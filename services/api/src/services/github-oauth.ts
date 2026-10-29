import {
  UnauthorizedError,
  ValidationError,
  type UserRole,
} from "@magnexis/shared";
import type { Pool } from "pg";
import { createSessionToken } from "../plugins/auth.js";

export type GitHubIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  login?: string;
};

export async function exchangeGitHubCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GitHubIdentity> {
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: options.code,
        redirect_uri: options.redirectUri,
      }),
    },
  );
  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenPayload.access_token) {
    throw new UnauthorizedError(
      tokenPayload.error_description ||
        "GitHub sign-in could not be completed.",
    );
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokenPayload.access_token}`,
    "User-Agent": "Magnexis-Maps",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const userRes = await fetch("https://api.github.com/user", { headers });
  const user = (await userRes.json().catch(() => ({}))) as {
    id?: number;
    login?: string;
    name?: string | null;
    email?: string | null;
  };
  if (!userRes.ok || user.id == null) {
    throw new UnauthorizedError("GitHub did not return a usable profile.");
  }

  let email =
    typeof user.email === "string" && user.email.includes("@")
      ? user.email.toLowerCase()
      : null;
  let emailVerified = Boolean(email);

  const emailsRes = await fetch("https://api.github.com/user/emails", {
    headers,
  });
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const preferred =
      emails.find((e) => e.primary && e.verified) ||
      emails.find((e) => e.verified) ||
      emails.find((e) => e.primary) ||
      emails[0];
    if (preferred?.email) {
      email = preferred.email.toLowerCase();
      emailVerified = preferred.verified === true;
    }
  }

  if (!email) {
    throw new ValidationError(
      "Your GitHub account has no email Magnexis Maps can use. Add a public or verified email on GitHub, then try again.",
    );
  }
  if (!emailVerified) {
    throw new ValidationError(
      "Verify your GitHub email address before signing in to Magnexis Maps.",
    );
  }

  return {
    id: String(user.id),
    email,
    emailVerified: true,
    name: user.name?.trim() || user.login || undefined,
    login: user.login,
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

export async function upsertGitHubUser(
  pool: Pool,
  identity: GitHubIdentity,
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
  let row = await loadUserWithRoles(pool, "u.github_id = $1", [identity.id]);

  if (!row) {
    const byEmail = await pool.query<{
      id: string;
      github_id: string | null;
    }>(
      `SELECT id, github_id FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [identity.email],
    );
    const existing = byEmail.rows[0];
    if (existing) {
      if (existing.github_id && existing.github_id !== identity.id) {
        throw new ValidationError(
          "This email is already linked to a different GitHub account.",
        );
      }
      await pool.query(
        `UPDATE users
         SET github_id = $1,
             email_verified = TRUE,
             display_name = CASE
               WHEN display_name IS NULL OR btrim(display_name) = '' THEN $2
               ELSE display_name
             END,
             updated_at = NOW()
         WHERE id = $3`,
        [
          identity.id,
          identity.name ?? identity.login ?? identity.email.split("@")[0]!,
          existing.id,
        ],
      );
      row = await loadUserWithRoles(pool, "u.id = $1", [existing.id]);
    } else {
      const displayName =
        identity.name ??
        identity.login ??
        identity.email.split("@")[0] ??
        "Magnexis user";
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name, email_verified, github_id)
         VALUES ($1, NULL, $2, TRUE, $3)
         RETURNING id`,
        [identity.email, displayName, identity.id],
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
    throw new UnauthorizedError("GitHub sign-in could not create a session.");
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
