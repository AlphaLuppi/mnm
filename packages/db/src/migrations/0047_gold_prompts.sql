-- PIPE-03: Gold schema + prompts table
-- Adds gold JSONB column to traces, creates gold_prompts config table

ALTER TABLE traces ADD COLUMN IF NOT EXISTS gold jsonb;

CREATE TABLE IF NOT EXISTS gold_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  scope text NOT NULL,
  scope_id uuid,
  prompt text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gold_prompts_scope_idx ON gold_prompts(company_id, scope, scope_id);

-- RLS
ALTER TABLE gold_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_prompts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gold_prompts_rls' AND tablename = 'gold_prompts') THEN
    CREATE POLICY gold_prompts_rls ON gold_prompts USING (company_id::text = current_setting('app.current_company_id', true));
  END IF;
END $$;

-- Seed a default global prompt for each company
INSERT INTO gold_prompts (company_id, scope, prompt, is_active)
SELECT id, 'global',
  'Analyse cette trace d''agent et produis pour chaque phase: un score de pertinence (0-100), une annotation expliquant ce qui s''est passé et pourquoi, et un verdict (success/partial/failure). Produis aussi un verdict global et identifie les observations clés. Si une issue est liée, évalue chaque critère d''acceptation.',
  true
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM gold_prompts gp WHERE gp.company_id = companies.id AND gp.scope = 'global'
);
