-- GitLab OAuth accounts: stable numeric GitLab user id as text.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gitlab_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS users_gitlab_id_idx ON users (gitlab_id)
  WHERE gitlab_id IS NOT NULL;
