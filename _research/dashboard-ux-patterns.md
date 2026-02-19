# Dashboard UX Patterns — Agent Orchestration UI

**Date:** 2026-02-19  
**Auteur:** Atlas (Subagent Research)

## Résumé Exécutif

- **Views multiples** : Compact (overview), Timeline (durées), Full History (debug) — pattern validé par Temporal
- **Status colors** : Rouge = error, Vert = success, Bleu/Violet = running/pending, Jaune = warning
- **Métriques clés** : Status, duration, tokens utilisés, erreurs, nombre d'outils appelés
- **Logs streaming** : Virtual scrolling + auto-scroll + pause/resume + filtres par level
- **Actions** : Pause/Resume/Cancel doivent être visibles et instantanées

---

## 1. Patterns de Visualisation

### 1.1 Vue Cards (Grid)

Idéal pour overview de plusieurs agents :

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 🟢 Agent Alpha  │  │ 🔵 Agent Beta   │  │ 🔴 Agent Gamma  │
│                 │  │                 │  │                 │
│ Task: Research  │  │ Task: Coding    │  │ Task: Review    │
│ Duration: 2m34s │  │ Duration: 5m12s │  │ Duration: 1m03s │
│ Tokens: 12,450  │  │ Tokens: 34,200  │  │ Tokens: 8,100   │
│                 │  │                 │  │                 │
│ [View] [Stop]   │  │ [View] [Pause]  │  │ [View] [Retry]  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Recommandations :**
- Couleur de bordure/badge = status
- Hover pour plus de détails
- Click pour vue détaillée
- Actions contextuelles selon status

### 1.2 Vue Timeline (Horizontal)

Pattern Temporal - montre la progression temporelle :

```
                Time →
    0s        10s       20s       30s       40s
    │─────────│─────────│─────────│─────────│
    ●━━━━━━━━━●─────────┐
    │ Analyze │         │
    └─────────┘         │
              ●━━━━━━━━━━━━━━━━━●─────────┐
              │    Research     │         │
              └─────────────────┘         │
                                ●━━━━━━━━━●
                                │ Compile │
                                └─────────┘
```

**Caractéristiques :**
- Axe X = temps
- Barres = durée d'exécution
- Couleurs = status
- Zoom in/out
- Hover pour détails

### 1.3 Vue Graphe (DAG)

Pour visualiser les dépendances :

```
        ┌──────────┐
        │  Start   │
        └────┬─────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────┐    ┌──────────┐
│ Research │    │ Validate │
└────┬─────┘    └────┬─────┘
     │               │
     └───────┬───────┘
             ▼
       ┌──────────┐
       │ Compile  │
       └────┬─────┘
             │
             ▼
       ┌──────────┐
       │   End    │
       └──────────┘
```

**Implémentation suggérée :**
- React Flow ou D3.js
- Nodes interactifs
- Edges avec labels conditionnels
- Animation pendant l'exécution

### 1.4 Vue Liste (Table)

Pour filtrer et rechercher :

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Filter: [__________]  Status: [All ▼]  Sort: [Recent ▼]     │
├─────────┬──────────┬─────────┬──────────┬─────────┬────────────┤
│ Status  │ Agent    │ Task    │ Duration │ Tokens  │ Actions    │
├─────────┼──────────┼─────────┼──────────┼─────────┼────────────┤
│ 🟢      │ Alpha    │ Research│ 2m 34s   │ 12,450  │ View       │
│ 🔵      │ Beta     │ Coding  │ 5m 12s   │ 34,200  │ Stop Pause │
│ 🔴      │ Gamma    │ Review  │ 1m 03s   │ 8,100   │ Retry View │
│ ⚪      │ Delta    │ Pending │ -        │ -       │ Start      │
└─────────┴──────────┴─────────┴──────────┴─────────┴────────────┘
```

---

## 2. Métriques à Afficher

### 2.1 Métriques Agent

| Métrique | Description | Affichage |
|----------|-------------|-----------|
| **Status** | running/completed/failed/paused | Badge coloré |
| **Duration** | Temps depuis le start | `2m 34s` |
| **Tokens** | Input + Output tokens | `12,450` |
| **Cost** | Coût estimé | `$0.45` |
| **Steps** | Nombre d'étapes exécutées | `5/8` |
| **Tools** | Outils appelés | Liste avec icônes |
| **Errors** | Nombre d'erreurs | Badge rouge |
| **Last Update** | Dernier event | Timestamp relatif |

### 2.2 Métriques Workflow

| Métrique | Description |
|----------|-------------|
| **Total Duration** | Temps total d'exécution |
| **Total Tokens** | Somme de tous les agents |
| **Success Rate** | % de steps réussis |
| **Active Agents** | Nombre d'agents en cours |
| **Pending Tasks** | Tâches en attente |
| **Error Count** | Erreurs totales |

### 2.3 Affichage Token

```typescript
// Component pour afficher les tokens
function TokenDisplay({ input, output, model }: TokenProps) {
  const cost = calculateCost(input, output, model);
  
  return (
    <div className="token-display">
      <span className="input">↓ {formatNumber(input)}</span>
      <span className="output">↑ {formatNumber(output)}</span>
      <span className="total">{formatNumber(input + output)}</span>
      <span className="cost">${cost.toFixed(4)}</span>
    </div>
  );
}
```

---

## 3. Status & Couleurs

### Convention de Couleurs

| Status | Couleur | Hex | Usage |
|--------|---------|-----|-------|
| **Running** | Bleu | `#3B82F6` | Agent actif |
| **Pending** | Violet | `#8B5CF6` | En attente |
| **Completed** | Vert | `#10B981` | Terminé avec succès |
| **Failed** | Rouge | `#EF4444` | Erreur |
| **Paused** | Jaune | `#F59E0B` | En pause |
| **Cancelled** | Gris | `#6B7280` | Annulé |
| **Retrying** | Orange | `#F97316` | Retry en cours |

### Status Badge Component

```tsx
// components/StatusBadge.tsx
const statusConfig = {
  running: { color: 'blue', icon: Spinner, label: 'Running' },
  pending: { color: 'purple', icon: Clock, label: 'Pending' },
  completed: { color: 'green', icon: Check, label: 'Completed' },
  failed: { color: 'red', icon: X, label: 'Failed' },
  paused: { color: 'yellow', icon: Pause, label: 'Paused' },
  cancelled: { color: 'gray', icon: Ban, label: 'Cancelled' },
  retrying: { color: 'orange', icon: RefreshCw, label: 'Retrying' }
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <span className={`badge badge-${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
```

---

## 4. Log Streaming UI

### 4.1 Virtual Scrolling

Pour des milliers de lignes de logs :

```tsx
// components/LogViewer.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function LogViewer({ logs }: { logs: LogEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24, // Line height
    overscan: 20 // Render 20 extra items
  });
  
  return (
    <div ref={parentRef} className="h-[500px] overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        className="relative"
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <LogLine
            key={virtualRow.key}
            log={logs[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translateY(${virtualRow.start}px)`,
              height: `${virtualRow.size}px`
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### 4.2 Auto-Scroll avec Pause

```tsx
function LogViewerWithAutoScroll({ logs }: { logs: LogEntry[] }) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (autoScroll && !isPaused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, autoScroll, isPaused]);
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };
  
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`btn btn-sm ${isPaused ? 'btn-primary' : 'btn-ghost'}`}
        >
          {isPaused ? <Play /> : <Pause />}
        </button>
        <button
          onClick={() => bottomRef.current?.scrollIntoView()}
          className="btn btn-sm btn-ghost"
        >
          <ArrowDown />
        </button>
      </div>
      
      <div onScroll={handleScroll} className="h-[500px] overflow-auto">
        {logs.map((log, i) => (
          <LogLine key={i} log={log} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

### 4.3 Filtres de Logs

```tsx
function LogFilters({
  level,
  search,
  onLevelChange,
  onSearchChange
}: FilterProps) {
  return (
    <div className="flex gap-4 p-2 bg-gray-100">
      {/* Level filter */}
      <select
        value={level}
        onChange={(e) => onLevelChange(e.target.value)}
        className="select select-sm"
      >
        <option value="all">All Levels</option>
        <option value="error">Errors</option>
        <option value="warn">Warnings</option>
        <option value="info">Info</option>
        <option value="debug">Debug</option>
      </select>
      
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search logs..."
        className="input input-sm flex-1"
      />
      
      {/* Quick filters */}
      <div className="flex gap-1">
        <button className="btn btn-xs">Tool Calls</button>
        <button className="btn btn-xs">LLM</button>
        <button className="btn btn-xs">Errors Only</button>
      </div>
    </div>
  );
}
```

### 4.4 Log Line Component

```tsx
const levelColors = {
  error: 'text-red-500 bg-red-50',
  warn: 'text-yellow-600 bg-yellow-50',
  info: 'text-blue-500',
  debug: 'text-gray-500'
};

function LogLine({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div
      className={`font-mono text-sm ${levelColors[log.level]} hover:bg-gray-50`}
      onClick={() => setExpanded(!expanded)}
    >
      <span className="text-gray-400 mr-2">
        {formatTime(log.timestamp)}
      </span>
      <span className={`font-bold mr-2 ${levelColors[log.level]}`}>
        [{log.level.toUpperCase()}]
      </span>
      <span className="text-gray-600 mr-2">[{log.source}]</span>
      <span>{log.message}</span>
      
      {expanded && log.data && (
        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs">
          {JSON.stringify(log.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

---

## 5. Contrôles Agent (Pause/Resume/Cancel)

### 5.1 Action Buttons

```tsx
function AgentControls({ agent, onAction }: ControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  
  const handleAction = async (action: string) => {
    setLoading(action);
    try {
      await onAction(agent.id, action);
    } finally {
      setLoading(null);
    }
  };
  
  return (
    <div className="flex gap-2">
      {/* Pause/Resume */}
      {agent.status === 'running' && (
        <button
          onClick={() => handleAction('pause')}
          disabled={loading !== null}
          className="btn btn-warning btn-sm"
        >
          {loading === 'pause' ? <Spinner /> : <Pause />}
          Pause
        </button>
      )}
      
      {agent.status === 'paused' && (
        <button
          onClick={() => handleAction('resume')}
          disabled={loading !== null}
          className="btn btn-success btn-sm"
        >
          {loading === 'resume' ? <Spinner /> : <Play />}
          Resume
        </button>
      )}
      
      {/* Stop */}
      {['running', 'paused'].includes(agent.status) && (
        <button
          onClick={() => handleAction('stop')}
          disabled={loading !== null}
          className="btn btn-error btn-sm"
        >
          {loading === 'stop' ? <Spinner /> : <Square />}
          Stop
        </button>
      )}
      
      {/* Retry */}
      {agent.status === 'failed' && (
        <button
          onClick={() => handleAction('retry')}
          disabled={loading !== null}
          className="btn btn-primary btn-sm"
        >
          {loading === 'retry' ? <Spinner /> : <RefreshCw />}
          Retry
        </button>
      )}
    </div>
  );
}
```

### 5.2 Confirmation Dialog

```tsx
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel
}: ConfirmProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <p>{message}</p>
      </DialogContent>
      <DialogActions>
        <button onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`btn btn-${confirmVariant}`}
        >
          {confirmLabel}
        </button>
      </DialogActions>
    </Dialog>
  );
}

// Usage
function StopButton({ agentId, onStop }) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowConfirm(true)}>Stop</button>
      
      <ConfirmDialog
        open={showConfirm}
        title="Stop Agent?"
        message="This will stop the agent immediately. Any unsaved work may be lost."
        confirmLabel="Stop Agent"
        confirmVariant="error"
        onConfirm={() => {
          onStop(agentId);
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
```

---

## 6. Layouts Recommandés

### 6.1 Dashboard Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  MnM Dashboard                    [+ New Workflow]  [Settings]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Summary Cards                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ Active  │ │ Pending │ │ Success │ │ Failed  │               │
│  │   3     │ │   5     │ │   42    │ │   2     │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                  │
│  Recent Workflows                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [List/Cards Toggle]  [Filter▼]  [Sort▼]  [🔍 Search]       │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 🟢 Data Pipeline    | 2m ago   | 45s  | 12,000 tokens      │ │
│  │ 🔵 Code Review      | Running  | 5m   | 34,000 tokens      │ │
│  │ 🔴 API Integration  | Failed   | 3m   | 8,000 tokens       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Workflow Detail

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back   Workflow: Data Pipeline           [Pause] [Stop]      │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                     │
│  Workflow Graph            │  Selected Node: Process Data        │
│                            │                                     │
│       ●─────●              │  Status: Running                    │
│      /       \             │  Duration: 2m 34s                   │
│     ●         ●            │  Tokens: 12,450                     │
│      \       /             │                                     │
│       ●─────●              │  ─────────────────────────────────  │
│                            │                                     │
│  [Compact] [Timeline]      │  Logs                               │
│                            │  ┌───────────────────────────────┐  │
├────────────────────────────┤  │ 10:23:45 [INFO] Starting...   │  │
│                            │  │ 10:23:46 [INFO] Loaded 1000   │  │
│  Agents                    │  │ 10:23:47 [INFO] Processing... │  │
│  ┌──────────────────────┐  │  │ 10:23:48 [WARN] Slow query   │  │
│  │ 🟢 Research Agent    │  │  │ ...                           │  │
│  │ 🔵 Process Agent     │  │  └───────────────────────────────┘  │
│  │ ⚪ Output Agent      │  │                                     │
│  └──────────────────────┘  │                                     │
│                            │                                     │
└────────────────────────────┴────────────────────────────────────┘
```

### 6.3 Agent Detail

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back   Agent: Research Agent                 [Pause] [Stop]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Status      │  │ Duration    │  │ Tokens      │              │
│  │ 🟢 Running  │  │ 2m 34s      │  │ 12,450      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Progress                                                        │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  60%       │
│                                                                  │
│  Tools Called                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✅ web_search (3x)  │ ✅ read_file (2x)  │ 🔵 write_file    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ───────────────────────────────────────────────────────────────│
│                                                                  │
│  Conversation / Logs   [Conversation] [Logs] [Raw]              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 👤 User: Research the latest AI trends                     ││
│  │                                                              ││
│  │ 🤖 Agent: I'll search for recent AI developments...        ││
│  │          [Tool: web_search("AI trends 2026")]               ││
│  │          Found 10 relevant articles...                      ││
│  │                                                              ││
│  │ 🤖 Agent: Based on my research, here are the key trends:   ││
│  │          1. Agent orchestration systems...                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Interactions & Animations

### 7.1 Loading States

```tsx
// Skeleton for loading
function AgentCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded w-16"></div>
        <div className="h-8 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  );
}

// Progress indicator
function ProgressBar({ progress, animated = true }: ProgressProps) {
  return (
    <div className="h-2 bg-gray-200 rounded overflow-hidden">
      <div
        className={`h-full bg-blue-500 transition-all ${
          animated ? 'animate-pulse' : ''
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

### 7.2 Status Transitions

```tsx
// Smooth status transitions
function AnimatedStatus({ status }: { status: AgentStatus }) {
  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
    >
      <StatusBadge status={status} />
    </motion.div>
  );
}
```

### 7.3 Real-Time Updates

```tsx
// Highlight new updates
function HighlightOnUpdate({ children, value }: HighlightProps) {
  const prevValue = usePrevious(value);
  const [highlight, setHighlight] = useState(false);
  
  useEffect(() => {
    if (prevValue !== undefined && value !== prevValue) {
      setHighlight(true);
      setTimeout(() => setHighlight(false), 1000);
    }
  }, [value, prevValue]);
  
  return (
    <span
      className={`transition-colors ${
        highlight ? 'bg-yellow-200' : 'bg-transparent'
      }`}
    >
      {children}
    </span>
  );
}
```

---

## 8. Recommandations pour MnM

### Architecture UI

```
src/
├── components/
│   ├── dashboard/
│   │   ├── SummaryCards.tsx
│   │   ├── WorkflowList.tsx
│   │   └── RecentActivity.tsx
│   ├── workflow/
│   │   ├── WorkflowGraph.tsx
│   │   ├── WorkflowTimeline.tsx
│   │   ├── WorkflowCompact.tsx
│   │   └── WorkflowControls.tsx
│   ├── agent/
│   │   ├── AgentCard.tsx
│   │   ├── AgentDetail.tsx
│   │   ├── AgentControls.tsx
│   │   └── AgentLogs.tsx
│   ├── logs/
│   │   ├── LogViewer.tsx
│   │   ├── LogLine.tsx
│   │   └── LogFilters.tsx
│   └── common/
│       ├── StatusBadge.tsx
│       ├── TokenDisplay.tsx
│       ├── ProgressBar.tsx
│       └── ConfirmDialog.tsx
├── hooks/
│   ├── useWebSocket.ts
│   ├── useAgentStatus.ts
│   └── useLogs.ts
└── lib/
    ├── websocket.ts
    └── api.ts
```

### Tech Stack Suggéré

| Besoin | Technologie |
|--------|-------------|
| **Framework** | React 18+ avec Suspense |
| **State** | Zustand ou Jotai (léger) |
| **Styling** | Tailwind CSS |
| **Components** | Radix UI ou shadcn/ui |
| **Graphe** | React Flow |
| **Virtualisation** | @tanstack/react-virtual |
| **Animations** | Framer Motion |
| **Charts** | Recharts |

### Priorités POC

1. **Phase 1** : Cards + Liste basique + Status
2. **Phase 2** : Log streaming + Contrôles (pause/stop)
3. **Phase 3** : Timeline view
4. **Phase 4** : Graph view + édition visuelle

---

## Sources

- https://docs.temporal.io/web-ui
- https://temporal.io/blog/the-dark-magic-of-workflow-exploration
- https://docs.prefect.io/orchestration/ui/dashboard.html
- https://docs.dagster.io/concepts/webserver/ui
- https://reactflow.dev/
- https://tanstack.com/virtual/latest
