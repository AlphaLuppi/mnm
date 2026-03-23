# Next Session — Roles + Tags Continuation

> **Last session** : 2026-03-23 | **Context** : Roles+Tags enterprise system 82% done
> **Start here** : Read this file, then CLAUDE.md, then the review reports

---

## What's Working

- Dynamic roles + tags + permissions (full CRUD + admin UI)
- Agents run in user's Docker sandbox via `docker exec`
- Agents inherit permissions from their creator
- Simplified API routes (`/api/issues` works without companyId prefix)
- CAO agent with rich prompt template, auto-creation, auto-tagging
- Issue title/description injected into agent prompts
- Onboarding wizard (5 steps: Company, Roles, Tags, Invite, Done)
- Deployment/preview system (nginx serves agent-created files)
- Permission editor with checkbox grid in AdminRoles
- Tag-based isolation service (agents, issues, traces)

---

## Priority Fixes (from code + architecture reviews)

### P0 — Security (do these first)

1. **Tag filtering on GET /agents** (review finding #3)
   - File: `server/src/routes/agents.ts` line ~455
   - Problem: `GET /companies/:companyId/agents` returns ALL agents without tag filtering
   - Fix: Use `tagFilterService(db).listAgentsFiltered(companyId, req.tagScope)` for non-bypass users
   - Same pattern needed for GET issues and GET traces routes

2. **bootstrapCompany() not transactional** (arch finding #5)
   - File: `server/src/services/cao.ts` line ~151
   - Problem: 5 sequential writes without db.transaction(). Partial bootstrap on crash.
   - Fix: Wrap in `db.transaction(async (tx) => { ... })`

3. **PATCH/DELETE role missing companyId in WHERE** (review finding #6)
   - File: `server/src/routes/roles.ts` lines 182, 246
   - Problem: UPDATE/DELETE only filter by roleId, not companyId. RLS backstop exists but defense-in-depth missing.
   - Fix: Add `eq(roles.companyId, companyId)` to write WHERE clauses

4. **Validate issueId UUID in run-actor-resolver** (review finding #9)
   - File: `server/src/services/run-actor-resolver.ts` line 44
   - Fix: Add `isUuidLike(issueId)` check before DB query

### P1 — Features

5. **TENANT-03** (2 SP) — Remove company selector from sidebar
   - File: `ui/src/components/Sidebar.tsx` or `CompanyRail.tsx`
   - Just hide/remove the company switcher UI element

6. **AGENT-TAGS-UI** (3 SP) — Tag selector in agent creation dialog
   - File: `ui/src/pages/NewAgent.tsx`
   - Add multi-select tag picker, pre-select creator's tags
   - Agent creation already accepts `tagIds` in the API

7. **UI-05** (5 SP) — Task Pool UI
   - Issue assignment by tag (`assignee_tag_id`)
   - Pool view: filter issues without direct assignee
   - "Take" action: self-assign from pool
   - Backend already supports this via `tag-filter.ts`

8. **ISO-04** (5 SP) — E2E tests for tag isolation
   - Create fixtures with 2 users, different tags
   - Verify User-A can't see User-B's agents/issues
   - Verify Admin sees everything

### P2 — Tech Debt

9. **N+1 queries in roles/tags list** (review finding #4)
   - `server/src/routes/roles.ts` line 28 — one query per role for permissions
   - Fix: single joined query + in-memory grouping

10. **Stale E2E tests** (arch finding #3)
    - RBAC-S03, TECH-05, ONB-S02, PROJ-S02 reference removed artifacts
    - Need to update or skip these tests

11. **CAO stale comment** (arch finding #1)
    - `server/src/services/cao.ts` line 67 says "adapter_type system" but it's actually `claude_local`
    - Just fix the comment

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/src/services/access.ts` | Permission engine (hasPermission, canUser, cache) |
| `server/src/middleware/tag-scope.ts` | TagScope middleware |
| `server/src/services/tag-filter.ts` | Tag isolation queries |
| `server/src/services/cao.ts` | CAO agent + bootstrapCompany |
| `server/src/routes/roles.ts` | Roles CRUD API |
| `server/src/routes/tags.ts` | Tags CRUD + assignments API |
| `server/src/routes/permissions.ts` | Permissions CRUD + member role |
| `packages/adapter-utils/src/server-utils.ts` | runChildProcess + docker exec |
| `packages/adapters/claude-local/src/server/execute.ts` | Claude adapter with Docker support |
| `server/src/services/heartbeat.ts` | Agent run orchestration + sandbox routing |

## Review Reports

- `_bmad-output/planning-artifacts/REVIEW-CODE-roles-tags-2026-03-23.md` — 9 findings
- `_bmad-output/planning-artifacts/REVIEW-ARCHITECT-roles-tags-2026-03-23.md` — 11 findings, 92% alignment
- `_bmad-output/planning-artifacts/STATUS-roles-tags-2026-03-23.md` — Full status report
