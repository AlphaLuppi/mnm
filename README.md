# MnM — Product-First Agentic Development Environment

> "You don't write code anymore. You write intent.  
> The agents write the code. You verify the intent was understood."

## Vision

MnM is an **Agentic Development Environment** (ADE) that puts product context first, not code.

While other ADEs (Cursor, Warp, Zed) are **code-first** — you code, AI helps — MnM is **product-first** — you define intent, agents implement.

## Core Features

### 🔄 Spec ↔ Code Sync (Spec Drift Detection)

The killer feature. MnM constantly monitors:

- **PRD → Code**: Are requirements implemented?
- **Stories → Tests**: Are acceptance criteria covered?
- **Architecture → Implementation**: Does code match design?

When drift is detected:
```
⚠️ PRD says: "User can cancel within 24h"
   Code says: if (hoursElapsed < 48)
   
   [Auto-fix] [Create Issue] [Ignore]
```

### 🌊 Workflow Stages

Visual pipeline from idea to production:

```
📋 PRD → 📖 Stories → 🏛️ Architecture → 💻 Development → 🧪 Testing → 🚀 Deploy
```

Each stage shows:
- Associated documents
- Assigned agents
- Sync status with other stages

### 🤖 Agent Orchestra

Built-in multi-agent management:

- **Main** 🧠 — Orchestrator
- **Atlas** 🔍 — Research & Analysis  
- **Daedalus** 🏛️ — Architecture
- **Héphaestos** 🔨 — Development
- **Hygieia** 🧪 — Testing

Watch agents work in real-time. See messages flow between them.

### 📊 Context Panel

Always know what the AI sees:

- Active documents in context
- Token usage
- What changed since last run

## Tech Stack

- **Rust** — Performance & safety
- **GPUI** — GPU-accelerated UI (from Zed)
- **BMAD** — Methodology integration

## Status

🚧 **Early Development** — Not ready for use yet.

## Architecture

```
src/
├── main.rs          # Application entry
├── ui/              # GPUI components
├── workflow/        # Workflow management
├── agents/          # Agent orchestration
├── context/         # Context tracking
└── sync/            # Spec drift detection
```

## Building

```bash
# Requires Rust 1.70+
cargo build --release

# Run
cargo run
```

## License

MIT

## Authors

- Tom Andrieu (@Seeyko)
- Pantheon AI Team
