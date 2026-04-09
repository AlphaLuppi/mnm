CREATE TABLE oauth_clients (
  client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_secret TEXT,
  client_name TEXT NOT NULL,
  redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  grant_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  company_id UUID NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  resource TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX oauth_refresh_tokens_expires_idx ON oauth_refresh_tokens(expires_at);
