# Story 4.4: Alerte Drift & Vue Diff

Status: ready-for-dev

## Story

As a **user**,
I want **to see actionable drift alerts with the exact diff between conflicting documents**,
So that **I understand precisely what has drifted and where**.

## Acceptance Criteria

### AC1 — DriftAlert card with severity and actions

**Given** un drift est detecte au-dessus du seuil de confiance
**When** l'alerte apparait
**Then** je vois une `DriftAlert` card avec : icone, titre (paire de documents), resume du drift, score de confiance (FR17)
**And** 3 boutons d'action : "Voir", "Corriger", "Ignorer"

### AC2 — DriftDiffView split view

**Given** je clique sur "Voir" dans une `DriftAlert`
**When** la vue detail s'ouvre
**Then** je vois un `DriftDiffView` en split view : document source (gauche) vs document derive (droite)
**And** les differences sont mises en surbrillance (FR17)

### AC3 — New alert badge and accessibility

**Given** une alerte drift est nouvelle
**When** elle apparait pour la premiere fois
**Then** elle a un badge "Nouveau" et est visuellement distincte
**And** `aria-live="polite"` annonce la nouvelle alerte

### AC4 — Sorted alert list

**Given** plusieurs drifts sont detectes
**When** je regarde la liste des alertes
**Then** elles sont triees par score de confiance (plus haut en premier)

## Tasks / Subtasks

- [ ] Task 1: Create DriftAlert component (AC: #1, #3, #4)
  - [ ] 1.1 Create `src/renderer/src/features/drift/components/DriftAlert.tsx`
  - [ ] 1.2 Render alert card with: severity icon (warning triangle for critical/warning, info circle for info), title (document pair names), drift summary text, confidence score badge
  - [ ] 1.3 Add 3 action buttons: "Voir" (secondary), "Corriger" (primary), "Ignorer" (ghost)
  - [ ] 1.4 Implement "Nouveau" badge for new (unseen) alerts
  - [ ] 1.5 Apply severity-based styling: critical = `--status-red` border, warning = `--status-orange` border, info = `--border-default`
  - [ ] 1.6 Add `role="alert"` and `aria-live="polite"` for accessibility
  - [ ] 1.7 Write `DriftAlert.test.tsx`

- [ ] Task 2: Create DriftAlertList component (AC: #4)
  - [ ] 2.1 Create `src/renderer/src/features/drift/components/DriftAlertList.tsx`
  - [ ] 2.2 Subscribe to `useDriftStore` for alert list
  - [ ] 2.3 Render alerts sorted by confidence (highest first) — sorting is done in store
  - [ ] 2.4 Empty state: green indicator + "Aucun drift detecte"
  - [ ] 2.5 Display drift count badge in header
  - [ ] 2.6 New alerts animate in with slide-in 150ms + fade
  - [ ] 2.7 Write `DriftAlertList.test.tsx`

- [ ] Task 3: Implement DriftDiffView component (AC: #2)
  - [ ] 3.1 Create `src/renderer/src/features/drift/components/DriftDiffView.tsx`
  - [ ] 3.2 Implement split view (side-by-side): source document (left) vs derived document (right)
  - [ ] 3.3 Fetch document contents via IPC: add `drift:get-diff` channel with args `{ reportId: string }` returning `{ sourceContent: string; derivedContent: string; drifts: DriftResult[] }`
  - [ ] 3.4 Highlight drift sections: background tint `--status-red` at 10% opacity for contradictions, `--status-orange` at 10% for missing/outdated
  - [ ] 3.5 Show drift annotations inline: type badge + description + confidence score per drift
  - [ ] 3.6 Implement scroll sync between left and right panes
  - [ ] 3.7 Add header with document names and close button
  - [ ] 3.8 Write `DriftDiffView.test.tsx`

- [ ] Task 4: Implement diff data service (AC: #2)
  - [ ] 4.1 Add `drift:get-diff` IPC channel to `src/shared/ipc-channels.ts`
  - [ ] 4.2 Implement handler in `src/main/ipc/handlers.ts` — reads both documents, retrieves cached DriftReport, returns contents + drift annotations
  - [ ] 4.3 Map drift results to line ranges for highlighting
  - [ ] 4.4 Write handler test

- [ ] Task 5: Wire DriftAlert actions (AC: #1)
  - [ ] 5.1 "Voir" button: opens `DriftDiffView` as overlay/drawer panel
  - [ ] 5.2 "Corriger" button: opens `DriftDiffView` with resolution mode enabled (connects to Story 4.5)
  - [ ] 5.3 "Ignorer" button: calls `drift:resolve` IPC with action `'ignore'` (implemented in Story 4.5), removes alert from list with fade-out 200ms
  - [ ] 5.4 Mark alert as seen when any action button is clicked
  - [ ] 5.5 Write action handler tests

- [ ] Task 6: Create severity indicator component (AC: #1)
  - [ ] 6.1 Create `src/renderer/src/features/drift/components/DriftSeverityBadge.tsx`
  - [ ] 6.2 Render severity badge: "Critique" (red), "Attention" (orange), "Info" (gray)
  - [ ] 6.3 Include confidence score as percentage text
  - [ ] 6.4 Use `Badge` from shadcn/ui with custom color variants
  - [ ] 6.5 Write `DriftSeverityBadge.test.tsx`

- [ ] Task 7: Create confidence score display (AC: #1)
  - [ ] 7.1 Create `src/renderer/src/features/drift/components/ConfidenceScore.tsx`
  - [ ] 7.2 Render confidence as percentage with color gradient: 80-100 red, 50-79 orange, 0-49 gray
  - [ ] 7.3 Small circular indicator or bar visualization
  - [ ] 7.4 Accessible: `aria-label="Score de confiance: {n}%"`
  - [ ] 7.5 Write `ConfidenceScore.test.tsx`

- [ ] Task 8: Wire stream listeners in drift store (AC: #3, #4)
  - [ ] 8.1 Create `src/renderer/src/features/drift/hooks/useDriftAlerts.ts`
  - [ ] 8.2 Subscribe to `stream:drift-alert` via `useIpcStream`
  - [ ] 8.3 On new alert: call `useDriftStore.addAlert()` — store handles sorting by confidence
  - [ ] 8.4 On alert received: trigger `aria-live` announcement
  - [ ] 8.5 Write `useDriftAlerts.test.ts`

- [ ] Task 9: Integrate drift alerts into layout (AC: #1, #4)
  - [ ] 9.1 Add `DriftAlertList` to the Tests/Validation pane (right pane, tab or section)
  - [ ] 9.2 Add drift badge counter in app header showing active alert count
  - [ ] 9.3 Badge uses number animation (300ms) when count changes
  - [ ] 9.4 `DriftDiffView` opens as overlay panel (drawer from right) above existing content
  - [ ] 9.5 Ensure layout integration respects existing 3-pane structure

## Dev Notes

### FRs Covered

- **FR17** — Alerte actionnable avec diff exact entre documents concernes

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, event bus, `AppError`, import aliases, shadcn/ui
- **Story 1.2** — Three-pane layout (DriftAlertList goes in right pane)
- **Story 4.1** — `DriftReport`, `DriftResult`, `DriftSeverity` types, drift cache (for retrieving reports)
- **Story 4.2** — `stream:drift-alert` emission, `DriftWatcherService`
- **Story 4.3** — `drift.store.ts` (Zustand store for drift feature), `DriftPanel`

### Technical Architecture

**Component hierarchy:**
```
ThreePaneLayout (Story 1.2)
  -> Right Pane (Tests/Validation)
    -> DriftAlertList
      -> DriftAlert (per alert)
        -> DriftSeverityBadge
        -> ConfidenceScore
        -> Action buttons (Voir/Corriger/Ignorer)

DriftDiffView (overlay/drawer)
  -> Split view: source | derived
  -> Highlighted diff sections
  -> Drift annotations
  -> Resolution actions (connects to Story 4.5)
```

**Data flow:**
```
stream:drift-alert (IPC)
  -> useDriftAlerts hook
    -> useDriftStore.addAlert()
      -> DriftAlertList re-renders (sorted by confidence)
        -> DriftAlert card with actions

User clicks "Voir"
  -> invoke drift:get-diff IPC
    -> Main reads documents + cached DriftReport
    -> Returns contents + drift annotations
  -> DriftDiffView opens with data
```

**File structure for this story:**
```
src/
  renderer/
    src/
      features/
        drift/
          components/
            DriftAlert.tsx                # Individual alert card
            DriftAlert.test.tsx
            DriftAlertList.tsx            # List of alerts (sorted)
            DriftAlertList.test.tsx
            DriftDiffView.tsx             # Split diff view
            DriftDiffView.test.tsx
            DriftSeverityBadge.tsx        # Severity indicator
            DriftSeverityBadge.test.tsx
            ConfidenceScore.tsx           # Score display
            ConfidenceScore.test.tsx
          hooks/
            useDriftAlerts.ts            # Stream listener hook
            useDriftAlerts.test.ts
  shared/
    ipc-channels.ts                      # Add drift:get-diff channel
```

### DriftAlert Component Pattern

```typescript
// src/renderer/src/features/drift/components/DriftAlert.tsx
import { DriftSeverityBadge } from '@renderer/features/drift/components/DriftSeverityBadge';
import { ConfidenceScore } from '@renderer/features/drift/components/ConfidenceScore';
import { Button } from '@renderer/shared/components/ui/button';
import { Badge } from '@renderer/shared/components/ui/badge';
import { DriftSeverity } from '@shared/types/drift.types';

type DriftAlertProps = {
  id: string;
  severity: DriftSeverity;
  summary: string;
  documents: [string, string];
  confidence: number;
  isNew: boolean;
  onView: (id: string) => void;
  onFix: (id: string) => void;
  onIgnore: (id: string) => void;
};

export function DriftAlert({
  id,
  severity,
  summary,
  documents,
  confidence,
  isNew,
  onView,
  onFix,
  onIgnore,
}: DriftAlertProps) {
  const borderColor = {
    critical: 'border-status-red',
    warning: 'border-status-orange',
    info: 'border-border-default',
  }[severity];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-lg border-l-4 ${borderColor} bg-bg-surface p-3 space-y-2`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DriftSeverityBadge severity={severity} />
          {isNew && (
            <Badge variant="secondary" className="text-xs">
              Nouveau
            </Badge>
          )}
        </div>
        <ConfidenceScore value={confidence} />
      </div>

      <div className="text-text-primary text-sm font-medium">
        {documents[0]} &harr; {documents[1]}
      </div>

      <p className="text-text-secondary text-sm">{summary}</p>

      <div className="flex gap-2 pt-1">
        <Button variant="secondary" size="sm" onClick={() => onView(id)}>
          Voir
        </Button>
        <Button variant="default" size="sm" onClick={() => onFix(id)}>
          Corriger
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onIgnore(id)}>
          Ignorer
        </Button>
      </div>
    </div>
  );
}
```

### DriftDiffView Component Pattern

```typescript
// src/renderer/src/features/drift/components/DriftDiffView.tsx
import { useEffect, useState, useRef } from 'react';
import { DriftResult } from '@shared/types/drift.types';
import { AsyncState } from '@shared/types/async-state.types';
import { Button } from '@renderer/shared/components/ui/button';
import { ScrollArea } from '@renderer/shared/components/ui/scroll-area';

type DiffData = {
  sourceContent: string;
  derivedContent: string;
  drifts: DriftResult[];
};

type DriftDiffViewProps = {
  reportId: string;
  sourceDocName: string;
  derivedDocName: string;
  onClose: () => void;
  onResolve?: (driftId: string, action: 'fix-source' | 'fix-derived' | 'ignore') => void;
};

export function DriftDiffView({
  reportId,
  sourceDocName,
  derivedDocName,
  onClose,
  onResolve,
}: DriftDiffViewProps) {
  const [diffState, setDiffState] = useState<AsyncState<DiffData>>({ status: 'loading' });
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.electronAPI
      .invoke('drift:get-diff', { reportId })
      .then((data) => setDiffState({ status: 'success', data }))
      .catch((error) => setDiffState({ status: 'error', error }));
  }, [reportId]);

  // Scroll sync: when left scrolls, sync right and vice versa
  const handleScroll = (source: 'left' | 'right') => {
    // Implementation of scroll synchronization
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-base/80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <h2 className="text-text-primary text-lg font-semibold">
          Drift: {sourceDocName} &harr; {derivedDocName}
        </h2>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </div>

      {/* Split view */}
      <div className="flex-1 flex">
        {/* Left: Source document */}
        <div className="flex-1 border-r border-border-default">
          <div className="p-2 bg-bg-elevated text-text-secondary text-sm font-medium">
            {sourceDocName} (source)
          </div>
          <ScrollArea ref={leftRef} className="p-4">
            {/* Render source content with drift highlights */}
          </ScrollArea>
        </div>

        {/* Right: Derived document */}
        <div className="flex-1">
          <div className="p-2 bg-bg-elevated text-text-secondary text-sm font-medium">
            {derivedDocName} (derive)
          </div>
          <ScrollArea ref={rightRef} className="p-4">
            {/* Render derived content with drift highlights */}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
```

### DriftAlertList Empty State Pattern

```typescript
// Empty state when no drifts detected
// [Source: ux-design-specification.md#Empty-States-Loading]
<div className="flex flex-col items-center justify-center py-8 text-text-muted">
  <div className="w-3 h-3 rounded-full bg-status-green mb-2" />
  <p className="text-sm">Aucun drift detecte</p>
</div>
```

### Drift Highlight Pattern

For highlighting drift sections in the DriftDiffView:
```css
/* Contradiction: red tint */
.drift-highlight-critical {
  background-color: color-mix(in srgb, var(--status-red) 10%, transparent);
  border-left: 2px solid var(--status-red);
}

/* Missing/outdated: orange tint */
.drift-highlight-warning {
  background-color: color-mix(in srgb, var(--status-orange) 10%, transparent);
  border-left: 2px solid var(--status-orange);
}

/* Ambiguous: default border */
.drift-highlight-info {
  background-color: color-mix(in srgb, var(--border-active) 10%, transparent);
  border-left: 2px solid var(--border-active);
}
```

### IPC Channel Addition

```typescript
// Addition to src/shared/ipc-channels.ts
// In IpcInvokeChannels:
'drift:get-diff': {
  args: { reportId: string };
  result: {
    sourceContent: string;
    derivedContent: string;
    sourcePath: string;
    derivedPath: string;
    drifts: DriftResult[];
  };
};
```

### Animation Patterns

```css
/* [Source: ux-design-specification.md#Real-Time-Update-Patterns] */

/* New alert slide-in */
@keyframes drift-alert-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.drift-alert-enter {
  animation: drift-alert-in 150ms ease-out;
}

/* Alert dismiss fade-out */
.drift-alert-exit {
  animation: drift-alert-in 200ms ease-out reverse forwards;
}

/* Badge count animation */
.drift-badge-count {
  transition: all 300ms ease-out;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .drift-alert-enter,
  .drift-alert-exit {
    animation: none;
  }
  .drift-badge-count {
    transition: none;
  }
}
```

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Components | PascalCase.tsx | `DriftAlert.tsx`, `DriftDiffView.tsx` |
| Tests | same name + `.test.tsx` co-located | `DriftAlert.test.tsx` |
| Hooks | camelCase, prefix `use` | `useDriftAlerts.ts` |
| CSS classes | kebab-case | `drift-highlight-critical` |
| IPC channels | namespace:action kebab | `'drift:get-diff'` |

### Testing Strategy

**Unit tests (co-located):**
- `DriftAlert.test.tsx`:
  - Test: renders severity icon, title, summary, confidence score
  - Test: "Nouveau" badge shown when `isNew=true`, hidden when `isNew=false`
  - Test: severity-based border colors applied correctly
  - Test: "Voir" button calls `onView` with alert id
  - Test: "Corriger" button calls `onFix` with alert id
  - Test: "Ignorer" button calls `onIgnore` with alert id
  - Test: `role="alert"` and `aria-live="polite"` are present
- `DriftAlertList.test.tsx`:
  - Test: renders alerts sorted by confidence (highest first)
  - Test: empty state shows green indicator + "Aucun drift detecte"
  - Test: badge counter shows correct alert count
  - Test: new alerts appear with animation class
- `DriftDiffView.test.tsx`:
  - Test: fetches diff data on mount via `drift:get-diff`
  - Test: renders split view with source and derived labels
  - Test: loading state shows skeleton
  - Test: error state shows error message
  - Test: drift sections are highlighted with correct colors
  - Test: close button calls `onClose`
- `DriftSeverityBadge.test.tsx`:
  - Test: renders correct color for each severity level
  - Test: renders correct label text
- `ConfidenceScore.test.tsx`:
  - Test: renders percentage value
  - Test: correct color for high/medium/low confidence
  - Test: has accessible aria-label
- `useDriftAlerts.test.ts`:
  - Test: subscribes to stream:drift-alert on mount
  - Test: adds alert to store on stream event
  - Test: cleans up subscription on unmount

### What NOT to Do

- Do NOT use popup/modal for drift alerts — they are inline cards in the right pane, non-blocking
- Do NOT show alerts below the configured confidence threshold (filtering is done in Story 4.2/4.3)
- Do NOT use `export default` — named exports only
- Do NOT hardcode colors — use design tokens (`--status-red`, `--status-orange`, etc.)
- Do NOT forget `role="alert"` and `aria-live="polite"` on DriftAlert — required for accessibility
- Do NOT skip `prefers-reduced-motion` check for animations
- Do NOT load full document content in the alert list — only load in DriftDiffView when "Voir" is clicked
- Do NOT implement the resolution logic in this story — "Corriger" opens the diff view, actual resolution is Story 4.5

### References

- [Source: architecture.md#IPC-Channel-Design] — `stream:drift-alert` stream definition
- [Source: architecture.md#Frontend-Component-Architecture] — `features/drift/components/` structure
- [Source: architecture.md#Communication-Patterns] — Zustand store pattern, useIpcStream hook
- [Source: ux-design-specification.md#Custom-Components] — DriftAlert spec (icone + titre + resume + 3 boutons), DriftDiffView spec (split view)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Animation durations (slide-in 150ms, fade-out 200ms, badge count 300ms)
- [Source: ux-design-specification.md#Feedback-Patterns] — Action feedback patterns
- [Source: ux-design-specification.md#Accessibility-Strategy] — ARIA roles, aria-live, reduced motion
- [Source: ux-design-specification.md#Color-System] — Status colors, background tokens
- [Source: ux-design-specification.md#Empty-States-Loading] — Empty state pattern
- [Source: ux-design-specification.md#Journey-2] — Gabri's drift journey (detection -> inspection -> resolution)
- [Source: epics.md#Story-4.4] — Full acceptance criteria

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
