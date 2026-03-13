# Story 3.7: Drift Resolution Workflow (Reject)

Status: ready-for-dev

## Story

As a user,
I want to reject drift and create a remediation task,
so that I can maintain alignment with my original spec.

## Acceptance Criteria

1. On the drift detail page, clicking "Reject Drift" opens a modal dialog
2. The modal shows: "Create a task to fix this drift?"
3. The modal includes inputs: task title (pre-filled: "Fix drift in [Spec Name]"), optional notes
4. On confirmation, the drift record is updated: `user_decision = 'rejected'`, `decided_at = current timestamp`
5. The drift alert is marked as resolved
6. A success toast confirms: "Drift rejected -- remediation task created"
7. The remediation task is stored in the database for future tracking

## Tasks / Subtasks

- [ ] Task 1: Create reject drift dialog (AC: #1, #2, #3)
  - [ ] Create `src/components/drift/reject-drift-dialog.tsx`
  - [ ] Use shadcn/ui `Dialog` with form content:
    - Title: "Reject Drift & Create Remediation Task"
    - Task title input (pre-filled with "Fix drift in [Spec Name]")
    - Notes textarea (optional, for context)
    - Cancel and "Create Task" buttons
  - [ ] Use shadcn/ui `Input` and `Textarea` form components
- [ ] Task 2: Implement reject API call (AC: #4, #5)
  - [ ] On confirm, call `PATCH /api/drift/[id]` with `{ decision: 'rejected', taskTitle, notes }`
  - [ ] API route updates drift record in database:
    - `userDecision = 'rejected'`
    - `decidedAt = Date.now()`
    - `updatedAt = Date.now()`
  - [ ] Return updated drift record
- [ ] Task 3: Store remediation task (AC: #7)
  - [ ] For the POC, store the remediation as a note in the drift record itself (add `remediationNote` field or use existing fields)
  - [ ] Alternatively, create a simple `tasks` table if task tracking is needed:
    - `id`, `title`, `description`, `driftId`, `status`, `createdAt`
  - [ ] For MVP, storing the task title in the drift record's metadata is sufficient
- [ ] Task 4: Update UI after rejection (AC: #5, #6)
  - [ ] After successful API call, update local state (SWR mutate)
  - [ ] Show toast: "Drift rejected -- remediation task created for [Spec Name]"
  - [ ] Navigate back to drift list or update card to show "Rejected" status
  - [ ] Decrement the pending drift count in the sidebar badge
- [ ] Task 5: Install form components
  - [ ] Add shadcn/ui components if not already added: `npx shadcn@latest add input textarea`

## Dev Notes

### Key Components

- **shadcn/ui Dialog**: For the rejection modal (more complex than AlertDialog since it has form inputs)
- **shadcn/ui Input**: For task title
- **shadcn/ui Textarea**: For optional notes
- **shadcn/ui Sonner/Toast**: For success notification

### Reject Flow

```
User clicks "Reject Drift"
  -> Dialog opens with pre-filled task title
  -> User optionally edits title and adds notes
  -> User clicks "Create Task"
  -> PATCH /api/drift/[id] { decision: 'rejected', taskTitle, notes }
  -> Success response
  -> Toast: "Drift rejected"
  -> SWR revalidation updates list
  -> Drift card shows "Rejected" status
```

### Remediation Task Strategy (POC)

For the POC, keep it simple: store the task information as part of the drift resolution. A full task management system is out of scope. The key data to capture:
- What was rejected (drift ID, spec name)
- What needs to be done (task title)
- Any context (notes)
- When it was rejected (timestamp)

This could be stored as a JSON field on the drift record or simply logged.

### Project Structure Notes

- `src/components/drift/reject-drift-dialog.tsx` -- rejection dialog with form
- Updates to `src/app/drift/[id]/page.tsx` to wire the button

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7: Drift Resolution Workflow (Reject)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 6.5 - Drift Resolution Workflow]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
