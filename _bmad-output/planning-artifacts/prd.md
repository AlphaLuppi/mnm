---
date: 2026-02-21
author: Pantheon
version: 2.1
status: Draft
classification:
  domain: developer_tools
  projectType: web_app
inputDocuments:
  - product-brief-mnm-2026-02-19.md
  - product-brief-mnm-2026-02-18.md
  - architecture-web.md
  - brainstorm-v2-2026-02-19.md
  - prd-validation-report.md
  - src-tauri/src/terminal.rs (native PTY implementation)
---

# Product Requirements Document: MnM v2.0

## Executive Summary

MnM is a Product-First Agile Development Environment (ADE) built as a web application (Next.js) that treats **product vision as the center of development**, not code.

### Problem Statement

Modern development has a growing alignment crisis at three levels:

**Level 1 — Code vs. Spec Drift:** In agentic development, specs are mission-critical. Yet during development flow, engineers discover better ideas, drift from specifications, and nobody helps them recenter. Products don't match specs, and teams can't identify where alignment broke.

**Level 2 — Spec vs. Spec Pollution:** Drift starts in specs themselves. A Product Brief specifies "SSE," a story writer mentions "websocket," an AI agent follows the polluted context. Nobody catches the inconsistency at the spec layer, and it cascades into code.

**Level 3 — Workflow Opacity:** Teams running agentic workflows have no structured way to define, visualize, or modify their pipelines. Workflows are implicit knowledge, raw configs, or ad-hoc conversations. No visibility into how steps impact each other.

### Three Pillars

1. **Workflow Editor** — Chat-first workflow definition and visual pipeline viewer. The heart of MnM.
2. **Cross-Document Drift Detection** — Detect inconsistencies between specification documents before they cascade into code.
3. **Spec-as-Interface** — Specification documents as interactive control surfaces with contextual actions.

### Core Innovation: LLM-Powered Auto-Discovery

MnM acts as an **intelligent wrapper** over existing development tool configurations. When opened in a repository, MnM uses an LLM to discover all specs, agents, workflows, and configurations automatically — then provides a single dashboard to manage everything. Users can transition from CLI-based workflows (BMAD, Claude Code) to managing everything from MnM's visual interface.

**MVP Goal:** Deliver an intelligent command center for agentic development that auto-discovers existing repo configurations via LLM analysis, eliminates spec drift through multi-level detection, and provides visual workflow management — all powered by a configurable LLM provider (Claude API for MVP).

---

## Product Scope

### In Scope (MVP)

1. LLM-powered auto-discovery of specs, agents, workflows, and tool configurations
2. Dashboard showing real discovered project state (not hardcoded data)
3. Cross-document drift detection (spec-vs-spec inconsistency)
4. Code-vs-spec drift detection (existing, enhanced)
5. Workflow viewer (read-only visual representation of discovered workflows)
6. Spec-as-Interface (interactive document actions)
7. Agent orchestration with real-time status from AI provider state
8. Conversational onboarding (guided first-run setup)
9. Configurable LLM provider settings (Claude API for MVP)
10. E2E test suite validating all features with Playwright
11. Native Claude Code terminal integration (desktop app via Tauri)

### Out of Scope (Post-MVP)

- Chat-first workflow editing (visual builder drag-and-drop)
- Multi-framework agent support (Cursor, Aider, Codeium)
- MCP connectors (GitHub, Linear, Slack)
- Code editing within MnM
- Real-time multi-user collaboration
- Mobile apps (desktop app is in-scope via Tauri wrapper)
- Enterprise features (RBAC, SSO, audit logs)

---

## User Journeys

### Persona 1: Alex — The Solopreneur

**Profile:** Solo developer building products with AI agents. Uses Claude Code + BMAD for development. Wears every hat.

**Journey:**
1. Alex clones a repo with BMAD workflows and Claude Code configured
2. Opens MnM → auto-discovery scans the repo via LLM
3. Dashboard shows: 5 BMAD workflows detected, 12 specs indexed, 3 Claude commands found, 2 active sessions
4. Alex browses specs in the interactive viewer → clicks a story → [Launch Agent] action
5. Agent runs → MnM monitors real-time status from Claude Code state files
6. Agent completes → MnM triggers drift detection → "Story S-003 implementation drifted from architecture: REST endpoint uses POST where spec says PUT"
7. Alex reviews drift → accepts and updates the spec inline
8. Cross-doc drift alert: "Story S-007 mentions 'websocket' but Architecture specifies 'SSE'" → Alex corrects the story

**Success:** Alex manages all agentic development from MnM's dashboard instead of running BMAD CLI commands manually.

### Persona 2: Jordan — Product Engineer (Small Team)

**Profile:** Product engineer at early-stage startup. Team of 4 sharing a repo with BMAD and Claude Code.

**Journey:**
1. Jordan clones the team repo → opens MnM
2. Auto-discovery finds: team's BMAD workflow definitions, all planning artifacts, Claude commands, agent configurations
3. Dashboard shows: "3 spec changes since last session" with AI-generated summaries
4. Jordan sees the workflow viewer showing the team's BMAD phases visually: Plan → Architecture → Implementation → Testing
5. Cross-doc drift panel: "PRD was updated yesterday but 4 stories still reference old architecture" → Jordan reviews and updates
6. Jordan launches agents from stories using Spec-as-Interface actions, monitors progress in real-time

**Success:** Jordan uses MnM as single source of truth instead of switching between BMAD CLI, Claude Code terminal, and manual file browsing.

### Persona 3: Gabriel — Team Member Navigating Change

**Profile:** Engineer joining an existing project mid-flight. Needs to understand current state quickly.

**Journey:**
1. Gabriel clones repo → opens MnM for the first time
2. Conversational onboarding: "I see this repo has BMAD configured with 4 workflow phases and 51 stories. Claude Code is installed with 3 custom commands. Would you like me to index everything?"
3. Gabriel confirms → MnM discovers and displays full project state
4. Dashboard shows: which stories are complete, which have drift, which agents are running
5. Gabriel browses the spec hierarchy (Product Brief → PRD → Architecture → Stories) and understands the project structure
6. Gabriel picks up a story, launches an agent, and starts contributing immediately

**Success:** Gabriel is productive within minutes, not hours, because MnM surfaced the full project context automatically.

---

## Functional Requirements

### FR1: Agent & Workflow Dashboard

**FR1.1** — User can view all available agents
- **FR1.1.1** — User can see a list of all discovered agent configurations with their capabilities
- **FR1.1.2** — User can see agent status: idle, running, paused, error
- **FR1.1.3** — User can see agent capability metadata

**FR1.2** — User can view all running agent sessions
- **FR1.2.1** — User can see active agent sessions with unique identifiers
- **FR1.2.2** — User can see which spec each agent is working on
- **FR1.2.3** — User can see real-time progress indicators per agent
- **FR1.2.4** — User can see agent output logs in collapsible panels

**FR1.3** — User can control running agents
- **FR1.3.1** — User can pause and resume running agents
- **FR1.3.2** — User can stop and terminate agents
- **FR1.3.3** — User can view detailed agent error states

**FR1.4** — User can see multi-agent conflict indicators
- **FR1.4.1** — System can detect when agents work on overlapping file scopes
- **FR1.4.2** — System can flag potential file conflicts with visual indicators
- **FR1.4.3** — User can see dependency relationships between agent tasks

### FR2: Spec-Driven Agent Launching

**FR2.1** — User can browse specifications in a unified view
- **FR2.1.1** — User can navigate specs in a tree structure grouped by type (brief, PRD, architecture, stories)
- **FR2.1.2** — System can render specs with syntax highlighting and semantic structure
- **FR2.1.3** — User can search and filter across all indexed specs

**FR2.2** — User can launch agents from any spec
- **FR2.2.1** — User can trigger "Launch Agent" from any spec document
- **FR2.2.2** — System can pre-populate agent context with selected spec content
- **FR2.2.3** — User can select agent type for launch
- **FR2.2.4** — User can launch agents in parallel from different specs

**FR2.3** — User can see agent-to-spec relationships
- **FR2.3.1** — User can see bidirectional links between agents and specs
- **FR2.3.2** — User can see "Agents working on this" indicator on each spec
- **FR2.3.3** — User can navigate from a running agent to its originating spec

**FR2.4** — User can define agent file scope
- **FR2.4.1** — User can set file/directory scope for each agent launch
- **FR2.4.2** — System can prevent agents from modifying files outside their scope
- **FR2.4.3** — User can see scope boundaries in the agent dashboard

**FR2.5** — User can interact with specs as control surfaces (Spec-as-Interface)
- **FR2.5.1** — System can render markdown documents as interactive surfaces with actionable elements
- **FR2.5.2** — User can see contextual actions on each heading/section (hover/focus)
- **FR2.5.3** — User can trigger section-level actions based on document type:
  - On PRD sections: [TLDR] [Clarify] [Generate Stories] [Architecture Review]
  - On Story sections: [TLDR] [Dev] [TDD] [E2E] [Code Review] [Acceptance Criteria]
  - On Epic sections: [Expand] [Prioritize] [Estimate] [Sprint Planning]
- **FR2.5.4** — User can see agent presence indicators per section (viewing, working, completed)
- **FR2.5.5** — User can see section status badges inline (Done / In Progress / Backlog)
- **FR2.5.6** — User can multi-select sections to launch bulk agent actions
- **FR2.5.7** — User can click an action to open agent launch dialog pre-populated with section context

### FR3: Progress & Drift Detection (Code-vs-Spec)

**FR3.1** — User can track workflow and story completion
- **FR3.1.1** — System can track completion status per story and per workflow stage
- **FR3.1.2** — User can see roadmap-style progress view with visual indicators
- **FR3.1.3** — User can see completion percentage per story and per workflow stage

**FR3.2** — System can detect code-vs-spec drift
- **FR3.2.1** — System can compare code changes against associated specs using AI analysis
- **FR3.2.2** — System can classify drift severity: minor, moderate, critical
- **FR3.2.3** — System can identify drift type: scope expansion, approach change, design deviation

**FR3.3** — User can review drift insights
- **FR3.3.1** — User can see human-readable drift summary explaining what drifted and why
- **FR3.3.2** — User can see drift value assessment (improvement vs. misalignment)
- **FR3.3.3** — User can see actionable recommendation: update spec or recenter code
- **FR3.3.4** — User can see diff view showing spec vs. actual implementation

**FR3.4** — User can resolve drift
- **FR3.4.1** — User can accept drift and update spec inline
- **FR3.4.2** — User can reject drift and create remediation task
- **FR3.4.3** — System can track drift resolution history

**FR3.5** — User can see progress with drift annotations
- **FR3.5.1** — User can see blockers and dependencies preventing progress
- **FR3.5.2** — User can see drift indicators on progress view ("Story X: 80% complete, 1 critical drift")

### FR4: Spec Change Awareness (Git-Driven)

**FR4.1** — System can detect important files via AI
- **FR4.1.1** — System can scan repository structure on first run or repo change
- **FR4.1.2** — System can classify files as: product brief, PRD, architecture, stories, config, code
- **FR4.1.3** — System can persist classified file list locally
- **FR4.1.4** — User can review and adjust AI-generated classification

**FR4.2** — System can detect git changes to specs
- **FR4.2.1** — System can detect changed files on git operations (checkout, fetch, pull)
- **FR4.2.2** — System can filter changes to important files only
- **FR4.2.3** — System can calculate diff for each changed important file

**FR4.3** — User can review spec change briefings
- **FR4.3.1** — User can see notification: "N important files changed since last session"
- **FR4.3.2** — User can see AI-generated summary of changes per file
- **FR4.3.3** — User can see impact assessment per change
- **FR4.3.4** — User can view full diff of any changed file

**FR4.4** — System can propagate awareness
- **FR4.4.1** — System can update agent context when launching new agents after spec changes
- **FR4.4.2** — System can flag running agents that may be affected by spec changes

### FR5: Git Integration

**FR5.1** — System can connect to git repository
- **FR5.1.1** — System can detect git repository root on launch
- **FR5.1.2** — User can see current branch, commit SHA, and remote status

**FR5.2** — System can monitor git operations
- **FR5.2.1** — System can monitor git status (staged, unstaged, untracked files)
- **FR5.2.2** — System can read git log for change history

**FR5.3** — System can associate commits with specs
- **FR5.3.1** — System can link commits to stories/specs via commit message parsing
- **FR5.3.2** — User can see commit history per story
- **FR5.3.3** — User can see "Implemented by commits: X, Y, Z" on each story

### FR6: Code Viewing (Read-Only)

**FR6.1** — User can browse and view code files
- **FR6.1.1** — User can see code with syntax highlighting
- **FR6.1.2** — User can navigate files in a tree structure
- **FR6.1.3** — User can search files with fuzzy matching

**FR6.2** — User can see code-to-spec relationships
- **FR6.2.1** — User can navigate from code file to associated spec
- **FR6.2.2** — User can see "Related specs" panel when viewing code

**FR6.3** — User can view diffs
- **FR6.3.1** — User can see git diffs inline with syntax highlighting
- **FR6.3.2** — User can see side-by-side diff view for drift comparisons

### FR7: Workflow Viewer

**FR7.1** — User can see discovered workflows as visual pipelines
- **FR7.1.1** — System can render workflows as node-and-edge diagrams showing phases, steps, and dependencies
- **FR7.1.2** — User can see workflow metadata: name, description, phase, estimated duration
- **FR7.1.3** — User can see real-time execution status on workflow nodes (pending, running, completed, error)

**FR7.2** — User can browse workflow details
- **FR7.2.1** — User can click a workflow node to see its configuration (role, instructions, tools, scope)
- **FR7.2.2** — User can see which agents are associated with each workflow step
- **FR7.2.3** — User can see input/output relationships between workflow steps

**FR7.3** — User can manage workflows from the dashboard
- **FR7.3.1** — User can see all discovered workflows in a list view
- **FR7.3.2** — User can trigger workflow execution from the viewer
- **FR7.3.3** — User can see workflow execution history

### FR8: Cross-Document Drift Detection

**FR8.1** — System can understand document hierarchy
- **FR8.1.1** — System can model the spec hierarchy: Product Brief → PRD → Architecture → Stories → Code
- **FR8.1.2** — System can detect parent-child relationships between specs based on content analysis
- **FR8.1.3** — User can see the document hierarchy as a visual tree

**FR8.2** — System can detect cross-document inconsistencies
- **FR8.2.1** — System can use LLM to compare related specs for terminology, decisions, and approach consistency
- **FR8.2.2** — System can classify cross-doc drift severity: minor (terminology), moderate (approach), critical (contradictory decisions)
- **FR8.2.3** — System can identify the source of inconsistency (which document introduced the deviation)

**FR8.3** — User can review cross-document drift alerts
- **FR8.3.1** — User can see alerts: "Story S-007 mentions 'websocket' but Architecture specifies 'SSE'"
- **FR8.3.2** — User can see both documents side-by-side with the inconsistency highlighted
- **FR8.3.3** — User can see the document chain showing how the inconsistency propagated

**FR8.4** — User can resolve cross-document drift
- **FR8.4.1** — User can update the downstream document to match the source of truth
- **FR8.4.2** — User can update the source of truth if the downstream change was intentional
- **FR8.4.3** — System can log all cross-doc drift resolutions with rationale

### FR9: LLM-Powered Auto-Discovery & Configuration

**FR9.1** — System can scan repository structure
- **FR9.1.1** — System can traverse the repo file tree and build a structural overview
- **FR9.1.2** — System can detect known tool configurations: `.claude/` directory, `_bmad/` directory, `.mnm/` directory
- **FR9.1.3** — System can send structural overview to LLM for intelligent classification
- **FR9.1.4** — User can trigger a full re-scan at any time

**FR9.2** — System can discover specification files
- **FR9.2.1** — System can use LLM to identify and classify: product briefs, PRDs, architecture docs, epics, stories, brainstorms
- **FR9.2.2** — System can detect spec relationships (which brief produced which PRD, which PRD produced which stories)
- **FR9.2.3** — System can index all discovered specs with metadata (type, title, status, relationships)
- **FR9.2.4** — User can review and override AI classifications

**FR9.3** — System can discover agent configurations
- **FR9.3.1** — System can discover Claude Code sessions from `~/.claude/projects/` directory
- **FR9.3.2** — System can discover active Claude Code subagents and teams
- **FR9.3.3** — System can discover BMAD agent definitions from agent manifest files
- **FR9.3.4** — System can discover Claude commands from `.claude/commands/` directory
- **FR9.3.5** — User can see all discovered agents unified in the dashboard

**FR9.4** — System can discover workflows
- **FR9.4.1** — System can discover BMAD workflow definitions from `_bmad/bmm/workflows/` directory
- **FR9.4.2** — System can parse workflow step files and understand phase sequencing
- **FR9.4.3** — System can discover custom workflow patterns from repo conventions
- **FR9.4.4** — User can see all discovered workflows in the workflow viewer

**FR9.5** — System can auto-configure from discoveries
- **FR9.5.1** — System can generate MnM configuration from discovered artifacts
- **FR9.5.2** — System can map discovered specs to the spec browser
- **FR9.5.3** — System can map discovered agents to the agent dashboard
- **FR9.5.4** — System can map discovered workflows to the workflow viewer
- **FR9.5.5** — User can review and customize the auto-generated configuration

**FR9.6** — User can configure LLM provider settings
- **FR9.6.1** — User can select LLM provider (Claude API for MVP, extensible for future providers)
- **FR9.6.2** — User can securely configure and store API keys
- **FR9.6.3** — User can select model for different tasks (discovery, drift analysis, summarization)
- **FR9.6.4** — System can validate API key connectivity on save
- **FR9.6.5** — User can see LLM usage metrics (tokens used, calls made)

### FR10: Conversational Onboarding

**FR10.1** — System can detect first-run state
- **FR10.1.1** — System can detect whether MnM has been configured for the current repository
- **FR10.1.2** — System can redirect to onboarding flow on first run

**FR10.2** — User can complete guided setup
- **FR10.2.1** — User can enter repository path and validate git connectivity
- **FR10.2.2** — User can configure LLM provider and API key
- **FR10.2.3** — System can trigger auto-discovery during onboarding
- **FR10.2.4** — User can see discovery results: "Found 5 workflows, 51 stories, 3 Claude commands"
- **FR10.2.5** — User can confirm or adjust discovered configuration

**FR10.3** — System can provide contextual guidance
- **FR10.3.1** — System can display a summary of what was discovered and how MnM will help
- **FR10.3.2** — System can suggest next actions based on project state ("You have 3 stories with unresolved drift")

### FR11: Native Claude Code Terminal Integration

**FR11.1** — User can access Claude Code from within MnM
- **FR11.1.1** — User can open a Claude Code terminal panel from the MnM interface
- **FR11.1.2** — System can spawn a native PTY terminal session via Tauri backend
- **FR11.1.3** — System can auto-launch Claude Code CLI in the terminal session
- **FR11.1.4** — User can see real-time terminal output with proper ANSI rendering

**FR11.2** — System can leverage existing Claude Code authentication
- **FR11.2.1** — System can pass through user environment variables (APPDATA, HOME, PATH) to terminal session
- **FR11.2.2** — System can use user's existing Claude Code OAuth session (no separate API key required)
- **FR11.2.3** — User can work with Claude Code using their existing subscription without additional configuration

**FR11.3** — User can control the terminal session
- **FR11.3.1** — User can resize the terminal panel (minimize/maximize)
- **FR11.3.2** — User can restart the Claude Code session from the panel
- **FR11.3.3** — User can close the terminal panel without terminating the session
- **FR11.3.4** — System can handle terminal resize events and communicate new dimensions to PTY

**FR11.4** — Terminal panel integrates with MnM UI
- **FR11.4.1** — User can toggle terminal panel via keyboard shortcut (Ctrl+Shift+C)
- **FR11.4.2** — Terminal panel displays styled xterm.js with app-matching theme
- **FR11.4.3** — Terminal panel shows connection status (connecting, connected, disconnected)
- **FR11.4.4** — User can access Claude Code panel via floating action button

---

## Non-Functional Requirements

### NFR1: Performance

**NFR1.1** — UI responsiveness
- **NFR1.1.1** — Dashboard refresh latency < 200ms when agent status changes
- **NFR1.1.2** — Spec browsing and navigation < 100ms response time
- **NFR1.1.3** — Page transitions < 300ms (measured as Largest Contentful Paint)

**NFR1.2** — Drift detection performance
- **NFR1.2.1** — Code-vs-spec drift analysis completes within 10 seconds for files < 1000 LOC
- **NFR1.2.2** — Cross-document drift analysis completes within 15 seconds per document pair
- **NFR1.2.3** — Background drift detection does not block UI interactions

**NFR1.3** — Discovery performance
- **NFR1.3.1** — Repository structure scan completes within 5 seconds for repos < 10,000 files
- **NFR1.3.2** — Full LLM-powered discovery completes within 60 seconds for typical repos
- **NFR1.3.3** — Incremental re-discovery completes within 10 seconds

### NFR2: Scalability

**NFR2.1** — Agent orchestration
- **NFR2.1.1** — System can support up to 10 concurrent agent sessions with dashboard refresh latency < 500ms
- **NFR2.1.2** — System can handle agent log output up to 10MB per session with < 100ms render time

**NFR2.2** — Spec volume
- **NFR2.2.1** — System can support projects with up to 500 specs
- **NFR2.2.2** — Search performance < 300ms across all indexed specs

### NFR3: Reliability

**NFR3.1** — Agent fault tolerance
- **NFR3.1.1** — System can detect crashed agents within 5 seconds and update dashboard
- **NFR3.1.2** — System can preserve agent state across MnM restarts
- **NFR3.1.3** — System can display structured error messages with error code, context, and recovery suggestion

**NFR3.2** — Data integrity
- **NFR3.2.1** — System must never corrupt git repository state
- **NFR3.2.2** — System can maintain consistent local config even on crash
- **NFR3.2.3** — System can validate LLM-generated analysis before display (structured output parsing with fallback)

**NFR3.3** — Graceful degradation
- **NFR3.3.1** — System can function without LLM API access (discovery uses cached results, drift detection disabled)
- **NFR3.3.2** — System can display fallback UI when LLM analysis fails

### NFR4: Usability

**NFR4.1** — Onboarding
- **NFR4.1.1** — First-time setup completes in < 3 minutes (connect repo, configure LLM, auto-discover)
- **NFR4.1.2** — System can provide contextual help tooltips on hover

**NFR4.2** — UI/UX
- **NFR4.2.1** — System can follow a consistent design system with minimal chrome and high information density
- **NFR4.2.2** — User can use keyboard-driven navigation
- **NFR4.2.3** — User can switch between light and dark themes

**NFR4.3** — Accessibility
- **NFR4.3.1** — System can support screen readers with ARIA labels on all interactive elements
- **NFR4.3.2** — User can adjust font size via settings

### NFR5: Extensibility

**NFR5.1** — LLM provider framework
- **NFR5.1.1** — System architecture supports pluggable LLM providers via a common interface
- **NFR5.1.2** — MVP supports one provider (Claude API) with abstraction layer for future providers

**NFR5.2** — Spec format support
- **NFR5.2.1** — System can parse BMAD, open-spec, and generic markdown specs

### NFR6: Security & Privacy

**NFR6.1** — Data privacy
- **NFR6.1.1** — All data stored locally (no cloud sync in MVP)
- **NFR6.1.2** — No telemetry without explicit user consent

**NFR6.2** — Agent sandbox
- **NFR6.2.1** — Agents operate within defined file scopes
- **NFR6.2.2** — System can require confirmation before destructive operations

**NFR6.3** — Credential management
- **NFR6.3.1** — System can store LLM provider API keys in local encrypted config
- **NFR6.3.2** — System must never log or display API keys in plain text
- **NFR6.3.3** — System can leverage Claude Code CLI OAuth authentication as alternative to API keys
- **NFR6.3.4** — Native terminal inherits user's environment for seamless Claude authentication

### NFR7: Testing

**NFR7.1** — E2E test coverage
- **NFR7.1.1** — All functional requirements have corresponding Playwright E2E tests
- **NFR7.1.2** — E2E tests run against real Next.js backend with seeded test database
- **NFR7.1.3** — External LLM API calls are mocked in E2E tests with realistic fixture responses
- **NFR7.1.4** — File system reads for discovery are mocked with test repo fixtures

---

## Success Metrics

### SM1: User Activation
- **SM1.1** — 80% of users complete auto-discovery on first run
- **SM1.2** — 60% of users launch at least one agent within first session
- **SM1.3** — 50% of users joining existing projects are operational within 2 minutes

### SM2: User Engagement
- **SM2.1** — Average session duration > 30 minutes
- **SM2.2** — Users launch average 3+ agents per day
- **SM2.3** — 70% of workflow interactions happen through MnM dashboard (not CLI)

### SM3: Drift Detection Value
- **SM3.1** — 70% of drift alerts marked as "useful" by users
- **SM3.2** — Cross-doc drift alerts catch inconsistencies before they reach code in 80% of cases
- **SM3.3** — 40% of detected drifts result in spec update

### SM4: Auto-Discovery Value
- **SM4.1** — 90% of specs correctly classified by LLM discovery
- **SM4.2** — 85% of workflows correctly detected and visualized
- **SM4.3** — Users report auto-discovery saves > 30 minutes of manual setup

### SM5: Performance Benchmarks
- **SM5.1** — 95th percentile UI response time < 300ms
- **SM5.2** — Drift detection accuracy > 90% (detected drifts align with manual review)

---

## Constraints

### C1: Technology Stack
- **C1.1** — Next.js 15+ with TypeScript and App Router
- **C1.2** — SQLite via Drizzle ORM for local-first persistence
- **C1.3** — shadcn/ui + Tailwind CSS for UI components
- **C1.4** — Claude API as MVP LLM provider (via Anthropic SDK)
- **C1.5** — Playwright for E2E testing
- **C1.6** — Tauri v2 for desktop app wrapper with native PTY terminal

### C2: Platform Support
- **C2.1** — MVP targets modern browsers (Chrome, Firefox, Safari, Edge)
- **C2.2** — Runs as local Next.js development server
- **C2.3** — Desktop app via Tauri (Windows, macOS, Linux) for native terminal features

### C3: Dependencies
- **C3.1** — Requires git installed and accessible
- **C3.2** — Requires LLM access via API key OR Claude Code CLI with OAuth session
- **C3.3** — Graceful degradation when API unavailable (cached discovery, disabled drift)
- **C3.4** — Desktop app requires Tauri runtime for native terminal features

### C4: Data Storage
- **C4.1** — All data stored locally in `.mnm/` directory within repository
- **C4.2** — SQLite database at `.mnm/state.db`
- **C4.3** — No cloud infrastructure in MVP

---

## Assumptions

### A1: User Environment
- **A1.1** — Users have a modern web browser
- **A1.2** — Users have git repository with product specs already committed
- **A1.3** — Users have an LLM API key (Claude API) OR Claude Code CLI with existing subscription

### A2: Workflow Assumptions
- **A2.1** — Specs live in git (not in JIRA, Linear, or Notion)
- **A2.2** — Users follow some structured spec format (BMAD, open-spec, or markdown)
- **A2.3** — Repository may have existing tool configurations (.claude/, _bmad/) that MnM should discover

### A3: Technical Assumptions
- **A3.1** — Claude API provides sufficient context window for drift analysis and discovery
- **A3.2** — LLM classification accuracy is sufficient for auto-discovery (with human review/override)

---

## Open Questions & Risks

### OQ1: Product Questions
- **OQ1.1** — What's the right frequency for cross-doc drift scanning? (on every commit vs. on-demand)
- **OQ1.2** — Should drift detection run automatically on agent completion, or on-demand only?
- **OQ1.3** — How granular should workflow visualization be? (phase-level vs. step-level vs. sub-step-level)

### OQ2: Technical Questions
- **OQ2.1** — What's the optimal LLM prompt strategy for repo discovery? (single comprehensive prompt vs. multi-pass)
- **OQ2.2** — How to handle large repos where full discovery exceeds context window?
- **OQ2.3** — How to mock LLM responses effectively in E2E tests while maintaining realistic behavior?

### R1: Technical Risks
- **R1.1** — LLM discovery accuracy may be inconsistent across different repo structures — mitigate with human review/override and iterative prompt refinement
- **R1.2** — Claude API rate limits may slow discovery — mitigate with caching and incremental updates
- **R1.3** — Cross-document drift detection may produce false positives — mitigate with severity classification and user feedback loop

---

## Next Steps

1. **Create implementation epics and stories** from FR7-FR11 (new features)
2. **Set up Playwright E2E testing infrastructure** with test database seeding and LLM mocking
3. **Implement FR9 (Auto-Discovery)** first — this unlocks FR7, FR8, and FR10
4. **Enhance dashboard** to display real discovered data
5. **Implement FR8 (Cross-Document Drift)** leveraging existing drift module
6. **Implement FR7 (Workflow Viewer)** from discovered workflow data
7. **FR11 (Native Claude Code Terminal)** — implemented via Tauri desktop wrapper
8. **Write E2E tests** for each completed feature

---

*PRD v2.1 — Updated 2026-02-21. Added FR11: Native Claude Code Terminal Integration (Tauri desktop app with native PTY terminal and OAuth authentication support).*
