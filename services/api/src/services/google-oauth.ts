import { OAuth2Client } from "google-auth-library";
import {
  UnauthorizedError,
  ValidationError,
  type UserRole,
} from "@magnexis/shared";
import type { Pool } from "pg";
import { createSessionToken } from "../plugins/auth.js";

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
};

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleIdentity> {
  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError("Google sign-in could not be verified.");
  }

  if (!payload?.sub || !payload.email) {
    throw new UnauthorizedError("Google sign-in did not return a usable identity.");
  }
  if (payload.email_verified !== true) {
    throw new ValidationError(
      "Verify your Google email address before signing in to Magnexis Maps.",
    );
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name?.trim() || undefined,
  };
}

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  created_at: Date;
  roles: string[] | null;
};

async function loadUserWithRoles(
  pool: Pool,
  whereSql: string,
  params: unknown[],
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT u.id, u.email, u.display_name, u.email_verified, u.created_at,
            COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE ${whereSql} AND u.deleted_at IS NULL
     GROUP BY u.id`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function upsertGoogleUser(
  pool: Pool,
  identity: GoogleIdentity,
  jwtSecret: string,
): Promise<{
  user: {
    id: string;
    email: string;
    displayName: string;
    roles: UserRole[];
    emailVerified: boolean;
    createdAt: string;
  };
  token: string;
}> {
  let row = await loadUserWithRoles(pool, "u.google_sub = $1", [identity.sub]);

  if (!row) {
    const byEmail = await pool.query<{
      id: string;
      google_sub: string | null;
    }>(
      `SELECT id, google_sub FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [identity.email],
    );
    const existing = byEmail.rows[0];
    if (existing) {
      if (existing.google_sub && existing.google_sub !== identity.sub) {
        throw new ValidationError(
          "This email is already linked to a different Google account.",
        );
      }
      await pool.query(
        `UPDATE users
         SET google_sub = $1,
             email_verified = TRUE,
             display_name = CASE
               WHEN display_name IS NULL OR btrim(display_name) = '' THEN $2
               ELSE display_name
             END,
             updated_at = NOW()
         WHERE id = $3`,
        [
          identity.sub,
          identity.name ?? identity.email.split("@")[0]!,
          existing.id,
        ],
      );
      row = await loadUserWithRoles(pool, "u.id = $1", [existing.id]);
    } else {
      const displayName =
        identity.name ?? identity.email.split("@")[0] ?? "Magnexis user";
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name, email_verified, google_sub)
         VALUES ($1, NULL, $2, TRUE, $3)
         RETURNING id`,
        [identity.email, displayName, identity.sub],
      );
      const userId = inserted.rows[0]!.id;
      await pool.query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'user')`,
        [userId],
      );
      await pool.query(`INSERT INTO user_preferences (user_id) VALUES ($1)`, [
        userId,
      ]);
      row = await loadUserWithRoles(pool, "u.id = $1", [userId]);
    }
  }

  if (!row) {
    throw new UnauthorizedError("Google sign-in could not create a session.");
  }

  const token = createSessionToken(row, jwtSecret);
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
}
