# Story 2.4: Agent Dashboard UI (Available & Running Agents)

Status: ready-for-dev

## Story

As a user,
I want to see all available and running agents at a glance,
so that I can understand what's happening in my project.

## Acceptance Criteria

1. The Agents page (`/agents`) displays three sections: Available Agents, **Discovered Workflows**, and Running Agents
2. Available Agents shows agent types (TDD, Implementation, E2E, Review) with descriptions and Launch buttons
3. **Discovered Workflows section shows BMAD workflows discovered from the repository** (fetched from `/api/discovery/workflows`)
4. **Each workflow card displays: workflow name, phase badge (analysis/planning/solutioning/implementation), description**
5. **Clicking a workflow's "Launch" button opens the Launch Agent dialog pre-populated with workflow context**
6. Running Agents shows a real-time table of active agent sessions
7. Each running agent row displays: name, status badge, spec link, file scope, control buttons
8. Status badges use color coding: Running (blue), Paused (yellow), Completed (green), Error (red)
9. Dashboard polls for updates every 2 seconds using SWR
10. Clicking a spec link navigates to the spec view
11. The table handles 10 concurrent agents without performance issues
12. **Empty state for workflows: "No workflows discovered. Run discovery to scan for BMAD workflows."**

## Tasks / Subtasks

- [ ] Task 1: Create Agents page layout (AC: #1)
  - [ ] Create `src/app/agents/page.tsx` with two sections
  - [ ] Use shadcn Card components for section containers
- [ ] Task 2: Build Available Agents section (AC: #2)
  - [ ] Create `src/components/agents/available-agents.tsx`
  - [ ] Define agent type configs: name, description, icon
  - [ ] Add Launch button per agent type (opens launch dialog -- Story 2.5)
- [ ] Task 2b: Build Discovered Workflows section (AC: #3, #4, #5, #12) **[ENHANCEMENT]**
  - [ ] Create `src/components/agents/discovered-workflows.tsx`
  - [ ] Fetch workflows from `GET /api/discovery/workflows` using SWR
  - [ ] Display workflow cards with: name, phase badge, description
  - [ ] Add Launch button that opens LaunchAgentDialog with workflow as agentType
  - [ ] Handle empty state when no workflows discovered
- [ ] Task 3: Build Running Agents table (AC: #3, #4, #5, #8)
  - [ ] Create `src/components/agents/agent-table.tsx`
  - [ ] Use shadcn Table component with columns: Name, Status, Spec, Scope, Actions
  - [ ] Create `src/components/agents/status-badge.tsx` with color-coded Badge
  - [ ] Display file scope as a truncated list with expand on click
  - [ ] Add control buttons: Pause/Resume, Terminate (wire to API in Story 2.7)
- [ ] Task 4: Implement real-time data fetching (AC: #6)
  - [ ] Install and configure SWR: `npm install swr`
  - [ ] Create `src/hooks/use-agents.ts` hook with `useSWR('/api/agents', fetcher, { refreshInterval: 2000 })`
  - [ ] Handle loading and error states with shadcn Skeleton components
- [ ] Task 5: Implement spec link navigation (AC: #7)
  - [ ] Render spec name as a Next.js Link to `/specs/[specId]`
- [ ] Task 6: Create empty state
  - [ ] When no agents are running, show empty state: "No agents running. Launch one from a spec."

## Dev Notes

### File Structure

```
src/app/agents/
└── page.tsx                          # Agents page

src/components/agents/
├── available-agents.tsx              # Agent type cards with launch buttons
├── agent-table.tsx                   # Running agents table
├── status-badge.tsx                  # Color-coded status badge
└── agent-row.tsx                     # Individual agent row (optional)

src/hooks/
└── use-agents.ts                     # SWR hook for agent data
```

### SWR Setup

```typescript
// src/hooks/use-agents.ts
import useSWR from 'swr'
import type { Agent } from '@/lib/models'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<Agent[]>('/api/agents', fetcher, {
    refreshInterval: 2000,
  })

  return {
    agents: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
  }
}
```

### Agent Type Definitions

```typescript
const AGENT_TYPES = [
  {
    id: 'tdd',
    name: 'TDD Agent',
    description: 'Write tests first, then implement to pass them',
    icon: 'TestTube',
  },
  {
    id: 'implementation',
    name: 'Implementation Agent',
    description: 'Implement features from spec acceptance criteria',
    icon: 'Code',
  },
  {
    id: 'e2e',
    name: 'E2E Test Agent',
    description: 'Write end-to-end browser tests',
    icon: 'Monitor',
  },
  {
    id: 'review',
    name: 'Code Review Agent',
    description: 'Review code for quality, security, and spec alignment',
    icon: 'Search',
  },
] as const
```

### Status Badge Colors

```typescript
const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  running: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}
```

### shadcn/ui Components Needed

Install via CLI if not already present:
```bash
npx shadcn@latest add table badge skeleton alert-dialog
```

### Critical Constraints

- SWR `refreshInterval: 2000` ensures near-real-time updates without overwhelming the server
- The agents table is a client component (`'use client'`) since it uses SWR hooks
- The Available Agents section can be a server component (static content)
- Use `mutate()` from SWR after spawn/terminate actions for instant UI update (optimistic)
- Icons from `lucide-react` (already included with shadcn/ui)
- Scope display should truncate to 2-3 items with "+N more" for readability

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 9.2 - Component Library]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.2 - Polling for Dashboard State]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
