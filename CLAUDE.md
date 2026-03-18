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
- **Trace Vision**: Bronze→Silver→Gold trace pipeline (PIPE-01 to PIPE-06 done)

## CURRENT STATE — Bronze→Silver→Gold Pipeline (2026-03-18)

### What's DONE (verified with Chrome screenshots)

| Step | Status | What |
|------|--------|------|
| PIPE-01 | DONE | Bronze capture in heartbeat.ts:onLog — 2000+ real observations from real agent runs |
| PIPE-02 | DONE | Silver enrichment — deterministic phase detection (COMPREHENSION/IMPLEMENTATION/VERIFICATION...) |
| PIPE-03 | DONE | Gold schema — traces.gold JSONB + gold_prompts table + CRUD API + default prompt seeded |
| PIPE-04 | DONE | Gold engine — deterministic fallback + `claude -p --model haiku` fallback (no API key needed) |
| PIPE-05 | DONE | UI Gold timeline — TraceDetail with Gold→Silver→Bronze drill-down (accordion style) |
| PIPE-06 | DONE | Gold in RunDetail — agent run panel shows trace gold phases |

### What REMAINS — Next Session TODO

| Step | Description | Priority |
|------|-------------|----------|
| **REFACTOR-UI** | Refaire l'UI timeline style Langfuse (barres horizontales, séquentiel/parallélisme, PAS des accordéons) | P0 |
| **REAL-RUN** | Lancer un VRAI agent run via MnM Docker avec tool calls riches (Read, Edit, Bash) sur un projet temp | P0 |
| **HAIKU-GOLD** | Tester le gold avec Haiku via `claude -p` sur des données riches (pas "deterministic-fallback") | P0 |
| PIPE-07 | UI Gold prompts management (settings page pour configurer prompts par scope) | P1 |
| PIPE-08 | Workflow-level gold (agréger traces multi-agent) | P1 |
| PIPE-09 | QC final bout-en-bout avec screenshots Chrome | P1 |

### How to Resume

1. Read THIS FILE
2. Read `_bmad-output/planning-artifacts/tech-spec-bronze-silver-gold-2026-03-18.md` for full tech spec v2
3. Read the 3 review reports in `_bmad-output/planning-artifacts/REVIEW-*.md` for known issues
4. Check memory files for user feedback/vision (especially `feedback_gold_hierarchical_auto.md`)
5. Start with REFACTOR-UI or REAL-RUN depending on priorities

### Critical Architecture Decisions

**Bronze→Silver→Gold vision (user-confirmed):**
- **Gold** = DEFAULT view the user sees. Intelligent timeline, phases scored, annotated, contextualized
- **Silver** = expand for more detail. Still retravaillé, not raw. Grouped observations with summaries
- **Bronze** = expand further for raw JSON blocks. Debug only.
- Gold is AUTO-GENERATED at trace completion (not manual click)
- Gold prompt is HIERARCHICAL: global → workflow → agent → issue context
- Traces are a MIDDLEWARE on top of all adapters (heartbeat.ts:onLog), NOT inside adapters
- For LLM enrichment (silver naming + gold analysis): use `claude -p --model haiku` which reuses existing Claude Code auth. Works in Docker too since admin is logged in as MnM user.

**UI direction (user feedback):**
- Current accordion/dropdown UI is NOT acceptable
- Need Langfuse-style timeline: horizontal bars, sequential/parallel visibility, proportional durations
- Look at https://langfuse.com for inspiration
- The timeline should show multi-agent workflows as parallel lanes

### Key Files for Trace Pipeline

```
server/src/services/bronze-trace-capture.ts    — Bronze capture middleware (hooks into onLog)
server/src/services/silver-trace-enrichment.ts — Silver phase detection (deterministic)
server/src/services/gold-trace-enrichment.ts   — Gold enrichment (claude -p Haiku + fallback)
server/src/services/trace-service.ts           — Trace CRUD + aggregation
server/src/services/lens-analysis.ts           — Legacy lens analysis (may be replaced by gold)
server/src/services/heartbeat.ts               — WHERE bronze hooks in (onLog callback ~line 1257)
server/src/routes/traces.ts                    — API routes for traces, lenses, gold prompts
packages/db/src/schema/traces.ts               — DB schema (traces, observations, lenses, gold_prompts)
packages/db/src/migrations/0045_trace_vision.sql      — Initial trace tables
packages/db/src/migrations/0046_trace_vision_fixes.sql — RLS + schema alignment fixes
packages/db/src/migrations/0047_gold_prompts.sql       — Gold prompts table + traces.gold column
ui/src/pages/Traces.tsx                        — Trace list page
ui/src/pages/TraceDetail.tsx                   — Trace detail (Gold→Silver→Bronze drill-down)
ui/src/components/traces/GoldVerdictBanner.tsx  — Gold verdict banner component
ui/src/components/traces/GoldPhaseCard.tsx      — Gold phase card component
```

## Key Documents

- `_bmad-output/planning-artifacts/tech-spec-bronze-silver-gold-2026-03-18.md` — Tech spec v2 (Gold=default, hierarchical prompts, 9 stories)
- `_bmad-output/planning-artifacts/REVIEW-ARCHITECT-trace-pipeline.md` — Architecture review (6/10, RLS fix applied)
- `_bmad-output/planning-artifacts/REVIEW-ADVERSARIAL-trace-pipeline.md` — Adversarial review (4 critical, all fixed)
- `_bmad-output/planning-artifacts/REVIEW-QA-trace-pipeline.md` — QA review (60+ AC enriched)
- `_bmad-output/planning-artifacts/epics-b2b.md` — 16 Epics, ~69 Stories (all done)
- `_bmad-output/planning-artifacts/epics-scale-trace.md` — TRACE Epics (13 stories)
- `_bmad-output/planning-artifacts/UI-UX-AUDIT-REPORT.md` — UI audit (7.2/10)

## Repository Structure

- `server/src/` — Express backend (routes/, services/, middleware/, realtime/, auth/)
- `ui/src/` — React frontend (pages/, components/, hooks/, api/)
- `packages/db/src/` — Drizzle ORM schema, migrations (50+ tables, multi-tenant)
- `packages/shared/` — Shared types (B2B domain models)
- `packages/adapters/` — Agent adapters (claude-local, cursor-local, etc.)
- `e2e/` — Playwright E2E tests (59 pass in Docker authenticated mode)
- `_bmad/` — BMAD framework. Do NOT modify.
- `_bmad-output/` — Planning artifacts, brainstorming, reviews, stories

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
# 59 E2E tests pass against Docker
```

## E2E Test System

### Running
```bash
# Docker (recommended): 59 tests, auth + RBAC
docker compose build && docker compose up -d --wait
bun run test:e2e

# Local dev: 50 tests, auth skipped
bun run dev
bun run test:e2e
```

### Writing New E2E Tests
1. Use seed data from `e2e/fixtures/seed-data.ts`
2. Real browser interactions (not file-content checks)
3. Cover RBAC enforcement (4 roles)
4. `data-testid` attributes for selectors
5. Video capture automatic (playwright.config.ts)
