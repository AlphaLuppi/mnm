# Story 4.3: Drift Check Manuel & Configuration du Seuil

Status: ready-for-dev

## Story

As a **user**,
I want **to trigger a drift check on demand and configure the confidence threshold**,
So that **I can control when and how sensitive drift detection is**.

## Acceptance Criteria

### AC1 — Manual drift check trigger

**Given** un projet est ouvert
**When** je clique sur "Verifier le drift" (ou `Cmd+Shift+D`)
**Then** je peux selectionner un ensemble de documents a verifier (FR16)
**And** la drift detection est lancee sur les paires selectionnees

### AC2 — Progress feedback during manual check

**Given** la verification manuelle est en cours
**When** l'analyse progresse
**Then** une progress bar + "Analyse en cours..." s'affiche
**And** les resultats apparaissent au fur et a mesure

### AC3 — Confidence threshold configuration

**Given** je veux configurer le seuil de confiance
**When** j'ouvre les settings (`.mnm/settings.json`)
**Then** je peux definir le seuil (0-100) en dessous duquel les alertes ne sont pas surfacees (FR20)
**And** le changement prend effet immediatement sans restart

## Tasks / Subtasks

- [ ] Task 1: Extend drift:check IPC handler for manual trigger (AC: #1)
  - [ ] 1.1 Extend `drift:check` handler in `src/main/ipc/handlers.ts` to support both single-pair and multi-pair requests
  - [ ] 1.2 Add new IPC channel `drift:check-multiple` in `src/shared/ipc-channels.ts` with args `{ pairs: Array<{ docA: string; docB: string }> }` and result `{ reports: DriftReport[] }`
  - [ ] 1.3 Implement handler that delegates to `DriftEngineService.analyzePair()` for each pair
  - [ ] 1.4 Write handler test with mocked drift engine

- [ ] Task 2: Implement manual drift check with progress streaming (AC: #1, #2)
  - [ ] 2.1 Create `src/main/services/drift/manual-drift-check.service.ts`
  - [ ] 2.2 Implement `runManualCheck(pairs: DocumentPair[]): Promise<DriftReport[]>` — orchestrates analysis of multiple pairs
  - [ ] 2.3 Emit progress via `stream:drift-progress` IPC stream: `{ completed: number; total: number; currentPair: [string, string] }`
  - [ ] 2.4 Add `stream:drift-progress` type to `IpcStreamChannels` in `src/shared/ipc-channels.ts`
  - [ ] 2.5 Results emitted incrementally via `stream:drift-alert` as each pair completes
  - [ ] 2.6 Write `manual-drift-check.service.test.ts`

- [ ] Task 3: Implement document selector for manual check (AC: #1)
  - [ ] 3.1 Create `src/renderer/src/features/drift/components/DriftCheckDialog.tsx`
  - [ ] 3.2 Display list of configured document pairs from settings with checkboxes
  - [ ] 3.3 Allow user to select which pairs to check (select all by default)
  - [ ] 3.4 "Run" button triggers `drift:check-multiple` IPC invoke
  - [ ] 3.5 Use shadcn/ui `Dialog` + `Checkbox` components
  - [ ] 3.6 Write `DriftCheckDialog.test.tsx`

- [ ] Task 4: Implement progress UI for manual check (AC: #2)
  - [ ] 4.1 Create `src/renderer/src/features/drift/components/DriftCheckProgress.tsx`
  - [ ] 4.2 Subscribe to `stream:drift-progress` via `useIpcStream` hook
  - [ ] 4.3 Display progress bar with `{completed}/{total}` label + "Analyse en cours..."
  - [ ] 4.4 Display current pair being analyzed
  - [ ] 4.5 Results appear inline as each pair analysis completes (via `stream:drift-alert`)
  - [ ] 4.6 Write `DriftCheckProgress.test.tsx`

- [ ] Task 5: Create drift panel with manual trigger button (AC: #1)
  - [ ] 5.1 Create `src/renderer/src/features/drift/components/DriftPanel.tsx`
  - [ ] 5.2 Add "Verifier le drift" button (primary style)
  - [ ] 5.3 Button click opens `DriftCheckDialog`
  - [ ] 5.4 Display list of recent drift alerts (from `drift.store.ts`)
  - [ ] 5.5 Write `DriftPanel.test.tsx`

- [ ] Task 6: Implement keyboard shortcut Cmd+Shift+D (AC: #1)
  - [ ] 6.1 Register `Cmd+Shift+D` (macOS) / `Ctrl+Shift+D` (Linux/Windows) shortcut
  - [ ] 6.2 Shortcut opens `DriftCheckDialog` directly
  - [ ] 6.3 Detect platform via `navigator.platform` for correct modifier key display
  - [ ] 6.4 Write test for shortcut registration

- [ ] Task 7: Implement threshold configuration UI (AC: #3)
  - [ ] 7.1 Create `src/renderer/src/features/drift/components/DriftSettings.tsx`
  - [ ] 7.2 Slider or number input for confidence threshold (0-100, default 50)
  - [ ] 7.3 Save via new IPC channel `settings:update` with args `{ key: string; value: unknown }`
  - [ ] 7.4 Changes persisted to `.mnm/settings.json` immediately
  - [ ] 7.5 Write `DriftSettings.test.tsx`

- [ ] Task 8: Implement live threshold reload in main process (AC: #3)
  - [ ] 8.1 Create settings watcher in main process that detects changes to `.mnm/settings.json`
  - [ ] 8.2 When `drift.confidenceThreshold` changes, update `DriftWatcherService` config in-memory
  - [ ] 8.3 No restart required — new threshold takes effect on next drift analysis
  - [ ] 8.4 Emit `stream:settings-changed` to renderer so UI reflects current value
  - [ ] 8.5 Write test for hot-reload of threshold

- [ ] Task 9: Create drift store (AC: #1, #2)
  - [ ] 9.1 Create `src/renderer/src/features/drift/drift.store.ts` (Zustand)
  - [ ] 9.2 State: `alerts: DriftAlert[]`, `checkStatus: AsyncState<DriftReport[]>`, `threshold: number`
  - [ ] 9.3 Actions: `addAlert`, `removeAlert`, `setCheckStatus`, `setThreshold`
  - [ ] 9.4 Wire to `stream:drift-alert` and `stream:drift-progress` via hooks
  - [ ] 9.5 Write `drift.store.test.ts`

## Dev Notes

### FRs Covered

- **FR16** — Lancer une verification de drift a la demande sur un ensemble de documents
- **FR20** — Configurer le seuil de confiance en dessous duquel les alertes ne sont pas surfacees

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus, `AppError`, `AsyncState<T>`, import aliases, shadcn/ui init
- **Story 1.2** — Layout shell (for panel integration)
- **Story 1.3** — `.mnm/settings.json` initialization, project loader
- **Story 4.1** — `DriftEngineService`, `DriftReport` types, `LLMService`
- **Story 4.2** — `DriftWatcherService`, `DocumentPairRegistry`, `stream:drift-alert` wiring, `stream:drift-status`

### Technical Architecture

**Manual check flow:**
```
User clicks "Verifier le drift" (or Cmd+Shift+D)
  -> DriftCheckDialog opens
    -> User selects pairs
    -> Invoke drift:check-multiple IPC
      -> ManualDriftCheckService.runManualCheck(pairs)
        -> For each pair:
          -> DriftEngineService.analyzePair()
          -> Emit stream:drift-progress { completed, total }
          -> If drift found above threshold: emit stream:drift-alert
        -> Return DriftReport[]
      -> DriftCheckProgress displays results
```

**Threshold configuration flow:**
```
User adjusts threshold slider in DriftSettings
  -> Invoke settings:update IPC
    -> Write to .mnm/settings.json (atomic)
    -> Update DriftWatcherService config in-memory
    -> Emit stream:settings-changed to renderer
  -> Next drift analysis uses new threshold
```

**File structure for this story:**
```
src/
  main/
    services/
      drift/
        manual-drift-check.service.ts         # Manual check orchestrator
        manual-drift-check.service.test.ts    # Tests
  renderer/
    src/
      features/
        drift/
          components/
            DriftPanel.tsx                     # Main drift panel with trigger button
            DriftPanel.test.tsx
            DriftCheckDialog.tsx               # Document pair selector dialog
            DriftCheckDialog.test.tsx
            DriftCheckProgress.tsx             # Progress bar during manual check
            DriftCheckProgress.test.tsx
            DriftSettings.tsx                  # Threshold configuration
            DriftSettings.test.tsx
          drift.store.ts                       # Zustand store for drift feature
          drift.store.test.ts
          index.ts                             # Barrel file
  shared/
    ipc-channels.ts                            # Add drift:check-multiple, stream:drift-progress, settings:update
```

### ManualDriftCheckService Pattern

```typescript
// src/main/services/drift/manual-drift-check.service.ts
import { DriftEngineService } from '@main/services/drift/drift-engine.service';
import { DriftReport, DocumentPair } from '@shared/types/drift.types';

export class ManualDriftCheckService {
  constructor(
    private driftEngine: DriftEngineService,
    private streamSender: StreamSender,
    private logger: Logger,
  ) {}

  async runManualCheck(pairs: DocumentPair[]): Promise<DriftReport[]> {
    const reports: DriftReport[] = [];

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];

      // Emit progress
      this.streamSender.send('stream:drift-progress', {
        completed: i,
        total: pairs.length,
        currentPair: [pair.parent, pair.child] as [string, string],
      });

      try {
        const report = await this.driftEngine.analyzePair(pair.parent, pair.child);
        reports.push(report);

        // Emit results incrementally if drifts found
        if (report.drifts.length > 0) {
          this.streamSender.send('stream:drift-alert', {
            id: report.id,
            severity: this.computeMaxSeverity(report.drifts),
            summary: `${report.drifts.length} drift(s) in ${pair.parent} <-> ${pair.child}`,
            documents: [pair.parent, pair.child],
            confidence: report.overallConfidence,
          });
        }
      } catch (error) {
        this.logger.error('manual-drift-check', 'Pair analysis failed', { pair, error });
        // Continue with remaining pairs
      }
    }

    // Final progress
    this.streamSender.send('stream:drift-progress', {
      completed: pairs.length,
      total: pairs.length,
      currentPair: ['', ''] as [string, string],
    });

    return reports;
  }

  private computeMaxSeverity(drifts: DriftResult[]): DriftSeverity {
    if (drifts.some((d) => d.severity === 'critical')) return 'critical';
    if (drifts.some((d) => d.severity === 'warning')) return 'warning';
    return 'info';
  }
}
```

### IPC Channel Additions

```typescript
// Additions to src/shared/ipc-channels.ts

// In IpcInvokeChannels:
'drift:check-multiple': {
  args: { pairs: Array<{ docA: string; docB: string }> };
  result: { reports: DriftReport[] };
};
'settings:update': {
  args: { key: string; value: unknown };
  result: void;
};

// In IpcStreamChannels:
'stream:drift-progress': {
  completed: number;
  total: number;
  currentPair: [string, string];
};
'stream:settings-changed': {
  key: string;
  value: unknown;
};
```

### Drift Store Pattern (Zustand)

```typescript
// src/renderer/src/features/drift/drift.store.ts
import { create } from 'zustand';
import { AsyncState } from '@shared/types/async-state.types';
import { DriftReport, DriftSeverity } from '@shared/types/drift.types';
import { AppError } from '@shared/types/error.types';

type DriftAlert = {
  id: string;
  severity: DriftSeverity;
  summary: string;
  documents: [string, string];
  confidence: number;
  isNew: boolean;
  timestamp: number;
};

type DriftCheckProgress = {
  completed: number;
  total: number;
  currentPair: [string, string];
};

type DriftState = {
  alerts: DriftAlert[];
  checkStatus: AsyncState<DriftReport[]>;
  checkProgress: DriftCheckProgress | null;
  threshold: number;

  addAlert: (alert: Omit<DriftAlert, 'isNew' | 'timestamp'>) => void;
  removeAlert: (id: string) => void;
  markAlertSeen: (id: string) => void;
  setCheckStatus: (status: AsyncState<DriftReport[]>) => void;
  setCheckProgress: (progress: DriftCheckProgress | null) => void;
  setThreshold: (threshold: number) => void;
};

export const useDriftStore = create<DriftState>((set) => ({
  alerts: [],
  checkStatus: { status: 'idle' },
  checkProgress: null,
  threshold: 50,

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        { ...alert, isNew: true, timestamp: Date.now() },
        ...state.alerts,
      ].sort((a, b) => b.confidence - a.confidence),
    })),

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),

  markAlertSeen: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, isNew: false } : a
      ),
    })),

  setCheckStatus: (checkStatus) => set({ checkStatus }),
  setCheckProgress: (checkProgress) => set({ checkProgress }),
  setThreshold: (threshold) => set({ threshold }),
}));
```

### DriftCheckDialog Component Pattern

```typescript
// src/renderer/src/features/drift/components/DriftCheckDialog.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@renderer/shared/components/ui/dialog';
import { Checkbox } from '@renderer/shared/components/ui/checkbox';
import { Button } from '@renderer/shared/components/ui/button';
import { useDriftStore } from '@renderer/features/drift/drift.store';

type DriftCheckDialogProps = {
  pairs: DocumentPair[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DriftCheckDialog({ pairs, open, onOpenChange }: DriftCheckDialogProps) {
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(
    new Set(pairs.map((_, i) => i))
  );

  const handleRun = async () => {
    const selected = pairs.filter((_, i) => selectedPairs.has(i));
    // Invoke drift:check-multiple IPC
    await window.electronAPI.invoke('drift:check-multiple', {
      pairs: selected.map((p) => ({ docA: p.parent, docB: p.child })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verifier le drift</DialogTitle>
        </DialogHeader>
        {/* Pair list with checkboxes */}
        {/* Run button */}
      </DialogContent>
    </Dialog>
  );
}
```

### Keyboard Shortcut Pattern

```typescript
// Register in App.tsx or a dedicated shortcuts hook
import { useEffect } from 'react';

export function useDriftShortcut(onTrigger: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        onTrigger();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTrigger]);
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Services | kebab-case + `.service.ts` | `manual-drift-check.service.ts` |
| Components | PascalCase.tsx | `DriftCheckDialog.tsx` |
| Stores | camelCase + `.store.ts` | `drift.store.ts` |
| Tests | same name + `.test.ts(x)` co-located | `DriftCheckDialog.test.tsx` |
| Hooks | camelCase, prefix `use` | `useDriftShortcut.ts` |
| IPC channels | namespace:action kebab | `'drift:check-multiple'` |

### Testing Strategy

**Unit tests (co-located):**
- `manual-drift-check.service.test.ts`:
  - Test: multiple pairs analyzed sequentially with progress emission
  - Test: error in one pair does not stop analysis of remaining pairs
  - Test: incremental results emitted as alerts
  - Test: progress stream shows correct completed/total counts
- `DriftCheckDialog.test.tsx`:
  - Test: renders all pairs with checkboxes
  - Test: select/deselect pairs
  - Test: run button triggers IPC with selected pairs only
  - Test: dialog closes on successful completion
- `DriftCheckProgress.test.tsx`:
  - Test: renders progress bar with correct percentage
  - Test: shows "Analyse en cours..." label
  - Test: displays current pair being analyzed
  - Test: updates in real-time as stream events arrive
- `DriftSettings.test.tsx`:
  - Test: slider renders with current threshold value
  - Test: changing slider triggers settings:update IPC
  - Test: value is clamped to 0-100 range
- `drift.store.test.ts`:
  - Test: addAlert sorts by confidence descending
  - Test: removeAlert filters correctly
  - Test: markAlertSeen toggles isNew flag
  - Test: setThreshold updates value

### What NOT to Do

- Do NOT require app restart for threshold changes — implement hot-reload
- Do NOT block UI during manual drift check — use streaming progress
- Do NOT allow threshold values outside 0-100 range — validate on both client and server
- Do NOT use `export default` — named exports only
- Do NOT use `any` for settings values — use proper typing with validation
- Do NOT run all pairs in parallel — run sequentially to avoid overwhelming the LLM API rate limits
- Do NOT forget to debounce in event-driven mode (Story 4.2) but do NOT debounce manual triggers — manual checks run immediately
- Do NOT skip error handling for individual pair failures during manual check — continue with remaining pairs

### References

- [Source: architecture.md#IPC-Channel-Design] — `drift:check` channel, IPC invoke pattern
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, useIpcStream hook
- [Source: architecture.md#Local-Data-Persistence] — `.mnm/settings.json` structure, atomic writes
- [Source: architecture.md#Process-Patterns] — Error handling, AsyncState pattern
- [Source: ux-design-specification.md#Keyboard-Shortcuts] — `Cmd+Shift+D` for drift panel toggle
- [Source: ux-design-specification.md#Feedback-Patterns] — Progress bar for operations, toast for results
- [Source: ux-design-specification.md#Empty-States-Loading] — "Analyse en cours..." loading state
- [Source: ux-design-specification.md#Component-Strategy] — shadcn/ui Dialog, Checkbox, Button
- [Source: epics.md#Story-4.3] — Full acceptance criteria

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
