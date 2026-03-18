# Tech Spec — MnM Observability Suite

> **Date** : 2026-03-18 | **Version** : 1.0
> **Scope** : Level 1 (~12 stories) | **Effort** : ~48h (~6 jours dev)
> **Sources** : Langfuse codebase analysis, user vision (10 memory files), Bronze→Silver→Gold pipeline (PIPE-01 to PIPE-06)
> **Prerequisite** : Bronze capture working (2530 obs), Silver phases done, Gold engine done (deterministic + claude -p)

---

## 1. Problem

MnM a un pipeline Bronze→Silver→Gold fonctionnel mais l'UI est nulle :
- Des **accordéons** au lieu d'une **timeline** — impossible de voir temporalité, parallélisme, bottlenecks
- Pas de **tree view** — impossible de naviguer dans 200+ observations
- Pas de **detail panel** — impossible de voir Input/Output/Scores sans quitter la page
- Pas de **agent graph** — impossible de visualiser les workflows multi-agent
- Pas de **live streaming** — traces visibles seulement après completion
- Le **bronze parse mal** le format stream-json (tool calls dans `assistant.message.content[]`, pas top-level)
- Le **gold est en "deterministic-fallback"** — jamais testé avec Haiku réel

## 2. Solution — Layout Principal

Inspiration Langfuse mais avec Gold→Silver→Bronze en plus.

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: Trace name | Status | Duration | Cost | Tokens | Gold  │
├──────────────────┬───────────────────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL                                  │
│  (resizable)     │  (resizable)                                  │
│                  │                                               │
│  Toggle:         │  Tabs:                                        │
│  [Tree] [Gantt]  │  [Gold] [Input/Output] [Scores] [Metadata]   │
│  [Graph]         │                                               │
│                  │                                               │
│  Tree:           │  Gold (phase selected):                       │
│  ▶ COMPREHENSION │  ┌────────────────────────────────┐           │
│    ├ tool:Read   │  │ ✓ Success | Score: 95          │           │
│    ├ tool:Read   │  │ "Fixed the security vuln..."   │           │
│    └ tool:Grep   │  │ AC-1: Met | AC-2: Met         │           │
│  ▶ IMPLEMENTATION│  └────────────────────────────────┘           │
│    ├ tool:Edit   │                                               │
│    └ tool:Edit   │  I/O (observation selected):                  │
│  ▶ VERIFICATION  │  ┌────────────────────────────────┐           │
│    └ tool:Bash   │  │ [Formatted] [JSON] [Raw]       │           │
│                  │  │ file: src/auth/login.ts         │           │
│  Gantt:          │  │ output: { lines: 245 }          │           │
│  ██████░░░░░░░░  │  └────────────────────────────────┘           │
│  ░░░░████████░░  │                                               │
│  ░░░░░░░░░░████  │                                               │
├──────────────────┴───────────────────────────────────────────────┤
│  Legend | Zoom | Display prefs                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Left Panel — 3 views

**Tree View** (DEFAULT) — Langfuse-style indented tree
- Observations groupées par phases silver
- Gold annotations sur les phase nodes
- Click → detail panel droit
- TanStack Virtual pour 200+ obs
- Icônes par type (📖 Read, ✏️ Edit, ⚡ Bash, 💭 Think)
- Heatmap couleur cost/duration

**Timeline View** (Gantt) — amélioration de TraceTimeline v1
- Barres horizontales proportionnelles
- Scroll synchronisé avec le tree
- Click barre → detail panel

**Graph View** (Workflow multi-agent) — NEW
- Agents comme nodes, handoffs comme edges
- vis-network ou reactflow
- Click agent → filtre ses traces
- Critical path highlighted

### Right Panel — Detail tabs

**Gold Tab** (default pour phases) : verdict, annotation, score, AC status
**I/O Tab** (default pour observations) : Formatted/JSON/Raw toggle, copy button
**Scores Tab** : phase scores grid, cost breakdown
**Metadata Tab** : model, timestamps, tool IDs, session

## 3. Requirements

| # | Requirement | Priority |
|---|------------|----------|
| R1 | Fix bronze — parse `assistant.message.content[]` blocks | P0 |
| R2 | Tree view avec phase grouping, expand/collapse, icons | P0 |
| R3 | Resizable split layout (left + right panels) | P0 |
| R4 | Detail panel avec tabs Gold/IO/Scores/Meta | P0 |
| R5 | Timeline Gantt upgrade (virtualized, sync scroll) | P0 |
| R6 | Gold avec Haiku via `claude -p` (pas fallback) | P0 |
| R7 | Agent graph view (workflow multi-agent) | P1 |
| R8 | Live streaming WebSocket | P1 |
| R9 | Heatmap cost/duration sur tree nodes | P1 |
| R10 | Intégration dans RunDetail | P1 |
| R11 | Gold prompts management UI | P2 |

**Out of scope** : Trace replay, export CSV, alerting, multi-tenant dashboards

## 4. Architecture Composants

```
TracePage (React Query fetch)
  → TraceProviders
    → TraceDataProvider     (tree building itératif, nodeMap)
    → SelectionProvider     (selected node, collapsed, URL sync)
    → ViewPreferencesProvider (active view, display opts)
  → TraceLayout (react-resizable-panels)
    → LEFT: TraceLeftPanel
      → ViewToggle [Tree | Gantt | Graph]
      → TraceTreeView       (TanStack Virtual, indented, phase groups)
      → TraceTimeline        (Gantt bars — EXISTING, upgrade)
      → TraceGraphView       (vis-network/reactflow — NEW)
    → RIGHT: TraceDetailPanel
      → TabBar [Gold | I/O | Scores | Meta]
      → GoldDetailTab       (verdict, annotation, AC)
      → IODetailTab          (Formatted/JSON/Raw)
      → ScoresDetailTab      (phase scores grid)
      → MetaDetailTab        (timestamps, model, IDs)
```

### Tree Building (Langfuse pattern, adapté)

```typescript
// Itératif, O(N), supporte 10k+ depth
function buildTraceTree(observations, phases) {
  // 1. Map parent-child via parentObservationId
  // 2. Inject phase group nodes as virtual parents
  // 3. Topological sort bottom-up (cost aggregation)
  // 4. Return { roots, nodeMap, flatList }
}
```

### Timeline Math (Langfuse pattern)

```typescript
startOffset = (timeFromStart / totalScaleSpan) * scaleWidth
itemWidth = (duration / totalScaleSpan) * scaleWidth
```

## 5. Stories

| # | Story | Description | Effort | Depends |
|---|-------|-------------|--------|---------|
| **OBS-01** | Fix bronze content block parsing | Parse `assistant.message.content[]` pour tool_use/thinking/text. Test avec vrai `claude -p` stream-json. | S (3h) | — |
| **OBS-02** | TraceDataProvider + tree building | Context itératif, nodeMap O(1), cost aggregation, phase group nodes. | M (4h) | OBS-01 |
| **OBS-03** | Selection + ViewPreferences providers | Selected node, collapsed set, active view, URL sync. | S (2h) | — |
| **OBS-04** | Resizable split layout | react-resizable-panels, mobile tabs fallback, persist sizes. | S (2h) | — |
| **OBS-05** | Tree view component | Indented tree, phase headers, icons, heatmap, click-to-select. TanStack Virtual. | L (8h) | OBS-02, OBS-03 |
| **OBS-06** | Timeline Gantt upgrade | Virtualiser, sync scroll, heatmap, click→detail panel. | M (4h) | OBS-02, OBS-03 |
| **OBS-07** | Detail panel — IO tab | Formatted/JSON/Raw toggle, CodeMirror, copy button. | M (5h) | OBS-04 |
| **OBS-08** | Detail panel — Gold tab | Verdict, annotation, score bar, AC cards. Reuse GoldVerdictBanner. | M (4h) | OBS-04 |
| **OBS-09** | Gold Haiku E2E | Test gold `claude -p --model haiku` sur vraies traces. Fix JSON parsing. | M (4h) | OBS-01 |
| **OBS-10** | Agent graph view | vis-network ou reactflow. Workflow nodes, handoff edges. Click→filtre. | L (6h) | OBS-02 |
| **OBS-11** | Live streaming | LiveEvents WebSocket → providers. New obs apparaissent live. | M (4h) | OBS-05 |
| **OBS-12** | QC Chrome verification | Vrai agent run, bronze→silver→gold→UI. Screenshot chaque étape. | S (2h) | ALL |

**Effort total** : ~48h (~6 jours dev)

### Ordre

```
OBS-01 (fix bronze) ──→ OBS-09 (haiku gold)
         │
         ├──→ OBS-02 (tree provider) ──→ OBS-05 (tree view) ──→ OBS-11 (live)
         │                    │
OBS-03 ──┤              OBS-06 (gantt upgrade)
         │
OBS-04 ──┼──→ OBS-07 (IO tab)
         │
         ├──→ OBS-08 (gold tab)
         │
         └──→ OBS-10 (graph view)
                    │
              OBS-12 (QC final)
```

## 6. Acceptance Criteria

- [ ] Bronze parse les `assistant.message.content[]` blocks correctement
- [ ] Split layout resizable (left tree/timeline, right detail)
- [ ] Tree view avec phases silver, expand/collapse, 200+ obs performant
- [ ] Click node → detail panel avec Gold/IO/Scores/Meta tabs
- [ ] Gantt barres proportionnelles, virtualized, sync scroll
- [ ] IO tab : Formatted/JSON/Raw toggle avec CodeMirror
- [ ] Gold tab : verdict, annotation, relevance score, AC status
- [ ] Gold enrichment avec Haiku (pas "deterministic-fallback")
- [ ] Graph view multi-agent (nodes = agents, edges = handoffs)
- [ ] Live streaming WebSocket pendant l'exécution
- [ ] Screenshot Chrome de chaque feature sur vraies données
- [ ] <2s load pour 200+ observations

## 7. Risques

| Risque | Mitigation |
|--------|------------|
| vis-network trop lourd | Alternative: reactflow (SVG, léger) ou dagre |
| `claude -p` timeout Docker | 90s timeout + fallback deterministic |
| 200+ obs slow tree build | Itératif O(N), pre-compute pendant fetch |
| Content block parsing complexe | Format bien documenté, tests unitaires |
| Split panels + virtual = CSS bugs | Test 375px/768px/1024px/1440px |

---

*Tech Spec Observability Suite v1.0 — 12 stories, ~48h. Langfuse-inspired + Bronze→Silver→Gold unique.*
