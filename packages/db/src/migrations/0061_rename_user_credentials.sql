-- Migration 0061: Rename user_mcp_credentials → user_credentials
-- + extend provider CHECK constraint to include 'pat'
-- + extend config_layer_items.item_type CHECK to include 'git_provider'

-- Idempotent table rename
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_mcp_credentials') THEN
    ALTER TABLE user_mcp_credentials RENAME TO user_credentials;
  END IF;
END $$;--> statement-breakpoint

-- Idempotent index renames
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_mcp_credentials_user_company_item_uq') THEN
    ALTER INDEX user_mcp_credentials_user_company_item_uq RENAME TO user_credentials_user_company_item_uq;
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_mcp_credentials_user_company_idx') THEN
    ALTER INDEX user_mcp_credentials_user_company_idx RENAME TO user_credentials_user_company_idx;
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'user_mcp_credentials_expiring_idx') THEN
    ALTER INDEX user_mcp_credentials_expiring_idx RENAME TO user_credentials_expiring_idx;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE user_credentials
  DROP CONSTRAINT IF EXISTS user_mcp_credentials_provider_check;--> statement-breakpoint
ALTER TABLE user_credentials
  ADD CONSTRAINT user_credentials_provider_check
  CHECK (provider IN ('oauth2', 'api_key', 'bearer', 'pat', 'custom'));--> statement-breakpoint

-- GAP-01: Update CHECK constraint on config_layer_items.item_type to include 'git_provider'
ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;--> statement-breakpoint
ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check
  CHECK (item_type IN ('mcp', 'skill', 'hook', 'setting', 'git_provider'));--> statement-breakpoint

ALTER TABLE user_credentials
  DROP CONSTRAINT IF EXISTS user_credentials_status_check;--> statement-breakpoint
ALTER TABLE user_credentials
  ADD CONSTRAINT user_credentials_status_check
  CHECK (status IN ('pending', 'connected', 'expired', 'revoked', 'error'));--> statement-breakpoint

-- Re-assert RLS after rename (safety net)
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE user_credentials FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON user_credentials;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON user_credentials
  AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
