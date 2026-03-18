# CLAUDE.md

## Project Overview

**MnM** is an enterprise B2B supervision cockpit for AI agent orchestration, multi-tenant workforce management, and compliance audit.
Fork of Paperclip, transformed into a multi-tenant B2B platform (pivot mars 2026).
Stack: React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo bun workspaces.
Language: French for planning documents.

## B2B Context (as of 2026-03)

- **Multi-Tenant**: RLS PostgreSQL, per-company isolation, per-project scoping
- **RBAC**: 4 business roles (admin/manager/contributor/viewer), 20 permission keys
- **Orchestration**: Deterministic workflows with state machine (XState), HITL validation
- **Observability**: Immutable audit trail, LLM summaries, k-anonymity dashboards
- **Security**: Container isolation (Docker), credential proxy, mount allowlist
- **69 B2B stories implemented** (TECH/RBAC/MU/ORCH/PROJ/OBS/CHAT/CONT/A2A/COMP/DUAL/SSO/DASH/ONB/DRIFT)
- **Trace Vision**: Prompt-driven personalized trace analysis (Epic TRACE, 13 stories)

## Autonomous Execution Pipeline V2 (2026-03-17)

### How to Resume After Compaction

1. Read THIS FILE first (CLAUDE.md)
2. Read `_bmad-output/planning-artifacts/EXECUTION-TRACKER-V2.md` for current phase + next step
3. Execute the next PENDING step in the tracker
4. Update tracker status (PENDING → DONE)
5. Commit atomically after each step
6. Continue to next step

### Pipeline Phases

```
PHASE 1 — BUN MIGRATION + BUILD FIX
├── STEP-1.1: Migrate pnpm → bun (package.json, scripts, lockfile, CI)
├── STEP-1.2: Fix TypeScript typecheck errors
├── STEP-1.3: Fix linter issues
└── STEP-1.4: Verify build + dev server boots

PHASE 2 — UI/UX DESIGN REVIEW
├── STEP-2.1: Design audit report (review ALL pages/components)
└── STEP-2.2: Implement design fixes from audit report

PHASE 3 — E2E TEST INFRASTRUCTURE
├── STEP-3.1: QA Architecture (seed system, cleanup, test strategy)
├── STEP-3.2: Global setup (DB seed, auth fixtures, cleanup hooks)
├── STEP-3.3: Implement E2E tests — Auth + Members + RBAC flows
├── STEP-3.4: Implement E2E tests — Orchestration + Workflow flows
├── STEP-3.5: Implement E2E tests — Chat + Container + Agents flows
├── STEP-3.6: Implement E2E tests — Dashboard + Audit + SSO flows
├── STEP-3.7: Implement E2E tests — Onboarding + Settings + Drift flows
└── STEP-3.8: Full E2E run with video capture verification

PHASE 4 — TRACE VISION IMPLEMENTATION
├── STEP-4.1: TRACE-01 Schema (traces + observations tables)
├── STEP-4.2: TRACE-02 Trace Service (CRUD + aggregation)
├── STEP-4.3: TRACE-03 API Routes
├── STEP-4.4: TRACE-07 Schema Lenses (analysis prompts per user)
├── STEP-4.5: TRACE-04 Adapter Instrumentation (claude-local)
├── STEP-4.6: TRACE-06 LiveEvents Trace Streaming
├── STEP-4.7: TRACE-08 Lens Analysis Engine (LLM-powered)
├── STEP-4.8: TRACE-11 Sub-Agent Trace Linking
├── STEP-4.9: TRACE-09 UI — Trace Page + Lens Selector
├── STEP-4.10: TRACE-10 UI — Lens Management + Context Pane
├── STEP-4.11: TRACE-12 Workflow Story View (multi-agent timeline)
├── STEP-4.12: TRACE-13 Live Multi-Agent Dashboard
└── STEP-4.13: E2E tests for Trace Vision features
```

### Status Tracking

See `_bmad-output/planning-artifacts/EXECUTION-TRACKER-V2.md` for real-time status.

## Key Documents

- `_bmad-output/planning-artifacts/prd-b2b.md` — Product Requirements (52 FRs)
- `_bmad-output/planning-artifacts/architecture-b2b.md` — Architecture (8 ADRs)
- `_bmad-output/planning-artifacts/epics-b2b.md` — 16 Epics, ~69 Stories
- `_bmad-output/planning-artifacts/epics-scale-trace.md` — SCALE + TRACE Epics (20 stories)
- `_bmad-output/planning-artifacts/EXECUTION-TRACKER-V2.md` — Current pipeline tracker
- `_bmad-output/brainstorming/brainstorming-trace-summarization-2026-03-16.md` — Trace design brainstorm
- `_bmad-output/brainstorming/brainstorming-langfuse-tracing-2026-03-16.md` — Langfuse analysis

## Repository Structure

- `server/src/` — Express backend (routes/, services/, middleware/, realtime/, auth/)
- `ui/src/` — React frontend (pages/, components/, hooks/, api/)
- `packages/db/src/` — Drizzle ORM schema, migrations (50 tables, multi-tenant)
- `packages/shared/` — Shared types (B2B domain models)
- `packages/adapters/` — Agent adapters (claude-local, cursor-local, etc.)
- `e2e/` — Playwright E2E tests (real functional tests with video capture)
- `_bmad/` — BMAD framework. Do NOT modify.
- `_bmad-output/` — Planning artifacts (B2B docs), brainstorming, stories
- `_research/` — Technical research (orchestration patterns, Nanoclaw, OpenClaw)

## Dev Commands

```bash
bun install         # Install all dependencies
bun run dev         # Start dev (server + ui)
bun run build       # Build all packages
bun run test        # Run vitest unit tests
bun run test:run    # Run vitest once
bun run typecheck   # TypeScript check all packages
bun run db:generate # Generate Drizzle migrations
bun run db:migrate  # Run migrations
bun run test:e2e    # Run Playwright E2E tests (real browser, video capture)
bun run test:e2e:report  # View E2E test report
```

## E2E Test System

### Architecture
- **Framework**: Playwright with video capture on every test
- **Seed Data**: `e2e/global-setup.ts` injects realistic demo data into PostgreSQL before tests
- **Cleanup**: `e2e/global-teardown.ts` cleans up test data after all tests complete
- **Fixtures**: `e2e/fixtures/` provides authenticated page objects per role (admin, manager, contributor, viewer)
- **Test Structure**: `e2e/tests/` organized by feature domain (auth/, members/, rbac/, orchestration/, etc.)

### Running E2E Tests

#### Option A: Against Docker (authenticated mode — recommended for full coverage)
```bash
docker compose -f docker-compose.dev.yml build            # Rebuild with latest code
docker compose -f docker-compose.dev.yml up -d --wait     # Start server + DB + Redis
bun run test:e2e                                           # 59 tests pass, auth + RBAC included
bun run test:e2e:report                                    # View HTML report with videos
```

#### Option B: Against local dev server (local_trusted — faster, no auth)
```bash
bun run dev                                                # Start embedded postgres dev server
bun run test:e2e                                           # 50 tests pass, auth tests skip
bun run test:e2e:report                                    # View HTML report
```

#### Notes
- Video capture (.webm) works for auth/signout tests. Other tests use storageState which doesn't produce separate videos.
- Screenshots are captured for ALL tests (122 screenshots in authenticated mode).
- After Docker rebuild, migration 0045_trace_vision.sql auto-applies on first start.

### Writing New E2E Tests
When implementing new features, ALWAYS add E2E tests that:
1. Use the seed data from `e2e/fixtures/seed-data.ts`
2. Test the full user flow (not just check code structure)
3. Cover happy path + error cases + RBAC enforcement
4. Use `data-testid` attributes for selectors
5. Video capture is automatic (configured in playwright.config.ts)

## Trace Vision — Product Vision

MnM's trace system is NOT a Langfuse clone. It's a **prompt-driven trace analysis** system.

1. Raw traces stored (every tool call, result)
2. Each user writes a prompt describing what they care about (or picks from suggestions)
3. LLM analyzes raw traces through user's personal lens
4. Two users, same trace = different analyses
5. Prompts saved per agent/workflow, auto-apply to new traces

This is MnM's core differentiator. Full spec in `epics-scale-trace.md`.
