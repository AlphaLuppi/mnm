# Security Audit — Progress Log

**Démarré** : 2026-04-29
**Plan** : `docs/superpowers/plans/2026-04-29-night-security-audit.md`
**Tom** : dort, autonome jusqu'à son réveil

---

## État global

- [x] Plan rédigé
- [x] CLAUDE.md mis à jour avec ACTIVE MISSION
- [x] Wave 1 lancée (2026-04-29 ~01:30)
- [x] Wave 1 terminée (T1+T2+T3)
- [x] Wave 2 lancée
- [x] Wave 2 terminée (T4+T5+T6)
- [x] Wave 3 lancée
- [x] Wave 3 terminée (T7+T8+T9)
- [x] Wave 4 lancée
- [x] Wave 4 terminée (T10+T11)
- [x] VULNERABILITIES.md consolidé (167 findings)
- [ ] Fix Team passée
- [ ] SECURITY-AUDIT-REPORT.md final
- [ ] typecheck + build OK
- [ ] Tous fix commits poussés

---

## Logs des waves

### Wave 1 — Foundations
- [x] T1 Auth — status: **done** — 2 critical, 5 high, 5 medium, 3 low, 2 info (22 findings)
  - SEC-T1-002 critical: SAML ACS no signature validation (string "Signature" passes)
  - SEC-T1-001 critical: BetterAuth secret fallback "mnm-dev-secret" no deploymentMode guard
  - SEC-T1-003 high: OIDC id_token decoded without signature verification
  - SEC-T1-004 high: SSO sessions bypass BetterAuth lifecycle (logout doesn't revoke)
  - SEC-T1-005 high: allowDifferentEmails:true → account linking hijack
  - SEC-T1-006 high: Agent permission inheritance unconditional (low-priv token = creator full access)
  - SEC-T1-007 high: Admin temp password 48-bit entropy plaintext no expiry
  - SEC-T1-008 high: MNM_E2E_SEED=true globally disables rate limiters + exposes seed endpoint
- [x] T2 Multi-tenant — status: **done** — 2 critical, 6 high, 4 medium, 2 low
  - SEC-T2-001 critical: 9 tables sans RLS (routines, routine_triggers, routine_runs, feedback_votes, folder_shares, view_presets, user_widgets, inbox_items, oauth_refresh_tokens)
  - SEC-T2-003 critical: deployment preview IDOR (/preview/:deploymentId)
  - SEC-T2-002 high: agent_permissions/role_permissions sans company_id ni RLS
  - SEC-T2-004 high: RLS context race (is_local=false + async cleanup + pool)
  - SEC-T2-005 high: WS endpoints ne valident pas companyId UUID
  - SEC-T2-006 high: agent routes utilisent agent.companyId DB pas req.params.companyId
  - SEC-T2-007 high: oauth_clients sans company_id (instance-global)
  - SEC-T2-008 high: local_trusted mode pas gardé contre prod
  - SEC-T2-009..014 medium/low
- [x] T3 SQL/ORM — status: **done** — 2 critical, 2 high, 2 medium, 1 low, 2 info
  - SEC-T3-9 critical: RLS context leakage via MCP tools (no finally clearTenantContext)
  - SEC-T3-2 critical: backup-lib.ts cross-company RLS bypass + table whitelist absent
  - SEC-T3-6 high: tenant-context middleware async cleanup fire-and-forget
  - SEC-T3-1 high: pgvector embedding injection vector (mitigated currently)
  - SEC-T3-3 medium: Number(req.query.limit) NaN → no LIMIT
  - SEC-T3-5 medium: sql.unsafe() in migration engine
  - SEC-T3-7 low: ILIKE no max length
  - SEC-T3-4, SEC-T3-8 info

### Wave 2 — Surface
- [x] T4 XSS/CSRF — status: **done** — 1 critical, 4 high, 3 medium, 5 low (13 findings)
  - SEC-T4-01 critical: zero security headers (no helmet, CSP, HSTS, X-Frame-Options)
  - SEC-T4-02 high: CORS wildcard on deployment-proxy
  - SEC-T4-03 high: AI Assistant indirect prompt injection (workflow.json verbatim in system prompt)
  - SEC-T4-04 high: javascript: protocol allowed in deployment.url <a href>
  - SEC-T4-05 high: javascript: protocol allowed in claudeLoginResult.loginUrl
  - SEC-T4-06 high: attachment.contentPath without protocol guard
  - SEC-T4-07 medium: open redirect via ?next= unvalidated
  - SEC-T4-08 medium: CSRF protection relies only on SameSite=Lax (no token on mutations)
- [x] T5 API hardening — status: **done** — 0 critical, 5 high, 6 medium, 3 low, 1 info (15 findings)
  - SEC-T5-002 high: SSRF via Jira baseUrl (no RFC1918/link-local filter)
  - SEC-T5-013 high: deployment proxy auth bypass (req.actor always truthy → cross-confirm T2-003)
  - SEC-T5-005 high: no trust proxy → IP rate limit broken behind LB
  - SEC-T5-004 high: rate limiter single-instance, no per-route LLM cap, Redis race
  - SEC-T5-007 medium: documents/folders upload accepts any MIME (SVG, HTML, exe)
- [x] T6 Secrets — status: **done** — 0 critical, 4 high, 4 medium, 3 low, 1 info (12 findings)
  - SEC-T6-01 high: BetterAuth fallback "mnm-dev-secret" (cross-confirm T1-001)
  - SEC-T6-02 high: MCP_JWT_SECRET undocumented in .env.example
  - SEC-T6-03 high: pino-http logs req.body on 4xx/5xx → passwords/secrets in logs
  - SEC-T6-04 high: WS token via ?token= query (cross-confirm T8-02)
  - SEC-T6-05 medium: missing env vars in .env.example
  - SEC-T6-06 medium: docker-compose.yml hardcodes POSTGRES_PASSWORD=mnm
  - SEC-T6-07 medium: redaction.ts misses GIT_TOKEN_* patterns
  - SEC-T6-08 medium: encryption key in-memory only, no file fallback

### Wave 3 — Advanced
- [x] T7 Supply chain — status: **done** — 1 critical, 7 high, 5 medium, 4 low, 1 info (19 findings)
  - SEC-T7-01 critical: protobufjs@7.5.4 RCE (GHSA-xq3m-2v4x-88gg)
  - SEC-T7-02 high: kysely MySQL SQLi (low risk on PG)
  - SEC-T7-03 high: path-to-regexp ReDoS via express 5
  - SEC-T7-04 high: defu prototype pollution via better-auth
  - SEC-T7-06 high: vite dev-server file exfiltration (.env via CORS bypass)
  - SEC-T7-14 medium: dependency confusion (9 @mnm/* packages sans private:true)
  - SEC-T7-15 medium: ignore-scripts pas configuré
- [x] T8 WS/SSE — status: **done** — 0 critical, 4 high, 7 medium, 3 low, 1 info (15 findings)
  - SEC-T8-01 high: CSWSH (no Origin validation on WS upgrade)
  - SEC-T8-02 high: agent API token via query string → logged
  - SEC-T8-03 high: no WS conn limit per user/company → DoS
  - SEC-T8-04 high: WS sessions survive token revocation
  - SEC-T8-07 medium: agent_api_keys no expiresAt
  - SEC-T8-08 medium: indirect prompt injection via workflow.json (cross-T4)
- [x] T9 LLM prompt injection — status: **done** — 3 critical, 5 high, 4 medium, 3 low (15 findings)
  - SEC-T9-01 critical: RCE via shell injection in git credential helper (execute.ts:315 repoUrl)
  - SEC-T9-02 critical: workflow.json verbatim in AI system prompt (cross-T4-03/T8-08)
  - SEC-T9-03 critical: parseFileProposals accepts ../../.env → arbitrary file write
  - SEC-T9-05 high: --dangerously-skip-permissions=true default on claude_local
  - SEC-T9-07 high: CAO hijack via issue title/description (Admin perms)

### Wave 4 — Wildcards
- [x] T10 Infra/Tauri — status: **done** — 1 critical, 4 high, 7 medium, 4 low, 1 info (17 findings)
  - SEC-T10-001 critical: Docker socket bind-mount → host escape
  - SEC-T10-002 high: Shell injection + --dangerously-skip-permissions in drift CLI (cross-T9)
  - SEC-T10-003 high: Bun install via curl-bash no checksum
  - SEC-T10-004 high: Docker password mnm:mnm (cross-T6-06)
  - SEC-T10-005 high: E2E password E2eTestPass!2026 committed
  - SEC-T10-006 medium: no USER directive, gosu drop allows skip-permissions
  - SEC-T10-009 medium: COPY . . + incomplete .dockerignore (.npmrc, docs/, .claude/, .idea/)
  - SEC-T10-010 medium: zero GitHub Actions (no CI scan)
  - SEC-T10-013 low: Tauri desktop dir absent (audit gap, not a vuln itself)
- [x] T11 Wildcard recon — status: **done** — 1 critical, 4 high, 5+ medium/low (15 findings)
  - SEC-T11-01 critical: metadata.isCAO mass assignment via PATCH /agents/:id
  - SEC-T11-02 high: SSRF via company import URL
  - SEC-T11-03 high: bypassTagFilter role escalation
  - SEC-T11-04 high: webhook secrets stored plaintext (column "secret_hash")
  - SEC-T11-07 medium: E2E mode = production root backdoor (cross-T1-008)
  - SEC-T11-08 medium: workflow.json prompt injection (cross-T4-03/T8-08/T9-02)
  - SEC-T11-10 medium: HTTP adapter executes agent-config URLs without SSRF protection

### Fix Team
- [ ] T-FIX — status: pending

---

## Findings count (live)

| Team | critical | high | medium | low | info |
|------|----------|------|--------|-----|------|
| T1   | 2        | 5    | 5      | 3   | 2    |
| T2   | 2        | 6    | 4      | 2   | 0    |
| T3   | 2        | 2    | 2      | 1   | 2    |
| T4   | 1        | 4    | 3      | 5   | 0    |
| T5   | 0        | 5    | 6      | 3   | 1    |
| T6   | 0        | 4    | 4      | 3   | 1    |
| T7   | 1        | 7    | 5      | 4   | 1    |
| T8   | 0        | 4    | 7      | 3   | 1    |
| T9   | 3        | 5    | 4      | 3   | 0    |
| T10  | 1        | 4    | 7      | 4   | 1    |
| T11  | 1        | 4    | 5      | 4   | 1    |

---

## Fix log (commit hashes)

- 52d08026 — fix(security): batch B — RLS hardening for 12 untenanted tables (T2-001/002/014 fixed, T2-007 wontfix)
- d5940a9f — docs(security): add commit SHA to findings
- 00ee0f9a — fix(security): batch A — auth secrets, E2E prod guard, docker pwd, body log redaction (T1-001, T1-008, T6-01/02/03/06, T10-004, T11-07)
- ae53182d — fix(security): batch I — supply chain overrides + workspace privatization (T7-01..09, T7-14, T7-15) — bun audit 29→2
- 9c16551e — fix(security): batch C — deployment proxy auth bypass + CORS hardening (T2-003, T5-013, T11-09, T4-02)
- 2d60c4c0 — docs(security): annotate fix SHAs in findings
- a3fa8352 — fix(security): batch F — RCE shell injection in git credential helper (T9-01)
- 58408286 — fix(security): batch G — AI Assistant path validation + prompt injection isolation (T9-02, T9-03)
- 42b452a4 — fix(security): batch L — central SSRF guard (T5-002, T11-02, T11-10)
- 4332468b — fix(security): batch E1+E2+E3 — SAML signature + OIDC JWKS + SSO session lifecycle (T1-002, T1-003, T1-004)
- 41f1303a — fix(security): batch E4 — BetterAuth allowDifferentEmails=false (T1-005)
- 98e5762c — fix(security): batch E5 — admin temp password 128-bit + session invalidation (T1-007)
- fddda017 — fix(security): batch M1 — Docker socket via tecnativa/docker-socket-proxy (T10-001)
- 79e656d7 — fix(security): batch M2 — agent route req.params.companyId enforcement (T2-006)
- b23dec33 — fix(security): batch M3 — local_trusted production guard (T2-008)
- 54a10c25 — fix(security): batch M4 — disable --dangerously-skip-permissions default + CAO sanitization + drift exec (T9-05, T9-07, T10-002)
- 095c5b96 — fix(security): batch M5 — Dockerfile pin bun v1.2.10 + sha256 verify (T10-003)
- 13373edf — fix(security): batch M6 — E2E password from env, agent perm inheritance scoped (T10-005, T1-006)
- d970e395 — fix(security): batch H1 — isCAO mass assignment via PATCH /agents/:id (T11-01)
- 457c7767 — fix(security): batch H2 — bypassTagFilter role escalation guard (T11-03)
- 8bb3c243 — fix(security): batch H3 — encrypt webhook secrets at rest (T11-04)
- dff882ef — docs(security): update finding status for batch M fixes

---

## TypeScript cleanup pending

Erreurs TS détectées en cours de fix waves (à corriger après que les fix agents terminent) :

- `server/src/mcp/tools/governed-workflows.tool.ts:129+` — Fix-J a modifié signature `wrap()`, 10 call sites pas encore migrés (Expected 3 args, got 2)
- `server/src/app.ts` — Fix-D : `permissionsPolicy` n'existe pas dans helmet options (devrait être `permittedCrossDomainPolicies`) ; `rows` implicit any L194/247 ; helmet/shutdownMcp imports unused
- `server/src/services/workflow-ai-assistant.ts:379` — Fix-G : signature mismatch `workflowName` missing ; `rejectTraversal` unused
- `ui/src/components/deployments/IssueDeploymentLinks.tsx:20` — Fix-D : `safeExternalHref` import unused
- `ui/src/pages/Deployments.tsx` — Fix-D : `useState`, `Trash2` imports unused

Cleanup à faire après stabilisation des fix waves.

## Reprise après /compact

**Quoi faire si je reviens après un /compact :**

1. `cat docs/superpowers/plans/2026-04-29-night-security-audit.md` (le plan complet)
2. `cat _bmad-output/security-audit-2026-04-29/progress.md` (ce fichier)
3. `git log --oneline -30` (commits poussés)
4. `ls -la _bmad-output/security-audit-2026-04-29/findings/` (teams ayant rendu)
5. Trouver la 1re ligne `- [ ]` non cochée dans "État global" → c'est la prochaine étape.
6. Si une team est `running` mais sans output, la relancer.

**Briefs des teams** (pour relance) :
Voir `docs/superpowers/plans/2026-04-29-night-security-audit.md` section "Waves d'attaque".
