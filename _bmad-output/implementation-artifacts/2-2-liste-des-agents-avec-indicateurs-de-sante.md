# Story 2.2: Liste des Agents avec Indicateurs de Sante

Status: ready-for-dev

## Story

As a **user**,
I want **to see all agents with health indicators in the Work pane**,
So that **I know which agents are healthy, struggling, or idle at a glance**.

## Context

Depends on: Story 2.1.

Paperclip already has: `ActiveAgentsPanel`, `SidebarAgents`, `StatusBadge`, `AgentDetail` page. This story enhances the **Work pane center view** with a dedicated agent health overview when no specific story is selected, and adds health indicators (green/orange/red) based on recent run success/failure patterns.

## Acceptance Criteria

### AC1 — Agent list in Work pane default view

**Given** no story or artifact is selected in the Context pane
**When** I view the project cockpit
**Then** the Work pane shows a list of all agents assigned to this company
**And** each agent shows: name, icon, adapter type, status (active/idle), health indicator

### AC2 — Health indicators

**Given** agents have run history
**When** I view the agent list
**Then** each agent shows a health dot: green (last 3 runs succeeded), orange (1 failure in last 3), red (2+ failures in last 3)
**And** agents with no runs show gray

### AC3 — Click agent opens detail

**Given** the agent list is displayed
**When** I click on an agent
**Then** the Work pane shows the agent detail (existing `AgentDetail` page content embedded in the pane)

### AC4 — Active run indicator

**Given** an agent is currently running
**When** I view the agent list
**Then** that agent shows an animated pulse indicator and "Running" label with elapsed time

## Tasks / Subtasks

- [ ] Task 1: Create AgentHealthList component (AC: #1, #2, #4)
  - [ ] 1.1 Create `ui/src/components/AgentHealthList.tsx` — fetches agents via `agentsApi.list(companyId)` and live runs via `heartbeatsApi.liveRunsForCompany(companyId)`
  - [ ] 1.2 Compute health score per agent: fetch recent runs via `heartbeatsApi.recentRunsForAgent(agentId)` or use dashboard data
  - [ ] 1.3 Render each agent as a row: icon (from `AgentIconPicker`), name, adapter badge, health dot, active run indicator
  - [ ] 1.4 Health dot colors: green (`text-green-500`), orange (`text-yellow-500`), red (`text-red-500`), gray (`text-muted-foreground`)
  - [ ] 1.5 Active run: animated pulse using `animate-pulse` class + "Running" + elapsed time

- [ ] Task 2: Wire into WorkPane (AC: #1, #3)
  - [ ] 2.1 Update `WorkPane` to show `<AgentHealthList />` as default view when `selectedItem === null`
  - [ ] 2.2 On click agent → update navigation context to show agent detail
  - [ ] 2.3 Embed existing agent detail content (reuse components from `AgentDetail` page)

- [ ] Task 3: Tests
  - [ ] 3.1 Test: AgentHealthList renders agents with health indicators
  - [ ] 3.2 Verify app compiles: `cd ui && pnpm build`

## Dev Notes

### Existing Components to Reuse

- `AgentIconPicker` — already renders agent icons
- `StatusBadge` — for status display
- `ActiveAgentsPanel` — study its pattern for live run display
- `SidebarAgents` — study how it lists agents with indicators
- `LiveRunWidget` — embed for running agent detail

### Health Computation

```typescript
function computeHealth(recentRuns: Run[]): 'green' | 'orange' | 'red' | 'gray' {
  if (recentRuns.length === 0) return 'gray';
  const last3 = recentRuns.slice(0, 3);
  const failures = last3.filter(r => r.status === 'failed').length;
  if (failures === 0) return 'green';
  if (failures === 1) return 'orange';
  return 'red';
}
```

### What NOT to do

- Do NOT rebuild agent CRUD — it exists
- Do NOT modify the heartbeat engine
- Do NOT create Electron/IPC code

## Dev Agent Record

### Agent Model Used
### Completion Notes List
### File List
