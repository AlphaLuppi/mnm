---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
inputDocuments:
  - brainstorming/brainstorm-nikou.md
  - brainstorming/brainstorm-tom-2026-02-19.md
  - brainstorming/brainstorming-session-gab-2026-02-21.md
date: 2026-02-22
author: Gabri
---

# Product Brief: MnM

## Executive Summary

MnM est un IDE open-source conçu pour le développement piloté par agents IA. Contrairement aux IDEs traditionnels qui ajoutent de l'IA à un éditeur de code, MnM part du principe que **l'humain ne code plus — il supervise l'alignement entre les specs, les tests et le travail des agents**.

MnM répond à un problème concret vécu par ses créateurs : quand on développe via des agents IA (Claude Code, BMAD), les outils actuels — terminaux, IDEs classiques, fichiers XML — ne donnent aucune visibilité sur ce que les agents font, quel contexte ils utilisent, s'ils dérivent des specs, ni où en est le projet globalement.

MnM remplace le paradigme **"Write → Run → Debug"** par **"Describe → Review → Approve"**, en offrant un cockpit de supervision avec visualisation du contexte, orchestration multi-agents, détection de drift entre documents, et workflows visuels.

Projet open-source, MnM est d'abord construit pour ses créateurs, et partagé avec quiconque adopte le même paradigme de développement agentique.

---

## Core Vision

### Problem Statement

Les agents IA (Claude Code, etc.) sont désormais capables de produire du code de qualité à partir de specs en langage naturel. Le paradigme de développement bascule : l'humain définit l'intention, l'agent exécute. Mais les outils de développement restent ancrés dans l'ancien monde — celui où l'humain écrit, lit et debug du code ligne par ligne.

### Problem Impact

Au quotidien, les développeurs travaillant avec des agents IA font face à :

- **L'opacité de l'activité des agents** : pour savoir ce qu'un agent fait, il faut ouvrir un terminal et lire ses logs. Aucune vue d'ensemble de son avancement, de ses blocages, de ses décisions.
- **L'invisibilité du contexte** : impossible de savoir quels fichiers de contexte un agent consulte, ni de détecter quand il travaille avec un contexte pollué ou obsolète.
- **Le drift silencieux** : un agent modifie un fichier de specs, et personne ne vérifie automatiquement la cohérence avec le reste de la documentation. Les incohérences se propagent en cascade.
- **Les workflows opaques** : les workflows de développement sont des fichiers XML illisibles. On peut demander à un agent de les modifier, mais impossible de les visualiser ou comprendre ce qu'on a.
- **Le flou opérationnel** : qu'est-ce qui tourne, qu'est-ce qui est prêt, qu'est-ce qu'il faut tester — le statut réel du projet est dispersé et difficile à reconstituer.

### Why Existing Solutions Fall Short

| Outil | Ce qu'il fait | Ce qui manque |
|-------|--------------|---------------|
| **Cursor / Windsurf** | IA intégrée dans un éditeur de code | Reste centré sur l'édition manuelle. L'IA est un assistant, pas l'exécuteur principal. |
| **VSCode + extensions** | Éditeur extensible | Aucun support natif pour la supervision d'agents ou la détection de drift. |
| **Claude Code (CLI)** | Agent de développement puissant | Interface terminal pure. Zéro visualisation, zéro vue d'ensemble multi-agents. |
| **Zed** | IDE performant avec IA | Même paradigme que Cursor — l'humain code, l'IA aide. |
| **IntelliJ** | IDE robuste | Conçu pour le codeur, pas le superviseur. |

Tous ces outils partagent la même hypothèse fondamentale : **l'humain écrit du code**. MnM renverse cette hypothèse.

### Proposed Solution

MnM est un IDE où :

- **Le code est un artefact dérivé**, consultable à la demande mais pas l'interface principale. Les specs et les tests sont au premier plan.
- **Les agents sont des first-class citizens** avec indicateurs de santé, plan de vol, et timeline d'activité visuelle remplaçant le terminal.
- **Le contexte est visible et manipulable** — on voit ce que chaque agent utilise, on drag & drop du contexte vers un agent.
- **Le drift est détecté automatiquement** entre tous les niveaux de la hiérarchie documentaire (Product Brief → PRD → Architecture → Stories → Code).
- **Les workflows sont visuels** — éditables graphiquement, compréhensibles sans lire du XML.

Le paradigme MnM : **"On ne vérifie plus le code, on ne vérifie que les specs et les tests."**

### Key Differentiators

1. **Specs-first, pas code-first** — Le code n'est pas l'interface principale. L'humain travaille au niveau des specs et des tests.
2. **Supervision, pas édition** — Le layout est un cockpit (contexte / agents / tests), pas un éditeur de texte avec un chat à côté.
3. **Drift detection cross-document** — Détection automatique des incohérences entre tous les niveaux de documentation, pas juste code vs spec.
4. **Timeline d'activité** — Le terminal est remplacé par une timeline visuelle qui montre l'activité de tous les agents d'un coup d'oeil.
5. **Né du terrain** — Construit par et pour des développeurs qui utilisent le paradigme agentique au quotidien avec BMAD et Claude Code.

---

## Target Users

### Primary Users

MnM est construit par et pour ses trois créateurs. Il n'y a pas de segmentation marché — il y a une équipe de trois développeurs qui pratiquent le développement agentique au quotidien et qui ont besoin d'un outil adapté à leur paradigme.

**Profil commun :**
- Développeurs expérimentés utilisant Claude Code + BMAD comme stack de développement principal
- Travaillent dans un paradigme où l'humain définit les specs et supervise, les agents codent
- Utilisent actuellement des IDEs classiques (Cursor, IntelliJ, Warp) en palliatif, faute de mieux
- Ont une connaissance approfondie des workflows agentiques et de leurs limites actuelles

**Sensibilités individuelles :**
- **Tom** — Besoin fort de visibilité sur l'activité des agents et de visualisation/édition des workflows
- **Gabri** — Besoin fort de visibilité sur le contexte des agents, la détection de drift, et le statut opérationnel du projet
- **Nikou** — Besoin fort d'architecture extensible et de support multi-frameworks agentiques

### Secondary Users

Hors scope. MnM est un outil interne d'abord. Si d'autres développeurs agentiques l'adoptent via l'open source, tant mieux, mais ce n'est pas un objectif de design.

### User Journey

1. **Discovery** — N/A (les utilisateurs sont les créateurs)
2. **Onboarding** — Configuration du projet existant (repo Git + fichiers BMAD) dans MnM
3. **Core Usage quotidien** — Ouvrir MnM, voir le cockpit (santé projet, agents, alertes), assigner des stories aux agents, superviser via la timeline, vérifier l'alignement specs/tests
4. **Success Moment** — "Je vois exactement ce que chaque agent fait, avec quel contexte, et je n'ai pas eu à ouvrir un terminal une seule fois"
5. **Long-term** — MnM remplace complètement l'IDE classique pour le travail quotidien de supervision agentique

---

## Success Metrics

MnM n'a pas de métriques business — c'est un outil interne pour trois développeurs. Le succès se mesure en termes d'**adoption réelle**, de **temps gagné** et de **confiance déléguée**.

### Adoption

- MnM remplace le setup actuel (Cursor/IntelliJ/Warp + terminal) pour le travail quotidien de supervision agentique
- Les trois créateurs utilisent MnM comme interface principale, sans avoir besoin de retourner dans un IDE classique ou un terminal pour superviser les agents

### Réduction du temps de vérification manuelle

| Tâche | Aujourd'hui | Objectif MnM |
|-------|-------------|--------------|
| Vérifier ce que fait un agent | Ouvrir le terminal, lire les logs | Vue d'un coup d'oeil (timeline + indicateurs) |
| Vérifier le contexte d'un agent | Inspecter manuellement les fichiers | Visualisation directe dans le volet contexte |
| Vérifier l'alignement specs/tests/code | Run manuellement des commandes de vérification | Drift detection automatique avec alertes actionnables |
| Comprendre un workflow | Ouvrir un fichier XML et essayer de le lire | Visualisation graphique du workflow |
| Savoir où en est le projet | Reconstituer mentalement à partir de sources dispersées | Dashboard cockpit à l'ouverture |

### Confiance déléguée

Le KPI fondamental de MnM est le **niveau de confiance déléguée** :
- **Niveau 1** — Je vois ce que les agents font (visibilité)
- **Niveau 2** — Je suis alerté quand quelque chose dérive (drift detection)
- **Niveau 3** — Je fais confiance à MnM pour vérifier l'alignement specs ↔ tests ↔ code sans que j'aille vérifier moi-même

L'objectif est d'atteindre le niveau 3 sur les projets matures avec une couverture de tests solide.

### Business Objectives

N/A — Projet open-source sans objectif commercial. Le seul objectif est que les trois créateurs gagnent du temps et de la confiance dans leur workflow agentique quotidien.

### Key Performance Indicators

N/A — Pas de KPIs business. Le succès se mesure qualitativement : "est-ce que j'ouvre encore Cursor/le terminal aujourd'hui, ou est-ce que MnM me suffit ?"

---

## MVP Scope

### Core Features

Le MVP de MnM comprend trois blocs fonctionnels qui, ensemble, constituent le cockpit minimum de supervision agentique.

#### Bloc 1 — Visibilité (fondation)

- **Timeline d'activité des agents** — Remplacement du terminal par une timeline visuelle horizontale montrant l'activité de tous les agents. Indicateurs de santé (vert/orange/rouge) visibles d'un coup d'oeil. Cliquer sur un checkpoint amène dans le chat de l'agent à ce moment.
- **Visualisation du contexte des agents** — Voir quels fichiers de contexte chaque agent consulte. Savoir en temps réel ce que l'agent "voit".

#### Bloc 2 — Supervision (usage quotidien)

- **Drift detection cross-document** — Détection automatique des incohérences entre les niveaux de la hiérarchie documentaire (Product Brief → PRD → Architecture → Stories → Code). Alertes actionnables avec options de résolution.
- **Dashboard cockpit** — Vue d'ensemble à l'ouverture : santé du projet, agents actifs, stories en cours, alertes de drift.
- **Layout 3 volets** — Contexte (gauche) / Agents (centre) / Tests & Validation (droite), avec navigation hiérarchique synchronisée (Projet → Epic → Story → Tâche).

#### Bloc 3 — Puissance (workflow complet)

- **Workflow Editor visuel** — Visualisation graphique des workflows (remplacement de la lecture de fichiers XML). Édition basique.
- **Tests hiérarchiques** — Affichage des tests en miroir de la hiérarchie des specs (tâche → unitaires, story → unitaires groupés, epic → intégration, projet → e2e).
- **Context management interactif** — Drag & drop de contexte vers un agent. Ajout/retrait de fichiers du contexte d'un agent.

### Contrainte technique

MnM nécessite un accès au filesystem local, aux process des agents, et à Git. Une pure web app est insuffisante. La solution envisagée est une application desktop basée sur des technologies web (Electron ou Tauri), permettant de coder en web tout en ayant un accès système complet. Le choix technique sera affiné lors de la phase d'architecture.

### Out of Scope pour le MVP

- **Sync bidirectionnelle chat ↔ builder** dans le Workflow Editor (le builder visuel suffit pour le MVP)
- **Plugin system pour frameworks agentiques** (MVP = Claude Code uniquement, pas d'abstraction multi-framework)
- **Connecteurs MCP** (Linear, GitHub, Slack — post-MVP)
- **Marketplace de workflows communautaires**
- **Onboarding conversationnel** (les 3 utilisateurs connaissent déjà le produit)
- **Groupes d'agents / squads**
- **Minimap projet**
- **Tests e2e jouables par l'humain**
- **Édition de code** (le code est consultable en mode inspection, pas éditable dans le MVP)

### MVP Success Criteria

Le MVP est réussi quand les trois créateurs peuvent :
1. Ouvrir MnM et voir d'un coup d'oeil l'état de leur projet (cockpit)
2. Suivre l'activité de chaque agent sans ouvrir un terminal
3. Voir quel contexte chaque agent utilise
4. Être alertés automatiquement quand des documents dérivent les uns des autres
5. Visualiser leurs workflows sans lire du XML

### Future Vision

**Post-MVP — Niveau 2 :**
- Sync bidirectionnelle chat ↔ Workflow Editor
- Plugin system extensible (support OpenHands, Devin, etc.)
- Connecteurs MCP (Linear, GitHub, Slack)
- Rigueur de drift configurable par zone (story critique vs cosmétique)
- Mode inspection du code avec niveaux progressifs (specs → diff langage naturel → code)

**Long-terme — Niveau 3 :**
- Marketplace de workflows communautaires
- Agents-as-Extensions (marketplace d'agents spécialisés)
- Groupes d'agents avec ordres collectifs
- Courbes de tendance et métriques projet
- Confiance déléguée niveau 3 (auto-approve sur projets matures)
