# MnM — Vulnerabilities Register (consolidated)

**Audit completed (recon)** : 2026-04-29
**Teams** : 11 (T1 → T11)
**Findings total** : 167

| Severity | Count |
|---|---|
| **Critical** | 13 |
| **High** | 50 |
| Medium | 52 |
| Low | 35 |
| Info | 17 |

## Cross-team confirmations (high signal)

Les vulnerabilités confirmées par plusieurs teams indépendantes sont prioritaires.

| Pattern | Teams |
|---|---|
| `workflow.json` prompt injection (verbatim in system prompt) | T4-03, T8-08, T9-02, T11-08 |
| Deployment preview proxy auth bypass (`req.actor` truthy) | T2-003, T5-013, T11-09 |
| BetterAuth secret fallback `"mnm-dev-secret"` | T1-001, T6-01 |
| WS token via `?token=` query (logged plaintext) | T8-02, T6-04 |
| E2E `MNM_E2E_SEED=true` = production backdoor | T1-008, T11-07 |
| Docker `POSTGRES_PASSWORD: mnm` hardcoded | T6-06, T10-004 |
| `--dangerously-skip-permissions=true` default | T9-05, T10-002 |

---

## Critical (13)

| ID | Title | File | Status |
|---|---|---|---|
| SEC-T1-001 | BetterAuth secret fallback `"mnm-dev-secret"` no deploymentMode guard | `server/src/auth/better-auth.ts:180` | **fixed** — commit 00ee0f9a |
| SEC-T1-002 | SAML ACS handler — zero crypto validation (string `Signature` passes) | `server/src/services/sso-auth.ts:132` | **fixed** — commit 4332468b |
| SEC-T2-001 | 9 tenant tables without RLS (routines/triggers/runs, view_presets, user_widgets, inbox_items, oauth_refresh_tokens, folder_shares, feedback_votes) | `packages/db/src/schema*` | **fixed** — commit 52d08026 |
| SEC-T2-003 | Deployment preview proxy IDOR (`/preview/:deploymentId` checks `!!req.actor` only) | `server/src/middleware/deployment-proxy.ts` | **fixed** — commit 9c16551e |
| SEC-T3-2 | Backup utility RLS bypass + no whitelist (reads cross-company) | `packages/db/src/backup-lib.ts` | **fixed** — commit 63596857 |
| SEC-T3-9 | RLS context leakage via 18 MCP tool handlers (no `clearTenantContext` finally) | `server/src/mcp/tools/governed-workflows.tool.ts` | **fixed** — commit 63596857 |
| SEC-T4-01 | Zero security headers (no helmet, CSP, HSTS, X-Frame-Options) | `server/src/app.ts` | **fixed** — (committed by prior batch; app.ts had headers before this agent) |
| SEC-T7-01 | `protobufjs@7.5.4` RCE (GHSA-xq3m-2v4x-88gg) | root `package.json` overrides | **fixed** — commit ae53182d |
| SEC-T9-01 | RCE via shell injection in git credential helper (`repoUrl` raw in shell `case`) | `packages/adapters/claude-local/src/server/execute.ts:315` | **fixed** — commit a3fa8352 |
| SEC-T9-02 | Indirect prompt injection — `workflow.json` verbatim in AI Assistant system prompt | `server/src/services/workflow-ai-assistant.ts:112-142` | **fixed** — commit 58408286 |
| SEC-T9-03 | `parseFileProposals` accepts `../../.env` paths → arbitrary file write via Apply | `server/src/services/workflow-ai-assistant.ts:163-230` | **fixed** — commit 58408286 |
| SEC-T10-001 | Docker socket bind-mount → host escape | `docker-compose*.yml` | **fixed** — commit fddda017 (tecnativa socket-proxy) |
| SEC-T11-01 | `metadata.isCAO` mass assignment via `PATCH /agents/:id` | `server/src/routes/agents.ts:1085` | **fixed** — commit d970e395 |

## High (50)

### Auth & Sessions
- **[fixed 4332468b]** SEC-T1-003 — OIDC id_token decoded without signature verification
- **[fixed 4332468b]** SEC-T1-004 — SSO sessions bypass BetterAuth lifecycle (logout doesn't revoke)
- **[fixed 41f1303a]** SEC-T1-005 — `allowDifferentEmails: true` enables account hijack
- **[fixed 13373edf]** SEC-T1-006 — Agent permission inheritance unconditional (low-priv token = creator full access)
- **[fixed 98e5762c]** SEC-T1-007 — Admin temp password 48-bit entropy plaintext no expiry
- **[fixed 00ee0f9a]** SEC-T1-008 — `MNM_E2E_SEED=true` disables rate limiters + exposes seed endpoint without auth

### Multi-tenant
- **[fixed 52d08026]** SEC-T2-002 — `agent_permissions` / `role_permissions` no `company_id` no RLS
- **[partial 63596857]** SEC-T2-004 — RLS context race (`is_local=false` + async cleanup + 40-conn pool) — mitigated with pre-clear guard + double hook; full fix (transaction-scoped is_local=true) deferred — invasive architectural change
- **[fixed 59c4c432]** SEC-T2-005 — WS endpoints don't validate `companyId` UUID
- **[fixed 79e656d7]** SEC-T2-006 — Agent routes use `agent.companyId` from DB, not `req.params.companyId`
- **[wontfix]** SEC-T2-007 — `oauth_clients` no `company_id` — instance-global by design (MnM runs one OAuth AS per instance)
- **[fixed b23dec33]** SEC-T2-008 — `local_trusted` mode no production guard

### SQL/ORM
- **[info/wontfix]** SEC-T3-1 — pgvector embedding injection vector — mitigated by trusted source; no action needed today
- **[fixed 63596857]** SEC-T3-6 — tenant-context middleware async cleanup fire-and-forget

### XSS/CSRF
- **[fixed 9c16551e]** SEC-T4-02 — CORS `*` on deployment-proxy
- **[fixed 58408286]** SEC-T4-03 — AI Assistant prompt injection via `workflow.json`
- **[fixed]** SEC-T4-04 — `javascript:` protocol allowed in `deployment.url <a href>` — `safeExternalHref()` in IssueDeploymentLinks.tsx + Deployments.tsx
- **[fixed]** SEC-T4-05 — `javascript:` protocol allowed in `claudeLoginResult.loginUrl` — `safeExternalHref()` in AgentDetail.tsx
- **[fixed]** SEC-T4-06 — `attachment.contentPath` no protocol guard — `safeHref()` in IssueDetail.tsx (3 sites)

### API hardening
- **[fixed 42b452a4]** SEC-T5-002 — SSRF via Jira `baseUrl` (no RFC1918 / link-local filter)
- **[deferred]** SEC-T5-004 — rate limiter single-instance, Redis race, no per-route LLM cap — Redis limiter already in place; per-route LLM cap needs product decision
- **[fixed]** SEC-T5-005 — no `trust proxy` → IP rate limit broken behind LB — `app.set("trust proxy", 1)` in app.ts (authenticated mode only)
- **[fixed 9c16551e]** SEC-T5-013 — deployment proxy `req.actor` always truthy (cross-T2-003)

### Secrets
- **[fixed 00ee0f9a]** SEC-T6-01 — BetterAuth fallback `"mnm-dev-secret"` (cross-T1-001)
- **[fixed 00ee0f9a]** SEC-T6-02 — `MNM_MCP_JWT_SECRET` undocumented in `.env.example`
- **[fixed 00ee0f9a]** SEC-T6-03 — pino-http logs `req.body` on 4xx/5xx → passwords/secrets in `server.log`
- **[fixed 59c4c432]** SEC-T6-04 — WS token via `?token=` query → logged (cross-T8-02)

### Supply chain
- **[wontfix]** SEC-T7-02 — `kysely@0.28.12` MySQL SQLi — PG only, no exploitable path
- **[fixed ae53182d]** SEC-T7-03 — `path-to-regexp@8.3.0` ReDoS via `express@5.2.1`
- **[fixed ae53182d]** SEC-T7-04 — `defu@6.1.4` prototype pollution via `better-auth@1.4.18`
- **[fixed ae53182d]** SEC-T7-05 — `fast-xml-parser` proto pollution
- **[fixed ae53182d]** SEC-T7-06 — `vite@6.4.1` dev-server arbitrary file read via WS CORS bypass
- **[fixed ae53182d]** SEC-T7-07 — `picomatch` ReDoS
- **[fixed ae53182d]** SEC-T7-08 — `dompurify` XSS
- **[fixed ae53182d]** SEC-T7-09 — `hono` vulnerability

### WS/SSE
- **[fixed 59c4c432]** SEC-T8-01 — CSWSH (no Origin validation on WS upgrade)
- **[fixed 59c4c432]** SEC-T8-02 — Agent API token via `?token=` (cross-T6-04)
- **[fixed 59c4c432]** SEC-T8-03 — No WS connection limit per user/company → DoS
- **[partial 59c4c432]** SEC-T8-04 — WS sessions survive token revocation — expiresAt added (90d); full real-time revocation would need a token blacklist (deferred)

### LLM
- **[deferred]** SEC-T9-04 — (high) — details in T9 findings file
- **[fixed 54a10c25]** SEC-T9-05 — `--dangerously-skip-permissions=true` default on claude_local agents
- **[deferred]** SEC-T9-06 — (high) — details in T9 findings file
- **[fixed 54a10c25]** SEC-T9-07 — CAO hijack via issue title/description (creates Admin agents)

### Infra
- **[fixed 54a10c25]** SEC-T10-002 — Shell injection + `--dangerously-skip-permissions` in drift CLI fallback
- **[fixed 095c5b96]** SEC-T10-003 — Bun installed via `curl | bash` no checksum no version pin
- **[fixed 00ee0f9a]** SEC-T10-004 — Docker password `mnm:mnm` hardcoded (cross-T6-06)
- **[fixed 13373edf]** SEC-T10-005 — E2E password `E2eTestPass!2026` committed

### Wildcard
- **[fixed 42b452a4]** SEC-T11-02 — SSRF via `POST /api/companies/import/preview` (`source.type:"url"`)
- **[fixed 457c7767]** SEC-T11-03 — `bypassTagFilter` role escalation (level check OK, flag check missing)
- **[fixed 8bb3c243]** SEC-T11-04 — Webhook secrets stored plaintext (column nommée `secret_hash` mais raw hex)

## Medium / Low / Info

Voir les fichiers individuels dans `_bmad-output/security-audit-2026-04-29/findings/T*/`.
Counts : 52 medium, 35 low, 17 info.

---

## Plan de remédiation (Fix Team)

**Priorité 1 (Fix immédiat — critical + production-impact high)** :
1. Hardening secrets : SEC-T1-001 + SEC-T6-01 (BetterAuth secret guard) ; SEC-T6-02 (env doc) ; SEC-T10-004 + SEC-T6-06 (docker pwd)
2. Multi-tenant RLS : SEC-T2-001 (9 tables RLS) ; SEC-T2-002 (perms tables) ; SEC-T2-007 (oauth_clients)
3. Deployment proxy auth : SEC-T2-003 + SEC-T5-013 + SEC-T11-09 (un seul fix consolidé)
4. SAML : SEC-T1-002 (signature validation)
5. RCE : SEC-T9-01 (shell injection git helper)
6. Path traversal AI : SEC-T9-02 + SEC-T9-03 (workflow.json + parseFileProposals)
7. Mass assignment : SEC-T11-01 (isCAO field strip)
8. Headers : SEC-T4-01 (helmet + CSP + HSTS + X-Frame-Options)
9. Supply chain : SEC-T7-01 (protobufjs override) + SEC-T7-03 + SEC-T7-04 + SEC-T7-06
10. E2E mode prod guard : SEC-T1-008 + SEC-T11-07
11. Docker socket : SEC-T10-001 (remove ou contraindre)
12. WS hardening : SEC-T8-01 (Origin) + SEC-T8-03 (limit) + SEC-T8-02/T6-04 (no token in query)

**Priorité 2 (high prio — peut nécessiter plus de design)** :
- OAuth/SSO : SEC-T1-003 / T1-004 / T1-005
- Agent permission inheritance refactor : SEC-T1-006
- Tenant context cleanup : SEC-T2-004 + SEC-T3-6
- CAO hardening : SEC-T9-05 + SEC-T9-07
- SSRF : SEC-T5-002 + SEC-T11-02 + SEC-T11-10
- bypassTagFilter : SEC-T11-03
- Webhook secrets : SEC-T11-04

**Priorité 3 (medium/low — best-effort)** :
- Le reste, en fonction du temps.
