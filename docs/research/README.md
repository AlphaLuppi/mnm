# Research

Recherches techniques qui ont alimenté l'architecture MnM. Patterns adoptés, décisions, competitive intel.

## Synthèses

- [SYNTHESE-AGENT-ORCHESTRATION.md](SYNTHESE-AGENT-ORCHESTRATION.md) — Synthèse globale orchestration agents. Base de plusieurs décisions architecture.

## Patterns adoptés

- [agent-orchestration-patterns.md](agent-orchestration-patterns.md) — Comparatif Temporal, Prefect, Dagster, n8n. Adopté : DAG explicite + gates (cf. governed workflows).
- [llm-workflow-control.md](llm-workflow-control.md) — Function calling, structured output, LangGraph, CrewAI. Adopté : structured output + XState pour contrôle workflow.
- [realtime-workflows.md](realtime-workflows.md) — WebSocket vs SSE. Adopté : SSE pour live events `/events/ws` (no polling).
- [dashboard-ux-patterns.md](dashboard-ux-patterns.md) — Patterns UI cockpit. Adopté : grille unifiée, drag resize, widgets SSE.

## Études de produits

- [openclaw-deep-dive.md](openclaw-deep-dive.md) — Architecture OpenClaw. Inspiration partielle.
- [openclaw-auth-architecture.md](openclaw-auth-architecture.md) — Modèle auth OpenClaw. Adopté : BetterAuth + OAuth 2.1.
- [nanoclaw-analysis.md](nanoclaw-analysis.md) — File-based IPC, Docker éphémère. Écarté : Docker sandbox déprioritisé en faveur de clients locaux.
- [entire-io-analysis.md](entire-io-analysis.md) — Competitive intel. Positionnement et différenciation.

## Outillage

- [git-nexus-evaluation-2026-04-06.md](git-nexus-evaluation-2026-04-06.md) — Évaluation GitNexus. Adopté : indexation symboles + impact analysis (voir CLAUDE.md).
