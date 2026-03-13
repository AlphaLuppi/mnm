# Synthèse : Comment MnM va orchestrer les agents

**Date :** 2026-02-19  
**Pour :** Tom — lecture matinale ☕  
**Sources :** Atlas research + doc OpenClaw + doc Claude Code Teams

---

## TL;DR (30 secondes)

1. **OpenClaw** track les agents via sessions isolées + système "announce" push-based (pas de polling)
2. **Claude Code Teams** utilise une **shared task list** (fichier JSON + file locking) pour la coordination
3. **Pour MnM** : on peut soit wrapper OpenClaw, soit implémenter notre propre orchestration
4. **Recommandation POC** : WebSocket pour control/events + SSE pour logs streaming

---

## 1. Comment OpenClaw sait le status des agents

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GATEWAY                           │
│  (un seul process Node.js, port 18789)              │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                │
│  │   Session    │  │   Session    │                │
│  │   main       │  │   subagent   │                │
│  │              │  │   :uuid      │                │
│  └──────────────┘  └──────────────┘                │
│         ▲                  │                        │
│         │    "announce"    │                        │
│         └──────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

### Le flow

```
1. Tu appelles sessions_spawn({ task: "...", agentId: "atlas" })

2. OpenClaw retourne IMMÉDIATEMENT :
   {
     status: "accepted",  // PAS "completed" — juste lancé
     runId: "abc-123",
     childSessionKey: "agent:atlas:subagent:abc-123"
   }

3. Le subagent tourne dans sa propre session (isolé)

4. Quand il termine, il "announce" au parent :
   [System Message] A subagent task "..." just completed.
   Status: success | error | timeout
   Result: <résumé du travail>

5. Le status vient du RUNTIME, pas du texte :
   - Process crash → error
   - Timeout atteint → timeout  
   - Fin normale → success
```

### APIs disponibles

| Commande | Usage |
|----------|-------|
| `sessions_spawn` | Lancer un subagent |
| `sessions_list` | Lister les sessions actives |
| `sessions_history` | Historique d'une session |
| `/subagents info <id>` | Status détaillé |
| `/subagents log <id>` | Logs du subagent |
| `/subagents kill <id>` | Arrêter un subagent |

### WebSocket events

OpenClaw émet des events en temps réel sur le WebSocket :

```typescript
// Event quand un agent démarre/progresse/termine
{
  type: "event",
  event: "agent",
  payload: {
    runId: "abc-123",
    stream: "lifecycle",  // ou "assistant" ou "tool"
    phase: "start" | "end" | "error",
    content?: "...",
    error?: "..."
  }
}
```

**Point clé** : C'est **push-based**. Pas besoin de poll. Le Gateway push les events.

---

## 2. Comment Claude Code Teams fonctionne

### Architecture

```
┌──────────────────────────────────────────────────┐
│              SHARED TASK LIST                     │
│         (fichier JSON + file locking)             │
│                                                   │
│  { "tasks": [                                    │
│    { "id": 1, "title": "Research", "status": "in_progress", "owner": "A" },
│    { "id": 2, "title": "Code", "status": "pending", "depends": [1] },
│    { "id": 3, "title": "Test", "status": "pending", "depends": [2] }
│  ]}                                              │
└──────────────────────────────────────────────────┘
        ↓           ↓           ↓
   Teammate A   Teammate B   Teammate C
   (session)    (session)    (session)
        ↕    messaging direct    ↕
```

### Mécanismes clés

| Feature | Comment |
|---------|---------|
| **Task claiming** | File locking pour éviter 2 agents sur la même tâche |
| **Dependencies** | Task B ne peut pas être claimée tant que Task A n'est pas done |
| **Inter-agent messaging** | Les teammates s'envoient des messages directement |
| **Plan approval** | Le lead peut exiger un plan avant que l'agent implémente |
| **Hooks** | `TeammateIdle`, `TaskCompleted` pour intercepter les events |

### Display modes

- **In-process** : Tous les agents dans le même terminal. Shift+Down pour cycler.
- **Split-panes** : Chaque agent a son propre pane (tmux ou iTerm2).

### Différence avec subagents

| | Subagents | Agent Teams |
|---|-----------|-------------|
| Communication | Vers parent only | Entre eux directement |
| Coordination | Parent gère tout | Shared task list, self-coordination |
| Context | Propre context, résumé au parent | Propre context, totalement indépendant |
| Best for | Tâches focales | Travail collaboratif |

---

## 3. Pattern temps réel recommandé pour MnM

### Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│                      MnM Frontend (React)                    │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ WebSocket Client │  │   SSE Client     │                │
│  │ (control/events) │  │   (logs stream)  │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
└───────────┼─────────────────────┼───────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────────────────────────────────────────────┐
│                      MnM Backend                           │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Event     │  │   Task      │  │   Agent     │       │
│  │   Bus       │  │   Queue     │  │   Manager   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│         │                │                │               │
│         └────────────────┼────────────────┘               │
│                          │                                │
│                          ▼                                │
│               ┌─────────────────┐                         │
│               │   Agent Runner  │                         │
│               │  (subprocess)   │                         │
│               └─────────────────┘                         │
│                          │                                │
└──────────────────────────┼────────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │   OpenClaw Gateway           │
            │   (ou Claude Code CLI)       │
            └──────────────────────────────┘
```

### Pourquoi WebSocket + SSE ?

| Canal | Usage | Pourquoi |
|-------|-------|----------|
| **WebSocket** | Control plane : start/stop/pause, status events | Bidirectionnel, latence minimale |
| **SSE** | Logs streaming (stdout/stderr) | Unidirectionnel, simple, reconnexion auto |
| **REST** | CRUD : workflows, configs | Standard, cacheable |

### Exemple events

```typescript
// WebSocket events
{ type: "agent.started", agentId: "dev-1", taskId: "task-42" }
{ type: "agent.progress", agentId: "dev-1", step: 3, total: 5 }
{ type: "agent.completed", agentId: "dev-1", status: "success" }
{ type: "agent.error", agentId: "dev-1", error: "Rate limited" }
{ type: "task.claimed", taskId: "task-42", agentId: "dev-1" }

// SSE stream (logs)
data: {"level":"info","msg":"Reading file src/index.ts","ts":1708383600}
data: {"level":"info","msg":"Analyzing code...","ts":1708383601}
data: {"level":"tool","name":"edit","file":"src/index.ts","ts":1708383602}
```

---

## 4. Comment le LLM comprend et modifie les workflows

### Format workflow (JSON schema strict)

```json
{
  "id": "workflow-123",
  "name": "BMAD Pipeline",
  "steps": [
    {
      "id": "research",
      "agent": "atlas",
      "model": "claude-sonnet",
      "prompt": "prompts/research.md",
      "tools": ["web_search", "read"],
      "outputs": ["research_notes"]
    },
    {
      "id": "architect",
      "agent": "daedalus", 
      "model": "claude-opus",
      "prompt": "prompts/architect.md",
      "depends_on": ["research"],
      "inputs": ["research_notes"],
      "outputs": ["architecture_doc"]
    },
    {
      "id": "dev",
      "agent": "hephaestos",
      "model": "codex",
      "prompt": "prompts/dev.md",
      "depends_on": ["architect"],
      "inputs": ["architecture_doc"],
      "file_scope": ["src/"]
    }
  ]
}
```

### Le LLM modifie via function calling

```typescript
// Tools exposés au LLM chat
const workflowTools = [
  {
    name: "add_workflow_step",
    parameters: {
      id: "string",
      agent: "string",
      model: "string",
      after: "string",  // step ID
      prompt: "string"
    }
  },
  {
    name: "modify_workflow_step",
    parameters: {
      stepId: "string",
      changes: {
        model?: "string",
        prompt?: "string",
        tools?: "string[]"
      }
    }
  },
  {
    name: "remove_workflow_step",
    parameters: { stepId: "string" }
  },
  {
    name: "reorder_workflow_steps",
    parameters: { stepIds: "string[]" }
  }
]
```

### Validation avant apply

```
User dit: "Ajoute un reviewer après le dev"
              ↓
LLM génère: add_workflow_step({ id: "review", agent: "reviewer", after: "dev" })
              ↓
MnM valide:
  - Schema OK ?
  - Step "dev" existe ?
  - Pas de cycle créé ?
  - Agent "reviewer" existe ?
              ↓
Si OK → Apply + Refresh viewer
Si KO → Feedback au LLM avec l'erreur
```

---

## 5. Dashboard UX patterns (Temporal, Prefect, etc.)

### Vues validées

| Vue | Usage | Quand |
|-----|-------|-------|
| **Cards** | Overview rapide de N agents | Dashboard principal |
| **Timeline** | Voir les durées et le parallélisme | Debug performance |
| **Graph (DAG)** | Voir les dépendances | Design workflow |
| **Table** | Filtrer/rechercher dans l'historique | Audit |

### Métriques à afficher par agent

```
┌────────────────────────────────────┐
│ 🟢 Héphaestos                      │
│                                    │
│ Task: Implement auth module        │
│ Duration: 5m 34s                   │
│ Tokens: 34,200 (↑12k ↓22k)        │
│ Cost: $0.45                        │
│ Steps: 3/5 ████████░░             │
│ Tools: read(12) edit(8) exec(3)   │
│                                    │
│ [Logs] [Pause] [Cancel]           │
└────────────────────────────────────┘
```

### Logs streaming

```
┌─────────────────────────────────────────────────────┐
│ Logs — Héphaestos                    [Auto-scroll ✓]│
├─────────────────────────────────────────────────────┤
│ 10:32:45 [INFO] Reading src/auth/index.ts          │
│ 10:32:46 [INFO] Analyzing existing code...          │
│ 10:32:48 [TOOL] edit src/auth/index.ts              │
│ 10:32:49 [INFO] Adding JWT validation               │
│ 10:32:51 [TOOL] exec npm test                       │
│ 10:32:55 [WARN] 2 tests failing                     │
│ 10:32:56 [INFO] Fixing test assertions...           │
│ █                                                   │
└─────────────────────────────────────────────────────┘
│ Level: [All ▼]  │ Search: [________]  │ [Export]   │
```

### Couleurs status

| Status | Couleur | Hex |
|--------|---------|-----|
| Running | Bleu | `#3b82f6` |
| Pending | Gris | `#6b7280` |
| Success | Vert | `#22c55e` |
| Error | Rouge | `#ef4444` |
| Paused | Jaune | `#eab308` |
| Cancelled | Gris foncé | `#374151` |

---

## 6. Recommandations pour le POC MnM

### Phase 1 : Proof of Concept

1. **Stack** : Next.js + React + Tailwind + Zustand
2. **Backend** : Node.js simple avec WebSocket (ws) + SQLite
3. **Agent runtime** : Wrapper autour de Claude Code CLI (subprocess)
4. **Pas d'OpenClaw direct** — on simule avec notre propre orchestration

### Phase 2 : Intégration OpenClaw

1. Connecter au Gateway via WebSocket (protocol v3)
2. Utiliser `sessions_spawn` pour les agents
3. Streamer les events `agent` pour les updates UI

### Phase 3 : Multi-provider

1. Adapter pattern : `AgentAdapter` interface
2. Implémentations : OpenClaw, Claude Code CLI, Codex, Aider
3. Config user pour choisir le provider par agent

### Ce qu'on garde simple pour le POC

- **Pas de file locking** — un seul user pour l'instant
- **Pas de persistence** — SQLite local suffit
- **Pas de multi-user** — pas de sync cloud
- **Un seul provider** — Claude Code via subprocess

---

## 7. Questions ouvertes

1. **MnM backend ou serverless ?** — Un backend Node dédié vs Vercel functions
2. **Comment packager ?** — Electron app vs CLI + browser vs pure web
3. **Auth provider** — Local only vs sync cloud optionnel
4. **Pricing model** — BYOK (bring your own key) vs hosted

---

## Sources

### Documentation lue

- `/opt/homebrew/lib/node_modules/openclaw/docs/` (gateway, protocol, multi-agent, sessions)
- https://code.claude.com/docs/en/agent-teams (Claude Code Teams)
- Atlas research : `_research/openclaw-deep-dive.md`
- Atlas research : `_research/realtime-workflows.md`
- Atlas research : `_research/dashboard-ux-patterns.md`
- Atlas research : `_research/llm-workflow-control.md`

### Outils référencés

- Temporal UI (workflow orchestration dashboard)
- Prefect UI (data pipeline dashboard)
- n8n (visual workflow builder)
- React Flow (graph visualization)

---

*Bonne lecture ! ☕*
