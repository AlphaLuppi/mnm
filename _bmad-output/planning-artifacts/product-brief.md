# MnM — Product Brief

**Date**: 2026-03-09
**Auteurs**: Tom Andrieu (Seeyko), Gabri, Nikou
**Version**: 3.0 — Fork Paperclip

---

## Vision

MnM est un **cockpit de supervision pour le développement piloté par agents IA**.

L'humain ne code plus. Il décrit ce qu'il veut (specs), supervise les agents qui implémentent, et valide que le résultat est aligné avec la vision produit.

**Paradigme** : Describe → Review → Approve

## Le problème

Les outils de coding IA actuels (Cursor, Windsurf, Claude Code) sont des **terminaux améliorés** :
- Pas de vision globale du projet
- Pas de lien entre les specs et le code produit
- Aucun moyen de savoir si un agent a dévié de la spec
- Supervision = lire les logs manuellement
- Multi-agent = ouvrir N terminaux

Les développeurs utilisant BMAD ou des méthodologies spec-first n'ont aucun outil qui comprend leur pipeline de documents.

## La solution

MnM est une **application web** (fork de Paperclip AI) qui :

1. **Parse les specs BMAD** d'un workspace projet (PRD, architecture, epics, stories)
2. **Affiche un cockpit 3 volets** : Contexte (specs) | Agents (travail) | Tests (validation)
3. **Lance des agents** sur des stories/epics directement depuis la vue specs
4. **Détecte le drift** entre documents (PRD vs stories, archi vs code) via LLM
5. **Suit la progression** en temps réel (tasks cochées, tests passés)

## Positionnement

| | Cursor/Windsurf | Paperclip AI | **MnM** |
|---|---|---|---|
| Agent execution | ✅ | ✅ | ✅ (hérité de Paperclip) |
| Multi-agent | ❌ | ✅ | ✅ |
| Cost tracking | ❌ | ✅ | ✅ |
| Spec-aware | ❌ | ❌ | ✅ |
| Drift detection | ❌ | ❌ | ✅ |
| 3-pane cockpit | ❌ | ❌ | ✅ |
| BMAD integration | ❌ | ❌ | ✅ |
| Multi-user (équipe) | ❌ | ✅ | ✅ |
| Déployable on-premise | ❌ | ✅ | ✅ |

**MnM = Paperclip (orchestration opérationnelle) + couche sémantique (specs + drift + tests)**

## Architecture technique

### Hérité de Paperclip (ne pas reconstruire)
- **Backend** : Express + Drizzle ORM + PostgreSQL
- **Frontend** : React 19 + Vite + TanStack Query + Tailwind + shadcn/ui
- **Agents** : 8 adapters (claude-local, codex-local, cursor, opencode, pi, openclaw-gateway, http)
- **Heartbeat engine** : exécution périodique des agents sur les issues
- **WebSocket** : events temps réel (live runs, activité)
- **Auth** : better-auth (multi-user, invitations, rôles)
- **Cost tracking** : par agent, par run
- **Docker** : déploiement conteneurisé

### Ajouté par MnM
- **BMAD Analyzer** : service backend qui parse `_bmad-output/` (planning + implementation artifacts)
- **3-pane Layout** : Contexte | Agents/Work | Tests — uniquement sur la vue Projet
- **Drift Detection Engine** : comparaison LLM de documents avec scoring de confiance
- **File Watcher** : surveillance du workspace pour détecter les modifications d'agents
- **Git Info** : branches, commits, historique
- **Test Discovery** : scan des fichiers de tests, mapping spec↔tests
- **Navigation synchronisée** : clic dans un volet → les 2 autres se mettent à jour

## Utilisateurs cibles

1. **Développeurs solo** utilisant des agents IA avec une méthodologie spec-first
2. **Petites équipes** (2-5 personnes) où chacun supervise ses agents
3. **Agences** déployant MnM pour leurs clients comme outil de supervision projet

## Modèle de déploiement

- **Self-hosted** : Docker sur le serveur de l'entreprise/agence/particulier
- **Local** : `docker-compose up` pour utilisation perso
- **Multi-projet** : chaque projet a son workspace path (monorepo supporté)
- **Multi-utilisateur** : tous les stakeholders accèdent via navigateur

## Critères de succès MVP

1. Un utilisateur peut ouvrir un projet BMAD et voir ses specs dans le cockpit 3 volets
2. Il peut lancer un agent sur une story depuis la vue specs
3. Il voit la progression en temps réel (tasks cochées, output agent)
4. Il peut déclencher une vérification de drift entre 2 documents
5. Les tests/ACs sont visibles et liés aux specs

## Ce qui n'est PAS dans le MVP

- Éditeur visuel de workflow (post-MVP)
- Onboarding conversationnel pour créer sa méthodologie (post-MVP)
- Support d'autres frameworks que BMAD (post-MVP)
- Application desktop Electron (abandonné — web only)
- Marketplace d'agents/workflows (futur)
