# Story 4.5: Resolution de Drift

Status: ready-for-dev

## Story

As a **user**,
I want **to resolve a drift directly from the alert by choosing which document to correct or ignoring it**,
So that **I can maintain document alignment without leaving MnM**.

## Acceptance Criteria

### AC1 — Fix source document

**Given** je suis dans la vue detail d'un drift
**When** je clique sur "Corriger le document source"
**Then** MnM ouvre le document source en mode lecture avec les sections en drift mises en evidence
**And** un bouton permet de demander a un agent de corriger le document (FR18)

### AC2 — Fix derived document

**Given** je suis dans la vue detail d'un drift
**When** je clique sur "Corriger le document derive"
**Then** MnM ouvre le document derive en mode lecture avec les sections en drift mises en evidence
**And** un bouton permet de demander a un agent de corriger le document (FR18)

### AC3 — Ignore drift

**Given** je suis dans la vue detail d'un drift
**When** je clique sur "Ignorer"
**Then** l'alerte est marquee comme resolue (ignoree) et disparait avec fade-out (FR18)
**And** le drift est enregistre comme ignore dans le cache (ne reapparait pas sauf changement)

### AC4 — Counter update after resolution

**Given** un drift est resolu (corrige ou ignore)
**When** le compteur de drifts se met a jour
**Then** le badge dans le header/cockpit est decremente
**And** la `DriftAlert` disparait de la liste

## Tasks / Subtasks

- [ ] Task 1: Implement drift:resolve IPC handler (AC: #1, #2, #3)
  - [ ] 1.1 Add `drift:resolve` channel handler in `src/main/ipc/handlers.ts`
  - [ ] 1.2 Handle action `'fix-source'`: mark drift as pending resolution on source document
  - [ ] 1.3 Handle action `'fix-derived'`: mark drift as pending resolution on derived document
  - [ ] 1.4 Handle action `'ignore'`: mark drift as ignored in cache, update resolution history
  - [ ] 1.5 Emit `stream:drift-resolved` to renderer with `{ driftId: string; action: string }`
  - [ ] 1.6 Write handler tests for all 3 actions

- [ ] Task 2: Implement drift resolution service (AC: #1, #2, #3)
  - [ ] 2.1 Create `src/main/services/drift/drift-resolution.service.ts`
  - [ ] 2.2 Implement `resolveDrift(driftId: string, action: 'fix-source' | 'fix-derived' | 'ignore', content?: string): Promise<void>`
  - [ ] 2.3 For `'ignore'`: update drift cache entry with `{ resolved: true, action: 'ignore', resolvedAt: timestamp }`
  - [ ] 2.4 For `'fix-source'` / `'fix-derived'`: write resolved content back to the target file (atomic write: temp + rename)
  - [ ] 2.5 After resolution: update drift cache to mark as resolved
  - [ ] 2.6 Emit `drift:resolved` event on main event bus
  - [ ] 2.7 Write `drift-resolution.service.test.ts`

- [ ] Task 3: Implement resolution history (AC: #3)
  - [ ] 3.1 Create `src/main/services/drift/drift-history.service.ts`
  - [ ] 3.2 Store resolution history in `.mnm/drift-cache/history.json`
  - [ ] 3.3 Schema: `{ driftId: string; documentA: string; documentB: string; action: string; resolvedAt: number; resolvedBy: 'user' | 'agent' }[]`
  - [ ] 3.4 Implement `addResolution(entry: ResolutionEntry): Promise<void>` — atomic append
  - [ ] 3.5 Implement `getHistory(): Promise<ResolutionEntry[]>` — read history
  - [ ] 3.6 Implement `isIgnored(documentA: string, documentB: string, driftHash: string): boolean` — check if a specific drift was previously ignored (prevents re-alerting)
  - [ ] 3.7 Write `drift-history.service.test.ts`

- [ ] Task 4: Create DriftResolutionPanel component (AC: #1, #2)
  - [ ] 4.1 Create `src/renderer/src/features/drift/components/DriftResolutionPanel.tsx`
  - [ ] 4.2 Display the target document (source or derived) in read mode with drift sections highlighted
  - [ ] 4.3 Show drift annotations in a sidebar: type, description, confidence score
  - [ ] 4.4 Add "Demander a un agent de corriger" button — triggers agent launch with correction task
  - [ ] 4.5 Add "Marquer comme resolu" button — manually marks drift as resolved
  - [ ] 4.6 Show resolution confirmation toast on success
  - [ ] 4.7 Write `DriftResolutionPanel.test.tsx`

- [ ] Task 5: Implement agent-assisted correction (AC: #1, #2)
  - [ ] 5.1 Create `src/renderer/src/features/drift/components/AgentCorrectionDialog.tsx`
  - [ ] 5.2 Dialog shows: which document to correct, drift summary, suggested correction prompt
  - [ ] 5.3 "Lancer" button triggers `agent:launch` IPC with task = correction of the document based on drift analysis
  - [ ] 5.4 Task payload includes: document path, drift description, parent/child context
  - [ ] 5.5 After agent launch: show toast "Agent lance pour corriger {document}"
  - [ ] 5.6 Write `AgentCorrectionDialog.test.tsx`

- [ ] Task 6: Wire ignore action with cache and UI (AC: #3, #4)
  - [ ] 6.1 When "Ignorer" is clicked: invoke `drift:resolve` with action `'ignore'`
  - [ ] 6.2 On success: call `useDriftStore.removeAlert(driftId)` — alert disappears with fade-out 200ms
  - [ ] 6.3 Update drift history via `drift-history.service.ts`
  - [ ] 6.4 The ignored drift does not reappear on next file change (checked against history)
  - [ ] 6.5 If the document content changes after ignore, the drift CAN reappear (different content hash)
  - [ ] 6.6 Write integration test for ignore flow

- [ ] Task 7: Wire resolution to alert counter (AC: #4)
  - [ ] 7.1 Create `src/renderer/src/features/drift/hooks/useDriftResolution.ts`
  - [ ] 7.2 Subscribe to `stream:drift-resolved` via `useIpcStream`
  - [ ] 7.3 On resolution event: call `useDriftStore.removeAlert(driftId)`
  - [ ] 7.4 Badge counter in header decrements automatically (via store reactivity)
  - [ ] 7.5 Badge uses number animation 300ms on change
  - [ ] 7.6 Write `useDriftResolution.test.ts`

- [ ] Task 8: Integrate resolution into DriftDiffView (AC: #1, #2, #3)
  - [ ] 8.1 Add resolution buttons to `DriftDiffView` (from Story 4.4): "Corriger la source", "Corriger le derive", "Ignorer"
  - [ ] 8.2 "Corriger la source" opens `DriftResolutionPanel` focused on source document
  - [ ] 8.3 "Corriger le derive" opens `DriftResolutionPanel` focused on derived document
  - [ ] 8.4 "Ignorer" invokes resolution directly and closes DriftDiffView
  - [ ] 8.5 After any resolution: close DriftDiffView and show toast confirmation
  - [ ] 8.6 Write integration tests for DriftDiffView resolution flow

- [ ] Task 9: Add IPC channels and stream types (AC: #1, #2, #3, #4)
  - [ ] 9.1 Verify `drift:resolve` channel in `IpcInvokeChannels`: `{ args: { driftId: string; action: 'fix-source' | 'fix-derived' | 'ignore'; content?: string }; result: void }`
  - [ ] 9.2 Add `stream:drift-resolved` to `IpcStreamChannels`: `{ driftId: string; action: 'fix-source' | 'fix-derived' | 'ignore' }`
  - [ ] 9.3 Add `drift:get-resolution-history` to `IpcInvokeChannels`: `{ args: void; result: ResolutionEntry[] }`

## Dev Notes

### FRs Covered

- **FR18** — Resoudre un drift depuis l'alerte (corriger le document source, corriger le document derive, ou ignorer)

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus, `AppError`, import aliases
- **Story 2.1** — Agent harness (`agent:launch` IPC) for agent-assisted correction
- **Story 4.1** — `DriftEngineService`, `DriftCacheService`, `DriftReport` types
- **Story 4.2** — `DriftWatcherService`, drift history integration (ignored drifts not re-alerted)
- **Story 4.3** — `drift.store.ts` (Zustand store), `DriftPanel`
- **Story 4.4** — `DriftAlert`, `DriftDiffView`, `DriftAlertList` components

### Technical Architecture

**Resolution flow — Ignore:**
```
User clicks "Ignorer" (DriftAlert or DriftDiffView)
  -> invoke drift:resolve IPC { driftId, action: 'ignore' }
    -> DriftResolutionService.resolveDrift()
      -> Update drift cache: { resolved: true, action: 'ignore', resolvedAt }
      -> Add to resolution history
      -> Emit drift:resolved event on main bus
        -> stream:drift-resolved to renderer
          -> useDriftStore.removeAlert(driftId)
            -> DriftAlertList re-renders (alert gone, badge decremented)
  -> Toast: "Drift ignore"
```

**Resolution flow — Fix (agent-assisted):**
```
User clicks "Corriger la source" or "Corriger le derive" (DriftDiffView)
  -> DriftResolutionPanel opens with target document
    -> User clicks "Demander a un agent de corriger"
      -> AgentCorrectionDialog opens
        -> User clicks "Lancer"
          -> invoke agent:launch IPC { task: correction prompt, context: [docPath] }
          -> Toast: "Agent lance pour corriger {document}"
          -> Agent runs correction (async, monitored via Epic 2)
          -> When agent writes corrected file:
            -> File watcher detects change (Story 3.1)
            -> Drift re-analysis triggered (Story 4.2)
            -> If drift is resolved, no new alert
```

**Resolution flow — Fix (manual content write):**
```
(Post-MVP: user edits content directly)
  -> invoke drift:resolve IPC { driftId, action: 'fix-source', content: correctedContent }
    -> DriftResolutionService writes content to file (atomic write)
    -> File watcher detects change -> drift re-analysis
```

**File structure for this story:**
```
src/
  main/
    services/
      drift/
        drift-resolution.service.ts       # Resolution logic (ignore, fix-source, fix-derived)
        drift-resolution.service.test.ts
        drift-history.service.ts           # Resolution history storage
        drift-history.service.test.ts
  renderer/
    src/
      features/
        drift/
          components/
            DriftResolutionPanel.tsx        # Document view with drift highlights + resolution actions
            DriftResolutionPanel.test.tsx
            AgentCorrectionDialog.tsx       # Dialog to launch agent for correction
            AgentCorrectionDialog.test.tsx
          hooks/
            useDriftResolution.ts           # Stream listener for drift:resolved
            useDriftResolution.test.ts
  shared/
    ipc-channels.ts                        # Add drift:resolve, stream:drift-resolved, drift:get-resolution-history
```

### DriftResolutionService Pattern

```typescript
// src/main/services/drift/drift-resolution.service.ts
import { DriftCacheService } from '@main/services/drift/drift-cache.service';
import { DriftHistoryService } from '@main/services/drift/drift-history.service';
import { AppError } from '@shared/types/error.types';
import { writeFile, rename } from 'fs/promises';

type ResolveAction = 'fix-source' | 'fix-derived' | 'ignore';

export class DriftResolutionService {
  constructor(
    private cacheService: DriftCacheService,
    private historyService: DriftHistoryService,
    private eventBus: TypedEventEmitter,
    private streamSender: StreamSender,
    private logger: Logger,
  ) {}

  async resolveDrift(
    driftId: string,
    action: ResolveAction,
    content?: string,
  ): Promise<void> {
    this.logger.info('drift-resolution', 'Resolving drift', { driftId, action });

    switch (action) {
      case 'ignore':
        await this.handleIgnore(driftId);
        break;
      case 'fix-source':
      case 'fix-derived':
        await this.handleFix(driftId, action, content);
        break;
      default:
        throw {
          code: 'DRIFT_INVALID_ACTION',
          message: `Invalid resolution action: ${action}`,
          source: 'drift-resolution',
        } satisfies AppError;
    }

    // Notify renderer
    this.streamSender.send('stream:drift-resolved', { driftId, action });

    // Emit internal event
    this.eventBus.emit('drift:resolved', { driftId, action });
  }

  private async handleIgnore(driftId: string): Promise<void> {
    // Update cache with resolution status
    await this.cacheService.markResolved(driftId, 'ignore');

    // Add to history
    await this.historyService.addResolution({
      driftId,
      action: 'ignore',
      resolvedAt: Date.now(),
      resolvedBy: 'user',
    });
  }

  private async handleFix(
    driftId: string,
    action: 'fix-source' | 'fix-derived',
    content?: string,
  ): Promise<void> {
    if (content) {
      // Direct content write (manual fix)
      const report = await this.cacheService.getReportById(driftId);
      if (!report) {
        throw {
          code: 'DRIFT_NOT_FOUND',
          message: `Drift report not found: ${driftId}`,
          source: 'drift-resolution',
        } satisfies AppError;
      }

      const targetPath = action === 'fix-source' ? report.documentA : report.documentB;

      // Atomic write: temp + rename
      const tempPath = `${targetPath}.tmp`;
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, targetPath);

      this.logger.info('drift-resolution', 'Document corrected', { targetPath, action });
    }

    // Update cache
    await this.cacheService.markResolved(driftId, action);

    // Add to history
    await this.historyService.addResolution({
      driftId,
      action,
      resolvedAt: Date.now(),
      resolvedBy: content ? 'user' : 'agent',
    });
  }
}
```

### DriftHistoryService Pattern

```typescript
// src/main/services/drift/drift-history.service.ts
import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import { join } from 'path';

export type ResolutionEntry = {
  driftId: string;
  documentA?: string;
  documentB?: string;
  driftHash?: string;
  action: 'fix-source' | 'fix-derived' | 'ignore';
  resolvedAt: number;
  resolvedBy: 'user' | 'agent';
};

export class DriftHistoryService {
  private historyPath: string;

  constructor(cacheDir: string) {
    this.historyPath = join(cacheDir, 'history.json');
  }

  async addResolution(entry: ResolutionEntry): Promise<void> {
    const history = await this.getHistory();
    history.push(entry);

    // Atomic write
    await mkdir(join(this.historyPath, '..'), { recursive: true });
    const tempPath = `${this.historyPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(history, null, 2), 'utf-8');
    await rename(tempPath, this.historyPath);
  }

  async getHistory(): Promise<ResolutionEntry[]> {
    try {
      const raw = await readFile(this.historyPath, 'utf-8');
      return JSON.parse(raw) as ResolutionEntry[];
    } catch {
      return [];
    }
  }

  async isIgnored(documentA: string, documentB: string, driftHash: string): Promise<boolean> {
    const history = await this.getHistory();
    return history.some(
      (entry) =>
        entry.action === 'ignore' &&
        entry.documentA === documentA &&
        entry.documentB === documentB &&
        entry.driftHash === driftHash
    );
  }
}
```

### DriftResolutionPanel Component Pattern

```typescript
// src/renderer/src/features/drift/components/DriftResolutionPanel.tsx
import { useState } from 'react';
import { Button } from '@renderer/shared/components/ui/button';
import { DriftResult } from '@shared/types/drift.types';

type DriftResolutionPanelProps = {
  documentPath: string;
  documentContent: string;
  documentLabel: 'source' | 'derived';
  drifts: DriftResult[];
  onRequestAgentFix: () => void;
  onMarkResolved: () => void;
  onClose: () => void;
};

export function DriftResolutionPanel({
  documentPath,
  documentContent,
  documentLabel,
  drifts,
  onRequestAgentFix,
  onMarkResolved,
  onClose,
}: DriftResolutionPanelProps) {
  return (
    <div className="flex h-full">
      {/* Document view with highlighted drift sections */}
      <div className="flex-1 overflow-auto p-4">
        <div className="text-text-muted text-xs mb-2">{documentPath}</div>
        <div className="font-mono text-sm text-text-primary whitespace-pre-wrap">
          {/* Render content with drift highlights */}
          {/* Each drift section gets a colored background + annotation */}
        </div>
      </div>

      {/* Drift annotations sidebar */}
      <div className="w-72 border-l border-border-default p-4 overflow-auto">
        <h3 className="text-text-primary text-md font-semibold mb-4">
          Drifts ({drifts.length})
        </h3>

        {drifts.map((drift) => (
          <div key={drift.id} className="mb-3 p-2 rounded bg-bg-elevated">
            <div className="text-text-primary text-sm font-medium">{drift.type}</div>
            <p className="text-text-secondary text-xs mt-1">{drift.description}</p>
            <div className="text-text-muted text-xs mt-1">
              Confiance: {drift.confidence}%
            </div>
          </div>
        ))}

        <div className="mt-6 space-y-2">
          <Button
            variant="default"
            className="w-full"
            onClick={onRequestAgentFix}
          >
            Demander a un agent de corriger
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={onMarkResolved}
          >
            Marquer comme resolu
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### AgentCorrectionDialog Pattern

```typescript
// src/renderer/src/features/drift/components/AgentCorrectionDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/shared/components/ui/dialog';
import { Button } from '@renderer/shared/components/ui/button';

type AgentCorrectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentPath: string;
  driftSummary: string;
  onLaunch: () => void;
};

export function AgentCorrectionDialog({
  open,
  onOpenChange,
  documentPath,
  driftSummary,
  onLaunch,
}: AgentCorrectionDialogProps) {
  const handleLaunch = async () => {
    await window.electronAPI.invoke('agent:launch', {
      task: `Corriger le document ${documentPath} pour resoudre le drift suivant: ${driftSummary}`,
      context: [documentPath],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correction par agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-text-secondary text-sm">
            Un agent va etre lance pour corriger le document:
          </div>
          <div className="bg-bg-elevated p-3 rounded text-text-primary text-sm font-mono">
            {documentPath}
          </div>
          <div className="text-text-secondary text-sm">
            Drift a corriger:
          </div>
          <div className="bg-bg-elevated p-3 rounded text-text-secondary text-sm">
            {driftSummary}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button variant="default" onClick={handleLaunch}>
              Lancer l&apos;agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### IPC Channel Additions

```typescript
// Additions/verifications in src/shared/ipc-channels.ts

// In IpcInvokeChannels:
'drift:resolve': {
  args: { driftId: string; action: 'fix-source' | 'fix-derived' | 'ignore'; content?: string };
  result: void;
};
'drift:get-resolution-history': {
  args: void;
  result: ResolutionEntry[];
};

// In IpcStreamChannels:
'stream:drift-resolved': {
  driftId: string;
  action: 'fix-source' | 'fix-derived' | 'ignore';
};
```

### Ignore vs. Content-Change Re-alerting Logic

A drift marked as "ignore" should NOT reappear unless the document content changes. This is achieved by:
1. When ignoring: store `{ driftId, documentA, documentB, driftHash }` in history
2. `driftHash` = hash of the specific drift (based on the concepts and type, not file content)
3. When DriftWatcherService detects a new drift, check against history: `isIgnored(docA, docB, driftHash)`
4. If document content changes (new hash), the driftHash will be different -> the drift CAN reappear
5. This prevents stale ignores from suppressing real new drifts

### Toast Feedback for Resolutions

```typescript
// Toast messages per action
// [Source: ux-design-specification.md#Feedback-Patterns]

// Ignore:
{ type: 'success', message: 'Drift ignore', duration: 3000 }  // auto-dismiss

// Fix via agent:
{ type: 'success', message: 'Agent lance pour corriger {document}', duration: 3000 }

// Manual resolve:
{ type: 'success', message: 'Drift marque comme resolu', duration: 3000 }
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Services | kebab-case + `.service.ts` | `drift-resolution.service.ts` |
| Components | PascalCase.tsx | `DriftResolutionPanel.tsx` |
| Tests | same name + `.test.ts(x)` co-located | `drift-resolution.service.test.ts` |
| Hooks | camelCase, prefix `use` | `useDriftResolution.ts` |
| IPC channels | namespace:action kebab | `'drift:resolve'` |
| Error codes | UPPER_SNAKE_CASE | `DRIFT_INVALID_ACTION`, `DRIFT_NOT_FOUND` |

### Testing Strategy

**Unit tests (co-located):**
- `drift-resolution.service.test.ts`:
  - Test: ignore action updates cache and adds to history
  - Test: fix-source with content writes to source file atomically
  - Test: fix-derived with content writes to derived file atomically
  - Test: fix without content (agent mode) only updates cache/history
  - Test: invalid action throws `AppError` with code `DRIFT_INVALID_ACTION`
  - Test: unknown driftId throws `AppError` with code `DRIFT_NOT_FOUND`
  - Test: `stream:drift-resolved` emitted on success
  - Test: `drift:resolved` event emitted on main bus
- `drift-history.service.test.ts`:
  - Test: addResolution appends to history file
  - Test: getHistory returns empty array when no file exists
  - Test: getHistory returns parsed history
  - Test: isIgnored returns true for matching ignored drift
  - Test: isIgnored returns false for different document pair
  - Test: atomic write (temp file created then renamed)
- `DriftResolutionPanel.test.tsx`:
  - Test: renders document content with drift highlights
  - Test: renders drift annotations in sidebar
  - Test: "Demander a un agent" button calls onRequestAgentFix
  - Test: "Marquer comme resolu" button calls onMarkResolved
- `AgentCorrectionDialog.test.tsx`:
  - Test: renders document path and drift summary
  - Test: "Lancer" button triggers `agent:launch` IPC with correct task
  - Test: dialog closes after launch
  - Test: "Annuler" button closes dialog without action
- `useDriftResolution.test.ts`:
  - Test: subscribes to `stream:drift-resolved` on mount
  - Test: removes alert from store on resolution event
  - Test: cleans up subscription on unmount

### What NOT to Do

- Do NOT implement a full document editor — this story shows documents in READ mode with highlights only
- Do NOT auto-resolve drifts — always require user decision (ignore, fix-source, fix-derived)
- Do NOT lose the ignore status when the app restarts — persist in `.mnm/drift-cache/history.json`
- Do NOT use `export default` — named exports only
- Do NOT use `any` — type all resolution actions, history entries, IPC payloads
- Do NOT modify documents without atomic writes (temp + rename) — data safety is critical
- Do NOT forget to emit `stream:drift-resolved` after resolution — the renderer needs to update the badge counter
- Do NOT re-alert for ignored drifts unless the document content has actually changed
- Do NOT implement inline editing of documents in the resolution panel — that is post-MVP. For now, corrections go through agent assistance

### References

- [Source: architecture.md#IPC-Channel-Design] — `drift:resolve` channel definition with 3 actions
- [Source: architecture.md#Local-Data-Persistence] — `.mnm/drift-cache/` directory, atomic write pattern (temp + rename)
- [Source: architecture.md#Process-Patterns] — Error handling (AppError), logging format
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern
- [Source: ux-design-specification.md#Journey-2] — Gabri's drift journey: step 4 (resolution) = 3 boutons
- [Source: ux-design-specification.md#Custom-Components] — DriftAlert spec (3 boutons: Voir/Corriger/Ignorer)
- [Source: ux-design-specification.md#Feedback-Patterns] — Toast auto-dismiss 3s for success actions
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Fade-out 200ms for alert dismissal, badge count animation 300ms
- [Source: ux-design-specification.md#Button-Hierarchy] — Destructive actions need Dialog confirmation (ignore = soft, no confirmation needed)
- [Source: epics.md#Story-4.5] — Full acceptance criteria
- [Source: epics.md#Story-2.1] — Agent harness (`agent:launch` IPC) dependency for agent-assisted correction

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
