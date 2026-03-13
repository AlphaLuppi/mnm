# MnM — Product Requirements Document (PRD)

**Version**: 4.0 — Framework Agnostic
**Date**: 2026-03-11
**Auteur**: Tom Andrieu (Seeyko)
**Basé sur**: Product Brief v3.0, brainstorms Tom + Gab + Nikou

---

## 1. Executive Summary

MnM est un cockpit universel de supervision pour le développement piloté par agents IA. C'est un fork de Paperclip AI enrichi d'une couche sémantique : context panel framework-agnostic, cockpit 3 volets synchronisé, drift detection, onboarding par agent de découverte, et suivi de tests.

**Paradigme** : Discover → Describe → Review → Approve. L'humain supervise et valide. L'agent implémente.

## 2. Classification

- **Type** : Application web (Docker, self-hosted)
- **Plateforme** : Navigateur (desktop-first, responsive mobile)
- **Stack** : React 19 + Express + PostgreSQL (Paperclip fork)
- **Licence** : Open source

## 3. Success Criteria

| Critère | Mesure | Cible MVP |
|---|---|---|
| Parsing BMAD | % de structures BMAD correctement parsées | > 95% |
| Temps d'affichage cockpit | Temps de chargement du 3-pane avec specs | < 2s |
| Drift detection | Temps de comparaison 2 documents | < 30s |
| Agent launch from specs | Nombre de clics pour lancer un agent sur une story | ≤ 3 |
| Test visibility | % des ACs visibles dans le panneau Tests | 100% |

## 4. Functional Requirements

### 4.1 Workspace Context Analysis (FR1-FR5)

**FR1** : Le système lit `_mnm-context/config.yaml` dans un workspace projet pour déterminer quels fichiers afficher dans le Context Panel. Si le fichier n'existe pas, le panel est vide.

**FR2** : Le système peut lire les planning artifacts (product-brief, PRD, architecture, epics, etc.) depuis leurs **vrais chemins** dans le projet, tels que définis dans `config.yaml`. Les chemins sont relatifs à la racine du workspace.

**FR3** : Le système peut lire les stories/epics depuis leurs vrais chemins et en extraire : titre, statut (`Status:` line), acceptance criteria (Given/When/Then), tasks avec checkbox

**FR4** : Le système peut lire un fichier `sprint-status.yaml` depuis le chemin défini dans `config.yaml` pour obtenir les statuts des stories et epics

**FR5** : Le système peut servir le contenu markdown de n'importe quel fichier du workspace via API REST (`path` relatif à la racine du workspace), avec protection contre la traversée de répertoire

### 4.2 Three-Pane Cockpit Layout (FR6-FR12)

**FR6** : L'utilisateur peut voir un layout 3 volets (Contexte 25% | Agents/Work 50% | Tests 25%) quand il visite une page projet

**FR7** : L'utilisateur peut redimensionner chaque volet en respectant les contraintes min (Context 200px, Work 400px, Tests 200px)

**FR8** : L'utilisateur peut maximiser un volet (double-clic header) et le restaurer

**FR9** : Le volet Contexte affiche les planning artifacts et l'arbre Epics → Stories avec badges de statut

**FR10** : Le volet Work affiche le contenu sélectionné : markdown d'un artifact, détail d'une story, ou liste d'agents (vue par défaut)

**FR11** : Le volet Tests affiche les acceptance criteria en miroir de la hiérarchie specs, avec statut par AC

**FR12** : Les 3 volets se synchronisent : clic dans Contexte → mise à jour Work et Tests

### 4.3 Agent Integration (FR13-FR18)

**FR13** : L'utilisateur peut lancer un agent sur une story depuis le cockpit (sélection de l'agent + type de workflow BMAD)

**FR14** : L'utilisateur peut arrêter un agent en cours depuis le cockpit

**FR15** : L'utilisateur peut voir les agents actifs avec indicateur de santé (vert/orange/rouge basé sur les 3 derniers runs)

**FR16** : L'utilisateur peut voir la progression d'un agent via les tasks cochées dans le fichier story

**FR17** : Le système détecte quand un agent est potentiellement bloqué (>10min sans activité)

**FR18** : L'utilisateur peut voir l'output d'un agent en temps réel dans le cockpit (chat viewer)

### 4.4 Drift Detection (FR19-FR24)

**FR19** : Le système peut comparer 2 documents via LLM et détecter les incohérences avec sévérité et score de confiance

**FR20** : Le système déclenche automatiquement le drift check quand un fichier BMAD est modifié (event-driven, debounce 30s)

**FR21** : L'utilisateur peut lancer un drift check manuellement depuis la vue d'un artifact

**FR22** : L'utilisateur peut voir les alertes drift avec diff side-by-side des excerpts conflictuels

**FR23** : L'utilisateur peut résoudre un drift : corriger source, corriger cible (lance un agent correct-course), ou ignorer

**FR24** : L'utilisateur peut configurer le seuil de confiance en dessous duquel les alertes ne sont pas affichées

### 4.5 File Watching & Git (FR25-FR29)

**FR25** : Le système surveille le workspace du projet et détecte les modifications de fichiers en < 1 seconde

**FR26** : Le système attribue les modifications de fichiers aux agents actifs (best-effort)

**FR27** : L'utilisateur est notifié quand un agent modifie un fichier de contexte

**FR28** : L'utilisateur peut voir l'historique git du projet (branch courante, 20 derniers commits)

**FR29** : Les modifications dans `_mnm-context/` déclenchent un refresh du Context Panel dans le cockpit

### 4.6 Tests & Validation (FR30-FR34)

**FR30** : Le système extrait les acceptance criteria des stories BMAD comme "tests" avec statut pending/pass/fail

**FR31** : Le système peut découvrir les fichiers de tests du workspace et les associer aux specs par convention de nommage

**FR32** : L'utilisateur peut voir la couverture par story : "N/M ACs ont des tests"

**FR33** : L'utilisateur peut naviguer d'une spec vers ses tests et inversement (bidirectionnel)

**FR34** : L'utilisateur peut lancer les tests depuis MnM et voir les résultats en temps réel

### 4.7 Dashboard Cockpit (FR35-FR38)

**FR35** : Le dashboard affiche : agents actifs, alertes drift, progression des stories, activité récente

**FR36** : Chaque widget du dashboard est cliquable et navigue vers le détail dans le cockpit projet

**FR37** : Le dashboard affiche un indicateur de santé globale du projet

**FR38** : Une timeline d'activité en bas du cockpit montre les événements chronologiquement (filtrable par agent)

### 4.8 Onboarding & Workspace Discovery (FR43-FR46)

**FR43** : L'utilisateur peut déclencher un agent de découverte sur un workspace depuis le cockpit (`POST /projects/:id/onboard`). L'issue créée est automatiquement assignée à l'agent CEO du projet.

**FR44** : L'agent de découverte suit un prompt en 4 étapes : (1) explorer le workspace librement, (2) créer des agents MnM scoped au workspace, (3) sauvegarder les workflow assignments, (4) écrire `_mnm-context/config.yaml` pointant vers les vrais fichiers. L'agent ne copie jamais de contenu.

**FR45** : Les agents créés lors de l'onboarding sont obligatoirement **scoped** au workspace du projet (`scopedToWorkspaceId`). Un agent scoped n'est visible que dans le cockpit de son projet.

**FR46** : Chaque workflow découvert dans le workspace est assigné à un agent MnM (mapping slug → agentId persisté dans `workspace.metadata`). Depuis `LaunchAgentDialog`, l'agent approprié est pré-sélectionné automatiquement.

### 4.9 Project Lifecycle (FR47-FR48)

**FR47** : La suppression d'un projet déclenche automatiquement la suppression en cascade : agents scoped au projet, toutes les issues du projet (et leurs commentaires, read states).

**FR48** : Le Properties Panel (volet droit) dispose d'un footer sticky pour les actions destructives (suppression projet), toujours visible même quand le contenu scrolle.

### 4.10 Deployment & Multi-user (FR39-FR42 — hérité Paperclip)

**FR39** : L'application se déploie via Docker (docker-compose)

**FR40** : Multi-utilisateur avec auth, rôles, et invitations

**FR41** : Multi-projet : chaque projet a son workspace path (monorepo supporté avec submodules git)

**FR42** : Les specs, contexte, et tests sont scopés au projet global (pas par branche)

## 5. Non-Functional Requirements

**NFR1** : Le cockpit 3 volets doit se charger en < 2 secondes après navigation vers un projet

**NFR2** : Le file watching ne doit pas consommer > 5% CPU au repos

**NFR3** : Le drift detection doit retourner un résultat en < 30 secondes (dépend du LLM, mais la latence pipeline locale < 2s)

**NFR4** : Le WebSocket doit relayer les événements en < 500ms

**NFR5** : L'application ne doit pas bloquer l'UI pendant l'exécution d'agents

**NFR6** : La mémoire consommée doit rester < 500MB en usage normal

**NFR7** : L'application doit être accessible (ARIA landmarks, navigation clavier, skip links)

## 6. MVP Scope

### In Scope (MVP) — ✅ implémenté
- Workspace Context Analysis config-driven (FR1-FR5) ✅
- 3-pane cockpit layout (FR6-FR12) ✅
- Agent launch from specs (FR13-FR14, FR18) ✅
- Drift detection manual + display (FR19, FR21-FR23) ✅
- Tests pane with ACs (FR30, FR32) ✅
- Dashboard cockpit (FR35-FR37) ✅
- Deployment Docker (FR39) ✅
- Workspace onboarding par agent de découverte (FR43-FR44) ✅
- Scoped agents + workflow assignments (FR45-FR46) ✅
- Cascade delete projet (FR47) ✅
- Properties panel footer sticky (FR48) ✅

### Post-MVP
- Event-driven drift detection (FR20)
- File watcher attribut-agent (FR25-FR27)
- Agent health indicators & blockage (FR15-FR17)
- Test file discovery & execution (FR31, FR33, FR34)
- Confidence threshold config (FR24)
- Timeline bar (FR38)
- Git history viewer (FR28)
- Bidirectionnalité : MnM génère des stories dans le workspace

## 7. Risks

| Risque | Impact | Mitigation |
|---|---|---|
| Drift detection peu fiable | Faux positifs → perte de confiance | Seuil de confiance configurable + option ignorer |
| BMAD format pas standard | Parsing incomplet | Parser flexible + fallbacks |
| Coût LLM pour drift detection | Facture élevée | Cache des résultats + debounce |
| Fork Paperclip diverge | Difficile de merge upstream | Isoler les changements MnM dans des fichiers séparés |
