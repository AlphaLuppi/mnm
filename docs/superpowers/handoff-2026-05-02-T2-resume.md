# Handoff T2 — Workflow Hooks (resume après /compact)

> **Pour l'agent post-compact** : ce document est self-contained. Avec lui + le plan
> [`plans/2026-05-01-enterprise-pilot-foundation.md`](plans/2026-05-01-enterprise-pilot-foundation.md), tu as
> tout ce qu'il faut pour finir T2 sans re-faire le recon. Lis-le en entier
> avant d'éditer du code.

**Branche active** : `feat/enterprise-pilot-foundation` (5 commits ahead of master)
**Plan source** : `docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md` (1002 lignes)
**Date handoff** : 2026-05-02
**Auteur orchestration** : Tom (cofondateur, solo dev) — agents en parallèle

---

## 1. État livré (commits sur la branche)

| Commit | Task | Description |
|---|---|---|
| `d2076ae4d` | **T0** | Extract `<TagSelector>` + `<PrincipalSelector>` de `Members.tsx` → `ui/src/components/principals/`. 23 tests pure logic. |
| `2af87e1e1` | **T1** | 3-tier visibility foundation : `@mnm/shared/types/visibility`, `server/src/services/visibility.ts` (`canPrincipalAccess` avec resolvers DI), `<VisibilityPicker>`, `<VisibilityBadge>`. 15 tests. |
| `e75d0e880` | **T2.1** | Extract `packages/isolate-runtime/` du gate-runner (`installHelpers` avec `helperTimeoutMs` param, `CompiledCache`, `freezeDeep`). Gate-runner refacto en re-export pour zéro régression. |
| `5de1e443e` | **T2.5** | Migration `0081_workflow_hooks.sql` + 5 schemas Drizzle + RLS double-policy + permissions seedées (`hooks:manage`, `hooks:enforce`). 30 tests. |
| `866b8adbe` | **T2.9** | UI Hooks (page + Sheet detail + Catalog) + queryKeys + LiveUpdatesProvider hook event + App.tsx routes + parity tracker. |

**Typecheck** : 17/17 ✅. **Tests** : tous verts pour les sous-tasks livrées.

---

## 2. État restant (T2.2, T2.3, T2.4, T2.6, T2.7, T2.8)

Ordre de dépendances :

```
T2.1 ✅
  ↓
T2.2 (workflow-hooks runner) ── T2.3 (resolver) ── T2.4 (4 canonical hooks)
  ↓                                                  ↑ depend T2.2 + T2.3
T2.6 (service backend) ←──────── T2.5 ✅
  ↓
T2.7 (wire governed-workflows.ts)
  ↓
T2.8 (REST + MCP) ← T2.9 ✅ consume

```

**Estimation** : ~4-5j séquentiel, ~3j si T2.2/T2.5 parallélisés (déjà fait).

---

## 3. Red flags TRANCHÉS (à appliquer tel quel — ne pas re-débattre)

- **RF-1** ✅ Migration 0080 prise → renommée `0081`. Pattern RLS double-policy (`tenant_baseline_permissive` PERMISSIVE + `tenant_isolation` RESTRICTIVE) appliqué sur les 5 nouvelles tables (cf. `0081_workflow_hooks.sql` livré).
- **RF-2** ✅ Pas de table `workflow_hooks_providers_whitelist`, pas de page `HookProviders.tsx`, pas de service `workflow-hook-providers.ts`. Réutilise `oauth_connectors` du plan Connectors.
- **RF-3** ✅ `launchRun` n'existe pas, c'est **`launchWorkflow`** (`server/src/services/governed-workflows.ts:657`).
- **RF-4** ✅ Pas de table `instance_settings`. Kill-switch **env-only V0** : `if (process.env.MNM_HOOKS_DISABLED === "true") return;`
- **RF-5** ✅ `defineHook` doit aller dans `packages/governed-workflows/src/define-hook.ts` (parité `define-gate.ts`), PAS dans `isolate-runtime`.
- **RF-6** ✅ Pas de fonction `transitionStep` callable — transitions de state inline `db.update().set({state:...})`.
- **RF-7** ✅ Vraie signature `connectorService.getUserToken(userId, providerSlug, companyId): Promise<UserTokenResult>` (3 args, ordre exact). `UserTokenResult = { accessToken, expiresAt: Date|null, scopes: string[], type: "oauth2"|"api_key" }`.
- **RF-A1** (DNS rebind) ✅ V0 = single re-resolve via `assertSafePublicUrl` (existe dans `server/src/services/ssrf-guard.ts`) + cache 60s. **TODO V1 explicit** dans le code (host-pinning + Host header force).
- **RF-A2** (token revoked mapping) ✅ `CONNECTOR_TOKEN_REVOKED` → `HOOK_TOKEN_EXPIRED` (sémantique reconnect requis).
- **RF-A3** (order assertUserInCompany avant getActiveConnectorBySlug) ✅ Documenté.
- **RF-A4** (codes HOOK_*) ✅ Vivent dans `packages/governed-workflows/src/errors.ts` `HOOK_ERROR_CODES` (livré dans T2.5).
- **schemas.ts ghost** ✅ `packages/governed-workflows/src/schemas.ts` n'existe pas. Les Zod vivent dans `workflow-step.ts` (`workflowStepSchema`) et `workflow.ts` (`workflowDefinitionSchema`). T2.6 doit étendre ces deux fichiers.
- **`private-hostname-guard.ts` ne fait pas SSRF runtime** ✅ Inbound-only middleware. Pour SSRF outbound, consommer `assertSafePublicUrl` de `server/src/services/ssrf-guard.ts`.

---

## 4. Lignes EXACTES dans `server/src/services/governed-workflows.ts` (T2.7 wire)

Validées par lecture du fichier. À re-vérifier au moment du patch (codebase peut bouger) :

| Cible | Ligne | Action |
|---|---|---|
| `launchWorkflow` def | 657 | `before_run` hooks à wire entre 658 (`getWorkflowParsed`) et 697 (`tx.insert(governedWorkflowRuns)`) |
| `launchStep` def | 850 | `before_step` après `interpolatePromptContext:1145`, avant `return:1210`. Merge `injected_by_hooks` dans `prompt_context`. Reject si total inject > 100KB → `HOOK_INJECT_TOO_LARGE` |
| `completeStep` def | 1346 | `after_step` après `commitHandoffArtifacts:1457` + UPDATE state `1469-1475` + `emitStepUpdated:1478`, AVANT exit gate eval `exitBlock:1485`. Si fail → step transitionne `failed` rétroactivement |
| Run completion | `if (allDone):1632` ; UPDATE `status:"completed":1635-1636` | `after_run` à wire après ce UPDATE. Si fail → run reste `completed` mais flag `cleanup_failed=true` |

**`gitnexus_impact` OBLIGATOIRE** avant edit de chaque symbol (`launchWorkflow`, `launchStep`, `completeStep`). Reporter le blast radius dans le commit message T2.7.

---

## 5. File map des sous-tasks restantes

### T2.2 — `packages/workflow-hooks/` (NEW package, ~1.75j)

```
packages/workflow-hooks/
├── package.json                         (deps: @mnm/isolate-runtime, @mnm/governed-workflows, @mnm/git-provider)
├── tsconfig.json
├── src/index.ts                         export { runHook, resolveHookRef, defineHook (re-export) }
├── src/types.ts                         HookContext, HookResult, HookPhase, ResolvedHook, HostHelpers, HttpRequest, HttpResponse, LlmRequest, LlmResponse, ConnectorTokenSource
├── src/runner.ts                        runHook(resolved, ctx, helpers): Promise<HookResult> — uses installHelpers({helperTimeoutMs: 30000}), outer Promise.race 35s, classify err
├── src/host-helpers.ts                  buildHookHelpers(deps): HostHelpers — http, llm, fetchHandoff (PAS credential)
├── src/__tests__/runner.test.ts
├── src/__tests__/isolation.test.ts      (5 tests sécu : require('fs') blocked, proto pollution, recursion __mnm_call_helper, 1GB alloc killed, timeout 30s)
├── src/__tests__/host-helpers.test.ts   (5 tests : ctx.helpers.credential undefined, OAuth token injection, HOOK_USER_NOT_CONNECTED, Auth header from caller rejected, cross-company → HOOK_USER_NOT_IN_COMPANY)
└── src/__tests__/ssrf.test.ts           (DNS rebind 10.0.0.1 → HOOK_SSRF_BLOCKED via assertSafePublicUrl)
```

**`packages/governed-workflows/src/define-hook.ts` (NEW)** — parité `define-gate.ts`. Re-export depuis `workflow-hooks/src/index.ts`.

**Types EXACTS à exporter** :
```ts
export interface HookContext<Artifact = unknown, Config extends Record<string, unknown> = Record<string, unknown>> {
  artifact: Artifact | undefined;
  run: { id: string; workflow_name: string; git_tag: string; params: Record<string, unknown> };
  step: { id: string; previous_artifacts: Record<string, unknown> };
  config: Config;
  phase: HookPhase;  // "before_run" | "before_step" | "after_step" | "after_run"
  helpers: HostHelpers;
  // INVARIANT: ctx.helpers.credential is undefined (HOST-ONLY)
}

export interface HookResult {
  ok: boolean;
  error_code?: string;
  report?: string;
  hints?: string[];
  data?: Record<string, unknown>;
  inject?: { context_md: string };  // before_step / before_run merge prompt_context
}

export type HookPhase = "before_run" | "before_step" | "after_step" | "after_run";

export interface HostHelpers {
  http(req: HttpRequest): Promise<HttpResponse>;
  llm(req: LlmRequest): Promise<LlmResponse>;
  fetchHandoff(args: { git_sha: string; path: string }): Promise<string>;
}

export interface HttpRequest {
  provider: string;          // ex: "jira", "clickup"
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;  // Authorization rejected (override silencieux)
  query?: Record<string, string>;
}

export interface ConnectorTokenSource {
  getUserToken(userId: string, providerSlug: string, companyId: string): Promise<{
    accessToken: string;
    expiresAt: Date | null;
    scopes: string[];
    type: string;
  }>;
}
```

### T2.3 — Resolver (~0.5j)

```ts
// packages/workflow-hooks/src/resolver.ts
export async function resolveHookRef(
  ref: string,
  ctx: { companyId: string; gitProvider: GitProvider; workflowRepoPath: string; workflowGitSha: string }
): Promise<{ source: "canonical"|"shared"|"local"; code: string; sha: string }>
```

Tests TDD :
- ref `"jira-comment"` (no prefix) → throw
- ref `"canonical:Jira"` (camelCase) → throw (kebab-only)
- ref `"canonical:jira-comment-on-complete"` → loads from `./canonical/index.ts`
- ref `"shared:custom-hook"` → `gitProvider.fetchBlob({ path:'hooks/custom-hook.hook.ts', ref:'main' })` (note: vraie API confirmée par recon)
- ref `"local:my-hook"` → `gitProvider.fetchBlob({ path:'hooks/my-hook.hook.ts', ref: workflowGitSha })`
- ShaCache hit 2nd call

### T2.4 — 4 canonical hooks (~0.75j)

```
packages/workflow-hooks/canonical/
├── index.ts                                (registry consommé par resolver)
├── jira-comment-on-complete.hook.ts        (after_step ; helper mdToADF basique)
├── jira-create-issue-on-complete.hook.ts   (after_step ; templates Mustache-light)
├── clickup-import-task.hook.ts             (before_step ; retourne { inject: { context_md } })
├── clickup-create-task-on-complete.hook.ts (after_step ; templates Mustache-light)
└── __tests__/                               (4 fixtures + assertion payload HTTP attendu)
```

### T2.6 — Service backend (~1.0j)

```
server/src/services/workflow-hooks.ts                       (NEW)
server/src/services/__tests__/workflow-hooks.test.ts        (NEW)
packages/governed-workflows/src/workflow-step.ts            (modify — Zod stepSchema avec hooks)
packages/governed-workflows/src/workflow.ts                 (modify — Zod root avec hooks racine)
```

**Service shape** :
```ts
export function workflowHooksService(db: Db, deps: {
  resolveGitProvider: ResolveGitProvider;
  connectors: ReturnType<typeof connectorService>;
  llmConfig: { provider: "anthropic"; apiKey: string; tokenBudget?: number };
}) {
  return {
    resolveHooksForStep(stepDef, phase: HookPhase, principalId, companyId): Promise<ResolvedHook[]>,
    executeHook(resolved: ResolvedHook, runtimeCtx: HookRuntimeCtx): Promise<HookResult>,
    listConfigs(companyId, principalId): Promise<HookConfig[]>,
    getConfig(companyId, configId, principalId): Promise<HookConfig | null>,
    upsertConfig(companyId, configId | null, payload, ctx): Promise<HookConfig>,
    deleteConfig(companyId, configId, ctx): Promise<boolean>,
    listExecutions(companyId, filters): Promise<HookExecution[]>,
    listCatalog(companyId, opts): Promise<HookCatalog>,    // CONSUMÉ PAR T2.8/T2.9
    invalidateEnforcedCache(companyId): void,
  };
}
```

**Cache LRU `companyId → enforcedHooks[]`** : TTL 60s, invalidé sur PATCH config (call `invalidateEnforcedCache` + emit SSE `hook.config.updated`).

**`executeHook` body — pattern outbox** :
```ts
if (process.env.MNM_HOOKS_DISABLED === "true") return { ok: true };  // kill-switch
setTenantContext(db, runtimeCtx.companyId);
const auditId = randomUUID();
try {
  await db.insert(workflowHookExecutions).values({ id: auditId, status: "pending", actor_user_id: runtimeCtx.actorUserId, ... });
  const helpers = buildHookHelpers({ connectorService: deps.connectors, companyId, actorUserId, llmConfig, gitProvider, workflowGitSha });
  const ctx = freezeDeep({ ...runtimeCtx.hookCtx, helpers });
  const result = await runHook(resolved, ctx, helpers);
  await db.update(workflowHookExecutions).set({ status: result.ok ? "success" : "failed", duration_ms, error_code, ... }).where(eq(id, auditId));
  return result;
} catch (err) {
  await db.update(...).set({ status: "failed", error_code: classifyHookError(err), duration_ms });
  throw err;
} finally {
  clearTenantContext(db);
}
```

**Zod extension `workflow-step.ts`** :
```ts
const hookRefSchema = z.object({
  name: z.string().regex(/^(canonical|shared|local):[a-z0-9-]+$/, "..."),
  with: z.record(z.unknown()).optional(),
});
// Étendre stepSchema avec hooks: { before, after }
```

**`workflow.ts`** : étendre `workflowDefinitionSchema` avec `hooks: { before, after }` racine pour `before_run` / `after_run`.

**Tests TDD service (5)** :
1. SSRF runtime guard appelé (mock `assertSafePublicUrl`, assert called)
2. Prototype pollution post-freeze (hook returns `{__proto__:{x:1}}`)
3. Cache enforced invalidé après `upsertConfig` qui flip `enforced`
4. Tenant context propagated `after_run` (out of HTTP cycle)
5. Audit row `pending` insérée AVANT call HTTP réel

### T2.7 — Wire dans `governed-workflows.ts` (~1.0j)

Voir section 4 (lignes EXACTES).

**Fail-mode** :
| Phase | Fail | Conséquence |
|---|---|---|
| `before_run` | log + audit + run fail | `state="failed"`, error `HOOK_FAILED:<ref>` |
| `before_step` | log + audit + step fail | run cascade selon deps |
| `after_step` | log + audit + step fail rétroactif | step `failed` même si artifact commité |
| `after_run` | log + audit + flag `cleanup_failed=true` | run reste `completed` |
| `inject > 100KB` | reject + step fail | `HOOK_INJECT_TOO_LARGE` |
| Hook timeout 30s | step fail | comme hook fail |

**Tests E2E (TDD, 5)** : `server/src/__tests__/workflow-hooks-fail-mode.e2e.test.ts` (NEW). 4 fail-mode + 1 kill-switch.

**Wire DI** : `workflowHooksService(db, deps)` à instancier dans `server/src/app.ts` ou wherever `governedWorkflowService` est créé.

### T2.8 — REST + MCP (~0.5j)

```
server/src/routes/workflow-hooks.ts                        (NEW)
server/src/mcp/tools/workflow-hooks.tool.ts                (NEW — 6 tools)
server/src/app.ts                                          (modify — mount)
server/src/__tests__/workflow-hooks-routes.test.ts         (NEW — supertest)
server/src/mcp/tools/governed-workflows.tool.ts            (modify — descriptions launch_/complete_governed_step enrichies)
```

**Routes REST** (préfix `/companies/:companyId/`, perm `hooks:manage`) :
- `GET    /workflow-hooks/configs`
- `GET    /workflow-hooks/configs/:configId`
- `POST   /workflow-hooks/configs`              (perm `hooks:enforce` requise EN PLUS si `enforced=true` dans body)
- `PATCH  /workflow-hooks/configs/:configId`    (idem)
- `DELETE /workflow-hooks/configs/:configId`
- `GET    /workflow-hooks/executions`           (query: `?config_id=&run_id=&status=&limit=`)
- `GET    /workflow-hooks/catalog`              (query: `?workflow_ref=...`)

**MCP tools (6, PAS 7)** : `list_hook_configs`, `get_hook_config`, `update_hook_config`, `delete_hook_config`, `list_hook_catalog`, `list_hook_executions`. Pattern `wrap()` standard (cf. `connectors.tool.ts`).

**Mount route dans `app.ts`** : avant le bloc `governedWorkflowFilesRoutes`.

L'UI T2.9 livrée consume déjà ces endpoints — `ui/src/api/hooks.ts` contient déjà les types et les paths corrects.

---

## 6. Patterns codebase à respecter (NON-NÉGOCIABLES)

- **RLS double-policy obligatoire** sur toute nouvelle table tenant (cf. `database.md` rule). Pattern : PERMISSIVE `tenant_baseline_permissive USING (true)` + RESTRICTIVE `tenant_isolation USING (company_id = current_setting('app.current_company_id', true)::uuid)` + `FORCE ROW LEVEL SECURITY`.
- **Atomic commit + push** par sous-task (CLAUDE.md). Jamais de commit local non-pushé.
- **Conventional commits** : `feat(workflow-hooks): T2.X — ...`.
- **Pas de Co-Authored-By Claude/AI** (rule MnM).
- **Pas de nom de client/prospect/personne externe** dans le code/commits/doc (rule absolue CLAUDE.md `feedback_no_client_names_in_repo`). Termes neutres uniquement.
- **GPG fix** : si commit hangait sur passphrase → `git -c commit.gpgsign=false commit -F .commit-msg.tmp` (writeFile heredoc-style, puis rm tmp). Pattern utilisé pour T2.5 et T2.9.
- **Typecheck 17/17** après chaque commit.
- **Atomic stage** : ne jamais `git add -A` ou `git add .` — toujours stager les fichiers explicites de la session (rule `feedback_only_commit_session_changes`).
- **`gitnexus_impact` AVANT edit** des symbols `governed-workflows.ts` (T2.7). Reporter le blast radius dans le commit.
- **No polling** : SSE/WebSocket via `LiveUpdatesProvider` (déjà fait pour `hook.config.updated`/`hook.config.deleted` en T2.9).
- **Parité REST + MCP** : tout endpoint REST doit avoir son équivalent MCP (rule `governed-workflows.md`).
- **Composants UI shadcn** : importer depuis `ui/src/components/ui/`, jamais inline.

---

## 7. Tests sécurité OBLIGATOIRES (T2.2 — 18 tests)

| # | Test | Fichier | Vecteur |
|---|---|---|---|
| 1 | `ctx.helpers.credential === undefined` | `host-helpers.test.ts` | Credential exposure |
| 2 | OAuth token injection via `getUserToken` | `host-helpers.test.ts` | Traçabilité §1.7 |
| 3 | User non-connecté → `HOOK_USER_NOT_CONNECTED` | `host-helpers.test.ts` | Fail-fast OAuth |
| 4 | Authorization header from caller rejected | `host-helpers.test.ts` | Auth override |
| 5 | Cross-company user → `HOOK_USER_NOT_IN_COMPANY` | `host-helpers.test.ts` | C2 cross-tenant guard |
| 6 | DNS rebind 10.0.0.1 at runtime → `HOOK_SSRF_BLOCKED` | `ssrf.test.ts` | DNS rebinding |
| 7 | Cloud metadata 169.254.169.254 rejected | `ssrf.test.ts` | Cloud SSRF |
| 8 | `__proto__` pollution → host not polluted | `isolation.test.ts` | Prototype pollution |
| 9 | `__mnm_call_helper` injected via response → no recursion | `isolation.test.ts` | Helper recursion |
| 10 | 1GB allocation in isolate → killed | `isolation.test.ts` | Memory exhaustion |
| 11 | `require('fs')`, `process.exit()`, `require('http')` → blocked | `isolation.test.ts` | Standard escape |
| 12 | Tenant context propagated `after_run` post-HTTP | `workflow-hooks.test.ts` (T2.6) | Tenant leak |
| 13 | Audit row written on crash (status=pending) | `workflow-hooks.test.ts` (T2.6) | Audit gap |
| 14 | Helper timeout 30s respecté (vs gates 3s) | `runner.test.ts` | Timeout config |
| 15 | Pool budget exceeded → hook skipped (V1, OK skip V0) | `enforced-hook-pool.test.ts` | DoS budget |
| 16 | Token budget LLM enforcé | `host-helpers.test.ts` | Budget runaway |
| 17 | `inject` >100KB rejeté | `workflow-hooks.test.ts` (T2.7 E2E) | Prompt context DoS |
| 18 | `MNM_HOOKS_DISABLED=true` → no execution | `workflow-hooks.test.ts` (T2.6 + T2.7 E2E) | Kill-switch |

---

## 8. Patterns de référence dans le repo (à lire avant d'écrire)

| Pattern | Fichier de référence |
|---|---|
| Drizzle migration RLS double-policy | `packages/db/src/migrations/0080_rls_permissive_baseline.sql` |
| Drizzle schema simple | `packages/db/src/schema/oauth_connectors.ts` |
| Service factory + advisory lock | `server/src/services/governed-workflows.ts:974` |
| Service consommant connectorService | `server/src/services/connectors.ts:744-935` (`getUserToken`) |
| SSRF guard outbound | `server/src/services/ssrf-guard.ts` (`assertSafePublicUrl`) |
| Tenant context | `server/src/middleware/tenant-context.ts:113-133` |
| MCP tool pattern `wrap()` | `server/src/mcp/tools/connectors.tool.ts` |
| REST route + permissions | `server/src/routes/connectors.ts` |
| Test migration | `packages/db/src/migrations/0067_agents_archived_at.test.ts` |
| Test supertest | `server/src/__tests__/health.test.ts` |
| Test pure UI (sans RTL) | `ui/src/components/workflows/__tests__/CancelRunDialog.test.tsx` |
| `defineGate` (parité pour `defineHook`) | `packages/governed-workflows/src/define-gate.ts` |
| `installHelpers` (extracté en T2.1) | `packages/isolate-runtime/src/install-helpers.ts` |
| Visibility helper (consommé par T2.6) | `server/src/services/visibility.ts` |

---

## 9. Mode opératoire post-compact

### Préalables
1. `git checkout feat/enterprise-pilot-foundation`
2. `git pull --rebase origin feat/enterprise-pilot-foundation`
3. Vérifier app dev : `curl localhost:3100/api/health` → 200 attendu. Si fail, relance `bun run dev` en background.
4. Lire ce document + le plan en entier.

### Ordre d'attaque suggéré (séquentiel solo)
1. **T2.2** d'abord (le bloc sécu) : runner + host-helpers + types + 18 tests sécu. ~1.75j. Commit + push.
2. **T2.3** resolver. ~0.5j. Commit + push.
3. **T2.4** 4 canonical hooks. ~0.75j. Commit + push.
4. **T2.6** service + Zod schemas (les schemas Zod sont dans `workflow-step.ts` + `workflow.ts`, PAS `schemas.ts` qui n'existe pas). ~1.0j. Commit + push.
5. **T2.7** wire dans `governed-workflows.ts` (lignes 657, 1145, 1457, 1632 — cf. section 4). `gitnexus_impact` obligatoire avant edit. ~1.0j. Commit + push.
6. **T2.8** REST + MCP. ~0.5j. Commit + push.

### Après T2 livré
1. **P3 — Multi-agent review** : 6+ agents `general-purpose` en // (PO/UX, sécu ×2, perf, bugs prod ×2, archi). Chaque agent reçoit ce doc + le plan + scope précis. Tous utilisent ChromeMCP pour les checks UI.
2. **P4 — Fix findings** : 2 agents `general-purpose` traitent les findings P3.
3. **P5 — E2E + fix live** : 2 agents `general-purpose`, l'un teste via ChromeMCP, l'autre patch en parallèle.

### Gotchas
- **GPG passphrase hangs commit** → utiliser `git -c commit.gpgsign=false commit -F .commit-msg.tmp` avec un fichier tmp pour le message, puis rm.
- **Sub-agents `mnm-*` sont read-only** → utiliser `general-purpose` pour le dev (Write/Edit/Bash dispos).
- **Sub-agents background peuvent mourir sans notification** → toujours préférer travail solo en foreground pour les phases critiques (T2.6 service + T2.7 wire), garder agents pour les phases parallélisables (review/E2E).
- **Diagnostics transitoires** sur les imports manquants pendant qu'on écrit un nouveau package : normal, ils disparaissent quand le package est complet. Lancer `bun run typecheck` à la fin de chaque sous-task pour confirmer.

---

## 10. Prompt à coller post-compact

```
Reprends T2 (Workflow Hooks) sur la branche feat/enterprise-pilot-foundation.

État livré : T0, T1, T2.1, T2.5, T2.9 (5 commits, dernier 866b8adbe). Restent
T2.2, T2.3, T2.4, T2.6, T2.7, T2.8.

Lis EN PRIORITÉ :
- docs/superpowers/handoff-2026-05-02-T2-resume.md (handoff complet, self-contained)
- docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md (plan source)

Le handoff contient : red flags tranchés, file map exact, signatures TS,
lignes exactes pour wire governed-workflows.ts (657/1145/1457/1632), 18
tests sécu obligatoires, patterns de référence, mode opératoire (GPG fix,
sub-agents `general-purpose` only, etc.).

Ordre : T2.2 (runner + helpers) → T2.3 (resolver) → T2.4 (4 canonical hooks)
→ T2.6 (service + Zod) → T2.7 (wire) → T2.8 (REST + MCP). Atomic commit +
push par sous-task. Pas de Co-Authored-By. Pas de nom de client/prospect.

Avant T2.7 : gitnexus_impact obligatoire sur launchWorkflow / launchStep /
completeStep. Reporter blast radius dans le commit message.

Après T2 livré : me dire pour qu'on lance Phase 3 (review multi-agent) +
P4 (fix) + P5 (E2E).
```
