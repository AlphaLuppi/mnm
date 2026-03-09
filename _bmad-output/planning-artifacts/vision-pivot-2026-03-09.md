# MnM Vision Pivot — March 2026

*Date: 2026-03-09*
*Author: Tom (Seeyko) + Main (assistant)*
*Status: Vision Draft — Pre-implementation*

---

## Context: Why This Pivot

MnM v1 was built from scratch in Rust/GPUI, then pivoted to Next.js. The core problems were:

1. **Agent spawning was painful** — no reliable way to launch Claude/Codex/Cursor from the UI
2. **No context recovery** — agents lost their state between runs, couldn't resume where they left off
3. **No stage awareness** — impossible to know which spec/stage an agent was working on
4. **Workflow execution was manual** — BMAD workflows had to be kicked off via CLI, no visual pipeline
5. **Building orchestration from scratch took forever** — reinventing queue management, session persistence, cost tracking

### The Discovery: Paperclip

[Paperclip](https://github.com/paperclipai/paperclip) is an open-source "orchestration for zero-human companies" — a Node.js server + React UI that solves the exact plumbing problems MnM struggled with:

- **8 agent adapters** (Claude, Codex, Cursor, OpenClaw, OpenCode, Pi, Process, HTTP)
- **Heartbeat engine** with queue, concurrency control, coalescing
- **Session persistence** across runs (`agentTaskSessions`)
- **Real-time streaming** via WebSocket (live logs, status updates)
- **Cost tracking** per agent/run/model
- **Embedded Postgres** (zero-config database)

### The Opportunity

**Fork Paperclip's backend. Build MnM's unique value on top.**

Paperclip = "task manager for agents" (operational orchestration)
MnM = "product-aware agent orchestrator" (semantic orchestration)

The gap nobody fills: **understanding whether agents are working on the right thing, not just tracking that they're working.**

---

## New Vision: MnM = BMAD with a UI + Drift Detection + Auto-orchestration

### One-liner
**MnM is a spec-driven development environment that orchestrates AI agents through structured workflows, with built-in drift detection and automatic stage transitions.**

### Core Insight
BMAD-style frameworks are powerful but friction-heavy (CLI commands, manual tracking). Paperclip-style tools manage agents but don't understand the product context. MnM combines both: **structured workflows with intelligent agent orchestration**.

---

## Architecture: Paperclip Fork + MnM Layer

### What We Keep from Paperclip (backend engine)

```
server/src/
├── adapters/          ← Agent runtime adapters (Claude, Codex, Cursor, etc.)
│   ├── registry.ts    ← Unified adapter interface
│   ├── process/       ← Generic subprocess adapter
│   └── http/          ← Webhook adapter
├── services/
│   ├── heartbeat.ts   ← Queue, scheduling, execution engine
│   ├── agents.ts      ← Agent CRUD + lifecycle
│   ├── issues.ts      ← Task management (we'll extend this)
│   ├── goals.ts       ← Goal hierarchy (we'll repurpose)
│   ├── costs.ts       ← Cost tracking per agent/run
│   ├── live-events.ts ← WebSocket real-time pub/sub
│   └── secrets.ts     ← Encrypted secrets management
├── realtime/          ← WebSocket server
├── storage/           ← File storage (local + S3)
└── auth/              ← Authentication
```

### What We Add (MnM layer)

```
server/src/
├── services/
│   ├── workflows.ts       ← NEW: Workflow template engine
│   ├── stages.ts          ← NEW: Stage lifecycle management
│   ├── specs.ts           ← NEW: Spec document parsing/indexing
│   ├── drift.ts           ← NEW: LLM-powered drift detection
│   ├── onboarding.ts      ← NEW: Conversational workflow setup
│   └── transitions.ts     ← NEW: Automatic stage transitions
├── routes/
│   ├── workflows.ts       ← NEW: Workflow API endpoints
│   ├── stages.ts          ← NEW: Stage API endpoints
│   ├── specs.ts           ← NEW: Spec document endpoints
│   └── drift.ts           ← NEW: Drift detection endpoints
```

### What We Rewrite (UI)

```
ui/src/
├── pages/
│   ├── Pipeline.tsx        ← Workflow pipeline view (replaces Issues)
│   ├── SpecViewer.tsx      ← Interactive spec documents
│   ├── DriftAlerts.tsx     ← Drift detection dashboard
│   ├── WorkflowEditor.tsx  ← Visual workflow builder
│   ├── Chat.tsx            ← Conversational interface
│   ├── Agents.tsx          ← Keep from Paperclip (enhanced)
│   └── Costs.tsx           ← Keep from Paperclip
├── components/
│   ├── StageCard.tsx       ← Stage status with live run info
│   ├── DriftBadge.tsx      ← Inline drift warnings
│   ├── LiveRunWidget.tsx   ← Keep from Paperclip
│   └── WorkflowCanvas.tsx  ← Visual pipeline editor
```

---

## Core Feature: Workflow Engine

### Concept: Workflow Template

A workflow template defines the development methodology. MnM ships with a default (BMAD-inspired) but users can customize during onboarding.

```typescript
interface WorkflowTemplate {
  id: string;
  name: string;                    // e.g., "BMAD Standard", "Lean Sprint"
  description: string;
  stages: WorkflowStageTemplate[];
  isDefault: boolean;
  createdFrom: "builtin" | "onboarding" | "custom";
}

interface WorkflowStageTemplate {
  order: number;
  name: string;                    // e.g., "Product Brief", "PRD", "Architecture"
  type: StageType;                 // "spec" | "development" | "testing" | "review" | "deploy"
  defaultAgentRole: string;        // e.g., "product_analyst", "architect", "developer"
  inputArtifacts: string[];        // What this stage needs from previous stages
  outputArtifacts: string[];       // What this stage produces
  acceptanceCriteria: string[];    // How to know it's done
  transitionMode: "auto" | "manual" | "review";  // How to move to next stage
  driftCheckEnabled: boolean;      // Run drift detection after this stage?
}
```

### Default Workflow: BMAD Standard

```
Stage 1: Product Brief
  Agent role: product_analyst
  Output: product-brief.md
  Transition: auto → PRD

Stage 2: PRD (Product Requirements Document)
  Agent role: product_analyst
  Input: product-brief.md
  Output: prd.md
  Transition: review → Architecture
  Drift check: ✅ (PRD vs Brief consistency)

Stage 3: Architecture
  Agent role: architect
  Input: prd.md
  Output: architecture.md
  Transition: review → Stories
  Drift check: ✅ (Architecture vs PRD consistency)

Stage 4: Stories & Epics
  Agent role: product_analyst
  Input: prd.md, architecture.md
  Output: epics.md, stories/*.md
  Transition: auto → Development
  Drift check: ✅ (Stories vs PRD + Architecture)

Stage 5: Development
  Agent role: developer
  Input: stories/*.md, architecture.md
  Output: code changes (git diff)
  Transition: auto → Testing
  Drift check: ✅ (Code vs Stories + Architecture)

Stage 6: Testing
  Agent role: tester
  Input: stories/*.md, code changes
  Output: test results
  Transition: manual → Deploy
  Drift check: ✅ (Tests cover acceptance criteria?)
```

### Workflow Instance

When a user says "build feature X", MnM creates a workflow instance:

```typescript
interface WorkflowInstance {
  id: string;
  templateId: string;
  name: string;                    // "Feature: Dark Mode"
  projectId: string;
  stages: StageInstance[];
  status: "active" | "paused" | "completed" | "failed";
  createdAt: Date;
}

interface StageInstance {
  id: string;
  workflowInstanceId: string;
  templateStageOrder: number;
  name: string;
  agentId: string | null;          // Assigned agent
  status: "pending" | "running" | "review" | "done" | "failed" | "skipped";
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  runIds: string[];                // Paperclip heartbeat run IDs
  driftCheckId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}
```

---

## Core Feature: Onboarding Conversationnel

### First Launch Flow

```
MnM: "Welcome! I see a repo at /path/to/project.
      Let me scan it..."
      
      [Scanning... found: package.json, .claude/, 3 BMAD artifacts]

MnM: "I found:
      - A Next.js project
      - Claude Code configured
      - Existing BMAD artifacts (product-brief.md, prd.md)
      
      How do you want to structure your development?
      
      1. 📋 BMAD Standard (Brief → PRD → Archi → Stories → Dev → Test)
      2. 🏃 Lean Sprint (Backlog → Dev → Test → Ship)
      3. 💬 Let's design a custom workflow together"

User: "1"

MnM: "Great! BMAD Standard it is. Now let's assign agents.
      
      Which coding agent do you use?
      a) Claude Code
      b) Codex
      c) Cursor
      d) Other"

User: "Claude Code"

MnM: "Perfect. For BMAD, I need agents for different roles:
      - Product Analyst (Brief, PRD, Stories)
      - Architect (System Design)
      - Developer (Implementation)
      - Tester (Quality)
      
      With Claude Code, I can use different models per role:
      - Opus for Product + Architecture (needs deep reasoning)
      - Sonnet for Development + Testing (fast, capable)
      
      Sound good?"

User: "yes"

MnM: "Setup complete! Your workflow is ready.
      
      I also found existing BMAD artifacts:
      - product-brief.md ✅
      - prd.md ✅
      
      Want me to import these into a workflow instance?"
```

### Custom Workflow Design (Option 3)

```
MnM: "Let's build your workflow. Tell me about your process.
      What happens first when you start a new feature?"

User: "I usually write a quick spec, then jump into code"

MnM: "OK, so something like:
      1. Quick Spec (short document describing what to build)
      2. Development (implement it)
      3. Review (check the work)
      
      Should I add a testing stage? Or do you test during development?"

User: "Test during dev"

MnM: "Got it. Here's your workflow:
      
      [Quick Spec] → [Development + Tests] → [Review]
      
      For drift detection, I'll check that the code matches the spec
      after development. Sound right?"
```

---

## Core Feature: Drift Detection

### What Gets Checked

| Drift Type | When | What |
|---|---|---|
| **Spec vs Spec** | After each spec stage | PRD contradicts Brief? Stories contradict Architecture? |
| **Code vs Spec** | After development | Does the implementation match the stories? |
| **Cross-document** | On demand | Are all specs internally consistent? |

### How It Works

```typescript
interface DriftCheck {
  id: string;
  workflowInstanceId: string;
  stageId: string;
  type: "spec_vs_spec" | "code_vs_spec" | "cross_document";
  status: "pending" | "running" | "clean" | "drift_detected" | "error";
  sourceDocuments: string[];       // What we're comparing
  targetDocuments: string[];       // Against what
  findings: DriftFinding[];
  llmModel: string;
  llmCostUsd: number;
  checkedAt: Date;
}

interface DriftFinding {
  severity: "info" | "warning" | "critical";
  source: string;                  // "prd.md, line 42"
  target: string;                  // "architecture.md, line 15"
  description: string;             // "PRD specifies SSE but Architecture uses WebSocket"
  suggestedFix: string;
  resolution: "pending" | "accepted" | "rejected" | "auto_fixed";
}
```

---

## Core Feature: Chat-Driven Workflow

### Natural Language → Workflow Actions

```
User: "lance la feature dark mode"

MnM: [Creates WorkflowInstance "Dark Mode"]
     [Assigns Stage 1 (Brief) to Atlas]
     [Starts heartbeat run]
     
     "Workflow 'Dark Mode' created. 
      Atlas is starting the Product Brief now.
      I'll notify you when it's ready for review."

---

User: "where are we on dark mode?"

MnM: "Dark Mode workflow:
      ✅ Brief — done (2h ago)
      ✅ PRD — done (1h ago)  
      🔄 Architecture — Daedalus is working (started 15min ago)
      ⏳ Stories — waiting for Architecture
      ⏳ Development
      ⏳ Testing
      
      ⚠️ 1 drift warning: PRD mentions 'system preference detection' 
         but Brief only mentions manual toggle.
         [View] [Dismiss]"

---

User: "skip architecture, go straight to dev"

MnM: "Are you sure? Skipping Architecture means:
      - No drift check between Architecture and Stories
      - Developer won't have architecture constraints
      
      [Skip anyway] [Keep Architecture]"
```

---

## Database Schema Additions

On top of Paperclip's existing schema:

```sql
-- Workflow templates (methodology definitions)
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stages_json JSONB NOT NULL,         -- WorkflowStageTemplate[]
  is_default BOOLEAN DEFAULT false,
  created_from VARCHAR(50),            -- "builtin" | "onboarding" | "custom"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow instances (active workflows for features/projects)
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),
  template_id UUID NOT NULL REFERENCES workflow_templates(id),
  name VARCHAR(255) NOT NULL,          -- "Feature: Dark Mode"
  status VARCHAR(50) DEFAULT 'active', -- active | paused | completed | failed
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stage instances (individual stages within a workflow)
CREATE TABLE stage_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  stage_order INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  stage_type VARCHAR(50),              -- spec | development | testing | review | deploy
  agent_id UUID REFERENCES agents(id),
  status VARCHAR(50) DEFAULT 'pending',
  input_artifact_ids UUID[],
  output_artifact_ids UUID[],
  acceptance_criteria JSONB,
  transition_mode VARCHAR(20),         -- auto | manual | review
  drift_check_enabled BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Drift checks
CREATE TABLE drift_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  workflow_instance_id UUID REFERENCES workflow_instances(id),
  stage_id UUID REFERENCES stage_instances(id),
  type VARCHAR(50) NOT NULL,           -- spec_vs_spec | code_vs_spec | cross_document
  status VARCHAR(50) DEFAULT 'pending',
  source_documents JSONB,
  target_documents JSONB,
  findings JSONB,                      -- DriftFinding[]
  llm_model VARCHAR(255),
  llm_cost_usd NUMERIC(10,4),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Spec documents (indexed from repo)
CREATE TABLE spec_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),
  file_path VARCHAR(1000) NOT NULL,
  doc_type VARCHAR(50),                -- brief | prd | architecture | story | epic
  title VARCHAR(255),
  content_hash VARCHAR(64),
  last_indexed_at TIMESTAMPTZ,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Implementation Roadmap

### Phase 0: Fork & Setup (Week 1)
- [ ] Fork Paperclip repo
- [ ] Strip Paperclip branding, rename to MnM
- [ ] Verify all existing features work
- [ ] Add MnM database migrations (workflow_templates, stage_instances, etc.)

### Phase 1: Workflow Engine (Weeks 2-3)
- [ ] `workflow_templates` CRUD (built-in BMAD + custom)
- [ ] `workflow_instances` lifecycle (create, pause, complete)
- [ ] `stage_instances` with automatic transitions
- [ ] Wire stages to Paperclip's heartbeat engine (stage complete → wake next agent)
- [ ] Basic pipeline UI (horizontal flow visualization)

### Phase 2: Spec Parsing & Drift Detection (Weeks 4-5)
- [ ] Spec document indexer (scan repo for .md files matching patterns)
- [ ] LLM-powered drift detection service
- [ ] Drift alerts in UI
- [ ] Spec viewer with inline drift warnings

### Phase 3: Onboarding & Chat (Weeks 6-7)
- [ ] Conversational onboarding flow (choose/design workflow)
- [ ] Chat interface for workflow commands ("launch feature X")
- [ ] Natural language → workflow actions
- [ ] Auto-discovery of existing BMAD artifacts

### Phase 4: Polish & Ship (Week 8)
- [ ] Mobile-friendly pipeline view (Tailscale access)
- [ ] Notifications (stage complete, drift detected)
- [ ] Documentation
- [ ] Open source release

---

## Competitive Positioning

| Feature | Paperclip | Cursor/Claude | BMAD CLI | **MnM** |
|---|---|---|---|---|
| Agent orchestration | ✅ | ❌ | ❌ | ✅ (via Paperclip) |
| Multi-agent support | ✅ | ❌ | ❌ | ✅ |
| Workflow templates | ❌ | ❌ | ✅ (CLI only) | ✅ (UI + Chat) |
| Drift detection | ❌ | ❌ | ❌ | ✅ |
| Spec-as-interface | ❌ | ❌ | ❌ | ✅ |
| Visual pipeline | ❌ | ❌ | ❌ | ✅ |
| Onboarding conversation | ❌ | ❌ | ❌ | ✅ |
| Cost tracking | ✅ | ❌ | ❌ | ✅ |
| Chat-driven commands | ❌ | ✅ (single agent) | ❌ | ✅ (multi-agent) |

**MnM's moat: the only tool that combines structured workflows with intelligent agent orchestration and semantic drift detection.**

---

*This document supersedes the original MnM PRD (2026-02-21) and architecture docs.*
*Previous vision (Rust/GPUI native app, then Next.js web app) is archived.*
*New foundation: Paperclip fork with MnM semantic layer.*
