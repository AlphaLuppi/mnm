# Story 3.4: Notifications de Modification de Fichiers de Contexte

Status: ready-for-dev

## Story

As a **user**,
I want **to be notified when an agent modifies a context file**,
So that **I'm aware of changes that might affect other agents or documents**.

## Acceptance Criteria

### AC1 — Toast notification on file modification

**Given** un agent modifie un fichier de contexte
**When** le file watcher détecte la modification
**Then** je reçois une notification toast (bottom-right, auto-dismiss 3s) (FR13)
**And** la notification indique : quel agent, quel fichier, quel type de modification

### AC2 — Shared file badges update

**Given** un fichier de contexte partagé entre 2 agents est modifié
**When** la modification est détectée
**Then** les badges des deux agents sont mis à jour sur la `ContextFileCard`
**And** la notification mentionne l'impact potentiel sur l'autre agent

### AC3 — Toast stacking limit (max 3)

**Given** plusieurs fichiers sont modifiés rapidement
**When** les notifications s'accumulent
**Then** max 3 toasts sont empilés simultanément
**And** les notifications suivantes remplacent les plus anciennes

## Tasks / Subtasks

- [ ] Task 1: Setup toast notification system (AC: #1, #3)
  - [ ] 1.1 Install shadcn/ui Toast component if not already present (`npx shadcn@latest add toast`)
  - [ ] 1.2 Create `src/renderer/src/shared/components/Toaster.tsx` — toast container, positioned bottom-right
  - [ ] 1.3 Configure toast max count: 3 simultaneous toasts
  - [ ] 1.4 Configure auto-dismiss: 3s for success/info, persistent for errors
  - [ ] 1.5 Add `Toaster` to `App.tsx` root layout

- [ ] Task 2: Create notification types (AC: #1, #2)
  - [ ] 2.1 Create `src/renderer/src/features/context/notification.types.ts`
  - [ ] 2.2 Define `FileChangeNotification`: `agentId`, `agentName`, `filePath`, `fileName`, `changeType`, `affectedAgentIds`, `timestamp`
  - [ ] 2.3 Define `NotificationLevel`: `'all'` | `'important'` | `'none'` (for configurable notification filtering)

- [ ] Task 3: Create useFileNotifications hook (AC: #1, #2, #3)
  - [ ] 3.1 Create `src/renderer/src/features/context/hooks/useFileNotifications.ts`
  - [ ] 3.2 Subscribe to `stream:file-change` via `useIpcStream`
  - [ ] 3.3 When a file change arrives with `agentId`:
    - Look up the file in context store to check if it's a tracked context file
    - Look up which agents share this file (from context store)
    - Generate a `FileChangeNotification`
    - Trigger toast notification
  - [ ] 3.4 Implement notification deduplication: batch rapid changes to the same file within 500ms window
  - [ ] 3.5 Create `src/renderer/src/features/context/hooks/useFileNotifications.test.ts`

- [ ] Task 4: Create FileChangeToast component (AC: #1, #2)
  - [ ] 4.1 Create `src/renderer/src/features/context/components/FileChangeToast.tsx`
  - [ ] 4.2 Display: agent name (with HealthIndicator color), file name, change type icon (create/modify/delete)
  - [ ] 4.3 If shared file: add line "Aussi utilisé par [agent names]"
  - [ ] 4.4 Add click action: clicking the toast navigates to the file in the context panel
  - [ ] 4.5 Style: bottom-right, slide-in from right (200ms), auto-dismiss 3s
  - [ ] 4.6 ARIA: `role="status"`, `aria-live="polite"`
  - [ ] 4.7 Create `src/renderer/src/features/context/components/FileChangeToast.test.tsx`

- [ ] Task 5: Create header badge counter (AC: #1)
  - [ ] 5.1 Create `src/renderer/src/features/context/components/FileChangeBadge.tsx` — badge for the app header
  - [ ] 5.2 Display count of unacknowledged file changes since last view
  - [ ] 5.3 Badge resets when user views the context panel
  - [ ] 5.4 Animate counter change with number animation (300ms)
  - [ ] 5.5 Create `src/renderer/src/features/context/components/FileChangeBadge.test.tsx`

- [ ] Task 6: Update context store for notifications (AC: #1, #2)
  - [ ] 6.1 Add `pendingNotificationCount: number` to context store
  - [ ] 6.2 Add `incrementNotificationCount()` action
  - [ ] 6.3 Add `resetNotificationCount()` action — called when context panel becomes visible
  - [ ] 6.4 Add `lastModifiedBy: string | undefined` to `ContextFile` type (already partially in Story 3.2)

- [ ] Task 7: Implement notification level setting (AC: #1)
  - [ ] 7.1 Read notification level from `.mnm/settings.json` via IPC (key: `notificationLevel`)
  - [ ] 7.2 Default: `'all'` — notify on every context file change by an agent
  - [ ] 7.3 `'important'` — only notify on shared files (used by 2+ agents) or deletions
  - [ ] 7.4 `'none'` — suppress all file change toasts (badge still updates)
  - [ ] 7.5 Setting change takes effect immediately without restart

- [ ] Task 8: Wire into layout (AC: #1)
  - [ ] 8.1 Import `useFileNotifications` in `ContextPanel` or app-level component
  - [ ] 8.2 Add `FileChangeBadge` to the app header (next to project name or breadcrumb)
  - [ ] 8.3 Verify toast appears on file change, badge increments, and both reset on panel view

## Dev Notes

### FRs Covered

- **FR13** — L'utilisateur peut être notifié quand un agent modifie un fichier de contexte
- **FR44** — L'utilisateur peut voir le contexte tel qu'il était à un commit donné (indirectly — notification links to context, versioning in Story 3.5)

### Dependencies on Previous Stories

- **Story 1.1** — IPC bridge, `useIpcStream` hook, shared types
- **Story 1.2** — App header for badge placement, `ThreePaneLayout`
- **Story 3.1** — `stream:file-change` events with `agentId` from `EventCorrelator`
- **Story 3.2** — `context.store.ts` with file tracking, `ContextFileCard` with badges

### Notification Flow Architecture

```
File Watcher (main) → EventCorrelator → stream:file-change (IPC)
                                              ↓
                                    useFileNotifications (renderer)
                                      ↓              ↓
                               FileChangeToast   FileChangeBadge
                              (bottom-right)     (app header)
                                      ↓
                               context.store
                           (mark modified, count)
```

### FileChangeToast Component Pattern

```tsx
// src/renderer/src/features/context/components/FileChangeToast.tsx
import { toast } from '@renderer/shared/components/Toaster';
import type { FileChangeNotification } from '../notification.types';

export function showFileChangeToast(notification: FileChangeNotification): void {
  const changeTypeLabel = {
    create: 'créé',
    modify: 'modifié',
    delete: 'supprimé',
  }[notification.changeType];

  const changeTypeIcon = {
    create: '+',
    modify: '~',
    delete: '-',
  }[notification.changeType];

  toast({
    title: `${changeTypeIcon} ${notification.fileName} ${changeTypeLabel}`,
    description: buildDescription(notification),
    duration: 3000,
    action: notification.filePath
      ? {
          label: 'Voir',
          onClick: () => navigateToFile(notification.filePath),
        }
      : undefined,
  });
}

function buildDescription(notification: FileChangeNotification): string {
  const parts: string[] = [];

  if (notification.agentName) {
    parts.push(`Par ${notification.agentName}`);
  }

  if (notification.affectedAgentIds.length > 0) {
    const otherAgents = notification.affectedAgentIds
      .filter((id) => id !== notification.agentId)
      .join(', ');
    if (otherAgents) {
      parts.push(`Impact potentiel sur : ${otherAgents}`);
    }
  }

  return parts.join(' — ');
}
```

[Source: ux-design-specification.md#Feedback-Patterns — Toast bas-droite, auto-dismiss 3s]

### useFileNotifications Hook Pattern

```typescript
// src/renderer/src/features/context/hooks/useFileNotifications.ts
import { useCallback, useRef } from 'react';
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream';
import { useContextStore } from '../context.store';
import { showFileChangeToast } from '../components/FileChangeToast';
import type { FileChangeNotification, NotificationLevel } from '../notification.types';

const DEDUP_WINDOW_MS = 500;

export function useFileNotifications(
  notificationLevel: NotificationLevel = 'all',
): void {
  const files = useContextStore((s) => s.files);
  const markFileModified = useContextStore((s) => s.markFileModified);
  const incrementNotificationCount = useContextStore(
    (s) => s.incrementNotificationCount,
  );

  const recentNotifications = useRef<Map<string, number>>(new Map());

  const handleFileChange = useCallback(
    (data: { path: string; type: string; agentId?: string }) => {
      // Only notify for tracked context files modified by agents
      const contextFile = files.get(data.path);
      if (!contextFile || !data.agentId) return;

      // Deduplication: skip if same file notified within window
      const lastNotified = recentNotifications.current.get(data.path);
      const now = Date.now();
      if (lastNotified && now - lastNotified < DEDUP_WINDOW_MS) return;
      recentNotifications.current.set(data.path, now);

      // Update store
      markFileModified(data.path, data.agentId);
      incrementNotificationCount();

      // Build notification
      const affectedAgentIds = contextFile.agentIds.filter(
        (id) => id !== data.agentId,
      );
      const notification: FileChangeNotification = {
        agentId: data.agentId,
        agentName: data.agentId, // Resolve from agents store if available
        filePath: data.path,
        fileName: contextFile.name,
        changeType: data.type as 'create' | 'modify' | 'delete',
        affectedAgentIds,
        timestamp: now,
      };

      // Apply notification level filter
      if (notificationLevel === 'none') return;
      if (
        notificationLevel === 'important' &&
        affectedAgentIds.length === 0 &&
        data.type !== 'delete'
      ) {
        return;
      }

      showFileChangeToast(notification);
    },
    [files, markFileModified, incrementNotificationCount, notificationLevel],
  );

  useIpcStream('stream:file-change', handleFileChange);
}
```

### Toast Stacking Configuration

```typescript
// Toast container configuration
// shadcn/ui Toast uses Radix Primitives which support viewport stacking

// In Toaster component or toast config:
const TOAST_CONFIG = {
  maxVisible: 3,        // Max 3 simultaneous toasts (AC3)
  defaultDuration: 3000, // Auto-dismiss 3s for info/success
  errorDuration: 0,      // Persistent for errors (dismiss manual)
  position: 'bottom-right' as const,
  swipeDirection: 'right' as const,
};
```

[Source: ux-design-specification.md#Feedback-Patterns — Toasts empilés max 3]

### Header Badge Pattern

```tsx
// src/renderer/src/features/context/components/FileChangeBadge.tsx
import { useContextStore } from '../context.store';
import { Badge } from '@renderer/shared/components/Badge';

export function FileChangeBadge() {
  const count = useContextStore((s) => s.pendingNotificationCount);

  if (count === 0) return null;

  return (
    <Badge
      variant="warning"
      size="sm"
      className="motion-safe:animate-number-pop"
      aria-label={`${count} modification${count > 1 ? 's' : ''} non lue${count > 1 ? 's' : ''}`}
    >
      {count}
    </Badge>
  );
}
```

### Number Animation CSS

```css
@keyframes number-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.animate-number-pop {
  animation: number-pop 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .animate-number-pop {
    animation: none;
  }
}
```

[Source: ux-design-specification.md#Real-Time-Update-Patterns — Number animation 300ms]

### Toast Slide-In Animation

```css
@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Applied by shadcn/ui Toast component automatically */
```

[Source: ux-design-specification.md#Real-Time-Update-Patterns — Toast, slide-in droite 200ms]

### Notification Settings in .mnm/settings.json

```json
{
  "notificationLevel": "all",
  "driftConfidenceThreshold": 70
}
```

The `notificationLevel` value can be `"all"`, `"important"`, or `"none"`.

[Source: architecture.md#Local-Data-Persistence — settings.json]

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Component | PascalCase.tsx | `FileChangeToast.tsx`, `FileChangeBadge.tsx` |
| Hook | camelCase, prefix `use` | `useFileNotifications.ts` |
| Types file | kebab-case + `.types.ts` | `notification.types.ts` |
| Test file | same name + `.test.ts(x)` | `FileChangeToast.test.tsx` |
| Toast function | camelCase | `showFileChangeToast()` |

[Source: architecture.md#Naming-Patterns]

### Testing Strategy

**Unit tests:**
- `FileChangeToast.test.tsx` — Verify toast renders with agent name, file name, change type. Verify "Impact potentiel" line appears for shared files. Verify click action navigates.
- `FileChangeBadge.test.tsx` — Verify badge renders with count. Verify hidden when count is 0. Verify ARIA label.
- `useFileNotifications.test.ts` — Verify toast triggered on `stream:file-change` for tracked files. Verify NOT triggered for non-context files. Verify deduplication within 500ms window. Verify notification level filtering: `'none'` suppresses all, `'important'` only shows shared/deletions.

**Integration tests:**
- Full flow: `stream:file-change` with agentId -> toast appears -> badge increments -> view context panel -> badge resets
- Shared file: file used by 2 agents, modified by agent A -> toast mentions agent B impact -> both badges updated on card

**Accessibility tests:**
- Toast has `role="status"` and `aria-live="polite"`
- Badge has descriptive `aria-label`
- Toast action button is keyboard-focusable
- Animations respect `prefers-reduced-motion`

### What NOT to Do

- Do NOT use `alert()` or `confirm()` for notifications — use toast system
- Do NOT show more than 3 toasts at once — enforce max stack limit
- Do NOT use `aria-live="assertive"` for file change notifications — use `"polite"` (not critical alerts)
- Do NOT make toasts persistent for info notifications — auto-dismiss 3s per UX spec
- Do NOT notify for file changes WITHOUT an `agentId` — only agent-initiated changes warrant notification (FR13)
- Do NOT notify for files that are NOT tracked context files — only context files in the store
- Do NOT forget deduplication — rapid saves (e.g., agent writing multiple chunks) should not flood toasts
- Do NOT use `export default` — named exports only
- Do NOT hardcode notification level — read from settings, allow runtime change
- Do NOT use inline styles for animations — use Tailwind utility classes + CSS keyframes

### References

- [Source: architecture.md#Communication-Patterns] — useIpcStream pattern
- [Source: architecture.md#Local-Data-Persistence] — settings.json for notification level
- [Source: architecture.md#IPC-Channel-Design] — `stream:file-change` payload
- [Source: architecture.md#Naming-Patterns] — Naming conventions
- [Source: ux-design-specification.md#Feedback-Patterns] — Toast system spec (bottom-right, 3s, max 3)
- [Source: ux-design-specification.md#Real-Time-Update-Patterns] — Animations (slide-in, number animation, fade)
- [Source: ux-design-specification.md#Accessibility-Strategy] — ARIA live regions
- [Source: ux-design-specification.md#Emotional-Design-Principles] — Alert, don't interrupt
- [Source: ux-design-specification.md#Anti-Patterns-to-Avoid] — Notification fatigue
- [Source: epics.md#Story-3.4] — Acceptance criteria source
- [Source: 1-1-project-scaffold-ipc-bridge-event-bus.md] — IPC and event bus patterns

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
