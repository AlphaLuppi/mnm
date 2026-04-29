# T4 — XSS / CSRF / Frontend Security Audit Summary
**Date:** 2026-04-29
**Team:** T4 Whitebox Security Audit (whitehat + redhat + blackhat)
**Scope:** ui/src/, server/src/middleware/, server/src/app.ts, packages/mnm-plugin/
**Repo root:** C:/Users/andri/IdeaProjects/AlphaLuppi/mnm

---

## Stats by Severity

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 4 |
| Medium | 3 |
| Low | 3 |
| Total | 11 |

---

## All dangerouslySetInnerHTML Occurrences

| File | Line | Content | Sanitized? | Justified? |
|---|---|---|---|---|
| ui/src/components/MarkdownBody.tsx | 101 | Mermaid SVG from user markdown | YES — DOMPurify USE_PROFILES:{svg:true} | YES (fragile, see SEC-T4-13) |

Result: 1 occurrence total. It IS sanitized. No unprotected dangerouslySetInnerHTML found.

---

## Top 5 Risks

### 1. SEC-T4-01 — CRITICAL: No HTTP security headers at all
No CSP, no X-Frame-Options, no HSTS, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy.
The entire Express app is served with zero security headers — no helmet middleware installed.
File: server/src/app.ts (createApp function has no helmet call).

### 2. SEC-T4-02 — HIGH: CORS wildcard on deployment proxy
The /preview/:deploymentId/* proxy sets Access-Control-Allow-Origin: * unconditionally.
Any origin can read deployment content cross-origin.
File: server/src/middleware/deployment-proxy.ts:63

### 3. SEC-T4-04 — HIGH: Deployment URLs as href without protocol validation
deployment.url is rendered as <a href={deployment.url}> without a protocol guard.
A javascript: URI injected into deployment.url triggers XSS when clicked.
Files: ui/src/components/deployments/IssueDeploymentLinks.tsx:118, ui/src/pages/Deployments.tsx:150, ui/src/pages/GovernedWorkflowRunDetail.tsx:114

### 4. SEC-T4-03 — HIGH: Indirect prompt injection via workflow.json
The full workflow.json is embedded verbatim in the Claude system prompt.
Malicious instructions in any workflow field can manipulate AI output.
Current rendering is plain text (safe) but this is undocumented — one MarkdownBody renderer switch = stored XSS.
File: server/src/services/workflow-ai-assistant.ts:137

### 5. SEC-T4-07 — MEDIUM: Open redirect via ?next= parameter
The /auth page's ?next= is passed directly to react-router navigate() without origin validation.
React Router will follow absolute external URLs (http://evil.com) via navigate().
File: ui/src/pages/Auth.tsx:26,42,71

---

## State of CSP

STATUS: ABSENT

No Content-Security-Policy header is set on any main application response.
No <meta http-equiv="Content-Security-Policy"> in index.html.
Only exception: CSP frame-ancestors 'none' on the MCP OAuth consent-data API endpoint (mcp-oauth-router.ts:182-183) — a single narrow route.
No helmet middleware anywhere in server/src/app.ts.
Consequence: Any XSS executes without browser-side mitigation.

---

## State of CORS

PARTIALLY MISCONFIGURED

| Endpoint | Policy | Risk |
|---|---|---|
| /preview/:deploymentId/* | Access-Control-Allow-Origin: * | HIGH (SEC-T4-02) |
| /api/* all routes | No CORS header | SameSite=Lax partial CSRF protection |
| /api/auth/* | BetterAuth trustedOrigins allowlist | Acceptable |

No Access-Control-Allow-Origin: * combined with credentials found (that would be critical).

---

## State of CSRF Protection

PARTIAL — relies solely on SameSite=Lax cookies.

- Session cookies: SameSite=lax; httpOnly=true (BetterAuth + SSO-auth route).
- No CSRF token middleware on any /api/* mutation endpoint.
- No Origin/Referer header check on mutations in main API router.
- MCP OAuth consent form DOES have a proper CSRF token (correct implementation).
- SameSite=Lax bypassed by: cross-subdomain requests, top-level navigation to GET mutations, older browsers.

---

## Tauri Desktop App

NOT FOUND — apps/desktop/src-tauri/ does not exist. No Tauri findings applicable.

---

## Additional Notes

- No eval() or Function() string constructor calls in ui/src/ — clean.
- No innerHTML/outerHTML direct assignments in ui/src/ — all DOM via React.
- No external CDN scripts — fully self-hosted (good).
- Session tokens in httpOnly cookies, not localStorage (good).
- MCP OAuth CSRF is correctly implemented with in-memory token store.
- AI assistant file proposals rendered as plain text pre — safe currently.
- Issue/asset upload MIME allowlists exist but folder/document uploads have none (SEC-T4-10).
- gate-runner context.eval runs inside isolated-vm — not a browser XSS vector.
- workspace.repoUrl in ProjectProperties.tsx:416 also lacks protocol guard (same class as SEC-T4-04).
- attachment.contentPath in IssueDetail.tsx lacks protocol guard (SEC-T4-06).
- claudeLoginResult.loginUrl in AgentDetail.tsx lacks protocol guard (SEC-T4-05).
