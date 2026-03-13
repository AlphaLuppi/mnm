# Story 1.2: Spec File Detection & Indexing

Status: ready-for-dev

## Story

As a user,
I want MnM to automatically discover and index my spec files,
so that I can browse them without manual configuration.

## Acceptance Criteria

1. On app startup (or first visit), the spec indexer scans the repository for `.md` and `.json` files
2. For each file, metadata is extracted: file path, spec type, title, content hash (SHA256), last modified timestamp, git commit SHA
3. Supported formats are parsed correctly: BMAD (YAML frontmatter + Markdown), open-spec (JSON), Generic Markdown (H1 as title)
4. Extracted specs are stored in the `specs` table via Drizzle ORM
5. Indexing completes in < 5 seconds for repos with 500 specs
6. If parsing fails for a file, it is logged as a warning and skipped (no crash)
7. A `/api/specs` GET endpoint returns the list of indexed specs
8. A `/api/specs` POST endpoint triggers re-indexing

## Tasks / Subtasks

- [ ] Task 1: Implement SpecParser (AC: #2, #3)
  - [ ] Create `src/lib/spec/parser.ts`
  - [ ] Parse BMAD format: extract YAML frontmatter (use `gray-matter` npm package) and Markdown body
  - [ ] Parse open-spec format: parse JSON, extract title and type
  - [ ] Parse generic Markdown: extract first H1 heading as title
  - [ ] Classify spec type from frontmatter, file path patterns, or content heuristics:
    - Files matching `*product-brief*` -> `product_brief`
    - Files matching `*prd*` -> `prd`
    - Files matching `*architecture*` -> `architecture`
    - Files matching `*story*` or `*stories*` -> `story`
    - Other -> `config`
  - [ ] Generate SHA256 content hash for change detection
- [ ] Task 2: Implement SpecIndexer (AC: #1, #5, #6)
  - [ ] Create `src/lib/spec/indexer.ts`
  - [ ] Scan repository for `.md` and `.json` files (use `glob` or `fast-glob` package)
  - [ ] Exclude `.git/`, `node_modules/`, `.mnm/`, and other common non-spec directories
  - [ ] For each file, call SpecParser to extract metadata
  - [ ] Get last modified timestamp and commit SHA via simple-git
  - [ ] Upsert results into `specs` table (insert or update based on file_path)
  - [ ] Wrap in try/catch per file to skip failures gracefully
- [ ] Task 3: Create specs repository (AC: #4)
  - [ ] Create `src/lib/db/repositories/specs.ts`
  - [ ] Implement: `findAll()`, `findById(id)`, `findByType(specType)`, `findByPath(filePath)`, `upsert(spec)`, `search(query)`
  - [ ] Use Drizzle ORM query builder with proper types
- [ ] Task 4: Create API routes (AC: #7, #8)
  - [ ] Create `src/app/api/specs/route.ts`
  - [ ] GET handler: return all specs from database, support `?type=` filter query param
  - [ ] POST handler: trigger full re-index, return updated spec list
- [ ] Task 5: Install parsing dependencies
  - [ ] Install `gray-matter` for YAML frontmatter extraction
  - [ ] Install `fast-glob` for file scanning

## Dev Notes

### Key Packages

- **gray-matter**: Parse YAML frontmatter from Markdown files (`npm install gray-matter`)
- **fast-glob**: Fast file globbing (`npm install fast-glob`)
- **crypto** (built-in): SHA256 hashing for content hash

### Spec Type Classification Logic

Priority order for classification:
1. Explicit `spec_type` in YAML frontmatter (highest priority)
2. File path pattern matching (e.g., path contains "prd", "architecture", "story")
3. Content heuristics (fallback)

### File Path for Repository Root

The target repository path should be configurable. For the POC, use the current working directory or a config value. Store as environment variable `MNM_REPO_PATH` in `.env.local`.

### Performance Notes

- Use `fast-glob` with `ignore` patterns instead of scanning everything
- Batch database inserts where possible
- Git operations (last commit SHA per file) can be slow for large repos -- consider batching via `git log`

### Project Structure Notes

- `src/lib/spec/parser.ts` -- SpecParser class
- `src/lib/spec/indexer.ts` -- SpecIndexer class
- `src/lib/db/repositories/specs.ts` -- SpecRepository
- `src/app/api/specs/route.ts` -- API route

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Spec File Detection & Indexing]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 3 - Project Structure]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 4 - Data Model]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5 - API Routes Design]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
