# Brainstorming Session: Langfuse-Style Distributed Tracing in MnM

**Date:** 2026-03-16
**Objective:** Integrate a Langfuse-style trace view into MnM to visualize agent runs (tool calls, LLM interactions, durations, costs) and feed the context pane with real agent-gathered data.
**Context:** 69/69 B2B stories complete. Roadmap item #4 (Distributed tracing). MnM has existing audit events, LiveEvents, orchestrator state machine, heartbeat_runs. User wants the waterfall tree view from Langfuse (https://langfuse.com/images/docs/tracing-overview.png).

## Techniques Used
1. SCAMPER (creative variations on integration approach)
2. Reverse Brainstorming (how to guarantee failure)
3. Six Thinking Hats (multi-perspective analysis)

---

## Ideas Generated

### Category 1: Integration Approach

- **Build native tracing** in MnM's PostgreSQL with Langfuse-inspired schema (2 tables: `traces`, `observations`)
- **Adapt Langfuse MIT React components** for the waterfall UI instead of building from scratch
- Use Langfuse only as API backend + build custom MnM UI
- Full Langfuse self-hosted deployment (rejected: infra bloat)
- Hybrid: OTEL wire format into MnM's own store (future option, not needed now)
- Agents PUSH traces to MnM via adapter layer (not external collector)

### Category 2: Data Model Design

- Map **heartbeat_run = trace** (agent execution lifecycle IS the trace)
- Map **workflow_instance = session** (groups multiple agent traces)
- Observation types: **span** (tool call, file op), **generation** (LLM call), **event** (point-in-time)
- Add `workflowInstanceId`, `stageId`, `agentId` to traces (MnM-specific, Langfuse can't)
- Add drift/compaction events as first-class observation types
- Store truncated I/O by default, full optionally with TTL cleanup
- Self-referential tree via `parentObservationId`

### Category 3: Context Pane Integration ("Trace as Context")

- **Each observation becomes a context pane node**: tool calls show files read, generations show decisions
- Live knowledge graph: "Agent read schema.ts, understood 5 tables, generated migration"
- Context pane renders trace tree in real-time while agent runs
- Multi-agent context: combine observations from multiple agents in same project
- Context summarization: use existing audit-summarizer pattern for trace summaries
- "What does this agent know?" = aggregation of all its trace observations

### Category 4: UI Components

- **Trace list view**: tabular list with columns (agent, duration, cost, tokens, status, stage)
- **Waterfall/tree detail view**: horizontal time bars showing nested spans (the Langfuse screenshot)
- **Live streaming waterfall**: builds in real-time via LiveEvents WebSocket
- Three sub-views: tree (hierarchical), timeline (gantt), log (concatenated)
- Color coding by observation type (span=blue, generation=purple, event=gray)
- Click-to-expand: full input/output, model params, token usage in detail panel
- Inline cost display per generation and rolled-up per trace

### Category 5: Collection Layer

- **Instrument at adapter layer** (packages/adapters/): each adapter method emits observations
- Add `trace.observation_created` and `trace.created` LiveEvent types
- Parse agent logs for structured data (tool calls, file operations)
- ContainerPipeService (CHAT-S03) already pipes stdin/stdout — intercept for trace data
- CompactionWatcher pattern: event-driven + periodic for trace enrichment

### Category 6: Analytics & Advanced Features

- Cost analytics: per-agent, per-project, per-company breakdown from generation observations
- Agent comparison: same task, different agents, compare trace waterfall side-by-side
- Trace-based drift detection: compare actual trace against expected workflow template
- Multi-agent trace correlation via A2A bus message linking
- Trace replay: recorded traces replayed step-by-step for training/review
- Alerting: configurable thresholds on cost, duration, error rate

---

## Key Insights

### Insight 1: Build Native, Inspired by Langfuse
**Description:** Add 2 tables (traces + observations) to MnM's PostgreSQL, instrument adapters, build React waterfall UI. Don't deploy Langfuse.
**Source:** SCAMPER (Substitute, Eliminate) + Reverse Brainstorming + Six Hats
**Impact:** High | **Effort:** Medium
**Why it matters:** MnM has 80% of the infrastructure. Full control means workflow stages, drift, and compaction are first-class concepts. Zero new infra dependencies.

### Insight 2: "Trace as Context" is the Killer Feature
**Description:** Each trace observation becomes a node in the context pane. The context pane shows what agents actually read, decided, and produced — in real-time.
**Source:** SCAMPER (Put to other uses) + Six Hats (Green/Red)
**Impact:** Very High | **Effort:** Medium
**Why it matters:** Transforms MnM from monitoring dashboard to comprehension interface. No competitor does this.

### Insight 3: Adapt Langfuse's MIT React Components
**Description:** Fork/adapt Langfuse's trace tree + timeline React components. Restyle for MnM, wire to MnM's API.
**Source:** Reverse Brainstorming + Six Hats (Green)
**Impact:** High | **Effort:** Low-Medium
**Why it matters:** Saves weeks of complex UI work. MIT license allows this.

### Insight 4: Instrument at the Adapter Layer
**Description:** packages/adapters/ (claude-local, cursor-local) is the natural instrumentation point. Each adapter method emits observations.
**Source:** SCAMPER (Reverse) + Reverse Brainstorming
**Impact:** High | **Effort:** Medium
**Why it matters:** All agents automatically get traced. Single integration point.

### Insight 5: Stream Live via Existing LiveEvents
**Description:** Add `trace.observation_created` to LiveEventTypes. Waterfall builds live as agent runs. Existing WebSocket infra, zero new transport.
**Source:** SCAMPER (Combine) + Reverse Brainstorming + Six Hats (Red)
**Impact:** High | **Effort:** Low
**Why it matters:** Demo wow-moment. No polling, no refresh. Watch the execution tree grow.

---

## Statistics
- Total ideas: 32
- Categories: 6
- Key insights: 5
- Techniques applied: 3

## Recommended Approach

**Option C: Native MnM Tracing** with Langfuse-inspired data model and adapted React components.

### Implementation Phases

**Phase 1 — Data Model + Collection (1 week)**
- 2 new tables: `traces`, `observations` (Langfuse-inspired schema)
- Trace service: create, list, getById, addObservation
- Adapter instrumentation: emit observations from claude-local adapter
- 2 new LiveEvent types: `trace.created`, `trace.observation_created`

**Phase 2 — Trace List UI (3-4 days)**
- Trace list page with filters (agent, project, stage, date range, cost)
- Basic trace detail: tree view of observations
- API client + React Query hooks

**Phase 3 — Waterfall UI (1 week)**
- Adapted waterfall/timeline component (from Langfuse OSS or built with visx/d3)
- Live streaming: waterfall builds in real-time via LiveEvents
- Click-to-expand observation details (input/output, tokens, cost, duration)

**Phase 4 — Context Pane Integration (1 week)**
- Feed context pane with trace observations
- "What does this agent know?" aggregation view
- Multi-agent context merge for project-level view

### Comparison Table

| | Option A: Full Langfuse | Option B: API Bridge | **Option C: Native** |
|---|---|---|---|
| New infra | ClickHouse+Postgres+Redis | Same as A | **None** |
| Context pane | API bridge needed | Latent | **Direct, real-time** |
| Workflow concepts | Can't model | Manual mapping | **First-class** |
| Live streaming | Separate SSE | API polling | **Existing WebSocket** |
| UI control | None/iframe | Full | **Full** |
| Maintenance | External dep | Dual | **Single codebase** |

## Recommended Next Steps

1. Run `/bmad:architecture` or `/bmad:tech-spec` to design the trace data model and API
2. Evaluate Langfuse's React trace components for extraction feasibility
3. Prototype the adapter instrumentation with claude-local

---

*Generated by BMAD Method v6 - Creative Intelligence*
