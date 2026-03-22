# Architecture Review -- Roles + Tags System
> **Date** : 2026-03-23 | **Reviewer** : Architecture Agent | **Scope** : Full system alignment check

## Summary: 3 High, 4 Medium, 4 Low

---

## HIGH -- Must fix before production

### 1. CAO adapter type contradiction (cao.ts)
`CAO_ADAPTER_TYPE = "claude_local"` but comment says `"system"` and architecture doc says `"system"`.
**Decision needed**: CAO runs in user sandbox (current) or in-process (architecture spec)?
Tom confirmed: CAO runs in sandbox. Comment is stale. Architecture doc outdated on this point.
**Fix**: Remove stale comment in cao.ts. Update architecture doc section 8.2.

### 2. CAO has no company_memberships row
bootstrapCompany() creates the CAO agent but never creates a company_memberships row with the Admin role_id. hasPermission() for the CAO returns false for all checks.
**Mitigated by**: agent permission inheritance (falls back to creatorUserId). CAO's creator is the admin user who has the Admin role. So CAO effectively has admin permissions via inheritance.
**Fix**: Still should create a membership row for the CAO for consistency.

### 3. Stale E2E tests reference removed artifacts
RBAC-S03 expects BUSINESS_ROLES. TECH-05 expects principal_permission_grants. ONB-S02 expects role-hierarchy.ts. PROJ-S02 expects syncUserProjectScope.
**Fix**: Update or skip these E2E tests.

---

## MEDIUM -- Should fix before going live

### 4. membershipRole legacy column still written
ensureMembership() writes "member"/"owner" to membershipRole. Column should be removed.
**Fix**: Remove writes to membershipRole in access.ts.

### 5. CAO identified by JSONB field scan
Full table scan + in-memory filter on metadata.isCAO. No index possible on JSONB.
**Fix**: Cache CAO ID after first lookup, or use a column-level identifier.

### 6. hasPermission() resourceScope was dead code
FIXED in latest commit (ddeb7a8). Parameter removed entirely.

### 7. Tags list endpoint has no read guard
GET /companies/:companyId/tags has no requirePermission. Any member can list all tags.
**Fix**: Add requirePermission(db, "tags:manage") or a lighter "tags:read" permission.

---

## LOW -- Technical debt

### 8. ROUTE_GUARD_SLUGS manually maintained
permission-validator.ts has a static set. Architecture envisioned auto-generation.

### 9. resolveRunActor returns null instead of throwing
Architecture says throw. Implementation silently falls back to local execution.

### 10. agents table has no is_system column
CAO cannot be delete-protected at DB level.

### 11. onTagCreated hook only wired in tags route
Tags created by other paths (seed, migration) don't auto-assign to CAO.

---

## Alignment Score

| Area | Architecture Match | Notes |
|------|-------------------|-------|
| Data model | 95% | membershipRole residue, no is_system on agents |
| Permission resolution | 90% | resourceScope fixed, cache correct |
| Tag isolation | 100% | TagScope + tagFilterService correct |
| Sandbox routing | 95% | null fallback instead of throw |
| CAO | 70% | adapter type mismatch, no membership row, JSONB scan |
| API design | 90% | routes correct, tags missing read guard |
| Agent permissions | 100% | inheritance via creatorUserId correct |
| Single-tenant | 100% | auto-inject + rewriting correct |

**Overall: ~92% alignment with architecture spec**
