# Story 4.2: Drift Detection par Evenement

Status: ready-for-dev

## Story

As a **user**,
I want **drift detection to trigger automatically when a context file is modified**,
So that **I don't have to remember to check for drift manually**.

## Acceptance Criteria

### AC1 — Automatic drift trigger on file change

**Given** le file watcher detecte une modification sur un fichier de la hierarchie documentaire
**When** le fichier modifie fait partie d'une paire connue (ex: PRD <-> Architecture)
**Then** la drift detection est declenchee automatiquement sur les paires impactees (FR15)
**And** un indicateur "Analyse en cours..." apparait

### AC2 — Drift alert emission above threshold

**Given** la drift detection par evenement est declenchee
**When** l'analyse detecte un drift avec un score de confiance au-dessus du seuil configure
**Then** une alerte drift est emise via `stream:drift-alert`
**And** le badge drift dans le header/cockpit est incremente

### AC3 — Silent cache update below threshold

**Given** la drift detection par evenement est declenchee
**When** l'analyse ne detecte aucun drift (ou score sous le seuil)
**Then** aucune alerte n'est emise
**And** le cache est mis a jour silencieusement

## Tasks / Subtasks

- [ ] Task 1: Create document pair registry (AC: #1)
  - [ ] 1.1 Create `src/main/services/drift/document-pair-registry.ts`
  - [ ] 1.2 Implement `DocumentPairRegistry` class that loads configured pairs from `.mnm/settings.json`
  - [ ] 1.3 Implement `getPairsForFile(filePath: string): DocumentPair[]` — returns all pairs that include the modified file
  - [ ] 1.4 Implement `registerPair(pair: DocumentPair): void` — add a pair dynamically
  - [ ] 1.5 Implement `getAllPairs(): DocumentPair[]` — returns all configured pairs
  - [ ] 1.6 Write `document-pair-registry.test.ts`

- [ ] Task 2: Create drift watcher service (AC: #1, #2, #3)
  - [ ] 2.1 Create `src/main/services/drift/drift-watcher.service.ts`
  - [ ] 2.2 Subscribe to `file:changed` events from the main event bus
  - [ ] 2.3 On `file:changed`, look up affected pairs via `DocumentPairRegistry`
  - [ ] 2.4 If no pairs match the changed file, do nothing
  - [ ] 2.5 If pairs match, trigger `DriftEngineService.analyzePair()` for each affected pair
  - [ ] 2.6 Implement debounce (500ms) to avoid triggering multiple analyses for rapid file changes
  - [ ] 2.7 Write `drift-watcher.service.test.ts` with mocked event bus and drift engine

- [ ] Task 3: Implement threshold filtering and alert emission (AC: #2, #3)
  - [ ] 3.1 Read confidence threshold from `.mnm/settings.json` (`drift.confidenceThreshold`, default: 50)
  - [ ] 3.2 After drift analysis, filter results by threshold
  - [ ] 3.3 If any drift result has confidence >= threshold: emit `drift:detected` event on main event bus
  - [ ] 3.4 The `drift:detected` event triggers IPC stream `stream:drift-alert` to renderer
  - [ ] 3.5 If all drift results are below threshold: update cache silently, emit no alert
  - [ ] 3.6 Write tests for threshold filtering (above, below, edge cases)

- [ ] Task 4: Wire IPC stream for drift alerts (AC: #2)
  - [ ] 4.1 Ensure `stream:drift-alert` is registered in `src/main/ipc/streams.ts`
  - [ ] 4.2 Wire `drift:detected` main event -> `stream:drift-alert` IPC stream
  - [ ] 4.3 Stream payload: `{ id: string; severity: DriftSeverity; summary: string; documents: [string, string]; confidence: number }`
  - [ ] 4.4 Write integration test: file change -> drift detected -> stream emitted

- [ ] Task 5: Implement "analyzing" status indicator (AC: #1)
  - [ ] 5.1 Create `stream:drift-status` IPC stream with payload `{ status: 'idle' | 'analyzing'; pairCount: number }`
  - [ ] 5.2 Emit `status: 'analyzing'` when drift analysis starts, `status: 'idle'` when complete
  - [ ] 5.3 Add type definition to `IpcStreamChannels` in `src/shared/ipc-channels.ts`
  - [ ] 5.4 Write test for status transitions

- [ ] Task 6: Register drift watcher in app startup (AC: #1)
  - [ ] 6.1 Initialize `DocumentPairRegistry` with settings from `.mnm/settings.json` in main process startup
  - [ ] 6.2 Initialize `DriftWatcherService` with drift engine, pair registry, event bus, and threshold config
  - [ ] 6.3 Start watching after project is loaded and drift engine is ready
  - [ ] 6.4 Log initialization: `logger.info('drift-watcher', 'Drift watcher started', { pairCount })`

## Dev Notes

### FRs Covered

- **FR15** — Drift detection declenchee par evenement (quand un fichier de contexte est modifie)
- **FR16** — Lancer une verification de drift a la demande (partial: the event-driven trigger provides the foundation for Story 4.3's manual trigger)

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus (`MainEvents`, `stream:drift-alert`), `AppError`, import aliases
- **Story 3.1** — File watcher service (chokidar), `file:changed` event emission
- **Story 4.1** — `DriftEngineService`, `DriftCacheService`, `LLMService`, `DriftReport` types, drift cache

### Technical Architecture

**Event flow:**
```
File System
  -> chokidar (file watcher, Story 3.1)
    -> event bus: 'file:changed' { path, type }
      -> DriftWatcherService
        -> DocumentPairRegistry.getPairsForFile(path)
        -> DriftEngineService.analyzePair() (for each pair)
        -> threshold filter
        -> event bus: 'drift:detected' (if above threshold)
          -> IPC stream: 'stream:drift-alert'
            -> Renderer (DriftAlert component, Story 4.4)
```

**File structure for this story:**
```
src/
  main/
    services/
      drift/
        drift-watcher.service.ts         # Listens to file:changed, triggers drift analysis
        drift-watcher.service.test.ts    # Tests with mocked dependencies
        document-pair-registry.ts        # Manages configured document pairs
        document-pair-registry.test.ts   # Registry tests
  shared/
    ipc-channels.ts                      # Add stream:drift-status type
```

### DriftWatcherService Pattern

```typescript
// src/main/services/drift/drift-watcher.service.ts
import { DriftEngineService } from '@main/services/drift/drift-engine.service';
import { DocumentPairRegistry } from '@main/services/drift/document-pair-registry';
import { DriftSeverity } from '@shared/types/drift.types';
import { AppError } from '@shared/types/error.types';

type DriftWatcherConfig = {
  confidenceThreshold: number;  // 0-100, default 50
  debounceMs: number;           // default 500
};

export class DriftWatcherService {
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private analyzing = false;

  constructor(
    private driftEngine: DriftEngineService,
    private pairRegistry: DocumentPairRegistry,
    private eventBus: TypedEventEmitter,
    private streamSender: StreamSender,
    private config: DriftWatcherConfig,
    private logger: Logger,
  ) {}

  start(): void {
    this.eventBus.on('file:changed', (event) => this.onFileChanged(event));
    this.logger.info('drift-watcher', 'Drift watcher started', {
      pairCount: this.pairRegistry.getAllPairs().length,
      threshold: this.config.confidenceThreshold,
    });
  }

  private onFileChanged(event: { path: string; type: string }): void {
    const pairs = this.pairRegistry.getPairsForFile(event.path);
    if (pairs.length === 0) return;

    // Debounce per file path
    const existingTimer = this.debounceTimers.get(event.path);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(event.path);
      this.analyzeAffectedPairs(pairs);
    }, this.config.debounceMs);

    this.debounceTimers.set(event.path, timer);
  }

  private async analyzeAffectedPairs(pairs: DocumentPair[]): Promise<void> {
    // Emit analyzing status
    this.streamSender.send('stream:drift-status', {
      status: 'analyzing',
      pairCount: pairs.length,
    });

    for (const pair of pairs) {
      try {
        const report = await this.driftEngine.analyzePair(pair.parent, pair.child);

        // Filter by threshold
        const significantDrifts = report.drifts.filter(
          (d) => d.confidence >= this.config.confidenceThreshold
        );

        if (significantDrifts.length > 0) {
          // Emit drift alert
          this.eventBus.emit('drift:detected', {
            id: report.id,
            severity: this.computeMaxSeverity(significantDrifts),
            documents: [pair.parent, pair.child] as [string, string],
          });

          this.streamSender.send('stream:drift-alert', {
            id: report.id,
            severity: this.computeMaxSeverity(significantDrifts),
            summary: this.buildSummary(significantDrifts),
            documents: [pair.parent, pair.child],
            confidence: report.overallConfidence,
          });
        }
        // Cache is updated regardless (inside drift engine)
      } catch (error) {
        this.logger.error('drift-watcher', 'Drift analysis failed', {
          pair,
          error,
        });
      }
    }

    // Emit idle status
    this.streamSender.send('stream:drift-status', {
      status: 'idle',
      pairCount: 0,
    });
  }

  private computeMaxSeverity(drifts: DriftResult[]): DriftSeverity {
    if (drifts.some((d) => d.severity === 'critical')) return 'critical';
    if (drifts.some((d) => d.severity === 'warning')) return 'warning';
    return 'info';
  }

  private buildSummary(drifts: DriftResult[]): string {
    return `${drifts.length} drift(s) detected: ${drifts.map((d) => d.type).join(', ')}`;
  }

  stop(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
```

### DocumentPairRegistry Pattern

```typescript
// src/main/services/drift/document-pair-registry.ts
import { DocumentPair } from '@shared/types/drift.types';
import { resolve, normalize } from 'path';

export class DocumentPairRegistry {
  private pairs: DocumentPair[] = [];
  private fileIndex: Map<string, DocumentPair[]> = new Map();

  constructor(private projectRoot: string) {}

  loadFromSettings(settings: { drift?: { documentPairs?: DocumentPair[] } }): void {
    const configuredPairs = settings.drift?.documentPairs ?? [];
    for (const pair of configuredPairs) {
      this.registerPair({
        ...pair,
        parent: resolve(this.projectRoot, pair.parent),
        child: resolve(this.projectRoot, pair.child),
      });
    }
  }

  registerPair(pair: DocumentPair): void {
    this.pairs.push(pair);
    // Index by both parent and child for fast lookup
    this.addToIndex(normalize(pair.parent), pair);
    this.addToIndex(normalize(pair.child), pair);
  }

  getPairsForFile(filePath: string): DocumentPair[] {
    return this.fileIndex.get(normalize(filePath)) ?? [];
  }

  getAllPairs(): DocumentPair[] {
    return [...this.pairs];
  }

  private addToIndex(key: string, pair: DocumentPair): void {
    const existing = this.fileIndex.get(key) ?? [];
    existing.push(pair);
    this.fileIndex.set(key, existing);
  }
}
```

### IPC Stream Addition

```typescript
// Addition to src/shared/ipc-channels.ts
// In IpcStreamChannels:
'stream:drift-status': { status: 'idle' | 'analyzing'; pairCount: number };
```

### Debounce Strategy

File changes often come in bursts (editor save, git checkout, agent writes). The drift watcher uses per-file debouncing:
- Each file path gets its own debounce timer (500ms default)
- If the same file changes again within 500ms, the timer resets
- This prevents triggering multiple drift analyses for rapid successive saves
- Different files can trigger analysis independently

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Services | kebab-case + `.service.ts` | `drift-watcher.service.ts` |
| Registry | kebab-case | `document-pair-registry.ts` |
| Tests | same name + `.test.ts` co-located | `drift-watcher.service.test.ts` |
| Events | namespace:action kebab | `'drift:detected'`, `'file:changed'` |
| IPC streams | `stream:` prefix | `'stream:drift-alert'`, `'stream:drift-status'` |

### Testing Strategy

**Unit tests (co-located):**
- `drift-watcher.service.test.ts`:
  - Mock event bus, drift engine, pair registry, stream sender
  - Test: file change on unknown file -> no analysis triggered
  - Test: file change on known pair -> analysis triggered
  - Test: rapid file changes -> debounced to single analysis
  - Test: drift above threshold -> `stream:drift-alert` emitted
  - Test: drift below threshold -> no alert, cache updated
  - Test: analysis error -> logged, no crash, continues processing
  - Test: status transitions (`analyzing` -> `idle`)
- `document-pair-registry.test.ts`:
  - Test: load pairs from settings
  - Test: lookup by parent file path
  - Test: lookup by child file path
  - Test: unknown file returns empty array
  - Test: multiple pairs for same file

**Test patterns:**
```typescript
// drift-watcher.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DriftWatcherService', () => {
  it('should trigger analysis when a monitored file changes', async () => {
    const mockEngine = { analyzePair: vi.fn().mockResolvedValue(mockReport) };
    const mockRegistry = { getPairsForFile: vi.fn().mockReturnValue([mockPair]) };
    const mockBus = { on: vi.fn(), emit: vi.fn() };
    const mockStream = { send: vi.fn() };

    const watcher = new DriftWatcherService(
      mockEngine, mockRegistry, mockBus, mockStream,
      { confidenceThreshold: 50, debounceMs: 0 },
      mockLogger,
    );

    watcher.start();
    // Simulate file:changed
    const handler = mockBus.on.mock.calls[0][1];
    await handler({ path: '/project/prd.md', type: 'modify' });

    expect(mockEngine.analyzePair).toHaveBeenCalled();
  });

  it('should not emit alert when confidence is below threshold', async () => {
    // ... mock drift report with low confidence
    // ... verify stream:drift-alert NOT called
  });
});
```

### What NOT to Do

- Do NOT poll for file changes — rely entirely on the `file:changed` event from Story 3.1's file watcher
- Do NOT trigger drift analysis on every file change without debouncing — rapid saves would overwhelm the LLM API
- Do NOT block the main process event loop during drift analysis — all LLM calls are async
- Do NOT emit alerts for drifts below the configured threshold
- Do NOT use `export default` — named exports only
- Do NOT use `any` for event payloads — use typed event maps
- Do NOT hardcode document pairs — always read from `.mnm/settings.json`
- Do NOT ignore errors from drift analysis — log them and continue processing other pairs

### References

- [Source: architecture.md#Event-Bus-Architecture] — `file:changed` event definition, event flow pattern
- [Source: architecture.md#IPC-Channel-Design] — `stream:drift-alert` channel definition
- [Source: architecture.md#Local-Data-Persistence] — `.mnm/settings.json` for drift configuration
- [Source: architecture.md#Process-Patterns] — Error handling, logging format
- [Source: architecture.md#Data-Flow] — Filesystem -> File Watcher -> Event Bus -> IPC Stream -> React UI
- [Source: ux-design-specification.md#Journey-2] — Gabri's drift detection journey
- [Source: epics.md#Story-4.2] — Full acceptance criteria
- [Source: epics.md#Story-3.1] — File watcher dependency (chokidar, `stream:file-change`)

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
