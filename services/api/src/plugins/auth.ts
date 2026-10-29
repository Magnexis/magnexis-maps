import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@magnexis/shared";
import { ForbiddenError, UnauthorizedError } from "@magnexis/shared";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
  emailVerified: boolean;
};

function signToken(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token: string, secret: string): Record<string, unknown> | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function createSessionToken(
  user: { id: string; email: string },
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return signToken({ sub: user.id, email: user.email, exp }, secret);
}

export async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", null);

  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      request.user = null;
      return;
    }
    const token = header.slice("Bearer ".length);
    const payload = verifyToken(token, app.config.jwtSecret);
    if (!payload?.sub || typeof payload.sub !== "string") {
      request.user = null;
      return;
    }
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) {
      request.user = null;
      return;
    }

    const result = await app.db.query<{
      id: string;
      email: string;
      display_name: string;
      email_verified: boolean;
      roles: string[] | null;
    }>(
      `SELECT u.id, u.email, u.display_name, u.email_verified,
              COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
      [payload.sub],
    );

    const row = result.rows[0];
    if (!row) {
      request.user = null;
      return;
    }

    request.user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      roles: (row.roles ?? []) as UserRole[],
      emailVerified: row.email_verified,
    };
  });
}

export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.user) {
    throw new UnauthorizedError();
  }
  return request.user;
}

export function requireRoles(
  request: FastifyRequest,
  roles: UserRole[],
): AuthUser {
  const user = requireAuth(request);
  if (!roles.some((r) => user.roles.includes(r))) {
    throw new ForbiddenError();
  }
  return user;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export { signToken, verifyToken };
