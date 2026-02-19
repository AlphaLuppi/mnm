---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - brainstorm-v2-2026-02-19.md
  - product-brief-mnm-2026-02-18.md
  - architecture.md
  - epics.md
  - prd.md
date: 2026-02-19
author: Pantheon
---

# Product Brief: MnM

## Executive Summary

MnM is a Product-First Agile Development Environment (ADE) built from scratch in Rust and GPUI for GPU-accelerated performance. Unlike traditional IDEs that treat code as the center of development, MnM treats **product vision** as the center — giving teams a unified environment where specifications, code, and multi-agent workflows stay connected and aligned.

The core experience revolves around three pillars:

1. **Workflow Editor** — A chat-first system that serves as the heart of MnM. Users define and modify their agentic development pipelines primarily through natural language conversation with an LLM, complemented by a visual workflow viewer for at-a-glance pipeline understanding and an optional visual builder for manual edits. The Workflow Editor is also the onboarding experience: new users create their first workflow through guided conversation, with zero YAML/JSON configuration required.

2. **Cross-Document Drift Detection** — Beyond detecting when code diverges from specs, MnM detects inconsistencies *between* specification documents themselves. When a story mentions "websocket" but the Product Brief specifies "SSE," MnM catches the pollution before it cascades into agent context and code — preventing the kind of silent misalignment that costs teams days of rework.

3. **Spec-as-Interface** — Specification documents are not static text. Every heading, section, and requirement becomes an interactive control surface with contextual actions (Launch Agent, Generate Stories, Code Review), agent presence indicators, and real-time status badges.

MnM targets small teams (1-6 people) and product engineers who work in agentic, spec-driven development workflows. In a world where AI-assisted development makes specs mission-critical but nobody helps you stay aligned with them, MnM is the environment that keeps product vision ambient, accessible, and actionable — while giving teams unprecedented visibility into how their agentic workflows execute in real time.

---

## Core Vision

### Problem Statement

Modern development has a growing alignment crisis that operates on two levels.

**Level 1 — Code vs. Spec Drift:** In the age of agentic development, specs are mission-critical — you debug by rewriting from scratch. Yet during the flow of development, engineers discover better ideas, drift from specifications, and nobody helps them recenter on product vision. Products don't match specs, and teams can't identify at which step alignment broke.

**Level 2 — Spec vs. Spec Pollution:** The drift doesn't start in code. It starts in the specs themselves. A Product Brief specifies "SSE" for real-time communication. A story writer accidentally mentions "websocket." An AI agent, working from that story's context, guides a developer toward websocket. The developer remembers the original decision — but the agent doesn't. Nobody caught the pollution at the spec layer, and it cascaded silently into code and context. This is the real problem: **context pollution propagates from spec to spec, poisoning every agent and human who touches the downstream documents.**

**Level 3 — Workflow Opacity:** Teams running agentic workflows today have no structured way to define, visualize, or modify their development pipelines. Workflows live as implicit knowledge, raw JSON configs, or ad-hoc conversations. There is no real-time visibility into how each step impacts the next, what results flow between agents, or how to adjust the pipeline when something goes wrong.

### Problem Impact

- **Specs become dead documents and pollution vectors**: Epics become useless once stories are created. But worse — when specs contain inconsistencies, they actively mislead agents and developers. A single terminology mismatch in a story can redirect an entire implementation down the wrong path.

- **Agentic chaos without structure**: Multi-agent parallel workflows amplify drift — multiple agents working simultaneously can diverge from specs in different directions without anyone noticing. Without a defined workflow structure, there's no way to understand dependencies, sequencing, or conflict potential between agents.

- **Discovery without guardrails**: When engineers discover better approaches mid-development, they have no easy way to validate whether this aligns with the product vision, the architecture decisions, or even the terminology their teammates are using.

- **Feature factory syndrome**: Without accessible, living vision and real-time workflow visibility, teams drift into building features without understanding how they serve the product — creating a gap between stated values and daily work.

### Why Existing Solutions Fall Short

Current tools create a fragmented landscape where alignment is manual and tedious:

- **Project management tools** (JIRA, Linear, Notion): Store specs but don't connect them to code or to each other. Epics become write-once artifacts. No cross-document consistency checking.

- **Knowledge bases** (Confluence, company handbooks): Theoretically available but practically ignored. No one re-reads them, and no tool alerts you when they contradict each other.

- **Modern IDEs** (Cursor, Zed, Windsurf, VS Code + Copilot): Focused entirely on code generation and developer productivity, with zero awareness of product vision, specifications, or document-level consistency.

- **Workflow/automation tools** (n8n, Langflow, Flowise): Built for LLM pipeline orchestration, but not for product development workflows. No spec awareness, no drift detection, no product-first design.

- **Emerging tools** (Kiro, Conductor, etc.): Beginning to explore agentic development, but none combine workflow orchestration with cross-document drift detection and spec-as-interface interactivity.

No existing tool bridges the gap between the spec layer and the code layer with real-time drift awareness, cross-document consistency checking, structured workflow definition, and actionable insights.

### Proposed Solution

MnM is a GPU-accelerated ADE that provides:

1. **Workflow Editor (Heart of the App)**: A chat-first system where users create and modify workflows through natural language conversation ("Add a code review agent after dev"). A visual workflow viewer provides at-a-glance understanding of the pipeline (nodes, connections, parallelism, real-time status), and an optional visual builder allows manual drag-and-drop edits with a "Refresh Context" button to sync the chat's understanding. The Workflow Editor is also the onboarding: new users create their first workflow through conversation, and MnM proposes a template based on their project context. Each agent in the workflow is configurable: role, instructions, tools (Git, Terminal, Browser), and file scope.

2. **Cross-Document Drift Detection**: MnM understands the document hierarchy (Product Brief → PRD → Architecture → Stories → Code) and detects inconsistencies at every level. Not just "code drifted from spec" but "this story contradicts the architecture decision" or "this PRD section uses different terminology than the Product Brief." Alerts are actionable: update the source of truth, correct the downstream document, or escalate for team discussion.

3. **Spec-as-Interface**: Markdown documents become interactive control surfaces. Every section offers contextual actions (Launch Agent, Generate Stories, TLDR, Code Review), displays agent presence (who's working on what), and shows real-time status. Specs are alive — not files you read, but interfaces you work through.

4. **Real-Time Workflow Visibility**: During execution, users see how each workflow step impacts the next, what results flow between agents, and where the pipeline stands. This goes beyond a dashboard — it's a live, interactive view of the entire development process.

5. **Unified Vision Layer**: A framework-agnostic view that surfaces product vision, PRDs, stories, and architecture — regardless of whether teams use BMAD, open-spec, or any other workflow tooling.

### Key Differentiators

- **Product-first, not code-first**: The only ADE that treats specs as living, interactive, connected artifacts — not static documents. Specs are interfaces you work through, not files you read.

- **Workflow-centric orchestration**: Not just "who's working on what" but the complete definition, visualization, and real-time monitoring of agentic development pipelines — with a chat-first interface for natural language workflow editing and a visual viewer/builder for at-a-glance understanding.

- **Cross-document drift detection**: The only tool that catches inconsistencies *between* specification documents before they cascade into code and agent context. Prevents context pollution at the source.

- **Vision as unfair advantage**: MnM's competitive moat isn't a technical detail — it's the product vision itself. The combination of workflow orchestration + cross-document drift + spec-as-interface creates a category that doesn't exist yet: the **product-first agentic development platform**.

- **Built from scratch in Rust/GPUI**: Full architectural control without legacy constraints — enabling a product experience that existing IDEs cannot retrofit. 120+ FPS rendering, native performance, no Electron overhead.

- **New category**: MnM doesn't compete in the IDE market or the workflow automation market. It defines a new way of working with agents, workflows, and spec-driven development — where product vision stays ambient and actionable throughout the entire development lifecycle.

---

## Target Users

### Primary Users

#### Persona 1: Alex — The Solopreneur

**Profile:** Solo developer / founder running agentic workflows to build a product. Wears every hat — product, engineering, design. Works primarily through AI agents rather than manual coding.

**Day-to-Day:** Alex launches multiple agents in parallel across stories — TDD, implementation, E2E tests, review. The challenge isn't writing code (agents do that), it's **maintaining a clear product vision while moving fast** and **structuring the workflow that produces the best results**. Without a co-founder or PM to challenge ideas, it's easy to drift from the original vision without realizing it — and without a defined workflow, the agentic pipeline is ad-hoc and inconsistent.

**Current Pain:**
- Workflows are implicit: Alex launches Claude Code manually, decides execution order from memory, and has no visual representation of the pipeline
- Vision lives in their head — no system reflects it back or flags when specs contradict each other
- When agents produce code that subtly deviates from specs, there's no early warning — and when specs themselves are inconsistent, the agents blindly follow the polluted context
- No way to see in real time how each agent's output impacts the next step in the pipeline

**What Success Looks Like:**
- Opens MnM → the Workflow Editor shows the defined pipeline with real-time status of each step
- Configures and iterates on workflows through chat ("add a code review step after dev") or visual builder, without touching config files
- Gets clear signals when specs contradict each other, not just when code drifts from specs
- Sees live how each workflow step feeds into the next — results, dependencies, and bottlenecks at a glance

#### Persona 2: Jordan — Product Engineer on a Small Team (4 people)

**Profile:** Product engineer at an early-stage startup. Part of a tight team of 3-4 people where everyone runs agents. Reports to a lead/founder who sets product vision.

**Day-to-Day:** Jordan works on stories assigned from the team's sprint. Launches agents, reviews their output, and coordinates with teammates working on adjacent features. The team shares a workflow definition, but adapts it per story.

**Current Pain:**
- **The vision isn't shared.** When the founder updates the product brief or changes direction on a spec, Jordan doesn't find out until something breaks or conflicts surface in code review
- Workflows are tribal knowledge: the team's agentic pipeline exists as informal convention, not as a defined, visible structure anyone can modify
- Teammates change specs or discover better approaches but the rest of the team doesn't know — changes live in individual conversations with agents, not in a shared system
- No single place to see what everyone is working on, what's changed, and how current work connects to product goals

**What Success Looks Like:**
- Joins the project by cloning the repo → MnM detects the existing workflow definitions, specs, and agent configurations automatically
- Opens MnM and sees the team's shared workflow with live agent status, who's working on what, and any spec changes since last session
- When a colleague discovers that websockets would work better than polling, MnM surfaces that insight to the whole team with context on how it affects the broader architecture
- Can modify the workflow through the visual builder and see the change reflected in the chat log, keeping a transparent history of pipeline adjustments

#### Persona 3: Gabriel — The Team Member Navigating Change

**Profile:** Engineer on a team project who discovers that things have changed since they last worked — and needs to understand what, why, and what to do about it.

**Day-to-Day:** Gabriel works on his part of the project, often asynchronously from teammates. When he returns to work — whether after a day off, switching branches, or starting a new story — he needs to quickly understand the current state of truth. Did someone change the architecture? Are the stories still consistent with the PRD? Is the context he's about to give his agents still valid?

**Current Pain:**
- An architect passed through and changed technical decisions. Gabriel doesn't know why it changed, how it happened, or whether it was a deliberate decision or an accidental pollution
- The SSE vs Websocket problem: a teammate wrote a story mentioning "websocket," the agent used that context, and Gabriel only caught it because he remembered the original brainstorming discussion. He had to ping on Discord: "Why did your stories add websocket?" — Answer: "The agent assumed it from an example, it wasn't intentional"
- No way to distinguish between a "good drift" (validated team decision) and a "bad drift" (context pollution from an agent or a careless edit)
- When changes are detected, there's no clear path to resolution: should he redo his work? Update the source of truth? Escalate to the team?

**What Success Looks Like:**
- Opens MnM and sees immediately: "3 spec changes since your last session" with AI-generated summaries explaining *what* changed and *why*
- Each change is tagged: deliberate decision (accepted drift) vs. unreviewed change (potential pollution)
- Can trace the change back to its source: who made it, which agent, which commit, which document was modified
- Actionable resolution: "Update downstream docs," "Revert to source of truth," or "Flag for team discussion" — one click, not a Discord thread

### Secondary Users

**Team Lead / Product Owner (e.g., Tom):** Sets product vision and specs. Needs visibility into whether the team is building what was envisioned. Benefits from cross-document drift detection at the strategic level — "the team has collectively drifted from the original architecture in these 3 areas." Uses the Workflow Editor to define the team's standard pipeline and onboard new team members with a shared, visible workflow structure.

### User Journey

**Discovery:** Product engineers and solopreneurs frustrated with the gap between specs and code in agentic workflows. Word of mouth in developer communities: "finally something that treats specs as living documents and gives you a real workflow editor instead of raw configs."

**Onboarding (two paths):**
- **New project:** MnM opens → conversational onboarding → "What's your project? What LLM provider? What does your team look like?" → MnM proposes a workflow template based on answers → user accepts or modifies via chat or visual builder → first workflow is ready to run. Zero config files.
- **Join existing project:** Clone the repo → MnM detects existing workflow definitions, specs, important files, and agent configurations automatically → "Your team has 2 workflows defined and 14 specs indexed. Ready to go." → user sees the team's live state immediately.

**Core Usage:** Open Workflow Editor → see pipeline status and agent activity in real time → launch agents from specs (click section → contextual action) → monitor cross-document drift alerts → resolve or update specs → iterate on workflow through chat or builder → repeat.

**Success Moment (double):**
1. *First:* "I just created my entire agentic workflow in 2 minutes through a conversation. No YAML, no JSON, no docs to read."
2. *Then:* "My first workflow produced results way better than me manually driving Claude Code — AND I have real-time visibility into what's happening at every step."

**Long-term:** MnM becomes the command center for product development. The place you open first, not the code editor. Workflows are living, evolving structures. Vision stays ambient and alive. Spec changes propagate as awareness, not as surprises. The team operates with shared context instead of tribal knowledge.

---

## Success Metrics

### User Activation

- **SM1.1** — 80% of users create their first workflow within the onboarding session (new project path)
- **SM1.2** — 90% of users joining an existing project are operational (workflow detected, specs indexed) within 2 minutes
- **SM1.3** — 60% of users launch at least one agent within first session
- **SM1.4** — 50% of users complete first drift detection workflow within first week

### User Engagement

- **SM2.1** — Daily Active Users (DAU) > 50% of Weekly Active Users (WAU) for teams using MnM
- **SM2.2** — Average session duration > 30 minutes
- **SM2.3** — Users launch average 3+ agents per day
- **SM2.4** — 70% of workflow modifications happen through the dual interface (chat or builder), not external config

### Workflow Editor Value

- **SM3.1** — Users who define workflows produce measurably better agent output vs. ad-hoc agent launching (measured via drift rate and rework rate)
- **SM3.2** — 60% of users iterate on their workflow at least once per week (workflow is living, not set-and-forget)
- **SM3.3** — Average time from "new project" to "first workflow running" < 5 minutes

### Drift Detection Value

- **SM4.1** — 70% of drift alerts marked as "useful" by users (not dismissed as noise)
- **SM4.2** — 40% of detected drifts result in spec update (indicates drift had value)
- **SM4.3** — 30% of detected drifts result in code recenter (indicates drift prevented misalignment)
- **SM4.4** — Cross-document drift alerts catch inconsistencies before they reach code in 80% of cases (measured via drift resolved at spec level vs. discovered at code level)

### Multi-Agent Orchestration

- **SM5.1** — Users run average 2+ concurrent agents per story
- **SM5.2** — 50% reduction in merge conflicts compared to ad-hoc workflows (measured via git conflict rate)

### Product-Market Fit Indicators

- **SM6.1** — Net Promoter Score (NPS) > 40
- **SM6.2** — 60% of users would be "very disappointed" if MnM went away (Sean Ellis test)
- **SM6.3** — 30% of users invite a teammate within first month

### Retention

- **SM7.1** — Week 1 retention > 60%
- **SM7.2** — Week 4 retention > 40%
- **SM7.3** — Churn rate < 10% per month after first month

### Performance Benchmarks

- **SM8.1** — 95th percentile UI response time < 200ms
- **SM8.2** — Drift detection success rate > 90% (detected drifts align with manual review)
- **SM8.3** — Workflow Editor context refresh latency < 500ms (builder edits reflected in chat context after refresh)

---

## Scope Definition

### MVP Scope

The MVP delivers six capabilities that directly address the alignment crisis and workflow opacity problem:

**1. Workflow Editor (Heart of the App)**

The central experience of MnM. Users define and manage their agentic development pipelines through a chat-first interface:

- **Chat LLM (primary editing mode):** Users create and modify workflows through natural language conversation. "Add a code review agent after dev." "Run E2E tests in parallel with unit tests." "Connect the QA agent to the test results." The chat is the primary way to define, iterate, and evolve workflows.
- **Visual Workflow Viewer:** A read-only visual representation of the workflow (nodes-and-edges style) that provides at-a-glance understanding of the pipeline — agent order, parallelism, dependencies, and real-time execution status.
- **Builder (secondary editing mode):** A visual editing fallback for users who prefer drag-and-drop manipulation. When edits are made in the builder, the user clicks "Refresh Context" in the chat to sync the LLM's understanding with the current workflow state.
- **Agent Configuration:** Each agent in the workflow is configurable with: role (what it does), instructions (prompt/guidelines), tools (Git, Terminal, Browser), and file scope.

**2. Conversational Onboarding**

The Workflow Editor IS the onboarding. Two paths:

- **New project:** Guided conversation → "What's your project? What LLM provider?" → MnM proposes a workflow template based on answers → user accepts or modifies via chat → first workflow ready to run. Zero config files, zero documentation to read.
- **Join existing project:** Clone the repo → MnM auto-detects existing workflow definitions, specs, important files, and agent configurations → user sees the team's live state immediately.

**3. Spec-as-Interface (Interactive Documents)**

Specification documents become interactive control surfaces:

- Every heading/section becomes an actionable element with contextual actions on hover
- Section-level actions based on document type: PRD sections get [TLDR] [Clarify] [Generate Stories]; Story sections get [Dev] [TDD] [E2E] [Code Review]
- Agent presence indicators per section: viewing, working, completed
- Real-time status badges: Done / In Progress / Backlog
- Multi-select sections for bulk agent actions

**4. Agent Orchestration & Control**

Launch, monitor, and control multiple AI agents with conflict prevention:

- Agent dashboard with real-time status (running, paused, completed, error)
- Launch agents from specs (via Spec-as-Interface actions)
- Pre-work file locking for multi-agent conflict prevention
- Agent log streaming (real-time stdout/stderr)
- Pause, resume, terminate controls
- Live workflow visibility: see how each step impacts the next during execution

**5. Drift Detection (Code + Cross-Document)**

Two layers of drift detection:

- **Code-vs-Spec Drift:** When an agent completes work, MnM compares the implementation against the spec using git diff + AI analysis. Classifies severity (minor, moderate, critical) and type (scope expansion, approach change, design deviation). Provides actionable recommendation: update spec or recenter code.
- **Cross-Document Drift:** MnM understands the document hierarchy (Product Brief → PRD → Architecture → Stories → Code) and detects inconsistencies between levels. A story that mentions "websocket" when the Product Brief specifies "SSE" triggers an alert before it cascades into code. Alerts include source references, context, and resolution options.
- **Resolution workflow:** Accept drift (update source of truth) or reject drift (create remediation task). All decisions logged for audit trail.

**6. Spec Change Awareness (Git-Driven)**

Automatic detection and summarization of spec changes:

- On git checkout/fetch/pull, detect changes to important files (PRD, product brief, architecture, stories)
- Important files identified via AI analysis of the repository (stored in `.mnm/important-files.json`)
- AI-generated natural language summaries: "Architecture updated: switched from REST to GraphQL for the API layer"
- Notification on MnM open: "3 important files changed since last session" with grouped summaries
- Flag running agents that may be affected by spec changes

### How These Features Address the Core Problem

| Feature | Problem Addressed |
|---------|-------------------|
| **Workflow Editor** | Workflow Opacity (Level 3) — gives structure to implicit knowledge |
| **Onboarding** | Zero-friction entry — workflows from conversation, not config files |
| **Spec-as-Interface** | Specs as dead documents — makes them living, interactive surfaces |
| **Agent Orchestration** | Agentic chaos — visibility + conflict prevention + real-time monitoring |
| **Code Drift Detection** | Code vs. Spec (Level 1) — catches implementation divergence |
| **Cross-Doc Drift Detection** | Spec vs. Spec Pollution (Level 2) — prevents context cascade |
| **Spec Change Awareness** | Discovery without guardrails — propagates awareness, not surprises |

### Must-Have vs Nice-to-Have

**Must-Have (MVP):**
- Workflow Editor with chat-first editing + visual viewer + builder fallback
- Conversational onboarding (both paths: new project + join existing)
- Spec-as-Interface with contextual actions and agent presence
- Agent orchestration with file locking and real-time visibility
- Drift detection: code-vs-spec + cross-document
- Spec change awareness with AI summaries
- Git integration as source of truth
- Claude Code as agent runtime
- Config per agent: role, instructions, tools, file scope

**Nice-to-Have (v1.1):**
- MCP Connectors (GitHub, Linear, ClickUp, Slack)
- Custom API connectors for internal tools
- Workflow templates (pre-built pipelines for common setups)
- Markdown file connectors (like BMAD sprint-status.md pattern)

### Assumptions (MVP)

- Product brief is already brainstormed and pushed to the repo — no brainstorming/ideation flow in MVP
- Single agentic framework: Claude Code only
- macOS only (GPUI cross-platform exists but not validated for MVP)
- Chat is the primary workflow editing interface; builder is a visual fallback with manual context refresh
- All data stored locally (no cloud sync, no backend server)

### MVP Technical Constraint

**Git + Claude Code + Local-first.** The MVP integrates exclusively with git (for spec tracking, change detection, and drift analysis), Claude Code (as the agent runtime), and stores all state locally in `.mnm/` (SQLite + config files). No cloud infrastructure, no external database.

### Out of Scope (Post-MVP)

**Features Explicitly Deferred:**
- MCP connectors and external integrations (Linear, JIRA, Notion, Slack)
- Custom API connectors for internal tools
- Multi-framework agent support (Cursor, Aider, Codeium, etc.)
- Code editing within MnM (code modification exclusively through agents in MVP)
- Daily news/digest view (standup-style summary)
- CEO-level vision dashboard (strategic drift overview)
- Brainstorming/ideation flow for product brief creation
- Real-time team collaboration (multi-user sync beyond git-based awareness)
- Workflow sharing / marketplace / community templates
- Automated live sync between builder and chat (manual refresh is MVP)

**Platform Deferred:**
- Linux and Windows support
- Mobile companion app
- Web-based version

**Enterprise Deferred:**
- Role-based access control (RBAC)
- Audit logs and compliance reporting
- SSO/SAML authentication
- On-premises deployment

### The "Aha!" Moment

> *First:* "I just created my entire agentic workflow in 2 minutes through a conversation. No YAML, no JSON, no docs to read."
>
> *Then:* "My first workflow produced results way better than me manually driving Claude Code — AND I have real-time visibility into what's happening at every step, AND MnM caught an inconsistency between my story and my architecture doc before my agent even started coding."

The delight is the **triple combination**: effortless workflow creation (chat-first) + superior results with visibility (structured pipeline) + proactive protection from context pollution (cross-document drift). MnM doesn't slow you down to stay aligned — it makes alignment the natural byproduct of working in the environment.

---

## Technical Foundation

- **Rust + GPUI**: GPU-accelerated UI framework (same as Zed), 120+ FPS rendering
- **gpui 0.2.2** from crates.io + **gpui-component 0.5.1** for UI components
- **NOT a VSCode fork**: Built from scratch for full architectural control
- **Apache 2.0 License**: GPUI licensing is permissive
- **SQLite**: Local-first data persistence (no cloud, no server)
- **git2-rs**: Native git integration for change detection and drift analysis
- **Claude API**: Drift analysis, spec change summarization, cross-document consistency checking
- **Claude Code**: Agent runtime (subprocess via IPC)

---

## Team

- **Tom**: Lead / Product
- **Nikou**: Team member
- **TarsaaL**: Team member

---

## Market Timing Insights

- Building for where teams are heading (agentic development), not where they are today
- "Everything in code/git" trend is a major tailwind — specs as code, not specs in separate SaaS tools
- The explosion of AI-assisted development makes specs mission-critical but nobody helps teams stay aligned
- Framework-agnostic approach positions MnM as a unified vision layer, not another opinionated workflow tool
- Chat-first workflow editing aligns with the natural language paradigm shift — users expect to talk to their tools, not configure them

---

---

*Product Brief v2 complete (Steps 1-5). Incorporates Cross-Document Drift Detection and Workflow Editor based on feedback from Gabriel and Tom's vision. Next: Update PRD, Architecture, and Epics from this Product Brief via BMAD workflow.*
