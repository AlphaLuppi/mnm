# Next-session prompt — Governed Workflows UI (listing + editor + runs)

Copy/paste ce bloc entier dans une nouvelle session Claude Code à la racine du repo `C:\Users\tom.andrieu\IdeaProjects\perso\alphalup\mnm`.

---

Salut, j'ai besoin d'ajouter l'UI pour la feature **Governed Workflows** qu'on vient de livrer en backend (MCP tools + 4 tables DB). Aujourd'hui tout est piloté en ligne de commande via MCP ; il me faut 4 pages React dans l'UI web pour que l'utilisateur final puisse visualiser, éditer et suivre ses runs sans passer par MCP.

# Contexte

- Repo : `C:\Users\tom.andrieu\IdeaProjects\perso\alphalup\mnm` (branch `master`).
- Stack UI : React 18 + Vite + TanStack Query + React Router + Tailwind + shadcn/ui (`ui/src/components/ui/`), icônes Lucide.
- Stack serveur : Express + Drizzle + Postgres, `@mnm/shared` pour les types/zod, `@mnm/governed-workflows` pour les schemas de workflow.
- Monorepo bun workspaces. Conventional commits, scope `workflows`. Pas d'emojis.
- Atomic commit+push à chaque task (règle `CLAUDE.md`).

# Docs à lire en priorité (avant d'écrire une ligne)

1. `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — design complet MVP (§2 data model, §3 format workflow.json, §5 flow d'un step, §7 tranches).
2. `docs/superpowers/plans/2026-04-22-T7-polish-distribution.md` — completion report T7 + MVP clôturé.
3. `packages/governed-workflows/src/` — les zod schemas (`workflow.ts`, `workflow-step.ts`, `gate-block.ts`, `gate-item.ts`, `gate-output.ts`). **C'est la source de vérité du format JSON.**
4. `packages/db/src/migrations/0065_governed_workflows.sql` (ou équivalent) — colonnes exactes des 4 tables.
5. `server/src/mcp/tools/governed-workflows.tool.ts` — les 9 tools MCP (références pour comprendre les use-cases côté serveur).
6. `server/src/services/governed-workflows.ts` — service layer (`listDefinitions`, `getWorkflowParsed`, `launchWorkflow`, `launchStep`, `completeStep`, `getRun`, `syncEnvironment`, etc.). **Réutilise ce service depuis les routes REST, ne duplique pas la logique.**
7. `ui/src/pages/Workflows.tsx` + `ui/src/pages/WorkflowEditor.tsx` + `ui/src/pages/WorkflowDetail.tsx` + `ui/src/pages/WorkflowTraces.tsx` — **pages existantes pour l'ancienne feature Workflows**. À prendre comme patterns visuels et query-style, PAS à modifier ni à étendre (elles servent l'ancien data model, c'est une feature distincte).
8. `ui/src/pages/Traces.tsx` — pattern de run-list paginée avec filtres + status badges, à mirrorer pour la runs list governed.

# Scope — 4 pages + les endpoints REST qui les sous-tendent

## Page 1 — `GovernedWorkflowsList`

Route : `/governed-workflows`

- Liste des `governed_workflow_definitions` pour la company courante (via `useCompany().selectedCompanyId`).
- Colonnes : `name`, `description`, `latest_git_tag`, `enabled` (badge), `updated_at` (relativeTime).
- Actions par ligne : `Éditer` (→ editor), `Voir les runs` (→ runs list), `Désactiver/Activer` (toggle `enabled`), `Supprimer`.
- Bouton top-right : `Nouveau workflow` → route `/governed-workflows/new` (éditeur en mode création).
- Empty state via `<EmptyState>` avec CTA `Nouveau workflow`.
- Loading via `<PageSkeleton>`.
- Permission gate : `workflows:read`.

## Page 2 — `GovernedWorkflowEditor`

Route : `/governed-workflows/:workflowName` et `/governed-workflows/new`.

- **Le format éditable est le JSON complet** qui matche `workflowDefinitionSchema` (`apiVersion: "mnm/v1"`, `kind: "GovernedWorkflow"`, `name`, `description`, `variables`, `steps[]`).
- **Choix d'architecture à prendre en brainstorming au début de la session** :
  - Option A : **éditeur JSON brut** avec validation zod en temps réel (Monaco ou CodeMirror + schema zod → display erreurs inline). Plus simple, moins joli, suffit pour le MVP.
  - Option B : **formulaire structuré** (un bloc par step avec sous-blocs gates/prompt_context/deps). Plus beau, beaucoup plus de code, risque de dériver du schema zod si mal câblé.
  - Recommandation par défaut : **Option A** pour le MVP (prouve la boucle), Option B dans une itération future. Confirme avec moi avant de coder.
- Preview side-by-side : parse → show erreurs zod inline avec path (`steps[1].gates.exit[0].source is required`).
- Save : POST/PUT vers la nouvelle REST endpoint (cf. §Endpoints REST plus bas). L'endpoint ne fait pas commit/push dans le bare repo ; il update juste la DB avec le `workflow.json` inline (stocké dans une nouvelle colonne `definition_json` — voir plus bas).
- Dans le cas d'un workflow tracké via git tag (`latest_git_tag != null`), l'éditeur affiche un warning "Ce workflow est versionné via git ; éditer ici crée un override DB non synchronisé. Pour une édition propre, pousse un nouveau tag git et relance `sync_governed_environment`."
- Permission gate : `workflows:create` (création) / `workflows:read` (visualisation).

## Page 3 — `GovernedWorkflowRuns`

Route : `/governed-workflows/:workflowName/runs`

- Liste paginée des `governed_workflow_runs` filtrée par `workflow_def_id` (résolu via `name` → `id` côté serveur).
- Colonnes : `id` (short uuid), `status` (badge : draft/active/completed/failed), `started_at` (relativeTime), `completed_at`, `initiated_by` (`actor_type:actor_id`), `git_tag`, actions (→ run detail).
- Filtres : status, date range, initiated_by.
- Pagination classique (50/page, offset).
- Bouton top-right : `Lancer un run` → modal simple demandant les `variables` requises du workflow (depuis le JSON parsé) + button `Launch` qui appelle REST `POST /runs` (qui délègue à `governedWorkflowService.launchWorkflow`).
- Permission gate : `workflows:read`.

## Page 4 — `GovernedWorkflowRunDetail`

Route : `/governed-workflows/:workflowName/runs/:runId`

- Header : status du run, `started_at`/`completed_at`, `git_tag`, `params_json`.
- Timeline verticale des `governed_step_executions` ordonnés par `step_id_in_json` selon l'ordre dans le workflow JSON (respecte les `deps` — résoudre topologiquement côté serveur ou côté client). Pour chaque step :
  - Header step : `step_id`, `agent`, `state` (badge : pending/running/gate_eval/succeeded/failed), `started_at`/`completed_at`.
  - Onglet **Input** : le `prompt_context` résolu (avec les substitutions `{{variables.X}}` et `{{steps.Y.artifact.Z}}` appliquées au moment du launch — le serveur doit stocker le prompt résolu OU le recalculer à l'affichage).
  - Onglet **Output / Artifact** : `artifacts_json` pretty-printed (syntax-highlighted JSON).
  - Onglet **Gates** : liste des `gate_results` pour ce step_exec_id, ordonnée par `evaluated_at`. Pour chaque entrée : `gate_id_in_json`, `kind` (entry/exit), `pass` (badge vert/rouge), `report` (texte libre), `error_code` (si présent), `hints[]`, `gate_git_sha` (short).
- Section top-level "Gates globales" si le run a des gates au niveau workflow (pour plus tard — note sans implémenter si pas pertinent pour l'instant).
- Auto-refresh pendant que le run est `active` : TanStack Query avec `refetchInterval` ? **NON** — le CLAUDE.md dit "NEVER use polling". Utilise SSE/WebSocket via `/events/ws`. Grep `live-events-ws` dans `server/src/realtime/` pour voir le pattern existant et subscribe aux events `governed_run.step_updated` / `governed_run.gate_evaluated` (à créer côté serveur si absents).
- Permission gate : `workflows:read`.

# Endpoints REST à créer

Le backend n'expose actuellement ces tables que via MCP. L'UI a besoin de REST pour pagination, filtres efficaces et SSE streaming. Crée un nouveau fichier `server/src/routes/governed-workflows.ts` avec :

- `GET /companies/:companyId/governed-workflows` — list definitions (delegate to `governedWorkflowService.listDefinitions`). Pagination, filtre `enabled`.
- `GET /companies/:companyId/governed-workflows/:name` — get parsed definition (`getWorkflowParsed`). Retourne le JSON + métadonnées (latest_git_tag, enabled, etc.).
- `POST /companies/:companyId/governed-workflows` — create inline definition (nouveau flow, voir §DB migration ci-dessous).
- `PUT /companies/:companyId/governed-workflows/:name` — update inline.
- `PATCH /companies/:companyId/governed-workflows/:name/enabled` — toggle enabled.
- `DELETE /companies/:companyId/governed-workflows/:name` — soft-delete (ajouter `archived_at` colonne si besoin, ou hard-delete si la table le supporte sans FK violations).
- `GET /companies/:companyId/governed-workflows/:name/runs` — paginated runs list. Filtres status/actor/date.
- `GET /companies/:companyId/governed-workflows/:name/runs/:runId` — run detail (run + step_executions + gate_results en un seul paylod, ou split en 2 si trop gros).
- `POST /companies/:companyId/governed-workflows/:name/runs` — launch run (delegate to `governedWorkflowService.launchWorkflow`).

Monte ce router dans `server/src/app.ts` **après** le middleware chain company-scoped (assertCompanyMembership + tenantContextMiddleware + tagScopeMiddleware). Le chain est déjà en place via `api.use("/companies/:companyId", ...)` — grep pour trouver le point d'insertion.

# DB migration — édition inline

Le MVP stocke le workflow JSON canoniquement dans un bare git repo (source of truth). Pour l'éditeur web, ajoute une colonne `definition_json jsonb NOT NULL DEFAULT '{}'` à `governed_workflow_definitions`, plus un flag `source` text CHECK IN ('git', 'inline') DEFAULT 'git'. L'éditeur écrit `source='inline'` avec le JSON. Le service layer (`getWorkflowParsed`) privilégie `definition_json` quand `source='inline'`, sinon fetch le git blob. **Crée une nouvelle migration** (`packages/db/src/migrations/NNNN_governed_workflow_inline.sql`) qui ADD ces 2 colonnes avec backfill `source='git'` pour les lignes existantes.

**Avant d'écrire la migration**, pre-flight schema check : lis la migration 0065 actuelle pour vérifier la structure exacte et les index existants. Respecte les contraintes RLS (policy pour INSERT/UPDATE en plus de SELECT).

# API TypeScript client

Crée `ui/src/api/governed-workflows.ts` miroir de `ui/src/api/workflows.ts` (patterns : `listGovernedWorkflows`, `getGovernedWorkflow`, `createGovernedWorkflow`, `updateGovernedWorkflow`, `deleteGovernedWorkflow`, `setEnabled`, `listRuns`, `getRun`, `launchRun`). Tous typés via les types exportés par `@mnm/governed-workflows` (`WorkflowDefinition`) et des nouveaux types DB (`GovernedWorkflowDefinitionRow`, `GovernedRunRow`, `GovernedStepExecutionRow`, `GateResultRow`) que tu définis dans `@mnm/shared` si ils n'existent pas déjà.

Ajoute les queryKeys dans `ui/src/lib/queryKeys.ts` :

```typescript
governedWorkflows: {
  list: (companyId: string, filters?: Record<string, unknown>) => ["governed-workflows", companyId, filters ?? {}] as const,
  detail: (companyId: string, name: string) => ["governed-workflows", "detail", companyId, name] as const,
  runs: (companyId: string, name: string, filters?: Record<string, unknown>) => ["governed-workflows", "runs", companyId, name, filters ?? {}] as const,
  runDetail: (companyId: string, runId: string) => ["governed-workflows", "runs", "detail", companyId, runId] as const,
}
```

# Registration router

Dans `ui/src/App.tsx`, ajoute les 4 routes à côté du bloc `<Route path="workflows" ...>` existant (grep `path="workflows"` pour le localiser). Utilise le même pattern `<RequirePermission permission="workflows:read|workflows:create" showForbidden>`.

Ajoute aussi un item de menu dans la nav principale (grep `<SidebarMenu` ou équivalent dans `ui/src/components/` pour trouver le point d'insertion). Label : `Workflows gouvernés`, icône Lucide `Workflow` ou `Shield` ou `Gavel` — ton call.

# Tests

- **Server** : tests unit pour chaque nouvelle route REST dans `server/src/routes/__tests__/governed-workflows.test.ts` (une assertion par endpoint : 2xx happy path + 403 sans permission + 404 si ressource absente + 422 validation zod).
- **UI** : pas de tests Playwright E2E pour le MVP (trop coûteux pour 4 pages). Un test vitest par page qui mount le composant avec un mock TanStack Query et vérifie que le render n'explose pas + que les textes principaux sont présents. Pattern : grep `ui/src/pages/__tests__/` pour exemples (si vide, adopte un `PageName.test.tsx` minimaliste).

# Conventions MnM

- **NEVER use polling** — SSE via `/events/ws` pour le run detail live-updates.
- **Always use UI library components** — jamais d'inline Switch/Dialog/Button custom, tout vient de `ui/src/components/ui/`. Si un primitive manque, crée-le là-dedans d'abord.
- **Multi-tenant** — toutes les routes company-scoped préfixées `/companies/:companyId/`. RLS enforcée côté DB.
- **Tag-based isolation** — les users ne voient que les workflows/runs partageant au moins 1 tag avec eux via `tagScopeMiddleware` (déjà en place).
- **Dynamic RBAC** — roles/perms en DB, pas de constantes hardcodées. Utilise `workflows:read` / `workflows:create` / `workflows:enforce` qui existent déjà.
- Pas d'emojis dans code/commits.
- Conventional commits scope `workflows`.

# Workflow d'exécution recommandé

1. **Brainstorm** (`superpowers:brainstorming`) : choix architecture éditeur JSON vs formulaire structuré, shape exacte des endpoints REST, besoin ou pas d'une nouvelle colonne DB `definition_json`, stratégie live-update (SSE vs invalidation manuelle).
2. **Plan** (`superpowers:writing-plans`) : `docs/superpowers/plans/YYYY-MM-DD-governed-workflows-ui.md`. Découpage en tasks bite-sized, TDD, file paths exacts, code complet.
3. **Exécution** (`superpowers:subagent-driven-development`) : fresh subagent per task. Pattern vérifié efficace sur T6/T7.
4. **Per task** : test qui échoue → impl → test vert → commit+push → typecheck. Atomic.
5. **Final** : completion report en bas du plan file. Si tu trouves des bugs dans le backend existant, log-les comme follow-ups (ne les fix pas dans cette session sauf si bloquant).

# Question pour démarrer

1. Tu confirmes **Option A (JSON brut éditeur)** pour le MVP, ou on part sur B (formulaire structuré) dès maintenant ?
2. Tu veux qu'on garde le bare git repo comme canonical source et que l'éditeur web écrive uniquement l'override `definition_json` en DB, OU tu veux basculer les workflows sur édition 100% DB avec sync git en background ? (Le premier est moins disruptif, le second simplifie l'UX.)
3. Le menu nav : tu veux `Workflows gouvernés` comme item racine à côté des Workflows existants, ou un sous-menu sous le groupe Workflows ?

Dis-moi et on y va.
