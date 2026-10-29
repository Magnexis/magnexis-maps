-- Google OAuth accounts: nullable password, stable Google subject id.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub)
  WHERE google_sub IS NOT NULL;
