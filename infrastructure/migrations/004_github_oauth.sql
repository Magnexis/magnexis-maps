-- GitHub OAuth accounts: stable numeric GitHub user id as text.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS github_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS users_github_id_idx ON users (github_id)
  WHERE github_id IS NOT NULL;
