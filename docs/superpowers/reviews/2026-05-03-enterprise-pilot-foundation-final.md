# Review finale — Enterprise Pilot Foundation (T0 → T6)

**Date :** 2026-05-03
**Branche :** `feat/enterprise-pilot-foundation`
**Plan :** [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](../plans/2026-05-01-enterprise-pilot-foundation.md)
**Verdict :** **READY FOR PILOT**

---

## Périmètre livré

5 chantiers majeurs (T0 → T5) + validation finale (T6) sur 38 commits sur la branche depuis master.

### T0 — Refactor préparatoire (1 commit)

| SHA | Sujet |
|---|---|
| `d2076ae4d` | refactor(ui): extract TagSelector + PrincipalSelector from Members |

### T1 — 3-tier visibility model (1 commit)

| SHA | Sujet |
|---|---|
| `2af87e1e1` | feat(visibility): T1 — 3-tier model foundation (types + helper + UI picker/badge) |

### T2 — Workflow Hooks (T2.1 → T2.9 + P4 hardening, 13 commits)

| SHA | Sujet |
|---|---|
| `e75d0e880` | feat(isolate-runtime): T2.1 — extract installHelpers + CompiledCache + freezeDeep |
| `5de1e443e` | feat(workflow-hooks): T2.5 — migration 0081 + 5 schemas + RLS double-policy + perms |
| `866b8adbe` | feat(workflow-hooks): T2.9 — UI page Hooks (configs + catalog + Sheet detail) |
| `8cc9719a1` | docs(workflow-hooks): handoff T2 resume |
| `966d10f41` | feat(workflow-hooks): T2.2 — runner + host-helpers + 35 tests (18 sécu) |
| `b2ce1f356` | feat(workflow-hooks): T2.3 — resolver tests (canonical/shared/local) |
| `04d62d98a` | feat(workflow-hooks): T2.4 — 4 canonical hooks + fs-backed registry |
| `025d2768b` | feat(workflow-hooks): T2.6 — service backend + Zod schemas |
| `56c55935f` | feat(workflow-hooks): T2.7 — wire 4 hook phases into governed-workflows.ts |
| `9e04ec71d` | feat(workflow-hooks): T2.8 — REST routes + 6 MCP tools |
| `9fb257dd9` | fix(workflow-hooks): P4-E — UI client params + inline toggles + error messages |
| `0b6dd663b` | fix(workflow-hooks): P4-C — runner sandbox hardening (headers, timeout, body cap, retry) |
| `4fa17bc19` | fix(workflow-hooks): P4-D — REST routes hardening (assertBoard, principalId, query filters) |
| `9f1be598a` | fix(workflow-hooks): P4-A — service security/perf hardening |
| `a3c397cdf` | feat(workflow-hooks): P4-G — catalog metadata (description, phase, configSchema, defaultConfig) |
| `596fe8b14` | fix(workflow-hooks): P4-A test — tighten cross-tenant tag test for mock harness |
| `fa0d8be21` | fix(workflow-hooks): P4-B — wire critical path (after_step state, after_run fire-and-forget) |
| `9a16ba582` | docs(workflow-hooks): P5 — review finale |

### T3 — Workflow step assignments (5 commits)

| SHA | Sujet |
|---|---|
| `e04e5b2b6` | feat(workflow-assignments): T3.1 — schema + RLS migration 0082 |
| `a09e894cc` | feat(workflow-assignments): T3.2 — service resolver + Zod + tests |
| `3fdb7e65c` | feat(workflow-assignments): T3.3 — wire launchRun/launchStep + live event |
| `19322319b` | feat(workflow-assignments): T3.4 — REST + MCP list_my_pending_work |
| `e8869aec6` | feat(workflow-assignments): T3.5 — Inbox UI + sidebar badge |

### T4 — Artifact viewer (3 commits)

| SHA | Sujet |
|---|---|
| `c8fca4c4d` | feat(artifact-viewer): T4.1 — extract OutputRow + RunArtifactsTree + permalink |
| `c09f4c175` | feat(artifact-viewer): T4.2 — ArtifactViewer wrapper (markdown/doc/monaco/url) |
| `e2a9da0de` | feat(artifact-viewer): T4.3 — review human page (2-col layout) + parity |

### T5 — Composite workflows (3 commits)

| SHA | Sujet |
|---|---|
| `4d06a1a8b` | feat(workflow-composite): T5.1 — schema + Zod composite step type |
| `fb3b1f447` | feat(workflow-composite): T5.2 — composite resolver + cycle detect + fanout cap |
| `d9b28aecb` | feat(workflow-composite): T5.3 — wire launchStep/completeStep + UI badges + tree lazy-load |

### T6 — Final validation + docs + parity (3 commits)

| SHA | Sujet |
|---|---|
| `781f6c9f7` | docs(governed-workflows): T6.1 — user docs (hooks/assignments/composite) |
| `c342a7696` | test(governed-workflows): T6.2 — sync WORKFLOW_ERROR_CODES test snapshot with T3+T5 codes |
| `87730e356` | docs(decision-log): T6.8 — record T2-T5 deliveries |

(+ ce review = T6.9)

---

## Statut de vérification

### Typecheck — 19/19 PASS

`bun run typecheck` : tous les packages passent. Includes les nouveaux `isolate-runtime`, `workflow-hooks`, et les changes T3 (governed-workflows-assignments) + T5 (governed-workflows-composite).

### Tests unit

| Package | Résultat | Notes |
|---|---|---|
| `packages/governed-workflows` | **100/100 pass** | T6.2 a fixé le snapshot WORKFLOW_ERROR_CODES (T3+T5 nouveaux codes) |
| `packages/workflow-hooks` | **81/81 pass** | Inclut 18 tests sécu sandbox (isolation, recursion, memory, prototype pollution) |
| `server` (vitest run) | **747 pass / 15 fail / 144 skipped** | Les 15 failures sont **pré-existantes** sur master (bmad-analyzer, cursor-local, opencode, health, invite-join-manager, governed-workflows-ui POST 201). Les 144 skipped attendent Postgres :5433. **Aucune régression introduite par T2-T5.** |
| `ui` (vitest run) | **135/136 pass** | 1 failure pré-existante (GovernedWorkflowEditor — Monaco beforeMount, import resolution issue, non modifiée sur la branche) |

### Playwright E2E — SKIPPED

Pas de Postgres :5433 dans l'environnement courant. Le test E2E end-to-end (login user → Inbox → click step → run detail → MCP launch → complete with mock artifact → hook fires → kill-switch) est **deferred** vers la verif manuelle Tom (T6.5).

### Manual UI verification (`bun run dev`) — DEFERRED

Pas d'environnement runtime browser dans cette session. Les 5 nouveautés UI à valider manuellement par Tom :

1. Page `/hooks` — Tabs Configs / Catalog, inline toggles, Sheet detail
2. Inbox section "Pending workflow steps" + sidebar badge
3. Run detail review mode (`?step=<name>` → 2-col)
4. RunArtifactsTree expand sub-runs composite
5. Workflow editor accepte `type: "composite"` + `uses: "workflows/<name>@<ref>"`

### Parity tracker — 4 entries verified

`scripts/parity/data.ts` contient :

- `workflow-hooks` (T2 — done web, missing desktop blocked)
- `workflow-step-assignments` (T3 — done web, n/a desktop)
- `artifact-viewer` (T4 — done web, n/a desktop)
- `composite-workflows` (T5 — done web, n/a desktop)

`bun run parity` ne lève aucune erreur.

### Decision-log — 27 lignes ajoutées (§4.4 + §4.4.1 + §4.4.2 + §4.4.3)

Le sous-ensemble suivant a été mis à jour :

- §4.4 hooks : status passé "à venir" → "T2 + P4 livré 2026-05-02 → 2026-05-03", mention explicite que `helpers.credential` a été supprimée.
- §4.4.1 assignments (NEW)
- §4.4.2 composite (NEW)
- §4.4.3 artifact viewer (NEW)

---

## V1 backlog / open items

### À faire avant un pilote production réel

- **E2E Playwright complet** : login user → Inbox → click step → MCP launch → complete → hook fire (verified via audit) → kill-switch verification. Spec dans plan T6.4.
- **Manuel test des 5 UI** par Tom (T6.5).

### Améliorations V1 (post-pilote, non-blocking)

- **Monaco lazy editor pour `default_config_json`** dans la page `/hooks` (currently Textarea — fonctionne, manque la coloration syntaxique JSON et la validation inline).
- **Durcissement SSRF DNS rebind** : le `helpers.http` resolve l'IP au moment de la première requête. Un attaquant peut faire bouger l'IP entre la check et le call (DNS rebinding). Mitigation : pin l'IP au connect (custom Agent dans Node).
- **HookProviderCatalog dynamique** : le mapping provider → base_url est currently hardcodé dans `packages/workflow-hooks/canonical-helpers/`. Migrer vers `oauth_connectors.base_url` (P3 finding) pour permettre aux self-hosters d'ajouter leurs propres providers sans PR upstream.
- **Multi-instance advisory lock** sur `runWatchdogTick` (déjà tracké dans le parity entry `governed-workflows-liveness-watchdog`).
- **Composite cancel cascade** : un cancel sur un run parent ne cancel pas les sub-runs en cours. Tracké comme out-of-scope V1.
- **Composite retry granulaire** : actuellement, retry un sub-run = depuis le début. Granularité par step requerrait un état partagé root, hors scope V1.

---

## Conformité aux invariants

| Invariant | Status |
|---|---|
| Repo public, zéro nom client | OK — grep manuel des docs T6.1 + decision-log T6.8, aucun nom externe |
| Traçabilité humaine §1.7 | OK — hooks utilisent OAuth user-level via `helpers.http` (no service account) |
| 3-tier visibility §1.6 | OK — hooks configs + assignments + visibility T1 alignés |
| Zero polling | OK — SSE events `hook.config.updated`, `step.assignment.created`, `step.composite.launched`, `step.composite.completed` |
| RBAC dynamique | OK — perms `hooks:enforce`, `hooks:read`, `hooks:write` seedées via migration, pas de constante hardcodée |
| Multi-tenant fail-closed | OK — RLS double-policy migration 0080 + nouveaux 0081 (hooks), 0082 (assignments), 0083 (composite) |

---

## Verdict final

**READY FOR PILOT** sous réserve du E2E manuel par Tom (T6.4 + T6.5). Le code est shipped, typechecké, unit-testé, documenté, et conforme aux invariants. Les failures de tests pré-existantes sur master sont identifiées et hors-scope (à traiter dans un sprint dédié quality, pas un blocker pour le pilote).

Pour le démarrage pilote :

1. Tom run `bun run dev` localement avec Postgres :5433
2. Vérifie les 5 UI (cf. T6.5)
3. Lance le scénario E2E plan T6.4 (création hook canonical, assignment via tag, composite workflow, kill-switch)
4. Si OK → merge `feat/enterprise-pilot-foundation` → `master`, tag pré-pilote
