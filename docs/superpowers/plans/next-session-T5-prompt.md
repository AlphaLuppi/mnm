# Next-session prompt — T5 (MCP tools)

Copy/paste this into a fresh Claude Code session to continue MnM Governed Workflows at T5.

---

Salut, on continue l'implémentation des MnM Governed Workflows.

# Contexte

Repo : `C:\path\to\mnm` (branch master).

Statut actuel :
- **T1 shipped 2026-04-21** (`fb028ae..1c483e1`) — Package `@mnm/governed-workflows` (zod schemas + types + `defineGate<Artifact, Config>`)
- **T2 shipped 2026-04-21** (`dd8fc01..f438256`) — Migrations DB (4 tables + RLS + text+CHECK `status`/`state` + `gate_results.kind` text + `config_layer_items.env_ref`)
- **T3 shipped 2026-04-21** (`a0d9464..969dd6b`) — Package `@mnm/git-provider` (`GitProvider` interface + `LocalBareRepoProvider` + `GitlabProvider` + `ShaCache` + 7 closed-set error codes)
- **T4 shipped 2026-04-21** (`7dec547..49d426f`) — Package `@mnm/gate-runner` (isolated-vm + esbuild + `runGateBlock` kind-agnostic + `CompiledCache` RAM + fail-closed errors + retry-once sur sandbox crash + test-only `attemptEval` dep seam)
- **T5 pending** ← cette session
- T6/T7 dépendent de T5 à des degrés variables

# Docs à lire avant de commencer

1. **Spec design (source of truth)** : `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`
   → Section 4 (les 7 primitives MCP) + Section 2 (data model) + Section 6 (gate runner flow) + Table §7 (T1-T4 ✅).

2. **Plan T4 (format attendu + completion report + retro)** : `docs/superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md`
   → Section "Completion report" en bas (13 commits, deferred follow-ups, 8 process leçons).

3. **Plan T3** : `docs/superpowers/plans/2026-04-21-governed-workflows-T3-git-provider.md` — pour l'API `GitProvider.fetchBlob / listTags / resolveRef / pathExists / commitFile`.

4. **Plan T2** : `docs/superpowers/plans/2026-04-21-governed-workflows-T2-migrations.md` — pour le schema des 4 tables DB.

5. **Plan T1** : `docs/superpowers/plans/2026-04-21-governed-workflows-T1-package.md` — pour les schemas zod et les types.

# Conventions MnM à respecter

- `CLAUDE.md` racine : atomic commit + push
- Monorepo bun workspaces (`packages/*`, `server`, `ui`, `cli`)
- Conventional commits scope `workflows` (ex: `feat(workflows): ...`)
- RLS multi-tenant (déjà en place + contexte DB via `tenantContextMiddleware`)
- Pas d'emojis dans code/commits
- Tests via vitest, TDD pour le nouveau code
- Shell bash sur Windows (Unix paths, forward slashes)

# Leçons process T4 à continuer d'appliquer

Issues from T4 retro (plan T4 completion report bottom) :

1. **Team persistence + waves parallèles ont marché** : 13 commits en ~25 min, 0 merge conflict, parallélisme Wave 1 (6 tasks sur 3 impl) a tenu. Repeat le pattern T4.
2. **First brief stalle quasi-systématiquement** : impl-1 puis impl-2 puis impl-3 ont silent-stall sur leur premier brief de la session. Chaque fois resolved par un nudge team-lead. Mitigation T5 : envoyer le premier brief à impl-1 puis attendre 30s activement avant de brief impl-2/impl-3, pour réveiller le runtime proprement.
3. **Halfway check-ins ont donné 100% de visibilité** — garder la standing order.
4. **JSON task_assignment ≠ brief authorization** — rappeler dans chaque brief initial.
5. **Plan comments are contract** — 0 stripped JSDoc sur 13 commits quand front-loadé.
6. **Messages-cross-in-flight routine** — implementer resend sur chaque ship, harmless, juste accuser et continuer.
7. **Code-rev plan gaps** : T4 plan manquait les tests de retry-branch. Pour T5, **pre-mortem avant plan** : lister toutes les branches conditionnelles et exiger un test chacune.
8. **Stale version strings in plan JSDoc** — ajouter au plan-author checklist T5 : vérifier tous les refs de version (`isolated-vm`, `esbuild`, Node engines) dans les inline docs contre `package.json` actuel.

# Follow-ups T4 à intégrer dans T5 (ou laisser deferred)

**Depuis T4 deferred** :
- **Node engines mismatch** : root `package.json` dit `"node": ">=20"` mais `isolated-vm@6.x` veut `>=22`. À coordonner en T5 (bump root engines ou pin isolated-vm v4.x).
- **Wire-up `@mnm/git-provider`** : dep declared dans `packages/gate-runner/package.json` mais pas importée. T5 MCP ajoute la pipeline `fetchBlob(path, sha) → ShaCache → compileGateSource → runGateBlock`.
- **Real `GateContext.helpers.queryTraces` + `checkWorkflowExists`** : MVP exposait `helpers: {}` stub. T5 remplit la pipe DB read-only RLS-scoped.
- **T4.4 minors (IDE polish)** : narrow `kind` type union, typed `error_code` union, JSDoc cross-refs. Non-bloquant.

**Depuis T3 deferred** (peut rester deferred) :
- GitlabProvider.pathExists ref-first, 400→conflict narrowing, RateLimit-Remaining backoff, `server_error` code, author identity validation, webhook listener. Voir plan T3 completion report.

**Depuis T2 deferred** :
- Advisory lock (`pg_advisory_xact_lock`) sur `launchWorkflow` — à implémenter en T5.

# Ce que T4 a livré (pour T5)

- Package `@mnm/gate-runner` importable :
  - `runSingleGate({gateItem, source, gateSourcePath, gitSha, kind, context}, deps)` — evaluate une gate dans isolated-vm
  - `runGateBlock({block, kind, gitSha, context, resolveSource}, deps)` — compose un `GateBlock` nested-array (sequential outer + parallel inner)
  - `CompiledCache` RAM-only, FIFO 500 entries
  - `compileGateSource(source, path)` — esbuild.transform TS→CJS
  - `classifyIsolateError(value)` — deterministic GATE_* mapping
  - `RunSingleGateDeps`, `RunnerOptions`, `GateEvaluationResult`, `GateBlockResult` (types publics)
- `defineGate` identity runtime + isolate shim (`require("@mnm/governed-workflows")` resolves inside sandbox)
- Fail-closed on 4 error codes (GATE_TIMEOUT / GATE_EXCEPTION / GATE_INVALID_OUTPUT / GATE_SANDBOX_CRASH) avec retry-once sur crash
- 50/50 vitest green, monorepo typecheck green

T5 consomme ça : l'orchestrateur MCP appelle `runGateBlock` aux hooks `launchStep` (entry gate) et `completeStep` (exit gate), avec un `resolveSource` qui pipe `GitProvider.fetchBlob` + `ShaCache`.

# Scope T5 (spec §4)

**7 primitives MCP** (tools exposés à Claude Code via stdio) :

### Discovery
1. **`listWorkflows({enabled?})`** → `[{name, description, latest_git_tag}]`. Lit `governed_workflow_definitions` (RLS par company).
2. **`getWorkflow({name, git_tag?})`** → parsed JSON + meta. Fetch `workflow.json` via `GitProvider.fetchBlob` au tag (default: `latest_git_tag`), parse contre `workflowDefinitionSchema`, cache par sha.
3. **`getWorkflowState({runId})`** → `{status, steps:[{id, state, artifact_ok}], last_gate_result}`. Lit `governed_workflow_runs` + `governed_step_executions` + `gate_results`.

### Exécution
4. **`launchWorkflow({name, git_tag?, params})`** → `{runId, firstStep}`. Advisory lock. Insert run + N step_executions (pending).
5. **`launchStep({runId, stepId})`** → `{agent_name, prompt_context, subagent_type}`. Vérifie deps OK. Si entry gate définie, eval via `runGateBlock` — si pass, retourne le triplet; si fail, renvoie `WORKFLOW_*` error + hints.
6. **`completeStep({runId, stepId, artifact})`** → `{status}` ou error. Eval exit gate. Si pass, unlock deps + peut-être run complete. Si fail, `error_code` + `hints` remontés.

### Sync
7. **`syncEnvironment({lastSyncedSha?})`** → `{agents:[{name, md_content, config_merged}], changelog, newSha}`. Lit `agents` + fetch `agent.md` + merge `config_layer_items`.

### Contrat d'erreur uniforme
```json
{
  "isError": true,
  "error_code": "WORKFLOW_DEPENDENCY_UNMET",
  "message": "Cannot launch 'shout': missing 'greet'. Call getWorkflow('hello-world') for DAG.",
  "hints": ["Start with the first step", "Check getWorkflowState"]
}
```

### Helpers pour gate sandbox
- Définir `ctx.helpers.queryTraces(filter)` (read-only, RLS-scoped) + `ctx.helpers.checkWorkflowExists(name)` — passés au sandbox via `ivm.Reference`.

# Questions ouvertes à trancher pendant le plan T5

1. **Où vit l'orchestrateur MCP** : `packages/mcp-orchestrator/` nouveau package, ou dans `packages/server/`?
2. **Transport** : MCP stdio (standard Anthropic) via `@modelcontextprotocol/sdk` — confirmer version + match with Claude Code harness.
3. **`resolveSource` factory** : comment router le path `./gates/xxx.gate.ts` d'un GateItem contre le repo + sha du run ? Plan pour une closure `makeResolveSource(gitProvider, workflowGitSha, workflowPath)` → `(itemSource) => {source, gateSourcePath}`.
4. **`ctx.helpers` signature** :
   - `queryTraces(filter: {...}): Promise<Trace[]>` — quelle shape de filter ? SQL-like, tags-based, time-range? RLS-scoped via `app.current_company_id`.
   - `checkWorkflowExists(name: string): Promise<boolean>` — trivial lookup.
5. **Advisory lock scope** : `pg_advisory_xact_lock(hashtext("launchWorkflow:" + runId))` dans la même TX que l'insert du run.
6. **Helper functions via `ivm.Reference`** : pass async refs into sandbox, await via `.apply(null, [...], { result: { promise: true, copy: true }, timeout })`.
7. **Error taxonomy** : use `WORKFLOW_*` codes from `@mnm/governed-workflows` + possibly add `WORKFLOW_RUN_NOT_FOUND`, `WORKFLOW_GATE_FAILED` (surface gate fail distinctly from tool error).

# Workflow d'exécution recommandé

1. **Plan** via `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-T5-mcp-tools.md`. TDD bite-sized, file paths exacts, code complet.
2. **Exécution** via `superpowers:subagent-driven-development` OU team persistante (T4 retro confirme team ✅).
   - Si team : `TeamCreate gw-t5`, 3 impl + 2 reviewers.
3. **Per task** : impl → halfway check-in → commit+push → spec-rev → code-rev → fix si Critical/Important sinon defer.
4. **Final** : update spec §7 T5 row + completion report + T6 next-session prompt.

# Question pour démarrer

1. **Team persistante (comme T4) ou one-shot subagents** ?
2. **Plan T5 dès maintenant ou brainstorm 5 min** sur les 7 questions ouvertes ?
3. **MCP SDK version** : vérifier la version installée par Claude Code côté user + confirmer compat.

Dis-moi et on y va.
