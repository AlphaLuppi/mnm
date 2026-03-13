---
story_id: "6.5"
title: "Cold-Start Drift Detection Trigger"
epic: "Epic 6: LLM-Powered Discovery & Interaction"
status: ready-for-dev
priority: critical
estimate: 1 day
created: 2026-02-20
tags: [backend, frontend, drift, quick-win]
blocked_by: ["3-4"]
---

# Story 6.5: Cold-Start Drift Detection Trigger

## User Story

**As a** user,
**I want to** trigger drift detection manually or on startup,
**So that** I see drift results even without running agents first.

## Background

Current drift detection only triggers after an agent completes (via event listener in `src/lib/drift/index.ts`). On cold start (no agents run yet), the drift API returns an empty array.

The user reported: "Spec drift just returns an empty array immediately, no workflow launch to detect drift."

This story adds manual and startup triggers for drift detection.

## Acceptance Criteria

### AC1: Manual Drift Scan Button
**Given** I am on the Drift page
**When** I look at the UI
**Then** I see a "Scan for Drift" button

**When** I click "Scan for Drift"
**Then**:
- A dialog appears asking which spec to scan
- I can select a spec from dropdown or "All specs"
- Clicking "Scan" triggers drift detection

### AC2: Drift Detection Without Agent
**Given** I trigger a manual drift scan
**When** drift detection runs
**Then**:
- Drift is detected by comparing spec against related code files
- Scope is determined by: files in same directory, files mentioned in spec, or user-selected files
- Results appear in the drift list

### AC3: Startup Drift Offer
**Given** I open MnM and drift detection hasn't run recently
**When** the dashboard loads
**Then** I see a prompt: "Would you like to scan for spec drift?"
- "Scan Now" button triggers full drift scan
- "Later" dismisses for this session
- "Don't ask again" persists preference

### AC4: Progress Indicator
**Given** drift detection is running
**When** I view the Drift page
**Then** I see:
- "Scanning for drift..." message
- Progress: "Analyzing spec 3/12"
- Cancel button to abort

### AC5: Empty State Update
**Given** no drift has been detected
**When** I view the Drift page
**Then** I see:
- "No drift detected" message (not blank/empty)
- "Scan for Drift" button prominently displayed
- Helpful text: "Run a scan to check for misalignment between specs and code"

### AC6: Scan History
**Given** drift scans have been run
**When** I view the Drift page
**Then** I see:
- "Last scanned: 5 minutes ago"
- Number of issues found in last scan

## Technical Notes

### Scope Detection
When no agent is specified, determine code scope by:
1. Files in same directory as spec
2. Files mentioned in spec content (e.g., `src/lib/agent/`)
3. Files with similar names (spec: `auth.story.md` → code: `auth.ts`)

### API Changes
- `POST /api/drift` — Update to accept `scopeOverride` parameter
- Add `GET /api/drift/status` — Returns scan status, last scan time

### UI Components
- Scan button with loading state
- Spec selector dropdown
- Progress indicator
- Empty state component

### File Locations
- Update: `src/app/drift/page.tsx`
- Update: `src/components/drift/drift-list.tsx`
- New: `src/components/drift/scan-drift-dialog.tsx`
- New: `src/components/drift/drift-empty-state.tsx`
- Update: `src/lib/drift/detector.ts` — Add scope inference

## Out of Scope
- Automatic scheduled scans (post-MVP)
- Webhook triggers from git operations
- Parallel scanning of multiple specs

## Definition of Done
- [ ] "Scan for Drift" button triggers manual detection
- [ ] Drift detection works without prior agent run
- [ ] Startup prompt offers drift scan
- [ ] Progress indicator shows scan status
- [ ] Empty state displays helpful message
- [ ] Last scan time is tracked and displayed
- [ ] Unit tests for new components
- [ ] Integration test for manual drift flow

## Dependencies
- Story 3.4 (Drift Detection Pipeline)

## References
- PRD: FR3.2, FR3.4
- User feedback: "Drift returns empty array immediately"
