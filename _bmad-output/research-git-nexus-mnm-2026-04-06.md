# Research: GitNexus & Code Intelligence pour les Agents Dev MnM

**Date:** 2026-04-06
**Type:** Technical Research
**Durée:** ~45 min

## Executive Summary

"Git Nexus" désigne principalement **GitNexus** — un moteur d'intelligence de code zero-server (19K+ stars GitHub) qui indexe un repo en **knowledge graph** et l'expose via **MCP tools** pour que les agents AI comprennent l'architecture avant de modifier du code.

L'écosystème 2026 autour des agents de dev parallèles comprend aussi :
- **Clash** — détection de conflits git entre worktrees en temps réel
- **Nexus (nexi-lab)** — plateforme de collaboration inter-agents avec mémoire partagée
- **Orchestrateurs** (Overstory, ComposioHQ/agent-orchestrator) — planification + dispatch + CI auto

**Recommandation principale :** Intégrer GitNexus comme **étape d'indexation automatique** dans le pipeline MnM quand un projet git est cloné dans un sandbox, et ajouter **Clash** pour la détection de conflits quand plusieurs agents travaillent en parallèle sur le même repo.

---

## Findings

### 1. GitNexus — Code Intelligence via Knowledge Graph

**Ce que c'est :**
- Moteur client-side qui parse un repo avec **Tree-sitter** (11 langages : TS, JS, Python, Java, Go, Rust, C, C++, C#, PHP, Swift)
- Construit un **knowledge graph** : fonctions, classes, imports, call chains, héritage, clusters fonctionnels, execution flows
- Pipeline d'indexation en 7 phases : Structure → Parse → Imports → Calls → Heritage → Communities → Processes
- Expose le graphe via **MCP tools** (Model Context Protocol) — compatible Claude Code, Cursor, Codex, etc.

**Comment ça marche :**
```bash
npx gitnexus analyze --skills
```
- Indexe le codebase
- Génère un `AGENTS.md` / `CLAUDE.md` avec le contexte architectural
- Crée des fichiers `SKILL.md` par module fonctionnel (entry points, flows, connexions)
- Installe des hooks Claude Code et enregistre les MCP tools

**Pourquoi c'est pertinent pour MnM :**
- Nos agents `claude_local` tournent dans des sandboxes Docker avec des projets clonés
- Sans contexte architectural, ils font des **blind edits** — cassent des call chains, oublient des dépendances
- GitNexus donne à l'agent un **plan du codebase** avant chaque intervention
- Le Graph RAG Agent permet des requêtes comme "quels fichiers sont impactés si je change cette interface ?"

**Capacité :** Repos jusqu'à ~10K-50K fichiers (selon hardware). Suffisant pour la majorité des projets client.

**Confidence:** High — outil mature, 19K+ stars, npm package publié, MCP natif

---

### 2. Clash — Détection de Conflits entre Worktrees

**Ce que c'est :**
- CLI Rust qui détecte les merge conflicts entre **toutes les paires de worktrees** en temps réel
- Utilise `git merge-tree` (via gix) pour faire des three-way merges **sans modifier le repo** (100% read-only)
- TUI live avec `clash watch` — rafraîchi automatiquement à chaque modification de fichier

**Features clés :**
- **Guard hooks** — vérifie les conflits avant chaque édit d'un agent AI
- **Conflict matrix** — visualise quelles branches sont en conflit
- **Zero impact** — ne touche jamais au repo

**Pourquoi c'est pertinent pour MnM :**
- MnM supporte `maxConcurrentRuns` (1-10) par agent, et plusieurs agents par projet
- Quand 3 agents travaillent sur le même repo (features différentes), les conflits ne sont détectés qu'au merge
- Clash peut alerter **pendant l'exécution** via le heartbeat/live-events
- Le CAO pourrait utiliser cette info pour réassigner ou séquencer les agents

**Limitation actuelle :** Clash détecte mais ne résout pas les conflits (résolution prévue dans une future version).

**Confidence:** High — outil spécialisé, bien documenté, Hacker News featured

---

### 3. Nexus (nexi-lab) — Collaboration Inter-Agents

**Ce que c'est :**
- "AI-Native Distributed Filesystem" pour agents
- Chaque agent rejoint un **room**, échange des messages, commit des fichiers dans un storage partagé
- Supporte MCP + A2A (Agent-to-Agent protocol)
- Bricks modulaires : Memory, Delegation, Discovery, Auth, Permissions

**Features :**
- Mémoire partagée (namespace-based, identity-based)
- Feedback tracking (corrections, thumbs up/down)
- Trajectory recording (historique d'actions)
- Multi-tenant avec permissions

**Pourquoi c'est pertinent pour MnM :**
- MnM a déjà un concept similaire (issues + comments + traces = collaboration)
- Nexus pourrait compléter comme **couche de coordination temps réel** entre agents dans un même projet
- Alternative : enrichir le système d'issues MnM pour servir de "room" de coordination

**Confidence:** Medium — projet plus jeune, overlap avec ce que MnM fait déjà

---

### 4. Patterns d'Orchestration Multi-Agents 2026

**6 patterns de coordination identifiés :**

| Pattern | Description | MnM Status |
|---------|-------------|-------------|
| **Spec-driven decomposition** | Découper une feature en tâches isolées | ✓ Issues + workflow stages |
| **Worktree isolation** | 1 agent = 1 branche = 1 répertoire | ⚠️ Partiel (cwd par workspace) |
| **Coordinator/Specialist/Verifier** | Rôles séparés pour planifier/exécuter/vérifier | ✓ CAO + agents + orchestrator |
| **Per-task model routing** | Modèle différent selon la complexité | ⚠️ Config layers existent |
| **Automated quality gates** | CI/tests auto avant merge | ✗ Pas encore |
| **Sequential merges** | Merge un par un pour éviter les conflits | ✗ Pas encore |

**Stat clé :** Google DORA 2025 — 90% d'adoption AI = +9% bugs, +91% temps de review, +154% taille des PRs. Les quality gates automatisés sont critiques.

---

## Mapping vers l'Architecture MnM

### Ce qui existe déjà

| Composant MnM | Rôle | Pertinence |
|----------------|------|------------|
| `ProjectWorkspace` | `repoUrl`, `repoRef`, `cwd` | Base pour l'intégration git |
| `sandbox-manager.ts` | Docker containers per-user | Isolation déjà en place |
| `heartbeat.ts` | Exécution async + session persistence | Hooks pour pre/post-run |
| `agent_task_sessions` | Session par adapter/task | Peut stocker l'état git |
| `cao-watchdog.ts` | Monitoring des runs | Peut intégrer les alertes conflit |
| `orchestrator.ts` | FSM workflow stages | Quality gates possibles |
| Live events (SSE/WS) | Streaming temps réel | Alertes conflits en temps réel |

### Ce qui manque

| Gap | Impact | Solution proposée |
|-----|--------|-------------------|
| **Pas de git clone automatique** | Agents doivent cloner manuellement | Auto-clone au provision du workspace |
| **Pas de worktree management** | Agents partagent le même working dir | Worktree par run/tâche |
| **Pas d'indexation codebase** | Agents font du blind editing | GitNexus au clone/pull |
| **Pas de détection de conflits** | Conflits découverts trop tard | Clash intégré au heartbeat |
| **Pas de quality gates auto** | Pas de CI avant merge | Post-run test/lint hooks |
| **Pas de merge management** | Pas de PR/merge orchestré | PR auto + sequential merge |

---

## Recommandations d'Implémentation

### Phase 1 : Git Intelligence de Base (3-5 jours)

**Objectif :** Les agents comprennent le code avant de le modifier.

1. **Auto-clone au workspace provision**
   - Quand `ProjectWorkspace.repoUrl` est défini → `git clone` automatique dans le sandbox
   - Utiliser `repoRef` pour checkout la bonne branche
   - Stocker l'état dans `agent_task_sessions`

2. **GitNexus indexation automatique**
   - Post-clone : `npx gitnexus analyze --skills` dans le sandbox
   - Génère les fichiers de contexte (AGENTS.md, SKILL.md)
   - L'agent a le knowledge graph dès sa première exécution
   - Re-index sur `git pull` (via hook post-merge)

3. **MCP tools exposition**
   - GitNexus expose ses tools via MCP
   - Claude Code dans le sandbox les détecte automatiquement
   - L'agent peut query : "quels fichiers sont impactés par ce changement ?"

### Phase 2 : Worktree Isolation (3-5 jours)

**Objectif :** Chaque agent/tâche travaille sur sa propre branche sans collision.

1. **Worktree manager service**
   ```
   server/src/services/git-worktree-manager.ts
   ```
   - `createWorktree(sandboxId, branchName, baseBranch)` → `git worktree add`
   - `listWorktrees(sandboxId)` → état de tous les worktrees
   - `removeWorktree(sandboxId, branchName)` → cleanup
   - Exécuté via `docker exec` dans le sandbox

2. **Intégration heartbeat**
   - `resolveWorkspaceForRun()` crée un worktree dédié si `maxConcurrentRuns > 1`
   - Convention de nommage : `worktrees/{agent-name}/{task-key}`
   - Session persistence du worktree path dans `agent_task_sessions`

3. **Branch naming convention**
   ```
   {agent-name}/{issue-key}/{timestamp}
   ex: backend-dev/MNM-42/20260406-1430
   ```

### Phase 3 : Conflict Detection & Resolution (2-3 jours)

**Objectif :** Détecter les conflits entre agents avant le merge.

1. **Clash integration**
   - Installer Clash dans l'image Docker `mnm-agent:latest`
   - Hook heartbeat post-run : `clash check` sur tous les worktrees actifs
   - Résultat → live event `git.conflict.detected`

2. **CAO conflict awareness**
   - Le watchdog écoute `git.conflict.detected`
   - Auto-comment sur l'issue avec le détail du conflit
   - Peut mettre en pause un agent si conflit critique (`agent.status → paused`)

3. **UI conflict dashboard**
   - Matrice de conflits par projet (quels agents/branches sont en conflit)
   - Block type dans le Blocks Platform : `ConflictMatrix`

### Phase 4 : Quality Gates & Merge Orchestration (5-7 jours)

**Objectif :** CI automatique et merge séquentiel orchestré.

1. **Post-run quality gates**
   - Après chaque run réussi → exécuter les tests du projet dans le sandbox
   - Résultat stocké dans `heartbeat_runs.resultJson`
   - Si tests fail → agent re-dispatché pour fix

2. **PR auto-creation**
   - Agent termine + tests passent → créer une PR automatiquement
   - Via GitHub/GitLab API (token stocké dans config layer)
   - PR liée à l'issue MnM

3. **Sequential merge orchestration**
   - Orchestrator gère l'ordre des merges
   - Merge un par un, re-run tests après chaque merge
   - Si conflit → re-dispatch à l'agent concerné

---

## Architecture Cible

```
┌─────────────────────────────────────────────────┐
│                    MnM Server                    │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Heartbeat │  │ Git      │  │ Conflict      │  │
│  │Service   │──│ Worktree │──│ Detector      │  │
│  │          │  │ Manager  │  │ (Clash)       │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│  ┌────┴─────┐  ┌────┴─────┐  ┌───────┴───────┐  │
│  │Workspace │  │Quality   │  │ CAO           │  │
│  │Resolver  │  │Gates     │  │ Watchdog      │  │
│  └────┬─────┘  └────┬─────┘  └───────────────┘  │
│       │              │                           │
└───────┼──────────────┼───────────────────────────┘
        │              │
┌───────┴──────────────┴───────────────────────────┐
│              Docker Sandbox (per-user)            │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Project  │  │ Worktree │  │ Worktree        │  │
│  │ (clone)  │  │ Agent A  │  │ Agent B         │  │
│  │ main     │  │ feat/X   │  │ fix/Y           │  │
│  └────┬─────┘  └──────────┘  └─────────────────┘  │
│       │                                           │
│  ┌────┴─────────────────────────────────────────┐ │
│  │ GitNexus Knowledge Graph (indexed)           │ │
│  │ → AGENTS.md, SKILL.md, MCP tools             │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ Clash (conflict watcher)                     │ │
│  └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

---

## Effort Estimé

| Phase | Effort | Dépendances |
|-------|--------|-------------|
| Phase 1 : Git Intelligence | 3-5j | npm gitnexus, image Docker |
| Phase 2 : Worktree Isolation | 3-5j | Phase 1 |
| Phase 3 : Conflict Detection | 2-3j | Phase 2, Clash CLI |
| Phase 4 : Quality Gates & Merge | 5-7j | Phase 2-3 |
| **Total** | **13-20j** | |

---

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| GitNexus trop lourd pour gros repos | Indexation lente, RAM sandbox | Limiter à 50K fichiers, indexation incrémentale |
| Clash pas encore stable | Faux positifs/négatifs | Utiliser en mode advisory, pas bloquant |
| Complexité git dans Docker | Permissions, SSH keys | Git HTTPS + token auth (déjà en place via OAuth) |
| Overhead worktrees | Espace disque sandbox | Cleanup automatique post-merge |

---

## Sources

- [GitNexus (GitHub)](https://github.com/abhigyanpatwari/GitNexus) — 19K+ stars
- [GitNexus on npm](https://www.npmjs.com/package/gitnexus)
- [GitNexus: Knowledge Graph for AI Agents](https://hoangyell.com/gitnexus-explained/)
- [GitNexus: Zero-Server Code Intelligence](https://www.bighatgroup.com/blog/gitnexus-zero-server-code-intelligence-ai-development/)
- [Clash (GitHub)](https://github.com/clash-sh/clash) — Conflict detection for parallel agents
- [Clash.sh](https://clash.sh/)
- [Nexus (nexi-lab)](https://github.com/nexi-lab/nexus) — Agent collaboration platform
- [Nexus MCP Integration](https://nexi-lab.github.io/nexus/integrations/mcp/)
- [The Code Agent Orchestra (Addy Osmani)](https://addyosmani.com/blog/code-agent-orchestra/)
- [Multi-Agent Coding Workspace (Augment Code)](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace)
- [Agentmaxxing: Parallel AI Agents](https://vibecoding.app/blog/agentmaxxing)
- [Git Worktrees for Parallel AI Agents (Medium)](https://medium.com/@mabd.dev/git-worktrees-the-secret-weapon-for-running-multiple-ai-coding-agents-in-parallel-e9046451eb96)

---

*Generated by BMAD Method v6 — Creative Intelligence*
