# Next Session — Roles + Tags + Enterprise

> **Last session** : 2026-03-23 | **Context** : Roles+Tags enterprise system ~95% done
> **Start here** : Read this file, then CLAUDE.md, then the review reports

---

## What's Working

- Dynamic roles + tags + permissions (full CRUD + admin UI)
- **Tag-based isolation enforced** on GET /agents, issues, traces
- **Tag selector** in agent creation AND edit (inline add/remove)
- Agents run in user's Docker sandbox via `docker exec`
- Agents inherit permissions from their creator
- Simplified API routes (`/api/issues` works without companyId prefix)
- CAO agent with rich prompt template, auto-creation, auto-tagging, **membership row**
- **bootstrapCompany() transactional** (all-or-nothing)
- Issue title/description injected into agent prompts
- Onboarding wizard (5 steps: Company, Roles, Tags, Invite, Done)
- Deployment/preview system (nginx serves agent-created files)
- Permission editor with checkbox grid in AdminRoles
- **Company rail hidden** in single-tenant mode
- **Task Pool UI** — "All Issues" / "Pool" tabs, "Take" self-assign action
- **N+1 queries fixed** in roles + tags list endpoints

---

## DONE This Session (2026-03-23, batch 2)

| # | Item | Commit |
|---|------|--------|
| 1 | P0: Tag filtering on GET /agents | ea11717 |
| 2 | P0: bootstrapCompany() transaction | ea11717 |
| 3 | P0: companyId in PATCH/DELETE role WHERE | ea11717 |
| 4 | P0: UUID validation in run-actor-resolver | ea11717 |
| 5 | P0: CAO stale comment fixed | ea11717 |
| 6 | P1: TENANT-03 — CompanyRail hidden | 4d92b85 |
| 7 | P1: AGENT-TAGS-UI — Tag selector (create) | 4d92b85 |
| 8 | P2: N+1 queries (roles + tags) | 4d92b85 |
| 9 | P1: Tag management in agent edit | 7b095f3 |
| 10 | P1: UI-05 Task Pool (tabs + Take) | e655ea4 |
| 11 | Arch: Tags list assertCompanyAccess | e655ea4 |
| 12 | Arch: CAO membership row | e655ea4 |
| 13 | P2: Stale E2E tests skipped | b7c1488 |

---

## Remaining Work

### P1 — Features

1. **ISO-04** (5 SP) — E2E tests for tag isolation
   - Create fixtures with 2 users, different tags
   - Verify User-A can't see User-B's agents/issues
   - Verify Admin sees everything
   - Needs running server + seed data

### P2 — Tech Debt

2. **membershipRole legacy removal** — Remove writes to membershipRole column
   - `server/src/services/access.ts` ensureMembership() still writes "member"/"owner"
   - Multiple callers depend on the parameter — needs broader migration
   - Low risk (column is unused by new RBAC system)

3. **CAO identified by JSONB scan** (arch finding #5)
   - Full table scan + in-memory filter on metadata.isCAO
   - Fix: Cache CAO ID after first lookup, or use is_system column

4. **In-process cache breaks multi-instance** (review finding #7)
   - Module-level Map caches in access.ts — single-instance only
   - Fix: Document constraint or use Redis

5. **Hardcoded permission slugs in OnboardingWizard** (review finding #8)
   - `PRESET_ROLES` duplicates seed slugs — will diverge if slugs change
   - Fix: Fetch from API or move presets to server-side

### P1 — Deferred Features

6. **CAO-03** (5 SP) — Watchdog mode (event hooks, anomaly detection)
7. **CAO-04** (5 SP) — Interactive @cao (chat integration)
8. **UI-04** (3 SP) — Onboarding wizard tag step polish

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/src/services/access.ts` | Permission engine (hasPermission, canUser, cache) |
| `server/src/middleware/tag-scope.ts` | TagScope middleware |
| `server/src/services/tag-filter.ts` | Tag isolation queries |
| `server/src/services/cao.ts` | CAO agent + bootstrapCompany (transactional) |
| `server/src/routes/roles.ts` | Roles CRUD API |
| `server/src/routes/tags.ts` | Tags CRUD + assignments API |
| `server/src/routes/issues.ts` | Issues + pool filter + "me" substitution |
| `server/src/services/agents.ts` | Agent CRUD + tagIds in create/update |
| `ui/src/pages/Issues.tsx` | Issues page with Pool tab |
| `ui/src/pages/NewAgent.tsx` | Agent creation with tag selector |
| `ui/src/pages/AgentDetail.tsx` | Agent edit with tag management |

## Review Reports

- `_bmad-output/planning-artifacts/REVIEW-CODE-roles-tags-2026-03-23.md` — 9 findings (7 fixed)
- `_bmad-output/planning-artifacts/REVIEW-ARCHITECT-roles-tags-2026-03-23.md` — 11 findings (8 fixed)
- `_bmad-output/planning-artifacts/STATUS-roles-tags-2026-03-23.md` — Full status report
