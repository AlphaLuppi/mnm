---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - planning-artifacts/prd.md
  - planning-artifacts/product-brief-mnm-2026-02-22.md
  - planning-artifacts/technical-research-mnm-2026-02-22.md
workflowType: 'architecture'
project_name: mnm
user_name: Gabri
date: 2026-02-28
---

# Architecture -- MnM IDE

**Auteur :** Gabri / Architecture Technique
**Date :** 2026-02-28
**Statut :** Draft initial (base sur PRD valide + recherche technique + analyse SDK verifiee)

---

## Table des matieres

1. [Vision technique](#1-vision-technique)
2. [Decisions architecturales (ADR)](#2-decisions-architecturales-adr)
3. [Stack technique](#3-stack-technique)
4. [Architecture systeme](#4-architecture-systeme)
5. [Architecture des composants](#5-architecture-des-composants)
6. [Integration Claude Code -- SDK spawn + file watching](#6-integration-claude-code--sdk-spawn--file-watching)
7. [Data flow et event bus](#7-data-flow-et-event-bus)
8. [Modele de donnees](#8-modele-de-donnees)
9. [Architecture UI et layout](#9-architecture-ui-et-layout)
10. [Securite et permissions](#10-securite-et-permissions)
11. [Performance et contraintes](#11-performance-et-contraintes)
12. [Risques techniques et mitigations](#12-risques-techniques-et-mitigations)
13. [Ordre de construction](#13-ordre-de-construction)

---

## 1. Vision technique

MnM est un **cockpit de supervision** pour le developpement agentique. L'architecture est concue autour de trois principes :

1. **Observation sans intrusion** -- MnM observe les agents via les fichiers qu'ils ecrivent sur disque (`~/.claude/`), sans modifier Claude Code ni intercepter ses appels API.
2. **Event-driven** -- Toute l'UI se met a jour par evenements (fichier modifie, message inter-agent, tache creee). Pas de polling.
3. **Local-first** -- Zero serveur distant. Tout tourne en local. La seule connexion internet est pour les appels LLM (drift detection) et le SDK Anthropic.

### Contraintes PRD

- App desktop cross-platform (macOS, Linux, Windows)
- Internet requis (appels LLM + agents Claude)
- Pas de backend serveur, pas de compte utilisateur
- Architecture evenementielle (NFR1 : < 500ms de latence)
- 3 agents monitores simultanement (NFR6, NFR7)
- Open source

---

## 2. Decisions architecturales (ADR)

### ADR-001 : Electron comme runtime desktop

**Contexte :** MnM necessite un acces filesystem complet, process management, et Git natif. L'equipe a des competences web (React/TypeScript).

**Decision :** Electron (derniere version stable).

**Justification :**
- Courbe d'apprentissage minimale vs Tauri (pas de Rust requis)
- Ecosysteme NPM complet (chokidar, simple-git, claude-agent-sdk)
- Precedent VS Code / Cursor pour des IDEs complexes
- Migration Tauri possible a terme si performance insuffisante

**Consequences :** Bundle 150-300 MB, RAM 150-400 MB. Acceptable pour un outil developpeur.

### ADR-002 : SDK spawn + file watching (vs subprocess wrapping)

**Contexte :** MnM doit observer l'activite de N agents Claude Code simultanement, incluant leurs messages inter-agents, taches, et transcriptions.

**Decision :** Lancer les agents via `@anthropic-ai/claude-agent-sdk` et observer leur activite via chokidar sur `~/.claude/`.

**Justification :**
- Agent Teams ecrit TOUT son etat sur disque en temps reel (inboxes JSON, tasks JSON, sessions JSONL)
- Le file watching est non-intrusif (zero modification de Claude Code)
- Le stdout parsing est fragile et ne supporte qu'un agent a la fois
- Le SDK fournit un lifecycle propre (start, stream messages, stop)
- Valide par 5 projets open-source existants (c9watch, clog, claude_code_agent_farm)

**Consequences :** Dependance au format des fichiers `~/.claude/` (non documente officiellement). Necessite une couche de validation (zod) et une veille sur les releases Claude Code.

### ADR-003 : Zustand pour le state management

**Contexte :** L'UI de MnM est pilotee par des evenements temps reel (file changes, messages, tasks) et doit supporter des updates a haute frequence.

**Decision :** Zustand avec des stores separes par domaine.

**Justification :**
- Plus leger que Redux (pas de boilerplate)
- Subscriptions selectrices (un composant ne re-render que quand son slice change)
- Compatible avec les updates haute frequence depuis le main process Electron via IPC
- API simple, TypeScript-native

### ADR-004 : React Flow pour le workflow editor

**Decision :** React Flow + dagre pour le layout automatique.

**Justification :** Voir section 3 de la recherche technique. React-native, nodes personnalisables, edges conditionnels, drag & drop, mini-map, performance (virtualisation).

### ADR-005 : LLM-as-judge pour la drift detection (MVP)

**Decision :** Appels Claude API (mode comparaison) pour detecter les drifts entre documents.

**Justification :** Plus simple a implementer que les embeddings+concepts, plus precis sur les contradictions fines. Cout acceptable (~$1/jour pour 3 utilisateurs). Migration vers l'architecture hybride 3 couches (embeddings + concepts + LLM) possible post-MVP.

### ADR-006 : Architecture IPC stricte main/renderer

**Decision :** Separation stricte main process / renderer process via contextBridge. Aucun acces Node.js depuis le renderer.

**Justification :** Securite (le renderer ne peut pas executer de commandes systeme directement), testabilite (le renderer est un SPA React standard), preparation a une eventuelle migration web.

---

## 3. Stack technique

| Couche | Choix | Version cible | Justification |
|--------|-------|---------------|---------------|
| **Runtime desktop** | Electron | Derniere stable | ADR-001 |
| **Build system** | electron-vite | Derniere stable | Vite rapide + support Electron natif |
| **Frontend** | React 19 + TypeScript | 19.x | Standard, ecosysteme riche |
| **State management** | Zustand | 5.x | ADR-003 |
| **Styling** | Tailwind CSS | 4.x | Utility-first, rapid prototyping |
| **Workflow editor** | React Flow + dagre | Dernieres stables | ADR-004 |
| **Agent SDK** | @anthropic-ai/claude-agent-sdk | Derniere stable | ADR-002 |
| **File watching** | chokidar | 4.x | Standard, FSEvents sur macOS, performant |
| **Git** | simple-git | Derniere stable | API TypeScript complete, git natif |
| **Schema validation** | zod | 3.x | Validation des JSON Claude a l'entree |
| **YAML parsing** | js-yaml | 4.x | Standard, rapide |
| **XML parsing** | fast-xml-parser | 4.x | Performant, bonne API |
| **Markdown parsing** | remark / unified | Dernieres stables | AST Markdown, extraction sections |
| **LLM calls** | Anthropic SDK (@anthropic-ai/sdk) | Derniere stable | Drift detection, extraction concepts |
| **Packaging** | electron-builder | Derniere stable | Cross-platform (dmg, AppImage, exe) |
| **Tests unitaires** | Vitest | Derniere stable | Rapide, compatible Vite |
| **Tests E2E** | Playwright (Electron) | Derniere stable | Support Electron natif |

---

## 4. Architecture systeme

### Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ Agent       │  │ File        │  │ Git                  │ │
│  │ Manager     │  │ Watcher     │  │ Integration          │ │
│  │             │  │ Service     │  │                      │ │
│  │ - SDK spawn │  │ - ~/.claude │  │ - simple-git         │ │
│  │ - lifecycle │  │ - project/  │  │ - status, diff, log  │ │
│  │ - stream    │  │ - debounce  │  │ - file at commit     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘ │
│         │                │                     │             │
│         v                v                     v             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   EVENT BUS (EventEmitter)               │ │
│  │                                                         │ │
│  │  AgentEvent | FileEvent | TaskEvent | MessageEvent |    │ │
│  │  DriftEvent | GitEvent | SessionEvent               │   │ │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │              IPC BRIDGE (contextBridge)               │   │
│  │  preload.ts : expose API typee au renderer           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────┐
│                    ELECTRON RENDERER PROCESS                  │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │              ZUSTAND STORES                          │   │
│  │                                                      │   │
│  │  teamStore | agentStore | taskStore | messageStore | │   │
│  │  fileStore | sessionStore | driftStore | gitStore  | │   │
│  │  uiStore | workflowStore                           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │              REACT UI                                │   │
│  │                                                      │   │
│  │  ┌─────────┐ ┌───────────┐ ┌─────────────────────┐ │   │
│  │  │ Context │ │  Agents   │ │ Tests & Validation  │ │   │
│  │  │ Panel   │ │  Panel    │ │ Panel               │ │   │
│  │  │ (left)  │ │  (center) │ │ (right)             │ │   │
│  │  └─────────┘ └───────────┘ └─────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │            Timeline (bottom)                     │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Separation des responsabilites

| Processus | Responsabilites | Acces |
|-----------|-----------------|-------|
| **Main process** | Agent lifecycle (SDK), file watching (chokidar), Git (simple-git), drift detection (LLM API), event bus | Node.js complet, filesystem, process |
| **Preload** | Exposition d'une API typee (contextBridge), marshalling des evenements | Bridge securise |
| **Renderer** | UI React, state management (Zustand), visualisation (React Flow) | Aucun acces Node.js |

---

## 5. Architecture des composants

### 5.1 Main process -- Services

#### AgentManager

Gere le lifecycle des agents via le Claude Agent SDK.

```typescript
interface AgentManagerAPI {
  // Lifecycle
  spawnAgent(config: AgentSpawnConfig): Promise<AgentHandle>;
  spawnTeam(config: TeamSpawnConfig): Promise<TeamHandle>;
  stopAgent(agentId: string): Promise<void>;
  stopTeam(teamName: string): Promise<void>;

  // Queries
  getActiveAgents(): AgentInfo[];
  getTeamInfo(teamName: string): TeamInfo | null;

  // Events (via event bus)
  // -> agent_started, agent_stopped, agent_error, agent_output
}

interface AgentSpawnConfig {
  prompt: string;
  projectDir: string;
  maxTurns?: number;
  settingSources?: ('project' | 'user')[];
  env?: Record<string, string>;
}

interface TeamSpawnConfig extends AgentSpawnConfig {
  teamName: string;
  // Active Agent Teams via env flag
  // env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" }
}
```

#### ClaudeFileWatcher

Observe les fichiers `~/.claude/` pour extraire l'etat des agents en temps reel.

```typescript
interface ClaudeFileWatcherAPI {
  start(config: WatcherConfig): void;
  stop(): void;

  // Events emis (via event bus) :
  // -> team_config_changed(teamConfig)
  // -> inbox_message(agentName, messages[])
  // -> task_created(task)
  // -> task_updated(task)
  // -> session_entry(sessionId, entry)
}

interface WatcherConfig {
  claudeDir: string;         // ~/.claude
  teamName: string;
  projectDir: string;
  debounceMs?: number;       // defaut: 100
}
```

#### ProjectFileWatcher

Observe les fichiers du projet pour detecter les modifications par les agents.

```typescript
interface ProjectFileWatcherAPI {
  start(projectDir: string): void;
  stop(): void;

  // Events emis :
  // -> project_file_changed(path, type)
  // -> project_file_created(path)
  // -> project_file_deleted(path)
}
```

#### GitService

Acces programmatique a Git via simple-git.

```typescript
interface GitServiceAPI {
  getStatus(): Promise<StatusResult>;
  getFileDiff(filePath: string): Promise<string>;
  getFileHistory(filePath: string, maxCount?: number): Promise<LogResult>;
  getFileAtCommit(filePath: string, commitHash: string): Promise<string>;
  getRecentCommits(count?: number): Promise<LogResult>;
  getBranches(): Promise<BranchSummary>;
}
```

#### DriftDetector

Detection de drift entre documents via LLM-as-judge.

```typescript
interface DriftDetectorAPI {
  // Detection on-demand
  checkDrift(parentDoc: string, childDoc: string): Promise<DriftReport>;

  // Detection automatique (declenchee par file watcher)
  enableAutoDetection(hierarchy: DocumentHierarchy): void;
  disableAutoDetection(): void;

  // Configuration
  setConfidenceThreshold(threshold: number): void; // 0.0 - 1.0
}

interface DriftReport {
  items: DriftItem[];
  overallScore: number;      // 0 = coherent, 1 = drift total
  timestamp: number;
}

interface DriftItem {
  concept: string;
  parentValue: string;
  childValue: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;        // 0.0 - 1.0
  parentLocation: string;    // fichier + section
  childLocation: string;
  suggestion: string;
}
```

### 5.2 IPC Bridge -- Preload

Le preload expose une API typee au renderer via `contextBridge` :

```typescript
// preload.ts
contextBridge.exposeInMainWorld('mnm', {
  // Agents
  agents: {
    spawn: (config: AgentSpawnConfig) => ipcRenderer.invoke('agents:spawn', config),
    spawnTeam: (config: TeamSpawnConfig) => ipcRenderer.invoke('agents:spawnTeam', config),
    stop: (agentId: string) => ipcRenderer.invoke('agents:stop', agentId),
    getActive: () => ipcRenderer.invoke('agents:getActive'),
  },

  // Git
  git: {
    getStatus: () => ipcRenderer.invoke('git:status'),
    getFileDiff: (path: string) => ipcRenderer.invoke('git:fileDiff', path),
    getFileHistory: (path: string) => ipcRenderer.invoke('git:fileHistory', path),
  },

  // Drift
  drift: {
    check: (parent: string, child: string) => ipcRenderer.invoke('drift:check', parent, child),
    setThreshold: (t: number) => ipcRenderer.invoke('drift:setThreshold', t),
  },

  // Event subscriptions (main -> renderer)
  on: (channel: EventChannel, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },
  off: (channel: EventChannel, callback: (data: any) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
```

### 5.3 Renderer -- Zustand stores

Chaque domaine a son propre store. Les stores sont alimentes par les evenements IPC.

```typescript
// stores/agentStore.ts
interface AgentState {
  agents: Map<string, AgentInfo>;
  teamConfig: TeamConfig | null;

  // Actions
  setAgent: (id: string, info: AgentInfo) => void;
  removeAgent: (id: string) => void;
  setTeamConfig: (config: TeamConfig) => void;
}

// stores/taskStore.ts
interface TaskState {
  tasks: Map<string, TaskInfo>;

  setTask: (id: string, task: TaskInfo) => void;
  removeTask: (id: string) => void;
}

// stores/messageStore.ts
interface MessageState {
  inboxes: Map<string, InboxMessage[]>;

  addMessage: (agent: string, message: InboxMessage) => void;
  markRead: (agent: string, index: number) => void;
}

// stores/sessionStore.ts
interface SessionState {
  entries: Map<string, SessionEntry[]>;   // sessionId -> entries

  appendEntry: (sessionId: string, entry: SessionEntry) => void;
}

// stores/fileStore.ts
interface FileState {
  projectFiles: Map<string, FileInfo>;    // path -> info
  contextFiles: Map<string, ContextFile>; // path -> context info per agent

  updateFile: (path: string, info: FileInfo) => void;
  setContextFile: (path: string, ctx: ContextFile) => void;
}

// stores/driftStore.ts
interface DriftState {
  reports: DriftReport[];
  threshold: number;

  addReport: (report: DriftReport) => void;
  setThreshold: (t: number) => void;
  dismissDrift: (reportIndex: number, itemIndex: number) => void;
}

// stores/uiStore.ts
interface UIState {
  activePanel: 'context' | 'agents' | 'tests';
  hierarchyLevel: 'project' | 'epic' | 'story' | 'task';
  selectedAgentId: string | null;
  selectedFileId: string | null;
  panelSizes: { left: number; center: number; right: number };

  // Actions
  setActivePanel: (panel: string) => void;
  setHierarchyLevel: (level: string) => void;
  selectAgent: (id: string | null) => void;
}
```

---

## 6. Integration Claude Code -- SDK spawn + file watching

C'est le coeur technique de MnM. Cette section detaille le pattern "SDK spawn + file watching".

### 6.1 Spawn via SDK

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

class AgentManager {
  private activeAgents: Map<string, AsyncIterable<any>> = new Map();

  async spawnTeam(config: TeamSpawnConfig): Promise<void> {
    const conversation = query({
      prompt: config.prompt,
      options: {
        cwd: config.projectDir,
        settingSources: ['project', 'user'],
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: config.maxTurns ?? 250,
        env: {
          ...config.env,
          CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"
        }
      }
    });

    // Stream les messages du SDK (lifecycle events)
    for await (const message of conversation) {
      this.eventBus.emit({
        type: 'sdk_message',
        teamName: config.teamName,
        message
      });
    }
  }
}
```

### 6.2 Observation via file watching

Le `ClaudeFileWatcher` surveille 4 categories de fichiers :

| Categorie | Pattern glob | Evenement emis | Frequence |
|-----------|-------------|----------------|-----------|
| **Team config** | `teams/{name}/config.json` | `team_config_changed` | Rare (setup) |
| **Inboxes** | `teams/{name}/inboxes/*.json` | `inbox_message` | Haute (chaque message) |
| **Tasks** | `tasks/{name}/*.json` | `task_created` / `task_updated` | Moyenne |
| **Sessions** | `projects/*/sessions/*.jsonl` | `session_entry` | Tres haute (chaque turn) |

### 6.3 Validation des schemas (zod)

Les fichiers `~/.claude/` ne sont pas documentes officiellement. On valide tout a l'entree :

```typescript
import { z } from 'zod';

// Schema inbox message
const InboxMessageSchema = z.object({
  from: z.string(),
  text: z.string(),
  timestamp: z.string(),
  read: z.boolean()
});

// Schema task
const TaskSchema = z.object({
  id: z.string(),
  subject: z.string(),
  description: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  blocks: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional()
});

// Schema session entry (JSONL line)
const SessionEntrySchema = z.object({
  uuid: z.string(),
  parentUuid: z.string().nullable(),
  type: z.enum(['human', 'assistant', 'tool_use', 'tool_result']),
  message: z.any(),
  timestamp: z.string()
});

// Schema team config
const TeamConfigSchema = z.object({
  members: z.array(z.object({
    name: z.string(),
    agentId: z.string(),
    agentType: z.enum(['leader', 'worker'])
  }))
});

// Usage : validation avant traitement
function parseInbox(raw: string): InboxMessage[] {
  const parsed = JSON.parse(raw);
  return z.array(InboxMessageSchema).parse(parsed);
}
```

### 6.4 Hooks complementaires

En plus du file watching, MnM peut installer des hooks Claude Code pour des evenements supplementaires :

```typescript
// .claude/settings.local.json (genere par MnM)
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{
          "type": "command",
          "command": "node /path/to/mnm/hooks/pre-tool-use.js $TOOL_NAME $FILE_PATH"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{
          "type": "command",
          "command": "node /path/to/mnm/hooks/post-tool-use.js $TOOL_NAME $FILE_PATH"
        }]
      }
    ]
  }
}
```

**Note :** Certains hooks (SessionStart, SessionEnd, TeammateIdle, TaskCompleted) ne supportent que des handlers TypeScript (.ts), pas bash. MnM devra fournir des handlers .ts preconfigures pour ces evenements.

---

## 7. Data flow et event bus

### 7.1 Flux d'evenements

```
[Source]                    [Event Bus]              [Store]           [UI]
                                │
chokidar (inbox)  ──────>  inbox_message  ──────>  messageStore  ──>  MessageFeed
chokidar (task)   ──────>  task_updated   ──────>  taskStore     ──>  TaskBoard
chokidar (session)──────>  session_entry  ──────>  sessionStore  ──>  Timeline
chokidar (project)──────>  file_changed   ──────>  fileStore     ──>  FileExplorer
SDK stream        ──────>  agent_output   ──────>  agentStore    ──>  AgentPanel
simple-git        ──────>  git_change     ──────>  gitStore      ──>  GitPanel
DriftDetector     ──────>  drift_detected ──────>  driftStore    ──>  DriftAlert
```

### 7.2 Types d'evenements

```typescript
type MnMEvent =
  // Agent lifecycle
  | { type: 'agent_started'; agentId: string; name: string }
  | { type: 'agent_stopped'; agentId: string; exitCode: number }
  | { type: 'agent_error'; agentId: string; error: string }
  | { type: 'agent_output'; agentId: string; content: string }

  // Team
  | { type: 'team_config_changed'; config: TeamConfig }

  // Messages inter-agents
  | { type: 'inbox_message'; agent: string; messages: InboxMessage[] }

  // Tasks
  | { type: 'task_created'; task: TaskInfo }
  | { type: 'task_updated'; task: TaskInfo }

  // Sessions (transcriptions)
  | { type: 'session_entry'; sessionId: string; entry: SessionEntry }

  // Fichiers projet
  | { type: 'file_changed'; path: string; changeType: 'create' | 'modify' | 'delete' }

  // Git
  | { type: 'git_status_changed'; status: GitStatus }

  // Drift
  | { type: 'drift_detected'; report: DriftReport }
  | { type: 'drift_resolved'; reportId: string; itemIndex: number }

  // UI
  | { type: 'navigation'; target: NavigationTarget };
```

### 7.3 IPC Transport

Les evenements sont transmis du main process au renderer via `ipcMain.send()` / `ipcRenderer.on()`. Le preload serialise les evenements et le renderer les dispatch dans les stores Zustand correspondants.

```typescript
// main process : emission
eventBus.on('*', (event: MnMEvent) => {
  mainWindow.webContents.send('mnm:event', event);
});

// renderer : reception et dispatch
window.mnm.on('mnm:event', (event: MnMEvent) => {
  switch (event.type) {
    case 'inbox_message':
      useMessageStore.getState().addMessage(event.agent, event.messages);
      break;
    case 'task_created':
    case 'task_updated':
      useTaskStore.getState().setTask(event.task.id, event.task);
      break;
    case 'session_entry':
      useSessionStore.getState().appendEntry(event.sessionId, event.entry);
      break;
    case 'drift_detected':
      useDriftStore.getState().addReport(event.report);
      break;
    // ... etc
  }
});
```

---

## 8. Modele de donnees

### 8.1 Entites principales

```typescript
// Agent
interface AgentInfo {
  id: string;
  name: string;
  role: 'leader' | 'worker';
  status: 'active' | 'idle' | 'blocked' | 'stopped' | 'error';
  healthColor: 'green' | 'orange' | 'red';
  currentTask: string | null;
  startedAt: number;
  lastActivityAt: number;
}

// Task (miroir du fichier JSON Claude)
interface TaskInfo {
  id: string;
  subject: string;
  description?: string;
  owner?: string;
  status: 'pending' | 'in_progress' | 'completed';
  blocks: string[];
  blockedBy: string[];
  createdAt: number;
  updatedAt: number;
}

// Message inter-agent
interface InboxMessage {
  from: string;
  text: string;           // JSON stringifie contenant le type
  timestamp: string;
  read: boolean;
  // Parsed from text:
  parsed?: {
    type: 'task_assignment' | 'message' | 'broadcast' | 'shutdown_request'
          | 'idle_notification' | 'plan_approval_request' | 'plan_approval_response';
    [key: string]: any;
  };
}

// Session entry (JSONL line)
interface SessionEntry {
  uuid: string;
  parentUuid: string | null;
  type: 'human' | 'assistant' | 'tool_use' | 'tool_result';
  message: any;
  timestamp: string;
  // Enriched by MnM:
  agentName?: string;
  toolName?: string;       // Si type === 'tool_use'
  filePath?: string;       // Si l'outil touche un fichier
}

// Drift item
interface DriftItem {
  concept: string;
  parentValue: string;
  childValue: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number;
  parentLocation: string;
  childLocation: string;
  suggestion: string;
  dismissed: boolean;
}

// Workflow node (pour React Flow)
interface WorkflowNode {
  id: string;
  type: 'step' | 'decision' | 'action' | 'output' | 'halt';
  label: string;
  tag?: string;
  data: {
    actions: string[];
    criticals: string[];
    outputs: string[];
    asks: string[];
  };
  position: { x: number; y: number };
}
```

### 8.2 Hierarchie documentaire (drift detection)

```
DocumentHierarchy:
  product-brief.md           (niveau 0 -- source de verite)
    └── prd.md               (niveau 1)
        └── architecture.md  (niveau 2)
            └── epic-*.md    (niveau 3)
                └── story-*.md (niveau 4)
                    └── code  (niveau 5)
```

La drift detection compare chaque document avec son parent direct. Un drift a un niveau N se propage potentiellement aux niveaux N+1, N+2...

---

## 9. Architecture UI et layout

### 9.1 Layout principal (3 volets + timeline)

```
┌──────────────────────────────────────────────────────────────┐
│  [MnM]  Projet: my-project  │  ▶ 3 agents actifs  │ ⚠ 1 drift │
├──────────────┬───────────────────────────┬───────────────────┤
│              │                           │                   │
│   CONTEXT    │         AGENTS            │  TESTS &          │
│   PANEL      │         PANEL             │  VALIDATION       │
│              │                           │                   │
│  - Hierarchy │  - Agent cards            │  - Test tree      │
│  - Files     │  - Chat/transcript        │  - Status         │
│  - Context   │  - Task board             │  - Run tests      │
│    cards     │  - Message feed           │  - Coverage       │
│              │                           │                   │
│              │                           │                   │
├──────────────┴───────────────────────────┴───────────────────┤
│                       TIMELINE (bottom)                       │
│  [──●───●────●──────●────●─────●───●────────>]               │
│   10:30  10:35  10:40  10:45  10:50  10:55   now             │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Navigation hierarchique synchronisee

Quand l'utilisateur navigue dans la hierarchie (Projet > Epic > Story > Tache), les 3 volets se synchronisent :

| Niveau | Context Panel | Agents Panel | Tests Panel |
|--------|--------------|--------------|-------------|
| **Projet** | Product Brief, PRD, Architecture | Tous les agents, cockpit dashboard | Tests E2E, coverage globale |
| **Epic** | Epic spec, stories liees | Agents travaillant sur cet epic | Tests integration de l'epic |
| **Story** | Story spec, fichiers de contexte | Agent assigne a cette story | Tests unitaires groupes |
| **Tache** | Fichier(s) concerne(s) | Agent executant la tache | Tests unitaires specifiques |

### 9.3 Composants React principaux

```
App
├── TopBar (projet, agents actifs, alertes)
├── MainLayout
│   ├── ContextPanel (redimensionnable)
│   │   ├── HierarchyTree
│   │   ├── ContextFileList
│   │   └── ContextCards
│   ├── AgentsPanel (centre)
│   │   ├── AgentCardList
│   │   ├── AgentTranscript
│   │   ├── TaskBoard (kanban)
│   │   └── MessageFeed
│   └── TestsPanel (redimensionnable)
│       ├── TestTree
│       ├── TestStatus
│       └── CoverageView
├── TimelineBar (bas, persistant)
│   └── TimelineChart
├── DriftAlertOverlay
└── WorkflowEditorModal
    ├── ReactFlowCanvas
    ├── NodeEditor
    └── MiniMap
```

---

## 10. Securite et permissions

### 10.1 Modele de securite Electron

- **Context isolation** active (renderer n'a pas acces a Node.js)
- **nodeIntegration** desactive dans le renderer
- **contextBridge** pour l'API IPC typee
- **Content Security Policy** stricte dans le renderer

### 10.2 Permissions Claude Code

MnM lance les agents avec `permissionMode: "bypassPermissions"` et `allowDangerouslySkipPermissions: true`. Cela signifie que les agents peuvent executer n'importe quelle operation fichier/bash sans demander permission.

**Justification :** MnM est un outil local utilise par des developpeurs qui font deja confiance a Claude Code. Le but est de superviser, pas de restreindre.

**Mitigation :** Les agents sont lances dans le repertoire projet (`cwd: projectDir`). File checkpointing est actif (rollback possible).

### 10.3 Secrets et cles API

- La cle API Anthropic est lue depuis les variables d'environnement (`ANTHROPIC_API_KEY`) ou la configuration Claude existante
- MnM ne stocke aucune cle API en clair dans ses propres fichiers
- Les fichiers `.env`, `credentials.json` sont exclus du file watching

---

## 11. Performance et contraintes

### 11.1 Mapping PRD NFR -> Architecture

| NFR | Cible | Solution architecturale |
|-----|-------|------------------------|
| **NFR1** Timeline < 500ms | < 500ms | Event-driven (file watcher -> event bus -> IPC -> store -> React). Pas de polling. |
| **NFR2** File watching < 5% CPU au repos | < 5% CPU | chokidar avec FSEvents natif, ignored patterns stricts |
| **NFR3** React Flow > 30 FPS / 50 noeuds | > 30 FPS | Virtualisation native de React Flow, dagre pour layout |
| **NFR4** Drift detection < 30s | < 30s | Claude API streaming, pipeline local < 2s |
| **NFR5** Cold start < 5s | < 5s | Lazy loading des composants non-visibles, pas de scan initial complet |
| **NFR6** Pas de block UI > 100ms / 3 agents | < 100ms | Tout le travail lourd dans le main process (workers), IPC async |
| **NFR7** RAM < 500 MB / 3 agents | < 500 MB | Stores selectifs, pagination des sessions JSONL, pas de cache unbounded |
| **NFR9** File watching < 1s | < 1s | chokidar + FSEvents : < 100ms typique |

### 11.2 Optimisations specifiques

- **Sessions JSONL** : Ne pas charger la totalite des fichiers JSONL en memoire. Lire uniquement les nouvelles lignes (tail -f pattern) et paginer le historique.
- **Inboxes JSON** : Comparer avec le contenu precedent en cache pour ne traiter que les nouveaux messages.
- **Debouncing** : awaitWriteFinish (100-200ms) sur tous les watchers pour eviter les faux evenements.
- **IPC batching** : Grouper les evenements haute frequence (sessions) en batch avant envoi au renderer (toutes les 100ms).

---

## 12. Risques techniques et mitigations

| # | Risque | Probabilite | Impact | Mitigation |
|---|--------|-------------|--------|------------|
| 1 | **Agent Teams experimental** -- le flag `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` peut etre retire ou change | Haute | Haut | Abstraire derriere `AgentManager` interface. Fallback sur spawn simple si teams indisponible. Veille changelogs. |
| 2 | **Format fichiers ~/.claude/ change** sans annonce | Moyenne | Haut | Validation zod a l'entree. Degradation gracieuse (ignorer les champs inconnus). Tests de regression sur les schemas. |
| 3 | **SDK query() API change** | Moyenne | Moyen | Wrapper thin autour du SDK. Lock de version dans package.json. Tests d'integration. |
| 4 | **Performance Electron avec 3+ agents** | Moyenne | Moyen | Worker threads pour le parsing lourd. Pagination des sessions. Monitoring memoire integre. |
| 5 | **Drift detection faux positifs** | Haute | Haut | Seuil de confiance configurable (FR20). Bouton "ignorer" (FR18). Tuning iteratif des prompts. |
| 6 | **Race conditions file watching** (lecture pendant ecriture) | Moyenne | Moyen | awaitWriteFinish + try/catch JSON.parse + retry 1x apres 50ms. |
| 7 | **Cross-platform filesystem differences** (paths, events) | Moyenne | Moyen | path.join() partout, tests CI sur les 3 OS (NFR11). chokidar abstrait les differences OS. |
| 8 | **settingSources non documente** (SDK option critique) | Moyenne | Moyen | Tests reguliers de verification. Fallback sur `spawn('claude', ...)` direct si SDK ne charge pas les settings. |

---

## 13. Ordre de construction

Aligne avec le PRD (MVP en 3 blocs) et adapte a l'architecture SDK + file watching.

### Phase 0 : Fondation technique

1. Setup Electron + electron-vite + React 19 + TypeScript + Tailwind
2. Architecture IPC (main/preload/renderer) + contextBridge
3. Layout 3 volets + TopBar + Timeline placeholder
4. Zustand stores vides + types TypeScript
5. **Validation :** App qui s'ouvre avec le layout vide

### Phase 1 : Visibilite (Bloc 1 PRD)

6. Integrer Claude Agent SDK -- spawn un agent simple, recevoir le flux
7. ProjectFileWatcher (chokidar sur le projet) -> fileStore -> FileExplorer basique
8. ClaudeFileWatcher -- observer les sessions JSONL -> sessionStore -> Timeline fonctionnelle
9. AgentPanel basique -- statut agent, transcript, indicateur de sante
10. ContextPanel basique -- fichiers du projet, fichiers consultes par l'agent
11. **Validation :** Lancer un agent, voir son activite en temps reel dans MnM

### Phase 2 : Multi-agents et Teams (extension Bloc 1)

12. Activer Agent Teams (env flag) -> observer config.json, inboxes, tasks
13. TaskBoard (kanban) -- afficher les taches, dependencies, statuts
14. MessageFeed -- messages inter-agents en temps reel
15. Multi-agent dans AgentPanel -- cards par agent, navigation
16. **Validation :** Lancer une team de 3 agents, voir toute leur activite dans MnM

### Phase 3 : Supervision (Bloc 2 PRD)

17. DriftDetector -- LLM-as-judge via Anthropic SDK
18. DocumentHierarchy -- detection auto de la hierarchie BMAD
19. DriftAlertOverlay -- alertes actionnables, diff, resolve/dismiss
20. Dashboard cockpit -- vue d'ensemble a l'ouverture
21. GitService -- integration simple-git, historique, diffs
22. **Validation :** Modifier un fichier d'architecture, voir l'alerte de drift

### Phase 4 : Puissance (Bloc 3 PRD)

23. Workflow parser (js-yaml + fast-xml-parser -> WorkflowGraph)
24. WorkflowEditorModal (React Flow + dagre + nodes BMAD personnalises)
25. Edition basique de workflows (ajout/suppression noeuds, connexions)
26. Sync visuel -> fichier source (Pattern Source of Truth = Fichier)
27. TestsPanel -- test tree, statuts, lancement
28. Context management interactif -- drag & drop
29. **Validation :** Ouvrir un workflow BMAD, voir le graphe, ajouter un noeud

---

*Ce document d'architecture est la reference technique pour l'implementation de MnM. Il sera mis a jour au fur et a mesure des decisions prises pendant le developpement.*
