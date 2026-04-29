# T1-Auth Security Audit Summary
**Team T1 — Authentication & Session**
**Date:** 2026-04-29
**Auditor:** T1 whitehat/redhat/blackhat team
**Scope:** MnM Platform — Auth, Session, JWT, OAuth, SSO

---

## Finding Count by Severity

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 5 |
| Low | 3 |
| Info | 2 |
| **Total** | **17** |

---

## Top 5 Risks by Criticality

### 1. SEC-T1-002 — CRITICAL: SAML signature validation is a stub
**File:** `server/src/services/sso-auth.ts:132–138`
The SAML ACS handler checks only for the string `"Signature"` anywhere in the XML body. No cryptographic verification is performed. Any attacker can POST a forged SAML assertion claiming any email address to obtain a full session. This is an unauthenticated, pre-auth attack — no credentials needed, only a valid `RelayState` obtained from the public login-initiation endpoint (or absent relay state entirely per SEC-T1-015). Combined with SEC-T1-015 (optional relay state), this is a zero-click account takeover for any company with SAML SSO enabled.

### 2. SEC-T1-001 — CRITICAL: Hard-coded fallback JWT secret in BetterAuth (no deploymentMode guard)
**File:** `server/src/auth/better-auth.ts:180`
`createBetterAuthInstance` resolves the signing secret as `BETTER_AUTH_SECRET ?? MNM_AGENT_JWT_SECRET ?? "mnm-dev-secret"` with no check that `deploymentMode === "authenticated"`. If both env vars are unset in a production deployment, the server starts silently with a public secret. An attacker can forge valid session cookies and impersonate any userId. Unlike the agent JWT path (which throws), this fallback is silent and undetectable by operators.

### 3. SEC-T1-008 — HIGH: MNM_E2E_SEED=true disables all rate limiting AND exposes unauthenticated privilege-escalation endpoints
**File:** `server/src/middleware/rate-limit.ts:118`, `server/src/routes/e2e-seed.ts:66–70`
If this flag is accidentally set in production, every rate limiter (including BetterAuth's own) is disabled globally, and `POST /api/e2e-seed/ensure-access` is exposed without authentication. One request grants instance_admin to any userId. A single misconfigured Docker Compose variable causes complete instance compromise.

### 4. SEC-T1-003 — HIGH: OIDC id_token decoded without signature verification
**File:** `server/src/services/sso-auth.ts:275–284`
The OIDC callback handler decodes the id_token JWT payload with `Buffer.from(...).toString("base64")` but never verifies the signature, iss, aud, or exp. Trust is placed entirely in the HTTP response from the configured `tokenUrl`. A misconfigured token endpoint or a MITM between server and IdP results in arbitrary identity injection. No PKCE is used on the SSO OIDC flow either.

### 5. SEC-T1-006 — HIGH: Agent permissions unconditionally inherit from creator — compromised agent token = creator's full access
**File:** `server/src/middleware/require-permission.ts:104–109`
When an agent lacks a permission, the system falls back to checking the creator user's permissions. There is no cap mechanism. Any agent token can perform any action the creator can perform, regardless of the agent's assigned role. A read-only agent silently has full creator access. Combined with SEC-T1-009 (JWT replay), a stolen agent token with a high-privilege creator gives full creator-level access for 2 hours.

---

## All Findings Reference

| ID | Severity | Title |
|----|----------|-------|
| SEC-T1-001 | Critical | Hard-coded fallback JWT secrets — BetterAuth has no deploymentMode guard |
| SEC-T1-002 | Critical | SAML signature validation is a stub — arbitrary assertions accepted |
| SEC-T1-003 | High | OIDC id_token decoded without signature verification |
| SEC-T1-004 | High | SSO sessions bypass BetterAuth lifecycle — no server-side invalidation on logout |
| SEC-T1-005 | High | allowDifferentEmails=true enables OAuth account takeover |
| SEC-T1-006 | High | Agent permissions inherit unconditionally from creator |
| SEC-T1-007 | High | Temporary password: 6-byte entropy, returned in plaintext, no expiry |
| SEC-T1-008 | High | MNM_E2E_SEED=true disables all rate limiting + exposes unauthenticated seed endpoints |
| SEC-T1-009 | Medium | Agent JWT jti never validated for replay — 2-hour replay window |
| SEC-T1-010 | Medium | boardMutationGuard CSRF: Host-derived trusted origins bypassable via host header injection |
| SEC-T1-011 | Medium | isInstanceAdmin bypasses all company membership and RBAC checks — over-broad super-admin |
| SEC-T1-012 | Medium | SSRF via SSO metadata sync — arbitrary internal URLs fetched |
| SEC-T1-013 | Medium | Board-claim challenge printed in startup logs — accessible to anyone with log access |
| SEC-T1-014 | Medium | BetterAuth sign-in endpoint bypasses global API rate limiter (mounted order) |
| SEC-T1-015 | Medium | SAML relay state is optional — CSRF protection skipped when absent |
| SEC-T1-016 | Medium | OAuth DCR endpoint unauthenticated — anyone can register OAuth clients |
| SEC-T1-017 | Low | In-memory CSRF/SSO state stores — not distributed, breaks multi-instance |
| SEC-T1-018 | Low | SSO session cookie Secure flag uses req.secure — may be false behind HTTP proxy |
| SEC-T1-019 | Low | Legacy JWT issuer/audience values permanently accepted, tokens without iss/aud bypass checks |
| SEC-T1-020 | Low | requireEmailVerification=false — email squatting, SSO linking abuse |
| SEC-T1-021 | Info | GOOD PRACTICES: timing-safe compares, PKCE S256 enforcement, code single-use, token hashing |
| SEC-T1-022 | Info | x-mnm-run-id is client-controlled — informational only, not used for auth |

---

## Surfaces Not Audited / Out of Scope

The following surfaces were identified but not fully audited in this T1 pass. They are recommended for T2/T3 team review:

1. **PostgreSQL RLS policy definitions** (`packages/db/` migrations) — The tenant context and RLS are correctly set server-side, but the actual SQL RLS policies on each table were not read. A misconfigured policy could leak cross-tenant data.

2. **BetterAuth internal session management** — BetterAuth is a third-party library. Its internal session ID entropy, rotation behavior, and cookie configuration were not audited. The library version and its known CVEs were not checked.

3. **Token exposure in HTTP access logs** — The HTTP logger (`middleware/logger.ts`) was not fully audited for whether it logs Authorization headers or response bodies containing sensitive data.

4. **WebSocket auth** (`server/src/realtime/live-events-ws.ts`, `chat-ws.ts`) — These files were not audited in this pass. WebSocket auth uses `agentApiKeys` hash lookup which was observed briefly but not fully traced.

5. **Tauri desktop app auth** (`apps/desktop/src-tauri/`) — Desktop auth configuration was not reviewed.

6. **Password strength requirements** — BetterAuth's default password policy (minimum length, complexity) was not verified.

7. **Invitation flow token entropy and expiry** (`server/src/routes/access.ts:1561+`) — Invite token generation and validation was not fully traced.

---

## Strategic Recommendations

**Immediate (before next public deployment):**
1. Fix SEC-T1-001: Add deploymentMode guard to BetterAuth secret resolution. This is a one-line fix with potentially catastrophic consequences if missed.
2. Fix SEC-T1-002: Replace SAML stub with `xml-crypto` or `samlify` validation. Do not enable SAML SSO in production until this is fixed.
3. Fix SEC-T1-008: Add startup assertion `if (MNM_E2E_SEED=true && deploymentMode=authenticated) throw`.

**Short term (next sprint):**
4. Fix SEC-T1-003: Use `openid-client` for OIDC token validation.
5. Fix SEC-T1-015: Make SAML relay state mandatory.
6. Fix SEC-T1-016: Require authentication for OAuth DCR.
7. Fix SEC-T1-007: Increase temp password entropy and add expiry.

**Medium term:**
8. Address SEC-T1-006: Cap agent permissions at creator level rather than inheriting.
9. Address SEC-T1-004: Route SSO sessions through BetterAuth's session API.
10. Address SEC-T1-014: Add dedicated rate limiter before BetterAuth handler.
11. Address SEC-T1-020: Enable email verification in authenticated mode.

**Architecture:**
- Consider migrating SSO state and CSRF stores to Redis (SEC-T1-017) before horizontal scaling.
- Establish a JWT rotation policy and jti revocation store (SEC-T1-009).
- Audit all usages of `isInstanceAdmin` bypass for least-privilege review (SEC-T1-011).
