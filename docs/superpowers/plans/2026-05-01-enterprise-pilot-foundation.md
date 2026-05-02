# Premier Pilote Enterprise — Foundation V2 (Hooks + Assignments + Inbox extension + Composite)

> **Pour les agents :** SUB-SKILL REQUIS — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`. Tâches en checkbox `- [ ]`.

**Goal :** poser les briques qui font passer Governed Workflows d'un orchestrateur agent-only à une plateforme **humain↔agent gouvernée**, vendable enterprise. Premier pilote enterprise : quelques personnes tech/produit, workflows de dev/déploiement, sync sortante vers Jira/ClickUp via hooks user-written, "salut, j'ai quoi à faire ce matin".

**Branche :** `feat/enterprise-pilot-foundation`. Atomic commit + push par task (CLAUDE.md).

**⚠ Prérequis obligatoire :** [`2026-05-02-mnm-connectors-platform.md`](2026-05-02-mnm-connectors-platform.md) doit être livré AVANT ce plan. Les hooks Jira/ClickUp consument le helper `getUserToken()` exposé par Connectors Platform. Sans Connectors, les hooks n'ont pas d'auth user-level (invariant traçabilité §1.7 cassé).

**Conséquence sur ce plan :** la table `workflow_hooks_providers_whitelist` n'est plus créée par la migration 0080. Elle est remplacée par une **référence** à `oauth_connectors` (table du plan Connectors). Au runtime, `helpers.http({provider: "jira"})` :
1. Lookup `oauth_connectors WHERE company_id = ... AND provider_slug = "jira" AND enabled = true`.
2. Lookup token user via `getUserToken(actor.userId, "jira", companyId)`.
3. Inject Authorization. Pas de table provider whitelist redondante côté hooks.

**V1 → V2 (changelog) :** plan refondu après review multi-agent (architect/backend/frontend/security). Corrections principales :
- API helpers refondue : `credential` n'expose plus le secret en clair (CRITICAL).
- SSRF guard explicite sur `base_url` providers (CRITICAL).
- Freeze récursif des retours helpers (CRITICAL).
- Helper timeout configurable (extraction `packages/isolate-runtime/` partagé gate-runner ↔ hooks).
- Fail-mode par phase explicite (before_step enforced ne bloque pas le launchStep).
- Routes UI inchangées (`/inbox/new`, `/workflows/:name/runs/:runId`) — pas de refacto router.
- **Inbox.tsx existant étendu** (section `pending_workflow_steps` ajoutée), pas de doublon.
- **SidebarBadges existant étendu** (`inbox` agrégé), pas de nouveau badge.
- Réutilisation explicite : `MarkdownBody`, `DocumentViewer`, `OutputRow`, `Sheet`, `queryKeys.inboxItems`.
- **Task 0 nouvelle** : extraction `<TagSelector>`/`<PrincipalSelector>` de `Members.tsx` avant VisibilityPicker.
- **Feature flag `MNM_HOOKS_ENABLED`** kill-switch.
- Task 5 composite : 1j → **2j**.
- Total plan : 13j → **15j**.

---

## Décisions arrêtées V2 (signées Tom 2026-05-01)

0. **Traçabilité humaine universelle** — [`decision-log.md` §1.7](../../decision-log.md). TOUT s'exécute sous une identité humaine identifiée. Les hooks utilisent l'auth du user qui a déclenché le run via OAuth user-level (pattern GitLab existant), pas un service account.

1. **Modèle 3-tier visibility universel** — [`decision-log.md` §1.6](../../decision-log.md). Inchangé.

2. **Hooks = code en git, runner isolated-vm + helpers host-side** — [`decision-log.md` §4.4](../../decision-log.md). Pattern parallèle gates.

3. **3 niveaux de résolution avec préfixe obligatoire** : `canonical:` / `shared:` / `local:`.

4. **3 niveaux de partage (visibility)** appliqués aux hooks configs : private / public-tags-ou-principals / company-enforced (tier 3 = colonne `enforced=true` qui applique à TOUS les workflows de la company même non listés dans `workflow.json`).

5. **API helpers — auth OAuth user-level, jamais exposée à l'isolate** (CRITICAL fix C1 + invariant traçabilité §1.7) :
   - ❌ Pas de `helpers.credential(name)` retournant un string.
   - ❌ Pas de credential service partagé pour les hooks.
   - ✅ `helpers.http({ provider, path, body, ... })` — host lookup le **token OAuth du user actor courant** dans `account` (BetterAuth OAuth tokens), injecte l'`Authorization` côté host, l'isolate ne voit JAMAIS la valeur. Si le user n'a pas connecté le provider → erreur explicite `HOOK_USER_NOT_CONNECTED`.
   - ✅ `helpers.llm({ prompt, model })` — host injecte la clé LLM de l'instance (provider-agnostic, V0 Anthropic, multi-provider prévu — cf. [`decision-log.md` §4.5](../../decision-log.md)).
   - ✅ `helpers.fetchHandoff({ git_sha, path })` — héritée des gates, lecture artifact.
   - **Pattern OAuth user-level** : extension du pattern GitLab existant (cf. `docs/governed-workflows/oauth-setup.md`). Connecteurs Jira/ClickUp/Slack/Linear créés dans une UI "Connecteurs" où chaque user connecte son propre compte. Les tokens vivent dans `account`. Le hook utilise systématiquement le token du `actor.userId` courant.
   - **Cas CAO/watchdog** : le user actor est l'admin instance qui a setup le watchdog (cf. invariant §1.7 traçabilité humaine).

6. **SSRF guard strict sur `base_url`** (CRITICAL fix C2) :
   - À l'écriture (POST `/providers`) : validation `^https://`, DNS resolution, deny-list IP (RFC 1918 + 169.254/16 + ::1 + fc00::/7).
   - À chaque appel `helpers.http` : re-vérifier (DNS rebinding mitigation).
   - Réutiliser la logique de `server/src/middleware/private-hostname-guard.ts` (à confirmer présence — sinon créer + tests).

7. **Freeze récursif des retours helpers** (CRITICAL fix C3) : `Object.freeze` profond côté host avant retour à l'isolate ET avant merge dans `prompt_context`. Tests d'isolation dédiés.

8. **Tenant context isolé dans `executeHook`** (HIGH fix C4) : try/finally explicite `setTenantContext(db, companyId)` / `clearTenantContext(db)`, indépendant du middleware HTTP. Important pour `after_run` (out of request cycle).

9. **Pool worker dédié hooks tier 3 enforced** (HIGH fix H3) : budget CPU par company (default 60s/min, override Config Layer). Pool isolated-vm shared avec `companyId` tag pour fairness multi-tenant.

10. **Helper timeout configurable** (HIGH fix H1) : `installHelpers` actuel a `3000ms` hardcoded ([`packages/gate-runner/src/isolate-helpers.ts:56`](../../../packages/gate-runner/src/isolate-helpers.ts)). Extraction dans `packages/isolate-runtime/` avec paramètre `helperTimeoutMs`. Hooks → 30s, gates → 3s (inchangé).

11. **Fail-mode : un hook qui fail → bloque le step entier** (décision Tom 2026-05-01) :
    | Phase | Hook fail | Conséquence |
    |---|---|---|
    | `before_step` (enforced ou non) | log + audit row + alert CAO | **step transitionne en `failed`** avec error_code `HOOK_FAILED:<hook_ref>`. Le run cascade selon ses deps. |
    | `after_step` (enforced ou non) | log + audit row + alert CAO | **step transitionne en `failed`** rétroactivement même si l'artifact a été commité. Run cascade. |
    | `before_run` | log + audit row | **run transitionne en `failed`** avant tout step. |
    | `after_run` | log + audit row | **run reste `completed`** (artifacts déjà persistés, contrat de l'utilisateur respecté) mais flag `cleanup_failed=true` + alert CAO. |
    | `inject` >100KB retourné | log + reject + step fail | DoS guard prompt_context |
    | Hook timeout (30s) | step fail comme un hook fail | idem |

    **Trade-off accepté :** un hook cassé = workflows bloqués. Mitigation : kill-switch instance `MNM_HOOKS_DISABLED=true` (env var) qui désactive TOUS les hooks runtime, override la DB. Documentation explicite dans onboarding admin que créer un hook = engagement de fiabilité.

12. **Routes UI INCHANGÉES** (frontend F1) : `/inbox/new`, `/workflows/:name/runs/:runId`, etc. Pas de refacto router. `companyId` reste dans `useCompany()` context côté UI. Routes API REST restent `/companies/:companyId/...` (rule backend.md inchangé).

13. **Étendre `ui/src/pages/Inbox.tsx` existant** (frontend F2) : nouvelle section `pending_workflow_steps` ajoutée à la liste actuelle (issues_i_touched, approvals, failed_runs, stale_work, alerts, notifications, join_requests). Pas de page séparée.

14. **Étendre `SidebarBadges` existant** (frontend F3) : ajout de `pending_workflow_steps_count` à `SidebarBadges` shared type. Le badge `inbox` côté `Sidebar.tsx:79-80` agrège (et fait pulser sur changement). Pas de nouveau badge nav.

15. **Réutiliser composants UI existants** (frontend F4) :
    - `ui/src/components/MarkdownBody.tsx` pour markdown viewing
    - `ui/src/components/ui/document-viewer.tsx` pour mime-aware artifact preview (étendre si besoin)
    - `OutputRow` extrait de `ui/src/pages/GovernedWorkflowRunDetail.tsx:109-152` → composant partagé
    - `ui/src/components/ui/sheet.tsx` pour HookConfigDetail drawer
    - `queryKeys.inboxItems` étendu, pas dupliqué (`queryKeys.ts:301-304`)

16. **Extraire `<TagSelector>` + `<PrincipalSelector>` AVANT le VisibilityPicker** (frontend F5) : nouvelle Task 0 (0.5j). Aujourd'hui ils sont inline dans `Members.tsx:96-100`. À factoriser en composants partagés.

17. **Feature flag default `true` + kill-switch `MNM_HOOKS_DISABLED`** : par défaut, le système hooks est activé (`instance_settings.hooks_enabled = true`). Kill-switch d'urgence via env var `MNM_HOOKS_DISABLED=true` qui override la DB et désactive runtime tous les hooks (utile si une RCE ou une boucle infinie tier 3 enforced est découverte — `kubectl set env MNM_HOOKS_DISABLED=true` désactive tout sans toucher la DB).

18. **`CompiledCache` extrait dans `packages/isolate-runtime/`** (architect A2) : partagé gate-runner ↔ workflow-hooks-runner. Pas de double cache mémoire.

19. **Composite workflows réestimé à 2j** (backend S1) : `launchStep` 430 lignes + cascade `previous_artifacts` cross-run + nouvelle table `run_lineage` ou variante de `fetchSucceededArtifacts(runId)`.

20. **`launchRun` ajouté au scope hooks** (backend S2) : `before_run` / `after_run` nécessitent patch `launchRun` qui était absent du File Map V1.

21. **Cache `companyId → enforcedHooks[]`** (backend S3) : invalidé sur PATCH `workflow_hooks_config`. Sinon 200 SELECT par run avec 50 hooks × 4 phases × 5 steps.

22. **Permission split** (backend) : 2 permissions distinctes seedées dans la migration 0080 :
    - `hooks:manage` (CRUD config)
    - `hooks:enforce` (toggle `enforced=true`)
    - (`connectors:manage` est seedé par le plan Connectors Platform, pas ici)

23. **Cycle detection runtime au `launchCompositeStep`** (security M3) : pas seulement statique au launchRun. Re-vérifie au moment du sub-launch.

24. **Cap fan-out par `root_run_id`** (security M4) : max 1000 sub-runs actifs par root run. Vérifié au launchCompositeStep.

25. **Audit log sur changement `enforced` flag** (security I1) : table `workflow_hooks_config_audit` avec who/when/from→to.

26. **RLS RESTRICTIVE FORCE sur tables de jointure** (security M1) : `workflow_hooks_config_tags`, `workflow_hooks_config_principals`, `governed_step_assignments`. Tests de migration vérifient.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     packages/isolate-runtime/ (NEW)                          │
│  Extracté de gate-runner. Partagé runner V8 + CompiledCache + installHelpers │
│  installHelpers(ctx, jail, helpers, { helperTimeoutMs })  ← param NEW        │
└─────────────────────────────────────────────────────────────────────────────┘
            ▲                                              ▲
            │                                              │
┌───────────┴────────────────┐               ┌────────────┴────────────────────┐
│  packages/gate-runner/     │               │  packages/workflow-hooks/ (NEW) │
│  helperTimeoutMs: 3000     │               │  helperTimeoutMs: 30000         │
│  Pure validators           │               │  Side-effect hooks              │
└────────────────────────────┘               └─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                  server/src/services/workflow-hooks.ts                       │
│                                                                              │
│  resolveHooksForStep(stepDef, phase, principalId, companyId) → ResolvedHook[]│
│    1. Cache enforced hooks lookup (invalidé sur PATCH config)                │
│    2. Hooks listés step que principalId voit (canPrincipalAccess)            │
│                                                                              │
│  executeHook(resolved, runtimeCtx)                                           │
│    setTenantContext(db, companyId)                                           │
│    try { runner.runHook(code, ctx) } finally { clearTenantContext(db) }      │
│    INSERT audit (status, http_calls_count, llm_tokens, duration)             │
│                                                                              │
│  Host helpers (jamais exposés en clair) :                                    │
│    http({ provider, path, body }) →                                          │
│      validateBaseUrl(provider) → validateNoSSRF(resolved_ip) →               │
│      lookupUserToken(actor.userId, provider.oauth_provider_id) →             │
│      injectAuth(token) → fetch() → freeze(response) → return                 │
│      (if no token: throw HOOK_USER_NOT_CONNECTED)                            │
│    llm({ prompt, model }) →                                                  │
│      injectKey(model) → call → freeze(response) → enforceTokenBudget()       │
│    NO helpers.credential — IMPOSSIBLE de récupérer le secret en clair        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       Inbox UI — extension du existant                        │
│                                                                              │
│  ui/src/pages/Inbox.tsx (700+ lignes existantes)                             │
│    Section existantes : issues_i_touched, approvals, failed_runs, alerts,   │
│      stale_work, notifications, join_requests                                │
│    NEW SECTION : pending_workflow_steps (Task 3)                             │
│                                                                              │
│  ui/src/api/sidebarBadges.ts                                                 │
│    SidebarBadges interface étendue : pending_workflow_steps_count            │
│    Badge inbox agrégé sur Sidebar.tsx:79-80                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Map

### Created

**Packages (extraction + nouveau) :**
- `packages/isolate-runtime/` (NEW package, extraction de gate-runner)
  - `package.json`, `tsconfig.json`
  - `src/index.ts` — exports : `installHelpers`, `CompiledCache`, `defineGate`, `defineHook`, types
  - `src/install-helpers.ts` — extracté de `gate-runner/src/isolate-helpers.ts` avec param `helperTimeoutMs`
  - `src/compiled-cache.ts` — extracté de `gate-runner/src/compiled-cache.ts`
  - `src/freeze-deep.ts` — `freezeDeep(obj)` récursif (sécu C3)
  - `src/__tests__/`

- `packages/workflow-hooks/` (NEW)
  - `package.json`, `tsconfig.json`
  - `src/index.ts`, `src/define-hook.ts`, `src/types.ts`
  - `src/runner.ts` — utilise `isolate-runtime`'s `installHelpers({ helperTimeoutMs: 30000 })`
  - `src/resolver.ts` — `canonical:` / `shared:` / `local:` resolveur
  - `src/host-helpers.ts` — `http`, `llm`, `fetchHandoff` (PAS `credential`)
  - `src/__tests__/runner.test.ts`, `resolver.test.ts`, `host-helpers.test.ts`, `isolation.test.ts`, `ssrf.test.ts`, `prototype-pollution.test.ts`
  - `canonical/jira-comment-on-complete.hook.ts` + `__tests__/`
  - `canonical/jira-create-issue-on-complete.hook.ts` + `__tests__/`
  - `canonical/clickup-import-task.hook.ts` + `__tests__/`
  - `canonical/clickup-create-task-on-complete.hook.ts` + `__tests__/`
  - `canonical/index.ts`

**DB :**
- `packages/db/src/migrations/0080_workflow_hooks.sql` + `.test.ts`
- `packages/db/src/migrations/0081_step_assignments.sql` + `.test.ts`
- `packages/db/src/migrations/0082_workflow_meta_uses.sql` + `.test.ts`
- `packages/db/src/schema/workflow_hooks_config.ts`
- `packages/db/src/schema/workflow_hooks_config_audit.ts`
- `packages/db/src/schema/workflow_hooks_providers_whitelist.ts`
- `packages/db/src/schema/workflow_hook_executions.ts`
- `packages/db/src/schema/governed_step_assignments.ts`

**Shared types :**
- `packages/shared/src/types/visibility.ts`
- `packages/shared/src/types/workflow-hooks.ts`
- `packages/shared/src/types/workflow-assignment.ts`
- Modify : `packages/shared/src/types/sidebar-badges.ts` (ajout `pending_workflow_steps_count`)

**Server :**
- `server/src/services/visibility.ts` + `__tests__/`
- `server/src/services/workflow-hooks.ts` + `__tests__/`
- `server/src/services/governed-workflows-assignments.ts` + `__tests__/`
- `server/src/services/governed-workflows-composite.ts` + `__tests__/`
- `server/src/services/workflow-hook-providers.ts` (CRUD + SSRF validation)
- `server/src/routes/workflow-hooks.ts`
- `server/src/routes/workflow-hook-providers.ts`
- `server/src/__tests__/inbox-pending-steps.e2e.test.ts`

**UI :**
- `ui/src/components/visibility/VisibilityPicker.tsx` + `__tests__/`
- `ui/src/components/visibility/VisibilityBadge.tsx` (mode read-only)
- `ui/src/components/principals/TagSelector.tsx` (extracté de Members.tsx)
- `ui/src/components/principals/PrincipalSelector.tsx` (extracté de Members.tsx)
- `ui/src/components/runs/OutputRow.tsx` (extracté de GovernedWorkflowRunDetail.tsx:109-152)
- `ui/src/components/runs/RunArtifactsTree.tsx`
- `ui/src/pages/Hooks.tsx`
- `ui/src/pages/HookConfigDetail.tsx` (Sheet)
- `ui/src/pages/HookCatalog.tsx` (sub-tab)
- `ui/src/pages/HookProviders.tsx`
- `ui/src/api/hooks.ts`
- `ui/src/api/hook-providers.ts`

### Modified

- `packages/governed-workflows/src/schemas.ts` — Zod : `hooks` step+root, `assignment` step+root, `type: composite|agent`, `uses`
- `packages/db/src/schema/governed_step_executions.ts` — ajout `parent_step_execution_id`, `assigned_at`, `composite_run_id`
- `packages/db/src/schema/instance_settings.ts` (ou similaire) — colonne `hooks_enabled boolean`
- `server/src/services/governed-workflows.ts` — wire hooks (before_run/before_step/after_step/after_run), wire assignment snapshot, wire composite resolver. **gitnexus_impact obligatoire sur `launchRun`, `launchStep`, `completeStep` AVANT edit**
- `server/src/services/governed-workflows-extensions.ts` — `listRuns` filtré assignment optionnel
- `server/src/services/sidebarBadges.ts` (à confirmer chemin) — ajouter `pending_workflow_steps_count`
- `server/src/services/inbox-items.ts` (à confirmer chemin, ou `dashboard.ts`) — ajouter type `pending_workflow_step` aux items
- `server/src/mcp/tools/governed-workflows.tool.ts` — `list_my_pending_work`, enrich descriptions
- `server/src/mcp/tools/workflow-hooks.tool.ts` (nouveau ou extension) — list/get/update configs, list catalog
- `server/src/app.ts` — mount routes
- `server/src/middleware/private-hostname-guard.ts` (vérifier existance, sinon créer)
- `ui/src/App.tsx` — routes `/hooks`, `/hooks/providers`, `/hooks/:configId` (PAS de scope `/companies/:companyId/`)
- `ui/src/lib/queryKeys.ts` — extension `inboxItems` (filter `pending_workflow_steps`), nouveaux `hooks`, `hookProviders`
- `ui/src/components/Sidebar.tsx` — pas de modif (badge `inbox` agrégé via SidebarBadges)
- `ui/src/pages/Inbox.tsx` — **étendre** : nouvelle section `pending_workflow_steps`, nouveau filter category, nouveau type d'`InboxItem`
- `ui/src/components/InboxItemCard.tsx` — étendre pour rendre les pending_workflow_steps avec badge "Step en attente"
- `ui/src/pages/GovernedWorkflowRunDetail.tsx` — utiliser `OutputRow` extracté + ajouter `RunArtifactsTree`
- `scripts/parity/data.ts` — éditer `inbox` + `inbox-interactive` features (pas créer), ajouter `workflow-hooks`, `workflow-assignments`, `composite-workflows`, `visibility-picker`, `artifact-viewer`

### NOT Modified (volontaire)

- `packages/gate-runner/canonical/*` — gates restent pures, isolated-vm, helperTimeoutMs=3000.
- Routes UI scoping (pas de refacto vers `/companies/:companyId/...`).
- `Sidebar.tsx` (badge `inbox` est déjà agrégé via SidebarBadges).

---

## Sprint structure (parallélisation)

| Sprint | Durée | Tasks | Parallélisation |
|---|---|---|---|
| **Sprint 1** | 5j | T0 → T1 (séquentiel) ‖ T2.1-2.3 (package + runner + resolveur) | 1-2 devs |
| **Sprint 2** | 5j | T2.4-2.9 (canoniques + DB + service + wire + REST/MCP + UI) ‖ T3 (assignments + inbox extension) | 2 devs idéal |
| **Sprint 3** | 5j | T4 (artifact viewer + RunArtifactsTree) + T5 (composite) + T6 (validation/parity/doc) | 1-2 devs |

**Chemin critique :** T0 → T1 → T2.4 (canoniques DB) → T2.7 (wire). T3 dépend de T1.3 (`<VisibilityPicker>`). T4 dépend de T2 (artifacts persistés). T5 dépend de T2.7 (hooks enforced cross-run).

**Total : 15j (1 dev) / ~8j (2 devs) / ~6j (3 devs)**.

---

## Task 0 — Extraction `<TagSelector>` + `<PrincipalSelector>` (~0.5j)

**Files :**
- Create : `ui/src/components/principals/TagSelector.tsx` + `__tests__/`
- Create : `ui/src/components/principals/PrincipalSelector.tsx` + `__tests__/`
- Modify : `ui/src/pages/Members.tsx` (remplacer les pickers inline lignes 96-100)

- [ ] **0.1 — `TagSelector`** : Popover + Command + Checkbox loop. Props `value: string[]`, `onChange`, `companyId`, `multiple?: boolean`. Réutilise `tagsApi.list(companyId)`.
- [ ] **0.2 — `PrincipalSelector`** : pareil mais sur principals. Recherche par email/nom.
- [ ] **0.3 — Refactor `Members.tsx`** pour utiliser les nouveaux composants. Vérifier que la page Members reste fonctionnelle (build + dev test rapide).
- [ ] **0.4 — Tests Vitest + Testing Library** : selection multiple, search, debounce.
- [ ] **0.5 — Commit + push** (`refactor(ui): extract TagSelector + PrincipalSelector from Members`)

---

## Task 1 — Foundation 3-tier visibility (~1.5j)

**Files :**
- Create : `packages/shared/src/types/visibility.ts`
- Create : `server/src/services/visibility.ts` + `__tests__/`
- Create : `ui/src/components/visibility/VisibilityPicker.tsx` + `__tests__/`
- Create : `ui/src/components/visibility/VisibilityBadge.tsx`

- [ ] **1.1 — Types partagés** (cf. `docs/conventions/visibility-tiers.md`)
- [ ] **1.2 — `canPrincipalAccess()` helper** TDD : tier 3 company-enforced bypass, tier 1 creator, tier 2a tag intersection, tier 2b principal direct.
- [ ] **1.3 — `<VisibilityPicker>`** : 4 segments (Tabs ou RadioGroup shadcn), utilise `<TagSelector>` + `<PrincipalSelector>` de Task 0, prop `companyEnforcedAvailable: boolean` conditionné par `usePermissions().has("hooks:enforce")` (pattern à adapter par feature).
- [ ] **1.4 — `<VisibilityBadge>`** : mode read-only pour les listings (rend juste l'état avec icône + label).
- [ ] **1.5 — Test Vitest** : transitions tier, props change, callback fired.
- [ ] **1.6 — Documenter exemple dans `docs/conventions/visibility-tiers.md`**.
- [ ] **1.7 — `bun run typecheck` (17/17) + commit + push**

---

## Task 2 — Workflow Hooks (~5j)

> Les contrats helper API + fail-modes + sérialisation + SSRF guards sont arrêtés dans la section **§ Détails techniques sécurité hooks** en fin de ce plan. Lire avant Task 2.1.

### 2.1 — Extraction `packages/isolate-runtime/` (NEW shared package, ~0.5j)

**Files :**
- Create : `packages/isolate-runtime/` (cf. File Map)
- Modify : `packages/gate-runner/` — dépend de `isolate-runtime` au lieu d'avoir son propre `installHelpers`/`CompiledCache`

- [ ] **2.1.1 — Créer le package** + `package.json` + workspaces config.
- [ ] **2.1.2 — Extraire `installHelpers` avec param `helperTimeoutMs`** (était hardcoded 3000 ligne 56 de l'ancien fichier). Tests : timeout custom respecté.
- [ ] **2.1.3 — Extraire `CompiledCache`**.
- [ ] **2.1.4 — Helper `freezeDeep(obj)`** récursif. Test : prototype pollution attack vector bloqué (objet retourné via helper avec `__proto__` malicieux ne pollue pas le host).
- [ ] **2.1.5 — Refactor `gate-runner` pour consommer `isolate-runtime`**. `bun run typecheck` + tests gate-runner existants pass.
- [ ] **2.1.6 — Commit + push** (`refactor(isolate-runtime): extract shared isolate primitives`)

### 2.2 — Package `packages/workflow-hooks/` + runner + helpers (~1.5j)

**Files :**
- Create : `packages/workflow-hooks/` (cf. File Map)
- Modify : root `package.json`, workspaces

- [ ] **2.2.1 — Bootstrap package + types + `defineHook<Config>(handler)` API.**

- [ ] **2.2.2 — Tests d'isolation (TDD, sécurité)** dans `isolation.test.ts` :
  - Hook qui essaie `require('fs')`, `require('http')`, `process.exit()` → bloqué.
  - Hook qui retourne `{ __proto__: { polluted: true } }` → host non pollué après freeze.
  - Hook qui retourne `{ __mnm_call_helper: "..." }` → pas de re-injection (recursion bloquée).
  - Memory exhaustion (allocation 1GB) → isolate killed via `memoryLimitMb`.
  - Hook timeout 30s respecté (et configurable via param helperTimeoutMs).

- [ ] **2.2.3 — Tests host-helpers (TDD)** :
  - `helpers.http({ provider:"jira", path:"/rest/api/3/issue/PROJ-1" })` : injecte Authorization du provider, retourne body JSON freeze.
  - `helpers.http({ provider:"unknown" })` → `HOOK_PROVIDER_NOT_ALLOWED`.
  - `helpers.http({ provider:"jira", path:"/" })` avec `base_url` qui résout en 10.0.0.1 → `HOOK_SSRF_BLOCKED` (DNS rebinding mitigation).
  - `helpers.llm({ prompt:"hello" })` : injecte clé Anthropic/OpenAI, retourne `{text, usage}` freeze. Token budget (default 100k) enforced.
  - **Aucune méthode `helpers.credential` exposée à l'isolate** : test qu'`ctx.helpers.credential` est `undefined`.

- [ ] **2.2.4 — `runner.ts`** : crée `Isolate` via `isolate-runtime.installHelpers({ helperTimeoutMs: 30000, helpers })`. Outer timeout (`Promise.race`) à 35s. Catch exceptions → `HookResult` synthétique.

- [ ] **2.2.5 — `host-helpers.ts`** : implémentation des bridges. Constructeur `(companyId, db, configLayerService, providerWhitelistService)`. Audit row écrite **AVANT** l'appel HTTP réel (status `pending`), update à la fin (`success`/`failed`). Pattern outbox.

- [ ] **2.2.6 — Tests + typecheck + commit + push**

### 2.3 — Resolveur 3-niveaux (~0.5j)

**Files :**
- Create : `packages/workflow-hooks/src/resolver.ts` + `__tests__/`

- [ ] **2.3.1 — Tests TDD** : refus du préfixe manquant, refus du nom non-kebab, lecture canonical depuis registry, lecture shared via `gitProvider.getFile(repo:'_shared', path:'hooks/...')`, lecture local via `gitProvider.getFile(repo:workflowRepo, path:'hooks/...')`. ShaCache hits sur 2e appel.
- [ ] **2.3.2 — Implémentation** : retourne `{ source, code, sha }`.
- [ ] **2.3.3 — Commit + push**

### 2.4 — 4 hooks canoniques (~0.75j)

**Files :**
- Create : `packages/workflow-hooks/canonical/{4 fichiers .hook.ts + tests}`
- Create : `packages/workflow-hooks/canonical/index.ts`

- [ ] **2.4.1 — `jira-comment-on-complete.hook.ts`** (after_step). Config `{ issueKey | issueKeyFromArtifactPath }`. Helper `mdToADF()` (markdown → Atlassian Document Format basique).
- [ ] **2.4.2 — `jira-create-issue-on-complete.hook.ts`** (after_step). Templates Mustache-light (`{{step.name}}`, `{{run.id}}`, `{{artifact.outputs.<name>}}`).
- [ ] **2.4.3 — `clickup-import-task.hook.ts`** (before_step). Config `{ taskIdsFromParam }`. Retourne `{ inject: { context_md } }`.
- [ ] **2.4.4 — `clickup-create-task-on-complete.hook.ts`** (after_step). Templates pareils.
- [ ] **2.4.5 — Registry `canonical/index.ts`** consommé par resolver.
- [ ] **2.4.6 — Tests par hook** : fixture artifact + mock helpers, valider payload HTTP attendu.
- [ ] **2.4.7 — Commit + push**

### 2.5 — Schema DB métadonnées + audit + providers (~0.5j)

**Files :**
- Create : `packages/db/src/migrations/0080_workflow_hooks.sql` + `.test.ts`
- Create : 4 fichiers schema Drizzle
- Modify : `instance_settings` schema (colonne `hooks_enabled`)

```sql
-- 0080_workflow_hooks.sql

-- Feature flag
ALTER TABLE "instance_settings"
  ADD COLUMN IF NOT EXISTS "hooks_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- Workflow hooks config (métadonnées ; le code des hooks vit en git)
CREATE TABLE IF NOT EXISTS "workflow_hooks_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "hook_ref" text NOT NULL,                                -- "canonical:..." | "shared:..." | "local:..."
  "default_config_json" jsonb NOT NULL DEFAULT '{}',
  "visibility" text NOT NULL DEFAULT 'private'
    CHECK ("visibility" IN ('private','tags','principals','company')),
  "created_by_principal_id" uuid NOT NULL REFERENCES "principals"("id"),
  "enabled" boolean NOT NULL DEFAULT true,
  "enforced" boolean NOT NULL DEFAULT false,
  "enforced_phases" text[] NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("company_id", "name")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_hooks_config_tags" (
  "config_id" uuid REFERENCES "workflow_hooks_config"("id") ON DELETE CASCADE,
  "tag_id" uuid REFERENCES "tags"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  PRIMARY KEY ("config_id", "tag_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workflow_hooks_config_principals" (
  "config_id" uuid REFERENCES "workflow_hooks_config"("id") ON DELETE CASCADE,
  "principal_id" uuid REFERENCES "principals"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  PRIMARY KEY ("config_id", "principal_id")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hooks_config_company_enforced_idx"
  ON "workflow_hooks_config"("company_id","enforced","enabled")
  WHERE "enforced" = true;
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_hooks_config" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_hooks_config_tags" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config_tags" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config_principals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_hooks_config_principals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config_principals" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- Audit des changements de config (qui a flippé enforced quand)
CREATE TABLE IF NOT EXISTS "workflow_hooks_config_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "config_id" uuid REFERENCES "workflow_hooks_config"("id") ON DELETE SET NULL,
  "actor_principal_id" uuid REFERENCES "principals"("id"),
  "action" text NOT NULL CHECK ("action" IN ('created','updated','deleted','enforced_on','enforced_off','enabled_on','enabled_off')),
  "diff_json" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "workflow_hooks_config_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_hooks_config_audit" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_config_audit" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- Pas de table workflow_hooks_providers_whitelist : remplacée par référence
-- à oauth_connectors du plan Connectors Platform. Le helper helpers.http
-- résout le provider via SELECT FROM oauth_connectors WHERE company_id = ?
-- AND provider_slug = ? AND enabled = true, puis call getUserToken() pour
-- récupérer le token du user actor courant. Voir 2026-05-02-mnm-connectors-platform.md.
--> statement-breakpoint

ALTER TABLE "workflow_hooks_providers_whitelist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_hooks_providers_whitelist" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hooks_providers_whitelist" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- Audit log d'exécution (avec http_calls_count + tokens LLM)
CREATE TABLE IF NOT EXISTS "workflow_hook_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "config_id" uuid REFERENCES "workflow_hooks_config"("id") ON DELETE SET NULL,
  "hook_ref" text NOT NULL,
  "step_execution_id" uuid REFERENCES "governed_step_executions"("id") ON DELETE SET NULL,
  "run_id" uuid REFERENCES "governed_workflow_runs"("id") ON DELETE SET NULL,
  "phase" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('pending','success','failed','timeout')),
  "error_code" text,
  "duration_ms" integer,
  "result_summary" text,
  "http_calls_count" integer NOT NULL DEFAULT 0,
  "llm_tokens_in" integer NOT NULL DEFAULT 0,
  "llm_tokens_out" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workflow_hook_executions_company_run_idx"
  ON "workflow_hook_executions"("company_id","run_id","created_at" DESC);
--> statement-breakpoint

ALTER TABLE "workflow_hook_executions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workflow_hook_executions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_hook_executions" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint

-- Permissions seedées
INSERT INTO "permissions" ("company_id", "slug", "description", "category", "is_custom")
SELECT c.id, p.slug, p.description, 'hooks', false
FROM "companies" c
CROSS JOIN (VALUES
  ('hooks:manage',          'CRUD on hook configs'),
  ('hooks:enforce',          'Toggle enforced=true on hook config'),
  ('hooks:manage_providers', 'CRUD on hook providers whitelist')
) AS p(slug, description)
ON CONFLICT ("company_id", "slug") DO NOTHING;
--> statement-breakpoint
```

- [ ] **2.5.1 — Test migration** vérifie : 4 nouvelles tables + colonne `hooks_enabled`, RLS sur les 6 tables (incl. jointures), 3 permissions seedées, CHECK `^https://` sur base_url.
- [ ] **2.5.2 — Schemas Drizzle**
- [ ] **2.5.3 — Migration up + tests pass**
- [ ] **2.5.4 — Commit + push**

### 2.6 — Service serveur + Zod schema workflow.json (~0.5j)

**Files :**
- Modify : `packages/governed-workflows/src/schemas.ts` (Zod hooks step+root)
- Create : `server/src/services/workflow-hooks.ts` + `__tests__/`
- Create : `server/src/services/workflow-hook-providers.ts` (CRUD + SSRF validation)
- Modify : `server/src/middleware/private-hostname-guard.ts` (vérifier sinon créer)

- [ ] **2.6.1 — Étendre Zod** :
```ts
const hookRefSchema = z.object({
  name: z.string().regex(/^(canonical|shared|local):[a-z0-9-]+$/),
  with: z.record(z.unknown()).optional(),
});
// step + root schemas étendus avec hooks: { before, after }
```

- [ ] **2.6.2 — `workflow-hook-providers.ts`** : `createProvider({ provider, base_url, ... })` avec validation SSRF :
  ```ts
  validateBaseUrl(base_url) // ^https://, no port < 1024
  resolveDns(host) → ip
  assertNotPrivateIp(ip) // RFC 1918, 169.254/16, ::1, fc00::/7
  ```
  Pareil au runtime avant chaque `helpers.http` call (DNS rebinding).

- [ ] **2.6.3 — `workflow-hooks.ts` service** :
  - `resolveHooksForStep(stepDef, phase, principalId, companyId)` :
    - Cache LRU `companyId → enforcedHooks[]` (TTL 60s, invalidé sur PATCH config via SSE).
    - Hooks listés step + canPrincipalAccess + dédup.
  - `executeHook(resolved, runtimeCtx)` :
    - `setTenantContext(db, companyId)` try/finally.
    - INSERT audit row status=`pending` AVANT.
    - Lance runner.runHook avec `freezeDeep(args)`.
    - Update audit row status final.
    - Retourne `HookResult`.

- [ ] **2.6.4 — Tests TDD** sur les 2 services. Inclut : SSRF base_url 10.0.0.x rejected, prototype pollution retour helper bloqué, cache enforced invalidé, tenant context propagé en after_run hors HTTP cycle.

- [ ] **2.6.5 — Commit + push**

### 2.7 — Wire dans `governed-workflows.ts` (~0.75j)

> **Avant de coder cette task : `gitnexus_impact({target: "launchRun", direction: "upstream"})` + `gitnexus_impact({target: "launchStep"})` + `gitnexus_impact({target: "completeStep"})` + report dans la PR description.**

- [ ] **2.7.1 — Test E2E (TDD)** : 4 scénarios fail-mode (cf. décision 11) — `before_step` enforced fail ne bloque pas, etc.
- [ ] **2.7.2 — Test E2E (TDD)** : feature flag `MNM_HOOKS_ENABLED=false` → hooks pas exécutés (kill-switch).
- [ ] **2.7.3 — Patch `launchStep`** : entre evaluation entry gates et return, `resolveHooksForStep(_, "before_step")` + `executeHook` série + merge `inject` dans `prompt_context.injected_by_hooks: { hook_ref, content_md }[]`. Si `inject` >100KB → reject + log.
- [ ] **2.7.4 — Patch `completeStep`** : après `commitHandoffArtifacts` et avant `transitionStep`, `after_step` hooks. Erreur ≠ erreur step.
- [ ] **2.7.5 — Patch `launchRun`** : `before_run` hooks. Et `transition completed` → `after_run` hooks.
- [ ] **2.7.6 — Commit + push**

### 2.8 — REST + MCP parité (~0.5j)

- [ ] **2.8.1 — REST CRUD `workflow_hooks_config`** : GET/POST/PATCH/DELETE/executions. Permissions `hooks:manage`. Toggle `enforced` requiert `hooks:enforce` (vérification dans le service, pas juste middleware). PATCH écrit row `workflow_hooks_config_audit`.
- [ ] **2.8.2 — REST providers** : N/A. La gestion des providers OAuth se fait via le plan Connectors Platform (`/companies/:companyId/connectors`). Les hooks lookup le connecteur correspondant au provider référencé dans `workflow.json` `hooks: [{name:"canonical:jira-comment", with:{provider_slug:"jira"}}]`.
- [ ] **2.8.3 — REST `_catalog`** : list canonical + shared + locals d'un workflow donné (query param `workflow_ref`).
- [ ] **2.8.4 — MCP tools** : `list_hook_configs`, `get_hook_config`, `update_hook_config`, `delete_hook_config`, `list_hook_catalog`, `manage_hook_providers` (subset CRUD), `list_hook_executions`. Description enrichies de `launch_governed_step` + `complete_governed_step` (mention `injected_by_hooks` + `after_step` execution).
- [ ] **2.8.5 — Commit + push**

### 2.9 — UI Hooks (~0.5j)

**Files :**
- Create : `ui/src/pages/Hooks.tsx`, `ui/src/pages/HookConfigDetail.tsx`, `ui/src/pages/HookCatalog.tsx`, `ui/src/pages/HookProviders.tsx`
- Create : `ui/src/api/hooks.ts`, `ui/src/api/hook-providers.ts`
- Modify : `ui/src/App.tsx` (routes `/hooks`, `/hooks/providers`, etc. — PAS scopé `/companies/:companyId/`)
- Modify : `ui/src/lib/queryKeys.ts` (`hooks`, `hookProviders`)

- [ ] **2.9.1 — `Hooks.tsx`** : 2 tabs (Mes configs / Catalog) + sub-route `/hooks/providers`.
- [ ] **2.9.2 — `HookConfigDetail.tsx`** : `<Sheet>` shadcn (pas Dialog). Form config (Monaco lazy pour `default_config_json`), `<VisibilityPicker>`, toggle `enforced` (visible si `hasPermission("hooks:enforce")`), liste audit `workflow_hook_executions`, kill-switch row "Hooks désactivés sur cette instance" si `MNM_HOOKS_ENABLED=false`.
- [ ] **2.9.3 — Live update** via SSE event `hook.config.updated` (queryKeys.hooks invalidé), `LiveUpdatesProvider` étendu.
- [ ] **2.9.4 — Tests Vitest** sur les pages.
- [ ] **2.9.5 — Tester en browser** sur `bun run dev`.
- [ ] **2.9.6 — `parity/data.ts`** : ajout `workflow-hooks` web=done desktop=missing.
- [ ] **2.9.7 — Commit + push**

---

## Task 3 — Step assignments + Inbox extension (~3j)

### 3.1 — Schema assignment + audit (~0.5j)

**Files :**
- Create : `packages/db/src/migrations/0081_step_assignments.sql` + `.test.ts`
- Create : `packages/db/src/schema/governed_step_assignments.ts`

```sql
CREATE TABLE IF NOT EXISTS "governed_step_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "step_execution_id" uuid NOT NULL REFERENCES "governed_step_executions"("id") ON DELETE CASCADE,
  "principal_id" uuid NOT NULL REFERENCES "principals"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "snapshot_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("step_execution_id", "principal_id")
);
--> statement-breakpoint

-- Index optimisé pour la query inbox (filtré par status via jointure)
CREATE INDEX IF NOT EXISTS "governed_step_assignments_principal_snapshot_idx"
  ON "governed_step_assignments"("company_id","principal_id","snapshot_at" DESC);
--> statement-breakpoint

-- Index partial sur step_executions pour le hot path inbox
CREATE INDEX IF NOT EXISTS "governed_step_executions_company_state_partial_idx"
  ON "governed_step_executions"("company_id", "state")
  WHERE "state" IN ('waiting','running');
--> statement-breakpoint

ALTER TABLE "governed_step_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "governed_step_assignments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "governed_step_assignments" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
```

- [ ] **3.1.1 — Test migration** + Drizzle schema + commit + push

### 3.2 — Zod + service resolver (~0.5j)

- [ ] **3.2.1 — Étendre Zod step schema** : `assignment: { tags?, principals?, roles? }`.
- [ ] **3.2.2 — Service `governed-workflows-assignments.ts`** : `resolveAssignment`, `snapshotStepAssignments`, `listPendingWorkFor` (utilise les 2 index ajoutés en 3.1).
- [ ] **3.2.3 — Tests** : tag intersection, role expansion, dedup, perf 10k steps.
- [ ] **3.2.4 — Commit + push**

### 3.3 — Wire dans `launchRun` / `launchStep` (~0.5j)

- [ ] **3.3.1 — `gitnexus_impact({target: "launchRun"})` (déjà fait Task 2.7 si même PR)**
- [ ] **3.3.2 — Patch `launchRun`** : pour chaque step → snapshot assignment.
- [ ] **3.3.3 — Patch `launchStep`** : re-résolution si assignment a changé (tags/users mis à jour).
- [ ] **3.3.4 — Live event `step.assignment.created`** publié.
- [ ] **3.3.5 — Test E2E** + commit + push

### 3.4 — REST + MCP `list_my_pending_work` (~0.25j)

- [ ] **3.4.1 — MCP tool `list_my_pending_work({ company_id?, status? })`** :
  ```
  Returns: [{
    step_execution_id, step_name, run_id, run_status,
    workflow_name, workflow_git_tag,
    parent_step_execution_id,  // si dans un sub-run composite
    assigned_at, assignment_reason,
    has_artifacts: boolean,
    deps_completed: boolean
  }]
  ```
  Filtré par tag scope du caller. Exclut runs cancelled. Inclut sub-runs composite.
- [ ] **3.4.2 — REST `GET /companies/:companyId/inbox/pending-workflow-steps`** (note : c'est l'API REST qui est scopée companyId, pas l'URL UI — cf. décision 12).
- [ ] **3.4.3 — Tests** + commit + push

### 3.5 — Inbox extension (existant) + SidebarBadges (~0.75j)

**Files :**
- Modify : `ui/src/pages/Inbox.tsx` (ajouter section + filter category)
- Modify : `ui/src/components/InboxItemCard.tsx` (rendu card pending step)
- Modify : `packages/shared/src/types/sidebar-badges.ts` (`pending_workflow_steps_count`)
- Modify : `ui/src/api/sidebarBadges.ts` (rien, hérité du type)
- Modify : `server/src/services/dashboard.ts` ou équivalent (ajouter le count)
- Modify : `ui/src/lib/queryKeys.ts` (extension `inboxItems` filter, pas nouveau)

- [ ] **3.5.1 — Étendre `Inbox.tsx`** :
  - Nouvelle `SectionKey` : `"pending_workflow_steps"`.
  - Nouveau `InboxCategoryFilter`: `"pending_workflow_steps"`.
  - Nouvelle query (réutilise `inboxItemsApi` ou crée `pendingWorkflowStepsApi` — décider en lisant `inbox-items.ts`).
  - Section rendue dans la liste actuelle (issues_i_touched, approvals, ...) avec son icône (lucide `Workflow` ou `ClipboardCheck`).

- [ ] **3.5.2 — Étendre `InboxItemCard`** : nouveau type d'item `pending_workflow_step` avec rendu spécifique (workflow name + step name + assignment reason badge + run status icon + click → naviguer vers `/workflows/:name/runs/:runId`).

- [ ] **3.5.3 — Backend `dashboard.ts`** (ou équivalent : trouver où est calculé `SidebarBadges`) : ajouter `pending_workflow_steps_count` au compute. Le badge `inbox` agrégé l'inclut.

- [ ] **3.5.4 — Live event** `step.assignment.created` invalide `queryKeys.sidebarBadges` ET `queryKeys.inboxItems` (extension via `LiveUpdatesProvider`).

- [ ] **3.5.5 — Tester en browser** : assigner un step à mon principal, voir la section apparaître + badge pulser.

- [ ] **3.5.6 — `parity/data.ts`** : éditer entry `inbox` existante (status partial → étendu), ajouter feature `workflow-step-assignments`.

- [ ] **3.5.7 — Commit + push**

---

## Task 4 — Artifact viewer pour review humaine (~1.5j)

### 4.1 — `OutputRow` extracté + `RunArtifactsTree`

**Files :**
- Create : `ui/src/components/runs/OutputRow.tsx` (extracté de `GovernedWorkflowRunDetail.tsx:109-152`)
- Create : `ui/src/components/runs/RunArtifactsTree.tsx`

- [ ] **4.1.1 — Extraire `OutputRow`** : composant partagé, props `output`, `onClick`. Réutilisable sur run detail + Inbox item detail.
- [ ] **4.1.2 — `RunArtifactsTree`** : récursif sur sub-runs composite (lazy-load enfants à l'expand). Tree shadcn ou simple `<ul>` collapsible.
- [ ] **4.1.3 — Permalink stable** : `/workflows/:name/runs/:runId/artifacts/:stepName/:outputName` avec `encodeURIComponent` sur `stepName`/`outputName` (stepName peut contenir `/`). Bouton "Copier permalink".
- [ ] **4.1.4 — Refactor `GovernedWorkflowRunDetail.tsx`** pour utiliser `OutputRow` extracté + ajouter `RunArtifactsTree`.
- [ ] **4.1.5 — Tests** + commit + push

### 4.2 — `ArtifactViewer` réutilise `DocumentViewer` + `MarkdownBody`

**Files :**
- Modify : `ui/src/components/ui/document-viewer.tsx` (étendre si besoin)
- Create (peut-être) : `ui/src/components/runs/ArtifactViewer.tsx` (juste un wrapper qui pioche le bon viewer mime-aware)

- [ ] **4.2.1 — Étendre `DocumentViewer`** si besoin (ajouter mime types `git_file`, `external_url`).
- [ ] **4.2.2 — `ArtifactViewer.tsx`** : wrapper, dispatch sur `MarkdownBody` / `DocumentViewer` / Monaco lazy / external_url card.
- [ ] **4.2.3 — Tests + tester en browser** + commit + push

### 4.3 — Page review humaine (Inbox item detail)

- [ ] **4.3.1 — Naviguer depuis InboxItemCard `pending_workflow_step`** vers `/workflows/:name/runs/:runId#step=<stepName>` ou page dédiée si vraiment nécessaire (probable : la run detail page suffit, on ajoute juste un anchor).
- [ ] **4.3.2 — Sur la run detail, layout 2 colonnes si `step` query param** : `RunArtifactsTree` à gauche (descend dans sub-runs composite), `ArtifactViewer` à droite.
- [ ] **4.3.3 — Tester** + `parity/data.ts` ajout `artifact-viewer` + commit + push

---

## Task 5 — Meta-workflow `uses:` (~2j)

### 5.1 — Schema + types

**Files :**
- Create : `packages/db/src/migrations/0082_workflow_meta_uses.sql` + `.test.ts`
- Modify : `packages/db/src/schema/governed_step_executions.ts`

```sql
ALTER TABLE "governed_step_executions"
  ADD COLUMN IF NOT EXISTS "parent_step_execution_id" uuid
    REFERENCES "governed_step_executions"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "composite_run_id" uuid
    REFERENCES "governed_workflow_runs"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "root_run_id" uuid
    REFERENCES "governed_workflow_runs"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "governed_step_executions_root_run_idx"
  ON "governed_step_executions"("company_id","root_run_id")
  WHERE "root_run_id" IS NOT NULL;
--> statement-breakpoint
```

`root_run_id` permet de cap le fan-out (security M4).

- [ ] **5.1.1 — Étendre Zod** : `type: "agent"|"composite"`, `uses: "workflows/<name>@<ref>"`, `params`.
- [ ] **5.1.2 — Migration + schema + commit + push**

### 5.2 — Resolver `governed-workflows-composite.ts`

- [ ] **5.2.1 — Tests TDD** : cycle detection statique (launchRun) + runtime (launchCompositeStep). Profondeur 4 niveaux. Fan-out cap 1000 sub-runs par root_run_id.
- [ ] **5.2.2 — Implémentation** : `launchCompositeStep`, `completeCompositeStep`, `detectCycle(workflow, deps)`, `enforceFanoutCap(rootRunId)`.
- [ ] **5.2.3 — Cascade `previous_artifacts` cross-run** : variante de `fetchSucceededArtifacts(runId)` qui descend récursivement via `composite_run_id`.
- [ ] **5.2.4 — Commit + push**

### 5.3 — Wire `launchStep` / `completeStep`

- [ ] **5.3.1 — Test E2E** : workflow `feature-dev` avec 3 steps composite (`design`, `build`, `deploy`), 4 niveaux profondeur testés.
- [ ] **5.3.2 — Patch `launchStep`** : if `step.type === "composite"` → `launchCompositeStep` + lier parent.
- [ ] **5.3.3 — Patch `completeStep`** : if step composite → consume sub-run final outputs comme step artifact.
- [ ] **5.3.4 — Live events** `step.composite.launched`, `step.composite.completed`.
- [ ] **5.3.5 — UI** : badge "composite" dans `GovernedWorkflowRunDetail`, breadcrumb sub-run → root, `RunArtifactsTree` descend automatiquement.
- [ ] **5.3.6 — Commit + push**

---

## Task 6 — Validation finale + spec doc + parity (~1j)

- [ ] **6.1 — Doc utilisateur** : `docs/governed-workflows/hooks.md` (pattern, exemples, sécu user-facing), `assignments.md`, `composite.md`.
- [ ] **6.2 — `bun run typecheck`** (17/17 packages — incluant nouveau `isolate-runtime` + `workflow-hooks`)
- [ ] **6.3 — `bun run test`** : tous les nouveaux tests pass + aucune régression gate-runner
- [ ] **6.4 — `bun run test:e2e`** : test Playwright bout-en-bout flow pilote :
  1. Login user "marie" (tag "produit") → Inbox → 1 step `design-functional` en attente
  2. Click → run detail avec `RunArtifactsTree`
  3. Lancer step depuis MCP mock
  4. Compléter avec artifact mock → hook `clickup-create-task-on-complete` exécuté (mock fetch verified via audit row)
  5. Step suivant `implementation` (tag "engineer") apparaît dans inbox de "tom"
  6. Toggle `MNM_HOOKS_ENABLED=false` → hooks ne s'exécutent plus (kill-switch verified)
- [ ] **6.5 — `bun run dev`** : test manuel des 5 nouveautés UI
- [ ] **6.6 — `gitnexus_detect_changes({scope: "all"})`** : scope conforme
- [ ] **6.7 — `parity/data.ts`** : entries éditées (inbox) + ajoutées (workflow-hooks, workflow-assignments, composite-workflows, visibility-picker, artifact-viewer)
- [ ] **6.8 — Doc** : `docs/governed-workflows/hooks.md`, `assignments.md`, `composite.md` créés. `decision-log.md` §4.4 mis à jour si change de design depuis l'écriture initiale (notamment l'API `helpers.credential` retirée).
- [ ] **6.9 — Commit final + push**

---

## Risks (mis à jour V2)

| Risque | Impact | Mitigation V2 |
|---|---|---|
| Évasion isolated-vm RCE | CRITICAL | Tests sécu dédiés (prototype pollution, recursion, memory exhaust) Task 2.2.2. `isolate-runtime` extracté = un seul code path à durcir. |
| Helpers exposent credentials en clair | CRITICAL | API `credential` SUPPRIMÉE. `http`/`llm` injectent server-side. Test `ctx.helpers.credential === undefined`. |
| SSRF via base_url | CRITICAL | CHECK SQL `^https://` + DNS resolve + IP deny-list à l'écriture ET au runtime (rebinding mitigation). |
| Hook tier 3 enforced cassé qui bloque tous les runs | HIGH | Fail-mode explicite : `before_step` fail = continue avec context non-enrichi. Pool worker dédié + budget CPU per-company. Kill-switch `MNM_HOOKS_ENABLED`. |
| RLS gap sur tables jointures | HIGH | Migration SQL inline 0080 inclut RLS sur `_tags`, `_principals`. Test migration vérifie. |
| Tenant context leak entre exécutions hooks | HIGH | `setTenantContext` try/finally explicite dans `executeHook`. Critique pour `after_run` hors HTTP cycle. |
| Audit log race entre crash et insert | MED | Pattern outbox : INSERT row status=`pending` AVANT call HTTP, UPDATE après. Crash = row reste `pending`, alert. |
| Helper timeout 3s vs 30s incohérent | MED | Extraction `installHelpers` avec param `helperTimeoutMs`. Hooks 30s, gates 3s. Tests dédiés. |
| Cycle composite runtime-introduced | MED | Re-detect au `launchCompositeStep`, pas seulement launchRun. |
| Fan-out exponentiel composite | MED | Cap 1000 sub-runs par `root_run_id`. CHECK au `launchCompositeStep`. |
| Inbox query slow sur grosses companies | MED | Index partial `governed_step_executions_company_state_partial_idx` + `governed_step_assignments_principal_snapshot_idx`. Test perf 10k steps. |
| Cache enforced hooks stale | LOW | TTL 60s + invalidation SSE `hook.config.updated`. |
| Régression gate-runner par extraction `isolate-runtime` | HIGH | Tests gate-runner existants doivent tous passer après refactor Task 2.1. CI bloquant. |

---

## Out of scope (post-pilote, plans dédiés)

- **Mirroir GitLab `_org-structure/`** — plan séparé `2026-05-XX-org-structure-gitlab-mirror.md`.
- **UI éditeur de hooks locaux/shared** dans le Workflow Studio — next plan évident (Monaco multi-fichiers existe déjà, élargir filetree à `hooks/`, ajouter validation TS via Monaco Worker, AI Assistant qui propose du code de hook).
- **Workflows en `.md` au lieu de `.json`** — change de surface (Studio Monaco, AI Assistant prompt, schema validation). Brainstorm requis.
- **Reassign dynamique d'un step en cours** (CAO réassigne quand quelqu'un OOO).
- **Hooks marketplace cross-company** (un hook publié par une company réutilisable par d'autres clients).
- **Notifications push/email sur assignment** (au-delà du badge SSE).
- **DSL TypeScript-light pour configurer un hook sans écrire de code** (form-driven dans Hook Catalog).

---

## Validation Tom (à signer avant merge final)

- [ ] L'invariant 3-tier est respecté partout (Hooks + assignments).
- [ ] **L'invariant traçabilité humaine §1.7** est respecté : tous les `helpers.http` utilisent le token OAuth du user actor, jamais un service account.
- [ ] **Aucun helper n'expose un credential en clair à l'isolate** — vérifié par test (`ctx.helpers.credential === undefined`).
- [ ] **SSRF impossible** — vérifié par test (10.0.0.1 + 169.254.169.254 + localhost rejected à la création ET au runtime).
- [ ] **Tier 3 enforced non-bypassable côté client** — vérifié par test (kill-switch instance-level seulement).
- [ ] Inbox MCP tool nommé `list_my_pending_work` (pas autre chose).
- [ ] Le permalink artifact est shareable et stable, encodeURIComponent appliqué.
- [ ] Meta-workflow profondeur > 3 fonctionne (test E2E avec 4 niveaux).
- [ ] `Inbox.tsx` étendu, pas dupliqué. Page existante toujours fonctionnelle.
- [ ] `SidebarBadges.inbox` agrège tous les sous-badges. Pulse SSE fonctionne.
- [ ] Feature flag `MNM_HOOKS_ENABLED=false` désactive tous les hooks runtime (kill-switch verified).
- [ ] Gate-runner tests existants tous passent après extraction `isolate-runtime`.

---

## Détails techniques sécurité hooks

Patterns clés à appliquer lors de l'implémentation Task 2. Code-level — à inliner dans les fichiers concernés.

### `freezeDeep` (anti-prototype pollution)

```ts
// packages/isolate-runtime/src/freeze-deep.ts
export function freezeDeep<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj;
  // Strip __proto__/constructor pollution AVANT freeze
  if (Object.getPrototypeOf(obj) !== Object.prototype && !Array.isArray(obj)) {
    Object.setPrototypeOf(obj, Object.prototype);
  }
  Object.freeze(obj);
  for (const key of Reflect.ownKeys(obj)) {
    const v = (obj as any)[key];
    if (v !== null && (typeof v === "object" || typeof v === "function")) freezeDeep(v);
  }
  return obj;
}
```

Appelé sur : retour `helpers.http`, retour `helpers.llm`, `HookResult` avant merge `prompt_context`.

### SSRF guard à 2 niveaux

À l'écriture du provider whitelist :

```ts
async function validateProviderBaseUrl(base_url: string) {
  if (!base_url.startsWith("https://")) throw badRequest("https only");
  const url = new URL(base_url);
  if (url.port && parseInt(url.port) < 1024) throw badRequest("port >= 1024");
  const ips = [
    ...await dns.resolve4(url.hostname).catch(() => []),
    ...await dns.resolve6(url.hostname).catch(() => []),
  ];
  if (ips.length === 0) throw badRequest("hostname does not resolve");
  for (const ip of ips) {
    if (isPrivateOrSensitiveIp(ip)) throw forbidden(`forbidden IP: ${ip}`);
  }
}
// Deny-list : 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16,
// 127.0.0.0/8, ::1, fc00::/7, 0.0.0.0
```

Au runtime de chaque `helpers.http` : re-resolve DNS + re-check (cache 60s) — DNS rebinding mitigation.

### Audit pattern outbox (pre-call INSERT, post-call UPDATE) + OAuth user lookup

```ts
async function http(args: HttpArgs): Promise<HttpResponse> {
  // 1. Lookup OAuth user token (invariant traçabilité §1.7)
  const provider = await getProviderWhitelist(ctx.companyId, args.provider);
  if (!provider) throw new Error("HOOK_PROVIDER_NOT_ALLOWED");
  const token = await getUserOAuthToken(ctx.actorUserId, provider.oauth_provider_id);
  if (!token) throw new Error(`HOOK_USER_NOT_CONNECTED: connect your ${provider.provider} account first`);

  // 2. SSRF re-check at runtime
  await assertNotSsrf(provider.base_url);

  // 3. Audit row pre-call (outbox pattern)
  const auditId = randomUUID();
  await db.insert(workflow_hook_executions).values({
    id: auditId, company_id, config_id, hook_ref, step_execution_id, run_id,
    actor_user_id: ctx.actorUserId,  // traçabilité humaine
    phase, status: "pending", http_calls_count: 0,
  });

  try {
    const response = await fetch(provider.base_url + args.path, {
      method: args.method ?? "GET",
      headers: { ...args.headers, Authorization: `Bearer ${token.accessToken}` },  // Authorization rejected from caller
      body: args.body ? JSON.stringify(args.body) : undefined,
    });
    await db.update(workflow_hook_executions)
      .set({ status: "success", http_calls_count: 1, duration_ms })
      .where(eq(workflow_hook_executions.id, auditId));
    return freezeDeep({ status: response.status, headers: sanitizeHeaders(response.headers), body: await response.json() });
  } catch (err) {
    await db.update(workflow_hook_executions)
      .set({ status: "failed", error_code: classify(err), duration_ms })
      .where(eq(workflow_hook_executions.id, auditId));
    throw err;
  }
}
```

Crash de l'isolate → row reste `pending`. Job nightly alerte les rows `pending > 5min`. Token OAuth lookup throw si user non-connecté → erreur claire dans audit row + step fail explicite avec un message actionnable pour le user ("Connecte ton compte Jira dans Settings > Connecteurs").

Crash de l'isolate → row reste `pending`. Job nightly alerte les rows `pending > 5min`.

### Pool CPU budget tier 3 enforced

```ts
class EnforcedHookPool {
  private cpuBudgetMs = 60_000;
  private windowMs = 60_000;
  private cpuSpentByCompany = new Map<string, number[]>();

  async acquire(companyId: string): Promise<Lease> {
    const now = Date.now();
    const spent = (this.cpuSpentByCompany.get(companyId) ?? [])
      .filter(t => now - t < this.windowMs);
    if (spent.length * AVERAGE_HOOK_DURATION > this.cpuBudgetMs) {
      throw new Error("HOOK_BUDGET_EXCEEDED");
    }
    spent.push(now);
    this.cpuSpentByCompany.set(companyId, spent);
    return { release: () => {} };
  }
}
```

Budget dépassé → hook enforced skipé pour ce step (audit row `status=skipped_budget` + alert CAO).

### Tests sécurité obligatoires (18)

| Test | Fichier | Vecteur |
|---|---|---|
| `ctx.helpers.credential === undefined` | `host-helpers.test.ts` | Credential exposure |
| User OAuth token lookup utilisé (pas service account) | `host-helpers.test.ts` | Traçabilité §1.7 |
| User non-connecté → `HOOK_USER_NOT_CONNECTED` | `host-helpers.test.ts` | Fail-fast OAuth |
| Authorization header rejected from caller | `host-helpers.test.ts` | Auth override |
| `base_url` 10.0.0.1 rejected at create | `workflow-hook-providers.test.ts` | SSRF write-time |
| `base_url` rebinds private IP at runtime | `host-helpers.test.ts` | DNS rebinding |
| Cloud metadata 169.254.169.254 rejected | `workflow-hook-providers.test.ts` | Cloud SSRF |
| `__proto__` pollution → host not polluted | `isolation.test.ts` | Prototype pollution |
| `__mnm_call_helper` injected via response → no recursion | `isolation.test.ts` | Helper recursion |
| 1GB allocation in isolate → killed | `isolation.test.ts` | Memory exhaustion |
| `require('fs')`, `process.exit()` → blocked | `isolation.test.ts` | Standard escape |
| Tenant context propagated `after_run` post-HTTP | `workflow-hooks.test.ts` | Tenant leak |
| Audit row written on crash (status=pending) | `workflow-hooks.test.ts` | Audit gap |
| Helper timeout 30s respecté (vs gates 3s) | `install-helpers.test.ts` | Timeout config |
| Pool budget exceeded → hook skipped | `enforced-hook-pool.test.ts` | DoS budget |
| Token budget LLM enforcé | `host-helpers.test.ts` | Budget runaway |
| `inject` >100KB rejeté | `workflow-hooks.test.ts` | Prompt context DoS |
| `MNM_HOOKS_ENABLED=false` → no execution | `workflow-hooks.test.ts` | Kill-switch |
| Cycle composite at runtime detected | `governed-workflows-composite.test.ts` | Cycle race |
| Fan-out 1001 sub-runs blocked | `governed-workflows-composite.test.ts` | Exponential fanout |
