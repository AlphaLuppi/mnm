-- scripts/migrate-2026-04-26-db.sql
--
-- OPS-1b — M2 of docs/superpowers/plans/2026-04-26-mnm-git-first-agents.md
--
-- Single-transaction DB updates that flip the demo company from the legacy
-- repo layout to the Git-first agents layout.
--
-- Run AFTER M0 (Drizzle migration 0067 + 0068 applied) AND AFTER M1
-- (mnm-demo repo + agents/v1.0.0 + feature-dev/v1.0.2 tags exist).
--
-- After commit, REQUIRED restart of the MnM dev server because the
-- resolveGitProvider cache is process-lifetime (cf. plan §M2).
--
-- Usage:
--   psql "$MNM_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-2026-04-26-db.sql
--
-- The config_layer_item ID is discovered dynamically from `kind = 'gitlab'`
-- + projectId LIKE the demo repo. If the discovery query matches 0 or >1
-- rows the script aborts with a RAISE EXCEPTION before doing any UPDATE.

\set ON_ERROR_STOP on

-- Pre-flight: fail fast if M0 wasn't applied (B-3 round 2 guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'archived_at'
  ) THEN
    RAISE EXCEPTION 'M0 not applied: column agents.archived_at is missing. Run "bun run db:migrate" first.';
  END IF;
END
$$;

-- Defensive log: pre-count the rows we are about to archive (Nit-2).
-- If this returns 0, greeter/shouter aren't there — investigate before M3.
DO $$
DECLARE
  to_archive_count integer;
BEGIN
  SELECT COUNT(*) INTO to_archive_count
  FROM agents
  WHERE name IN ('greeter','shouter')
    AND company_id = 'c26214de-ada2-4f71-ba6f-90c686a6dd5c'
    AND archived_at IS NULL;
  RAISE NOTICE 'pre-archive: agents to archive (greeter/shouter) = %', to_archive_count;
END
$$;

BEGIN;

-- ── Discover the gitlab git_provider config_layer_item dynamically ────────
-- Match on kind=gitlab + projectId pointing to either the old
-- (mnm-workflows-tom) or the new (mnm-demo) repo path. We do this in a
-- single DO block so we can fail loudly on 0 or >1 matches inside the TX.

DO $$
DECLARE
  cli_id uuid;
  match_count integer;
BEGIN
  SELECT COUNT(*) INTO match_count
  FROM config_layer_items
  WHERE config_json->>'kind' = 'gitlab'
    AND (
      config_json->>'projectId' LIKE '%mnm-workflows-tom%'
      OR config_json->>'projectId' LIKE '%mnm-demo%'
    );

  IF match_count = 0 THEN
    RAISE EXCEPTION 'No gitlab config_layer_item found pointing at mnm-workflows-tom or mnm-demo. Aborting M2.';
  ELSIF match_count > 1 THEN
    RAISE EXCEPTION 'Multiple gitlab config_layer_items match (%) — refusing to UPDATE without manual disambiguation. Aborting M2.', match_count;
  END IF;

  SELECT id INTO cli_id
  FROM config_layer_items
  WHERE config_json->>'kind' = 'gitlab'
    AND (
      config_json->>'projectId' LIKE '%mnm-workflows-tom%'
      OR config_json->>'projectId' LIKE '%mnm-demo%'
    );

  UPDATE config_layer_items
  SET config_json = config_json
    || jsonb_build_object('projectId', 'your-username/mnm-demo')
    || jsonb_build_object('paths', jsonb_build_object('agents','agents','workflows','workflows'))
  WHERE id = cli_id;
  RAISE NOTICE 'config_layer_items updated: 1 row (id=%)', cli_id;
END
$$;

-- ── Archive greeter/shouter ────────────────────────────────────────────────

WITH archived AS (
  UPDATE agents
  SET archived_at = NOW(), enabled = false
  WHERE name IN ('greeter','shouter')
    AND company_id = 'c26214de-ada2-4f71-ba6f-90c686a6dd5c'
    AND archived_at IS NULL
  RETURNING name
)
SELECT 'agents archived: ' || COALESCE(string_agg(name, ', '), '(none)') AS info FROM archived;

-- ── Retag governed_workflow_definitions ───────────────────────────────────

WITH retagged AS (
  UPDATE governed_workflow_definitions
  SET latest_git_tag = 'feature-dev/v1.0.2'
  WHERE name = 'feature-dev'
    AND company_id = 'c26214de-ada2-4f71-ba6f-90c686a6dd5c'
  RETURNING name
)
SELECT 'governed_workflow_definitions retagged: ' || COALESCE(string_agg(name, ', '), '(none)') AS info FROM retagged;

COMMIT;

-- After COMMIT: restart `bun run dev` so the GitProvider cache picks up the
-- new `paths` configuration on next resolveGitProvider call.
