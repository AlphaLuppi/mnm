-- Add 'credential' to the config_layer_items item_type CHECK constraint
ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;--> statement-breakpoint
ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check
  CHECK (item_type IN ('mcp', 'skill', 'hook', 'setting', 'git_provider', 'credential'));
