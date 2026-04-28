# Plan — Paperclip upstream merge / cherry-pick / steal-patterns

> **Statut** : draft 2026-04-28
> **Branche de travail** : `feat/paperclip-upstream-merge` (forkée de `origin/master` au tip `03392581`)
> **Owner** : Tom + Claude
> **Source upstream** : `paperclipai/paperclip` (remote `upstream`)
> **Dernier merge upstream sur master MnM** : commit `14258051` le 2026-03-13 (`Merge branch 'tom-paperclip' into master`)

---

## 1. Contexte (et la décision principale)

MnM est un **fork stratégique permanent** de paperclipai/paperclip. Depuis le 2026-03-13, MnM a accumulé ~200 commits divergents (governed-workflows, multi-tenant + RLS, dynamic RBAC, AI Assistant Panel, Workflow Studio, cc-plugin-import, Trace pipeline, dashboard widgets, CAO, A2A bus, GitProvider unifié, desktop parity). En parallèle Paperclip a sorti 5 releases (v2026.318.0 → v2026.427.0).

**Décision actée** : **pas de `git merge upstream/master`**. Les zones les plus chaudes (`server/src/middleware/`, `server/src/routes/`, `server/src/services/`, `packages/db/src/schema/`, `ui/src/pages/`) ont divergé à >70 % entre les deux histoires. Un merge classique = 3 semaines de résolution de conflits + perte de cohérence multi-tenant + risque d'introduire des régressions sur les chantiers en cours (governed-workflows, open-source publication).

**Approche retenue** :
1. **Cherry-picks dirigés** sur les fix sécurité / CVE / bugs critiques (Phase 1)
2. **Portage architectural** des 2-3 features stratégiques alignées roadmap (Phases 2-4) → on relit les PR Paperclip, on adapte à MnM, on réimplémente proprement
3. **Vol de patterns** sans porter le code (Phase 5) — idempotency keys, resumable continuations, execution-target abstraction, plugin host RPC, typed activity events
4. **Process upstream-watch** mensuel (Phase 6) pour ne pas refaire ce travail dans 2 mois

**Sont explicitement skippés** : multi-user auth (#3784, déjà BetterAuth), execution policies issue-level (#3222, déjà step-level chez nous), subtree pause/cancel (#4332, déjà finer-grained), DB-backed company skills (#1346, on est file-based), promptfoo (#832, pas de campagne d'évals), routines engine (#1351, ré-implé from scratch sera plus rapide).

---

## 2. Pre-checks à exécuter en Phase 0 (preuves attendues)

### 2.1 Inventaire des routes non protégées par `assertCompanyMembership`
Avant de commencer les cherry-picks sécu, audit du middleware chain :
```bash
# routes top-level qui devraient être derrière /companies/:companyId/
grep -rE "router\.(get|post|put|patch|delete)\s*\(" server/src/routes/ \
  | grep -v "/companies/" \
  | grep -v "test\|spec" \
  > /tmp/mnm-routes-non-tenant.txt
```
**AC** : on liste les routes hors préfixe tenant et on classe chacune (légitime / à déplacer / à durcir).

### 2.2 Versions deps avec CVE potentielles
```bash
bun pm ls multer rollup better-auth drizzle-orm 2>&1 | grep -E "multer|rollup|better-auth|drizzle"
```
Connu : `drizzle-orm` à 0.45.2 déjà bumpé (commit `e27260a8`, 2026-04-25). `multer` (#2819) et `rollup` (#2909) à vérifier.

### 2.3 Confirmer que les patterns Paperclip skippés sont déjà couverts
- `cancelRun` / `reactivateRun` MCP tools : `git log --grep="cancel.*run\|reactivate" --oneline | head` (commits 27-28 avril)
- BetterAuth + invites : présence de `server/src/routes/auth.ts` + `server/src/routes/invites.ts`
- governed-workflows step-level cancel : `cancelled_at` colonne sur `governed_workflow_runs` (migration 0069)

**Output** : `docs/superpowers/upstream-watch.md` avec l'état initial (à compléter au fil du plan).

---

## 3. Phase 1 — Cherry-picks sécurité ciblés (1-2 jours)

### 3.1 Périmètre
6 PRs upstream à porter manuellement. Aucun ne sera "clean cherry-pick" car routes MnM ont préfixe `/companies/:companyId/` et middleware divergent. On utilise `git cherry-pick -n` (no-commit) → résolution manuelle → commit conventionnel MnM.

### 3.2 Tâches (par ordre de criticité)

| # | PR upstream | Type | Approche MnM | Output commit |
|---|---|---|---|---|
| 3.2.1 | [#3315](https://github.com/paperclipai/paperclip/pull/3315) | CVE GHSA-68qg-g8mg-6pr7 | Lire le diff, vérifier que toutes les routes équivalentes MnM passent par `assertCompanyMembership`. Compléter si manque. | `fix(security): port GHSA-68qg-g8mg-6pr7 — scope import/approval/activity routes` |
| 3.2.2 | [#4122](https://github.com/paperclipai/paperclip/pull/4122) | Authz hardening | 40+ routes hardenées upstream. Pour chaque, vérifier l'équivalent MnM et porter le check actor/company/active-checkout. | `fix(security): port API route authz hardening from upstream #4122` |
| 3.2.3 | [#2819](https://github.com/paperclipai/paperclip/pull/2819) + [#2909](https://github.com/paperclipai/paperclip/pull/2909) | CVE deps | `bun add multer@^2.1.1 rollup@^4.59.0` + lockfile + smoke test | `chore(deps): bump multer 2.1.1 + rollup 4.59.0 (CVEs)` |
| 3.2.4 | [#3124](https://github.com/paperclipai/paperclip/pull/3124) + [#2866](https://github.com/paperclipai/paperclip/pull/2866) | JWT secret | Vérifier que MnM n'a pas de fallback hardcoded JWT. BetterAuth utilise `BETTER_AUTH_SECRET` — confirmer que `agent.jwt` aussi. | `fix(security): remove any hardcoded JWT fallback, use BETTER_AUTH_SECRET` |
| 3.2.5 | [#2659](https://github.com/paperclipai/paperclip/pull/2659) | Bearer redaction logs | Identifier le logger MnM (probablement dans `server/src/middleware/logger.ts` ou équivalent), ajouter un redactor sur Bearer tokens. | `fix(security): redact Bearer tokens from server logs` |
| 3.2.6 | [#4225](https://github.com/paperclipai/paperclip/pull/4225) | Sandbox dynamic adapter UI parsers | Vérifier si MnM utilise `dynamic-loader.ts` côté UI adapters (probablement pas). Si oui : porter le `sandboxed-parser-worker`. Sinon : skip et noter dans upstream-watch. | `fix(security): sandbox dynamic adapter UI parsers` (ou skip note) |
| 3.2.7 | [#4557](https://github.com/paperclipai/paperclip/pull/4557) + [#4234](https://github.com/paperclipai/paperclip/pull/4234) | Bug data loss (comments) | Lire le diff. Si MnM a le même pattern optimistic-update : porter le fix. | `fix(comments): port disappearing-comment fix from #4557` (ou skip) |

### 3.3 Acceptance criteria Phase 1
- [ ] `docs/superpowers/upstream-watch.md` créé avec ligne par PR (statut : ported/skipped/not-applicable + raison)
- [ ] `bun run typecheck` passe (13/13 packages)
- [ ] `bun run test:e2e` passe (au moins le subset auth/multi-tenant)
- [ ] Aucun lockfile drift non documenté
- [ ] Tous les commits suivent conventionnels (`fix(security): ...`, `chore(deps): ...`)

### 3.4 Risques Phase 1
- **R1** : routes MnM non couvertes par `assertCompanyMembership` → CVE potentielle propre à MnM. Mitigation : audit 2.1 obligatoire avant le cherry-pick #3315.
- **R2** : bump multer/rollup peut casser des consumers (uploads, build). Mitigation : smoke test upload + build complet.
- **R3** : redaction logger trop agressive masque debug légitime. Mitigation : redactor regex précis (`Bearer [A-Za-z0-9._-]+`), test unitaire.

---

## 4. Phase 2 — Inbox Interactive (Structured Issue-Thread Interactions) — ~2 sprints

### 4.1 Pourquoi
PRs upstream [#4244](https://github.com/paperclipai/paperclip/pull/4244) + [#4381](https://github.com/paperclipai/paperclip/pull/4381). Aligne 100 % avec **Inbox Interactive** dans `project_blocks_platform.md`. Permet aux agents de poster dans le thread des **propositions structurées** (suggested tasks, multi-question forms, request-for-confirmation cards) avec idempotency keys + resumable continuations.

### 4.2 Périmètre
**Pas de cherry-pick code.** Lecture des PRs → design adapté MnM (tables companies-scoped, RLS, RBAC dynamique, integration governed-workflows).

### 4.3 Tâches
| # | Tâche | Output |
|---|---|---|
| 4.3.1 | Lire le détail des PRs #4244 + #4381 + DB migrations Paperclip 0063, 0064 | Note de design dans `docs/superpowers/specs/2026-04-28-inbox-interactive-design.md` |
| 4.3.2 | Designer le schema MnM (`thread_interactions` table : `company_id`, `issue_id`, `agent_id`, `type` enum, `payload` JSONB, `idempotency_key` UNIQUE, `resume_token` JSONB, `status`, `accepted_at`, etc.) | Migration Drizzle `0070_thread_interactions.sql` |
| 4.3.3 | RLS PostgreSQL fail-closed sur company_id | Migration + test E2E multi-tenant |
| 4.3.4 | Backend service `server/src/services/thread-interactions.ts` (create / accept / reject / answer / list) | Service + tests unitaires |
| 4.3.5 | MCP tools `propose_task`, `ask_questions`, `request_confirmation` (3 nouveaux outils MCP) | Update `server/src/mcp/tools.ts` + tests MCP |
| 4.3.6 | UI cards (Suggested Task, Multi-Question Form, Confirmation Card) avec accept/reject/answer flows | Composants `ui/src/components/thread/InteractionCard*.tsx` |
| 4.3.7 | Live-events emitter `thread_interaction.created/answered/accepted/rejected` | `server/src/realtime/emitters/thread-interactions.ts` + hook `useThreadInteractions` |
| 4.3.8 | E2E test : agent propose → user accept → resumable continuation déclenche le step suivant | `e2e/tests/thread-interactions.spec.ts` |

### 4.4 AC Phase 2
- [ ] Démo : agent propose 3 tâches dans un thread, user accepte 2 + reject 1, agent reprend le run avec les 2 acceptées
- [ ] Idempotency key empêche le double-propose
- [ ] Resumable continuation fonctionne après crash agent
- [ ] Tests E2E verts

### 4.5 Risques Phase 2
- **R1** : couplage fort avec Issue threads existants (qui n'existent peut-être pas formellement chez MnM). Pre-check : grep `issue_comments` ou équivalent, sinon designer le storage from scratch.
- **R2** : interaction avec governed-workflows (un step gate-bloquant peut être un thread interaction). Décision design : oui ou pas ? À trancher avant 4.3.4.

---

## 5. Phase 3 — Environments + sandbox pluggable — ~3-4 sprints

### 5.1 Pourquoi
PRs [#4297](https://github.com/paperclipai/paperclip/pull/4297) + [#4358](https://github.com/paperclipai/paperclip/pull/4358) + [#4415](https://github.com/paperclipai/paperclip/pull/4415) + [#4449](https://github.com/paperclipai/paperclip/pull/4449). Aligne directement avec l'epic **Per-User Pods + Artifact Deployment** (`project_pods_deployments.md`). MnM a aujourd'hui une architecture sandbox locale-only ; il faut la faire évoluer vers une abstraction pluggable (Local / SSH / sandboxed plugins).

### 5.2 Périmètre
**Portage architectural lourd**. La PR upstream introduit ~12k lignes — on ne va PAS porter tout, on prend l'archi clé :
- `Environment` table (lifecycle: created → leased → released → expired)
- `EnvironmentLease` table (qui détient l'env, pour combien de temps)
- `ExecutionTarget` interface (Local, SSH, Sandbox via plugin)
- Plugin contract pour providers tiers (e2b, futurs lambda, k8s)

### 5.3 Tâches
| # | Tâche | Output |
|---|---|---|
| 5.3.1 | Spec design `2026-04-28-environments-design.md` adapté multi-tenant MnM | Spec |
| 5.3.2 | Migration `0071_environments.sql` + `0072_environment_leases.sql` (avec `company_id`, RLS) | 2 migrations |
| 5.3.3 | `packages/execution-target/` nouveau package — interface + Local impl | Package + tests |
| 5.3.4 | SSH provider | `packages/execution-target/src/ssh.ts` + tests |
| 5.3.5 | Plugin contract + sandbox provider abstraction | `packages/execution-target/src/plugin-contract.ts` |
| 5.3.6 | Refactor de l'usage actuel des sandboxes locaux vers `ExecutionTarget` | Audit grep `sandbox` côté server, refactor sites consumers |
| 5.3.7 | (optionnel) reference plugin homebrew (PAS e2b — vendor lock) | À décider avec Tom |
| 5.3.8 | UI : page `/environments` (list / create / inspect leases) | Pages + tests |
| 5.3.9 | E2E test : créer env, lease, exécuter step governed-workflow dedans, release | `e2e/tests/environments.spec.ts` |

### 5.4 AC Phase 3
- [ ] Un governed-workflow step peut s'exécuter dans un Environment SSH (proof-of-concept Tom local)
- [ ] Lease lifecycle visible dans l'UI
- [ ] Multi-tenant isolation prouvée (company A ne voit pas envs company B)
- [ ] Plugin contract documenté pour 3rd-party providers

### 5.5 Risques Phase 3
- **R1** : refactor sandbox actuel = effets de bord sur traces, heartbeat, governed-workflows. Mitigation : feature flag `USE_EXECUTION_TARGET=true` pour rollout incrémental.
- **R2** : SSH provider = surface d'attaque (creds, command injection). Mitigation : passer par `assertCompanyMembership` + validation stricte des params SSH + logs auditables.
- **R3** : scope creep sur les plugins. Mitigation : ship Local + SSH d'abord, plugin contract design seul (pas d'impl externe), feedback Tom avant Phase 3.7.

---

## 6. Phase 4 — Run liveness + watchdog + auto-recovery — ~2 sprints

### 6.1 Pourquoi
PRs [#4083](https://github.com/paperclipai/paperclip/pull/4083) + [#4419](https://github.com/paperclipai/paperclip/pull/4419) + [#4587](https://github.com/paperclipai/paperclip/pull/4587). MnM a aujourd'hui le Trace pipeline + CAO watchdog mais pas de **resumable continuations** automatiques. Si un run agent crash mid-flight, on perd le contexte. Les patterns Paperclip donnent un cadre pour stabiliser ça.

### 6.2 Tâches
| # | Tâche | Output |
|---|---|---|
| 6.2.1 | Ajouter colonne `resumable_token JSONB` sur `governed_workflow_runs` (et `heartbeat_runs` si pertinent) | Migration `0073_resumable_tokens.sql` |
| 6.2.2 | Service `governed-workflows-liveness.ts` : détecter steps stalled (timeout configurable per workflow), émettre wake event | Service + tests |
| 6.2.3 | Auto-recovery configurable : `recovery_policy = { retries: 3, backoff_ms: 1000, max_age_minutes: 30 }` | Schema + UI Instance Settings |
| 6.2.4 | UI widget `LiveRunWidget` (active runs + auto-recovery indicator) | Composant + intégration dashboard |
| 6.2.5 | CAO watchdog amélioré : sur stall → auto-comment avec next-action hint + propose resume | Update `cao-watchdog.ts` |
| 6.2.6 | E2E : kill agent mid-step, vérifier auto-recovery déclenché | `e2e/tests/liveness-recovery.spec.ts` |

### 6.3 AC Phase 4
- [ ] Run agent crashed = détecté < 60s
- [ ] Auto-recovery déclenche resume avec contexte préservé (resumable_token replay)
- [ ] CAO commente le stall + propose action
- [ ] Operator peut désactiver auto-recovery (advisory mode)

### 6.4 Risques Phase 4
- **R1** : false positives détection stall (run vraiment long pas mort). Mitigation : timeout configurable per workflow + heuristique `last_useful_action_at` plutôt que `last_heartbeat_at`.
- **R2** : recovery loop infinite si la cause du crash est déterministe. Mitigation : `retries: 3` + backoff + circuit breaker.

---

## 7. Phase 5 — Patterns volés (intégrés au fil des phases)

Ces patterns ne sont pas des chantiers à part : on les implémente **au sein** des phases 2/3/4. Listés ici comme tracker pour ne rien oublier.

| # | Pattern | Source PR | Phase d'implémentation |
|---|---|---|---|
| 5.1 | **Idempotency keys** sur thread interactions (UNIQUE `(company_id, issue_id, idempotency_key)`) | #4244 | Phase 2 (4.3.2) |
| 5.2 | **Resumable continuation tokens** sur governed runs | #4083 | Phase 4 (6.2.1) |
| 5.3 | **ExecutionTarget abstraction** | #4358 | Phase 3 (5.3.3) |
| 5.4 | **Plugin host RPC** — `POST /mcp/plugin/:id/host-rpc` au lieu d'accès DB direct par les plugins | #4114 | Phase 3 (5.3.5) ou phase MCP dédiée si besoin séparé |
| 5.5 | **Typed activity events** — extension de `audit_events` MnM avec event-type enum + JSON payload + WebSocket broadcast | #3222 | Phase 2 (4.3.7) — pattern réutilisable |

---

## 8. Phase 6 — Process upstream-watch (1 jour, après Phase 1)

### 8.1 Output
Fichier `docs/superpowers/upstream-watch.md` avec :
- Liste des PRs upstream étudiées + verdict (ported / skipped / re-implemented / pattern-stolen)
- Pattern d'audit mensuel (cron mental ou Claude scheduled task) : check les nouvelles releases Paperclip, ajouter au tableau
- Critères de décision documentés (alignement roadmap, conflit attendu, effort)

### 8.2 Automation candidate
Une fois le doc en place, on peut `/schedule` un agent mensuel qui :
1. Pull `upstream` refs
2. Liste les nouvelles releases depuis le dernier check
3. Propose un PR draft sur `feat/upstream-watch-YYYY-MM` avec le triage initial
4. Tom valide / ajuste / merge

---

## 9. Sequencing & milestones

| Milestone | Quand | Contenu |
|---|---|---|
| **M1 — Phase 0 + 1 done** | J+2 | Audit fait, sécu portée, deps bumpées, doc upstream-watch initiée |
| **M2 — Phase 2 prod** | J+3 sem | Inbox Interactive démontrable end-to-end |
| **M3 — Phase 4 prod** | J+5 sem | Liveness + auto-recovery shipped |
| **M4 — Phase 3 prod** | J+9 sem | Environments + ExecutionTarget shipped, plugin contract documenté |
| **M5 — Phase 6 done** | J+9 sem (parallèle M4) | upstream-watch.md complet, process automatisé |

**Ordre intentionnel** : M2 avant M4 (Inbox Interactive = quick win UX/démo), M3 avant M4 (liveness durcit la base avant qu'on multiplie les surface d'execution avec Phase 3).

---

## 10. Hors scope (formellement)

- ❌ Multi-user auth (#3784) — déjà BetterAuth, design diverge
- ❌ Execution policies issue-level (#3222) — governed-workflows step-level est plus fine
- ❌ Issue subtree pause/cancel/restore (#4332) — cancel/reactivate step-level (commits 27-28 avril) couvre
- ❌ Company skills DB-backed (#1346) — file-based + cc-plugin-import, pas de pivot
- ❌ Promptfoo eval framework (#832) — pas de campagne d'évals active
- ❌ Routines engine (#1351, #1622) — ré-implé from scratch sera plus rapide qu'unwind le code couplé Paperclip

Si Tom change d'avis sur un de ces points, créer un nouveau plan dédié.

---

## 11. Rollback strategy

- **Phase 1** : chaque cherry-pick = 1 commit atomique → `git revert <sha>` si régression. Aucune migration DB → pas de rollback DB nécessaire.
- **Phase 2** : feature flag `INBOX_INTERACTIVE_ENABLED=false` côté server → désactive la table writes. UI fallback sur thread classique.
- **Phase 3** : feature flag `USE_EXECUTION_TARGET=false` → fallback sur sandboxes locaux d'aujourd'hui. Migration ENV table = additive (no drop).
- **Phase 4** : `recovery_policy.enabled=false` côté Instance Settings = mode advisory only.

Toutes les migrations DB doivent être **additives** (no drop, no breaking col rename) sur ce cycle pour permettre rollback applicatif sans rollback DB.

---

## 12. Owner & cadence

- Tom : valide les specs design avant chaque phase, smoke test E2E
- Claude (sessions) : exécute le code des phases, écrit specs, ouvre PRs atomiques
- Cadence : 1 PR par sous-tâche (pas de gros PR) ; review continue sur la branche `feat/paperclip-upstream-merge` jusqu'à M5

---

## Annexe — index des PRs upstream référencées

| PR | Sujet | Phase | Verdict |
|---|---|---|---|
| #2659 | Bearer redaction logs | 1 | port |
| #2819 / #2909 | multer / rollup CVEs | 1 | bump |
| #2866 / #3124 | JWT secret hardening | 1 | port (verify) |
| #3079 | Issue chat thread (assistant-ui) | — | défer (UX polish) |
| #3163 | Typing lag | — | défer (verify if MnM concerned) |
| #3222 | Execution policies multi-stage | — | skip (already step-level) |
| #3315 | GHSA CVE | 1 | port (audit first) |
| #3784 | Multi-user auth + invites | — | skip (BetterAuth) |
| #4083 | Run liveness continuations | 4 | port pattern |
| #4114 | Plugin orchestration host APIs | 3/5 | port pattern |
| #4122 | API authz hardening | 1 | port |
| #4129 | Terminal adapter process groups | — | verify if applicable, then maybe port |
| #4209 | Issue graph deadlock detection | — | defer |
| #4214 | Issue references PAP-123 | — | defer (nice-to-have) |
| #4225 | Sandbox dynamic adapter UI | 1 | verify, then port if applicable |
| #4234 / #4557 | Disappearing comments | 1 | port if MnM concerned |
| #4244 / #4381 | Structured thread interactions | 2 | port arch (Inbox Interactive) |
| #4258 | Stale execution run locks | — | verify, port if MnM concerned |
| #4296 / #4324 | External adapter hot-install | — | verify if applicable |
| #4297 / #4358 / #4415 / #4449 / #4452 | Environments + sandboxes | 3 | port arch (4452 plugin-e2b skip) |
| #4332 | Issue subtree pause/cancel/restore | — | skip (step-level done) |
| #4419 | Runtime lifecycle recovery | 4 | port pattern |
| #4445 / #4534 | Cancel stale queued work | — | verify, port if MnM concerned |
| #4523 / #4588 | Sub-issues as checklist | — | defer (low priority) |
| #4532 / #4586 / #4589 | Security agent role | — | defer (RBAC dynamic = more flexible) |
| #4553 / #4554 | publicBaseUrl port handling | — | verify if MnM concerned |
| #4587 | Configurable liveness auto-recovery | 4 | port pattern |
| #1346 | Company skills library | — | skip (file-based) |
| #1351 / #1622 | Routines engine | — | re-implement from scratch later |
| #2435 | Standalone @paperclipai/mcp-server | — | defer (MnM has embedded MCP) |
| #2999 | pg_trgm full-text search | — | defer (perf optim) |
| #832 | Promptfoo evals | — | skip |
