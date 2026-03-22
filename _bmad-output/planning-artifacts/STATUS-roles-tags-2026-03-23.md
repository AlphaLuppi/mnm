# Status Report — Roles + Tags + Enterprise System
> **Date** : 2026-03-23 | **Total commits** : ~25 | **0 TS errors**

## Completed (108/132 SP + bonus fixes)

### Sprint 1 — Schema + Tenant (25/25 SP) DONE
- [x] SCHEMA-01..05 : 5 nouvelles tables, nuke legacy, migration SQL
- [x] TENANT-01 : Auto-inject companyId middleware
- [x] TENANT-02 : Route rewriting (agents can call /api/issues directly)

### Sprint 2 — Permission Engine (24/24 SP) DONE
- [x] PERM-01..05 : hasPermission rewrite, TagScope, cache, validation, seed
- [x] API-01 : Roles CRUD
- [x] API-04 : Permissions + Member Role CRUD

### Sprint 3 — Tags + Isolation (23/28 SP) DONE
- [x] API-02 : Tags CRUD
- [x] API-03 : Tag Assignments
- [x] ISO-01..03 : Tag filtering service (agents, issues, traces)
- [ ] ISO-04 : Tests E2E isolation (deferred — needs running server + seed)

### Sprint 4 — Agents + UI (27/27 SP) DONE
- [x] AGENT-01..04 : Agent tags, sandbox routing, resolveRunActor
- [x] UI-01..03 : Admin pages (Roles, Tags, Members)

### Sprint 5 — CAO (5/15 SP) PARTIAL
- [x] CAO-01 : Agent auto-creation + bootstrap
- [x] CAO-02 : Auto-tagging hook
- [ ] CAO-03 : Watchdog mode (deferred — needs event hooks)
- [ ] CAO-04 : Interactive @cao (deferred — needs chat integration)

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

## Remaining Work

### P0 — Blocking / Critical
| Story | Description | Effort |
|-------|-------------|--------|
| **TENANT-03** | Remove company selector UI (sidebar) | 2 SP |
| **ISO-04** | E2E tests for tag isolation | 5 SP |

### P1 — Important
| Story | Description | Effort |
|-------|-------------|--------|
| **UI-04** | Onboarding wizard — tag step needs polish | 3 SP |
| **UI-05** | Task Pool UI (assign issue by tag, pool view) | 5 SP |
| **CAO-03** | Watchdog mode (event hooks, anomaly detection) | 5 SP |
| **CAO-04** | Interactive @cao (chat integration) | 5 SP |
| **AGENT-TAGS-UI** | Agent creation dialog — tag selector | 3 SP |

### P2 — Nice to Have
| Story | Description | Effort |
|-------|-------------|--------|
| **BOARD-RENAME** | Rename "board" actor type to "user" | 8 SP |
| **CEO-CLEANUP** | Remove remaining CEO references in codebase | 3 SP |
| **AGENT-INSTRUCTIONS** | Agent instructions file support in Docker | 3 SP |
| **SANDBOX-AUTH-PERSIST** | Auto-copy claude credentials to new containers | 3 SP |

## Known Issues
1. Agent runs still show stderr "Using fallback workspace" from heartbeat (cosmetic, non-blocking)
2. Claude auth in container needs manual setup after container recreation
3. Some old UI components still reference legacy role patterns (stub'd, not broken)
