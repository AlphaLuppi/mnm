# Architecture Technique Détaillée - MnM (Make no Mistake)

**Auteur:** NiClawDCode (Tech Architect)
**Date:** 2026-02-19
**Version:** 1.1
**Statut:** Draft — basé sur PRD v1.0 · ADR-10 single window GPUI intégré

---

## Table des Matières

1. [Vue d'Ensemble Architecturale](#1-vue-densemble-architecturale)
2. [Diagramme des Composants](#2-diagramme-des-composants)
3. [Stack Technologique](#3-stack-technologique)
4. [Structure Fichiers / Dossiers](#4-structure-fichiers--dossiers)
5. [API Contracts (Composants Internes)](#5-api-contracts-composants-internes)
6. [Data Flow Complet](#6-data-flow-complet)
7. [Process Lifecycle (Agent Spawn → Approve)](#7-process-lifecycle-agent-spawn--approve)
8. [Database Schema (SQLite)](#8-database-schema-sqlite)
9. [Git Integration Layer](#9-git-integration-layer)
10. [Sécurité & Persistence](#10-sécurité--persistence)
11. [Considérations Cross-Platform](#11-considérations-cross-platform)
12. [Décisions d'Architecture (ADRs Complémentaires)](#12-décisions-darchitecture-adrs-complémentaires)
    - ADR-6: Zustand ~~(obsolète ADR-10)~~
    - ADR-7: Event Bus Rust
    - ADR-8: SQLite par Workspace
    - ADR-9: GPUI + Tauri séparés ~~(abandonné)~~
    - **ADR-10: Single Window 100% GPUI ✅ VALIDÉ**

---

## 1. Vue d'Ensemble Architecturale

MnM est architecturé en trois couches horizontales communiquant via des interfaces définies :

```
┌─────────────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER — FENÊTRE UNIQUE GPUI            │
│    100% Rust · GPU-accelerated · Pas de WebView (ADR-10)        │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Dashboard │ │ Review   │ │Timeline  │ │Context / Editor  │   │
│  │ Panel    │ │ DiffView │ │ Panel    │ │     Panel        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Rust channels (tokio::mpsc/broadcast)
┌─────────────────────────────▼───────────────────────────────────┐
│                       DOMAIN / APPLICATION LAYER                 │
│           Rust (backend + async Tokio runtime — pas de Tauri)    │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │AgentManager  │ │ChangeManager │ │    SessionStore          │ │
│  │              │ │              │ │    (SQLite + Files)      │ │
│  └──────┬───────┘ └──────┬───────┘ └──────────────────────────┘ │
│         │                │                                        │
│  ┌──────▼───────────────▼──────────────────────────────────┐    │
│  │              AgentFramework Trait (Adapter Interface)    │    │
│  │  ┌──────────────────────┐  ┌────────────────────────┐   │    │
│  │  │ ClaudeCodeCliAdapter │  │ AnthropicApiAdapter    │   │    │
│  │  └──────────────────────┘  └────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ OS syscalls / FFI
┌─────────────────────────────▼───────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                          │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Process Mgmt │ │ File System  │ │    Git Integration       │ │
│  │ (tokio::proc)│ │ (notify +    │ │    (git2-rs / CLI)       │ │
│  │              │ │  atomic I/O) │ │                          │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Principes Directeurs

- **Séparation des responsabilités stricte** : chaque composant a une seule raison de changer
- **Event-driven** : les mutations d'état remontent via des canaux Tokio → GPUI entity updates → UI (ADR-10 : plus de Tauri events)
- **Zéro couplage UI ↔ Adapters** : l'UI ne sait rien de Claude Code ou de l'API Anthropic
- **Local-first** : toutes les données persistées localement, pas de réseau sauf pour les appels agent
- **Forward-compatible schema** : SQLite avec migrations versionnées dès v1

---

## 2. Diagramme des Composants

### 2.1 Vue Macro

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MnM Application                                │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    UI SHELL (GPUI Window — ADR-10)                    │  │
│   │                                                                        │  │
│   │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│   │  │                      App Shell Component                         │ │  │
│   │  │  (Router, Layout, Theme, Keyboard Shortcuts, Notification Hub)   │ │  │
│   │  └───────────────────────────┬─────────────────────────────────────┘ │  │
│   │                              │                                         │  │
│   │   ┌──────────────┐  ┌────────▼────────┐  ┌───────────────────────┐   │  │
│   │   │  Sidebar     │  │  Main Content   │  │   Right Panel         │   │  │
│   │   │              │  │  Area           │  │   (Context / History) │   │  │
│   │   │ - FileBrowser│  │                 │  │                       │   │  │
│   │   │ - SessionList│  │  ┌───────────┐  │  │ ┌───────────────────┐ │   │  │
│   │   │ - GitHistory │  │  │ Dashboard │  │  │ │  ContextViewer    │ │   │  │
│   │   │              │  │  │ (default) │  │  │ │  - TokenBudget    │ │   │  │
│   │   │              │  │  └───────────┘  │  │ │  - FileList       │ │   │  │
│   │   │              │  │  ┌───────────┐  │  │ │  - RelevanceScore │ │   │  │
│   │   │              │  │  │ Review    │  │  │ └───────────────────┘ │   │  │
│   │   │              │  │  │ Panel     │  │  │ ┌───────────────────┐ │   │  │
│   │   │              │  │  └───────────┘  │  │ │  TimelinePanel    │ │   │  │
│   │   │              │  │  ┌───────────┐  │  │ │  - EventList      │ │   │  │
│   │   │              │  │  │ Minimal   │  │  │ │  - Filters        │ │   │  │
│   │   │              │  │  │ Editor    │  │  │ └───────────────────┘ │   │  │
│   │   │              │  │  │ (GPUI)    │  │  │                       │   │  │
│   │   │              │  │  └───────────┘  │  │                       │   │  │
│   │   └──────────────┘  └────────┬────────┘  └───────────────────────┘   │  │
│   │                              │ Rust channels (tokio mpsc/broadcast)    │  │
│   └──────────────────────────────┼─────────────────────────────────────── ┘  │
│                                  │                                              │
│   ┌──────────────────────────────▼─────────────────────────────────────────┐  │
│   │                         RUST BACKEND CORE                               │  │
│   │                                                                          │  │
│   │  ┌──────────────────┐    ┌─────────────────────┐   ┌─────────────────┐ │  │
│   │  │  AgentManager    │    │   ChangeManager      │   │  SessionStore   │ │  │
│   │  │                  │    │                      │   │                 │ │  │
│   │  │ - session_map    │    │ - pending_changes    │   │ - sqlite_pool   │ │  │
│   │  │ - event_bus      │    │ - apply_approved()   │   │ - file_cache    │ │  │
│   │  │ - spawn_agent()  │    │ - reject_with_msg()  │   │ - audit_logger  │ │  │
│   │  │ - kill_agent()   │    │ - gen_commit()       │   │                 │ │  │
│   │  └────────┬─────────┘    └──────────┬──────────┘   └────────┬────────┘ │  │
│   │           │                         │                        │           │  │
│   │  ┌────────▼─────────────────────────▼────────────────────────▼────────┐ │  │
│   │  │                    AgentFramework Trait                             │ │  │
│   │  │  spawn() | send_feedback() | event_stream() | get_changes() |      │ │  │
│   │  │  terminate() | get_status() | get_conversation()                   │ │  │
│   │  └─────────────────────────┬────────────────────────────────────────── ┘ │  │
│   │                            │                                              │  │
│   │          ┌─────────────────┼──────────────────────┐                      │  │
│   │          │                 │                       │                      │  │
│   │  ┌───────▼───────┐  ┌──────▼────────┐  ┌─────────▼────────┐             │  │
│   │  │ ClaudeCode    │  │ AnthropicApi  │  │  (Future:        │             │  │
│   │  │ CliAdapter    │  │ Adapter       │  │  AiderAdapter,   │             │  │
│   │  │               │  │               │  │  OpenHands...)   │             │  │
│   │  │ tokio::process│  │ reqwest HTTP  │  │                  │             │  │
│   │  │ stdin/stdout  │  │ streaming     │  │                  │             │  │
│   │  └───────────────┘  └───────────────┘  └──────────────────┘             │  │
│   │                                                                          │  │
│   │  ┌──────────────────┐  ┌─────────────────────┐  ┌────────────────────┐ │  │
│   │  │  WorkspaceIndex  │  │   GitIntegration     │  │   KeychainService  │ │  │
│   │  │                  │  │                      │  │                    │ │  │
│   │  │ - file_tree      │  │ - git2-rs wrapper    │  │ - store_api_key()  │ │  │
│   │  │ - file_watcher   │  │ - commit_with_meta() │  │ - get_api_key()    │ │  │
│   │  │ - content_search │  │ - query_history()    │  │ - OS keychain API  │ │  │
│   │  └──────────────────┘  └─────────────────────┘  └────────────────────┘ │  │
│   └──────────────────────────────────────────────────────────────────────── ┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Composants GPUI (Zed Crates)

MnM utilise les crates Zed suivantes comme dépendances (pas fork, import direct) :

```
Zed crates utilisées (via Cargo.toml) — étendu ADR-10
│
├── gpui                    → GPU-accelerated UI framework principal
│   ├── View system         → reactive component model (Entity + Model)
│   ├── Text rendering      → glyph rasterization, font shaping
│   ├── Layout engine       → flexbox-style layout
│   └── Event dispatch      → keyboard, mouse, focus management
│
├── workspace               → ✨ NOUVEAU (ADR-10) — multi-panel layout
│   ├── Pane system         → resizable panels, tabs
│   ├── Dock               → sidebar left/right/bottom
│   └── Item system        → focusable content panes
│
├── project                 → ✨ NOUVEAU (ADR-10) — workspace management
│   ├── File tree model    → directory listing, file watching
│   └── Search             → grep/ripgrep integration
│
├── editor                  → Composant éditeur (réutilisé tel quel)
│   ├── Buffer model        → in-memory text buffer
│   ├── Syntax highlighting → tree-sitter integration
│   ├── Selection / cursors → multi-cursor support
│   └── Gutter / line nums  → minimal line decorations
│
├── language                → Language detection + LSP client
│   ├── Language registry   → file extension → language mapping
│   └── Highlight queries   → tree-sitter grammar queries
│
└── diff                    → Diff computation (from Zed)
    ├── Line diff           → Myers diff algorithm
    └── Hunk computation    → logical change block detection
```

Les composants **non** importés de Zed (construits custom) :
- Dashboard / agent cards UI → GPUI views custom
- Review panel (approve/reject) → GPUI views custom
- Timeline panel → GPUI views custom
- Context viewer (token budget) → GPUI views custom
- Tout le backend Rust (AgentManager, SessionStore, etc.) → 100% custom

> **Note ADR-10 :** Les crates `workspace` et `project` Zed sont ajoutées pour le layout multi-panel et la gestion du file tree. Cela réduit significativement le code UI custom nécessaire.

---

## 3. Stack Technologique

### 3.1 Résumé des Choix

| Layer | Technologie | Justification |
|-------|-------------|---------------|
| App Shell | GPUI standalone (pas Tauri) | ADR-10 : fenêtre unique, pas de WebView |
| UI Framework | GPUI (Zed) | 60fps GPU rendering, Rust-native, single window |
| UI Supplémentaire | ~~React/TypeScript~~ **supprimé** | ADR-10 : 100% GPUI, plus de WebView |
| Backend | Rust (async/await) | Performance, memory safety, tokio |
| Async Runtime | Tokio | Standard Rust async, multi-thread |
| Process Mgmt | tokio::process | Spawn/kill/stream CLI subprocesses |
| Database | SQLite (rusqlite + r2d2) | Local, embedded, portable |
| File Watching | notify crate | Cross-platform FS events |
| Git Integration | git2-rs + git CLI | Rich Git API, trailer support |
| HTTP Client | reqwest (async) | Anthropic API calls |
| Serialization | serde + serde_json | IPC messages, DB storage |
| OS Keychain | keyring crate | API key secure storage |
| Diff Engine | similar crate + Zed diff | Myers diff, hunk computation |
| Tree-sitter | tree-sitter + grammars | Syntax parsing for 50+ languages |
| Testing | Rust tests + mockall | Unit + integration |
| Packaging | cargo-bundle + AppImage | ADR-10 : remplace Tauri bundler |

### 3.2 Dépendances Cargo Clés

```toml
[dependencies]
# === ADR-10 : Tauri supprimé — 100% GPUI fenêtre unique ===
# tauri = ... (SUPPRIMÉ)
# tauri-plugin-notification = ... (SUPPRIMÉ)
# tauri-plugin-shell = ... (SUPPRIMÉ)

# GPUI / Zed crates — ADR-10 étendu
gpui = { git = "https://github.com/zed-industries/zed", rev = "<sha-épinglé>" }
editor = { git = "https://github.com/zed-industries/zed", rev = "<sha-épinglé>" }
language = { git = "https://github.com/zed-industries/zed", rev = "<sha-épinglé>" }
workspace = { git = "https://github.com/zed-industries/zed", rev = "<sha-épinglé>" }  # ADR-10
project = { git = "https://github.com/zed-industries/zed", rev = "<sha-épinglé>" }   # ADR-10

# Async
tokio = { version = "1", features = ["full"] }
futures = "0.3"
async-trait = "0.1"

# Database
rusqlite = { version = "0.31", features = ["bundled"] }
r2d2 = "0.8"
r2d2_sqlite = "0.24"
rusqlite_migration = "1"

# Git
git2 = "0.19"

# HTTP (Anthropic API)
reqwest = { version = "0.12", features = ["json", "stream"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# File watching
notify = "6"

# Diff
similar = "2"

# Security
keyring = "2"

# Utilities
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
```

---

## 4. Structure Fichiers / Dossiers

```
// ADR-10 : Structure mise à jour — 100% Rust, pas de src/ TypeScript
mnm/
│
├── Cargo.toml                          # Workspace root (cargo-bundle config)
├── Cargo.lock
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Tests + lint
│       └── release.yml                 # Build + cargo-bundle + publish
│
├── crates/                             # Workspace Rust crates
│   │
│   ├── mnm-app/                        # Crate principale — GPUI app entry
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs                 # GPUI app bootstrap (cx.open_window)
│   │       └── app.rs                  # AppShell GPUI view (root)
│   │
│   ├── mnm-ui/                         # Composants GPUI custom
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── layout/
│   │       │   ├── app_shell.rs        # Layout 3-panneaux principal (GPUI)
│   │       │   ├── sidebar.rs          # Left sidebar GPUI view
│   │       │   └── right_panel.rs      # Context / timeline panel
│   │       │
│   │       ├── dashboard/
│   │       │   ├── mod.rs
│   │       │   ├── dashboard_view.rs   # Vue principale dashboard
│   │       │   ├── agent_card.rs       # Carte session agent
│   │       │   ├── task_input.rs       # Input nouvelle tâche
│   │       │   └── session_list.rs     # Liste sessions complétées
│   │       │
│   │       ├── review/
│   │       │   ├── mod.rs
│   │       │   ├── review_panel.rs     # Panneau review changements
│   │       │   ├── diff_viewer.rs      # Diff side-by-side (Zed diff crate)
│   │       │   ├── file_change_list.rs # Liste fichiers à reviewer
│   │       │   └── approve_reject.rs   # Boutons action + feedback input
│   │       │
│   │       ├── timeline/
│   │       │   ├── mod.rs
│   │       │   ├── timeline_panel.rs   # Vue timeline
│   │       │   ├── timeline_entry.rs   # Entrée event unique
│   │       │   └── timeline_filters.rs # Filtres par type d'event
│   │       │
│   │       ├── context/
│   │       │   ├── mod.rs
│   │       │   ├── context_viewer.rs   # Context files + token budget
│   │       │   ├── file_picker.rs      # Modal sélection fichiers/dossiers
│   │       │   └── token_budget_bar.rs # Barre visuelle budget tokens
│   │       │
│   │       └── git/
│   │           ├── git_history_view.rs # Git log avec metadata MnM
│   │           └── commit_detail.rs    # Détail commit + prompt metadata
│   │
│   ├── mnm-core/                       # Domain logic (pas d'UI)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── agent/                  # Agent management domain
│   │       │   ├── mod.rs
│   │       │   ├── manager.rs          # AgentManager: session lifecycle
│   │       │   ├── session.rs          # AgentSession struct + state machine
│   │       │   ├── framework.rs        # AgentFramework trait definition
│   │       │   ├── events.rs           # AgentEvent enum + EventStream
│   │       │   └── adapters/
│   │       │       ├── mod.rs
│   │       │       ├── claude_code_cli.rs  # ClaudeCodeCliAdapter
│   │       │       └── anthropic_api.rs    # AnthropicApiAdapter
│   │       │
│   │       ├── changes/                # Change review domain
│   │       │   ├── mod.rs
│   │       │   ├── manager.rs          # ChangeManager: pending → approved → applied
│   │       │   ├── file_change.rs      # FileChange struct, DiffHunk
│   │       │   └── apply.rs            # Atomic file write operations
│   │       │
│   │       ├── workspace/              # Workspace + filesystem
│   │       │   ├── mod.rs
│   │       │   ├── index.rs            # WorkspaceIndex: file tree, search
│   │       │   ├── watcher.rs          # FileWatcher: notify-based FS events
│   │       │   └── paths.rs            # Path normalization, cross-platform
│   │       │
│   │       ├── git/                    # Git integration layer
│   │       │   ├── mod.rs
│   │       │   ├── integration.rs      # GitIntegration: main interface
│   │       │   ├── commit.rs           # commit_with_metadata(), trailer format
│   │       │   ├── history.rs          # query_history(), parse_trailers()
│   │       │   └── diff.rs             # workspace diff helpers
│   │       │
│   │       ├── storage/                # Persistence layer
│   │       │   ├── mod.rs
│   │       │   ├── session_store.rs    # SessionStore: CRUD on sessions
│   │       │   ├── audit_log.rs        # AuditLogger: append-only event log
│   │       │   ├── db.rs               # SQLite pool + connection management
│   │       │   └── migrations/
│   │       │       ├── mod.rs          # Migration runner
│   │       │       ├── 001_initial.sql # Schema v1
│   │       │       └── 002_*.sql       # Future migrations
│   │       │
│   │       └── security/
│   │           ├── mod.rs
│   │           └── keychain.rs         # KeychainService: OS keychain wrapper
│   │
│   └── mnm-types/                      # Types partagés (pas de dépendances lourdes)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── agent.rs                # AgentSession, AgentStatus, AgentEvent
│           ├── changes.rs              # FileChange, DiffHunk, ReviewStatus
│           ├── timeline.rs             # TimelineEvent, TimelineEventType
│           └── git.rs                  # GitCommit, PromptMetadata
│
├── tests/
│   ├── integration/
│   │   ├── agent_lifecycle_test.rs     # Spawn → complete → store
│   │   ├── change_apply_test.rs        # Approve → write → verify
│   │   └── git_metadata_test.rs        # Commit → parse trailers
│   └── ui/                             # GPUI UI tests (GPUI test harness)
│
└── docs/
    ├── architecture.md                 # Ce document
    ├── prd.md                          # Product Requirements
    └── dev-setup.md                    # Developer onboarding
```

> **Note ADR-10 :** Structure reorganisée en workspace multi-crates. Plus de `src/` TypeScript, plus de `src-tauri/`. La séparation `mnm-ui` / `mnm-core` / `mnm-types` facilite les tests et la maintenance.

---

## 5. API Contracts (Composants Internes)

### 5.1 AgentFramework Trait

```rust
/// Trait central que tous les adapters doivent implémenter.
/// Permet d'ajouter Aider, OpenHands, etc. sans toucher au core.
#[async_trait]
pub trait AgentFramework: Send + Sync {
    /// Démarre une nouvelle session agent pour la tâche et le contexte donnés.
    /// Retourne immédiatement avec le SessionHandle ; l'exécution est async.
    async fn spawn(
        &self,
        task: SpawnRequest,
    ) -> Result<AgentSession, AgentError>;

    /// Envoie un message (feedback sur un rejet, question) à l'agent en cours.
    async fn send_message(
        &self,
        session_id: SessionId,
        message: String,
    ) -> Result<(), AgentError>;

    /// Retourne un stream d'événements pour la session.
    /// Le stream se termine quand la session est complète ou terminée.
    async fn subscribe_events(
        &self,
        session_id: SessionId,
    ) -> Result<Pin<Box<dyn Stream<Item = AgentEvent> + Send>>, AgentError>;

    /// Récupère les changements proposés par l'agent (snapshot courant).
    async fn get_proposed_changes(
        &self,
        session_id: SessionId,
    ) -> Result<Vec<FileChange>, AgentError>;

    /// Arrête proprement une session (SIGTERM → SIGKILL après timeout).
    async fn terminate(
        &self,
        session_id: SessionId,
        reason: TerminateReason,
    ) -> Result<(), AgentError>;

    /// Status courant de la session.
    async fn get_status(
        &self,
        session_id: SessionId,
    ) -> Result<AgentStatus, AgentError>;

    /// Historique complet de la conversation (messages user + agent).
    async fn get_conversation(
        &self,
        session_id: SessionId,
    ) -> Result<Vec<ConversationMessage>, AgentError>;
}

/// Request pour spawner un agent
pub struct SpawnRequest {
    pub task_description: String,
    pub context_files: Vec<PathBuf>,
    pub workspace_root: PathBuf,
    pub model: ModelSpec,         // ex: Claude Opus 4, Sonnet 4
    pub max_tokens: Option<u32>,
}

pub enum AgentStatus {
    Thinking,
    Coding,
    WaitingApproval,
    WaitingFeedback,
    Completed,
    Error(String),
    Terminated,
}
```

### 5.2 Interface UI ↔ Backend (ADR-10 : Rust Channels, plus Tauri IPC)

> **ADR-10 :** Remplacement complet du Tauri IPC (invoke/listen TypeScript) par des **channels Rust natifs** entre le backend (`mnm-core`) et l'UI GPUI (`mnm-ui`). Plus rapide, plus simple, type-safe nativement.

#### AppHandle — Interface centrale

```rust
// mnm-core/src/app_handle.rs
// Injecté dans les GPUI views via cx.global::<AppHandle>()

pub struct AppHandle {
    agent_manager: Arc<AgentManager>,
    change_manager: Arc<ChangeManager>,
    session_store: Arc<SessionStore>,
    git_integration: Arc<GitIntegration>,
    workspace_index: Arc<WorkspaceIndex>,
    // Channel pour recevoir les events agent dans l'UI
    event_rx: broadcast::Receiver<AppEvent>,
}

pub enum AppEvent {
    AgentEvent { session_id: String, event: AgentEvent },
    AgentStatusChanged { session_id: String, status: AgentStatus },
    AgentChangesReady { session_id: String, change_count: usize },
    AgentTokenUpdate { session_id: String, total_tokens: u32 },
    AgentError { session_id: String, error: String },
}
```

#### Agent Actions (UI → Backend)

```rust
// Appels synchrones/async directs depuis les GPUI views via cx.spawn()

// Spawn un agent
app_handle.agent_manager.spawn(SpawnRequest {
    task_description: String,
    context_files: Vec<PathBuf>,
    workspace_root: PathBuf,
    framework: FrameworkType::ClaudeCodeCli,
    model: "claude-opus-4".into(),
}).await? // → AgentSession

// Envoyer feedback à l'agent
app_handle.agent_manager.send_message(session_id, feedback).await?

// Terminer un agent
app_handle.agent_manager.terminate(session_id, TerminateReason::UserRequested).await?

// Statut et conversation
app_handle.agent_manager.get_status(session_id).await?       // → AgentStatus
app_handle.agent_manager.get_conversation(session_id).await? // → Vec<ConversationMessage>
```

#### Change Actions (UI → Backend)

```rust
// Récupérer les changements proposés
app_handle.change_manager.get_proposed_changes(session_id).await? // → Vec<FileChange>

// Approuver des changements
app_handle.change_manager.approve_changes(ApproveRequest {
    session_id,
    file_changes: vec![FileApproval {
        file_path,
        approved_hunks: vec![], // [] = tout approuver
    }],
}).await?

// Rejeter avec feedback
app_handle.change_manager.reject_changes(RejectRequest {
    session_id,
    file_path,
    feedback: String,
}).await?

// Appliquer les changements approuvés
app_handle.change_manager.apply_approved_changes(session_id).await? // → FilesApplied count
```

#### Workspace Actions (UI → Backend)

```rust
app_handle.workspace_index.open(PathBuf)?           // → WorkspaceInfo
app_handle.workspace_index.list_files(pattern)?     // → Vec<FileEntry>
app_handle.workspace_index.read_file(path)?         // → (content, language)
app_handle.workspace_index.search_files(query)?     // → Vec<SearchResult>
app_handle.workspace_index.search_content(query)?   // → Vec<ContentSearchResult>
```

#### Git Actions (UI → Backend)

```rust
app_handle.git_integration.commit(CommitRequest {
    workspace_path, message, session_id, files
}).await? // → CommitHash

app_handle.git_integration.get_history(QueryOptions { limit, offset }).await? // → Vec<GitCommit>
app_handle.git_integration.get_commit_metadata(hash)?  // → Option<PromptMetadata>
app_handle.git_integration.get_diff(from, to, file?)?  // → FileDiff
```

#### Session Actions (UI → Backend)

```rust
app_handle.session_store.list_sessions(filter)?     // → Vec<AgentSession>
app_handle.session_store.get_session(session_id)?   // → AgentSession
app_handle.session_store.export_audit(session_id)?  // → String (JSON)
```

#### Event Subscription depuis GPUI Views

```rust
// Dans un GPUI view, subscribe aux events backend :
cx.spawn(|this, mut cx| async move {
    let mut rx = app_handle.event_rx.resubscribe();
    while let Ok(event) = rx.recv().await {
        match event {
            AppEvent::AgentChangesReady { session_id, .. } => {
                this.update(&mut cx, |view, cx| {
                    view.open_review_panel(session_id, cx);
                })?;
            }
            AppEvent::AgentStatusChanged { session_id, status } => {
                this.update(&mut cx, |view, cx| {
                    view.update_agent_card(session_id, status, cx);
                })?;
            }
            _ => {}
        }
    }
    anyhow::Ok(())
})
```

### 5.3 Types Partagés (Rust → TypeScript via Serde)

```rust
// Rust structs (serde::Serialize) → TypeScript types (auto-générés ou manuels)

pub struct AgentSession {
    pub id: String,                          // UUID v4
    pub workspace_path: String,
    pub task_description: String,
    pub framework_type: FrameworkType,
    pub status: AgentStatus,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub context_files: Vec<String>,
    pub total_tokens: u32,
    pub elapsed_seconds: u64,
    pub proposed_changes: Vec<FileChange>,
    pub applied_changes: Vec<String>,        // file paths
    pub timeline_events: Vec<TimelineEvent>,
}

pub struct FileChange {
    pub session_id: String,
    pub file_path: String,
    pub change_type: ChangeType,             // Create | Modify | Delete
    pub before_content: Option<String>,
    pub after_content: Option<String>,
    pub diff_hunks: Vec<DiffHunk>,
    pub review_status: ReviewStatus,         // Pending | Approved | Rejected
    pub reviewer_feedback: Option<String>,
    pub agent_reasoning: Option<String>,
}

pub struct DiffHunk {
    pub hunk_index: usize,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,               // Context | Added | Removed
}

pub struct TimelineEvent {
    pub id: String,
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub event_type: TimelineEventType,
    pub description: String,
    pub files_involved: Vec<String>,
    pub tokens_consumed: u32,
    pub raw_data: serde_json::Value,
}

pub enum TimelineEventType {
    Thinking,
    FileRead,
    FileWrite,
    ToolUse { tool_name: String },
    ChangeProposed,
    ChangeApproved,
    ChangeRejected,
    SessionStarted,
    SessionCompleted,
    SessionError,
}
```

---

## 6. Data Flow Complet

### 6.1 Flow Principal : Spawn → Approve → Commit

```
┌──────────┐     ┌──────────────┐     ┌───────────────────┐     ┌────────────┐
│   USER   │     │  FRONTEND    │     │  RUST BACKEND     │     │ SUBPROCESS │
│          │     │  (GPUI only) │     │  (mnm-core)       │     │(Claude Code│
└────┬─────┘     └──────┬───────┘     └────────┬──────────┘     └─────┬──────┘
     │                  │                       │                       │
     │  1. Tape tâche   │                       │                       │
     │─────────────────►│                       │                       │
     │                  │                       │                       │
     │  2. Sélectionne  │                       │                       │
     │  contexte        │                       │                       │
     │─────────────────►│                       │                       │
     │                  │                       │                       │
     │  3. Click Spawn  │                       │                       │
     │─────────────────►│                       │                       │
     │                  │ 4. invoke("spawn")    │                       │
     │                  │──────────────────────►│                       │
     │                  │                       │ 5. Create session DB  │
     │                  │                       │───────────────────┐   │
     │                  │                       │◄──────────────────┘   │
     │                  │                       │                       │
     │                  │                       │ 6. ClaudeCodeCliAdapter│
     │                  │                       │    .spawn(request)    │
     │                  │                       │──────────────────────►│
     │                  │                       │                       │
     │                  │ 7. event:"agent:start"│                       │
     │                  │◄──────────────────────│                       │
     │                  │                       │                       │
     │   Shows agent    │                       │  8. stdout stream:    │
     │   card "Thinking"│                       │  {"type":"thinking",.}│
     │◄─────────────────│                       │◄──────────────────────│
     │                  │                       │                       │
     │                  │                       │ 9. Parse events,      │
     │                  │                       │ log to DB, broadcast  │
     │                  │                       │ AppEvent (ADR-10)     │
     │                  │ 10. GPUI view update  │                       │
     │                  │◄──────────────────────│                       │
     │                  │                       │                       │
     │  Timeline updates│                       │  11. {"type":"file_  │
     │  in real-time    │                       │  write","changes":[.]}│
     │◄─────────────────│                       │◄──────────────────────│
     │                  │                       │                       │
     │                  │ 12. agent:changes_ready                       │
     │                  │◄──────────────────────│                       │
     │                  │                       │                       │
     │  Review panel    │                       │                       │
     │  opens auto      │                       │                       │
     │◄─────────────────│                       │                       │
     │                  │                       │                       │
     │  13. Reviews     │                       │                       │
     │  diffs, approves │                       │                       │
     │─────────────────►│                       │                       │
     │                  │ 14. invoke("approve") │                       │
     │                  │──────────────────────►│                       │
     │                  │                       │ 15. ChangeManager     │
     │                  │                       │ .apply_approved()     │
     │                  │                       │ (atomic file writes)  │
     │                  │                       │───────────────────┐   │
     │                  │                       │◄──────────────────┘   │
     │                  │                       │                       │
     │  16. Commits     │                       │                       │
     │─────────────────►│                       │                       │
     │                  │ 17. invoke("git_commit")                      │
     │                  │──────────────────────►│                       │
     │                  │                       │ 18. GitIntegration    │
     │                  │                       │ .commit_with_metadata │
     │                  │                       │ (trailers attached)   │
     │                  │                       │───────────────────┐   │
     │                  │                       │◄──────────────────┘   │
     │                  │ 19. { commitHash }    │                       │
     │                  │◄──────────────────────│                       │
     │  ✅ Committed    │                       │                       │
     │◄─────────────────│                       │                       │
```

### 6.2 Flow de Rejet avec Feedback

```
User rejects file A avec feedback
    ↓
Frontend: invoke("reject_changes", { sessionId, filePath, feedback })
    ↓
ChangeManager.reject(filePath, feedback)
    → met à jour DB: FileChange.review_status = Rejected, reviewer_feedback = feedback
    ↓
AgentManager.send_feedback(sessionId, "File {filePath} rejected: {feedback}")
    ↓
ClaudeCodeCliAdapter.send_message(sessionId, feedback_message)
    → écrit dans stdin du subprocess
    ↓
Subprocess reprend → génère nouvelles propositions
    ↓
Nouveau cycle de events stdout → parse → broadcast channel → GPUI views update
    ↓
Frontend reçoit agent:changes_ready → Review panel se met à jour
```

### 6.3 Flow de l'Event Stream (ClaudeCode CLI)

```
tokio::process stdout pipe
    ↓
StreamReader (ligne par ligne)
    ↓
JSON parser (each line is a JSON event)
    ↓
AgentEvent deserialization
    ↓
┌────────────────────────────────────────────────────────┐
│ Match event type:                                       │
│  "thinking"     → TimelineEvent::Thinking              │
│  "tool_use"     → TimelineEvent::ToolUse + log context │
│  "file_read"    → TimelineEvent::FileRead + update ctx │
│  "file_write"   → TimelineEvent::FileWrite + stage chg │
│  "api_response" → update token count                   │
│  "done"         → mark session WaitingApproval         │
└────────────────────────────────────────────────────────┘
    ↓
SessionStore.log_timeline_event(event)    [async, DB write]
    ↓
broadcast::send(AppEvent::AgentEvent) → GPUI views (ADR-10)
```

---

## 7. Process Lifecycle (Agent Spawn → Approve)

### 7.1 Machine à États de l'AgentSession

```
                    ┌──────────────────────────────────────────────────────┐
                    │                  AgentSession States                  │
                    └──────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   Created   │  (session créée en DB, pas encore spawn)
                              └──────┬──────┘
                                     │ spawn() appelé
                                     ▼
                              ┌─────────────┐
                              │  Thinking   │  (agent traite la tâche, génère un plan)
                              └──────┬──────┘
                                     │ agent commence modifications
                          ┌──────────▼──────────┐
                          │       Coding        │  (agent lit/écrit des fichiers)
                          └──────────┬──────────┘
                                     │ agent finit, propose changements
                                     ▼
                          ┌──────────────────────┐
                          │   WaitingApproval    │  (review panel ouvert)
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
           tout approuvé    rejeté avec feedback   rejeté sans feedback
                    │                │                 │
                    ▼                ▼                 │
             ┌──────────┐    ┌──────────────┐         │
             │ Applying │    │WaitingFeedback│        │
             └────┬─────┘    └──────┬───────┘         │
                  │                 │                   │
                  │           agent reçoit msg          │
                  │                 │                   │
                  │                 ▼                   │
                  │           retour à Thinking         │
                  │                                     │
                  │                                     ▼
                  │                              ┌─────────────┐
                  │                              │  Terminated │
                  │                              └─────────────┘
                  ▼
           ┌─────────────┐
           │  Completed  │  (changements appliqués, session archivée)
           └─────────────┘

           ══════ Transitions d'erreur (depuis n'importe quel état) ══════
                    Subprocess crash | timeout | user kill
                              ▼
                       ┌──────────┐
                       │   Error  │
                       └──────────┘
```

### 7.2 Gestion du Subprocess (ClaudeCodeCliAdapter)

```rust
// Pseudo-code de la gestion du lifecycle

async fn spawn(request: SpawnRequest) -> Result<AgentSession> {
    // 1. Préparer la commande
    let mut cmd = Command::new("claude");
    cmd.arg("--output-format").arg("stream-json")
       .arg("--model").arg(&request.model)
       .current_dir(&request.workspace_path)
       .stdin(Stdio::piped())
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    // 2. Spawn le subprocess
    let mut child = cmd.spawn()?;
    let stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();

    // 3. Envoyer le prompt initial via stdin
    let initial_msg = build_initial_prompt(&request);
    write_to_stdin(stdin, initial_msg).await?;

    // 4. Démarrer le task de lecture du stdout
    let session_id = request.session_id.clone();
    let event_tx = self.event_bus.sender();
    tokio::spawn(async move {
        stream_stdout(stdout, session_id, event_tx).await;
    });

    // 5. Démarrer le task de surveillance de la mort du processus
    tokio::spawn(async move {
        let exit_status = child.wait().await;
        handle_process_exit(session_id, exit_status, event_tx).await;
    });

    Ok(session)
}

async fn terminate(session_id: SessionId, reason: TerminateReason) {
    if let Some(child) = self.get_child(session_id) {
        // SIGTERM d'abord
        child.kill().await?;
        // Si pas mort après 5s, SIGKILL
        timeout(Duration::from_secs(5), child.wait()).await
            .unwrap_or_else(|_| { /* force kill */ });
    }
    self.session_store.update_status(session_id, AgentStatus::Terminated).await;
}
```

### 7.3 Gestion des Crashs (Resilience)

```
Scénario: subprocess crash pendant "Coding"
    ↓
tokio::process wait() retourne avec exit code non-zero
    ↓
handle_process_exit() appelé
    ↓
SessionStore.update_status(sessionId, Error("Crash: exit code {n}"))
    ↓
broadcast::send(AppEvent::AgentError) → GPUI views update (ADR-10)
    ↓
UI: AgentCard montre état "Error" + message
    → bouton "Retry" disponible (respawn avec même tâche/contexte)
    → timeline events préservés jusqu'au point de crash
    → changements partiellement proposés conservés pour review
```

---

## 8. Database Schema (SQLite)

### 8.1 Structure de la DB

La DB SQLite est créée à `{workspace_root}/.mnm/mnm.db`.

```sql
-- ============================================================
-- Migration 001 - Initial Schema
-- ============================================================

-- Table principale des sessions
CREATE TABLE agent_sessions (
    id              TEXT PRIMARY KEY,           -- UUID v4
    workspace_path  TEXT NOT NULL,
    task_description TEXT NOT NULL,
    framework_type  TEXT NOT NULL,              -- "claude_code_cli" | "anthropic_api"
    model           TEXT NOT NULL,              -- "claude-opus-4" | "claude-sonnet-4"
    status          TEXT NOT NULL DEFAULT 'created',
                                                -- created|thinking|coding|waiting_approval|
                                                -- waiting_feedback|applying|completed|error|terminated
    created_at      TEXT NOT NULL,              -- ISO 8601 UTC
    completed_at    TEXT,                       -- NULL si en cours
    total_tokens    INTEGER NOT NULL DEFAULT 0,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT                        -- NULL si pas d'erreur
);

-- Fichiers de contexte pour chaque session
CREATE TABLE session_context_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES agent_sessions(id),
    file_path       TEXT NOT NULL,
    added_at        TEXT NOT NULL,              -- ISO 8601 UTC
    source          TEXT NOT NULL DEFAULT 'manual',
                                                -- "manual" | "auto_detected" | "agent_requested"
    relevance_score REAL                        -- 0.0-1.0, NULL si manuel
);

-- Changements de fichiers proposés/appliqués
CREATE TABLE file_changes (
    id              TEXT PRIMARY KEY,           -- UUID v4
    session_id      TEXT NOT NULL REFERENCES agent_sessions(id),
    file_path       TEXT NOT NULL,
    change_type     TEXT NOT NULL,              -- "create" | "modify" | "delete"
    review_status   TEXT NOT NULL DEFAULT 'pending',
                                                -- "pending" | "approved" | "rejected"
    reviewer_feedback TEXT,
    agent_reasoning TEXT,
    proposed_at     TEXT NOT NULL,              -- ISO 8601 UTC
    reviewed_at     TEXT,
    applied_at      TEXT,
    -- Contenus stockés comme fichiers séparés (voir ci-dessous)
    before_snapshot_path TEXT,                  -- chemin vers fichier dans .mnm/snapshots/
    after_snapshot_path  TEXT
);

-- Hunks individuels de diff (pour approbation granulaire)
CREATE TABLE diff_hunks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    file_change_id  TEXT NOT NULL REFERENCES file_changes(id),
    hunk_index      INTEGER NOT NULL,
    old_start       INTEGER NOT NULL,
    old_lines       INTEGER NOT NULL,
    new_start       INTEGER NOT NULL,
    new_lines       INTEGER NOT NULL,
    review_status   TEXT NOT NULL DEFAULT 'pending',
    diff_content    TEXT NOT NULL               -- patch format
);

-- Événements de timeline (log d'audit)
CREATE TABLE timeline_events (
    id              TEXT PRIMARY KEY,           -- UUID v4
    session_id      TEXT NOT NULL REFERENCES agent_sessions(id),
    timestamp       TEXT NOT NULL,              -- ISO 8601 UTC
    event_type      TEXT NOT NULL,              -- "thinking"|"file_read"|"file_write"|
                                                -- "tool_use"|"change_proposed"|
                                                -- "change_approved"|"change_rejected"|
                                                -- "session_started"|"session_completed"|
                                                -- "session_error"
    description     TEXT NOT NULL,
    tokens_consumed INTEGER NOT NULL DEFAULT 0,
    raw_data        TEXT                        -- JSON blob (nullable)
);

-- Fichiers impliqués dans chaque timeline event
CREATE TABLE timeline_event_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id        TEXT NOT NULL REFERENCES timeline_events(id),
    file_path       TEXT NOT NULL,
    operation       TEXT                        -- "read" | "write" | "delete"
);

-- Messages de conversation (user ↔ agent)
CREATE TABLE conversation_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES agent_sessions(id),
    timestamp       TEXT NOT NULL,
    role            TEXT NOT NULL,              -- "user" | "assistant"
    content         TEXT NOT NULL,
    tokens          INTEGER NOT NULL DEFAULT 0
);

-- Métadonnées Git liées aux sessions
CREATE TABLE git_commits (
    commit_hash     TEXT PRIMARY KEY,
    session_id      TEXT REFERENCES agent_sessions(id),
    workspace_path  TEXT NOT NULL,
    committed_at    TEXT NOT NULL,
    commit_message  TEXT NOT NULL,
    author          TEXT NOT NULL,
    -- Prompt metadata (dupliqué ici pour query rapide ; source of truth = git trailers)
    mnm_prompt      TEXT,
    mnm_agent       TEXT,
    mnm_tokens      INTEGER,
    mnm_context_files TEXT                      -- JSON array de chemins
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_sessions_workspace ON agent_sessions(workspace_path);
CREATE INDEX idx_sessions_status ON agent_sessions(status);
CREATE INDEX idx_sessions_created_at ON agent_sessions(created_at);
CREATE INDEX idx_timeline_session ON timeline_events(session_id);
CREATE INDEX idx_timeline_timestamp ON timeline_events(timestamp);
CREATE INDEX idx_file_changes_session ON file_changes(session_id);
CREATE INDEX idx_file_changes_status ON file_changes(review_status);
CREATE INDEX idx_git_commits_session ON git_commits(session_id);
```

### 8.2 Stockage des Snapshots de Fichiers

Les contenus de fichiers (avant/après) sont stockés hors DB pour éviter de gonfler SQLite :

```
{workspace_root}/
└── .mnm/
    ├── mnm.db                          # SQLite database
    ├── snapshots/
    │   └── {session_id}/
    │       ├── {file_change_id}_before.txt
    │       └── {file_change_id}_after.txt
    └── exports/
        └── {session_id}_audit.json     # Exports manuels
```

### 8.3 Versioning du Schema

```rust
// src-tauri/src/storage/migrations/mod.rs

static MIGRATIONS: Migrations<'static> = Migrations::new(vec![
    M::up(include_str!("001_initial.sql")),
    // M::up(include_str!("002_add_context_presets.sql")),  // v2
]);

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    MIGRATIONS.to_latest(conn)?;
    Ok(())
}
```

---

## 9. Git Integration Layer

### 9.1 Architecture de l'Intégration Git

```
GitIntegration
│
├── Repository Handle (git2::Repository)
│   └── Opened lazily, cached per workspace
│
├── commit_with_metadata(CommitRequest) → Result<String>
│   ├── Stage specified files (git add)
│   ├── Build commit message with MnM trailers
│   ├── Create commit via git2
│   └── Store in git_commits table
│
├── query_history(QueryOptions) → Result<Vec<GitCommit>>
│   ├── Walk revwalk from HEAD
│   ├── Parse commit messages for MnM trailers
│   └── Enrich with DB data (session info)
│
├── get_commit_metadata(hash) → Result<Option<PromptMetadata>>
│   ├── Read commit from git2
│   ├── Parse trailers
│   └── Join with git_commits table
│
├── get_diff(from, to, file?) → Result<FileDiff>
│   ├── git2 diff between two refs
│   └── Parse into DiffHunk structs
│
└── export_audit_trail(session_id) → Result<AuditExport>
    ├── Load session from DB
    ├── Load all timeline events
    ├── Load all file changes + diffs
    └── Serialize to JSON
```

### 9.2 Format des Trailers Git

```
commit a3f8b91c4d2e...
Author: Nikou <nikou@example.com>
Date:   Thu Feb 19 14:30:00 2026 +0100

    Refactor authentication module to use JWT

    The auth module now uses JWT tokens instead of session cookies.
    All existing tests have been updated accordingly.

    MnM-Prompt: Refactor the authentication module to use JWT
    MnM-Session: 550e8400-e29b-41d4-a716-446655440000
    MnM-Agent: claude-code-cli
    MnM-Model: claude-opus-4
    MnM-Tokens: 12847
    MnM-Context: src/auth/login.ts,src/auth/jwt.ts,src/auth/types.ts
    MnM-Approved-Files: 3
    MnM-Rejected-Files: 1
    MnM-Approval-Rate: 0.75
```

### 9.3 Implémentation Rust

```rust
// src-tauri/src/git/commit.rs

pub struct CommitRequest {
    pub workspace_path: PathBuf,
    pub files: Vec<PathBuf>,
    pub message: String,
    pub session: &AgentSession,
}

pub fn commit_with_metadata(req: CommitRequest) -> Result<String> {
    let repo = Repository::open(&req.workspace_path)?;
    let mut index = repo.index()?;

    // Stage les fichiers spécifiés
    for file in &req.files {
        let relative = file.strip_prefix(&req.workspace_path)?;
        index.add_path(relative)?;
    }
    index.write()?;

    // Build le message avec trailers
    let context_files = req.session.context_files.join(",");
    let approval_rate = compute_approval_rate(&req.session);

    let full_message = format!(
        "{}\n\n\
        MnM-Prompt: {}\n\
        MnM-Session: {}\n\
        MnM-Agent: {}\n\
        MnM-Model: {}\n\
        MnM-Tokens: {}\n\
        MnM-Context: {}\n\
        MnM-Approval-Rate: {:.2}",
        req.message,
        req.session.task_description,
        req.session.id,
        req.session.framework_type.as_str(),
        req.session.model,
        req.session.total_tokens,
        context_files,
        approval_rate,
    );

    // Créer le commit
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let parent = repo.head()?.peel_to_commit()?;

    let commit_hash = repo.commit(
        Some("HEAD"),
        &sig, &sig,
        &full_message,
        &tree,
        &[&parent],
    )?;

    Ok(commit_hash.to_string())
}
```

### 9.4 Query History avec Métadonnées MnM

```rust
// src-tauri/src/git/history.rs

pub fn parse_mnm_trailers(message: &str) -> Option<PromptMetadata> {
    let mut meta = PromptMetadata::default();
    let mut found = false;

    for line in message.lines() {
        if let Some(val) = line.strip_prefix("MnM-Prompt: ") {
            meta.prompt = val.to_string(); found = true;
        } else if let Some(val) = line.strip_prefix("MnM-Session: ") {
            meta.session_id = val.to_string();
        } else if let Some(val) = line.strip_prefix("MnM-Agent: ") {
            meta.agent = val.to_string();
        } else if let Some(val) = line.strip_prefix("MnM-Model: ") {
            meta.model = val.to_string();
        } else if let Some(val) = line.strip_prefix("MnM-Tokens: ") {
            meta.tokens = val.parse().unwrap_or(0);
        } else if let Some(val) = line.strip_prefix("MnM-Context: ") {
            meta.context_files = val.split(',').map(String::from).collect();
        } else if let Some(val) = line.strip_prefix("MnM-Approval-Rate: ") {
            meta.approval_rate = val.parse().unwrap_or(0.0);
        }
    }

    if found { Some(meta) } else { None }
}
```

---

## 10. Sécurité & Persistence

### 10.1 API Key Storage

```rust
// src-tauri/src/security/keychain.rs
// Utilise le crate `keyring` qui wrap OS keychain:
//   macOS    → Keychain Services
//   Linux    → libsecret (GNOME Keyring) / KWallet
//   Windows  → Windows Credential Manager

const SERVICE_NAME: &str = "mnm-cde";

pub fn store_api_key(provider: &str, key: &str) -> Result<()> {
    let entry = keyring::Entry::new(SERVICE_NAME, provider)?;
    entry.set_password(key)?;
    Ok(())
}

pub fn get_api_key(provider: &str) -> Result<Option<String>> {
    let entry = keyring::Entry::new(SERVICE_NAME, provider)?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}
```

### 10.2 Atomic File Writes

```rust
// src-tauri/src/changes/apply.rs

pub async fn apply_change_atomically(change: &FileChange) -> Result<()> {
    let target_path = PathBuf::from(&change.file_path);
    let content = change.after_content.as_ref()
        .ok_or(ApplyError::MissingContent)?;

    // Écrire dans un fichier temporaire DANS le même répertoire
    // (pour garantir atomicité même cross-filesystem)
    let parent = target_path.parent().unwrap_or(Path::new("/"));
    let tmp_path = parent.join(format!(".mnm_tmp_{}", uuid::Uuid::new_v4()));

    fs::write(&tmp_path, content).await?;

    // Rename atomique (POSIX)
    fs::rename(&tmp_path, &target_path).await?;

    Ok(())
}
```

### 10.3 Politique de Données

- **Aucune télémétrie** sans consentement explicite (opt-in seulement, v2+)
- **Toutes les données restent locales** dans `{workspace}/.mnm/`
- **API keys** jamais écrits en plaintext dans aucun fichier
- **Logs** ne contiennent pas de contenu de fichiers (seulement des chemins et métadonnées)

---

## 11. Considérations Cross-Platform

### 11.1 Path Handling

```rust
// src-tauri/src/workspace/paths.rs

/// Normalise tous les chemins vers des forward slashes pour stockage DB
/// et pour affichage UI. Conversion native au moment des I/O système.
pub fn to_db_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
}

pub fn from_db_path(s: &str) -> PathBuf {
    #[cfg(windows)]
    { PathBuf::from(s.replace('/', "\\")) }
    #[cfg(not(windows))]
    { PathBuf::from(s) }
}
```

### 11.2 Process Spawning

```rust
// Claude Code CLI est disponible sur PATH sur les 3 plateformes
// La résolution de PATH est gérée via std::process::Command (cross-platform natif, ADR-10)

#[cfg(windows)]
fn claude_binary() -> &'static str { "claude.exe" }

#[cfg(not(windows))]
fn claude_binary() -> &'static str { "claude" }
```

### 11.3 Config & Data Directories

```
macOS:   ~/Library/Application Support/mnm/
Linux:   ~/.config/mnm/  (XDG_CONFIG_HOME)
Windows: %APPDATA%\mnm\

Workspace data (per project):
{workspace_root}/.mnm/
    mnm.db
    snapshots/
    exports/
```

---

## 12. Décisions d'Architecture (ADRs Complémentaires)

### ADR-6: Zustand pour l'État Frontend ~~[OBSOLÈTE — ADR-10]~~

**Statut :** ❌ OBSOLÈTE — supersédé par ADR-10.

**Décision initiale (abandonnée):** Zustand (React state management) pour l'état global du frontend.

**Pourquoi obsolète :** ADR-10 supprime tout le frontend React/TypeScript. L'état UI est géré via le **Entity system GPUI** (modèle réactif Rust-natif), qui joue le même rôle de façon type-safe et sans couche JavaScript.

**Remplacé par :**
```rust
// GPUI Entity system — équivalent Rust de Zustand
pub struct AppState {
    pub sessions: HashMap<String, AgentSession>,
    pub active_session_id: Option<String>,
    pub workspace: Option<WorkspaceInfo>,
}

// Dans les GPUI views : Model<AppState>
// cx.observe(&app_state, |view, cx| { view.render(cx) }) — réactif automatique
```

### ADR-7: Event Bus Interne Rust (tokio::broadcast)

**Décision:** Canal `tokio::broadcast` pour distribuer les AgentEvents en interne (entre AgentManager, SessionStore, et GPUI views).

**Justification:** Permet à plusieurs consommateurs (logger DB + GPUI UI + metrics) de recevoir les mêmes événements sans couplage. ADR-10 : le consumer "Tauri event emitter" est remplacé par le consumer "GPUI broadcast receiver".

```rust
// Dans AgentManager
let (event_tx, _) = tokio::sync::broadcast::channel::<AppEvent>(256);
// SessionStore subscribe → log to DB
// GPUI views subscribe → cx.spawn() avec rx.recv().await (ADR-10, remplace Tauri events)
// Metrics subscribe → future monitoring
```

### ADR-8: Une DB SQLite par Workspace (pas globale)

**Décision:** La DB SQLite est dans `{workspace}/.mnm/mnm.db` et pas dans le répertoire de config global.

**Justification:**
- Workspace est self-contained → portable, copiable, partageable en équipe
- Pas de mélange de données entre projets
- Facilite le debug (ouvrir la DB avec DB Browser for SQLite directement dans le projet)

**Conséquence:** MnM maintient une connexion pool par workspace ouvert (max 3 workspaces simultanés pour MVP).

### ADR-9: GPUI Render dans WebView vs Fenêtre Séparée ~~[SUPERSEDED par ADR-10]~~

**Décision initiale (abandonée):** Pour MVP, l'éditeur et le diff viewer GPUI sont rendus dans une fenêtre GPUI séparée de la WebView Tauri.

**Pourquoi abandonné:** Résultat = 2 fenêtres séparées, UX fragmentée, 2 renderers différents à maintenir, IPC bridge complexe entre React et GPUI. Contraire à la contrainte Nikou.

---

### ADR-10: Architecture Single Window — 100% GPUI (Fenêtre Unifiée)

**Date:** 2026-02-19
**Statut:** ✅ VALIDÉ — Remplace ADR-9

**Contrainte de Nikou :**
- ✅ Une seule fenêtre unifiée
- ✅ App Rust bien optimisée (pas d'Electron, pas de WebView lourd)
- ✅ Tous les composants UI dans le même rendu

**Décision:** Supprimer la Tauri WebView (React/HTML) et migrer **100% de l'UI vers GPUI**. MnM devient une application Rust pure avec une seule fenêtre GPUI rendant l'ensemble des composants : Dashboard, Timeline, Diff Viewer, Monitoring ET Éditeur de code.

#### Options évaluées

| Option | Fenêtre unique | Rust natif | Perf text | Maturité IDE | Verdict |
|--------|---------------|-----------|-----------|-------------|---------|
| **100% GPUI** | ✅ | ✅ | ✅ Excellent | ✅ Zed proof | **✅ CHOISI** |
| egui | ✅ | ✅ | ⚠️ Correct | ❌ Pas IDE | Non |
| Iced | ✅ | ✅ | ⚠️ Correct | ❌ Pas IDE | Non |
| Slint | ✅ | ✅ | ⚠️ | ❌ Pas IDE | Non |
| Tauri WebView seul | ✅ | ❌ WebKit | ✅ | ⚠️ | Non |
| GPUI + Tauri (2 win) | ❌ 2 fenêtres | ✅ | ✅ | ⚠️ | ADR-9 abandonné |

#### Pourquoi GPUI peut tout gérer

GPUI est le framework sur lequel Zed Editor est construit **entièrement**. Zed démontre que GPUI peut rendre :

- ✅ **Editor** : Buffer model, syntax highlighting tree-sitter, multi-cursor, gutter → crate `editor`
- ✅ **Diff viewer** : Myers diff, hunk rendering, side-by-side → crate `diff`
- ✅ **Panels/Layout** : Panneaux redimensionnables, split views → crate `workspace`
- ✅ **File tree** : Composants de liste hiérarchique → patterns GPUI natifs
- ✅ **Timeline** : Scroll views, event lists → GPUI scroll container
- ✅ **Dashboard** : Cards, status indicators → GPUI custom views
- ✅ **Context viewer** : Token budget bar, file lists → GPUI views
- ✅ **GPU-accelerated** : Metal (macOS), Vulkan (Linux), DX12 (Windows) → 60fps garanti

#### Architecture Mise à Jour

```
┌──────────────────────────────────────────────────────────────────┐
│                    FENÊTRE UNIQUE (GPUI Window)                   │
│                    GPU-accelerated · Rust natif                   │
│                                                                    │
│  ┌─────────┐  ┌──────────────────────────────┐  ┌─────────────┐ │
│  │Sidebar  │  │     Main Content Area         │  │Right Panel  │ │
│  │         │  │                               │  │             │ │
│  │FileBrow │  │  ┌─────────┐  ┌──────────┐   │  │ContextView  │ │
│  │Session  │  │  │Dashboard│  │ Review   │   │  │TokenBudget  │ │
│  │GitHist  │  │  │AgentCard│  │ DiffView │   │  │             │ │
│  │         │  │  └─────────┘  └──────────┘   │  │Timeline     │ │
│  │         │  │  ┌─────────────────────────┐  │  │EventList    │ │
│  │         │  │  │  Minimal Editor (GPUI)  │  │  │             │ │
│  │         │  │  │  (Zed editor crate)     │  │  │             │ │
│  │         │  │  └─────────────────────────┘  │  │             │ │
│  └─────────┘  └──────────────────────────────┘  └─────────────┘ │
└─────────────────────────┬────────────────────────────────────────┘
                          │ Rust channels (pas d'IPC)
┌─────────────────────────▼────────────────────────────────────────┐
│                    RUST BACKEND CORE                              │
│         AgentManager · ChangeManager · SessionStore              │
│         (Tokio async · SQLite · Git · Process mgmt)              │
└──────────────────────────────────────────────────────────────────┘
```

#### Impact sur le Stack Technologique

**Supprimé :**
- ❌ Tauri 2.x (plus nécessaire — on n'a plus de WebView)
- ❌ React / TypeScript
- ❌ Tauri IPC commands (invoke/listen)
- ❌ Zustand store (ADR-6 obsolète)
- ❌ Toute la couche `src/` frontend web

**Remplacé par :**
- ✅ GPUI standalone (pas via Tauri)
- ✅ Crates Zed étendues : `workspace`, `project` (layout multi-panel)
- ✅ Communication via channels Rust natifs (tokio::mpsc/broadcast) — plus rapide, plus simple
- ✅ State management : Entity system GPUI (réactif, Rust-natif)

**Conservé :**
- ✅ Tout le Rust backend (AgentManager, ChangeManager, SessionStore, GitIntegration)
- ✅ SQLite (rusqlite)
- ✅ Tokio async runtime
- ✅ tree-sitter, git2, keyring, notify, similar

**Packaging (remplace Tauri bundler) :**
- macOS : `cargo-bundle` → `.app` bundle
- Linux : AppImage ou flatpak
- Windows : NSIS installer

#### Effort Additionnel vs ADR-9

| Aspect | ADR-9 (2 fenêtres) | ADR-10 (100% GPUI) | Delta |
|--------|--------------------|--------------------|-------|
| Frontend React | ~8 sem | ~~0~~ (supprimé) | -8 sem |
| GPUI Dashboard custom | ~3 sem | ~5 sem | +2 sem |
| GPUI Timeline custom | ~2 sem | ~3 sem | +1 sem |
| GPUI Context Viewer | ~1 sem | ~2 sem | +1 sem |
| Tauri IPC bridge | ~2 sem | ~~0~~ (supprimé) | -2 sem |
| GPUI Editor (inchangé) | ~3 sem | ~3 sem | = |
| Packaging (cargo-bundle) | inclus Tauri | ~0.5 sem | +0.5 sem |
| **TOTAL DELTA** | | | **~-5.5 sem** ✨ |

> **Conclusion effort :** La migration 100% GPUI est **moins coûteuse** que l'approche hybride une fois qu'on compte la suppression du layer React et du bridge IPC. La complexité est transférée vers GPUI (Rust) qui est plus simple à maintenir dans ce projet.

#### Risques & Mitigations

| Risque | Probabilité | Mitigation |
|--------|------------|------------|
| API GPUI instable (pre-1.0) | Moyen | Épingler la version git Zed, wrapper thin autour des APIs critiques |
| Documentation GPUI limitée | Élevée | Étudier le code source Zed comme référence primaire |
| Composants riches plus longs à builder | Faible | Zed workspace/panel crates réutilisables |
| Packaging sans Tauri | Faible | cargo-bundle mature pour .app, AppImage |

#### Références Zed Crates Additionnelles

```toml
# Cargo.toml — nouvelles dépendances ADR-10
gpui = { git = "https://github.com/zed-industries/zed", rev = "<sha-stable>" }
workspace = { git = "https://github.com/zed-industries/zed", rev = "<sha-stable>" }
editor = { git = "https://github.com/zed-industries/zed", rev = "<sha-stable>" }
language = { git = "https://github.com/zed-industries/zed", rev = "<sha-stable>" }
diff = { git = "https://github.com/zed-industries/zed", rev = "<sha-stable>" }
project = { git = "https://github.com/zed-industries/zed", rev = "<sha-stable>" }
```

**ADRs impactés :**
- ADR-6 (Zustand) → **OBSOLÈTE** (plus de frontend React)
- ADR-7 (tokio::broadcast) → **CONSERVÉ** mais simplifié (pas d'émission Tauri, juste canaux internes)
- ADR-8 (SQLite par workspace) → **CONSERVÉ** sans changement

---

## Annexe A : Estimation de Complexité

> **Note ADR-10:** Tableau mis à jour — Architecture 100% GPUI, Tauri WebView supprimé.

| Composant | Complexité | Durée Estimée | Delta vs ADR-9 |
|-----------|-----------|---------------|----------------|
| ~~Tauri shell + IPC setup~~ (supprimé) | — | ~~1 semaine~~ | **-1 sem** |
| GPUI app bootstrap (Window + layout) | Faible | 0.5 semaine | nouveau |
| AgentFramework trait + ClaudeCode adapter | Haute | 3 semaines | = |
| Anthropic API adapter | Moyenne | 1 semaine | = |
| AgentManager + event bus | Haute | 2 semaines | = |
| ChangeManager + atomic writes | Moyenne | 1 semaine | = |
| SQLite schema + migrations | Faible | 1 semaine | = |
| SessionStore CRUD | Faible | 1 semaine | = |
| Git integration (trailers + history) | Moyenne | 2 semaines | = |
| WorkspaceIndex (file tree + search) | Moyenne | 2 semaines | = |
| GPUI Dashboard + AgentCard | Haute | 5 semaines | +2 sem |
| GPUI Review Panel + DiffViewer | Haute | 3 semaines | = |
| GPUI Timeline Panel | Moyenne | 3 semaines | +1 sem |
| GPUI Context Viewer | Moyenne | 2 semaines | +1 sem |
| GPUI FileBrowser | Faible | 1.5 semaine | +0.5 sem (vs React) |
| GPUI Minimal Editor (Zed crate intégration) | Haute | 3 semaines | = |
| ~~React/TypeScript frontend~~ (supprimé) | — | ~~8 semaines~~ | **-8 sem** |
| Keyboard shortcuts + theming (GPUI) | Faible | 1 semaine | = |
| Packaging (cargo-bundle, AppImage) | Faible | 0.5 semaine | ≈ |
| Tests + polish | Moyenne | 3 semaines | = |
| **TOTAL ESTIMÉ** | | **~26-28 semaines (~6-7 mois)** | **~-4 sem** ✨ |

> **Gain ADR-10 :** ~4 semaines d'effort total en moins grâce à la suppression de la couche React et du bridge Tauri IPC, malgré un surcoût GPUI pour les composants custom.

---

## Annexe B : Séquence de Démarrage de l'Application

```
// ADR-10 : séquence 100% GPUI, pas de Tauri WebView
1. GPUI app init (cx.open_window → GPU context)
2. Run SQLite migrations (chaque workspace ouvert)
3. Charger config (framework préféré, workspace path)
4. Vérifier disponibilité Claude Code CLI (`which claude`)
5. GPUI rasterizer setup → Metal/Vulkan/DX12
6. Render root view (AppShell GPUI) → fenêtre unique visible
7. WorkspaceIndex.init() → indexer file tree en background (tokio)
8. SessionStore.load_active_sessions() → restaurer sessions en cours
9. Tokio broadcast channels actifs → AgentManager prêt
10. UI prête → cold start < 3s (NFR1)
// Note: plus de "React mount" ni "Tauri events subscribe" — tout Rust
```

---

*Document généré le 2026-02-19. Basé sur PRD MnM v1.0.*
*Prochaines étapes recommandées : Story mapping des épics, setup du repo, Spike GPUI multi-panel layout (crates workspace/project Zed), POC AppHandle → GPUI view binding.*

*v1.1 — ADR-10 validé : Architecture single window 100% GPUI. Tauri WebView supprimé.*
