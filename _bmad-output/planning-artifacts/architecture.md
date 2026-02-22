---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - planning-artifacts/prd.md
  - planning-artifacts/product-brief-mnm-2026-02-22.md
  - planning-artifacts/technical-research-mnm-2026-02-22.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-22'
project_name: mnm
user_name: Gabri
date: 2026-02-22
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

48 FRs répartis en 9 domaines fonctionnels :

| Domaine | FRs | Implication architecturale |
|---------|-----|---------------------------|
| Agent Monitoring & Supervision | FR1-FR8 | Process management, stdout parsing, event correlation, health status engine |
| Context Visualization & Management | FR9-FR13 | File tracking par agent, drag & drop IPC, notification system |
| Drift Detection | FR14-FR20 | LLM integration async, document hierarchy model, confidence scoring, alert system |
| Dashboard & Project Overview | FR21-FR24 | Aggregation layer, navigation routing, real-time counters |
| Workflow Visualization & Editing | FR25-FR32 | Graph engine (React Flow), YAML/XML parser, bidirectional sync, execution tracking |
| Test Visualization | FR33-FR36 | Test runner integration, hierarchical mapping specs ↔ tests |
| Navigation & Layout | FR37-FR40 | Shell/layout manager, panel system, hierarchical navigation state |
| File & Git Integration | FR41-FR44 | File watcher (chokidar), Git client (simple-git), event correlator |
| Project & Integration | FR45-FR48 | Project loader, BMAD structure detector, Git reader, workflow parser |

**Non-Functional Requirements:**

11 NFRs répartis en 2 catégories, tous avec métriques quantifiées :

| NFR | Contrainte | Impact architectural |
|-----|-----------|---------------------|
| NFR1 | Timeline update < 500ms | Event bus performant, pas de polling |
| NFR2 | File watching < 5% CPU au repos | chokidar avec filtering strict |
| NFR3 | Workflow Editor > 30 FPS / 50 noeuds | React Flow avec virtualisation |
| NFR4 | Drift detection < 30s (pipeline local < 2s) | LLM async avec cache |
| NFR5 | Cold start < 5s | Lazy loading, pas de scan initial lourd |
| NFR6 | UI thread < 100ms de blocage | Séparation stricte main/renderer, worker threads si nécessaire |
| NFR7 | RAM < 500 MB | Monitoring mémoire, virtualisation de listes |
| NFR8 | Interception Claude Code < 500ms | Subprocess capture optimisée |
| NFR9 | File watching < 1s de délai | chokidar avec FSEvents (macOS) |
| NFR10 | Process sans privilèges élevés | Architecture user-space only |
| NFR11 | Cross-platform identique | Abstraction OS, CI multi-plateforme |

**Scale & Complexity:**

- Domaine principal : Desktop application full-stack (Electron)
- Niveau de complexité : **Medium-High**
- Composants architecturaux estimés : **12-15** (shell, event bus, agent harness, file watcher, Git client, drift engine, workflow parser, workflow editor, timeline, context panel, test panel, dashboard, navigation state, IPC bridge, LLM service)

### Technical Constraints & Dependencies

| Contrainte | Source | Impact |
|-----------|--------|--------|
| Application desktop avec accès filesystem + process + Git | PRD (contrainte technique) | Electron ou Tauri obligatoire |
| Internet requis pour LLM (drift detection, agents) | PRD (Connectivity) | Pas de mode offline, gestion des déconnexions |
| Pas de backend serveur | PRD (Connectivity) | Tout est local, pas de sync cloud |
| Claude Code CLI comme agent principal (MVP) | PRD (scope) | Subprocess wrapping, parsing stdout |
| Event-driven (pas de polling) | PRD (Technical Success) | Architecture pub/sub ou event bus |
| Cross-platform macOS/Linux/Windows | PRD (Platform Support) | Abstraction OS pour filesystem, process, Git |
| Équipe 3 devs, pas d'expérience desktop | Product Brief (Resources) | Prioriser la simplicité, stack web-first |

### Cross-Cutting Concerns Identified

1. **Event System** — Le bus d'événements est le système nerveux de MnM. File changes, agent stdout, drift alerts, workflow execution, navigation — tout passe par des événements. L'architecture du bus (synchrone vs async, typed vs untyped, buffered vs unbuffered) est une décision fondatrice.

2. **IPC Main ↔ Renderer** — Chaque feature nécessite une communication entre le main process Electron (filesystem, process, Git) et le renderer (React UI). Le design de la couche IPC (contextBridge, channels typés, serialization) impacte toute l'application.

3. **State Management** — L'état partagé entre les 3 volets (agents actifs, fichiers contexte, alertes drift, navigation hiérarchique, workflow courant) nécessite un store centralisé avec des mises à jour réactives performantes.

4. **Async Error Handling** — Agents qui crashent, LLM qui timeout, filesystem inaccessible, Git corrompu — chaque composant dépend de ressources externes faillibles. La stratégie de gestion d'erreurs (retry, fallback, notification utilisateur) doit être cohérente.

5. **Cross-Platform Abstraction** — Les différences entre macOS (FSEvents), Linux (inotify), et Windows (ReadDirectoryChangesW) pour le file watching, et les subtilités de process management, nécessitent une couche d'abstraction OS.

## Starter Template Evaluation

### Primary Technology Domain

Desktop application (Electron) basé sur l'analyse des requirements : accès filesystem, process management, Git integration, UI riche React.

### Versions Vérifiées (février 2026)

| Technologie | Version | Notes |
|-------------|---------|-------|
| Electron | 40.6.0 | Stable, 19 fév 2026 |
| React | 19.2.4 | 26 jan 2026 |
| electron-vite | 5.0.0 | Build tooling Vite pour Electron |
| Zustand | 5.0.11 | State management |
| Tailwind CSS | 4.x | CSS-first config, perf x5 |
| Vitest | 4.0.18 | Testing framework Vite-native |
| React Flow | latest | Node-based graph editor |

### Starter Options Considered

| Starter | Type | Verdict |
|---------|------|---------|
| **Official electron-vite scaffold** | CLI officiel (`npm create @quick-start/electron`) | **Sélectionné** — clean, officiel, bien maintenu |
| guasam/electron-react-app | Template GitHub (Tailwind + Shadcn/UI) | Rejeté — opinions UI à défaire |
| Electron Forge + Vite | Outil officiel Electron | Rejeté — Vite support expérimental (v7.5.0) |
| 2skydev/electron-vite-react-ts-template | Template GitHub (feature-rich) | Rejeté — utilise Recoil + styled-components (pas notre stack) |

### Selected Starter: Official electron-vite scaffold

**Rationale for Selection:**

1. Fondation propre sans opinions à défaire — on ajoute exactement ce qu'on veut
2. Officiellement maintenu (electron-vite v5.0)
3. Séparation main/renderer/preload déjà configurée avec contextBridge (best practice sécurité)
4. DX excellente (HMR, source maps, Chrome DevTools)
5. Adapté à une équipe intermédiaire sans expérience desktop

**Initialization Command:**

```bash
npm create @quick-start/electron@latest mnm -- --template react-ts
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
TypeScript strict, Electron 40.x, Node.js (main process), Chromium (renderer)

**Build Tooling:**
Vite 6.x via electron-vite 5.0 — HMR pour main + renderer, build optimisé

**Code Organization:**
- `src/main/` — Electron main process (filesystem, process, Git, IPC)
- `src/renderer/` — React application (UI, state, composants)
- `src/preload/` — contextBridge scripts (pont sécurisé main ↔ renderer)

**IPC Pattern:**
contextBridge + preload scripts — le renderer n'a pas d'accès direct à Node.js

**Development Experience:**
Hot reload, source maps, Chrome DevTools intégré

### Dependencies to Add

| Catégorie | Package | Version | Justification |
|-----------|---------|---------|---------------|
| Styling | tailwindcss | 4.x | CSS-first config, rapide, léger |
| State management | zustand | 5.0.x | Léger, performant, événements temps réel |
| Workflow viz | @xyflow/react | latest | Node-based editor, React natif |
| Graph layout | dagre | latest | Auto-layout de DAGs |
| File watching | chokidar | latest | Standard, FSEvents natif macOS |
| Git | simple-git | latest | API TypeScript complète, git natif |
| YAML parsing | js-yaml | latest | Standard de facto |
| XML parsing | fast-xml-parser | latest | Rapide, bien maintenu |
| Testing | vitest | 4.0.x | Vite-native, rapide |
| Markdown parsing | remark / unified | latest | AST structurel pour drift detection |
| LLM integration | @anthropic-ai/sdk | latest | Appels Claude API pour drift detection |

**Note:** L'initialisation du projet avec cette commande sera la première story d'implémentation.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Event bus architecture → EventEmitter (main) + mitt (renderer)
2. IPC channel design → Hybride invoke + streaming
3. Persistance locale → Fichiers JSON dans `.mnm/`
4. LLM integration pattern → Service abstrait avec implémentation Claude

**Important Decisions (Shape Architecture):**
5. Component architecture → Hybrid (feature-based + shared layer)
6. Packaging & distribution → electron-builder + GitHub Releases

**Deferred Decisions (Post-MVP):**
- Auto-update mechanism (gestion manuelle au MVP)
- Plugin system pour agents additionnels (MVP = Claude Code uniquement)
- Mécanisme de migration de données `.mnm/` (pas nécessaire tant que le format est simple)

### Event Bus Architecture

| Aspect | Décision |
|--------|----------|
| **Choix** | EventEmitter natif (main process) + mitt (renderer) |
| **Version** | mitt latest, EventEmitter natif Node.js |
| **Rationale** | EventEmitter est gratuit côté Node, mitt est ultra-léger (200 bytes) et typé côté renderer. Évite la complexité de RxJS pour le MVP. |
| **Affects** | Tous les composants — c'est le système nerveux de l'app |

**Pattern :**
- Main process : `EventEmitter` Node.js natif pour les événements internes (file changes, agent stdout, Git events)
- Renderer : `mitt` avec types stricts pour les événements UI (navigation, panel state, user actions)
- Pont : Les événements traversent l'IPC via des channels typés (main émet → IPC bridge → mitt renderer)

**Types d'événements :**

```typescript
// src/shared/events.ts
type MainEvents = {
  'agent:output': { agentId: string; data: string; timestamp: number };
  'agent:status': { agentId: string; status: AgentStatus };
  'agent:chat-entry': { agentId: string; role: 'user' | 'assistant' | 'system'; content: string; checkpoint?: string; timestamp: number };
  'file:changed': { path: string; type: 'create' | 'modify' | 'delete' };
  'drift:detected': { id: string; severity: 'critical' | 'warning' | 'info'; documents: [string, string] };
  'git:commit': { hash: string; message: string };
  'workflow:node-status': { workflowId: string; nodeId: string; status: 'pending' | 'active' | 'done' | 'error' };
  'test:result': { testId: string; specId: string; status: 'pass' | 'fail' | 'pending'; duration: number };
};

type RendererEvents = {
  'nav:select': { level: 'project' | 'epic' | 'story' | 'task'; id: string };
  'panel:resize': { panel: 'context' | 'agents' | 'tests'; width: number };
  'agent:launch': { task: string; context: string[] };
};
```

### IPC Channel Design

| Aspect | Décision |
|--------|----------|
| **Choix** | Hybride invoke (request-response) + streaming (events push) |
| **Rationale** | Les requêtes ponctuelles (getStatus, getFileHistory) utilisent invoke. Les flux temps réel (agent output, file watching) utilisent le streaming. Séparation claire des responsabilités. |
| **Affects** | Toute la communication main ↔ renderer |

**Pattern :**

```typescript
// src/shared/ipc-channels.ts

// Request-Response (renderer → main → response)
type IpcInvokeChannels = {
  'git:status': { args: void; result: GitStatus };
  'git:log': { args: { count: number }; result: GitLog };
  'git:show-file': { args: { path: string; commitHash: string }; result: string };
  'agent:launch': { args: { task: string; context: string[] }; result: { agentId: string } };
  'agent:stop': { args: { agentId: string }; result: void };
  'agent:get-chat': { args: { agentId: string; fromCheckpoint?: string }; result: ChatEntry[] };
  'drift:check': { args: { docA: string; docB: string }; result: DriftReport };
  'drift:resolve': { args: { driftId: string; action: 'fix-source' | 'fix-derived' | 'ignore'; content?: string }; result: void };
  'project:open': { args: { path: string }; result: ProjectInfo };
  'stories:list': { args: void; result: StoryProgress[] };
  'workflow:save': { args: { workflowId: string; graph: WorkflowGraph }; result: void };
  'test:run': { args: { specId?: string; scope: 'unit' | 'integration' | 'e2e' }; result: { runId: string } };
  'test:list': { args: { specId?: string }; result: TestInfo[] };
};

// Streaming (main → renderer, push)
type IpcStreamChannels = {
  'stream:agent-output': { agentId: string; data: string; timestamp: number };
  'stream:agent-chat': { agentId: string; role: 'user' | 'assistant' | 'system'; content: string; checkpoint?: string; timestamp: number };
  'stream:file-change': { path: string; type: 'create' | 'modify' | 'delete'; agentId?: string };
  'stream:drift-alert': { id: string; severity: string; summary: string };
  'stream:agent-status': { agentId: string; status: AgentStatus };
  'stream:workflow-node': { workflowId: string; nodeId: string; status: 'pending' | 'active' | 'done' | 'error' };
  'stream:test-result': { testId: string; specId: string; status: 'pass' | 'fail' | 'pending'; duration: number; output?: string };
};
```

**Fichier preload :** expose les channels typés via `contextBridge.exposeInMainWorld()`.

### Local Data Persistence

| Aspect | Décision |
|--------|----------|
| **Choix** | Fichiers JSON dans `.mnm/` à la racine du projet |
| **Rationale** | Données simples au MVP (préférences, cache, historique). JSON est lisible, débuggable, versionnable. Migration vers SQLite possible post-MVP si les besoins évoluent. |
| **Affects** | Settings, drift cache, agent history |

**Structure :**

```
.mnm/
├── settings.json            # Préférences utilisateur (seuils drift, layout, clé API)
├── drift-cache/
│   ├── concepts-{docHash}.json   # Concepts extraits par document
│   └── results-{pairHash}.json   # Résultats de drift par paire
├── agent-history/
│   └── session-{timestamp}.json  # Historique des sessions agents
└── project-state.json       # Dernier état du projet (navigation, panels)
```

**Règles :**
- `.mnm/` est ajouté au `.gitignore` du projet (données locales, pas versionnées)
- Lecture/écriture atomique (write to temp + rename)
- Pas de migration de schema au MVP — format simple et extensible

### LLM Integration Pattern

| Aspect | Décision |
|--------|----------|
| **Choix** | Service abstrait `LLMService` + implémentation `ClaudeLLMService` |
| **Version** | @anthropic-ai/sdk latest |
| **Rationale** | Testable (mock), extensible (swap provider), centralise retries et rate limiting. |
| **Affects** | Drift detection, potentiellement d'autres features LLM futures |

**Interface :**

```typescript
// src/main/services/llm/llm-service.ts
interface LLMService {
  compareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport>;
  extractConcepts(document: string): Promise<Concept[]>;
}

// src/main/services/llm/claude-llm-service.ts
class ClaudeLLMService implements LLMService {
  constructor(private apiKey: string, private model: string = 'claude-sonnet-4-6') {}
  // Implémentation avec Anthropic SDK, retries, structured output
}
```

**Gestion de la clé API :** Stockée dans `.mnm/settings.json`, lue au démarrage. Pas de hardcoding.

### Frontend Component Architecture

| Aspect | Décision |
|--------|----------|
| **Choix** | Hybrid — feature-based pour les domaines, shared layer pour les communs |
| **Rationale** | Les 3 domaines (agents, drift, workflow) sont indépendants. Les composants partagés (panels, nav, UI) vivent dans un dossier commun. |
| **Affects** | Organisation du code renderer, navigation entre features |

**Structure :**

```
src/renderer/
├── features/
│   ├── agents/          # Timeline, health indicators, agent panels
│   │   ├── components/
│   │   ├── hooks/
│   │   └── store.ts     # Zustand slice
│   ├── drift/           # Drift detection, alerts, resolution
│   │   ├── components/
│   │   ├── hooks/
│   │   └── store.ts
│   ├── workflow/        # Workflow editor, React Flow, parser
│   │   ├── components/
│   │   ├── hooks/
│   │   └── store.ts
│   ├── tests/           # Test visualization, hierarchy
│   │   ├── components/
│   │   ├── hooks/
│   │   └── store.ts
│   └── dashboard/       # Cockpit overview
│       ├── components/
│       └── hooks/
├── shared/
│   ├── components/      # UI kit (Button, Panel, Badge, etc.)
│   ├── layout/          # Shell, 3-pane layout, navigation
│   └── hooks/           # Hooks partagés (useIpc, useEventBus)
├── stores/
│   └── navigation.ts    # État de navigation hiérarchique (partagé entre features)
└── App.tsx
```

### Packaging & Distribution

| Aspect | Décision |
|--------|----------|
| **Choix** | electron-builder + GitHub Releases |
| **Rationale** | Plus mature que Forge, pas de risque avec le Vite expérimental de Forge. Distribution via GitHub Releases (simple, gratuit). |
| **Affects** | Build pipeline, CI/CD |

**Targets :** macOS (.dmg), Linux (.AppImage), Windows (.exe)
**CI/CD :** GitHub Actions — build + test sur les 3 plateformes, release automatique sur tag.

### Decision Impact Analysis

**Implementation Sequence :**
1. Scaffold electron-vite + configuration de base (Tailwind, Zustand, Vitest)
2. IPC bridge typé + preload setup
3. Event bus (main + renderer)
4. Shell layout 3 volets + navigation
5. File watcher + Git integration (main process services)
6. Agent harness (subprocess wrapping Claude Code)
7. Timeline + dashboard (renderer features)
8. Drift detection (LLM service + UI)
9. Workflow editor (parser + React Flow)
10. Packaging + CI/CD

**Cross-Component Dependencies :**
- Event bus → requis par tous les composants
- IPC bridge → requis pour toute communication main ↔ renderer
- File watcher → alimente le drift engine et le context panel
- Agent harness → alimente la timeline et le context panel
- Navigation store → synchronise les 3 volets

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**12 zones de conflit potentiel identifiées** où des agents IA pourraient coder différemment sans règles explicites.

### Naming Patterns

**Fichiers & Répertoires :**

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants React | PascalCase.tsx | `AgentTimeline.tsx` |
| Hooks | camelCase, préfixe `use` | `useAgentStatus.ts` |
| Stores Zustand | camelCase + `.store.ts` | `agents.store.ts` |
| Services main process | kebab-case + `.service.ts` | `file-watcher.service.ts` |
| Types/interfaces | kebab-case + `.types.ts` | `agent.types.ts` |
| Tests | même nom + `.test.ts` co-localisé | `AgentTimeline.test.tsx` |
| Constantes/config | kebab-case + `.config.ts` | `ipc.config.ts` |

**Code :**

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Variables, fonctions | camelCase | `getAgentStatus()` |
| Composants React | PascalCase | `<DriftAlert />` |
| Types & Interfaces | PascalCase, préfixe `I` interdit | `type AgentStatus = ...` |
| Enums | PascalCase + membres UPPER_SNAKE | `enum Status { ACTIVE, BLOCKED }` |
| Constantes globales | UPPER_SNAKE_CASE | `MAX_AGENTS = 10` |
| IPC channels | namespace:action en kebab | `'agent:launch'`, `'stream:file-change'` |
| Event types | namespace:action en kebab | `'drift:detected'`, `'nav:select'` |

### Structure Patterns

**Tests co-localisés :**

```
features/agents/
├── components/
│   ├── AgentTimeline.tsx
│   └── AgentTimeline.test.tsx
├── hooks/
│   ├── useAgentStatus.ts
│   └── useAgentStatus.test.ts
└── agents.store.ts
```

**Services main process :**

```
src/main/services/
├── agent/
│   ├── agent-harness.service.ts
│   ├── agent-harness.service.test.ts
│   └── agent.types.ts
├── file-watcher/
│   ├── file-watcher.service.ts
│   └── file-watcher.service.test.ts
├── git/
│   ├── git.service.ts
│   └── git.service.test.ts
├── llm/
│   ├── llm.service.ts
│   ├── claude-llm.service.ts
│   └── llm.types.ts
└── drift/
    ├── drift-engine.service.ts
    └── drift.types.ts
```

**Imports absolus avec alias :**

```typescript
// ✅ Bon
import { AgentStatus } from '@shared/types/agent.types';
import { useAgentStatus } from '@renderer/features/agents/hooks/useAgentStatus';

// ❌ Mauvais
import { AgentStatus } from '../../../shared/types/agent.types';
```

Alias configurés dans tsconfig paths : `@main/`, `@renderer/`, `@shared/`.

### Format Patterns

**Erreurs normalisées :**

```typescript
// src/shared/types/error.types.ts
type AppError = {
  code: string;         // 'AGENT_CRASH' | 'LLM_TIMEOUT' | 'FILE_NOT_FOUND' | ...
  message: string;      // Message lisible par l'humain
  source: string;       // 'agent-harness' | 'drift-engine' | 'file-watcher' | ...
  details?: unknown;    // Données additionnelles pour le debug
};
```

Toutes les erreurs du main process sont normalisées en `AppError` avant envoi au renderer.

**IPC Streaming — tous les événements push incluent un timestamp :**

```typescript
type StreamEvent<T> = T & { timestamp: number };
```

**TypeScript :**

| Règle | Convention |
|-------|-----------|
| `type` vs `interface` | `type` par défaut. `interface` pour les contrats de service (extension possible) |
| Strict mode | `strict: true` dans tsconfig |
| `any` | Interdit. Utiliser `unknown` + type guard |
| Export | Named exports uniquement. Pas de `export default` |
| Barrel files | Un `index.ts` par feature qui re-exporte les éléments publics |

### Communication Patterns

**Zustand Store — pattern standard :**

```typescript
import { create } from 'zustand';

type AgentsState = {
  agents: Map<string, Agent>;
  addAgent: (agent: Agent) => void;
  updateStatus: (id: string, status: AgentStatus) => void;
  removeAgent: (id: string) => void;
};

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: new Map(),
  addAgent: (agent) => set((state) => {
    const next = new Map(state.agents);
    next.set(agent.id, agent);
    return { agents: next };
  }),
  updateStatus: (id, status) => set((state) => {
    const next = new Map(state.agents);
    const agent = next.get(id);
    if (agent) next.set(id, { ...agent, status });
    return { agents: next };
  }),
  removeAgent: (id) => set((state) => {
    const next = new Map(state.agents);
    next.delete(id);
    return { agents: next };
  }),
}));
```

**Règles Zustand :**
- Un store par feature (pas de mega-store)
- Actions dans le store (pas de fonctions externes qui modifient le state)
- Immutable updates (jamais de mutation directe)
- Sélecteurs typés pour l'accès depuis les composants

**Hook IPC standard :**

```typescript
// shared/hooks/useIpcStream.ts
function useIpcStream<T>(channel: string, handler: (data: T) => void) {
  useEffect(() => {
    const cleanup = window.electronAPI.on(channel, handler);
    return cleanup;
  }, [channel, handler]);
}
```

### Process Patterns

**Error Handling par couche :**

| Couche | Pattern |
|--------|---------|
| Main process services | `try/catch` → normaliser en `AppError` → émettre via IPC |
| IPC invoke handlers | `try/catch` → retourner `{ success: false, error: AppError }` |
| Renderer (composants) | React Error Boundaries par feature |
| Renderer (async) | `try/catch` dans les hooks, erreur dans le store de la feature |
| LLM calls | Retry 2x avec backoff exponentiel, puis `AppError` code `LLM_TIMEOUT` |

**Async State — pattern standard :**

```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: AppError };
```

Chaque store avec opérations async utilise ce pattern. Pas de booléens `isLoading` éparpillés.

**Logging (main process uniquement) :**

```
[timestamp] [level] [source] message
```

Niveaux : `debug`, `info`, `warn`, `error`.

```typescript
logger.info('agent-harness', 'Agent launched', { agentId, task });
logger.error('drift-engine', 'LLM call failed', { error, retryCount });
```

### Enforcement Guidelines

**Tous les agents IA DOIVENT :**

1. Suivre les conventions de nommage exactes (fichiers, variables, IPC channels)
2. Co-localiser les tests avec le code source
3. Utiliser les imports absolus avec alias (`@main/`, `@renderer/`, `@shared/`)
4. Normaliser toutes les erreurs en `AppError` avant de les exposer
5. Utiliser `AsyncState<T>` pour les opérations async dans les stores
6. Named exports uniquement (pas de `export default`)
7. `type` par défaut, `interface` pour les contrats de service
8. Actions Zustand dans le store, pas à l'extérieur

**Vérification :** ESLint + règles custom pour enforcer conventions de nommage et d'import.

## Project Structure & Boundaries

### Complete Project Directory Structure

```
mnm/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Build + test macOS/Linux/Windows
│       └── release.yml               # Build + release sur tag
├── .mnm/                             # Données locales (gitignored)
│   ├── settings.json
│   ├── drift-cache/
│   ├── agent-history/
│   └── project-state.json
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts           # Config electron-vite
├── electron-builder.yml              # Config packaging
├── tailwind.config.ts
├── vitest.config.ts
├── README.md
│
├── src/
│   ├── main/                         # ── Electron Main Process ──
│   │   ├── index.ts                  # Entry point main process
│   │   ├── ipc/
│   │   │   ├── handlers.ts           # Tous les ipcMain.handle()
│   │   │   └── streams.ts            # Tous les webContents.send() streams
│   │   ├── services/
│   │   │   ├── agent/
│   │   │   │   ├── agent-harness.service.ts
│   │   │   │   ├── agent-harness.service.test.ts
│   │   │   │   ├── stdout-parser.ts
│   │   │   │   ├── chat-segmenter.ts          # GAP-1: Segmente stdout en ChatEntry[]
│   │   │   │   └── agent.types.ts
│   │   │   ├── file-watcher/
│   │   │   │   ├── file-watcher.service.ts
│   │   │   │   ├── file-watcher.service.test.ts
│   │   │   │   └── event-correlator.ts
│   │   │   ├── git/
│   │   │   │   ├── git.service.ts
│   │   │   │   └── git.service.test.ts
│   │   │   ├── llm/
│   │   │   │   ├── llm.service.ts
│   │   │   │   ├── claude-llm.service.ts
│   │   │   │   ├── claude-llm.service.test.ts
│   │   │   │   └── llm.types.ts
│   │   │   ├── drift/
│   │   │   │   ├── drift-engine.service.ts
│   │   │   │   ├── drift-engine.service.test.ts
│   │   │   │   └── drift.types.ts
│   │   │   ├── project/
│   │   │   │   ├── project-loader.service.ts
│   │   │   │   ├── bmad-detector.ts
│   │   │   │   ├── story-parser.ts            # GAP-2: Parse stories BMAD → StoryProgress[]
│   │   │   │   └── project.types.ts
│   │   │   ├── workflow-parser/
│   │   │   │   ├── yaml-parser.ts
│   │   │   │   ├── xml-parser.ts
│   │   │   │   ├── workflow-graph-builder.ts
│   │   │   │   ├── yaml-serializer.ts         # GAP-3: Graph → fichier YAML
│   │   │   │   ├── xml-serializer.ts          # GAP-3: Graph → fichier XML
│   │   │   │   └── workflow-parser.types.ts
│   │   │   └── test-runner/
│   │   │       ├── test-runner.service.ts      # GAP-5: Spawn vitest/npm test
│   │   │       ├── test-runner.service.test.ts
│   │   │       ├── spec-mapper.ts             # Mapping spec → tests (convention-based)
│   │   │       └── test-runner.types.ts
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── event-bus.ts
│   │
│   ├── preload/                      # ── Preload Scripts ──
│   │   ├── index.ts
│   │   └── api.ts
│   │
│   ├── renderer/                     # ── React Application ──
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── app.css
│   │   ├── features/
│   │   │   ├── agents/
│   │   │   │   ├── components/
│   │   │   │   │   ├── AgentTimeline.tsx
│   │   │   │   │   ├── AgentTimeline.test.tsx
│   │   │   │   │   ├── AgentCard.tsx
│   │   │   │   │   ├── AgentHealthBadge.tsx
│   │   │   │   │   ├── AgentProgressBar.tsx
│   │   │   │   │   ├── AgentChatViewer.tsx     # GAP-1: Historique chat d'un agent
│   │   │   │   │   └── AgentChatViewer.test.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useAgentStatus.ts
│   │   │   │   │   ├── useAgentStream.ts
│   │   │   │   │   └── useAgentChat.ts        # GAP-1: Hook pour chat entries
│   │   │   │   ├── agents.store.ts
│   │   │   │   └── index.ts
│   │   │   ├── context/
│   │   │   │   ├── components/
│   │   │   │   │   ├── ContextFileCard.tsx
│   │   │   │   │   ├── ContextPanel.tsx
│   │   │   │   │   └── ContextDragDrop.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useContextFiles.ts
│   │   │   │   ├── context.store.ts
│   │   │   │   └── index.ts
│   │   │   ├── drift/
│   │   │   │   ├── components/
│   │   │   │   │   ├── DriftAlert.tsx
│   │   │   │   │   ├── DriftDiffView.tsx
│   │   │   │   │   └── DriftResolutionPanel.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useDriftAlerts.ts
│   │   │   │   ├── drift.store.ts
│   │   │   │   └── index.ts
│   │   │   ├── workflow/
│   │   │   │   ├── components/
│   │   │   │   │   ├── WorkflowEditor.tsx
│   │   │   │   │   ├── WorkflowEditor.test.tsx
│   │   │   │   │   ├── BmadStepNode.tsx
│   │   │   │   │   ├── BmadDecisionNode.tsx
│   │   │   │   │   └── WorkflowToolbar.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useWorkflowGraph.ts
│   │   │   │   ├── workflow.store.ts
│   │   │   │   └── index.ts
│   │   │   ├── tests/
│   │   │   │   ├── components/
│   │   │   │   │   ├── TestHierarchy.tsx
│   │   │   │   │   └── TestStatusBadge.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useTestResults.ts
│   │   │   │   ├── tests.store.ts
│   │   │   │   └── index.ts
│   │   │   └── dashboard/
│   │   │       ├── components/
│   │   │       │   ├── CockpitDashboard.tsx
│   │   │       │   ├── ProjectHealthSummary.tsx
│   │   │       │   ├── AlertsSummary.tsx
│   │   │       │   └── StoriesProgress.tsx     # GAP-2: Avancement stories BMAD
│   │   │       ├── hooks/
│   │   │       │   ├── useDashboardData.ts
│   │   │       │   └── useStoriesProgress.ts  # GAP-2: Hook pour stories:list
│   │   │       └── index.ts
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Panel.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── ThreePaneLayout.tsx
│   │   │   │   ├── TimelineBar.tsx
│   │   │   │   └── NavigationSidebar.tsx
│   │   │   └── hooks/
│   │   │       ├── useIpcInvoke.ts
│   │   │       ├── useIpcStream.ts
│   │   │       └── useEventBus.ts
│   │   └── stores/
│   │       └── navigation.store.ts
│   │
│   └── shared/                       # ── Shared Types (main + renderer) ──
│       ├── ipc-channels.ts
│       ├── events.ts
│       └── types/
│           ├── agent.types.ts
│           ├── chat.types.ts              # GAP-1: ChatEntry, ChatSegment
│           ├── drift.types.ts
│           ├── workflow.types.ts
│           ├── project.types.ts
│           ├── story.types.ts             # GAP-2: StoryProgress, TaskStatus
│           ├── test.types.ts              # GAP-5: TestInfo, TestRunResult
│           ├── error.types.ts
│           └── async-state.types.ts
│
├── resources/                        # Assets pour le packaging
│   ├── icon.icns
│   ├── icon.ico
│   └── icon.png
│
└── e2e/
    └── .gitkeep
```

### Architectural Boundaries

**Process Boundaries (Electron) :**

```
┌─────────────────────────────────────────────────────┐
│  Main Process (Node.js)                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Agent    │ │ File     │ │ Git      │            │
│  │ Harness  │ │ Watcher  │ │ Service  │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       │             │            │                   │
│  ┌────┴─────────────┴────────────┴─────┐            │
│  │           Event Bus (main)           │            │
│  └──────────────┬──────────────────────┘            │
│                 │                                    │
│  ┌──────────────┴──────────────────────┐            │
│  │        IPC Handlers + Streams        │            │
│  └──────────────┬──────────────────────┘            │
│                 │                                    │
│  ┌──────────┐  │  ┌──────────┐ ┌──────────┐        │
│  │ Drift    │  │  │ Project  │ │ Workflow │        │
│  │ Engine   │  │  │ Loader   │ │ Parser   │        │
│  └──────────┘  │  └──────────┘ └──────────┘        │
└────────────────┼────────────────────────────────────┘
                 │ contextBridge (preload)
┌────────────────┼────────────────────────────────────┐
│  Renderer Process (Chromium)                         │
│                │                                     │
│  ┌─────────────┴───────────────────────┐            │
│  │    IPC Hooks (useIpcInvoke/Stream)   │            │
│  └─────────────┬───────────────────────┘            │
│                │                                     │
│  ┌─────────────┴───────────────────────┐            │
│  │      Zustand Stores (per feature)    │            │
│  └─────────────┬───────────────────────┘            │
│                │                                     │
│  ┌─────┐ ┌────┴──┐ ┌────────┐ ┌────────┐          │
│  │Dash │ │Agents │ │ Drift  │ │Workflow│          │
│  │board│ │Panel  │ │ Panel  │ │Editor  │          │
│  └─────┘ └───────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────────────┘
```

**Boundary Rules :**

| Règle | Description |
|-------|------------|
| Renderer → Main | Uniquement via `window.electronAPI` (preload). Jamais d'import direct de Node.js |
| Main → Renderer | Uniquement via `webContents.send()` pour les streams. Jamais de référence au DOM |
| Feature → Feature | Communication via stores Zustand partagés (navigation.store.ts). Pas d'import croisé entre features |
| Service → Service | Dépendance via constructeur (ex: drift-engine dépend de llm). Pas de singletons globaux |
| Shared types | `src/shared/` est le seul dossier importable par main ET renderer |

### Requirements to Structure Mapping

| FR Category | Main Process | Renderer | Shared Types |
|-------------|-------------|----------|-------------|
| Agent Monitoring (FR1-FR8) | `services/agent/` (+ `chat-segmenter.ts`) | `features/agents/` (+ `AgentChatViewer`) | `types/agent.types.ts` + `types/chat.types.ts` |
| Context Viz (FR9-FR13) | `services/file-watcher/` | `features/context/` | `types/agent.types.ts` |
| Drift Detection (FR14-FR20) | `services/drift/` + `services/llm/` | `features/drift/` | `types/drift.types.ts` |
| Dashboard (FR21-FR24) | `services/project/story-parser.ts` | `features/dashboard/` (+ `StoriesProgress`) | `types/story.types.ts` |
| Workflow Editor (FR25-FR32) | `services/workflow-parser/` (+ sérialiseurs + execution tracking) | `features/workflow/` | `types/workflow.types.ts` |
| Test Viz (FR33-FR36) | `services/test-runner/` | `features/tests/` | `types/test.types.ts` |
| Navigation (FR37-FR40) | — | `shared/layout/` + `stores/` | — |
| File & Git (FR41-FR44) | `services/file-watcher/` + `services/git/` | — (via IPC) | — |
| Project (FR45-FR48) | `services/project/` + `services/workflow-parser/` | — (via IPC) | `types/project.types.ts` |

### Data Flow

```
Filesystem ──→ File Watcher ──→ Event Bus ──→ IPC Stream ──→ Zustand Stores ──→ React UI
                                    │
Claude Code CLI ──→ Agent Harness ──┘
                                    │
Git Repo ──→ Git Service ───────────┘
                                    │
Documents ──→ Drift Engine ─────────┘
                 │
                 └──→ LLM Service (Claude API)
```

## Architecture Validation

### Gap Resolution

5 gaps critiques identifiés lors de la validation de couverture, tous résolus par amendement du document.

#### GAP-1 : Agent Chat Viewer (FR4)

**Problème :** Aucun composant ni canal IPC pour afficher l'historique de chat d'un agent et naviguer vers un checkpoint depuis la timeline.

**Résolution :**

- Service `chat-segmenter.ts` : segmente le stdout brut d'un agent en `ChatEntry[]` (rôle, contenu, checkpoint, timestamp) en parsant les marqueurs Claude Code
- IPC `agent:get-chat` : retourne l'historique chat segmenté d'un agent (avec filtre par checkpoint)
- Stream `stream:agent-chat` : push en temps réel des nouvelles entrées chat
- Composant `AgentChatViewer.tsx` : affiche le chat, scroll-to-checkpoint quand l'utilisateur clique sur la timeline
- Hook `useAgentChat.ts` : combine invoke initial + stream pour l'état chat live

```typescript
// src/shared/types/chat.types.ts
type ChatEntry = {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  checkpoint?: string;  // Identifiant correspondant au checkpoint timeline
  timestamp: number;
};
```

#### GAP-2 : BMAD Story Parser (FR23)

**Problème :** Aucun service pour parser les fichiers story BMAD et calculer l'avancement.

**Résolution :**

- Service `story-parser.ts` dans `services/project/` : lit les fichiers Markdown BMAD, extrait les listes de tâches (`- [ ]` / `- [x]`), calcule le ratio complétées/totales
- IPC `stories:list` : retourne la liste des stories avec avancement
- Composant `StoriesProgress.tsx` dans `features/dashboard/` : affiche les stories avec barres de progression
- Hook `useStoriesProgress.ts` : appelle `stories:list` et écoute les `file:changed` pour rafraîchir

```typescript
// src/shared/types/story.types.ts
type StoryProgress = {
  id: string;
  title: string;
  filePath: string;
  tasksTotal: number;
  tasksCompleted: number;
  ratio: number;  // 0.0 à 1.0
};
```

#### GAP-3 : Workflow Serializer (FR31)

**Problème :** Le parser workflow est unidirectionnel (fichier → graph). Pas de sérialiseur pour sauvegarder les modifications visuelles.

**Résolution :**

- `yaml-serializer.ts` : convertit un `WorkflowGraph` en YAML conforme au format BMAD
- `xml-serializer.ts` : convertit un `WorkflowGraph` en XML (format BPMN-like)
- IPC `workflow:save` : reçoit le graph modifié, appelle le sérialiseur approprié selon le format source, écrit le fichier
- Le format cible est déterminé par le format source du fichier chargé (YAML in → YAML out)

```typescript
// Dans services/workflow-parser/yaml-serializer.ts
function serializeToYaml(graph: WorkflowGraph): string;

// Dans services/workflow-parser/xml-serializer.ts
function serializeToXml(graph: WorkflowGraph): string;
```

#### GAP-4 : Workflow Execution Tracking (FR32)

**Problème :** Aucun mécanisme pour suivre l'exécution en cours d'un workflow et mettre en évidence le noeud actif.

**Résolution :**

- Event `workflow:node-status` dans le bus principal : émis quand un noeud change d'état
- Stream `stream:workflow-node` : push vers le renderer
- Le `WorkflowEditor.tsx` consomme ce stream et applique un style visuel (classe CSS `node-active`, `node-done`, `node-error`) aux noeuds React Flow
- La corrélation agent ↔ noeud est faite dans le `event-correlator.ts` (un agent qui exécute une tâche correspondant à un step workflow met à jour le noeud)

```typescript
// Corrélation dans event-correlator.ts
// Quand un agent:status change → vérifier si l'agent est lié à un noeud workflow → émettre workflow:node-status
```

#### GAP-5 : Test Runner Service (FR36)

**Problème :** Aucun service pour lancer l'exécution de tests ni mapper les specs aux tests.

**Résolution :**

- Service `test-runner.service.ts` : spawn `vitest` (ou commande configurable dans `.mnm/settings.json`) en subprocess, parse la sortie pour extraire les résultats
- `spec-mapper.ts` : mapping convention-based entre specs BMAD et tests (convention : fichier test nommé d'après l'ID de la spec, ex: `FR12.test.ts`)
- IPC `test:run` : lance un run de tests (scope configurable)
- IPC `test:list` : liste les tests trouvés (optionnellement filtrés par spec)
- Stream `stream:test-result` : push les résultats au fur et à mesure de l'exécution

```typescript
// src/shared/types/test.types.ts
type TestInfo = {
  id: string;
  name: string;
  filePath: string;
  specId?: string;     // ID de la spec BMAD associée (convention-based)
  scope: 'unit' | 'integration' | 'e2e';
};

type TestRunResult = {
  testId: string;
  status: 'pass' | 'fail' | 'pending';
  duration: number;
  output?: string;     // Sortie de test en cas d'échec
};
```

### Coherence Validation

| Vérification | Résultat |
|---|---|
| Compatibilité technologique | Electron 40 + React 19 + Vite 5 + Zustand 5 + Tailwind 4 — tous compatibles |
| Décisions non-contradictoires | Aucune contradiction entre les 6 décisions + 5 amendements |
| Patterns ↔ Structure | Conventions de nommage respectées pour tous les nouveaux fichiers |
| Flux de données | Tous les nouveaux IPC/events s'inscrivent dans le pattern existant |
| Couverture FR | 28 couverts + 5 gaps résolus = 33 couverts (56%), 22 partiels (37%), 4 N/A (7%) |

### Coverage Summary Post-Amendment

| Catégorie | Avant | Après |
|---|---|---|
| **Couverts** | 28 (47.5%) | 33 (56%) |
| **Partiels** | 22 (37.3%) | 22 (37%) |
| **Gaps critiques** | 5 (8.5%) | 0 (0%) |
| **N/A** | 4 (6.8%) | 4 (7%) |

Les 22 partiels restants sont des détails d'implémentation (heuristiques de blocage, seuils configurables, abstraction OS) qui seront précisés dans les stories d'implémentation. Aucun n'est bloquant pour le démarrage du développement.
