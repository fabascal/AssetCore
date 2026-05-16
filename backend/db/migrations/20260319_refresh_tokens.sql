-- Refresh tokens for session hardening (HttpOnly cookies + rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           SERIAL       PRIMARY KEY,
  token_hash   VARCHAR(128) NOT NULL UNIQUE,
  user_id      INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family       VARCHAR(64)  NOT NULL,
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family  ON refresh_tokens(family);
