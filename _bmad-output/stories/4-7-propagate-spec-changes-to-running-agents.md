# Story 4.7: Propagate Spec Changes to Running Agents

Status: ready-for-dev

## Story

As a user,
I want running agents to be notified when specs change,
so that they can adjust their work accordingly.

## Acceptance Criteria

1. When a spec file changes (git update detected) and a running agent is working on that spec, the agent is notified via the AgentEventBus: "Spec updated: [change_summary]"
2. Agent can choose to: continue with old spec (user confirmation required) or reload spec and recenter (agent restarts with new spec)
3. UI displays warning: "Agent X is working on a spec that changed. Review recommended."
4. User can click warning to: view diff, pause agent, terminate agent, or acknowledge and continue
5. Warning is visible on the agent dashboard card and in the agent detail view

## Tasks / Subtasks

- [ ] Task 1: Implement spec change event propagation (AC: #1)
  - [ ] In `src/lib/git/change-detector.ts`, after detecting changes to important files, cross-reference with running agents via `agentRepository.findBySpecId(specId)`
  - [ ] Emit `specChanged` event on `AgentEventBus` with `{ agentId, specId, changeSummary, diffUrl }`
  - [ ] Create typed event: `{ type: "specChanged"; agentId: string; specId: string; changeSummary: string }`
- [ ] Task 2: Create spec change notification API (AC: #1, #3)
  - [ ] Add `GET /api/agents/[id]/spec-changes` endpoint returning pending spec changes for an agent
  - [ ] Include change summary, diff reference, and timestamp
  - [ ] Update agent record with `specChangesPending: true` flag (or store in a separate table)
- [ ] Task 3: Build agent spec change warning UI (AC: #3, #4, #5)
  - [ ] Create `src/components/agents/spec-change-warning.tsx` using shadcn/ui Alert with warning variant
  - [ ] Show warning text: "Agent {name} is working on a spec that changed. Review recommended."
  - [ ] Add action buttons: "View Diff", "Pause Agent", "Terminate Agent", "Acknowledge"
  - [ ] Integrate warning into agent dashboard card (Story 2.4) and agent detail view
- [ ] Task 4: Implement user action handlers (AC: #2, #4)
  - [ ] "View Diff": open diff viewer (reuse Story 4.6 component) with the changed spec
  - [ ] "Pause Agent": call `PATCH /api/agents/[id]` with `{ action: "pause" }` (reuse Story 2.7)
  - [ ] "Terminate Agent": call `DELETE /api/agents/[id]` with confirmation dialog (reuse Story 2.7)
  - [ ] "Acknowledge": dismiss warning, mark spec change as acknowledged for this agent
  - [ ] "Reload Spec": terminate agent and re-launch with same config but updated spec content
- [ ] Task 5: Write tests (AC: #1, #3)
  - [ ] Unit test for spec change event propagation (mock AgentEventBus)
  - [ ] Unit test for cross-referencing running agents with changed specs
  - [ ] Component test for warning UI rendering and action buttons
  - [ ] Integration test for acknowledge flow

## Dev Notes

- This story bridges Epic 4 (Spec Change Awareness) and Epic 2 (Agent Orchestration) -- it requires both the change detection pipeline and the agent runtime to be functional
- The AgentEventBus (from Story 2.2) is the communication backbone: `agentEventBus.emit("specChanged", { agentId, specId, changeSummary })`
- Agent "reload" is implemented as terminate + re-launch (not hot-reload); the new agent gets the updated spec content
- Warning should be prominent but not block the UI; use shadcn/ui Alert with `variant="destructive"` or a custom warning style
- SWR polling on the agent dashboard (2s) will automatically pick up the `specChangesPending` flag

### Project Structure Notes

- `src/lib/git/change-detector.ts` -- extend to cross-reference running agents
- `src/lib/agent/event-bus.ts` -- add `specChanged` event type
- `src/components/agents/spec-change-warning.tsx` -- new warning component
- `src/app/api/agents/[id]/spec-changes/route.ts` -- new API endpoint

### References

- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.3 - Agent Event Bus]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 7.1 - Claude Code Subprocess]
- [Source: _bmad-output/planning-artifacts/architecture-web.md#Section 6.2 - Polling for Dashboard State: 2s interval]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
