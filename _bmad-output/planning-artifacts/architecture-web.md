---
date: 2026-02-20
author: Daedalus (System Architect)
version: 1.0
status: Draft
baseDocument: architecture.md (Rust/GPUI v1.0)
inputDocuments:
  - architecture.md
  - prd.md
  - epics.md
  - product-brief-mnm-2026-02-19.md
---

# MnM Web Architecture (Next.js POC)

## Document Overview

This document adapts the existing MnM system architecture from a native Rust/GPUI desktop application to a **web-based POC** built with Next.js. The architecture preserves the core domain logic, data model, and workflows while mapping them to a web-appropriate technology stack.

**Purpose:** Validate MnM's core value propositions (agent orchestration, drift detection, spec-as-interface) in a web environment before committing to the full native Rust/GPUI build.

**Key Architectural Decisions (Web POC):**
- Next.js 15 App Router with TypeScript for full-stack web application
- SQLite via Drizzle ORM + better-sqlite3 (preserves local-first)
- Tailwind CSS + shadcn/ui for clean, professional UI
- simple-git for git integration (replaces git2-rs)
- Claude API via server-side API routes (preserves API key security)
- Server-Sent Events for real-time agent log streaming

---

## 1. System Overview

### 1.1 High-Level Architecture

MnM Web is a **local-first web application** with three core subsystems, mapped from the native architecture:

```
+-------------------------------------------------------------+
|                     MnM Web Application                       |
|  +-------------+  +--------------+  +------------------+     |
|  |  UI Layer   |  | Core Engine  |  | Agent Runtime    |     |
|  |  (React +   |<-|  (Business   |<-|  (Claude Code    |     |
|  |  shadcn/ui) |  |   Logic)     |  |   Subprocess)    |     |
|  +-------------+  +--------------+  +------------------+     |
|         ^                ^                      ^             |
|         |                |                      |             |
|         v                v                      v             |
|  +-------------+  +--------------+  +------------------+     |
|  |  Next.js    |  |   State      |  |   Data Layer     |     |
|  |  App Router |  | (React/SSE)  |  |   (SQLite +      |     |
|  |  + API      |  |              |  |    Drizzle ORM)  |     |
|  +-------------+  +--------------+  +------------------+     |
+-------------------------------------------------------------+
                          |
                          v
              +-------------------+
              |   Git Repository  |
              |  (Source of Truth) |
              +-------------------+
```

### 1.2 Web vs. Native Architecture Mapping

| Native (Rust/GPUI) | Web (Next.js) | Rationale |
|---------------------|--------------|-----------|
| GPUI GPU rendering | React + shadcn/ui | Browser-native, rapid prototyping |
| GPUI `Model<T>` state | React state + SWR/polling | Familiar React patterns |
| Cargo workspace (7 crates) | `src/lib/` modules (7 dirs) | Same separation, JS modules |
| `git2-rs` (libgit2) | `simple-git` (CLI wrapper) | No native bindings needed |
| `rusqlite` / `sqlez` | Drizzle ORM + better-sqlite3 | Type-safe, migration support |
| IPC (stdin/stdout) | Node.js `child_process` | Same subprocess pattern |
| `tokio` async | Node.js async/await | Native to runtime |
| `tracing` structured logging | `pino` or `console` | Standard Node.js logging |
| macOS Keychain | `.env.local` (dev) / env vars | Simplified for POC |

### 1.3 Core Workflows (Preserved)

All three core workflows from the native architecture are preserved:

**Workflow 1: Agent Launch & Orchestration** -- unchanged flow, web UI triggers API routes instead of GPUI actions.

**Workflow 2: Drift Detection** -- unchanged flow, Claude API calls happen in server-side API routes.

**Workflow 3: Spec Change Awareness** -- unchanged flow, git operations via `simple-git` in API routes.

### 1.4 External Dependencies

| Dependency | Purpose | Integration Method |
|------------|---------|-------------------|
| **Git** | Source of truth for specs + code | `simple-git` (Node.js git CLI wrapper) |
| **Claude API** | Drift analysis + spec change summarization | `fetch` in Next.js API routes |
| **Claude Code** | Agent runtime (TDD, dev, E2E, review) | `child_process.spawn` + stdout/stderr |
| **SQLite** | Local state + drift history | Drizzle ORM + `better-sqlite3` |
| **Next.js** | Full-stack web framework | App Router + API Routes |

---

## 2. Technical Stack

### 2.1 Stack Decisions & Justifications

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Language** | TypeScript | Type safety, ecosystem maturity, team familiarity |
| **Framework** | Next.js 15 (App Router) | Full-stack (SSR + API routes), file-based routing, React Server Components |
| **UI Components** | shadcn/ui + Tailwind CSS | Professional, accessible components; utility-first styling; no vendor lock-in (copy-paste, not dependency) |
| **Database** | SQLite via better-sqlite3 | Local-first (same as native), no server required, single-file |
| **ORM** | Drizzle ORM | Type-safe SQL, lightweight, excellent SQLite support, push-based migrations |
| **Git Integration** | simple-git | Comprehensive git CLI wrapper, async, well-maintained |
| **State/Real-time** | SWR + Server-Sent Events | SWR for data fetching/caching; SSE for real-time log streaming |
| **Styling** | Tailwind CSS 4 | Utility-first, consistent design, pairs with shadcn/ui |
| **Icons** | Lucide React | Default shadcn/ui icon set, tree-shakeable |
| **Build** | Next.js built-in (Turbopack) | Zero-config, fast dev/build |

### 2.2 Boring Technology Principle (Web Adaptation)

**Why Next.js?**
- **Industry standard**: Most widely adopted React meta-framework
- **Full-stack**: API routes eliminate the need for a separate backend
- **Local-first compatible**: API routes run server-side on the same machine, SQLite works natively
- **Rapid prototyping**: Hot reload, file-based routing, React ecosystem
- **Team velocity**: TypeScript + React is the most common web stack

**Why not the native Rust/GPUI stack for POC?**

| Concern | Rust/GPUI | Next.js |
|---------|-----------|---------|
| **Iteration speed** | Slow (compile times, unfamiliar API) | Fast (hot reload, familiar) |
| **UI component library** | Limited (gpui-component 0.5.1) | Extensive (shadcn/ui, 40+ components) |
| **Time to first demo** | Weeks | Days |
| **Risk** | GPUI 0.2.2 stability unknown | Production-proven framework |
| **Team expertise** | Learning curve | Existing skills |

**Trade-offs vs. Native:**

| Aspect | Native Advantage | Web Trade-off |
|--------|-----------------|--------------|
| **Performance** | 120+ FPS GPU rendering | Browser-limited (~60 FPS, sufficient for POC) |
| **Memory** | Rust zero-cost abstractions | Node.js/browser memory overhead |
| **Binary size** | Single ~50MB binary | Requires Node.js runtime |
| **Offline** | Fully offline | Requires local server running |
| **Distribution** | .dmg / homebrew | `npm start` or Docker |

### 2.3 Version Constraints

| Dependency | Version | Strategy |
|------------|---------|----------|
| `next` | `15.x` | Latest stable |
| `react` / `react-dom` | `19.x` | Latest stable (Next.js 15 default) |
| `typescript` | `5.x` | Latest stable |
| `drizzle-orm` | `latest` | Latest stable |
| `better-sqlite3` | `latest` | Latest stable |
| `simple-git` | `latest` | Latest stable |
| `tailwindcss` | `4.x` | Latest stable |

**Runtime:** Node.js 20+ LTS

---

## 3. Project Structure

### 3.1 Directory Layout

```
mnm-web/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (sidebar + nav)
│   │   ├── page.tsx                # Dashboard / home
│   │   ├── specs/
│   │   │   ├── page.tsx            # Spec browser
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Spec detail view
│   │   ├── agents/
│   │   │   └── page.tsx            # Agent dashboard
│   │   ├── drift/
│   │   │   └── page.tsx            # Drift detection results
│   │   ├── progress/
│   │   │   └── page.tsx            # Progress / roadmap view
│   │   └── settings/
│   │       └── page.tsx            # Settings panel
│   │
│   ├── components/                 # React UI components (shadcn/ui + custom)
│   │   ├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── layout/                 # Sidebar, header, nav
│   │   ├── specs/                  # Spec browser tree, spec renderer, search
│   │   ├── agents/                 # Agent cards, log viewer, controls
│   │   ├── drift/                  # Drift alerts, diff viewer, resolution UI
│   │   ├── progress/               # Roadmap, status badges
│   │   └── shared/                 # Common components (status badge, severity indicator)
│   │
│   ├── lib/                        # Business logic (maps to Cargo crates)
│   │   ├── core/                   # Domain models, types, enums (mnm-core)
│   │   │   ├── types.ts            # Agent, Spec, DriftDetection, FileLock, etc.
│   │   │   └── errors.ts           # Error types and hierarchy
│   │   ├── db/                     # Database layer (mnm-db)
│   │   │   ├── schema.ts           # Drizzle schema (all tables)
│   │   │   ├── index.ts            # Database connection + initialization
│   │   │   ├── migrate.ts          # Migration runner
│   │   │   └── repositories/       # Repository pattern (one per table)
│   │   │       ├── agents.ts
│   │   │       ├── specs.ts
│   │   │       ├── drift.ts
│   │   │       ├── file-locks.ts
│   │   │       ├── important-files.ts
│   │   │       └── spec-changes.ts
│   │   ├── agent/                  # Agent orchestration (mnm-agent)
│   │   │   ├── orchestrator.ts     # AgentOrchestrator (lifecycle management)
│   │   │   ├── claude-code.ts      # ClaudeCodeBridge (subprocess spawn + IPC)
│   │   │   ├── file-lock.ts        # FileLockManager
│   │   │   └── event-bus.ts        # AgentEventBus (EventEmitter-based)
│   │   ├── drift/                  # Drift detection (mnm-drift)
│   │   │   ├── detector.ts         # DriftDetector (pipeline orchestrator)
│   │   │   ├── analyzer.ts         # DriftAnalyzer (Claude API integration)
│   │   │   └── classifier.ts       # DriftClassifier (severity + type)
│   │   ├── git/                    # Git integration (mnm-git)
│   │   │   ├── repository.ts       # Git repository wrapper (simple-git)
│   │   │   ├── diff.ts             # Diff generation
│   │   │   ├── change-detector.ts  # Spec change detection
│   │   │   └── file-classifier.ts  # Important file classification
│   │   └── spec/                   # Spec parsing (mnm-spec)
│   │       ├── parser.ts           # SpecParser (BMAD, open-spec, markdown)
│   │       ├── indexer.ts          # SpecIndexer (scan + index all specs)
│   │       └── searcher.ts         # SpecSearcher (fuzzy search)
│   │
│   └── api/                        # Next.js API route handlers (shared logic)
│       ├── agents/
│       │   └── route.ts            # POST: launch, GET: list, PATCH: pause/resume/terminate
│       ├── agents/[id]/
│       │   ├── route.ts            # GET: agent detail, DELETE: terminate
│       │   └── logs/
│       │       └── route.ts        # GET: SSE stream for agent logs
│       ├── specs/
│       │   ├── route.ts            # GET: list specs, POST: re-index
│       │   └── [id]/
│       │       └── route.ts        # GET: spec detail + content
│       ├── drift/
│       │   ├── route.ts            # GET: list drift detections, POST: trigger manual detection
│       │   └── [id]/
│       │       └── route.ts        # PATCH: accept/reject drift
│       ├── git/
│       │   ├── status/
│       │   │   └── route.ts        # GET: git status, branch, remotes
│       │   └── changes/
│       │       └── route.ts        # GET: spec changes since last session
│       └── settings/
│           └── route.ts            # GET/PATCH: app settings
│
├── drizzle/                        # Drizzle migration files
│   └── migrations/
├── public/                         # Static assets
├── .env.local                      # Claude API key (git-ignored)
├── drizzle.config.ts               # Drizzle configuration
├── next.config.ts                  # Next.js configuration
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json
└── .mnm/                           # Runtime state (git-ignored)
    ├── state.db                    # SQLite database
    └── important-files.json        # AI-detected important files (git-tracked)
```

### 3.2 Crate-to-Module Mapping

| Rust Crate | Web Module | Responsibility |
|------------|-----------|----------------|
| `mnm-core` | `src/lib/core/` | Domain models, types, enums, error hierarchy |
| `mnm-ui` | `src/components/` + `src/app/` | React components + Next.js pages |
| `mnm-agent` | `src/lib/agent/` | Agent orchestration, Claude Code subprocess, file locking |
| `mnm-drift` | `src/lib/drift/` | Drift detection pipeline, Claude API analysis |
| `mnm-git` | `src/lib/git/` | Git integration via simple-git |
| `mnm-db` | `src/lib/db/` | Drizzle ORM schema, repositories, migrations |
| `mnm-spec` | `src/lib/spec/` | Spec parsing (BMAD, open-spec, markdown), indexing |

### 3.3 Dependency Graph (Web Modules)

```
src/components/ + src/app/
    |---> src/lib/core/
    |---> src/lib/agent/ --+--> src/lib/core/
    |                      +--> src/lib/db/ --> src/lib/core/
    |                      +--> src/lib/git/ --> src/lib/core/
    |---> src/lib/drift/ --+--> src/lib/core/
    |                      +--> src/lib/db/
    |                      +--> src/lib/git/
    |---> src/lib/spec/ ---+--> src/lib/core/
                           +--> src/lib/db/

src/lib/core/: ZERO dependencies on other MnM modules (pure domain)
```

---

## 4. Data Model (Drizzle ORM Schema)

### 4.1 Database Location

`.mnm/state.db` -- SQLite file within the target repository root (git-ignored), same as the native architecture.

### 4.2 Drizzle Schema

```typescript
// src/lib/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── agents ──────────────────────────────────────────────────
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),                  // UUID v4
  name: text("name").notNull(),                 // Human-readable name
  status: text("status").notNull(),             // idle | running | paused | completed | error
  specId: text("spec_id"),                      // FK to specs.id
  scope: text("scope"),                         // JSON array of file paths
  startedAt: integer("started_at"),             // Unix timestamp
  completedAt: integer("completed_at"),         // Unix timestamp
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── specs ───────────────────────────────────────────────────
export const specs = sqliteTable("specs", {
  id: text("id").primaryKey(),                  // SHA256 hash of file path
  filePath: text("file_path").notNull().unique(),
  specType: text("spec_type").notNull(),        // product_brief | prd | story | architecture | config
  title: text("title"),
  lastModified: integer("last_modified").notNull(),
  gitCommitSha: text("git_commit_sha"),
  contentHash: text("content_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── drift_detections ────────────────────────────────────────
export const driftDetections = sqliteTable("drift_detections", {
  id: text("id").primaryKey(),                  // UUID v4
  agentId: text("agent_id").notNull(),
  specId: text("spec_id").notNull(),
  severity: text("severity").notNull(),         // minor | moderate | critical
  driftType: text("drift_type").notNull(),      // scope_expansion | approach_change | design_deviation
  summary: text("summary").notNull(),
  recommendation: text("recommendation").notNull(),
  diffContent: text("diff_content"),
  userDecision: text("user_decision"),          // accepted | rejected | pending
  decidedAt: integer("decided_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── file_locks ──────────────────────────────────────────────
export const fileLocks = sqliteTable("file_locks", {
  id: text("id").primaryKey(),                  // UUID v4
  filePath: text("file_path").notNull(),
  agentId: text("agent_id").notNull(),
  lockType: text("lock_type").notNull(),        // read | write
  acquiredAt: integer("acquired_at").notNull(),
  releasedAt: integer("released_at"),
});

// ── important_files ─────────────────────────────────────────
export const importantFiles = sqliteTable("important_files", {
  id: text("id").primaryKey(),                  // UUID v4
  filePath: text("file_path").notNull().unique(),
  fileType: text("file_type").notNull(),        // product_brief | prd | architecture | story | config
  detectedAt: integer("detected_at").notNull(),
  userConfirmed: integer("user_confirmed").default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── spec_changes ────────────────────────────────────────────
export const specChanges = sqliteTable("spec_changes", {
  id: text("id").primaryKey(),                  // UUID v4
  filePath: text("file_path").notNull(),
  oldCommitSha: text("old_commit_sha"),
  newCommitSha: text("new_commit_sha").notNull(),
  changeSummary: text("change_summary").notNull(),
  detectedAt: integer("detected_at").notNull(),
  userViewed: integer("user_viewed").default(0),
  createdAt: integer("created_at").notNull(),
});
```

### 4.3 Migrations

**Strategy:** Drizzle Kit push-based migrations for development; generate SQL migration files for production.

```bash
# Development: push schema changes directly
npx drizzle-kit push

# Production: generate migration files
npx drizzle-kit generate
npx drizzle-kit migrate
```

Migration files are stored in `drizzle/migrations/` and applied automatically on application startup.

### 4.4 Data Lifecycle

Same as native architecture:
- **Agents**: Persist indefinitely (for history)
- **Drift Detections**: Persist indefinitely (audit trail)
- **File Locks**: Released locks can be purged after 30 days
- **Spec Changes**: Persist indefinitely (change log)

---

## 5. API Routes Design

### 5.1 Route Overview

All API routes are server-side Next.js Route Handlers running on the same machine as the client. No external server required.

| Route | Method | Purpose | Maps to Crate |
|-------|--------|---------|---------------|
| `/api/agents` | GET | List all agents | mnm-agent |
| `/api/agents` | POST | Launch new agent | mnm-agent |
| `/api/agents/[id]` | GET | Agent detail + status | mnm-agent |
| `/api/agents/[id]` | PATCH | Pause / resume / terminate | mnm-agent |
| `/api/agents/[id]` | DELETE | Terminate + cleanup | mnm-agent |
| `/api/agents/[id]/logs` | GET | SSE stream for agent logs | mnm-agent |
| `/api/specs` | GET | List indexed specs | mnm-spec |
| `/api/specs` | POST | Re-index specs | mnm-spec |
| `/api/specs/[id]` | GET | Spec detail + rendered content | mnm-spec |
| `/api/specs/search` | GET | Fuzzy search specs | mnm-spec |
| `/api/drift` | GET | List drift detections | mnm-drift |
| `/api/drift` | POST | Trigger manual drift detection | mnm-drift |
| `/api/drift/[id]` | PATCH | Accept / reject drift | mnm-drift |
| `/api/git/status` | GET | Git status, branch, remotes | mnm-git |
| `/api/git/changes` | GET | Spec changes since last session | mnm-git |
| `/api/git/diff` | GET | Generate diff for file(s) | mnm-git |
| `/api/settings` | GET | Read settings | config |
| `/api/settings` | PATCH | Update settings | config |

### 5.2 Request/Response Examples

**Launch Agent:**
```
POST /api/agents
{
  "specId": "sha256-of-file-path",
  "agentType": "tdd",
  "scope": ["src/lib/agent/orchestrator.ts", "src/lib/agent/claude-code.ts"]
}

Response 201:
{
  "id": "uuid-v4",
  "name": "TDD Agent",
  "status": "running",
  "specId": "sha256-of-file-path",
  "scope": ["src/lib/agent/orchestrator.ts", "src/lib/agent/claude-code.ts"],
  "startedAt": 1708387200
}
```

**Drift Detection Result:**
```
GET /api/drift

Response 200:
{
  "items": [
    {
      "id": "uuid-v4",
      "agentId": "agent-uuid",
      "specId": "spec-sha",
      "severity": "moderate",
      "driftType": "approach_change",
      "summary": "Implementation uses WebSocket instead of SSE as specified in architecture.",
      "recommendation": "recenter_code",
      "userDecision": "pending",
      "createdAt": 1708387200
    }
  ]
}
```

**Accept Drift:**
```
PATCH /api/drift/[id]
{
  "decision": "accepted"
}

Response 200:
{
  "id": "uuid-v4",
  "userDecision": "accepted",
  "decidedAt": 1708387300
}
```

### 5.3 Error Response Format

All API routes return consistent error responses:

```json
{
  "error": {
    "code": "LOCK_CONFLICT",
    "message": "Cannot launch agent: file src/main.ts is locked by Agent 'TDD Agent'",
    "details": {
      "filePath": "src/main.ts",
      "lockedBy": "agent-uuid",
      "lockedByName": "TDD Agent"
    }
  }
}
```

HTTP status codes: 400 (bad request), 404 (not found), 409 (conflict), 500 (internal error).

---

## 6. Real-Time Communication

### 6.1 Server-Sent Events (SSE) for Agent Logs

Agent log streaming uses SSE instead of WebSockets for simplicity and unidirectional data flow.

**Server (API Route):**

```typescript
// src/app/api/agents/[id]/logs/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const agentProcess = orchestrator.getProcess(params.id);
      if (!agentProcess) {
        controller.close();
        return;
      }

      agentProcess.stdout.on("data", (data: Buffer) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "stdout", content: data.toString() })}\n\n`)
        );
      });

      agentProcess.stderr.on("data", (data: Buffer) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "stderr", content: data.toString() })}\n\n`)
        );
      });

      agentProcess.on("close", (code: number) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "exit", code })}\n\n`)
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Client (React Component):**

```typescript
// Usage in agent log viewer component
useEffect(() => {
  const eventSource = new EventSource(`/api/agents/${agentId}/logs`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    appendLog(data);
  };

  return () => eventSource.close();
}, [agentId]);
```

### 6.2 Polling for Dashboard State

Agent status and drift detections use SWR with polling for near-real-time updates:

```typescript
const { data: agents } = useSWR("/api/agents", fetcher, {
  refreshInterval: 2000, // Poll every 2 seconds
});
```

This approach is simpler than SSE for dashboard-level data that changes infrequently.

### 6.3 Real-Time Strategy Summary

| Data Type | Strategy | Latency | Justification |
|-----------|----------|---------|---------------|
| Agent logs | SSE | ~instant | High-frequency, append-only stream |
| Agent status | SWR polling (2s) | ~2s | Low-frequency status changes |
| Drift detections | SWR polling (5s) | ~5s | Triggered by agent completion |
| Spec changes | SWR polling (10s) | ~10s | Triggered by git operations |
| Git status | SWR polling (10s) | ~10s | Background monitoring |

---

## 7. Agent Orchestration (Web Adaptation)

### 7.1 Claude Code Subprocess (Node.js)

The native Rust subprocess spawn maps directly to Node.js `child_process`:

```typescript
// src/lib/agent/claude-code.ts
import { spawn, ChildProcess } from "child_process";

export class ClaudeCodeBridge {
  private process: ChildProcess;

  static spawn(specPath: string, scope: string[]): ClaudeCodeBridge {
    const process = spawn("claude", [
      "--print",
      "--spec", specPath,
      "--allowedTools", "Edit,Write,Bash,Read",
    ], {
      cwd: repoRoot,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    return new ClaudeCodeBridge(process);
  }

  async terminate(): Promise<void> {
    this.process.kill("SIGTERM");
  }
}
```

### 7.2 File Lock Manager

Same read/write lock semantics as native, implemented with Drizzle ORM:

```typescript
// src/lib/agent/file-lock.ts
export class FileLockManager {
  async acquireLock(agentId: string, filePath: string, lockType: "read" | "write"): Promise<FileLock> {
    const activeLocks = await db
      .select()
      .from(fileLocks)
      .where(
        and(
          eq(fileLocks.filePath, filePath),
          isNull(fileLocks.releasedAt)
        )
      );

    if (lockType === "write" && activeLocks.length > 0) {
      throw new LockConflictError(filePath, activeLocks[0].agentId);
    }
    if (lockType === "read" && activeLocks.some(l => l.lockType === "write")) {
      throw new LockConflictError(filePath, activeLocks[0].agentId);
    }

    // Insert lock record
    const lock = { id: randomUUID(), filePath, agentId, lockType, acquiredAt: Date.now() };
    await db.insert(fileLocks).values(lock);
    return lock;
  }

  async releaseLock(lockId: string): Promise<void> {
    await db
      .update(fileLocks)
      .set({ releasedAt: Date.now() })
      .where(eq(fileLocks.id, lockId));
  }
}
```

### 7.3 Agent Event Bus

Node.js `EventEmitter` replaces the Rust `mpsc` channels:

```typescript
// src/lib/agent/event-bus.ts
import { EventEmitter } from "events";

export type AgentEvent =
  | { type: "started"; agentId: string; specId: string }
  | { type: "progress"; agentId: string; message: string }
  | { type: "completed"; agentId: string; filesModified: string[] }
  | { type: "error"; agentId: string; error: string }
  | { type: "fileLockReleased"; filePath: string };

export const agentEventBus = new EventEmitter();
```

---

## 8. Drift Detection Pipeline (Web Adaptation)

### 8.1 Pipeline (Same as Native)

The six-step drift detection pipeline is preserved identically:

1. **Identify Scope** -- Load spec + agent's modified files
2. **Generate Git Diff** -- `simple-git` diff between base and current
3. **AI Analysis** -- Claude API call from server-side API route
4. **Classification** -- Parse structured JSON response
5. **Persist Results** -- Drizzle ORM insert to `drift_detections`
6. **Display to User** -- React UI component with SWR refresh

### 8.2 Claude API Integration

```typescript
// src/lib/drift/analyzer.ts
export class DriftAnalyzer {
  async analyze(spec: Spec, diff: string, customInstructions?: string): Promise<DriftResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0,
        messages: [{
          role: "user",
          content: buildDriftPrompt(spec, diff, customInstructions),
        }],
      }),
    });

    const result = await response.json();
    return parseDriftResponse(result);
  }
}
```

### 8.3 Custom Instructions

Same as native: loaded from `.mnm/drift-instructions.md`, cached, and appended to the Claude API prompt.

---

## 9. UI Architecture

### 9.1 Page Layout

```
+------+--------------------------------------------+
|      |  Header (breadcrumb, git status, alerts)   |
|  S   |--------------------------------------------|
|  I   |                                            |
|  D   |           Main Content Area                |
|  E   |                                            |
|  B   |    (Spec viewer, agent dashboard,          |
|  A   |     drift alerts, progress view)           |
|  R   |                                            |
|      |                                            |
|      |--------------------------------------------|
|      |  Status Bar (agent count, drift count)     |
+------+--------------------------------------------+
```

### 9.2 Component Library (shadcn/ui)

Key shadcn/ui components used:

| Component | Usage |
|-----------|-------|
| `Button` | Actions (Launch Agent, Accept Drift, etc.) |
| `Card` | Agent cards, drift alert cards |
| `Dialog` | Agent launch modal, drift resolution modal |
| `Tabs` | Main navigation (Specs, Agents, Drift, Progress) |
| `Table` | Agent list, spec list, drift list |
| `Badge` | Status indicators (Running, Error, Critical) |
| `ScrollArea` | Log viewer, spec content |
| `Sheet` | Side panels (Related Specs, Settings) |
| `Command` | Command palette (Cmd+K) |
| `Tooltip` | Contextual help |
| `Alert` | Notifications (drift detected, spec changed) |
| `Separator` | Visual dividers |
| `Skeleton` | Loading states |
| `Sidebar` | App navigation |

### 9.3 Spec-as-Interface (FR2.5)

Interactive spec rendering with contextual actions:

```typescript
// src/components/specs/spec-renderer.tsx
// Each heading becomes an actionable element
// Contextual actions appear on hover based on document type:
//   PRD sections:   [TLDR] [Clarify] [Generate Stories] [Architecture Review]
//   Story sections: [TLDR] [Dev] [TDD] [E2E] [Code Review] [Acceptance Criteria]
//   Epic sections:  [Expand] [Prioritize] [Estimate] [Sprint Planning]
```

Markdown is parsed with `remark` + `rehype` and rendered as React components with interactive overlays.

### 9.4 Theming

Tailwind CSS + shadcn/ui theme system:
- Light and dark mode via `next-themes`
- CSS custom properties for colors
- Consistent with shadcn/ui design language (clean, minimal, professional)

---

## 10. Security Considerations

### 10.1 API Key Storage

| Environment | Strategy |
|-------------|----------|
| Development | `.env.local` file (git-ignored) |
| Production (local) | Environment variables |

**Critical:** The Claude API key is NEVER exposed to the browser. All Claude API calls happen in server-side API routes.

```
Browser (client) --> Next.js API Route (server) --> Claude API
                     ^-- API key lives here
```

### 10.2 Local-First Guarantees

- All data stored in `.mnm/state.db` (git-ignored SQLite file)
- No external database or cloud storage
- Only outbound network requests: Claude API (`api.anthropic.com`)
- No telemetry, analytics, or tracking
- `.mnm/important-files.json` is the only git-tracked MnM file

### 10.3 Input Validation

- API routes validate all input parameters (Zod schemas recommended)
- File paths are sanitized (no path traversal)
- SQL injection prevented by Drizzle ORM (parameterized queries)
- Git operations scoped to the repository root

### 10.4 Agent Sandboxing

Same as native: agents declare file scope, FileLockManager enforces boundaries. Destructive operations (file deletion, git reset) require confirmation via the UI.

---

## 11. Error Handling Strategy (Web Adaptation)

### 11.1 Error Types

```typescript
// src/lib/core/errors.ts
export class MnMError extends Error {
  constructor(message: string, public code: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export class AgentError extends MnMError {
  static notFound(id: string) { return new AgentError(`Agent not found: ${id}`, "AGENT_NOT_FOUND"); }
  static alreadyRunning(id: string) { return new AgentError(`Agent already running: ${id}`, "AGENT_ALREADY_RUNNING"); }
  static spawnFailed(reason: string) { return new AgentError(`Subprocess spawn failed: ${reason}`, "SPAWN_FAILED"); }
}

export class LockConflictError extends MnMError {
  constructor(filePath: string, lockedByAgentId: string) {
    super(`File ${filePath} is locked by agent ${lockedByAgentId}`, "LOCK_CONFLICT", { filePath, lockedByAgentId });
  }
}

export class DriftError extends MnMError {
  static apiError(reason: string) { return new DriftError(`Claude API error: ${reason}`, "API_ERROR"); }
  static invalidResponse(reason: string) { return new DriftError(`Invalid drift response: ${reason}`, "INVALID_RESPONSE"); }
}
```

### 11.2 Error Handling in API Routes

```typescript
// Pattern for all API route handlers
export async function POST(request: Request) {
  try {
    // ... business logic
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof LockConflictError) {
      return Response.json({ error: { code: error.code, message: error.message, details: error.details } }, { status: 409 });
    }
    if (error instanceof AgentError) {
      return Response.json({ error: { code: error.code, message: error.message } }, { status: 400 });
    }
    console.error("Unexpected error:", error);
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
```

### 11.3 Error Recovery Strategies

Same as native architecture:

| Error Type | Recovery Strategy |
|------------|------------------|
| Agent crash | Mark as `Error`, release file locks, notify user via UI |
| Claude API timeout | Retry with exponential backoff (3 attempts) |
| Git operation failure | Display error, allow retry |
| SQLite issues | Drizzle handles connection, transactions are atomic |
| Spec parsing error | Skip file, log warning, continue indexing |

---

## 12. Testing Strategy

### 12.1 Test Pyramid (Web)

```
         +-------------------+
         |    E2E Tests      |  <-- 10% (Playwright)
         | (browser flows)   |
         +-------------------+
              ^
         +---------------------+
         | Integration Tests   |  <-- 30% (API routes + DB)
         | (vitest + supertest)|
         +---------------------+
              ^
         +------------------------+
         |    Unit Tests          |  <-- 60% (pure functions)
         | (vitest, fast)         |
         +------------------------+
```

### 12.2 Tools

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit + integration tests (fast, ESM-native) |
| **Playwright** | E2E browser tests |
| **Testing Library** | React component testing |
| **MSW** | Mock Claude API responses |

### 12.3 Key Test Areas

- **Unit tests**: Domain models, drift classification, spec parsing, error handling
- **Integration tests**: API routes with in-memory SQLite, file lock manager, drift pipeline
- **E2E tests**: Launch agent flow, drift resolution flow, spec browsing

---

## 13. Architecture Decision Records (ADRs) -- Web POC

### ADR-W01: Next.js Instead of Rust/GPUI for POC

**Context:** MnM's native architecture targets Rust + GPUI for GPU-accelerated performance. Building the POC in the native stack carries risk due to GPUI 0.2.2 instability and Rust learning curve.

**Decision:** Build the POC in Next.js 15 with TypeScript, preserving the same domain logic and data model.

**Rationale:**
- **Speed:** Web stack enables 5-10x faster prototyping than Rust/GPUI
- **Risk reduction:** Validate product concepts before committing to native stack
- **UI maturity:** shadcn/ui provides 40+ production-ready components vs. limited GPUI components
- **Team velocity:** TypeScript + React is widely understood

**Consequences:**
- (+) Faster time to demo and user validation
- (+) Lower risk of framework instability
- (+) Can reuse domain logic patterns when moving to native
- (-) Cannot achieve 120+ FPS GPU rendering (browser limited)
- (-) Requires Node.js runtime instead of single binary
- (-) Potential "POC trap" -- web version may become the product instead of a validation step

**Status:** Accepted

---

### ADR-W02: SQLite via Drizzle ORM (Preserving Local-First)

**Context:** The native architecture uses SQLite for local-first data storage. The web POC must preserve this property.

**Decision:** Use `better-sqlite3` with Drizzle ORM for type-safe database access.

**Rationale:**
- **Same database:** SQLite file at `.mnm/state.db`, identical to native
- **Type safety:** Drizzle provides TypeScript types from schema, preventing runtime errors
- **Migration support:** Drizzle Kit handles schema migrations
- **Synchronous access:** `better-sqlite3` provides synchronous API, simpler than async alternatives
- **No server:** Database runs in-process, no external database server needed

**Alternatives Considered:**
- Prisma: Heavier, generates client code, overkill for SQLite
- Turso (libSQL): Cloud-oriented, adds complexity
- Raw `better-sqlite3`: No type safety, manual SQL

**Consequences:**
- (+) Identical data model to native architecture
- (+) Type-safe queries matching TypeScript domain models
- (+) Zero additional infrastructure
- (-) `better-sqlite3` requires native compilation (C++ addon)

**Status:** Accepted

---

### ADR-W03: Server-Sent Events for Agent Log Streaming

**Context:** Agent logs need to be streamed to the UI in real-time. The native architecture uses stdin/stdout capture. The web needs a transport mechanism.

**Decision:** Use Server-Sent Events (SSE) instead of WebSockets.

**Rationale:**
- **Unidirectional:** Agent logs flow server-to-client only; no client-to-server messages needed
- **Simplicity:** SSE works over standard HTTP, no WebSocket upgrade or library needed
- **Next.js native:** Route Handlers support streaming responses natively
- **Auto-reconnect:** EventSource API handles reconnection automatically
- **No additional dependencies:** Built into browser and Next.js

**Alternatives Considered:**
- WebSocket: Bidirectional (unnecessary), requires additional library (ws, socket.io)
- Polling: Too slow for real-time logs, wasteful
- Long polling: Complex, fragile

**Consequences:**
- (+) Simple implementation, no extra dependencies
- (+) Works with Next.js Route Handlers out of the box
- (+) Browser-native EventSource API
- (-) Cannot send messages from client to server (not needed for logs)
- (-) Limited to ~6 concurrent connections per domain in some browsers (sufficient for POC)

**Status:** Accepted

---

### ADR-W04: shadcn/ui for Component Library

**Context:** The POC needs a comprehensive, professional UI component library.

**Decision:** Use shadcn/ui with Tailwind CSS instead of other component libraries.

**Rationale:**
- **No vendor lock-in:** Components are copied into project, not installed as dependency
- **Customizable:** Full control over component source code
- **Accessible:** Built on Radix UI primitives (ARIA-compliant)
- **Professional design:** Clean, minimal aesthetic matching MnM's design vision
- **Tailwind integration:** First-class Tailwind CSS support

**Alternatives Considered:**
- Material UI: Opinionated design, large bundle size
- Ant Design: Enterprise-focused, heavy
- Chakra UI: Good but less customizable than shadcn/ui
- Headless UI: Too low-level, would need custom styling for everything

**Consequences:**
- (+) Professional, accessible UI out of the box
- (+) Full ownership of component code
- (+) Consistent with modern web development best practices
- (-) Manual updates (no dependency version bumps)

**Status:** Accepted

---

### ADR-W05: simple-git for Git Integration

**Context:** The native architecture uses `git2-rs` (libgit2 bindings). The web POC needs git integration without native Rust bindings.

**Decision:** Use `simple-git` (Node.js git CLI wrapper) instead of `isomorphic-git` or other alternatives.

**Rationale:**
- **Full git compatibility:** Wraps the actual `git` CLI, supports all git operations
- **Well-maintained:** Active development, comprehensive API
- **Async API:** Returns promises, integrates naturally with Next.js
- **No WASM/native compilation:** Pure JavaScript wrapper

**Alternatives Considered:**
- `isomorphic-git`: Pure JS git implementation, but incomplete (no hooks, limited merge support)
- `nodegit` (libgit2 bindings): Native compilation issues, less maintained
- Direct `child_process` exec: Too low-level, would need to parse git output manually

**Consequences:**
- (+) Full git feature support
- (+) Simple, well-documented API
- (+) No native compilation required
- (-) Requires `git` CLI installed on system (acceptable -- already required by native architecture)
- (-) Slightly slower than libgit2 bindings (spawns processes)

**Status:** Accepted

---

## 14. FR/NFR Addressability

### Functional Requirements Coverage

| FR | Web Approach | Notes |
|----|-------------|-------|
| **FR1: Agent Dashboard** | React components + SWR polling | Same data, web UI |
| **FR2: Spec-Driven Launching** | Spec browser + API route to spawn | Same flow |
| **FR2.5: Spec-as-Interface** | React Markdown renderer with interactive overlays | remark/rehype + custom components |
| **FR3: Drift Detection** | API routes calling Claude API | Identical pipeline |
| **FR4: Spec Change Awareness** | simple-git change detection + API routes | Same logic |
| **FR5: Git Integration** | simple-git wrapper | Same operations |
| **FR6: Code Viewing** | React code viewer with syntax highlighting | `react-syntax-highlighter` or `shiki` |

### Non-Functional Requirements

| NFR | Native Target | Web POC Target | Notes |
|-----|--------------|----------------|-------|
| **NFR1.1: UI FPS** | 120+ FPS | 60 FPS (browser limit) | Acceptable for POC |
| **NFR1.2: Drift latency** | < 5s | < 5s | Same (API-bound) |
| **NFR1.3: Git operations** | < 200ms | < 500ms | simple-git slightly slower |
| **NFR2.1: 10 concurrent agents** | Supported | Supported | Node.js handles async well |
| **NFR3.1: Agent fault tolerance** | Process isolation | Same (child_process) | Identical subprocess model |
| **NFR3.2: Data integrity** | SQLite transactions | Same (Drizzle + SQLite) | Identical |
| **NFR4.1: Onboarding < 2min** | Native wizard | Web wizard | Same flow |
| **NFR6.1: Local-first** | Fully local | Fully local | Same `.mnm/` directory |
| **NFR6.3: API key security** | macOS Keychain | `.env.local` + server-only | Simplified but secure |

---

## 15. Deployment & Running

### 15.1 Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add CLAUDE_API_KEY to .env.local

# Initialize database
npx drizzle-kit push

# Start development server
npm run dev
# Open http://localhost:3000
```

### 15.2 Production (Local)

```bash
npm run build
npm start
# Or: run via Docker for isolation
```

### 15.3 Distribution

| Method | Target |
|--------|--------|
| `npm start` | Developers with Node.js |
| Docker | Anyone with Docker installed |
| Future | Electron wrapper if web POC becomes product |

---

## 16. Open Architectural Questions (Web-Specific)

### Q-W1: Should the web POC support concurrent users?

**Current decision:** No. Single-user, same as native architecture. The web server runs locally.

### Q-W2: How to handle `better-sqlite3` native compilation?

**Mitigation:** Provide Docker image with pre-compiled dependencies. Document Node.js version requirements (20+ LTS).

### Q-W3: Will the web POC eventually replace the native architecture?

**Decision deferred.** The POC validates product concepts. If the web version proves sufficient, the team may choose to skip the native Rust/GPUI build entirely. This is a product decision, not an architectural one.

---

## 17. Conclusion

This web architecture preserves the core value propositions of MnM while enabling rapid prototyping and validation:

1. **Same domain logic** -- Types, data model, and business rules are identical
2. **Same data model** -- SQLite schema is unchanged, Drizzle provides type safety
3. **Same workflows** -- Agent orchestration, drift detection, and spec awareness are identical pipelines
4. **Local-first preserved** -- SQLite + `.mnm/` directory, no cloud dependencies
5. **Faster iteration** -- Next.js + shadcn/ui enables rapid UI development
6. **Lower risk** -- Proven web stack vs. unvalidated GPUI framework

**Key trade-off:** Performance ceiling (browser ~60 FPS vs. GPUI 120+ FPS) in exchange for dramatically faster development velocity and lower technical risk.

**Next step:** Epic and story breakdown adapted for web stack, then implementation kickoff.

---

*Web Architecture Document v1.0 -- Daedalus, 2026-02-20*
