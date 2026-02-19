---
date: 2026-02-19
author: Daedalus (System Architect)
version: 1.0
status: Draft
stepsCompleted: []
inputDocuments:
  - product-brief-mnm-2026-02-18.md
  - prd.md
  - architecture.md
---

# MnM - Epic Breakdown

## Overview

**Total Epics:** 5
**Total Stories:** 47
**Target Platform:** macOS (MVP)
**Tech Stack:** Rust + GPUI 0.2.2 + SQLite + git2-rs

### Coverage Summary
- **Functional Requirements:** All FRs (FR1-FR6) covered
- **Non-Functional Requirements:** All NFRs integrated into stories
- **Architecture Decisions:** All ADRs reflected in implementation

---

## Requirements Inventory

### Functional Requirements (from PRD)

**FR1: Agent & Workflow Dashboard**
- FR1.1: Display real-time view of all available agents
- FR1.2: Display real-time view of all running agents
- FR1.3: Provide agent control actions
- FR1.4: Multi-agent orchestration visibility

**FR2: Spec-Driven Agent Launching**
- FR2.1: Browse specifications in unified view
- FR2.2: Launch agents from any spec
- FR2.3: Agent-to-spec tracking
- FR2.4: Agent scope management

**FR3: Progress & Drift Detection**
- FR3.1: Track workflow and story completion
- FR3.2: Detect spec drift
- FR3.3: Generate drift insights
- FR3.4: Drift resolution workflow
- FR3.5: Progress reporting

**FR4: Spec Change Awareness (Git-Driven)**
- FR4.1: Detect important files via AI
- FR4.2: Detect git changes
- FR4.3: Brief user on spec changes
- FR4.4: Propagate awareness

**FR5: Git Integration**
- FR5.1: Repository connection
- FR5.2: Git operations
- FR5.3: Commit association

**FR6: Code Viewing (Read-Only)**
- FR6.1: Display code files
- FR6.2: Code-to-spec linking
- FR6.3: Diff viewing

### Non-Functional Requirements (from PRD)

**NFR1: Performance**
- NFR1.1: UI responsiveness (60+ FPS, target 120 FPS)
- NFR1.2: Drift detection performance (< 5s for 1000 LOC)
- NFR1.3: Git operations (< 200ms)

**NFR2: Scalability**
- NFR2.1: Support 10 concurrent agents
- NFR2.2: Handle 500 stories
- NFR2.3: Search performance < 300ms

**NFR3: Reliability**
- NFR3.1: Agent fault tolerance
- NFR3.2: Data integrity
- NFR3.3: Graceful degradation

**NFR4: Usability**
- NFR4.1: Onboarding < 2 minutes
- NFR4.2: Consistent UI/UX (Zed-inspired)
- NFR4.3: Accessibility support

**NFR5: Extensibility**
- NFR5.1: Multi-framework architecture (Claude Code MVP)
- NFR5.2: Multiple spec format support

**NFR6: Security & Privacy**
- NFR6.1: Local-first data (no cloud)
- NFR6.2: Agent sandboxing
- NFR6.3: Secure API key management

### Additional Requirements (from Architecture)

**Tech Stack Constraints:**
- Rust + GPUI 0.2.2
- SQLite (sqlez or rusqlite)
- git2-rs for Git integration
- Claude API for drift detection

**Architectural Decisions:**
- Cargo workspace structure (multi-crate)
- Pre-work file locking for multi-agent orchestration
- IPC-based Claude Code integration
- Hybrid drift detection (git diff + Claude API)

---

## FR Coverage Map

**Epic 0: Infrastructure & Foundation**
- NFR3.2 (Data integrity via migrations)
- NFR6.3 (API key management)
- Architecture: Cargo workspace, SQLite setup

**Epic 1: Spec Visibility & Navigation**
- FR2.1: Browse specifications in unified view
- FR6.1: Display code files
- FR6.2: Code-to-spec linking
- FR6.3: Diff viewing
- NFR4.2 (UI/UX design system)

**Epic 2: Agent Orchestration & Control**
- FR1.1: Display available agents
- FR1.2: Display running agents
- FR1.3: Provide agent control actions
- FR1.4: Multi-agent orchestration visibility
- FR2.2: Launch agents from spec
- FR2.3: Agent-to-spec tracking
- FR2.4: Agent scope management
- NFR1.1 (UI responsiveness)
- NFR2.1 (Concurrent agents)
- NFR3.1 (Agent fault tolerance)

**Epic 3: Drift Detection & Resolution**
- FR3.1: Track workflow and story completion
- FR3.2: Detect spec drift
- FR3.3: Generate drift insights
- FR3.4: Drift resolution workflow
- FR3.5: Progress reporting
- NFR1.2 (Drift detection performance)

**Epic 4: Spec Change Awareness**
- FR4.1: Detect important files via AI
- FR4.2: Detect git changes
- FR4.3: Brief user on spec changes
- FR4.4: Propagate awareness
- FR5.1: Repository connection
- FR5.2: Git operations
- FR5.3: Commit association
- NFR1.3 (Git performance)

**Epic 5: Polish & Production Readiness**
- NFR4.1: Onboarding flow
- NFR4.3: Accessibility
- NFR6.1: Privacy guarantees
- NFR6.2: Agent sandboxing

---

## Epic List

### Epic 0: Infrastructure & Foundation
Set up the foundational technical infrastructure that enables all other features to function. Users get a reliable, performant application foundation.

**FRs covered:** NFR3.2, NFR6.3, Architecture (Cargo workspace, SQLite, migrations)

**User outcome:** MnM runs reliably with proper data persistence and secure configuration management.

---

### Epic 1: Spec Visibility & Navigation
Users can browse, search, and navigate their product specifications (PRD, stories, architecture) in a unified, GPU-accelerated interface with code viewing capabilities.

**FRs covered:** FR2.1, FR6.1, FR6.2, FR6.3, NFR4.2

**User outcome:** Users have a clear, fast view of all specs and code, with navigation between related artifacts.

---

### Epic 2: Agent Orchestration & Control
Users can launch, monitor, and control multiple AI agents working on different specs in parallel, with visibility into what each agent is doing and conflict prevention.

**FRs covered:** FR1.1, FR1.2, FR1.3, FR1.4, FR2.2, FR2.3, FR2.4, NFR1.1, NFR2.1, NFR3.1

**User outcome:** Users orchestrate multiple agents efficiently without merge conflicts or lost context.

---

### Epic 3: Drift Detection & Resolution
Users receive intelligent alerts when code diverges from specifications, with actionable insights on whether to update specs or recenter code.

**FRs covered:** FR3.1, FR3.2, FR3.3, FR3.4, FR3.5, NFR1.2

**User outcome:** Users maintain alignment between product vision and implementation through automated drift detection.

---

### Epic 4: Spec Change Awareness
Users are automatically notified when important specification files change in Git, with AI-generated summaries of what changed and why it matters.

**FRs covered:** FR4.1, FR4.2, FR4.3, FR4.4, FR5.1, FR5.2, FR5.3, NFR1.3

**User outcome:** Users stay aware of spec changes from teammates or git operations, preventing surprise misalignment.

---

### Epic 5: Polish & Production Readiness
Users experience a polished, accessible, production-ready application with smooth onboarding and proper security/privacy guarantees.

**FRs covered:** NFR4.1, NFR4.3, NFR6.1, NFR6.2

**User outcome:** Users onboard quickly, feel confident in data privacy, and experience a refined, accessible interface.

---

---

# Epic 0: Infrastructure & Foundation

**Goal:** Set up the foundational technical infrastructure that enables all other features to function.

**Value:** Users get a reliable, performant application foundation with proper data persistence and secure configuration.

---

### Story 0.1: Cargo Workspace Initialization

**[Backend] [Infra]**

As a developer,
I want a well-structured Cargo workspace,
So that I can develop modular, maintainable code.

**Acceptance Criteria:**

**Given** a fresh repository
**When** the workspace is initialized
**Then** the following crates exist:
- `mnm-core` (domain models, zero dependencies on other MnM crates)
- `mnm-ui` (GPUI UI components)
- `mnm-agent` (agent orchestration)
- `mnm-drift` (drift detection)
- `mnm-git` (git integration)
- `mnm-db` (SQLite persistence)
- `mnm-spec` (spec parsing)

**And** `Cargo.toml` workspace file correctly configures all crates
**And** dependencies are properly declared:
- `gpui = "0.2.2"` (exact pin)
- `gpui-component = "^0.5.1"`
- `git2 = "~0.19"`
- `rusqlite` or `sqlez` (latest stable)
- `tokio = "1.x"`
- `serde = "1.x"`

**And** each crate compiles successfully with `cargo build`

**Blocked by:** None

**Estimated effort:** 0.5 day

---

### Story 0.2: SQLite Database Setup & Migrations

**[Backend] [Infra]**

As a developer,
I want a robust SQLite database with migrations,
So that I can reliably persist application state.

**Acceptance Criteria:**

**Given** the `mnm-db` crate
**When** the database is initialized
**Then** `.mnm/state.db` is created in the repository root

**And** the following tables are created via migrations:
- `agents` (id, name, status, spec_id, scope, timestamps)
- `specs` (id, file_path, spec_type, title, content_hash, git_commit_sha)
- `drift_detections` (id, agent_id, spec_id, severity, drift_type, summary, recommendation)
- `file_locks` (id, file_path, agent_id, lock_type, acquired_at, released_at)
- `important_files` (id, file_path, file_type, detected_at, user_confirmed)
- `spec_changes` (id, file_path, old_commit_sha, new_commit_sha, change_summary)
- `_migrations` (version, applied_at)

**And** all tables have proper indexes as defined in architecture
**And** migrations are embedded in Rust code (`migrations/` module)
**And** on startup, MnM checks `_migrations` and applies missing migrations sequentially
**And** migration rollback is not supported (append-only migrations)

**Blocked by:** Story 0.1

**Estimated effort:** 1 day

---

### Story 0.3: Domain Models (mnm-core)

**[Backend]**

As a developer,
I want clean domain models with no external dependencies,
So that I have a solid foundation for business logic.

**Acceptance Criteria:**

**Given** the `mnm-core` crate
**When** domain models are implemented
**Then** the following structs exist:
- `Agent` (id, name, status, spec_id, scope, timestamps, error_message)
- `Spec` (id, file_path, spec_type, title, content_hash, git_commit_sha, timestamps)
- `DriftDetection` (id, agent_id, spec_id, severity, drift_type, summary, recommendation, diff_content, user_decision, timestamps)
- `FileLock` (id, file_path, agent_id, lock_type, acquired_at, released_at)
- `ImportantFile` (id, file_path, file_type, detected_at, user_confirmed)
- `SpecChange` (id, file_path, old_commit_sha, new_commit_sha, change_summary, detected_at, user_viewed)

**And** the following enums exist:
- `AgentStatus` (Idle, Pending, Running, Paused, Completed, Error)
- `SpecType` (ProductBrief, Prd, Story, Architecture, Config)
- `DriftSeverity` (Minor, Moderate, Critical)
- `DriftType` (ScopeExpansion, ApproachChange, DesignDeviation)
- `LockType` (Read, Write)

**And** all types implement `Serialize`, `Deserialize` (via serde)
**And** all types have proper `Debug`, `Clone` implementations
**And** `mnm-core` has ZERO dependencies on other MnM crates

**Blocked by:** Story 0.1

**Estimated effort:** 1 day

---

### Story 0.4: Repository Pattern (mnm-db)

**[Backend]**

As a developer,
I want repository traits for database access,
So that I can cleanly separate persistence logic from business logic.

**Acceptance Criteria:**

**Given** the `mnm-db` crate with database tables
**When** repository traits are implemented
**Then** the following traits exist:
- `AgentRepository` (find_by_id, find_by_status, insert, update, delete)
- `SpecRepository` (find_by_id, find_by_path, find_by_type, search, insert, update)
- `DriftRepository` (find_by_agent, find_by_spec, find_pending, insert, update)
- `FileLockRepository` (find_active_locks, acquire, release)
- `ImportantFileRepository` (find_all, find_by_type, insert, update)
- `SpecChangeRepository` (find_unviewed, insert, mark_viewed)

**And** each trait has a concrete implementation using `rusqlite` or `sqlez`
**And** implementations use prepared statements (no SQL injection risk)
**And** all insert/update operations are transactional
**And** unit tests verify CRUD operations work correctly

**Blocked by:** Story 0.2, Story 0.3

**Estimated effort:** 1.5 days

---

### Story 0.5: Error Handling Hierarchy

**[Backend]**

As a developer,
I want a well-structured error hierarchy,
So that I can handle errors gracefully and provide clear user feedback.

**Acceptance Criteria:**

**Given** the `mnm-core` crate
**When** error types are defined
**Then** the following error enums exist using `thiserror`:
- `MnMError` (top-level, wraps all sub-errors)
- `AgentError` (NotFound, AlreadyRunning, LockConflict, SpawnFailed)
- `DriftError` (ApiError, InvalidResponse, SpecNotFound)
- `GitError` (wraps `git2::Error`)
- `DatabaseError` (wraps `rusqlite::Error`)

**And** all errors implement `std::error::Error` via `thiserror`
**And** errors have clear, user-friendly messages
**And** error propagation uses `?` operator consistently
**And** no silent failures (all errors logged or surfaced to UI)

**Blocked by:** Story 0.3

**Estimated effort:** 0.5 day

---

### Story 0.6: Logging Infrastructure (tracing)

**[Backend] [Infra]**

As a developer,
I want structured logging with proper levels,
So that I can debug issues and monitor application health.

**Acceptance Criteria:**

**Given** the `mnm-core` or `mnm-ui` crate
**When** logging is configured
**Then** the `tracing` crate is integrated with proper subscriber

**And** log levels are configurable: ERROR, WARN, INFO, DEBUG
**And** development logs output to stdout with color
**And** production logs output to `.mnm/logs/mnm.log` with daily rotation
**And** structured logging includes context (agent_id, spec_id, file_path, etc.)
**And** critical events are logged:
- Agent spawned/completed/crashed (INFO)
- Drift detected (INFO)
- Spec change detected (INFO)
- API errors (ERROR)
- Database errors (ERROR)

**Blocked by:** Story 0.3

**Estimated effort:** 0.5 day

---

### Story 0.7: Configuration Management & API Key Storage

**[Backend] [Infra]**

As a user,
I want my Claude API key stored securely,
So that I can use drift detection without exposing sensitive credentials.

**Acceptance Criteria:**

**Given** a user with a Claude API key
**When** the API key is configured
**Then** the key is stored in the system keychain (macOS Keychain)

**And** the key is never logged or displayed in plain text
**And** the key is never committed to git
**And** `.mnm/config.json` stores non-sensitive config:
- `repository_path`
- `drift_detection_enabled`
- `custom_instructions_path` (optional)

**And** on first run, MnM prompts for API key if missing
**And** API key can be updated via settings UI (future) or CLI
**And** if API key is missing, drift detection gracefully fails with clear error message

**Blocked by:** Story 0.1

**Estimated effort:** 1 day

---

---

# Epic 1: Spec Visibility & Navigation

**Goal:** Users can browse, search, and navigate their product specifications (PRD, stories, architecture) in a unified, GPU-accelerated interface with code viewing capabilities.

**Value:** Users have a clear, fast view of all specs and code, with navigation between related artifacts.

---

### Story 1.1: GPUI App Initialization & Window Management

**[Frontend]**

As a user,
I want MnM to launch quickly with a clean window,
So that I can start working immediately.

**Acceptance Criteria:**

**Given** MnM is installed
**When** I launch the application
**Then** a GPUI window opens within 2 seconds

**And** the window title is "MnM - {repository_name}"
**And** the window uses the Zed-inspired design system (clean, minimal)
**And** the window supports light and dark themes (default: system preference)
**And** the window is resizable with minimum size 800x600px
**And** on macOS, standard keyboard shortcuts work (Cmd+Q to quit, Cmd+W to close)

**Blocked by:** Story 0.1, Story 0.3

**Estimated effort:** 1 day

---

### Story 1.2: Spec File Detection & Indexing

**[Backend]**

As a user,
I want MnM to automatically discover and index my spec files,
So that I can browse them without manual configuration.

**Acceptance Criteria:**

**Given** a git repository with spec files
**When** MnM starts
**Then** the `mnm-spec` crate scans the repository for `.md` and `.json` files

**And** for each file, metadata is extracted:
- File path (relative to repo root)
- Spec type (ProductBrief, Prd, Story, Architecture, Config)
- Title (extracted from H1 or YAML frontmatter)
- Content hash (SHA256)
- Last modified timestamp (from git)
- Git commit SHA (last commit that touched this file)

**And** supported formats are:
- BMAD (YAML frontmatter + Markdown)
- open-spec (JSON)
- Generic Markdown (H1 as title)

**And** extracted specs are stored in `specs` table
**And** indexing completes in < 5 seconds for repos with 500 specs
**And** if parsing fails for a file, it's logged as WARN and skipped

**Blocked by:** Story 0.4

**Estimated effort:** 1.5 days

---

### Story 1.3: Spec Browser UI (Tree View)

**[Frontend]**

As a user,
I want to browse my specs in a hierarchical tree view,
So that I can quickly find and navigate to specific documents.

**Acceptance Criteria:**

**Given** specs are indexed
**When** I open MnM
**Then** a left sidebar displays a tree view of specs organized by type:
- 📋 Product Brief
- 📄 PRD
- 📐 Architecture
- 📝 Stories
- ⚙️ Config

**And** each spec shows its title and file path
**And** clicking a spec opens it in the main content area
**And** the tree supports collapse/expand per section
**And** keyboard navigation works (arrow keys, Enter to open)
**And** the tree renders at 60+ FPS even with 500 specs

**Blocked by:** Story 1.1, Story 1.2

**Estimated effort:** 1.5 days

---

### Story 1.4: Spec Content Rendering (Markdown + Syntax Highlighting)

**[Frontend]**

As a user,
I want to read specs with proper formatting and syntax highlighting,
So that I can understand the content easily.

**Acceptance Criteria:**

**Given** a spec file is selected
**When** it opens in the main content area
**Then** Markdown is rendered with:
- Headings (H1-H6)
- Lists (ordered, unordered)
- Code blocks with syntax highlighting (via `syntect` or similar)
- Tables
- Links (clickable)
- Images (if present)

**And** YAML frontmatter is displayed in a collapsible header section
**And** rendering is fast (< 50ms for 1000 lines)
**And** the content is scrollable with smooth 60+ FPS scrolling
**And** text is selectable and copyable

**Blocked by:** Story 1.3

**Estimated effort:** 1.5 days

---

### Story 1.5: Fuzzy Search Across Specs

**[Frontend] [Backend]**

As a user,
I want to search across all specs using fuzzy matching,
So that I can quickly find relevant content without remembering exact file names.

**Acceptance Criteria:**

**Given** specs are indexed
**When** I open the search panel (Cmd+K or Cmd+P)
**Then** a search input appears with fuzzy matching

**And** as I type, results update in real-time (< 100ms latency)
**And** results show:
- Spec title
- File path
- Spec type badge (ProductBrief, PRD, Story, etc.)
- Snippet of matching content (if keyword search)

**And** results are ranked by relevance (title match > content match)
**And** pressing Enter on a result opens that spec
**And** search works across 500 specs with < 300ms response time
**And** keyboard navigation works (arrow keys to select, Enter to open)

**Blocked by:** Story 1.2, Story 1.3

**Estimated effort:** 1.5 days

---

### Story 1.6: Code File Browser & Syntax Highlighting

**[Frontend] [Backend]**

As a user,
I want to browse code files with syntax highlighting,
So that I can review implementation alongside specs.

**Acceptance Criteria:**

**Given** a git repository with code files
**When** I open the "Files" tab
**Then** a tree view displays the repository file structure

**And** clicking a file opens it in a read-only code viewer
**And** syntax highlighting works for:
- Rust (.rs)
- TypeScript (.ts, .tsx)
- Python (.py)
- Markdown (.md)
- JSON (.json)
- YAML (.yaml, .yml)

**And** line numbers are displayed
**And** files up to 10,000 LOC render in < 200ms
**And** scrolling is smooth (60+ FPS)
**And** no code editing is allowed (read-only in MVP)

**Blocked by:** Story 1.1, Story 1.2

**Estimated effort:** 1.5 days

---

### Story 1.7: Code-to-Spec Linking

**[Frontend] [Backend]**

As a user,
I want to see which specs are related to a code file,
So that I can understand the context and requirements.

**Acceptance Criteria:**

**Given** a code file is open in the viewer
**When** I view the file
**Then** a "Related Specs" panel is displayed on the right

**And** the panel shows specs that reference this file (via file path or git history)
**And** clicking a related spec opens it in a new pane or tab
**And** if no specs are found, the panel displays "No related specs found"
**And** the linking is updated when git commits associate files with specs (via commit message parsing like "refs: story-1.2.md")

**Blocked by:** Story 1.6, Story 1.2

**Estimated effort:** 1 day

---

### Story 1.8: Git Diff Viewer (Side-by-Side)

**[Frontend] [Backend]**

As a user,
I want to view git diffs side-by-side with syntax highlighting,
So that I can review changes for drift detection or spec updates.

**Acceptance Criteria:**

**Given** a file has uncommitted changes or a diff is generated
**When** I open the diff view
**Then** a side-by-side diff is displayed:
- Left pane: original version
- Right pane: modified version

**And** changes are highlighted:
- Green: added lines
- Red: removed lines
- Yellow: modified lines

**And** syntax highlighting is preserved in both panes
**And** the diff is scrollable in sync (scrolling one pane scrolls the other)
**And** diffs up to 2000 LOC render in < 500ms

**Blocked by:** Story 1.6

**Estimated effort:** 1.5 days

---

---

# Epic 2: Agent Orchestration & Control

**Goal:** Users can launch, monitor, and control multiple AI agents working on different specs in parallel, with visibility into what each agent is doing and conflict prevention.

**Value:** Users orchestrate multiple agents efficiently without merge conflicts or lost context.

---

### Story 2.1: Agent Runtime Trait & Claude Code Subprocess Spawn

**[Backend]**

As a developer,
I want a clean abstraction for agent runtimes,
So that I can integrate Claude Code now and other frameworks later.

**Acceptance Criteria:**

**Given** the `mnm-agent` crate
**When** the `AgentRuntime` trait is implemented
**Then** the trait defines methods:
- `spawn(&mut self, spec: &Spec, scope: Vec<PathBuf>) -> Result<AgentHandle>`
- `pause(&mut self, agent_id: &str) -> Result<()>`
- `resume(&mut self, agent_id: &str) -> Result<()>`
- `terminate(&mut self, agent_id: &str) -> Result<()>`
- `status(&self, agent_id: &str) -> Result<AgentStatus>`
- `logs(&self, agent_id: &str) -> Result<Vec<String>>`

**And** a `ClaudeCodeRuntime` struct implements this trait
**And** `spawn` method:
- Spawns Claude Code subprocess via `std::process::Command`
- Passes spec file path and scope as arguments
- Captures stdin, stdout, stderr
- Returns `AgentHandle` with process ID

**And** the subprocess is spawned with proper environment variables
**And** if spawn fails, returns `AgentError::SpawnFailed` with clear error message

**Blocked by:** Story 0.3, Story 0.4

**Estimated effort:** 1.5 days

---

### Story 2.2: Agent IPC Bridge (JSON-RPC over stdin/stdout)

**[Backend]**

As a developer,
I want bidirectional communication with Claude Code agents,
So that I can send commands and receive status updates.

**Acceptance Criteria:**

**Given** a spawned Claude Code subprocess
**When** the IPC bridge is established
**Then** MnM can send JSON-RPC commands via stdin:
- `{"jsonrpc": "2.0", "method": "pause", "id": 1}`
- `{"jsonrpc": "2.0", "method": "resume", "id": 2}`
- `{"jsonrpc": "2.0", "method": "status", "id": 3}`

**And** MnM receives JSON-RPC responses via stdout:
- `{"jsonrpc": "2.0", "result": {"status": "paused"}, "id": 1}`

**And** stdout/stderr are buffered and readable line-by-line
**And** IPC is non-blocking (uses `tokio` async runtime)
**And** if subprocess exits unexpectedly, agent status becomes `Error`
**And** IPC errors are logged and surfaced as `AgentError`

**Blocked by:** Story 2.1

**Estimated effort:** 1.5 days

---

### Story 2.3: File Lock Manager (Pre-Work Conflict Detection)

**[Backend]**

As a user,
I want agents to declare file scope before starting,
So that conflicts are detected and prevented upfront.

**Acceptance Criteria:**

**Given** the `mnm-agent` crate
**When** `FileLockManager` is implemented
**Then** agents must acquire locks before starting work

**And** lock acquisition logic:
- Read lock: Multiple agents can acquire read locks on the same file
- Write lock: Exclusive (no other read or write locks allowed)

**And** if conflict detected:
- `acquire_lock` returns `Err(AgentError::LockConflict { ... })`
- Error message includes: file path, conflicting agent ID

**And** locks are stored in `file_locks` table
**And** locks are released when agent completes or terminates
**And** orphaned locks (agent crashed) are released on startup

**Blocked by:** Story 0.4, Story 2.1

**Estimated effort:** 1.5 days

---

### Story 2.4: Agent Dashboard UI (Available & Running Agents)

**[Frontend]**

As a user,
I want to see all available and running agents at a glance,
So that I can understand what's happening in my project.

**Acceptance Criteria:**

**Given** MnM is running
**When** I open the Agent Dashboard tab
**Then** the dashboard displays two sections:

**Available Agents:**
- List of configured agent types (TDD, Implementation, E2E, Review)
- Agent capability description
- "Launch" button for each

**Running Agents:**
- Real-time list of active agent sessions
- For each agent:
  - Agent name
  - Status badge (Running, Paused, Completed, Error)
  - Spec being worked on (clickable link)
  - File scope (list of paths)
  - Progress indicator (if available)
  - Control buttons (Pause, Resume, Terminate)

**And** dashboard updates in real-time (< 100ms latency)
**And** UI renders at 60+ FPS even with 10 concurrent agents
**And** clicking spec link navigates to spec view
**And** clicking file scope shows files in tree view

**Blocked by:** Story 1.1, Story 2.1, Story 2.2

**Estimated effort:** 2 days

---

### Story 2.5: Launch Agent from Spec UI

**[Frontend] [Backend]**

As a user,
I want to launch an agent directly from a spec,
So that I can start work on a requirement with minimal friction.

**Acceptance Criteria:**

**Given** a spec is open in the viewer
**When** I click the "Launch Agent" button
**Then** a modal appears with:
- Agent type selector (TDD, Implementation, E2E, Review)
- File scope selector (checkboxes for files in repo)
- Pre-populated spec content (read-only preview)

**And** when I click "Confirm":
- File locks are acquired for selected scope
- If conflict detected, error message displays: "File X is locked by Agent Y. Wait, modify scope, or cancel?"
- If no conflict, agent spawns
- Modal closes and agent appears in dashboard

**And** the spec view shows "Agents working on this: 1" badge
**And** spec-to-agent link is stored in database
**And** agent receives spec content as context

**Blocked by:** Story 1.4, Story 2.1, Story 2.3

**Estimated effort:** 1.5 days

---

### Story 2.6: Agent Log Streaming (Real-Time stdout/stderr)

**[Frontend] [Backend]**

As a user,
I want to see agent logs in real-time,
So that I can monitor progress and debug issues.

**Acceptance Criteria:**

**Given** an agent is running
**When** I click on the agent in the dashboard
**Then** an expandable log panel appears

**And** logs stream in real-time from agent's stdout/stderr
**And** logs are syntax-highlighted (ANSI color codes preserved)
**And** logs auto-scroll to latest (with option to disable)
**And** logs are searchable (Cmd+F within log panel)
**And** logs persist for completed/error agents (stored in DB or filesystem)
**And** log rendering is performant (handles 10MB log output without freezing)

**Blocked by:** Story 2.2, Story 2.4

**Estimated effort:** 1.5 days

---

### Story 2.7: Agent Control Actions (Pause, Resume, Terminate)

**[Frontend] [Backend]**

As a user,
I want to pause, resume, or terminate agents,
So that I can control agent execution when needed.

**Acceptance Criteria:**

**Given** a running agent
**When** I click "Pause"
**Then** MnM sends pause command via IPC
**And** agent status updates to "Paused"
**And** agent subprocess is paused (SIGSTOP on Unix)
**And** UI button changes to "Resume"

**When** I click "Resume"
**Then** agent subprocess is resumed (SIGCONT on Unix)
**And** agent status updates to "Running"

**When** I click "Terminate"
**Then** MnM sends terminate signal (SIGTERM on Unix)
**And** agent subprocess exits gracefully
**And** file locks are released
**And** agent status updates to "Completed" (if clean exit) or "Error" (if crashed)
**And** agent record persists in database for history

**Blocked by:** Story 2.2, Story 2.4

**Estimated effort:** 1 day

---

### Story 2.8: Multi-Agent Conflict Detection & Visibility

**[Frontend] [Backend]**

As a user,
I want to see when multiple agents work on overlapping scopes,
So that I can prevent conflicts before they happen.

**Acceptance Criteria:**

**Given** multiple agents are running
**When** agents work on overlapping file scopes
**Then** the dashboard displays conflict warnings:
- "⚠️ Agent A and Agent B both working on src/main.rs"

**And** when launching a new agent:
- If scope conflicts with running agent, warning appears before spawn
- User can choose: "Wait for Agent X to complete", "Modify scope", or "Cancel"

**And** a dependency graph visualizes agent relationships:
- Nodes: agents
- Edges: shared file dependencies
- Conflicts highlighted in red

**And** graph renders cleanly with up to 10 agents
**And** graph is optional (collapsible panel)

**Blocked by:** Story 2.3, Story 2.4

**Estimated effort:** 1.5 days

---

### Story 2.9: Agent Fault Tolerance & Recovery

**[Backend]**

As a user,
I want agents to recover gracefully from crashes,
So that I don't lose work or corrupt state.

**Acceptance Criteria:**

**Given** an agent subprocess crashes unexpectedly
**When** the crash is detected
**Then** MnM logs the error with full context (agent_id, spec_id, error message)

**And** agent status updates to "Error"
**And** file locks are released immediately
**And** error message is surfaced in UI (dashboard shows red error badge)
**And** user can view full error log
**And** other running agents are unaffected (isolation)

**And** on MnM restart:
- Orphaned agent sessions are marked as "Error"
- Orphaned file locks are released
- MnM displays recovery summary: "2 agents failed during last session"

**Blocked by:** Story 2.2, Story 2.7

**Estimated effort:** 1 day

---

---

# Epic 3: Drift Detection & Resolution

**Goal:** Users receive intelligent alerts when code diverges from specifications, with actionable insights on whether to update specs or recenter code.

**Value:** Users maintain alignment between product vision and implementation through automated drift detection.

---

### Story 3.1: Git Diff Generation (mnm-git)

**[Backend]**

As a developer,
I want to generate git diffs for files modified by agents,
So that I can analyze drift between spec and implementation.

**Acceptance Criteria:**

**Given** the `mnm-git` crate
**When** `DiffGenerator::diff_file` is called
**Then** it generates a git diff between:
- Base commit (before agent started)
- Current state (after agent completed or current working tree)

**And** the diff includes:
- File path
- Added lines (with line numbers)
- Removed lines (with line numbers)
- Modified lines (with before/after)

**And** diff is returned as structured data (`GitDiff` struct), not raw text
**And** diff generation works for files up to 5000 LOC
**And** diff is generated in < 200ms for typical files (< 1000 LOC)

**Blocked by:** Story 0.3

**Estimated effort:** 1 day

---

### Story 3.2: Claude API Integration for Drift Analysis

**[Backend]**

As a developer,
I want to call Claude API to analyze semantic drift,
So that I can provide intelligent insights to users.

**Acceptance Criteria:**

**Given** the `mnm-drift` crate
**When** `DriftAnalyzer::analyze` is called with spec content + git diff
**Then** it sends a request to Claude API:
- Model: `claude-sonnet-4` (or latest)
- Prompt: Drift detection template (see Architecture)
- Input: spec content + diff + optional custom instructions
- Max tokens: 4096
- Temperature: 0 (deterministic)

**And** response is parsed as structured JSON:
```json
{
  "severity": "minor|moderate|critical",
  "drift_type": "scope_expansion|approach_change|design_deviation",
  "summary": "...",
  "recommendation": "update_spec|recenter_code"
}
```

**And** if API call fails:
- Retry with exponential backoff (3 attempts)
- If all retries fail, return `DriftError::ApiError`

**And** API key is loaded from keychain (never hardcoded)
**And** API latency is logged for performance monitoring

**Blocked by:** Story 0.7

**Estimated effort:** 1.5 days

---

### Story 3.3: Custom Drift Instructions Support

**[Backend]**

As a user,
I want to define custom drift detection rules,
So that I can enforce project-specific standards.

**Acceptance Criteria:**

**Given** a file `.mnm/drift-instructions.md` exists
**When** drift detection runs
**Then** custom instructions are loaded and appended to Claude API prompt

**And** instruction format is plain Markdown:
```markdown
# Custom Drift Detection Instructions

## Performance Rules
- If O(n^2) complexity introduced, classify as critical

## Security Rules
- If API endpoint added without spec, classify as critical
```

**And** if file doesn't exist, default instructions are used
**And** instructions are cached (reloaded only on file change)
**And** instructions are included in drift analysis logs for traceability

**Blocked by:** Story 3.2

**Estimated effort:** 0.5 day

---

### Story 3.4: Drift Detection Pipeline (End-to-End)

**[Backend]**

As a user,
I want drift detection to run automatically when an agent completes,
So that I'm alerted to misalignment without manual checks.

**Acceptance Criteria:**

**Given** an agent completes work on a spec
**When** the agent exits successfully
**Then** drift detection runs automatically:
1. Load spec content from database
2. Generate git diff for agent's file scope
3. Load custom instructions (if any)
4. Call Claude API for drift analysis
5. Parse response and classify drift
6. Store result in `drift_detections` table
7. Link drift to agent_id and spec_id

**And** drift detection runs asynchronously (doesn't block UI)
**And** drift detection completes in < 5 seconds for files < 1000 LOC
**And** if drift detection fails, error is logged but doesn't crash MnM
**And** user is notified: "Drift detection failed: [reason]"

**Blocked by:** Story 3.1, Story 3.2, Story 3.3

**Estimated effort:** 1.5 days

---

### Story 3.5: Drift Alert UI (Summary + Diff View)

**[Frontend]**

As a user,
I want to see drift alerts with clear summaries and diffs,
So that I can understand what drifted and why.

**Acceptance Criteria:**

**Given** drift detection completed
**When** drift is detected
**Then** a notification appears in the UI:
- "⚠️ Drift detected in Story X"
- Severity badge (Minor, Moderate, Critical)
- Drift type (Scope Expansion, Approach Change, Design Deviation)

**And** clicking the notification opens a drift detail panel:
- Summary (AI-generated, 1-2 sentences)
- Recommendation (Update Spec or Recenter Code)
- Side-by-side diff view (spec vs. actual code)
- Actions: "Accept Drift" or "Reject Drift"

**And** diff highlights differences clearly (green = added, red = removed)
**And** panel is scrollable and renders smoothly
**And** multiple drift alerts are stackable (list view)

**Blocked by:** Story 3.4, Story 1.8

**Estimated effort:** 1.5 days

---

### Story 3.6: Drift Resolution Workflow (Accept)

**[Frontend] [Backend]**

As a user,
I want to accept drift and update my spec,
So that I can evolve my product vision based on better implementation ideas.

**Acceptance Criteria:**

**Given** a drift alert is displayed
**When** I click "Accept Drift"
**Then** the spec file opens in an external editor (default macOS text editor)

**And** a comment is added to the drift record:
- `user_decision = 'accepted'`
- `decided_at = current_timestamp`

**And** the drift alert is marked as resolved (removed from pending list)
**And** after I save the spec file and commit:
- Updated spec is re-indexed
- Content hash is updated in database

**And** the drift record persists for audit trail
**And** UI shows "✅ Drift accepted and spec updated"

**Blocked by:** Story 3.5

**Estimated effort:** 1 day

---

### Story 3.7: Drift Resolution Workflow (Reject)

**[Frontend] [Backend]**

As a user,
I want to reject drift and recenter code,
So that I can maintain alignment with my original spec.

**Acceptance Criteria:**

**Given** a drift alert is displayed
**When** I click "Reject Drift"
**Then** a modal appears:
- "Create a task to fix this drift?"
- Input: Task title (pre-filled: "Fix drift in Story X")
- Input: Assign to agent or self

**And** when confirmed:
- A new task/story is created (stored in database or added to spec file)
- Drift record is updated:
  - `user_decision = 'rejected'`
  - `decided_at = current_timestamp`

**And** the drift alert is marked as resolved
**And** UI shows "❌ Drift rejected, remediation task created"
**And** user or agent can work on the remediation task

**Blocked by:** Story 3.5

**Estimated effort:** 1 day

---

### Story 3.8: Progress Tracking UI (Roadmap-Style)

**[Frontend] [Backend]**

As a user,
I want to see project progress with drift annotations,
So that I understand where the project stands vs. where it should be.

**Acceptance Criteria:**

**Given** multiple stories and agents have been worked on
**When** I open the Progress tab
**Then** a roadmap-style view displays:
- List of epics and stories
- Completion percentage per story (0%, 25%, 50%, 75%, 100%)
- Status badge (Not Started, In Progress, Completed, Drifted)
- Drift indicators (⚠️ if critical drift detected)

**And** completion is calculated based on:
- Agent work completed
- Acceptance criteria met (future: manual check)
- Drift resolved or accepted

**And** clicking a story shows:
- Associated agents
- Drift detections
- Commits linked to story

**And** progress updates in real-time as agents complete work
**And** view renders smoothly with 500 stories

**Blocked by:** Story 3.4

**Estimated effort:** 2 days

---

### Story 3.9: Workflow Stage Tracking (PRD → Stories → Arch → Dev → Test → Deploy)

**[Backend]**

As a user,
I want to track which workflow stage each story is in,
So that I understand the full development lifecycle.

**Acceptance Criteria:**

**Given** the `specs` table
**When** workflow tracking is implemented
**Then** each spec has a `workflow_stage` field:
- `prd` (requirements defined)
- `stories` (stories created)
- `architecture` (architecture designed)
- `dev` (development in progress or complete)
- `test` (testing in progress or complete)
- `deploy` (deployed)

**And** workflow stage is updated automatically:
- When spec is created → `prd`
- When stories are generated from PRD → `stories`
- When architecture is defined → `architecture`
- When agent completes dev work → `dev`
- Manual transition to `test` and `deploy` (future automation)

**And** progress UI shows workflow stage per story
**And** workflow stage is filterable (e.g., "Show all stories in dev")

**Blocked by:** Story 0.4

**Estimated effort:** 1 day

---

---

# Epic 4: Spec Change Awareness

**Goal:** Users are automatically notified when important specification files change in Git, with AI-generated summaries of what changed and why it matters.

**Value:** Users stay aware of spec changes from teammates or git operations, preventing surprise misalignment.

---

### Story 4.1: Git Repository Connection & Status

**[Backend]**

As a user,
I want MnM to connect to my git repository,
So that it can track changes and provide git-driven features.

**Acceptance Criteria:**

**Given** MnM is launched
**When** a git repository is detected in the working directory
**Then** MnM connects to the repository using `git2-rs`

**And** the following information is displayed:
- Repository path
- Current branch name
- Latest commit SHA
- Remotes (origin, upstream, etc.)
- Git status (staged, unstaged, untracked files count)

**And** if no git repository is found, MnM displays:
- "No git repository detected. Please open a git-initialized project."

**And** git connection is established in < 200ms
**And** git operations are non-blocking (async)

**Blocked by:** Story 0.1

**Estimated effort:** 1 day

---

### Story 4.2: Important File Detection via AI (First Run)

**[Backend]**

As a user,
I want MnM to automatically identify important spec files,
So that I'm notified when they change without manual configuration.

**Acceptance Criteria:**

**Given** MnM runs for the first time in a repository
**When** important file detection runs
**Then** the `mnm-git` crate scans the repository for files

**And** for each file, Claude API is called to classify:
- File type: ProductBrief, Prd, Story, Architecture, Config, Code (not important)
- Confidence: High, Medium, Low

**And** files classified as ProductBrief, Prd, Story, Architecture, Config are stored in `important_files` table
**And** classification result is saved to `.mnm/important-files.json` (git-tracked):
```json
{
  "files": [
    {"path": "docs/product-brief.md", "type": "ProductBrief", "confidence": "high"},
    {"path": "docs/prd.md", "type": "Prd", "confidence": "high"},
    ...
  ]
}
```

**And** user is shown a review UI:
- List of detected important files
- Option to confirm, add, or remove files
- "Save" button to finalize

**And** detection completes in < 30 seconds for repos with 500 files
**And** user can manually re-run detection via settings

**Blocked by:** Story 3.2, Story 4.1

**Estimated effort:** 1.5 days

---

### Story 4.3: Git Change Detection (Post-Checkout/Fetch/Pull)

**[Backend]**

As a user,
I want MnM to detect when important files change in git,
So that I'm aware of updates from teammates or branch switches.

**Acceptance Criteria:**

**Given** important files are configured
**When** I run `git checkout`, `git fetch`, or `git pull`
**Then** MnM detects changed files by comparing:
- Old git ref (before operation)
- New git ref (after operation)

**And** only important files are checked (performance optimization)
**And** for each changed file:
- Old commit SHA and new commit SHA are recorded
- Diff is generated
- Change is stored in `spec_changes` table

**And** change detection runs automatically via git hooks:
- `.git/hooks/post-checkout` (registered on MnM first run)
- `.git/hooks/post-merge` (for pulls)

**And** change detection completes in < 200ms
**And** if detection fails, error is logged but doesn't crash MnM

**Blocked by:** Story 4.1, Story 4.2

**Estimated effort:** 1.5 days

---

### Story 4.4: AI-Generated Change Summaries

**[Backend]**

As a user,
I want AI-generated summaries of spec changes,
So that I can quickly understand what changed without reading full diffs.

**Acceptance Criteria:**

**Given** an important file has changed
**When** change detection runs
**Then** Claude API is called with:
- Old file content
- New file content (or diff)
- Prompt: "Summarize what changed and why it matters"

**And** response is a natural language summary (1-3 sentences):
- "Product vision updated: new feature X added to roadmap"
- "FR3.2 modified: drift detection now supports custom instructions"
- "Architecture decision: switched from PostgreSQL to SQLite"

**And** summary is stored in `spec_changes.change_summary`
**And** summary generation is async (doesn't block git operations)
**And** if API call fails, fallback to "File changed: [file_path]"

**Blocked by:** Story 3.2, Story 4.3

**Estimated effort:** 1 day

---

### Story 4.5: Spec Change Notification UI

**[Frontend]**

As a user,
I want to see notifications when important specs change,
So that I stay aware of updates without constantly checking git.

**Acceptance Criteria:**

**Given** spec changes are detected
**When** I open MnM or changes are detected while MnM is running
**Then** a notification badge appears:
- "3 important files changed since last session"

**And** clicking the notification opens a change summary panel:
- List of changed files
- Change summary (AI-generated)
- Links to view full diff
- Option to mark as "Viewed"

**And** changes are grouped by:
- Since last MnM session
- Since last commit
- Since last branch switch

**And** viewed changes are hidden (but accessible in history)
**And** notification is dismissible

**Blocked by:** Story 4.4, Story 1.1

**Estimated effort:** 1.5 days

---

### Story 4.6: View Full Diff for Spec Changes

**[Frontend]**

As a user,
I want to view full diffs for changed specs,
So that I can understand details beyond the AI summary.

**Acceptance Criteria:**

**Given** a spec change notification
**When** I click "View Full Diff"
**Then** the diff viewer opens (side-by-side view)

**And** the diff shows:
- Old version (left pane)
- New version (right pane)
- Highlighted changes (green/red)

**And** diff is scrollable and syntax-highlighted
**And** diff matches the git diff exactly
**And** I can navigate between multiple diffs (if multiple files changed)

**Blocked by:** Story 1.8, Story 4.5

**Estimated effort:** 1 day

---

### Story 4.7: Propagate Spec Changes to Running Agents

**[Backend] [Frontend]**

As a user,
I want running agents to be notified when specs change,
So that they can adjust their work accordingly.

**Acceptance Criteria:**

**Given** a running agent is working on a spec
**When** that spec file changes (git update detected)
**Then** the agent is notified via IPC:
- Message: "Spec updated: [change_summary]"

**And** agent can choose to:
- Continue with old spec (user confirmation required)
- Reload spec and recenter (agent restarts with new spec)

**And** UI displays warning:
- "⚠️ Agent X is working on a spec that changed. Review recommended."

**And** user can click warning to:
- View diff
- Pause agent
- Terminate agent
- Acknowledge and continue

**Blocked by:** Story 2.2, Story 4.4

**Estimated effort:** 1.5 days

---

### Story 4.8: Commit Association (Link Commits to Specs/Stories)

**[Backend]**

As a user,
I want commits to be linked to specs/stories,
So that I can track implementation history per requirement.

**Acceptance Criteria:**

**Given** a git commit is made
**When** the commit message follows convention:
- `refs: story-1.2.md` or `refs: #story-1.2`
- `implements: FR3.2`
- `closes: story-1.2.md`

**Then** MnM parses commit message and creates associations:
- Commit SHA → Spec ID
- Stored in `specs` table or separate `commit_associations` table

**And** associations are displayed:
- In spec view: "Implemented by commits: abc123, def456"
- In progress view: "Story 1.2: 3 commits"

**And** clicking a commit SHA shows full commit details (message, diff, author)
**And** parsing is forgiving (handles various formats)

**Blocked by:** Story 4.1

**Estimated effort:** 1 day

---

---

# Epic 5: Polish & Production Readiness

**Goal:** Users experience a polished, accessible, production-ready application with smooth onboarding and proper security/privacy guarantees.

**Value:** Users onboard quickly, feel confident in data privacy, and experience a refined, accessible interface.

---

### Story 5.1: First-Run Onboarding Flow

**[Frontend] [Backend]**

As a new user,
I want a smooth onboarding experience,
So that I can start using MnM in under 2 minutes.

**Acceptance Criteria:**

**Given** MnM is launched for the first time
**When** the app starts
**Then** an onboarding wizard appears:

**Step 1: Welcome**
- "Welcome to MnM - Product-First ADE"
- Brief explanation (2-3 sentences)
- "Get Started" button

**Step 2: Select Repository**
- File picker to select git repository folder
- Validation: must be a git repo
- Error if not a git repo: "Please select a git-initialized folder"

**Step 3: Configure Claude API Key**
- Input for API key
- "Where to find your key" help link
- Key is validated via test API call
- Key is stored in system keychain

**Step 4: Detect Important Files**
- "Analyzing your repository..."
- Progress indicator
- Results: list of detected important files
- User can review and adjust

**Step 5: Complete**
- "Setup complete! 🎉"
- "Open Dashboard" button

**And** onboarding completes in < 2 minutes for typical repos
**And** onboarding can be skipped (advanced users)
**And** onboarding state is saved (never shown again unless reset)

**Blocked by:** Story 1.1, Story 0.7, Story 4.2

**Estimated effort:** 2 days

---

### Story 5.2: Settings Panel (Preferences)

**[Frontend] [Backend]**

As a user,
I want to configure MnM settings,
So that I can customize behavior to my preferences.

**Acceptance Criteria:**

**Given** MnM is running
**When** I open Settings (Cmd+,)
**Then** a settings panel appears with tabs:

**General:**
- Theme: Light, Dark, System
- Font size: 12-20px (slider)
- Enable/disable drift detection

**Git:**
- Auto-detect important files on startup
- Re-run important file detection (button)
- Git hooks: enable/disable

**Agent:**
- Default agent type (TDD, Implementation, E2E, Review)
- Max concurrent agents (1-10)
- Agent timeout (seconds)

**API:**
- Claude API key (update/remove)
- Custom drift instructions path

**Privacy:**
- Telemetry opt-in (disabled by default)
- Clear local database (button)

**And** settings are saved to `.mnm/config.json`
**And** changes apply immediately (no restart required, except where noted)

**Blocked by:** Story 1.1, Story 0.7

**Estimated effort:** 1.5 days

---

### Story 5.3: Keyboard Shortcuts & Accessibility

**[Frontend]**

As a user,
I want keyboard shortcuts and accessibility features,
So that I can navigate MnM efficiently and accessibly.

**Acceptance Criteria:**

**Given** MnM is running
**When** I use keyboard shortcuts
**Then** the following shortcuts work:

**Navigation:**
- Cmd+K / Cmd+P: Open search
- Cmd+1/2/3/4: Switch tabs (Specs, Agents, Progress, Files)
- Cmd+B: Toggle sidebar
- Cmd+Shift+P: Command palette

**Agent Control:**
- Cmd+Shift+L: Launch agent from current spec
- Cmd+Shift+T: Terminate selected agent
- Space: Pause/Resume selected agent

**General:**
- Cmd+,: Settings
- Cmd+Q: Quit
- Cmd+W: Close window

**And** accessibility features:
- Screen reader support (ARIA labels on all interactive elements)
- High-contrast mode (via theme)
- Keyboard focus indicators (visible outline)
- Tab navigation works everywhere

**And** shortcuts are documented in Help menu

**Blocked by:** Story 1.1

**Estimated effort:** 1.5 days

---

### Story 5.4: Agent Sandboxing & Scope Enforcement

**[Backend]**

As a user,
I want agents to be restricted to their declared file scope,
So that they can't accidentally modify unrelated files.

**Acceptance Criteria:**

**Given** an agent is launched with file scope
**When** the agent attempts to modify a file
**Then** MnM validates:
- Is the file within declared scope?
- If yes: allow
- If no: block and log warning

**And** blocking is enforced at IPC level (before command reaches subprocess)
**And** user is notified: "⚠️ Agent X attempted to modify file outside scope: [path]"
**And** user can choose:
- Expand scope (add file to agent's allowed list)
- Deny and continue
- Terminate agent

**And** destructive operations require confirmation:
- File deletion
- Git reset/revert
- Large file modifications (> 1000 LOC changed)

**And** sandbox violations are logged for audit

**Blocked by:** Story 2.2, Story 2.3

**Estimated effort:** 1.5 days

---

### Story 5.5: Privacy Guarantees & Local-First Verification

**[Backend] [Infra]**

As a user,
I want guaranteed local-first operation with no cloud sync,
So that my code and specs never leave my machine (except Claude API calls).

**Acceptance Criteria:**

**Given** MnM is running
**When** I inspect network traffic
**Then** the only external requests are:
- Claude API calls (api.anthropic.com)
- Optional: update checks (github.com)

**And** no other telemetry or analytics
**And** no background sync to cloud services
**And** all data stored in `.mnm/` directory (git-ignored)
**And** `.mnm/important-files.json` is the only git-tracked MnM file

**And** privacy policy is displayed:
- In onboarding
- In settings
- Clearly states: "All data local except Claude API calls"

**And** user can verify via:
- Network monitor (no unexpected traffic)
- `.mnm/` directory inspection (all data visible)

**Blocked by:** Story 0.1, Story 3.2

**Estimated effort:** 1 day

---

### Story 5.6: Error Handling & User-Friendly Error Messages

**[Frontend] [Backend]**

As a user,
I want clear, actionable error messages,
So that I can resolve issues without frustration.

**Acceptance Criteria:**

**Given** an error occurs
**When** the error is displayed
**Then** the message is user-friendly:

**Bad:**
- "Error: git2::Error(Code(-1))"
- "Drift detection failed"

**Good:**
- "Git operation failed: repository not found. Please check that you're in a git-initialized folder."
- "Drift detection failed: Claude API key is invalid. Update your key in Settings."

**And** errors include:
- What happened
- Why it happened (if known)
- What to do next (actionable steps)

**And** technical details are collapsible (for advanced users)
**And** errors are logged with full context for debugging
**And** critical errors display a "Report Issue" link (GitHub)

**Blocked by:** Story 0.5, Story 1.1

**Estimated effort:** 1 day

---

### Story 5.7: Performance Monitoring & Optimization

**[Backend] [Infra]**

As a developer,
I want performance metrics and optimization,
So that MnM meets NFR performance targets.

**Acceptance Criteria:**

**Given** MnM is running
**When** key operations execute
**Then** performance is measured and logged:

**UI Responsiveness (NFR1.1):**
- Target: 60+ FPS (120 FPS ideal)
- Measured via GPUI profiler
- Logged at startup and every 10 minutes

**Drift Detection (NFR1.2):**
- Target: < 5s for 1000 LOC
- Measured per detection
- Logged per drift analysis

**Git Operations (NFR1.3):**
- Target: < 200ms
- Measured per git operation (status, diff, checkout)

**And** if performance degrades below targets:
- Warning logged
- User notified (if severe)

**And** performance metrics are aggregated:
- Average, p50, p95, p99
- Displayed in settings (optional debug panel)

**And** optimization is applied:
- Lazy loading for large spec files
- Debouncing for real-time UI updates
- Background threads for heavy operations (git, AI)

**Blocked by:** Story 0.6, Story 3.4, Story 4.3

**Estimated effort:** 1.5 days

---

### Story 5.8: Documentation & Help System

**[Frontend]**

As a user,
I want in-app help and documentation,
So that I can learn MnM without leaving the app.

**Acceptance Criteria:**

**Given** MnM is running
**When** I open Help menu
**Then** the following options appear:

**Quick Start Guide:**
- Interactive tutorial (overlay tooltips)
- Walks through: browse specs → launch agent → view drift

**Keyboard Shortcuts:**
- Full list of shortcuts
- Searchable

**Documentation:**
- Opens external docs site (future: in-app viewer)

**Report Issue:**
- Opens GitHub Issues page
- Pre-fills: MnM version, OS version

**About:**
- MnM version
- GPUI version
- License (Apache 2.0)
- Credits

**And** tooltips appear on hover for complex UI elements
**And** first-time users see contextual help hints
**And** help can be dismissed and re-enabled in settings

**Blocked by:** Story 1.1

**Estimated effort:** 1.5 days

---

### Story 5.9: Production Build & Distribution (macOS .dmg)

**[Infra]**

As a user,
I want to install MnM easily on macOS,
So that I can start using it without compiling from source.

**Acceptance Criteria:**

**Given** the MnM codebase
**When** a production build is created
**Then** the following are produced:

**Binary:**
- `target/release/mnm` (optimized, stripped)
- Size < 50 MB
- Startup time < 2 seconds

**macOS Bundle:**
- `MnM.app` (application bundle)
- Info.plist with proper metadata
- Icon (high-resolution)

**DMG Installer:**
- `MnM-v1.0.0.dmg`
- Contains: MnM.app, README.txt, LICENSE.txt
- Drag-to-Applications installer UI

**And** build is reproducible (same source → same binary)
**And** release artifacts are uploaded to GitHub Releases
**And** download link is published on website (future)

**Post-MVP:**
- Code signing with Apple Developer ID
- Notarization for Gatekeeper

**Blocked by:** Story 0.1, Story 1.1

**Estimated effort:** 1 day

---

### Story 5.10: Crash Recovery & State Persistence

**[Backend]**

As a user,
I want MnM to recover gracefully from crashes,
So that I don't lose work or corrupt state.

**Acceptance Criteria:**

**Given** MnM crashes unexpectedly
**When** I restart MnM
**Then** the following are recovered:

**Agent State:**
- Running agents are marked as "Error"
- File locks are released
- Logs are preserved

**UI State:**
- Last opened spec is restored
- Last selected tab is restored
- Window size/position restored

**Database Integrity:**
- SQLite transactions ensure no corruption
- If corruption detected, backup is restored (from last clean shutdown)

**And** on startup, MnM displays recovery summary:
- "Recovered from crash"
- "2 agents were terminated"
- "No data loss detected"

**And** crash logs are saved to `.mnm/logs/crash-YYYY-MM-DD.log`
**And** user can report crash via Help → Report Issue

**Blocked by:** Story 0.2, Story 2.9

**Estimated effort:** 1 day

---

---

# Coverage Verification

## FR Coverage
✅ **FR1: Agent & Workflow Dashboard** → Epic 2 (Stories 2.4, 2.6, 2.8)
✅ **FR2: Spec-Driven Agent Launching** → Epic 1 (Stories 1.2, 1.3) + Epic 2 (Story 2.5)
✅ **FR3: Progress & Drift Detection** → Epic 3 (Stories 3.1-3.9)
✅ **FR4: Spec Change Awareness** → Epic 4 (Stories 4.1-4.8)
✅ **FR5: Git Integration** → Epic 4 (Stories 4.1, 4.8)
✅ **FR6: Code Viewing** → Epic 1 (Stories 1.6, 1.7, 1.8)

## NFR Coverage
✅ **NFR1: Performance** → Epic 5 (Story 5.7) + implicit in all UI stories
✅ **NFR2: Scalability** → Epic 2 (Story 2.8) + architecture decisions
✅ **NFR3: Reliability** → Epic 2 (Story 2.9) + Epic 5 (Story 5.10)
✅ **NFR4: Usability** → Epic 5 (Stories 5.1, 5.3, 5.8)
✅ **NFR5: Extensibility** → Epic 0 + Epic 2 (AgentRuntime trait abstraction)
✅ **NFR6: Security & Privacy** → Epic 0 (Story 0.7) + Epic 5 (Stories 5.4, 5.5)

## Architecture Coverage
✅ **Cargo workspace** → Story 0.1
✅ **SQLite + migrations** → Story 0.2
✅ **Domain models** → Story 0.3
✅ **Repository pattern** → Story 0.4
✅ **Error hierarchy** → Story 0.5
✅ **Logging (tracing)** → Story 0.6
✅ **Pre-work file locking** → Story 2.3
✅ **IPC-based agent integration** → Stories 2.1, 2.2
✅ **Hybrid drift detection** → Stories 3.1, 3.2, 3.4
✅ **Git integration (git2-rs)** → Epic 4

---

**Total Stories:** 47
**Estimated Total Effort:** ~55 days (conservative, assuming 1 dev)
**Critical Path:** Epic 0 → Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 5

---

**Notes:**
- Each story is designed for 1-2 day implementation by a single agent or developer
- All FRs and NFRs are covered
- Architecture decisions are reflected in implementation
- Stories are ordered to minimize blocking dependencies
- Tags indicate which parts of the stack each story touches

---

**Status:** Draft — Ready for team review and approval
