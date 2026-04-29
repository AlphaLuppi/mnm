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
| Dernier audit complet | **2026-04-29** (releases v2026.318.0 → **v2026.428.0**) |
| Prochain audit | **2026-05-28** (mensuel) |

---

## Audit 2026-04-29 — release v2026.428.0 (incremental)

Released 2026-04-28T22:56Z. 4 DB migrations upstream (0071-0074), one author (@cryppadotta).

### Triage

| PR | Sujet | Verdict |
|---|---|---|
| [#4700](https://github.com/paperclipai/paperclip/pull/4700) | Per-company `attachmentMaxBytes` cap | 🟡 **PORTING** — MnM has env-only `MNM_ATTACHMENT_MAX_BYTES`. Add `companies.attachment_max_bytes` column + min(env, company) at upload. |
| [#4615](https://github.com/paperclipai/paperclip/pull/4615) | Manual routine runs stay in runner inbox (touch issueReadStates on coalesce/skip) | 🟡 **PORTING** — MnM has routines. Bug present: coalesced/skipped manual runs don't surface in operator inbox. Effort S. |
| [#4700](https://github.com/paperclipai/paperclip/pull/4700) | "Peer agents can't mutate issues they don't own" | ✅ **ALREADY DONE** in our Z7 port (commit `17607640e`). Verify nuances. |
| [#4600](https://github.com/paperclipai/paperclip/pull/4600) | Newly-created companies default `requireBoardApprovalForNewAgents=false` | ⏸️ **PRODUCT DECISION** — MnM default is currently `true` (more conservative). Tom to validate flip. |
| [#4600](https://github.com/paperclipai/paperclip/pull/4600) | Stranded recovery: redact retry-failure details, dispatch single recovery origin, honor maxConcurrentRuns | ⏭️ **N/A** — MnM has no `stranded_issue_recovery` issue-type / Paperclip-specific watchdog. |
| [#4614](https://github.com/paperclipai/paperclip/pull/4614) | Dispatch assigned `todo` issues during recovery sweeps | ⏭️ **N/A** — Same reason. |
| [#4616](https://github.com/paperclipai/paperclip/pull/4616) | Sidebar pause/resume agents | ⏭️ **DEFER** — UI sidebar Paperclip-specific layout, not aligned with MnM dashboard widgets. |
| [#4701](https://github.com/paperclipai/paperclip/pull/4701) | Issue thread virtualization, scroll anchoring, latest-comment jump | ⏭️ **DEFER** — Upstream uses assistant-ui, MnM uses TanStack table. Different libs, different solutions. |
| [#4701](https://github.com/paperclipai/paperclip/pull/4701) | Issues list cursor pagination | ⏭️ **DEFER** — Worth a dedicated session if list perf becomes a problem. |
| [#4701](https://github.com/paperclipai/paperclip/pull/4701) | Routine variable inline help + mention support | ⏭️ **DEFER** — UX polish. |
| [#4700](https://github.com/paperclipai/paperclip/pull/4700) + [#4701](https://github.com/paperclipai/paperclip/pull/4701) | Productivity review service (auto-open review issues for stalled work) | ⏭️ **DEFER** — Heavy feature, dedicated sprint required. Aligned with MnM Trace Pipeline + CAO watchdog vision but design pivot needed. |
| [#4617](https://github.com/paperclipai/paperclip/pull/4617) | Inline selector keyboard handling | ⏭️ **DEFER** — UI-specific. |
| [#4601](https://github.com/paperclipai/paperclip/pull/4601) | Reject stale company skill refreshes | ⏭️ **DEFER** — MnM company-skills are partial (cc-plugin-import does most), low priority. |
| [#4602](https://github.com/paperclipai/paperclip/pull/4602) | Ignore stale stored company selections | ⏭️ **MAYBE** — MnM has CompanyProvider, check if same race exists. Defer pending audit. |

---

## Audit 2026-04-28 — releases v2026.318.0 → v2026.427.0

### PRs sécurité / fixes critiques (Phase 1)

| PR | Sujet | Statut | Notes |
|---|---|---|---|
| [#3315](https://github.com/paperclipai/paperclip/pull/3315) | GHSA-68qg-g8mg-6pr7 — scope import/approval/activity routes | ✅ **DONE** 2026-04-28 | Heartbeat/approvals routes already protected via `/companies/:companyId/` prefix. Only the import flow (no companyId in path for `new_company` mode) was vulnerable: ported via `assertInstanceAdmin` helper + regression test (commit `81c3599d`). |
| [#4122](https://github.com/paperclipai/paperclip/pull/4122) | API authz hardening (40+ routes, 8 zones) | ✅ **DONE** 2026-04-29 | All 8 zones triaged: Z1+Z4+Z5+Z6+Z7 ported (3 CRITICAL: #3315/Z4, Z6 SSRF, Z7 checkout); Z2+Z3+Z8 N/A in MnM. See zones below. |
| [#2819](https://github.com/paperclipai/paperclip/pull/2819) | multer 2.1.1 (HIGH CVE) | ✅ **DONE** 2026-04-28 | `multer` résolu à 2.1.1 dans bun.lock, manifest bumpé `^2.1.1` |
| [#2909](https://github.com/paperclipai/paperclip/pull/2909) | rollup 4.59.0 (path-traversal CVE) | ✅ **DONE** | rollup déjà à 4.59.0 (transitive via vite 6.4.1) |
| [#2866](https://github.com/paperclipai/paperclip/pull/2866) | JWT secret BETTER_AUTH_SECRET fallback | ✅ **DONE** 2026-04-29 | `agent-auth-jwt.ts` now reads `MNM_AGENT_JWT_SECRET || BETTER_AUTH_SECRET` (commit `b07b9b0c`). Operators set one secret in production. |
| [#3124](https://github.com/paperclipai/paperclip/pull/3124) | Removed hardcoded JWT secret | ✅ **DONE** 2026-04-29 | Covered by same commit `b07b9b0c`. MnM had no hardcoded fallback for `authenticated` mode (validated by error path); `local_trusted` retains intentional `mnm-dev-secret` fallback for dev UX. |
| [#2659](https://github.com/paperclipai/paperclip/pull/2659) | Bearer redaction logs | ✅ **DONE** 2026-04-29 | `server/src/middleware/logger.ts` now redacts Authorization, cookie, x-mnm-api-key, x-api-key, and reqBody password/token/apiKey/secret (commit `11ad9fe6`). Extends upstream's single-path redaction with MnM-specific headers and validation-failure body capture. |
| [#4225](https://github.com/paperclipai/paperclip/pull/4225) | Sandbox dynamic adapter UI parsers | ⏭️ **SKIP** — N/A | MnM has no dynamic adapter UI loading mechanism. `ui/src/adapters/registry.ts` is a 16-line static map of compiled-in adapters (claude/codex/cursor/opencode/pi/process). No `dynamic-loader.ts`, no `loadDynamicParser()`, no `/api/adapters/:type/ui-parser.js` endpoint. The vulnerability class doesn't exist in MnM. |
| [#4557](https://github.com/paperclipai/paperclip/pull/4557) | Disappearing issue comments | ⏭️ **SKIP** — N/A | MnM has no comment pagination (single fetch, no cursor anchor) and no optimistic UI queueing for comments. The buggy descending-cursor SQL predicate and stale comment-target reconciliation don't exist in MnM's simpler React Query model. Re-evaluate if pagination/optimistic UX is added in a future phase. |
| [#4234](https://github.com/paperclipai/paperclip/pull/4234) | Stale queued comment targets | ⏭️ **SKIP** — N/A | Lié à #4557 — MnM n'a pas de `LocallyQueuedIssueComment` wrapper ni de `applyLocalQueuedIssueCommentState()`. |

### PR #4122 zone-by-zone (Phase 1.2)

| Zone | Sujet upstream | Statut MnM | Commit |
|---|---|---|---|
| **Z1** | Budget mutation cross-company (`/companies/:companyId/agents/:agentId/budgets`) | ✅ **DONE** 2026-04-29 — explicit `agent.companyId === path.companyId` check + 2 regression tests | `eec9dead` |
| **Z2** | Plugin admin/scoped routes require instance-admin | ⏭️ **N/A** — MnM has no plugin install/disable/upgrade/delete routes (config-layers + cc-plugin-import replaced upstream concept) | — |
| **Z3** | Adapter management routes require instance-admin | ⏭️ **N/A** — MnM has no adapter install/reload/delete routes (adapters are workspace packages, not runtime-installable) | — |
| **Z4** | Company import/export instance-admin gate | ✅ **DONE** in Phase 1.1 (commit `81c3599d`, GHSA fix) | `81c3599d` |
| **Z5** | Direct agent creation must respect `requireBoardApprovalForNewAgents` | ✅ **DONE** 2026-04-29 — POST `/companies/:companyId/agents` returns 409 when flag is set, redirects to `/agent-hires`. Test deferred to follow-up (mocking surface > code change scope). | `eec9dead` |
| **Z6** | Invite test resolution DNS/NAT64 SSRF validation | ✅ **DONE** 2026-04-29 — added `isPrivateOrReservedIpv4/v6`, `isPublicIpAddress`, `resolveInviteResolutionTarget` helpers; switched `probeInviteResolutionTarget` to raw http(s).request with anti-rebinding (resolved IP + Host header + tlsServername). 58 helper-coverage tests. Commit `1126554e`. |
| **Z7** | Issue mutation requires active-checkout ownership for agents | ✅ **DONE** 2026-04-29 — fixed inverted logic in `assertAgentRunCheckoutOwnership`: peer agents now get 409 `ACTIVE_CHECKOUT_OWNED_BY_PEER` unless they hold `tasks:manage_active_checkouts` permission slug or are in the assignee's reporting chain. Helper called from PATCH/DELETE/release/comments/attachments. 6 regression tests. Commit `f37ca8dd`. **Breaking**: operators must grant the new permission slug to manager-equivalent roles, or rely on auto-override via reporting chain. |
| **Z8** | Adapter validation route company scope | ⏭️ **N/A** — MnM has no `/agents/:id/adapter-validation` route |

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
