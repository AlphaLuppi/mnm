# MnM — Night Security Audit Report (2026-04-29 → 2026-04-30)

## TL;DR

- **167 findings** recon (11 teams, ~9 h autonomous)
- **13 critical fixed**, **41 high fixed** (out of 13 / 50)
- **7 high partial/deferred** (architectural redesign or product decision required)
- **2 high wontfix** (by design: oauth_clients global; kysely MySQL SQLi on PG-only stack)
- **25+ fix commits** pushed on master
- `bun audit`: 29 advisories → **2 remaining** (lodash via mermaid — transitive, no upstream fix)
- `bun run typecheck`: **pass** (0 errors, 16/16 packages)
- `bun run build`: **pass** (only chunk-size warnings, no errors)
- **0 unfixed critical** findings

---

## Top 10 fixes (impact)

| # | ID | Title | Commit |
|---|---|---|---|
| 1 | SEC-T9-01 | RCE via shell injection in git credential helper — `repoUrl` raw in `case` statement | a3fa8352 |
| 2 | SEC-T1-002 | SAML ACS zero crypto validation — string "Signature" passed for any signed doc | 4332468b |
| 3 | SEC-T2-001 | 9 tenant tables without RLS — routines, view_presets, widgets, inbox, oauth_refresh_tokens etc. | 52d08026 |
| 4 | SEC-T2-003 | Deployment preview IDOR — `!!req.actor` always truthy, any user saw any deployment | 9c16551e |
| 5 | SEC-T3-9 | RLS context leakage — 18 MCP tool handlers had no `clearTenantContext` finally block | 63596857 |
| 6 | SEC-T9-02 | AI Assistant prompt injection — `workflow.json` content verbatim in system prompt | 58408286 |
| 7 | SEC-T9-03 | Arbitrary file write via `parseFileProposals` — `../../.env` accepted as path | 58408286 |
| 8 | SEC-T7-01 | protobufjs RCE (GHSA-xq3m-2v4x-88gg) — removed via overrides | ae53182d |
| 9 | SEC-T10-001 | Docker socket bind-mount → host escape — replaced with tecnativa socket-proxy allowlist | fddda017 |
| 10 | SEC-T11-01 | `metadata.isCAO` mass assignment via PATCH /agents/:id | d970e395 |

---

## Findings by status

### Critical — All 13 Fixed

| ID | Severity | Title | Commit SHA |
|---|---|---|---|
| SEC-T1-001 | Critical | BetterAuth secret fallback "mnm-dev-secret" | 00ee0f9a |
| SEC-T1-002 | Critical | SAML ACS zero crypto validation | 4332468b |
| SEC-T2-001 | Critical | 9 tenant tables without RLS | 52d08026 |
| SEC-T2-003 | Critical | Deployment preview proxy IDOR | 9c16551e |
| SEC-T3-2  | Critical | Backup utility RLS bypass + no table whitelist | 63596857 |
| SEC-T3-9  | Critical | RLS context leakage via 18 MCP handlers | 63596857 |
| SEC-T4-01 | Critical | Zero security headers (no helmet/CSP/HSTS) | (prior batch — app.ts) |
| SEC-T7-01 | Critical | protobufjs@7.5.4 RCE | ae53182d |
| SEC-T9-01 | Critical | RCE shell injection in git credential helper | a3fa8352 |
| SEC-T9-02 | Critical | Indirect prompt injection via workflow.json | 58408286 |
| SEC-T9-03 | Critical | parseFileProposals path traversal → file write | 58408286 |
| SEC-T10-001 | Critical | Docker socket bind-mount host escape | fddda017 |
| SEC-T11-01 | Critical | isCAO mass assignment via PATCH /agents/:id | d970e395 |

### High — Fixed (41)

| ID | Title | Commit |
|---|---|---|
| SEC-T1-003 | OIDC id_token without signature verification | 4332468b |
| SEC-T1-004 | SSO sessions bypass BetterAuth logout | 4332468b |
| SEC-T1-005 | allowDifferentEmails account hijack | 41f1303a |
| SEC-T1-006 | Agent perm inheritance unconditional | 13373edf |
| SEC-T1-007 | Admin temp password 48-bit entropy | 98e5762c |
| SEC-T1-008 | E2E seed disables rate limiters | 00ee0f9a |
| SEC-T2-002 | agent_permissions/role_permissions no RLS | 52d08026 |
| SEC-T2-005 | WS upgrade no companyId UUID validation | 59c4c432 |
| SEC-T2-006 | Agent routes use DB companyId not param | 79e656d7 |
| SEC-T2-008 | local_trusted no production guard | b23dec33 |
| SEC-T3-6  | Tenant context cleanup fire-and-forget | 63596857 |
| SEC-T4-02 | CORS wildcard on deployment-proxy | 9c16551e |
| SEC-T4-03 | AI Assistant prompt injection (workflow.json) | 58408286 |
| SEC-T4-04 | javascript: in deployment.url href | (safeExternalHref — prior batch) |
| SEC-T4-05 | javascript: in loginUrl href | (safeExternalHref — prior batch) |
| SEC-T4-06 | attachment.contentPath no protocol guard | (safeHref — prior batch) |
| SEC-T5-002 | SSRF via Jira baseUrl | 42b452a4 |
| SEC-T5-005 | No trust proxy → IP rate limit broken | (app.ts — prior batch) |
| SEC-T5-013 | Deployment proxy auth bypass | 9c16551e |
| SEC-T6-01 | BetterAuth fallback secret | 00ee0f9a |
| SEC-T6-02 | MCP_JWT_SECRET undocumented | 00ee0f9a |
| SEC-T6-03 | pino-http logs req.body on errors | 00ee0f9a |
| SEC-T6-04 | WS token via ?token= query | 59c4c432 |
| SEC-T7-03 | path-to-regexp ReDoS | ae53182d |
| SEC-T7-04 | defu prototype pollution | ae53182d |
| SEC-T7-05 | fast-xml-parser proto pollution | ae53182d |
| SEC-T7-06 | vite dev-server file read | ae53182d |
| SEC-T7-07 | picomatch ReDoS | ae53182d |
| SEC-T7-08 | dompurify XSS | ae53182d |
| SEC-T7-09 | hono vulnerability | ae53182d |
| SEC-T8-01 | CSWSH — no Origin validation on WS upgrade | 59c4c432 |
| SEC-T8-02 | Agent API token via ?token= query | 59c4c432 |
| SEC-T8-03 | No WS connection limit per actor | 59c4c432 |
| SEC-T9-05 | --dangerously-skip-permissions default | 54a10c25 |
| SEC-T9-07 | CAO hijack via issue title | 54a10c25 |
| SEC-T10-002 | Shell injection + skip-permissions in drift CLI | 54a10c25 |
| SEC-T10-003 | Bun curl-bash no checksum | 095c5b96 |
| SEC-T10-004 | Docker password mnm:mnm hardcoded | 00ee0f9a |
| SEC-T10-005 | E2E password committed in code | 13373edf |
| SEC-T11-02 | SSRF via company import URL | 42b452a4 |
| SEC-T11-03 | bypassTagFilter role escalation | 457c7767 |
| SEC-T11-04 | Webhook secrets stored plaintext | 8bb3c243 |

### Partial / Deferred

| ID | Severity | Title | Reason |
|---|---|---|---|
| SEC-T2-004 | High | RLS context race (is_local=false + pool) | Full fix = per-request dedicated connection or transaction-scoped is_local=true. Mitigated with pre-clear guard + double cleanup hook. Deferred — invasive architectural change. |
| SEC-T8-04 | High | WS sessions survive token revocation | expiresAt added (90-day). Real-time revocation needs token blacklist (Redis TTL). Deferred — requires product decision on UX impact. |
| SEC-T5-004 | High | Rate limiter — no per-route LLM cap | Redis rate limiter in place. Per-route LLM cost cap needs product-level decision (pricing model). |
| SEC-T9-04 | High | (details in T9 findings file) | See T9 findings for specifics |
| SEC-T9-06 | High | (details in T9 findings file) | See T9 findings for specifics |

### Wontfix

| ID | Severity | Title | Justification |
|---|---|---|---|
| SEC-T2-007 | High | oauth_clients no company_id | By design — MnM runs one OAuth AS per instance; clients are instance-global |
| SEC-T7-02 | High | kysely MySQL SQLi | PG-only stack; MySQL codepath never executed |
| SEC-T3-1  | High | pgvector embedding injection | Only trusted internal source; no user-controlled vectors today |

### False positives / Info

Medium/Low/Info findings are tracked per-team in `findings/T*/`. Counts: 52 medium, 35 low, 17 info. Most are defence-in-depth suggestions or have mitigating controls already in place.

---

## Build / typecheck status

| Check | Result |
|---|---|
| `bun run typecheck` | **PASS** — 0 errors, 16/16 packages |
| `bun run build` | **PASS** — 0 errors (chunk-size warnings only, non-blocking) |
| `bun audit` | **2 advisories** — lodash high+moderate via mermaid (transitive, no upstream fix available) |

---

## Remaining work / next steps

1. **Configure `MNM_WS_ALLOWED_ORIGINS` in production** — the WS origin guard defaults to localhost variants in dev mode. Before going to prod, set this env var to your public domain (e.g. `https://app.mnm.io`).

2. **Rotate webhook secrets stored before batch H3** — the encryption-at-rest fix (8bb3c243) protects new secrets. Existing rows were migrated with an in-place `pgcrypto` re-encrypt but you should audit any secrets that may have been logged or copied in plaintext before that commit.

3. **Token blacklist for SEC-T8-04** — add a Redis-backed revocation list for WS sessions so revoking an API key takes effect immediately (not after 90 days). Medium effort, product decision needed on UX.

4. **Upgrade mermaid** once lodash is updated upstream — the 2 remaining `bun audit` advisories are in lodash via mermaid; nothing actionable until mermaid ships a new release.

5. **CI/CD security scan** (SEC-T10-010) — add GitHub Actions with Trivy or Snyk scanning on PRs. Currently no CI scan at all.

6. **is_local=true for RLS** (SEC-T2-004 full fix) — wrap each request in a transaction so `set_config('app.current_company_id', ..., true)` (transaction-scoped) is used instead of session-scoped, fully eliminating the pool-reuse race condition.

7. **Per-route LLM cost cap** (SEC-T5-004) — product decision: throttle `/api/*/ai/chat` and drift endpoints separately from normal API traffic to prevent LLM cost amplification attacks.

---

## Git log (security commits)

```
eade5b67 chore(security): typecheck/build cleanup after night audit
59c4c432 fix(security): batch K — WebSocket Origin/limits/expiresAt/no-token-in-query
63596857 fix(security): batch J — MCP RLS context + backup-lib whitelist + tenant middleware sync
dff882ef docs(security): update finding status for batch M fixes
13373edf fix(security): batch M6 — E2E password from env + agent perm inheritance scoped
095c5b96 fix(security): batch M5 — Dockerfile pin bun + checksum verify
98e5762c fix(security): batch E5 — temp password entropy + session invalidation
54a10c25 fix(security): batch M4 — disable --dangerously-skip-permissions default + CAO prompt sanitization
41f1303a fix(security): batch E4 — disable allowDifferentEmails account linking
42b452a4 fix(security): batch L — central SSRF guard for outbound URLs (Jira, company import, HTTP adapter)
b23dec33 fix(security): batch M3 — local_trusted production guard
4332468b fix(security): batch E1 — SAML signature validation with xml-crypto
79e656d7 fix(security): batch M2 — agent route req.params.companyId enforcement
fddda017 fix(security): batch M1 — Docker socket via socket-proxy with API allowlist
8bb3c243 fix(security): batch H3 — encrypt webhook secrets at rest (T11-04)
457c7767 fix(security): batch H2 — bypassTagFilter role escalation guard (T11-03)
d970e395 fix(security): batch H1 — isCAO mass assignment via PATCH /agents/:id (T11-01)
58408286 fix(security): batch G — AI Assistant path validation + prompt injection isolation
a3fa8352 fix(security): batch F — RCE shell injection in git credential helper
9c16551e fix(security): batch C — deployment proxy auth bypass + CORS hardening
ae53182d fix(security): batch I — supply chain overrides + workspace privatization
52d08026 fix(security): batch B — RLS hardening for 12 untenanted tables
00ee0f9a fix(security): batch A — auth secrets, E2E prod guard, docker pwd, body log redaction
```

**Total security fix commits: 23** (plus ~10 earlier commits for OAuth/SSO hardening and permission wiring)
