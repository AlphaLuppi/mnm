# Vision MnM

*Consolidée des visions et brainstorms internes Q1–Q2 2026.*

## En une phrase

**MnM est le management plane de l'IA coding** : un cockpit de supervision B2B qui orchestre des équipes complètes d'agents IA — dev, QA, PM, infra, compliance, direction — sans remplacer les outils que les développeurs utilisent déjà.

Analogie fondatrice : *Kubernetes n'a pas remplacé Docker — il l'orchestre.* MnM n'a pas à remplacer Claude Code, Cursor ou Codex — il les orchestre.

## Quoi

Un cockpit B2B self-hosted (et bientôt multi-tenant hébergé) qui apporte trois choses qui manquent aujourd'hui aux équipes utilisant l'IA coding à l'échelle :

- **Une orchestration déterministe** des workflows agents, versionnée en git (les Governed Workflows).
- **Un scoring objectif** des artefacts produits, multi-dimensionnel et porté par des agents reviewers spécialisés.
- **Un continuum d'autonomie** — six niveaux, de Manual à Full Autopilot — où la progression est pilotée par des KPI et jamais imposée.

Une plateforme avec **deux faces** d'une même médaille :

- **Web UI** — pour ceux qui supervisent (PM, CTO, QA, compliance, lead IA, direction). Dashboards, Feature Map, Improvement Cockpit, Workflow Studio.
- **MCP Server** — pour ceux qui exécutent (devs, agents). Get tasks, soumettre des artifacts, lancer des agents, créer des issues — depuis Claude Code, Cursor ou n'importe quel client MCP.

Même backend, même data, même auth. Deux projections du même système.

## Pourquoi

### Le problème

Le développement assisté par agents IA s'est installé partout en entreprise, **sans supervision**. Concrètement :

- **Le CEO ne sait pas** ce que font les agents, ce que ça coûte, ni si c'est fiable.
- **Le CTO n'a aucune traçabilité** — les agents exécutent sans audit, sans standards, sans gouvernance.
- **Le développeur travaille en solo** — pas de partage de pratiques, pas de feedback objectif, pas de progression mesurable.
- **Le QA découvre les régressions en production** — pas de gate de qualité avant.
- **Le PM brainstorme dans des outils non-gouvernés** (chatbots externes, prototypes Vercel privés) — l'information ne remonte pas vers la production.

Résultat : dette technique invisible, risques de sécurité, shadow-AI généralisée, perte de compétitivité, et personne ne peut dire si l'équipe s'améliore vraiment avec l'IA — ou si elle régresse.

### La conviction

Les entreprises ne veulent pas remplacer leurs équipes par des agents autonomes. Elles veulent que leurs équipes **utilisent des agents sous supervision**, avec :

- Des preuves objectives que les agents produisent du travail de qualité.
- Le choix du niveau d'autonomie agent par agent, étape par étape, jamais forcé.
- Une visibilité partagée, adaptée au rôle de chacun.

C'est l'angle mort actuel du marché. Aucun outil ne combine orchestration + scoring + continuum d'autonomie — et c'est précisément le croisement où MnM s'installe.

## Comment

Trois piliers, une boucle d'amélioration.

### Les 3 piliers

| Pilier | Promesse | Comment MnM le tient |
|--------|----------|----------------------|
| **Confiance** | L'agent prouve qu'il mérite l'autonomie. L'humain reste juge. | Quality Profiles + Agent Review Panel — scoring multi-dimensions par agents reviewers spécialisés tournant en parallèle. Gate review humaine en backup. |
| **Contrôle** | C'est un dial, pas un switch. L'utilisateur choisit son niveau d'autonomie. | Autonomy Continuum à six niveaux. Progression pilotée par les KPI. Le niveau Autopilot est verrouillé par défaut, déblocable uniquement par preuve. |
| **Transparence** | Chaque stakeholder voit ce qui le concerne, dans le format qui lui convient. | Pipeline de traces Bronze / Silver / Gold. Improvement Cockpit. Review Lenses composables (Blocks). Audit trail immutable. |

Détails complets dans [`three-pillars.md`](./three-pillars.md).

### Le Flywheel

Le mécanisme central — chaque feature est un rouage de cette boucle :

```
   Agent exécute  →  Scoring objectif  →  Gate review humain
        ↑                                          ↓
   Skill amélioré  ←  Improvement Cockpit  ←  Feedback structuré
        ↓
   KPI montent  →  Autonomie augmente  →  Agent exécute (mieux)
```

Le pitch n'est pas *"on a sept features"*. C'est *"on a une boucle d'amélioration continue qui rend vos agents meilleurs chaque jour, calibrée sur votre vraie codebase et vos vrais critères."*

Cette boucle constitue le moat défensif de MnM : les données du cycle sont propriétaires à chaque client. Plus une équipe utilise MnM, plus le scoring est calibré sur ses standards réels, plus l'amélioration est précise. Network effects intra-entreprise.

### Trois principes non-négociables

1. **Légèreté** — Le moins de tables, de types hardcodés et de contraintes possibles. Les entités structurelles sont génériques (`nodes`, `entity_links`). La sémantique vient de l'usage, pas du schema.
2. **Agnosticisme** — MnM doit marcher pour une petite startup interne comme pour une équipe réglementée de plusieurs centaines de personnes. Pas d'entités client-spécifiques, pas de logique métier hardcodée. La flexibilité vient des Blocks composables, des tags additifs et des agents configurables.
3. **Flexibilité** — Pas de rôles figés (PM/PO/Dev/QA). Les rôles deviennent flous. N'importe qui peut contribuer, chacun compose sa vue. La structure vient de l'usage, pas de l'outil.

## Pour qui

### Personas primaires

| Persona | Profil type | Pain principal | Ce que MnM résout |
|---------|-------------|----------------|-------------------|
| **CEO / Direction** | Dirigeant, perspective business et risque | Aucune visibilité sur ce que coûtent et produisent les agents | Confidence Badge, Project Health Score, Autonomy Leaderboard, vue macro 3 secondes |
| **CTO / DSI** | Responsable tech, gouvernance et compliance | Aucune traçabilité, aucune gouvernance sur les agents IA | Dashboard de supervision, audit trail immutable, policies, Quality Profiles réglementaires |
| **Tech Lead / Lead IA** | Senior dev qui pilote une équipe + des agents | Pas de feedback loop, amélioration manuelle, pas de progression mesurable | Improvement Cockpit, Quality Profiles par métier, Flywheel mesurable |
| **Développeur** | Utilise quotidiennement Claude Code, Cursor, Codex | IA en solo, pas de contexte partagé, pas de scoring objectif | MnM MCP dans son outil, scoring automatique, contexte enrichi, garde son IDE |

### Personas secondaires

- **PM / PO** — Chat-first avec handoff structuré vers la production. Plus de shadow-AI, plus de perte d'information à l'handoff.
- **QA** — Gate review, tests et coverage via la Feature Map, lifecycle des acceptance criteria.
- **Compliance / DPO** — Audit trail, Quality Profiles réglementaires, matrice de conformité automatique.
- **Designer** — Notifié dans les workflows, Review Lenses avec preview Figma / prototype.

### Taille cible

Équipes produit de **5 à 500 personnes**. Au-delà, MnM reste utilisable (multi-squads via tags additifs), mais le produit n'est pas optimisé pour les très grandes organisations.

## Différenciateurs

### MnM vs les IDE et frameworks IA

**vs Cursor / Windsurf / Devin et autres IDE-IA** : Cursor et Windsurf sont des IDE premium boostés à l'IA. Devin promet de l'autopilot. MnM ne s'oppose pas à eux — il vit *au-dessus*. MnM ne touche pas à l'expérience d'édition, ne remplace pas l'IDE. Il apporte la couche supervision, scoring et gouvernance qui leur manque par construction (un IDE n'est pas un cockpit cross-équipes).

**vs Claude Code** : Claude Code évolue vite, et ses utilisateurs ne veulent pas perdre la dernière feature en passant par un autre outil. MnM ne réimplemente pas Claude Code dans un navigateur — il **s'intègre** via le MnM MCP Server. Le développeur garde Claude Code et bénéficie en plus du contexte enrichi MnM (issues, specs, ACs, scoring, KPI). MnM est l'outil *derrière* l'outil.

**vs Langfuse / Patronus / Braintrust** : ce sont des outils d'observabilité et d'évaluation LLM. Ils tracent et scorent. Mais ils n'orchestrent pas, n'ont pas de continuum d'autonomie, pas de gate review humaine first-class, pas de Workflow Studio versionné en git.

**vs CrewAI / AutoGen** : ce sont des frameworks multi-agent. Du code Python pour bâtir soi-même son orchestration. MnM est un produit fini, multi-rôle, avec UI, scoring, governance et integration à l'écosystème (git, MCP, OAuth).

**vs Jira / Linear** : project management classiques, pas agent-native. Pas de scoring, pas de continuum d'autonomie, pas de pipeline de traces, pas de notion de gates qualité avant production.

### Le white space

MnM occupe un croisement vide sur le marché : **orchestration déterministe + scoring objectif + continuum d'autonomie + multi-rôle**. Les acteurs adjacents couvrent un seul axe : observabilité (Langfuse, Patronus, Braintrust), frameworks multi-agent (CrewAI, AutoGen), IDE-IA (Cursor, Windsurf), project management (Jira, Linear). Aucun ne combine les quatre.

### Le moat

1. **Le Flywheel propriétaire** — chaque cycle scoring → amélioration produit des données uniques au client.
2. **Network effects intra-entreprise** — le scoring se calibre sur la vraie codebase et les vrais standards. Impossible à répliquer côté concurrent.
3. **Switching cost** — Quality Profiles, workflows versionnés en git, configurations agent : un investissement client qu'on ne migre pas en un clic.
4. **First mover** sur le croisement orchestration + scoring + continuum.

## Roadmap haut niveau

Trois phases produit, pensées en cercles concentriques. Chaque phase apporte de la valeur indépendamment.

### Phase 1 — Foundation (T1 2026)

Les fondations sont en place :

- Multi-tenant : shared DB + RLS, routes scopées par `/companies/:companyId/`, middleware chain defense-in-depth.
- RBAC dynamique en DB (rôles, permissions, role_permissions), isolation par tags additifs.
- Pipeline de traces Bronze → Silver → Gold avec enrichissement LLM hiérarchique.
- Config Layers structurées avec priority merge et OAuth 2.1 PKCE.
- Chat collaboratif temps réel, artifacts, RAG, dossiers, @mentions.
- Audit trail immutable + A2A (agent-to-agent communication).
- Governed Workflows V1 — Workflow Studio Monaco multi-fichiers, AI Assistant SSE, gates canoniques (`artifact-exists`, `artifacts-bundle`, `step-succeeded`, `review-pass`), parité REST + MCP, multi-provider git.

### Phase 2 — Confiance + Cockpit (T2 2026)

Le scoring objectif et la première vraie boucle d'amélioration :

- Quality Profiles avec attachement universel via `entity_links` (s'attachent à tout, comme les tags).
- Agent Review Panel — scoring multi-dimensions par agents reviewers en parallèle.
- Gate review humaine first-class avec feedback structuré.
- Improvement Cockpit V1 — KPI, trends, thèmes de correction LLM-extracted, flow d'amélioration des skills.
- Confidence Badge — score unique hero metric visible partout.
- Feature Map V1 — vue centrale du produit, traceability specs → issues → code → tests.
- Handoff agent — chat → document structuré → projet, sans perte d'information.

### Phase 3 — Continuum + Scale (T3 2026 et au-delà)

L'autonomie progressive et l'industrialisation :

- Autonomy Continuum complet — UI de configuration des six niveaux par entité.
- Shadow Mode — l'agent exécute en parallèle de l'humain pour valider empiriquement avant transition.
- Pair Scoring — l'humain calibre les agents scorers via les overrides.
- Agent Recipes — combos pré-packagées (`Backend Dev Stack`, `Frontend Stack`, ...) en one-click.
- Quality Profile Templates partagés (marketplace interne).
- GitOps for MnM Config — quality profiles, workflows et agent configs versionnés en YAML.
- MnM Insights — Weekly Digest proactif (pas réactif).
- Internationalisation, billing automatisé, MnM CLI tool-agnostic.

### Au-delà

- **MnM pour le non-code** : rédaction marketing, support client, data analysis. Même flywheel, même cockpit, élargissement massif du périmètre adressable.
- **MnM comme outil de formation** : le continuum *est* un programme de formation. Les juniors démarrent en Guided, montent au fur et à mesure que leurs KPI prouvent la maîtrise.
- **MnM pour l'audit / compliance** : la combinaison Quality Profiles + Review Lenses + audit trail immutable = piste d'audit automatique. Aide aux certifications type ISO ou SOC2.

## Adoption

L'adoption se fait en **cercles concentriques** — chaque cercle indépendant apporte de la valeur : MnM MCP basique → Quality Profiles + gate humaine → Improvement Cockpit → agents reviewers automatisés → continuum d'autonomie → Autopilot + Shadow Mode. Pas de big-bang.

**Time to First Value < 30 minutes.** Le continuum démarre invisible. Tout le monde commence en Connected avec des defaults intelligents. Scoring, reviewers, niveaux se découvrent progressivement.

## Le narratif central

> *L'agent prouve qu'il mérite l'autonomie. L'humain reste juge.*

Ce renversement narratif est essentiel. MnM n'est pas un outil de surveillance, c'est un **amplificateur**. La progression d'autonomie est une récompense méritée par les KPI, pas un cadeau du management. Le développeur n'est pas fliqué : on mesure ce qu'il produit, jamais comment il le produit. Résultat sur méthode, toujours.

## Sources

Cette vision consolide les documents internes suivants (archivés dans `docs/history/`) :

- `vision-mnm-2026-04-07.md` — vision consolidée des cinq parties.
- `product-brief-mnm-v3-2026-04-08.md` — product brief V3.
- `vision-projects-v2-2026-04-06.md` — vision Projects v2 (nodes, entity_links, Feature Map).
- `brainstorming-3-pillars-2026-04-07.md` — naissance des trois piliers.
- `brainstorming-vision-consolidation-2026-04-07.md` — stress-test de la vision (reverse brainstorming, six thinking hats, SCAMPER).

En cas de divergence avec ces sources, **ce document fait foi**.

---

*Vision MnM — Studio Manifeste — 2026.*
