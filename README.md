# MnM — Make no Mistake

```
███╗   ███╗       █████╗       ███╗   ███╗
████╗ ████║      ██╔══██╗      ████╗ ████║
██╔████╔██║      ██║  ██║      ██╔████╔██║
██║╚██╔╝██║      ██║  ██║      ██║╚██╔╝██║
██║ ╚═╝ ██║      ██║  ██║      ██║ ╚═╝ ██║
╚═╝     ╚═╝ake   ╚═╝  ╚═╝o     ╚═╝     ╚═╝istake
```

> Le management plane pour l'IA coding en entreprise. Superviser les équipes qui bossent avec Claude Code, Cursor ou Codex, sans les remplacer.

MnM est une plateforme self-hosted qui orchestre et supervise les agents IA que tes devs utilisent déjà. Ce n'est pas un IDE, pas un framework, et ça ne remplace pas Claude Code ou Cursor. C'est le cockpit au-dessus. Une sorte de Kubernetes pour l'IA coding : tu gardes tes outils, MnM apporte la confiance, le contrôle et la transparence qui manquent quand 50 devs lancent des agents chacun dans leur coin.

Fait par Studio Manifeste. Client pilote : CBA (50+ devs multi-métiers).

## Le problème

L'IA coding s'est installée partout en entreprise sans que personne ne supervise vraiment ce qui se passe. Concrètement :

- Personne ne sait ce que font les agents, ni combien ça coûte.
- Pas d'audit, pas de standards partagés, pas de gouvernance.
- Chaque dev bosse seul avec ses prompts. Les bonnes pratiques ne circulent pas.
- Le QA découvre les bugs en production parce qu'il n'y a aucun gate avant.
- Impossible de dire si l'équipe s'améliore avec l'IA, ou si elle régresse.

La conviction derrière MnM : les boîtes ne veulent pas remplacer leurs devs par des agents autonomes. Elles veulent que leurs devs utilisent des agents sous supervision.

## Les 3 piliers

### Confiance — l'agent prouve qu'il mérite l'autonomie, le dev est juge

Chaque exécution d'agent est scorée selon des dimensions configurées par l'entreprise : coverage, conventions, sécurité, perf, ce que tu veux. Un panel d'agents reviewers tourne en parallèle et donne un verdict multi-dimensionnel. Les gate reviews humaines s'appuient là-dessus, pas sur du feeling.

### Contrôle — c'est un dial, pas un switch

Six niveaux d'autonomie, de Manual (l'humain fait tout) à Autonomous (l'agent décide seul). La progression est pilotée par les KPI : tant que le scoring n'atteint pas le seuil, l'autonomie reste bloquée. Le level Autonomous est verrouillé par défaut et se déverrouille dimension par dimension.

### Transparence — chaque stakeholder voit ce qui le concerne

Le CEO regarde les coûts et les tendances. Le CTO regarde la gouvernance et la conformité. Le PM regarde la coverage des features. Le dev voit ses propres scores. Le QA voit les tests manquants. Un seul système, plusieurs lentilles.

## Pour qui

- CTO et DSI qui ont besoin de gouvernance, d'audit et de visibilité cross-équipes sur l'IA coding.
- Lead Dev et Tech Lead IA qui pilotent une équipe avec des agents et veulent mesurer si ça s'améliore vraiment.
- Développeurs qui veulent un environnement où leurs agents tournent en sécurité, avec du feedback objectif.
- PM, PO, QA et compliance qui veulent voir ce qui est livré, testé et conforme sans harceler les devs.

Taille cible : équipes de 5 à 500 devs. Au-delà ça reste utilisable (multi-squads via tags), mais on n'a pas optimisé pour les mégacorps.

## MnM vs Paperclip

MnM est un fork de [Paperclip](https://github.com/paperclipai/paperclip). Les deux projets ont divergé vers des visions très différentes, et Paperclip a pas mal avancé de son côté depuis le fork. Le tableau ci-dessous reflète l'état actuel des deux.

| | Paperclip | MnM |
|---|---|---|
| Philosophie | "Run autonomous AI companies" : l'agent est l'employé, Paperclip est la boîte | Management plane pour l'IA coding : l'humain reste au centre, l'agent est un outil supervisé |
| Cible | Solo entrepreneurs, portfolios de boîtes autonomes | Équipes 5-500 devs qui utilisent déjà Claude Code ou Cursor |
| Modèle | Multi-company (plusieurs boîtes par déploiement) | Single-tenant (1 instance = 1 entreprise, isolation interne par tags) |
| Isolation | Par company | Par tags additifs (cross-métier, multi-équipes) |
| Agents | Heartbeats, org charts, délégation, goal alignment | Sandbox Docker par utilisateur, credentials injectées par run |
| Traces | Tool-call tracing + audit log | Pipeline Bronze/Silver/Gold avec enrichissement LLM hiérarchique |
| Communication | Ticketing threadé + goals | Chat collaboratif temps réel, artifacts, RAG, dossiers, @mentions |
| Orchestration | Heartbeats + skills manager + scheduled routines | Workflows BMAD (XState) + CAO + HITL |
| Config | AGENTS.md + Skills Manager + governance with rollback | Config Layers structurées avec priority merge + OAuth2 PKCE |
| Scoring | Pas de notion de qualité objective | Quality Profiles + Agent Review Panel (en cours) |
| Autonomie | Binaire (agent ou humain) | Continuum 6 niveaux KPI-driven (en cours) |
| Humain | Board-level (approve, override) | First-class, cockpit de supervision continue |

Les deux peuvent coexister. MnM s'adresse aux boîtes qui veulent garder leurs devs et les augmenter avec de l'IA, pas les remplacer par des agents autonomes.

## Ce qu'on a construit

### Livré et en production

- RBAC dynamique et isolation par tags : 91 permissions granulaires, rôles en DB, RLS PostgreSQL sur 41 tables, tags additifs cross-métier.
- Sandbox Docker par utilisateur : isolation, credentials injectées par run, proxy credential, rewrite automatique localhost → host.docker.internal.
- Pipeline de traces Bronze → Silver → Gold : capture raw logs, phase detection déterministe, enrichissement LLM hiérarchique (global → workflow → agent → issue), UI timeline inspirée de Langfuse.
- Config Layers : configuration agent structurée, mergée par priorité (Company enforced > Base > Additional), versionée, avec détection de conflits et advisory locks PostgreSQL.
- Chat collaboratif : discussions temps réel avec agents, artifacts versionés, documents et RAG pgvector, dossiers partagés, slash commands, @mentions.
- CAO (Chief Agent Officer) : agent système auto-créé, watchdog silencieux et interactif via `@cao`.
- Workflows BMAD : machine à états XState pour piloter Brief → PRD → Architecture → Stories → Dev → Test, avec validation HITL.
- Audit immuable : table partitionnée par mois, protégée par TRIGGER, auto-émission sur actions critiques, export UI.
- Serveur MCP : 68 tools et 10 resources sur 14 domaines, OAuth 2.1 avec PKCE, Dynamic Client Registration, écran de consentement granulaire. N'importe quel client MCP (Claude Code, Cursor, Claude Desktop) peut piloter la plateforme.
- Communication A2A : bus agent-to-agent avec règles de permissions et trail d'audit.

### En cours : le flywheel cœur

Ces briques sont l'architecture centrale des 3 piliers. Le schéma existe en DB, les APIs et les UI se construisent dessus en ce moment :

- Feature Map : arbre de nodes (features, ACs, requirements) reliés via `entity_links`, vue centrale du produit avec coverage structurelle.
- Quality Profiles : dimensions de scoring configurables par entreprise, attachées à des nodes via `entity_links`.
- Agent Review Panel : N agents reviewers tournent en parallèle et scorent chaque exécution par dimension.
- Gate Review humaine : approval workflow wire aux Quality Profiles.
- Autonomy Continuum : 6 niveaux KPI-driven, level 5 (Autonomous) verrouillé par défaut.
- Improvement Cockpit : KPIs, trends, thèmes de correction, vue par rôle (CEO, CTO, Lead, Dev, QA).
- Drift Detection : détection automatique de dérive entre specs et code, intégrée à la Feature Map.

Le flywheel : l'agent exécute, le Quality Profile score, la Gate Review tranche, l'Improvement Cockpit agrège, la skill s'améliore, l'autonomie peut monter d'un cran.

### Objectif T3 2026

MnM en production chez CBA (50+ devs multi-métiers), les 3 piliers opérationnels, premiers clients payants.

## Essayer MnM

```bash
# Prerequis : Bun >= 1.3, Node >= 20, Docker
bun install
bun run dev
```

Un serveur et une UI avec PostgreSQL embarqué. Aucun setup externe pour tester en local.

Pour le déploiement prod (Docker Compose, Dokploy), le get started dev complet et le guide pour brancher un client MCP, voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Aller plus loin

- [CONTRIBUTING.md](CONTRIBUTING.md) : installation, commandes, structure du repo, conventions, comment contribuer.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : stack technique, décisions architecturales, détails par composant.
- [docs/HISTORY.md](docs/HISTORY.md) : chronologie du projet, brainstorms fondateurs, métriques, roadmap détaillée.

## Credits

Fork de [Paperclip](https://github.com/paperclipai/paperclip) ("run autonomous AI companies"). Merci à l'équipe Paperclip pour le socle initial, même si les visions ont divergé depuis.

## Licence

MIT
