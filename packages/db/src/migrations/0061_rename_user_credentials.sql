-- Migration 0061: Rename user_mcp_credentials → user_credentials
-- + extend provider CHECK constraint to include 'pat'
-- + extend config_layer_items.item_type CHECK to include 'git_provider'

ALTER TABLE user_mcp_credentials RENAME TO user_credentials;

ALTER INDEX user_mcp_credentials_user_company_item_uq
  RENAME TO user_credentials_user_company_item_uq;
ALTER INDEX user_mcp_credentials_user_company_idx
  RENAME TO user_credentials_user_company_idx;
ALTER INDEX user_mcp_credentials_expiring_idx
  RENAME TO user_credentials_expiring_idx;

ALTER TABLE user_credentials
  DROP CONSTRAINT IF EXISTS user_mcp_credentials_provider_check;
ALTER TABLE user_credentials
  ADD CONSTRAINT user_credentials_provider_check
  CHECK (provider IN ('oauth2', 'api_key', 'bearer', 'pat', 'custom'));

-- GAP-01: Update CHECK constraint on config_layer_items.item_type to include 'git_provider'
ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;
ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check
  CHECK (item_type IN ('mcp', 'skill', 'hook', 'setting', 'git_provider'));
