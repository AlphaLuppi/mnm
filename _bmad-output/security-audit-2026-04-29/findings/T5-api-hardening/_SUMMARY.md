# T5 API & Endpoint Hardening — Audit Summary
**Date**: 2026-04-29  
**Auditor**: Team T5 (whitebox, recon-only — no fixes applied)  
**Codebase**: `server/src/routes/`, `server/src/middleware/`, `server/src/services/`, `server/src/errors.ts`  
**Routes audited**: 54 route files, ~1 800 LOC of route handlers

---

## Stats by Severity

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 0 | — |
| **High** | 5 | SEC-T5-001 through SEC-T5-005 |
| **Medium** | 4 | SEC-T5-006 through SEC-T5-009 |
| **Medium** | 2 | SEC-T5-010, SEC-T5-011 |
| **Low** | 3 | SEC-T5-012 through SEC-T5-014 |
| **Info** | 1 | SEC-T5-015 |
| **Total** | **15** | |

---

## Routes Without Zod Validation on req.body

These mutation routes bypass `validate()` or pass raw `req.body` to the service. The routes using `validate()` middleware are generally safe; those that don't are flagged:

| Route | File | Risk |
|---|---|---|
| `PATCH /companies/:companyId/agents/:id/permissions` | agents.ts:936 | `updateAgentPermissionsSchema` via `validate()` ✓ but `svc.updatePermissions(id, req.body)` passes req.body which is `result.data` after middleware — review schema strictness |
| `POST /companies/:companyId/agents/:id/api-keys` | agents.ts:1325 | only `.name` extracted — partial validation only |
| `POST /companies/:companyId/a2a/mcp-connectors` | a2a.ts:495 | `validate()` chained ✓ |
| `PUT /companies/:companyId/a2a/mcp-connectors/:id` | a2a.ts:579 | `validate()` chained ✓ |
| `POST /companies/:companyId/import/jira/connect` | jira-import.ts | SSRF risk (SEC-T5-002) |
| `POST /governed-workflows/import-plugin` | governed-workflows-ui.ts | SSRF risk (SEC-T5-014) |
| `POST /companies/:companyId/folders` (DELETE) | folders.ts:190 | `preserveDocumentIds` array from req.body — no length limit |

**Routes confirmed without any body validation (no `validate()` and no inline safeParse):**
- `DELETE /companies/:companyId/folders/:id` — `req.body?.preserveDocumentIds` extracted directly
- `PATCH /companies/:companyId/issues/:id` — uses `validate(updateIssueSchema)` ✓ but then destructures `req.body` directly after

---

## Routes Without Rate Limiting (Beyond Global 500/min)

All routes share the single global 500 req/min per-actor rate limiter. No per-route stricter limits exist for:

| Route | Why It Needs Its Own Limit |
|---|---|
| `POST /companies/:companyId/governed-workflows/:name/ai/chat` | Anthropic API call (~$0.01+ each) |
| `POST /companies/:companyId/documents/:id/summarize` | `claude -p` subprocess |
| `POST /companies/:companyId/user-widgets/generate` | LLM call + subprocess fallback |
| `POST /companies/:companyId/import/jira/connect` | Outbound HTTP + potential SSRF |
| `POST /companies/:companyId/import/jira/preview` | Outbound HTTP + N parallel requests |
| `POST /invites/:token/accept` | Auth endpoint — no dedicated limit |
| `POST /board-claim/:token/claim` | Auth endpoint — no dedicated limit |
| `GET /api/auth/get-session` | Unauthenticated path with DB query |

---

## Routes With File Upload (Validation Status)

| Route | MIME Allowlist | Size Limit | Magic Byte Check | Filename Sanitize |
|---|---|---|---|---|
| `POST /companies/:companyId/assets/images` | ✓ (image/* only) | 10 MB | ✗ | ✗ (SEC-T5-008) |
| `POST /companies/:companyId/issues/:issueId/attachments` | ✓ (image/* only) | 10 MB | ✗ | ✗ (SEC-T5-008) |
| `POST /companies/:companyId/documents/upload` | **✗ (any MIME)** | 50 MB | ✗ | ✗ (SEC-T5-007, SEC-T5-008) |
| `POST /companies/:companyId/folders/:id/upload` | **✗ (any MIME)** | 50 MB | ✗ | ✗ (SEC-T5-007, SEC-T5-008) |

---

## Top 5 Risks

1. **SEC-T5-002 (HIGH)** — SSRF via Jira `baseUrl` and invite resolution probe: any company admin can exfiltrate EC2 instance metadata or probe internal services.

2. **SEC-T5-005 (HIGH)** — `trust proxy` not configured: IP-based rate limiting and audit logging are unreliable in any reverse-proxy / load-balanced deployment.

3. **SEC-T5-004 (HIGH)** — Rate limiter in-memory fallback silently activates on Redis failure; multi-instance deployments are effectively unprotected per-IP; no dedicated limits on LLM endpoints.

4. **SEC-T5-007 (MEDIUM)** — Document/folder uploads accept any MIME type including HTML, SVG (XSS vector), executables; 50 MB size limit is generous.

5. **SEC-T5-013 (LOW → effective HIGH in production)** — Deployment proxy auth check is broken: `hasSession = !!(req as any).actor` is always truthy because Express sets `req.actor` to a non-null object even for unauthenticated requests. All deployment previews are publicly accessible.

---

## Error Verbosity State

| Error Path | Verbosity | Verdict |
|---|---|---|
| `500 Internal Server Error` (generic) | Opaque `{ error: "Internal server error" }` | ✓ Safe |
| `HttpError` (developer-constructed) | `{ error: message, details: details }` | Acceptable — but `details` needs audit |
| `ZodError` (validation) | Full error object with field paths and enum values | Medium risk — consider stripping in prod |
| Stack traces | Stored in `res.__errorContext`, NOT sent to client | ✓ Safe |
| DB errors via Drizzle | Wrapped in 500, message not forwarded | ✓ Safe |
| Health endpoint | PG version + topology in unauthenticated response | Medium risk (SEC-T5-009) |

---

## Positive Findings (Strengths)

The following areas are well-implemented and should be preserved:

- **Path traversal in local storage**: `resolveWithin()` in `local-disk-provider.ts` correctly uses `path.resolve` + prefix check. Solid.
- **Workflow file path validation**: `validateWorkflowRelativePath()` uses a strict allowlist `[A-Za-z0-9._-]` per segment, rejects `..`, backslash, empty segments. Excellent.
- **PostgreSQL RLS cleanup**: `tenantContextMiddleware` registers `res.on('close')` for cleanup, preventing tenant context leaks on pooled connections.
- **Content-Disposition on asset serving**: `inline` for assets, `attachment` for documents — correct.
- **Agent API key hashing**: SHA-256 hash stored, not plaintext.
- **Constant-time token comparison**: Not yet applied (see SEC-T5-013), but auth tokens are hash-compared via DB lookup.
- **Zod on most mutation bodies**: The majority of POST/PATCH/PUT routes use `validate()` with Zod schemas.
- **MCP OAuth rate limits**: Dedicated per-endpoint limits (5-20 req/min) for OAuth flows.
