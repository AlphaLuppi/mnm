# Next-session prompt — T4 (Gate Runner)

Copy/paste this into a fresh Claude Code session to continue MnM Governed Workflows at T4.

---

Salut, on continue l'implémentation des MnM Governed Workflows.

# Contexte

Repo : `C:\Users\tom.andrieu\IdeaProjects\perso\alphalup\mnm` (branch master).

Le design MVP est un système de workflows gouvernés : DAG de steps + gates TS versionnées git, sandboxées server-side (isolated-vm), avec MCP + hook SessionStart pour brancher Claude Code côté user.

Découpage en 7 tranches (T1..T7). **T1, T2, T3 sont shipped.** Les 4 tranches restantes sont à faire.

Statut actuel :
- **T1 shipped 2026-04-21** (`fb028ae..1c483e1`) — Package `@mnm/governed-workflows` (zod schemas + types)
- **T2 shipped 2026-04-21** (`dd8fc01..f438256`, docs `431244d`) — Migrations DB (4 tables + RLS + extensions)
- **T3 shipped 2026-04-21** (`a0d9464..969dd6b`) — Package `@mnm/git-provider`
- **T4 pending** ← cette session
- T5/T6/T7 dépendent de T4 à des degrés variables

# Docs à lire avant de commencer

1. **Spec design (source of truth)** : `docs/superpowers/specs/2026-04-20-governed-workflows-mvp-design.md`
   → Sections 1-7 + table §7 (statuts T1/T2/T3 ✅, T4-T7 ⏳). Section 6 (gate sandbox) est le cœur de T4.

2. **Plan T3 (format attendu + completion report + retro)** : `docs/superpowers/plans/2026-04-21-governed-workflows-T3-git-provider.md`
   → Surtout la section "Completion report" en bas (11 commits, 8 follow-ups différés, 6 process leçons).

3. **Plan T2** : `docs/superpowers/plans/2026-04-21-governed-workflows-T2-migrations.md`
4. **Plan T1** : `docs/superpowers/plans/2026-04-21-governed-workflows-T1-package.md`

5. **Brainstorm session 2** : `_bmad-output/brainstorming/implementation-governed-workflows-2026-04-20-session2.md`

# Conventions MnM à respecter

- `CLAUDE.md` racine : atomic commit + push
- Monorepo bun workspaces (`packages/*`, `server`, `ui`, `cli`)
- Conventional commits scope `workflows` (ex: `feat(workflows): ...`)
- RLS multi-tenant (déjà en place)
- Pas d'emojis dans code/commits
- Tests via vitest, TDD pour le nouveau code
- Shell bash sur Windows (Unix paths, forward slashes)

# Leçons process T3 à appliquer dès T4

Six leçons identifiées dans le T3 completion report :

1. **`impl` silent-stalling est la failure mode dominante.** Deux teammates T3 (`impl` et `impl-2`) ont ghost-stalled après avoir écrit les fichiers mais avant le commit. Recovery team-lead : vérifier files match plan, run tests+typecheck, commit direct. Mitigation T4 : front-loader un heartbeat ou "halfway check-in" obligatoire dans le brief initial.

2. **JSON `task_assignment` n'est PAS une brief authorization.** `impl-2` a démarré T3.8 sur la base du JSON auto-généré par `TaskUpdate owner=...` au lieu d'attendre la prose brief. Clarifier dès le spawn : "seuls les prose SendMessage de team-lead autorisent le travail; JSON task_assignment est un label UI."

3. **Comment-stripping est systématique sans instruction explicite.** `impl-2` a consistamment supprimé les JSDoc/inline comments prescrits par le plan (traités comme "narration" per CLAUDE.md no-comments default). 6 comments stripped en T3.6, 6 en T3.7, 7 en T3.8, puis 0 en T3.9 après instruction explicite. Standing order T4 : "plan comments are contract, not narration — copy verbatim."

4. **Plan regexes testées contre OS réel.** `classifyGitError` du plan T3 manquait `Needed a single revision` et `invalid object name` — Windows-specific stderr. Patched retroactivement. Pour T4 : tout regex/pattern matching validé contre l'OS cible avant commit du plan.

5. **Messages-cross-in-flight est routine.** Chaque ship/brief arrivait quasi-simultanément. Harmless, `impl-2` a appris à répondre "already shipped, idle" sur cross-fire.

6. **25 Minors → 10 applied + 8 deferred.** Reviewers flaggent libéralement, team-lead triage par impact. Pattern à reproduire en T4 : accepter plus de defer, pas moins de flag.

# Follow-ups T1/T3 à intégrer dans T4

**Depuis T1 completion report (3 Important à traiter en T4's first PR)** :
1. `.strict()` sur `gateOutputSchema` dans `@mnm/governed-workflows`
2. JSDoc disambiguation sur les error codes (GATE_* vs WORKFLOW_*)
3. Integration test avec `config` non-vide passé au `GateContext`

**Depuis T3 deferred** (peut rester defer si pas dans le critical path T4) :
- GitlabProvider.pathExists ref-first semantics
- 400→conflict narrowing
- RateLimit-Remaining pre-emptive backoff
- `server_error` code
- Author identity validation
- Voir T3 plan completion report pour la liste complète

# Ce que T3 a livré (pour T4)

- Package `@mnm/git-provider` importable : `GitProvider` interface, `LocalBareRepoProvider`, `GitlabProvider`, `ShaCache`, `GitProviderError` (7 codes closed-set)
- `GitProvider.fetchBlob({path, ref})` pour charger `.gate.ts` sources au runtime
- `ShaCache` pour memoïzer les reads sha-pinned (T4 gate runner réutilise cette instance)
- Pas de polling, fetch on-demand, erreurs classées

T4 consomme ça : le gate runner charge le source `.gate.ts` via `fetchBlob(path, sha)`, compile avec esbuild, exécute dans isolated-vm.

# Scope T4 (spec §6 + §7)

**Gate runner générique + sandbox + composition nested-arrays** :

1. **Isolated-vm wrapping** : spawn un context V8 frais par gate, 5s timeout + 256MB memory limit. No `process`/`child_process`/`eval`/`require`/`import` dynamique.

2. **esbuild runtime compile** : fetch `.gate.ts` via GitProvider → bundle standalone (resolves `@mnm/governed-workflows` imports) → cache compiled par `git_sha`.

3. **`runGateBlock(block, ctx, kind)` générique** : agnostique au `kind` (entry/exit/futur). Exécute un `GateBlock` nested-array (outer=séquence, inner=parallèle race). Retourne `GateBlockResult` avec liste de `GateResult`.

4. **GateContext exposé (read-only)** : artifact, run metadata, step, config paramétré, kind, helpers (queryTraces, checkWorkflowExists — à définir). Pas d'accès DB direct, pas de réseau brut.

5. **Fail-closed errors** : GATE_TIMEOUT / GATE_EXCEPTION / GATE_INVALID_OUTPUT / GATE_SANDBOX_CRASH. Retry 1× sur sandbox crash puis fail-closed.

6. **Integration tests contre fakes** : gates qui pass/fail/throw/infinite-loop/invalid-output, composition parallel/sequential, DAG interne.

**Questions ouvertes à trancher pendant le plan T4** :
- Où vit le gate runner : nouveau package `@mnm/gate-runner` ou dans `packages/server/` ? Recommandation : nouveau package (isolation, T5 MCP l'importe).
- `GateContext.helpers.queryTraces` signature : quelle partie de la DB traces est exposable sans leak cross-tenant ? Recommandation : read-only query par `company_id` (RLS-enforced), filtered shape. À définir.
- esbuild configuration : bundle strategy (inline `@mnm/governed-workflows` or external ?). Recommandation : inline (self-contained bundle caché par sha).
- Cache layout : in-memory RAM only, ou disk backup ? Recommandation : RAM-only MVP (ShaCache pattern réutilisé).
- isolated-vm deps Windows : a un native addon — check build. Backup : `node:vm` avec context isolation (moins strict mais built-in).

# Workflow d'exécution recommandé

1. **Plan** via skill `superpowers:writing-plans` → sauve dans `docs/superpowers/plans/YYYY-MM-DD-T4-gate-runner.md`. TDD bite-sized, file paths exacts, code complet, commandes exactes, conventional commit par task.

2. **Exécution** via skill `superpowers:subagent-driven-development` :
   - Option A (subagent one-shot frais par task) : plus prévisible, pas de silent-stall
   - Option B (agent team persistante) : plus parallélisable mais silent-stall fréquent en T3
   - **Recommandation T4 : Option A.** Les stalls T3 (impl puis impl-2) ont coûté ~6 min de recovery chacun. One-shot agents coupent le problème à la racine. Trade vs parallélisme des reviews : acceptable sur une tranche isolée comme T4.

3. **Per task** : implémenter → spec-compliance review → code-quality review → fix si Critical/Important, sinon defer au sweep.

4. **Final** : update statut T4 dans spec §7, append completion report au plan file, commit docs.

# Question pour démarrer

1. **Option A (one-shot subagent)** ou **B (team persistante)** ? Je recommande A pour T4 (2 stalls en T3).

2. **isolated-vm vs node:vm** : isolated-vm a un native addon buggy sur Windows (cpu-features failures pré-existants). node:vm built-in mais moins strict (pas de real memory limit). Recommandation : tenter isolated-vm d'abord, fallback node:vm si blocked.

3. **Plan T4 dès maintenant, ou brainstorm rapide d'abord** sur les 4-5 questions ouvertes ?

Dis-moi et on y va.
