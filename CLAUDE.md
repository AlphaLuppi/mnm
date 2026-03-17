# CLAUDE.md

## Project Overview

**MnM** is an enterprise B2B supervision cockpit for AI agent orchestration, multi-tenant workforce management, and compliance audit.
Fork of Paperclip, transformed into a multi-tenant B2B platform (pivot mars 2026).
Stack: React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo pnpm.
Language: French for planning documents.

## B2B Context (as of 2026-03)

- **Multi-Tenant**: RLS PostgreSQL, per-company isolation, per-project scoping
- **RBAC**: 4 business roles (admin/manager/contributor/viewer), 20 permission keys
- **Orchestration**: Deterministic workflows with state machine (XState), HITL validation
- **Observability**: Immutable audit trail, LLM summaries, k-anonymity dashboards
- **Security**: Container isolation (Docker), credential proxy, mount allowlist
- **69 B2B stories implemented** (TECH/RBAC/MU/ORCH/PROJ/OBS/CHAT/CONT/A2A/COMP/DUAL/SSO/DASH/ONB/DRIFT)

## Key B2B Documents

- `_bmad-output/planning-artifacts/prd-b2b.md` — Product Requirements (52 FRs)
- `_bmad-output/planning-artifacts/architecture-b2b.md` — Architecture (8 ADRs)
- `_bmad-output/planning-artifacts/epics-b2b.md` — 16 Epics, ~69 Stories
- `_bmad-output/planning-artifacts/EXECUTION-TRACKER.md` — All 69 stories execution log
- `_bmad-output/planning-artifacts/RECAP-B2B-TRANSFORMATION.md` — Executive summary

## Repository Structure

- `server/src/` — Express backend (routes/, services/, middleware/, realtime/, auth/)
- `ui/src/` — React frontend (pages/, components/, hooks/, api/)
- `packages/db/src/` — Drizzle ORM schema, migrations (50 tables, multi-tenant)
- `packages/shared/` — Shared types (B2B domain models)
- `packages/adapters/` — Agent adapters (claude-local, cursor-local, etc.)
- `_bmad/` — BMAD framework. Do NOT modify.
- `_bmad-output/` — Planning artifacts (B2B docs), brainstorming, stories
- `_research/` — Technical research (orchestration patterns, Nanoclaw, OpenClaw)

## Dev Commands

```bash
pnpm dev          # Start dev (server + ui)
pnpm build        # Build all packages
pnpm test         # Run vitest
pnpm test:run     # Run vitest once
pnpm typecheck    # TypeScript check all packages
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
```

