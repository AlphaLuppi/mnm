# Sprint Change Proposal: MnM v2.0 Feature Gap Resolution

**Date:** 2026-02-20
**Author:** Bob (Scrum Master) via BMAD Correct Course
**Status:** Pending User Approval
**Change Scope:** Major (requires PRD update + new epics/stories)

---

## 1. Issue Summary

### 1.1 Problem Statement

The current MnM implementation has **significant gaps** between the PRD v2.0 vision and actual functionality. Key features described in the PRD and brainstorm documents are either missing, stubbed, or not working correctly.

### 1.2 Triggering Issues (Evidence)

| Issue | PRD Requirement | Current State | Evidence |
|-------|-----------------|---------------|----------|
| **Drift returns empty array** | FR3.2, FR3.4 | Only triggers after agent completion; no cold-start | `src/lib/drift/detector.ts` - event listener only |
| **No conversational onboarding** | FR10.2, FR10.3 | Static wizard, not LLM-driven | `src/app/onboarding/page.tsx` - step-based UI |
| **Workflows not visible** | FR7.1, FR7.2, FR7.3 | Discovered but no UI | `/api/discovery/agents` returns data, no viewer |
| **Spec search overload** | FR9.2 | Heuristic scan, no LLM classification | `discovery-service.ts` uses glob patterns |
| **No chat interface** | FR10 (implied) | Missing entirely | No chat component exists |
| **Cross-doc drift not triggered** | FR8.2, FR8.3 | Manual API only, no UI | `cross-doc-detector.ts` exists but unused |

### 1.3 Discovery Context

- **When discovered:** During user testing and codebase exploration
- **How discovered:** User clicked "Launch" and investigated technical flow; found features returning empty/stubbed
- **Root cause:** Implementation focused on infrastructure (Epic 0-2) but skipped LLM-integration features (FR7-FR10)

---

## 2. Impact Analysis

### 2.1 Epic Impact Assessment

#### Epic 0: Infrastructure & Foundation
**Status:** ✅ Mostly Complete (ready-for-dev)
**Impact:** None — Infrastructure is solid

#### Epic 1: Spec Visibility & Navigation
**Status:** ⚠️ Partial Implementation
**Impact:** Medium
- Stories 1.2-1.5 need enhancement for LLM-driven spec classification
- Missing: LLM-powered spec type detection (currently heuristic)

#### Epic 2: Agent Orchestration & Control
**Status:** ⚠️ Working but incomplete
**Impact:** Medium
- Agent launch works (confirmed in code exploration)
- Missing: Clear visibility of BMAD workflows as launchable agents
- Story 2.4 (Agent Dashboard) needs workflow integration

#### Epic 3: Drift Detection & Resolution
**Status:** ❌ Critical Gap
**Impact:** High
- Stories 3.1-3.4 exist but drift only triggers post-agent-completion
- **Missing:** Cold-start drift detection trigger
- **Missing:** Cross-doc drift UI (FR8 not in Epic 3)
- **Missing:** Drift results viewer in UI
- Story 3.5 (Drift Alert UI) exists but no data flows to it

#### Epic 4: Spec Change Awareness
**Status:** ⚠️ Partial
**Impact:** Medium
- Git integration exists
- Story 4.2 (Important File Detection via AI) — LLM call implemented but not surfaced

#### Epic 5: Polish & Production Readiness
**Status:** ❌ Critical Gap
**Impact:** High
- Story 5.1 (Onboarding) — exists but **NOT conversational**
- **Missing:** Chat interface for onboarding
- **Missing:** LLM-driven project discovery during onboarding

### 2.2 PRD Coverage Gap Analysis

| PRD Requirement | Covered by Stories? | Implementation Status |
|-----------------|---------------------|----------------------|
| **FR7: Workflow Viewer** | ❌ No stories | Not implemented |
| **FR8: Cross-Document Drift** | ❌ No stories | Backend exists, no UI |
| **FR9: LLM-Powered Auto-Discovery** | Partial (4.2) | Partially implemented |
| **FR10: Conversational Onboarding** | ❌ Story 5.1 is wizard-based | Not implemented as described |

### 2.3 Architectural Conflicts

| Architecture Section | Current State | Conflict |
|---------------------|---------------|----------|
| Section 9.3 (Spec-as-Interface) | Code exists | Not rendering interactive actions |
| Section 7.3 (Agent Event Bus) | Implemented | Not connected to drift trigger |
| Section 8.1 (Drift Pipeline) | Implemented | Missing UI layer |

---

## 3. Recommended Path Forward

### 3.1 Evaluation of Options

#### Option 1: Direct Adjustment (Modify existing stories)
- **Viable?** Partially
- **Effort:** Medium
- **Risk:** Low
- **Analysis:** Can add missing UI components to existing stories, but need NEW stories for FR7, FR8, FR10 chat features

#### Option 2: Potential Rollback
- **Viable?** No
- **Analysis:** Current implementation is correct, just incomplete. No rollback needed.

#### Option 3: PRD MVP Review
- **Viable?** Yes — but scope should EXPAND not reduce
- **Analysis:** PRD v2.0 already defines the features; implementation didn't cover them

### 3.2 Selected Approach: **Hybrid (Option 1 + New Epics)**

**Recommendation:**
1. Create **Epic 6: LLM-Powered Features** for FR7, FR8, FR9, FR10 chat functionality
2. Enhance existing stories in Epics 3, 4, 5 to connect backend to UI
3. Add cold-start drift detection trigger

**Rationale:**
- PRD is correct — implementation is incomplete
- Brainstorm-v2 vision (conversational onboarding, workflow editor) requires new stories
- Existing infrastructure is solid — just needs UI integration
- Fastest path to working product

**Effort Estimate:** Medium (2-3 sprints for new epic)
**Risk Level:** Low (additive changes, no breaking changes)
**Timeline Impact:** Extends MVP by ~2 weeks

---

## 4. Detailed Change Proposals

### 4.1 New Epic: Epic 6 — LLM-Powered Discovery & Interaction

**Goal:** Implement the LLM-driven features specified in PRD FR7-FR10 and brainstorm-v2.

**User Outcome:** Users get conversational onboarding, workflow visualization, and intelligent project discovery.

#### New Stories for Epic 6:

---

**Story 6.1: Workflow Viewer UI (FR7.1, FR7.2)**

```
As a user,
I want to see discovered workflows as visual pipelines,
So that I understand the available development phases and steps.

Acceptance Criteria:
- Workflow list view showing all discovered BMAD workflows
- Each workflow shows: name, description, phase, agent association
- Click workflow to see step details
- "Launch Workflow" button triggers agent launch dialog

Blocked by: Story 1.2 (spec detection)
Effort: 1.5 days
```

---

**Story 6.2: Cross-Document Drift UI (FR8.3, FR8.4)**

```
As a user,
I want to see cross-document drift alerts with side-by-side comparison,
So that I can identify and resolve spec inconsistencies.

Acceptance Criteria:
- Cross-doc drift panel in dashboard
- Alerts show: "Story S-007 mentions 'websocket' but Architecture specifies 'SSE'"
- Side-by-side document view with inconsistency highlighted
- Resolution actions: Update downstream / Update source / Ignore

Blocked by: Cross-doc detector backend (exists)
Effort: 2 days
```

---

**Story 6.3: Conversational Onboarding Chat (FR10.2, FR10.3)**

```
As a new user,
I want a conversational chat experience during onboarding,
So that I can understand my project and MnM's capabilities interactively.

Acceptance Criteria:
- Chat interface replaces static wizard
- Claude introduces itself and asks about project
- LLM analyzes repo and explains what it found
- User can ask questions: "What workflows are available?"
- Chat suggests next steps based on project state

Blocked by: Story 0.7 (API key storage)
Effort: 3 days
```

---

**Story 6.4: LLM-Driven Spec Classification (FR9.2)**

```
As a user,
I want specs classified by LLM during discovery,
So that the spec browser shows accurate categorization.

Acceptance Criteria:
- During repo scan, LLM classifies each spec file
- Classification: product_brief, prd, architecture, epic, story, config
- User can review and override classifications
- Classifications persist in database

Blocked by: Story 1.2, Story 0.7
Effort: 1.5 days
```

---

**Story 6.5: Cold-Start Drift Detection Trigger**

```
As a user,
I want to trigger drift detection manually or on startup,
So that I see drift results even without running agents.

Acceptance Criteria:
- "Scan for Drift" button in drift panel
- On first load, offer to scan existing specs vs code
- Drift detection can run against any spec-code pairing
- Results display in drift alert UI (Story 3.5)

Blocked by: Story 3.4 (drift pipeline)
Effort: 1 day
```

---

**Story 6.6: Cross-Document Drift Auto-Trigger**

```
As a user,
I want cross-document drift to run automatically on key events,
So that spec inconsistencies are caught proactively.

Acceptance Criteria:
- Cross-doc drift runs when: spec saved, story created, agent completes
- Configurable in settings (enable/disable auto-scan)
- Results feed into cross-doc drift UI (Story 6.2)

Blocked by: Story 6.2
Effort: 1 day
```

---

### 4.2 Modifications to Existing Stories

#### Story 3.5: Drift Alert UI — ENHANCE

```
Section: Acceptance Criteria

OLD:
- A notification appears in the UI
- Clicking notification opens drift detail panel

NEW:
- A notification appears in the UI
- Clicking notification opens drift detail panel
- Drift panel shows results even on cold start (no agent required)
- "Scan for Drift" button triggers manual detection
- Empty state shows "No drift detected" instead of blank

Rationale: Connect UI to backend for cold-start scenario
```

---

#### Story 5.1: First-Run Onboarding Flow — REPLACE

```
Section: Full Story

OLD:
Step-by-step wizard with:
- Step 1: Welcome
- Step 2: Select Repository
- Step 3: Configure Claude API Key
- Step 4: Detect Important Files
- Step 5: Complete

NEW:
Conversational chat-based onboarding with:
- Chat welcome message from Claude
- User describes project or points to repo
- LLM analyzes repo, discovers specs/workflows/agents
- LLM explains what it found, asks clarifying questions
- User can ask questions interactively
- Chat suggests recommended next actions
- Settings captured conversationally (API key, preferences)

Rationale: Matches brainstorm-v2 vision and FR10 requirements
```

---

#### Story 2.4: Agent Dashboard UI — ENHANCE

```
Section: Acceptance Criteria - Available Agents

OLD:
- List of configured agent types (TDD, Implementation, E2E, Review)

NEW:
- List of configured agent types (TDD, Implementation, E2E, Review)
- List of discovered BMAD workflows as launchable items
- Workflow section shows: workflow name, phase, description
- Click workflow → Launch Agent dialog with workflow context

Rationale: Surface discovered BMAD workflows in agent dashboard
```

---

### 4.3 PRD Sections Requiring Update

| Section | Change |
|---------|--------|
| **FR10: Conversational Onboarding** | Clarify chat-based UX vs. wizard |
| **Scope → In Scope** | Add "Chat interface for onboarding" explicitly |
| **Success Metrics SM1.3** | Update to reflect conversational flow |

---

## 5. Implementation Handoff

### 5.1 Change Scope Classification

**Classification: MAJOR**

Requires:
- New Epic 6 with 6 stories
- Modifications to 3 existing stories
- Minor PRD clarifications

### 5.2 Handoff Plan

| Role | Responsibility |
|------|----------------|
| **Product Manager (John)** | Review and approve PRD updates |
| **Scrum Master (Bob)** | Create Epic 6, update sprint-status.yaml |
| **Architect (Winston)** | Review chat interface architecture |
| **Developer (Amelia)** | Implement stories starting with 6.5 (quick win) |

### 5.3 Recommended Implementation Order

```
Phase 1: Quick Wins (1 week)
├── Story 6.5: Cold-Start Drift Trigger (unblocks drift UI)
├── Story 3.5 Enhancement: Connect drift UI to data
└── Story 2.4 Enhancement: Surface BMAD workflows

Phase 2: Cross-Doc Drift (1 week)
├── Story 6.2: Cross-Document Drift UI
└── Story 6.6: Cross-Doc Auto-Trigger

Phase 3: LLM Discovery (1 week)
├── Story 6.4: LLM Spec Classification
└── Story 6.1: Workflow Viewer UI

Phase 4: Conversational Onboarding (1.5 weeks)
├── Story 6.3: Chat Onboarding Interface
└── Story 5.1 Replacement: Full conversational flow
```

### 5.4 Success Criteria

| Metric | Target |
|--------|--------|
| Drift detection works on cold start | ✅ Manual trigger shows results |
| Workflows visible in UI | ✅ BMAD workflows listed and launchable |
| Cross-doc drift detected | ✅ Alerts show spec inconsistencies |
| Onboarding is conversational | ✅ Chat interface, not wizard |
| Spec classification uses LLM | ✅ Accurate categorization |

---

## 6. Summary

### 6.1 What Changed

| Area | Before | After |
|------|--------|-------|
| Epics | 5 epics (47 stories) | 6 epics (53 stories) |
| Drift Detection | Post-agent only | Cold-start + auto-trigger |
| Onboarding | Static wizard | Conversational chat |
| Workflow Visibility | API only | Full UI viewer |
| Cross-Doc Drift | Backend only | Full UI + auto-trigger |

### 6.2 Why This Approach

1. **PRD is correct** — Implementation was incomplete, not PRD
2. **Brainstorm-v2 is the vision** — Conversational onboarding + workflow editor
3. **Infrastructure is solid** — Just missing UI integration
4. **Additive changes** — No breaking changes to existing code

### 6.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Chat interface complexity | Medium | Medium | Start with simple chat, iterate |
| LLM classification accuracy | Low | Low | Allow user override |
| Scope creep | Medium | High | Stick to FR7-FR10 only |

---

## 7. Approval Request

**Pantheon**, please review this Sprint Change Proposal.

**Questions for you:**

1. Do you approve the creation of **Epic 6** with 6 new stories?
2. Do you approve the **modifications** to Stories 3.5, 5.1, and 2.4?
3. Should we proceed with the **recommended implementation order** (quick wins first)?

**Response options:**
- **Yes** — Approve and proceed with implementation
- **No** — Reject and discuss alternatives
- **Revise** — Request specific changes to the proposal

---

*Sprint Change Proposal generated by Correct Course workflow — 2026-02-20*
