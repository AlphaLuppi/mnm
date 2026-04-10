# MnM — Make no Mistake

```
███╗   ███╗       █████╗       ███╗   ███╗
████╗ ████║      ██╔══██╗      ████╗ ████║
██╔████╔██║      ██║  ██║      ██╔████╔██║
██║╚██╔╝██║      ██║  ██║      ██║╚██╔╝██║
██║ ╚═╝ ██║      ██║  ██║      ██║ ╚═╝ ██║
╚═╝     ╚═╝ake   ╚═╝  ╚═╝o     ╚═╝     ╚═╝istake
```

> **Cockpit de supervision B2B pour orchestrer des equipes completes d'agents IA — dev, infra, PO, PM, marketing, DSI, CEO et au-dela.**

MnM est un fork de [Paperclip](https://github.com/paperclipai/paperclip) transforme en plateforme enterprise B2B self-hosted. La vision : chaque metier de l'entreprise dispose de ses propres agents IA, orchestres dans un cockpit unifie avec gouvernance, isolation et traçabilite. L'humain ne fait plus — il pilote.

Made by **Studio Manifeste**.

---

## De Paperclip à MnM : le pivot

**Paperclip** (upstream) est un orchestrateur d'agents IA mono-utilisateur orienté "zero-human companies".

**MnM** reprend ce socle et le transforme radicalement :

| | Paperclip | MnM |
|---|---|---|
| **Cible** | Développeur solo | Equipes enterprise completes (dev, PO, PM, infra, marketing, DSI, CEO...) |
| **Modèle** | Mono-utilisateur | Multi-tenant (1 instance = 1 entreprise) |
| **Sécurité** | Confiance locale | RBAC dynamique + isolation par tags + RLS PostgreSQL |
| **Agents** | Exécution locale | Sandbox Docker par utilisateur |
| **Config** | JSONB opaque | Config Layers structurées (priorité, merge, OAuth) |
| **Observabilité** | Logs basiques | Pipeline de traces Bronze/Silver/Gold |
| **Communication** | Chat simple | Chat collaboratif temps réel, artifacts, RAG, @mentions |
| **Orchestration** | Basique | CAO (Chief Agent Officer) + workflows BMAD |
| **Gouvernance** | Aucune | Anti-shadow-AI, audit immutable, permissions granulaires |

---

## Vision

MnM n'est pas un outil de dev. C'est **une plateforme de pilotage pour des equipes entieres d'agents IA**, couvrant tous les metiers d'une organisation : dev, infra, PO, PM, marketing, communication, DSI, CEO, CTO...

L'ambition : chaque role de l'entreprise a ses agents, ses workflows, ses outils. MnM orchestre le tout avec isolation, gouvernance et visibilite. L'humain passe de l'execution a la supervision strategique — 80% reflexion, 20% execution.

**Piliers de valeur :**

1. **Orchestrateur d'agents IA** — Modele Kubernetes-for-agents : isolation, scheduling, health monitoring. Pas limite au code — n'importe quel metier peut avoir ses agents (marketing, ops, finance, RH...)
2. **Fin du handoff lossy** — Contexte partage et requetable entre tous les roles. Le PO, le dev, le QA, le DSI, le CEO voient la meme realite, enrichie par les agents
3. **Dual-speed workflow** — Reflexion humaine (async, brainstorms, decisions strategiques) + execution machine (continue, 24/7, multi-agents)
4. **Anti-shadow-AI** — Tous les agents visibles, coutables, gouvernes, audites. Le DSI voit qui utilise quoi, combien ca coute, et peut appliquer des politiques de gouvernance
5. **Capture du savoir tacite** — Le savoir tribal (comment on deploie, les conventions internes, les decisions d'archi) devient un actif digital exploitable par les agents et les humains
6. **Feature Traceability** — Chaque produit est un ensemble de fonctionnalites vivantes reliees a des specs, du code et des tests. Les agents maintiennent les liens automatiquement. Un PM voit la coverage, un QA voit les tests manquants, un compliance officer voit la conformite. Audit-ready sans spreadsheets.

---

## Ce que MnM fait

- **RBAC dynamique & isolation par tags** — chaque utilisateur ne voit que les agents et les donnees de son perimetre. Roles et permissions sont configures depuis l'UI, pas dans le code.
- **Agents IA en sandbox** — chaque utilisateur dispose de son propre container Docker isole. Les credentials sont injectes par run, jamais persistes sur le disque.
- **CAO — Chief Agent Officer** — un agent systeme qui supervise l'orchestration, detecte les problemes en mode watchdog, et repond aux `@cao` en mode interactif.
- **Pipeline de traces Bronze → Silver → Gold** — les executions d'agents sont enrichies automatiquement par un LLM et presentees comme une timeline scoree et annotee, pas comme un dump JSON.
- **Config Layers** — configuration des agents structuree, versionee, mergee par priorite. Plus de JSONB opaque, plus de conflits silencieux.
- **Chat collaboratif temps reel** — discussions 1-1 avec les agents, artifacts versiones avec preview, documents + RAG via pgvector, dossiers partages, slash commands, `@mentions`.
- **Workflows BMAD** — machine a etats formelle pour piloter Brief → PRD → Architecture → Stories → Dev → Test, avec validation HITL aux points critiques.
- **Serveur MCP** — MnM expose 68 tools et 10 resources via le Model Context Protocol. N'importe quel client compatible (Claude Code, Cursor, Claude Desktop) peut piloter la plateforme via OAuth 2.1 avec consentement granulaire.
- **Audit immutable** — chaque action critique genere un evenement audit non modifiable, consultable dans l'UI avec filtres et export.
- **Feature Traceability (en cours)** — chaque fonctionnalite est un node reliee a ses specs, son code, ses tests et sa coverage.

---

## Essayer MnM

```bash
# Prerequis : Bun >= 1.3, Node >= 20, Docker
bun install
bun run dev
```

Ca lance un serveur + UI avec PostgreSQL embarque — aucun setup externe necessaire pour tester.

Pour un deploiement production (Docker Compose, Dokploy) et le get started dev complet, voir [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Aller plus loin

- 📖 [**CONTRIBUTING.md**](CONTRIBUTING.md) — Get started pour les developpeurs : installation, commandes, structure du repo, conventions, comment contribuer
- 🏛️ [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) — Stack technique et decisions architecturales cles
- 📅 [**docs/HISTORY.md**](docs/HISTORY.md) — Chronologie du projet, sessions de brainstorming, metriques, roadmap

---

## Credits

Fork de [Paperclip](https://github.com/paperclipai/paperclip) — orchestration for zero-human companies.

## Licence

MIT
