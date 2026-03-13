# Story 3.3: Custom Drift Instructions Support

Status: ready-for-dev

## Story

As a user,
I want to define custom drift detection rules,
so that I can enforce project-specific standards and reduce false positives.

## Acceptance Criteria

1. If a file `.mnm/drift-instructions.md` exists in the repository, its content is loaded and appended to the Claude API drift prompt
2. The instruction format is plain Markdown (free-form text)
3. If the file does not exist, default instructions are used (no error)
4. Instructions are cached in memory and reloaded only when the file changes (detected via content hash)
5. Custom instructions are included in drift analysis logs for traceability

## Tasks / Subtasks

- [ ] Task 1: Create instruction loader (AC: #1, #3, #4)
  - [ ] Create `src/lib/drift/instructions.ts`
  - [ ] Implement `loadCustomInstructions(repoRoot: string): Promise<string | null>`
  - [ ] Check for `.mnm/drift-instructions.md` at the repository root
  - [ ] If file exists, read content and return as string
  - [ ] If file does not exist, return `null`
  - [ ] Implement simple in-memory cache:
    - Store content hash (SHA256) of last loaded file
    - On subsequent calls, check if file hash changed before re-reading
    - If unchanged, return cached content
- [ ] Task 2: Integrate with DriftAnalyzer (AC: #1)
  - [ ] Update `src/lib/drift/analyzer.ts` to call `loadCustomInstructions()` before each analysis
  - [ ] If custom instructions are returned, append them to the prompt after the standard drift detection instructions
  - [ ] If `null`, use only the default prompt
- [ ] Task 3: Update prompt template (AC: #1)
  - [ ] Update `src/lib/drift/prompts.ts` to include a section for custom instructions:
    ```
    **Custom Instructions (project-specific rules):**
    {customInstructions}
    ```
  - [ ] Only include the section if custom instructions are present
- [ ] Task 4: Logging (AC: #5)
  - [ ] Log whether custom instructions were loaded (yes/no) for each drift analysis
  - [ ] Log the file path and content hash (not the full content) for traceability
  - [ ] If file read fails, log warning and proceed without custom instructions

## Dev Notes

### Example Custom Instructions File

`.mnm/drift-instructions.md`:
```markdown
# Custom Drift Detection Instructions

## Performance Rules
- If implementation introduces O(n^2) complexity where spec expects O(n), classify as critical design_deviation

## Security Rules
- If implementation exposes API endpoints not in spec, classify as critical scope_expansion

## Logging Rules
- If implementation adds extensive logging, classify as minor scope_expansion (acceptable)

## Architecture Rules
- SSE is the only accepted real-time transport. Any mention of WebSocket in implementation is a critical design_deviation.
```

### Caching Strategy

Simple approach for POC:
```typescript
let cachedContent: string | null = null
let cachedHash: string | null = null

async function loadCustomInstructions(repoRoot: string): Promise<string | null> {
  const filePath = path.join(repoRoot, '.mnm', 'drift-instructions.md')
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const hash = createHash('sha256').update(content).digest('hex')
    if (hash !== cachedHash) {
      cachedContent = content
      cachedHash = hash
    }
    return cachedContent
  } catch {
    return null // File doesn't exist
  }
}
```

### Project Structure Notes

- `src/lib/drift/instructions.ts` -- instruction loader with caching
- Updates to `src/lib/drift/analyzer.ts` and `src/lib/drift/prompts.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Custom Drift Instructions Support]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 6.4 - Custom Instructions Support]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
