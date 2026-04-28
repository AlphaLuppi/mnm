# MnM Documentation Index

Point d'entrée de la documentation MnM. Tous les liens sont relatifs à `docs/`.

## Démarrage rapide

- [`../README.md`](../README.md) — Présentation, install, dev commands.
- [`../CLAUDE.md`](../CLAUDE.md) — Architecture rules, multi-tenant, RBAC, conventions critiques.
- [`../AGENTS.md`](../AGENTS.md) — Guide opérationnel pour les agents intervenant sur le repo.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — Workflow de contribution, commits, branches.

## Architecture & roadmap

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Architecture canonique (multi-tenant, middleware chain, trace pipeline, config layers, CAO).
- [`B2B-enterprise-roadmap.md`](B2B-enterprise-roadmap.md) — Roadmap entreprise B2B consolidée.
- [`HISTORY.md`](HISTORY.md) — Historique condensé des décisions et pivots produit.
- [`../ROADMAP-B2B-REMAINING.md`](../ROADMAP-B2B-REMAINING.md) — Reste à faire B2B (suite de `RELEASE-NOTES-B2B.md`).
- [`../RELEASE-NOTES-B2B.md`](../RELEASE-NOTES-B2B.md) — Release notes du tronc B2B livré.

## Governed Workflows

DAG de steps/gates versionnés dans Git, exécutés par le gate-runner, observés via UI + MCP.

- [`governed-workflows/`](governed-workflows/README.md) — Index du sous-dossier (local-testing, scénarios, handoff artifacts, OAuth setup).

## Workflow Superpowers

Convention de planification vivante (remplace BMAD pour le travail courant). Trois types d'artefacts :

- `superpowers/plans/` — Plans datés `YYYY-MM-DD-{topic}.md` : phases, étapes, critères d'acceptation, risques, rollback.
- `superpowers/specs/` — Designs détaillés (contrats, data flow, file-level changes) quand un plan a besoin d'une passe d'architecture.
- `superpowers/reviews/` — Code reviews structurées sur les livraisons.

Voir [`superpowers/`](superpowers/) pour la liste complète des plans actifs et features livrées.

## Recherches techniques

Études et benchmarks utilisés pour cadrer les décisions d'architecture.

- [`research/`](research/) — 9 documents : agent orchestration patterns, dashboard UX, Entire.io analysis, GitNexus eval, LLM workflow control, Nanoclaw, Openclaw (auth + deep dive), realtime workflows, synthèse globale.

## Pensée produit historique

Brainstorms, visions, architectures intermédiaires, sessions de discovery. Utile pour comprendre le « pourquoi » des choix actuels — pas la source de vérité courante (voir `ARCHITECTURE.md` et `B2B-enterprise-roadmap.md` pour ça).

- [`history/visions/`](history/visions/) — 4 visions consolidées (governed-workflows, product brief v3, vision MnM 2026-04-07, vision Projects v2).
- [`history/brainstorms/`](history/brainstorms/) — ~17 sessions (Tom, Gab, Niko, EnterpriseCustomer, view presets, dashboard v2, governed workflows, langfuse tracing, projects v2, pods, traces).
- [`history/architectures/`](history/architectures/) — Architecture multi-tenant 2026-04-12, blocks platform progress.
- [`history/discovery/`](history/discovery/) — DM hackathon, questions d'interview.

## Archives

Artefacts post-livraison conservés pour traçabilité. Pas à lire pour onboarder.

- [`archive/historical-prd.md`](archive/historical-prd.md) — PRD historique (figé).
- [`archive/sessions-completed/`](archive/sessions-completed/) — Prompts de session terminés et progress logs.
- [`archive/shipped-epics/`](archive/shipped-epics/) — ~21 epics livrés.
- [`archive/abandoned/`](archive/abandoned/) — Pistes abandonnées (sandbox, scale, observability suite).
- [`archive/reviews/`](archive/reviews/) — Reviews et audits passés.
- [`archive/2026-04-07-historical-specs/`](archive/2026-04-07-historical-specs/) — 3 specs ponctuelles archivées.

## Stories BMAD legacy

Stories BMAD antérieures, conservées sous `_bmad-output/stories/`. Triage par statut dans le dossier (done / in-progress / abandoned). Le framework BMAD n'est plus utilisé pour les nouveaux développements — privilégier `superpowers/`.
