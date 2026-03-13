---
story_id: "6.6"
title: "Cross-Document Drift Auto-Trigger"
epic: "Epic 6: LLM-Powered Discovery & Interaction"
status: ready-for-dev
priority: medium
estimate: 1 day
created: 2026-02-20
tags: [backend, drift, automation]
blocked_by: ["6-2"]
---

# Story 6.6: Cross-Document Drift Auto-Trigger

## User Story

**As a** user,
**I want** cross-document drift to run automatically on key events,
**So that** spec inconsistencies are caught proactively without manual intervention.

## Background

The PRD (FR8.2) and brainstorm-v2 describe proactive drift detection. Cross-doc drift detection exists in `src/lib/drift/cross-doc-detector.ts` but only runs via manual API call.

The brainstorm-v2 user stories include:
- US3: "MnM vérifie automatiquement l'alignement quand une story passe en 'Done', une nouvelle story est créée, un merge request est ouvert"

## Acceptance Criteria

### AC1: Trigger on Spec Save
**Given** a spec file is modified and saved
**When** MnM detects the change (via file watcher or git)
**Then**:
- Cross-doc drift runs for that spec
- Compares against parent documents in hierarchy
- Results appear in cross-doc drift UI

### AC2: Trigger on Agent Completion
**Given** an agent completes work on a spec
**When** the agent status changes to "completed"
**Then**:
- Cross-doc drift runs for the spec the agent worked on
- Also checks related specs in the hierarchy

### AC3: Trigger on Discovery
**Given** MnM runs initial discovery
**When** all specs are indexed
**Then**:
- Full cross-doc drift scan runs automatically
- User sees: "Found 3 cross-document inconsistencies"

### AC4: Settings Toggle
**Given** I open Settings
**When** I view the Drift Detection section
**Then** I see toggles for:
- "Auto-scan on spec save" (default: on)
- "Auto-scan on agent completion" (default: on)
- "Auto-scan on discovery" (default: on)

### AC5: Scan Debouncing
**Given** multiple triggers fire rapidly (e.g., saving multiple files)
**When** auto-triggers accumulate
**Then**:
- Scans are debounced (wait 5 seconds for activity to settle)
- Single scan runs with all affected specs
- Prevents API rate limiting

### AC6: Background Execution
**Given** auto-trigger fires
**When** cross-doc drift runs
**Then**:
- Runs in background (doesn't block UI)
- Small toast notification: "Checking for cross-doc drift..."
- Results appear silently unless issues found

### AC7: Notification on Detection
**Given** auto-scan finds cross-doc drift
**When** results are available
**Then**:
- Toast notification: "⚠️ 2 cross-document inconsistencies found"
- Notification is clickable → navigates to cross-doc drift UI
- Badge appears on Drift nav item

## Technical Notes

### Event Integration
- Hook into `agentEventBus` for agent completion events
- Add file watcher for spec files (or use git status polling)
- Integrate with discovery service completion

### Debouncing
```typescript
// Debounce multiple triggers
const debouncedScan = debounce(async (specIds: string[]) => {
  await crossDocDetector.detectDrift(specIds);
}, 5000);
```

### Settings Storage
- Add settings to `.mnm/config.json`:
  - `crossDocDrift.autoScanOnSave`
  - `crossDocDrift.autoScanOnAgentComplete`
  - `crossDocDrift.autoScanOnDiscovery`

### File Locations
- Update: `src/lib/drift/cross-doc-detector.ts` — Add auto-trigger logic
- Update: `src/lib/agent/event-bus.ts` — Add cross-doc drift listener
- Update: `src/app/settings/page.tsx` — Add toggle UI
- New: `src/lib/drift/auto-trigger.ts` — Centralized trigger management

## Out of Scope
- Git hook integration (post-commit, post-merge)
- CI/CD pipeline integration
- Scheduled cron-style scans

## Definition of Done
- [ ] Auto-trigger on spec save works
- [ ] Auto-trigger on agent completion works
- [ ] Auto-trigger on discovery completion works
- [ ] Settings toggles control each trigger
- [ ] Debouncing prevents rapid-fire scans
- [ ] Background execution doesn't block UI
- [ ] Toast notifications for detected drift
- [ ] Unit tests for auto-trigger logic
- [ ] Integration test for end-to-end flow

## Dependencies
- Story 6.2 (Cross-Document Drift UI)

## References
- PRD: FR8.2
- Brainstorm-v2: US3 (Compliance Check automatique)
