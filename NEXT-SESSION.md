# Next Session — Roles + Tags + Enterprise

> **Last session** : 2026-03-23 | **Context** : Roles+Tags enterprise system 100% done (132/132 SP)
> **Start here** : Read this file, then CLAUDE.md, then the status report

---

## What's Working

Everything from previous sessions PLUS:
- **Tag-based isolation enforced** on GET /agents, issues, traces
- **Tag selector** in agent creation AND edit (inline add/remove)
- **Task Pool UI** — "All Issues" / "Pool" tabs, "Take" self-assign
- **CAO Watchdog** — monitors agent run failures/timeouts, auto-comments on issues
- **Interactive @CAO** — @mention in comments wakes CAO with full context + reply
- **E2E tests** for tag isolation (ISO-04: 8 tests)
- **bootstrapCompany() transactional** + CAO gets membership row
- **Company rail hidden** in single-tenant mode
- **N+1 queries fixed** in roles + tags list endpoints
- All 5 P0 security fixes applied
- Stale E2E tests handled (RBAC-S03, ONB-S02, PROJ-S02)

---

## Remaining Work

### All P1 Stories DONE

### P2 — Tech Debt

2. **UI-04** (3 SP) — Onboarding wizard tag step polish (already functional, just UX)
3. **membershipRole** (3 SP) — Remove legacy writes in access.ts
4. **CACHE-REDIS** (3 SP) — In-process permission cache → document or Redis
5. **PRESET-SLUGS** (2 SP) — Hardcoded permission slugs in OnboardingWizard
6. **BOARD-RENAME** (8 SP) — Rename "board" actor type to "user"
7. **AGENT-INSTRUCTIONS** (3 SP) — Agent instructions file support in Docker
8. **SANDBOX-AUTH-PERSIST** (3 SP) — Auto-copy claude credentials to new containers

### Trace Pipeline (from CLAUDE.md)

- **REAL-RUN** — Launch real agent run with rich tool calls for varied traces
- **BACKFILL** — Gold backfill timeout after 20 traces (batch + retry)
- **PIPE-07** — UI Gold prompts management (settings page)
- **PIPE-08** — Workflow-level gold (aggregate multi-agent traces)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/src/services/cao-watchdog.ts` | CAO watchdog (event listener, auto-comment) |
| `server/src/services/cao.ts` | CAO agent + bootstrapCompany (transactional) |
| `server/src/services/access.ts` | Permission engine (hasPermission, canUser, cache) |
| `server/src/middleware/tag-scope.ts` | TagScope middleware |
| `server/src/services/tag-filter.ts` | Tag isolation queries |
| `server/src/routes/issues.ts` | Issues + pool filter + "me" substitution |
| `server/src/services/agents.ts` | Agent CRUD + tagIds in create/update |
| `ui/src/pages/Issues.tsx` | Issues page with Pool tab |
| `ui/src/pages/NewAgent.tsx` | Agent creation with tag selector |
| `ui/src/pages/AgentDetail.tsx` | Agent edit with tag management |
| `e2e/tests/ISO-04.spec.ts` | E2E tests for tag isolation |

## Reports

- `_bmad-output/planning-artifacts/STATUS-roles-tags-2026-03-23.md` — Full status (132/132 SP)
- `_bmad-output/planning-artifacts/REVIEW-CODE-roles-tags-2026-03-23.md` — 9 findings (7 fixed)
- `_bmad-output/planning-artifacts/REVIEW-ARCHITECT-roles-tags-2026-03-23.md` — 11 findings (9 fixed)
