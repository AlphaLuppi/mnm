# Section 2 — Vision Produit, Problem Statement, 9 Personas, Métriques de Succès & Scope MVP

**Auteur** : John le PM 📋
**Date** : 2026-03-13
**Sources analysées** : Brainstorming 57 vérités, Roadmap B2B, Analyse Nanoclaw, Product Brief existant

---

## 1. Vision Produit — Pourquoi MnM, Pourquoi Maintenant

### Le constat fondamental

En mars 2026, les entreprises vivent un paradoxe : elles déploient massivement des outils IA (Claude Code, Cursor, Copilot, ChatGPT) mais n'ont **aucun moyen de les orchestrer, contrôler et auditer** à l'échelle de l'organisation. Chaque collaborateur bricole son propre usage de l'IA — le directeur produit accumule des fichiers dans un repo git avec Claude Code, le dev utilise Cursor en solo, le CEO demande des analyses à ChatGPT — mais personne ne capitalise, personne ne coordonne, et personne ne trace.

C'est exactement la situation qu'on observait avec les tableurs dans les années 2000 avant l'arrivée des ERP. Des usages individuels puissants mais cloisonnés, générant des "îlots d'intelligence" non-connectés, impossibles à auditer, et vulnérables au turnover.

### Pourquoi maintenant

Trois forces convergent en 2026 pour créer la fenêtre d'opportunité de MnM :

1. **La maturité des agents IA** — Les agents sont capables d'exécuter des tâches complexes (code, tests, analyse, rédaction), mais leur fiabilité dépend du contexte, des prompts, et des garde-fous qu'on leur impose. Sans orchestration déterministe, ils "driftent" — le CTO de CBA l'a constaté en direct lors du hackathon de mars 2026 (Vérité #45).

2. **La pression de transformation digitale** — Les entreprises sont poussées par leurs concurrents, leurs clients, et leurs actionnaires à adopter l'IA. Mais déployer de l'IA sans gouvernance, c'est comme déployer du cloud sans sécurité. Le besoin d'un "cockpit de contrôle" est imminent.

3. **L'échec des outils existants à évoluer** — Jira, ClickUp, Linear sont des outils de **tracking**, pas d'**orchestration**. Cursor, Windsurf sont des outils pour **développeurs individuels**, pas pour des **équipes multi-rôles**. Aucun outil ne combine la vision transversale, l'orchestration d'agents, et l'audit enterprise.

### L'insight fondamental

> Les entreprises n'ont pas besoin d'un meilleur Jira ou d'un meilleur Cursor. Elles ont besoin d'un **cockpit d'orchestration** où chaque partie prenante — du CEO au développeur — pilote ses agents IA dans un cadre déterministe, auditable, et collaboratif.

MnM est ce cockpit. Sa phrase produit :

> **MnM = orchestrateur d'agents déterministe avec audit, drift detection, et connecteurs auto-générés. Atomique, léger, extensible de l'intérieur.**

---

## 2. Problem Statement

### Énoncé du problème

Dans une entreprise tech en transformation digitale, **l'information se dégrade à chaque passage de relais entre rôles** (PPT → Epic → Story → Code → Tests). Les contrats inter-rôles (Definition of Ready, normes de documentation) ne sont jamais respectés. Les décisions critiques se prennent "hors système" et disparaissent. Le savoir critique reste partiellement dans les têtes des experts (le QA qui connaît l'edge case "patient ALD + diabétique + mutuelle Meurthe-et-Moselle"). Et le coût de la coordination synchrone — réunions, malentendus, re-développements — est colossal.

En parallèle, chaque collaborateur adopte l'IA à son propre rythme, créant des "poches d'efficacité" isolées qui ne se connectent jamais entre elles. Le CEO n'a aucune visibilité sur ce que les agents font. Le CTO ne peut pas imposer de standards. Le DPO ne peut pas agréger les roadmaps automatiquement.

### Les 8 faits terrain (validés chez CBA, mars 2026)

1. **L'information se dégrade à chaque handoff** (Vérité #1)
2. **Les contrats inter-rôles sont aspirationnels, jamais appliqués** (Vérité #2)
3. **Des décisions non-documentées se prennent en permanence** (Vérité #3)
4. **Le savoir critique est partiellement tacite** (Vérité #5)
5. **La boucle de feedback est structurellement trop longue** (Vérité #6)
6. **L'alignement inter-équipe est un goulot d'étranglement synchrone** (Vérité #13)
7. **L'information de pilotage n'existe nulle part de manière unifiée** (Vérité #15)
8. **Les workflows actuels CRÉENT des problèmes qui n'existeraient pas sans eux** (Vérité #23)

### Impact mesurable

- **Coût de coordination** : environ 30% du temps total des équipes est perdu en réunions de synchronisation, re-travail post-malentendu, et attente d'information
- **Perte de savoir** : chaque départ d'un expert (PO, QA senior) détruit des mois de connaissance contextuelle non-documentée
- **Risque de compliance** : zéro traçabilité sur les décisions prises par les agents IA déployés
- **Sous-utilisation de l'IA** : les équipes utilisent l'IA à 10-20% de son potentiel car chacun bricole en solo

---

## 3. Les 9 Personas Détaillés

### Persona 1 : Le CEO — Le Pilote Stratégique

**Rôle & responsabilités** : Définit la vision, suit l'avancée de chaque équipe, fait des POC, veille les forums utilisateurs, détecte les pain points hotline, priorise les investissements.

**Pain points actuels** :
- Consomme de l'info multi-format non-unifiée : ClickUp + Trello + Excel + PPT + rétros + réunions
- Quand il change de priorité stratégique, ça met des semaines avant que ce soit appliqué terrain
- Pas de moyen de savoir en temps réel où en sont les équipes sans passer par des intermédiaires

**Ce que MnM lui apporte** :
- Dashboard customisé avec des agents qui ont la vision sur TOUTE la chaîne complète
- Onboarding en mode conversationnel
- Propagation structurée de ses décisions dans le workflow

**Quote fictive** :
> *"Aujourd'hui je passe 2 heures par semaine à compiler des infos de 5 outils différents pour avoir une vue d'ensemble. Avec MnM, j'ouvre un dashboard et je pose une question."*

### Persona 2 : Le CTO / DSI — Le Garant Technique

**Rôle & responsabilités** : Responsable de l'architecture technique, de la fiabilité, de la sécurité, et de l'adoption des outils.

**Pain points actuels** :
- Les agents IA déployés ne chargent pas les bons fichiers (feedback CTO CBA hackathon mars 2026)
- Aucune traçabilité centralisée des actions des agents
- Pas de moyen d'imposer des standards techniques automatiquement

**Ce que MnM lui apporte** :
- Workflows déterministes : fichiers/prompts/contextes imposés
- Audit centralisé
- Drift detection
- Gestion de compaction plateforme

**Quote fictive** :
> *"Au hackathon, j'ai vu des agents qui sautaient des étapes. Avec MnM, je définis une fois le workflow et je sais que l'agent va le suivre."*

### Persona 3 : Le DPO — Le Chef d'Orchestre Produit

**Pain points** : Agrégation manuelle, pas de vue d'ensemble roadmaps, bricolage local fragile.

**Ce que MnM apporte** : Workflows structurés, base de connaissances connectée, vue inter-équipes.

> *"Mon repo git perso avec des années de data — si je pars, tout est perdu. Avec MnM, c'est un capital collectif."*

### Persona 4 : Le PM — Le Stratège Produit

**Pain points** : PPTs re-interprétés. 80% exécution / 20% réflexion.

**Ce que MnM apporte** : Brainstorm assisté → output exploitable. Ratio inversé.

> *"Je brainstorme avec un agent, l'output part directement dans le workflow. Plus de téléphone arabe."*

### Persona 5 : Le PO — Le Traducteur de Besoins

**Pain points** : 80% exécution mécanique. DoR jamais respectée. Savoir tribal.

**Ce que MnM apporte** : Agents écrivent stories, PO valide. Savoir capturé.

> *"80% de mon temps c'est de la mise en forme. Avec MnM, je me concentre sur comprendre le métier."*

### Persona 6 : Le Designer

**Pain points** : Sollicité ad-hoc. Recos arrivent trop tard. Pas de lien maquettes→code.

**Ce que MnM apporte** : Notification dans le workflow. Maquettes liées aux stories.

> *"On me demande une maquette en urgence. Avec MnM, je suis notifié dès l'epic."*

### Persona 7 : Le Développeur

**Pain points** : IA individuelle sans orchestration. Peur du remplacement. Contributions cross-rôles bloquées.

**Ce que MnM apporte** : Agent avec contexte complet. Dialogue temps réel. Curseur personnel.

> *"Mon agent connaît le contexte du projet. Je peux le guider en live. C'est un junior ultra-rapide."*

### Persona 8 : Le QA / Testeur

**Pain points** : Tests manuels répétitifs. Edge cases "dans la tête". Peur obsolescence.

**Ce que MnM apporte** : Capture savoir tacite. De testeur à architecte qualité.

> *"Je formalise ce savoir et les agents l'exécutent. Je me concentre sur les nouveaux edge cases."*

### Persona 9 : Le Lead Tech

**Pain points** : Travail background qui négocie sa place. Reviews chronophages. Scrum = "le pire".

**Ce que MnM apporte** : Monitoring auto dette/dépendances. Reviews augmentées. Workflows dédiés dette.

> *"60% de mon temps sur du scrum et des reviews. MnM automatise le mécanique."*

---

## 4. Métriques de Succès par Noyau de Valeur

### Noyau 1 — Orchestrateur Déterministe

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Taux de respect workflows | >90% | >98% |
| Temps détection drift | <15 min | <2 min |
| Taux réinjection contexte | >85% | >95% |
| Workflows actifs | 10+ | 50+ |

### Noyau 2 — Observabilité & Audit

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Couverture audit | 100% | 100% |
| Latence observabilité | <5s | <2s |
| Réduction MTTR | -40% | -70% |
| NPS transparence | >25 | >50 |

### Noyau 3 — Onboarding Cascade

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Temps onboarding | <1 sem | <2j |
| Taux complétion | >70% | >90% |
| Temps import | <3j | <1j |

### Noyau 4 — Agent-to-Agent

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Queries inter-agents/sem | 50+ | 500+ |
| Réduction handoff | -30% | -70% |
| Connecteurs auto | 0 | >5/client |

### Noyau 5 — Dual-Speed

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Ratio mécanique/réflexion | 60/40 | 20/80 |
| Position curseur | 1.5 | 2.5 |
| Savoir capturé | 100 items | 1000+ |

### KPIs Business

| Objectif | 3 mois | 12 mois |
|---|---|---|
| Client pilote CBA | POC signé | Prod + case study |
| ARR | 10-30k€ | 200k€ |
| Rôles non-dev | >30% | >40% |
| Rétention 90j | >70% | >85% |

---

## 5. Scope MVP vs. Future

### Dans le MVP (8-10 semaines)

| Feature | Justification | Noyau |
|---|---|---|
| Multi-user B2B | Prérequis absolu | Transversal |
| RBAC métier | Chaque user = un rôle | Onboarding |
| Scoping par projet | Confidentialité inter-équipes | Permissions |
| Chat temps réel humain-agent | Agent "conduisible" | Orchestrateur |
| Workflow stages déterministes | Cœur du différenciateur | Orchestrateur |
| Audit basique centralisé | Prérequis confiance CTO | Observabilité |

### Hors MVP — Court terme (3-6 mois)

SSO, Import Jira/Linear, Drift detection auto, Containerisation Docker, Email transactionnel

### Hors MVP — Moyen terme (6-12 mois)

Onboarding cascade complet, Mode dual oral+visuel, Communication agent-to-agent, Observabilité Langfuse, Multi-tenant SaaS

### Hors MVP — Long terme (12-24 mois)

MnM brainstorme seul, Connecteurs auto-générés, MnM modifiable de l'intérieur, Capital connaissances collectif

---

*Section produite par John le PM — Prête pour intégration dans le Product Brief B2B.*
