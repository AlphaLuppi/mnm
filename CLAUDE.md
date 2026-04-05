# CLAUDE.md

MnM — Enterprise B2B supervision cockpit for AI agent orchestration.
Stack: React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo bun workspaces.
Language: French for planning documents. See README.md for full project docs.

## Critical Rules

- **NEVER use polling (setInterval, refetchInterval)** — ALL real-time updates MUST use SSE/WebSocket via the live-events system (`/events/ws`).
- **Always use UI library components** — Never create custom/inline implementations of standard UI primitives (Switch, Button, Dialog, Checkbox, etc.). Always use `ui/src/components/ui/`. If a component doesn't exist, create it there first.
- **Single-tenant** — 1 instance = 1 company. `company_id` is auto-injected, never exposed in UI.
- **Dynamic RBAC** — Roles and permissions are in DB (`roles`, `permissions`, `role_permissions`), NOT hardcoded. No `BUSINESS_ROLES`, `AGENT_ROLES`, or `PERMISSION_KEYS` constants.
- **Tag-based isolation** — Tags control visibility. Users only see agents/issues/traces sharing at least 1 tag. Enforced via `TagScope` middleware.
- **Sandbox** — Each user has a personal Docker container. All agents run via `claude_local` adapter. No adapter choice needed.
- **Agent permissions** — Agents inherit permissions from their creator (createdByUserId).
- **Simplified API** — Routes work with or without `/companies/:companyId/` prefix. Middleware rewrites automatically.
- **Docker exec** — `runChildProcess` supports `dockerContainerId` option. Env vars with localhost URLs are rewritten to `host.docker.internal`.
- **`_bmad/`** — BMAD framework. Do NOT modify.

## Architecture Decisions

### Sandbox Auth
- Token injection via env var — `claude setup-token` → stored in `user_pods.claude_oauth_token` (migration 0051)
- Per-run injection — Heartbeat passes `CLAUDE_CODE_OAUTH_TOKEN` via `docker exec`. No credentials on sandbox filesystem.
- `copyClaudeCredentials` is removed. DB-stored setup-token is the only approach.

### Trace Pipeline
- **Gold** = DEFAULT view (scored phases, annotations, verdicts). **Silver** = grouped detail. **Bronze** = raw JSON debug.
- Gold is AUTO-GENERATED at trace completion, not manual click.
- Gold prompt is HIERARCHICAL: global → workflow → agent → issue context.
- Traces are MIDDLEWARE on top of adapters (heartbeat.ts:onLog), NOT inside adapters.
- LLM enrichment: `claude -p --model haiku`.

### Config Layers
- adapterConfig JSONB replaced by structured config layers. All agent config lives in layers.
- Priority merge: Company enforced (999) > Base layer (500) > Additional (0-498).
- Base layer auto-created per agent (migration 0054). Dual-path heartbeat for zero-downtime migration.
- Advisory locks (`pg_advisory_xact_lock`) serialize concurrent layer attachments.
- Tag-based visibility: private=creator only, team=shared tags, public=all, company=all.

### CAO (Chief Agent Officer)
- adapter_type="claude_local", metadata.isCAO=true, auto-created, has all tags, Admin role.
- Runs in admin's sandbox. Watchdog mode auto-comments on failures. Interactive via @cao mentions.

## Git Rules

- **Always atomic commit + push** — Every commit must be immediately pushed. Never leave unpushed commits.
- GPG signing often times out. If `git commit` fails with `gpg: signing failed: Timeout`, retry with `-c commit.gpgsign=false`.

## Dev Commands

```bash
bun install         # Install all dependencies
bun run dev         # Start dev (server + ui, embedded postgres)
bun run build       # Build all packages
bun run typecheck   # TypeScript check (13/13 packages pass)
bun run test:e2e    # Run Playwright E2E tests
```
