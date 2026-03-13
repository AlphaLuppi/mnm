# MnM — Architecture Document

**Version**: 4.0 — Framework Agnostic
**Date**: 2026-03-11

---

## 1. Architecture Overview

MnM est un fork de Paperclip AI. L'architecture est héritée : monorepo Node.js avec un serveur Express, une UI React, et des packages partagés.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ CompanyRail   │  │ Sidebar      │  │ 3-Pane    │ │
│  │ (navigation)  │  │ (navigation) │  │ Cockpit   │ │
│  │               │  │              │  │           │ │
│  │               │  │ Dashboard    │  │ Context   │ │
│  │               │  │ Issues       │  │ Work      │ │
│  │               │  │ Agents       │  │ Tests     │ │
│  │               │  │ Projects →   │  │           │ │
│  │               │  │ Workflows    │  │ Timeline  │ │
│  │               │  │ Costs        │  │           │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                     │
│  React 19 + Vite + TanStack Query + Tailwind        │
│  shadcn/ui + WebSocket (live events)                 │
└─────────────────────────┬───────────────────────────┘
                          │ REST API + WebSocket
┌─────────────────────────┴───────────────────────────┐
│                  Server (Express)                    │
│                                                     │
│  Routes: /api/projects, /api/agents,                │
│          /api/projects/:id/workspace-context        │
│  Services: workspace-analyzer, drift, watcher,      │
│            heartbeat, agents, projects, costs        │
│  Realtime: WebSocket (live-events-ws)               │
│  Auth:     better-auth (sessions, roles)            │
│  Adapters: claude-local, codex-local, cursor, ...   │
│                                                     │
│  Express + Drizzle ORM + embedded/external Postgres  │
└─────────────────────────────────────────────────────┘
```

## 2. Monorepo Structure

```
mnm/
├── server/src/
│   ├── routes/
│   │   ├── workspace-context.ts  # [MnM] Context panel + workflows + agents
│   │   ├── projects.ts           # [MnM+] Onboarding, cascade delete
│   │   └── ...                   # [INHERITED]
│   ├── services/
│   │   ├── workspace-analyzer.ts # [MnM] config.yaml parser + story reader
│   │   ├── workspace-context-watcher.ts  # [MnM] fs.watch sur _mnm-context/
│   │   ├── drift.ts              # [MnM] LLM drift detection
│   │   ├── heartbeat.ts          # [INHERITED] Agent execution engine
│   │   ├── agents.ts             # [INHERITED+] scopedToWorkspaceId
│   │   ├── projects.ts           # [INHERITED+] workspace management
│   │   └── ...
│   └── scripts/dev-runner.mjs    # [MnM] Kill stale postgres + port avant démarrage
├── ui/src/
│   ├── pages/
│   │   ├── ProjectDetail.tsx     # [MnM] 3-pane cockpit + Properties panel
│   │   └── ...
│   ├── components/
│   │   ├── ThreePaneLayout.tsx   # [MnM] Layout 3 volets redimensionnable
│   │   ├── ContextPane.tsx       # [MnM] Volet gauche — arbre planning/stories
│   │   ├── WorkPane.tsx          # [MnM] Volet central — viewer + agents
│   │   ├── TestsPane.tsx         # [MnM] Volet droit — ACs/tests
│   │   ├── PropertiesPanel.tsx   # [MnM] Panneau properties avec footer sticky
│   │   ├── ProjectProperties.tsx # [MnM] Workspaces, goals, onboarding
│   │   ├── DeleteProjectFooter   # [MnM] Exporté depuis ProjectProperties
│   │   ├── WorkspaceAgentSync.tsx# [MnM] Onboarding agents 2 étapes
│   │   ├── LaunchAgentDialog.tsx # [MnM+] Pré-sélection agent via assignments
│   │   └── ...
│   └── context/
│       ├── PanelContext.tsx      # [MnM+] openPanel(content, footer?)
│       ├── ProjectNavigationContext.tsx  # [MnM] Sync 3 volets
│       └── ...
├── packages/
│   ├── shared/src/types/
│   │   ├── workspace-context.ts  # [MnM] WorkspaceContext, WorkspaceEpic, etc.
│   │   ├── drift.ts              # [MnM] DriftReport, DriftItem
│   │   └── ...                   # [INHERITED]
│   └── db/src/schema/            # [INHERITED] Tables Paperclip
├── _mnm-context/                 # Config du context panel (config.yaml)
├── _bmad-output/                 # Docs de planning MnM (PRD, archi, stories)
└── .claude/commands/             # Workflows BMAD pour le dev MnM lui-même
```

## 3. Context Panel — Data Flow

```
_mnm-context/config.yaml
    ↓ yaml.load()
workspace-analyzer.ts (analyzeWorkspace)
    ↓ fs.readFile() sur les vrais fichiers du projet
    ↓ REST API
GET /api/projects/:id/workspace-context
    ↓ TanStack Query (invalidé par live event bmad.workspace.changed)
ContextPane + WorkPane + TestsPane
```

### Format config.yaml
```yaml
planning:
  - path: README.md           # relatif à workspace root
    type: product-brief
  - path: docs/prd.md
    type: prd
    group: specs              # groupement visuel optionnel
stories:
  - path: epics/1-1-auth.md   # fichier réel
    epic: 1
    story: 1
    epicTitle: Authentication
sprint_status:
  path: .bmad/sprint-status.yaml
```

**Règle** : pas de fallback. Si `config.yaml` absent → panel vide.

## 4. Onboarding Flow

```
User clique "Découvrir le workspace"
    ↓
POST /api/projects/:id/onboard { agentId? }
    ↓ crée une issue assignée au CEO (ou agent passé)
    ↓ prompt 4 étapes :
       1. Explorer workspace librement (tout format, tout dossier)
       2. Créer agents scoped (scopedToWorkspaceId obligatoire)
          POST /api/companies/:cid/agents
       3. Sauvegarder workflow assignments
          POST /api/projects/:id/workspace-context/assignments
       4. Écrire _mnm-context/config.yaml (pointer vers vrais fichiers, ne PAS copier)
    ↓ Agent travaille dans Claude Code
    ↓ File watcher détecte config.yaml créé
    ↓ Live event → Context Panel se peuple
```

## 5. Agents Architecture

### Scoped agents
- `agents.scopedToWorkspaceId = null` → agent global (visible partout)
- `agents.scopedToWorkspaceId = workspaceId` → agent scoped (visible dans ce projet uniquement)
- Créés par l'onboarding, configurés pour le framework du workspace

### Workflow assignments
Persistés dans `projectWorkspaces.metadata.bmadAssignments`:
```json
{ "dev": "agent-uuid-1", "sm": "agent-uuid-2", "default": "agent-uuid-3" }
```
`LaunchAgentDialog` lit ces assignments pour pré-sélectionner l'agent.

### Cascade delete projet
`DELETE /projects/:id` :
1. Supprime les agents scoped à chaque workspace du projet
2. Supprime toutes les issues (+ comments, read states, nullifie cost events)
3. Supprime le projet

## 6. Properties Panel

### PanelContext (`ui/src/context/PanelContext.tsx`)
```typescript
openPanel(content: ReactNode, footer?: ReactNode)
// content → ScrollArea (scrollable)
// footer → div sticky en bas (toujours visible)
```

### Usage dans ProjectDetail
```tsx
openPanel(
  <ProjectProperties project={project} onUpdate={...} />,
  <DeleteProjectFooter project={project} />,
);
```

## 7. API Endpoints (MnM additions)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/:id/workspace-context` | Context panel data (lit config.yaml) |
| GET | `/api/projects/:id/workspace-context/file?path=` | Fichier brut (relatif workspace root) |
| GET | `/api/projects/:id/workspace-context/workflows` | Workflows depuis `.claude/commands/` |
| GET | `/api/projects/:id/workspace-context/agents` | Agents découverts dans le workspace |
| POST | `/api/projects/:id/workspace-context/import-agents` | Crée agents MnM scoped |
| GET | `/api/projects/:id/workspace-context/assignments` | Lit bmadAssignments |
| POST | `/api/projects/:id/workspace-context/assignments` | Sauvegarde assignments |
| GET | `/api/projects/:id/workspace-context/command?name=` | Fichier depuis `.claude/commands/` |
| POST | `/api/projects/:id/workspace-context/drift-check` | Drift entre 2 fichiers |
| POST | `/api/projects/:id/onboard` | Lance l'agent de découverte |
| DELETE | `/api/projects/:id` | Suppression en cascade |

## 8. Shared Types (`packages/shared`)

```typescript
// workspace-context.ts
WorkspaceContext        // detected, planningArtifacts, epics, sprintStatus
WorkspaceEpic           // number, title, status, stories[], progress
WorkspaceStory          // id, epicNumber, storyNumber, title, status, filePath, ...
PlanningArtifact        // title, type, filePath (relatif workspace root)
SprintStatus            // project, statuses: Record<string, string>
AcceptanceCriterion     // id, title, given, when, then[]
WorkspaceTask           // label, done
```

## 9. Security

- File API : `path.resolve(workspacePath, filePath)` doit rester dans `workspacePath` (reject `..`, paths absolus)
- Tous les endpoints requirent authentication (hérité Paperclip)
- Drift detection utilise les clés LLM configurées par la company

## 10. Dev Runner (`scripts/dev-runner.mjs`)

Au démarrage :
1. Kill tous les `postgres.exe` (Windows) / process du PID file (Unix) → attend 800ms
2. Kill le process tenant le port 3100 (`netstat -ano` Windows / `lsof` Unix)
3. Supprime `postmaster.pid` si présent
4. Lance `pnpm --filter @mnm/server dev` avec env vars dev

## 11. Inherited Paperclip Components (DO NOT REBUILD)

| Component | Purpose |
|---|---|
| `Layout.tsx` | App shell avec rail + sidebar + content |
| `Sidebar.tsx` | Navigation |
| `LiveRunWidget.tsx` | Real-time agent output |
| `ActiveAgentsPanel.tsx` | Agents en cours |
| `StatusBadge.tsx` | Status indicators |
| `MarkdownBody.tsx` | Markdown renderer |
| `KanbanBoard.tsx` | Issue board |
| `OnboardingWizard.tsx` | First-time setup |
| `CommandPalette.tsx` | Cmd+K search |
