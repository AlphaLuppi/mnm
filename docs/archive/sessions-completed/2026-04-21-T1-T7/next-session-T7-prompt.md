# Next-session prompt — T7 (final polish + distribution)

Copy/paste this into a fresh Claude Code session to continue MnM Governed Workflows at T7.

---

Salut, on continue l'implémentation des MnM Governed Workflows.

# Contexte

Repo : `C:\path\to\mnm` (branch master).

Statut actuel :
- **T1 shipped 2026-04-21** (`fb028ae..1c483e1`) — Package `@mnm/governed-workflows` (zod schemas + types + `defineGate<Artifact, Config>`)
- **T2 shipped 2026-04-21** (`dd8fc01..f438256`) — Migrations DB (4 tables + RLS + text+CHECK `status`/`state` + `gate_results.kind` text + `config_layer_items.env_ref`)
- **T3 shipped 2026-04-21** (`a0d9464..969dd6b`) — Package `@mnm/git-provider` (`GitProvider` interface + `LocalBareRepoProvider` + `GitlabProvider` + `ShaCache` + 7 closed-set error codes)
- **T4 shipped 2026-04-21** (`7dec547..49d426f`) — Package `@mnm/gate-runner` (isolated-vm + esbuild + `runGateBlock` kind-agnostic + `CompiledCache` RAM + fail-closed errors + retry-once sandbox crash)
- **T5 shipped 2026-04-22** (`9a1cbe2..44de8d8`) — 7 MCP tools + `governedWorkflowService` + `installHelpers` bridge ivm.Reference + `buildGateHelpers` + `makeResolveSource` + advisory lock + E2E hello-world
- **T6 shipped 2026-04-22** (`2e31baa..7acdb8a`) — Plugin MnM (`plugins/mnm/`), SessionStart hook binary, `setup_workspace` + `push_local_state` MCP tools, `launchStep` enriched avec `current_agents` + `session_tools` (stale/missing self-correction), `GovernedWorkflowError.data`, E2E bootstrap test
- **T7 pending** ← cette session

# Scope T7

1. **Hot-reload spike** : exécuter le protocole de `docs/superpowers/specs/T6-hot-reload-spike-result.md` dans une session Claude Code live, remplir les résultats, ajuster le README plugin + ajouter le pattern "dispatch inline" si nécessaire.
2. **T5-DEF-1** : wirer `mergeAgentConfig` dans `governedWorkflowService` — utiliser `configLayerConflictService.mergePreview` pour retourner les vrais buckets (mcp/hook/setting/env_ref) pré-mergés, non plus un stub.
3. **T5-DEF-4** : `resolveGitProvider` per-company (multi-tenant prod) — injection du bon provider selon `companyId`, pas un singleton.
4. **T5-DEF-9** : board users multi-company dans MCP tools — les actors de type `user` avec plusieurs `companyIds` doivent passer un `company_id` explicite ou se voir rejetés.
5. **Plugin marketplace** : créer/publier le repo `mnm-platform/claude-plugins` avec un `marketplace.json` pointant sur `plugins/mnm/`. Tester l'install via `/plugin marketplace add ...` + `/plugin install mnm@mnm-platform`.
6. **Onboarding harness skill** : créer un skill Claude Code `mnm--onboard` qui guide l'user à travers le setup initial (appelle `setup_workspace`, écrit les agents, fait le premier `push_local_state`).

# Docs à lire avant de commencer

1. `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md` — design MVP complet (T6 section 5 superseded).
2. `docs/superpowers/specs/2026-04-22-governed-workflows-T6-plugin-design.md` — design T6 final.
3. `docs/superpowers/plans/2026-04-22-governed-workflows-T6-plugin.md` — **completion report en bas** pour les leçons process + tâches résiduelles détaillées.
4. `docs/superpowers/specs/T6-hot-reload-spike-result.md` — à ouvrir EN PRIORITÉ pour exécuter le spike.
5. `docs/superpowers/plans/2026-04-21-governed-workflows-T5-mcp-tools.md` — completion report T5 avec la liste complète des DEFs.

# Ce que T6 a livré (pour T7)

- `plugins/mnm/` — Plugin Claude Code distribuable : `plugin.json`, `.mcp.json` (HTTP + OAuth 2.1), `hooks/hooks.json`, `bin/mnm-session-start` compilé, `README.md`.
- `packages/mnm-plugin/` — Source TS du SessionStart hook binary + atomic-write util + tests vitest.
- 2 nouveaux MCP tools : `setup_workspace` (bootstrap agents → content + sha + target path + harness write instructions) et `push_local_state` (cache `last-session.json`).
- `launch_governed_step` enrichi : retourne `current_agents` + `session_tools` dans la réponse ; si stale → `AGENTS_STALE` avec fresh content ; si missing → `MISSING_TOOLS` avec hints.
- `GovernedWorkflowError.data` — payload structuré optionnel dans le contrat d'erreur MCP.
- E2E test `server/src/__tests__/t6-bootstrap-and-launch.e2e.test.ts` — setup → launch stale → retry pass → push cache.

# Leçons process T6 à appliquer dès T7

1. **Pre-flight schéma DB reste obligatoire** — zéro mismatch de colonnes durant T6 grâce à cette discipline (vs plusieurs en T5).
2. **Plan comments = contract** — 0 stripped JSDoc sur 15 commits T6. Standing order à front-loader dans chaque brief T7.
3. **Fresh subagent per task + task-reading-from-plan-file** — gain context controller ~50-70 %. Pattern à reconduire pour T7 (surtout pour les tâches DEF-1/DEF-4/DEF-9 qui sont indépendantes).
4. **Windows entry-point** : `import.meta.url === \`file://${process.argv[1]}\`` NE MATCHE PAS sur Windows (triple-slash vs double-slash). Toujours comparer via `pathToFileURL(process.argv[1]).href`. Noter dans memory projet pour tout futur compiled binary.
5. **`.gitattributes` LF sur binaires bundlés** : obligatoire pour protéger shebang sur clones Linux/macOS quand `core.autocrlf=true`. Pattern reproductible.
6. **E2E harness** : suivre le pattern inline-wiring existant plutôt qu'inventer une abstraction (`setupE2EHarness`). Étendre la fixture canonique bare-repo seed pour nouveaux agents.
7. **Tool tests** : mock-based pattern (`collectTools` + mocked service) cohérent avec le reste du suite — ne pas inventer un `setupToolHarness`.

# Conventions MnM à respecter

- `CLAUDE.md` racine : atomic commit + push
- Monorepo bun workspaces (`packages/*`, `server`, `ui`, `cli`, `plugins/*`)
- Conventional commits scope `workflows` (ex: `feat(workflows): ...`)
- RLS multi-tenant (déjà en place + contexte DB via `tenantContextMiddleware`)
- Pas d'emojis dans code/commits
- Tests via vitest, TDD pour le nouveau code
- Shell bash sur Windows (Unix paths, forward slashes)
- **DB test credentials** : `DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test`

# Follow-ups T5 restants (rappel de priorité T7)

**Prioritaires pour T7** :
- **T5-DEF-1** — `mergeAgentConfig` → wirer `configLayerConflictService.mergePreview(companyId, agentId)`. Stub T6 retourne `{mcp:{}, hook:{}, setting:{}, env_ref:{}}` vides.
- **T5-DEF-4** — `resolveGitProvider` per-company (multi-tenant prod) — injection par `companyId`, pas un singleton.
- **T5-DEF-9** — board users multi-company : actor `user` avec plusieurs `companyIds` doit passer `company_id` explicite ou être rejeté.

**Déjà fait en T6** : l'équivalent du DEF-2 (changelog stub) reste à la même place, non prioritaire.

**Post-T7** : T5-DEF-3 (filtre queryTraces étendu), T5-DEF-5 (cache workflow per-run), T5-DEF-6 (webhook GitLab), T5-DEF-7 (audit emit), T5-DEF-8 (helpers AbortController).

# Workflow d'exécution recommandé

1. **Hot-reload spike EN PREMIER** — tout T7 (surtout marketplace + onboarding skill) en dépend, car les résultats vont dicter si le README pointe sur `/reload-plugins`, sur un dispatch inline, ou sur un restart complet.
2. **Plan** via `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-T7-polish-distribution.md`. TDD bite-sized, file paths exacts, code complet.
3. **Exécution** via fresh subagents per task (T6 retro a confirmé le gain context).
4. **Per task** : impl → halfway check-in → commit+push → typecheck.
5. **Final** : update spec §7 T7 row + completion report + (T8 prompt ou close épopée si MVP final).

# Question pour démarrer

1. **Exécuter le spike hot-reload immédiatement** (tout T7 en dépend) ou d'abord traiter les DEFs serveur ?
2. **Fresh subagent per task (pattern T6) ou team persistante** ?
3. **Marketplace en dernier ou d'abord** (il faut un plugin T6 stabilisé post-spike pour tester l'install end-to-end) ?

Dis-moi et on y va.
