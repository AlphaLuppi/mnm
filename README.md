# MnM — Product-Aware Agent Orchestrator

> **Spec-driven development with intelligent agent orchestration and drift detection.**

MnM is a fork of [Paperclip](https://github.com/paperclipai/paperclip), enhanced with a semantic layer for product-aware development workflows.

## What MnM adds over Paperclip

- **Workflow Templates** — BMAD-style structured workflows (Brief → PRD → Architecture → Stories → Dev → Test), customizable via conversational onboarding
- **Stage-Aware Pipeline** — Visual pipeline showing which stage each feature is at, with automatic agent transitions
- **Drift Detection** — LLM-powered comparison between specs (PRD vs Architecture) and between code and specs
- **Conversational Onboarding** — Define your development methodology at first launch, or use the built-in BMAD default
- **Chat-Driven Workflows** — "Launch feature dark mode" → creates workflow, assigns agents, starts pipeline

## Architecture

```
server/         ← Paperclip backend (adapters, heartbeat, services) + MnM extensions
ui/             ← MnM frontend (pipeline view, spec viewer, drift alerts)
packages/       ← Shared packages (adapters, db)
cli/            ← MnM CLI
_bmad/          ← BMAD framework templates
_bmad-output/   ← Planning artifacts & vision docs
_legacy/        ← Previous MnM implementations (Rust/GPUI, Next.js)
```

## Vision

See [`_bmad-output/planning-artifacts/vision-pivot-2026-03-09.md`](./_bmad-output/planning-artifacts/vision-pivot-2026-03-09.md) for the full vision document.

## Credits

Built on top of [Paperclip](https://github.com/paperclipai/paperclip) — orchestration for zero-human companies.

## License

Apache-2.0 (inherited from Paperclip)
