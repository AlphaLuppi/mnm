# Next-session prompt — T6 (Hook SessionStart + cache client)

Copy/paste this into a fresh Claude Code session to continue MnM Governed Workflows at T6.

---

Salut, on continue l'implémentation des MnM Governed Workflows.

# Contexte

Repo : `C:\Users\tom.andrieu\IdeaProjects\perso\alphalup\mnm` (branch master).

Statut actuel :
- **T1 shipped 2026-04-21** (`fb028ae..1c483e1`) — Package `@mnm/governed-workflows` (zod schemas + types + `defineGate<Artifact, Config>`)
- **T2 shipped 2026-04-21** (`dd8fc01..f438256`) — Migrations DB (4 tables + RLS + text+CHECK `status`/`state` + `gate_results.kind` text + `config_layer_items.env_ref`)
- **T3 shipped 2026-04-21** (`a0d9464..969dd6b`) — Package `@mnm/git-provider` (`GitProvider` interface + `LocalBareRepoProvider` + `GitlabProvider` + `ShaCache` + 7 closed-set error codes)
- **T4 shipped 2026-04-21** (`7dec547..49d426f`) — Package `@mnm/gate-runner` (isolated-vm + esbuild + `runGateBlock` kind-agnostic + `CompiledCache` RAM + fail-closed errors + retry-once sur sandbox crash + test-only `attemptEval` dep seam)
- **T5 shipped 2026-04-22** (`9a1cbe2..44de8d8`) — 7 MCP tools + `governedWorkflowService` complet + `installHelpers` bridge ivm.Reference + `buildGateHelpers` (queryTraces + checkWorkflowExists) + `makeResolveSource` + advisory lock + E2E hello-world + Node engines ≥22
- **T6 pending** ← cette session
- T7 dépend de T6

# Docs à lire avant de commencer

1. **Spec design (source of truth)** : `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`
   → Section 3 (hook SessionStart + cache client) + Section 4 (MCP tools) + Table §7 (T1-T5 ✅).

2. **Plan T5 (completion report + retro)** : `docs/superpowers/plans/2026-04-21-governed-workflows-T5-mcp-tools.md`
   → Section "Completion report" en bas (12 commits, deferred follow-ups T5-DEF-1..9, 8 process leçons).

3. **Plan T4** : `docs/superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md` — pour l'API `@mnm/gate-runner`.

4. **Plan T3** : `docs/superpowers/plans/2026-04-21-governed-workflows-T3-git-provider.md` — pour l'API `GitProvider`.

5. **Plan T2** : `docs/superpowers/plans/2026-04-21-governed-workflows-T2-migrations.md` — pour le schema des 4 tables DB.

# Conventions MnM à respecter

- `CLAUDE.md` racine : atomic commit + push
- Monorepo bun workspaces (`packages/*`, `server`, `ui`, `cli`)
- Conventional commits scope `workflows` (ex: `feat(workflows): ...`)
- RLS multi-tenant (déjà en place + contexte DB via `tenantContextMiddleware`)
- Pas d'emojis dans code/commits
- Tests via vitest, TDD pour le nouveau code
- Shell bash sur Windows (Unix paths, forward slashes)
- **DB test credentials** : `DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test` (pas `postgres:postgres`). Le container Docker expose le port 5433.

# Leçons process T5 à appliquer dès T6

1. **Stall silencieux tardif plus dangereux que le premier brief** : en T5, impl-1 a stallé après avoir livré 3 tasks successives. Envoyer `shutdown_request` dès le 2e silence consécutif post-ship, pas seulement sur le 1er brief.
2. **Pre-flight schéma DB obligatoire** : valider les noms de colonnes contre `packages/db/src/schema/` avant de codifier dans le plan. En T5, la raw SQL de Task 10 référençait `agent_name`, `step_id`, `gold_summary` qui n'existent pas.
3. **ShaCache API réelle : `get(sha, path)` / `set(sha, path, value)`** — pas de `getOrFetch`. Plusieurs impls T5 ont dû adapter. Documenter explicitement dans chaque brief qui touche ShaCache.
4. **issue_prefix unique par suite de test** : toute suite qui insère des companies doit utiliser un prefix distinct (ex: `T6HL`) + `ON CONFLICT (id) DO NOTHING` pour robustesse cross-suite.
5. **compiledCache shas distincts par fixture** : le `CompiledCache` est en RAM globale dans le process vitest — utiliser des shas uniques par fixture pour éviter les collisions.
6. **ivm timeout helpers = wall-clock, pas CPU** : `Reference.apply({ timeout: 3000 })` est CPU-time de l'isolate, inefficace pour les Promises async. Utiliser `Promise.race` côté host avec `setTimeout`.
7. **ivm structured-clone accepte les circulaires** : `copy:true` ne rejette pas les circulaires en ivm 6.x, il les copie avec `[Circular]`. Ne pas tester la rejection sur circulaires — tester sur fonctions (non-cloneables).
8. **Plan comments are contract** : 0 stripped JSDoc sur 12 commits T5. Standing order "copie verbatim les JSDoc du plan" front-loadée dans chaque brief.

# Follow-ups T5 à intégrer dans T6 (DEF-1 + DEF-2 + DEF-7)

**Prioritaires pour T6** :
- **T5-DEF-1** : `mergeAgentConfig` stub retourne des buckets vides — wirer `configLayerConflictService.mergePreview(companyId, agentId)` une fois le tag scoping résolu.
- **T5-DEF-2** : `syncEnvironment.changelog` non peuplé — le harness peut diff localement, mais idéalement peuplé côté server.
- **T5-DEF-7** : audit emit sur chaque transition governed-workflow via `services.audit` — si l'audit trail est requis dans le hook SessionStart.

**Restent post-MVP** :
- T5-DEF-3 (filtre queryTraces étendu), T5-DEF-5 (cache workflow per-run), T5-DEF-6 (webhook GitLab), T5-DEF-8 (helpers AbortController).

**T6/T7** :
- T5-DEF-4 : `resolveGitProvider` per-company (multi-tenant prod). T7.
- T5-DEF-9 : board users multi-company dans MCP tools. T7.

# Ce que T5 a livré (pour T6)

- 7 MCP tools opérationnels via `buildMcpServices` :
  - `listWorkflows`, `getWorkflow`, `getWorkflowState` (discovery)
  - `launchWorkflow` (advisory lock), `launchStep` (entry gate), `completeStep` (exit gate + cascade)
  - `syncEnvironment` (agents + config, changelog stub)
- `governedWorkflowService` complet dans `server/src/services/governed-workflows.ts`
- `buildGateHelpers({db, companyId})` → `{queryTraces, checkWorkflowExists}` (RLS-scoped)
- `installHelpers(context, jail, helpers)` bridge ivm.Reference dans `@mnm/gate-runner`
- `makeResolveSource({gitProvider, workflowGitSha, workflowRepoPath, shaCache})` factory
- Contrat erreur uniforme `{isError, error_code, message, hints}` sur tous les tools

T6 consomme ça : le hook SessionStart appelle `syncEnvironment` via MCP, écrit les fichiers locaux, et bootstrappe l'environnement Claude Code de l'agent.

# Scope T6 (spec §3)

**Hook SessionStart + cache client** :

### Fichiers locaux managed
- `~/.mnm/cache/<companyId>/agents/<agentName>.md` — system prompt de l'agent
- `~/.mnm/cache/<companyId>/config.json` — config merged
- `~/.mnm/cache/<companyId>/meta.json` — `{lastSyncedSha, syncedAt}`

### Atomic write strategy
- Write to `.tmp` + `rename` (atomic sur POSIX, near-atomic sur Windows via NTFS)
- Vérifier que le répertoire parent existe avant chaque write

### Hook SessionStart Claude Code
- Fichier : `~/.claude/hooks/session-start.sh` (ou `.js`) — exécuté par Claude Code au démarrage de chaque session
- Appelle le tool MCP `syncEnvironment({lastSyncedSha})` via stdio
- Si `newSha !== lastSyncedSha` : écrit les fichiers mis à jour, log le changelog
- Idempotent si aucun changement

### `.mnm-managed.json` tracking
- Répertoire : `~/.mnm/` racine
- Contenu : `{managedAgents: string[], lastSync: ISO, companyId: string}`
- Mis à jour après chaque sync réussi

### Merge non-destructif
- `~/.claude/mcp.json` : ajouter les servers MnM sans écraser les servers existants (merge par clé)
- `~/.claude/settings.json` : ajouter les hooks MnM sans écraser les hooks existants (merge par clé)
- Jamais de remplacement aveugle — lire, merger, écrire

### Plugin Claude Code minimal
- Script `packages/mnm-plugin/` (ou inline dans `cli/`) qui implémente le hook SessionStart
- Exécutable standalone (bun script) ou npm binary
- Gère les erreurs réseau (MCP down → log warning, ne pas bloquer la session)

# Questions ouvertes à trancher pendant le plan T6

1. **Emplacement du plugin** : monorepo `packages/mnm-plugin/` vs `cli/` existant vs script standalone ? Recommandation : `packages/mnm-plugin/` pour isolation.
2. **Transport hook → MCP** : le hook SessionStart communique avec le server MnM via stdio MCP ou HTTP direct ? Recommandation : HTTP direct sur `localhost:PORT` (plus simple que spawner un process stdio depuis un hook shell).
3. **Secret handling** : le hook a besoin d'un token d'auth pour parler au server. Où le stocker ? `~/.mnm/auth.json` ? Env var ? Recommandation : `~/.mnm/auth.json` (jamais dans `settings.json` public).
4. **Atomic write sur Windows** : `rename` NTFS peut échouer si le fichier destination est ouvert. Alternative : `mv /Y` via PowerShell ou `fs.rename` Node qui utilise `MoveFileEx`. À tester.
5. **Merge `mcp.json` et `settings.json`** : format exact de Claude Code — vérifier la spec MCP stdio de `@modelcontextprotocol/sdk` pour les noms de champs.

# Workflow d'exécution recommandé

1. **Plan** via `superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-T6-session-start.md`. TDD bite-sized, file paths exacts, code complet.
2. **Exécution** via team persistante (T5 retro confirme team ✅) ou one-shot subagents.
3. **Per task** : impl → halfway check-in → commit+push → typecheck.
4. **Final** : update spec §7 T6 row + completion report + T7 next-session prompt.

# Question pour démarrer

1. **Team persistante ou one-shot subagents** ?
2. **Transport hook → MCP** : stdio vs HTTP ?
3. **Plan T6 dès maintenant ou brainstorm 5 min** sur les 5 questions ouvertes ?

Dis-moi et on y va.
