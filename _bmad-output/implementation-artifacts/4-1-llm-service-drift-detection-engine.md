# Story 4.1: LLM Service & Drift Detection Engine

Status: ready-for-dev

## Story

As a **user**,
I want **MnM to automatically detect inconsistencies between documents in the hierarchy (Brief -> PRD -> Architecture -> Stories -> Code)**,
So that **silent drift between my specs is caught before it propagates**.

## Acceptance Criteria

### AC1 — LLM Service initialization with Claude API

**Given** le projet est ouvert et une cle API Claude est configuree dans `.mnm/settings.json`
**When** le drift engine s'initialise
**Then** le `LLMService` abstrait est instancie via `ClaudeLLMService` avec `@anthropic-ai/sdk`
**And** les retries sont configures (2x exponential backoff)

### AC2 — Document pair analysis via Markdown AST

**Given** le drift engine est actif
**When** il analyse une paire de documents de la hierarchie
**Then** il extrait les concepts cles via parsing Markdown (remark/unified)
**And** compare les concepts entre les deux niveaux pour detecter les incoherences (FR14)
**And** le resultat est retourne en < 30 secondes (NFR4, dont < 2s de latence pipeline local)

### AC3 — Confidence scoring and drift cache

**Given** les resultats de drift sont calcules
**When** l'analyse est terminee
**Then** chaque drift detecte recoit un score de confiance (0-100) (FR19)
**And** les resultats sont mis en cache dans `.mnm/drift-cache/`

### AC4 — Missing API key error handling

**Given** une cle API n'est pas configuree
**When** le drift engine tente de s'initialiser
**Then** un message d'erreur inline s'affiche : "Cle API Claude requise pour la drift detection"
**And** un lien vers les settings est propose

## Tasks / Subtasks

- [ ] Task 1: Create drift types and shared interfaces (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/shared/types/drift.types.ts` with `DriftReport`, `DriftResult`, `DriftSeverity`, `Concept`, `DocumentPair`, `DriftCacheEntry` types
  - [ ] 1.2 Create `src/shared/types/llm.types.ts` with `LLMConfig`, `LLMResponse` types
  - [ ] 1.3 Add `drift:check` channel args/result types to `src/shared/ipc-channels.ts` if not already present

- [ ] Task 2: Implement abstract LLM Service interface (AC: #1)
  - [ ] 2.1 Create `src/main/services/llm/llm.service.ts` with `LLMService` interface (`compareDocuments`, `extractConcepts`)
  - [ ] 2.2 Create `src/main/services/llm/llm.types.ts` with internal LLM types (prompt templates, retry config)

- [ ] Task 3: Implement ClaudeLLMService (AC: #1, #4)
  - [ ] 3.1 Create `src/main/services/llm/claude-llm.service.ts` implementing `LLMService`
  - [ ] 3.2 Initialize `@anthropic-ai/sdk` Anthropic client with API key from `.mnm/settings.json`
  - [ ] 3.3 Implement `extractConcepts()` — sends document to Claude, receives structured concept list
  - [ ] 3.4 Implement `compareDocuments()` — sends parent + child doc, receives drift analysis with confidence scores
  - [ ] 3.5 Implement retry logic: 2x exponential backoff (1s, 2s), then `AppError` code `LLM_TIMEOUT`
  - [ ] 3.6 Handle missing API key: throw `AppError` code `LLM_NO_API_KEY` with actionable message
  - [ ] 3.7 Write `claude-llm.service.test.ts` with mocked Anthropic SDK

- [ ] Task 4: Implement Markdown AST parser for concept extraction (AC: #2)
  - [ ] 4.1 Create `src/main/services/drift/markdown-parser.ts` using remark/unified
  - [ ] 4.2 Implement `parseMarkdownToAST(content: string)` — returns unified AST
  - [ ] 4.3 Implement `extractSections(ast)` — extracts headers, lists, code blocks as structured sections
  - [ ] 4.4 Implement `extractTextContent(ast)` — extracts plain text for LLM analysis
  - [ ] 4.5 Write `markdown-parser.test.ts` with sample Markdown documents

- [ ] Task 5: Implement Drift Engine Service (AC: #2, #3)
  - [ ] 5.1 Create `src/main/services/drift/drift-engine.service.ts`
  - [ ] 5.2 Implement `analyzePair(docA: string, docB: string): Promise<DriftReport>` — orchestrates full pipeline
  - [ ] 5.3 Pipeline: read files -> parse MD AST -> extract sections -> send to LLM -> score confidence -> return DriftReport
  - [ ] 5.4 Measure and log pipeline local latency (must be < 2s excluding LLM call)
  - [ ] 5.5 Write `drift-engine.service.test.ts` with mocked LLM service

- [ ] Task 6: Implement drift cache (AC: #3)
  - [ ] 6.1 Create `src/main/services/drift/drift-cache.service.ts`
  - [ ] 6.2 Implement `getCachedResult(pairHash: string): DriftCacheEntry | null` — read from `.mnm/drift-cache/results-{pairHash}.json`
  - [ ] 6.3 Implement `cacheResult(pairHash: string, report: DriftReport): void` — atomic write (temp + rename)
  - [ ] 6.4 Implement `getCachedConcepts(docHash: string): Concept[] | null` — read from `.mnm/drift-cache/concepts-{docHash}.json`
  - [ ] 6.5 Implement `cacheConcepts(docHash: string, concepts: Concept[]): void` — atomic write
  - [ ] 6.6 Implement `computeHash(content: string): string` — content-based hash for cache invalidation
  - [ ] 6.7 Write `drift-cache.service.test.ts`

- [ ] Task 7: Register IPC handler for drift:check (AC: #1, #2, #3)
  - [ ] 7.1 Add `drift:check` handler in `src/main/ipc/handlers.ts` — delegates to drift engine
  - [ ] 7.2 Normalize errors to `AppError` before IPC transmission
  - [ ] 7.3 Write integration-level test: invoke `drift:check` -> receive `DriftReport`

- [ ] Task 8: Settings integration for API key (AC: #4)
  - [ ] 8.1 Implement API key reader from `.mnm/settings.json` in drift engine initialization
  - [ ] 8.2 Validate API key presence at engine startup
  - [ ] 8.3 Emit appropriate `AppError` with code `LLM_NO_API_KEY` when key is missing
  - [ ] 8.4 Write test for missing API key scenario

## Dev Notes

### FRs Covered

- **FR14** — Detection automatique des incoherences entre documents de la hierarchie
- **FR19** — Score de confiance associe a chaque drift detecte

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus, `AppError` type, `AsyncState<T>`, import aliases, project scaffold
- **Story 1.3** — Project loader (`.mnm/` directory creation, `settings.json` initialization)

### Technical Architecture

**Service dependency chain:**
```
DriftEngineService
  -> LLMService (interface)
     -> ClaudeLLMService (implementation)
        -> @anthropic-ai/sdk (Anthropic client)
  -> MarkdownParser (remark/unified)
  -> DriftCacheService (filesystem)
```

**File structure for this story:**
```
src/
  main/
    services/
      llm/
        llm.service.ts              # LLMService interface
        claude-llm.service.ts       # ClaudeLLMService implementation
        claude-llm.service.test.ts  # Tests with mocked SDK
        llm.types.ts                # Internal LLM types
      drift/
        drift-engine.service.ts      # DriftEngineService orchestrator
        drift-engine.service.test.ts # Tests with mocked LLM
        drift-cache.service.ts       # Cache read/write
        drift-cache.service.test.ts  # Cache tests
        markdown-parser.ts           # remark/unified wrapper
        markdown-parser.test.ts      # Parser tests
        drift.types.ts               # Internal drift types
  shared/
    types/
      drift.types.ts                 # Shared drift types (DriftReport, etc.)
      llm.types.ts                   # Shared LLM config types
```

### LLM Service Interface

```typescript
// src/main/services/llm/llm.service.ts
// [Source: architecture.md#LLM-Integration-Pattern]

export interface LLMService {
  compareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport>;
  extractConcepts(document: string): Promise<Concept[]>;
}
```

### ClaudeLLMService Implementation Pattern

```typescript
// src/main/services/llm/claude-llm.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { LLMService } from '@main/services/llm/llm.service';
import { DriftReport, Concept } from '@shared/types/drift.types';
import { AppError } from '@shared/types/error.types';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

export class ClaudeLLMService implements LLMService {
  private client: Anthropic;

  constructor(private apiKey: string, private model: string = 'claude-sonnet-4-6') {
    if (!apiKey) {
      throw {
        code: 'LLM_NO_API_KEY',
        message: 'Cle API Claude requise pour la drift detection',
        source: 'claude-llm-service',
      } satisfies AppError;
    }
    this.client = new Anthropic({ apiKey });
  }

  async compareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport> {
    return this.withRetry(() => this.doCompareDocuments(parentDoc, childDoc));
  }

  async extractConcepts(document: string): Promise<Concept[]> {
    return this.withRetry(() => this.doExtractConcepts(document));
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw {
      code: 'LLM_TIMEOUT',
      message: `LLM call failed after ${MAX_RETRIES + 1} attempts`,
      source: 'claude-llm-service',
      details: lastError,
    } satisfies AppError;
  }

  private async doCompareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport> {
    // Use structured prompt to get drift analysis
    // Parse response into DriftReport with confidence scores
    // Implementation details in the actual service
  }

  private async doExtractConcepts(document: string): Promise<Concept[]> {
    // Use structured prompt to extract key concepts
    // Parse response into Concept[] array
    // Implementation details in the actual service
  }
}
```

### Shared Drift Types

```typescript
// src/shared/types/drift.types.ts

export type DriftSeverity = 'critical' | 'warning' | 'info';

export type Concept = {
  id: string;
  name: string;
  description: string;
  sourceSection: string;    // Section header where concept was found
  sourceLineRange: [number, number];
};

export type DriftResult = {
  id: string;
  parentConcept: Concept;
  childConcept: Concept | null;  // null = concept missing in child
  type: 'contradiction' | 'missing' | 'outdated' | 'ambiguous';
  description: string;
  confidence: number;            // 0-100
  severity: DriftSeverity;
};

export type DriftReport = {
  id: string;
  documentA: string;             // File path of parent doc
  documentB: string;             // File path of child doc
  timestamp: number;
  drifts: DriftResult[];
  overallConfidence: number;     // Average confidence
  pipelineLatencyMs: number;     // Local pipeline latency (excl. LLM)
  llmLatencyMs: number;          // LLM call latency
};

export type DocumentPair = {
  parent: string;                // File path
  child: string;                 // File path
  relationship: 'brief-prd' | 'prd-architecture' | 'architecture-story' | 'story-code';
};

export type DriftCacheEntry = {
  pairHash: string;
  report: DriftReport;
  cachedAt: number;
  documentAHash: string;
  documentBHash: string;
};
```

### Markdown Parser Pattern (remark/unified)

```typescript
// src/main/services/drift/markdown-parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, List, Code } from 'mdast';

export type MarkdownSection = {
  title: string;
  depth: number;
  content: string;
  startLine: number;
  endLine: number;
};

export function parseMarkdownToAST(content: string): Root {
  const processor = unified().use(remarkParse);
  return processor.parse(content);
}

export function extractSections(ast: Root): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  // Visit heading nodes, collect content between headings
  visit(ast, 'heading', (node: Heading) => {
    // Extract heading text and content following it
  });
  return sections;
}

export function extractTextContent(ast: Root): string {
  const parts: string[] = [];
  visit(ast, 'text', (node) => {
    parts.push(node.value);
  });
  return parts.join(' ');
}
```

### Drift Engine Pipeline

```typescript
// src/main/services/drift/drift-engine.service.ts
import { LLMService } from '@main/services/llm/llm.service';
import { DriftCacheService } from '@main/services/drift/drift-cache.service';
import { parseMarkdownToAST, extractSections, extractTextContent } from '@main/services/drift/markdown-parser';
import { DriftReport, DocumentPair } from '@shared/types/drift.types';
import { readFile } from 'fs/promises';

export class DriftEngineService {
  constructor(
    private llmService: LLMService,
    private cacheService: DriftCacheService,
  ) {}

  async analyzePair(docA: string, docB: string): Promise<DriftReport> {
    const pipelineStart = performance.now();

    // 1. Read files
    const [contentA, contentB] = await Promise.all([
      readFile(docA, 'utf-8'),
      readFile(docB, 'utf-8'),
    ]);

    // 2. Check cache
    const pairHash = this.cacheService.computeHash(contentA + contentB);
    const cached = this.cacheService.getCachedResult(pairHash);
    if (cached) return cached.report;

    // 3. Parse Markdown AST
    const [astA, astB] = [parseMarkdownToAST(contentA), parseMarkdownToAST(contentB)];

    // 4. Extract text for LLM
    const [textA, textB] = [extractTextContent(astA), extractTextContent(astB)];

    const pipelineLatencyMs = performance.now() - pipelineStart;
    // Pipeline local latency must be < 2s (NFR4)

    // 5. Send to LLM for comparison
    const llmStart = performance.now();
    const report = await this.llmService.compareDocuments(textA, textB);
    const llmLatencyMs = performance.now() - llmStart;

    // 6. Enrich report with metadata
    const enrichedReport: DriftReport = {
      ...report,
      documentA: docA,
      documentB: docB,
      timestamp: Date.now(),
      pipelineLatencyMs,
      llmLatencyMs,
    };

    // 7. Cache results
    this.cacheService.cacheResult(pairHash, enrichedReport);

    return enrichedReport;
  }
}
```

### Drift Cache — Atomic Write Pattern

```typescript
// src/main/services/drift/drift-cache.service.ts
// [Source: architecture.md#Local-Data-Persistence]

import { writeFile, rename, readFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import { join } from 'path';

export class DriftCacheService {
  constructor(private cacheDir: string) {}
  // cacheDir = path.join(projectRoot, '.mnm', 'drift-cache')

  computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  async cacheResult(pairHash: string, report: DriftReport): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    const filePath = join(this.cacheDir, `results-${pairHash}.json`);
    const tempPath = `${filePath}.tmp`;
    // Atomic write: write temp + rename
    await writeFile(tempPath, JSON.stringify(report, null, 2), 'utf-8');
    await rename(tempPath, filePath);
  }
}
```

### Settings.json Schema for Drift

```json
{
  "llm": {
    "apiKey": "sk-ant-...",
    "model": "claude-sonnet-4-6"
  },
  "drift": {
    "confidenceThreshold": 50,
    "documentPairs": [
      { "parent": "_bmad-output/planning-artifacts/prd.md", "child": "_bmad-output/planning-artifacts/architecture.md", "relationship": "prd-architecture" }
    ]
  }
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Services | kebab-case + `.service.ts` | `drift-engine.service.ts` |
| Types | kebab-case + `.types.ts` | `drift.types.ts` |
| Tests | same name + `.test.ts` co-located | `drift-engine.service.test.ts` |
| Parser modules | kebab-case | `markdown-parser.ts` |
| IPC channels | namespace:action kebab | `'drift:check'` |
| Error codes | UPPER_SNAKE_CASE | `LLM_TIMEOUT`, `LLM_NO_API_KEY` |

### Testing Strategy

**Unit tests (co-located):**
- `claude-llm.service.test.ts` — Mock `@anthropic-ai/sdk`, verify retry logic (2x backoff), verify `LLM_TIMEOUT` after exhaustion, verify `LLM_NO_API_KEY` on missing key
- `drift-engine.service.test.ts` — Mock `LLMService`, verify pipeline orchestration, verify latency measurement, verify cache interaction
- `drift-cache.service.test.ts` — Test atomic write (temp + rename), test cache hit/miss, test hash computation
- `markdown-parser.test.ts` — Test AST parsing with real Markdown samples, test section extraction, test text content extraction

**Test patterns:**
```typescript
// Example: claude-llm.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ClaudeLLMService } from '@main/services/llm/claude-llm.service';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

describe('ClaudeLLMService', () => {
  it('should throw LLM_NO_API_KEY when apiKey is empty', () => {
    expect(() => new ClaudeLLMService('')).toThrow();
  });

  it('should retry 2x with exponential backoff on failure', async () => {
    // ...
  });

  it('should throw LLM_TIMEOUT after 3 failed attempts', async () => {
    // ...
  });
});
```

### What NOT to Do

- Do NOT hardcode API key anywhere — always read from `.mnm/settings.json`
- Do NOT use `any` for LLM responses — define typed response shapes and validate with type guards
- Do NOT skip retry logic — always retry 2x with exponential backoff before `AppError`
- Do NOT use `export default` — named exports only
- Do NOT store API key in Electron main process globals — read from settings service on demand
- Do NOT call Claude API from the renderer process — all LLM calls go through main process via IPC
- Do NOT block on cache writes — fire-and-forget for caching (but await for cache reads)
- Do NOT skip pipeline latency measurement — required for NFR4 compliance

### References

- [Source: architecture.md#LLM-Integration-Pattern] — LLMService interface design, ClaudeLLMService pattern
- [Source: architecture.md#Local-Data-Persistence] — `.mnm/` structure, drift-cache directory, atomic write pattern
- [Source: architecture.md#Process-Patterns] — Retry 2x exponential backoff, AppError normalization, logging format
- [Source: architecture.md#IPC-Channel-Design] — `drift:check` channel definition
- [Source: architecture.md#Structure-Patterns] — `services/llm/` and `services/drift/` directory structure
- [Source: architecture.md#Format-Patterns] — AppError type, AsyncState pattern
- [Source: architecture.md#Naming-Patterns] — File and code naming conventions
- [Source: epics.md#Story-4.1] — Full acceptance criteria
- [Source: prd.md] — FR14 (drift detection cross-document), FR19 (confidence scoring), NFR4 (< 30s latency)

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
