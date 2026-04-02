-- CONFIG-LAYERS: Migrate existing agent adapterConfig to base layers
DO $$
DECLARE
  agent_rec RECORD;
  new_layer_id uuid;
  cfg jsonb;
  runtime_cfg jsonb;
  setting_key text;
  setting_value jsonb;
BEGIN
  FOR agent_rec IN
    SELECT id, company_id, name, adapter_config, runtime_config, created_by_user_id
    FROM agents
    WHERE base_layer_id IS NULL
      AND (adapter_config IS NOT NULL AND adapter_config != '{}'::jsonb)
  LOOP
    INSERT INTO config_layers (company_id, name, scope, visibility, is_base_layer, created_by_user_id, owner_type)
    VALUES (
      agent_rec.company_id,
      'Base: ' || agent_rec.name,
      'private', 'private', true,
      COALESCE(agent_rec.created_by_user_id, 'system'), 'user'
    ) RETURNING id INTO new_layer_id;

    cfg := agent_rec.adapter_config;
    runtime_cfg := COALESCE(agent_rec.runtime_config, '{}'::jsonb);

    IF cfg ? 'model' THEN
      INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
      VALUES (agent_rec.company_id, new_layer_id, 'setting', 'model',
              jsonb_build_object('key', 'model', 'value', cfg->'model'));
    END IF;

    IF cfg ? 'cwd' THEN
      INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
      VALUES (agent_rec.company_id, new_layer_id, 'setting', 'cwd',
              jsonb_build_object('key', 'cwd', 'value', cfg->'cwd'));
    END IF;

    IF runtime_cfg ? 'heartbeat' AND (runtime_cfg->'heartbeat') ? 'timeoutSec' THEN
      INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
      VALUES (agent_rec.company_id, new_layer_id, 'setting', 'timeoutSec',
              jsonb_build_object('key', 'timeoutSec', 'value', runtime_cfg->'heartbeat'->'timeoutSec'));
    END IF;

    IF cfg ? 'env' AND jsonb_typeof(cfg->'env') = 'object' THEN
      FOR setting_key, setting_value IN SELECT * FROM jsonb_each(cfg->'env')
      LOOP
        INSERT INTO config_layer_items (company_id, layer_id, item_type, name, config_json)
        VALUES (agent_rec.company_id, new_layer_id, 'setting', 'env.' || setting_key,
                jsonb_build_object('key', 'env.' || setting_key, 'value', setting_value));
      END LOOP;
    END IF;

    INSERT INTO config_layer_revisions (company_id, layer_id, version, changed_keys, after_snapshot, changed_by, change_source)
    VALUES (agent_rec.company_id, new_layer_id, 1, '["migration"]'::jsonb,
            jsonb_build_object('source', 'adapterConfig', 'agent_id', agent_rec.id::text),
            COALESCE(agent_rec.created_by_user_id, 'system'), 'migration');

    UPDATE agents SET base_layer_id = new_layer_id WHERE id = agent_rec.id;
  END LOOP;
END
$$;
