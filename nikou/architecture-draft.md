# MnM - Architecture Draft
## IDE pour le Développement Agentique

**Date :** 2026-02-19  
**Status :** Draft initial - En attente du retour BMAD

---

## 🎯 Principes Architecturaux

### 1. Agent-First Design
L'architecture entière est centrée sur les agents de coding, pas sur l'édition manuelle de code.

**Implications :**
- L'éditeur de texte est un composant secondaire (view-only ou minimal editing)
- Le diff viewer et change reviewer sont des composants primaires
- Le contexte agent est géré explicitement par l'IDE
- Les sessions agent sont des first-class objects

### 2. Extensibilité par Design
Support natif pour Claude Code + BMAD, mais architecture ouverte.

**Plugin Interface :**
```typescript
interface AgenticFramework {
  // Lifecycle
  spawn(task: Task, context: WorkspaceContext): Promise<AgentSession>;
  terminate(session: AgentSession): Promise<void>;
  
  // Communication
  sendMessage(session: AgentSession, message: string): Promise<void>;
  subscribeToChanges(session: AgentSession, callback: (changes: FileChange[]) => void): void;
  
  // State
  getSession State(session: AgentSession): SessionState;
  getContext(session: AgentSession): FileContext[];
  
  // Changes
  proposeChanges(session: AgentSession): Promise<FileChange[]>;
  applyChanges(changes: FileChange[]): Promise<ApplyResult>;
  rollbackChanges(changes: FileChange[]): Promise<void>;
}
```

### 3. Human-in-the-Loop
L'autonomie des agents doit être balancée par le contrôle humain.

**Review Granularity Levels :**
- **File-level** : Approve/Reject par fichier
- **Chunk-level** : Approve/Reject par bloc de changements logiques
- **Line-level** : Édition fine si nécessaire
- **Batch-level** : Approve tout d'un coup (pour changements de confiance)

### 4. Multi-Agent Coordination
Support natif pour plusieurs agents travaillant en parallèle.

**Conflict Management :**
- Détection automatique de conflits entre agents
- Stratégies de merge configurables
- Isolation des workspaces (agents ne se marchent pas dessus)
- Serialization des changements si nécessaire

---

## 🏗️ System Components

### Core Layer

#### 1. Agent Manager
**Responsabilités :**
- Spawn/terminate agent sessions
- Monitor agent health and progress
- Route messages entre UI et agents
- Manage agent lifecycle (pause, resume, cancel)

**State :**
```typescript
interface AgentSession {
  id: string;
  framework: AgenticFramework;
  task: Task;
  status: 'spawning' | 'thinking' | 'coding' | 'waiting_approval' | 'applying' | 'error' | 'terminated';
  context: FileContext[];
  proposedChanges: FileChange[];
  appliedChanges: FileChange[];
  conversation: Message[];
  metadata: {
    tokensUsed: number;
    timeElapsed: number;
    filesModified: number;
  };
}
```

#### 2. Change Manager
**Responsabilités :**
- Receive proposed changes from agents
- Present changes for human review
- Apply approved changes
- Track change history
- Rollback capabilities

**Operations :**
- `proposeChanges(agent: AgentSession, changes: FileChange[])`
- `reviewChanges(changes: FileChange[], reviewer: Human)`
- `applyChanges(approved: FileChange[])`
- `rollback(changeSet: ChangeSet)`

#### 3. Context Manager
**Responsabilités :**
- Manage what files/context each agent sees
- Enforce workspace boundaries
- Track token usage per agent
- Optimize context for agent efficiency

**Features :**
- Explicit context control (add/remove files from agent view)
- Auto-suggest relevant files based on task
- Context budget tracking (token limits)
- Context diff visualization (what changed in agent's view)

#### 4. Conflict Resolver
**Responsabilités :**
- Detect conflicts between concurrent agents
- Present merge options to user
- Execute merge strategies
- Prevent corruption from overlapping changes

**Strategies :**
- **Sequential** : Serialize agent changes (safest)
- **Parallel with detection** : Allow parallel, detect & resolve conflicts
- **Optimistic** : Apply first, rollback if conflict
- **Custom** : User-defined merge logic

---

### UI Layer

#### 1. Agent Dashboard
**Primary view** - Show all active agent sessions

**Features :**
- Card per agent session
- Status indicators (thinking, coding, waiting, error)
- Progress visualization
- Quick actions (pause, cancel, review changes)
- Resource usage (tokens, time, files touched)

#### 2. Change Review Panel
**Critical component** - Where human oversight happens

**Features :**
- Side-by-side diff viewer
- Syntax highlighting
- Inline comments on changes
- Approve/Reject per file or chunk
- "Approve with edits" mode
- Change categorization (refactor, bug fix, feature, etc.)

#### 3. Task/Intent Input
**Where developers describe what they want**

**Features :**
- Natural language task description
- Task templates for common operations
- Task history and favorites
- Context pre-selection (which files agent should see)
- Agent selection (which framework/model to use)

#### 4. Context Viewer
**Visualize agent's view of the codebase**

**Features :**
- File tree with "in context" indicators
- Token budget visualization
- Relevance scoring (which files matter most for task)
- Manual context adjustment (drag & drop files in/out)

#### 5. Minimal Code Editor
**For quick manual edits or post-agent tweaks**

**Features :**
- Syntax highlighting
- Basic LSP support
- Read-mostly mode (discourage heavy manual editing)
- "Switch to agent" button (delegate editing back to agent)

---

### Integration Layer

#### 1. Git Integration
**How changes interact with version control**

**Options :**
- **Auto-commit** : Each approved changeset becomes a commit
- **Manual commit** : User commits when ready
- **Branch per agent** : Each agent works on its own branch
- **Stash management** : Easy rollback via git stash

#### 2. Testing Integration
**Validation before applying changes**

**Features :**
- Auto-run tests after changes proposed
- Test status in change review UI
- Block approval if tests fail (configurable)
- Performance regression detection

#### 3. Language Server Integration
**For syntax/semantic validation**

**Purpose :**
- Validate agent changes before applying
- Provide context to agents (definitions, references)
- Catch obvious errors early

#### 4. CI/CD Integration
**Continuous validation**

**Features :**
- Trigger CI on approved changes
- Show CI status in UI
- Rollback on CI failure (optional)

---

## 📊 Data Flow

### Typical Workflow

1. **User** defines task in Task Input panel
2. **Agent Manager** spawns agent session with selected framework
3. **Context Manager** provides initial context to agent
4. **Agent** analyzes, thinks, proposes changes
5. **Change Manager** receives proposed changes
6. **UI** displays changes in Review Panel
7. **User** reviews, approves/rejects/edits
8. **Testing Integration** runs tests on approved changes
9. **Change Manager** applies approved changes if tests pass
10. **Git Integration** (optionally) commits changes
11. **Agent Manager** terminates or continues agent session

### Multi-Agent Flow

1. **User** defines multiple tasks
2. **Agent Manager** spawns multiple agent sessions
3. **Context Manager** partitions context (if possible)
4. **Agents** work in parallel
5. **Conflict Resolver** monitors for overlapping changes
6. **Change Manager** sequences or merges changes
7. Rest of flow continues as single-agent

---

## 🔧 Technical Challenges & Solutions

### Challenge 1: Agent Communication Protocol

**Problem :** Different agentic frameworks have different APIs and communication patterns.

**Solution :** 
- Abstract interface (`AgenticFramework`)
- Adapters for each framework (Claude Code adapter, BMAD adapter, etc.)
- Standardized message format internally

### Challenge 2: Real-time Change Preview

**Problem :** Showing diffs before applying while agent is still thinking.

**Solution :**
- Stream changes as agent produces them
- Virtual filesystem layer for preview
- Apply changes only on approval

### Challenge 3: Context Window Management

**Problem :** Large codebases don't fit in agent context.

**Solution :**
- Intelligent context selection (relevance scoring)
- Context caching (reuse across sessions)
- User-guided context (manual file selection)
- Multi-hop context (agent can request more files dynamically)

### Challenge 4: Multi-Agent Conflicts

**Problem :** Two agents modifying the same file simultaneously.

**Solution :**
- Lock-based approach (first agent gets exclusive access)
- CRDT-like merge (operational transformation)
- Human arbitration (show both changes, let user decide)

### Challenge 5: Trust & Safety

**Problem :** Agents could make dangerous changes (delete files, expose secrets).

**Solution :**
- Sandboxing (agents can't execute arbitrary commands)
- Change whitelisting (only allow certain file patterns)
- Audit log (track all agent actions)
- Rollback always available

---

## 🚀 Implementation Phases

### Phase 1: MVP (Claude Code + BMAD only)
- Single agent session support
- Basic change review UI
- Manual context selection
- File-level approve/reject
- Git commit integration

### Phase 2: Multi-Agent
- Parallel agent sessions
- Conflict detection
- Sequential merge strategy
- Agent dashboard

### Phase 3: Extensibility
- Plugin system
- Framework adapter interface
- Custom agent integration
- Community plugins

### Phase 4: Intelligence
- Auto context selection
- Task templates
- Change categorization
- Performance optimization

---

## 💡 Open Questions

1. **Platform :** Native macOS app ou cross-platform (Electron/Tauri) ?
2. **Agent hosting :** Local processes ou remote API calls ?
3. **State persistence :** How to save/restore agent sessions ?
4. **Collaboration :** Support for multiple human users ?
5. **Performance :** How to handle very large codebases ?

---

*Document évolutif - Sera enrichi par les retours BMAD et les discussions avec Nikou*
