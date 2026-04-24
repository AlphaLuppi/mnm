# CLAUDE.md

MnM — Enterprise B2B supervision cockpit for AI agent orchestration.
Stack: React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo bun workspaces.
Language: French for planning documents. See README.md for full project docs.

## Governed Workflows UI — Status: landed 2026-04-24 — pending Tom's morning review.

- All 6 tranches shipped (U1 nuke legacy, U2 REST, U3 live events, U4 UI API, U5 4 pages + routes + parity, U6 MCP tools).
- Completion report: `docs/superpowers/plans/2026-04-24-governed-workflows-ui.md` (end of file).
- Progress log: `docs/superpowers/plans/progress-2026-04-24-governed-workflows-ui.md`
- Remove this block after sign-off.

## Critical Rules

- **NEVER use polling (setInterval, refetchInterval)** — ALL real-time updates MUST use SSE/WebSocket via the live-events system (`/events/ws`).
- **Always use UI library components** — Never create custom/inline implementations of standard UI primitives (Switch, Button, Dialog, Checkbox, etc.). Always use `ui/src/components/ui/`. If a component doesn't exist, create it there first.
- **Multi-tenant** — 1 backend serves N companies. ALL company-scoped routes MUST have `/companies/:companyId/` prefix. No auto-injection, no URL rewrite. `company_id` is explicit in every API call, verified by `assertCompanyMembership` middleware, and enforced by PostgreSQL RLS (fail-closed).
- **Dynamic RBAC** — Roles and permissions are in DB (`roles`, `permissions`, `role_permissions`), NOT hardcoded. No `BUSINESS_ROLES`, `AGENT_ROLES`, or `PERMISSION_KEYS` constants.
- **Tag-based isolation** — Tags control visibility within a company. Users only see agents/issues/traces sharing at least 1 tag. Enforced via `TagScope` middleware (mounted on `api.use("/companies/:companyId", ...)` — NOT at app level).
- **Agent permissions** — Agents inherit permissions from their creator (createdByUserId).
- **Client-side compute** — Agent execution happens on the user's machine (MCP, Desktop, local CLI). The server is an API/data/orchestration layer. Docker sandboxes are optional for non-tech users.
- **Deployment modes** — `local_trusted` (dev, zero auth, single company auto-created) or `authenticated` (prod, BetterAuth + OAuth 2.1, multi-company).
- **`_bmad/`** — BMAD framework. Do NOT modify.

## Architecture Decisions

### Multi-Tenant Middleware Chain
- **Order**: `actorMiddleware` (app level) → `api` Router → `assertCompanyMembership` → `tenantContextMiddleware` → `tagScopeMiddleware` → route handlers.
- ALL three company middlewares are mounted on `api.use("/companies/:companyId", ...)` so Express parses the param BEFORE they run. NEVER mount at app level.
- `assertCompanyMembership` verifies the actor belongs to the company in the path. Board users check `actor.companyIds`, agents check `actor.companyId`. Validates UUID format. Fail-closed for unknown actor types.
- `tenantContextMiddleware` sets PostgreSQL RLS context (`app.current_company_id`) from `req.params.companyId`. Does NOT inject into params.
- The URL rewrite middleware is REMOVED. All company-scoped routes have explicit `/companies/:companyId/` prefix.
- Rate limiting is per-tenant: key = `{companyId}:{actorId}`.

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
- Watchdog mode auto-comments on failures. Interactive via @cao mentions.

## Web/Desktop Parity Tracking

MnM ships as both a web app (`@mnm/ui`) and a Tauri desktop app (`apps/desktop`). To keep visibility on what's live where, we maintain a **typed parity tracker** at `scripts/parity/data.ts`.

**You MUST update `scripts/parity/data.ts` whenever you:**
- Add a new user-facing feature (page, panel, significant component, IPC command, or desktop-native capability)
- Change the status of an existing feature on either platform (e.g. verify it in a packaged DMG, fix a blocker, add desktop polish)
- Discover a new cross-platform gap or blocker

**How to update:**
1. Find the relevant domain in `scripts/parity/data.ts` (`auth`, `agents`, `traces`, `desktop-native`, etc.) or add a new one.
2. Add/edit the `Feature` entry with `web` and `desktop` `PlatformState` objects. Status values: `done | dev-only | partial | missing | n/a`.
3. For features that need work, fill the `todo` object (`code`, `config`, `tests`, `notes`) so remaining work is explicit.
4. If a blocker is shared across features, reference an existing key from `sharedBlockers` rather than repeating the description.
5. Run `bun run parity` to verify the report renders cleanly, and `bun run parity --missing` to see the updated gap list.

**Parity commands:**
```bash
bun run parity                   # Full report
bun run parity --missing         # Features done on web but not on desktop
bun run parity --todo            # Features with open todo items
bun run parity --domain=agents   # Filter to one domain
bun run parity --json            # Raw JSON (for tooling)
```

**Rule of thumb:** any PR touching `ui/src/pages/`, `ui/src/components/`, `apps/desktop/src-tauri/`, or adding a new IPC command **should also touch `scripts/parity/data.ts`**. If you genuinely don't need to, mention it in the PR body so reviewers know it was considered.

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **mnm** (8752 symbols, 21008 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/mnm/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/mnm/context` | Codebase overview, check index freshness |
| `gitnexus://repo/mnm/clusters` | All functional areas |
| `gitnexus://repo/mnm/processes` | All execution flows |
| `gitnexus://repo/mnm/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
