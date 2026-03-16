# CLAUDE.md

## Project Overview

**MnM** is an open-source IDE for AI agent-driven development. Supervision cockpit for multi-agent workflows.
Stack: React + Express + SQLite (migrating to PostgreSQL) + Drizzle ORM. Monorepo pnpm.
Language: French for planning documents.

## Repository Structure

- `server/src/` — Express backend (routes/, services/, middleware/, realtime/, auth/)
- `ui/src/` — React frontend (pages/, components/, hooks/, api/)
- `packages/db/src/` — Drizzle ORM schema, migrations
- `packages/shared/` — Shared types
- `packages/adapters/` — Agent adapters (claude-local, cursor-local, etc.)
- `_bmad/` — BMAD framework. Do NOT modify.
- `_bmad-output/` — Planning artifacts (epics, PRD, architecture, sprint planning)

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

