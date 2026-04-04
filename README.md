# MnM — Make no Mistake

```
███╗   ███╗          ███╗   ███╗
████╗ ████║  █████╗  ████╗ ████║
██╔████╔██║ ██╔══██╗ ██╔████╔██║
██║╚██╔╝██║ ██║  ██║ ██║╚██╔╝██║
██║ ╚═╝ ██║ ██║  ██║ ██║ ╚═╝ ██║
╚═╝     ╚═╝ ╚═╝  ╚═╝ ╚═╝     ╚═╝
```

> **Cockpit de supervision B2B pour l'orchestration d'agents IA, la gestion multi-tenant et la gouvernance enterprise.**

MnM est un fork de [Paperclip](https://github.com/paperclipai/paperclip) transformé en plateforme enterprise B2B self-hosted pour piloter des équipes d'agents IA. Le projet est né d'un constat : les humains ne doivent plus coder, mais superviser l'alignement entre intention et exécution.

Made by **Studio Manifeste**.

---

## De Paperclip à MnM : le pivot

**Paperclip** (upstream) est un orchestrateur d'agents IA mono-utilisateur orienté "zero-human companies".

**MnM** reprend ce socle et le transforme radicalement :

| | Paperclip | MnM |
|---|---|---|
| **Cible** | Développeur solo | Equipes enterprise B2B |
| **Modèle** | Mono-utilisateur | Multi-tenant (1 instance = 1 entreprise) |
| **Sécurité** | Confiance locale | RBAC dynamique + isolation par tags + RLS PostgreSQL |
| **Agents** | Exécution locale | Sandbox Docker par utilisateur |
| **Config** | JSONB opaque | Config Layers structurées (priorité, merge, OAuth) |
| **Observabilité** | Logs basiques | Pipeline de traces Bronze/Silver/Gold |
| **Communication** | Chat simple | Chat collaboratif temps réel, artifacts, RAG, @mentions |
| **Orchestration** | Basique | CAO (Chief Agent Officer) + workflows BMAD |
| **Gouvernance** | Aucune | Anti-shadow-AI, audit immutable, permissions granulaires |

---

## Vision

MnM n'est pas un IDE avec un copilote. C'est **un IDE concu POUR developper VIA des agents**.

Le paradigme change : l'humain passe de codeur à pilote. 80% strategie, 20% execution. Les agents sont la workforce, MnM est la tour de controle.

**5 piliers de valeur :**

1. **Orchestrateur d'agents IA** — Modele Kubernetes-for-agents : isolation, scheduling, health monitoring
2. **Fin du handoff lossy** — Contexte partage et requetable entre tous les roles (PO, dev, QA, manager)
3. **Dual-speed workflow** — Reflexion humaine (async) + execution machine (continue)
4. **Anti-shadow-AI** — Tous les agents visibles, coutables, gouvernes, audites
5. **Capture du savoir tacite** — Le savoir tribal devient un actif digital exploitable

---

## Stack technique

```
React 18 + TypeScript (shadcn/ui + Tailwind)
  ↓
Express.js API (35+ routes, auth middleware, rate limiting)
  ↓
71 Services backend (RBAC, orchestrateur, containers, audit, chat, drift, A2A, config layers)
  ↓
PostgreSQL 17 (51 tables, RLS sur 41) + Redis 7 (cache, pub/sub) + WebSocket (live events, chat)
  ↓
Agent Runtime (adapters, Docker containers, credential proxy, heartbeat)
```

**Monorepo Bun workspaces** avec 13 packages typechecked.

---

## Features implementees

### RBAC & Multi-tenant (15 stories)
- 4 roles dynamiques (Admin, Lead, Member, Viewer) stockes en DB
- 20+ permissions granulaires, matrice de permissions UI
- **Isolation par tags** : les utilisateurs ne voient que les agents/issues partageant au moins 1 tag
- RLS PostgreSQL sur 41 tables
- Invitations par email, import CSV bulk, inscription sur invitation uniquement

### Orchestration & Agents (5 stories)
- **CAO (Chief Agent Officer)** : agent systeme auto-cree, watchdog silencieux + interactif via @cao
- Machine a etats XState (12 transitions), WorkflowEnforcer, validation HITL
- Workflow templates BMAD (Brief -> PRD -> Architecture -> Stories -> Dev -> Test)
- Editeur visuel de workflows

### Sandbox & Securite (5 stories)
- Container Docker persistant par utilisateur
- 5 couches de securite : ephemere, read-only, mount allowlist, credential proxy, reseaux isoles
- Token OAuth Claude injecte par run (pas de credentials sur le filesystem sandbox)
- `docker exec` avec rewrite automatique localhost -> host.docker.internal

### Pipeline de Traces (8 stories)
- **Gold** (vue par defaut) : timeline intelligente, phases scorees, annotees, contextualisees
- **Silver** : observations groupees avec resumes
- **Bronze** : blocs JSON bruts (debug)
- Auto-generation a la completion du trace (pas de clic manuel)
- Enrichissement LLM hierarchique : global -> workflow -> agent -> issue

### Config Layers (5 stories)
- 8 tables DB, 22+ routes API, 6 services backend, 10+ composants frontend
- Types d'items : MCP Servers, Skills, Hooks, Settings — chacun avec editeur dedie
- Merge par priorite : Company enforced (999) > Base layer (500) > Additional (0-498)
- Detection de conflits avec advisory locks PostgreSQL
- OAuth2 PKCE pour credentials MCP (chiffrement AES-256-GCM)
- Historique de revisions avec snapshots

### Chat Collaboratif (18 stories)
- Chat temps reel 1-1 avec agents IA via WebSocket
- **Artifacts** : versiones, preview HTML dans side panel, CRUD via tools
- **Documents & RAG** : upload, ingestion pipeline, embeddings pgvector, recherche par similarite cosinus
- **Dossiers** : visibilite par tags (prive/public + tags directs), auto-save artifacts
- Slash commands, @mentions, streaming
- 8 tables DB, 13 nouvelles permissions

### Observabilite & Audit
- Table `audit_events` immutable (protegee par TRIGGER, partitionnee par mois)
- Auto-emission sur actions critiques
- UI AuditLog avec filtres et export
- Dashboard role-based avec cartes configurables, updates WebSocket temps reel

### Communication Agent-to-Agent
- Bus de communication A2A avec regles de permissions
- Trail d'audit pour chaque echange
- Connecteurs MCP

### Drift Detection
- Detection automatique de derive entre specs et code
- UI diff viewer side-by-side
- Persistence en DB

### Dual-Speed Workflow
- Curseurs d'automation (Manual/Assisted/Auto x 4 niveaux)
- Slider visuel UI + enforcement

---

## Architecture du repo

```
server/              Express backend (routes, services, middleware, realtime, auth)
ui/                  React frontend (pages, components, hooks, api)
packages/
  db/                Drizzle ORM schema, migrations (51 tables)
  shared/            Types partages (modeles B2B)
  adapters/          Adaptateurs agents (claude-local, cursor-local, codex-local, etc.)
  adapter-utils/     Utilitaires communs aux adaptateurs
  test-utils/        Factories et helpers de test
cli/                 CLI MnM (@mnm/cli, publie sur npm)
skills/              Skills Claude Code (mnm, mnm-create-agent, para-memory-files)
e2e/                 Tests Playwright E2E (70+ fichiers)
docs/                Plans d'implementation et specs
_bmad/               Framework BMAD (templates, NE PAS MODIFIER)
_bmad-output/        Artifacts de planning, brainstorms, reviews, stories
_research/           Recherches techniques (orchestration, OpenClaw, dashboard UX)
```

---

## Demarrage rapide

```bash
# Prerequis : Bun >= 1.3, Node >= 20, Docker

# Installation
bun install

# Dev (embedded PostgreSQL, pas besoin de Docker pour la DB)
bun run dev

# Ou avec PostgreSQL + Redis externes
bun run dev:docker:up    # Lance PG + Redis
bun run dev              # Lance le serveur
```

### Production (Docker Compose)

```bash
docker compose build server
docker compose up -d --wait
# Server sur http://127.0.0.1:3100 (mode authenticated, 41 tables RLS)
```

### Deploiement Dokploy

```bash
docker compose -f docker-compose.dokploy.yml up -d
```

---

## CLI

```bash
npx @mnm/cli configure   # Configuration initiale
npx @mnm/cli onboard     # Onboarding interactif
npx @mnm/cli doctor       # Diagnostic de l'installation
npx @mnm/cli run          # Lancer le serveur
npx @mnm/cli db-backup   # Backup de la base
```

---

## Commandes dev

```bash
bun install          # Installer les dependances
bun run dev          # Lancer en dev (server + ui, embedded postgres)
bun run build        # Build tous les packages
bun run typecheck    # Verification TypeScript (13/13 packages)
bun run test:e2e     # Tests Playwright E2E
```

---

## Decisions architecturales cles

| Decision | Justification |
|---|---|
| **Zero polling** | Tous les updates temps reel via SSE/WebSocket. Jamais de `setInterval` ou `refetchInterval`. |
| **Single-tenant** | 1 instance = 1 entreprise. `company_id` auto-injecte, jamais expose en UI. |
| **RBAC dynamique** | Roles et permissions en DB, jamais de constantes hardcodees. |
| **Tags > Teams** | Les tags sont additifs et flexibles. Score 8/8 sur le test CBA vs 5/8 pour Roles+Teams. |
| **Config Layers > JSONB** | Config structuree, mergeable, versionee, avec detection de conflits. |
| **Trace Gold par defaut** | L'utilisateur voit la synthese intelligente, pas le bruit brut. |
| **Container par user** | Isolation securisee, credentials injectees par run, pas persistees sur disque. |

---

## Chronologie du projet

| Date | Jalon |
|---|---|
| **Fev 2026** | Fork de Paperclip, premieres sessions de brainstorming |
| **19 fev** | Brainstorm Cross-Document Drift Detection (architecture fondatrice) |
| **21 fev** | Brainstorm IDE for Agent-Driven Dev — 45 idees, changement de paradigme |
| **Mar 2026** | Pivot B2B enterprise, migration PostgreSQL |
| **12 mar** | Brainstorm B2B Transformation — 5 piliers de valeur identifies |
| **16 mar** | Brainstorm Distributed Tracing — trace-as-context |
| **20-21 mar** | Decision architecture Roles+Tags, definition du CAO |
| **22 mar** | Sprint Roles+Tags termine (132 SP, tous P1 complete) |
| **23 mar** | Review architecture — 92% d'alignement avec les specs |
| **2 avr** | Epic Config Layers termine (5 stories, 47 SP) |
| **3 avr** | Epic Chat Collaboratif termine (18 stories, 80 SP) |
| **4 avr** | **69/69 stories B2B completees** — MVP enterprise ready |

---

## Metriques

- **292 commits** sur la branche B2B
- **503 fichiers** modifies
- **~194 000 lignes** ajoutees
- **69/69 stories** implementees (16 epics)
- **51 tables** PostgreSQL (41 avec RLS)
- **71 services** backend
- **35+ routes** API
- **99+ composants** React
- **70+ fichiers** de tests E2E
- **13 packages** typechecked

---

## Ce qui reste

| Item | Priorite | Description |
|---|---|---|
| Validation E2E complete | P1 | Deploy test instance, smoke test 8 scenarios CBA |
| Import Jira intelligent | P1 | Mapping semantique Jira -> MnM, dry-run preview |
| "Drive the Agent" Live UX | P1 | Split view code+chat, quick-actions, historique navigable |
| Distributed Tracing avance | P2 | OpenTelemetry, correlation trace/audit/drift, alertes |
| Drift Auto-Remediation | P2 | Politiques configurables, kill+relance automatique |
| Auto-Generated Connectors | P2 | Agent analyse API/codebase, genere un MCP server |
| MnM Self-Modifying | P3 | Les agents modifient MnM lui-meme |
| Brainstorm as Entry Point | P3 | Brainstorm humain -> output structure -> agents -> prod |
| Agent Communication Proxies | P3 | Echange de contexte machine-to-machine |
| AI Auto-Brainstorming | P3 | Detection de problemes, proposition de solutions |

---

## Sessions de brainstorming

Le projet a ete construit sur une reflexion approfondie documentee dans `_bmad-output/` :

- **Cross-Document Drift** (fev 19) — Detection de derive hierarchique entre documents de specs
- **IDE for Agent-Driven Dev** (fev 21) — 45 idees via assumption-reversal, morphological analysis, cross-pollination. Paradigme : superviser, pas coder.
- **B2B Transformation** (mar 12) — 24 idees via role-playing et what-if scenarios. 5 noyaux de valeur.
- **Distributed Tracing** (mar 16) — Trace-as-context, vision Langfuse-native
- **Enterprise Architecture** (mar 20-21) — Modele hybride Roles+Tags, CAO, pods Docker, task pools

---

## Credits

Fork de [Paperclip](https://github.com/paperclipai/paperclip) — orchestration for zero-human companies.

## Licence

MIT
