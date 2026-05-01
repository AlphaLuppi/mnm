-- packages/db/src/migrations/0078_session_bundle_runs.sql
-- Session-bundle runs : matérialiser les steps gouvernés exécutés côté client
-- (Claude Code via MCP) en heartbeat_runs, alimentés par le .jsonl de session
-- bundlé au complete_governed_step.
--
-- Spec: docs/superpowers/plans/2026-04-30-session-bundle-runs.md §Task 1.
-- Idempotent: IF NOT EXISTS guards on column adds and indexes.
-- Additive-only (CLAUDE.md "Architecture Decisions").

-- ── 1. heartbeat_runs : execution_mode + bundle metadata ────────────────────
--
-- execution_mode :
--   'server' (défaut) — le worker spawn le subprocess (claude_local, etc.).
--   'client'          — exécution côté MCP client, le worker NE DOIT PAS claim.
--                       Le run est créé par governedWorkflows.launchStep et
--                       finalisé par finalizeClientRun à completeStep.
--
-- bundle_format :
--   Identifiant versionné du parser à utiliser pour déchiffrer logRef.
--   V1 = 'claude-code-jsonl-v1'. NULL = run server-side classique.
--
-- bundle_sha256 :
--   Hash SHA-256 du contenu du session_file (après décompression). Utilisé
--   pour l'idempotence : si completeStep est retry avec le même bundle,
--   finalizeClientRun détecte le hash existant et no-op.
ALTER TABLE "heartbeat_runs"
  ADD COLUMN IF NOT EXISTS "execution_mode" text NOT NULL DEFAULT 'server',
  ADD COLUMN IF NOT EXISTS "bundle_format"  text,
  ADD COLUMN IF NOT EXISTS "bundle_sha256"  text;
--> statement-breakpoint

-- CHECK contraint sur execution_mode. Idempotent via DO block — pas de
-- IF NOT EXISTS pour les contraintes en PG.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'heartbeat_runs_execution_mode_chk'
  ) THEN
    ALTER TABLE "heartbeat_runs"
      ADD CONSTRAINT "heartbeat_runs_execution_mode_chk"
      CHECK ("execution_mode" IN ('server', 'client'));
  END IF;
END $$;
--> statement-breakpoint

-- ── 2. Index claim worker : ne sélectionner que les runs server-side ───────
--
-- Le worker `claimQueuedRun()` (server/src/services/heartbeat.ts) scanne les
-- runs status='queued'. Cet index partiel restreint le scan aux runs client
-- en 'running' (utile pour la timeline UI), tandis que le path serveur garde
-- son index existant heartbeat_runs_company_agent_started_idx pour le claim.
CREATE INDEX IF NOT EXISTS "heartbeat_runs_client_status_idx"
  ON "heartbeat_runs" ("status")
  WHERE "execution_mode" = 'client';
--> statement-breakpoint

-- ── 3. Index lookup par bundle_sha256 (idempotence dedup) ───────────────────
--
-- finalizeClientRun(runId, sessionFile) check d'abord
--   SELECT 1 FROM heartbeat_runs WHERE id = $1 AND bundle_sha256 = $2
-- Si match → no-op (le bundle a déjà été parsé pour ce run).
CREATE INDEX IF NOT EXISTS "heartbeat_runs_bundle_sha256_idx"
  ON "heartbeat_runs" ("bundle_sha256")
  WHERE "bundle_sha256" IS NOT NULL;
--> statement-breakpoint

-- ── 4. governed_step_executions : lien vers heartbeat_run client ────────────
--
-- Lien optionnel d'un step vers son client run. Set par launchStep quand le
-- step déclare la gate `session-file-bundled` dans ses exit gates. NULL pour
-- les steps sans capture de session (review humain, gate cron, etc.).
--
-- ON DELETE SET NULL : si le heartbeat_run est supprimé (purge), on garde le
-- step + ses artifacts, on perd juste le lien vers la timeline.
ALTER TABLE "governed_step_executions"
  ADD COLUMN IF NOT EXISTS "heartbeat_run_id" uuid
    REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Index pour le reverse-lookup "trouver le step depuis le run" (UI run detail
-- veut afficher 'step X.Y du workflow Z').
CREATE INDEX IF NOT EXISTS "governed_step_executions_heartbeat_run_id_idx"
  ON "governed_step_executions" ("heartbeat_run_id")
  WHERE "heartbeat_run_id" IS NOT NULL;
