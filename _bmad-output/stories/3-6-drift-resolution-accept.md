# Story 3.6: Drift Resolution Workflow (Accept)

Status: ready-for-dev

## Story

As a user,
I want to accept drift and update my spec,
so that I can evolve my product vision based on better implementation ideas.

## Acceptance Criteria

1. On the drift detail page, clicking "Accept Drift" opens a confirmation dialog
2. The dialog explains: "Accepting this drift means the spec should be updated to match the implementation"
3. On confirmation, the drift record is updated: `user_decision = 'accepted'`, `decided_at = current timestamp`
4. The drift alert is marked as resolved (removed from pending list, moved to resolved)
5. The spec file path is displayed with a "Open in Editor" suggestion (external editor)
6. The drift record persists in the database for audit trail
7. A success toast notification confirms: "Drift accepted -- update your spec to match the implementation"

## Tasks / Subtasks

- [ ] Task 1: Create accept drift confirmation dialog (AC: #1, #2)
  - [ ] Create `src/components/drift/accept-drift-dialog.tsx`
  - [ ] Use shadcn/ui `AlertDialog` with:
    - Title: "Accept Drift?"
    - Description: "This marks the drift as intentional. You should update the spec to reflect the implementation changes."
    - Cancel button and Confirm button
  - [ ] Display the drift summary and spec name in the dialog for context
- [ ] Task 2: Implement accept API call (AC: #3, #6)
  - [ ] On confirm, call `PATCH /api/drift/[id]` with `{ decision: 'accepted' }`
  - [ ] API route updates drift record in database:
    - `userDecision = 'accepted'`
    - `decidedAt = Date.now()`
    - `updatedAt = Date.now()`
  - [ ] Return updated drift record
- [ ] Task 3: Update UI after acceptance (AC: #4, #7)
  - [ ] After successful API call, update local state (SWR mutate)
  - [ ] Show success toast using shadcn/ui `Sonner` or `Toast`:
    - "Drift accepted for [Spec Name]"
    - "Remember to update the spec to match the implementation"
  - [ ] Navigate back to drift list or update card in-place to show "Accepted" status
  - [ ] Decrement the pending drift count in the sidebar badge
- [ ] Task 4: Display spec file path (AC: #5)
  - [ ] In the dialog or after acceptance, show the spec file path
  - [ ] Provide a "Copy Path" button to copy the file path to clipboard
  - [ ] Optionally suggest: "Open in your editor to update the spec"
- [ ] Task 5: Install toast component
  - [ ] Add shadcn/ui toast: `npx shadcn@latest add sonner` (or `toast`)
  - [ ] Add `Toaster` provider to root layout

## Dev Notes

### Key Components

- **shadcn/ui AlertDialog**: For the confirmation dialog (accessible, handles keyboard interaction)
- **shadcn/ui Sonner** (or Toast): For success/error toast notifications
- **SWR mutate**: To revalidate drift list after acceptance

### Accept Flow

```
User clicks "Accept Drift"
  -> AlertDialog opens with context
  -> User clicks "Confirm"
  -> PATCH /api/drift/[id] { decision: 'accepted' }
  -> Success response
  -> Toast: "Drift accepted"
  -> SWR revalidation updates list
  -> Drift card shows "Accepted" status
```

### API Route Implementation

The `PATCH /api/drift/[id]` route should already exist from Story 3.4. This story adds the client-side UI that calls it.

```typescript
// In PATCH handler (already created in 3.4)
const { decision } = await request.json()
await db.update(driftDetections)
  .set({
    userDecision: decision,
    decidedAt: Date.now(),
    updatedAt: Date.now(),
  })
  .where(eq(driftDetections.id, params.id))
```

### Project Structure Notes

- `src/components/drift/accept-drift-dialog.tsx` -- confirmation dialog
- Updates to `src/app/drift/[id]/page.tsx` to wire the button

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6: Drift Resolution Workflow (Accept)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Section 6.5 - Drift Resolution Workflow]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
