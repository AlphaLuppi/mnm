# MnM — Epic Breakdown

**Version**: 3.0 — Fork Paperclip
**Date**: 2026-03-09

---

## Overview

4 epics MVP + 2 epics post-MVP. Périmètre réduit pour livrer vite.

## Epic 1: BMAD Cockpit Foundation (MVP)

**Objectif** : Parser les specs BMAD et les afficher dans un cockpit 3 volets.

**Functional Requirements** : FR1-FR12

| Story | Titre | Description | FRs |
|---|---|---|---|
| 1.1 | BMAD Analyzer Service & API | Backend : parser _bmad-output/, API REST | FR1-FR5 |
| 1.2 | Three-Pane Resizable Layout | UI : 3 volets resizable sur la page projet | FR6-FR8 |
| 1.3 | Context Pane — Specs Tree | Volet gauche : artifacts + arbre epics/stories | FR9 |
| 1.4 | Work Pane — Content Viewer | Volet centre : markdown viewer + story detail | FR10 |
| 1.5 | Tests Pane — ACs Mirror | Volet droit : acceptance criteria en miroir | FR11 |
| 1.6 | Pane Synchronization | Navigation synchronisée entre les 3 volets | FR12 |

## Epic 2: Agent Integration in Cockpit (MVP)

**Objectif** : Lancer et superviser des agents directement depuis la vue specs.

**Functional Requirements** : FR13-FR14, FR18

| Story | Titre | Description | FRs |
|---|---|---|---|
| 2.1 | Launch Agent from Story | Lancer un agent sur une story BMAD | FR13 |
| 2.2 | Agent Output in Cockpit | Voir l'output agent en temps réel dans le Work pane | FR18 |
| 2.3 | Stop Agent from Cockpit | Arrêter un agent depuis le cockpit | FR14 |

## Epic 3: Drift Detection (MVP)

**Objectif** : Détecter les incohérences entre documents specs.

**Functional Requirements** : FR19, FR21-FR23

| Story | Titre | Description | FRs |
|---|---|---|---|
| 3.1 | Drift Detection Engine | Backend : comparaison LLM de 2 documents | FR19 |
| 3.2 | Manual Drift Check UI | Bouton "Vérifier le drift" + affichage résultats | FR21-FR22 |
| 3.3 | Drift Resolution Actions | Corriger source, corriger cible, ignorer | FR23 |

## Epic 4: Dashboard Cockpit (MVP)

**Objectif** : Vue d'ensemble du projet avec widgets cliquables.

**Functional Requirements** : FR35-FR37

| Story | Titre | Description | FRs |
|---|---|---|---|
| 4.1 | Cockpit Dashboard Widgets | Métriques : agents, drift, progress, santé | FR35, FR37 |
| 4.2 | One-Click Navigation | Clic widget → détail dans cockpit projet | FR36 |

---

## Epic 5: File Watching & Live Updates (Post-MVP)

**Objectif** : Surveillance temps réel du workspace + notifications.

**Functional Requirements** : FR15-FR17, FR20, FR25-FR29

| Story | Titre | Description | FRs |
|---|---|---|---|
| 5.1 | File Watcher Service | Backend : surveillance fs.watch du workspace | FR25-FR26 |
| 5.2 | BMAD Live Refresh | Modifications _bmad-output/ → refresh cockpit | FR29 |
| 5.3 | File Change Notifications | Toast + attribution aux agents | FR27 |
| 5.4 | Agent Health & Blockage | Indicateurs santé + détection blocage | FR15-FR17 |
| 5.5 | Event-Driven Drift | Drift auto sur modification de fichiers BMAD | FR20 |
| 5.6 | Timeline Bar | Chronologie d'activité en bas du cockpit | FR38 |
| 5.7 | Git Integration | Branch courante, historique commits | FR28 |

## Epic 6: Test Discovery & Execution (Post-MVP)

**Objectif** : Scanner, mapper et exécuter les tests depuis MnM.

**Functional Requirements** : FR24, FR30-FR34

| Story | Titre | Description | FRs |
|---|---|---|---|
| 6.1 | Test File Discovery | Scanner les fichiers test, mapper aux specs | FR31 |
| 6.2 | Test Coverage Indicators | Couverture par story : "N/M ACs couverts" | FR32 |
| 6.3 | Bidirectional Spec↔Test Nav | Navigation entre specs et tests | FR33 |
| 6.4 | Test Execution from MnM | Lancer les tests depuis l'UI | FR34 |
| 6.5 | Drift Confidence Threshold | Config du seuil de confiance | FR24 |

---

## Sprint Plan (MVP)

| Sprint | Stories | Durée estimée |
|---|---|---|
| Sprint 1 | 1.1, 1.2 | 1 semaine |
| Sprint 2 | 1.3, 1.4, 1.5 | 1 semaine |
| Sprint 3 | 1.6, 2.1 | 1 semaine |
| Sprint 4 | 2.2, 2.3, 3.1 | 1 semaine |
| Sprint 5 | 3.2, 3.3 | 1 semaine |
| Sprint 6 | 4.1, 4.2, polish | 1 semaine |

**Total MVP** : ~6 semaines

## Requirements Inventory

### MVP Functional Requirements

- FR1: Détection structure BMAD
- FR2: Parsing planning artifacts
- FR3: Parsing implementation artifacts (stories)
- FR4: Parsing sprint-status.yaml
- FR5: API fichier markdown avec protection traversée
- FR6: Layout 3 volets sur page projet
- FR7: Volets resizable avec contraintes min
- FR8: Maximiser/restaurer un volet
- FR9: Context pane — artifacts + arbre epics/stories
- FR10: Work pane — contenu sélectionné
- FR11: Tests pane — ACs en miroir
- FR12: Synchronisation des 3 volets
- FR13: Lancer agent sur story
- FR14: Arrêter agent depuis cockpit
- FR18: Output agent en temps réel
- FR19: Drift detection LLM
- FR21: Drift check manuel
- FR22: Affichage drift avec diff
- FR23: Résolution drift
- FR35: Dashboard widgets
- FR36: Navigation one-click depuis dashboard
- FR37: Indicateur santé globale

### Non-Functional Requirements

- NFR1: Chargement cockpit < 2s
- NFR2: File watching < 5% CPU repos
- NFR3: Drift detection < 30s
- NFR4: WebSocket latence < 500ms
- NFR5: Pas de blocage UI pendant exécution agents
- NFR6: Mémoire < 500MB
- NFR7: Accessibilité (ARIA, clavier)
