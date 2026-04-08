# MCP Server Foundation — Progress Tracker

**Started:** 2026-04-08
**Design Spec:** `2026-04-08-mcp-server-design.md`
**Implementation Plan:** `2026-04-08-mcp-server-foundation.md`

---

## Phase Overview

| Phase | Team | Status | Description |
|-------|------|--------|-------------|
| 1 | `mcp-architects` | ✅ Done | Architecture review & UX/DX analysis |
| 2 | `mcp-planning` | ✅ Done | Epic breakdown & sprint planning |
| 3 | `mcp-builders` | ✅ Done | Implementation (18 tasks) |
| 4 | `mcp-reviewers` | ✅ Done | Design, bugs, archi, security, PO review |
| 5 | `mcp-fixers` | ✅ Done | Fix findings from phase 4 |
| 6 | `mcp-qa` | ✅ Done | Build verification + Functional QA — ALL PASS |

---

## Phase 2 — All Tools & Resources

| Step | Status | Description |
|------|--------|-------------|
| Build (4 agents) | ✅ Done | 68 tools + 10 resources across 14 domains |
| Review+Fix | ✅ Done | 4 bugs fixed: services wiring, admin/roles, invite stub, sandbox guard |
| Final QA | ✅ Done | Typecheck 0 errors, 68 tools + 10 resources verified |

### Phase 2 Commits
| Commit | Description |
|--------|-------------|
| `124bc9b` | feat(mcp): config-layers, workflows, traces tools + resources |
| `4417894` | feat(mcp): sandbox, users, admin, a2a tools |
| `69cb54a` | feat(mcp): chat, documents, folders, artifacts tools + resources |
| `8c910fd` | feat(mcp): complete agents, issues, projects tools + agents, nodes resources |
| `1e83601` | fix(mcp): review fixes — services wiring, admin/roles, invite stub, sandbox guard |

---

## Implementation Tasks (Plan Tasks 1-18)

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Install MCP SDK dependency | ✅ Done | `9844516` |
| 2 | Typed permission contracts | ✅ Done | `84351b2` |
| 3 | Migrate permission-seed.ts to contracts | ✅ Done | `a10fe9b` |
| 4 | Type requirePermission middleware | ✅ Done | `5252149` |
| 5 | Harden agent JWT (TTL, jti, fail-fast) | ✅ Done | `8be1384` |
| 6 | Bump DB pool max | ✅ Done | `6e3f1aa` |
| 7 | MCP registry types and interfaces | ✅ Done | `8fca16e` |
| 8 | defineMcpTools factory | ✅ Done | `638f09d` |
| 9 | Tool registry | ✅ Done | `b37f54d` |
| 10 | Resource registry | ✅ Done | `35bf22c` |
| 11 | Example tools (issues + agents + context) | ✅ Done | `85a65da` |
| 12 | Example resources (projects + issues) | ✅ Done | `6c30b47` |
| 13 | OAuth 2.1 store | ✅ Done | `cf83ac4` |
| 14 | MCP token verifier | ✅ Done | `8e9f8f4` |
| 15 | OAuth 2.1 router + consent screen | ✅ Done | `db9bd39` |
| 16 | MCP session manager | ✅ Done | `157424c` |
| 17 | MCP Express mount point | ✅ Done | `b238b16` |
| 18 | End-to-end smoke test | ✅ Done (QA) | Phase 6 |

---

## Findings & Blockers Log

### Phase 1 — Architecture Review (COMPLETED)

**Architect findings (0 blockers, 4 risks):**
- ⚠️ Services need tagScope passthrough (services don't accept tagScope param — MCP tools must adapt)
- ⚠️ Mount MCP routes BEFORE SPA fallback in app.ts, skip express.json() on MCP routes
- ⚠️ 91 permission slugs (not 77) — plan code is correct, narrative wrong
- ⚠️ iss/aud JWT change breaks in-flight tokens → accept old+new values during transition
- ✅ Express 5.1 + StreamableHTTPServerTransport fully compatible
- ✅ DB pool 20→40 safe (PG default max_connections=100)
- ✅ No OAuth route conflicts (plan routes at /oauth/*, existing at /api/oauth/*)

**UX/DX findings (overall 4.1/5):**
- OAuth consent: add scope descriptions, client name, admin warning badge
- McpErrorPayload: add `details` for validation errors, `retryAfterMs` for rate limiting
- OAuth store: move DCR clients + refresh tokens to PostgreSQL (survive restarts)
- Tool naming: `manage_*` inconsistent with granular CRUD pattern (document or split)
- Resource URIs: document hyphen convention, note coverage gaps
- Developer onboarding (defineMcpTools pattern): 5/5 — excellent, no changes
- Add real-client smoke testing (Claude Code, Cursor) to plan

---

## Git Commit History

| Time | Commit | Description |
|------|--------|-------------|
| Pre-flight | `9844516` | chore: add @modelcontextprotocol/sdk dependency |
| Pre-flight | `84351b2` | feat: add typed permission contracts (PermissionSlug, MCP_SCOPES) |
| Pre-flight | `6e3f1aa` | chore: bump DB pool max 20→40 |
| Pre-flight | `8fca16e` | feat: MCP registry types and error contracts |
| Lane A | `a10fe9b` | refactor: permission-seed imports from typed contracts |
| Lane A | `5252149` | refactor: all requirePermission calls use typed PERMISSIONS constants |
| Lane B | `8be1384` | fix(security): harden agent JWT |
| Lane C | `85a65da` | feat: example MCP tools |
| Lane B | `cf83ac4` | feat: in-memory OAuth store |
| Lane B | `8e9f8f4` | feat: dual MCP token verifier |
| Lane C | `6c30b47` | feat: example MCP resources |
| Lane C | `157424c` | feat: MCP session manager |
| Lane B | `db9bd39` | feat: OAuth 2.1 AS router + consent screen |
| Lane A | `638f09d` | feat: defineMcpTools factory |
| Lane A | `b37f54d` | feat: ToolRegistry |
| Lane A | `35bf22c` | feat: ResourceRegistry |
| Integration | `b238b16` | feat: MCP server mount point |
| Fixes | `cc1d7a8` | fix: critical bugs (sessionId, Zod schemas, resource leak, dedup) |
| Fixes | `12c6df0` | fix(security): CSRF, redirect URI validation, timing-safe PKCE, session auth |
| Fixes | `564aef2` | refactor: unify McpActor type, extract shared auth config, wrap resources |

---

## Session Recovery Instructions

If this session crashes, to resume:
1. Read this file to understand current progress
2. Check `git log --oneline -20` for last commits
3. Check which tasks are marked ✅ above
4. Resume from the next ⬜ task
5. Re-create the appropriate team for the current phase
