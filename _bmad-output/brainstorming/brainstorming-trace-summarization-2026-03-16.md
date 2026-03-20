# Brainstorming Session: Intelligent Trace Summarization

**Date:** 2026-03-16
**Objective:** Transform 200+ raw tool calls per agent run into readable, user-centric narrative traces with semantic phases, configurable views, and progressive drill-down.
**Context:** MnM receives stream-json from Claude (thinking + tool_use + tool_result). Previous brainstorm designed raw Langfuse-style tracing. User feedback: raw traces are noise, need simplification and user-driven configuration.

## Techniques Used
1. Starbursting — questioned every assumption about who/what/where/when/why/how
2. Mind Mapping — structured the three-layer architecture (Data → Intelligence → Presentation)
3. Reverse Brainstorming — identified 10 anti-patterns and inverted them into design rules

---

## Ideas Generated

### Category 1: Phase Detection

- Use thinking blocks as primary phase boundary signal (regex on intent patterns)
- Fall back to tool pattern clustering for non-thinking agents (3+ Reads = comprehension)
- Use time gaps (>30s) as supplementary boundary signal
- Phase types: COMPREHENSION, IMPLEMENTATION, VERIFICATION, SELF_REVIEW, RESULT, CUSTOM
- Phase detection happens in real-time during stream ingestion, not post-hoc
- Allow manual phase override (user can rename/split/merge phases)
- Probabilistic confidence score per phase boundary (high when thinking-detected, medium when pattern-detected)

### Category 2: Phase Summarization

- Deterministic summarizer: aggregate tool calls ("Read 14 files", "Modified 10 files +847 lines")
- LLM-assisted summarizer: feed thinking blocks to small model for rich one-sentence summary
- Deterministic first, LLM as opt-in upgrade
- Summaries must be SPECIFIC (file names, line counts, test results), never generic
- Structured details per phase type (filesRead[], filesModified[], commands[], decisions[])
- Trace Story Generator: post-completion narrative for the whole trace (one-liner for list view)
- Cache summaries in dedicated table, regenerable

### Category 3: Configurable Views

- Three built-in views: Executive (outcome-first card), Developer (phases), Debug (raw waterfall)
- Default view based on businessRole (RBAC-S03): PM→Executive, Dev→Developer, Admin→Debug
- User can override default + per-trace toggle
- Custom view config: which phases to show, which metrics, expand/collapse, hide thinking, hide reads
- Stored in user preferences (per-company, per-user)
- Detail slider: Executive ◄────●────► Debug

### Category 4: Drill-Down UX

- Progressive disclosure: Executive → Phases → Tool calls → Raw observation
- ALL drill-down is inline expansion, never page navigation
- "Why?" link: every tool call links to the thinking block that motivated it
- Visual weight proportional to user interest: Result and Errors BOLD, Comprehension subdued, Failed phases RED
- Each phase is a collapsible container with summary header

### Category 5: Live Traces

- Phase detection in real-time during agent execution
- Current phase visible with animated "working..." indicator
- Summary generated incrementally (not just post-completion)
- During execution: show current phase + progress estimate
- After completion: show full phase summary with story narrative

### Category 6: Multi-Agent / Workflow

- Story-level aggregation: group traces by workflow instance
- Timeline: "PM spec'd → Dev implemented → QA tested → Review approved"
- Individual agent traces accessible via drill-down from story view
- Cross-agent context: what Agent A produced is shown as input to Agent B

---

## Key Insights

### Insight 1: Thinking Blocks Are the Rosetta Stone
**Description:** Claude's thinking blocks contain explicit intent ("Now I'll implement...") — near-100% confidence phase boundaries without ML.
**Source:** Starbursting + Mind Mapping
**Impact:** Very High | **Effort:** Medium
**Why it matters:** Simple regex-based detection is reliable and fast. For non-thinking agents, tool pattern clustering is the fallback.

### Insight 2: Three-Layer Architecture (Raw → Phases → Story)
**Description:** Store raw observations (Debug), index into phases (Developer), generate narrative (Executive). Independent layers, different audiences.
**Source:** Mind Mapping
**Impact:** Very High | **Effort:** Medium
**Why it matters:** Each layer serves a different role. Improve summarization without changing storage. Phase index is 5-10 rows vs 200+ observations.

### Insight 3: Default View by Role, Not by Feature
**Description:** Use existing businessRole (RBAC-S03) to auto-select trace view depth. CEO→Executive, Dev→Developer, Admin→Debug.
**Source:** Reverse Brainstorm + Starbursting
**Impact:** High | **Effort:** Low
**Why it matters:** Zero-config UX. It just works for each role. Override available.

### Insight 4: "Why?" Link — Actions Trace to Reasoning
**Description:** Every tool call or file change links to the thinking block that motivated it. Click "Why?" → see the reasoning.
**Source:** Reverse Brainstorm + Starbursting
**Impact:** High | **Effort:** Medium
**Why it matters:** This is what makes supervision meaningful — not just WHAT but WHY. No other tool does this.

### Insight 5: Deterministic First, LLM Second
**Description:** Ship deterministic summaries (file counts, test results) immediately. LLM narratives as opt-in upgrade.
**Source:** Mind Mapping + Reverse Brainstorm
**Impact:** Medium | **Effort:** Low
**Why it matters:** Never block UI on LLM generation. Deterministic is instant, free, always available.

### Insight 6: Story-Level Aggregation for Multi-Agent
**Description:** Workflow with 4 agents shows as ONE story timeline, not 4 separate traces.
**Source:** Starbursting + Reverse Brainstorm
**Impact:** High | **Effort:** Medium-High
**Why it matters:** Natural view for PMs tracking story completion. Individual agent traces via drill-down.

---

## Design Rules (from Reverse Brainstorm inversions)

1. Default to Executive view. 3-5 lines max. User opts INTO detail.
2. Human language, not jargon. "Read 14 files to understand auth" not "14 retrieval observations"
3. Phase detection is probabilistic (thinking > patterns > time gaps), not rigid rules
4. Default view by role (businessRole), user can override
5. Live traces show current phase with progress, not blank until completion
6. Multi-agent = one story timeline, not N separate traces
7. Drill-down is inline expansion, never page navigation
8. Summaries must be SPECIFIC (file names, counts, results)
9. Every action has a "Why?" link to reasoning
10. Visual weight: Result/Errors BOLD, Comprehension subdued, Failed RED

---

## Architecture Summary

```
INGESTION (real-time)              INTELLIGENCE (post-trace)          PRESENTATION (per-user)

Claude stream-json                 Phase Summarizer                   Executive View (card)
  → TraceTransformer               → Deterministic: file counts       Developer View (phases)
    → raw observations to DB        → LLM-assisted: narratives        Debug View (waterfall)
    → Phase Detector                                                   Custom View (config)
      → thinking intent regex      Story Generator
      → tool pattern cluster        → whole-trace narrative            Role-based defaults
      → phase boundaries to DB      → one-liner for list view          Progressive drill-down
                                                                       "Why?" links
```

## Data Model Additions

```
trace_phases (NEW)
├── id: uuid PK
├── traceId: uuid FK traces
├── order: integer
├── type: text (comprehension|implementation|verification|review|result|custom)
├── name: text (human-readable, e.g. "Understanding the auth flow")
├── startedAt: timestamptz
├── completedAt: timestamptz
├── durationMs: integer
├── observationCount: integer
├── firstObservationId: uuid FK trace_observations
├── lastObservationId: uuid FK trace_observations
├── thinkingExcerpt: text (the thinking block that started this phase, truncated)
├── createdAt: timestamptz
└── updatedAt: timestamptz

trace_phase_summaries (NEW)
├── id: uuid PK
├── phaseId: uuid FK trace_phases
├── summaryText: text (one-liner)
├── details: jsonb (structured: {filesRead[], filesModified[], commands[], decisions[]})
├── generatedBy: text (deterministic|llm)
├── createdAt: timestamptz
└── updatedAt: timestamptz

user_trace_preferences (NEW — or column in existing user settings)
├── userId: uuid FK
├── defaultView: text (executive|developer|debug)
├── showPhases: text[] (which phase types to show)
├── showMetrics: text[] (cost|tokens|duration|files)
├── expandByDefault: boolean
├── customFilters: jsonb
└── updatedAt: timestamptz
```

## Statistics
- Total ideas: 35
- Categories: 6
- Key insights: 6
- Design rules: 10
- Techniques applied: 3

## Recommended Next Steps

1. Update `epics-scale-trace.md` with revised TRACE stories incorporating phase detection + summarization
2. Run `/bmad:tech-spec` for the Phase Detection Engine specifically
3. Prototype the Developer View UI with mock data to validate the phase UX
4. User research: ask 3-5 potential users "what do you want to see when an agent finishes a task?"

---

*Generated by BMAD Method v6 - Creative Intelligence*
