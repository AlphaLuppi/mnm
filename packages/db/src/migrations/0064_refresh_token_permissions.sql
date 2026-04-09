ALTER TABLE oauth_refresh_tokens ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
