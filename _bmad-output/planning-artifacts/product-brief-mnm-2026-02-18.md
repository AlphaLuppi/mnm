---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ["user-provided-context (verbal)"]
date: 2026-02-18
author: Pantheon
---

# Product Brief: MnM

## Executive Summary

MnM is a Product-First Agile Development Environment (ADE) built from scratch in Rust and GPUI for GPU-accelerated performance. Unlike traditional IDEs that treat code as the center of development, MnM treats **product vision** as the center — giving teams a unified environment where specifications, code, and multi-agent workflows stay connected and aligned.

The killer feature is **Spec Drift Detection**: real-time awareness of when code diverges from PRD, stories, and architectural specifications — with actionable insights that help teams decide whether to update specs or recenter code. MnM targets small teams (1-6 people) and product engineers who work in agentic, spec-driven development workflows, providing the tooling layer that makes structured development effortless rather than burdensome.

In a world where AI-assisted development makes specs mission-critical but nobody helps you stay aligned with them, MnM is the environment that keeps product vision ambient, accessible, and actionable at every step of the development process.

---

## Core Vision

### Problem Statement

Modern development has a growing alignment crisis. In the pre-AI era, specs became stale documents because code dictated truth — and that was acceptable. In the age of agentic/vibe-coding, specs are mission-critical (you debug by rewriting from scratch), yet the problem has inverted: during the flow of development, engineers discover better ideas, drift from specifications, and **nobody helps them recenter on product vision**.

The result: products don't match specs, and teams can't identify at which step alignment broke. Engineers must be constantly vigilant — during development, testing, review — but nothing in their toolchain makes vision-checking effortless or integrated.

### Problem Impact

- **Specs become dead documents**: Epics become useless once stories are created; technical docs in Confluence are never re-read; product vision lives in the CEO's head
- **Discovery without guardrails**: When engineers discover better approaches mid-development (e.g., websockets instead of polling), they have no easy way to validate whether this aligns with long-term product vision
- **Feature factory syndrome**: Without accessible vision, teams drift into building features without understanding how they serve the product — creating a gap between stated values and daily work
- **Agentic chaos**: Multi-agent parallel workflows amplify drift — multiple agents working simultaneously can diverge from specs in different directions without anyone noticing

### Why Existing Solutions Fall Short

Current tools create a fragmented landscape where alignment is manual and tedious:

- **Project management tools** (JIRA, Linear, Notion): Store specs but don't connect them to code; epics become write-once artifacts
- **Knowledge bases** (Confluence, company handbooks): Theoretically available but practically ignored — like PostHog's public handbook that nobody re-reads because it's tedious
- **Modern IDEs** (Cursor, Zed, Windsurf, VS Code + Copilot): Focused entirely on code generation and developer productivity, with zero awareness of product vision or specifications
- **Emerging tools** (Kiro and similar): Beginning to explore this space but not yet proven in full agentic workflows

No existing tool bridges the gap between the spec layer and the code layer with real-time drift awareness and actionable insights.

### Proposed Solution

MnM is a GPU-accelerated ADE that provides:

1. **Unified Vision Layer**: A framework-agnostic view that surfaces product vision, PRDs, stories, and architecture — regardless of whether teams use BMAD, open-spec, JIRA, or any other workflow tooling
2. **Spec Drift Detection**: Bidirectional sync between specs and code with intelligent drift analysis — not just "drift detected" but insights on whether the drift has value and whether to update specs or recenter code
3. **Multi-Agent Orchestration**: Clear visibility into parallel agent work, conflict detection, and orchestration for teams running multiple agents simultaneously across stories
4. **Daily Product Awareness**: A standup-style overview showing what's changed, what's left, and how current work serves the product vision — making alignment effortless rather than requiring discipline

The workflow spans the full lifecycle: PRD → Stories → Architecture → Dev → Test → Deploy, with vision accessibility at every stage.

### Key Differentiators

- **Product-first, not code-first**: Built for organizations with product vision, not just individual developers writing code. The only ADE that treats specs as living, connected artifacts rather than static documents
- **Framework-agnostic integration**: Works with whatever workflow tooling teams already use — MnM provides the unified vision layer, not another opinionated process
- **Multi-agent orchestration with drift awareness**: Purpose-built for the emerging reality of parallel agentic development, where drift compounds and visibility is critical
- **Built from scratch in Rust/GPUI**: Full architectural control without VS Code's legacy constraints — enabling a product experience that existing IDEs cannot retrofit
- **Designed for Product Engineers**: Targets the convergence of PM and dev roles, enabling small teams to advance products together with minimal friction and maximum clarity on what matters

---

## Solution Vision (User Answers)

### 1. Walk me through a day if MnM works perfectly

**Opening MnM**: The product engineer sees a clear view of what they need to work on, or what agents have been working on since last time — like a **daily standup overview**. For example: a check of what's left to do (tests, dev, review, latest product brief updates, etc.) since their last session.

**Working on a story**: Launching multiple agents in parallel (TDD test writing, dev, E2E tests, code review). Since they're working on **multiple stories in parallel**, they need a clear view of everything happening and what remains.

**When drift happens**: A **diff of what drifted**, why it drifted, and a vision of whether it's a drift that could be useful or not — and whether they can update the specs or need to redo the code.

### 2. What's the simplest version that makes a meaningful difference?

The **core loop**: Work easily in multi-agent mode, verify parallel agent work and potential conflicts, orchestrate well. Have meaningful insights when agents derail or spec drift — **not just "drift detected"** but actual value on these insights.

### 3. What would make users say "this is exactly what I needed"?

Something like: "Woah, that idea my colleague had on their feature is really going to drive the product forward"

*Note: This answer was uncertain — the real delight moment may be the drift insight itself: not just "drift detected" but "here's a drift that could make your product better, want to update specs?"*

---

## Unique Differentiators (User Answers)

### 4. What's your unfair advantage?

The ability to **execute fast** (GPUI base) but **without the disadvantages of VSCode etc.** — so we can do whatever we want with full control.

### 5. Why now?

**Ahead of market** but a wave is coming — though maybe not directly on our scope.

### 6. What would be hardest for a competitor to copy?

Definitely the **multi-agent orchestration** and the **product vision layer**. They make products for devs, not for organizations with a product vision. That's the key difference.

---

## Target Users

### Primary Users

#### Persona 1: Alex — The Solopreneur

**Profile:** Solo developer / founder running agentic workflows to build a product. Wears every hat — product, engineering, design. Works primarily through AI agents rather than manual coding.

**Day-to-Day:** Alex launches multiple agents in parallel across stories — TDD, implementation, E2E tests, review. The challenge isn't writing code (agents do that), it's **maintaining a clear product vision while moving fast**. Without a co-founder or PM to challenge ideas, it's easy to drift from the original vision without realizing it.

**Current Pain:**
- Bounces between tools (terminal, browser, project management, docs) with no unified view of what's happening
- Vision lives in their head — no system reflects it back or flags when they're drifting
- When agents produce code that subtly deviates from specs, there's no early warning
- Pivots happen organically but without structure — hard to tell if they're drifting or genuinely improving the product

**What Success Looks Like:**
- Opens MnM and immediately sees agent status, spec alignment, and what needs attention
- Gets a clear signal when drift happens: "You've drifted from spec X — is this intentional? Here's how it could improve your product, or here's why you should recenter"
- Can pivot intelligently with structured re-brainstorming rather than unconscious drift
- Good orchestration of parallel agents without context-switching between tools

#### Persona 2: Jordan — Product Engineer on a Small Team (4 people)

**Profile:** Product engineer at an early-stage startup. Part of a tight team of 3-4 people where everyone runs agents. Reports to a lead/founder who sets product vision.

**Day-to-Day:** Jordan works on stories assigned from the team's sprint. Launches agents, reviews their output, and coordinates with teammates working on adjacent features. The code editing happens through agents — Jordan's role is orchestration, review, and product alignment.

**Current Pain:**
- **The vision isn't shared.** When the founder updates the product brief or changes direction on a spec, Jordan doesn't find out until something breaks or conflicts surface in code review
- Teammates change specs or discover better approaches but **the rest of the team doesn't know about it** — changes live in individual conversations with agents, not in a shared system
- No single place to see what everyone is working on, what's changed, and how current work connects to product goals
- Coordination overhead grows as agents multiply across team members

**What Success Looks Like:**
- Opens MnM and sees what's changed since last session — spec updates from teammates, agent progress, drift alerts
- When a colleague discovers that websockets would work better than polling, MnM surfaces that insight to the whole team with context on how it affects the broader architecture
- Information flows automatically: spec changes propagate as awareness, not as surprises during integration

### Secondary Users

**Team Lead / Product Owner (e.g., Tom):** Sets product vision and specs. Needs visibility into whether the team is building what was envisioned. Benefits from drift detection at the strategic level — "the team has collectively drifted from the original architecture in these 3 areas."

### User Journey

**Discovery:** Product engineers and solopreneurs frustrated with the gap between specs and code in agentic workflows. Word of mouth in developer communities, "finally something that treats specs as living documents."

**Onboarding:** Connect existing project specs (BMAD, open-spec, or custom). MnM indexes the vision layer and begins tracking alignment. No code editor to learn — the interface is about vision, agents, and orchestration.

**Core Usage:** Daily standup view → launch/monitor agents → drift alerts → resolve or update specs → repeat. No manual code editing in MVP — code viewing only, editing is agent-driven.

**Success Moment:** First time MnM flags a meaningful drift and the insight is genuinely useful — either "this drift is an improvement, update your specs" or "this broke your architecture, recenter."

**Long-term:** MnM becomes the command center for product development. The place you open first, not the code editor. Vision stays ambient and alive instead of decaying in a forgotten doc.

---

## Scope Definition

### MVP Scope (Absolute Minimum)

The MVP delivers four capabilities that directly address the spec drift and vision loss problem:

1. **Agent & Workflow Dashboard**: A clear, real-time view of available agents, running agents, and what each agent is currently working on — the command center for agentic development

2. **Spec-Driven Agent Launching**: Browse specs (stories, PRD, architecture), launch agents from any spec with minimal friction, and maintain visibility into each agent's progress and scope. The core interaction is: see spec → launch agent → track work

3. **Progress & Drift Detection**: At the end of each workflow or story completion, surface a roadmap-style progress view showing advancement and spec drift — a clear signal of where the project stands vs. where it should be, like a progress bar with drift annotations

4. **Spec Change Awareness (Git-Driven)**: On git checkout/fetch, automatically detect and brief the user on changes to important files (PRD, product brief, architecture, stories). Important files are identified via AI analysis of the repository — stored in a pushed config file, not manually configured by the user

### How These Features Address the Core Problem

Each MVP capability maps directly to the alignment crisis:

- **Dashboard + Agent Launching** → eliminates the "bouncing between tools" pain; gives one place to see and control everything
- **Drift Detection** → the killer feature; surfaces misalignment as it happens, not after integration breaks
- **Spec Change Awareness** → ensures vision changes propagate as awareness, not as surprises; solves the "my colleague updated specs and I didn't know" problem
- **AI-driven file detection** → removes the setup burden; MnM understands which files matter without manual configuration

### Must-Have vs Nice-to-Have

**Must-Have (MVP):**
- Agent visibility and orchestration dashboard
- Spec-driven agent launching with per-agent tracking
- Progress and drift detection at workflow/story boundaries
- Git-driven spec change awareness with AI-identified important files
- Git integration as the source of truth
- Claude Code as the agent runtime

**Nice-to-Have (Not MVP):**
- Daily news/digest view (standup-style summary)
- CEO-level vision dashboard (strategic drift overview for team leads)

**Assumptions (MVP):**
- Product brief is already brainstormed and pushed to the repo — no brainstorming/ideation flow in MVP
- Single agentic framework: Claude Code only

**Post-MVP (Future Scope):**
- Real onboarding flow where users choose their preferred agentic framework (Claude Code, Cursor, Aider, etc.)
- Guided integration into existing codebase and tools with connectors and MCP setup
- Multi-framework agent orchestration
- Team collaboration features beyond git-based awareness

### MVP Technical Constraint

**Git + Claude Code only.** The MVP integrates exclusively with git (for spec tracking, change detection, and drift analysis) and Claude Code (as the agent runtime). This constraint keeps scope tight and delivers a complete, polished experience for one stack before expanding.

### The "Aha!" Moment

> "It's so simple to move fast and have a clear vision of what the agent is working on, what it will work on next, how to prevent conflicts, and how to course-correct when I see it doing something wrong — like implementing a bad design or writing tests that don't serve the specs well."

The delight is the **combination of speed and control**: MnM doesn't slow you down to stay aligned — it makes alignment the natural byproduct of working in the environment. The moment a user sees a drift alert that saves them from a wrong turn, or launches three agents from specs in seconds and watches them all tracked in one view, they understand why this exists.

---

## Technical Foundation

- **Rust + GPUI**: GPU-accelerated UI framework (same as Zed), 120+ fps rendering
- **gpui 0.2.2** from crates.io + **gpui-component 0.5.1** for UI components
- **NOT a VSCode fork**: Built from scratch for full architectural control
- **Apache 2.0 License**: GPUI licensing is permissive

---

## Team

- **Tom**: Lead / Product
- **Niko**: Team member
- **TarsaaL**: Team member

---

## Market Timing Insights

- Building for where teams are heading (agentic development), not where they are today
- "Everything in code/git" trend is a major tailwind — specs as code, not specs in separate SaaS tools
- Framework-agnostic approach positions MnM as a unified vision layer, not another opinionated workflow tool

---

---

*Product Brief complete (Steps 1-5). Next: Generate PRD from this Product Brief via BMAD workflow.*
