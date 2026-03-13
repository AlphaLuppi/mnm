# Story 3.2: Claude API Integration for Drift Analysis

Status: ready-for-dev

## Story

As a developer,
I want to call the Claude API to analyze semantic drift between specs and code,
so that I can provide intelligent, actionable insights to users.

## Acceptance Criteria

1. A `DriftAnalyzer` module sends spec content + git diff to the Claude API and receives structured analysis
2. The API call uses model `claude-sonnet-4-20250514` (or latest) with temperature 0 for deterministic output
3. The response is parsed as structured JSON with: severity, drift_type, summary, recommendation
4. If the API call fails, retry with exponential backoff (3 attempts max)
5. If all retries fail, return a `DriftError` with clear error message
6. The Claude API key is loaded from environment variables (never hardcoded, never exposed to client)
7. API latency is logged for performance monitoring

## Tasks / Subtasks

- [ ] Task 1: Create DriftAnalyzer module (AC: #1, #2)
  - [ ] Create `src/lib/drift/analyzer.ts`
  - [ ] Implement `analyze(spec: Spec, diff: string, customInstructions?: string): Promise<DriftResult>`
  - [ ] Build the Claude API request:
    - Endpoint: `https://api.anthropic.com/v1/messages`
    - Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`
    - Body: model, max_tokens (4096), temperature (0), messages with drift prompt
  - [ ] API key from `process.env.CLAUDE_API_KEY`
- [ ] Task 2: Build drift detection prompt (AC: #1)
  - [ ] Create prompt template in `src/lib/drift/prompts.ts`
  - [ ] Prompt structure:
    - System role: "You are a drift detection system"
    - Spec content (full text of the spec document)
    - Git diff (structured or raw unified diff)
    - Custom instructions (optional, appended if provided)
    - Output format instruction: JSON with severity, drift_type, summary, recommendation
  - [ ] Include clear definitions for each classification value (from architecture doc)
- [ ] Task 3: Parse and validate API response (AC: #3)
  - [ ] Extract text content from Claude API response
  - [ ] Parse JSON from response (handle markdown code fences if present)
  - [ ] Validate with Zod schema:
    - `severity`: enum `minor | moderate | critical`
    - `driftType`: enum `scope_expansion | approach_change | design_deviation`
    - `summary`: string (1-3 sentences)
    - `recommendation`: enum `update_spec | recenter_code`
  - [ ] If parsing/validation fails, throw `DriftError.invalidResponse()`
- [ ] Task 4: Implement retry logic (AC: #4, #5)
  - [ ] Wrap API call in retry loop (max 3 attempts)
  - [ ] Exponential backoff: 1s, 2s, 4s between retries
  - [ ] Retry on: network errors, 429 (rate limit), 500/502/503 (server errors)
  - [ ] Do NOT retry on: 400 (bad request), 401 (auth failure)
  - [ ] If all retries exhausted, throw `DriftError.apiError()` with last error message
- [ ] Task 5: Logging and monitoring (AC: #7)
  - [ ] Log API call start time and duration
  - [ ] Log request token count (approximate from input length)
  - [ ] Log response status code and any errors
  - [ ] Use `console.info` for success, `console.error` for failures

## Dev Notes

### Claude API Request Shape

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.CLAUDE_API_KEY!,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    messages: [{
      role: 'user',
      content: buildDriftPrompt(spec, diff, customInstructions),
    }],
  }),
})
```

### Response Parsing

Claude returns:
```json
{
  "content": [{ "type": "text", "text": "..." }],
  "model": "claude-sonnet-4-20250514",
  "usage": { "input_tokens": 1234, "output_tokens": 567 }
}
```

The `text` field contains the JSON drift analysis. It may be wrapped in markdown code fences:
````
```json
{ "severity": "moderate", ... }
```
````

Strip code fences before parsing.

### Zod Validation Schema

```typescript
import { z } from 'zod'

const DriftResultSchema = z.object({
  severity: z.enum(['minor', 'moderate', 'critical']),
  drift_type: z.enum(['scope_expansion', 'approach_change', 'design_deviation']),
  summary: z.string().min(1),
  recommendation: z.enum(['update_spec', 'recenter_code']),
})
```

### Security

- `CLAUDE_API_KEY` lives in `.env.local` (git-ignored)
- All Claude API calls happen in server-side code only (API routes or server actions)
- The key is NEVER sent to the client or included in client bundles

### Project Structure Notes

- `src/lib/drift/analyzer.ts` -- DriftAnalyzer class
- `src/lib/drift/prompts.ts` -- Prompt templates
- Both are server-side only modules

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Claude API Integration for Drift Analysis]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 8.2 - Claude API Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 6.3 - Claude API Prompt Template]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
