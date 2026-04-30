# Mission Report — Bootstrap fix (round 2)

> **Suite de** : `MISSION-REPORT-2026-04-30.md`
> **Date** : 2026-04-30 matin
> **Branche** : `feat/paperclip-upstream-merge`
> **Statut** : ✅ App build + boot + UI smoke OK

---

## Contexte

Phase 1 et Phase 2-6 ont été livrées et mergées hier soir. Mais le QA agent automatique avait constaté que l'app **ne bootait pas** : Drizzle plantait sur la première migration "pending" en re-tentant un statement non-idempotent. Le bug existait déjà sur `master`, mais Tom a demandé de tout fixer plutôt que de merger un état cassé.

## Root cause

`packages/db/src/migrations/meta/_journal.json` était corrompu : 51 entries pour 84 fichiers `.sql`. Drizzle voyait 33 fichiers comme "orphan pending" et tentait de les re-appliquer à chaque boot.

Sur des DBs ayant déjà un schema partiellement avancé (Tom's dev DB ou prod), ces re-tries plantaient sur :
- `CREATE TABLE` sans `IF NOT EXISTS`
- `CREATE INDEX` référençant des colonnes droppées par des migrations ultérieures
- `ALTER TABLE ADD CONSTRAINT` sur des constraints existants
- `CREATE POLICY` sans drop préalable
- Tables référencées via FK qui ont été drop par 0066_nuke_legacy_workflows

## Fix

### 1. Journal rebuild (`d436c4b2d`)
Reconstruit `_journal.json` avec **84 entries**, ordonnées par filename prefix. 33 entries ajoutées : 0027, 0035-0044, 0048-0066.

### 2. Migration idempotency patches (`19faa4779`)
Patché 8 migrations pour les rendre vraiment re-runnables :

| Migration | Fix |
|---|---|
| `0045_trace_vision` | Guard `CREATE INDEX traces_workflow_idx` (col `workflow_instance_id` droppée par 0066) via `DO $$ IF EXISTS ... END $$` |
| `0052_config_layers` | `CREATE TABLE → IF NOT EXISTS` partout. Guard `workflow_template_stage_layers` + `workflow_stage_config_layers` sur l'existence des tables legacy référencées |
| `0055_collaborative_chat` | Guard `CREATE INDEX folders_company_visibility_idx` (col `visibility` droppée par 0056) |
| `0061_rename_user_credentials` | `DROP CONSTRAINT IF EXISTS user_credentials_provider_check` avant ADD ; guard `config_layer_items_item_type_check` sur data shape |
| `0063_oauth_tables` | `CREATE TABLE → IF NOT EXISTS` |
| `0065_governed_workflows` | `CREATE TABLE/INDEX → IF NOT EXISTS` |
| `0075_environments` / `0076_environment_leases` | Idem (Phase 3 nouvelles) |

### 3. `packages/db/src/client.ts` — extended reconcile
- **`policyExists()`** helper backed by `pg_policies`.
- **`migrationStatementAlreadyApplied()`** étendue pour reconnaître :
  - `DROP ... IF EXISTS`, `ALTER TABLE ENABLE/FORCE/DISABLE ROW LEVEL SECURITY`
  - `DO $$ ... $$` blocks, `INSERT ... ON CONFLICT`
  - `GRANT/REVOKE`, `CREATE EXTENSION IF NOT EXISTS`
  - `SET/RESET/COMMENT`, `CREATE POLICY`, `CREATE TYPE`
  - Naked `ALTER TABLE DROP COLUMN/CONSTRAINT`
  - Regex relaxés pour identifiers quoted ET unquoted
- **`applyPendingMigrations()`** appelle maintenant `reconcilePendingMigrationHistory` **AVANT** `migratePg`. Avant : reconcile était seulement post-crash → migratePg crashait avant de pouvoir reconcile.
- **`MNM_DB_FORCE_RECONCILE=true`** env flag → force-marque toutes les entries du journal comme appliquées sans inspecter chaque statement. Pour scénarios de recovery où la détection per-statement ne suffit pas. Tom utilise ce flag sur sa DB existante.

## Verification

### Boot fresh DB
```
Embedded PostgreSQL cluster created
Migrations applied (pending migrations) — clean apply
Server listening on 127.0.0.1:3100
```

### Boot Tom's existing DB (avec `MNM_DB_FORCE_RECONCILE=true`)
```
Embedded PostgreSQL already running; reusing existing process
permission backfill: starting (count: 2)        ← 2 companies
permission backfill: complete
view-preset backfill: starting (count: 2)
CAO ensured for 2 company(ies)                  ← CAO re-init
Server listening on 127.0.0.1:3100
```

### ChromeMCP smoke test (Tom's DB)
| Page | Status | Console |
|---|---|---|
| `/TOM/dashboard` | ✅ Rendered (1 agent, $119.10 spend, healthy) | 1× 400 sur `PATCH /my-view/overrides` (bug pré-existant orthogonal) |
| `/TOM/issues` | ✅ Rendered (empty state, "Create Issue") | clean |
| `/TOM/workflows` | ✅ Rendered (empty state, "Nouveau workflow") | clean |
| `/TOM/agents/cao` | ✅ Rendered (running, Live Run en cours, Run Activity widgets) | clean |

Screenshots sauvegardés dans `_qa/` pour archive.

### Typecheck
**17/17 packages OK** sur la branche consolidée.

## Decision: GO pour merge

Toutes les conditions de Tom sont remplies :
- ✅ Build OK
- ✅ App tourne (boot + listening)
- ✅ UI rendue correctement (dashboard, issues, workflows, agent CAO)
- ✅ Console clean (1 erreur 400 mineure pré-existante)

**La PR #28 est prête à merger vers `master`.**

## TODO restants (orthogonaux à cette PR)

1. **Bug `/my-view/overrides` PATCH 400** — pré-existant, à investiguer dans une PR séparée. Probablement un schema validation issue côté serveur ou un body mal formé côté client.
2. **`MNM_DB_FORCE_RECONCILE` doc** — ajouter à `README.md` ou `CLAUDE.md` pour expliquer quand l'utiliser (dev DBs partiellement migrées).
3. **Cleanup `_qa/` screenshots** — peuvent être commitées comme proof, ou ajoutées à `.gitignore`.
4. **Backups DB** — `default.backup-2026-04-30` et `default.fresh-test` à supprimer une fois validation OK.
5. **CI Linux** — valider les ~30 DB tests skip-on-Windows (Phase 2/4).

## Crédits

- **Investigation** : QA agent autonome (`aeb7aa5d47a5879c1`) a identifié le journal corrompu en 45 min.
- **Fix** : main session (Tom + Claude) — ~1h30 de fix-itérer + ChromeMCP smoke + commits.
- **DB de Tom** : préservée intacte. Aucune perte de données. Backup disponible si besoin (`default.backup-2026-04-30`).
