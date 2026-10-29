# Account deletion

The shared web/iPhone Account panel provides permanent account deletion after sign-in. It requires the current password and the exact confirmation `DELETE`, explains the data scope, and can also remove favorites, home/work and recent history from the current device. Appearance settings and other devices' storage are preserved. Device cleanup occurs only after the API confirms deletion; cleanup failures are distinguished from server failures.

`DELETE /api/v1/me` requires the session bearer token and JSON `{ "password": "current password", "confirmation": "DELETE" }`. The API derives the user from the authenticated session; it rejects a supplied user ID or unknown fields. Success is `{ "deleted": true }`. Invalid input is 400, an absent/invalid session is 401, a wrong password is 403, excessive attempts are 429, and transactional failures are 503 with `ACCOUNT_DELETION_UNAVAILABLE`. Never log request bodies or passwords.

Apply `infrastructure/migrations/002_account_deletion.sql` before enabling deletion. It permits anonymous moderator references so public moderation history can be preserved without a deleted account link.

## Data scope

The service locks the account, verifies its password, and performs all database changes in one transaction. It removes the user and cascading sessions, roles, preferences, account saves and votes; removes submitted correction reports and associated evidence references, proposals and moderation records; removes incident reports and business claims/updates. It anonymizes attribution on retained place versions and moderation/review history, and clears identifying metadata on related audit entries. A failure rolls back every change. Published place information remains as public map data.

Evidence currently consists of database URL/metadata records, not an implemented file-upload store. If a blob storage integration is added, connect deletion of its uploaded objects before advertising equivalent deletion coverage. Active database deletion cannot directly erase third-party access logs or recovery copies; operator/provider retention must be disclosed. Support submissions are separate Netlify Forms records and need support-dashboard removal when requested.

## Regression verification

From `services/api`, set `MAGNEXIS_ACCOUNT_TEST_DATABASE_URL` to a local PostgreSQL/PostGIS test instance and run `pnpm test`. The integration suite creates and drops its own randomly named schema, uses the real migrations and account/session code, and never truncates the normal application schema. It covers another user's data, invalid credentials/confirmation, account reuse, concurrent requests, missing sessions, rate limiting, CORS and transaction rollback. Without the explicit local test URL those database tests are skipped.
