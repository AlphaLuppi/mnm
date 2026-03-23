# Status Report — Roles + Tags + Enterprise System
> **Date** : 2026-03-23 (updated batch 2) | **Total commits** : ~33 | **0 TS errors**

## Completed (132/132 SP + bonus fixes)

### Sprint 1 — Schema + Tenant (25/25 SP) DONE
- [x] SCHEMA-01..05 : 5 nouvelles tables, nuke legacy, migration SQL
- [x] TENANT-01 : Auto-inject companyId middleware
- [x] TENANT-02 : Route rewriting (agents can call /api/issues directly)
- [x] TENANT-03 : Company rail hidden in single-tenant mode *(batch 2)*

### Sprint 2 — Permission Engine (24/24 SP) DONE
- [x] PERM-01..05 : hasPermission rewrite, TagScope, cache, validation, seed
- [x] API-01 : Roles CRUD
- [x] API-04 : Permissions + Member Role CRUD

### Sprint 3 — Tags + Isolation (28/28 SP) DONE
- [x] API-02 : Tags CRUD
- [x] API-03 : Tag Assignments
- [x] ISO-01..03 : Tag filtering service (agents, issues, traces)
- [x] ISO-04 : E2E tests for tag isolation (8 tests: setup, isolation, cleanup) *(batch 2)*

### Sprint 4 — Agents + UI (30/30 SP) DONE
- [x] AGENT-01..04 : Agent tags, sandbox routing, resolveRunActor
- [x] UI-01..03 : Admin pages (Roles, Tags, Members)
- [x] AGENT-TAGS-UI : Tag selector in agent creation + edit dialog *(batch 2)*

### Sprint 5 — CAO (15/15 SP) DONE
- [x] CAO-01 : Agent auto-creation + bootstrap (transactional, with membership row)
- [x] CAO-02 : Auto-tagging hook
- [x] CAO-03 : Watchdog mode — monitors run failures, auto-comments on issues *(batch 2)*
- [x] CAO-04 : Interactive @cao — mention wakeup + context injection *(batch 2)*

### Sprint 6 — Task Pool (5/5 SP) DONE *(batch 2)*
- [x] UI-05 : Task Pool UI (All Issues / Pool tabs, "Take" self-assign, pool filter backend)

### Bonus Fixes (not in original sprints)
- [x] Onboarding wizard rewrite (5 steps, roles+tags presets)
- [x] CEO→CAO rename across codebase
- [x] Sandbox routing (docker exec in adapter-utils)
- [x] localhost→host.docker.internal rewrite for Docker env vars
- [x] Issue title+description injected into agent prompt context
- [x] Default prompt template includes task info
- [x] Agent permission inheritance (agents use creator's permissions)
- [x] TENANT-02 route rewriting (simplified API URLs)
- [x] UTF-8 encoding fix for embedded PostgreSQL
- [x] Stale container cleanup + auto-provision after onboarding
- [x] CAO prompt template (knows its role, platform, API)
- [x] Permission editor in AdminRoles (checkbox grid)
- [x] Permission presets in onboarding (Startup/Structured)

### Security & Architecture Fixes *(batch 2)*
- [x] P0: Tag filtering enforced on GET /agents (tagFilterService)
- [x] P0: bootstrapCompany() wrapped in db.transaction()
- [x] P0: PATCH/DELETE role adds companyId in WHERE (defense-in-depth)
- [x] P0: UUID validation on issueId in run-actor-resolver
- [x] P0: CAO stale comment fixed (claude_local, not system)
- [x] N+1 queries fixed in roles + tags list endpoints
- [x] Tags list endpoint: assertCompanyAccess guard added
- [x] CAO membership row created in bootstrapCompany
- [x] Stale E2E tests skipped (RBAC-S03, ONB-S02, PROJ-S02 Group 1)
- [x] assigneeTagId added to shared Issue type
- [x] "me" substitution in PATCH /issues/:id for self-assign

## Remaining Work

### P2 — Nice to Have / Tech Debt
| Story | Description | Effort |
|-------|-------------|--------|
| **UI-04** | Onboarding wizard — tag step polish (already functional) | 3 SP |
| **membershipRole** | Remove legacy membershipRole writes in access.ts | 3 SP |
| **CAO-CACHE** | Cache CAO ID lookup (avoid JSONB scan) — partially done in watchdog | 2 SP |
| **CACHE-REDIS** | In-process permission cache → document single-instance or use Redis | 3 SP |
| **PRESET-SLUGS** | Hardcoded permission slugs in OnboardingWizard → fetch from API | 2 SP |
| **BOARD-RENAME** | Rename "board" actor type to "user" | 8 SP |
| **AGENT-INSTRUCTIONS** | Agent instructions file support in Docker | 3 SP |
| **SANDBOX-AUTH-PERSIST** | Auto-copy claude credentials to new containers | 3 SP |

## Known Issues
1. Agent runs still show stderr "Using fallback workspace" from heartbeat (cosmetic, non-blocking)
2. Claude auth in container needs manual setup after container recreation
3. Some old UI components still reference legacy role patterns (stub'd, not broken)

## Session 2 Commits (2026-03-23, batch 2)

| Commit | Description |
|--------|-------------|
| ea11717 | fix: 5 P0 security findings — tag isolation, transaction, defense-in-depth |
| 4d92b85 | feat: TENANT-03 + AGENT-TAGS-UI + N+1 queries |
| 7b095f3 | feat: tag management in agent edit |
| e655ea4 | feat: UI-05 Task Pool + arch fixes |
| b7c1488 | fix: skip stale E2E tests |
| f247739 | docs: NEXT-SESSION.md updated |
| 201f670 | test: ISO-04 — E2E tests tag isolation |
| 2aa0c38 | feat: CAO-03 — Watchdog mode |
| 41bb68c | feat: CAO-04 — Interactive @cao via mentions |
