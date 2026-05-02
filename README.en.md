# MnM — Make no Mistake

🇫🇷 [Lire en français](README.md) | 🇬🇧 You are reading the English version.

> ℹ️ The French version is the source of truth — this English version may lag behind.

```
███╗   ███╗       █████╗       ███╗   ███╗
████╗ ████║      ██╔══██╗      ████╗ ████║
██╔████╔██║      ██║  ██║      ██╔████╔██║
██║╚██╔╝██║      ██║  ██║      ██║╚██╔╝██║
██║ ╚═╝ ██║      ██║  ██║      ██║ ╚═╝ ██║
╚═╝     ╚═╝ake   ╚═╝  ╚═╝o     ╚═╝     ╚═╝istake
```

> The supervision cockpit for teams who design, build, and ship with AI agents. Steer, govern, and measure what Claude Code, Cursor, Codex and friends actually do inside your company — without replacing anyone.

MnM is a platform that orchestrates and supervises the AI agents used across your full product chain: dev, PO, PM, infra, QA, compliance, leadership. It is **not** an IDE, **not** a framework, and it does **not** replace Claude Code, Cursor, or Codex. It is the layer above — steering, governance, transparency. You keep your tools; MnM brings the trust, control, and visibility that go missing when dozens of people each launch agents in their own corner, with no shared supervision and no shared memory.

Three deployment modes: full local for solo devs, self-hosted single-company for teams, or hosted multi-company backend for large-scale distribution. Agent compute happens client-side (MCP, Desktop, local CLI) — the server is an API/data/orchestration layer.

Built by Studio Manifeste. Currently being deployed in production with an enterprise pilot customer.

## 🚀 Flagship feature: Governed Workflows

**Governed Workflows** are MnM's headline capability for steering teams that build with AI agents. Every workflow is a `workflow.json` file versioned in git — the same rigor as a code commit, applied to agent orchestration.

- **Workflow Studio** — Monaco multi-file editor with JSON schema, autocomplete, live validation, and an AI Assistant that proposes edits in natural language (per-file Apply / Reject cards).
- **Canonical gates** — 4 reusable gates shipped (`artifact-exists`, `artifacts-bundle`, `step-succeeded`, `review-pass`) + a DSL for custom gates (`packages/gate-runner/`).
- **HITL** — human approval on critical step transitions, with a live validation badge and a detail drawer.
- **Full audit** — every change goes through a git commit: real author, message, diff, native rollback. No floating workflow state in DB without a trail.
- **REST + MCP parity** — the 14 endpoints are exposed over HTTP **and** MCP. Your Claude Code agent can design, save, and launch a workflow without touching the UI.
- **Multi-provider git** — local provider for solo dev, self-hosted GitLab for production (OAuth 2.1 + PKCE, commits attributed to the user via their token).
- **Live events** — SSE `/events/ws` for real-time updates on runs and the AI Assistant.

This is the first MnM feature designed for broad enterprise deployment: a single backend orchestrates, but authority stays in the team's git repo — no cockpit lock-in, no black box.

## The problem

Agent-assisted development and design have rolled into the enterprise without anyone really supervising what's happening. Concretely:

- Nobody knows what the agents do, or how much it costs.
- No audit, no shared standards, no governance.
- Each person works alone with their prompts. Best practices don't circulate between teams or roles.
- Bugs and drifts ship to production because there's no quality gate beforehand.
- Impossible to tell whether teams are improving with AI, or regressing.

The conviction behind MnM: companies don't want to replace their teams with autonomous agents. They want their teams to use agents under supervision.

## The 3 pillars

### Trust — the agent proves it earned autonomy, the human is the judge

Every agent run is scored along dimensions configured by the company: coverage, conventions, security, performance, whatever you want. A panel of reviewer agents runs in parallel and produces a multi-dimensional verdict. Human gate reviews lean on that, not on gut feeling.

### Control — it's a dial, not a switch

Six autonomy levels, from Manual (the human does everything) to Autonomous (the agent decides alone). Progression is driven by KPIs: as long as scoring stays below the threshold, autonomy stays locked. Autonomous is locked by default and unlocks dimension by dimension.

### Transparency — every stakeholder sees what concerns them

The CEO watches costs and trends. The CTO watches governance and compliance. The PM watches feature coverage. The dev sees their own scores. QA sees missing tests. One system, many lenses.

## Who it's for

- CTOs and CIOs who need governance, audit, and cross-team visibility on AI agent usage.
- Lead Devs and AI Tech Leads who steer a team with agents and want to measure whether things are actually improving.
- Developers who want an environment where their agents run safely, with objective feedback.
- PMs, POs, QA, and compliance who want to see what's shipped, tested, and compliant without harassing the teams.

Target size: product teams of 5 to 500 (dev, PO, PM, infra, QA, compliance). Beyond that it's still usable (multi-squad via tags), but we haven't optimized for megacorps.

## MnM vs Paperclip

MnM is a fork of [Paperclip](https://github.com/paperclipai/paperclip). The two projects diverged toward very different visions, and Paperclip has moved a lot on its side since the fork. The table below reflects the current state of both.

| | Paperclip | MnM |
|---|---|---|
| Philosophy | "Run autonomous AI companies": the agent is the employee, Paperclip is the company | Supervision cockpit for teams who work with AI agents: the human stays at the center, the agent is a supervised tool |
| Target | Solo entrepreneurs, portfolios of autonomous companies | Product teams of 5–500 (dev, PO, PM, infra, QA, compliance) already using Claude Code, Cursor, or Codex |
| Model | Multi-company (multiple companies per deployment) | Multi-tenant (shared DB + RLS, isolation per company + tags) |
| Isolation | Per company | Per additive tags (cross-role, multi-team) |
| Agents | Heartbeats, org charts, delegation, goal alignment | Client-side compute (MCP/Desktop/CLI), optional Docker sandbox |
| Traces | Tool-call tracing + audit log | Bronze/Silver/Gold pipeline with hierarchical LLM enrichment |
| Communication | Threaded ticketing + goals | Real-time collaborative chat, artifacts, RAG, folders, @mentions |
| Orchestration | Heartbeats + skills manager + scheduled routines | **Governed Workflows** (git-first, Monaco Studio + AI Assistant + canonical gates) + CAO + HITL |
| Config | AGENTS.md + Skills Manager + governance with rollback | Structured Config Layers with priority merge + OAuth2 PKCE |
| Scoring | No notion of objective quality | Quality Profiles + Agent Review Panel (in progress) |
| Autonomy | Binary (agent or human) | 6-level KPI-driven continuum (in progress) |
| Human | Board-level (approve, override) | First-class, continuous supervision cockpit |

The two can coexist. MnM is for companies that want to keep their developers and augment them with AI, not replace them with autonomous agents.

## What we've built

### Shipped and in production

- Dynamic RBAC and tag-based isolation: 91 granular permissions, roles in DB, PostgreSQL RLS on 41 tables, additive cross-role tags.
- Multi-tenant architecture: shared DB + RLS, all API routes scoped by `/companies/:companyId/`, defense-in-depth middleware chain (auth → company membership → permissions → tag scope → RLS).
- Bronze → Silver → Gold trace pipeline: raw log capture, deterministic phase detection, hierarchical LLM enrichment (global → workflow → agent → issue), Langfuse-inspired UI timeline.
- Config Layers: structured agent config, priority-merged (Company enforced > Base > Additional), versioned, with conflict detection and PostgreSQL advisory locks.
- Collaborative chat: real-time discussions with agents, versioned artifacts, pgvector documents and RAG, shared folders, slash commands, @mentions.
- CAO (Chief Agent Officer): auto-created system agent, silent watchdog, interactive via `@cao`.
- **Governed Workflows** (flagship enterprise feature): workflows-as-code versioned in git, multi-file Workflow Studio (Monaco + JSON schema + autocomplete), AI Assistant Panel (SSE Claude Sonnet) with inline file proposals, 4 canonical gates (`artifact-exists`, `artifacts-bundle`, `step-succeeded`, `review-pass`) + custom gates, HITL validation with live badge, OAuth 2.1 GitLab for user-attributed commits, REST + MCP parity (14 endpoints). See the dedicated section above.
- Immutable audit: month-partitioned table, TRIGGER-protected, auto-emitted on critical actions, UI export.
- MCP server: 68 tools and 10 resources across 14 domains, OAuth 2.1 with PKCE, Dynamic Client Registration, granular consent screen. Any MCP client (Claude Code, Cursor, Claude Desktop) can drive the platform.
- A2A communication: agent-to-agent bus with permission rules and audit trail.

### In progress: the core flywheel

These pieces are the central architecture of the 3 pillars. The DB schema exists; the APIs and UIs are being built on top right now:

- Feature Map: tree of nodes (features, ACs, requirements) linked via `entity_links`, central product view with structural coverage.
- Quality Profiles: scoring dimensions configurable per company, attached to nodes via `entity_links`.
- Agent Review Panel: N reviewer agents run in parallel and score each run by dimension.
- Human Gate Review: approval workflow wired to Quality Profiles.
- Autonomy Continuum: 6 KPI-driven levels, level 5 (Autonomous) locked by default.
- Improvement Cockpit: KPIs, trends, fix themes, role-specific view (CEO, CTO, Lead, Dev, QA).
- Drift Detection: automatic detection of drift between specs and code, integrated into the Feature Map.

The flywheel: the agent runs, the Quality Profile scores, the Gate Review decides, the Improvement Cockpit aggregates, the skill improves, autonomy can step up.

### Q3 2026 goal

MnM in production on cross-functional teams, the 3 pillars operational, first paying customers.

## Try MnM

### Full local (solo dev)

```bash
# Prerequisites: Bun >= 1.3, Node >= 20
bun install
bun run dev        # Quick start with embedded PostgreSQL, zero auth
```

### Local with Docker infra (daily use)

```bash
# Prerequisites: Docker
cp .env.example .env   # uncomment DATABASE_URL + REDIS_URL
bun run local          # Docker (PG + Redis) + native app
```

The local setup mirrors production topology: infra runs in Docker, app runs natively to talk directly to your Claude CLI. You can then consume MnM via the web UI, the desktop app, or as MCP from Claude Code / Cursor.

### Self-hosted or hosted multi-company (production)

```bash
docker compose up      # 1 company = self-hosted, N companies = hosted
```

Same code, same DB — only the config changes (`MNM_DEPLOYMENT_MODE=authenticated`). Each company is isolated by PostgreSQL RLS.

For production deployment (Docker Compose, Dokploy), the full dev getting-started, and the guide to wire an MCP client, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Going further

- [CONTRIBUTING.md](CONTRIBUTING.md): install, commands, repo structure, conventions, how to contribute.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): tech stack, architectural decisions, per-component details.
- [docs/HISTORY.md](docs/HISTORY.md): project timeline, founding brainstorms, metrics, detailed roadmap.

## Credits

Fork of [Paperclip](https://github.com/paperclipai/paperclip) ("run autonomous AI companies"). Thanks to the Paperclip team for the initial foundation, even though the visions have diverged since.

## License

MnM is dual-licensed:

- **Core (everything outside `ee/`)**: [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Free to use, modify, and self-host. Network distribution requires source disclosure.
- **Enterprise modules (`ee/` directory)**: [MnM Enterprise License](ee/LICENSE) (source-available, requires a commercial license).
- **Commercial / non-AGPL license**: available for organizations that cannot adopt AGPL — see [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md). Contact `licensing@alphaluppi.fr`.

Trademarks (MnM, Alpha Luppi, MnM logo) — see [TRADEMARKS.md](TRADEMARKS.md). Contributing — see [CLA.md](CLA.md).
