# Story 0.2: SQLite Database Setup & Migrations

Status: ready-for-dev

## Story

As a developer,
I want a robust SQLite database with Drizzle ORM schema and migrations,
so that I can reliably persist application state.

## Acceptance Criteria

1. Drizzle schema defines all 7 tables: `agents`, `specs`, `drift_detections`, `file_locks`, `important_files`, `spec_changes`, `_migrations`
2. All tables have proper indexes as defined in the architecture document
3. Database file is created at `.mnm/state.db` on first run (directory auto-created if missing)
4. Drizzle migrations are generated and can be applied via `npm run db:migrate`
5. A `getDb()` singleton function provides the database connection
6. All columns use appropriate SQLite types (TEXT for UUIDs, INTEGER for timestamps, etc.)
7. Foreign key constraints are defined where specified in the architecture

## Tasks / Subtasks

- [ ] Task 1: Define Drizzle schema for all tables (AC: #1, #6, #7)
  - [ ] Define `agents` table with all columns and indexes
  - [ ] Define `specs` table with all columns and indexes
  - [ ] Define `driftDetections` table with all columns, indexes, and foreign keys
  - [ ] Define `fileLocks` table with all columns, indexes, and foreign keys
  - [ ] Define `importantFiles` table with all columns and indexes
  - [ ] Define `specChanges` table with all columns and indexes
  - [ ] Define `migrations` tracking table
- [ ] Task 2: Implement database connection singleton (AC: #3, #5)
  - [ ] Create `getDb()` function that initializes connection to `.mnm/state.db`
  - [ ] Auto-create `.mnm/` directory if it does not exist
  - [ ] Enable WAL mode and foreign keys pragma
- [ ] Task 3: Generate and apply migrations (AC: #4)
  - [ ] Add `db:generate` and `db:migrate` scripts to package.json
  - [ ] Run `drizzle-kit generate` to create initial migration
  - [ ] Implement migration runner that applies on app startup
- [ ] Task 4: Verify database setup (AC: #2)
  - [ ] Write a smoke test or script that creates all tables and verifies schema
  - [ ] Verify indexes exist with correct columns

## Dev Notes

### Drizzle Schema Location

File: `src/lib/db/schema.ts`

Use Drizzle's SQLite schema builder (`drizzle-orm/sqlite-core`).

### Table Definitions (from Architecture)

All table schemas are defined in the architecture document Section 3.2. Key mappings:

| Architecture Column Type | Drizzle Type |
|---|---|
| `TEXT PRIMARY KEY` (UUID) | `text('id').primaryKey()` |
| `TEXT NOT NULL` | `text('name').notNull()` |
| `INTEGER NOT NULL` (timestamp) | `integer('created_at', { mode: 'timestamp' }).notNull()` |
| `BOOLEAN DEFAULT 0` | `integer('user_confirmed', { mode: 'boolean' }).default(false)` |
| `TEXT` (nullable) | `text('error_message')` |

### Database Connection Pattern

```typescript
// src/lib/db/index.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { mkdirSync } from 'fs'
import { join } from 'path'

let db: ReturnType<typeof drizzle> | null = null

export function getDb(repoRoot: string = process.cwd()) {
  if (!db) {
    const dbDir = join(repoRoot, '.mnm')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'state.db')
    const sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema })
  }
  return db
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Architecture Schema Reference

Refer to architecture.md Section 3.2 for exact SQL schemas for all 7 tables:
- `agents` (id, name, status, spec_id, scope, started_at, completed_at, error_message, created_at, updated_at)
- `specs` (id, file_path, spec_type, title, last_modified, git_commit_sha, content_hash, created_at, updated_at)
- `drift_detections` (id, agent_id, spec_id, severity, drift_type, summary, recommendation, diff_content, user_decision, decided_at, created_at, updated_at)
- `file_locks` (id, file_path, agent_id, lock_type, acquired_at, released_at)
- `important_files` (id, file_path, file_type, detected_at, user_confirmed, created_at, updated_at)
- `spec_changes` (id, file_path, old_commit_sha, new_commit_sha, change_summary, detected_at, user_viewed, created_at)

### Critical Constraints

- Use `integer({ mode: 'timestamp' })` for all timestamp columns (Unix epoch seconds)
- Use `text` for UUID columns, not auto-increment integers
- All `id` columns should default to `crypto.randomUUID()` in application code, not in schema
- Foreign keys: `drift_detections.agent_id` -> `agents.id`, `drift_detections.spec_id` -> `specs.id`, `file_locks.agent_id` -> `agents.id`
- better-sqlite3 runs synchronously -- no async/await needed for DB operations

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 3.2 - Schema Design]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 3.3 - Database Migrations]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
