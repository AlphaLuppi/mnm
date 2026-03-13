# Story 2.5: Launch Agent from Spec UI

Status: ready-for-dev

## Story

As a user,
I want to launch an agent directly from a spec,
so that I can start work on a requirement with minimal friction.

## Acceptance Criteria

1. A "Launch Agent" button appears on the spec detail view
2. Clicking it opens a Dialog modal with: agent type selector, file scope selector, spec preview
3. Agent type is selectable from a dropdown (TDD, Implementation, E2E, Review)
4. File scope selector shows files in the repository as checkboxes
5. When user clicks "Confirm": file locks are acquired, agent spawns, modal closes
6. If lock conflict detected, error message displays with conflicting agent info
7. After successful launch, the spec view shows an "Agents working on this" badge count
8. The launch calls `POST /api/agents` with specId, agentType, and scope

## Tasks / Subtasks

- [ ] Task 1: Create LaunchAgentDialog component (AC: #2, #3, #4)
  - [ ] Create `src/components/agents/launch-agent-dialog.tsx`
  - [ ] Use shadcn Dialog, Select, Checkbox, Button, ScrollArea components
  - [ ] Agent type dropdown with descriptions
  - [ ] File scope selector: load repo files via API, render as checkbox list
  - [ ] Read-only spec title/path display at top
- [ ] Task 2: Add Launch button to spec view (AC: #1)
  - [ ] Add "Launch Agent" button to spec detail page header
  - [ ] Pass specId and specPath to dialog as props
- [ ] Task 3: Implement launch action (AC: #5, #8)
  - [ ] On "Confirm": POST to `/api/agents` with { specId, agentType, scope }
  - [ ] On success: close dialog, show toast notification, trigger SWR mutate
  - [ ] On error: display error in dialog (do not close)
- [ ] Task 4: Handle lock conflicts (AC: #6)
  - [ ] If API returns 409 (LOCK_CONFLICT): show Alert with conflict details
  - [ ] Display: file path, conflicting agent name
  - [ ] Offer options: "Modify Scope" (uncheck conflicting files) or "Cancel"
- [ ] Task 5: Show active agents badge on spec (AC: #7)
  - [ ] Query agents by specId
  - [ ] Display Badge showing count of active agents on the spec detail page header

## Dev Notes

### File Structure

```
src/components/agents/
├── launch-agent-dialog.tsx     # Dialog modal for launching agents
└── ...

src/components/specs/
├── spec-detail-header.tsx      # Spec header with Launch button and agent count badge
└── ...
```

### LaunchAgentDialog Component Structure

```tsx
// src/components/agents/launch-agent-dialog.tsx
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Props {
  specId: string
  specTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LaunchAgentDialog({ specId, specTitle, open, onOpenChange }: Props) {
  const [agentType, setAgentType] = useState('implementation')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)

  async function handleLaunch() {
    setIsLaunching(true)
    setError(null)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specId, agentType, scope: selectedFiles }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message ?? 'Failed to launch agent')
        return
      }
      onOpenChange(false)
      // Toast + SWR mutate
    } finally {
      setIsLaunching(false)
    }
  }

  // ... render dialog
}
```

### shadcn/ui Components Needed

```bash
npx shadcn@latest add dialog select checkbox scroll-area alert toast
```

### File List API

For the file scope selector, create a simple API route or server action that returns the repository file tree:

```typescript
// GET /api/git/files -- returns flat list of tracked files
import simpleGit from 'simple-git'

export async function GET() {
  const git = simpleGit(repoRoot)
  const files = await git.raw(['ls-files'])
  return Response.json(files.split('\n').filter(Boolean))
}
```

### Critical Constraints

- The dialog is a client component (`'use client'`)
- File list should be loaded on dialog open (not on page load) to avoid unnecessary git operations
- Filter out non-relevant files (e.g., node_modules, .git, _bmad/) from the file scope selector
- The lock conflict error should show actionable info: which file, which agent holds the lock
- Use `useAgents().mutate()` after successful launch for immediate UI update
- Spec detail page needs to receive specId from the URL params

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 5.2 - Launch Agent API]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Dialog component]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
