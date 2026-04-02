-- CONFIG-LAYERS: Add base_layer_id FK on agents table
ALTER TABLE "agents" ADD COLUMN "base_layer_id" uuid REFERENCES "config_layers"("id") ON DELETE RESTRICT;
