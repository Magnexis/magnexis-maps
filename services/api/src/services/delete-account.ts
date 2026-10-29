import type { Pool, PoolClient } from "pg";
import bcrypt from "bcryptjs";
import {
  ForbiddenError,
  MagnexisError,
  UnauthorizedError,
} from "@magnexis/shared";

/** Remove private account records atomically; preserve only anonymous map history. */
export async function deleteAccount(
  pool: Pool,
  userId: string,
  password: string | undefined,
): Promise<void> {
  let client: PoolClient | undefined;
  let transaction = false;
  let destroyConnection = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transaction = true;
    // Locks the account against concurrent deletions and new FK-linked records.
    const account = await client.query<{
      password_hash: string | null;
      google_sub: string | null;
      github_id: string | null;
    }>(
      "SELECT password_hash, google_sub, github_id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [userId],
    );
    if (!account.rows[0])
      throw new UnauthorizedError(
        "Your session is no longer active. Sign in again.",
      );
    const {
      password_hash: hash,
      google_sub: googleSub,
      github_id: githubId,
    } = account.rows[0];
    const oauthOnly = Boolean(googleSub || githubId);
    if (hash) {
      if (!password) {
        throw new ForbiddenError(
          "Enter your current password to delete this account.",
        );
      }
      if (!(await bcrypt.compare(password, hash))) {
        throw new ForbiddenError(
          "The password did not match. Your account has not been deleted.",
        );
      }
    } else if (!oauthOnly) {
      throw new ForbiddenError(
        "This account cannot be deleted with the provided confirmation.",
      );
    } else if (password) {
      throw new ForbiddenError(
        "This account has no password. Confirm with DELETE only.",
      );
    }

    // Scrub audit payloads before removing the reports used to identify them.
    await client.query(
      `UPDATE audit_logs SET actor_id = NULL, metadata = '{}'::jsonb
      WHERE actor_id = $1 OR (resource_type IN ('user','account') AND resource_id = $1::text)
      OR (resource_type = 'report' AND resource_id IN (SELECT id::text FROM correction_reports WHERE submitter_id = $1))`,
      [userId],
    );
    await client.query(
      "UPDATE place_versions SET changed_by = NULL WHERE changed_by = $1",
      [userId],
    );
    await client.query(
      "UPDATE moderation_actions SET moderator_id = NULL, notes = NULL WHERE moderator_id = $1",
      [userId],
    );
    await client.query(
      "UPDATE report_status_history SET actor_id = NULL, reason = NULL WHERE actor_id = $1",
      [userId],
    );
    await client.query(
      "UPDATE business_claims SET reviewed_by = NULL WHERE reviewed_by = $1",
      [userId],
    );
    await client.query(
      "UPDATE business_updates SET reviewed_by = NULL WHERE reviewed_by = $1",
      [userId],
    );
    await client.query("DELETE FROM business_updates WHERE claimant_id = $1", [
      userId,
    ]);
    await client.query("DELETE FROM business_claims WHERE claimant_id = $1", [
      userId,
    ]);
    await client.query("DELETE FROM report_evidence WHERE uploaded_by = $1", [
      userId,
    ]);
    // Report children (proposals, evidence, votes, moderation and status events)
    // cascade. Applied place corrections are independent geographic records.
    await client.query(
      "DELETE FROM correction_reports WHERE submitter_id = $1",
      [userId],
    );
    await client.query("DELETE FROM incident_reports WHERE reporter_id = $1", [
      userId,
    ]);
    // Cascades sessions, user_roles, preferences, saved places, and remaining votes.
    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
    transaction = false;
  } catch (error) {
    if (client && transaction) {
      try {
        await client.query("ROLLBACK");
      } catch {
        destroyConnection = true;
      }
    }
    if (error instanceof MagnexisError) throw error;
    // Do not include SQL row contents, hashes, submitted passwords or raw DB errors.
    throw new MagnexisError(
      "Account deletion could not be completed. Try again later; if the problem continues, contact support.",
      "ACCOUNT_DELETION_UNAVAILABLE",
      503,
    );
  } finally {
    client?.release(destroyConnection);
  }
}
