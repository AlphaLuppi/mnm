# BMAD legacy artefacts

Ce dossier contient les artefacts produits par l'ancien framework **BMAD** (Brainstorming → Modeling → Architecture → Delivery) — utilisé jusqu'au début 2026 pour piloter les sprints MnM.

> **Le framework BMAD n'est plus utilisé.** Les nouveaux développements suivent la convention [Superpowers](../../superpowers/).

## Contenu

- `stories/` — Stories BMAD avec triage par statut (`done` / `in-progress` / `abandoned` / `_shipped`)
- `specs/` — Tech specs MCP server, agents, gate-runner, etc.
- `implementation-artifacts/` — Tech specs des features livrées (auth/onboarding standalone, document viewer)
- `dashboard-v2/` — Architecture, sprint plans, UX spec et progress du dashboard v2 (grid + WS security)
- `blocks-platform/` — Architecture et UX spec de la blocks platform
- `json-render-integration-plan.md` — Plan d'intégration json-render
- `prompt-sprint1-multi-tenant.md` — Prompt initial du sprint multi-tenant
- `sprint-plan-epic2-epic4.md`, `sprint-plan-epic3-epic5-f1.md` — Plans de sprint epics 2 à 5

## Pourquoi conserver

Traçabilité : ces artefacts permettent de retrouver le « pourquoi » des choix d'architecture actuels et l'enchaînement des sprints qui ont produit le code en place.

Pour le **travail courant**, voir [`../../superpowers/`](../../superpowers/).
Pour la **vision produit**, voir [`../../product/`](../../product/).
