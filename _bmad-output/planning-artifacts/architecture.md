---
date: 2026-02-19
author: Daedalus (System Architect)
version: 1.0
status: Final
inputDocuments:
  - product-brief-mnm-2026-02-18.md
  - prd.md
approvedBy: Tom (Product Lead)
---

# MnM System Architecture

## Document Overview

This document defines the complete system architecture for **MnM** — a Product-First Agile Development Environment built in Rust/GPUI. The architecture prioritizes:

1. **GPU-accelerated performance** (120+ FPS UI)
2. **Multi-agent orchestration** with conflict prevention
3. **Intelligent drift detection** between specs and code
4. **Local-first data model** (no cloud dependencies)
5. **Extensibility** for future agent framework support

**Key Architectural Decisions:**
- Zed-inspired stack (Rust + GPUI + SQLite + git2-rs)
- Pre-work file locking for multi-agent conflict prevention
- Hybrid drift detection (git diff + Claude API + custom instructions)
- Cargo workspace structure for modularity
- IPC-based Claude Code integration via subprocess

---

## 1. System Overview

### 1.1 High-Level Architecture

MnM is a **native desktop application** with three core subsystems:

```
┌─────────────────────────────────────────────────────────────┐
│                     MnM Application                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   UI Layer  │  │ Core Engine  │  │ Agent Runtime    │  │
│  │   (GPUI)    │◄─┤  (Business   │◄─┤  (Claude Code    │  │
│  │             │  │   Logic)     │  │   IPC Bridge)    │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│         ▲                ▲                      ▲           │
│         │                │                      │           │
│         ▼                ▼                      ▼           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Component  │  │    State     │  │   Data Layer     │  │
│  │  Registry   │  │  Management  │  │   (SQLite)       │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Git Repository      │
              │  (Source of Truth)    │
              └───────────────────────┘
```

### 1.2 Core Workflows

**Workflow 1: Agent Launch & Orchestration**
1. User browses specs in UI (stories, FRs, architecture)
2. User selects spec → launches agent(s)
3. Agent declares file scope (pre-work lock)
4. MnM spawns Claude Code subprocess + IPC channel
5. Agent executes, logs stream to UI
6. On completion, drift detection runs automatically

**Workflow 2: Drift Detection**
1. Agent completes work on story
2. MnM compares git diff against spec content
3. Claude API analyzes semantic drift
4. UI displays drift summary + actionable recommendations
5. User accepts (update spec) or rejects (create remediation task)
6. Decision logged in SQLite + git history

**Workflow 3: Spec Change Awareness**
1. User runs `git checkout` / `git fetch` / `git pull`
2. Git hook triggers MnM change detection
3. MnM diffs important files (PRD, product brief, architecture, stories)
4. Claude API generates natural language summary
5. UI displays notification: "3 important files changed"
6. User reviews changes and updates context

### 1.3 Data Flow

```
Specs (Git) → AI Analysis → Important Files Config (.mnm/)
                                       ↓
User Action → Agent Launch → IPC → Claude Code Subprocess
                                       ↓
                              Code Changes (Git)
                                       ↓
                          Drift Detection (Claude API)
                                       ↓
                        Drift Summary (UI) → User Decision
                                       ↓
                            Update Spec OR Recenter Code
```

### 1.4 External Dependencies

| Dependency | Purpose | Integration Method |
|------------|---------|-------------------|
| **Git** | Source of truth for specs + code | `git2-rs` (libgit2 bindings) |
| **Claude API** | Drift analysis + spec change summarization | HTTPS API calls |
| **Claude Code** | Agent runtime (TDD, dev, E2E, review) | Subprocess spawn + stdout/stderr capture |
| **SQLite** | Local state + drift history | `sqlez` or `rusqlite` |
| **GPUI** | GPU-accelerated UI framework | Direct crate dependency |

---

## 2. Technical Stack

### 2.1 Stack Decisions & Justifications

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Language** | Rust | Memory safety, performance, GPUI ecosystem |
| **UI Framework** | GPUI 0.2.2 | GPU-accelerated rendering (120+ FPS), Zed-proven, native feel |
| **UI Components** | gpui-component 0.5.1 | Pre-built components (buttons, panels, inputs) |
| **Database** | SQLite via `sqlez` or `rusqlite` | Local-first, no server, Zed-proven, simple schema |
| **Git Integration** | git2-rs (libgit2) | Safe Rust bindings, comprehensive API, Zed-proven |
| **State Management** | GPUI built-in | Reactive state via `Model<T>`, no external state lib needed |
| **Build System** | Cargo workspace | Multi-crate modularity, shared dependencies |
| **Platform** | macOS (MVP) | GPUI cross-platform exists but MVP scope limited |
| **License** | Apache 2.0 | GPUI-compatible, permissive |

### 2.2 Boring Technology Principle

**Why Zed-inspired stack?**
- **Proven in production**: Zed uses this exact stack for a high-performance code editor
- **No invention**: SQLite, git2-rs, GPUI are mature and battle-tested
- **Performance guaranteed**: GPUI delivers 120+ FPS rendering without custom optimization
- **Risk reduction**: No experimental frameworks, no greenfield UI libs

**Alternatives Considered & Rejected:**

| Alternative | Reason for Rejection |
|-------------|---------------------|
| **Tauri + React** | Webview overhead, cannot hit 120 FPS target |
| **Electron** | Memory bloat, slow startup, not Rust-native |
| **egui** | CPU-rendered, cannot compete with GPUI performance |
| **VS Code Extension** | Cannot control full UX, limited to VS Code constraints |
| **Custom WGPU UI** | High risk, requires inventing UI framework from scratch |

### 2.3 Version Constraints

| Dependency | Version | Lock Strategy |
|------------|---------|---------------|
| `gpui` | `0.2.2` | Exact pin (breaking changes likely) |
| `gpui-component` | `0.5.1` | Minor updates allowed (`^0.5`) |
| `git2` | Latest stable (`~0.19`) | Minor updates allowed |
| `rusqlite` or `sqlez` | Latest stable | Patch updates allowed |
| `tokio` | `1.x` | Major version locked |
| `serde` | `1.x` | Major version locked |

**Rust Toolchain:** `stable` (no nightly required)

---

## 3. Data Model (SQLite Schema)

### 3.1 Database Location

`.mnm/state.db` — SQLite file within repository root (git-ignored)

### 3.2 Schema Design

#### Table: `agents`
Tracks agent lifecycle and metadata.

```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY,              -- UUID v4
    name TEXT NOT NULL,               -- Human-readable name (e.g., "TDD Agent")
    status TEXT NOT NULL,             -- idle | running | paused | completed | error
    spec_id TEXT,                     -- FK to specs.id
    scope TEXT,                       -- JSON array of file paths
    started_at INTEGER,               -- Unix timestamp
    completed_at INTEGER,             -- Unix timestamp (NULL if running)
    error_message TEXT,               -- NULL if no error
    created_at INTEGER NOT NULL,      -- Unix timestamp
    updated_at INTEGER NOT NULL       -- Unix timestamp
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_spec ON agents(spec_id);
```

#### Table: `specs`
Tracks spec files and their metadata.

```sql
CREATE TABLE specs (
    id TEXT PRIMARY KEY,              -- SHA256 hash of file path
    file_path TEXT NOT NULL UNIQUE,   -- Relative path from repo root
    spec_type TEXT NOT NULL,          -- product_brief | prd | story | architecture | config
    title TEXT,                       -- Extracted from document (e.g., "FR1: Agent Dashboard")
    last_modified INTEGER NOT NULL,   -- Unix timestamp from git
    git_commit_sha TEXT,              -- Last commit that modified this file
    content_hash TEXT NOT NULL,       -- SHA256 of file content for change detection
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_specs_type ON specs(spec_type);
CREATE INDEX idx_specs_path ON specs(file_path);
```

#### Table: `drift_detections`
Stores drift analysis results.

```sql
CREATE TABLE drift_detections (
    id TEXT PRIMARY KEY,              -- UUID v4
    agent_id TEXT NOT NULL,           -- FK to agents.id
    spec_id TEXT NOT NULL,            -- FK to specs.id
    severity TEXT NOT NULL,           -- minor | moderate | critical
    drift_type TEXT NOT NULL,         -- scope_expansion | approach_change | design_deviation
    summary TEXT NOT NULL,            -- AI-generated summary
    recommendation TEXT NOT NULL,     -- "update_spec" | "recenter_code"
    diff_content TEXT,                -- Git diff (optional, can be large)
    user_decision TEXT,               -- accepted | rejected | pending
    decided_at INTEGER,               -- Unix timestamp (NULL if pending)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (spec_id) REFERENCES specs(id)
);

CREATE INDEX idx_drift_agent ON drift_detections(agent_id);
CREATE INDEX idx_drift_spec ON drift_detections(spec_id);
CREATE INDEX idx_drift_decision ON drift_detections(user_decision);
```

#### Table: `file_locks`
Pre-work file locking for multi-agent conflict prevention.

```sql
CREATE TABLE file_locks (
    id TEXT PRIMARY KEY,              -- UUID v4
    file_path TEXT NOT NULL,          -- Relative path from repo root
    agent_id TEXT NOT NULL,           -- FK to agents.id
    lock_type TEXT NOT NULL,          -- read | write
    acquired_at INTEGER NOT NULL,     -- Unix timestamp
    released_at INTEGER,              -- Unix timestamp (NULL if still locked)
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX idx_locks_file ON file_locks(file_path, released_at);
CREATE INDEX idx_locks_agent ON file_locks(agent_id);
```

#### Table: `important_files`
AI-detected important spec files.

```sql
CREATE TABLE important_files (
    id TEXT PRIMARY KEY,              -- UUID v4
    file_path TEXT NOT NULL UNIQUE,   -- Relative path from repo root
    file_type TEXT NOT NULL,          -- product_brief | prd | architecture | story | config
    detected_at INTEGER NOT NULL,     -- Unix timestamp
    user_confirmed BOOLEAN DEFAULT 0, -- User reviewed and confirmed
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_important_type ON important_files(file_type);
```

#### Table: `spec_changes`
Git-driven spec change log.

```sql
CREATE TABLE spec_changes (
    id TEXT PRIMARY KEY,              -- UUID v4
    file_path TEXT NOT NULL,          -- Relative path from repo root
    old_commit_sha TEXT,              -- Previous commit SHA
    new_commit_sha TEXT NOT NULL,     -- New commit SHA
    change_summary TEXT NOT NULL,     -- AI-generated summary
    detected_at INTEGER NOT NULL,     -- Unix timestamp
    user_viewed BOOLEAN DEFAULT 0,    -- User acknowledged the change
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_changes_file ON spec_changes(file_path);
CREATE INDEX idx_changes_viewed ON spec_changes(user_viewed);
```

### 3.3 Database Migrations

**Strategy:** Embedded SQL migrations in Rust code (no external migration tool).

```rust
// migrations/mod.rs
pub const MIGRATIONS: &[&str] = &[
    include_str!("001_create_agents.sql"),
    include_str!("002_create_specs.sql"),
    include_str!("003_create_drift_detections.sql"),
    include_str!("004_create_file_locks.sql"),
    include_str!("005_create_important_files.sql"),
    include_str!("006_create_spec_changes.sql"),
];
```

**Migration Tracker:**

```sql
CREATE TABLE _migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);
```

On startup, MnM checks `_migrations` and applies missing migrations sequentially.

### 3.4 Data Lifecycle

- **Agents**: Persist indefinitely (for history), but UI can filter to "active" agents
- **Drift Detections**: Persist indefinitely (audit trail)
- **File Locks**: Released locks can be purged after 30 days
- **Spec Changes**: Persist indefinitely (change log)

---

## 4. Component Architecture (Crates Breakdown)

### 4.1 Cargo Workspace Structure

```
mnm/
├── Cargo.toml              # Workspace root
├── crates/
│   ├── mnm-core/           # Business logic, domain models
│   ├── mnm-ui/             # GPUI UI components and rendering
│   ├── mnm-agent/          # Agent orchestration and IPC
│   ├── mnm-drift/          # Drift detection engine
│   ├── mnm-git/            # Git integration (git2-rs wrapper)
│   ├── mnm-db/             # SQLite persistence layer
│   ├── mnm-spec/           # Spec parsing and indexing
│   └── mnm-cli/            # CLI entry point (if needed)
├── _bmad/                  # BMAD workflow (not compiled)
├── _bmad-output/           # Planning artifacts (not compiled)
└── .mnm/                   # Runtime state (git-ignored)
    ├── state.db            # SQLite database
    └── important-files.json # AI-detected important files (git-tracked)
```

### 4.2 Crate Responsibilities

#### `mnm-core`
**Purpose:** Business logic, domain models, core types.

**Exports:**
- `Agent` struct (id, name, status, scope, etc.)
- `Spec` struct (id, file_path, spec_type, content_hash, etc.)
- `DriftDetection` struct (severity, drift_type, summary, recommendation)
- `FileLock` struct (file_path, agent_id, lock_type)
- Enums: `AgentStatus`, `SpecType`, `DriftSeverity`, `DriftType`, `LockType`

**Dependencies:**
- `serde` (serialization)
- `uuid` (ID generation)
- `chrono` (timestamps)

**No dependencies on:** UI, DB, Git (pure domain logic)

#### `mnm-ui`
**Purpose:** GPUI-based UI components and rendering.

**Exports:**
- `App` struct (root GPUI app)
- `DashboardView` (agent dashboard)
- `SpecBrowserView` (spec navigation)
- `DriftAlertView` (drift summary + actions)
- `SpecChangeView` (git change notifications)
- UI primitives (buttons, panels, modals) via `gpui-component`

**Dependencies:**
- `gpui = "0.2.2"`
- `gpui-component = "0.5.1"`
- `mnm-core` (domain models)
- `mnm-agent` (agent state for dashboard)
- `mnm-drift` (drift data for alerts)

**State Management:** GPUI `Model<T>` for reactive UI updates.

#### `mnm-agent`
**Purpose:** Agent orchestration, IPC bridge to Claude Code.

**Exports:**
- `AgentOrchestrator` (manages agent lifecycle)
- `ClaudeCodeBridge` (subprocess spawn + IPC)
- `FileLockManager` (pre-work file locking)
- `AgentEventBus` (pub/sub for inter-agent communication)

**Key Traits:**
```rust
pub trait AgentRuntime {
    fn spawn(&mut self, spec: &Spec, scope: Vec<PathBuf>) -> Result<AgentHandle>;
    fn pause(&mut self, agent_id: &str) -> Result<()>;
    fn resume(&mut self, agent_id: &str) -> Result<()>;
    fn terminate(&mut self, agent_id: &str) -> Result<()>;
    fn status(&self, agent_id: &str) -> Result<AgentStatus>;
}
```

**Dependencies:**
- `tokio` (async runtime for IPC)
- `mnm-core` (domain models)
- `mnm-db` (persist agent state)
- `mnm-git` (file scope validation)

**IPC Protocol:** JSON-RPC over stdin/stdout.

#### `mnm-drift`
**Purpose:** Drift detection engine (git diff + Claude API).

**Exports:**
- `DriftDetector` (main entry point)
- `DriftAnalyzer` (Claude API integration)
- `DriftClassifier` (severity + type classification)

**Key Functions:**
```rust
pub async fn detect_drift(
    spec: &Spec,
    diff: &GitDiff,
    instructions: Option<&str>, // Custom instructions
) -> Result<DriftDetection>;
```

**Dependencies:**
- `reqwest` (HTTPS client for Claude API)
- `mnm-core` (domain models)
- `mnm-git` (git diff generation)
- `mnm-db` (persist drift results)

**Claude API Usage:**
- Model: `claude-sonnet-4` (or latest)
- Context: spec content + git diff + optional custom instructions
- Output: structured JSON (severity, drift_type, summary, recommendation)

#### `mnm-git`
**Purpose:** Git integration via git2-rs.

**Exports:**
- `Repository` (wrapper around `git2::Repository`)
- `DiffGenerator` (generate diffs for drift detection)
- `ChangeDetector` (detect spec changes on git fetch/checkout)
- `FileClassifier` (identify important files via AI)

**Key Functions:**
```rust
pub fn diff_file(repo: &Repository, path: &Path, base: &str, head: &str) -> Result<GitDiff>;
pub fn detect_changes(repo: &Repository, old_ref: &str, new_ref: &str) -> Result<Vec<FileChange>>;
pub fn classify_files(repo: &Repository) -> Result<Vec<ImportantFile>>;
```

**Dependencies:**
- `git2` (libgit2 bindings)
- `mnm-core` (domain models)
- `mnm-db` (persist important files, spec changes)

**Git Hooks:** MnM registers post-checkout, post-merge hooks to trigger change detection.

#### `mnm-db`
**Purpose:** SQLite persistence layer.

**Exports:**
- `Database` (connection manager)
- `AgentRepository` (CRUD for agents)
- `SpecRepository` (CRUD for specs)
- `DriftRepository` (CRUD for drift detections)
- `FileLockRepository` (CRUD for file locks)
- `ImportantFileRepository` (CRUD for important files)
- `SpecChangeRepository` (CRUD for spec changes)

**Dependencies:**
- `rusqlite` or `sqlez` (SQLite bindings)
- `mnm-core` (domain models)

**Design Pattern:** Repository pattern (one repository per table/aggregate).

#### `mnm-spec`
**Purpose:** Spec parsing and indexing.

**Exports:**
- `SpecParser` (extract metadata from spec files)
- `SpecIndexer` (index all specs in repo)
- `SpecSearcher` (fuzzy search across specs)

**Supported Formats:**
- BMAD (YAML frontmatter + Markdown)
- open-spec (JSON)
- Generic Markdown (H1 as title)

**Dependencies:**
- `pulldown-cmark` (Markdown parsing)
- `serde_yaml` (YAML frontmatter)
- `serde_json` (JSON spec)
- `mnm-core` (domain models)
- `mnm-db` (persist indexed specs)

**Indexing Strategy:**
- On first run: scan repository for `.md` and `.json` files
- On git change: re-index modified files
- Store extracted metadata in `specs` table

#### `mnm-cli` (Optional)
**Purpose:** CLI entry point for headless operations (e.g., CI).

**Exports:**
- `main()` (entry point)
- CLI commands: `mnm drift-check`, `mnm agent-status`, etc.

**Dependencies:**
- `clap` (CLI framework)
- All other MnM crates

**MVP Scope:** Not required (GUI-only MVP), but architecture prepared.

### 4.3 Dependency Graph

```
mnm-ui ──┬──> mnm-core
         ├──> mnm-agent ──┬──> mnm-core
         │                ├──> mnm-db ──> mnm-core
         │                └──> mnm-git ──> mnm-core
         ├──> mnm-drift ──┬──> mnm-core
         │                ├──> mnm-db
         │                └──> mnm-git
         └──> mnm-spec ───┬──> mnm-core
                          └──> mnm-db

mnm-core: ZERO dependencies on other MnM crates (pure domain)
```

**Principle:** `mnm-core` is the foundation. All other crates depend on it. No circular dependencies.

---

## 5. Agent Orchestration Architecture

### 5.1 Multi-Agent Conflict Prevention

**Problem:** Multiple agents working in parallel can modify the same files, causing merge conflicts and spec divergence.

**Solution:** **Pre-Work File Locking** + **Inter-Agent Communication** via pub/sub.

### 5.2 File Locking Mechanism

**Lock Acquisition Flow:**
1. User launches agent from spec
2. Agent declares intended file scope (list of paths)
3. `FileLockManager` checks for conflicts:
   - **Read lock**: Multiple agents can acquire read locks on the same file
   - **Write lock**: Exclusive (no other read or write locks allowed)
4. If conflict detected:
   - UI displays warning: "Agent X is already working on file Y"
   - User can choose: wait, modify scope, or cancel
5. If no conflict, agent acquires locks and proceeds
6. On agent completion or termination, locks are released

**Lock Implementation:**

```rust
pub struct FileLockManager {
    db: Database,
}

impl FileLockManager {
    pub fn acquire_lock(
        &mut self,
        agent_id: &str,
        file_path: &Path,
        lock_type: LockType,
    ) -> Result<FileLock> {
        // Check for conflicts
        let conflicts = self.db.file_locks.find_active_locks(file_path)?;
        
        match lock_type {
            LockType::Read => {
                // Read lock conflicts with write locks only
                if conflicts.iter().any(|l| l.lock_type == LockType::Write) {
                    return Err(LockConflictError::WriteInProgress);
                }
            }
            LockType::Write => {
                // Write lock conflicts with any lock
                if !conflicts.is_empty() {
                    return Err(LockConflictError::FileInUse);
                }
            }
        }
        
        // Acquire lock
        let lock = FileLock::new(file_path, agent_id, lock_type);
        self.db.file_locks.insert(&lock)?;
        Ok(lock)
    }
    
    pub fn release_lock(&mut self, lock_id: &str) -> Result<()> {
        self.db.file_locks.release(lock_id)
    }
}
```

### 5.3 Inter-Agent Communication (Pub/Sub)

**Purpose:** Agents notify each other of progress, completion, or issues.

**Design:** Event bus pattern with typed events.

```rust
pub struct AgentEventBus {
    subscribers: HashMap<String, Vec<mpsc::Sender<AgentEvent>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentEvent {
    Started { agent_id: String, spec_id: String },
    Progress { agent_id: String, message: String },
    Completed { agent_id: String, files_modified: Vec<PathBuf> },
    Error { agent_id: String, error: String },
    FileLockReleased { file_path: PathBuf },
}

impl AgentEventBus {
    pub fn publish(&self, event: AgentEvent) {
        for sender in self.subscribers.values().flatten() {
            let _ = sender.send(event.clone());
        }
    }
    
    pub fn subscribe(&mut self, subscriber_id: String) -> mpsc::Receiver<AgentEvent> {
        let (tx, rx) = mpsc::channel(100);
        self.subscribers.entry(subscriber_id).or_default().push(tx);
        rx
    }
}
```

**Use Cases:**
- Agent A completes work → publishes `Completed` event → Agent B waiting for file lock gets notified
- Agent X encounters error → publishes `Error` event → UI updates dashboard

### 5.4 Claude Code Integration (IPC)

**Subprocess Spawn:**

```rust
pub struct ClaudeCodeBridge {
    process: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    stderr: BufReader<ChildStderr>,
}

impl ClaudeCodeBridge {
    pub fn spawn(spec: &Spec, scope: Vec<PathBuf>) -> Result<Self> {
        let mut cmd = Command::new("claude-code");
        cmd.arg("--spec").arg(&spec.file_path);
        cmd.arg("--scope").arg(scope.join(","));
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        
        let mut process = cmd.spawn()?;
        let stdin = process.stdin.take().unwrap();
        let stdout = BufReader::new(process.stdout.take().unwrap());
        let stderr = BufReader::new(process.stderr.take().unwrap());
        
        Ok(Self { process, stdin, stdout, stderr })
    }
    
    pub async fn send_command(&mut self, cmd: &str) -> Result<()> {
        writeln!(self.stdin, "{}", cmd)?;
        Ok(())
    }
    
    pub async fn read_output(&mut self) -> Result<String> {
        let mut line = String::new();
        self.stdout.read_line(&mut line)?;
        Ok(line)
    }
}
```

**IPC Protocol:** JSON-RPC over stdin/stdout.

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "pause",
  "id": 1
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "result": { "status": "paused" },
  "id": 1
}
```

### 5.5 Agent Lifecycle State Machine

```
┌─────────┐   spawn    ┌─────────┐   start    ┌─────────┐
│  Idle   │───────────►│ Pending │───────────►│ Running │
└─────────┘            └─────────┘            └─────────┘
                                                    │
                                ┌───────────────────┼───────────────────┐
                                │                   │                   │
                              pause              complete             error
                                │                   │                   │
                                ▼                   ▼                   ▼
                           ┌─────────┐        ┌───────────┐      ┌─────────┐
                           │ Paused  │        │ Completed │      │  Error  │
                           └─────────┘        └───────────┘      └─────────┘
                                │
                              resume
                                │
                                └──────────────────►┌─────────┐
                                                    │ Running │
                                                    └─────────┘
```

**State Transitions:**
- `Idle → Pending`: User clicks "Launch Agent"
- `Pending → Running`: Subprocess spawned successfully
- `Running → Paused`: User clicks "Pause"
- `Paused → Running`: User clicks "Resume"
- `Running → Completed`: Agent exits with code 0
- `Running → Error`: Agent exits with code != 0 or crashes

---

## 6. Drift Detection Pipeline

### 6.1 Trigger Conditions

Drift detection runs:
1. **On agent completion** (automatic)
2. **On user request** (manual "Check Drift" button)
3. **On git commit** (optional, configurable)

### 6.2 Detection Pipeline

```
┌────────────────────────────────────────────────────────────┐
│  Step 1: Identify Scope                                    │
│  - Agent completed work on Story X                         │
│  - Find all files modified by agent (git diff)             │
│  - Load Story X content from specs table                   │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Step 2: Generate Git Diff                                 │
│  - Run git diff between base commit and current state      │
│  - Extract added/modified lines                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Step 3: AI Analysis (Claude API)                          │
│  - Input: Spec content + git diff + optional custom instr  │
│  - Prompt: "Analyze semantic drift between spec and code"  │
│  - Output: Structured JSON (severity, type, summary, rec)  │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Step 4: Classification                                    │
│  - Severity: minor | moderate | critical                   │
│  - Type: scope_expansion | approach_change | design_dev    │
│  - Recommendation: update_spec | recenter_code             │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Step 5: Persist Results                                   │
│  - Save to drift_detections table                          │
│  - Link to agent_id and spec_id                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Step 6: Display to User                                   │
│  - Show drift alert in UI                                  │
│  - Provide "Accept" and "Reject" actions                   │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Claude API Prompt Template

```markdown
You are a drift detection system analyzing whether code implementation matches its specification.

**Spec:**
{spec_content}

**Git Diff:**
{diff_content}

**Custom Instructions (if any):**
{custom_instructions}

**Task:**
Analyze the diff and determine:
1. **Severity:** minor | moderate | critical
   - minor: cosmetic changes, no functional impact
   - moderate: approach differs but achieves spec goals
   - critical: spec requirements not met or design violated

2. **Drift Type:** scope_expansion | approach_change | design_deviation
   - scope_expansion: implemented beyond spec requirements
   - approach_change: different implementation approach than spec suggests
   - design_deviation: violates architectural constraints

3. **Summary:** 1-2 sentence explanation of what drifted

4. **Recommendation:** update_spec | recenter_code
   - update_spec: drift improves product, spec should be updated
   - recenter_code: drift breaks spec, code should be reverted/fixed

**Output Format (JSON):**
{
  "severity": "minor|moderate|critical",
  "drift_type": "scope_expansion|approach_change|design_deviation",
  "summary": "...",
  "recommendation": "update_spec|recenter_code"
}
```

### 6.4 Custom Instructions Support

Users can define custom drift detection rules in `.mnm/drift-instructions.md`:

```markdown
# Custom Drift Detection Instructions

## Performance Rules
- If implementation introduces O(n^2) complexity where spec expects O(n), classify as critical design_deviation

## Security Rules
- If implementation exposes API endpoints not in spec, classify as critical scope_expansion

## Logging Rules
- If implementation adds extensive logging, classify as minor scope_expansion (acceptable)
```

These instructions are appended to the Claude API prompt.

### 6.5 Drift Resolution Workflow

**Accept Drift (Update Spec):**
1. User clicks "Accept Drift"
2. MnM opens spec file in external editor
3. User manually updates spec to match new implementation
4. User commits updated spec
5. Drift record marked as `accepted` in DB

**Reject Drift (Recenter Code):**
1. User clicks "Reject Drift"
2. MnM creates new task: "Fix drift in Story X"
3. Task assigned to user or agent
4. User/agent reverts or fixes code
5. Drift record marked as `rejected` in DB

---

## 7. API Design (Internal Interfaces)

### 7.1 Core Traits

#### `AgentRuntime`
```rust
pub trait AgentRuntime: Send + Sync {
    fn spawn(&mut self, spec: &Spec, scope: Vec<PathBuf>) -> Result<AgentHandle>;
    fn pause(&mut self, agent_id: &str) -> Result<()>;
    fn resume(&mut self, agent_id: &str) -> Result<()>;
    fn terminate(&mut self, agent_id: &str) -> Result<()>;
    fn status(&self, agent_id: &str) -> Result<AgentStatus>;
    fn logs(&self, agent_id: &str) -> Result<Vec<String>>;
}
```

#### `DriftDetector`
```rust
pub trait DriftDetector: Send + Sync {
    async fn detect(
        &self,
        spec: &Spec,
        diff: &GitDiff,
        custom_instructions: Option<&str>,
    ) -> Result<DriftDetection>;
}
```

#### `SpecRepository`
```rust
pub trait SpecRepository: Send + Sync {
    fn find_by_id(&self, id: &str) -> Result<Option<Spec>>;
    fn find_by_path(&self, path: &Path) -> Result<Option<Spec>>;
    fn find_by_type(&self, spec_type: SpecType) -> Result<Vec<Spec>>;
    fn insert(&mut self, spec: &Spec) -> Result<()>;
    fn update(&mut self, spec: &Spec) -> Result<()>;
    fn search(&self, query: &str) -> Result<Vec<Spec>>;
}
```

### 7.2 Event System

MnM uses typed events for UI reactivity and inter-component communication.

```rust
pub enum AppEvent {
    // Agent events
    AgentSpawned { agent_id: String },
    AgentStatusChanged { agent_id: String, status: AgentStatus },
    AgentCompleted { agent_id: String },
    AgentError { agent_id: String, error: String },
    
    // Drift events
    DriftDetected { drift_id: String },
    DriftResolved { drift_id: String, decision: UserDecision },
    
    // Spec events
    SpecChanged { spec_id: String },
    SpecIndexed { spec_id: String },
    
    // Git events
    GitCheckout { branch: String },
    GitFetch { remote: String },
    ImportantFilesChanged { files: Vec<PathBuf> },
}
```

### 7.3 Error Hierarchy

```rust
#[derive(Debug, thiserror::Error)]
pub enum MnMError {
    #[error("Agent error: {0}")]
    Agent(#[from] AgentError),
    
    #[error("Drift detection error: {0}")]
    Drift(#[from] DriftError),
    
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Spec parsing error: {0}")]
    SpecParsing(String),
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Agent not found: {0}")]
    NotFound(String),
    
    #[error("Agent already running: {0}")]
    AlreadyRunning(String),
    
    #[error("File lock conflict: {0}")]
    LockConflict(#[from] LockConflictError),
    
    #[error("Subprocess spawn failed: {0}")]
    SpawnFailed(String),
}

#[derive(Debug, thiserror::Error)]
pub enum DriftError {
    #[error("Claude API error: {0}")]
    ApiError(String),
    
    #[error("Invalid drift response: {0}")]
    InvalidResponse(String),
    
    #[error("Spec not found: {0}")]
    SpecNotFound(String),
}
```

---

## 8. Error Handling Strategy

### 8.1 Error Handling Principles

1. **Fail fast, recover gracefully**: Errors should be detected early and handled with clear user feedback
2. **No silent failures**: All errors must be logged and surfaced to the user
3. **Transactional safety**: Database operations are atomic (SQLite transactions)
4. **Agent isolation**: One agent crash should not affect other agents

### 8.2 Error Handling Patterns

#### Pattern 1: Result Propagation
```rust
// Use ? operator for internal errors
pub fn launch_agent(&mut self, spec_id: &str) -> Result<AgentHandle> {
    let spec = self.db.specs.find_by_id(spec_id)?; // Propagate DB error
    let agent = self.runtime.spawn(&spec, vec![])?; // Propagate agent error
    Ok(agent)
}
```

#### Pattern 2: User-Facing Errors
```rust
// Convert internal errors to user-friendly messages
match launch_agent(spec_id) {
    Ok(agent) => show_success("Agent launched"),
    Err(MnMError::Agent(AgentError::LockConflict(e))) => {
        show_error(&format!("Cannot launch: {}", e));
    }
    Err(e) => show_error(&format!("Unexpected error: {}", e)),
}
```

#### Pattern 3: Async Error Handling
```rust
// Use tokio::spawn with error logging
tokio::spawn(async move {
    if let Err(e) = drift_detector.detect(&spec, &diff, None).await {
        error!("Drift detection failed: {}", e);
        event_bus.publish(AppEvent::DriftError { error: e.to_string() });
    }
});
```

### 8.3 Error Recovery Strategies

| Error Type | Recovery Strategy |
|------------|------------------|
| **Agent crash** | Mark agent as `Error`, release file locks, notify user |
| **Claude API timeout** | Retry with exponential backoff (3 attempts) |
| **Git operation failure** | Display error, allow manual git fix, retry |
| **SQLite lock timeout** | Retry with backoff, fallback to read-only mode |
| **Spec parsing error** | Skip file, log warning, continue indexing |

### 8.4 Logging Strategy

**Logging Levels:**
- `ERROR`: Unrecoverable errors (agent crash, API failure)
- `WARN`: Recoverable errors (spec parsing failure, retry attempt)
- `INFO`: Key events (agent started, drift detected)
- `DEBUG`: Detailed traces (IPC messages, SQL queries)

**Logging Library:** `tracing` (structured logging, async-aware)

**Log Output:**
- **Development:** stdout with color
- **Production:** `.mnm/logs/mnm.log` (rotated daily)

**Example:**
```rust
use tracing::{info, warn, error};

info!(agent_id = %agent.id, spec_id = %spec.id, "Agent spawned");
warn!(file_path = %path, "Spec parsing failed, skipping");
error!(agent_id = %agent.id, error = %e, "Agent crashed");
```

---

## 9. Testing Strategy

### 9.1 Test Pyramid

```
         ┌─────────────────┐
         │   E2E Tests     │  ← 10% (manual + automated)
         │  (UI workflows) │
         └─────────────────┘
              ▲
         ┌───────────────────┐
         │ Integration Tests │  ← 30% (crate interactions)
         │  (multi-crate)    │
         └───────────────────┘
              ▲
         ┌──────────────────────┐
         │    Unit Tests        │  ← 60% (pure functions, domain logic)
         │ (single-crate, fast) │
         └──────────────────────┘
```

### 9.2 Unit Tests

**Scope:** Test individual functions and modules in isolation.

**Coverage Target:** 80% line coverage for `mnm-core`, `mnm-drift`, `mnm-spec`.

**Example (mnm-core):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_status_transition() {
        let mut agent = Agent::new("test-agent");
        assert_eq!(agent.status, AgentStatus::Idle);
        
        agent.start();
        assert_eq!(agent.status, AgentStatus::Running);
        
        agent.pause();
        assert_eq!(agent.status, AgentStatus::Paused);
    }
}
```

### 9.3 Integration Tests

**Scope:** Test interactions between crates (e.g., `mnm-agent` + `mnm-db` + `mnm-git`).

**Key Integration Tests:**
1. **Agent Launch + File Lock**: Verify file locks are acquired and released correctly
2. **Drift Detection Pipeline**: Verify git diff → Claude API → DB persistence
3. **Spec Indexing**: Verify spec parsing → DB insertion → search
4. **Git Change Detection**: Verify git checkout → change detection → UI notification

**Example (Agent + DB + File Lock):**
```rust
#[tokio::test]
async fn test_agent_file_lock_integration() {
    let db = Database::in_memory();
    let mut orchestrator = AgentOrchestrator::new(db.clone());
    
    let spec = Spec::new("story-1", "stories/story-1.md");
    let scope = vec![PathBuf::from("src/main.rs")];
    
    // Launch agent 1
    let agent1 = orchestrator.spawn(&spec, scope.clone()).unwrap();
    
    // Attempt to launch agent 2 on same file (should fail)
    let result = orchestrator.spawn(&spec, scope.clone());
    assert!(matches!(result, Err(AgentError::LockConflict(_))));
    
    // Complete agent 1, release locks
    orchestrator.complete(&agent1.id).unwrap();
    
    // Agent 2 should now succeed
    let agent2 = orchestrator.spawn(&spec, scope).unwrap();
    assert!(agent2.id != agent1.id);
}
```

### 9.4 End-to-End Tests

**Scope:** Test full user workflows in the UI.

**Approach:**
- **Manual testing** (MVP): Checklists for QA
- **Automated (post-MVP)**: GPUI test harness (if available) or headless mode

**Key E2E Workflows:**
1. Launch MnM → browse specs → launch agent → view logs → drift alert → accept drift
2. Git checkout → spec change notification → view diff → dismiss
3. Launch 3 agents in parallel → verify no conflicts → complete all → verify progress

**Example E2E Checklist (Manual):**
```markdown
- [ ] Open MnM on sample project
- [ ] Navigate to "Stories" tab
- [ ] Select "FR1: Agent Dashboard"
- [ ] Click "Launch TDD Agent"
- [ ] Verify agent appears in dashboard with "Running" status
- [ ] Wait for agent completion
- [ ] Verify drift alert appears
- [ ] Click "Accept Drift"
- [ ] Verify drift record marked as "accepted" in DB
```

### 9.5 Performance Tests

**Scope:** Validate NFR performance targets.

**Key Metrics:**
- UI responsiveness: 60+ FPS (measure via GPUI profiler)
- Drift detection latency: < 5s for 1000 LOC (measure via benchmarks)
- Git change detection: < 200ms (measure via benchmarks)

**Benchmark Example (Drift Detection):**
```rust
#[tokio::test]
async fn bench_drift_detection() {
    let detector = DriftDetector::new(/* ... */);
    let spec = Spec::load("test-spec.md");
    let diff = GitDiff::load("test-diff.txt"); // 1000 LOC
    
    let start = Instant::now();
    let result = detector.detect(&spec, &diff, None).await.unwrap();
    let elapsed = start.elapsed();
    
    assert!(elapsed < Duration::from_secs(5), "Drift detection too slow: {:?}", elapsed);
}
```

### 9.6 Test Data

**Strategy:** Use fixtures and factories for test data.

**Fixtures:**
- Sample specs: `tests/fixtures/specs/`
- Sample diffs: `tests/fixtures/diffs/`
- Sample git repos: `tests/fixtures/repos/`

**Factory Example:**
```rust
pub struct AgentFactory;

impl AgentFactory {
    pub fn build() -> Agent {
        Agent {
            id: Uuid::new_v4().to_string(),
            name: "Test Agent".into(),
            status: AgentStatus::Idle,
            spec_id: None,
            scope: vec![],
            started_at: None,
            completed_at: None,
            error_message: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }
}
```

---

## 10. Deployment & Distribution

### 10.1 Build Process

**Cargo Build:**
```bash
cargo build --release
```

**Output:** `target/release/mnm` (macOS binary)

**Size Target:** < 50 MB (stripped, optimized)

### 10.2 macOS Packaging

**Format:** `.dmg` (macOS disk image)

**Contents:**
- `MnM.app` (application bundle)
- README.txt (installation instructions)
- LICENSE.txt (Apache 2.0)

**Signing:** Code-signed with Apple Developer ID (post-MVP)

**Notarization:** Notarized with Apple (post-MVP)

### 10.3 Installation Flow

1. User downloads `MnM-v1.0.0.dmg`
2. User opens DMG, drags `MnM.app` to Applications
3. User launches MnM for first time
4. macOS prompts: "MnM is from an unidentified developer" (pre-notarization)
5. User right-clicks → Open → confirms
6. MnM launches, displays onboarding:
   - "Select repository" → file picker
   - "Detecting important files..." → AI analysis
   - "Setup complete" → dashboard

### 10.4 Auto-Updates (Post-MVP)

**Strategy:** GitHub Releases + Sparkle framework

**Update Flow:**
1. MnM checks GitHub Releases API on startup
2. If new version available, displays notification
3. User clicks "Update" → downloads new DMG → quits → installs → relaunches

### 10.5 Distribution Channels

**MVP:**
- GitHub Releases (manual download)
- Direct link from website

**Post-MVP:**
- Homebrew: `brew install mnm`
- Mac App Store (requires sandbox compliance)

### 10.6 Telemetry & Analytics (Opt-In)

**MVP:** No telemetry (privacy-first)

**Post-MVP (opt-in only):**
- Anonymous usage metrics (e.g., "agent launch count", "drift detection count")
- Crash reports (via sentry.io)
- Performance metrics (UI FPS, drift detection latency)

**Privacy Policy:** Telemetry must be explicitly opted-in, no tracking by default.

---

## 11. Architecture Decision Records (ADRs)

### ADR-001: Use GPUI Instead of Native UI Frameworks

**Context:** MnM requires 60+ FPS UI performance and a modern, code-editor-like UX.

**Decision:** Use GPUI 0.2.2 instead of native frameworks (SwiftUI, AppKit) or web-based frameworks (Tauri, Electron).

**Rationale:**
- **Performance:** GPUI is GPU-accelerated, proven to deliver 120+ FPS in Zed
- **Zed validation:** Zed is a production code editor using this exact stack
- **Rust-native:** No FFI overhead, no JavaScript
- **Full control:** Can customize every aspect of UX without platform constraints

**Consequences:**
- (+) Best-in-class performance
- (+) Tight integration with Rust codebase
- (-) Smaller ecosystem than SwiftUI or React
- (-) Learning curve for GPUI (new framework)

**Status:** Accepted

---

### ADR-002: SQLite for Local State Instead of JSON Files

**Context:** MnM needs to persist agent state, drift detections, and file locks.

**Decision:** Use SQLite (via `sqlez` or `rusqlite`) instead of JSON files or in-memory state.

**Rationale:**
- **ACID guarantees:** Transactions prevent corruption on crash
- **Query performance:** Indexed lookups for agents, specs, drift
- **Zed validation:** Zed uses `sqlez` for similar use cases
- **Simplicity:** No external database server, single-file storage

**Alternatives Considered:**
- JSON files: No transactions, slow searches, corruption risk
- In-memory only: Data loss on crash
- PostgreSQL: Overkill, requires server setup

**Consequences:**
- (+) Reliable, fast, simple
- (+) No migration headaches (SQLite migrations are straightforward)
- (-) Single-writer limitation (not an issue for MnM's single-user model)

**Status:** Accepted

---

### ADR-003: Pre-Work File Locking for Multi-Agent Orchestration

**Context:** Multiple agents working in parallel can cause merge conflicts and spec divergence.

**Decision:** Implement **pre-work file locking**: agents declare file scope and acquire locks before starting work.

**Rationale:**
- **Conflict prevention is better than conflict resolution:** Detect conflicts before code is written
- **User control:** User decides how to resolve conflicts (wait, modify scope, cancel)
- **Simplicity:** Read/write lock semantics are well-understood

**Alternatives Considered:**
- Post-work merge conflict resolution: Reactive, painful, error-prone
- No locking (free-for-all): Guaranteed chaos with multiple agents
- Full file-level transactions: Overengineered, git already provides this

**Consequences:**
- (+) Prevents conflicts before they happen
- (+) Clear visibility into who's working on what
- (-) May slow down agent launches (user must resolve conflicts upfront)

**Status:** Accepted

---

### ADR-004: Hybrid Drift Detection (Git Diff + Claude API)

**Context:** Need to detect when code diverges from specs, with actionable insights.

**Decision:** Use **hybrid approach**: git diff for structural changes + Claude API for semantic analysis.

**Rationale:**
- **Git diff alone is insufficient:** Can't determine if drift is valuable or harmful
- **AI alone is risky:** Hallucination risk, needs git diff as ground truth
- **Custom instructions add flexibility:** Users can define domain-specific drift rules

**Alternatives Considered:**
- Pure git diff: No semantic analysis, just "code changed"
- Pure AI: Hallucination risk, no ground truth
- Local models (Ollama, etc.): Performance/quality concerns for MVP

**Consequences:**
- (+) Best of both worlds: structural + semantic analysis
- (+) Actionable insights (not just "drift detected")
- (-) Requires Claude API access (cost, latency)
- (-) Network dependency (no offline drift detection)

**Status:** Accepted

---

### ADR-005: Cargo Workspace Structure for Modularity

**Context:** MnM has distinct concerns (UI, agents, drift, git, DB, specs).

**Decision:** Use Cargo workspace with multiple crates instead of monolithic crate.

**Rationale:**
- **Separation of concerns:** Each crate has a single responsibility
- **Parallel compilation:** Cargo can compile crates in parallel
- **Reusability:** `mnm-core` can be used by `mnm-cli` and `mnm-ui`
- **Testing:** Easier to test crates in isolation

**Alternatives Considered:**
- Monolithic crate: Faster initial development, but poor modularity
- Separate repositories: Overengineered for MVP team size

**Consequences:**
- (+) Clean architecture, testable, scalable
- (+) Faster incremental builds
- (-) Slight overhead in workspace management

**Status:** Accepted

---

### ADR-006: IPC-Based Claude Code Integration

**Context:** Need to orchestrate Claude Code agents from MnM.

**Decision:** Spawn Claude Code as subprocess, communicate via stdin/stdout IPC (JSON-RPC).

**Rationale:**
- **Isolation:** Agent crashes don't crash MnM
- **Flexibility:** Can switch to other agent frameworks (Cursor, Aider) by changing subprocess
- **Simplicity:** No need to embed Claude Code or fork it

**Alternatives Considered:**
- Embedded Claude Code (if possible): Tight coupling, crashes affect MnM
- HTTP API: Overengineered, adds latency
- Shared memory IPC: Complex, platform-specific

**Consequences:**
- (+) Clean separation, fault-tolerant
- (+) Easy to support multiple agent frameworks
- (-) IPC overhead (acceptable for MVP scope)

**Status:** Accepted

---

## 12. Open Architectural Questions

### Q1: How to Handle Large Diffs (5000+ LOC)?

**Issue:** Claude API has token limits. Large diffs may exceed context window.

**Options:**
1. Chunk diff into smaller pieces, analyze separately, merge results
2. Use local models (Ollama) for large diffs
3. Limit drift detection to files < 5000 LOC, skip larger files

**Recommendation:** Implement (1) with chunking strategy. Defer (2) to post-MVP.

**Owner:** Daedalus (to validate with Héphaestos during implementation)

---

### Q2: How to Prevent AI Hallucination in Drift Insights?

**Issue:** Claude API may hallucinate drift that doesn't exist.

**Options:**
1. Validate AI output against git diff (e.g., ensure mentioned files are in diff)
2. Add confidence score to drift detection (low confidence = flag for manual review)
3. Allow users to rate drift quality (thumbs up/down) to train future models

**Recommendation:** Implement (1) for MVP. Add (2) post-MVP.

**Owner:** Daedalus + Atlas (research hallucination mitigation)

---

### Q3: How to Handle Spec Changes During Agent Execution?

**Issue:** If a spec changes (e.g., PRD updated) while an agent is working on it, agent may be working from stale spec.

**Options:**
1. Lock specs during agent work (prevent edits)
2. Notify agent of spec change, pause, ask user to restart
3. Ignore (let drift detection catch it)

**Recommendation:** Implement (2) for MVP (notify + pause). Option (1) is too restrictive.

**Owner:** Daedalus + Héphaestos

---

### Q4: Should Drift Detection Run Automatically or On-Demand?

**Issue:** Automatic drift detection on every agent completion may be noisy.

**Options:**
1. Automatic (always run on agent completion)
2. On-demand only (user clicks "Check Drift")
3. Configurable (user chooses per-project)

**Recommendation:** Implement (3) with default = automatic. Add toggle in settings.

**Owner:** Hermès (UX flow) + Héphaestos (implementation)

---

## 13. Next Steps

### Immediate Actions (Before Implementation)

1. **Validate GPUI 0.2.2 Stability**
   - Owner: Héphaestos
   - Task: Build "Hello World" GPUI app, verify 60+ FPS, test on macOS
   - Deliverable: Spike report with performance metrics

2. **Validate Claude API for Drift Detection**
   - Owner: Daedalus + Atlas
   - Task: Test Claude API with sample spec + diff, measure latency and quality
   - Deliverable: Drift detection prototype with 5 test cases

3. **Design UI Mockups**
   - Owner: Tom (or external designer)
   - Task: Wireframe dashboard, spec browser, drift alerts
   - Deliverable: Figma mockups or sketches

4. **Story Breakdown**
   - Owner: Hermès
   - Task: Decompose FRs into implementable stories with acceptance criteria
   - Deliverable: Story backlog in BMAD format

5. **Test Strategy Document**
   - Owner: Hygieia
   - Task: Define test coverage targets, test data fixtures
   - Deliverable: Test plan document

### Implementation Phases

**Phase 1: Foundation (Weeks 1-2)**
- Cargo workspace setup
- `mnm-core` domain models
- `mnm-db` SQLite schema + migrations
- `mnm-git` basic wrapper around git2-rs

**Phase 2: Agent Orchestration (Weeks 3-4)**
- `mnm-agent` file locking + IPC bridge
- Claude Code subprocess spawn
- Agent lifecycle state machine

**Phase 3: UI Basics (Weeks 5-6)**
- `mnm-ui` GPUI app shell
- Dashboard view (agent list)
- Spec browser (basic navigation)

**Phase 4: Drift Detection (Weeks 7-8)**
- `mnm-drift` git diff + Claude API integration
- Drift classification logic
- Drift alert UI

**Phase 5: Spec Change Awareness (Week 9)**
- Git hook integration
- AI file classification
- Spec change notification UI

**Phase 6: Polish & Testing (Weeks 10-12)**
- E2E testing
- Performance optimization
- Bug fixes
- Documentation

---

## 14. Architectural Risk Register

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
| GPUI 0.2.2 is unstable | High | Early spike, fallback to 0.1.x | Héphaestos |
| Claude API rate limits | Medium | Cache results, batch requests | Daedalus |
| Git repository size limits | Low | Shallow clone support, file filtering | Héphaestos |
| Drift detection is too slow | Medium | Optimize prompts, chunk large diffs | Daedalus |
| AI hallucination in drift insights | Medium | Validate output against diff | Atlas |
| File locking UX is too restrictive | Low | User testing, adjust as needed | Hermès |
| Team capacity insufficient | High | Ruthless prioritization, scope cuts | Tom |

---

## 15. Conclusion

This architecture provides a solid foundation for MnM's MVP, prioritizing:

1. **Performance** (GPUI, Rust, SQLite)
2. **Conflict prevention** (pre-work file locking, pub/sub)
3. **Intelligent drift detection** (hybrid git + AI)
4. **Local-first simplicity** (no cloud, no server)
5. **Extensibility** (multi-crate, trait-based design)

**Key Success Factors:**
- Zed-validated stack minimizes risk
- Multi-agent orchestration is a unique differentiator
- Drift detection insights must be genuinely valuable (not noise)
- User experience must be **effortless** — alignment should be natural, not burdensome

**Approval Required:**
- Tom (Product Lead)
- Nikou (Team Member)
- TarsaaL (Team Member)

**Next Milestone:** Story Breakdown → Implementation Kickoff

---

*Architecture Document v1.0 — Daedalus, 2026-02-19*
