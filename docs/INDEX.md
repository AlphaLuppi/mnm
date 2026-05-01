# MnM — Index documentation

Point d'entrée flat de la documentation MnM. Pour une lecture **guidée** orientée Claude, voir [`README.md`](README.md).

## Démarrage rapide

- [`../README.md`](../README.md) — Présentation produit, install, dev commands
- [`../CLAUDE.md`](../CLAUDE.md) — Règles opérationnelles + mission active
- [`../AGENTS.md`](../AGENTS.md) — Guide pour les agents intervenant sur le repo
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — Workflow de contribution
- [`./README.md`](./README.md) — Doc entry point Claude-friendly

## Architecture & décisions

- [`./ARCHITECTURE.md`](./ARCHITECTURE.md) — Stack technique, multi-tenant, middleware chain, traces, config layers, CAO
- [`./decision-log.md`](./decision-log.md) — Décisions architecturales encore actives + recherches qui les justifient

## Conventions

- [`./conventions/git.md`](./conventions/git.md) — Atomic commit + push, GPG, format des messages
- [`./conventions/middleware-chain.md`](./conventions/middleware-chain.md) — Chaîne multi-tenant + 5 couches de sécurité
- [`./conventions/no-polling.md`](./conventions/no-polling.md) — SSE/WebSocket exclusivement
- [`./conventions/rbac-tags.md`](./conventions/rbac-tags.md) — Rôles dynamiques, tags additifs, isolation

## Vision & roadmap

- [`./product/vision.md`](./product/vision.md) — Vision MnM consolidée
- [`./product/three-pillars.md`](./product/three-pillars.md) — Confiance / Contrôle / Transparence
- [`./product/autonomy-continuum.md`](./product/autonomy-continuum.md) — 6 niveaux KPI-driven
- [`./B2B-enterprise-roadmap.md`](./B2B-enterprise-roadmap.md) — Roadmap entreprise consolidée
- [`./HISTORY.md`](./HISTORY.md) — Chronologie + métriques

## Governed Workflows (feature phare)

- [`./governed-workflows/README.md`](./governed-workflows/README.md) — Index
- [`./governed-workflows/local-testing.md`](./governed-workflows/local-testing.md)
- [`./governed-workflows/scenarios.md`](./governed-workflows/scenarios.md)
- [`./governed-workflows/handoff-artifacts.md`](./governed-workflows/handoff-artifacts.md)
- [`./governed-workflows/oauth-setup.md`](./governed-workflows/oauth-setup.md)

## Workflow Superpowers

Convention de planification vivante. 3 types d'artefacts :

- [`./superpowers/plans/`](./superpowers/plans/) — Plans datés `YYYY-MM-DD-{topic}.md`
- [`./superpowers/specs/`](./superpowers/specs/) — Designs détaillés (contrats, data flow, file-level)
- [`./superpowers/reviews/`](./superpowers/reviews/) — Code reviews structurées

## Archive privée

Le repo public ne contient plus le framework BMAD, les artefacts legacy (stories, sprint plans, dashboard-v2, blocks-platform), les brainstorms historiques (`docs/history/`), ni les recherches techniques (`docs/research/`).

Tout est conservé dans le repo privé [`AlphaLuppi/mnm-documentation`](https://github.com/AlphaLuppi/mnm-documentation). La synthèse de ce qui shape encore le code est dans [`./decision-log.md`](./decision-log.md).
