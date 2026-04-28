# Code Review -- Roles + Tags System
> **Date** : 2026-03-23 | **Reviewer** : Code Reviewer Agent | **Scope** : 20 key files

## Summary: 3 Critical, 6 Important

---

## Critical

### 1. `hasPermission` resourceScope is dead code (access.ts:194)
`resourceScope` parameter always returns `true`. The tag check comment says "done at query level via TagScope". The parameter misleads callers into thinking scope enforcement happens here.
**Fix:** Remove `resourceScope` from the signature entirely, or implement actual tag intersection.

### 2. TagScope middleware runs before route rewriting (app.ts:107)
`tagScopeMiddleware` fires before the API router's path-rewrite middleware. For simplified API calls (`/api/issues`), `req.params.companyId` may not be set yet. Mitigated in single-tenant by `tenantContextMiddleware` auto-inject.
**Fix:** Verify tenant middleware covers all cases, or move route-rewrite to app-level.

### 3. Agent list endpoint ignores tag isolation (routes/agents.ts:455)
`GET /companies/:companyId/agents` returns ALL agents without tag filtering. `tagFilterService.listAgentsFiltered()` exists but is never called from any route.
**Fix:** Use `tagFilterService.listAgentsFiltered(companyId, req.tagScope)` for non-bypass users.

---

## Important

### 4. N+1 queries in roles/tags list (routes/roles.ts:28, tags.ts:38)
One permission query per role, one COUNT per tag. Will degrade with scale.
**Fix:** Single joined query + in-memory grouping.

### 5. bootstrapCompany not transactional (cao.ts:151)
5 sequential writes without db.transaction(). Partial bootstrap on crash.
**Fix:** Wrap in `db.transaction()`.

### 6. PATCH/DELETE role missing companyId in WHERE (roles.ts:182)
Update/delete by roleId only. RLS backstop exists but defense-in-depth missing.
**Fix:** Add `eq(roles.companyId, companyId)` to write WHERE clauses.

### 7. In-process cache breaks in multi-instance (access.ts:35)
Module-level Map caches. Single-instance only. Document constraint or use Redis.

### 8. Hardcoded permission slugs in onboarding presets (OnboardingWizard.tsx:41)
`PRESET_ROLES` duplicates seed slugs. Will silently diverge if slugs change.
**Fix:** Fetch from API or move presets to server-side.

### 9. Unvalidated issueId from context (run-actor-resolver.ts:44)
String from `contextSnapshot` passed to UUID column without validation.
**Fix:** Add `isUuidLike()` check.
