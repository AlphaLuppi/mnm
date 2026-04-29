# T2 — Multi-Tenant Isolation Audit Summary
**Date**: 2026-04-29  
**Scope**: Multi-tenant isolation (middleware, RLS, routes, WebSocket, MCP, deployment proxy)  
**Methodology**: Full whitebox code review — middleware chain, route handlers, DB schema, migration files  

---

## Finding Count by Severity

| Severity | Count | IDs |
|---|---|---|
| Critical | 2 | SEC-T2-001, SEC-T2-003 |
| High | 5 | SEC-T2-002, SEC-T2-004, SEC-T2-005, SEC-T2-006, SEC-T2-007, SEC-T2-008 |
| Medium | 3 | SEC-T2-009, SEC-T2-010, SEC-T2-011, SEC-T2-012 |
| Low | 2 | SEC-T2-013, SEC-T2-014 |
| **Total** | **14** | |

---

## Top 5 Risks (Priority Order)

### 1. SEC-T2-001 — CRITICAL: 9 tenant-scoped tables lack RLS
**The most structurally dangerous finding.** Tables added after migration 0030 were never given RLS policies. This includes `routines`, `routine_triggers`, `routine_runs`, `feedback_votes`, `folder_shares`, `view_presets`, `user_widgets`, `inbox_items`, and `oauth_refresh_tokens`.

Without RLS, the defense-in-depth guarantee is broken. If any application-layer check fails (bug, race, future refactor), cross-company data is directly exposed. The `oauth_refresh_tokens` table is especially sensitive.

**Fix**: New migration adding `ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY + RESTRICTIVE tenant_isolation policy` for all 9 tables.

---

### 2. SEC-T2-003 — CRITICAL: Deployment proxy IDOR — any authenticated user can access any company's deployment
**Immediate exploitable.** The `/preview/:deploymentId/*` middleware only checks `!!(req as any).actor` — any logged-in user can proxy to any company's live deployment. The `companyId` field is fetched from the DB but never validated against the actor's company membership.

**Fix**: Check `actorCompanyIds.includes(info.companyId)` before proxying.

---

### 3. SEC-T2-004 — HIGH: Session-scoped RLS context + connection pool = potential cross-tenant leak
**Architectural risk.** The `tenantContextMiddleware` sets `app.current_company_id` with `is_local=false` (session scope) and clears it asynchronously on `res.close`. Under concurrent load, a race window exists where the cleanup from Request A fires on the connection being used by Request B, clearing B's RLS context mid-query.

**Fix**: Use `is_local=true` (transaction scope) inside explicit transactions, OR add defensive explicit `WHERE company_id = $x` to all tenant-sensitive queries.

---

### 4. SEC-T2-007 — HIGH: oauth_clients table is instance-global (no company_id) — OAuth clients span all tenants
**Design gap.** The `oauth_clients` table has no `company_id`, making OAuth client registrations visible to all companies. Combined with missing RLS on `oauth_refresh_tokens` (SEC-T2-001), the OAuth subsystem has no database-level tenant isolation.

**Fix**: Add `company_id` to `oauth_clients`, add RLS to both OAuth tables.

---

### 5. SEC-T2-006 — HIGH: Agent routes check agent.companyId not req.params.companyId — path/auth mismatch for multi-company users
**IDOR precursor.** Handlers fetch agent by ID, then validate against `agent.companyId` instead of `req.params.companyId`. For multi-company users, this means the path company and the validation company can diverge silently. The RLS layer currently saves this, but the design is fragile.

**Fix**: Add `agent.companyId !== req.params.companyId → 404` check before access validation.

---

## Tables Without RLS (Full List)

| Table | Migration | company_id? | RLS? |
|---|---|---|---|
| `routines` | 0055_routines.sql | YES | **NO** |
| `routine_triggers` | 0055_routines.sql | YES | **NO** |
| `routine_runs` | 0055_routines.sql | YES | **NO** |
| `feedback_votes` | 0056_feedback_votes.sql | YES | **NO** |
| `folder_shares` | 0056_folder_workspace.sql | YES | **NO** |
| `view_presets` | 0057_view_presets.sql | YES | **NO** |
| `user_widgets` | 0058_blocks_foundation.sql | YES | **NO** |
| `inbox_items` | 0059_inbox_items.sql | YES | **NO** |
| `agent_permissions` | 0062_agent_permissions.sql | **NO** | **NO** |
| `oauth_refresh_tokens` | 0063_oauth_tables.sql | YES | **NO** |
| `oauth_clients` | 0063_oauth_tables.sql | **NO** | **NO** |
| `role_permissions` | 0049 (migration comment says "FK chain") | **NO** | **NO** |

**Tables with non-standard RLS (permissive instead of RESTRICTIVE)**:
| Table | Migration | Issue |
|---|---|---|
| `user_pods` | 0048 | Not RESTRICTIVE, text comparison |
| `artifact_deployments` | 0048 | Not RESTRICTIVE, text comparison |

**Tables with special RLS (information risk)**:
| Table | Migration | Issue |
|---|---|---|
| `invites` | 0030 | `OR company_id IS NULL` clause exposes global invites to all tenants |

---

## Routes Without Company Middleware Detected

All routes examined use the `/companies/:companyId/` prefix and go through the three middleware (`assertCompanyMembership` → `tenantContextMiddleware` → `tagScopeMiddleware`). No route was found mounted outside of `/companies/:companyId/` that accesses tenant data via the `api` Router.

**Exceptions (by design but flagged):**
- `/llms/*` — mounted on `app` before `api` router, bypasses rate limiter and company middleware (SEC-T2-013)
- `/preview/:deploymentId/*` — mounted outside `/api`, no company membership check (SEC-T2-003)
- `/ws/chat/:channelId` — WS upgrade, bypasses HTTP middleware entirely
- `/api/companies/:companyId/events/ws` — WS upgrade, bypasses HTTP middleware (SEC-T2-005)

---

## Middleware Chain Verification

The middleware chain in `app.ts` is correctly ordered:

```
actorMiddleware (app level)
  └── api Router
       ├── apiRateLimiter
       ├── boardMutationGuard
       ├── api.use("/companies/:companyId", assertCompanyMembership())   ← verifies membership
       ├── api.use("/companies/:companyId", tenantContextMiddleware(db))  ← sets RLS context
       ├── api.use("/companies/:companyId", tagScopeMiddleware(db))       ← sets tag scope
       └── [all route handlers]
```

Order is correct. No routes found to be mounted BEFORE the company middleware chain within the `api` Router.

**Caveat**: WebSocket upgrades bypass this chain entirely and implement their own auth in `authorizeUpgrade`.

---

## Key Structural Observations

1. **Defense-in-depth gap**: The application layer (assertCompanyAccess, assertCompanyMembership) is strong. The DB layer (RLS) is incomplete for 12 tables added since 2024. The system relies more heavily on application-layer guards than intended.

2. **RLS context mechanism is inherently racy** with connection pools. The current implementation is functionally correct for sequential requests but has a theoretical race under high concurrency. This should be addressed architecturally.

3. **Multi-company users are a weak point**: Several patterns assume single-company actors. Multi-company board users (instance admins) can trigger subtle bugs in routes that check `agent.companyId` vs `req.params.companyId`.

4. **WebSocket auth is re-implemented** in each WS handler. This is a code duplication risk — the live-events WS and chat WS both have their own auth code that diverges from the HTTP auth middleware.

5. **local_trusted mode completely bypasses isolation** (SEC-T2-008). This is documented but the risk of misconfiguration in production has no safeguard.
