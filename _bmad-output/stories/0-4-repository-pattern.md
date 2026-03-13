# Story 0.4: Repository Pattern

Status: ready-for-dev

## Story

As a developer,
I want repository functions for database access,
so that I can cleanly separate persistence logic from business logic.

## Acceptance Criteria

1. Repository modules exist for each domain entity: agents, specs, driftDetections, fileLocks, importantFiles, specChanges
2. Each repository provides CRUD operations: findById, findByX, insert, update, delete (where applicable)
3. All operations use Drizzle ORM query builder (no raw SQL)
4. All write operations are correctly typed with Drizzle's `InferInsertModel`
5. Repository functions accept a `db` parameter (dependency injection, not global singleton)
6. Basic tests verify CRUD operations work against an in-memory SQLite database

## Tasks / Subtasks

- [ ] Task 1: Create agent repository (AC: #1, #2, #3)
  - [ ] `findById(db, id)` - find agent by ID
  - [ ] `findByStatus(db, status)` - find agents by status
  - [ ] `insert(db, agent)` - create new agent
  - [ ] `update(db, id, data)` - update agent fields
  - [ ] `deleteAgent(db, id)` - remove agent record
- [ ] Task 2: Create spec repository (AC: #1, #2, #3)
  - [ ] `findById(db, id)`
  - [ ] `findByPath(db, filePath)`
  - [ ] `findByType(db, specType)`
  - [ ] `search(db, query)` - full-text search on title
  - [ ] `insert(db, spec)` and `update(db, id, data)`
- [ ] Task 3: Create drift detection repository (AC: #1, #2, #3)
  - [ ] `findByAgent(db, agentId)`
  - [ ] `findBySpec(db, specId)`
  - [ ] `findPending(db)` - find unresolved drifts
  - [ ] `insert(db, drift)` and `update(db, id, data)`
- [ ] Task 4: Create file lock repository (AC: #1, #2, #3)
  - [ ] `findActiveLocks(db, filePath)` - locks where releasedAt is null
  - [ ] `acquire(db, lock)` - insert new lock
  - [ ] `release(db, lockId)` - set releasedAt timestamp
- [ ] Task 5: Create important file repository (AC: #1, #2, #3)
  - [ ] `findAll(db)`
  - [ ] `findByType(db, fileType)`
  - [ ] `insert(db, file)` and `update(db, id, data)`
- [ ] Task 6: Create spec change repository (AC: #1, #2, #3)
  - [ ] `findUnviewed(db)` - changes where userViewed is false
  - [ ] `insert(db, change)`
  - [ ] `markViewed(db, id)` - set userViewed to true
- [ ] Task 7: Write repository tests (AC: #6)
  - [ ] Set up in-memory SQLite for testing
  - [ ] Test insert + findById for each repository
  - [ ] Test update and delete operations
  - [ ] Test query filters (findByStatus, findByType, etc.)

## Dev Notes

### File Structure

```
src/lib/db/
├── index.ts              # getDb() connection singleton
├── schema.ts             # Drizzle table definitions (from Story 0.2)
├── migrations/           # Generated migrations
└── repositories/
    ├── index.ts          # Barrel exports
    ├── agents.ts
    ├── specs.ts
    ├── drift-detections.ts
    ├── file-locks.ts
    ├── important-files.ts
    └── spec-changes.ts
```

### Repository Function Pattern

Use plain functions (not classes) with the `db` instance passed as first argument:

```typescript
// src/lib/db/repositories/agents.ts
import { eq } from 'drizzle-orm'
import { agents } from '../schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '../schema'

type Db = BetterSQLite3Database<typeof schema>

export function findById(db: Db, id: string) {
  return db.query.agents.findFirst({
    where: eq(agents.id, id),
  })
}

export function findByStatus(db: Db, status: string) {
  return db.query.agents.findMany({
    where: eq(agents.status, status),
  })
}

export function insert(db: Db, data: typeof agents.$inferInsert) {
  return db.insert(agents).values(data).returning().get()
}

export function update(db: Db, id: string, data: Partial<typeof agents.$inferInsert>) {
  return db.update(agents).set({ ...data, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(agents.id, id)).returning().get()
}
```

### Testing Pattern

Use in-memory SQLite for fast, isolated tests:

```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../schema'

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './src/lib/db/migrations' })
  return db
}
```

### Critical Constraints

- Functions, not classes -- keep it simple and composable
- Always pass `db` as first parameter (enables testing with in-memory DB)
- Use Drizzle's `.returning().get()` for insert/update to return the created/updated record
- Use `.$inferInsert` for insert types and `.$inferSelect` for return types
- better-sqlite3 is synchronous -- no async/await needed on repository functions
- Use `Math.floor(Date.now() / 1000)` for Unix timestamps (seconds, not milliseconds)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 4.2 - mnm-db]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 7.1 - Core Traits (SpecRepository)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
