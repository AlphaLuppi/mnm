---
stepsCompleted: ["features-definition", "user-stories", "acceptance-criteria", "mvp-scope"]
inputDocuments: ["product-brief.md"]
workflowType: 'prd'
createdDate: '2026-02-18'
---

# Product Requirements Document - MnM MVP

**Author:** Pantheon  
**Date:** February 18, 2026  
**Product:** MnM (Product-First Agentic Development Environment)  
**Version:** 1.0 - MVP Scope  
**Status:** Draft → Architecture Review

---

## Document Purpose

This PRD defines the **Minimum Viable Product (MVP)** for MnM – the first release that demonstrates the product-first development paradigm and validates core assumptions with early adopters.

**MVP Goal:** Enable a solo developer or small team to manage product lifecycle from PRD → Code with basic drift detection, powered by integrated AI agents.

---

## Product Overview

### Vision Recap

MnM is an Agentic Development Environment where product specifications (PRDs, stories, tests) are the source of truth, and code is continuously validated against them using AI-powered drift detection.

### MVP Thesis

**We believe that:**  
If developers can see product specs alongside code *and* get automated alerts when code diverges from specs, they will maintain product documentation more consistently and ship features that better match product vision.

**We will know we're right when:**  
- Users update PRDs/stories at least weekly  
- Drift detection catches at least 1 misalignment per week per user  
- Users report >7/10 confidence in documentation accuracy after 1 month

---

## MVP Scope

### In-Scope Features (MVP)

#### **1. Workflow Dashboard**
Central interface showing product lifecycle stages and current project state.

#### **2. Workflow Stage View**
Dedicated UI for PRD → Stories → Architecture → Dev → Test → Deploy stages.

#### **3. Spec Drift Detection (Basic)**
Automated analysis comparing PRD requirements to codebase implementation.

#### **4. Agent Panel**
Interface for interacting with Pantheon AI agents (Product, Architect, Dev, QA, Scrum).

#### **5. Context Synchronization Engine**
Backend system that maintains bidirectional links between specs and code.

### Out-of-Scope (Post-MVP)

- ❌ Multi-user collaboration (real-time editing)
- ❌ Cloud sync / remote repositories
- ❌ Advanced analytics dashboard
- ❌ Custom drift detection rules
- ❌ Third-party integrations (Jira, Linear, etc.)
- ❌ Mobile companion app
- ❌ Multi-language support (start with Rust/English only)
- ❌ Export to other formats (PDF, Confluence, etc.)

**Rationale:** MVP focuses on core product-code sync loop for single user. Collaboration and integrations come after validating core value proposition.

---

## Core Features

### Feature 1: Workflow Dashboard

**Purpose:** Provide at-a-glance view of project health and current workflow stage.

#### User Stories

**US-001: View Workflow Status**
- **As a** developer  
- **I want to** see which workflow stage I'm currently in (PRD, Stories, Dev, etc.)  
- **So that** I know what phase of product development I'm focusing on

**Acceptance Criteria:**
- ✅ Dashboard displays 6 workflow stages: PRD, Stories, Architecture, Dev, Test, Deploy
- ✅ Current active stage is visually highlighted
- ✅ Each stage shows completion percentage (0-100%)
- ✅ Click on stage navigates to that stage's detail view

**US-002: View Spec Drift Alerts**
- **As a** product-focused developer  
- **I want to** see critical drift alerts on the dashboard  
- **So that** I can quickly identify spec-code misalignments

**Acceptance Criteria:**
- ✅ Dashboard shows count of active drift alerts (e.g., "3 drift alerts")
- ✅ Alerts categorized by severity: Critical, Warning, Info
- ✅ Clicking alert navigates to drift detail view
- ✅ Dismissed alerts don't show on dashboard

**US-003: Quick Actions**
- **As a** developer  
- **I want to** access common actions from the dashboard  
- **So that** I can jump directly into my work

**Acceptance Criteria:**
- ✅ "Create New PRD" button visible
- ✅ "Add User Story" button visible
- ✅ "Run Drift Check" button triggers manual drift analysis
- ✅ "Open Agent Chat" button opens agent panel

#### Technical Requirements

- **UI Framework:** GPUI 0.2.2 (Rust-based GPU-accelerated UI)
- **Layout:** Single-window app with dashboard as home view
- **State Management:** Workflow stage state persisted locally (JSON file)
- **Performance:** Dashboard loads <500ms on cold start

---

### Feature 2: Workflow Stage View

**Purpose:** Provide dedicated interface for each product lifecycle stage.

#### User Stories

**US-004: PRD Editor**
- **As a** product manager / developer  
- **I want to** write and edit PRDs in Markdown  
- **So that** I can document product requirements clearly

**Acceptance Criteria:**
- ✅ PRD editor supports Markdown with syntax highlighting
- ✅ PRD saved to `_bmad-output/planning-artifacts/PRD.md`
- ✅ PRD includes frontmatter: title, author, date, version
- ✅ Auto-save every 30 seconds
- ✅ PRD preview pane (split view: edit | preview)

**US-005: User Stories Management**
- **As a** developer  
- **I want to** create user stories linked to PRD sections  
- **So that** I can break down requirements into actionable work

**Acceptance Criteria:**
- ✅ Create story with: Title, As a/I want/So that, Acceptance Criteria
- ✅ Stories stored in `_bmad-output/planning-artifacts/stories/`
- ✅ Stories list view shows all stories with status (Todo, In Progress, Done)
- ✅ Link story to PRD requirement (by section header or tag)
- ✅ Stories exported as Markdown files

**US-006: Architecture View**
- **As an** architect / lead developer  
- **I want to** document system architecture and design decisions  
- **So that** implementation aligns with technical strategy

**Acceptance Criteria:**
- ✅ Architecture document editor (Markdown)
- ✅ Support for Mermaid diagrams (rendered in preview)
- ✅ ADR (Architecture Decision Record) templates
- ✅ Architecture saved to `_bmad-output/planning-artifacts/architecture.md`

**US-007: Dev Panel Integration**
- **As a** developer  
- **I want to** see relevant PRD/stories while coding  
- **So that** I have context without switching windows

**Acceptance Criteria:**
- ✅ Dev panel shows "Current Story" (selected story displayed in sidebar)
- ✅ Dev panel shows "Related Requirements" (PRD sections linked to current file)
- ✅ Keyboard shortcut to toggle context sidebar (Cmd+Shift+K)

**US-008: Test Spec View**
- **As a** QA engineer / developer  
- **I want to** see test specs generated from acceptance criteria  
- **So that** I can verify implementation meets requirements

**Acceptance Criteria:**
- ✅ Test spec view lists all stories with acceptance criteria
- ✅ "Generate Test Stubs" button creates Rust test files from AC
- ✅ Test status indicators (Passed, Failed, Not Run)

**US-009: Deploy View**
- **As a** developer  
- **I want to** see deployment checklist and generate changelogs  
- **So that** releases are well-documented

**Acceptance Criteria:**
- ✅ Deploy checklist: Tests passed, Docs updated, Drift alerts resolved
- ✅ "Generate Changelog" button extracts completed stories and creates CHANGELOG.md
- ✅ Deployment status indicators (Ready, Blocked, Deployed)

#### Technical Requirements

- **Navigation:** Tab-based navigation between stages
- **Persistence:** All documents saved as Markdown files in `_bmad-output/`
- **Editor:** GPUI-based text editor with syntax highlighting
- **Preview:** Real-time Markdown rendering (supports Mermaid diagrams)

---

### Feature 3: Spec Drift Detection (Basic)

**Purpose:** Detect when code implementation diverges from product specifications.

#### User Stories

**US-010: Automated Drift Analysis**
- **As a** developer  
- **I want** MnM to automatically detect when code doesn't match PRD  
- **So that** I'm alerted to spec-code misalignments

**Acceptance Criteria:**
- ✅ Drift analysis runs automatically on file save (debounced)
- ✅ Manual trigger: "Run Drift Check" button
- ✅ Analysis compares: PRD requirements ↔ Codebase APIs/structs
- ✅ Analysis time <10 seconds for projects <10k LOC

**US-011: Drift Alerts Display**
- **As a** developer  
- **I want to** see clear descriptions of detected drift  
- **So that** I understand what's misaligned and why

**Acceptance Criteria:**
- ✅ Drift alerts show: Type, Severity, Description, Location (file/line)
- ✅ Alert types: Missing Feature, Undocumented Feature, Behavioral Drift
- ✅ Severity levels: Critical (blocks deploy), Warning (review recommended), Info
- ✅ Click alert navigates to relevant code or PRD section

**US-012: Drift Resolution Tracking**
- **As a** developer  
- **I want to** mark drift alerts as resolved or dismissed  
- **So that** I can track progress on alignment

**Acceptance Criteria:**
- ✅ "Resolve" button: User confirms spec/code now aligned
- ✅ "Dismiss" button: User acknowledges drift is intentional (with reason)
- ✅ Dismissed alerts stay dismissed until spec/code changes again
- ✅ Resolved alerts disappear from dashboard

#### Technical Requirements

**Drift Detection Algorithm (MVP - Simple Rules-Based):**

1. **Extract Requirements from PRD**
   - Parse Markdown headings and bullet points
   - Identify feature keywords (e.g., "User can edit profile")

2. **Analyze Codebase**
   - Parse Rust code: extract public APIs, structs, functions
   - Build code inventory: endpoints, data models, services

3. **Match Requirements to Code**
   - Keyword matching: "edit profile" → look for `edit_profile()`, `ProfileEdit`, etc.
   - Structure matching: PRD mentions "Authentication" → expect `auth` module

4. **Generate Alerts**
   - **Missing Feature:** PRD requirement found, no matching code
   - **Undocumented Feature:** Code API found, not mentioned in PRD
   - **Behavioral Drift:** (Future) Use AI to detect semantic mismatches

**Technology:**
- **Parser:** `tree-sitter` for Rust AST parsing
- **NLP (Basic):** Keyword extraction from PRD using simple regex + stemming
- **Storage:** Alerts stored in `.mnm/drift-alerts.json`

**Limitations (MVP):**
- No semantic understanding (future: use OpenClaw API + LLM)
- Rust-only codebase support
- No cross-file dependency analysis
- Manual dismissal required (no auto-resolution)

---

### Feature 4: Agent Panel

**Purpose:** Interface for interacting with Pantheon AI agents that assist with product work.

#### User Stories

**US-013: Agent Chat Interface**
- **As a** developer  
- **I want to** chat with AI agents about product decisions  
- **So that** I get intelligent assistance on specs, architecture, code

**Acceptance Criteria:**
- ✅ Agent panel accessible via sidebar or keyboard shortcut (Cmd+Shift+A)
- ✅ Agent selector: Product Agent, Architect Agent, Dev Agent, QA Agent, Scrum Agent
- ✅ Chat interface with message history
- ✅ Agents have access to current PRD, stories, and codebase context

**US-014: Agent-Suggested Actions**
- **As a** developer  
- **I want** agents to suggest next actions based on product state  
- **So that** I follow best practices without manual planning

**Acceptance Criteria:**
- ✅ Product Agent suggests: "Your PRD is missing acceptance criteria for Feature X"
- ✅ Architect Agent suggests: "Based on PRD, consider adding a `sync` module"
- ✅ Dev Agent suggests: "Story ABC is ready for implementation"
- ✅ Suggestions appear as notifications (dismissible)

**US-015: Agent-Assisted Drift Resolution**
- **As a** developer  
- **I want** agents to help resolve drift alerts  
- **So that** I get guidance on how to align spec and code

**Acceptance Criteria:**
- ✅ Click drift alert → "Ask Agent" button appears
- ✅ Agent explains drift in plain English
- ✅ Agent suggests: Update PRD or Update Code (with code diff preview)
- ✅ User can apply agent suggestion with one click

#### Technical Requirements

**Agent Integration:**
- **Backend:** OpenClaw API for agent communication
- **Agent Context:** Agents receive:
  - Full PRD content
  - All user stories
  - Current file being edited
  - Drift alerts list
- **Agent Keys:** Use Olympus agent keys (`olympus_daedalus_architect_key_2026`, etc.)
- **Response Time:** <3 seconds for chat responses (streaming preferred)

**Agent Capabilities (MVP):**
- ✅ **Product Agent:** PRD refinement, feature prioritization suggestions
- ✅ **Architect Agent:** System design recommendations, ADR generation
- ✅ **Dev Agent:** Code generation from stories, refactoring suggestions
- ✅ **QA Agent:** Test generation from acceptance criteria
- ✅ **Scrum Agent:** Sprint planning, progress reports

**Limitations (MVP):**
- No multi-agent collaboration (agents work independently)
- No agent memory across sessions (context reset on restart)
- No custom agent configuration

---

### Feature 5: Context Synchronization Engine

**Purpose:** Backend system maintaining bidirectional links between specs and code.

#### User Stories

**US-016: Auto-Link Stories to Code**
- **As a** developer  
- **I want** MnM to automatically link stories to relevant code files  
- **So that** I can see which code implements which story

**Acceptance Criteria:**
- ✅ When story created, MnM suggests related code files (based on keywords)
- ✅ User can manually link story to files/functions
- ✅ Linked files show story reference in editor sidebar
- ✅ Links persisted in `.mnm/context-graph.json`

**US-017: Spec-Code Traceability**
- **As a** product manager  
- **I want to** see which code files relate to each PRD section  
- **So that** I understand implementation scope

**Acceptance Criteria:**
- ✅ PRD view shows "Linked Code" section per requirement
- ✅ Code files show "Linked Requirements" in sidebar
- ✅ Click link navigates to related spec or code

**US-018: Context Change Notifications**
- **As a** developer  
- **I want to** be notified when specs change for code I'm working on  
- **So that** I stay aligned with product updates

**Acceptance Criteria:**
- ✅ When PRD section updated, linked code files flagged "Spec Updated"
- ✅ When code updated, linked stories flagged "Implementation Changed"
- ✅ Notification appears in status bar (dismissible)

#### Technical Requirements

**Context Graph Data Structure:**
```json
{
  "links": [
    {
      "prd_section": "## User Authentication",
      "story_id": "story-001",
      "code_files": ["src/auth/mod.rs", "src/auth/login.rs"],
      "last_synced": "2026-02-18T10:30:00Z"
    }
  ],
  "drift_alerts": [...],
  "agent_suggestions": [...]
}
```

**Persistence:**
- All links stored in `.mnm/context-graph.json`
- File watched for changes (rebuild graph on edit)

**Sync Triggers:**
- File save (code or spec)
- Manual "Sync Context" button
- On app startup (initial graph build)

---

## User Experience

### Target User Flow (MVP)

1. **Day 1: Setup**
   - User opens MnM, sees welcome dashboard
   - Clicks "Create New PRD" → editor opens
   - Writes PRD in Markdown, saves

2. **Day 2: Define Stories**
   - User switches to "Stories" tab
   - Creates 5 user stories with acceptance criteria
   - MnM auto-links stories to PRD sections (suggests links)

3. **Day 3-7: Development**
   - User switches to "Dev" tab
   - Selects story to work on → context sidebar shows story + PRD
   - Writes code, MnM syncs context graph
   - On file save, drift analysis runs → 1 alert: "Missing endpoint for story-003"

4. **Day 8: Drift Resolution**
   - User reviews drift alert
   - Clicks "Ask Agent" → Dev Agent explains: "Story requires POST /profile/edit endpoint, not found"
   - User implements endpoint, drift alert auto-resolves

5. **Day 14: First Release**
   - User switches to "Deploy" tab
   - Sees checklist: ✅ Tests passed, ✅ Drift alerts resolved, ✅ Docs updated
   - Clicks "Generate Changelog" → CHANGELOG.md created from completed stories
   - Deploys with confidence

---

## Non-Functional Requirements

### Performance

- **Startup Time:** <2 seconds (cold start)
- **Drift Analysis:** <10 seconds (projects <10k LOC)
- **File Save Response:** <100ms (incremental context update)
- **Agent Response:** <3 seconds (chat interaction)

### Reliability

- **Data Persistence:** All docs auto-saved locally (no data loss on crash)
- **Offline Support:** All features work offline (no cloud dependency for MVP)
- **Error Handling:** Graceful degradation (if drift analysis fails, show error but don't block UI)

### Usability

- **Learning Curve:** User can create PRD + first story within 10 minutes
- **Keyboard Shortcuts:** All common actions accessible via keyboard
- **Accessibility:** WCAG 2.1 AA compliance (high contrast mode, keyboard navigation)

### Security

- **Data Storage:** All files stored locally (no cloud sync in MVP)
- **Agent API:** Use secure API keys for OpenClaw (keys stored in keychain)
- **No Telemetry:** Zero usage tracking in MVP (privacy-first)

---

## Technical Architecture Preview

### Tech Stack

- **Frontend/UI:** GPUI 0.2.2 (Rust GPU-accelerated UI framework)
- **Backend/Logic:** Rust (project parsing, drift detection, context graph)
- **Data Storage:** Local file system (Markdown files + JSON for metadata)
- **Agent Integration:** OpenClaw API (HTTP requests to agent endpoints)
- **Code Parsing:** `tree-sitter` (Rust AST parsing)

### System Modules (High-Level)

1. **UI Module:** Dashboard, Workflow Views, Agent Panel
2. **Workflow Module:** PRD/Story/Architecture editors, state management
3. **Sync Module:** Context graph, spec-code linking
4. **Drift Module:** Analysis engine, alert generation
5. **Agent Module:** OpenClaw API client, agent context builder

*Detailed architecture in separate Architecture Document.*

---

## Success Criteria (MVP)

### Launch Criteria

Before public release, MnM MVP must:
- ✅ Allow user to create PRD + 5 stories + architecture doc
- ✅ Detect at least 3 types of drift (Missing Feature, Undocumented Feature, Behavioral)
- ✅ Integrate with 3 Pantheon agents (Product, Architect, Dev)
- ✅ Run on macOS (primary platform)
- ✅ No critical bugs (P0/P1 bugs = 0)

### Post-Launch Metrics (30 days)

- **Adoption:** 10+ active users (Pantheon team + 5 early adopters)
- **Engagement:** Users create ≥1 PRD and ≥3 stories per week
- **Drift Detection:** ≥70% of users encounter ≥1 drift alert per week
- **Satisfaction:** NPS >50 from early adopters

---

## Out-of-Scope (Explicit)

### Features NOT in MVP

1. **Real-time Collaboration**
   - No multi-user editing (single-user app for MVP)
   - No shared workspaces or cloud sync

2. **Advanced Analytics**
   - No dashboards for team productivity
   - No burndown charts or velocity tracking

3. **Integrations**
   - No Jira, Linear, GitHub Issues sync
   - No CI/CD pipeline integration
   - No Slack/Discord notifications

4. **Multi-Language Support**
   - Rust-only codebase parsing in MVP
   - English-only UI and documentation

5. **Custom Drift Rules**
   - No user-defined drift patterns
   - No severity customization

6. **Export/Import**
   - No PDF export
   - No import from Notion/Confluence
   - No API for third-party integrations

7. **Mobile App**
   - Desktop-only (macOS/Linux/Windows)

**Rationale:** Focus MVP on core value loop (PRD → Code → Drift Detection) with single-user. Expand to collaboration and integrations post-validation.

---

## Risks & Mitigations

### Risk 1: Drift Detection Accuracy (High)

**Risk:** False positives/negatives reduce trust in drift alerts.

**Mitigation:**
- Start with simple keyword matching (low false positives)
- Add "Dismiss" option to handle intentional drift
- User feedback loop: "Was this alert helpful?" (track accuracy)

### Risk 2: Agent Integration Complexity (Medium)

**Risk:** OpenClaw API changes or rate limits break agent features.

**Mitigation:**
- Abstract agent interface (easy to swap providers)
- Graceful degradation (app works without agents)
- Cache agent responses to reduce API calls

### Risk 3: GPUI Learning Curve (Medium)

**Risk:** GPUI 0.2.2 is less mature than Electron/Tauri, slower development.

**Mitigation:**
- Invest in GPUI examples and documentation
- Budget extra time for UI polish (2x typical web dev time)
- Fallback: Prototype UI in Tauri if GPUI blocks progress

### Risk 4: User Adoption (High)

**Risk:** Users don't adopt product-first workflow (too different from code-first habits).

**Mitigation:**
- Onboarding tutorial ("Your first PRD in 5 minutes")
- Gamification: "Spec Coverage Score" to incentivize documentation
- Community: Share MnM workflows on Twitter/YouTube (BMAD audience)

---

## Dependencies

### External Dependencies

- **OpenClaw API:** Agent integration requires API access (keys: `olympus_*_key_2026`)
- **GPUI 0.2.2:** UI framework (open source, but evolving)
- **tree-sitter:** Rust grammar (stable)

### Internal Dependencies

- **Olympus API:** If using Olympus task system for agent orchestration
- **BMAD Method:** MnM workflow aligns with BMAD stages (not a hard dependency but synergy)

---

## Appendix

### User Story Summary

| ID | Feature | Priority |
|----|---------|----------|
| US-001 | View Workflow Status | P0 (Must-Have) |
| US-002 | View Spec Drift Alerts | P0 |
| US-003 | Quick Actions | P1 (Should-Have) |
| US-004 | PRD Editor | P0 |
| US-005 | User Stories Management | P0 |
| US-006 | Architecture View | P1 |
| US-007 | Dev Panel Integration | P1 |
| US-008 | Test Spec View | P2 (Nice-to-Have) |
| US-009 | Deploy View | P2 |
| US-010 | Automated Drift Analysis | P0 |
| US-011 | Drift Alerts Display | P0 |
| US-012 | Drift Resolution Tracking | P1 |
| US-013 | Agent Chat Interface | P0 |
| US-014 | Agent-Suggested Actions | P1 |
| US-015 | Agent-Assisted Drift Resolution | P1 |
| US-016 | Auto-Link Stories to Code | P1 |
| US-017 | Spec-Code Traceability | P2 |
| US-018 | Context Change Notifications | P2 |

**MVP Scope:** P0 (must-have) + P1 (should-have) = 13 user stories  
**Post-MVP:** P2 (nice-to-have) = 3 user stories

### Glossary

- **ADE:** Agentic Development Environment
- **PRD:** Product Requirements Document
- **Spec Drift:** Divergence between product specifications and code implementation
- **Context Graph:** Data structure linking specs to code files
- **BMAD:** Build More, Architect Dreams (product development methodology)
- **AC:** Acceptance Criteria
- **ADR:** Architecture Decision Record

---

**Document Status:** ✅ Complete  
**Next Document:** Architecture Document  
**Owner:** Pantheon Team  
**Reviewers:** Daedalus (Architect), Hephaestos (Dev Lead)
