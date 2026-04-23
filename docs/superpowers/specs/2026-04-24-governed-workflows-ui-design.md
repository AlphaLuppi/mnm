# Governed Workflows UI — Design

**Date** : 2026-04-24
**Statut** : Design validé section par section, prêt pour writing-plans
**Auteurs** : Tom (cofondateur), Claude
**Objectif** : spécification technique pour l'implémentation des 4 pages UI des Governed Workflows + REST endpoints + nuke total de la feature legacy Workflows.

---

## Contexte et intention

La feature Governed Workflows est shippée côté backend (MCP tools T5, plugin T6, polish T7) mais non exposée en UI web — tout est piloté via MCP. Cette spec couvre :

1. **4 pages React** pour visualiser, éditer, lancer et monitorer les governed workflows
2. **Les endpoints REST** qui les sous-tendent (pagination, filtres, SSE)
3. **Le nuke total** de la feature legacy Workflows (tables, services, pages, UI), qui est devenue obsolète — Governed Workflows devient **le nouveau standard unique** pour la notion de workflow dans MnM.

Contraintes clés :
- **MnM n'est pas déployé** (pré-MVP). Pas de données à migrer, pas de compat à préserver. Nuke franc.
- Git = source de vérité pour tout contenu de workflow (workflow.json, gates, agents). La DB `governed_workflow_definitions` est un pur cache d'index pour la liste.
- Les runs governed s'exécutent **client-side** (sub-agents via Claude Code harness). Pas de traces serveur-side en MVP.

Sources à consulter avant implémentation :
- Design MVP backend : `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`
- Plan T7 : `docs/superpowers/plans/2026-04-22-T7-polish-distribution.md`
- Zod schemas : `packages/governed-workflows/src/`
- Service layer : `server/src/services/governed-workflows.ts`
- GitProvider : `packages/git-provider/src/types.ts` (méthodes `fetchBlob`, `commitFile`, `listTags`, `resolveRef`, `pathExists`)
- Migration 0065 : `packages/db/src/migrations/0065_governed_workflows.sql`

---

## Décisions actées

### D1 — Format éditable = JSON brut (Monaco + zod live)

L'éditeur affiche le JSON canonique qui matche `workflowDefinitionSchema` (`apiVersion`, `kind`, `name`, `description`, `variables`, `steps[]`). Validation zod debounce 300ms, erreurs en panel latéral avec `path` + `message` cliquables (jump au range Monaco).

Pas de formulaire structuré en MVP. Raisons : le schema zod évolue encore (gate types extensibles), les premiers users sont des leads techniques, les nested-arrays de gates sont pénibles à exprimer en form. Option post-MVP si besoin confirmé.

### D2 — Git = source de vérité, DB = cache d'index

- **Listing** : lit la DB (`governed_workflow_definitions` : `name`, `description`, `latest_git_tag`, `enabled`, `updated_at`). Pas d'appel git.
- **Load editor/detail** : `gitProvider.fetchBlob({path: "<name>/workflow.json", ref: latest_git_tag || "main"})`. Parse zod côté serveur, renvoie au client.
- **Save editor** : `gitProvider.commitFile({path, content, message, branch: "main", authorName, authorEmail})` sur `main` + calcul du prochain tag semver via `listTags()` + création du tag git. Puis upsert DB (`latest_git_tag` mis à jour).
- **Create new workflow** : même flow que Save avec nouveau path `<new-name>/workflow.json`. Insert DB row.
- **Delete** : soft-delete DB (`archived_at=now()` + `enabled=false`). Pas de suppression git (historique préservé).

**Aucune colonne `definition_json`, aucun flag `source`.** Pas de migration d'ajout côté governed — on réutilise la table existante avec une seule colonne supplémentaire `archived_at` (intégrée à la migration de nuke legacy).

**Stratégie de commit** : save = commit sur `main` + tag auto calculé par MnM (bump patch depuis le dernier tag, `v0.0.1` si aucun). Schéma de tag : `<workflow-name>/vX.Y.Z` (convention monorepo). Plus tard, `semantic-release` sera installé comme template dans les repos de workflows et remplacera le calcul manuel.

**Runs utilisent `latest_git_tag` par défaut**. Toggle "Launch from main HEAD (untagged)" dans la modale de launch pour cas dev/qualif — warning badge.

**Identité commit** : `session.user.name` + `session.user.email` de BetterAuth. Mode `local_trusted` : fallback `MnM Dev <dev@mnm.local>`.

**Token GitLab** : réutilise le `config_layer_item` de type `git_provider` per-company (T7 DEF-4). Zéro nouveau mécanisme d'auth.

### D3 — Nuke legacy intégral, governed devient le standard

MnM n'étant déployé nulle part, on supprime sans compat :

- **5 tables DB** : `workflow_templates`, `workflow_instances`, `stage_instances`, `workflow_stage_config_layers`, `workflow_template_stage_layers`.
- **Fichiers server** : `routes/workflows.ts`, `routes/orchestrator.ts`, `routes/stages.ts`, `routes/compaction.ts`, `services/workflows.ts`, `services/workflow-enforcer.ts`, `services/workflow-state-machine.ts`, `services/orchestrator.ts`, `services/stages.ts`, `services/compaction-watcher.ts`, `services/compaction-reinjection.ts`, `services/compaction-kill-relaunch.ts`.
- **Fichiers UI** : `pages/Workflows.tsx`, `WorkflowEditor.tsx`, `WorkflowDetail.tsx`, `WorkflowTraces.tsx`, `NewWorkflow.tsx`, `AutomationCursors.tsx`, `api/workflows.ts`, `components/traces/WorkflowTimeline.tsx`.
- **Schema files** : `packages/db/src/schema/workflow_templates.ts`, `workflow_instances.ts`, `stage_instances.ts`, `workflow_stage_config_layers.ts`, `workflow_template_stage_layers.ts`.
- **Colonnes traces** : `traces.workflow_instance_id` (nullable → drop) et `traces.stage_instance_id` (NOT NULL → d'abord UPDATE … SET NULL après drop de la contrainte NOT NULL, puis drop de la colonne). Objectif : garder les traces, perdre juste le lien workflow.
- **Colonnes compaction_snapshots** : `workflow_instance_id` + `stageId` (UUID sans FK) → simple DROP COLUMN.
- **Permissions retirées** : `workflows:delete`, `workflows:manage` (aucun usage governed).
- **Permissions gardées et rebrandées** : `workflows:read`, `workflows:create`, `workflows:enforce` — servent les governed workflows.
- **Dépendance** : retrait de `xstate@^5.28.0` dans `server/package.json`.
- **Nav** : entrée `cursors` supprimée du `nav-registry.ts` et de l'union `NavItemId` (`packages/shared/src/types/nav.ts` ou équivalent). Entrées `workflows` + `workflow-editor` gardées, labels inchangés, routes pointent vers les nouvelles pages governed.

**Features legacy perdues** (intentionnel, à rebuild en governed si besoin confirmé) : approval chains / HITL multi-actor, auto-transitions de stages, retry policy, pre-prompts + expected outputs, acceptance criteria validation.

### D4 — Placement nav

Les slots nav `workflows` (`/workflows`) et `workflow-editor` (`/workflow-editor/new`) existants sont réutilisés. Pas de nouvelle entrée nav. Pas de sous-menu. Label garde "Workflows". Les 5 routes UI vivent sous `/workflows/*`.

**Note** : la route `/workflow-editor/new` historique devient `/workflows/new` (cohérence hiérarchique). Le registry nav est ajusté en conséquence pour pointer `workflow-editor` vers `/workflows/new`.

---

## Architecture globale

```
┌─ UI (React) ────────────────────────────────────────────────┐
│  Pages: GovernedWorkflowsList, GovernedWorkflowEditor,      │
│         GovernedWorkflowRuns, GovernedWorkflowRunDetail     │
│  Routes /workflows/*  (nav slots legacy réutilisés)         │
└──────────────┬──────────────────────────────────────────────┘
               │ REST
               ▼
┌─ Server (Express) ──────────────────────────────────────────┐
│  routes/governed-workflows-ui.ts                            │
│  ─► governedWorkflowService (T5, étendu U2)                 │
│        ├─► DB (governed_workflow_* tables — cache/index)    │
│        └─► GitProvider (T3, existant)                       │
│              ├─► fetchBlob    (load workflow.json)          │
│              ├─► commitFile   (save = commit + push)        │
│              └─► listTags     (resolve versions + semver)   │
└─────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                                ┌──────────────────┐
                                │ GitLab repo      │
                                │ mnm-<co>-wfs     │
                                └──────────────────┘
```

**Rôles** :
- **Git** = source de vérité pour `workflow.json`, gates TS, agents `.md`. Lu lors du load éditeur/detail. Écrit au save (commit + push + tag auto).
- **DB** (`governed_workflow_definitions`) = cache d'index pour la page list uniquement.
- **Runs** = exécutés client-side (Claude Code harness + MCP). Tables `governed_workflow_runs` / `governed_step_executions` / `gate_results` remplies par les MCP tools T5. Pas de traces serveur-side MVP.
- **Live updates** (run detail) : SSE via `/events/ws`, events `governed_run.step_updated` + `governed_run.gate_evaluated` à créer côté serveur.

---

## REST endpoints

Nouveau fichier `server/src/routes/governed-workflows-ui.ts`, monté sur le router `api.use("/companies/:companyId", ...)` après `assertCompanyMembership` + `tenantContextMiddleware` + `tagScopeMiddleware`. **Tous les chemins ci-dessous sont donc préfixés par `/api/companies/:companyId` dans l'URL complète.** Tous les handlers délèguent au `governedWorkflowService` + `gitProvider`, zéro duplication.

| Méthode + Path (relatif au middleware chain) | Permission | Comportement |
|---|---|---|
| `GET /governed-workflows` | `workflows:read` | List paginée (filtre `enabled`, tri `updated_at DESC`). Lit DB seulement. |
| `GET /governed-workflows/:name` | `workflows:read` | `fetchBlob` depuis git à `latest_git_tag \|\| "main"` + parse zod + renvoie `{definition, latestGitTag, enabled, updatedAt, archivedAt}`. |
| `GET /governed-workflows/:name/tags` | `workflows:read` | `listTags({prefix: ":name/v"})` — picker de version (post-MVP UI). |
| `POST /governed-workflows` | `workflows:create` | Validate body zod → `commitFile` sur `main` → `computeNextTag` → tag git → upsert DB row. Si commit OK mais DB fail : log, pas de rollback git. |
| `PUT /governed-workflows/:name` | `workflows:create` | Update : même flow que POST. Refuse si `:name` du path diffère du `name` du body (422). |
| `PATCH /governed-workflows/:name/enabled` | `workflows:create` | Toggle `enabled` DB uniquement (champ MnM-only). |
| `DELETE /governed-workflows/:name` | `workflows:create` | Soft-delete : `archived_at=now()` + `enabled=false`. Pas de delete git. |
| `GET /governed-workflows/:name/runs` | `workflows:read` | List paginée runs. Filtres `status`, `initiated_by_actor_id`, `started_after`, `started_before`. |
| `GET /governed-workflows/:name/runs/:runId` | `workflows:read` | Run + step executions + gate_results en un payload. Steps triés par ordre du JSON (topo deps résolu serveur). |
| `POST /governed-workflows/:name/runs` | `workflows:enforce` | Delegate à `governedWorkflowService.launchWorkflow({name, params, gitTag?: "latest" \| "HEAD"})`. HEAD = `ref="main"` au lieu du tag (warning UI). |

**Contrat d'erreur uniforme** (réutilise pattern MCP T5) :
```json
{
  "isError": true,
  "error_code": "WORKFLOW_NOT_FOUND",
  "message": "human-readable",
  "hints": ["actionable guidance"]
}
```

**Nouveaux error codes** : `WORKFLOW_NAME_MISMATCH` (path vs body), `WORKFLOW_INVALID_AT_HEAD` (parse fail sur `main`), `WORKFLOW_COMMIT_CONFLICT` (non-fast-forward), `GIT_PROVIDER_MISCONFIG` (existe déjà T7 DEF-4).

---

## DB migration

Fichier unique `packages/db/src/migrations/0066_nuke_legacy_workflows.sql`. Dans l'ordre :

1. **Drop contraintes FK** sur `traces.workflow_instance_id` et `traces.stage_instance_id`.
2. **`ALTER TABLE traces ALTER COLUMN stage_instance_id DROP NOT NULL`** puis `UPDATE traces SET workflow_instance_id = NULL, stage_instance_id = NULL` (sécurité si rows).
3. **Drop colonnes** : `traces.workflow_instance_id`, `traces.stage_instance_id`, `compaction_snapshots.workflow_instance_id`, `compaction_snapshots.stage_id`.
4. **Drop tables** (ordre inverse des FK) : `stage_instances`, `workflow_stage_config_layers`, `workflow_template_stage_layers`, `workflow_instances`, `workflow_templates`. `CASCADE` pour safety.
5. **Drop enums** associés : `workflow_stage_status`, `workflow_instance_status` (si existent).
6. **Add** à `governed_workflow_definitions` : colonne `archived_at timestamptz NULL` + index partiel `WHERE archived_at IS NULL` sur `(company_id, enabled)`.
7. **Seed update** : si le seed.ts contient `workflows:delete` / `workflows:manage`, les retirer de l'assignation par défaut aux rôles (gardées dans le dictionnaire de permissions pour les envs où elles seraient persistées, mais non seedées — adjustment à vérifier pendant l'implem).

Pre-flight : lire `schema/traces.ts` et `schema/compaction_snapshots.ts` pour vérifier les noms exacts des colonnes et contraintes avant d'écrire la migration.

---

## UI — Routes, pages, composants

### Routes (`ui/src/App.tsx`)

```
/workflows                           → GovernedWorkflowsList          (perm workflows:read)
/workflows/new                       → GovernedWorkflowEditor (create) (perm workflows:create)
/workflows/:name                     → GovernedWorkflowEditor (edit)   (perm workflows:read/create)
/workflows/:name/runs                → GovernedWorkflowRuns            (perm workflows:read)
/workflows/:name/runs/:runId         → GovernedWorkflowRunDetail       (perm workflows:read)
```

### Page 1 — `GovernedWorkflowsList.tsx`

- Table shadcn : `name`, `description` (truncate), `latest_git_tag` (badge mono), `enabled` (Switch `ui/src/components/ui/switch.tsx`), `updated_at` (relativeTime).
- Actions par ligne : Éditer, Voir les runs, Toggle enabled (optimistic), Supprimer (Dialog confirm).
- CTA top-right : `Nouveau workflow` → `/workflows/new`.
- `<EmptyState>` avec CTA si liste vide. `<PageSkeleton>` pendant load.
- Cas `GIT_PROVIDER_MISCONFIG` : EmptyState dédié "Configurer le provider git" avec lien `/admin/config-layers`.

### Page 2 — `GovernedWorkflowEditor.tsx`

- Monaco (`@monaco-editor/react`, lazy-loaded via `React.lazy`). **Absent de `ui/package.json` aujourd'hui** — à installer en U5.
- Mode `create` : pre-rempli avec template minimal + input `name` séparé (validation slug `[a-z][a-z0-9-]+`).
- Mode `edit` : fetch initial via `GET /governed-workflows/:name`.
- Validation zod live debounce 300ms : parse JSON → `workflowDefinitionSchema.safeParse` → panel latéral des issues (cliquables, jump Monaco range).
- Header : nom, tag actuel, bouton `Save` (disabled si parse invalide).
- Modale Save : input `commit message` (default auto), affiche prochain tag calculé. Submit → POST/PUT → toast success + redirect list (ou stay + nouveau tag affiché).
- Gestion conflit 409 : toast "Quelqu'un a push, recharger" + bouton reload.
- Read-only si user a `workflows:read` mais pas `workflows:create` : Monaco `readOnly: true`, Save caché.
- Warning banner "Ce workflow est versionné via git, éditer ici crée un commit sur main et un nouveau tag" — informatif, pas bloquant.

### Page 3 — `GovernedWorkflowRuns.tsx`

- Header : nom workflow + bouton retour + CTA `Lancer un run`.
- Table paginée 50/page : `id` (short mono + tooltip full), `status` (Badge variant), `started_at`, `completed_at`, `initiated_by` (`actor_type:actor_id` + avatar user), `git_tag` (badge mono).
- Filtres : Select `status`, DatePicker range, Input `initiated_by`.
- Row click → run detail.
- Modale Launch : parse le workflow depuis git pour récupérer `variables`, génère un form dynamique (inputs par type). Checkbox "Launch from main HEAD (untagged)" avec warning badge. Submit → `POST /runs` → redirect run detail.

### Page 4 — `GovernedWorkflowRunDetail.tsx`

- Header : status (badge animé si active), `started_at`/`completed_at`, `git_tag` (badge link GitLab), `params_json` (collapsible pretty-printed).
- Timeline verticale de step executions, ordre topo des deps (serveur renvoie pré-trié). Chaque step = `<Card>` expandable :
  - Header step : `step_id`, `agent`, `state` (badge), `started_at`/`completed_at`.
  - Tabs (`ui/src/components/ui/tabs.tsx`) : `Input` | `Output` | `Gates`.
    - **Input** : `prompt_context` résolu côté serveur (substitutions `{{variables.X}}` + `{{steps.Y.artifact.Z}}`). JSON syntax-highlighted.
    - **Output** : `artifacts_json` syntax-highlighted, ou placeholder "Not executed yet" si step pending.
    - **Gates** : table `gate_results` triée par `evaluated_at`. Colonnes : `gate_id`, `kind`, `pass` (badge), `report`, `error_code`, `hints[]` (bullets), `gate_git_sha` (short mono).
- Live updates : hook `useGovernedRunEvents(runId)` (nouveau, basé sur `live-events-ws` existant) subscribe à `company:{companyId}:governed-runs:{runId}` → invalidate `queryKeys.governedWorkflows.runDetail(...)` à chaque event.

### API client — `ui/src/api/governed-workflows.ts`

Functions : `listGovernedWorkflows`, `getGovernedWorkflow`, `getGovernedWorkflowTags`, `createGovernedWorkflow`, `updateGovernedWorkflow`, `deleteGovernedWorkflow`, `setEnabled`, `listRuns`, `getRun`, `launchRun`.

Types : `WorkflowDefinition` (depuis `@mnm/governed-workflows`) + nouveaux row types dans `@mnm/shared` (`GovernedWorkflowDefinitionRow`, `GovernedRunRow`, `GovernedStepExecutionRow`, `GateResultRow`).

### Query keys — `ui/src/lib/queryKeys.ts`

```typescript
governedWorkflows: {
  list: (companyId, filters?) => ["governed-workflows", companyId, filters ?? {}] as const,
  detail: (companyId, name) => ["governed-workflows", "detail", companyId, name] as const,
  tags: (companyId, name) => ["governed-workflows", "tags", companyId, name] as const,
  runs: (companyId, name, filters?) => ["governed-workflows", "runs", companyId, name, filters ?? {}] as const,
  runDetail: (companyId, runId) => ["governed-workflows", "runs", "detail", companyId, runId] as const,
}
```

---

## MCP tool parity (REST ↔ MCP)

L'éditeur web expose create/update/archive via REST. Les sessions Claude Code, elles, parlent à MnM via MCP. Pour que la feature soit utilisable indifféremment UI / REST / MCP, on étend `server/src/mcp/tools/governed-workflows.tool.ts` (T5) avec **3 nouveaux tools** :

| Tool MCP | Input | Comportement |
|---|---|---|
| `createGovernedWorkflow` | `{definition, commitMessage}` | Même logique que `POST /governed-workflows` : zod-validate → `saveDefinition` (commit + semver tag) → upsert DB row. |
| `updateGovernedWorkflow` | `{name, definition, commitMessage}` | Même logique que `PUT /governed-workflows/:name` : vérifie existence + `name` match → `saveDefinition` → upsert DB row. |
| `archiveGovernedWorkflow` | `{name}` | Même logique que `DELETE /governed-workflows/:name` : `archiveDefinition` (soft-delete DB, pas de delete git). |

**Les 3 tools partagent les helpers de service** (`saveDefinition`, `archiveDefinition`, `resolveGitProvider`, `upsertDefinition`) avec les REST handlers — zéro duplication de logique, mêmes garanties RLS/tenant.

**Error codes MCP** : réutilisent le contrat uniforme T5 (`isError`, `error_code`, `message`, `hints`). Codes nouveaux : `WORKFLOW_NAME_MISMATCH`, `WORKFLOW_VALIDATION`, `WORKFLOW_NOT_FOUND`, `GIT_PROVIDER_MISCONFIG`.

**Actor identity** : lue depuis `ctx.actor` (déjà fourni par le MCP context T5). En mode MCP, l'actor est l'user authentifié via OAuth (ou le synthetic session `local_trusted` T6). `authorName` / `authorEmail` passés à `saveDefinition` viennent de là.

**Pas de tool `launchGovernedRun` séparé** — le tool existant `launchWorkflow` (T5) couvre déjà le use-case launch run.

---

## Live events serveur

Émission depuis `governedWorkflowService` :

- `launchStep` (après entry gate eval + state=running) → `governed_run.step_updated`
- `completeStep` (après exit gate eval + state=succeeded/failed) → `governed_run.step_updated`
- Gate runner (à chaque gate évaluée) → `governed_run.gate_evaluated`

Channel : `company:{companyId}:governed-runs:{runId}`. Payload minimal : `{runId, stepExecId?, gateResultId?}`. Le client invalidate la query, pas de payload riche.

Ajout dans `server/src/realtime/emitters/` (grep pour trouver le pattern existant). 2 tests d'émission.

---

## Tests

### Serveur (~13 tests)

- `routes/__tests__/governed-workflows-ui.test.ts` : 1 test par endpoint × (happy 2xx + 403 sans permission + 404 ressource absente + 422 validation) = ~10 tests.
- `services/__tests__/governed-workflows-extensions.test.ts` : `computeNextTag`, `saveDefinition` avec conflit, `archiveDefinition` = ~3 tests.
- `realtime/__tests__/governed-run-events.test.ts` : émission step_updated + gate_evaluated = 2 tests.

### UI (~4 tests vitest + 1 hook)

- `pages/__tests__/GovernedWorkflowsList.test.tsx` : render avec mock TanStack Query, vérifie textes principaux + action buttons.
- Idem pour `GovernedWorkflowEditor`, `GovernedWorkflowRuns`, `GovernedWorkflowRunDetail`.
- `hooks/__tests__/useGovernedRunEvents.test.ts` : mock WS + vérifie invalidation.

### Manuel (1 passage)

Loop end-to-end en `local_trusted` mode :
1. Créer un workflow (mode create editor)
2. L'éditer + save (nouveau tag créé)
3. Lancer un run (launch from latest tag)
4. Voir le run detail avec SSE live update pendant l'exécution des steps client-side

---

## Tranches d'implémentation (5 PR)

| # | Tranche | Livrable | Validation |
|---|---|---|---|
| **U1** | **Nuke legacy** | Migration `0066_nuke_legacy_workflows.sql` + suppression fichiers UI/server/schema + retrait `xstate` + retrait `cursors` nav + retrait permissions mortes | `bun run typecheck` 13/13 vert. `bun run test` vert. App boot clean. |
| **U2** | **REST endpoints governed-workflows-ui** | `routes/governed-workflows-ui.ts` + mount `app.ts` + extension `governedWorkflowService` (`saveDefinition`, `archiveDefinition`, `listRuns` paginée, `getRunWithSteps`, `computeNextTag` helper). Colonne `archived_at` intégrée à la migration U1. | 10 tests routes + 3 tests service. |
| **U3** | **Live events** | Émission step_updated + gate_evaluated depuis service. Hook UI `useGovernedRunEvents`. | 2 tests émission + 1 test hook. |
| **U4** | **API client + query keys + shared types** | `ui/src/api/governed-workflows.ts` + `queryKeys.governedWorkflows.*` + row types `@mnm/shared`. | Typecheck vert + 1 smoke test client. |
| **U5** | **4 pages UI** | `GovernedWorkflowsList.tsx`, `GovernedWorkflowEditor.tsx` (Monaco lazy-loaded, install `@monaco-editor/react` si absent), `GovernedWorkflowRuns.tsx`, `GovernedWorkflowRunDetail.tsx`. Routes `App.tsx`. Parity tracker `scripts/parity/data.ts` mis à jour. | 4 tests render + 1 passage manuel E2E local. |
| **U6** | **MCP tool parity** | 3 nouveaux tools MCP (`createGovernedWorkflow`, `updateGovernedWorkflow`, `archiveGovernedWorkflow`) qui wrappent les mêmes helpers service que les REST (`saveDefinition`, `archiveDefinition`). Registration dans le MCP registry. | ~9 tests MCP (3 tools × happy + validation + error). |

**Ordre de merge** : U1 → (U2 + U3 + U6 parallèles) → U4 → U5. U1 bloque U2 car `archived_at` vit dans la même migration. U6 dépend uniquement des helpers service introduits en U2.

---

## Open points

- **Resolution du `prompt_context`** sur la run detail : re-résoudre à l'affichage côté serveur plutôt que stocker la chaîne résolue en DB. Pas de nouvelle colonne nécessaire.
- **Launch from HEAD** : valider le workflow JSON avant launch, rejeter avec `WORKFLOW_INVALID_AT_HEAD` + hints si parse fail. Test dans U2.
- **Delete UX** : toggle "Afficher archivés" dans filtres list — reporté post-MVP (follow-up).
- **Git provider manquant** : EmptyState dédié "Configurer le provider git" avec lien `/admin/config-layers` si `GIT_PROVIDER_MISCONFIG` remonté.
- **Monaco bundle size** : ~500KB gzip. Acceptable MVP (lazy-loaded route editor). Surveiller post-MVP, éventuel switch CodeMirror 6.
- **Seed permissions** : vérifier pendant l'implem U1 que `workflows:delete` et `workflows:manage` sont bien retirés du seed.ts sans casser d'autre feature (grep d'usage hors routes legacy).

---

## Alignement avec les règles CLAUDE.md

- ✅ **Never use polling** : run detail via SSE live-events, pas de `refetchInterval`.
- ✅ **Always use UI library components** : Switch, Dialog, Tabs, Badge, Button, Card, DatePicker, Select depuis `ui/src/components/ui/`. Monaco = lib externe (pas un primitive UI générique).
- ✅ **Multi-tenant** : toutes les routes REST préfixées `/companies/:companyId/`. RLS enforcée DB.
- ✅ **Dynamic RBAC** : permissions `workflows:read` / `workflows:create` / `workflows:enforce` lues depuis DB, zéro hardcodage.
- ✅ **Tag-based isolation** : `tagScopeMiddleware` en place (mounted on `api.use("/companies/:companyId", ...)`).
- ✅ **Client-side compute** : runs s'exécutent sur le poste user (Claude Code harness + MCP). Serveur = control plane.
- ✅ **Atomic commit + push** : chaque task du plan = 1 commit + 1 push.
- ✅ **Parity tracker** : `scripts/parity/data.ts` mis à jour en U5 (nouvelle domain `governed-workflows` avec 4 features `web` statut).
- ✅ **Conventional commits** : scope `workflows` (pas de distinction `governed-workflows` pour rester court).

---

## Next

1. Invoquer `superpowers:writing-plans` pour produire `docs/superpowers/plans/2026-04-24-governed-workflows-ui.md` — découpage bite-sized par task, TDD, file paths exacts, code complet.
2. Exécution via `superpowers:subagent-driven-development` (fresh subagent par task).
