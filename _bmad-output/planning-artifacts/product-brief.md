# MnM — Product Brief

**Date**: 2026-03-10
**Auteurs**: Tom Andrieu (Seeyko), Gabri, Nikou
**Version**: 4.0 — Framework Agnostic Cockpit

---

## Vision

MnM est un **cockpit universel de supervision pour le développement piloté par agents IA**.

Peu importe le framework agentique utilisé (BMAD, open-specs, raw Claude, custom), peu importe le rôle du stakeholder (dev, PO, directeur), MnM est **l'unique interface** pour comprendre où en est le projet, piloter les agents, et garantir l'alignement entre la vision et l'exécution.

**Paradigme** : Discover → Describe → Review → Approve

---

## Le problème

Les outils de coding IA actuels (Cursor, Windsurf, Claude Code) sont des **terminaux améliorés** :
- Pas de vision globale du projet
- Pas de lien entre les specs et le code produit
- Aucun moyen de savoir si un agent a dévié de la spec (value drift)
- Supervision = lire les logs manuellement
- Multi-agent = ouvrir N terminaux
- Accès limité aux devs — le PO ou le directeur ne peut pas s'en servir

Les frameworks agentiques (BMAD, open-specs, custom) produisent des structures de documentation et de workflow riches, mais **aucun outil ne sait les lire et les présenter** à l'ensemble de l'équipe.

---

## La solution

MnM est une **application web** (fork de Paperclip AI) qui :

1. **Découvre le contexte** d'un workspace projet via un agent d'onboarding (sans a priori sur le framework)
2. **Affiche un cockpit 3 volets** : Contexte projet | Travail & Agents | Tests & Validation
3. **Lance des agents** sur des tâches/stories directement depuis le contexte projet
4. **Détecte le value drift** entre documents (vision vs specs, specs vs implémentation)
5. **Suit la progression** en temps réel et expose la visibilité à tous les stakeholders

---

## Utilisateurs cibles

MnM s'adresse à **tous les stakeholders** d'un projet piloté par agents :

| Rôle | Ce qu'il fait dans MnM |
|------|------------------------|
| **Développeur** | Lance des agents sur ses stories, suit l'avancement en temps réel, déclenche les workflows |
| **Product Owner** | Lit le PRD, les epics, les specs. Lance un agent pour générer/affiner des stories. Vérifie le drift vision→implémentation |
| **Directeur / Client** | Vue macro : progression par epic, budget consommé, statut global du projet |
| **Architecte** | Compare les documents d'architecture avec l'état du code. Détecte les dérives techniques |

---

## Le Cockpit : 3 volets

### Volet gauche — Contexte projet

Ce que l'agent a découvert lors de l'onboarding, présenté sous forme d'arbre navigable :
- Documents de planning (product brief, PRD, architecture, specs)
- Structure d'implémentation (epics, stories, tasks)
- Tout autre artefact pertinent découvert dans le workspace

**La structure est dynamique** — elle reflète ce que le workspace *contient*, pas ce qu'un framework impose. Un projet BMAD affichera ses epics/stories. Un projet avec un seul README affichera ce README. Un projet avec une arborescence open-specs l'affichera.

### Volet central — Travail & Agents

- **Liste des issues** du projet avec statut, assignation, priorité
- **Activité des agents en cours** (live run, output en streaming)
- **Vue détaillée** d'un artefact sélectionné dans le volet contexte (markdown rendu, drift inline)
- **Launch agent** : bouton contextuel pour déclencher un agent sur l'artefact/story sélectionné

### Volet droit — Tests & Validation

- Tests liés aux stories/ACs
- Résultats de runs précédents
- Timeline des exécutions

---

## Onboarding & Découverte de workspace

### Le problème de départ

Un projet peut être organisé de mille façons. MnM ne peut pas hardcoder la structure de chaque framework agentique.

### La solution : Discovery par agent

Quand un workspace n'a pas encore été configuré dans MnM, on lance un **agent de découverte** :
1. L'agent explore le workspace librement (fichiers, docs, structure, outils)
2. Il identifie la méthodologie, les artefacts existants, les workflows configurés
3. Il remonte un rapport structuré : ce qu'il a trouvé, comment ça mappe aux concepts MnM
4. L'utilisateur valide et MnM est populé : contexte projet, agents scoped, assignments workflow→agent

Si le workspace utilise BMAD → les agents/workflows BMAD sont liés aux agents MnM.
Si le workspace utilise raw Claude Code → des agents MnM scoped sont créés pour chaque workflow découvert.
Si le workspace n'a pas de méthodologie → l'agent propose d'en créer une ou de travailler avec MnM natif.

### Gestion des agents

- **Agents globaux MnM** : disponibles sur tous les projets (ex: "Dev Agent", "PM Agent")
- **Agents scoped** : créés lors de l'onboarding, liés à un workspace spécifique (portent le contexte du framework local)
- **Assignments** : chaque workflow découvert dans le workspace est lié à un agent MnM (global ou scoped). Quand on lance un workflow depuis le cockpit → l'agent approprié est sélectionné automatiquement.

---

## Value Drift Detection

Le **drift** est le désalignement progressif entre la vision et l'exécution. MnM le détecte à deux niveaux :

1. **Document vs Document** : PRD vs stories, architecture vs specs — détecte si une décision de conception n'a pas été propagée
2. **Specs vs Code** : ce qui est implémenté vs ce qui était spécifié (via git diff + analyse LLM)

Chaque drift est signalé avec : sévérité, description, suggestion de résolution.

---

## Positionnement

| | Cursor/Windsurf | Paperclip AI | **MnM** |
|---|---|---|---|
| Agent execution | ✅ | ✅ | ✅ (hérité de Paperclip) |
| Multi-agent | ❌ | ✅ | ✅ |
| Cost tracking | ❌ | ✅ | ✅ |
| Context-aware cockpit | ❌ | ❌ | ✅ |
| Drift detection | ❌ | ❌ | ✅ |
| 3-pane cockpit | ❌ | ❌ | ✅ |
| Framework agnostic | ❌ | ❌ | ✅ |
| Workspace onboarding | ❌ | ❌ | ✅ |
| Accès tous stakeholders | ❌ | ✅ | ✅ |
| Déployable on-premise | ❌ | ✅ | ✅ |

**MnM = Paperclip (orchestration opérationnelle) + couche sémantique (contexte + drift + onboarding)**

---

## Architecture technique

### Hérité de Paperclip (ne pas reconstruire)
- **Backend** : Express + Drizzle ORM + PostgreSQL
- **Frontend** : React 19 + Vite + TanStack Query + Tailwind + shadcn/ui
- **Agents** : adapters multiples (claude-local, codex-local, cursor, opencode, pi...)
- **Heartbeat engine** : exécution périodique des agents sur les issues
- **WebSocket** : events temps réel (live runs, activité)
- **Auth** : better-auth (multi-user, invitations, rôles)
- **Cost tracking** : par agent, par run
- **Docker** : déploiement conteneurisé

### Ajouté par MnM (fork-paperclip)
- **Workspace Context Analyzer** : service backend qui parse dynamiquement la structure d'un workspace
- **3-pane Layout** : Contexte | Travail/Agents | Tests — uniquement sur la vue Projet (Cockpit)
- **Drift Detection Engine** : comparaison LLM de documents avec scoring de confiance
- **Workspace File Watcher** : surveillance du workspace pour détecter les modifications d'agents en temps réel
- **Workspace Discovery** : endpoint d'onboarding + agent de découverte libre
- **Navigation synchronisée** : `ProjectNavigationContext` — sélection dans un volet → les autres se mettent à jour
- **Scoped Agents** : agents liés à un workspace spécifique avec configuration dédiée
- **Agent Assignments** : mapping workflow/rôle → agent MnM par workspace

---

## État actuel (mars 2026)

### Implémenté ✅
- Layout 3 volets (ThreePaneLayout)
- ContextPane avec arbre navigable (planning artifacts + epics/stories)
- WorkPane : SpecViewer (markdown + drift inline), EpicOverview, StoryViewer, ProjectAgentsDashboard
- Drift detection (document vs document via LLM)
- WorkspaceAgentSync : onboarding agents (détection → assignment UI)
- **Workspace discovery / onboarding** : `POST /projects/:id/onboard` → issue assignée au CEO agent avec prompt 4 étapes (explorer → créer agents scoped → assignments → écrire config.yaml)
- **Context panel config-driven** : `_mnm-context/config.yaml` mappe les vrais fichiers du projet. L'analyzer lit en live, zéro copie. Si le config n'existe pas → panel vide (pas de fallback).
- **Agents scoped** : `scopedToWorkspaceId` sur chaque agent. Les agents de découverte sont obligatoirement scoped au workspace du projet.
- **Agent assignments** : `workspace.metadata.bmadAssignments` — mapping slug workflow → agent MnM
- WorkspaceContextWatcher : file watcher + live events sur `_mnm-context/`
- LaunchAgentDialog avec injection de contexte workspace (persona + workflow)
- **Properties panel** : scroll area + footer sticky — bouton "Supprimer le projet" toujours visible
- **Cascade delete projet** : supprime agents scoped + toutes les issues (commentaires, read states inclus)
- Renommage complet BMAD → framework-agnostic terminé (`bmad-analyzer` → `workspace-analyzer`, types `Bmad*` → `Workspace*`, routes `/bmad` → `/workspace-context`)

### À venir
- Finaliser le flow de discovery : l'agent reporte → MnM popule `config.yaml` automatiquement sans intervention manuelle
- TestsPane : mapping story↔tests, résultats de run
- Bidirectionnalité : MnM crée des issues → workspace mis à jour (stories générées)
- Timeline : vue temporelle des runs et progressions

---

## Modèle de déploiement

- **Self-hosted** : Docker sur le serveur de l'entreprise/agence/particulier
- **Local** : `docker-compose up` pour utilisation perso
- **Multi-projet** : chaque projet a son workspace path (monorepo supporté)
- **Multi-utilisateur** : tous les stakeholders accèdent via navigateur
