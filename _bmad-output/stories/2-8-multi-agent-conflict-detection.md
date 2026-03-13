# Story 2.8: Multi-Agent Conflict Detection & Visibility

Status: ready-for-dev

## Story

As a user,
I want to see when multiple agents work on overlapping scopes,
so that I can prevent conflicts before they happen.

## Acceptance Criteria

1. The agent dashboard displays conflict warnings when agents have overlapping file scopes
2. When launching a new agent, if scope conflicts with a running agent, a warning appears before spawn
3. User can choose: "Wait for Agent X to complete", "Modify scope", or "Cancel" on conflict
4. A simple conflict visualization shows which agents share file dependencies
5. Visualization renders cleanly with up to 10 agents
6. The conflict visualization is collapsible (optional panel)

## Tasks / Subtasks

- [ ] Task 1: Create conflict detection logic (AC: #1, #2)
  - [ ] Create `src/lib/agent/conflict-detector.ts`
  - [ ] `detectConflicts(agents: Agent[])` -- compare scopes of all running agents pairwise
  - [ ] Return list of conflicts: `{ agentA, agentB, sharedFiles }[]`
  - [ ] `checkNewAgentConflicts(scope, runningAgents)` -- check if new scope overlaps with running agents
- [ ] Task 2: Display conflict warnings on dashboard (AC: #1)
  - [ ] Create `src/components/agents/conflict-warnings.tsx`
  - [ ] Use shadcn Alert with warning variant for each conflict
  - [ ] Show: agent names and shared file paths
  - [ ] Place above the running agents table
- [ ] Task 3: Pre-launch conflict check in dialog (AC: #2, #3)
  - [ ] In LaunchAgentDialog: after file selection, check for conflicts with running agents
  - [ ] If conflicts found, show inline Alert with details
  - [ ] Highlight conflicting files in the file scope selector (red checkboxes)
  - [ ] Show action buttons: "Wait", "Modify Scope", "Cancel"
- [ ] Task 4: Create conflict visualization (AC: #4, #5, #6)
  - [ ] Create `src/components/agents/conflict-graph.tsx`
  - [ ] Simple visual: list of agents with lines/badges showing shared files
  - [ ] Use a card-based layout (not a full graph library for the POC)
  - [ ] Conflicts highlighted with red border/badge
  - [ ] Wrap in a collapsible section (shadcn Collapsible)
- [ ] Task 5: Create API endpoint for conflicts
  - [ ] `GET /api/agents/conflicts` -- return current conflicts between running agents
  - [ ] Used by dashboard to show real-time conflict state

## Dev Notes

### Conflict Detection Logic

```typescript
// src/lib/agent/conflict-detector.ts
interface Conflict {
  agentA: { id: string; name: string }
  agentB: { id: string; name: string }
  sharedFiles: string[]
}

export function detectConflicts(agents: Agent[]): Conflict[] {
  const running = agents.filter(a => a.status === 'running' || a.status === 'paused')
  const conflicts: Conflict[] = []

  for (let i = 0; i < running.length; i++) {
    for (let j = i + 1; j < running.length; j++) {
      const scopeA = JSON.parse(running[i].scope || '[]') as string[]
      const scopeB = JSON.parse(running[j].scope || '[]') as string[]
      const shared = scopeA.filter(f => scopeB.includes(f))

      if (shared.length > 0) {
        conflicts.push({
          agentA: { id: running[i].id, name: running[i].name },
          agentB: { id: running[j].id, name: running[j].name },
          sharedFiles: shared,
        })
      }
    }
  }

  return conflicts
}
```

### Conflict Warning Component

```tsx
// src/components/agents/conflict-warnings.tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

export function ConflictWarnings({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {conflicts.map((c, i) => (
        <Alert key={i} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Scope Conflict</AlertTitle>
          <AlertDescription>
            {c.agentA.name} and {c.agentB.name} share files: {c.sharedFiles.join(', ')}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
```

### Visualization Approach

For the POC, use a simple card-based layout rather than a full graph library (d3, vis.js, etc.):

- Each agent is a Card with its name and scope
- Shared files between agents are shown as colored badges
- Red border on cards that have conflicts
- This avoids adding a heavy graph visualization dependency

Post-POC: upgrade to a proper node-edge graph if needed.

### Critical Constraints

- Conflict detection is computed from agent data already in memory/DB -- no additional queries needed
- The pairwise comparison is O(n^2) but n is max 10 agents -- performance is not a concern
- Scope is stored as JSON string in the DB -- parse with `JSON.parse` before comparing
- Pre-launch conflict checking should use the existing `FileLockManager` for authoritative lock state
- The conflict visualization is a nice-to-have for the POC -- prioritize the warning alerts and pre-launch check

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.1 - Multi-Agent Conflict Prevention]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 5.2 - File Locking Mechanism]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
