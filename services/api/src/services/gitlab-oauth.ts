import {
  UnauthorizedError,
  ValidationError,
  type UserRole,
} from "@magnexis/shared";
import type { Pool } from "pg";
import { createSessionToken } from "../plugins/auth.js";

export type GitLabIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  username?: string;
};

export async function exchangeGitLabCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GitLabIdentity> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code: options.code,
    grant_type: "authorization_code",
    redirect_uri: options.redirectUri,
  });
  const tokenRes = await fetch("https://gitlab.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenPayload.access_token) {
    throw new UnauthorizedError(
      tokenPayload.error_description ||
        "GitLab sign-in could not be completed.",
    );
  }

  const userRes = await fetch("https://gitlab.com/api/v4/user", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const user = (await userRes.json().catch(() => ({}))) as {
    id?: number;
    username?: string;
    name?: string | null;
    email?: string | null;
    public_email?: string | null;
    confirmed_at?: string | null;
  };
  if (!userRes.ok || user.id == null) {
    throw new UnauthorizedError("GitLab did not return a usable profile.");
  }

  const rawEmail = user.email || user.public_email;
  if (!rawEmail || !rawEmail.includes("@")) {
    throw new ValidationError(
      "Your GitLab profile has no email Magnexis Maps can use. Add a verified email on GitLab, then try again.",
    );
  }

  return {
    id: String(user.id),
    email: rawEmail.toLowerCase(),
    // GitLab does not expose a verified flag with its OAuth profile. A token
    // issued for the account proves control of the identity; email is treated
    // as verified only when GitLab returns a primary account email.
    emailVerified: Boolean(user.email),
    name: user.name?.trim() || user.username || undefined,
    username: user.username,
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

export async function upsertGitLabUser(
  pool: Pool,
  identity: GitLabIdentity,
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
  let row = await loadUserWithRoles(pool, "u.gitlab_id = $1", [identity.id]);

  if (!row) {
    const byEmail = await pool.query<{
      id: string;
      gitlab_id: string | null;
    }>(
      `SELECT id, gitlab_id FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [identity.email],
    );
    const existing = byEmail.rows[0];
    if (existing) {
      if (existing.gitlab_id && existing.gitlab_id !== identity.id) {
        throw new ValidationError(
          "This email is already linked to a different GitLab account.",
        );
      }
      await pool.query(
        `UPDATE users
         SET gitlab_id = $1,
             email_verified = email_verified OR $2,
             display_name = CASE
               WHEN display_name IS NULL OR btrim(display_name) = '' THEN $3
               ELSE display_name
             END,
             updated_at = NOW()
         WHERE id = $4`,
        [
          identity.id,
          identity.emailVerified,
          identity.name ?? identity.username ?? identity.email.split("@")[0]!,
          existing.id,
        ],
      );
      row = await loadUserWithRoles(pool, "u.id = $1", [existing.id]);
    } else {
      const displayName =
        identity.name ??
        identity.username ??
        identity.email.split("@")[0] ??
        "Magnexis user";
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name, email_verified, gitlab_id)
         VALUES ($1, NULL, $2, $3, $4)
         RETURNING id`,
        [identity.email, displayName, identity.emailVerified, identity.id],
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
    throw new UnauthorizedError("GitLab sign-in could not create a session.");
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
