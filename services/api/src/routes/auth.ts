import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import {
  CreateSavedPlaceSchema,
  GitHubAuthCodeSchema,
  GoogleIdTokenSchema,
  LoginSchema,
  RegisterSchema,
  UnauthorizedError,
  ValidationError,
  type UserRole,
} from "@magnexis/shared";
import { createSessionToken, requireAuth } from "../plugins/auth.js";
import {
  upsertGoogleUser,
  verifyGoogleIdToken,
} from "../services/google-oauth.js";
import {
  exchangeGitHubCode,
  upsertGitHubUser,
} from "../services/github-oauth.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/v1/auth/google/status", async () => ({
    configured: Boolean(app.config.googleOauthClientId),
    clientId: app.config.googleOauthClientId
      ? app.config.googleOauthClientId
      : null,
  }));

  app.post("/api/v1/auth/google", async (request, reply) => {
    const clientId = app.config.googleOauthClientId;
    if (!clientId) {
      throw new ValidationError(
        "Google sign-in is not configured. Set GOOGLE_OAUTH_CLIENT_ID on the API.",
      );
    }
    const body = GoogleIdTokenSchema.parse(request.body);
    const identity = await verifyGoogleIdToken(body.idToken, clientId);
    const session = await upsertGoogleUser(
      app.db,
      identity,
      app.config.jwtSecret,
    );
    return reply.send(session);
  });

  app.get("/api/v1/auth/github/status", async () => ({
    configured: Boolean(
      app.config.githubOauthClientId && app.config.githubOauthClientSecret,
    ),
    clientId: app.config.githubOauthClientId
      ? app.config.githubOauthClientId
      : null,
  }));

  app.post("/api/v1/auth/github", async (request, reply) => {
    const clientId = app.config.githubOauthClientId;
    const clientSecret = app.config.githubOauthClientSecret;
    if (!clientId || !clientSecret) {
      throw new ValidationError(
        "GitHub sign-in is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET on the API.",
      );
    }
    const body = GitHubAuthCodeSchema.parse(request.body);
    const identity = await exchangeGitHubCode({
      code: body.code,
      clientId,
      clientSecret,
      redirectUri: body.redirectUri,
    });
    const session = await upsertGitHubUser(
      app.db,
      identity,
      app.config.jwtSecret,
    );
    return reply.send(session);
  });


  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = RegisterSchema.parse(request.body);
    const existing = await app.db.query(`SELECT id FROM users WHERE email = $1`, [
      body.email.toLowerCase(),
    ]);
    if (existing.rowCount) {
      throw new ValidationError("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await app.db.query<{
      id: string;
      email: string;
      display_name: string;
      email_verified: boolean;
      created_at: Date;
    }>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, email_verified, created_at`,
      [body.email.toLowerCase(), passwordHash, body.displayName],
    );
    const row = user.rows[0]!;
    await app.db.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'user')`,
      [row.id],
    );
    await app.db.query(
      `INSERT INTO user_preferences (user_id) VALUES ($1)`,
      [row.id],
    );

    const token = createSessionToken(row, app.config.jwtSecret);
    return reply.status(201).send({
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        roles: ["user"] as UserRole[],
        emailVerified: row.email_verified,
        createdAt: row.created_at.toISOString(),
      },
      token,
      notice:
        "Email verification workflow is scaffolded; treat accounts as unverified until confirmation is completed.",
    });
  });

  app.post("/api/v1/auth/login", async (request) => {
    const body = LoginSchema.parse(request.body);
    const result = await app.db.query<{
      id: string;
      email: string;
      display_name: string;
      email_verified: boolean;
      created_at: Date;
      password_hash: string | null;
      roles: string[] | null;
    }>(
      `SELECT u.id, u.email, u.display_name, u.email_verified, u.created_at, u.password_hash,
              COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.email = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
      [body.email.toLowerCase()],
    );
    const row = result.rows[0];
    if (!row) throw new UnauthorizedError("Invalid email or password");
    if (!row.password_hash) {
      throw new ValidationError(
        "This account uses Google or GitHub sign-in. Continue with that provider instead of a password.",
      );
    }

    const ok = await bcrypt.compare(body.password, row.password_hash);
    if (!ok) throw new UnauthorizedError("Invalid email or password");

    const token = createSessionToken(row, app.config.jwtSecret);
    return {
      user: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        roles: (row.roles ?? []) as UserRole[],
        emailVerified: row.email_verified,
        createdAt: row.created_at.toISOString(),
      },
      token,
    };
  });

  app.get("/api/v1/me", async (request) => {
    const user = requireAuth(request);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        emailVerified: user.emailVerified,
        createdAt: new Date().toISOString(),
      },
    };
  });

  app.get("/api/v1/me/saved-places", async (request) => {
    const user = requireAuth(request);
    const result = await app.db.query(
      `SELECT id, place_id, label, notes, created_at,
              ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
       FROM saved_places
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id],
    );
    return {
      savedPlaces: result.rows.map((r) => ({
        id: r.id,
        placeId: r.place_id,
        label: r.label,
        notes: r.notes,
        coordinates: { lng: r.lng, lat: r.lat },
        createdAt: (r.created_at as Date).toISOString(),
      })),
    };
  });

  app.post("/api/v1/me/saved-places", async (request, reply) => {
    const user = requireAuth(request);
    const body = CreateSavedPlaceSchema.parse(request.body);
    const result = await app.db.query(
      `INSERT INTO saved_places (user_id, place_id, label, geom, notes)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6)
       RETURNING id, place_id, label, notes, created_at,
                 ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat`,
      [
        user.id,
        body.placeId ?? null,
        body.label,
        body.lng,
        body.lat,
        body.notes ?? null,
      ],
    );
    const r = result.rows[0]!;
    return reply.status(201).send({
      savedPlace: {
        id: r.id,
        placeId: r.place_id,
        label: r.label,
        notes: r.notes,
        coordinates: { lng: r.lng, lat: r.lat },
        createdAt: (r.created_at as Date).toISOString(),
      },
    });
  });
}
