# Upstream watch — paperclipai/paperclip

> **But** : tracker ce qui sort côté upstream Paperclip et notre verdict (port / skip / re-implement / pattern stolen).
> **Cadence** : audit mensuel manuel (à automatiser via `/schedule` une fois Phase 1 done).
> **Plan associé** : `docs/superpowers/plans/2026-04-28-paperclip-upstream-merge.md`

---

## Statut MnM ↔ upstream

| | |
|---|---|
| Remote upstream | `https://github.com/paperclipai/paperclip.git` |
| Dernier merge upstream | commit `14258051` (`Merge branch 'tom-paperclip' into master`) le **2026-03-13** |
| Stratégie | **Fork stratégique permanent**. Pas de `git merge upstream/master`. Cherry-picks dirigés + portage architectural + vol de patterns. |
| Dernier audit complet | **2026-04-28** (releases v2026.318.0 → v2026.427.0) |
| Prochain audit | **2026-05-28** (mensuel) |

---

## Audit 2026-04-28 — releases v2026.318.0 → v2026.427.0

### PRs sécurité / fixes critiques (Phase 1)

| PR | Sujet | Statut | Notes |
|---|---|---|---|
| [#3315](https://github.com/paperclipai/paperclip/pull/3315) | GHSA-68qg-g8mg-6pr7 — scope import/approval/activity routes | **TODO** Phase 1 | Audit routes MnM puis port manuel (préfixe `/companies/:companyId/` divergent) |
| [#4122](https://github.com/paperclipai/paperclip/pull/4122) | API authz hardening (40+ routes) | **TODO** Phase 1 | Port manuel actor/company/active-checkout boundary |
| [#2819](https://github.com/paperclipai/paperclip/pull/2819) | multer 2.1.1 (HIGH CVE) | ✅ **DONE** 2026-04-28 | `multer` résolu à 2.1.1 dans bun.lock, manifest bumpé `^2.1.1` |
| [#2909](https://github.com/paperclipai/paperclip/pull/2909) | rollup 4.59.0 (path-traversal CVE) | ✅ **DONE** | rollup déjà à 4.59.0 (transitive via vite 6.4.1) |
| [#2866](https://github.com/paperclipai/paperclip/pull/2866) | JWT secret BETTER_AUTH_SECRET fallback | **TODO** Phase 1 | Audit MnM: `better-auth 1.4.18`, vérifier pas de fallback hardcoded |
| [#3124](https://github.com/paperclipai/paperclip/pull/3124) | Removed hardcoded JWT secret | **TODO** Phase 1 | Cf. #2866 |
| [#2659](https://github.com/paperclipai/paperclip/pull/2659) | Bearer redaction logs | **TODO** Phase 1 | Identifier logger MnM (`server/src/middleware/logger.ts`), ajouter redactor |
| [#4225](https://github.com/paperclipai/paperclip/pull/4225) | Sandbox dynamic adapter UI parsers | **TODO** Phase 1 | Vérifier d'abord si `dynamic-loader.ts` existe côté UI MnM, sinon skip |
| [#4557](https://github.com/paperclipai/paperclip/pull/4557) | Disappearing issue comments | **TODO** Phase 1 | Vérifier si MnM a même pattern optimistic-update |
| [#4234](https://github.com/paperclipai/paperclip/pull/4234) | Stale queued comment targets | **TODO** Phase 1 | Lié à #4557 |

### Features stratégiques (Phases 2-4)

| PR(s) | Sujet | Verdict | Phase |
|---|---|---|---|
| [#4244](https://github.com/paperclipai/paperclip/pull/4244) + [#4381](https://github.com/paperclipai/paperclip/pull/4381) | Structured issue-thread interactions (suggested tasks, multi-question forms, confirmation cards, idempotency keys, resumable continuations) | **PORT ARCH** | Phase 2 — Inbox Interactive |
| [#4297](https://github.com/paperclipai/paperclip/pull/4297) + [#4358](https://github.com/paperclipai/paperclip/pull/4358) + [#4415](https://github.com/paperclipai/paperclip/pull/4415) + [#4449](https://github.com/paperclipai/paperclip/pull/4449) | Environments + sandbox pluggable (Local/SSH/sandbox plugin contract) | **PORT ARCH** | Phase 3 — Environments |
| [#4452](https://github.com/paperclipai/paperclip/pull/4452) | E2B sandbox provider plugin | **SKIP** | Vendor lock — homebrew pod préféré |
| [#4083](https://github.com/paperclipai/paperclip/pull/4083) + [#4419](https://github.com/paperclipai/paperclip/pull/4419) + [#4587](https://github.com/paperclipai/paperclip/pull/4587) | Run liveness + watchdog + auto-recovery | **PORT PATTERNS** | Phase 4 |
| [#4114](https://github.com/paperclipai/paperclip/pull/4114) | Plugin orchestration host APIs (host-RPC factory) | **PATTERN STEAL** | Phase 3 (5.3.5) |

### À skipper formellement

| PR(s) | Sujet | Raison skip |
|---|---|---|
| [#3784](https://github.com/paperclipai/paperclip/pull/3784) | Multi-user auth + invites + onboarding/profile | MnM déjà BetterAuth + OAuth 2.1 + invites + SSO — design diverge |
| [#3222](https://github.com/paperclipai/paperclip/pull/3222) | Execution policies multi-stage signoff (issue-level) | MnM governed-workflows step-level **plus granulaire** |
| [#4332](https://github.com/paperclipai/paperclip/pull/4332) | Issue subtree pause/cancel/restore | MnM cancel/reactivate step-level (commits 27-28 avril) couvre |
| [#1346](https://github.com/paperclipai/paperclip/pull/1346) | Company skills library DB-backed | MnM file-based + `cc-plugin-import` — pas de pivot |
| [#1351](https://github.com/paperclipai/paperclip/pull/1351) + [#1622](https://github.com/paperclipai/paperclip/pull/1622) | Routines & recurring tasks engine | Code couplé heartbeat Paperclip — ré-implémenter natif sera plus rapide |
| [#832](https://github.com/paperclipai/paperclip/pull/832) | Promptfoo eval framework | Pas de campagne d'évals MnM active |

### À déférer (nice-to-have)

| PR(s) | Sujet | Raison défer |
|---|---|---|
| [#3079](https://github.com/paperclipai/paperclip/pull/3079) | Issue chat thread (assistant-ui lib polish) | UX nice-to-have, MnM chat existe déjà |
| [#3163](https://github.com/paperclipai/paperclip/pull/3163) | Typing lag fix dans long threads | Vérifier si MnM concerné avant action |
| [#4129](https://github.com/paperclipai/paperclip/pull/4129) | Terminal adapter process groups cleanup | Vérifier si applicable au stack adapters MnM |
| [#4209](https://github.com/paperclipai/paperclip/pull/4209) | Issue graph deadlock detection | Future-proofing, pas de DAG nesting profond MnM |
| [#4214](https://github.com/paperclipai/paperclip/pull/4214) | First-class issue references PAP-123 mentions | Nice-to-have UX |
| [#4258](https://github.com/paperclipai/paperclip/pull/4258) | Stale execution run locks | Vérifier si MnM concerné |
| [#4296](https://github.com/paperclipai/paperclip/pull/4296) + [#4324](https://github.com/paperclipai/paperclip/pull/4324) | External adapter hot-install | Vérifier si MnM utilise hot-install |
| [#4445](https://github.com/paperclipai/paperclip/pull/4445) + [#4534](https://github.com/paperclipai/paperclip/pull/4534) | Cancel stale queued/scheduled work | MnM a déjà cancel/reactivate, vérifier overlap |
| [#4523](https://github.com/paperclipai/paperclip/pull/4523) + [#4588](https://github.com/paperclipai/paperclip/pull/4588) | Sub-issues as workflow checklist | UI nice-to-have |
| [#4532](https://github.com/paperclipai/paperclip/pull/4532) + [#4586](https://github.com/paperclipai/paperclip/pull/4586) + [#4589](https://github.com/paperclipai/paperclip/pull/4589) | First-class security agent role | RBAC dynamique MnM est plus flexible |
| [#4553](https://github.com/paperclipai/paperclip/pull/4553) + [#4554](https://github.com/paperclipai/paperclip/pull/4554) | publicBaseUrl port handling | Vérifier si MnM concerné |
| [#2435](https://github.com/paperclipai/paperclip/pull/2435) | Standalone `@paperclipai/mcp-server` package | MnM a embedded MCP — extract en package optionnel |
| [#2999](https://github.com/paperclipai/paperclip/pull/2999) | pg_trgm full-text search | Perf optim, pas urgent |

---

## Audit dépendances 2026-04-28

| Package | MnM (manifest / lock) | Upstream advisory | Statut |
|---|---|---|---|
| `multer` | `^2.1.1` / `2.1.1` (this commit) | 2.1.1 (HIGH CVE) | ✅ aligned |
| `rollup` | transitive via `vite 6.4.1` / `4.59.0` | 4.59.0 (path-traversal) | ✅ |
| `drizzle-orm` | `^0.45.2` / `0.45.2` | 0.45.2 (SQL injection CVE) | ✅ déjà bumpé commit `e27260a8` (2026-04-25) |
| `better-auth` | `1.4.18` | n/a | ✅ récent |
| `express` | `^5.1.0` | n/a | ✅ récent (express 5) |

À surveiller au prochain audit : `@modelcontextprotocol/sdk`, `bullmq`, `dockerode`.

---

## Audit routes 2026-04-28 (overview)

**Total routes** : 433 lignes `router.X()` dans `server/src/routes/*.ts`

**Routes hors préfixe `/companies/:companyId/`** (échantillon) :
- `health.ts` — healthcheck (légitime)
- `access.ts` — `/board-claim/`, `/skills/index`, `/invites/:token` (publics, vérifient token), `/admin/users/.../company-access` (à auditer en Phase 1.1)
- `credentials.ts` — `/oauth/authorize`, `/oauth/callback` (OAuth flow)
- `sso-auth.ts` — SSO discover/login/ACS (auth flow)
- `onboarding.ts` — `/role-presets`
- `llms.ts` — config index
- `e2e-seed.ts` — tests only

**Action Phase 1.1** : pour chaque route hors préfixe, valider que l'auth est correctement vérifiée (token, identity, etc.). Audit non urgent côté health/onboarding/llms ; à creuser sur `access.ts` admin routes et `credentials.ts` OAuth callback.

---

## Process de l'audit mensuel

À chaque audit (cadence ~1 mois) :

1. `git fetch upstream --prune --tags`
2. `gh api repos/paperclipai/paperclip/releases --jq '.[] | "\(.tag_name) (\(.published_at[0:10]))"'` → liste des releases depuis le dernier audit
3. Pour chaque release :
   - Lire les highlights / fixes / security
   - Pour chaque PR mentionnée, ajouter une ligne au tableau approprié (sécu / strat / skip / défer)
   - Verdict : port / skip / re-implement / pattern-steal / defer
4. Update `docs/superpowers/upstream-watch.md`
5. Si fix sécurité **CRITICAL** : créer issue + PR dans la semaine
6. Sinon : batch dans le prochain plan

### Automation candidate (post-Phase 1)

`/schedule` un agent mensuel (1er du mois) qui :
1. Pull `upstream`
2. Liste les nouvelles releases
3. Crée PR draft `feat/upstream-watch-YYYY-MM` avec triage initial
4. Ping Tom pour validation

---

## Historique des audits

| Date | Auditeur | Couvre | Notes |
|---|---|---|---|
| 2026-04-28 | Claude (Tom session) | v2026.318.0 → v2026.427.0 | Audit initial post-création de ce doc. Phase 0 complète. |
