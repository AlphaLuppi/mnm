---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-02-27'
inputDocuments:
  - planning-artifacts/prd.md
  - planning-artifacts/architecture.md
  - planning-artifacts/ux-design-specification.md
---

# MnM - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for MnM, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: L'utilisateur peut voir la liste de tous les agents actifs avec leur statut mis à jour en continu (actif, en pause, bloqué, terminé) — latence définie par NFR1
FR2: L'utilisateur peut voir l'indicateur de santé de chaque agent (vert/orange/rouge) sans navigation — visible depuis la vue principale
FR3: L'utilisateur peut voir la timeline d'activité de chaque agent sous forme de frise chronologique avec des checkpoints
FR4: L'utilisateur peut cliquer sur un checkpoint de la timeline pour naviguer au moment exact dans le chat de l'agent
FR5: L'utilisateur peut voir quand un agent est bloqué et accéder au point de blocage en un clic
FR6: L'utilisateur peut lancer un agent sur une tâche depuis MnM
FR7: L'utilisateur peut arrêter un agent en cours d'exécution
FR8: L'utilisateur peut voir la progression d'un agent sous forme d'étapes (tâches du todolist ou checkpoints émis par l'agent) avec distinction entre complétées et restantes
FR9: L'utilisateur peut voir la liste des fichiers de contexte que chaque agent consulte, mise à jour en continu — latence définie par NFR1
FR10: L'utilisateur peut ajouter un fichier de contexte à un agent (drag & drop ou sélection)
FR11: L'utilisateur peut retirer un fichier de contexte d'un agent
FR12: L'utilisateur peut voir les fichiers de contexte sous forme de cards visuelles avec badges indiquant quel agent les utilise
FR13: L'utilisateur peut être notifié quand un agent modifie un fichier de contexte
FR14: Le système peut détecter automatiquement les incohérences entre documents de la hiérarchie (Product Brief → PRD → Architecture → Stories → Code)
FR15: Le système peut déclencher la drift detection par événement (quand un fichier de contexte est modifié)
FR16: L'utilisateur peut lancer une vérification de drift à la demande sur un ensemble de documents
FR17: L'utilisateur peut voir une alerte actionnable quand un drift est détecté, avec le diff exact entre les documents concernés
FR18: L'utilisateur peut résoudre un drift depuis l'alerte (corriger le document source, corriger le document dérivé, ou ignorer)
FR19: Le système peut associer un score de confiance à chaque drift détecté
FR20: L'utilisateur peut configurer le seuil de confiance en dessous duquel les alertes ne sont pas surfacées
FR21: L'utilisateur peut voir un dashboard cockpit à l'ouverture de MnM avec la santé globale du projet
FR22: L'utilisateur peut voir le nombre d'agents actifs, leur statut, et les alertes de drift en cours depuis le cockpit
FR23: L'utilisateur peut voir les stories en cours avec leur état d'avancement (ratio tâches complétées / tâches totales, source : fichiers Markdown BMAD)
FR24: L'utilisateur peut naviguer du cockpit vers n'importe quel agent, alerte, ou story en un clic
FR25: L'utilisateur peut voir un workflow BMAD sous forme de diagramme de flux visuel (noeuds et connexions)
FR26: L'utilisateur peut voir l'ordre d'exécution des étapes et les branches parallèles dans le diagramme
FR27: L'utilisateur peut ajouter un noeud (étape) à un workflow existant via l'éditeur visuel
FR28: L'utilisateur peut supprimer un noeud d'un workflow
FR29: L'utilisateur peut réorganiser les connexions entre noeuds
FR30: L'utilisateur peut configurer les propriétés d'un noeud (rôle, instructions)
FR31: Le système peut synchroniser les modifications visuelles avec le fichier source du workflow (YAML/XML)
FR32: L'utilisateur peut voir l'exécution d'un workflow en continu (étape en cours mise en évidence visuellement) — latence définie par NFR1
FR33: L'utilisateur peut voir les tests organisés en miroir de la hiérarchie des specs (tâche → unitaires, story → unitaires groupés, epic → intégration, projet → e2e)
FR34: L'utilisateur peut voir le statut de chaque test (pass/fail/pending)
FR35: L'utilisateur peut naviguer d'une spec vers ses tests associés et inversement
FR36: L'utilisateur peut lancer l'exécution des tests associés à une spec depuis MnM
FR37: L'utilisateur peut voir l'interface en layout 3 volets : Contexte (gauche) / Agents (centre) / Tests & Validation (droite)
FR38: L'utilisateur peut naviguer dans la hiérarchie du projet (Projet → Epic → Story → Tâche) et les 3 volets se synchronisent automatiquement
FR39: L'utilisateur peut redimensionner, maximiser ou masquer chaque volet
FR40: L'utilisateur peut voir la timeline d'activité dans un panneau bas persistant
FR41: Le système peut détecter les modifications de fichiers par événement (file watching) — délai défini par NFR9
FR42: Le système peut attribuer une modification de fichier à l'agent qui l'a produite
FR43: L'utilisateur peut voir l'historique Git du projet et des fichiers de contexte
FR44: L'utilisateur peut voir le contexte tel qu'il était à un commit donné (versioning de contexte via Git)
FR45: L'utilisateur peut ouvrir un projet en sélectionnant un répertoire Git local
FR46: Le système peut détecter automatiquement la structure BMAD dans un répertoire de projet (présence de `_bmad/`, `_bmad-output/`, fichiers de workflow)
FR47: Le système peut lire l'historique Git du projet (commits, branches, diffs) sans nécessiter de privilèges élevés
FR48: Le système peut parser les fichiers de workflow BMAD (YAML/Markdown) pour les restituer dans le Workflow Editor visuel

### NonFunctional Requirements

NFR1: Les mises à jour de la timeline d'activité doivent apparaître dans l'UI en moins de 500ms après l'événement source (modification fichier, output agent)
NFR2: Le file watching événementiel ne doit pas consommer plus de 5% CPU au repos (aucune activité agent)
NFR3: Le rendu du Workflow Editor visuel doit rester fluide (>30 FPS) pour des workflows jusqu'à 50 noeuds
NFR4: La drift detection sur une paire de documents doit retourner un résultat en moins de 30 secondes (depend du LLM, mais le pipeline local doit ajouter moins de 2s de latence)
NFR5: Le démarrage de l'application (cold start) doit prendre moins de 5 secondes jusqu'au cockpit affiché
NFR6: L'application ne doit pas bloquer le thread UI plus de 100ms pendant l'exécution simultanée de 3 agents avec file watching et drift detection actifs
NFR7: La consommation mémoire de MnM doit rester sous 500 MB en usage normal (cockpit + 3 agents monitorés)
NFR8: MnM doit intercepter l'output de Claude Code CLI via stdout/stderr avec une latence inférieure à 500ms sans modifier le comportement de l'agent
NFR9: Le file watching doit détecter les modifications de fichiers dans le repo du projet dans un délai de 1 seconde
NFR10: MnM doit pouvoir spawner et monitorer des process système (agents) sans privilèges élevés (pas de sudo/admin)
NFR11: Les intégrations filesystem et process doivent passer la même suite de tests sur macOS, Linux et Windows avec un taux de réussite identique

### Additional Requirements

**Architecture — Starter Template :**
- Scaffold officiel electron-vite : `npm create @quick-start/electron@latest mnm -- --template react-ts`
- Greenfield — pas de code existant. L'initialisation du projet avec cette commande sera la première story d'implémentation.

**Architecture — Infrastructure & Déploiement :**
- electron-builder + GitHub Releases (macOS .dmg, Linux .AppImage, Windows .exe)
- CI/CD : GitHub Actions — build + test sur les 3 plateformes, release automatique sur tag
- Update manuelle pour le MVP. Auto-update post-MVP.

**Architecture — Intégrations externes :**
- Claude Code CLI : subprocess wrapping, stdout parsing, interception < 500ms
- LLM (Claude API) : `LLMService` abstrait + `ClaudeLLMService` avec `@anthropic-ai/sdk`, retries 2x exponential backoff
- Git : `simple-git` pour l'API TypeScript vers git natif
- Filesystem : `chokidar` (FSEvents macOS, inotify Linux, ReadDirectoryChangesW Windows)
- YAML/XML : `js-yaml` + `fast-xml-parser` (parsers + serializers bidirectionnels)
- Markdown : `remark / unified` pour le parsing AST structurel (drift detection)

**Architecture — Persistence locale :**
- JSON files dans `.mnm/` à la racine du projet (gitignored)
- `settings.json`, `drift-cache/`, `agent-history/`, `project-state.json`
- Écriture atomique : write temp + rename
- Pas de migration de schéma au MVP

**Architecture — Logging :**
- Format : `[timestamp] [level] [source] message`
- Niveaux : debug, info, warn, error
- Pas de service de monitoring externe au MVP

**Architecture — Sécurité :**
- Process isolation : renderer n'a pas accès à Node.js directement
- IPC via contextBridge + preload scripts uniquement
- Pas de privilèges élevés
- Clé API dans `.mnm/settings.json`

**Architecture — Décisions techniques clés :**
- Event Bus : EventEmitter (main) + mitt (renderer)
- IPC : Hybride invoke + streaming
- State management : Zustand (un store par feature)
- Error handling : `AppError` normalisé + `AsyncState<T>` discriminated union + Error Boundaries par feature
- TypeScript strict, `any` interdit, named exports only
- Imports absolus avec alias (`@main/`, `@renderer/`, `@shared/`)
- Séquence d'implémentation : scaffold → IPC → event bus → shell layout → file watcher + git → agent harness → timeline + dashboard → drift detection → workflow editor → packaging + CI/CD

**Architecture — GAP Resolutions :**
- GAP-1 (FR4) : Chat Segmenter + AgentChatViewer
- GAP-2 (FR23) : Story Parser + StoriesProgress
- GAP-3 (FR31) : YAML/XML Serializers + workflow:save IPC
- GAP-4 (FR32) : Workflow Execution Tracking via events
- GAP-5 (FR36) : Test Runner Service + spec-mapper

**UX — Responsive :**
- Desktop-only (Electron), 4 breakpoints (full >= 1440, compact 1280-1439, narrow 1024-1279, min < 1024 non supporté)
- Desktop-first, panes redimensionnables avec contraintes min/max
- CSS Container Queries pour composants adaptatifs

**UX — Accessibilité :**
- WCAG 2.1 AA
- Keyboard-first, skip links, focus visible (2px ring)
- ARIA natif via Radix UI, `aria-live` pour updates temps réel
- `prefers-reduced-motion` respecté
- eslint-plugin-jsx-a11y + @axe-core/react + tests manuels VoiceOver

**UX — Interaction patterns :**
- Glance-first / Progressive disclosure
- Max 2 clics du cockpit à la résolution
- Direct manipulation (drag & drop contexte, workflow nodes, pane resize)
- Command palette `Cmd+K`
- Animations : fade 200ms, slide-in 150ms, number animation 300ms, toutes désactivées si reduced motion

**UX — Components custom :**
- 10 composants MnM : HealthIndicator, AgentCard, AgentProgressBar, AgentChatViewer, TimelineBar, DriftAlert, DriftDiffView, WorkflowCanvas, ContextFileCard, StoriesProgress
- shadcn/ui + Tailwind CSS 4 comme design system
- Dark mode par défaut
- Inter + JetBrains Mono, base 14px, spacing 4px unit

**UX — Error handling :**
- Jamais d'écran blanc : empty states, skeletons, messages d'erreur inline
- Toast system : bottom-right, auto-dismiss 3s (success), persistent (errors)
- Max 3 toasts empilés
- `AppError` normalisé côté renderer via `AsyncState<T>`

### FR Coverage Map

FR1: Epic 2 — Liste agents actifs avec statut temps réel
FR2: Epic 2 — Indicateur de santé agent (vert/orange/rouge)
FR3: Epic 2 — Timeline d'activité agent (frise chronologique)
FR4: Epic 2 — Navigation checkpoint timeline → chat agent
FR5: Epic 2 — Détection agent bloqué + accès 1 clic
FR6: Epic 2 — Lancer un agent sur une tâche
FR7: Epic 2 — Arrêter un agent en cours
FR8: Epic 2 — Progression agent (étapes complétées/restantes)
FR9: Epic 3 — Liste fichiers de contexte par agent
FR10: Epic 3 — Ajouter contexte à un agent (drag & drop)
FR11: Epic 3 — Retirer contexte d'un agent
FR12: Epic 3 — Context cards avec badges agent
FR13: Epic 3 — Notification modification fichier contexte
FR14: Epic 4 — Drift detection automatique cross-document
FR15: Epic 4 — Drift detection par événement (file change)
FR16: Epic 4 — Drift detection à la demande
FR17: Epic 4 — Alerte actionnable avec diff exact
FR18: Epic 4 — Résolution drift depuis l'alerte
FR19: Epic 4 — Score de confiance par drift
FR20: Epic 4 — Configuration seuil de confiance
FR21: Epic 5 — Dashboard cockpit à l'ouverture
FR22: Epic 5 — Agents actifs + alertes drift dans cockpit
FR23: Epic 5 — Stories en cours avec avancement
FR24: Epic 5 — Navigation cockpit → agent/alerte/story en 1 clic
FR25: Epic 6 — Workflow BMAD en diagramme visuel
FR26: Epic 6 — Ordre d'exécution + branches parallèles
FR27: Epic 6 — Ajouter un noeud workflow
FR28: Epic 6 — Supprimer un noeud workflow
FR29: Epic 6 — Réorganiser connexions entre noeuds
FR30: Epic 6 — Configurer propriétés d'un noeud
FR31: Epic 6 — Sync modifications visuelles → fichier source
FR32: Epic 6 — Exécution workflow en temps réel
FR33: Epic 7 — Tests en miroir hiérarchie specs
FR34: Epic 7 — Statut test (pass/fail/pending)
FR35: Epic 7 — Navigation spec ↔ tests
FR36: Epic 7 — Lancer tests depuis MnM
FR37: Epic 1 — Layout 3 volets
FR38: Epic 1 — Navigation hiérarchique synchronisée
FR39: Epic 1 — Redimensionner/maximiser/masquer volets
FR40: Epic 1 — Timeline panneau bas persistant
FR41: Epic 3 — File watching événementiel
FR42: Epic 3 — Attribution modification → agent
FR43: Epic 3 — Historique Git projet
FR44: Epic 3 — Versioning contexte via Git
FR45: Epic 1 — Ouvrir projet via répertoire Git
FR46: Epic 1 — Détection structure BMAD
FR47: Epic 3 — Lecture historique Git
FR48: Epic 6 — Parsing fichiers workflow BMAD

## Epic List

### Epic 1 : Application Foundation & Project Shell
L'utilisateur peut ouvrir MnM, sélectionner un projet Git, et voir le layout 3 volets avec navigation hiérarchique synchronisée.
**FRs couvertes :** FR37, FR38, FR39, FR40, FR45, FR46
**Notes :** Scaffold electron-vite, IPC bridge, event bus, shell layout, sidebar navigation, détection BMAD.

### Epic 2 : Agent Monitoring & Supervision
L'utilisateur peut voir tous les agents actifs avec leur santé, suivre leur activité via la timeline, naviguer dans leur chat, et lancer/arrêter des agents.
**FRs couvertes :** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8
**Notes :** Agent harness (spawn/monitor Claude Code), stdout parsing, chat segmenter, timeline. Parcours de Tom.

### Epic 3 : Context Visibility & File Intelligence
L'utilisateur peut voir les fichiers de contexte de chaque agent, ajouter/retirer du contexte par drag & drop, être notifié des modifications, et consulter l'historique Git.
**FRs couvertes :** FR9, FR10, FR11, FR12, FR13, FR41, FR42, FR43, FR44, FR47
**Notes :** File watcher (chokidar), git integration (simple-git), context cards, drag & drop, versioning de contexte.

### Epic 4 : Drift Detection & Document Alignment
L'utilisateur peut être alerté automatiquement quand des documents dérivent, voir les diffs exacts, et résoudre les drifts depuis l'alerte.
**FRs couvertes :** FR14, FR15, FR16, FR17, FR18, FR19, FR20
**Notes :** LLM integration (Claude API), markdown parsing (remark/unified), drift engine, confidence scoring. Parcours de Gabri.

### Epic 5 : Dashboard Cockpit & Project Overview
L'utilisateur peut voir d'un coup d'oeil la santé du projet, les agents actifs, les stories en cours, et naviguer vers n'importe quel élément en un clic.
**FRs couvertes :** FR21, FR22, FR23, FR24
**Notes :** Story parser BMAD, cockpit dashboard, "Cockpit Glance" experience (< 5 sec).

### Epic 6 : Workflow Visualization & Editing
L'utilisateur peut voir les workflows BMAD sous forme de diagramme visuel, les éditer graphiquement, et suivre leur exécution en temps réel.
**FRs couvertes :** FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR48
**Notes :** React Flow, YAML/XML parsers + serializers, workflow execution tracking. Parcours de Nikou.

### Epic 7 : Test Visualization & Execution
L'utilisateur peut voir les tests en miroir de la hiérarchie des specs, lancer les tests depuis MnM, et naviguer entre specs et tests.
**FRs couvertes :** FR33, FR34, FR35, FR36
**Notes :** Test runner service, spec-mapper, test hierarchy view.

### Epic 8 : Packaging, CI/CD & Cross-Platform
L'utilisateur peut installer MnM comme une app desktop native sur macOS, Linux et Windows.
**FRs couvertes :** Adresse NFR10, NFR11 + requirements architecture
**Notes :** electron-builder, GitHub Actions, release automatique sur tag.

---

## Epic 1 : Application Foundation & Project Shell

L'utilisateur peut ouvrir MnM, sélectionner un projet Git, et voir le layout 3 volets avec navigation hiérarchique synchronisée.

### Story 1.1 : Project Scaffold, IPC Bridge & Event Bus

As a **developer**,
I want **the MnM Electron app initialized with typed IPC channels and event bus**,
So that **I have a solid foundation for building all features**.

**Acceptance Criteria:**

**Given** le scaffold electron-vite est exécuté (`npm create @quick-start/electron@latest mnm -- --template react-ts`)
**When** je lance `npm run dev`
**Then** l'app Electron s'ouvre avec HMR fonctionnel sur le renderer
**And** TypeScript est en mode `strict: true` avec `any` interdit

**Given** les fichiers de types IPC existent (`src/shared/ipc-channels.ts`, `src/shared/events.ts`)
**When** le renderer appelle `window.electronAPI.invoke(channel, args)`
**Then** l'appel est routé via le preload script typé vers le main process
**And** seuls les channels déclarés dans `IpcInvokeChannels` sont exposés

**Given** l'event bus est configuré
**When** un événement est émis dans le main process (EventEmitter)
**Then** il peut être relayé au renderer via IPC stream
**And** le renderer écoute via mitt avec les types de `RendererEvents`

**Given** les alias d'import sont configurés
**When** un fichier importe `@shared/events`
**Then** l'import se résout correctement (`@main/`, `@renderer/`, `@shared/`)

### Story 1.2 : Three-Pane Resizable Layout with Timeline Bar

As a **user**,
I want **to see the 3-pane layout (Contexte / Agents / Tests) with a bottom timeline bar**,
So that **I have the cockpit structure for supervising my project**.

**Acceptance Criteria:**

**Given** l'app est ouverte
**When** je vois l'interface principale
**Then** 3 volets sont visibles : Contexte (gauche, 25%), Agents (centre, 50%), Tests (droite, 25%)
**And** une timeline bar est visible en bas (120px)

**Given** les volets sont affichés
**When** je drag le séparateur entre deux volets
**Then** les volets se redimensionnent en respectant les contraintes min/max (Contexte: 200px-40%, Agents: 400px-70%, Tests: 200px-40%)

**Given** un volet est visible
**When** je double-clique sur son header
**Then** le volet se maximise (occupe tout l'espace horizontal)
**And** un second double-clic restaure la taille précédente

**Given** l'app est affichée sur un écran < 1024px
**When** la fenêtre est en dessous du breakpoint minimum
**Then** un overlay "Résolution insuffisante" s'affiche

**Given** l'app est entre 1024-1279px (narrow)
**When** le breakpoint narrow est actif
**Then** seuls 2 volets sont visibles avec un toggle pour le 3ème

### Story 1.3 : Open Project & BMAD Detection

As a **user**,
I want **to open a Git project directory and have MnM detect the BMAD structure**,
So that **my project is loaded and ready for supervision**.

**Acceptance Criteria:**

**Given** aucun projet n'est ouvert
**When** je lance MnM
**Then** je vois l'écran "Ouvrir un projet" avec un bouton de sélection de répertoire

**Given** je clique sur "Ouvrir un projet"
**When** je sélectionne un répertoire Git contenant `_bmad/` et `_bmad-output/`
**Then** MnM charge le projet et affiche son nom dans le header
**And** la structure BMAD est détectée et la sidebar affiche la hiérarchie

**Given** je sélectionne un répertoire sans `.git`
**When** MnM tente de charger
**Then** un message d'erreur inline s'affiche : "Ce répertoire n'est pas un repo Git"

**Given** je sélectionne un repo Git sans `_bmad/`
**When** MnM charge le projet
**Then** le projet s'ouvre mais un avertissement s'affiche : "Structure BMAD non détectée"

**Given** un projet est chargé
**When** les fichiers `.mnm/` n'existent pas encore
**Then** MnM crée le répertoire `.mnm/` avec `settings.json` et `project-state.json` par défaut

### Story 1.4 : Hierarchical Navigation & Pane Synchronization

As a **user**,
I want **to navigate the project hierarchy (Projet → Epic → Story → Tâche) and have all 3 panes synchronize**,
So that **I always see the context, agents, and tests relevant to my current focus**.

**Acceptance Criteria:**

**Given** un projet BMAD est chargé
**When** je vois la sidebar
**Then** la hiérarchie est affichée : Projet → Epics → Stories → Tâches (parsées depuis les fichiers BMAD)

**Given** je clique sur une Story dans la sidebar
**When** la navigation se met à jour
**Then** le volet Contexte affiche les fichiers de contexte liés à cette story
**And** le volet Agents affiche les agents travaillant sur cette story
**And** le volet Tests affiche les tests associés à cette story
**And** le breadcrumb en haut affiche "Projet > Epic X > Story Y"

**Given** je suis au niveau Story
**When** je clique sur le breadcrumb "Epic X"
**Then** je remonte au niveau Epic et les 3 volets se synchronisent à ce niveau

**Given** je navigue dans la hiérarchie
**When** je presse `Esc`
**Then** je remonte d'un niveau dans la hiérarchie

---

## Epic 2 : Agent Monitoring & Supervision

L'utilisateur peut voir tous les agents actifs avec leur santé, suivre leur activité via la timeline, naviguer dans leur chat, et lancer/arrêter des agents.

### Story 2.1 : Agent Harness — Lancer & Arrêter des Agents

As a **user**,
I want **to launch a Claude Code agent on a task and stop it when needed**,
So that **I can control agent execution directly from MnM**.

**Acceptance Criteria:**

**Given** un projet est ouvert
**When** je clique sur "Lancer un agent" et je spécifie une tâche
**Then** MnM spawne un process Claude Code CLI en subprocess
**And** le stdout/stderr est intercepté en temps réel (< 500ms, NFR8)
**And** l'agent apparaît dans la liste des agents actifs

**Given** un agent est en cours d'exécution
**When** je clique sur "Arrêter" sur cet agent
**Then** le process est terminé proprement (SIGTERM puis SIGKILL après timeout)
**And** le statut passe à "terminé"

**Given** un agent est lancé
**When** le process se termine naturellement
**Then** le statut passe à "terminé" automatiquement
**And** le timestamp de fin est enregistré

**Given** un agent est lancé
**When** le process crash (exit code non-zero)
**Then** le statut passe à "bloqué" avec l'indicateur rouge
**And** le dernier output stderr est accessible

### Story 2.2 : Liste des Agents avec Indicateurs de Santé

As a **user**,
I want **to see all active agents with real-time health indicators**,
So that **I know at a glance which agents are healthy, struggling, or blocked**.

**Acceptance Criteria:**

**Given** des agents sont actifs
**When** je regarde le volet Agents
**Then** je vois une liste d'`AgentCard` avec pour chacun : nom, `HealthIndicator` (vert/orange/rouge/gris), tâche en cours
**And** la liste se met à jour en continu (< 500ms, NFR1)

**Given** un agent fonctionne normalement
**When** il produit de l'output régulièrement
**Then** son `HealthIndicator` est vert

**Given** un agent n'a pas produit d'output depuis un seuil configurable
**When** le timeout est atteint
**Then** son `HealthIndicator` passe à orange (stalled)

**Given** un agent a crashé ou est bloqué
**When** son process retourne une erreur
**Then** son `HealthIndicator` passe à rouge
**And** le badge est visible sans navigation depuis la vue principale (FR2)

**Given** un agent est terminé
**When** il n'est plus actif
**Then** son `HealthIndicator` est gris

### Story 2.3 : Progression Agent & Détection de Blocage

As a **user**,
I want **to see agent progress as completed/remaining steps and access blocage points in one click**,
So that **I can quickly identify and unblock stuck agents**.

**Acceptance Criteria:**

**Given** un agent est actif
**When** je regarde son `AgentCard`
**Then** je vois une `AgentProgressBar` avec le ratio étapes complétées / restantes
**And** les étapes sont extraites des checkpoints ou todolist de l'agent (FR8)

**Given** un agent est bloqué (indicateur rouge)
**When** je regarde la liste des agents
**Then** le blocage est visuellement mis en évidence (badge "Bloqué" + rouge)
**And** je peux accéder au point de blocage en un clic (FR5)

**Given** je clique sur un agent bloqué
**When** la vue détail s'ouvre
**Then** je suis positionné directement sur le message/output qui a causé le blocage

### Story 2.4 : Timeline d'Activité des Agents

As a **user**,
I want **to see a visual activity timeline for all agents as a horizontal bar with checkpoints**,
So that **I can follow agent activity over time without reading logs**.

**Acceptance Criteria:**

**Given** des agents sont actifs
**When** je regarde la `TimelineBar` en bas de l'écran
**Then** je vois une frise chronologique horizontale avec des points colorés par agent
**And** chaque point représente un checkpoint ou événement significatif

**Given** la timeline affiche les activités
**When** un agent produit un nouveau checkpoint
**Then** un nouveau point apparaît sur la timeline avec animation (slide-in 150ms)
**And** un label court décrit l'événement

**Given** la timeline est affichée
**When** je survole un point
**Then** un tooltip affiche le détail de l'événement (timestamp, agent, description)

**Given** la timeline a du contenu
**When** je drag horizontalement sur la timeline
**Then** je peux naviguer dans le temps (temporal scrubbing)

### Story 2.5 : Chat Viewer Agent avec Navigation Timeline

As a **user**,
I want **to click a timeline checkpoint and navigate to the exact moment in the agent's chat**,
So that **I can understand what an agent was doing at any point in time**.

**Acceptance Criteria:**

**Given** la timeline affiche des checkpoints
**When** je clique sur un checkpoint
**Then** l'`AgentChatViewer` s'ouvre et scroll automatiquement au message correspondant (FR4)
**And** le message est mis en surbrillance

**Given** le chat viewer est ouvert
**When** je lis les messages
**Then** chaque message affiche : rôle (user/assistant/system), contenu, timestamp
**And** les checkpoints sont visuellement séparés par des marqueurs

**Given** un agent est actif
**When** de nouveaux messages arrivent
**Then** le chat viewer se met à jour en temps réel via `stream:agent-chat`
**And** `aria-live="polite"` annonce les nouveaux messages

**Given** je suis dans le chat viewer
**When** je clique sur un checkpoint dans la timeline
**Then** les 3 volets se synchronisent au contexte de ce moment (FR38)

---

## Epic 3 : Context Visibility & File Intelligence

L'utilisateur peut voir les fichiers de contexte de chaque agent, ajouter/retirer du contexte par drag & drop, être notifié des modifications, et consulter l'historique Git.

### Story 3.1 : File Watcher & Git Integration

As a **user**,
I want **MnM to detect file changes in my project in real-time and read Git history**,
So that **the system is always aware of what's happening in my codebase**.

**Acceptance Criteria:**

**Given** un projet est ouvert
**When** un fichier est modifié dans le repo
**Then** MnM détecte la modification en < 1 seconde (NFR9) via chokidar
**And** un événement `stream:file-change` est émis vers le renderer

**Given** le file watcher est actif
**When** aucun agent ne tourne et aucun fichier ne change
**Then** la consommation CPU du watcher reste < 5% (NFR2)

**Given** un projet Git est ouvert
**When** je demande l'historique Git
**Then** MnM lit les commits, branches et diffs via `simple-git` (FR47)
**And** aucun privilège élevé n'est requis (NFR10)

**Given** le watcher détecte une modification
**When** un agent est actif et a modifié ce fichier
**Then** la modification est attribuée à l'agent correspondant (FR42) via corrélation process → fichier

### Story 3.2 : Liste des Fichiers de Contexte par Agent

As a **user**,
I want **to see which context files each agent is using, displayed as visual cards with agent badges**,
So that **I know exactly what each agent "sees"**.

**Acceptance Criteria:**

**Given** un agent est actif et consulte des fichiers
**When** je regarde le volet Contexte
**Then** je vois des `ContextFileCard` pour chaque fichier : icône type, nom, chemin relatif
**And** chaque card affiche des badges indiquant quel(s) agent(s) utilisent ce fichier (FR12)

**Given** la liste de contexte est affichée
**When** un agent commence à consulter un nouveau fichier
**Then** la liste se met à jour en continu (< 500ms, NFR1) (FR9)
**And** la nouvelle card apparaît avec animation slide-in

**Given** je suis au niveau Story dans la navigation
**When** les volets sont synchronisés
**Then** le volet Contexte filtre les fichiers pertinents pour cette story

**Given** un fichier de contexte est modifié
**When** la modification est détectée par le file watcher
**Then** la card du fichier affiche un badge "Modifié" avec un indicateur visuel

### Story 3.3 : Drag & Drop de Contexte vers un Agent

As a **user**,
I want **to add or remove context files from an agent via drag & drop or selection**,
So that **I can control what context an agent works with**.

**Acceptance Criteria:**

**Given** un fichier est visible dans le volet Contexte
**When** je drag la `ContextFileCard` vers un `AgentCard` dans le volet Agents
**Then** le fichier est ajouté au contexte de cet agent (FR10)
**And** la card affiche le feedback visuel pendant le drag (état "dragging")
**And** l'`AgentCard` cible montre un drop zone highlight

**Given** un fichier est dans le contexte d'un agent
**When** je clique sur le bouton "Retirer" de la card (ou via clic droit)
**Then** le fichier est retiré du contexte de l'agent (FR11)
**And** la card disparaît avec fade-out 200ms

**Given** je veux ajouter un fichier qui n'est pas visible
**When** j'utilise la sélection de fichier (bouton "Ajouter contexte")
**Then** un file picker s'ouvre avec les fichiers du projet
**And** le fichier sélectionné est ajouté au contexte de l'agent

### Story 3.4 : Notifications de Modification de Fichiers de Contexte

As a **user**,
I want **to be notified when an agent modifies a context file**,
So that **I'm aware of changes that might affect other agents or documents**.

**Acceptance Criteria:**

**Given** un agent modifie un fichier de contexte
**When** le file watcher détecte la modification
**Then** je reçois une notification toast (bottom-right, auto-dismiss 3s) (FR13)
**And** la notification indique : quel agent, quel fichier, quel type de modification

**Given** un fichier de contexte partagé entre 2 agents est modifié
**When** la modification est détectée
**Then** les badges des deux agents sont mis à jour sur la `ContextFileCard`
**And** la notification mentionne l'impact potentiel sur l'autre agent

**Given** plusieurs fichiers sont modifiés rapidement
**When** les notifications s'accumulent
**Then** max 3 toasts sont empilés simultanément
**And** les notifications suivantes remplacent les plus anciennes

### Story 3.5 : Historique Git & Versioning de Contexte

As a **user**,
I want **to see Git history for project files and view context as it was at a given commit**,
So that **I can understand how context evolved over time**.

**Acceptance Criteria:**

**Given** un projet Git est ouvert
**When** je sélectionne un fichier de contexte
**Then** je peux voir son historique Git : liste des commits avec date, auteur, message (FR43)

**Given** l'historique d'un fichier est affiché
**When** je clique sur un commit
**Then** je vois le contenu du fichier tel qu'il était à ce commit (FR44)
**And** la vue utilise `git:show-file` IPC pour récupérer la version

**Given** je suis sur une vue historique d'un fichier
**When** je compare avec la version actuelle
**Then** un diff visuel montre les changements entre les deux versions

---

## Epic 4 : Drift Detection & Document Alignment

L'utilisateur peut être alerté automatiquement quand des documents dérivent, voir les diffs exacts, et résoudre les drifts depuis l'alerte.

### Story 4.1 : LLM Service & Drift Detection Engine

As a **user**,
I want **MnM to automatically detect inconsistencies between documents in the hierarchy (Brief → PRD → Architecture → Stories → Code)**,
So that **silent drift between my specs is caught before it propagates**.

**Acceptance Criteria:**

**Given** le projet est ouvert et une clé API Claude est configurée dans `.mnm/settings.json`
**When** le drift engine s'initialise
**Then** le `LLMService` abstrait est instancié via `ClaudeLLMService` avec `@anthropic-ai/sdk`
**And** les retries sont configurés (2x exponential backoff)

**Given** le drift engine est actif
**When** il analyse une paire de documents de la hiérarchie
**Then** il extrait les concepts clés via parsing Markdown (remark/unified)
**And** compare les concepts entre les deux niveaux pour détecter les incohérences (FR14)
**And** le résultat est retourné en < 30 secondes (NFR4, dont < 2s de latence pipeline local)

**Given** les résultats de drift sont calculés
**When** l'analyse est terminée
**Then** chaque drift détecté reçoit un score de confiance (0-100) (FR19)
**And** les résultats sont mis en cache dans `.mnm/drift-cache/`

**Given** une clé API n'est pas configurée
**When** le drift engine tente de s'initialiser
**Then** un message d'erreur inline s'affiche : "Clé API Claude requise pour la drift detection"
**And** un lien vers les settings est proposé

### Story 4.2 : Drift Detection par Événement

As a **user**,
I want **drift detection to trigger automatically when a context file is modified**,
So that **I don't have to remember to check for drift manually**.

**Acceptance Criteria:**

**Given** le file watcher détecte une modification sur un fichier de la hiérarchie documentaire
**When** le fichier modifié fait partie d'une paire connue (ex: PRD ↔ Architecture)
**Then** la drift detection est déclenchée automatiquement sur les paires impactées (FR15)
**And** un indicateur "Analyse en cours..." apparaît

**Given** la drift detection par événement est déclenchée
**When** l'analyse détecte un drift avec un score de confiance au-dessus du seuil configuré
**Then** une alerte drift est émise via `stream:drift-alert`
**And** le badge drift dans le header/cockpit est incrémenté

**Given** la drift detection par événement est déclenchée
**When** l'analyse ne détecte aucun drift (ou score sous le seuil)
**Then** aucune alerte n'est émise
**And** le cache est mis à jour silencieusement

### Story 4.3 : Drift Check Manuel & Configuration du Seuil

As a **user**,
I want **to trigger a drift check on demand and configure the confidence threshold**,
So that **I can control when and how sensitive drift detection is**.

**Acceptance Criteria:**

**Given** un projet est ouvert
**When** je clique sur "Vérifier le drift" (ou `Cmd+Shift+D`)
**Then** je peux sélectionner un ensemble de documents à vérifier (FR16)
**And** la drift detection est lancée sur les paires sélectionnées

**Given** la vérification manuelle est en cours
**When** l'analyse progresse
**Then** une progress bar + "Analyse en cours..." s'affiche
**And** les résultats apparaissent au fur et à mesure

**Given** je veux configurer le seuil de confiance
**When** j'ouvre les settings (`.mnm/settings.json`)
**Then** je peux définir le seuil (0-100) en dessous duquel les alertes ne sont pas surfacées (FR20)
**And** le changement prend effet immédiatement sans restart

### Story 4.4 : Alerte Drift & Vue Diff

As a **user**,
I want **to see actionable drift alerts with the exact diff between conflicting documents**,
So that **I understand precisely what has drifted and where**.

**Acceptance Criteria:**

**Given** un drift est détecté au-dessus du seuil de confiance
**When** l'alerte apparaît
**Then** je vois une `DriftAlert` card avec : icône, titre (paire de documents), résumé du drift, score de confiance (FR17)
**And** 3 boutons d'action : "Voir", "Corriger", "Ignorer"

**Given** je clique sur "Voir" dans une `DriftAlert`
**When** la vue détail s'ouvre
**Then** je vois un `DriftDiffView` en split view : document source (gauche) vs document dérivé (droite)
**And** les différences sont mises en surbrillance (FR17)

**Given** une alerte drift est nouvelle
**When** elle apparaît pour la première fois
**Then** elle a un badge "Nouveau" et est visuellement distincte
**And** `aria-live="polite"` annonce la nouvelle alerte

**Given** plusieurs drifts sont détectés
**When** je regarde la liste des alertes
**Then** elles sont triées par score de confiance (plus haut en premier)

### Story 4.5 : Résolution de Drift

As a **user**,
I want **to resolve a drift directly from the alert by choosing which document to correct or ignoring it**,
So that **I can maintain document alignment without leaving MnM**.

**Acceptance Criteria:**

**Given** je suis dans la vue détail d'un drift
**When** je clique sur "Corriger le document source"
**Then** MnM ouvre le document source en mode lecture avec les sections en drift mises en évidence
**And** un bouton permet de demander à un agent de corriger le document (FR18)

**Given** je suis dans la vue détail d'un drift
**When** je clique sur "Corriger le document dérivé"
**Then** MnM ouvre le document dérivé en mode lecture avec les sections en drift mises en évidence
**And** un bouton permet de demander à un agent de corriger le document (FR18)

**Given** je suis dans la vue détail d'un drift
**When** je clique sur "Ignorer"
**Then** l'alerte est marquée comme résolue (ignorée) et disparaît avec fade-out (FR18)
**And** le drift est enregistré comme ignoré dans le cache (ne réapparaît pas sauf changement)

**Given** un drift est résolu (corrigé ou ignoré)
**When** le compteur de drifts se met à jour
**Then** le badge dans le header/cockpit est décrémenté
**And** la `DriftAlert` disparaît de la liste

---

## Epic 5 : Dashboard Cockpit & Project Overview

L'utilisateur peut voir d'un coup d'oeil la santé du projet, les agents actifs, les stories en cours, et naviguer vers n'importe quel élément en un clic.

### Story 5.1 : Cockpit Dashboard Layout

As a **user**,
I want **to see a cockpit dashboard when I open MnM showing the overall health of my project**,
So that **I understand project state at a glance without clicking anything**.

**Acceptance Criteria:**

**Given** un projet est ouvert
**When** MnM s'ouvre (ou je clique sur le niveau "Projet" dans la sidebar)
**Then** le cockpit dashboard s'affiche dans le volet central (FR21)
**And** le dashboard est visible en < 5 secondes après le cold start (NFR5)

**Given** le cockpit est affiché
**When** je regarde la vue d'ensemble
**Then** je vois : un `ProjectHealthSummary` avec indicateur global (vert/orange/rouge), le nombre d'agents actifs, le nombre d'alertes drift en cours, la progression des stories

**Given** les données du projet ne sont pas encore chargées
**When** le cockpit est en cours de chargement
**Then** des skeletons animés s'affichent à la place des widgets
**And** jamais d'écran blanc

### Story 5.2 : Agents Actifs & Alertes Drift dans le Cockpit

As a **user**,
I want **to see active agents with their status and current drift alerts directly in the cockpit**,
So that **I know immediately if something needs my attention**.

**Acceptance Criteria:**

**Given** le cockpit est affiché
**When** des agents sont actifs
**Then** je vois un widget "Agents" avec : nombre d'agents par statut (actif/bloqué/terminé), les `HealthIndicator` des agents actifs, le nom et la tâche de chaque agent (FR22)

**Given** le cockpit est affiché
**When** des alertes drift sont en cours
**Then** je vois un widget "Drift" avec : nombre total d'alertes, les alertes triées par confiance, un résumé de chaque drift (paire de documents + score) (FR22)

**Given** les agents ou les drifts changent d'état
**When** une mise à jour arrive
**Then** les widgets se mettent à jour en temps réel (badges fade 200ms, compteurs animés 300ms)

**Given** aucun agent n'est actif
**When** je regarde le widget Agents
**Then** un empty state s'affiche : "Aucun agent actif" + bouton "Lancer un agent"

**Given** aucun drift n'est détecté
**When** je regarde le widget Drift
**Then** un empty state s'affiche : indicateur vert + "Aucun drift détecté"

### Story 5.3 : Stories Progress Widget

As a **user**,
I want **to see stories in progress with their completion ratio in the cockpit**,
So that **I know where the project stands without digging into files**.

**Acceptance Criteria:**

**Given** le cockpit est affiché et un projet BMAD est chargé
**When** des stories existent dans les fichiers Markdown BMAD
**Then** le widget `StoriesProgress` affiche : liste des stories en cours, mini progress bar par story, ratio tâches complétées / totales (FR23)
**And** les tâches sont parsées depuis les checkboxes Markdown (`- [ ]` / `- [x]`) via `story-parser.ts`

**Given** une story a toutes ses tâches complétées
**When** le ratio atteint 100%
**Then** la progress bar passe en vert solide et la story est marquée "Done"

**Given** les fichiers de stories sont modifiés
**When** le file watcher détecte un changement
**Then** le widget se met à jour automatiquement (ratios recalculés)

### Story 5.4 : Navigation One-Click depuis le Cockpit

As a **user**,
I want **to navigate from any cockpit element to its detail view in one click**,
So that **I can go from overview to action instantly**.

**Acceptance Criteria:**

**Given** le cockpit affiche un agent
**When** je clique sur un agent dans le widget Agents
**Then** la navigation passe au niveau de cet agent : le volet Agents affiche son `AgentCard` en focus, le volet Contexte affiche ses fichiers, le volet Tests affiche ses tests (FR24)

**Given** le cockpit affiche une alerte drift
**When** je clique sur une alerte dans le widget Drift
**Then** la `DriftDiffView` s'ouvre directement avec les documents concernés (FR24)

**Given** le cockpit affiche une story
**When** je clique sur une story dans le widget Stories
**Then** la navigation passe au niveau Story dans la sidebar et les 3 volets se synchronisent (FR24)

**Given** je suis dans une vue détail (agent, drift, story)
**When** je clique sur "Projet" dans le breadcrumb (ou `Esc` au niveau Epic)
**Then** je reviens au cockpit dashboard

---

## Epic 6 : Workflow Visualization & Editing

L'utilisateur peut voir les workflows BMAD sous forme de diagramme visuel, les éditer graphiquement, et suivre leur exécution en temps réel.

### Story 6.1 : BMAD Workflow Parser

As a **user**,
I want **MnM to parse my BMAD workflow files (YAML/Markdown) into a graph structure**,
So that **they can be visualized and manipulated as diagrams**.

**Acceptance Criteria:**

**Given** un projet BMAD est ouvert
**When** MnM scanne le répertoire `_bmad/`
**Then** tous les fichiers workflow (`.yaml`, `.md` contenant des workflow definitions) sont détectés et parsés (FR48)
**And** chaque workflow est transformé en une structure graph (noeuds + connexions)

**Given** un fichier workflow YAML est parsé
**When** le parser (`js-yaml`) traite le fichier
**Then** chaque étape devient un noeud avec : id, titre, rôle, instructions
**And** les transitions entre étapes deviennent des connexions directionnelles

**Given** un fichier workflow Markdown est parsé
**When** le parser traite la structure des headers et des steps
**Then** la hiérarchie est transformée en noeuds séquentiels avec branchements si applicable

**Given** un fichier workflow est malformé
**When** le parser rencontre une erreur
**Then** un message d'erreur inline s'affiche avec le fichier et la ligne concernée
**And** les workflows valides restent accessibles

### Story 6.2 : Workflow Diagram Viewer

As a **user**,
I want **to see a BMAD workflow as a visual flow diagram with nodes and connections**,
So that **I can understand workflow structure without reading YAML/XML**.

**Acceptance Criteria:**

**Given** un workflow est parsé
**When** je sélectionne un workflow dans la navigation
**Then** le `WorkflowCanvas` (React Flow) affiche le diagramme : noeuds positionnés, connexions fléchées entre les étapes (FR25)

**Given** le diagramme est affiché
**When** je regarde les noeuds
**Then** chaque noeud affiche : titre de l'étape, rôle/agent assigné, icône de type
**And** l'ordre d'exécution est clair visuellement (top-to-bottom ou left-to-right)

**Given** un workflow contient des branches parallèles
**When** le diagramme les rend
**Then** les branches parallèles sont affichées côte à côte avec des points de fork/join (FR26)

**Given** le diagramme est affiché
**When** je zoom, pan, ou sélectionne un noeud
**Then** les interactions sont fluides (> 30 FPS, NFR3) pour des workflows jusqu'à 50 noeuds

**Given** je survole un noeud
**When** le tooltip s'affiche
**Then** je vois les détails complets : instructions, fichier source, ligne

### Story 6.3 : Édition de Noeuds Workflow

As a **user**,
I want **to add, remove, and reorganize workflow nodes and connections visually**,
So that **I can edit workflows graphiquement sans toucher au YAML/XML**.

**Acceptance Criteria:**

**Given** le workflow est en mode édition
**When** je clique sur une connexion entre deux noeuds
**Then** un nouveau noeud est inséré à cet emplacement avec un formulaire de configuration (FR27)
**And** les connexions se réorganisent automatiquement

**Given** un noeud existe dans le workflow
**When** je le sélectionne et clique "Supprimer" (ou touche Delete)
**Then** une Dialog de confirmation s'affiche (action destructive)
**And** après confirmation, le noeud est supprimé et les connexions sont reconnectées (FR28)

**Given** des noeuds existent dans le workflow
**When** je drag une connexion d'un noeud source vers un noeud cible
**Then** les connexions sont réorganisées selon le nouveau lien (FR29)

**Given** je sélectionne un noeud
**When** j'ouvre son panneau de propriétés
**Then** je peux modifier : titre, rôle, instructions, conditions de branchement (FR30)
**And** les modifications sont reflétées en temps réel dans le diagramme

### Story 6.4 : Synchronisation Workflow → Fichier Source

As a **user**,
I want **visual workflow edits to be saved back to the source file (YAML/XML)**,
So that **my changes are persistent and the source of truth is always the file**.

**Acceptance Criteria:**

**Given** j'ai modifié un workflow visuellement
**When** je clique "Sauvegarder" (ou `Cmd+S`)
**Then** le graph est sérialisé vers le format source du fichier (YAML via `yaml-serializer.ts` ou XML via `xml-serializer.ts`) (FR31)
**And** le fichier est écrit de manière atomique (write temp + rename)

**Given** le fichier source est en YAML
**When** le serializer écrit le fichier
**Then** le format YAML est préservé (indentation, commentaires si possible)
**And** le fichier résultant est valide et parsable

**Given** le fichier source est en XML
**When** le serializer écrit le fichier
**Then** le format XML est préservé avec la structure correcte
**And** le fichier résultant est valide

**Given** j'ai des modifications non sauvegardées
**When** je tente de naviguer ailleurs
**Then** un avertissement s'affiche : "Modifications non sauvegardées. Sauvegarder ?"

### Story 6.5 : Suivi d'Exécution Workflow en Temps Réel

As a **user**,
I want **to see workflow execution in real-time with the active step highlighted**,
So that **I can follow where a workflow is at any moment**.

**Acceptance Criteria:**

**Given** un workflow est en cours d'exécution par un agent
**When** je visualise le diagramme
**Then** le noeud actif est mis en évidence visuellement (classe CSS `node-active`, bordure pulsante accent) (FR32)
**And** les noeuds terminés sont marqués (classe `node-done`, bordure verte)

**Given** un workflow est en cours d'exécution
**When** l'agent passe à l'étape suivante
**Then** le changement de statut est reflété en < 500ms (NFR1) via `stream:workflow-node`
**And** une transition animée montre la progression

**Given** un noeud rencontre une erreur pendant l'exécution
**When** l'événement `workflow:node-status` indique une erreur
**Then** le noeud passe en état `node-error` (bordure rouge)
**And** un tooltip affiche le message d'erreur

**Given** le workflow est terminé
**When** tous les noeuds sont passés en `done`
**Then** le diagramme affiche un état "Workflow terminé" avec tous les noeuds en vert

---

## Epic 7 : Test Visualization & Execution

L'utilisateur peut voir les tests en miroir de la hiérarchie des specs, lancer les tests depuis MnM, et naviguer entre specs et tests.

### Story 7.1 : Test Discovery & Hiérarchie en Miroir des Specs

As a **user**,
I want **to see tests organized as a mirror of the spec hierarchy (task → unit, story → grouped units, epic → integration, project → e2e)**,
So that **I can understand test coverage at each level of my project**.

**Acceptance Criteria:**

**Given** un projet est ouvert
**When** MnM scanne les fichiers de test du projet
**Then** les tests sont découverts via `test:list` IPC et le `spec-mapper.ts` les associe aux specs par convention de nommage (FR33)

**Given** les tests sont découverts
**When** je regarde le volet Tests
**Then** la hiérarchie affiche : Projet (e2e) → Epic (intégration) → Story (unitaires groupés) → Tâche (unitaires) (FR33)
**And** chaque niveau affiche le nombre de tests et un résumé de couverture

**Given** une spec n'a aucun test associé
**When** je regarde son niveau dans la hiérarchie
**Then** un indicateur "Pas de tests" s'affiche (empty state avec icône)

**Given** les fichiers de test changent
**When** le file watcher détecte une modification
**Then** la hiérarchie est mise à jour automatiquement

### Story 7.2 : Statut des Tests (Pass/Fail/Pending)

As a **user**,
I want **to see the status of each test (pass/fail/pending) with visual indicators**,
So that **I know immediately which tests are green and which need attention**.

**Acceptance Criteria:**

**Given** des tests existent dans la hiérarchie
**When** je regarde la liste des tests
**Then** chaque test affiche un badge de statut : vert (pass), rouge (fail), gris (pending/not run) (FR34)

**Given** un test a échoué
**When** je regarde le badge rouge
**Then** je vois le nom du test, et un clic ouvre le détail avec le message d'erreur

**Given** des tests sont en cours d'exécution
**When** les résultats arrivent via `stream:test-result`
**Then** les badges se mettent à jour en temps réel (fade 200ms)
**And** les compteurs pass/fail se mettent à jour avec animation (300ms)

**Given** je regarde un niveau de la hiérarchie (ex: Story)
**When** des tests enfants ont des statuts mixtes
**Then** le niveau parent affiche un résumé agrégé : "5 pass, 2 fail, 1 pending"
**And** l'indicateur du parent est rouge si au moins un test fail

### Story 7.3 : Navigation Bidirectionnelle Spec ↔ Tests

As a **user**,
I want **to navigate from a spec to its associated tests and vice versa**,
So that **I can quickly verify test coverage for any requirement**.

**Acceptance Criteria:**

**Given** je suis sur une spec (story ou tâche) dans la sidebar
**When** je clique sur "Voir les tests" (ou le volet Tests est synchronisé)
**Then** le volet Tests filtre et affiche uniquement les tests associés à cette spec (FR35)

**Given** je suis sur un test dans le volet Tests
**When** je clique sur "Voir la spec"
**Then** la navigation passe à la spec associée dans la sidebar
**And** les volets Contexte et Agents se synchronisent à ce niveau (FR35)

**Given** je suis au niveau Epic
**When** les volets sont synchronisés
**Then** le volet Tests affiche les tests d'intégration de cet epic + un résumé des tests unitaires des stories enfants

### Story 7.4 : Exécution des Tests depuis MnM

As a **user**,
I want **to run tests associated with a spec directly from MnM**,
So that **I can validate implementation without switching to a terminal**.

**Acceptance Criteria:**

**Given** je suis sur une spec avec des tests associés
**When** je clique sur "Lancer les tests" (ou `Cmd+Enter` dans le volet Tests)
**Then** MnM exécute les tests via `test:run` IPC qui spawne vitest (ou la commande configurée) (FR36)
**And** les résultats arrivent en streaming via `stream:test-result`

**Given** les tests sont en cours d'exécution
**When** je regarde le volet Tests
**Then** une progress bar s'affiche avec le nombre de tests exécutés / total
**And** les résultats apparaissent au fur et à mesure (pass en vert, fail en rouge)

**Given** un test échoue
**When** le résultat arrive
**Then** le détail de l'erreur est affiché : nom du test, message d'erreur, stack trace
**And** un clic sur le fichier source ouvre la ligne en question

**Given** tous les tests sont passés
**When** l'exécution est terminée
**Then** un toast de succès s'affiche : "X tests passés" (auto-dismiss 3s)

**Given** je lance des tests alors que des agents sont actifs
**When** l'exécution commence
**Then** le thread UI n'est pas bloqué (< 100ms, NFR6)
**And** les agents continuent de fonctionner normalement

---

## Epic 8 : Packaging, CI/CD & Cross-Platform

L'utilisateur peut installer MnM comme une app desktop native sur macOS, Linux et Windows.

### Story 8.1 : Configuration Electron Builder & Build macOS

As a **user**,
I want **to build MnM as a native macOS .dmg application**,
So that **I can install and use MnM like any desktop app on my Mac**.

**Acceptance Criteria:**

**Given** le projet MnM est complet
**When** je lance `npm run build:mac`
**Then** electron-builder produit un `.dmg` installable pour macOS
**And** l'app se lance correctement après installation

**Given** le .dmg est installé
**When** je lance MnM
**Then** l'app démarre en < 5 secondes (NFR5)
**And** toutes les fonctionnalités (file watching, agent harness, git) fonctionnent sans privilèges élevés (NFR10)

**Given** le build est configuré
**When** je regarde `electron-builder.config`
**Then** les targets sont définis : macOS (.dmg), avec icône, nom d'app, et metadata corrects

### Story 8.2 : Builds Linux & Windows

As a **user**,
I want **to build MnM for Linux (.AppImage) and Windows (.exe)**,
So that **MnM is disponible sur les 3 plateformes majeures**.

**Acceptance Criteria:**

**Given** le projet MnM est complet
**When** je lance `npm run build:linux`
**Then** electron-builder produit un `.AppImage` fonctionnel pour Linux

**Given** le projet MnM est complet
**When** je lance `npm run build:win`
**Then** electron-builder produit un `.exe` installable pour Windows

**Given** les builds sont produits sur les 3 plateformes
**When** je lance les tests d'intégration filesystem et process
**Then** la même suite de tests passe sur macOS, Linux et Windows avec un taux de réussite identique (NFR11)

**Given** les raccourcis clavier utilisent `Cmd`
**When** l'app tourne sur Linux ou Windows
**Then** `Cmd` est remplacé par `Ctrl` automatiquement (détection `navigator.platform`)

### Story 8.3 : GitHub Actions CI/CD Pipeline

As a **user**,
I want **automated CI/CD that builds, tests, and releases MnM on all platforms**,
So that **every push is validated and releases are automatic on tag**.

**Acceptance Criteria:**

**Given** un push est fait sur la branche principale
**When** GitHub Actions se déclenche (`.github/workflows/ci.yml`)
**Then** le pipeline exécute : lint (eslint + eslint-plugin-jsx-a11y), tests (vitest), build sur macOS, Linux, et Windows
**And** le pipeline échoue si un step échoue

**Given** un tag est créé (ex: `v0.1.0`)
**When** GitHub Actions se déclenche (`.github/workflows/release.yml`)
**Then** les builds sont produits pour les 3 plateformes
**And** une GitHub Release est créée automatiquement avec les artefacts (.dmg, .AppImage, .exe)

**Given** le pipeline CI tourne
**When** les tests s'exécutent
**Then** les tests accessibilité (`eslint-plugin-jsx-a11y`) et les tests unitaires (`@testing-library/jest-dom` assertions) sont inclus

**Given** le pipeline release est terminé
**When** je vais sur la page GitHub Releases
**Then** les 3 binaires sont téléchargeables avec les notes de release
