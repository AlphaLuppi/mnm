---
date: 2026-02-19
author: Daedalus (System Architect)
version: 1.0
status: Draft
inputDocuments:
  - product-brief-mnm-2026-02-18.md
---

# Product Requirements Document: MnM

## Executive Summary

MnM is a Product-First Agile Development Environment (ADE) built in Rust/GPUI that treats **product vision as the center of development**, not code. The core innovation is **Spec Drift Detection** — real-time awareness of when code diverges from specifications, with actionable insights to help teams decide whether to update specs or recenter code.

MnM targets small teams (1-6 people) and product engineers working in agentic, spec-driven development workflows, providing a unified environment where specifications, code, and multi-agent workflows stay connected and aligned.

**MVP Goal:** Deliver a command center for agentic development that eliminates spec drift through intelligent detection, git-driven awareness, and seamless agent orchestration.

---

## Functional Requirements

### FR1: Agent & Workflow Dashboard

**FR1.1** — Display real-time view of all available agents
- **FR1.1.1** — List all configured agents (Claude Code instances)
- **FR1.1.2** — Show agent status: idle, running, paused, error
- **FR1.1.3** — Display agent capability metadata (what each agent can do)

**FR1.2** — Display real-time view of all running agents
- **FR1.2.1** — Show active agent sessions with unique identifiers
- **FR1.2.2** — Display current task/spec each agent is working on
- **FR1.2.3** — Show real-time progress indicators per agent
- **FR1.2.4** — Display agent output logs (stdout/stderr) in collapsible panels

**FR1.3** — Provide agent control actions
- **FR1.3.1** — Pause/resume running agents
- **FR1.3.2** — Stop/terminate agents
- **FR1.3.3** — View detailed agent status and error states

**FR1.4** — Multi-agent orchestration visibility
- **FR1.4.1** — Detect when multiple agents work on overlapping files/scopes
- **FR1.4.2** — Flag potential conflicts before they occur
- **FR1.4.3** — Display dependency graph when agents work on related stories

### FR2: Spec-Driven Agent Launching

**FR2.1** — Browse specifications in unified view
- **FR2.1.1** — Display product brief, PRD, architecture docs, and stories in navigable tree structure
- **FR2.1.2** — Support multiple spec formats: BMAD, open-spec, markdown
- **FR2.1.3** — Render specs with syntax highlighting and semantic structure
- **FR2.1.4** — Allow quick search/filter across all specs

**FR2.2** — Launch agents from any spec
- **FR2.2.1** — Provide "Launch Agent" action on any spec document (story, FR, NFR, architecture section)
- **FR2.2.2** — Pre-populate agent context with the selected spec content
- **FR2.2.3** — Allow user to select agent type (TDD, implementation, E2E, review)
- **FR2.2.4** — Support launching multiple agents in parallel from different specs

**FR2.3** — Agent-to-spec tracking
- **FR2.3.1** — Maintain bidirectional link: agent → spec, spec → agents working on it
- **FR2.3.2** — Display "Agents working on this" indicator on each spec
- **FR2.3.3** — Allow navigation from running agent back to originating spec

**FR2.4** — Agent scope management
- **FR2.4.1** — Define file/directory scope for each agent launch
- **FR2.4.2** — Prevent agents from modifying files outside their scope
- **FR2.4.3** — Display scope boundaries in agent dashboard

**FR2.5** — Spec-as-Interface (Interactive Document Actions)
- **FR2.5.1** — Render markdown documents as interactive control surfaces, not static text
- **FR2.5.2** — Each heading/section becomes an actionable element with contextual actions on hover
- **FR2.5.3** — Provide section-level actions based on document type:
  - On PRD sections: [TLDR] [Clarify] [Generate Stories] [Architecture Review]
  - On Story sections: [TLDR] [Dev] [TDD] [E2E] [Code Review] [Acceptance Criteria]
  - On Epic sections: [Expand] [Prioritize] [Estimate] [Sprint Planning]
- **FR2.5.4** — Display agent presence indicators per section:
  - 👁️ "Viewing" — agent has this section in context
  - 🔨 "Working" — agent is actively modifying related code
  - ✅ "Completed" — agent finished work on this section
- **FR2.5.5** — Show section status badges inline: Done ✅ / In Progress 🔄 / Backlog 📋
- **FR2.5.6** — Actions appear contextually (on hover/focus) — not cluttered, premium UX
- **FR2.5.7** — Support multi-select sections to launch bulk agent actions
- **FR2.5.8** — Clicking an action opens agent launch dialog pre-populated with section context

### FR3: Progress & Drift Detection

**FR3.1** — Track workflow and story completion
- **FR3.1.1** — Define workflow stages: PRD → Stories → Architecture → Dev → Test → Deploy
- **FR3.1.2** — Track completion status per story and per workflow stage
- **FR3.1.3** — Display roadmap-style progress view with visual indicators

**FR3.2** — Detect spec drift
- **FR3.2.1** — Compare code changes against associated specs (stories, FRs, architecture)
- **FR3.2.2** — Use AI (Claude Code API) to analyze semantic divergence between code and spec
- **FR3.2.3** — Classify drift severity: minor, moderate, critical
- **FR3.2.4** — Identify drift type: scope expansion, approach change, design deviation

**FR3.3** — Generate drift insights
- **FR3.3.1** — Produce human-readable summary: "What drifted and why"
- **FR3.3.2** — Assess drift value: "This drift could improve your product" vs. "This breaks your architecture"
- **FR3.3.3** — Provide actionable recommendations: "Update spec" vs. "Recenter code"
- **FR3.3.4** — Include diff view showing spec vs. actual implementation

**FR3.4** — Drift resolution workflow
- **FR3.4.1** — Allow user to accept drift and update spec inline
- **FR3.4.2** — Allow user to reject drift and create remediation task
- **FR3.4.3** — Track drift resolution history (what was changed and why)

**FR3.5** — Progress reporting
- **FR3.5.1** — Show completion percentage per story
- **FR3.5.2** — Show completion percentage per workflow stage (e.g., "Dev: 60%, Test: 20%")
- **FR3.5.3** — Display blockers and dependencies preventing progress
- **FR3.5.4** — Annotate progress view with drift indicators ("Story X: 80% complete, 1 critical drift")

### FR4: Spec Change Awareness (Git-Driven)

**FR4.1** — Detect important files via AI
- **FR4.1.1** — On first run or repo change, scan repository structure
- **FR4.1.2** — Use AI to classify files as: product brief, PRD, architecture, stories, config, code
- **FR4.1.3** — Store important file list in `.mnm/important-files.json` (git-tracked)
- **FR4.1.4** — Allow user to review and adjust AI-generated classification

**FR4.2** — Detect git changes
- **FR4.2.1** — On `git checkout`, `git fetch`, `git pull`, detect changed files
- **FR4.2.2** — Filter changes to important files only (product brief, PRD, architecture, stories)
- **FR4.2.3** — Calculate diff for each changed important file

**FR4.3** — Brief user on spec changes
- **FR4.3.1** — Display notification: "3 important files changed since last session"
- **FR4.3.2** — Show summary of changes per file with AI-generated natural language description
- **FR4.3.3** — Highlight impact: "Product vision updated: new feature added to roadmap"
- **FR4.3.4** — Provide "View Full Diff" action to inspect raw changes

**FR4.4** — Propagate awareness
- **FR4.4.1** — Update agent context when launching new agents after spec changes
- **FR4.4.2** — Flag running agents that may be affected by spec changes
- **FR4.4.3** — Suggest re-validation of drift detection after major spec changes

### FR5: Git Integration

**FR5.1** — Repository connection
- **FR5.1.1** — Detect git repository root on MnM launch
- **FR5.1.2** — Display current branch, commit SHA, and remote status
- **FR5.1.3** — Support multiple git remotes

**FR5.2** — Git operations
- **FR5.2.1** — Monitor git status (staged, unstaged, untracked files)
- **FR5.2.2** — Integrate with `git checkout`, `git fetch`, `git pull` hooks
- **FR5.2.3** — Read git log for change history

**FR5.3** — Commit association
- **FR5.3.1** — Link commits to stories/specs via commit message parsing
- **FR5.3.2** — Display commit history per story
- **FR5.3.3** — Show "Implemented by commits: X, Y, Z" on each story

### FR6: Code Viewing (Read-Only)

**FR6.1** — Display code files
- **FR6.1.1** — Render code with syntax highlighting (Rust, TypeScript, Python, etc.)
- **FR6.1.2** — Support file tree navigation
- **FR6.1.3** — Provide quick file search (fuzzy finder)

**FR6.2** — Code-to-spec linking
- **FR6.2.1** — Allow navigation from code file to associated spec
- **FR6.2.2** — Display "Related specs" panel when viewing code
- **FR6.2.3** — Highlight code sections that map to specific FRs/stories

**FR6.3** — Diff viewing
- **FR6.3.1** — Display git diffs inline with syntax highlighting
- **FR6.3.2** — Show side-by-side diff view for spec drift comparisons

**MVP Constraint:** No code editing in MVP. Code modification happens exclusively through agents.

---

## Non-Functional Requirements

### NFR1: Performance

**NFR1.1** — UI responsiveness
- **NFR1.1.1** — Maintain 60+ FPS rendering for all UI interactions (target: 120 FPS via GPUI)
- **NFR1.1.2** — Dashboard refresh latency < 100ms when agent status changes
- **NFR1.1.3** — Spec browsing and navigation < 50ms response time

**NFR1.2** — Drift detection performance
- **NFR1.2.1** — Drift analysis completes within 5 seconds for files < 1000 LOC
- **NFR1.2.2** — Drift analysis completes within 30 seconds for files 1000-5000 LOC
- **NFR1.2.3** — Support background/async drift detection for large codebases

**NFR1.3** — Git operations
- **NFR1.3.1** — Git change detection < 200ms for repos < 10,000 commits
- **NFR1.3.2** — Support repos up to 100MB in size without performance degradation

### NFR2: Scalability

**NFR2.1** — Agent orchestration
- **NFR2.1.1** — Support up to 10 concurrent agent sessions without UI lag
- **NFR2.1.2** — Handle agent log output up to 10MB per session without freezing

**NFR2.2** — Spec volume
- **NFR2.2.1** — Support projects with up to 500 stories
- **NFR2.2.2** — Support spec files up to 10MB total size
- **NFR2.2.3** — Maintain search performance < 300ms across all specs

### NFR3: Reliability

**NFR3.1** — Agent fault tolerance
- **NFR3.1.1** — Detect and recover from crashed agents
- **NFR3.1.2** — Preserve agent state on MnM restart (resume sessions)
- **NFR3.1.3** — Display clear error messages when agent fails

**NFR3.2** — Data integrity
- **NFR3.2.1** — Never corrupt git repository state
- **NFR3.2.2** — Maintain consistent `.mnm/` config even on crash
- **NFR3.2.3** — Validate AI-generated drift insights before display (prevent hallucination display)

**NFR3.3** — Graceful degradation
- **NFR3.3.1** — Function without network access (git and Claude Code must be local/accessible)
- **NFR3.3.2** — Display fallback UI if AI drift analysis fails

### NFR4: Usability

**NFR4.1** — Onboarding
- **NFR4.1.1** — First-time setup < 2 minutes (connect repo, detect important files, launch)
- **NFR4.1.2** — Provide in-app tutorial for core workflows (launch agent, resolve drift)
- **NFR4.1.3** — Display contextual help tooltips on hover

**NFR4.2** — UI/UX
- **NFR4.2.1** — Follow consistent design system (Zed-inspired, clean, minimal)
- **NFR4.2.2** — Support keyboard-driven navigation (vim-style keybindings optional)
- **NFR4.2.3** — Provide light and dark themes

**NFR4.3** — Accessibility
- **NFR4.3.1** — Support screen readers (ARIA labels)
- **NFR4.3.2** — Provide high-contrast mode
- **NFR4.3.3** — Font size adjustable via settings

### NFR5: Extensibility

**NFR5.1** — Agent framework support (post-MVP)
- **NFR5.1.1** — Design architecture to support multiple agent frameworks (Cursor, Aider, Codeium, etc.)
- **NFR5.1.2** — MVP: Claude Code only, but abstraction layer prepared

**NFR5.2** — Spec format support
- **NFR5.2.1** — Parse BMAD, open-spec, and generic markdown specs
- **NFR5.2.2** — Allow custom spec schema via config

**NFR5.3** — Plugin architecture (future)
- **NFR5.3.1** — Design plugin API for custom drift detection rules
- **NFR5.3.2** — Allow third-party integrations (Linear, JIRA, Notion) via plugins

### NFR6: Security & Privacy

**NFR6.1** — Data privacy
- **NFR6.1.1** — All data stored locally (no cloud sync in MVP)
- **NFR6.1.2** — No telemetry or analytics without explicit user consent

**NFR6.2** — Agent sandbox
- **NFR6.2.1** — Agents operate within defined file scopes (prevent accidental modification outside scope)
- **NFR6.2.2** — Require confirmation before agents execute destructive operations (file deletion, git reset)

**NFR6.3** — API key management
- **NFR6.3.1** — Store Claude API keys securely (system keychain)
- **NFR6.3.2** — Never log or display API keys in plain text

### NFR7: Licensing & Legal

**NFR7.1** — Open source
- **NFR7.1.1** — MnM released under Apache 2.0 License (compatible with GPUI)
- **NFR7.1.2** — All dependencies compatible with Apache 2.0

---

## Success Metrics

### SM1: User Activation
- **SM1.1** — 80% of users launch at least one agent within first session
- **SM1.2** — 60% of users complete first drift detection workflow within first week

### SM2: User Engagement
- **SM2.1** — Daily Active Users (DAU) > 50% of Weekly Active Users (WAU) for teams using MnM
- **SM2.2** — Average session duration > 30 minutes
- **SM2.3** — Users launch average 3+ agents per day

### SM3: Drift Detection Value
- **SM3.1** — 70% of drift alerts marked as "useful" by users (not dismissed as noise)
- **SM3.2** — 40% of detected drifts result in spec update (indicates drift had value)
- **SM3.3** — 30% of detected drifts result in code recenter (indicates drift prevented misalignment)

### SM4: Multi-Agent Orchestration
- **SM4.1** — Users run average 2+ concurrent agents per story
- **SM4.2** — 50% reduction in merge conflicts compared to traditional workflows (measured via git conflict rate)

### SM5: Product-Market Fit Indicators
- **SM5.1** — Net Promoter Score (NPS) > 40
- **SM5.2** — 60% of users would be "very disappointed" if MnM went away (Sean Ellis test)
- **SM5.3** — 30% of users invite a teammate within first month

### SM6: Retention
- **SM6.1** — Week 1 retention > 60%
- **SM6.2** — Week 4 retention > 40%
- **SM6.3** — Churn rate < 10% per month after first month

### SM7: Performance Benchmarks
- **SM7.1** — 95th percentile UI response time < 200ms
- **SM7.2** — Drift detection success rate > 90% (detected drifts align with manual review)

---

## Constraints

### C1: Technology Stack
- **C1.1** — Must use Rust + GPUI 0.2.2 (crates.io) + gpui-component 0.5.1
- **C1.2** — Cannot use VSCode extension model or Electron
- **C1.3** — MVP limited to Claude Code as agent framework

### C2: Platform Support
- **C2.1** — MVP targets macOS only (GPUI cross-platform support exists but not validated)
- **C2.2** — Post-MVP: Linux and Windows support

### C3: Team & Timeline
- **C3.1** — Team size: 3 people (Tom, Niko, TarsaaL)
- **C3.2** — MVP timeline: TBD (pending architecture and story breakdown)

### C4: Dependencies
- **C4.1** — Requires git installed and accessible
- **C4.2** — Requires Claude API access (user-provided API key)
- **C4.3** — Requires Claude Code installed and configured

### C5: Data Storage
- **C5.1** — All data stored locally in `.mnm/` directory within repository
- **C5.2** — No cloud infrastructure in MVP (no backend server, no database)

### C6: Licensing
- **C6.1** — Must comply with GPUI Apache 2.0 license
- **C6.2** — Must not include GPL-licensed dependencies (incompatible with Apache 2.0)

### C7: Scope Limitations
- **C7.1** — No code editing in MVP (code modification exclusively through agents)
- **C7.2** — No brainstorming/ideation flow in MVP (assumes product brief exists)
- **C7.3** — No team collaboration features beyond git-based awareness (no real-time multi-user sync)

---

## Assumptions

### A1: User Environment
- **A1.1** — Users have macOS development environment
- **A1.2** — Users have git repository with product specs already committed
- **A1.3** — Users have Claude Code installed and configured
- **A1.4** — Users have Claude API key

### A2: Workflow Assumptions
- **A2.1** — Product brief is brainstormed and pushed to repo before MnM usage
- **A2.2** — Specs live in git (not in JIRA, Linear, or Notion)
- **A2.3** — Users follow some structured spec format (BMAD, open-spec, or markdown)

### A3: User Behavior
- **A3.1** — Users work in agentic workflows (not manual code editing)
- **A3.2** — Users care about maintaining alignment with specs
- **A3.3** — Users commit frequently (drift detection relies on git history)

### A4: Technical Assumptions
- **A4.1** — Claude API provides sufficient context window for drift analysis (assume 200k tokens)
- **A4.2** — GPUI 0.2.2 is stable enough for production use
- **A4.3** — gpui-component 0.5.1 provides necessary UI primitives

### A5: Market Assumptions
- **A5.1** — Agentic development adoption continues to grow
- **A5.2** — Product engineers (PM+dev hybrid role) are an expanding persona
- **A5.3** — Spec-driven development becomes more common as AI-assisted coding matures

---

## Out of Scope (Post-MVP)

### OS1: Features Explicitly Deferred
- **OS1.1** — Daily news/digest view (standup-style summary)
- **OS1.2** — CEO-level vision dashboard (strategic drift overview for team leads)
- **OS1.3** — Multi-framework agent support (Cursor, Aider, Codeium, etc.)
- **OS1.4** — Brainstorming/ideation flow for product brief creation
- **OS1.5** — Real-time team collaboration (multi-user sync)
- **OS1.6** — Code editing within MnM

### OS2: Integrations Not Included in MVP
- **OS2.1** — Linear, JIRA, Notion integrations
- **OS2.2** — Slack, Discord notifications
- **OS2.3** — CI/CD pipeline integration
- **OS2.4** — Cloud sync or backup

### OS3: Advanced Features
- **OS3.1** — AI-powered refactoring suggestions
- **OS3.2** — Predictive drift detection (flag potential drift before code is written)
- **OS3.3** — Automated spec generation from code
- **OS3.4** — Cross-repository vision tracking (for microservices architectures)

### OS4: Platform & Deployment
- **OS4.1** — Linux and Windows support
- **OS4.2** — Mobile companion app (iOS, Android)
- **OS4.3** — Web-based version (browser access)

### OS5: Enterprise Features
- **OS5.1** — Role-based access control (RBAC)
- **OS5.2** — Audit logs and compliance reporting
- **OS5.3** — SSO/SAML authentication
- **OS5.4** — On-premises deployment

---

## Open Questions & Risks

### OQ1: Product Questions
- **OQ1.1** — How do users discover and evaluate "useful" vs. "noise" drift alerts? (requires user testing)
- **OQ1.2** — What's the right frequency for spec change awareness notifications? (on every fetch vs. daily digest)
- **OQ1.3** — Should drift detection run automatically on every agent completion, or on-demand only?

### OQ2: Technical Questions
- **OQ2.1** — Can Claude API handle drift detection at scale (e.g., 5000 LOC file)? Fallback strategy?
- **OQ2.2** — How to prevent AI hallucination in drift insights? Validation layer needed?
- **OQ2.3** — What's the performance impact of running 10 concurrent Claude Code agents?

### OQ3: UX Questions
- **OQ3.1** — What's the optimal dashboard layout for 10 concurrent agents? (needs prototype testing)
- **OQ3.2** — How to visualize dependency graph for multi-agent work without overwhelming users?
- **OQ3.3** — Should spec-to-code navigation be bidirectional in MVP, or code → spec only?

### R1: Technical Risks
- **R1.1** — GPUI 0.2.2 stability — mitigate by early prototyping and fallback to 0.1.x if needed
- **R1.2** — Claude API rate limits — mitigate by local caching and batching drift detection
- **R1.3** — Git repository size limits — mitigate by shallow clone support and file filtering

### R2: Market Risks
- **R2.1** — Agentic development adoption slower than expected — mitigate by validating with early users before full build
- **R2.2** — Competitors (Kiro, etc.) move faster — mitigate by focusing on unique differentiators (multi-agent orchestration, product vision layer)

### R3: Execution Risks
- **R3.1** — Team capacity (3 people) insufficient for MVP scope — mitigate by ruthless prioritization and scope cuts
- **R3.2** — Rust/GPUI learning curve steeper than expected — mitigate by early prototyping and community support

---

## Next Steps

1. **Architecture Design** (Daedalus) — Define system architecture, component breakdown, and API contracts
2. **Story Breakdown** (Hermès) — Decompose FRs into implementable stories with acceptance criteria
3. **UI/UX Prototype** (Design) — Wireframe dashboard, drift alerts, and spec browsing views
4. **Technical Spike** (Héphaestos) — Validate GPUI + Claude Code integration, measure drift detection performance
5. **Test Strategy** (Hygieia) — Define test coverage for drift detection, agent orchestration, and git integration

---

**Document Status:** Draft — Pending architecture review and stakeholder approval

**Approval Required From:**
- Tom (Product Lead)
- Daedalus (System Architect)
- Niko (Team Member)
- TarsaaL (Team Member)

---

*PRD v1.0 — Generated by Daedalus, 2026-02-19*
