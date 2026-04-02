# CLAUDE.md

## Project Overview

**MnM** is an enterprise B2B supervision cockpit for AI agent orchestration, multi-tenant workforce management, and compliance audit.
Fork of Paperclip, transformed into a multi-tenant B2B platform (pivot mars 2026).
Stack: React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo bun workspaces.
Language: French for planning documents.

## Critical Rules

- **NEVER use polling (setInterval, refetchInterval)** — ALL real-time updates MUST use SSE (Server-Sent Events) or WebSocket. The app has a live-events system (`/events/ws`). If data needs to refresh, subscribe to the relevant event channel.
- **Single-tenant** — 1 instance = 1 company. `company_id` is auto-injected, never exposed in UI.
- **Dynamic RBAC** — Roles and permissions are in DB (tables `roles`, `permissions`, `role_permissions`), NOT hardcoded. No `BUSINESS_ROLES`, `AGENT_ROLES`, or `PERMISSION_KEYS` constants.
- **Tag-based isolation** — Tags control visibility. Users only see agents/issues/traces that share at least 1 tag with them. Enforced via `TagScope` middleware.
- **Sandbox** — Each user has a personal Docker container. All agents run via `claude_local` adapter in the user's sandbox. No adapter choice needed.
- **CAO** — Chief Agent Officer (adapter_type="claude_local", metadata.isCAO=true) is auto-created, has all tags, Admin role. Runs in admin's sandbox. Watchdog mode auto-comments on failures. Interactive via @cao mentions.
- **Agent permissions** — Agents inherit permissions from their creator (createdByUserId). An agent in Tom's sandbox has Tom's permissions.
- **Simplified API** — Routes work with or without `/companies/:companyId/` prefix. Middleware rewrites `/api/issues` to `/api/companies/:companyId/issues` automatically.
- **Docker exec** — `runChildProcess` in adapter-utils supports `dockerContainerId` option. When set, commands run via `docker exec` instead of local spawn. Env vars with localhost URLs are rewritten to `host.docker.internal`.

## What's Implemented

- **69 B2B stories** (TECH/RBAC/MU/ORCH/PROJ/OBS/CHAT/CONT/A2A/COMP/DUAL/SSO/DASH/ONB/DRIFT)
- **35 Roles/Tags stories** (all P1 complete, 132/132 SP) — see `_bmad-output/planning-artifacts/sprint-planning-roles-tags-2026-03-22.md`
- **Trace Pipeline**: Bronze→Silver→Gold (PIPE-01 to PIPE-08 done, BACKFILL fixed, workflow-level gold)
- **CAO System**: Auto-creation, watchdog (auto-comments on failures), interactive (@cao mentions)
- **Task Pool**: Pool tab on issues, "Take" self-assign, assigneeTagId support
- **Tag management**: Tag selector in agent creation + edit, tag isolation on all list endpoints
- **Config Layers System**: 8 DB tables, 22+ API routes, 6 backend services, 10+ frontend components
  - Layer CRUD with scope (company/shared/private), visibility (public/team/private), enforced mode
  - Item types: MCP Servers, Skills, Hooks, Settings — each with dedicated editor
  - Priority-based merge: Company enforced (999) > Base layer (500) > Additional (0-498)
  - Conflict detection with advisory locks at attachment time
  - OAuth2 PKCE flow for MCP credentials (AES-256-GCM encrypted)
  - Runtime merge engine integrated in heartbeat (dual-path with legacy fallback)
  - Tag-based visibility + ownership checks on all routes
  - Revision history with snapshots on every change
  - Frontend: Admin page (/admin/config-layers), Agent "Layers" tab, merge preview panel

## What Remains

| Item | Type | Description |
|------|------|-------------|
| **REAL-RUN** | Trace | Lancer un vrai agent run avec tool calls riches pour avoir des traces variées |
| **Supply chain analysis** | Config Layers | LLM sandbox for external URL/git sources (skeleton exists, not implemented) |
| **Workflow stage layer attachment** | Config Layers | DB tables exist, routes not yet implemented |
| **OAuth token refresh** | Config Layers | Background job skeleton exists, actual refresh not implemented |

All P1, P2, and tech debt items are complete (including SANDBOX-AUTH, PRESET-SLUGS, and CONFIG-LAYERS). REAL-RUN requires running server + agent execution.

### Architecture Decisions (Sandbox Auth)

- **Token injection via env var** — `claude setup-token` generates a 1-year independent token, stored in `user_pods.claude_oauth_token` (DB column, migration 0051)
- **Per-run injection** — Heartbeat fetches token from DB, passes `CLAUDE_CODE_OAUTH_TOKEN` as env var via `docker exec`. No credentials stored on sandbox filesystem.
- **No more credential copy** — `copyClaudeCredentials` (host `.credentials.json` copy) is removed. OAuth access tokens expire in ~5h and get invalidated on host CLI refresh, so DB-stored setup-token is the only reliable approach.
- **UI flows** — Onboarding wizard step 5 "Connect Claude" (skippable) + Settings "Claude" tab for connection status / update / disconnect
- **Workspace page deprecated** — Removed from sidebar and router. Auth is now handled entirely through token setup, not console-based `claude login`.

### Architecture Decisions (Trace Pipeline)

- **Gold** = DEFAULT view. Intelligent timeline, phases scored, annotated, contextualized
- **Silver** = expand for detail. Grouped observations with summaries
- **Bronze** = raw JSON blocks. Debug only.
- Gold is AUTO-GENERATED at trace completion (not manual click)
- Gold prompt is HIERARCHICAL: global → workflow → agent → issue context
- Traces are a MIDDLEWARE on top of all adapters (heartbeat.ts:onLog), NOT inside adapters
- For LLM enrichment: `claude -p --model haiku` which reuses existing Claude Code auth

### Architecture Decisions (Config Layers)

- **Tout-en-layers** — adapterConfig JSONB replaced by structured config layers. All agent config (model, cwd, env, MCP, skills, hooks) lives in layers.
- **Priority merge** — Company enforced (999, virtual) > Agent base layer (500) > Additional layers (0-498). DISTINCT ON + ORDER BY priority DESC.
- **Base layer auto-creation** — Migration 0054 creates a base layer per agent from existing adapterConfig. New agents get base layer at creation.
- **Dual-path heartbeat** — If agent has base_layer_id, resolveConfigForRun() merges layers. Otherwise legacy adapterConfig path. Zero-downtime migration.
- **Advisory locks** — pg_advisory_xact_lock serializes concurrent layer attachments to prevent TOCTOU race conditions.
- **Config layer revisions** — Every mutation creates a revision with after_snapshot + changed_keys. No before_snapshot (derivable from previous revision).
- **Tag-based layer visibility** — private=creator only, team=shared tags, public=all users, company=all. Derived from creator's tags (same pattern as agents).
- **OAuth popup** — window.open() + postMessage pattern keeps user in context. No redirect flow.

## Repository Structure

- `server/src/` — Express backend (routes/, services/, middleware/, realtime/, auth/)
- `ui/src/` — React frontend (pages/, components/, hooks/, api/)
- `packages/db/src/` — Drizzle ORM schema, migrations (50+ tables, multi-tenant)
- `packages/shared/` — Shared types (B2B domain models)
- `packages/adapters/` — Agent adapters (claude-local, cursor-local, etc.)
- `e2e/` — Playwright E2E tests (60+ tests in Docker authenticated mode)
- `_bmad/` — BMAD framework. Do NOT modify.
- `_bmad-output/` — Planning artifacts, brainstorming, reviews, stories
- `server/src/services/config-layer*.ts` — Config layer services (CRUD, conflict, runtime)
- `server/src/services/mcp-credential.ts` — MCP credential storage with AES-256-GCM
- `server/src/services/mcp-oauth.ts` — OAuth2 PKCE flow
- `server/src/routes/config-layers.ts` — All config layer API routes
- `ui/src/components/config-layers/` — Layer editors, agent tab, merge preview

## Dev Commands

```bash
bun install         # Install all dependencies
bun run dev         # Start dev (server + ui, embedded postgres)
bun run build       # Build all packages
bun run typecheck   # TypeScript check (13/13 packages pass)
bun run test:e2e    # Run Playwright E2E tests
```

## Docker (Authenticated Mode)

```bash
docker compose build server                    # Rebuild with latest code
docker compose up -d --wait                    # Start server + DB + Redis
# Server on http://127.0.0.1:3100 (authenticated mode, 48 RLS tables)
```

## Planning Documents

- `_bmad-output/planning-artifacts/sprint-planning-roles-tags-2026-03-22.md` — Sprint tracking (135 SP, all done)
- `_bmad-output/planning-artifacts/epics-b2b.md` — 16 Epics, ~69 Stories (all done)
- `_bmad-output/planning-artifacts/epics-scale-trace.md` — SCALE + TRACE Epics (20 stories)
- `_bmad-output/planning-artifacts/tech-spec-bronze-silver-gold-2026-03-18.md` — Trace pipeline tech spec
