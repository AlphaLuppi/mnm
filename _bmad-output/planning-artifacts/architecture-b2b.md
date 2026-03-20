# Architecture B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 2.0 (Document fusionne complet) | **Date** : 2026-03-14 | **Statut** : Final
> **Contributeurs** : Winston (Lead Architecte), Dr. Quinn (Problem Solver), Amelia (Dev), Quinn (QA/Securite), Murat (Test Architect), John (PM), Mary (Compliance)
> **Sources** : PRD B2B v1.0, UX Design B2B v1.0, Nanoclaw Research, Code existant MnM

---

## Table des Matieres

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [ADRs — Architecture Decision Records](#3-adrs--architecture-decision-records)
4. [Database Schema Changes](#4-database-schema-changes)
5. [API Design](#5-api-design)
6. [Security Architecture](#6-security-architecture)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Performance & Scalability](#8-performance--scalability)
9. [Test Architecture & CI/CD](#9-test-architecture--cicd)
10. [Migration Strategy](#10-migration-strategy)
11. [Compliance Architecture](#11-compliance-architecture)

---

## 1. Architecture Overview

### 1.1 Diagramme d'Architecture Globale

```
+===========================================================================+
|                        COUCHE PRESENTATION (React 18)                      |
|                                                                            |
|  +------------------+  +------------------+  +------------------+          |
|  |   Pages (28)     |  |  Composants UI   |  | Design System    |          |
|  |  Dashboard, Org  |  |  shadcn/ui (22)  |  | Tokens, Themes   |          |
|  |  Workflows, Chat |  |  Custom B2B (13) |  | Dark/Light adapt |          |
|  +--------+---------+  +--------+---------+  +--------+---------+          |
|           |                      |                     |                    |
|  +--------v----------------------v---------------------v---------+         |
|  |                     State Management                          |         |
|  |  React Query (server)  |  Zustand (client)  |  Context (auth) |         |
|  +--------+--------------------------------------------------+--+         |
|           |              WebSocket (ws)                       |            |
+===========|==================================================|============+
            | REST API (HTTPS)                                  | WS Events
            |                                                   |
+===========v===================================================v============+
|                        COUCHE API (Express + tsx)                           |
|                                                                            |
|  +--------------------------------------------------------------------+   |
|  |                      Middleware Pipeline                            |   |
|  |  CORS -> Auth (Better Auth) -> CompanyContext -> RBAC -> RateLimit |   |
|  +--------------------------------------------------------------------+   |
|                                                                            |
|  +------------------+  +------------------+  +------------------+          |
|  | Routes REST (22) |  | Routes WS (1)    |  | Agent Auth (JWT) |          |
|  | /api/companies/* |  | /events/ws       |  | /api/agent-auth  |          |
|  +--------+---------+  +--------+---------+  +--------+---------+          |
+===========|======================|======================|==================+
            |                      |                      |
+===========v======================v======================v==================+
|                     COUCHE SERVICES (Business Logic)                       |
|                                                                            |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  | access.ts      | | workflows.ts   | | heartbeat.ts   | | drift.ts    |  |
|  | hasPermission  | | templates,     | | agent runs,    | | detection,  |  |
|  | canUser        | | instances,     | | events, logs   | | analysis,   |  |
|  | RBAC enforce   | | stages         | | sessions       | | reporting   |  |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  | agents.ts      | | live-events.ts | | companies.ts   | | secrets.ts  |  |
|  | CRUD, status,  | | EventEmitter,  | | CRUD, members, | | 4 providers |  |
|  | adapters       | | publish/sub    | | invites        | | versioned   |  |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  | issues.ts      | | projects.ts    | | costs.ts       | | activity.ts |  |
|  | CRUD, labels,  | | workspaces,    | | budget, usage  | | audit log   |  |
|  | comments       | | goals          | | events         | | structured  |  |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|                                                                            |
|  === NOUVEAUX SERVICES B2B ===                                             |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  | workflow-       | | chat-          | | container-     | | audit-      |  |
|  | enforcer.ts    | | manager.ts     | | manager.ts     | | enterprise  |  |
|  | state machine  | | WebSocket bidi | | Docker lifecycle| | immutable   |  |
|  | transitions    | | stdin pipe     | | credential proxy| | partitioned |  |
|  +----------------+ +----------------+ +----------------+ +-------------+  |
|  +----------------+ +----------------+ +----------------+                  |
|  | automation-    | | a2a-bus.ts     | | sso-           |                  |
|  | cursor.ts      | | inter-agent    | | manager.ts     |                  |
|  | 3 positions    | | messages       | | SAML/OIDC      |                  |
|  | 4 granularites | | human-in-loop  | | Better Auth    |                  |
|  +----------------+ +----------------+ +----------------+                  |
|                                                                            |
+===========|================================================================+
            |
+===========v================================================================+
|                     COUCHE DATA (PostgreSQL + Drizzle ORM)                  |
|                                                                            |
|  +----- Existant (38 tables) -----+  +----- Nouveau B2B (10 tables) -----+ |
|  | Auth: user, session, account,  |  | project_memberships               | |
|  |       verification             |  | automation_cursors                | |
|  | Tenant: companies, memberships,|  | chat_channels, chat_messages      | |
|  |         roles, grants, invites |  | container_profiles, instances     | |
|  | Agents: agents, api_keys,      |  | credential_proxy_rules            | |
|  |         runtime_state, sessions|  | audit_events (PARTITIONED)        | |
|  | Projects: projects, workspaces,|  | sso_configurations                | |
|  |           goals, issues        |  | import_jobs                       | |
|  | Workflow: templates, instances, |  +-----------------------------------+ |
|  |           stage_instances      |                                        |
|  | Execution: heartbeat_runs,     |  +----- PostgreSQL Features --------+  |
|  |            events, cost_events |  | Row-Level Security (RLS)         |  |
|  | Secrets: company_secrets,      |  | Partitionnement (audit_events)   |  |
|  |          secret_versions       |  | TRIGGER deny UPDATE/DELETE       |  |
|  +--------------------------------+  +-----------------------------------+  |
|                                                                             |
+=============================================================================+
            |
+===========v================================================================+
|                  COUCHE REAL-TIME (WebSocket + EventEmitter)                |
|                                                                            |
|  +--------------------------------------------------------------------+   |
|  |              live-events-ws.ts (WebSocket Server)                  |   |
|  |  Upgrade: /api/companies/:id/events/ws                            |   |
|  |  Auth: Bearer token (agent) | Session cookie (board/user)         |   |
|  |  Direction: Server -> Client (events)                             |   |
|  |  NOUVEAU: Client -> Server (chat input, agent commands)           |   |
|  +--------------------------------------------------------------------+   |
|                                                                            |
|  +--------------------------------------------------------------------+   |
|  |              live-events.ts (EventEmitter interne)                 |   |
|  |  publishLiveEvent({companyId, type, payload})                     |   |
|  |  subscribeCompanyLiveEvents(companyId, listener)                  |   |
|  |  Types: heartbeat.run.status, .event, .log, .chat                |   |
|  +--------------------------------------------------------------------+   |
|                                                                            |
+=============================================================================+
            |
+===========v================================================================+
|              COUCHE AGENT RUNTIME (Adapters + Containers)                   |
|                                                                            |
|  +------ Adapter Registry (8 types) ------+                                |
|  | claude-local  | codex-local  | pi-local |                               |
|  | cursor-local  | opencode     | openclaw |                               |
|  +----+-----------------------------------+                                |
|       |                                                                    |
|       v                                                                    |
|  +--------------------------------------------------------------------+   |
|  |              NOUVEAU: ContainerManager (dockerode)                 |   |
|  |                                                                    |   |
|  |  +-- Container Docker Ephemere (--rm) --+                         |   |
|  |  | Image: node:22-slim + outils profil  |                         |   |
|  |  | User: non-root (uid 1000)            |                         |   |
|  |  | Mounts: allowlist tamper-proof        |                         |   |
|  |  | .env: shadow -> /dev/null            |                         |   |
|  |  | Reseau: isole (network=none)         |                         |   |
|  |  | Limites: CPU, RAM, disk, timeout     |                         |   |
|  |  +--------------------------------------+                         |   |
|  |                                                                    |   |
|  |  +-- Credential Proxy HTTP ----------+                            |   |
|  |  | Express sur port local            |                            |   |
|  |  | Container recoit: placeholder key |                            |   |
|  |  | Proxy injecte: vraie API key      |                            |   |
|  |  | Agent ne voit JAMAIS le secret    |                            |   |
|  |  +-----------------------------------+                            |   |
|  +--------------------------------------------------------------------+   |
|                                                                            |
+=============================================================================+
            |
+===========v================================================================+
|                    COUCHE SECURITE (Transversale)                           |
|                                                                            |
|  +------- RBAC --------+  +------- Audit --------+  +---- Isolation ----+ |
|  | 4 roles metier       |  | activity_log existant|  | Company: RLS +   | |
|  | 15 permission keys   |  | audit_events nouveau |  |   companyId      | |
|  | scope JSONB (corrige)|  | immutable (TRIGGER)  |  | Agent: container | |
|  | presets configurables|  | partitioned by date  |  | Credentials:     | |
|  | hasPermission+scope  |  | retention 3 ans      |  |   proxy HTTP     | |
|  +----------------------+  +----------------------+  +------------------+ |
|                                                                            |
+=============================================================================+
```

### 1.2 Flux de Donnees Principaux

#### Flux 1 : Requete Utilisateur -> Lancement Agent -> Execution Workflow

```
Utilisateur (React)
  |
  | 1. POST /api/companies/:cid/workflows/:wid/start
  |    Headers: Authorization (session cookie)
  |
  v
Express Middleware Pipeline
  |
  | 2. Auth: Better Auth resout session -> userId
  | 3. CompanyContext: verifie membership active
  | 4. RBAC: canUser(companyId, userId, "agents:create")
  | 5. Scope: verifie acces au projet du workflow (JSONB scope)
  |
  v
WorkflowService.startInstance()
  |
  | 6. Charge le workflow_template (stages JSONB)
  | 7. Cree workflow_instance (status: "active")
  | 8. Cree stage_instances pour chaque etape
  |
  v
WorkflowEnforcer (NOUVEAU)
  |
  | 9. State machine: determine l'etape courante
  | 10. Valide les preconditions (fichiers obligatoires, inputs)
  | 11. Injecte les pre-prompts de l'etape
  |
  v
HeartbeatService.triggerRun()
  |
  | 12. Cree heartbeat_run (status: "queued")
  | 13. Selectionne l'agent par role (stage.agentRole)
  | 14. ContainerManager.spawn() OU runChildProcess()
  |       - Si containerise: Docker run --rm avec profil
  |       - Si local: spawn process direct
  |
  v
Agent Execution (dans container ou process)
  |
  | 15. Agent recoit: pre-prompt + contexte + fichiers
  | 16. Agent execute la tache
  | 17. Streaming: stdout events -> WebSocket -> UI
  | 18. Chat bidirectionnel: UI -> WebSocket -> stdin agent
  |
  v
Completion
  |
  | 19. Agent termine -> heartbeat_run (status: "finished")
  | 20. Validation output vs acceptance_criteria
  | 21. WorkflowEnforcer: transition vers etape suivante
  | 22. audit_events: log de l'execution complete
  | 23. publishLiveEvent -> WebSocket -> UI mise a jour
```

#### Flux 2 : Observabilite Temps Reel

```
Agent (container/process)
  |
  | stdout/stderr events (pendant execution)
  |
  v
HeartbeatService
  |
  | heartbeat_run_events (persiste en DB)
  | publishLiveEvent(type: "heartbeat.run.event")
  |
  v
live-events.ts (EventEmitter)
  |
  | emitter.emit(companyId, event)
  |
  v
live-events-ws.ts (WebSocket Server)
  |
  | Pour chaque client WS abonne a companyId:
  |   socket.send(JSON.stringify(event))
  |
  v
React (LiveUpdatesProvider)
  |
  | useWebSocket() recoit l'event
  | React Query invalidation selective
  | UI update temps reel (< 50ms)
```

#### Flux 3 : Drift Detection

```
DriftService (periodique ou on-demand)
  |
  | 1. Pour chaque workflow_instance active:
  |    - Charge le template + etapes
  |    - Compare etat attendu vs etat observe
  |
  v
DriftAnalyzer (LLM-assisted)
  |
  | 2. Envoie le contexte a un LLM:
  |    - Specifications de l'etape (acceptance_criteria)
  |    - Output reel de l'agent
  |    - Historique du workflow
  |
  | 3. LLM retourne: {severity, type, description, recommendation}
  |
  v
DriftReport
  |
  | 4. Persiste en reportCache (DETTE: en memoire seulement)
  |    FUTUR: table drift_reports en DB
  | 5. Si severity >= warning:
  |    publishLiveEvent(type: "drift.detected")
  |
  v
UI: DriftAlert component
  |
  | 6. Affiche: attendu vs observe (diff visuel)
  | 7. Actions: Ignorer | Recharger | Kill+relance | Alerter CTO
```

### 1.3 Couches et Responsabilites

| Couche | Technologie | Responsabilite | Fichiers cles |
|--------|-------------|----------------|---------------|
| **Presentation** | React 18, Vite, shadcn/ui, Tailwind, React Query, Zustand | Rendering UI, state management, interactions utilisateur, mode adaptatif (5 modes) | `ui/src/` (28 pages, composants) |
| **API** | Express, tsx, Better Auth | Routing REST, authentification, autorisation, validation, rate limiting | `server/src/routes/` (22 fichiers) |
| **Services** | TypeScript pur | Logique metier, orchestration, RBAC, audit, drift | `server/src/services/` (31 fichiers) |
| **Data** | PostgreSQL, Drizzle ORM | Persistance, schema, migrations, RLS, partitionnement | `packages/db/src/schema/` (38 tables) |
| **Real-time** | WebSocket (ws), EventEmitter | Events temps reel, notification, chat bidirectionnel | `server/src/realtime/` |
| **Agent Runtime** | Adapter pattern, Docker (dockerode) | Execution agents, containerisation, credential proxy | `packages/adapters/` (6 types), `packages/adapter-utils/` |
| **Securite** | Transversale | RBAC, audit, isolation tenant, chiffrement, input sanitization | `server/src/services/access.ts`, middleware |

### 1.4 Interfaces entre Couches

| Interface | Protocole | Format | Authentification |
|-----------|-----------|--------|-----------------|
| UI <-> API | HTTPS (REST) | JSON | Session cookie (Better Auth) |
| UI <-> WS | WSS | JSON events | Session cookie ou Bearer token |
| API <-> Services | Appels directs TypeScript | Objets TS | Contexte transmis par middleware |
| Services <-> DB | Drizzle ORM | SQL genere | Connection pool |
| Services <-> Agents | stdin/stdout + WebSocket | JSON + text | Agent API key (JWT) |
| Agents <-> LLM APIs | HTTPS | JSON (API specifique) | Credential proxy (placeholder -> vraie cle) |

---


---

## 2. Structure Monorepo

### 2.1 Structure Actuelle

```
mnm/
|
+-- packages/
|   +-- shared/              # Types, constantes, validateurs partages
|   |   +-- src/
|   |       +-- constants.ts  # PERMISSION_KEYS (6 actuelles), roles, statuts
|   |       +-- types/        # Types TypeScript partages
|   |       +-- validators/   # Schemas Zod partages
|   |
|   +-- db/                  # Schema Drizzle, migrations, types DB
|   |   +-- src/
|   |       +-- schema/       # 38 tables (1 fichier par table)
|   |       +-- index.ts      # Re-exports
|   |
|   +-- adapter-utils/       # Utilitaires communs aux adapters
|   |   +-- src/
|   |       +-- server-utils.ts  # runChildProcess(), gestion stdout/stderr
|   |
|   +-- adapters/            # Adapters pour chaque type d'agent
|       +-- claude-local/    # Adapter Claude Code (process local)
|       +-- codex-local/     # Adapter OpenAI Codex
|       +-- cursor-local/    # Adapter Cursor
|       +-- openclaw-gateway/ # Adapter OpenClaw (gateway)
|       +-- opencode-local/  # Adapter OpenCode
|       +-- pi-local/        # Adapter Pi
|
+-- server/                  # Backend Express
|   +-- src/
|       +-- auth/            # Configuration Better Auth
|       +-- middleware/       # Logger, auth, error handling
|       +-- realtime/        # WebSocket server (live-events-ws.ts)
|       +-- routes/          # 22 fichiers de routes REST
|       +-- services/        # 31 services metier
|       +-- secrets/         # 4 providers (local, AWS, GCP, Vault)
|       +-- storage/         # Stockage de fichiers
|       +-- types/           # Types internes au serveur
|       +-- app.ts           # Configuration Express
|       +-- index.ts         # Point d'entree
|
+-- ui/                      # Frontend React
|   +-- src/
|       +-- adapters/        # Adapters frontend
|       +-- api/             # Clients API (React Query hooks)
|       +-- components/      # Composants reutilisables
|       +-- context/         # Providers React (Auth, LiveUpdates, Theme)
|       +-- hooks/           # Hooks custom
|       +-- lib/             # Utilitaires
|       +-- pages/           # 28 pages
|       +-- App.tsx          # Router principal
|       +-- main.tsx         # Point d'entree
|
+-- _bmad/                   # Framework BMAD (agents, workflows)
+-- _bmad-output/            # Artefacts de planification
+-- _research/               # Recherche et analyses techniques
```

### 2.2 Nouveaux Modules B2B

Les ajouts suivants sont necessaires pour la transformation B2B. Ils s'integrent dans la structure monorepo existante sans la re-architecturer.

```
mnm/
|
+-- packages/
|   +-- shared/
|   |   +-- src/
|   |       +-- constants.ts       # +9 PERMISSION_KEYS (15 total)
|   |       +-- types/
|   |       |   +-- rbac.ts        # NOUVEAU: types RBAC (BusinessRole, RolePreset)
|   |       |   +-- chat.ts        # NOUVEAU: types chat (ChatMessage, ChatChannel)
|   |       |   +-- container.ts   # NOUVEAU: types container (ContainerProfile, etc.)
|   |       |   +-- automation.ts  # NOUVEAU: types curseur (AutomationLevel, CursorScope)
|   |       |   +-- a2a.ts         # NOUVEAU: types A2A (A2ARequest, A2APermission)
|   |       +-- validators/
|   |           +-- rbac.ts        # NOUVEAU: validateurs roles/permissions
|   |           +-- chat.ts        # NOUVEAU: validateurs messages chat
|   |           +-- container.ts   # NOUVEAU: validateurs profils container
|   |
|   +-- db/
|   |   +-- src/
|   |       +-- schema/
|   |           +-- project_memberships.ts    # NOUVEAU (T1)
|   |           +-- automation_cursors.ts     # NOUVEAU (T2)
|   |           +-- chat_channels.ts          # NOUVEAU (T3)
|   |           +-- chat_messages.ts          # NOUVEAU (T4)
|   |           +-- container_profiles.ts     # NOUVEAU (T5)
|   |           +-- container_instances.ts    # NOUVEAU (T6)
|   |           +-- credential_proxy_rules.ts # NOUVEAU (T7)
|   |           +-- audit_events.ts           # NOUVEAU (T8, PARTITIONED)
|   |           +-- sso_configurations.ts     # NOUVEAU (T9)
|   |           +-- import_jobs.ts            # NOUVEAU (T10)
|   |
|   +-- adapter-utils/
|       +-- src/
|           +-- server-utils.ts     # MODIFIE: stdin pipe au lieu de "ignore"
|           +-- container-utils.ts  # NOUVEAU: utilitaires Docker
|
+-- server/
|   +-- src/
|       +-- services/
|       |   +-- access.ts             # MODIFIE: hasPermission() + scope JSONB
|       |   +-- workflow-enforcer.ts   # NOUVEAU: state machine d'enforcement
|       |   +-- chat-manager.ts        # NOUVEAU: gestion chat bidirectionnel
|       |   +-- container-manager.ts   # NOUVEAU: lifecycle containers Docker
|       |   +-- credential-proxy.ts    # NOUVEAU: proxy HTTP pour credentials
|       |   +-- automation-cursor.ts   # NOUVEAU: gestion curseur automatisation
|       |   +-- a2a-bus.ts             # NOUVEAU: bus messages inter-agents
|       |   +-- audit-enterprise.ts    # NOUVEAU: audit immutable partitionne
|       |   +-- sso-manager.ts         # NOUVEAU: gestion SSO SAML/OIDC
|       |   +-- import-manager.ts      # NOUVEAU: import Jira/Linear/ClickUp
|       |   +-- role-presets.ts        # NOUVEAU: presets de roles RBAC
|       |
|       +-- routes/
|       |   +-- chat.ts               # NOUVEAU: endpoints chat
|       |   +-- containers.ts         # NOUVEAU: endpoints containers
|       |   +-- automation.ts         # NOUVEAU: endpoints curseur
|       |   +-- sso.ts                # NOUVEAU: endpoints SSO config
|       |   +-- import.ts             # NOUVEAU: endpoints import
|       |   +-- audit.ts              # NOUVEAU: endpoints audit enterprise
|       |
|       +-- realtime/
|           +-- live-events-ws.ts     # MODIFIE: +chat bidirectionnel
|           +-- chat-ws-handler.ts    # NOUVEAU: handler WebSocket chat
|
+-- ui/
    +-- src/
        +-- components/
        |   +-- chat/                 # NOUVEAU: ChatPanel, MessageBubble, etc.
        |   +-- workflow/             # NOUVEAU: WorkflowPipeline, StageCard, etc.
        |   +-- rbac/                 # NOUVEAU: RoleSelector, PermissionMatrix, etc.
        |   +-- containers/           # NOUVEAU: ContainerStatus, ResourceMonitor
        |   +-- automation/           # NOUVEAU: AutomationCursor slider
        |   +-- onboarding/           # NOUVEAU: OnboardingChat, OrgChart
        |   +-- drift/                # NOUVEAU: DriftAlert, DriftDiff
        |
        +-- pages/
        |   +-- Members.tsx           # NOUVEAU: page Membres
        |   +-- RoleAdmin.tsx         # NOUVEAU: admin roles/permissions
        |   +-- SSOConfig.tsx         # NOUVEAU: config SSO
        |   +-- AuditLog.tsx          # NOUVEAU: consultation audit
        |   +-- ContainerMonitor.tsx  # NOUVEAU: monitoring containers
        |   +-- ImportWizard.tsx      # NOUVEAU: import Jira/Linear
        |
        +-- hooks/
            +-- useAgentChat.ts       # NOUVEAU: hook WebSocket chat
            +-- useAutomationCursor.ts # NOUVEAU: hook curseur
            +-- usePermissions.ts     # NOUVEAU: hook RBAC cote client
```

### 2.3 Dependances entre Packages

```
                    packages/shared
                    (types, constantes, validateurs)
                         |
              +----------+----------+
              |                     |
         packages/db           packages/adapter-utils
         (schema Drizzle)      (utilitaires adapters)
              |                     |
              |          +----------+----------+
              |          |          |          |
              |     adapters/  adapters/  adapters/
              |     claude     codex      cursor     ... (6 total)
              |          |          |          |
              +-----+----+----+----+----+-----+
                    |              |
                 server/        (utilise tous)
                 (Express, services, routes)
                    |
                 ui/
                 (React, pages, composants)
```

**Regles de dependances** :
- `shared` ne depend d'aucun autre package (feuille)
- `db` depend de `shared` (pour les types)
- `adapter-utils` depend de `shared` (pour les types)
- Chaque adapter depend de `adapter-utils` et `shared`
- `server` depend de tous les packages
- `ui` depend de `shared` (types) et communique avec `server` via HTTP/WS

**Impact B2B** : Les nouveaux modules s'ajoutent dans les packages existants. Aucun nouveau package racine n'est necessaire. Les types B2B vont dans `shared`, les schemas dans `db`, les services dans `server`, les composants dans `ui`.

### 2.4 Scripts et Build

```json
{
  "scripts": {
    "dev": "concurrently server:dev ui:dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:e2e": "cypress run",
    "db:migrate": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  }
}
```

Le build suit l'ordre topologique des dependances : `shared` -> `db` -> `adapter-utils` -> `adapters/*` -> `server` -> `ui`.

---


---

## 3. ADRs — Architecture Decision Records

### ADR-001 : Multi-tenant

### Contexte

MnM doit supporter plusieurs `companies` (tenants) sur la meme instance PostgreSQL. Le schema actuel possede deja la colonne `company_id` sur la majorite des tables (companies, agents, projects, workflows, issues, heartbeat_runs, activity_log, etc.) et toutes les routes passent par un middleware `assertCompanyAccess`. Cependant, l'isolation n'est pas enforcee au niveau de la base de donnees — elle repose uniquement sur le code applicatif.

Pour le B2B enterprise, un client qui decouvre qu'il peut acceder aux donnees d'un autre tenant detruirait toute confiance. L'isolation doit etre **defense-in-depth** : meme un bug dans le code applicatif ne doit pas permettre un acces cross-tenant.

### Options Evaluees

#### Option A : Row-Level Security (RLS) PostgreSQL

PostgreSQL permet de definir des politiques de securite au niveau des lignes. Chaque requete est automatiquement filtree par la politique active, basee sur un parametre de session (`SET app.current_company_id`).

```sql
-- Exemple de politique RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON agents
  USING (company_id = current_setting('app.current_company_id')::uuid);
```

**Avantages** :
- Defense-in-depth : meme un bug dans le code applicatif ne peut pas acceder aux donnees d'un autre tenant
- Transparent pour Drizzle ORM — les queries restent identiques
- Performance : le planificateur PostgreSQL optimise les filtres RLS comme des conditions WHERE normales
- Compatibilite avec les index existants (deja indexes par `company_id`)
- Pas de duplication de schema ou de bases de donnees
- Backups unifies, migrations unifiees
- Le schema actuel est deja pret (37/38 tables ont `company_id`)

**Inconvenients** :
- Necessite un `SET` par connexion (ou transaction) — impacte le connection pooling
- Les super-requetes cross-tenant (admin/reporting) necessitent un bypass explicite
- Complexite de debug : les queries qui "ne retournent rien" peuvent etre dues a un RLS mal configure

#### Option B : Base de donnees par tenant

Chaque company a sa propre base de donnees PostgreSQL.

**Avantages** :
- Isolation totale par design
- Backup/restore par tenant independant
- Pas de risque de fuite cross-tenant

**Inconvenients** :
- **Explosion de la complexite operationnelle** : migrations a appliquer sur N bases
- Connection pooling par tenant (N pools au lieu de 1)
- Requetes cross-tenant impossibles (reporting, admin)
- Incompatible avec le schema actuel (FK cross-company sur `instance_user_roles`, `company_memberships`)
- Cout infrastructure multiplie

#### Option C : Schema par tenant

Chaque company a son propre schema PostgreSQL dans la meme base.

**Avantages** :
- Bonne isolation logique
- Migrations par schema
- Backup par schema possible

**Inconvenients** :
- Memes problemes que Option B pour les migrations et le connection pooling
- Complexite de routing des requetes
- Incompatible avec Drizzle ORM sans modifications majeures
- Le schema actuel ne supporte pas cette approche

### Decision

**Option A — Row-Level Security PostgreSQL**

### Rationale

1. **Le schema est deja pret** : 37 des 38 tables possedent un `company_id`. Les index existent deja. Le travail applicatif est principalement fait (middleware `assertCompanyAccess`, filtrage dans les services). RLS ajoute une couche de securite sans restructuration.

2. **Defense-in-depth** : Le code applicatif filtre deja par `company_id`. RLS agit comme filet de securite : si un developpeur oublie un filtre ou introduit un bug, PostgreSQL bloque quand meme l'acces cross-tenant.

3. **Compatibilite Drizzle ORM** : Les requetes Drizzle generent du SQL standard. RLS est transparent — aucune modification des queries existantes.

4. **Operations unifiees** : Une seule base, un seul pool de connexions, des migrations unifiees, des backups unifies. La complexite operationnelle reste minimale pour une equipe de 2-3 developpeurs.

5. **Le profil de MnM** : Avec une cible de 500 companies max par instance (NFR), le volume ne justifie pas l'isolation par DB/schema. RLS scale largement a ce niveau.

### Consequences

**Positives** :
- Isolation tenant garantie au niveau PostgreSQL, meme en cas de bug applicatif
- Pas de re-architecture du schema ou des queries
- Migrations et operations simplifiees
- Les 4 tables sans `company_id` (auth: `user`, `session`, `account`, `verification`) sont des tables globales — pas de RLS necessaire

**Negatives** :
- Chaque requete DB doit setter `app.current_company_id` via `SET LOCAL` en debut de transaction
- Impact sur le connection pooling : utiliser `SET LOCAL` (scope transaction) au lieu de `SET` (scope session) pour compatibilite avec les pools
- Les requetes admin cross-tenant necessitent un role PostgreSQL avec `BYPASSRLS`
- Tests d'integration doivent verifier l'isolation RLS explicitement

**Implementation** :

1. **Migration SQL** : Activer RLS sur chaque table avec `company_id` et creer les politiques
2. **Middleware Drizzle** : Wrapper qui execute `SET LOCAL app.current_company_id = $1` avant chaque transaction
3. **Role admin** : Role PostgreSQL `mnm_admin` avec `BYPASSRLS` pour les queries de maintenance
4. **Tests** : Suite de tests d'isolation verifiant qu'un tenant ne peut jamais acceder aux donnees d'un autre, meme avec des queries brutes

```sql
-- Migration RLS pour toutes les tables avec company_id
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'company_id' AND table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
       USING (company_id = current_setting(''app.current_company_id'')::uuid)',
      tbl
    );
  END LOOP;
END $$;
```

---


### ADR-002 : Auth (Better Auth + RBAC + SSO)

### Contexte

MnM utilise deja **Better Auth** pour l'authentification (email/password, sessions en DB). Le schema auth comprend 4 tables (`user`, `session`, `account`, `verification`). Le systeme de permissions existe via `principal_permission_grants` avec 6 cles de permissions et un champ `scope` JSONB.

La transformation B2B necessite :
1. **RBAC metier** : 4 roles (Admin, Manager, Contributor, Viewer) avec presets de permissions
2. **Correction du trou `hasPermission()`** : le scope JSONB est stocke mais **jamais lu ni applique** (access.ts:45-66)
3. **SSO SAML/OIDC** pour les clients enterprise
4. **9 nouvelles cles de permissions** pour couvrir les fonctionnalites B2B

### Etat Actuel — Analyse du Code

Le service `access.ts` contient la fonction `hasPermission()` (lignes 45-66) :

```typescript
// ACTUEL — access.ts:45-66
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;
  const grant = await db
    .select({ id: principalPermissionGrants.id })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
        eq(principalPermissionGrants.permissionKey, permissionKey),
      ),
    )
    .then((rows) => rows[0] ?? null);
  return Boolean(grant);
}
```

**Probleme critique** : La colonne `scope` (JSONB) sur `principal_permission_grants` est **completement ignoree**. Un utilisateur avec la permission `agents:create` scopee a un seul projet a en realite acces a TOUS les agents de la company. C'est un trou de securite qui doit etre corrige avant tout deploiement B2B.

### Decision

**Extension du systeme Better Auth existant avec RBAC metier, correction du scope, et SSO via plugins Better Auth.**

### Architecture RBAC Cible

#### 4.1 Roles Metier et Presets

```typescript
// role-presets.ts (NOUVEAU)
export const BUSINESS_ROLES = ["admin", "manager", "contributor", "viewer"] as const;
export type BusinessRole = typeof BUSINESS_ROLES[number];

export const ROLE_PRESETS: Record<BusinessRole, PermissionKey[]> = {
  admin: [
    // Toutes les permissions
    "agents:create", "agents:manage", "agents:delete",
    "users:invite", "users:manage_permissions", "users:remove",
    "tasks:assign", "tasks:assign_scope",
    "joins:approve",
    "workflows:create", "workflows:manage",
    "projects:create", "projects:manage",
    "audit:read", "audit:export",
    "sso:configure",
  ],
  manager: [
    "agents:create", "agents:manage",
    "users:invite",
    "tasks:assign", "tasks:assign_scope",
    "joins:approve",
    "workflows:create", "workflows:manage",
    "projects:create", "projects:manage",
    "audit:read",
  ],
  contributor: [
    "agents:create",
    "tasks:assign",
    "projects:create",
  ],
  viewer: [
    // Lecture seule implicite — aucune permission de mutation
  ],
};
```

#### 4.2 Permission Keys (15 total)

| Cle | Description | Roles |
|-----|-------------|-------|
| `agents:create` | Creer un agent | Admin, Manager, Contributor |
| `agents:manage` | Modifier config, statut d'un agent | Admin, Manager |
| `agents:delete` | Supprimer un agent | Admin |
| `users:invite` | Inviter des utilisateurs | Admin, Manager |
| `users:manage_permissions` | Modifier roles/permissions | Admin |
| `users:remove` | Supprimer un utilisateur | Admin |
| `tasks:assign` | Assigner des taches/issues | Admin, Manager, Contributor |
| `tasks:assign_scope` | Assigner avec scope projet | Admin, Manager |
| `joins:approve` | Approuver les demandes d'acces | Admin, Manager |
| `workflows:create` | Creer des templates de workflow | Admin, Manager |
| `workflows:manage` | Modifier/supprimer des workflows | Admin, Manager |
| `projects:create` | Creer un projet | Admin, Manager, Contributor |
| `projects:manage` | Modifier/archiver un projet | Admin, Manager |
| `audit:read` | Consulter les logs d'audit | Admin, Manager |
| `audit:export` | Exporter les logs d'audit | Admin |
| `sso:configure` | Configurer SSO SAML/OIDC | Admin |

#### 4.3 Correction de `hasPermission()` — Lecture du Scope

```typescript
// CORRIGE — access.ts
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  resourceScope?: { projectId?: string },
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  const grants = await db
    .select({
      id: principalPermissionGrants.id,
      scope: principalPermissionGrants.scope,
    })
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
        eq(principalPermissionGrants.permissionKey, permissionKey),
      ),
    );

  if (grants.length === 0) return false;

  // Si aucun scope demande -> toute grant suffit
  if (!resourceScope) return true;

  // Verifier que au moins une grant couvre le scope demande
  return grants.some((grant) => {
    // Grant sans scope = acces global (toute la company)
    if (!grant.scope) return true;

    // Grant avec scope = verifier match
    const scopeData = grant.scope as { projectIds?: string[] };
    if (resourceScope.projectId && scopeData.projectIds) {
      return scopeData.projectIds.includes(resourceScope.projectId);
    }

    // Scope non reconnu -> acces refuse par defaut
    return false;
  });
}
```

**Changements cles** :
- Nouveau parametre optionnel `resourceScope` pour specifier le contexte d'acces
- Si pas de scope demande : comportement existant (backward compatible)
- Si scope demande : verifie que la grant couvre le projet
- Grant sans scope JSONB = acces global (invariant INV-04)
- Grant avec scope JSONB = acces restreint aux projets listes

#### 4.4 Modification de `canUser()`

```typescript
async function canUser(
  companyId: string,
  userId: string | null | undefined,
  permissionKey: PermissionKey,
  resourceScope?: { projectId?: string },
): Promise<boolean> {
  if (!userId) return false;
  if (await isInstanceAdmin(userId)) return true;
  return hasPermission(companyId, "user", userId, permissionKey, resourceScope);
}
```

#### 4.5 Impact sur les Routes (22 fichiers)

Chaque route qui appelle `canUser()` doit potentiellement passer le scope du projet :

```typescript
// AVANT (routes/agents.ts)
if (!(await svc.access.canUser(companyId, userId, "agents:create"))) {
  return res.status(403).json({ error: "Forbidden" });
}

// APRES
if (!(await svc.access.canUser(companyId, userId, "agents:create", { projectId }))) {
  return res.status(403).json({ error: "Forbidden" });
}
```

Les routes sans contexte projet continuent de fonctionner sans modification (backward compatible).

#### 4.6 SSO SAML/OIDC

Better Auth supporte les plugins d'authentification. L'integration SSO se fait via :

1. **Table `sso_configurations`** : stocke la config SAML/OIDC par company
2. **Plugin Better Auth** : extension qui redirige vers l'IdP configure
3. **Mapping claims** : les attributs SAML/OIDC sont mappes vers les roles MnM

```typescript
// sso_configurations schema
export const ssoConfigurations = pgTable("sso_configurations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  provider: text("provider").notNull(), // "saml" | "oidc"
  config: jsonb("config").notNull(), // IdP metadata, client ID/secret, etc.
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Consequences

**Positives** :
- Le trou de securite `scope` est corrige — invariant INV-04 respecte
- 4 roles metier clairs avec presets configurables
- Backward compatible : le code existant continue de fonctionner
- SSO via plugins Better Auth — pas de changement de framework auth
- 15 permission keys couvrent tous les besoins B2B identifies dans le PRD

**Negatives** :
- 22 fichiers de routes a auditer et potentiellement modifier pour passer le scope
- Les presets sont un raccourci — les permissions restent stockees individuellement en DB (pas de table "roles")
- SSO necessite un travail d'integration specifique par IdP client

---


### ADR-003 : Orchestrateur Deterministe

### Contexte

MnM possede deja un systeme de workflows avec 3 tables (`workflow_templates`, `workflow_instances`, `stage_instances`) et un service (`workflows.ts`, 267 lignes) qui gere les templates, instances et etapes. Cependant, le systeme actuel est **descriptif, pas prescriptif** : il enregistre les etapes et leur statut, mais ne les **impose pas** aux agents. Un agent peut sauter une etape, ignorer les fichiers obligatoires, ou deriver de son workflow sans que MnM ne l'empeche.

La Verite #45 du brainstorming confirme le probleme : *"Les agents sautent des etapes, ne chargent pas les bons fichiers, derivent sans controle."* Le PRD exige un orchestrateur **deterministe** (INV-02) : l'agent n'interprete pas le workflow — MnM l'execute pour lui.

### Decision

**Implementation d'une state machine deterministique qui enforce les transitions, valide les preconditions, et injecte les pre-prompts a chaque etape.**

### Architecture de l'Orchestrateur

#### 5.1 State Machine des Etapes

```
                                    WORKFLOW INSTANCE
    +==================================================================+
    |                                                                    |
    |  [created] --start--> [active] --complete--> [completed]          |
    |                          |                                        |
    |                          +--cancel--> [cancelled]                 |
    |                          +--error---> [failed]                    |
    |                                                                    |
    +==================================================================+

                                   STAGE INSTANCE
    +==================================================================+
    |                                                                    |
    |           preconditions                 postconditions             |
    |           validees?                     validees?                  |
    |              |                             |                       |
    |  [pending] --+-yes--> [running] --+-yes--> [completed]            |
    |              |                    |                                |
    |              +-no---> [blocked]   +-no---> [failed]               |
    |                                   |                                |
    |                                   +-drift--> [drifted]            |
    |                                   |                                |
    |                                   +-cancel-> [cancelled]          |
    |                                   |                                |
    |                                   +-compact-> [compacting]        |
    |                                       |                            |
    |                                       +--> [running] (relance)    |
    |                                                                    |
    +==================================================================+
```

**Transitions valides** :

| Etat source | Evenement | Etat cible | Conditions |
|-------------|-----------|-----------|------------|
| `pending` | `start` | `running` | Etape precedente completed, preconditions OK |
| `pending` | `block` | `blocked` | Preconditions non satisfaites |
| `blocked` | `unblock` | `pending` | Preconditions devenues satisfaites |
| `running` | `complete` | `completed` | Postconditions OK (acceptance criteria) |
| `running` | `fail` | `failed` | Erreur agent ou postconditions KO |
| `running` | `drift` | `drifted` | Drift detecte (severite >= warning) |
| `running` | `cancel` | `cancelled` | Annulation utilisateur |
| `running` | `compact` | `compacting` | Compaction LLM detectee |
| `compacting` | `relaunch` | `running` | Kill+relance avec contexte frais |
| `drifted` | `resolve` | `running` | Utilisateur ignore le drift |
| `drifted` | `kill_relaunch` | `running` | Kill+relance apres drift |
| `drifted` | `cancel` | `cancelled` | Utilisateur annule |

#### 5.2 Service WorkflowEnforcer

```typescript
// workflow-enforcer.ts (NOUVEAU)

interface StageTransition {
  from: StageStatus;
  event: StageEvent;
  to: StageStatus;
  guard?: (context: TransitionContext) => Promise<boolean>;
  action?: (context: TransitionContext) => Promise<void>;
}

interface TransitionContext {
  workflowInstance: WorkflowInstance;
  stageInstance: StageInstance;
  agent?: Agent;
  run?: HeartbeatRun;
  userId?: string;
}

export function workflowEnforcerService(db: Db) {

  // Table de transitions (state machine)
  const transitions: StageTransition[] = [
    {
      from: "pending",
      event: "start",
      to: "running",
      guard: async (ctx) => {
        // 1. Verifier que l'etape precedente est completed
        const prevCompleted = await isPreviousStageCompleted(ctx);
        // 2. Verifier les fichiers obligatoires
        const filesPresent = await areRequiredFilesPresent(ctx);
        return prevCompleted && filesPresent;
      },
      action: async (ctx) => {
        // Injecter les pre-prompts de l'etape
        await injectStagePrePrompts(ctx);
        // Lancer le run agent
        await triggerAgentRun(ctx);
      },
    },
    // ... autres transitions
  ];

  async function transition(
    stageId: string,
    event: StageEvent,
    context: Partial<TransitionContext>,
  ): Promise<StageInstance> {
    const stage = await getStageInstance(stageId);
    const validTransition = transitions.find(
      (t) => t.from === stage.status && t.event === event,
    );

    if (!validTransition) {
      throw new Error(
        `Transition invalide: ${stage.status} --(${event})--> ? ` +
        `Transitions valides depuis ${stage.status}: ` +
        transitions.filter(t => t.from === stage.status).map(t => t.event).join(", ")
      );
    }

    const fullContext = { ...context, stageInstance: stage } as TransitionContext;

    // Evaluer la garde (preconditions)
    if (validTransition.guard) {
      const allowed = await validTransition.guard(fullContext);
      if (!allowed) {
        // Transition vers "blocked" au lieu de "running"
        return await updateStageStatus(stageId, "blocked");
      }
    }

    // Executer l'action de transition
    if (validTransition.action) {
      await validTransition.action(fullContext);
    }

    // Mettre a jour le statut
    const updated = await updateStageStatus(stageId, validTransition.to);

    // Audit
    await logTransition(stage, event, validTransition.to, context);

    // Event temps reel
    publishLiveEvent({
      companyId: stage.companyId,
      type: "workflow.stage.transition",
      payload: {
        workflowInstanceId: stage.workflowInstanceId,
        stageId: stage.id,
        from: stage.status,
        event,
        to: validTransition.to,
      },
    });

    return updated;
  }

  // Verification des fichiers obligatoires
  async function areRequiredFilesPresent(ctx: TransitionContext): Promise<boolean> {
    const template = await getWorkflowTemplate(ctx.workflowInstance.templateId);
    const stageDef = template.stages[ctx.stageInstance.stageOrder];
    if (!stageDef?.requiredFiles?.length) return true;

    // Verifier que chaque fichier obligatoire existe dans le workspace
    for (const filePath of stageDef.requiredFiles) {
      const exists = await checkFileExists(ctx.workflowInstance.projectId, filePath);
      if (!exists) return false;
    }
    return true;
  }

  // Injection des pre-prompts
  async function injectStagePrePrompts(ctx: TransitionContext): Promise<string> {
    const template = await getWorkflowTemplate(ctx.workflowInstance.templateId);
    const stageDef = template.stages[ctx.stageInstance.stageOrder];

    let prompt = stageDef.prePrompt || "";

    // Ajouter le contexte du workflow
    prompt += `\n\n## Contexte Workflow\n`;
    prompt += `Workflow: ${ctx.workflowInstance.name}\n`;
    prompt += `Etape: ${ctx.stageInstance.name} (${ctx.stageInstance.stageOrder + 1}/${template.stages.length})\n`;

    // Ajouter les resultats intermediaires des etapes precedentes
    const previousOutputs = await getPreviousStageOutputs(ctx);
    if (previousOutputs.length > 0) {
      prompt += `\n## Resultats des etapes precedentes\n`;
      for (const output of previousOutputs) {
        prompt += `### ${output.stageName}\n${output.summary}\n\n`;
      }
    }

    // Ajouter les acceptance criteria
    if (stageDef.acceptanceCriteria?.length) {
      prompt += `\n## Criteres d'acceptation\n`;
      for (const criterion of stageDef.acceptanceCriteria) {
        prompt += `- [ ] ${criterion}\n`;
      }
    }

    return prompt;
  }

  // Gestion de la compaction
  async function handleCompaction(stageId: string): Promise<void> {
    const stage = await transition(stageId, "compact", {});

    // 1. Sauvegarder les resultats intermediaires
    const intermediateResults = await captureIntermediateResults(stage);

    // 2. Kill l'agent en cours
    await killAgentRun(stage.activeRunId);

    // 3. Reconstruire le contexte frais
    const freshContext = await buildFreshContext(stage, intermediateResults);

    // 4. Relancer avec le contexte reconstruit
    await transition(stageId, "relaunch", { prePrompt: freshContext });
  }

  return {
    transition,
    handleCompaction,
    areRequiredFilesPresent,
    injectStagePrePrompts,
    getValidTransitions: (status: StageStatus) =>
      transitions.filter(t => t.from === status).map(t => t.event),
  };
}
```

#### 5.3 Extension du Schema `workflow_templates`

Le type `WorkflowStageTemplateDef` existant doit etre enrichi pour supporter les preconditions et pre-prompts :

```typescript
// workflow_templates.ts — type enrichi
export type WorkflowStageTemplateDef = {
  order: number;
  name: string;
  description?: string;
  agentRole?: string;
  autoTransition: boolean;
  acceptanceCriteria?: string[];

  // NOUVEAU B2B
  requiredFiles?: string[];       // Fichiers obligatoires (paths relatifs au workspace)
  prePrompt?: string;             // Pre-prompt injecte a l'agent pour cette etape
  maxDurationMinutes?: number;    // Timeout par etape (defaut: 60)
  humanValidation?: boolean;      // Validation humaine requise avant transition
  validationRoles?: string[];     // Roles autorises a valider (defaut: admin, manager)
  compactionStrategy?: "kill_relaunch" | "reinject"; // Strategie de gestion compaction
};
```

#### 5.4 Integration avec le Heartbeat Service

Le `heartbeat.ts` existant (2396 lignes) gere le cycle de vie des runs d'agents. L'integration avec le WorkflowEnforcer se fait a deux points :

1. **Au demarrage d'un run** : Le WorkflowEnforcer valide les preconditions et injecte les pre-prompts AVANT que le HeartbeatService ne lance le processus agent.

2. **A la fin d'un run** : Le HeartbeatService notifie le WorkflowEnforcer qui evalue les postconditions et decide de la transition.

```
HeartbeatService                    WorkflowEnforcer
     |                                    |
     |  1. triggerRun(agentId, stageId)   |
     |  --------------------------------> |
     |                                    | 2. transition("start")
     |                                    |    - guard: prev completed? files OK?
     |                                    |    - action: inject pre-prompts
     |  <-------------------------------- |
     |  3. prePrompt + validated          |
     |                                    |
     |  4. spawn process/container        |
     |  5. stream events via WebSocket    |
     |                                    |
     |  6. run finished                   |
     |  --------------------------------> |
     |                                    | 7. transition("complete")
     |                                    |    - guard: acceptance criteria met?
     |  <-------------------------------- |
     |  8. next stage or workflow done    |
```

#### 5.5 Gestion de la Compaction

La compaction est l'evenement critique ou un LLM atteint sa limite de contexte. Le WorkflowEnforcer detecte cet evenement via les events du HeartbeatService et applique la strategie configuree :

**Strategie 1 : Kill+Relance** (defaut)
1. Capturer les resultats intermediaires (fichiers modifies, outputs)
2. Kill le processus/container agent
3. Reconstruire un prompt frais avec : pre-prompt original + resultats intermediaires + instructions "continue from here"
4. Relancer l'agent avec le nouveau contexte

**Strategie 2 : Reinjection**
1. Detecter la compaction via les events agent
2. Reinjecter les pre-prompts critiques dans le contexte compacte
3. L'agent continue sans interruption

La strategie est configurable par etape dans le `WorkflowStageTemplateDef`.

### Consequences

**Positives** :
- L'invariant INV-02 est respecte : workflows deterministes, pas suggestifs
- La state machine rend les transitions explicites, testables et auditables
- Les preconditions (fichiers obligatoires, etapes precedentes) sont validees automatiquement
- La gestion de la compaction est formalisee et configurable
- Le drift detection s'integre naturellement (etat `drifted`)
- Chaque transition est auditee (audit_events)

**Negatives** :
- Complexite supplementaire dans le flux d'execution (guard + action + audit)
- Le type `WorkflowStageTemplateDef` evolue — migration necessaire pour les templates existants
- L'integration avec `heartbeat.ts` (2396 lignes) necessite un refactoring partiel du fichier monolithique (dette DT7)
- Les strategies de compaction sont experimentales — necessitent un spike d'une semaine (hypothese H-T1)

**Risques** :
- **R1 (Critique)** : La compaction est mal comprise. L'hypothese H-T1 doit etre validee par un spike avant l'implementation complete. Si la compaction s'avere trop imprevisible, la strategie "kill+relance" reste le fallback fiable.
- **R2 (Moyen)** : La state machine peut devenir complexe avec l'ajout de nouveaux etats. Limiter le nombre d'etats a ceux documentes ici et ne les etendre qu'avec un ADR additionnel.

---


### ADR-004 : Containerisation Docker & Credential Proxy

### Contexte

MnM exécute aujourd'hui les agents IA comme des processus enfants directs du serveur Node.js, via `runChildProcess()` dans le service heartbeat (`server/src/services/heartbeat.ts`, ~2396 lignes). Les agents héritent des permissions de l'utilisateur système qui fait tourner MnM :

- **Accès fichier complet** : aucun sandboxing filesystem — un agent peut lire `~/.ssh`, `~/.aws`, n'importe quel fichier accessible au processus MnM.
- **Credentials en clair** : les variables d'environnement sont résolues par `secrets.ts` (4 providers : `plain`, `secret_ref`, etc.) puis passées directement dans `process.env` du child process. Un agent malveillant ou compromis peut lire `ANTHROPIC_API_KEY` via `process.env` ou `cat /proc/self/environ`.
- **Pas de limites de ressources** : seul un timeout basique existe. Un agent peut consommer CPU et RAM sans borne.
- **Pas d'isolation réseau** : les agents partagent la stack réseau du host.

Pour le B2B enterprise multi-tenant (REQ-CONT-01 à REQ-CONT-07), cette architecture est un risque de sécurité inacceptable. L'analyse de Nanoclaw (`_research/nanoclaw-analysis-realtime-chat-and-containerization.md`) a révélé un pattern mature de **defense in depth à 5 couches** que MnM doit adopter et adapter.

### Options Considérées

#### Option A : gVisor / Firecracker (micro-VMs)

- Isolation noyau forte (sandboxing syscall)
- Temps de démarrage ~1-3s (Firecracker), ~100ms overhead (gVisor)
- Complexité opérationnelle élevée : gVisor nécessite un runtime custom, Firecracker nécessite un host Linux avec KVM
- Non compatible Windows/macOS pour le développement local
- Sur-ingénierie pour le cas d'usage actuel (agents de code, pas workloads adversariaux)

#### Option B : Wasm/WASI Isolation

- Isolation au niveau du bytecode
- Excellent pour le sandboxing CPU-bound
- Incompatible avec les SDKs agents existants (Claude SDK, Codex CLI, Cursor) qui sont des binaires natifs Node.js
- Pas de support Docker mount, networking standard
- Trop restrictif — les agents ont besoin d'un shell, de git, d'outils CLI

#### Option C : Docker containers éphémères avec Credential Proxy (RETENUE)

- Pattern prouvé par Nanoclaw en production
- Compatible avec tous les adapter types existants (8 types dans `server/src/adapters/registry.ts`)
- Defense in depth à 5 couches
- Temps de démarrage <10s (objectif PRD), images pré-pullées <5s
- Dégradation gracieuse possible (mode sans Docker = processus local avec warnings)
- Écosystème Docker mature, tooling existant (dockerode, Docker Compose)

### Décision

**Adopter l'Option C** : containers Docker éphémères avec credential proxy HTTP, en adaptant le pattern Nanoclaw pour l'architecture multi-tenant PostgreSQL de MnM.

### Architecture Détaillée — 5 Couches de Defense in Depth

#### Couche 1 : Container Docker éphémère

Chaque exécution d'agent crée un container Docker éphémère `--rm`. Le container est détruit automatiquement après exécution — aucune donnée persistante dans le container lui-même.

```
ContainerManager.run({
  image: "mnm-agent-dev:latest",    // image par profil
  rm: true,                          // éphémère
  user: "node:node",                 // non-root (uid 1000)
  networkMode: "none",               // isolation réseau par défaut
  memoryLimit: "2g",                 // REQ-CONT-06
  cpuQuota: 80000,                   // 80% d'un CPU
  pidsLimit: 256,                    // protection fork bomb
  readonlyRootfs: true,              // filesystem racine RO
  tmpfs: { "/tmp": "size=512m" },    // tmpfs pour écriture
})
```

**Images par profil d'agent** (stockées dans `container_profiles`) :

| Profil | Image de base | Outils préinstallés |
|--------|--------------|---------------------|
| `dev` | `node:22-slim` | git, npm, pnpm, Claude SDK |
| `designer` | `node:22-slim` | Chromium, design tools |
| `qa` | `node:22-slim` | Playwright, jest, vitest |
| `minimal` | `node:22-alpine` | shell uniquement |

#### Couche 2 : Mount Allowlist Tamper-Proof

Fichier de configuration **externe au container** (JAMAIS monté dans le container) :

```json
// PostgreSQL: container_mount_allowlists table
// OU fichier local: ~/.config/mnm/mount-allowlist.json (self-hosted)
{
  "allowedRoots": [
    { "path": "/workspace/projects", "allowReadWrite": true },
    { "path": "/workspace/shared-libs", "allowReadWrite": false }
  ],
  "blockedPatterns": [
    "password", "secret", "token", ".ssh", ".gnupg", ".aws",
    ".azure", ".gcloud", ".kube", ".docker", "credentials",
    ".env", ".netrc", ".npmrc", ".pypirc", "id_rsa",
    "id_ed25519", "private_key", ".secret"
  ]
}
```

**Validation des mounts** — 5 étapes séquentielles :

1. **Rejet path traversal** : tout chemin contenant `..` est rejeté
2. **Résolution symlink** : `fs.realpath()` — les symlinks qui pointent hors des `allowedRoots` sont rejetés
3. **Vérification blockedPatterns** : chaque composant du chemin est testé contre les patterns
4. **Vérification allowedRoots** : le chemin résolu doit être un sous-chemin d'un `allowedRoot`
5. **Enforcement RO** : les mounts hors du workspace principal sont forcés en read-only

#### Couche 3 : Credential Proxy HTTP

C'est le composant le plus critique. Les agents ne doivent **JAMAIS** accéder directement aux clés API.

```
┌──────────────────────┐      ┌─────────────────────────┐
│   Container Agent    │      │    Host MnM Server      │
│                      │      │                         │
│  ANTHROPIC_API_KEY   │──────│  Credential Proxy       │
│  = "placeholder"     │      │  (port interne)         │
│                      │      │                         │
│  ANTHROPIC_BASE_URL  │──────│  → Intercepte requêtes  │
│  = http://host:3001  │      │  → Remplace placeholder  │
│                      │      │    par vraie clé         │
│  .env → /dev/null    │      │  → Forward à l'API      │
│  (shadow mount)      │      │  → Log audit            │
└──────────────────────┘      └─────────────────────────┘
```

**Implémentation** — `server/src/services/credential-proxy.ts` :

```typescript
// Le proxy s'intègre avec le secretService existant (secrets.ts)
// qui a déjà 4 providers et le pattern resolveAdapterConfigForRuntime()
interface CredentialProxyConfig {
  listenPort: number;          // port dynamique par container
  targetUrl: string;           // URL API réelle (api.anthropic.com)
  agentId: string;             // pour le audit log
  runId: string;               // pour la traçabilité
  credentials: Map<string, string>;  // clé header → valeur réelle
}
```

Le proxy utilise le `secretService.resolveAdapterConfigForRuntime()` existant pour résoudre les `secret_ref` en valeurs, puis les injecte dans les headers sans jamais les exposer au container.

**Shadow `.env`** — Protection contre l'accès direct aux secrets :

```typescript
// Si un fichier .env existe dans le workspace monté
if (fs.existsSync(path.join(workspacePath, '.env'))) {
  mounts.push({
    hostPath: '/dev/null',
    containerPath: '/workspace/project/.env',
    readonly: true,
  });
}
```

#### Couche 4 : Isolation Inter-Agents

Chaque container reçoit un namespace IPC isolé. Les capacités sont différenciées par rôle :

| Capability | Agent principal | Agent secondaire |
|------------|----------------|-----------------|
| Accès workspace projet | RW | RO ou aucun |
| Accès fichiers autres agents | Non | Non |
| Communication A2A | Via bus (ADR-006) | Via bus (ADR-006) |
| Accès réseau | Configurable | `none` par défaut |

#### Couche 5 : Limites de Ressources

```typescript
interface ContainerResourceLimits {
  memoryMB: number;        // défaut 2048, max 8192
  cpuPercent: number;      // défaut 80, max 100
  diskMB: number;          // défaut 1024 (tmpfs)
  pidsLimit: number;       // défaut 256
  timeoutMs: number;       // défaut 30min, reset sur output
  outputMaxBytes: number;  // défaut 10MB
  concurrencyLimit: number; // par company, défaut 5
}
```

**Timeout avec reset** — adapté du pattern Nanoclaw :

Le timeout se réinitialise à chaque output du container (SIGTERM suivi de SIGKILL après 10s si pas d'arrêt propre). Ce pattern est crucial car les agents LLM ont des temps de réponse variables.

### Architecture des Composants

```
server/src/
├── containers/
│   ├── container-manager.ts        // Lifecycle containers (dockerode)
│   ├── container-profiles.ts       // Profils par type d'agent
│   ├── credential-proxy.ts         // Proxy HTTP credentials
│   ├── mount-validator.ts          // Validation allowlist
│   └── resource-monitor.ts         // Monitoring limites
├── adapters/
│   ├── docker/
│   │   ├── docker-adapter.ts       // Adapter Docker (ServerAdapterModule)
│   │   └── docker-image-builder.ts // Build/pull images
│   └── registry.ts                 // +1 adapter type "docker_container"
└── services/
    ├── heartbeat.ts                // Modifié : délègue au ContainerManager
    └── secrets.ts                  // Inchangé : fournit les credentials
```

### Conséquences

**Positives :**
- Isolation complète des agents — un agent compromis ne peut pas accéder aux secrets ou fichiers d'autres agents
- Les credentials ne sont jamais exposées aux agents, même via `/proc/self/environ`
- Limites de ressources empêchent les abus (fork bombs, OOM, etc.)
- Audit complet de toutes les requêtes API via le credential proxy
- Compatible avec le modèle multi-tenant B2B

**Négatives :**
- Overhead de démarrage : ~3-10s par container vs ~100ms pour un processus local
- Complexité opérationnelle : Docker doit être installé et fonctionnel sur le host
- Images Docker à maintenir et mettre à jour
- Consommation mémoire accrue : chaque container a son propre kernel namespace

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Docker daemon indisponible | Moyenne | Critique | Mode dégradé : exécution en processus local avec warnings de sécurité et log audit |
| Container qui ne s'arrête pas | Faible | Moyen | Timeout SIGTERM → SIGKILL 10s + monitoring |
| Credential proxy comme SPOF | Faible | Critique | Health check + retry (3 tentatives, suspend agent après 3 échecs) |
| Path traversal via symlinks | Moyenne | Critique | `realpath()` + rejection systématique des symlinks hors allowlist |
| Épuisement ressources Docker | Moyenne | Moyen | Quota par company, file d'attente avec priorité |
| Latence réseau credential proxy | Faible | Faible | Proxy sur `host.docker.internal` (latence <1ms), connection pooling |

---


### ADR-005 : Chat Temps Réel — WebSocket Bidirectionnel

### Contexte

L'état actuel du WebSocket dans MnM (`server/src/realtime/live-events-ws.ts`, 273 lignes) est **strictement unidirectionnel** : le serveur publie des événements vers les clients via `subscribeCompanyLiveEvents()`, mais le client ne peut pas envoyer de messages au serveur via le WebSocket.

Analyse du code existant :

```typescript
// live-events-ws.ts ligne 201-210 : le handler "connection"
// ne définit aucun listener "message" sur le socket
wss.on("connection", (socket: WsSocket, req: IncomingMessage) => {
  const unsubscribe = subscribeCompanyLiveEvents(context.companyId, (event) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(event));  // serveur → client UNIQUEMENT
  });
  // ... ping/pong, close, error — mais PAS de socket.on("message")
});
```

L'interface `WsSocket` elle-même ne déclare même pas de handler `on("message")`. Le WebSocket actuel ne sert qu'à diffuser les événements `heartbeat.run.status`, `heartbeat.run.event`, et `heartbeat.run.log`.

Le PRD exige (REQ-CHAT-01 à REQ-CHAT-05) un dialogue bidirectionnel humain-agent pendant l'exécution. L'analyse Nanoclaw montre que cela est faisable via un pattern `MessageStream` + stdin piping, adapté à l'infrastructure WebSocket existante de MnM.

De plus, le `runChildProcess()` dans heartbeat.ts configure actuellement le stdin à `"ignore"` — le pipe existe dans Node.js mais n'est pas utilisé.

### Options Considérées

#### Option A : SSE (Server-Sent Events) pour le downstream + POST pour l'upstream

- Plus simple à implémenter côté serveur
- Pas de problème de proxy/firewall (HTTP standard)
- Limité : une connexion par direction, pas de multiplexage
- Rejet : MnM a déjà un WebSocket fonctionnel — ajouter SSE serait une régression architecturale

#### Option B : gRPC bidirectionnel

- Excellent pour le streaming bidirectionnel
- Typage fort via Protocol Buffers
- Rejet : complexité d'intégration avec l'écosystème frontend React existant, et l'UI utilise déjà React Query + WebSocket. gRPC-Web ajoute un proxy supplémentaire.

#### Option C : Extension WebSocket bidirectionnel (RETENUE)

- Réutilise l'infrastructure WebSocket existante (`live-events-ws.ts`)
- Ajout d'un handler `on("message")` pour le trafic client → serveur
- Routing par type de message vers les handlers appropriés
- Compatible avec `LiveUpdatesProvider.tsx` côté frontend

### Décision

**Adopter l'Option C** : étendre le WebSocket existant pour supporter le trafic bidirectionnel, avec un protocole de messages typé et un pipe vers stdin des agents en cours d'exécution.

### Architecture Détaillée

#### Protocole de Messages

```typescript
// Messages client → serveur
type ClientMessage =
  | { type: "chat.send"; runId: string; content: string; requestId: string }
  | { type: "chat.typing"; runId: string }
  | { type: "agent.interrupt"; runId: string; reason?: string }
  | { type: "ping" };

// Messages serveur → client (extension de l'existant)
type ServerMessage =
  | { type: "chat.message"; runId: string; message: ChatMessage }
  | { type: "chat.ack"; requestId: string; messageId: string }
  | { type: "chat.error"; requestId: string; code: string; reason: string }
  | { type: "chat.agent_typing"; runId: string }
  | LiveEvent;  // événements existants (heartbeat.run.status, etc.)
```

#### Modification de `live-events-ws.ts`

Le handler `on("connection")` doit être étendu avec un listener `on("message")` :

```typescript
// Ajout au handler connection (ligne ~201)
socket.on("message", (raw: Buffer | string) => {
  try {
    const msg = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as ClientMessage;
    handleClientMessage(socket, context, msg);
  } catch {
    socket.send(JSON.stringify({
      type: "chat.error",
      requestId: "unknown",
      code: "PARSE_ERROR",
      reason: "Invalid JSON"
    }));
  }
});
```

#### Pipeline Chat : UI → WebSocket → stdin Agent

```
┌────────┐    WebSocket     ┌──────────┐    stdin pipe    ┌──────────────┐
│   UI   │ ──chat.send──→  │  Server  │ ──JSON write──→ │   Agent      │
│        │                  │          │                  │  (container  │
│        │ ←chat.message── │          │ ←stdout parse── │   ou local)  │
└────────┘                  └──────────┘                  └──────────────┘
```

**Modification de `heartbeat.ts`** — le `runChildProcess()` doit :

1. Ouvrir stdin en mode `"pipe"` au lieu de `"ignore"`
2. Enregistrer le processus dans un `Map<runId, ChildProcess>` accessible au handler WebSocket
3. Écrire les messages chat sur `process.stdin` au format JSON (une ligne par message)

```typescript
// Dans le spawn de l'agent
const child = spawn(command, args, {
  stdio: ["pipe", "pipe", "pipe"],  // stdin en pipe (était "ignore")
  // ...
});

// Enregistrement pour accès depuis le handler WebSocket
runningProcesses.set(runId, {
  process: child,
  agentId,
  companyId,
  startedAt: Date.now(),
});
```

#### Schéma Base de Données

```sql
-- Table de persistance des messages chat
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  run_id UUID NOT NULL REFERENCES heartbeat_runs(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE(run_id)  -- un channel par run
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id),
  sender_type TEXT NOT NULL CHECK(sender_type IN ('user', 'agent', 'system')),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,  -- pour les pièces jointes, code snippets, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_channel_created
  ON chat_messages(channel_id, created_at);
```

#### Reconnexion avec Sync Messages Manqués (REQ-CHAT-03)

```typescript
// Buffer circulaire côté serveur (30 secondes)
class MessageBuffer {
  private buffer: Map<string, ChatMessage[]> = new Map(); // runId → messages
  private readonly maxAgeMs = 30_000;

  push(runId: string, message: ChatMessage): void {
    const messages = this.buffer.get(runId) ?? [];
    messages.push(message);
    this.buffer.set(runId, messages);
    this.pruneOld(runId);
  }

  // À la reconnexion, le client envoie son lastMessageId
  // Le serveur renvoie tous les messages après ce point
  getSince(runId: string, lastMessageId: string | null): ChatMessage[] {
    const messages = this.buffer.get(runId) ?? [];
    if (!lastMessageId) return messages;
    const idx = messages.findIndex(m => m.id === lastMessageId);
    return idx >= 0 ? messages.slice(idx + 1) : messages;
  }
}
```

#### Rate Limiting (REQ-CHAT-05)

```typescript
// 10 messages par minute par utilisateur par channel
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, channelId: string): boolean {
  const key = `${userId}:${channelId}`;
  const now = Date.now();
  const entry = rateLimiter.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
```

### Conséquences

**Positives :**
- Dialogue temps réel humain-agent pendant l'exécution du workflow
- Réutilise l'infrastructure WebSocket existante — pas de nouveau serveur
- Persistance des conversations pour replay et audit
- Le buffer 30s résout le problème de reconnexion gracieusement

**Négatives :**
- Le handler `on("message")` ajoute de la complexité au WebSocket existant
- Le piping stdin nécessite une modification non-triviale de `heartbeat.ts`
- Tous les adapter types ne supportent pas stdin (certains CLI agents ignorent stdin)

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Agent qui ne lit pas stdin | Moyenne | Moyen | Détection via timeout réponse, fallback en mode "note" (message persisté mais pas transmis en temps réel) |
| Flood de messages | Faible | Moyen | Rate limit 10/min + validation taille max 100KB + sanitization XSS (UTF-8 strict) |
| Messages en vol lors de crash serveur | Faible | Faible | Messages persistés en DB avant forwarding, le buffer 30s ne sert que pour la reconnexion rapide |
| Confusion client si message après fin d'exécution | Moyenne | Faible | Rejet avec `chat.error` code `RUN_COMPLETED` |
| Contenu XSS dans les messages | Moyenne | Élevé | Sanitization UTF-8 strict côté serveur, échappement HTML côté client, Content Security Policy |

---


### ADR-006 : Communication Agent-to-Agent (A2A)

### Contexte

MnM dispose déjà d'un système de permissions inter-agents dans la base de données : `agents.permissions`, `agents.reportsTo`, et les `principal_permission_grants` (pour les agents). Le PRD prévoit des interactions entre agents IA dans le cadre de workflows complexes (REQ-A2A-01 à REQ-A2A-04) :

- Un agent architecte qui consulte l'agent QA pour valider un schéma
- Un agent PM qui délègue une sous-tâche à un agent développeur
- Un agent développeur qui partage un artifact avec l'agent designer

Aujourd'hui, les agents sont exécutés de manière isolée par le heartbeat service — chaque run est indépendant, et il n'existe aucun bus de communication entre agents en cours d'exécution. Les interactions se font uniquement via des modifications de fichiers dans le workspace partagé (détection passive).

Le risque principal est la **boucle infinie** : un agent A envoie un message à B, qui répond à A, qui répond à B, etc. — consommant des tokens LLM sans limite. La validation human-in-the-loop configurable est la réponse à ce risque.

### Options Considérées

#### Option A : Communication via fichiers partagés (pattern actuel implicite)

- Les agents écrivent des fichiers dans un workspace commun
- Détection via polling ou inotify
- Simple mais fragile : pas de garantie de livraison, pas de typage, pas d'audit
- Rejet : ne répond pas aux exigences d'audit et de validation humaine

#### Option B : Message broker externe (RabbitMQ / Redis Streams)

- Infrastructure robuste, patterns publish/subscribe éprouvés
- Overhead opérationnel : un service supplémentaire à déployer et maintenir
- Sur-ingénierie pour le volume attendu (dizaines de messages A2A par jour, pas des milliers)
- Rejet : complexité opérationnelle disproportionnée

#### Option C : Bus de messages applicatif avec validation humaine (RETENUE)

- Bus interne au serveur MnM, persisté en PostgreSQL
- Validation human-in-the-loop configurable par paire d'agents
- Audit de chaque transaction
- Intégration avec le WebSocket existant pour les notifications temps réel

### Décision

**Adopter l'Option C** : bus de messages A2A applicatif, intégré au serveur MnM, avec validation humaine configurable et audit complet.

### Architecture Détaillée

#### Composants Principaux

```
┌─────────────┐    A2ABus     ┌──────────────────┐    Notification    ┌──────┐
│  Agent A    │ ──request──→ │  PermissionCheck  │ ──────────────→   │  UI  │
│ (container) │              │  + HumanValidation│                   │      │
│             │ ←response── │  + AuditLogger    │ ←──approve/deny── │      │
└─────────────┘              └──────────────────┘                   └──────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  Agent B │
                              │          │
                              └──────────┘
```

#### Types de Messages A2A

```typescript
type A2AMessageType =
  | "query"        // Question à un autre agent (réponse attendue)
  | "notify"       // Notification sans réponse attendue
  | "delegate"     // Délégation de sous-tâche
  | "share"        // Partage d'artifact (fichier, snippet, résultat)
  | "context_request" // Demande de contexte (historique, décisions)
;

interface A2AMessage {
  id: string;                    // UUID
  fromAgentId: string;
  toAgentId: string;
  type: A2AMessageType;
  subject: string;               // Description courte
  content: string;               // Contenu complet (JSON ou texte)
  metadata: {
    workflowId?: string;         // Contexte workflow
    stageId?: string;            // Étape courante
    priority: "low" | "normal" | "high";
    requiresHumanApproval: boolean;
    maxResponseTimeMs?: number;  // Timeout de réponse
  };
  status: "pending_approval" | "approved" | "delivered" | "responded" | "rejected" | "timeout";
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;           // userId du validateur humain
  deliveredAt?: Date;
  respondedAt?: Date;
}
```

#### Validation Human-in-the-Loop

La matrice de permissions détermine si une approbation humaine est requise :

```typescript
interface A2APermissionRule {
  id: string;
  companyId: string;
  fromAgentId: string | "*";     // wildcard = tout agent
  toAgentId: string | "*";
  messageType: A2AMessageType | "*";
  requireApproval: boolean;       // true = human-in-the-loop
  autoApproveConditions?: {
    maxContentLength?: number;    // auto-approve si contenu court
    allowedSubjects?: string[];   // patterns de sujets auto-approuvés
    withinSameWorkflow?: boolean; // auto-approve si même workflow
  };
}
```

**Algorithme de résolution** :

1. Chercher une règle spécifique `(fromAgentId, toAgentId, messageType)`
2. Sinon, chercher `(fromAgentId, toAgentId, *)`
3. Sinon, chercher `(*, *, messageType)`
4. Sinon, **défaut = requireApproval: true** (sécurité par défaut)

#### Protection Anti-Boucle

```typescript
class A2ALoopDetector {
  // Fenêtre glissante de 5 minutes
  private recentMessages = new Map<string, number[]>();

  check(fromAgentId: string, toAgentId: string): boolean {
    const pairKey = `${fromAgentId}:${toAgentId}`;
    const reversePairKey = `${toAgentId}:${fromAgentId}`;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    // Compter les messages dans les deux directions
    const forwardCount = this.countRecent(pairKey, now, windowMs);
    const reverseCount = this.countRecent(reversePairKey, now, windowMs);

    // Si > 10 échanges dans la fenêtre → suspicion de boucle
    if (forwardCount + reverseCount > 10) {
      return false; // BLOQUER
    }

    this.record(pairKey, now);
    return true;
  }
}
```

#### Schéma Base de Données

```sql
CREATE TABLE a2a_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_agent_id UUID NOT NULL REFERENCES agents(id),
  to_agent_id UUID NOT NULL REFERENCES agents(id),
  message_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_approval',
  parent_message_id UUID REFERENCES a2a_messages(id), -- pour les réponses
  workflow_instance_id UUID,  -- contexte workflow si applicable
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  delivered_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_a2a_messages_to_agent ON a2a_messages(to_agent_id, status);
CREATE INDEX idx_a2a_messages_company ON a2a_messages(company_id, created_at);

CREATE TABLE a2a_permission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_agent_id UUID,  -- NULL = wildcard
  to_agent_id UUID,    -- NULL = wildcard
  message_type TEXT,    -- NULL = wildcard
  require_approval BOOLEAN NOT NULL DEFAULT TRUE,
  auto_approve_conditions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Intégration avec les Agents Containerisés (ADR-004)

Les agents dans leurs containers accèdent au bus A2A via une API HTTP locale exposée par le credential proxy :

```
Container Agent A → http://host.docker.internal:3001/a2a/send
                  → http://host.docker.internal:3001/a2a/poll
                  → http://host.docker.internal:3001/a2a/respond
```

Le credential proxy authentifie l'agent par son `agentId` (injecté dans l'environnement du container) et applique les permissions.

### Conséquences

**Positives :**
- Communication structurée et auditée entre agents
- Validation humaine configurable — sécurité par défaut
- Protection anti-boucle intégrée
- Traçabilité complète de chaque transaction A2A

**Négatives :**
- Latence ajoutée par la validation humaine (secondes à minutes selon la configuration)
- Complexité du système de permissions (matrice de règles)
- Les agents doivent être modifiés pour utiliser l'API A2A (prompt engineering + tools)

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Boucle infinie A2A | Moyenne | Critique | Détecteur de boucle (10 échanges / 5 min), circuit breaker, alerte |
| Fatigue d'approbation humaine | Élevée | Moyen | Auto-approve configurable pour les patterns récurrents et sûrs |
| Agent qui ne répond jamais | Moyenne | Moyen | Timeout configurable (défaut 5 min), notification à l'agent source |
| Contenu A2A qui leak des secrets | Faible | Élevé | Scan du contenu contre les `blockedPatterns` de l'ADR-004, alerting |

---


### ADR-007 : Observabilité — Audit Log Immutable & Résumé LLM

### Contexte

MnM dispose déjà d'un `activity_log` basique (`packages/db/src/schema/activity_log.ts`, 26 lignes) avec les colonnes : `companyId`, `actorType`, `actorId`, `action`, `entityType`, `entityId`, `agentId`, `runId`, `details` (JSONB), `createdAt`. Ce log est alimenté ponctuellement depuis `heartbeat.ts` et `costs.ts`.

Cependant, ce log souffre de plusieurs limitations pour le B2B enterprise :

1. **Mutabilité** : rien n'empêche un `UPDATE` ou `DELETE` sur les entrées — pas d'immutabilité garantie
2. **Pas de partitionnement** : toutes les entreprises dans une seule table, pas d'optimisation pour la rétention longue (3 ans requis par REQ-OBS-06)
3. **Pas de résumé** : les logs sont techniques (JSON brut) — les managers non-techniques ne peuvent pas les comprendre
4. **Pas de dashboards agrégés** : la Vérité #20 du brainstorming exige "JAMAIS de dashboards individuels"
5. **Pas d'export** : REQ-OBS-05 exige CSV/JSON

Le `heartbeat_run_events` existant capture les événements d'exécution, et le `cost_events` trace les coûts. Mais aucun de ces systèmes ne fournit un audit trail immutable et compréhensible pour les décideurs business.

### Options Considérées

#### Option A : Audit log externe (Elasticsearch / OpenSearch)

- Recherche full-text performante
- Kibana/OpenSearch Dashboards pour la visualisation
- Complexité opérationnelle : cluster à maintenir, synchronisation avec PostgreSQL
- Rejet : trop de dépendances pour le MVP, PostgreSQL peut gérer le volume attendu

#### Option B : Event sourcing complet

- Historique complet et immuable par design
- Capacité de replay et reconstruction de l'état
- Rejet : changement paradigmatique de toute l'architecture — disproportionné. MnM n'est pas un système financier.

#### Option C : Audit log PostgreSQL partitionné + TRIGGER d'immutabilité + Résumé LLM (RETENUE)

- Extension du `activity_log` existant
- Immutabilité garantie par TRIGGER SQL
- Partitionnement par date pour la rétention longue
- Résumé LLM temps réel via un service dédié

### Décision

**Adopter l'Option C** : audit log immutable partitionné dans PostgreSQL avec résumé LLM temps réel.

### Architecture Détaillée

#### Immutabilité par TRIGGER SQL

```sql
-- TRIGGER qui empêche toute modification ou suppression
-- sur la table audit_log (renommée depuis activity_log)
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable — UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

-- Appliqué sur UPDATE
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

-- Appliqué sur DELETE
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();
```

**Note** : un superadmin PostgreSQL peut toujours désactiver les triggers. Pour une immutabilité plus forte en production, un rôle applicatif dédié sans `ALTER TABLE` est requis. Cette limitation est documentée.

#### Partitionnement par Date

```sql
-- Table partitionnée par mois pour la rétention longue
CREATE TABLE audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  agent_id UUID,
  run_id UUID,
  workflow_instance_id UUID,
  stage_instance_id UUID,
  details JSONB,
  summary TEXT,              -- Résumé LLM en langage naturel
  summary_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)  -- clé composite pour le partitionnement
) PARTITION BY RANGE (created_at);

-- Partitions mensuelles (générées automatiquement par un job CRON)
CREATE TABLE audit_log_2026_03 PARTITION OF audit_log
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit_log_2026_04 PARTITION OF audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- etc.
```

**Rétention** : les partitions de plus de 3 ans peuvent être archivées (pg_dump) puis détachées (`ALTER TABLE audit_log DETACH PARTITION`). Ce pattern permet une rétention efficace sans impacter les performances.

#### Résumé LLM Temps Réel (REQ-OBS-01)

Le service `audit-summarizer.ts` traduit les logs techniques en langage naturel compréhensible par un manager :

```typescript
// server/src/services/audit-summarizer.ts
interface AuditSummarizerConfig {
  model: string;           // e.g. "claude-haiku-4-5" — modèle rapide et économique
  maxLatencyMs: number;    // 5000ms max (REQ-OBS-01)
  batchSize: number;       // traiter par lots de 5 événements max
  language: "fr" | "en";   // langue de sortie
}

// Exemple de transformation
// Input (log technique) :
// { action: "file.write", entity_type: "file", entity_id: "/src/auth/middleware.ts",
//   details: { linesAdded: 47, linesRemoved: 12 } }
//
// Output (résumé LLM) :
// "L'agent a modifié le middleware d'authentification : 47 lignes ajoutées,
//  12 supprimées. Il semble refactorer la validation des tokens JWT."
```

**Architecture du pipeline** :

```
Événement brut → audit_log INSERT → pg_notify('audit_new')
                                          ↓
                                   AuditSummarizer (listener)
                                          ↓
                                   Batch (max 5, max 2s wait)
                                          ↓
                                   LLM API (Haiku — rapide, économique)
                                          ↓
                                   UPDATE audit_log SET summary = ...
                                   (via une colonne summary distincte,
                                    le TRIGGER autorise cet UPDATE spécifique)
```

**Exception au TRIGGER d'immutabilité** : le champ `summary` est la seule colonne modifiable, et uniquement par le service summarizer. Le TRIGGER est ajusté :

```sql
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Autoriser uniquement la mise à jour du résumé LLM
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.company_id = NEW.company_id
        AND OLD.actor_type = NEW.actor_type
        AND OLD.action = NEW.action
        AND OLD.entity_type = NEW.entity_type
        AND OLD.entity_id = NEW.entity_id
        AND OLD.details IS NOT DISTINCT FROM NEW.details
        AND OLD.created_at = NEW.created_at
        AND NEW.summary IS NOT NULL
        AND OLD.summary IS NULL) THEN
      RETURN NEW;  -- Autoriser : c'est l'ajout initial du résumé
    END IF;
  END IF;
  RAISE EXCEPTION 'Audit log entries are immutable — only initial summary generation is allowed';
END;
$$ LANGUAGE plpgsql;
```

#### Dashboards Agrégés — Vérité #20

La Vérité #20 du brainstorming des cofondateurs est catégorique : "Les dashboards sont TOUJOURS agrégés, JAMAIS individuels". Cela signifie :

- **OUI** : "Cette semaine, l'équipe a traité 47 issues, dont 12 critiques"
- **NON** : "Jean a traité 3 issues, Marie en a traité 8"

Les dashboards exposent :
- **Métriques d'équipe** : issues traitées/ouvertes, temps moyen de résolution, drift rate
- **Santé du workflow** : étapes en cours, blocages, compactions
- **Coûts agrégés** : tokens consommés par projet (pas par agent)
- **Tendances** : progression sur 7j/30j/90j

Les requêtes SQL agrégent toujours par `company_id` + `project_id`, jamais par `agent_id` seul.

#### Export (REQ-OBS-05)

```typescript
// API endpoint : GET /api/companies/:companyId/audit/export
// Query params : format=csv|json, from=ISO, to=ISO, actions[]=...
async function exportAuditLog(params: ExportParams): Promise<ReadableStream> {
  // Streaming pour les gros volumes — pas de chargement en mémoire
  const query = db
    .select()
    .from(auditLog)
    .where(and(
      eq(auditLog.companyId, params.companyId),
      gte(auditLog.createdAt, params.from),
      lte(auditLog.createdAt, params.to),
    ))
    .orderBy(asc(auditLog.createdAt));

  // Streaming CSV ou JSON via Transform streams
  return format === "csv"
    ? streamAsCSV(query)
    : streamAsJSON(query);
}
```

### Conséquences

**Positives :**
- Audit trail immutable — confiance pour compliance et audits
- Résumé LLM rend les logs accessibles aux non-techniques
- Partitionnement permet une rétention de 3+ ans sans dégradation
- Dashboards agrégés respectent la philosophie de confiance (pas de surveillance individuelle)

**Négatives :**
- Coût LLM pour les résumés (atténué par l'utilisation de Haiku, modèle économique)
- Le partitionnement mensuel nécessite un job de maintenance pour créer les partitions à l'avance
- L'exception au TRIGGER pour le résumé ajoute de la complexité à la logique d'immutabilité

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Volume d'audit logs explosif | Moyenne | Moyen | Partitionnement + archivage automatique des anciennes partitions |
| Latence résumé LLM > 5s | Moyenne | Faible | Batch processing, modèle Haiku (latence P99 < 2s), résumé asynchrone (l'UI montre le log brut puis le résumé) |
| Coût API LLM pour les résumés | Faible | Faible | Haiku à $0.25/MTok entrée — pour 100K events/mois ~$2-5/mois |
| Superadmin qui désactive les triggers | Faible | Élevé | Rôle applicatif dédié sans ALTER TABLE, monitoring des trigger states |
| Partitions non créées à temps | Faible | Critique | Job CRON qui crée les 3 prochains mois à l'avance, alerte si partition manquante |

---


### ADR-008 : Gestion de Compaction

### Contexte

La compaction est le **risque R1** — le plus critique du projet. Les LLMs ont une fenêtre de contexte limitée (100K-200K tokens selon le modèle). Lorsqu'un agent atteint cette limite, le SDK LLM "compacte" automatiquement le contexte : il résume les messages anciens et remplace le contexte complet par un résumé plus court.

**Pourquoi c'est critique pour MnM :**

Dans le cadre des workflows orchestrés (REQ-ORCH-06, REQ-ORCH-07), un agent doit exécuter des étapes séquentielles avec des pré-prompts injectés à chaque étape. Quand la compaction survient :

1. **Les pré-prompts sont perdus** : les instructions injectées par l'orchestrateur au début de l'exécution sont résumées ou supprimées
2. **Les résultats intermédiaires sont perdus** : les outputs des étapes précédentes, nécessaires pour la cohérence, disparaissent
3. **L'agent "oublie" son contexte** : il peut dériver de son objectif, sauter des étapes, ou répéter du travail
4. **Les fichiers obligatoires ne sont plus vérifiés** : l'agent ne sait plus qu'il devait produire certains fichiers

L'analyse du heartbeat service (`server/src/services/heartbeat.ts`) montre que MnM surveille déjà les runs via un système de heartbeat, mais ne détecte ni ne gère la compaction. Le `runChildProcess()` traite la sortie du processus comme un flux opaque — il n'analyse pas les événements de compaction.

### Options Considérées

#### Option A : Prévention de la compaction (contexte infini)

- Utiliser uniquement des modèles à fenêtre illimitée
- Rejet : aucun modèle actuel n'a une fenêtre réellement infinie. Même avec 200K tokens, les workflows longs (multi-heures) atteignent la limite. De plus, les coûts API croissent linéairement avec la taille du contexte.

#### Option B : Segmentation préventive (couper avant la compaction)

- Diviser automatiquement les longues sessions en sous-sessions plus courtes
- Chaque sous-session reçoit un résumé de la précédente
- Problème : la coupure peut intervenir au milieu d'une opération critique (commit, migration DB, etc.)
- Rejet partiel : bon principe mais insuffisant seul — la compaction peut quand même survenir

#### Option C : Stratégie duale — Kill+relance ET réinjection post-compaction (RETENUE)

Combine deux stratégies complémentaires :
1. **Stratégie 1 (proactive)** : détecter l'approche de la limite et kill+relancer avec résultats intermédiaires
2. **Stratégie 2 (réactive)** : si compaction détectée, réinjecter les pré-prompts critiques

### Décision

**Adopter l'Option C** : stratégie duale combinant la prévention proactive (kill+relance) et la récupération réactive (réinjection post-compaction).

### Architecture Détaillée

#### Détection de Compaction

La détection repose sur deux signaux complémentaires :

**Signal 1 : Monitoring du heartbeat (existant)**

Le service heartbeat (`heartbeat.ts`) surveille déjà les runs. Les SDKs agents émettent des événements sur stdout qui sont capturés par MnM. Certains SDKs (Claude SDK notamment) émettent un événement explicite lors de la compaction :

```typescript
// Événement de compaction émis par le SDK Claude
interface CompactionEvent {
  type: "system.compaction";
  timestamp: string;
  tokensBefore: number;
  tokensAfter: number;
  messagesDropped: number;
}
```

Le handler d'événements dans heartbeat.ts est étendu pour détecter ce pattern :

```typescript
// Extension du handler onLog/onEvent dans heartbeat.ts
function detectCompaction(event: unknown): CompactionEvent | null {
  const parsed = parseObject(event);
  if (parsed.type === "system.compaction" ||
      parsed.event === "compaction" ||
      // Heuristique pour SDKs qui n'émettent pas d'événement explicite
      (parsed.type === "system" &&
       typeof parsed.message === "string" &&
       parsed.message.includes("compact"))) {
    return {
      type: "system.compaction",
      timestamp: new Date().toISOString(),
      tokensBefore: asNumber(parsed.tokensBefore, 0),
      tokensAfter: asNumber(parsed.tokensAfter, 0),
      messagesDropped: asNumber(parsed.messagesDropped, 0),
    };
  }
  return null;
}
```

**Signal 2 : Estimation du contexte consommé**

Pour les SDKs qui n'émettent pas d'événement de compaction, MnM estime la consommation de contexte :

```typescript
interface ContextEstimation {
  estimatedTokens: number;       // estimation basée sur les logs
  modelMaxTokens: number;        // limite du modèle (100K, 200K, etc.)
  utilizationPercent: number;    // estimatedTokens / modelMaxTokens * 100
  warningThreshold: number;      // 70% — alerte proactive
  criticalThreshold: number;     // 85% — kill+relance recommandé
}
```

L'estimation est basée sur le volume de logs (approximation ~4 chars/token) émis par l'agent depuis le début du run. C'est une heuristique imprécise mais suffisante pour déclencher des alertes proactives.

#### Stratégie 1 : Kill + Relance avec Résultats Intermédiaires (REQ-ORCH-06)

Quand l'utilisation du contexte dépasse 85% ou qu'une compaction est détectée :

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Détection : contexte à 85% OU compaction détectée       │
│    ↓                                                        │
│ 2. Persistance des résultats intermédiaires                 │
│    → Sauvegarde dans compaction_snapshots                   │
│    → Liste des fichiers produits + état workflow            │
│    ↓                                                        │
│ 3. Kill propre de l'agent (SIGTERM → attente 10s → SIGKILL)│
│    ↓                                                        │
│ 4. Relance avec contexte frais                              │
│    → Pré-prompts de l'étape courante réinjectés             │
│    → Résumé des résultats intermédiaires injecté            │
│    → Référence aux fichiers déjà produits                   │
│    ↓                                                        │
│ 5. L'agent reprend avec un contexte propre                  │
└─────────────────────────────────────────────────────────────┘
```

**Table `compaction_snapshots`** :

```sql
CREATE TABLE compaction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  run_id UUID NOT NULL REFERENCES heartbeat_runs(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  workflow_instance_id UUID,
  stage_instance_id UUID,

  -- Raison du snapshot
  trigger TEXT NOT NULL, -- 'compaction_detected', 'threshold_85', 'manual'

  -- État au moment du snapshot
  context_tokens_estimated INTEGER,
  model_max_tokens INTEGER,

  -- Résultats intermédiaires
  intermediate_results JSONB NOT NULL DEFAULT '{}',
  -- Exemple : { "filesProduced": ["/src/auth.ts", "/tests/auth.test.ts"],
  --             "stageProgress": "step 3/5 completed",
  --             "lastAction": "wrote authentication middleware" }

  -- Fichiers produits (pour vérification de continuité)
  files_snapshot JSONB,  -- { path: hash } pour chaque fichier produit

  -- Pré-prompts actifs au moment de la compaction
  active_preprompts JSONB,

  -- Session agent (pour resume si possible)
  session_params JSONB,

  -- Résultat du kill+relance
  relaunch_run_id UUID REFERENCES heartbeat_runs(id),
  relaunch_status TEXT, -- 'pending', 'launched', 'failed'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compaction_snapshots_run ON compaction_snapshots(run_id);
CREATE INDEX idx_compaction_snapshots_agent ON compaction_snapshots(agent_id, created_at);
```

#### Stratégie 2 : Réinjection de Pré-Prompts Post-Compaction (REQ-ORCH-07)

Si la compaction survient sans que le kill+relance ait été déclenché (compaction automatique par le SDK avant d'atteindre le seuil de détection), les pré-prompts doivent être réinjectés dans le contexte de l'agent via stdin :

```typescript
// Utilise le pipe stdin du chat temps réel (ADR-005)
async function reinjectPostCompaction(
  runId: string,
  snapshot: CompactionSnapshot
): Promise<void> {
  const process = runningProcesses.get(runId);
  if (!process?.stdin) return;

  // Construire le message de réinjection
  const reinjectMessage = buildReinjectPrompt({
    currentStage: snapshot.stageProgress,
    preprompts: snapshot.activePreprompts,
    intermediateResults: snapshot.intermediateResults,
    filesProduced: snapshot.filesProduced,
  });

  // Écrire sur stdin du processus agent
  process.stdin.write(JSON.stringify({
    type: "system",
    message: reinjectMessage,
  }) + "\n");

  // Log dans l'audit
  await auditLog.insert({
    action: "compaction.reinject",
    entityType: "heartbeat_run",
    entityId: runId,
    details: {
      tokensEstimated: snapshot.contextTokensEstimated,
      prepromptsReinjectCount: Object.keys(snapshot.activePreprompts ?? {}).length,
    },
  });
}
```

**Contenu du prompt de réinjection** :

```typescript
function buildReinjectPrompt(params: {
  currentStage: string;
  preprompts: Record<string, string>;
  intermediateResults: Record<string, unknown>;
  filesProduced: string[];
}): string {
  return `
## CONTEXTE RÉINJECTÉ APRÈS COMPACTION

Ton contexte a été compacté. Voici les informations critiques que tu dois avoir :

### Étape actuelle du workflow
${params.currentStage}

### Instructions de l'étape (pré-prompts)
${Object.entries(params.preprompts).map(([k, v]) => `**${k}** : ${v}`).join("\n")}

### Résultats intermédiaires déjà produits
${JSON.stringify(params.intermediateResults, null, 2)}

### Fichiers déjà produits (ne pas recréer)
${params.filesProduced.map(f => `- ${f}`).join("\n")}

### Instructions
Continue ton travail depuis l'étape actuelle. Ne répète pas le travail déjà fait.
Vérifie que les fichiers listés ci-dessus existent avant de les recréer.
`.trim();
}
```

#### Intégration avec le Heartbeat Service

Le service heartbeat est étendu avec un `CompactionWatcher` :

```typescript
class CompactionWatcher {
  private estimatedTokens = 0;
  private readonly charsPerToken = 4;  // approximation

  // Appelé à chaque log/événement émis par l'agent
  onAgentOutput(chunk: string): void {
    this.estimatedTokens += Math.ceil(chunk.length / this.charsPerToken);
  }

  // Vérifie si on approche de la limite
  checkThresholds(modelMaxTokens: number): "ok" | "warning" | "critical" {
    const utilization = this.estimatedTokens / modelMaxTokens;
    if (utilization >= 0.85) return "critical";
    if (utilization >= 0.70) return "warning";
    return "ok";
  }

  // Appelé quand une compaction est détectée par le SDK
  onCompactionDetected(event: CompactionEvent): void {
    this.estimatedTokens = event.tokensAfter;
    // Déclencher le snapshot + réinjection
  }
}
```

#### Interaction avec le Drift Detection

Le service de drift existant (`server/src/services/drift.ts`) utilise un cache in-memory (`reportCache`) et un système de scan par projet. La compaction peut provoquer du drift si l'agent "oublie" ses contraintes après compaction. Le `CompactionWatcher` notifie le drift service pour déclencher un scan accéléré après toute compaction :

```typescript
// Après une compaction, vérifier que l'agent n'a pas dévié
async function postCompactionDriftCheck(
  agentId: string,
  workflowInstanceId: string
): Promise<void> {
  // Scan rapide des fichiers produits vs les attendus
  // Si divergence → alerte via WebSocket
}
```

### Conséquences

**Positives :**
- La compaction ne fait plus perdre le contexte critique des workflows
- Les résultats intermédiaires sont persistés et récupérables
- La réinjection de pré-prompts maintient l'agent sur sa trajectoire
- La détection proactive (70%/85%) permet d'agir avant la compaction

**Négatives :**
- Le kill+relance interrompt l'agent en cours d'exécution — risque de corruption si au milieu d'une opération fichier
- L'estimation de tokens est imprécise (heuristique chars/4)
- La réinjection via stdin dépend du support stdin par l'adapter (ADR-005)
- Certains SDKs n'émettent pas d'événement de compaction explicite

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Kill pendant une opération critique | Moyenne | Élevé | Fenêtre de grâce : attendre la fin de l'opération en cours (commit, write) avant kill. Détection via les logs de l'agent. |
| Estimation de tokens incorrecte | Élevée | Moyen | L'estimation est une heuristique. En cas de faux négatif (pas de détection), la stratégie 2 (réactive) prend le relais. |
| SDK qui ne supporte pas la réinjection | Moyenne | Élevé | Fallback : kill+relance systématique pour les SDKs sans support stdin. Table de compatibilité par adapter type. |
| Compaction pendant le kill+relance | Faible | Élevé | Le kill est suffisamment rapide (<10s) pour que la compaction ne survienne pas pendant. Si elle survient, un nouveau cycle est déclenché. |
| Boucle de compaction (compact → relance → compact immédiat) | Faible | Critique | Circuit breaker : max 3 relances par run. Après 3 relances, l'agent est mis en pause avec notification au board. |
| Divergence post-compaction non détectée | Moyenne | Élevé | Scan de drift accéléré post-compaction + vérification des fichiers obligatoires de l'étape courante |

---


### Synthèse des Dépendances entre ADRs

```
ADR-004 (Containerisation)
    │
    ├──→ ADR-005 (Chat) : stdin pipe fonctionne aussi dans les containers
    │
    ├──→ ADR-006 (A2A) : le credential proxy expose l'API A2A aux containers
    │
    └──→ ADR-007 (Observabilité) : le credential proxy log chaque requête API

ADR-005 (Chat Temps Réel)
    │
    └──→ ADR-008 (Compaction) : la réinjection post-compaction utilise le pipe stdin

ADR-006 (A2A)
    │
    └──→ ADR-007 (Observabilité) : chaque transaction A2A est auditée

ADR-008 (Compaction)
    │
    ├──→ ADR-005 (Chat) : réinjection via stdin
    │
    └──→ ADR-007 (Observabilité) : chaque compaction est auditée
```

### Récapitulatif des Tables à Créer

| ADR | Tables | Estimation lignes/mois |
|-----|--------|----------------------|
| ADR-004 | `container_profiles`, `container_mount_allowlists`, `container_runs` | ~1K |
| ADR-005 | `chat_channels`, `chat_messages` | ~10K |
| ADR-006 | `a2a_messages`, `a2a_permission_rules` | ~500 |
| ADR-007 | `audit_log` (partitionné, remplace `activity_log`) | ~100K |
| ADR-008 | `compaction_snapshots` | ~100 |

### Récapitulatif des Fichiers à Créer/Modifier

| Fichier | Action | ADR |
|---------|--------|-----|
| `server/src/containers/container-manager.ts` | Créer | ADR-004 |
| `server/src/containers/credential-proxy.ts` | Créer | ADR-004 |
| `server/src/containers/mount-validator.ts` | Créer | ADR-004 |
| `server/src/containers/container-profiles.ts` | Créer | ADR-004 |
| `server/src/containers/resource-monitor.ts` | Créer | ADR-004 |
| `server/src/adapters/docker/docker-adapter.ts` | Créer | ADR-004 |
| `server/src/realtime/live-events-ws.ts` | Modifier | ADR-005 |
| `server/src/services/heartbeat.ts` | Modifier | ADR-005, ADR-008 |
| `server/src/services/agent-chat.ts` | Créer | ADR-005 |
| `server/src/services/a2a-bus.ts` | Créer | ADR-006 |
| `server/src/services/a2a-permissions.ts` | Créer | ADR-006 |
| `server/src/services/audit-summarizer.ts` | Créer | ADR-007 |
| `server/src/services/audit-export.ts` | Créer | ADR-007 |
| `server/src/services/compaction-watcher.ts` | Créer | ADR-008 |
| `packages/db/src/schema/activity_log.ts` | Modifier (→ audit_log) | ADR-007 |
| `packages/db/src/schema/chat.ts` | Créer | ADR-005 |
| `packages/db/src/schema/a2a.ts` | Créer | ADR-006 |
| `packages/db/src/schema/compaction.ts` | Créer | ADR-008 |


---

## 4. Database Schema Changes

### 4.1 Database Schema Changes — Nouvelles Tables

#### 4.1.1 `project_memberships` (T1)

**Objectif** : Scoping d'accès par projet. Permet de restreindre les permissions d'un principal (user ou agent) à un sous-ensemble de projets au sein d'une company.

```typescript
// packages/db/src/schema/project_memberships.ts
export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    principalType: text("principal_type").notNull(), // "user" | "agent"
    principalId: text("principal_id").notNull(),
    role: text("role").notNull().default("contributor"), // "admin" | "contributor" | "viewer"
    grantedByUserId: text("granted_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectPrincipalUniqueIdx: uniqueIndex(
      "project_memberships_company_project_principal_unique_idx"
    ).on(table.companyId, table.projectId, table.principalType, table.principalId),
    companyPrincipalIdx: index("project_memberships_company_principal_idx").on(
      table.companyId, table.principalType, table.principalId
    ),
    projectRoleIdx: index("project_memberships_project_role_idx").on(
      table.projectId, table.role
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id` (tenant isolation)
- `projectId` → `projects.id` (cascade delete)
- `principalType` + `principalId` → correspond à `company_memberships` (user/agent)

**Impact** : Clé pour résoudre le trou critique INV-04. `hasPermission()` lira les `project_memberships` pour valider le scope JSONB `{ projectIds: [...] }` sur les `principal_permission_grants`.

---

#### 4.1.2 `automation_cursors` (T2)

**Objectif** : Curseur d'automatisation par user/agent/project/company (REQ-DUAL-01 à 04). Trois positions : `manual` (0), `assisted` (1), `automatic` (2). Le plafond hiérarchique l'emporte toujours.

```typescript
// packages/db/src/schema/automation_cursors.ts
export const automationCursors = pgTable(
  "automation_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // Granularité : si projectId null → company-wide, si agentId null → tous agents
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id"), // null = default company/project level
    level: integer("level").notNull().default(0), // 0=manual, 1=assisted, 2=automatic
    setByUserId: text("set_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyGranularityUniqueIdx: uniqueIndex("automation_cursors_unique_idx").on(
      table.companyId, table.projectId, table.agentId, table.userId
    ),
    companyProjectIdx: index("automation_cursors_company_project_idx").on(
      table.companyId, table.projectId
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- `projectId` → `projects.id` (nullable, cascade)
- `agentId` → `agents.id` (nullable, cascade)

**Logique de résolution** : La valeur effective est `min(company_level, project_level, user_level)`. Le plafond hiérarchique (CEO > CTO > Manager > Contributor) détermine qui peut élever le curseur. Un Contributor ne peut pas passer en `automatic` si le Manager a fixé `assisted` comme plafond.

---

#### 4.1.3 `chat_channels` (T3)

**Objectif** : Canaux de chat temps réel humain-agent (FR-CHAT). Chaque canal est typiquement lié à un run d'exécution ou à un agent spécifique.

```typescript
// packages/db/src/schema/chat_channels.ts
export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"), // "active" | "archived" | "closed"
    createdByUserId: text("created_by_user_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStatusIdx: index("chat_channels_company_agent_status_idx").on(
      table.companyId, table.agentId, table.status
    ),
    companyRunIdx: index("chat_channels_company_run_idx").on(table.companyId, table.runId),
    companyProjectIdx: index("chat_channels_company_project_idx").on(
      table.companyId, table.projectId
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id` (isolation tenant)
- `agentId` → `agents.id` (cascade delete — suppression agent ferme les canaux)
- `runId` → `heartbeat_runs.id` (optionnel, lié à un run spécifique)
- `projectId` → `projects.id` (optionnel, pour le scoping)

---

#### 4.1.4 `chat_messages` (T4)

**Objectif** : Messages dans les canaux de chat. Support bidirectionnel humain↔agent.

```typescript
// packages/db/src/schema/chat_messages.ts
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    channelId: uuid("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
    senderType: text("sender_type").notNull(), // "user" | "agent" | "system"
    senderId: text("sender_id").notNull(),
    content: text("content").notNull(),
    contentType: text("content_type").notNull().default("text"), // "text" | "code" | "diff" | "system"
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    parentMessageId: uuid("parent_message_id"), // thread support
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("chat_messages_channel_created_idx").on(
      table.channelId, table.createdAt
    ),
    companyChannelIdx: index("chat_messages_company_channel_idx").on(
      table.companyId, table.channelId
    ),
    senderIdx: index("chat_messages_sender_idx").on(
      table.senderType, table.senderId
    ),
  }),
);
```

**Relations** :
- `channelId` → `chat_channels.id` (cascade delete — suppression canal supprime messages)
- `companyId` → `companies.id`
- `parentMessageId` → self-ref (optionnel, threads)

**Rate limiting** : 10 messages/min par user/canal (REQ-CHAT-05). Troncature à 100KB (edge case PRD).

---

#### 4.1.5 `container_profiles` (T5)

**Objectif** : Profils de containerisation par type d'agent (FR-CONT). Définit les limites CPU/RAM/disque, images Docker, mounts autorisés.

```typescript
// packages/db/src/schema/container_profiles.ts
export const containerProfiles = pgTable(
  "container_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    dockerImage: text("docker_image").notNull(),
    cpuLimit: text("cpu_limit").notNull().default("1.0"), // e.g. "1.0", "0.5"
    memoryLimitMb: integer("memory_limit_mb").notNull().default(512),
    diskLimitMb: integer("disk_limit_mb").notNull().default(1024),
    timeoutSeconds: integer("timeout_seconds").notNull().default(3600),
    networkMode: text("network_mode").notNull().default("none"), // "none" | "bridge" | "host"
    mountAllowlist: jsonb("mount_allowlist").$type<string[]>().notNull().default([]),
    envOverrides: jsonb("env_overrides").$type<Record<string, string>>().notNull().default({}),
    securityOpts: jsonb("security_opts").$type<string[]>().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("container_profiles_company_name_unique_idx").on(
      table.companyId, table.name
    ),
    companyDefaultIdx: index("container_profiles_company_default_idx").on(
      table.companyId, table.isDefault
    ),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- Référencé par `agents.containerProfileId` (nouvelle colonne) et `container_instances.profileId`

**Sécurité** :
- `mountAllowlist` : validé via `realpath` + interdiction symlinks (REQ-CONT-03)
- `networkMode` : `none` par défaut (isolation réseau REQ-CONT-05)
- `securityOpts` : options Docker comme `["no-new-privileges"]`

---

#### 4.1.6 `container_instances` (T6)

**Objectif** : Instances de container actives. Tracking du cycle de vie des containers Docker éphémères.

```typescript
// packages/db/src/schema/container_instances.ts
export const containerInstances = pgTable(
  "container_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    profileId: uuid("profile_id").notNull().references(() => containerProfiles.id),
    runId: uuid("run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    dockerContainerId: text("docker_container_id"), // Docker's container ID
    status: text("status").notNull().default("pending"),
      // "pending" | "starting" | "running" | "stopping" | "stopped" | "failed" | "oom_killed"
    hostNode: text("host_node"), // for multi-node
    ipAddress: text("ip_address"),
    portMappings: jsonb("port_mappings").$type<Record<string, string>>(),
    exitCode: integer("exit_code"),
    exitSignal: text("exit_signal"),
    oomKilled: boolean("oom_killed").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentStatusIdx: index("container_instances_company_agent_status_idx").on(
      table.companyId, table.agentId, table.status
    ),
    companyStatusIdx: index("container_instances_company_status_idx").on(
      table.companyId, table.status
    ),
    dockerIdIdx: index("container_instances_docker_id_idx").on(table.dockerContainerId),
    runIdx: index("container_instances_run_idx").on(table.runId),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- `agentId` → `agents.id`
- `profileId` → `container_profiles.id`
- `runId` → `heartbeat_runs.id` (optionnel)

---

#### 4.1.7 `credential_proxy_rules` (T7)

**Objectif** : Règles de proxy pour credentials (REQ-CONT-02). Définit quels secrets un agent peut accéder via le proxy HTTP, sans jamais voir la valeur.

```typescript
// packages/db/src/schema/credential_proxy_rules.ts
export const credentialProxyRules = pgTable(
  "credential_proxy_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    profileId: uuid("profile_id").references(() => containerProfiles.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    secretId: uuid("secret_id").notNull().references(() => companySecrets.id, { onDelete: "cascade" }),
    targetUrl: text("target_url").notNull(), // URL pattern where secret is injected
    headerName: text("header_name").notNull().default("Authorization"), // HTTP header to inject
    headerTemplate: text("header_template").notNull().default("Bearer {{secret}}"),
    allowedMethods: jsonb("allowed_methods").$type<string[]>().notNull().default(["GET", "POST"]),
    maxRequestsPerMinute: integer("max_requests_per_minute").notNull().default(60),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProfileIdx: index("credential_proxy_rules_company_profile_idx").on(
      table.companyId, table.profileId
    ),
    companyAgentIdx: index("credential_proxy_rules_company_agent_idx").on(
      table.companyId, table.agentId
    ),
    secretIdx: index("credential_proxy_rules_secret_idx").on(table.secretId),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`
- `profileId` → `container_profiles.id` (optionnel — peut s'appliquer via profil ou directement via agent)
- `agentId` → `agents.id` (optionnel)
- `secretId` → `company_secrets.id` (cascade)

**Sécurité** : Le proxy HTTP intercepte les requêtes sortantes du container, injecte le header avec la valeur du secret, et forwarde. L'agent ne voit JAMAIS la valeur du secret.

---

#### 4.1.8 `audit_events` (T8)

**Objectif** : Audit log enterprise immutable (REQ-OBS-02, REQ-AUDIT-01). Séparé de `activity_log` existant pour les raisons suivantes :
- **Immutabilité** : TRIGGER deny UPDATE/DELETE (NFR-SEC-04)
- **Partitionnement** : PARTITION BY RANGE sur `created_at` pour rétention 3 ans
- **Non-répudiation** : hash chain (REQ-AUDIT-02)
- **Performance** : table séparée pour éviter de pénaliser l'`activity_log` opérationnel

```typescript
// packages/db/src/schema/audit_events.ts
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(), // pas de FK pour immutabilité
    actorType: text("actor_type").notNull(), // "user" | "agent" | "system"
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(), // "member.invited", "permission.changed", "workflow.enforced", etc.
    entityType: text("entity_type").notNull(), // "company", "project", "agent", "workflow", etc.
    entityId: text("entity_id").notNull(),
    severity: text("severity").notNull().default("info"), // "info" | "warn" | "critical"
    workflowInstanceId: uuid("workflow_instance_id"),
    stageInstanceId: uuid("stage_instance_id"),
    projectId: uuid("project_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    prevHash: text("prev_hash"), // hash chain pour non-répudiation
    eventHash: text("event_hash"), // SHA-256(prevHash + action + entityId + timestamp)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("audit_events_company_created_idx").on(
      table.companyId, table.createdAt
    ),
    companyActionIdx: index("audit_events_company_action_idx").on(
      table.companyId, table.action
    ),
    companyActorIdx: index("audit_events_company_actor_idx").on(
      table.companyId, table.actorType, table.actorId
    ),
    entityIdx: index("audit_events_entity_idx").on(table.entityType, table.entityId),
    severityIdx: index("audit_events_severity_idx").on(table.companyId, table.severity),
    hashChainIdx: index("audit_events_hash_chain_idx").on(table.eventHash),
  }),
);
```

**Immutabilité SQL** (à appliquer via migration raw SQL) :
```sql
-- TRIGGER deny UPDATE/DELETE sur audit_events
CREATE OR REPLACE FUNCTION deny_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is immutable: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();
```

**Partitionnement** (migration raw SQL) :
```sql
-- Partitionnement mensuel pour rétention 3 ans
-- Note : Drizzle ne supporte pas nativement le partitionnement,
-- on utilise une migration custom
CREATE TABLE audit_events_partitioned (
  LIKE audit_events INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Partition automatique via pg_partman ou cron job mensuel
```

**Relations** : Pas de foreign keys (table immutable — les FK empêcheraient le DELETE cascade des entités référencées). Les IDs sont stockés comme références logiques.

---

#### 4.1.9 `sso_configurations` (T9)

**Objectif** : Configuration SSO par company (NFR-SEC-05). Support SAML et OIDC via Better Auth.

```typescript
// packages/db/src/schema/sso_configurations.ts
export const ssoConfigurations = pgTable(
  "sso_configurations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    protocol: text("protocol").notNull(), // "saml" | "oidc"
    displayName: text("display_name").notNull(),
    issuerUrl: text("issuer_url"),
    clientId: text("client_id"),
    // clientSecret stocké via company_secrets, pas en clair
    clientSecretId: uuid("client_secret_id").references(() => companySecrets.id),
    metadataUrl: text("metadata_url"), // SAML metadata endpoint
    metadataXml: text("metadata_xml"), // SAML metadata XML (alternative)
    callbackPath: text("callback_path"), // override du callback URL path
    emailDomain: text("email_domain"), // auto-match : emails @domain → cette config
    attributeMapping: jsonb("attribute_mapping").$type<Record<string, string>>().notNull().default({}),
    defaultRole: text("default_role").notNull().default("contributor"),
    autoProvision: boolean("auto_provision").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    testResult: text("test_result"), // "success" | "failed"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProtocolIdx: index("sso_configurations_company_protocol_idx").on(
      table.companyId, table.protocol
    ),
    emailDomainIdx: uniqueIndex("sso_configurations_email_domain_idx").on(table.emailDomain),
  }),
);
```

**Relations** :
- `companyId` → `companies.id` (cascade)
- `clientSecretId` → `company_secrets.id` (le secret OAuth est stocké dans le vault, pas en clair)

---

#### 4.1.10 `import_jobs` (T10)

**Objectif** : Jobs d'import Jira/Linear/ClickUp (REQ-ONB-03). Suivi de l'état d'import avec mapping et résultats.

```typescript
// packages/db/src/schema/import_jobs.ts
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    source: text("source").notNull(), // "jira" | "linear" | "clickup" | "csv"
    status: text("status").notNull().default("pending"),
      // "pending" | "mapping" | "running" | "completed" | "failed" | "cancelled"
    sourceConfig: jsonb("source_config").$type<Record<string, unknown>>().notNull(),
      // { baseUrl, projectKey, apiToken (ref to secret), etc. }
    mappingConfig: jsonb("mapping_config").$type<Record<string, unknown>>(),
      // { statusMapping: {}, userMapping: {}, projectMapping: {} }
    progress: jsonb("progress").$type<{
      total: number;
      imported: number;
      skipped: number;
      errors: number;
    }>().notNull().default({ total: 0, imported: 0, skipped: 0, errors: 0 }),
    errorLog: jsonb("error_log").$type<Array<{ item: string; error: string }>>(),
    startedByUserId: text("started_by_user_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("import_jobs_company_status_idx").on(table.companyId, table.status),
    companySourceIdx: index("import_jobs_company_source_idx").on(table.companyId, table.source),
  }),
);
```

**Relations** :
- `companyId` → `companies.id`

---


### 4.2 Database Schema Changes — Tables Modifiées

#### 4.2.1 `companies` — 4 colonnes ajoutées

```typescript
// Colonnes ajoutées à packages/db/src/schema/companies.ts
tier: text("tier").notNull().default("free"),
  // "free" | "team" | "enterprise" | "on_premise"
ssoEnabled: boolean("sso_enabled").notNull().default(false),
maxUsers: integer("max_users").notNull().default(5),
  // free=5, team=50, enterprise=10000
parentCompanyId: uuid("parent_company_id").references(() => companies.id),
  // null = company racine, sinon multi-tenant hiérarchique
```

**Migration** :
```sql
ALTER TABLE companies ADD COLUMN tier text NOT NULL DEFAULT 'free';
ALTER TABLE companies ADD COLUMN sso_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN max_users integer NOT NULL DEFAULT 5;
ALTER TABLE companies ADD COLUMN parent_company_id uuid REFERENCES companies(id);
```

**Impact sur les requêtes existantes** : Aucun. Toutes les nouvelles colonnes ont des defaults. Les routes existantes (`companyRoutes`) continuent de fonctionner sans modification. Les nouvelles colonnes sont exposées uniquement via les nouveaux endpoints.

**Backward compatibility** : Les companies existantes sont automatiquement `tier=free`, `ssoEnabled=false`, `maxUsers=5`, `parentCompanyId=null`. Aucun changement de comportement.

#### 4.2.2 `company_memberships` — 1 colonne ajoutée

```typescript
// Colonne ajoutée à packages/db/src/schema/company_memberships.ts
businessRole: text("business_role").notNull().default("contributor"),
  // "admin" | "manager" | "contributor" | "viewer"
```

**Migration** :
```sql
ALTER TABLE company_memberships ADD COLUMN business_role text NOT NULL DEFAULT 'contributor';
-- Les memberships existantes deviennent 'contributor' par défaut
-- L'owner/créateur de la company doit être promu 'admin' manuellement
```

**Impact sur les requêtes existantes** : Le champ `membershipRole` existant (text nullable) coexiste avec `businessRole`. `membershipRole` est un rôle technique libre (e.g. "member", "owner"), tandis que `businessRole` est le rôle RBAC métier (les 4 niveaux). `hasPermission()` utilisera `businessRole` pour les presets, et `principal_permission_grants` pour les overrides granulaires.

**Backward compatibility** : Tous les membres existants deviennent `contributor`. Les routes existantes qui lisent `membershipRole` ne sont pas affectées.

#### 4.2.3 `agents` — 2 colonnes ajoutées

```typescript
// Colonnes ajoutées à packages/db/src/schema/agents.ts
containerProfileId: uuid("container_profile_id").references(() => containerProfiles.id, { onDelete: "set null" }),
isolationMode: text("isolation_mode").notNull().default("process"),
  // "process" | "container" | "container_strict"
```

**Migration** :
```sql
ALTER TABLE agents ADD COLUMN container_profile_id uuid REFERENCES container_profiles(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN isolation_mode text NOT NULL DEFAULT 'process';
```

**Impact sur les requêtes existantes** : Les agents existants restent en mode `process` (comportement actuel inchangé). Le `containerProfileId` est nullable — les agents sans profil continuent de fonctionner comme avant. Les routes `agentRoutes` qui créent/modifient des agents doivent accepter les nouveaux champs optionnels.

**Backward compatibility** : Complète. Le mode `process` correspond au comportement existant.

#### 4.2.4 `principal_permission_grants` — 9 nouvelles PERMISSION_KEYS

Pas de modification de schéma : les nouvelles clés sont ajoutées dans `packages/shared/src/constants.ts`.

```typescript
// Modification de packages/shared/src/constants.ts
export const PERMISSION_KEYS = [
  // 6 existantes
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
  // 9 nouvelles (15 total)
  "projects:create",
  "projects:manage_members",
  "workflows:create",
  "workflows:enforce",
  "agents:manage_containers",
  "company:manage_settings",
  "company:manage_sso",
  "audit:read",
  "audit:export",
] as const;
```

**Impact sur les requêtes existantes** : Aucun impact sur la table elle-même. Les 6 clés existantes continuent de fonctionner. Les 9 nouvelles sont utilisées par les nouvelles routes. La modification est dans le code TypeScript, pas en base.

#### 4.2.5 `activity_log` — 3 colonnes ajoutées

```typescript
// Colonnes ajoutées à packages/db/src/schema/activity_log.ts
ipAddress: text("ip_address"),
userAgent: text("user_agent"),
severity: text("severity").notNull().default("info"),
  // "info" | "warn" | "critical"
```

**Migration** :
```sql
ALTER TABLE activity_log ADD COLUMN ip_address text;
ALTER TABLE activity_log ADD COLUMN user_agent text;
ALTER TABLE activity_log ADD COLUMN severity text NOT NULL DEFAULT 'info';
CREATE INDEX activity_log_severity_idx ON activity_log(company_id, severity);
```

**Impact sur les requêtes existantes** : Aucun. Les colonnes sont nullable (sauf severity avec default). Les entrées existantes de l'activity log reçoivent `severity=info`, `ipAddress=null`, `userAgent=null`. Le service `logActivity()` existant sera enrichi pour capturer req.ip et req.headers['user-agent'].

**Backward compatibility** : Complète.

---


---

## 5. API Design par Functional Requirement

### 5.1 FR-MU : Multi-User & Auth

Les endpoints existants (`accessRoutes` dans `server/src/routes/access.ts`) couvrent déjà une grande partie de FR-MU. Les ajouts sont mineurs.

#### `POST /api/companies/:companyId/invites/bulk`
**Objectif** : REQ-MU-03 — Invitation en bulk (CSV ou liste emails).

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/invites/bulk` |
| **Auth** | Permission `users:invite` |
| **Rate limit** | 20/h par user |

**Request body** :
```json
{
  "emails": ["alice@example.com", "bob@example.com"],
  "businessRole": "contributor",
  "projectIds": ["uuid-1", "uuid-2"],
  "message": "Bienvenue dans l'équipe MnM !"
}
```

**Response 201** :
```json
{
  "results": [
    { "email": "alice@example.com", "status": "invited", "inviteId": "uuid" },
    { "email": "bob@example.com", "status": "already_member" }
  ],
  "invited": 1,
  "skipped": 1
}
```

**Response 403** : `{ "error": "forbidden", "message": "Missing permission users:invite" }`

---

#### `GET /api/companies/:companyId/members`
**Objectif** : REQ-MU-02 — Page Membres. Endpoint existant (`listMembers` dans `access.ts`) enrichi avec pagination, filtres et businessRole.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/members` |
| **Auth** | Tout membre actif de la company |
| **Rate limit** | Standard (100/min) |

**Query params** :
```
?status=active&businessRole=admin&search=alice&page=1&limit=20&sortBy=createdAt&sortDir=desc
```

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "principalType": "user",
      "principalId": "user-id",
      "status": "active",
      "membershipRole": "owner",
      "businessRole": "admin",
      "user": { "name": "Alice", "email": "alice@example.com", "image": null },
      "permissions": ["agents:create", "users:invite", "users:manage_permissions"],
      "createdAt": "2026-03-14T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42 }
}
```

---

#### `PATCH /api/companies/:companyId/members/:memberId/role`
**Objectif** : Changement de rôle métier d'un membre.

| Champ | Valeur |
|-------|--------|
| **Méthode** | PATCH |
| **Path** | `/api/companies/:companyId/members/:memberId/role` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "businessRole": "manager"
}
```

**Response 200** :
```json
{
  "id": "uuid",
  "businessRole": "manager",
  "permissions": ["agents:create", "tasks:assign", "tasks:assign_scope", "joins:approve"]
}
```

**Edge cases** :
- Dernier admin qui se rétrograde → **403** `"Cannot demote the last admin"`
- Changement de rôle pendant session → permissions appliquées au prochain appel API (pas besoin de re-login)

---

#### `DELETE /api/companies/:companyId/members/:memberId`
**Objectif** : Supprimer un membre de la company.

| Champ | Valeur |
|-------|--------|
| **Méthode** | DELETE |
| **Path** | `/api/companies/:companyId/members/:memberId` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Response 200** :
```json
{ "id": "uuid", "status": "removed" }
```

**Edge cases** :
- Suppression d'un membre avec agents actifs → agents passent en status `paused` et perdent leurs assignations
- Dernier admin → **403** `"Cannot remove the last admin"`

---

### 5.2 FR-RBAC : Roles & Permissions

#### `GET /api/companies/:companyId/roles`
**Objectif** : REQ-RBAC-02 — Liste des presets de rôles et leurs permissions.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/roles` |
| **Auth** | Tout membre actif |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "roles": [
    {
      "name": "admin",
      "label": "Administrateur",
      "color": "#ef4444",
      "permissions": [
        "agents:create", "users:invite", "users:manage_permissions",
        "tasks:assign", "tasks:assign_scope", "joins:approve",
        "projects:create", "projects:manage_members",
        "workflows:create", "workflows:enforce",
        "agents:manage_containers", "company:manage_settings",
        "company:manage_sso", "audit:read", "audit:export"
      ]
    },
    {
      "name": "manager",
      "label": "Manager",
      "color": "#3b82f6",
      "permissions": [
        "agents:create", "tasks:assign", "tasks:assign_scope",
        "joins:approve", "projects:create", "projects:manage_members",
        "workflows:create", "audit:read"
      ]
    },
    {
      "name": "contributor",
      "label": "Contributeur",
      "color": "#22c55e",
      "permissions": [
        "tasks:assign", "agents:create"
      ]
    },
    {
      "name": "viewer",
      "label": "Observateur",
      "color": "#6b7280",
      "permissions": [
        "audit:read"
      ]
    }
  ]
}
```

---

#### `GET /api/companies/:companyId/permissions/matrix`
**Objectif** : REQ-RBAC-07 — Matrice complète des permissions (admin UI).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/permissions/matrix` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "permissionKeys": ["agents:create", "users:invite", "..."],
  "members": [
    {
      "memberId": "uuid",
      "name": "Alice",
      "businessRole": "admin",
      "grants": {
        "agents:create": { "granted": true, "source": "preset", "scope": null },
        "users:invite": { "granted": true, "source": "custom", "scope": { "projectIds": ["uuid-1"] } }
      }
    }
  ]
}
```

---

#### `PUT /api/companies/:companyId/members/:memberId/permissions`
**Objectif** : Override granulaire des permissions d'un membre. Endpoint existant (`setMemberPermissions` dans `access.ts`) enrichi avec support scope.

| Champ | Valeur |
|-------|--------|
| **Méthode** | PUT |
| **Path** | `/api/companies/:companyId/members/:memberId/permissions` |
| **Auth** | Permission `users:manage_permissions` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "grants": [
    { "permissionKey": "tasks:assign", "scope": { "projectIds": ["uuid-1", "uuid-2"] } },
    { "permissionKey": "agents:create", "scope": null },
    { "permissionKey": "workflows:create", "scope": { "projectIds": ["uuid-1"] } }
  ]
}
```

**Response 200** :
```json
{
  "memberId": "uuid",
  "grants": [
    { "permissionKey": "tasks:assign", "scope": { "projectIds": ["uuid-1", "uuid-2"] } },
    { "permissionKey": "agents:create", "scope": null },
    { "permissionKey": "workflows:create", "scope": { "projectIds": ["uuid-1"] } }
  ]
}
```

---

#### Correction critique : `hasPermission()` avec scope

Le trou critique identifié dans INV-04 : `hasPermission()` (access.ts:45-66) ne lit JAMAIS le `scope` JSONB.

**Signature modifiée** :
```typescript
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  resourceScope?: { projectId?: string },
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  const grants = await db
    .select()
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
        eq(principalPermissionGrants.permissionKey, permissionKey),
      ),
    );

  if (grants.length === 0) return false;

  // Si aucun scope demandé, accepter tout grant (scope null = company-wide)
  if (!resourceScope?.projectId) {
    return grants.some((g) => !g.scope); // seul un grant sans scope couvre company-wide
  }

  // Si scope demandé, vérifier que le grant couvre le projet
  return grants.some((g) => {
    if (!g.scope) return true; // grant sans scope = accès company-wide → couvre tout projet
    const scopeData = g.scope as { projectIds?: string[] };
    if (!scopeData.projectIds) return true;
    return scopeData.projectIds.includes(resourceScope.projectId!);
  });
}
```

**Impact** : Les 22 fichiers de routes doivent passer le `resourceScope` quand ils opèrent sur un projet spécifique. Exemple dans `issueRoutes` :
```typescript
// Avant
if (!(await access.canUser(companyId, userId, "tasks:assign"))) return forbidden(res);

// Après
if (!(await access.canUser(companyId, userId, "tasks:assign", { projectId }))) return forbidden(res);
```

---

### 5.3 FR-ORCH : Orchestrateur Déterministe

#### `POST /api/companies/:companyId/workflows/:workflowId/enforce`
**Objectif** : REQ-ORCH-01 — Activer l'enforcement déterministe sur un workflow.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/workflows/:workflowId/enforce` |
| **Auth** | Permission `workflows:enforce` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "enforcementMode": "strict",
  "driftSensitivity": "medium",
  "requiredFiles": {
    "stage_1": ["requirements.md", "specs.md"],
    "stage_2": ["design.md"]
  },
  "prePrompts": {
    "stage_1": "Tu es un analyste. Lis les requirements et produis un rapport.",
    "stage_2": "Tu es un designer. Utilise le rapport d'analyse."
  },
  "humanValidationStages": [1, 3]
}
```

**Response 200** :
```json
{
  "workflowId": "uuid",
  "enforcementMode": "strict",
  "stages": [
    { "order": 1, "name": "Analyse", "enforced": true, "requiredFiles": ["requirements.md"] }
  ]
}
```

---

#### `GET /api/companies/:companyId/drift/alerts`
**Objectif** : REQ-ORCH-05 — Drift detection alerts.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/drift/alerts` |
| **Auth** | Permission `workflows:enforce` ou `audit:read` |
| **Rate limit** | Standard |

**Query params** :
```
?status=active&severity=high&workflowId=uuid&since=2026-03-01T00:00:00Z&limit=50
```

**Response 200** :
```json
{
  "alerts": [
    {
      "id": "uuid",
      "workflowInstanceId": "uuid",
      "stageInstanceId": "uuid",
      "agentId": "uuid",
      "type": "step_skipped",
      "severity": "high",
      "expected": "Stage 2: Design",
      "observed": "Stage 3: Implementation (skipped Design)",
      "detectedAt": "2026-03-14T10:30:00Z",
      "resolvedAt": null,
      "resolution": null
    }
  ],
  "total": 12
}
```

---

#### `POST /api/companies/:companyId/drift/alerts/:alertId/resolve`
**Objectif** : Résolution d'une alerte drift.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/drift/alerts/:alertId/resolve` |
| **Auth** | Permission `workflows:enforce` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "resolution": "reload",
  "note": "Agent rechargé avec contexte corrigé"
}
```

`resolution` : `"reload"` | `"kill_restart"` | `"ignore"` | `"rollback"`

**Response 200** :
```json
{
  "id": "uuid",
  "resolution": "reload",
  "resolvedAt": "2026-03-14T11:00:00Z",
  "resolvedByUserId": "user-id"
}
```

---

### 5.4 FR-OBS : Observabilité & Audit

#### `GET /api/companies/:companyId/audit`
**Objectif** : REQ-OBS-02 — Consultation audit log immutable.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/audit` |
| **Auth** | Permission `audit:read` |
| **Rate limit** | Standard |

**Query params** :
```
?actorType=user&actorId=user-id&action=permission.changed&entityType=agent
&severity=critical&since=2026-03-01&until=2026-03-14&page=1&limit=50
```

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "actorType": "user",
      "actorId": "user-id",
      "actorName": "Alice",
      "action": "permission.changed",
      "entityType": "agent",
      "entityId": "agent-uuid",
      "entityName": "Agent Builder",
      "severity": "info",
      "workflowInstanceId": null,
      "details": { "before": { "role": "contributor" }, "after": { "role": "admin" } },
      "ipAddress": "192.168.1.10",
      "createdAt": "2026-03-14T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1240 }
}
```

---

#### `GET /api/companies/:companyId/audit/export`
**Objectif** : REQ-OBS-05 — Export audit log (CSV, JSON).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/audit/export` |
| **Auth** | Permission `audit:export` |
| **Rate limit** | 5/h par user |

**Query params** :
```
?format=csv&since=2026-01-01&until=2026-03-14&actions=permission.changed,member.invited
```

**Response 200** : Stream CSV ou JSON selon `format`.
- Header `Content-Type: text/csv` ou `application/json`
- Header `Content-Disposition: attachment; filename="audit-export-2026-03-14.csv"`

---

#### `GET /api/companies/:companyId/dashboards/:type`
**Objectif** : REQ-OBS-03 — Dashboards management agrégés (JAMAIS individuels — Vérité #20).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/dashboards/:type` |
| **Auth** | Selon le type : `audit:read` (executive), membre actif (team/project) |
| **Rate limit** | Standard |

**Types supportés** : `executive`, `team`, `project`, `drift`, `costs`

**Response 200 (type=executive)** :
```json
{
  "type": "executive",
  "period": { "start": "2026-03-01", "end": "2026-03-14" },
  "metrics": {
    "activeAgents": 12,
    "activeWorkflows": 5,
    "completedTasks": 147,
    "driftAlerts": 3,
    "totalCostCents": 45200,
    "budgetUsedPercent": 67,
    "memberCount": 24,
    "projectCount": 8
  },
  "trends": {
    "tasksPerDay": [12, 15, 8, 20, 18, 14, 22, 19, 16, 25, 21, 17, 23, 20],
    "costPerDay": [3200, 3500, 2800, 4100, 3900, 3600, 4200, 3800, 3400, 4500, 4100, 3700, 4300, 4000]
  }
}
```

---

### 5.5 FR-CHAT : Chat Temps Réel avec Agents

#### WebSocket `/ws/chat/:channelId`
**Objectif** : REQ-CHAT-01 — WebSocket bidirectionnel humain-agent.

| Champ | Valeur |
|-------|--------|
| **Protocol** | WebSocket (wss://) |
| **Path** | `/ws/chat/:channelId` |
| **Auth** | Token de session dans query param `?token=xxx` ou header `Authorization` |
| **Rate limit** | 10 messages/min par user/canal (REQ-CHAT-05) |

**Messages client → serveur** :
```json
{
  "type": "message",
  "content": "Utilise le pattern Repository",
  "contentType": "text"
}
```

```json
{
  "type": "typing",
  "isTyping": true
}
```

**Messages serveur → client** :
```json
{
  "type": "message",
  "id": "uuid",
  "senderType": "agent",
  "senderId": "agent-uuid",
  "senderName": "Agent Builder",
  "content": "Compris, je refactorise avec le pattern Repository...",
  "contentType": "text",
  "createdAt": "2026-03-14T10:30:00Z"
}
```

```json
{
  "type": "status",
  "channelStatus": "active",
  "agentStatus": "running"
}
```

```json
{
  "type": "error",
  "code": "rate_limited",
  "message": "Rate limit exceeded: 10 messages/min"
}
```

**Reconnexion** (REQ-CHAT-03) : Buffer 30 secondes côté serveur. À la reconnexion, le client envoie :
```json
{ "type": "sync", "lastMessageId": "uuid" }
```
Le serveur répond avec les messages manqués.

**Edge cases** :
- Message après fin d'exécution → rejeté avec `{ "type": "error", "code": "channel_closed" }`
- Message > 100KB → troncature automatique
- XSS → sanitization UTF-8 strict côté serveur

---

#### `POST /api/companies/:companyId/chat/channels`
**Objectif** : Créer un canal de chat pour un agent.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/chat/channels` |
| **Auth** | Membre actif + accès à l'agent (scope projet si applicable) |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "agentId": "uuid",
  "runId": "uuid",
  "name": "Chat Builder — Sprint 3"
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "agentId": "uuid",
  "runId": "uuid",
  "name": "Chat Builder — Sprint 3",
  "status": "active",
  "wsUrl": "/ws/chat/uuid"
}
```

---

#### `GET /api/companies/:companyId/chat/channels/:channelId/messages`
**Objectif** : Historique des messages (REST fallback + pagination).

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/chat/channels/:channelId/messages` |
| **Auth** | Membre actif (viewer = read-only, REQ-CHAT-04) |
| **Rate limit** | Standard |

**Query params** : `?before=uuid&limit=50`

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "senderType": "user",
      "senderId": "user-id",
      "senderName": "Alice",
      "content": "Utilise le pattern Repository",
      "contentType": "text",
      "createdAt": "2026-03-14T10:30:00Z"
    }
  ],
  "hasMore": true
}
```

---

### 5.6 FR-CONT : Containerisation

#### `POST /api/companies/:companyId/containers/launch`
**Objectif** : REQ-CONT-01 — Lancer un container Docker éphémère.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/containers/launch` |
| **Auth** | Permission `agents:manage_containers` |
| **Rate limit** | 10/min par company |

**Request body** :
```json
{
  "agentId": "uuid",
  "profileId": "uuid",
  "runId": "uuid",
  "envOverrides": { "NODE_ENV": "production" },
  "command": ["node", "agent.js"]
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "agentId": "uuid",
  "profileId": "uuid",
  "dockerContainerId": "abc123def",
  "status": "starting",
  "credentialProxyUrl": "http://localhost:9876/proxy/uuid",
  "createdAt": "2026-03-14T10:00:00Z"
}
```

---

#### `GET /api/companies/:companyId/containers/:containerId/status`
**Objectif** : État d'un container.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/containers/:containerId/status` |
| **Auth** | Permission `agents:manage_containers` ou membre avec accès au projet de l'agent |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "id": "uuid",
  "status": "running",
  "agentId": "uuid",
  "profileName": "standard-node",
  "resources": {
    "cpuPercent": 45.2,
    "memoryMb": 312,
    "memoryLimitMb": 512,
    "diskMb": 89
  },
  "startedAt": "2026-03-14T10:00:05Z",
  "uptimeSeconds": 3595
}
```

---

#### `POST /api/companies/:companyId/containers/:containerId/stop`
**Objectif** : Arrêt d'un container (SIGTERM puis SIGKILL 10s — REQ-CONT-07).

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/containers/:containerId/stop` |
| **Auth** | Permission `agents:manage_containers` |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "gracePeriodSeconds": 10,
  "reason": "Manual stop by admin"
}
```

**Response 200** :
```json
{
  "id": "uuid",
  "status": "stopping",
  "stoppedAt": null,
  "reason": "Manual stop by admin"
}
```

---

#### `GET /api/companies/:companyId/containers`
**Objectif** : Liste de tous les containers actifs d'une company.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/containers` |
| **Auth** | Permission `agents:manage_containers` |
| **Rate limit** | Standard |

**Query params** : `?status=running&agentId=uuid&page=1&limit=20`

**Response 200** :
```json
{
  "data": [
    {
      "id": "uuid",
      "agentId": "uuid",
      "agentName": "Builder",
      "profileName": "standard-node",
      "status": "running",
      "startedAt": "2026-03-14T10:00:05Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

#### CRUD Container Profiles

**`POST /api/companies/:companyId/container-profiles`** — Créer un profil
- Auth : `agents:manage_containers`
- Body : `{ name, dockerImage, cpuLimit, memoryLimitMb, diskLimitMb, timeoutSeconds, networkMode, mountAllowlist, securityOpts }`
- Response 201 : profil créé

**`GET /api/companies/:companyId/container-profiles`** — Lister les profils
- Auth : membre actif
- Response 200 : liste paginée

**`PATCH /api/companies/:companyId/container-profiles/:profileId`** — Modifier un profil
- Auth : `agents:manage_containers`
- Body : champs partiels
- Response 200 : profil mis à jour

**`DELETE /api/companies/:companyId/container-profiles/:profileId`** — Supprimer un profil
- Auth : `agents:manage_containers`
- Edge case : profil utilisé par des agents → **409 Conflict**
- Response 200 : `{ deleted: true }`

---

### 5.7 FR-DUAL : Dual-Speed Workflow

#### `GET /api/companies/:companyId/automation/cursor`
**Objectif** : REQ-DUAL-01 — Obtenir la valeur effective du curseur d'automatisation.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/automation/cursor` |
| **Auth** | Membre actif |
| **Rate limit** | Standard |

**Query params** : `?projectId=uuid&agentId=uuid`

**Response 200** :
```json
{
  "effectiveLevel": 1,
  "effectiveName": "assisted",
  "levels": {
    "company": { "level": 2, "setBy": "Alice (admin)" },
    "project": { "level": 1, "setBy": "Bob (manager)" },
    "user": null
  },
  "maxAllowed": 1,
  "reason": "Project-level ceiling (manager)"
}
```

---

#### `PUT /api/companies/:companyId/automation/cursor`
**Objectif** : REQ-DUAL-02/03 — Modifier le curseur d'automatisation.

| Champ | Valeur |
|-------|--------|
| **Méthode** | PUT |
| **Path** | `/api/companies/:companyId/automation/cursor` |
| **Auth** | Selon granularité : admin (company), manager (project), contributor (user/agent) |
| **Rate limit** | Standard |

**Request body** :
```json
{
  "level": 2,
  "projectId": null,
  "agentId": null,
  "userId": null
}
```

**Response 200** :
```json
{
  "level": 2,
  "effectiveLevel": 1,
  "reason": "Capped by project-level ceiling (manager set level=1)"
}
```

**Response 403** : `"Cannot set automation level above your role ceiling"`

---

### 5.8 FR-A2A : Agent-to-Agent

#### `POST /api/companies/:companyId/agents/:agentId/query`
**Objectif** : REQ-A2A-01 — Query inter-agents avec validation humaine obligatoire.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/agents/:agentId/query` |
| **Auth** | Agent API key + permission sur l'agent cible |
| **Rate limit** | 30/min par agent |

**Request body** :
```json
{
  "targetAgentId": "uuid",
  "queryType": "context_request",
  "content": "Quels fichiers as-tu modifiés dans le sprint 3 ?",
  "requiresHumanApproval": true
}
```

**Response 202** (si approbation humaine requise) :
```json
{
  "queryId": "uuid",
  "status": "pending_approval",
  "approvalId": "uuid"
}
```

**Response 200** (si approbation automatique) :
```json
{
  "queryId": "uuid",
  "status": "completed",
  "response": { "files": ["src/auth.ts", "src/routes/login.ts"] }
}
```

---

### 5.9 SSO Configuration

#### `POST /api/companies/:companyId/sso`
**Objectif** : NFR-SEC-05 — Configuration SSO SAML/OIDC.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/sso` |
| **Auth** | Permission `company:manage_sso` |
| **Rate limit** | 5/h |

**Request body** :
```json
{
  "protocol": "oidc",
  "displayName": "CBA SSO",
  "issuerUrl": "https://login.cba.com",
  "clientId": "mnm-prod",
  "clientSecret": "secret-value",
  "emailDomain": "cba.com",
  "defaultRole": "contributor",
  "autoProvision": true
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "protocol": "oidc",
  "displayName": "CBA SSO",
  "emailDomain": "cba.com",
  "enabled": false,
  "testUrl": "/api/companies/uuid/sso/uuid/test"
}
```

---

#### `POST /api/companies/:companyId/sso/:ssoId/test`
**Objectif** : Test de la configuration SSO avant activation.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/sso/:ssoId/test` |
| **Auth** | Permission `company:manage_sso` |
| **Rate limit** | 10/h |

**Response 200** :
```json
{
  "result": "success",
  "details": {
    "idpReachable": true,
    "tokenEndpoint": true,
    "userInfoEndpoint": true,
    "attributeMapping": { "email": "ok", "name": "ok" }
  },
  "testedAt": "2026-03-14T10:00:00Z"
}
```

---

### 5.10 Import Jobs

#### `POST /api/companies/:companyId/imports`
**Objectif** : REQ-ONB-03 — Lancer un import Jira/Linear.

| Champ | Valeur |
|-------|--------|
| **Méthode** | POST |
| **Path** | `/api/companies/:companyId/imports` |
| **Auth** | Permission `company:manage_settings` |
| **Rate limit** | 3/h |

**Request body** :
```json
{
  "source": "jira",
  "sourceConfig": {
    "baseUrl": "https://cba.atlassian.net",
    "projectKey": "ALPHA",
    "apiTokenSecretId": "uuid"
  },
  "mappingConfig": {
    "statusMapping": {
      "To Do": "backlog",
      "In Progress": "in_progress",
      "Done": "done"
    }
  }
}
```

**Response 201** :
```json
{
  "id": "uuid",
  "source": "jira",
  "status": "mapping",
  "progress": { "total": 0, "imported": 0, "skipped": 0, "errors": 0 }
}
```

---

#### `GET /api/companies/:companyId/imports/:importId`
**Objectif** : Suivi de la progression d'un import.

| Champ | Valeur |
|-------|--------|
| **Méthode** | GET |
| **Path** | `/api/companies/:companyId/imports/:importId` |
| **Auth** | Permission `company:manage_settings` |
| **Rate limit** | Standard |

**Response 200** :
```json
{
  "id": "uuid",
  "source": "jira",
  "status": "running",
  "progress": { "total": 245, "imported": 180, "skipped": 12, "errors": 3 },
  "errorLog": [
    { "item": "ALPHA-42", "error": "User 'jsmith' not found in MnM" }
  ],
  "startedAt": "2026-03-14T10:00:00Z"
}
```

---


---

## 6. Security Architecture

#### 6.6.1. RBAC Enforcement Architecture

#### 6.1.1 Diagnostic de l'existant — Le trou critique

L'analyse du code source revele une faille structurelle dans le systeme de permissions actuel.

**`server/src/services/access.ts:45-66`** — La fonction `hasPermission()` ignore completement le champ `scope` JSONB :

```typescript
// ACTUEL — scope IGNORE
async function hasPermission(
  companyId, principalType, principalId, permissionKey
): Promise<boolean> {
  // ... verifie SEULEMENT que le grant existe
  // Le champ scope de principal_permission_grants est JAMAIS lu
  return Boolean(grant);
}
```

**Consequences** :
- Un utilisateur avec `tasks:assign` scope `{projectIds: ["proj-A"]}` peut assigner sur TOUS les projets
- Un agent avec `agents:create` scope restreint peut creer des agents partout
- Le champ `scope` JSONB dans `principal_permission_grants` est stocke mais jamais evalue

**`packages/shared/src/constants.ts:246-254`** — Seulement 6 permission keys :

```typescript
export const PERMISSION_KEYS = [
  "agents:create",
  "users:invite",
  "users:manage_permissions",
  "tasks:assign",
  "tasks:assign_scope",
  "joins:approve",
] as const;
```

Il manque 9 permission keys critiques pour le B2B enterprise.

#### 6.1.2 Correction de `hasPermission()` — Lecture du scope JSONB

La nouvelle signature integre un parametre `scope` optionnel :

```typescript
async function hasPermission(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  permissionKey: PermissionKey,
  requiredScope?: { projectIds?: string[] }
): Promise<boolean> {
  const membership = await getMembership(companyId, principalType, principalId);
  if (!membership || membership.status !== "active") return false;

  const grants = await db
    .select()
    .from(principalPermissionGrants)
    .where(
      and(
        eq(principalPermissionGrants.companyId, companyId),
        eq(principalPermissionGrants.principalType, principalType),
        eq(principalPermissionGrants.principalId, principalId),
        eq(principalPermissionGrants.permissionKey, permissionKey),
      ),
    );

  if (grants.length === 0) return false;

  // Si aucun scope requis, le grant suffit
  if (!requiredScope) return true;

  // Verifier que au moins un grant couvre le scope requis
  for (const grant of grants) {
    const grantScope = grant.scope as Record<string, unknown> | null;

    // Grant sans scope = acces global (wildcard)
    if (!grantScope) return true;

    // Verifier projectIds
    if (requiredScope.projectIds) {
      const allowedProjects = grantScope.projectIds;
      if (!Array.isArray(allowedProjects)) continue;
      const allCovered = requiredScope.projectIds.every(
        (pid) => allowedProjects.includes(pid)
      );
      if (allCovered) return true;
    }
  }

  return false;
}
```

**Regles d'evaluation du scope** :
- `scope: null` = acces global (wildcard) — couvre tout
- `scope: { projectIds: ["A", "B"] }` = acces restreint aux projets A et B
- Si `requiredScope` est fourni, au moins un grant doit couvrir toutes les `projectIds` demandees
- Les grants sont evalues en OR : si un seul couvre le scope, l'acces est accorde

**Validation du schema JSONB scope** (prevention injection SQL) :

```typescript
import { z } from "zod";

const scopeSchema = z.object({
  projectIds: z.array(z.string().uuid()).optional(),
}).strict().nullable();

// Applique a CHAQUE ecriture de scope dans setPrincipalGrants()
function validateScope(scope: unknown): Record<string, unknown> | null {
  const result = scopeSchema.safeParse(scope);
  if (!result.success) {
    throw unprocessable("Invalid scope: " + result.error.message);
  }
  return result.data;
}
```

Le `.strict()` de Zod rejette toute cle supplementaire, bloquant les tentatives d'injection de champs arbitraires dans le JSONB.

#### 6.1.3 `canUser()` evolue — Signature avec scope

```typescript
async function canUser(
  companyId: string,
  userId: string | null | undefined,
  permissionKey: PermissionKey,
  scope?: { projectIds?: string[] }
): Promise<boolean> {
  if (!userId) return false;
  if (await isInstanceAdmin(userId)) return true;
  return hasPermission(companyId, "user", userId, permissionKey, scope);
}
```

**Usage type dans une route** :

```typescript
// AVANT (pas de scope)
const allowed = await access.canUser(companyId, userId, "tasks:assign");

// APRES (avec scope projet)
const allowed = await access.canUser(companyId, userId, "tasks:assign", {
  projectIds: [issue.projectId]
});
if (!allowed) throw forbidden("Permission denied for this project");
```

#### 6.1.4 Middleware de route — Protection des 22 fichiers

**Etat actuel des 22 fichiers de routes** :

| Fichier | `assertCompanyAccess` | `canUser`/`hasPermission` | Statut |
|---------|----------------------|--------------------------|--------|
| `access.ts` | Oui (partiel) | Oui (3 endroits) | A completer |
| `agents.ts` | Oui (17 endroits) | Oui (5 endroits) | A completer |
| `approvals.ts` | Oui (7 endroits) | Non | **CRITIQUE** |
| `assets.ts` | Oui (2 endroits) | Non | **CRITIQUE** |
| `activity.ts` | Oui (3 endroits) | Non | A ajouter |
| `companies.ts` | Oui (5 endroits) | Non | A ajouter |
| `costs.ts` | Oui (4 endroits) | Non | A ajouter |
| `dashboard.ts` | Oui (1 endroit) | Non | A ajouter |
| `drift.ts` | Oui (6 endroits) | Non | A ajouter |
| `goals.ts` | Oui (5 endroits) | Non | A ajouter |
| `issues.ts` | Oui | Oui (1 endroit) | A completer |
| `issues-checkout-wakeup.ts` | A verifier | Non | A ajouter |
| `llms.ts` | A verifier | Non | A ajouter |
| `projects.ts` | A verifier | Non | A ajouter |
| `secrets.ts` | A verifier | Non | **CRITIQUE** |
| `sidebar-badges.ts` | Oui | Oui (2 endroits) | OK |
| `stages.ts` | A verifier | Non | A ajouter |
| `workflows.ts` | A verifier | Non | A ajouter |
| `workspace-context.ts` | Oui | Non | A ajouter |
| `health.ts` | N/A (public) | N/A | OK |
| `authz.ts` | Helper | Helper | OK |
| `index.ts` | Re-export | Re-export | OK |

**Pattern middleware recommande** :

```typescript
// Middleware factory pour protection de route
function requirePermission(
  permissionKey: PermissionKey,
  extractScope?: (req: Request) => { projectIds?: string[] } | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const companyId = req.params.companyId;
    if (!companyId) throw badRequest("companyId required");

    assertCompanyAccess(req, companyId);

    const scope = extractScope?.(req);
    const access = accessService(req.db);

    if (req.actor.type === "board") {
      const allowed = await access.canUser(companyId, req.actor.userId, permissionKey, scope);
      if (!allowed) throw forbidden(`Permission denied: ${permissionKey}`);
    } else if (req.actor.type === "agent") {
      const allowed = await access.hasPermission(
        companyId, "agent", req.actor.agentId!, permissionKey, scope
      );
      if (!allowed) throw forbidden(`Permission denied: ${permissionKey}`);
    }

    next();
  };
}

// Usage
router.post("/companies/:companyId/agents",
  requirePermission("agents:create"),
  async (req, res) => { /* ... */ }
);

router.post("/companies/:companyId/projects/:projectId/issues",
  requirePermission("issues:create", (req) => ({
    projectIds: [req.params.projectId]
  })),
  async (req, res) => { /* ... */ }
);
```

#### 6.1.5 Les 15 Permission Keys

**6 existantes** (conservees telles quelles) :

| Key | Description |
|-----|-------------|
| `agents:create` | Creer/configurer un agent |
| `users:invite` | Inviter un utilisateur |
| `users:manage_permissions` | Modifier les permissions d'un membre |
| `tasks:assign` | Assigner des taches a un agent |
| `tasks:assign_scope` | Definir le perimetre d'assignation |
| `joins:approve` | Approuver les demandes d'adhesion |

**9 nouvelles** (B2B enterprise) :

| Key | Description | Priorite |
|-----|-------------|----------|
| `projects:manage` | Creer/modifier/archiver des projets | P0 |
| `issues:create` | Creer des issues dans un projet | P0 |
| `issues:manage` | Modifier/supprimer des issues | P1 |
| `workflows:manage` | Creer/modifier des workflows et stages | P0 |
| `secrets:manage` | Gerer les secrets de la company | P0 |
| `company:settings` | Modifier les parametres de la company | P1 |
| `agents:manage` | Modifier/supprimer/suspendre un agent | P1 |
| `audit:read` | Consulter les logs d'audit | P1 |
| `costs:read` | Consulter les couts (dashboards, rapports) | P1 |

#### 6.1.6 Presets par role

| Permission | Admin | Manager | Contributor | Viewer |
|------------|-------|---------|-------------|--------|
| `agents:create` | scope: null | scope: null | scope: projets | - |
| `agents:manage` | scope: null | scope: null | - | - |
| `users:invite` | scope: null | scope: null | - | - |
| `users:manage_permissions` | scope: null | - | - | - |
| `tasks:assign` | scope: null | scope: null | scope: projets | - |
| `tasks:assign_scope` | scope: null | scope: null | - | - |
| `joins:approve` | scope: null | scope: null | - | - |
| `projects:manage` | scope: null | scope: null | - | - |
| `issues:create` | scope: null | scope: null | scope: projets | - |
| `issues:manage` | scope: null | scope: null | scope: projets | - |
| `workflows:manage` | scope: null | scope: null | - | - |
| `secrets:manage` | scope: null | - | - | - |
| `company:settings` | scope: null | - | - | - |
| `audit:read` | scope: null | scope: null | - | - |
| `costs:read` | scope: null | scope: null | scope: projets | - |

**Regles** :
- `scope: null` = acces global (toute la company)
- `scope: projets` = restreint aux projets explicitement assignes
- `-` = permission non accordee
- Admin = tous les droits, scope global
- Viewer = lecture seule, aucune permission d'ecriture

---

#### 6.6.2. Multi-tenant Isolation

#### 6.2.1 PostgreSQL RLS (Row-Level Security)

**Principe** : Chaque requete SQL est filtree au niveau de la base de donnees par `companyId`, rendant impossible l'acces aux donnees d'une autre company meme en cas de bug applicatif.

**Implementation** :

```sql
-- Activer RLS sur toutes les tables tenant-scoped
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

-- Variable de session pour le companyId courant
-- Set par le middleware Express AVANT chaque requete
-- SET LOCAL app.current_company_id = 'uuid-company';

-- Policy standard (appliquee a chaque table)
CREATE POLICY tenant_isolation ON agents
  USING (company_id = current_setting('app.current_company_id')::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id')::uuid);

-- Policy pour l'application (bypass RLS pour les migrations et admin ops)
-- Le role applicatif standard (mnm_app) est soumis a RLS
-- Le role admin (mnm_admin) bypass RLS pour les migrations
ALTER TABLE agents FORCE ROW LEVEL SECURITY;
```

**Middleware Express pour setter la variable de session** :

```typescript
// middleware/tenant-context.ts
async function setTenantContext(req: Request, res: Response, next: NextFunction) {
  const companyId = extractCompanyId(req);
  if (companyId) {
    await req.db.execute(
      sql`SET LOCAL app.current_company_id = ${companyId}`
    );
  }
  next();
}
```

**Tables exclues de RLS** (cross-tenant par design) :
- `companies` — liste des companies (filtrage par membership au niveau applicatif)
- `company_memberships` — mappings user/company
- `principal_permission_grants` — grants (filtres par companyId au niveau applicatif)
- `auth_users` — utilisateurs (cross-company)
- `instance_user_roles` — roles globaux
- `invites` — invitations (cross-company par nature)
- `join_requests` — demandes d'adhesion

#### 6.2.2 Filtrage API — `assertCompanyAccess` sur chaque route

**`server/src/routes/authz.ts:10-23`** — L'implementation actuelle est correcte mais insuffisante :

```typescript
export function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw unauthorized();
  if (req.actor.type === "agent" && req.actor.companyId !== companyId)
    throw forbidden("Agent key cannot access another company");
  if (req.actor.type === "board" && req.actor.source !== "local_implicit"
      && !req.actor.isInstanceAdmin) {
    const allowedCompanies = req.actor.companyIds ?? [];
    if (!allowedCompanies.includes(companyId))
      throw forbidden("User does not have access to this company");
  }
}
```

**Ameliorations requises** :
1. **Appel systematique** : Chaque route recevant un `companyId` DOIT appeler `assertCompanyAccess` en premier
2. **Routes sans companyId explicite** : Les routes qui chargent une entite (agent, issue, projet) par ID doivent verifier le `companyId` de l'entite chargee
3. **Double verification** : RLS au niveau DB + `assertCompanyAccess` au niveau applicatif = defense en profondeur

#### 6.2.3 Cache isolation

**Regle** : Toute cle de cache DOIT etre prefixee par le `companyId`.

```typescript
// Pattern cache tenant-aware
function cacheKey(companyId: string, resource: string, id: string): string {
  return `tenant:${companyId}:${resource}:${id}`;
}

// Exemple
const key = cacheKey(companyId, "agent", agentId);
// => "tenant:uuid-company:agent:uuid-agent"
```

**Interdictions** :
- Pas de cache global partage entre companies
- Pas de cache sans prefixe `companyId`
- Invalidation du cache lors du changement de company d'un utilisateur
- TTL maximum 5 minutes pour les caches de permissions (coherence apres changement de role)

#### 6.2.4 Container isolation

Chaque company dispose d'un reseau Docker isole :

```yaml
# Reseau par company (cree dynamiquement)
docker network create --internal --driver bridge mnm-tenant-${companyId}
```

- Les containers d'une company ne peuvent pas communiquer avec ceux d'une autre
- Le flag `--internal` empeche l'acces internet direct
- Le credential proxy est le seul point de sortie autorise (voir Section 3)

---

#### 6.6.3. Container Security (5 couches)

### Couche 1 : Container ephemere `--rm` avec `--read-only`

```bash
docker run \
  --rm \                          # Suppression automatique apres arret
  --read-only \                   # Filesystem en lecture seule
  --tmpfs /tmp:rw,noexec,size=100m \  # /tmp writable mais noexec
  --tmpfs /home/agent:rw,size=500m \  # Workspace agent writable
  --security-opt no-new-privileges \  # Pas d'escalade de privileges
  --cap-drop ALL \                # Drop toutes les capabilities Linux
  --cap-add NET_BIND_SERVICE \    # Autoriser bind sur ports
  --user 1000:1000 \              # Non-root
  --pids-limit 256 \              # Limiter le nombre de processus
  mnm-agent:latest
```

**Justification** :
- `--rm` : Pas de donnees persistantes dans le container
- `--read-only` : L'agent ne peut pas modifier le systeme de fichiers de base
- `no-new-privileges` : Meme si l'agent exploite une faille, pas d'escalade vers root
- `--cap-drop ALL` : Surface d'attaque minimale

### Couche 2 : Mount allowlist (realpath + symlinks interdits + null bytes)

**Validation des chemins de mount** :

```typescript
import { realpath } from "node:fs/promises";
import path from "node:path";

const ALLOWED_MOUNT_ROOTS = [
  "/data/workspaces",
  "/data/shared-readonly",
];

async function validateMountPath(requestedPath: string): Promise<string> {
  // 1. Bloquer null bytes
  if (requestedPath.includes("\0")) {
    throw forbidden("Null bytes in path");
  }

  // 2. Bloquer encodages URL
  if (requestedPath.includes("%")) {
    throw forbidden("URL-encoded characters in path");
  }

  // 3. Resoudre le chemin reel (suit les symlinks)
  const resolved = await realpath(requestedPath);

  // 4. Verifier que le chemin reel est dans un root autorise
  const isAllowed = ALLOWED_MOUNT_ROOTS.some(
    (root) => resolved.startsWith(root + "/") || resolved === root
  );
  if (!isAllowed) {
    throw forbidden(`Mount path not in allowlist: ${resolved}`);
  }

  // 5. Verifier que le chemin original et le chemin resolu sont identiques
  // (detecte les symlinks malveillants)
  const normalizedOriginal = path.resolve(requestedPath);
  if (normalizedOriginal !== resolved) {
    throw forbidden("Symlinks detected in mount path");
  }

  return resolved;
}
```

**Attaques bloquees** :
- `../../etc/shadow` → realpath resout, pas dans allowlist → rejete
- `/data/workspaces/../../../etc/passwd` → realpath resout → rejete
- `/data/workspaces/link-to-etc` (symlink) → original != resolved → rejete
- `/data/workspaces/foo%00/etc/shadow` → null byte detecte → rejete

### Couche 3 : Credential proxy HTTP (injection sans exposition)

**Architecture** :

```
Agent Container          Credential Proxy           Secret Store
     |                        |                         |
     |--- GET /creds/MY_KEY ->|                         |
     |                        |--- resolveSecretValue ->|
     |                        |<-- "sk-abc123..." ------|
     |<-- 200 "sk-abc123..." -|                         |
     |                        |                         |
```

**Implementation** :

```typescript
// credential-proxy.ts — Tourne HORS du container agent
const app = express();

app.get("/creds/:key", async (req, res) => {
  const { key } = req.params;
  const { companyId, agentId, runId } = req.proxyContext;

  // 1. Verifier que l'agent a acces a cette cle
  const envConfig = await getAgentEnvConfig(agentId);
  if (!envConfig[key]) {
    return res.status(403).json({ error: "Key not authorized" });
  }

  // 2. Resoudre la valeur du secret
  const binding = envConfig[key];
  if (binding.type === "plain") {
    return res.json({ value: binding.value });
  }

  const value = await secretService.resolveSecretValue(
    companyId, binding.secretId, binding.version
  );

  // 3. Audit log
  await logActivity({
    companyId, action: "secret.accessed",
    metadata: { key, agentId, runId, secretId: binding.secretId }
  });

  // 4. Retourner la valeur (jamais logguee)
  res.json({ value });
});
```

**Securite du proxy** :
- Le proxy tourne dans le reseau host, pas dans le container agent
- L'agent n'a pas acces aux variables d'environnement du proxy
- Chaque requete est auditee
- Le proxy valide que l'agent est autorise a acceder a chaque cle specifique
- TLS entre le proxy et le container (mTLS recommande en enterprise)

### Couche 4 : Shadow `.env` vers `/dev/null`

```bash
# Monter un fichier vide en lecture seule sur .env
docker run \
  -v /dev/null:/workspace/.env:ro \
  -v /dev/null:/home/agent/.env:ro \
  ...
```

**Objectif** : Meme si un agent tente de lire `.env`, il obtient un fichier vide. Les secrets passent uniquement par le credential proxy.

**Chemins couverts** :
- `/workspace/.env`
- `/home/agent/.env`
- `/workspace/.env.local`
- `/workspace/.env.production`

### Couche 5 : Reseau isole (pas d'acces internet direct)

```bash
# Reseau interne sans acces Internet
docker network create --internal mnm-tenant-${companyId}

# Le container agent est connecte UNIQUEMENT a ce reseau
docker run --network mnm-tenant-${companyId} ...

# Le credential proxy est connecte a ce reseau ET au reseau externe
# Il sert de passerelle controlee
```

**Regles de routage** :
- Les containers agents n'ont PAS d'acces internet direct
- Le credential proxy est la seule passerelle
- Les requetes vers des APIs externes (GitHub, LLM providers) passent par un proxy HTTP sortant avec allowlist de domaines
- Le proxy sortant log toutes les requetes

### Resource limits par profil

| Profil | CPU | RAM | Disk | PIDs | Timeout | Cas d'usage |
|--------|-----|-----|------|------|---------|-------------|
| `light` | 0.5 | 512 Mo | 200 Mo | 64 | 5 min | Taches simples (lint, format) |
| `standard` | 1.0 | 1 Go | 500 Mo | 128 | 15 min | Dev standard (code, test) |
| `heavy` | 2.0 | 2 Go | 1 Go | 256 | 30 min | Build, CI, analyse |
| `gpu` | 2.0 + GPU | 4 Go | 2 Go | 256 | 60 min | ML, inference locale |

**Enforcement** :

```bash
docker run \
  --cpus=1.0 \
  --memory=1g \
  --memory-swap=1g \          # Pas de swap (evite les OOM lents)
  --storage-opt size=500m \
  --pids-limit 128 \
  ...
```

**Gestion du timeout** :
1. Timer dans le host (pas dans le container)
2. A expiration : `SIGTERM` envoye au container
3. Si pas d'arret dans 10s : `SIGKILL`
4. Reset du timer a chaque output (stdout/stderr) detecte

---

#### 6.6.4. Input Validation & Injection Prevention

#### 6.4.1 XSS via chat

**Vecteurs d'attaque** :
- Messages chat contenant `<script>`, `<img onerror=...>`, `<svg onload=...>`
- Markdown malveillant (liens javascript:, images avec handlers)
- Caracteres Unicode speciaux (homoglyphs, zero-width characters)

**Defenses** :

```typescript
// 1. UTF-8 strict — rejeter les sequences invalides
function validateUtf8(input: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    return decoder.decode(encoder.encode(input));
  } catch {
    throw unprocessable("Invalid UTF-8 input");
  }
}

// 2. Sanitization HTML — cote serveur
import DOMPurify from "isomorphic-dompurify";

function sanitizeChatMessage(content: string): string {
  // Valider UTF-8
  const clean = validateUtf8(content);

  // Limiter la taille
  if (clean.length > 100_000) {
    throw unprocessable("Message too large (max 100KB)");
  }

  // Sanitiser le HTML (autoriser uniquement le Markdown rendu)
  return DOMPurify.sanitize(clean, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "code", "pre", "a", "ul", "ol", "li", "blockquote"],
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}
```

**3. CSP Headers** :

```typescript
// middleware/security-headers.ts
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self'; " +             // Pas de scripts inline
    "style-src 'self' 'unsafe-inline'; " +  // Styles inline pour CSS-in-JS
    "img-src 'self' data: https:; " +    // Images depuis self et HTTPS
    "connect-src 'self' wss:; " +        // WebSocket
    "frame-ancestors 'none'; " +         // Pas de framing (clickjacking)
    "base-uri 'self'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
```

#### 6.4.2 SQL injection via scope JSONB

**Vecteur d'attaque** : Un utilisateur malveillant pourrait tenter d'injecter du SQL dans le champ `scope` JSONB de `principal_permission_grants`.

**Defense** : Validation stricte du schema JSONB avec Zod (voir Section 1.2).

```typescript
// INTERDIT : Accepter un scope arbitraire
grants.map((grant) => ({
  scope: grant.scope  // DANGER — l'utilisateur controle le contenu
}));

// CORRECT : Valider strictement
grants.map((grant) => ({
  scope: validateScope(grant.scope)  // Zod strict, seulement projectIds:uuid[]
}));
```

**Protection supplementaire** : Drizzle ORM utilise des requetes parametrees nativement. Le JSONB est passe comme parametre, pas interpole dans le SQL. Mais la validation Zod ajoute une couche de defense en profondeur.

#### 6.4.3 CSRF Protection

```typescript
// 1. Token CSRF synchronise
import csurf from "csurf";

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  }
});

// Appliquer sur toutes les routes POST/PUT/DELETE
app.use("/api", csrfProtection);

// 2. Verification Origin/Referer
function validateOrigin(req: Request): void {
  const origin = req.header("Origin");
  const referer = req.header("Referer");
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];

  if (req.method === "GET" || req.method === "HEAD") return;

  if (origin && !allowedOrigins.includes(origin)) {
    throw forbidden("Invalid origin");
  }
  if (!origin && referer) {
    const refererOrigin = new URL(referer).origin;
    if (!allowedOrigins.includes(refererOrigin)) {
      throw forbidden("Invalid referer");
    }
  }
}

// 3. Cookie SameSite=Strict
// Configure dans Better Auth / session middleware
{
  cookie: {
    name: "mnm_session",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 24 * 60 * 60,  // 24 heures
  }
}
```

#### 6.4.4 Path traversal

La protection est deja couverte dans la Couche 2 (Mount allowlist) de la Section 3. Resume des defenses :

1. **Null bytes** : Rejet immediat si `\0` detecte dans un chemin
2. **Encodage URL** : Rejet si `%` present (double-encodage)
3. **Realpath** : Resolution complete du chemin reel
4. **Symlinks** : Comparaison chemin original vs chemin resolu
5. **Allowlist** : Seuls les chemins dans les roots autorises sont acceptes
6. **Normalisation** : `path.resolve()` avant toute operation

**Application dans les routes d'assets** :

```typescript
// server/src/routes/assets.ts — Verification supplementaire
router.get("/assets/:assetId/download", async (req, res) => {
  const asset = await assetService.getById(req.params.assetId);
  assertCompanyAccess(req, asset.companyId);

  // Valider que le chemin de stockage est safe
  const resolvedPath = await validateMountPath(asset.storagePath);

  // Streamer le fichier
  res.sendFile(resolvedPath);
});
```

---

#### 6.6.5. Auth & Session Security

#### 6.5.1 Session management

**Configuration Better Auth** :

| Parametre | Valeur | Justification |
|-----------|--------|---------------|
| Duree session | 24 heures | Balance securite/UX |
| Idle timeout | 2 heures | Deconnexion apres inactivite |
| Renouvellement | Sliding window | Prolonge si actif |
| Fixation prevention | Regenerer session ID apres login | OWASP standard |
| Stockage | PostgreSQL (pas cookie) | Invalidation serveur possible |
| Cookie flags | `httpOnly`, `secure`, `sameSite=strict` | Protection XSS/CSRF |

**Invalidation de session** :

```typescript
// Invalidation immediate lors de :
// 1. Logout explicite
await sessionStore.delete(sessionId);

// 2. Changement de mot de passe
await sessionStore.deleteAllForUser(userId);

// 3. Changement de role/permissions
// Invalider le cache de permissions (pas la session)
await permissionCache.invalidate(userId, companyId);

// 4. Suspension du compte
await sessionStore.deleteAllForUser(userId);
```

#### 6.5.2 Rate limiting

```typescript
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";

// Rate limits par endpoint
const rateLimits = {
  login: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 5,                  // 5 tentatives
    keyGenerator: (req) => req.ip + ":" + req.body?.email,
    message: { error: "Too many login attempts, try again in 1 minute" },
    standardHeaders: true,
  }),

  invitations: rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 heure
    max: 20,                    // 20 invitations
    keyGenerator: (req) => req.actor.userId ?? req.ip,
    message: { error: "Too many invitations, try again in 1 hour" },
  }),

  chat: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 10,                 // 10 messages
    keyGenerator: (req) => req.actor.userId ?? req.ip,
    message: { error: "Too many messages, slow down" },
  }),

  api: rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 100,                // 100 requetes
    keyGenerator: (req) => req.actor.userId ?? req.actor.agentId ?? req.ip,
    message: { error: "API rate limit exceeded" },
  }),
};

// Application
app.post("/auth/login", rateLimits.login);
app.post("/api/companies/:id/invites", rateLimits.invitations);
app.post("/api/companies/:id/chat", rateLimits.chat);
app.use("/api", rateLimits.api);
```

#### 6.5.3 Brute force protection

```typescript
// Lockout progressif apres tentatives echouees
const loginAttempts = new Map<string, { count: number; lockedUntil: Date | null }>();

function checkBruteForce(email: string): void {
  const key = email.toLowerCase();
  const record = loginAttempts.get(key);

  if (record?.lockedUntil && record.lockedUntil > new Date()) {
    const remainingMs = record.lockedUntil.getTime() - Date.now();
    throw new HttpError(429, `Account locked. Try again in ${Math.ceil(remainingMs / 1000)}s`);
  }
}

function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const record = loginAttempts.get(key) ?? { count: 0, lockedUntil: null };
  record.count += 1;

  // Lockout progressif
  if (record.count >= 5) {
    const lockoutMinutes = Math.min(2 ** (record.count - 5), 60);  // 1, 2, 4, 8, ... 60 min max
    record.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
  }

  loginAttempts.set(key, record);
}

function recordSuccessfulLogin(email: string): void {
  loginAttempts.delete(email.toLowerCase());
}
```

**Stockage en production** : Redis au lieu de Map en memoire (persistance et partage entre instances).

---

#### 6.6.6. Audit Trail Security

#### 6.6.1 Immutabilite — TRIGGER deny UPDATE/DELETE

```sql
-- Table audit_events (append-only)
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  actor_type TEXT NOT NULL,          -- 'user' | 'agent' | 'system'
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- 'agent.created', 'secret.accessed', etc.
  resource_type TEXT,                -- 'agent', 'issue', 'secret', etc.
  resource_id TEXT,
  metadata JSONB,                    -- Details complementaires
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRIGGER : Interdire UPDATE et DELETE
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

-- Meme le role applicatif ne peut pas contourner ces triggers
-- Seul un SUPERUSER pourrait les desactiver (et c'est audite par PostgreSQL)

-- Index pour les requetes frequentes
CREATE INDEX audit_events_company_action_idx
  ON audit_events (company_id, action, created_at DESC);
CREATE INDEX audit_events_actor_idx
  ON audit_events (actor_type, actor_id, created_at DESC);
CREATE INDEX audit_events_resource_idx
  ON audit_events (resource_type, resource_id, created_at DESC);
```

#### 6.6.2 Non-repudiation — Hash chain optionnel (P2)

```sql
-- Ajout colonne hash chain (P2 Enterprise)
ALTER TABLE audit_events ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_events ADD COLUMN event_hash TEXT;

-- Le hash est calcule cote application
-- event_hash = SHA-256(prev_hash + actor_id + action + resource_id + metadata + created_at)
```

```typescript
import { createHash } from "node:crypto";

async function appendAuditEvent(
  db: Db,
  event: AuditEventInput,
  enableHashChain: boolean = false
): Promise<void> {
  let prevHash: string | null = null;
  let eventHash: string | null = null;

  if (enableHashChain) {
    // Recuperer le dernier hash de la company
    const lastEvent = await db.execute(sql`
      SELECT event_hash FROM audit_events
      WHERE company_id = ${event.companyId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    prevHash = lastEvent.rows[0]?.event_hash ?? "GENESIS";

    // Calculer le hash de l'evenement courant
    const payload = JSON.stringify({
      prevHash,
      actorId: event.actorId,
      action: event.action,
      resourceId: event.resourceId,
      metadata: event.metadata,
      createdAt: event.createdAt,
    });
    eventHash = createHash("sha256").update(payload).digest("hex");
  }

  await db.insert(auditEvents).values({
    ...event,
    prevHash,
    eventHash,
  });
}
```

**Verification d'integrite** :

```typescript
// Verifier que la chaine de hash n'a pas ete alteree
async function verifyAuditChain(db: Db, companyId: string): Promise<{
  valid: boolean;
  brokenAt?: string;
}> {
  const events = await db.execute(sql`
    SELECT * FROM audit_events
    WHERE company_id = ${companyId}
    ORDER BY created_at ASC
  `);

  let expectedPrevHash = "GENESIS";
  for (const event of events.rows) {
    if (event.prev_hash !== expectedPrevHash) {
      return { valid: false, brokenAt: event.id };
    }
    // Recalculer le hash et comparer
    const payload = JSON.stringify({
      prevHash: event.prev_hash,
      actorId: event.actor_id,
      action: event.action,
      resourceId: event.resource_id,
      metadata: event.metadata,
      createdAt: event.created_at,
    });
    const computedHash = createHash("sha256").update(payload).digest("hex");
    if (computedHash !== event.event_hash) {
      return { valid: false, brokenAt: event.id };
    }
    expectedPrevHash = event.event_hash;
  }

  return { valid: true };
}
```

#### 6.6.3 Retention 3 ans minimum

```sql
-- Partitionnement par mois pour faciliter la retention
CREATE TABLE audit_events (
  -- ... colonnes ...
) PARTITION BY RANGE (created_at);

-- Partitions creees automatiquement par un cron job mensuel
CREATE TABLE audit_events_2026_03
  PARTITION OF audit_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Politique de retention : pas de suppression avant 3 ans
-- Le cron de cleanup ne supprime que les partitions > 3 ans
-- Politique configurable par company (enterprise : retention illimitee)
```

**Archivage** :
- Les partitions > 1 an sont deplacees vers un tablespace froid (stockage moins couteux)
- Les partitions > 3 ans sont exportees en CSV/Parquet avant suppression
- Chaque export est signe (SHA-256 + signature) pour prouver l'integrite

#### 6.6.4 Interface read-only

**API d'audit** :

```typescript
router.get("/companies/:companyId/audit", async (req, res) => {
  assertCompanyAccess(req, companyId);
  const allowed = await access.canUser(companyId, req.actor.userId, "audit:read");
  if (!allowed) throw forbidden("audit:read permission required");

  const { action, actorId, resourceType, from, to, page, limit } = req.query;

  const events = await auditService.query({
    companyId,
    filters: { action, actorId, resourceType, from, to },
    pagination: { page, limit: Math.min(limit ?? 50, 200) },
  });

  res.json(events);
});

// Export CSV (P2)
router.get("/companies/:companyId/audit/export", async (req, res) => {
  assertCompanyAccess(req, companyId);
  const allowed = await access.canUser(companyId, req.actor.userId, "audit:read");
  if (!allowed) throw forbidden("audit:read permission required");

  // ... streaming CSV
});
```

**Regles** :
- Aucune route `POST`/`PUT`/`DELETE` sur `/audit`
- Les evenements d'audit sont crees automatiquement par les services, pas par les utilisateurs
- L'interface UI affiche un filtre par action, acteur, ressource, date
- L'export CSV est rate-limite (1 export/10 min par utilisateur)

---

### Matrice de Traceabilite NFR → Implementation

| NFR | Section | Implementation | Priorite |
|-----|---------|---------------|----------|
| NFR-SEC-01 | 2.1, 2.2 | RLS PostgreSQL + assertCompanyAccess | P0 |
| NFR-SEC-02 | (infra) | TLS 1.3 via reverse proxy + AES-256 local_encrypted | P0 |
| NFR-SEC-03 | 3.3 | Credential proxy HTTP, injection sans exposition | P0 |
| NFR-SEC-04 | 6.1 | TRIGGER deny UPDATE/DELETE sur audit_events | P1 |
| NFR-SEC-05 | (auth) | Better Auth extensible pour SAML/OIDC | P1 Enterprise |
| NFR-SEC-06 | 3.1, 3.5 | --rm, --read-only, cap-drop ALL, resource limits | P1 |
| NFR-SEC-07 | 4.1, 4.2 | DOMPurify + CSP + Zod strict sur scope JSONB | P0 |
| NFR-SEC-08 | 4.3 | CSRF tokens + Origin/Referer + SameSite=Strict | P1 |
| NFR-SEC-09 | 5.2 | express-rate-limit : login 5/min, chat 10/min | P1 |
| NFR-SEC-10 | 3.2 | realpath + symlinks interdits + null bytes + allowlist | P0 |

---

### Synthese des Priorites d'Implementation

### Phase 1 — P0 (Sprint 1-2)
1. Corriger `hasPermission()` pour lire le scope JSONB
2. Ajouter les 9 nouvelles permission keys
3. Deployer `requirePermission()` middleware sur les routes critiques
4. Activer RLS PostgreSQL sur les tables tenant-scoped
5. Implementer la validation Zod stricte du scope
6. Deployer les CSP headers et la sanitization XSS
7. Implementer la validation des mount paths (realpath + allowlist)

### Phase 2 — P1 (Sprint 3-4)
1. Completer la couverture `canUser()` sur les 22 fichiers de routes
2. Deployer le credential proxy HTTP
3. Implementer les rate limits par endpoint
4. Configurer le lockout brute force
5. Creer la table `audit_events` avec triggers d'immutabilite
6. Configurer les profils de resources pour containers

### Phase 3 — P2 Enterprise (Sprint 5+)
1. Hash chain pour non-repudiation
2. Partitionnement et archivage des audit events
3. SSO SAML/OIDC via Better Auth
4. mTLS entre credential proxy et containers
5. Interface d'export CSV des audits


---

## 7. Deployment Architecture

### 7.1 Modes de Déploiement

MnM supporte trois modes de déploiement alignés sur les quatre tiers de licence (Open Source, Team, Enterprise, On-Premise). Chaque mode répond à des exigences différentes en termes de coût, contrôle des données, et scalabilité.

#### 7.1.1 Mode Self-Hosted (Open Source + Team)

**Cible** : Développeurs solo, petites équipes (<50 utilisateurs), communauté open source.

**Principe** : Docker Compose sur un serveur unique. L'utilisateur contrôle l'intégralité de son infrastructure. Zéro dépendance cloud propriétaire.

**Composants** :

```
┌─────────────────────────────────────────────────────┐
│                   SERVEUR UNIQUE                     │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ PostgreSQL│  │  MnM Server  │  │   MnM UI      │  │
│  │  17-alpine│  │  (Express +  │  │  (Vite build  │  │
│  │           │  │   Node.js)   │  │   statique)   │  │
│  │  Port 5432│  │  Port 3100   │  │  servi par    │  │
│  │           │  │  WebSocket   │  │  SERVE_UI=true│  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│                                                      │
│  ┌──────────────┐  ┌────────────────────────────┐   │
│  │ Volumes       │  │ Optionnel : Redis           │   │
│  │ pgdata:/var/  │  │ (sessions, cache, pub/sub)  │   │
│  │ mnm-data:/mnm │  │ Port 6379                   │   │
│  └──────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**docker-compose.yml existant** (base du mode self-hosted) :
- Service `db` : PostgreSQL 17-alpine avec healthcheck (`pg_isready`)
- Service `server` : Build depuis Dockerfile multi-stage (deps → build → production)
- Variables d'environnement : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MNM_DEPLOYMENT_MODE=authenticated`
- Volumes persistants : `pgdata` (données PostgreSQL), `mnm-data` (données MnM)

**Infrastructure requise** :
- CPU : 2 vCPU minimum, 4 recommandé
- RAM : 4 Go minimum, 8 Go recommandé
- Stockage : 20 Go SSD minimum (PostgreSQL + volumes Docker)
- OS : Linux (Ubuntu 22.04+, Debian 12+), macOS, ou Windows avec WSL2
- Docker Engine 24+ et Docker Compose v2+

**Backup strategy** :
- Script `db:backup` existant (`scripts/backup-db.sh`) pour dump PostgreSQL
- Recommandation : cron job quotidien `pg_dump` + rotation 7 jours
- Backup des volumes Docker (`mnm-data`) via snapshot ou rsync
- Documentation fournie pour restauration complète

**Monitoring** :
- Health check PostgreSQL intégré (interval 2s, retries 30)
- Endpoint `/health` sur le serveur MnM (HTTP 200 si connecté à la DB)
- Logs Docker (`docker compose logs -f`) — suffisant pour une petite équipe
- Optionnel : Prometheus node_exporter pour métriques système

**Limites** :
- Single point of failure (pas de HA)
- Scalabilité verticale uniquement
- Pas de CDN intégré
- WebSocket limité à une seule instance (pas besoin de Redis pub/sub)

---

#### 7.1.2 Mode Cloud Managed (Team + Enterprise)

**Cible** : Équipes 5-500+ utilisateurs, SaaS multi-tenant géré par AlphaLuppi.

**Principe** : Kubernetes (K8s) multi-tenant avec auto-scaling, isolation par namespace ou Row-Level Security PostgreSQL, et infrastructure managée.

**Architecture** :

```
                        ┌─────────────────────┐
                        │    CDN (Cloudflare)  │
                        │    Assets statiques  │
                        │    + DDoS protection │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Load Balancer      │
                        │   (Nginx Ingress     │
                        │    ou Traefik)       │
                        │   SSL Termination    │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼────────┐ ┌────────▼────────┐  ┌────────▼────────┐
    │  MnM Server (N)  │ │  MnM Server (N) │  │  MnM Server (N) │
    │  Pod replicas    │ │  Pod replicas   │  │  Pod replicas   │
    │  HPA: 2-20 pods  │ │  WebSocket      │  │  Workers async  │
    │  CPU/Memory      │ │  sticky sessions│  │  (audit, notif) │
    └────────┬─────────┘ └────────┬────────┘  └────────┬────────┘
             │                     │                     │
    ┌────────▼─────────────────────▼─────────────────────▼────────┐
    │                        Redis Cluster                         │
    │  Sessions │ Cache queries │ WebSocket pub/sub │ Rate limit   │
    │  (Sentinel ou Redis Cluster, 3 nœuds)                       │
    └────────────────────────────┬─────────────────────────────────┘
                                 │
    ┌────────────────────────────▼─────────────────────────────────┐
    │                     PostgreSQL Managed                        │
    │  (AWS RDS / GCP Cloud SQL / Azure DB)                        │
    │  RLS activé │ Connection pooling (pgBouncer) │ Read replicas │
    │  Backups automatiques │ Point-in-time recovery               │
    └──────────────────────────────────────────────────────────────┘
```

**Composants Kubernetes** :
- **Deployment MnM Server** : HPA (Horizontal Pod Autoscaler), min 2 replicas, max 20
  - Scaling sur CPU >70% et mémoire >80%
  - Requests : 256m CPU, 512Mi RAM | Limits : 1 CPU, 2Gi RAM
- **Service WebSocket** : Sticky sessions via annotation Ingress (`nginx.ingress.kubernetes.io/affinity: cookie`)
  - Alternative enterprise : Redis pub/sub pour broadcasting cross-instances
- **Workers asynchrones** : Deployment séparé pour tâches lourdes (audit trail, notifications, import Jira)
- **Redis** : StatefulSet avec Sentinel (3 nœuds) pour HA
- **Ingress** : Nginx Ingress Controller avec cert-manager (Let's Encrypt) pour SSL automatique
- **Secrets** : Kubernetes Secrets + external-secrets-operator pour HashiCorp Vault ou AWS Secrets Manager

**Infrastructure requise (par tenant cluster)** :
- Kubernetes 1.28+ (EKS, GKE, ou AKS)
- 3 nodes minimum (m5.xlarge ou équivalent : 4 vCPU, 16 Go RAM)
- PostgreSQL managed (db.r6g.xlarge : 4 vCPU, 32 Go RAM, 500 Go SSD)
- Redis managed (cache.r6g.large : 2 vCPU, 13 Go RAM)
- Stockage : 100 Go gp3 EBS par node + volumes PVC pour données persistantes

**Backup strategy** :
- PostgreSQL : Snapshots automatiques quotidiens (rétention 30 jours) + WAL archiving pour PITR
- Redis : RDB snapshots toutes les heures + AOF append-only pour durabilité
- Kubernetes : Velero pour backup/restore des ressources K8s et PVCs
- Rétention : 30 jours rolling pour données actives, 3 ans pour audit trail (REQ-AUDIT-01)

**Monitoring** :
- **Métriques** : Prometheus + Grafana (dashboards préconfiguré pour API latency, WebSocket connections, DB connections, container health)
- **Logs** : Loki ou ELK stack, rétention 90 jours
- **Alerting** : AlertManager avec escalation PagerDuty/Opsgenie
  - P1 : API P99 >500ms, DB connections >80%, pod restarts >3/heure
  - P2 : CPU sustained >85%, mémoire >90%, WebSocket reconnections >100/min
- **Tracing** : OpenTelemetry pour traces distribuées (requête → server → DB → Redis)

**Multi-tenancy** :
- Isolation par Row-Level Security (RLS) PostgreSQL — chaque query filtrée par `company_id`
- Pas d'isolation par namespace K8s (trop coûteux) — RLS + filtrage applicatif suffisent pour Team
- Enterprise : option namespace dédié si le client le demande (surcoût)

---

#### 7.1.3 Mode On-Premise (Enterprise)

**Cible** : Secteurs réglementés (banques, santé, défense, administrations), entreprises avec politique zero data exfiltration.

**Principe** : Déploiement dans l'infrastructure du client. Aucune donnée ne quitte le réseau du client. MnM est livré comme un package Helm ou un ensemble d'images Docker signées.

**Architecture** :

```
┌─────────────────── RÉSEAU CLIENT ───────────────────────┐
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Kubernetes Client (ou Docker Compose)   │   │
│  │                                                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │   │
│  │  │ MnM     │ │ MnM     │ │ Redis   │ │ Worker │ │   │
│  │  │ Server  │ │ Server  │ │ (local) │ │ Async  │ │   │
│  │  │ Pod 1   │ │ Pod 2   │ │         │ │        │ │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬───┘ │   │
│  │       └──────┬─────┘          │            │      │   │
│  │              │                │            │      │   │
│  │  ┌───────────▼────────────────▼────────────▼──┐  │   │
│  │  │          PostgreSQL (local ou client DB)     │  │   │
│  │  │          Géré par l'équipe infra client      │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌────────────────────┐  ┌─────────────────────────┐    │
│  │ LLM On-Premise     │  │ Registry privé          │    │
│  │ (Ollama, vLLM,     │  │ (Harbor, Artifactory)   │    │
│  │  Azure OpenAI      │  │ Images Docker signées   │    │
│  │  privé)            │  │                          │    │
│  └────────────────────┘  └─────────────────────────┘    │
│                                                          │
│  AUCUNE connexion sortante vers AlphaLuppi               │
└──────────────────────────────────────────────────────────┘
```

**Livraison** :
- **Helm Chart** versionné : `mnm-enterprise-X.Y.Z.tgz` avec `values.yaml` personnalisable
- **Images Docker signées** (cosign) poussées sur le registry privé du client
- **Guide d'installation** : procédure documentée étape par étape, validée par l'équipe SRE AlphaLuppi
- **Air-gapped support** : toutes les dépendances (images Docker, charts, packages npm) incluses dans un bundle offline

**Composants spécifiques On-Premise** :
- **LLM local** : Support Ollama, vLLM, ou Azure OpenAI privé via l'architecture d'adapters existante (8 adapters dans `packages/adapters/`)
- **Secrets** : HashiCorp Vault on-premise ou le secret manager du client (REQ-RESID-01)
- **Certificats** : TLS géré par l'infrastructure PKI du client
- **Stockage** : NFS ou stockage bloc fourni par le client

**Infrastructure requise (minimum)** :
- 3 nodes K8s (8 vCPU, 32 Go RAM chacun) ou Docker Compose sur un serveur dédié (16 vCPU, 64 Go)
- PostgreSQL 17+ (géré par le client ou déployé via le Helm chart)
- Redis 7+ (inclus dans le Helm chart ou fourni par le client)
- Stockage : 500 Go SSD minimum (DB + volumes + images Docker en cache)
- GPU optionnel pour LLM local (NVIDIA T4 ou mieux)

**Backup strategy** :
- Intégration avec les outils de backup du client (Veeam, Commvault, Velero)
- Scripts de backup/restore fournis et testés dans le guide d'installation
- Le client est responsable de la politique de rétention et de la fréquence
- MnM fournit un endpoint `/admin/export` pour export complet des données (REQ-REG-03 — portabilité)

**Monitoring** :
- Intégration avec la stack d'observabilité du client (Prometheus, Datadog, Splunk, ELK)
- Métriques exposées via endpoint Prometheus `/metrics` (format OpenMetrics)
- Health checks standard : `/health` (liveness), `/ready` (readiness)
- Logs structurés JSON pour intégration directe dans les pipelines de log existants

**Zero data exfiltration** :
- Aucun appel réseau sortant vers AlphaLuppi
- Pas de telemetry, analytics, ou phone-home
- Mises à jour : l'équipe infra du client pull les nouvelles images depuis un registry miroir ou reçoit le bundle offline
- LLM : uniquement des providers accessibles depuis le réseau interne du client

---

#### 7.1.4 Matrice Récapitulative Modes × Tiers

| Caractéristique | Self-Hosted (OSS) | Self-Hosted (Team) | Cloud Managed (Team) | Cloud Managed (Enterprise) | On-Premise (Enterprise) |
|-----------------|-------------------|-------------------|---------------------|---------------------------|------------------------|
| **Infrastructure** | Docker Compose | Docker Compose + Redis | Kubernetes | Kubernetes dédié | K8s client ou Docker |
| **HA** | Non | Non | Oui (2+ pods) | Oui (3+ pods) | Selon client |
| **Auto-scaling** | Non | Non | HPA | HPA + VPA | Selon client |
| **Multi-tenant** | N/A | N/A | RLS | RLS + namespace option | Single-tenant |
| **Backup** | Manuel (script) | Script + cron | Automatique PITR | Automatique PITR + cross-region | Client-managed |
| **Monitoring** | Docker logs | Docker logs + /health | Prometheus/Grafana | Full stack + alerting | Intégration client |
| **SSL** | Manuel (Caddy/nginx) | Manuel | cert-manager auto | cert-manager auto | PKI client |
| **LLM** | Cloud APIs | Cloud APIs | Cloud APIs | Cloud ou private | On-premise obligatoire |
| **Support** | Communauté | Email (48h) | Email (24h) + Slack | SLA 99.9% + CSM dédié | SLA sur-mesure |
| **Prix** | Gratuit | ~50EUR/user/mois | ~50EUR/user/mois | ~200EUR/user/mois | Licence annuelle |

---


### 7.2 Infrastructure par Environnement

#### 7.2.1 Environnement Dev (Local)

**Objectif** : Permettre à tout développeur de lancer MnM localement en moins de 5 minutes.

**Stack** :

```bash
# Démarrage rapide (docker-compose.quickstart.yml existant)
export BETTER_AUTH_SECRET="dev-secret-change-me"
docker compose -f docker-compose.quickstart.yml up

# Ou mode dev complet avec hot-reload
docker compose up db           # PostgreSQL uniquement
pnpm install                    # Dépendances
pnpm dev                        # Server + UI avec hot-reload
```

**Composants** :
- PostgreSQL 17-alpine (via Docker) — port 5432
- MnM Server (Express + tsx hot-reload) — port 3100
- MnM UI (Vite dev server) — port 5173 (proxy vers 3100)
- Redis : **non requis** en dev (sessions en mémoire, pas de pub/sub nécessaire single-instance)

**Variables d'environnement dev** :
```env
DATABASE_URL=postgres://mnm:mnm@localhost:5432/mnm
PORT=3100
SERVE_UI=false           # Vite dev server séparé
MNM_DEPLOYMENT_MODE=authenticated
MNM_DEPLOYMENT_EXPOSURE=private
BETTER_AUTH_SECRET=dev-secret-do-not-use-in-production
```

**Migrations** :
- `pnpm db:generate` — Génère les migrations Drizzle
- `pnpm db:migrate` — Applique les migrations
- Script `dev-runner.mjs` gère automatiquement les migrations au démarrage en mode dev

#### 7.2.2 Environnement Staging

**Objectif** : Reproduction fidèle de la production pour validation pré-release. Tests E2E automatisés, seed data, et smoke tests.

**Architecture** : Identique à la production mais dimensions réduites.

```
┌─────────────────── STAGING ────────────────────────┐
│                                                      │
│  Kubernetes (même cluster, namespace: mnm-staging)   │
│                                                      │
│  MnM Server: 2 replicas (min)                        │
│  PostgreSQL: Instance managée dédiée (small)         │
│  Redis: Single node (pas de Sentinel)                │
│  Ingress: staging.mnm.dev (accès restreint)          │
│                                                      │
│  Seed data:                                          │
│  - 3 companies (small, medium, enterprise)           │
│  - 50 utilisateurs (tous les rôles RBAC)             │
│  - 10 workflows actifs avec historique de drifts     │
│  - 1000 issues avec audit trail                      │
│                                                      │
│  Tests automatisés:                                  │
│  - Cypress E2E (7 smoke tests UX)                    │
│  - Load test (k6) : 50 users virtuels, 5 min        │
│  - Healthcheck continu (5 min interval)              │
│                                                      │
│  Politique de reset:                                 │
│  - Reset seed data chaque nuit (cron job)            │
│  - Migrations appliquées automatiquement au deploy   │
└──────────────────────────────────────────────────────┘
```

**Différences avec la production** :
- Pas de backups cross-region
- Pas de monitoring PagerDuty (alertes Slack uniquement)
- Données anonymisées (jamais de données client réelles)
- Accès restreint par VPN ou IP whitelist
- Replicas réduits (2 au lieu de 3-20)

**Pipeline de déploiement staging** :
1. PR merged dans `master` → CI build + tests unitaires
2. Images Docker taguées `staging-{sha}`
3. Helm upgrade automatique sur namespace `mnm-staging`
4. Tests E2E Cypress lancés automatiquement
5. Si E2E passent → candidat promotion en production

#### 7.2.3 Environnement Production

**Objectif** : Haute disponibilité, performance, sécurité maximale. SLA 99.5% (MVP) à 99.9% (Enterprise).

**Architecture Cloud Managed** (voir section 1.2 pour le diagramme complet).

**Configuration Kubernetes production** :

```yaml
# Extraits de configuration K8s

# --- Deployment MnM Server ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mnm-server
  namespace: mnm-production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0    # Zero-downtime deployment
  template:
    spec:
      containers:
      - name: mnm-server
        resources:
          requests:
            cpu: "256m"
            memory: "512Mi"
          limits:
            cpu: "1"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3100
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /ready
            port: 3100
          initialDelaySeconds: 5
          periodSeconds: 5

# --- HPA ---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mnm-server-hpa
spec:
  scaleTargetRef:
    name: mnm-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Reverse Proxy & SSL** :
- Nginx Ingress Controller avec annotations pour :
  - SSL termination (cert-manager + Let's Encrypt)
  - WebSocket upgrade (`nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`)
  - Sticky sessions pour WebSocket (`nginx.ingress.kubernetes.io/affinity: "cookie"`)
  - Rate limiting (`nginx.ingress.kubernetes.io/limit-rps: "50"`)
- HSTS activé, TLS 1.3 uniquement (NFR-SEC-02)

**Health Checks** :
- **Liveness** (`/health`) : vérifie que le process Node.js répond. Si échoue 3 fois → restart pod.
- **Readiness** (`/ready`) : vérifie connexion PostgreSQL + Redis. Si échoue → pod retiré du Service.
- **Startup** : délai initial de 10s pour laisser les connexions DB s'établir.

**Pipeline de déploiement production** :
1. Tag de release `vX.Y.Z` sur `master`
2. CI : build + tests unitaires + tests intégration + build Docker multi-arch
3. Images poussées sur registry (ECR/GCR) avec tag version
4. Helm upgrade avec `--atomic` (rollback automatique si healthcheck échoue)
5. Canary deployment : 10% traffic → monitoring 15 min → 50% → monitoring 15 min → 100%
6. Smoke tests automatisés post-déploiement
7. Notification Slack avec changelog

---


---

## 8. Performance & Scalability

### 8.0 Performance & Scalabilité

#### 8.1 Cibles NFR (extraites du PRD)

| Métrique | MVP | Enterprise | Technique |
|----------|-----|-----------|-----------|
| API P50 | <100ms | <50ms | Indexation PostgreSQL, cache Redis |
| API P99 | <500ms | <200ms | Connection pooling, query optimization |
| WebSocket message | <50ms | <20ms | Redis pub/sub, sticky sessions |
| Démarrage container agent | <10s | <5s | Image pré-chargée, warm pool |
| Requêtes simultanées | 100 | 1000 | HPA, connection pooling |
| Dashboard chargement | <2s | <1s | CDN, code splitting, SSR optionnel |
| Users/instance | 50 | 10 000 | Multi-instance, RLS optimisé |
| Companies/instance | 5 | 500 | Sharding par company_id si nécessaire |
| Agents actifs simultanés | 20 | 500 | Worker pool, queue management |
| WebSocket connexions | 100 | 10 000 | Redis pub/sub, multi-instance |

#### 8.2 Caching — Redis

Redis est le composant central de la stratégie de performance. Il couvre quatre usages distincts.

**Usage 1 — Sessions** :
- Sessions Better Auth stockées dans Redis (au lieu de PostgreSQL) en production
- TTL : 24h (configurable par company pour Enterprise)
- Format : `session:{sessionId}` → JSON sérialisé
- Avantage : réduit la charge DB de ~30% (chaque requête API vérifie la session)

**Usage 2 — Cache de requêtes** :
- Queries fréquentes mises en cache : liste des membres d'une company, permissions d'un utilisateur, workflows actifs
- Pattern : Cache-Aside avec invalidation event-driven
- TTL : 5 min pour données semi-statiques (membres, rôles), 30s pour données dynamiques (workflow status)
- Invalidation : via PostgreSQL NOTIFY/LISTEN → serveur invalide le cache quand une mutation se produit
- Format clé : `cache:{companyId}:{resource}:{hash}` pour isolation multi-tenant

**Usage 3 — WebSocket pub/sub** :
- En mode multi-instance, les messages WebSocket doivent atteindre tous les clients connectés, quel que soit le pod
- Redis Pub/Sub pour broadcaster les événements entre instances
- Channels : `ws:{companyId}:broadcast`, `ws:{companyId}:user:{userId}`, `ws:{companyId}:project:{projectId}`
- Latence ajoutée : <2ms par hop Redis

**Usage 4 — Rate limiting** :
- Compteurs Redis avec TTL pour rate limiting distribué
- Granularités (extraites de NFR-SEC-09) :
  - Par IP : login 5/min, API 100/min
  - Par utilisateur : chat 10/min, invitations 20/h
  - Par company : agents actifs selon tier de licence
- Pattern : sliding window counter (`ZADD` + `ZRANGEBYSCORE`)
- Réponse HTTP 429 avec header `Retry-After`

#### 8.3 Connection Pooling — pgBouncer

PostgreSQL ne supporte nativement qu'un nombre limité de connexions simultanées (~100-200 par défaut). Avec 20 pods serveur MnM, chacun ouvrant 10 connexions, on atteint rapidement la limite.

**Solution** : pgBouncer en mode `transaction` entre les pods MnM et PostgreSQL.

```
MnM Pod 1 ──┐
MnM Pod 2 ──┤
MnM Pod 3 ──┼──► pgBouncer (pool 200 conn) ──► PostgreSQL (max 250 conn)
  ...       ──┤
MnM Pod 20 ──┘
```

**Configuration** :
- Mode : `transaction` (partage une connexion DB entre requêtes, libère entre transactions)
- Pool size : 200 connexions côté client, 50 connexions côté serveur vers PostgreSQL
- Timeout : `server_idle_timeout = 300` (libère les connexions inactives après 5 min)
- Reserve : 10 connexions réservées pour les opérations admin (migrations, backup)

**Déploiement** :
- En Cloud Managed : Sidecar container dans chaque pod MnM ou service K8s dédié
- En On-Premise : Inclus dans le Helm chart, configurable via `values.yaml`
- En Self-Hosted : Optionnel (non nécessaire pour <50 utilisateurs)

**Impact mesuré** :
- Réduction du nombre de connexions PostgreSQL actives : de N×10 (N pods) à 50 fixe
- Réduction latence connexion : de ~50ms (nouvelle connexion) à <1ms (connexion poolée)
- Capacité accrue : supporte 10 000 requêtes/s avec 50 connexions DB effectives

#### 8.4 WebSocket Scaling

Le WebSocket est critique pour l'expérience temps réel de MnM : supervision d'agents en direct, chat, notifications, mises à jour dashboard.

**Problème multi-instance** : Un client WebSocket est connecté à un pod spécifique. Si un événement est émis par un autre pod, le client ne le reçoit pas.

**Solution 1 — Sticky Sessions (MVP)** :
- L'Ingress Controller route toujours un client vers le même pod (cookie `mnm-ws-affinity`)
- Suffisant pour <100 connexions simultanées
- Limitation : si un pod tombe, les clients doivent se reconnecter et perdent l'affinité

**Solution 2 — Redis Pub/Sub (Enterprise)** :
- Chaque pod subscribe aux channels Redis pertinents
- Quand un événement est émis (mutation DB, action agent, message chat), il est publié sur le channel Redis
- Tous les pods reçoivent l'événement et le relaient aux clients WebSocket connectés
- Latence totale : émission → Redis → pod → client < 20ms

**Reconnexion automatique** (déjà spécifié dans le design UX, section 11.6) :
- Backoff exponentiel : 1s → 2s → 4s → 8s → 16s (max)
- Buffer de 30s côté serveur : messages en attente pour clients en reconnexion
- Sync des messages manqués : le client envoie son dernier `eventId`, le serveur renvoie le delta
- Indicateur visuel : vert (connecté), orange (reconnexion), rouge (déconnecté)

**Métriques WebSocket à monitorer** :
- Connexions actives par pod
- Messages/seconde entrants et sortants
- Latence P50 et P99 des messages
- Taux de reconnexion (alarme si >10/min/pod)
- Buffer overflow (alarme si >1000 messages en attente)

#### 8.5 CDN pour Assets Statiques

**Objectif** : Réduire le temps de chargement initial du dashboard de <2s (MVP) à <1s (Enterprise).

**Stratégie** :
- Build Vite produit des fichiers avec hash dans le nom (`assets/index-a1b2c3.js`)
- Ces fichiers sont immutables → `Cache-Control: public, max-age=31536000, immutable`
- Servis via CDN (Cloudflare, CloudFront, ou Bunny CDN)
- HTML (`index.html`) : `Cache-Control: no-cache` (toujours vérifier la version)

**Configuration** :
- CDN origin : le service Kubernetes MnM Server (qui sert l'UI via `SERVE_UI=true`)
- Ou mieux : bucket S3/GCS dédié pour les assets statiques, MnM Server ne sert que l'API
- Purge CDN automatique lors du déploiement d'une nouvelle version

**Performance attendue** :
- TTFB assets : <50ms (CDN edge) vs <200ms (origin)
- Bundle principal : ~350 kB gzip (React + shadcn/ui + deps)
- Code splitting : lazy loading par route (chaque page <100 kB gzip)
- Fonts : Inter (variable, ~100 kB) + JetBrains Mono (~80 kB), préchargées

#### 8.6 Rate Limiting

**Architecture multi-couche** :

| Couche | Outil | Granularité | Limites |
|--------|-------|-------------|---------|
| Edge (CDN) | Cloudflare WAF | Par IP | 1000 req/min (global) |
| Ingress | Nginx rate limit | Par IP | 200 req/min (API) |
| Application | Redis sliding window | Par user, par company | Voir détails ci-dessous |
| Database | pgBouncer queue | Par connexion | 50 conn max |

**Limites applicatives** (extraites de NFR-SEC-09) :

| Endpoint | Limite | Fenêtre | Scope |
|----------|--------|---------|-------|
| `POST /auth/login` | 5 | 1 min | Par IP |
| `POST /auth/register` | 3 | 1 min | Par IP |
| `POST /invitations` | 20 | 1 h | Par user |
| `POST /chat/messages` | 10 | 1 min | Par user |
| `POST /agents/start` | 5 | 1 min | Par user |
| `GET /api/*` (lecture) | 200 | 1 min | Par user |
| `POST /api/*` (écriture) | 50 | 1 min | Par user |
| WebSocket messages | 30 | 1 min | Par connexion |

**Réponse en cas de dépassement** :
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 32
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710432000
```

---


---

## 9. Test Architecture & CI/CD

#### 9.9.1. Stratégie de Test

#### 9.1.1 Philosophie et Pyramide de Tests

La stratégie de test MnM B2B repose sur une pyramide de tests inversée par rapport aux pratiques traditionnelles. Dans un contexte d'orchestration d'agents IA multi-tenant, la **couche d'intégration est la couche la plus critique** — c'est là que se jouent l'isolation tenant, le RBAC, les workflows déterministes et la communication agent-to-agent. Les tests unitaires servent de filet de sécurité rapide ; les tests E2E valident les parcours utilisateurs complets.

```
         ┌─────────────────┐
         │    E2E (Cypress) │  ~50 scénarios — flux critiques
         │   ~15% du volume │  Login, workflow, chat, RBAC
         ├─────────────────┤
         │  Intégration      │  ~200 scénarios — routes API, RBAC,
         │  (Supertest+DB)   │  isolation tenant, WebSocket, containers
         │   ~35% du volume  │
         ├─────────────────┤
         │  Unitaires        │  ~500+ tests — logique métier pure
         │  (Vitest)         │  state machines, parsers, validators,
         │   ~50% du volume  │  permission engine, credential proxy
         └─────────────────┘
```

**Principe directeur** : Ne jamais mocker la base de données. Les tests d'intégration utilisent une vraie instance PostgreSQL avec transactions rollback. Les seuls composants mockés sont les providers LLM externes (Claude, OpenAI, etc.) et les services tiers (Docker daemon pour les tests unitaires du ContainerManager).

#### 9.1.2 Tests Unitaires — Vitest

**Framework** : Vitest 3.x (déjà installé et configuré dans le monorepo via `vitest.config.ts` racine avec workspace projects).

**Configuration existante** : Le projet utilise déjà un workspace Vitest avec 5 projets (`packages/db`, `packages/adapters/opencode-local`, `server`, `ui`, `cli`). Il y a déjà ~55+ tests unitaires côté serveur (`server/src/__tests__/`) et ~12 côté CLI (`cli/src/__tests__/`). Les packages adapteurs ont aussi leurs propres tests (`models.test.ts`, `parse.test.ts`).

**Couverture cible** :

| Couche | Objectif couverture | Justification |
|--------|-------------------|---------------|
| `hasPermission()` / `canUser()` | ≥95% | Noyau sécurité RBAC — un trou = escalade |
| ContainerManager | ≥90% | Isolation agents — un trou = credential leak |
| Credential Proxy | ≥95% | Zero-trust — un trou = secret exposé |
| Workflow state machine | ≥90% | Déterminisme — un trou = agent en roue libre |
| Routes API (auth checks) | 100% branches | Chaque route DOIT vérifier auth+permission |
| Nouveau code (global) | ≥80% | Standard de l'industrie B2B |
| Code legacy non modifié | Pas de régression | Ne pas casser ce qui marche |

**Patterns de tests unitaires** :

```typescript
// server/src/__tests__/rbac-permission-engine.test.ts
describe('hasPermission with scope', () => {
  it('refuse accès quand scope ne contient pas le projectId', () => {
    const grant = makeGrant({
      permission: 'agent:create',
      scope: { projectIds: ['proj-1', 'proj-2'] }
    });
    expect(hasPermission(grant, 'agent:create', 'proj-999')).toBe(false);
  });

  it('autorise accès quand scope est null (company-wide)', () => {
    const grant = makeGrant({
      permission: 'agent:create',
      scope: null
    });
    expect(hasPermission(grant, 'agent:create', 'proj-999')).toBe(true);
  });

  it('bloque escalade deny > allow', () => {
    const grants = [
      makeGrant({ permission: 'agent:create', effect: 'deny' }),
      makeGrant({ permission: 'agent:create', effect: 'allow' }),
    ];
    expect(evaluateGrants(grants, 'agent:create')).toBe(false);
  });
});
```

**Organisation des fichiers tests** :

```
server/src/__tests__/
├── rbac-permission-engine.test.ts     # Tests hasPermission, canUser, scope
├── workflow-state-machine.test.ts     # Tests transitions, validations
├── container-manager.test.ts          # Tests lifecycle containers (Docker mocké)
├── credential-proxy.test.ts           # Tests injection/isolation credentials
├── drift-detector.test.ts             # Tests heuristiques drift detection
├── compaction-handler.test.ts         # Tests kill+relance, réinjection
├── audit-logger.test.ts              # Tests immutabilité, format events
├── chat-rate-limiter.test.ts          # Tests rate limiting WebSocket
├── automation-cursor.test.ts          # Tests plafond hiérarchique
└── ... (tests existants conservés)

ui/src/__tests__/
├── components/
│   ├── PermissionGate.test.tsx        # Tests masquage DOM conditionnel
│   ├── RoleSelector.test.tsx          # Tests presets de rôles
│   └── WorkflowEditor.test.tsx        # Tests drag-and-drop étapes
├── hooks/
│   ├── usePermission.test.ts          # Tests hook permission client-side
│   └── useAgentChat.test.ts           # Tests hook WebSocket reconnexion
└── utils/
    └── scope-filter.test.ts           # Tests filtrage scope côté client
```

#### 9.1.3 Tests d'Intégration — Supertest + PostgreSQL

**Framework** : Supertest 7.x (déjà dans les devDependencies du server) + PostgreSQL de test via `embedded-postgres` (déjà utilisé) ou Docker Compose.

**Principe fondamental** : Chaque test d'intégration s'exécute dans une transaction PostgreSQL qui est **rollback à la fin du test**. Ceci garantit l'isolation entre tests sans coût de re-seeding. Le pattern utilise un `beforeEach` qui démarre une transaction et un `afterEach` qui fait rollback.

```typescript
// server/src/__tests__/integration/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres';

let testTx: ReturnType<typeof db.transaction>;

beforeEach(async () => {
  testTx = await db.transaction();
  // Injecter testTx dans le contexte de l'app Express
});

afterEach(async () => {
  await testTx.rollback();
});
```

**Scénarios d'intégration critiques** (alignés avec PRD section 10) :

| Catégorie | Tests | Priorité |
|-----------|-------|----------|
| **Isolation tenant** | Cross-company data leak (RLS), API scope enforcement, container isolation | P0 |
| **RBAC routes** | 22 fichiers routes × 4 rôles = ~88 cas d'accès. Viewer 403 sur mutation. Admin OK. | P0 |
| **Scope JSONB** | Permission avec scope `{projectIds: [...]}` respectée dans queries SQL | P0 |
| **Invitations** | Création → envoi → acceptation → membership → permissions. Expiration 7j. | P0 |
| **Workflow enforcement** | Création workflow → lancement agent → step-by-step imposé → refus saut | P0 |
| **Audit log** | Toute mutation génère un audit_event. UPDATE/DELETE bloqués par trigger. | P0 |
| **WebSocket chat** | Connexion → envoi message → réception → rate limit → reconnexion | P1 |
| **Container lifecycle** | Profil → lancement → credential proxy → exécution → cleanup | P1 |
| **Compaction** | Kill+relance → résultats intermédiaires persistés → réinjection contexte | P1 |
| **Drift detection** | Agent dévie du workflow → alerte <15min → diff attendu/observé | P1 |

**Tests RBAC exhaustifs** — Matrice d'accès :

```
Route                    | Admin | Manager | Contributor | Viewer |
POST /agents             | ✓     | ✓       | ✓ (own)     | ✗ 403  |
DELETE /agents/:id       | ✓     | ✓ (own) | ✗ 403       | ✗ 403  |
GET /agents              | ✓     | ✓       | ✓ (scoped)  | ✓ (scoped) |
PUT /workflows           | ✓     | ✓       | ✗ 403       | ✗ 403  |
GET /audit-events        | ✓     | ✓       | ✗ 403       | ✗ 403  |
POST /invites            | ✓     | ✓       | ✗ 403       | ✗ 403  |
POST /chat/messages      | ✓     | ✓       | ✓           | ✗ (read-only) |
GET /dashboard/aggregate | ✓     | ✓       | ✗ 403       | ✗ 403  |
```

Chaque cellule de cette matrice est un test d'intégration automatisé. L'objectif est la couverture 100% des combinaisons route × rôle pour les routes critiques.

#### 9.1.4 Tests End-to-End — Cypress

**Framework** : Cypress (à installer — aucune configuration Cypress n'existe actuellement dans le projet actif ; les specs legacy dans `_legacy/web/e2e/` utilisaient Playwright et ne sont plus maintenues).

**Pourquoi Cypress** : L'écosystème React 19 + Vite est parfaitement supporté. Cypress offre le time-travel debugging essentiel pour les flux complexes multi-étapes (workflows, chat temps réel, RBAC). Le Component Testing natif permet aussi de tester les composants shadcn/ui en isolation.

**Flux E2E critiques** (35 scénarios PRD section 10.1) :

| # | Flux | Scénarios | Priorité |
|---|------|-----------|----------|
| E2E-01 | Login / Signup / Sign-out | Login valide, signup désactivé, sign-out invalide session | P0 |
| E2E-02 | Invitation + Onboarding | Admin invite → email → accept → membership → rôle assigné | P0 |
| E2E-03 | RBAC Navigation | Viewer ne voit PAS les items admin dans le DOM (pas masqué CSS) | P0 |
| E2E-04 | Workflow complet | Créer template → lancer agent → observer step-by-step → valider | P0 |
| E2E-05 | Chat WebSocket | Connecter → envoyer message → recevoir réponse → rate limit | P0 |
| E2E-06 | Drift + Intervention | Agent dévie → alerte → diff attendu/observé → action corrective | P1 |
| E2E-07 | Container lifecycle | Lancer agent containerisé → observer logs → credential proxy → stop | P1 |
| E2E-08 | Dashboard agrégé | Manager voit métriques agrégées, JAMAIS données individuelles | P1 |
| E2E-09 | Import Jira | Upload → mapping → validation → données importées | P2 |
| E2E-10 | Multi-company | Switch company → données isolées → pas de leak cross-tenant | P0 |

**Configuration Cypress** :

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Vite dev server
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false, // Activé seulement en CI
    screenshotOnRunFailure: true,
    retries: { runMode: 2, openMode: 0 },
    env: {
      API_URL: 'http://localhost:3000',
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'ui/src/**/*.cy.tsx',
  },
});
```

**Organisation Cypress** :

```
cypress/
├── e2e/
│   ├── auth/
│   │   ├── login.cy.ts
│   │   ├── signup-disabled.cy.ts
│   │   └── signout.cy.ts
│   ├── rbac/
│   │   ├── role-assignment.cy.ts
│   │   ├── navigation-masking.cy.ts
│   │   └── scope-enforcement.cy.ts
│   ├── workflow/
│   │   ├── create-template.cy.ts
│   │   ├── step-by-step-execution.cy.ts
│   │   └── drift-intervention.cy.ts
│   ├── chat/
│   │   ├── websocket-dialog.cy.ts
│   │   └── reconnection.cy.ts
│   ├── containers/
│   │   └── lifecycle.cy.ts
│   └── multi-tenant/
│       └── isolation.cy.ts
├── fixtures/
│   ├── users.json
│   ├── companies.json
│   └── workflows.json
├── support/
│   ├── commands.ts         # cy.login(), cy.createAgent(), cy.asRole()
│   └── e2e.ts
└── plugins/
    └── db-seed.ts          # Seed PostgreSQL avant les tests
```

#### 9.1.5 Tests de Sécurité

**Framework principal** : OWASP ZAP (scan automatisé en CI) + tests manuels ciblés.

**12 catégories de tests sécurité** (alignées PRD 10.3) :

#### RBAC Bypass (3 tests)

1. **Escalade horizontale** : Envoyer un header `X-Company-Id` forgé. Le serveur DOIT utiliser uniquement le `companyId` résolu depuis la session, jamais un header client.
2. **Escalade verticale** : Token d'un viewer tente un `POST /agents`. Résultat attendu : 403 Forbidden.
3. **Injection SQL via JSONB** : Payload malicieux dans le champ `scope` (`{"projectIds": ["'; DROP TABLE users; --"]}"`). Le ORM Drizzle paramétrise les queries, mais le test vérifie que l'injection ne passe pas au niveau applicatif.

#### Container Security (3 tests)

4. **Container escape** : Mount `/etc/shadow` ou `/proc/self/environ`. L'allowlist tamper-proof DOIT refuser avec `realpath` + interdiction des symlinks.
5. **Credential proxy tampering** : Agent tente d'accéder directement aux secrets contournant le proxy. Résultat attendu : 403 + audit event.
6. **Path traversal** : `../../etc/passwd`, null bytes (`%00`), encodage URL double. Blocked par `realpath` + validation strict.

#### Input Validation (3 tests)

7. **XSS via chat** : Message contenant `<script>alert(1)</script>`, SVG avec JS, markdown malicieux. Le serveur applique UTF-8 strict + sanitization. Le client utilise React qui escape par défaut.
8. **CSRF** : Requête cross-origin sans token CSRF. SameSite=Strict sur les cookies + validation Origin/Referer.
9. **SQL injection scope** : Payloads OWASP standard dans les paramètres de query qui alimentent les filtres JSONB.

#### Auth & Session (2 tests)

10. **Session hijacking** : Token expiré ou fixé. Better Auth gère l'expiration ; le test vérifie que les sessions sont invalidées côté DB.
11. **Brute force** : >5 tentatives login en 1 minute. Rate limiting activé, réponse 429.

#### Multi-Tenant (1 test)

12. **Isolation inter-company** : Créer 2 companies avec chacune des agents, issues, workflows. Vérifier qu'aucune query ne retourne des données de l'autre company via RLS PostgreSQL + filtrage applicatif + isolation containers.

**Exécution** : Les tests sécurité OWASP ZAP tournent en mode headless dans le pipeline CI. Les tests RBAC/injection sont des tests d'intégration standards dans Vitest.

---

#### 9.9.2. Pipeline CI/CD

#### 9.2.1 Architecture du Pipeline

Le pipeline CI/CD utilise **GitHub Actions** avec une stratégie de parallélisation agressive pour maintenir un cycle de feedback rapide (<10 minutes pour le chemin critique).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PUSH / PULL REQUEST                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    QG-0 : Compile     │  ~2 min
                    │  ┌─────────────────┐  │
                    │  │ pnpm install     │  │
                    │  │ pnpm typecheck   │  │
                    │  │ ESLint           │  │
                    │  │ check:tokens     │  │
                    │  └─────────────────┘  │
                    └───────────┬───────────┘
                                │ (gate : 0 erreur)
                    ┌───────────▼───────────┐
                    │   PARALLÈLE            │
                    │                        │
        ┌───────────┤                        ├───────────┐
        │           └────────────────────────┘           │
        ▼                                                ▼
┌───────────────┐                              ┌──────────────────┐
│ QG-1 : Unit   │  ~3 min                      │ QG-2 : Integ    │  ~5 min
│ vitest run    │                              │ Supertest + PG   │
│ --coverage    │                              │ (embedded-pg)    │
│ ≥80% new code │                              │ RBAC + tenant    │
└───────┬───────┘                              └────────┬─────────┘
        │                                               │
        └───────────────────┬───────────────────────────┘
                            │ (gate : 0 failing, coverage OK)
                ┌───────────▼───────────┐
                │   QG-3 : Security     │  ~4 min
                │  ┌─────────────────┐  │
                │  │ OWASP ZAP scan  │  │
                │  │ Secret scan     │  │
                │  │ Dependency audit│  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │ (gate : 0 critique/haute)
                ┌───────────▼───────────┐
                │   Build Production    │  ~3 min
                │  ┌─────────────────┐  │
                │  │ pnpm build      │  │
                │  │ Docker image    │  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │   PARALLÈLE           │
        ┌───────┤                       ├───────┐
        ▼       └───────────────────────┘       ▼
┌───────────────┐                      ┌──────────────────┐
│ QG-4 : Perf   │  ~5 min             │ QG-5 : E2E      │  ~8 min
│ k6 benchmarks │                      │ Cypress          │
│ API + WS      │                      │ Flux critiques   │
└───────┬───────┘                      └────────┬─────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │ (gate : toutes métriques OK)
                ┌───────────▼───────────┐
                │   QG-6 : Review       │
                │  ┌─────────────────┐  │
                │  │ PR review req.  │  │
                │  │ Migration check │  │
                │  │ Audit log check │  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │ (gate : approbation humaine)
                ┌───────────▼───────────┐
                │   DEPLOY              │
                │  staging → production │
                └───────────────────────┘
```

#### 9.2.2 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [master, 'feature/**']
  pull_request:
    branches: [master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9.15.4'

jobs:
  # ─────────────────────────────────────
  # QG-0 : Compilation & Lint
  # ─────────────────────────────────────
  compile:
    name: QG-0 — Compile & Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: TypeScript strict check
        run: pnpm typecheck

      - name: ESLint
        run: pnpm lint

      - name: Check forbidden tokens (secrets)
        run: pnpm check:tokens

      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            packages/*/node_modules
            server/node_modules
            ui/node_modules
            cli/node_modules
          key: deps-${{ hashFiles('pnpm-lock.yaml') }}

  # ─────────────────────────────────────
  # QG-1 : Tests Unitaires (parallèle)
  # ─────────────────────────────────────
  unit-tests:
    name: QG-1 — Tests Unitaires
    needs: compile
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run unit tests with coverage
        run: pnpm vitest run --coverage --reporter=default --reporter=junit --outputFile=junit.xml

      - name: Check coverage threshold
        run: |
          # Vérifier couverture ≥80% nouveau code
          # Utiliser vitest coverage avec c8/istanbul
          pnpm vitest run --coverage --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.branches=80

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: unit-test-results
          path: junit.xml

  # ─────────────────────────────────────
  # QG-2 : Tests Intégration (parallèle)
  # ─────────────────────────────────────
  integration-tests:
    name: QG-2 — Tests Intégration
    needs: compile
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: mnm_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mnm_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://mnm_test:test_password@localhost:5432/mnm_test
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run database migrations
        run: pnpm db:migrate

      - name: Run integration tests
        run: pnpm vitest run --project server --testPathPattern='integration'

      - name: Upload integration results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: integration-test-results
          path: junit-integration.xml

  # ─────────────────────────────────────
  # QG-3 : Tests Sécurité
  # ─────────────────────────────────────
  security:
    name: QG-3 — Sécurité
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Dependency audit
        run: pnpm audit --audit-level=high

      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

      - name: OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.14.0
        with:
          target: 'http://localhost:3000'
          cmd_options: '-a -j'
          allow_issue_writing: false
        continue-on-error: true  # Alertes informational OK

  # ─────────────────────────────────────
  # Build production
  # ─────────────────────────────────────
  build:
    name: Build Production
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Build Docker image
        run: docker build -t mnm:${{ github.sha }} .

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: |
            server/dist/
            ui/dist/

  # ─────────────────────────────────────
  # QG-4 : Tests Performance (parallèle)
  # ─────────────────────────────────────
  performance:
    name: QG-4 — Performance
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: mnm_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mnm_perf
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Start application
        run: |
          pnpm install --frozen-lockfile
          pnpm db:migrate
          pnpm dev:server &
          sleep 5

      - name: Run API benchmarks
        run: k6 run tests/performance/api-benchmark.js --out json=perf-results.json

      - name: Run WebSocket benchmarks
        run: k6 run tests/performance/websocket-benchmark.js --out json=ws-results.json

      - name: Check thresholds
        run: node tests/performance/check-thresholds.js

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: perf-results
          path: |
            perf-results.json
            ws-results.json

  # ─────────────────────────────────────
  # QG-5 : Tests E2E (parallèle)
  # ─────────────────────────────────────
  e2e:
    name: QG-5 — E2E Cypress
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: mnm_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mnm_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run migrations & seed
        env:
          DATABASE_URL: postgresql://mnm_test:test_password@localhost:5432/mnm_e2e
        run: |
          pnpm db:migrate
          node tests/e2e/seed.js

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          start: pnpm dev
          wait-on: 'http://localhost:5173'
          wait-on-timeout: 60
          record: false
          config: video=true
        env:
          DATABASE_URL: postgresql://mnm_test:test_password@localhost:5432/mnm_e2e

      - name: Upload Cypress artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-artifacts
          path: |
            cypress/screenshots/
            cypress/videos/

  # ─────────────────────────────────────
  # Deploy (staging → production)
  # ─────────────────────────────────────
  deploy-staging:
    name: Deploy Staging
    needs: [security, performance, e2e]
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: echo "Deploy staging — à configurer selon l'infra choisie"

  deploy-production:
    name: Deploy Production
    needs: deploy-staging
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.mnm.dev
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: echo "Deploy production — à configurer selon l'infra choisie"

      - name: Run smoke tests
        run: |
          # 7 smoke tests obligatoires (PRD 10.5)
          node tests/smoke/run-all.js
```

#### 9.2.3 Stratégie de Caching

Le pipeline utilise un caching agressif pour réduire les temps d'exécution :

| Élément | Clé de cache | Invalidation |
|---------|-------------|-------------|
| `node_modules` | `deps-${{ hashFiles('pnpm-lock.yaml') }}` | Changement lockfile |
| Build artifacts | `build-${{ github.sha }}` | Chaque commit |
| Cypress binary | `cypress-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` | Changement version Cypress |
| Docker layers | GitHub Container Registry cache | Changement Dockerfile |
| PostgreSQL image | Docker layer cache | Changement version PG |

**Temps pipeline estimé** :
- Chemin critique (séquentiel) : QG-0 (2min) → QG-1||QG-2 (5min) → QG-3 (4min) → Build (3min) → QG-4||QG-5 (8min) = **~22 minutes**
- Avec cache warm : **~15 minutes**

#### 9.2.4 Environnements

| Environnement | Déclencheur | Base de données | Objectif |
|---------------|-------------|-----------------|----------|
| **Test (CI)** | Chaque push/PR | `embedded-postgres` ou service PG | Validation automatique |
| **Dev local** | `pnpm dev` | `embedded-postgres` (inclus) | Développement quotidien |
| **Staging** | Merge sur `master` | PostgreSQL dédié | Validation pré-production |
| **Production** | Approbation manuelle | PostgreSQL production (RDS/Cloud SQL) | Utilisateurs finaux |

#### 9.2.5 Stratégie de Branches et Déploiement

```
feature/* ──PR──▶ master ──auto──▶ staging ──manual──▶ production
                    │
                    └── tags/v*.*.* ──▶ release (npm, Docker Hub)
```

- **Feature branches** : CI complet (QG-0 à QG-5) sur chaque PR
- **Master** : Déploiement automatique en staging après merge
- **Production** : Déploiement manuel après validation staging (environment protection rule)
- **Hotfix** : Branche `hotfix/*` → PR directe sur master → fast-track CI (skip perf tests si `[hotfix]` dans le message)

---

#### 9.9.3. Quality Gates Automatisées

#### 9.3.1 Définition des 7 Quality Gates

Chaque Quality Gate est un **point de décision binaire** : le pipeline avance ou s'arrête. Aucune exception, aucun override sans approbation explicite d'un admin.

#### QG-0 — Compilation & Standards

| Critère | Commande | Seuil |
|---------|----------|-------|
| TypeScript strict | `pnpm typecheck` | 0 erreur |
| ESLint | `pnpm lint` | 0 erreur (warnings OK en dev, pas en CI) |
| Secrets check | `pnpm check:tokens` | 0 token interdit détecté |
| Build | `pnpm build` | Exit code 0 |

**Rationale** : Le build TypeScript strict est la première ligne de défense. Avec `strict: true` dans tous les `tsconfig.json` (déjà le cas), les types garantissent la cohérence structurelle du code. Le check de tokens interdit (`check:tokens`) prévient la fuite accidentelle de secrets.

#### QG-1 — Tests Unitaires

| Critère | Seuil |
|---------|-------|
| Tests passants | 100% (0 failing) |
| Couverture lignes (nouveau code) | ≥80% |
| Couverture fonctions (nouveau code) | ≥80% |
| Couverture branches (nouveau code) | ≥80% |
| Couverture RBAC engine | ≥95% |
| Couverture credential proxy | ≥95% |

**Mesure du "nouveau code"** : Utilisation de `vitest --changed` avec la base `origin/master` pour ne mesurer la couverture que sur les fichiers modifiés. Les fichiers existants non modifiés ne sont pas soumis au seuil de couverture.

#### QG-2 — Tests Intégration

| Critère | Seuil |
|---------|-------|
| Routes API protégées | 100% des routes auth-required testées |
| RBAC enforcement | Matrice rôle × route complète |
| Isolation tenant | 0 data leak cross-company |
| Migrations | Toutes les migrations appliquées sans erreur |
| Transactions rollback | Tests isolés (aucun effet de bord entre tests) |

#### QG-3 — Sécurité

| Critère | Outil | Seuil |
|---------|-------|-------|
| Vulnérabilités dépendances | `pnpm audit` | 0 critique, 0 haute |
| Secrets en dur | TruffleHog | 0 secret vérifié trouvé |
| OWASP Top 10 | ZAP Baseline | 0 alerte haute/critique |
| Injection SQL | Tests intégration | Tous les payloads OWASP bloqués |
| XSS | Tests intégration + ZAP | 0 vecteur XSS non-sanitisé |

#### QG-4 — Performance

| Critère | Seuil MVP | Seuil Enterprise |
|---------|----------|-----------------|
| API latence P50 | <100ms | <50ms |
| API latence P95 | <500ms | <200ms |
| API latence P99 | <1000ms | <500ms |
| WebSocket message latence | <50ms | <20ms |
| Container démarrage | <10s | <5s |
| Dashboard chargement | <2s | <1s |
| Requêtes simultanées | 100 | 1000 |

#### QG-5 — Tests E2E

| Critère | Seuil |
|---------|-------|
| Flux critiques P0 | 100% passants |
| Flux P1 | ≥90% passants (retry 2x pour flaky) |
| Screenshots de régression | 0 différence non-approuvée |
| Temps total E2E | <20 minutes |

#### QG-6 — Review & Audit

| Critère | Vérification |
|---------|-------------|
| Code review | ≥1 approbation requise sur la PR |
| Migrations réversibles | Chaque `up()` a un `down()` correspondant |
| Audit log vérifié | Toute mutation dans la PR émet un audit event |
| Changelog | PR contient un changeset si modification visible par l'utilisateur |
| Documentation | API modifiée → OpenAPI spec mise à jour |

#### 9.3.2 Matrice Quality Gate × Environnement

| QG | PR / Feature | Master | Staging | Production |
|----|-------------|--------|---------|-----------|
| QG-0 Compile | Obligatoire | Obligatoire | N/A | N/A |
| QG-1 Unit | Obligatoire | Obligatoire | N/A | N/A |
| QG-2 Integ | Obligatoire | Obligatoire | N/A | N/A |
| QG-3 Security | Obligatoire | Obligatoire | N/A | N/A |
| QG-4 Perf | Informational | Obligatoire | Obligatoire | N/A |
| QG-5 E2E | Obligatoire | Obligatoire | Smoke only | Smoke only |
| QG-6 Review | Obligatoire | N/A (post-merge) | Manual | Sign-off |

**"Informational" sur les PRs** : Les tests de performance ne bloquent pas une PR mais affichent les résultats en commentaire pour comparaison. Ils deviennent bloquants au merge sur master.

---

#### 9.9.4. Stratégie de Tests de Performance

#### 9.4.1 Benchmarks API — k6

**Framework** : k6 (Grafana Labs) — scriptable en JavaScript, intégration native CI, export métriques.

```javascript
// tests/performance/api-benchmark.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const apiLatency = new Trend('api_latency');
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Scénario 1 : Charge normale (MVP cible)
    normal_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
    },
    // Scénario 2 : Pic de charge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      startTime: '3m',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:agents}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:issues}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:workflows}': ['p(95)<500'],
    'http_req_duration{endpoint:audit}': ['p(95)<500'],
    'http_req_duration{endpoint:dashboard}': ['p(95)<2000'],
    errors: ['rate<0.01'],  // <1% erreurs
  },
};

export default function () {
  // GET /api/agents (liste agents, scoped par company)
  const agents = http.get(`${__ENV.BASE_URL}/api/agents`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
    tags: { endpoint: 'agents' },
  });
  check(agents, { 'agents 200': (r) => r.status === 200 });
  apiLatency.add(agents.timings.duration);

  // GET /api/issues (liste issues, scoped par projet)
  const issues = http.get(`${__ENV.BASE_URL}/api/issues`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
    tags: { endpoint: 'issues' },
  });
  check(issues, { 'issues 200': (r) => r.status === 200 });

  // POST /api/workflow-instances (création workflow)
  const workflow = http.post(`${__ENV.BASE_URL}/api/workflow-instances`,
    JSON.stringify({ templateId: __ENV.TEMPLATE_ID }),
    {
      headers: {
        Authorization: `Bearer ${__ENV.TOKEN}`,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'workflows' },
    }
  );
  check(workflow, { 'workflow 201': (r) => r.status === 201 });

  sleep(1);
}
```

**Endpoints benchmarkés** :

| Endpoint | Opération | Seuil P50 | Seuil P95 | Seuil P99 |
|----------|-----------|----------|----------|----------|
| `GET /api/agents` | Liste agents company | <50ms | <200ms | <500ms |
| `GET /api/issues` | Liste issues projet | <50ms | <200ms | <500ms |
| `POST /api/agents` | Création agent | <100ms | <300ms | <800ms |
| `POST /api/workflow-instances` | Lancement workflow | <200ms | <500ms | <1000ms |
| `GET /api/audit-events` | Query audit log | <100ms | <500ms | <1000ms |
| `GET /api/dashboard` | Dashboard agrégé | <500ms | <2000ms | <3000ms |

#### 9.4.2 WebSocket — k6 + xk6-websocket

```javascript
// tests/performance/websocket-benchmark.js
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const wsLatency = new Trend('ws_message_latency');

export const options = {
  vus: 50,        // 50 connexions simultanées (cible MVP)
  duration: '1m',
  thresholds: {
    ws_message_latency: ['p(95)<50', 'p(99)<100'],
    ws_connecting: ['p(95)<500'],
  },
};

export default function () {
  const url = `ws://${__ENV.WS_HOST}/ws`;

  const res = ws.connect(url, { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }, (socket) => {
    socket.on('open', () => {
      // Envoyer un message de chat
      const sendTime = Date.now();
      socket.send(JSON.stringify({
        type: 'chat_message',
        channelId: __ENV.CHANNEL_ID,
        content: 'Benchmark message',
      }));

      socket.on('message', (data) => {
        const latency = Date.now() - sendTime;
        wsLatency.add(latency);
      });
    });

    socket.setTimeout(() => socket.close(), 5000);
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
}
```

**Métriques WebSocket** :

| Métrique | Seuil MVP | Seuil Enterprise |
|----------|----------|-----------------|
| Messages/seconde (par connexion) | 10 | 50 |
| Latence message P95 | <50ms | <20ms |
| Temps de reconnexion | <2s | <500ms |
| Connexions simultanées | 100 | 10 000 |
| Buffer messages en vol (reconnexion) | 30s | 30s |

#### 9.4.3 Container — Benchmarks de Cycle de Vie

```javascript
// tests/performance/container-benchmark.js
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const containerStartTime = new Trend('container_start_time');
const containerMemory = new Trend('container_memory_mb');

export default function () {
  // Mesurer temps démarrage container
  const start = Date.now();
  const res = http.post(`${__ENV.BASE_URL}/api/containers`,
    JSON.stringify({
      profileId: __ENV.PROFILE_ID,
      agentId: __ENV.AGENT_ID,
    }),
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}`, 'Content-Type': 'application/json' } }
  );

  if (res.status === 201) {
    const containerId = JSON.parse(res.body).id;

    // Attendre que le container soit ready
    let ready = false;
    while (!ready && (Date.now() - start) < 30000) {
      const status = http.get(`${__ENV.BASE_URL}/api/containers/${containerId}/status`,
        { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
      );
      ready = JSON.parse(status.body).state === 'running';
    }

    containerStartTime.add(Date.now() - start);

    // Cleanup
    http.delete(`${__ENV.BASE_URL}/api/containers/${containerId}`,
      { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
    );
  }
}
```

**Métriques Container** :

| Métrique | Seuil MVP | Seuil Enterprise |
|----------|----------|-----------------|
| Temps démarrage cold | <10s | <5s |
| Temps démarrage warm (image cached) | <3s | <2s |
| Overhead mémoire par container | <256MB | <128MB |
| Temps cleanup (--rm) | <2s | <1s |
| Containers simultanés par instance | 20 | 500 |

#### 9.4.4 Base de Données — Monitoring Queries

**Outil** : `pg_stat_statements` + script d'analyse automatisé.

| Métrique | Seuil | Action si dépassé |
|----------|-------|-------------------|
| Queries >100ms | <5% du total | EXPLAIN ANALYZE + index candidat |
| Queries >1s | 0% | Alerte immédiate + optimisation |
| Index coverage (tables critiques) | >95% | CREATE INDEX pour queries manquantes |
| Seq scans sur tables >10k rows | 0 | Ajout index obligatoire |
| Connexions pool | <80% max_connections | Alerter si >80% |

**Tables critiques à monitorer** :

```sql
-- Script monitoring queries lentes
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### 9.4.5 Load Testing — Scénarios Utilisateurs

| Scénario | Users | Agents | Durée | Métriques clés |
|----------|-------|--------|-------|---------------|
| **MVP normal** | 50 users | 20 agents | 5min | API P95, WS latence, DB queries |
| **MVP peak** | 100 users | 50 agents | 2min | Erreur rate, temps réponse dégradation |
| **Enterprise steady** | 500 users | 200 agents | 10min | CPU/RAM, connexions pool, GC pauses |
| **Enterprise burst** | 1000 users | 500 agents | 1min | Saturation, queue depth, auto-scaling |
| **Soak test** | 50 users | 20 agents | 2h | Memory leaks, connexion leaks, DB bloat |

---

#### 9.9.5. Infrastructure de Test

#### 9.5.1 Test Fixtures — Factories

**Pattern** : Factory functions avec des valeurs par défaut sensibles et des overrides typés.

```typescript
// tests/factories/index.ts
import { randomUUID } from 'crypto';

export function createUser(overrides?: Partial<User>): User {
  return {
    id: randomUUID(),
    email: `user-${randomUUID().slice(0, 8)}@test.mnm.dev`,
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createCompany(overrides?: Partial<Company>): Company {
  return {
    id: randomUUID(),
    name: `Company ${randomUUID().slice(0, 6)}`,
    slug: `company-${randomUUID().slice(0, 6)}`,
    tier: 'team',
    maxUsers: 50,
    ssoEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: randomUUID(),
    companyId: randomUUID(),
    name: 'Test Agent',
    role: 'developer',
    status: 'idle',
    adapterType: 'claude_local',
    containerProfileId: null,
    isolationMode: 'process',
    ...overrides,
  };
}

export function createWorkflowTemplate(overrides?: Partial<WorkflowTemplate>): WorkflowTemplate {
  return {
    id: randomUUID(),
    companyId: randomUUID(),
    name: 'Test Workflow',
    steps: [
      { id: 'step-1', name: 'Analyse', requiredFiles: ['spec.md'], prompt: 'Analyse le spec' },
      { id: 'step-2', name: 'Implémentation', requiredFiles: [], prompt: 'Implémente' },
      { id: 'step-3', name: 'Tests', requiredFiles: [], prompt: 'Écris les tests' },
    ],
    autoTransition: false,
    ...overrides,
  };
}

export function createMembership(overrides?: Partial<CompanyMembership>): CompanyMembership {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    companyId: randomUUID(),
    businessRole: 'contributor',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createPermissionGrant(overrides?: Partial<PermissionGrant>): PermissionGrant {
  return {
    id: randomUUID(),
    principalType: 'user',
    principalId: randomUUID(),
    permission: 'agent:read',
    effect: 'allow',
    scope: null,  // null = company-wide
    ...overrides,
  };
}
```

#### 9.5.2 Database Seeding

**Seed de test cohérent** : Un jeu de données standard pour les tests E2E et d'intégration qui représente un cas d'usage réel MnM.

```typescript
// tests/seed/e2e-seed.ts
export async function seedE2EData(db: Database) {
  // Company Alpha (primary test company)
  const companyAlpha = await db.insert(companies).values(
    createCompany({ name: 'Alpha Corp', tier: 'team', maxUsers: 50 })
  ).returning();

  // Company Beta (for isolation tests)
  const companyBeta = await db.insert(companies).values(
    createCompany({ name: 'Beta Inc', tier: 'team', maxUsers: 10 })
  ).returning();

  // Users avec différents rôles
  const adminUser = await createAndInsertUser(db, {
    email: 'admin@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'admin',
  });

  const managerUser = await createAndInsertUser(db, {
    email: 'manager@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'manager',
  });

  const contributorUser = await createAndInsertUser(db, {
    email: 'contributor@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'contributor',
  });

  const viewerUser = await createAndInsertUser(db, {
    email: 'viewer@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'viewer',
  });

  // User dans Beta (pour tests isolation)
  const betaUser = await createAndInsertUser(db, {
    email: 'user@beta.test',
    companyId: companyBeta[0].id,
    businessRole: 'admin',
  });

  // Projet avec scoping
  const project = await db.insert(projects).values({
    id: randomUUID(),
    companyId: companyAlpha[0].id,
    name: 'Projet Test',
    slug: 'projet-test',
  }).returning();

  // Agents (2 dans Alpha, 1 dans Beta)
  const agentAlpha = await db.insert(agents).values(
    createAgent({
      companyId: companyAlpha[0].id,
      name: 'Agent Dev Alpha',
      role: 'developer',
    })
  ).returning();

  const agentBeta = await db.insert(agents).values(
    createAgent({
      companyId: companyBeta[0].id,
      name: 'Agent Dev Beta',
      role: 'developer',
    })
  ).returning();

  // Workflow template
  const template = await db.insert(workflowTemplates).values(
    createWorkflowTemplate({ companyId: companyAlpha[0].id })
  ).returning();

  // Permissions avec scope
  await db.insert(principalPermissionGrants).values([
    createPermissionGrant({
      principalId: contributorUser.id,
      permission: 'agent:create',
      scope: { projectIds: [project[0].id] },
    }),
  ]);

  return {
    companies: { alpha: companyAlpha[0], beta: companyBeta[0] },
    users: { admin: adminUser, manager: managerUser, contributor: contributorUser, viewer: viewerUser, beta: betaUser },
    projects: { test: project[0] },
    agents: { alpha: agentAlpha[0], beta: agentBeta[0] },
    templates: { default: template[0] },
  };
}
```

#### 9.5.3 Mock Strategy

**Règle fondamentale** : Mocker les services externes, JAMAIS la base de données.

| Composant | Stratégie | Justification |
|-----------|-----------|---------------|
| **PostgreSQL** | Vrai DB (embedded-postgres ou Docker service) | L'isolation tenant, le RBAC avec scope JSONB, les triggers audit — tout passe par la DB. Mocker = fausse confiance. |
| **LLM Providers** (Claude, OpenAI) | Mock complet via `vi.mock()` | Les appels LLM sont lents, coûteux, non-déterministes. Le mock retourne des réponses fixes pour les tests de workflow et drift. |
| **Docker daemon** | Mock pour tests unitaires, vrai Docker pour tests intégration | Les tests unitaires du ContainerManager vérifient la logique (allowlist, profils). Les tests intégration vérifient le cycle de vie réel. |
| **WebSocket** | Vrai serveur WS en test intégration, mock client pour tests unitaires UI | La reconnexion, le buffer 30s, le rate limiting ne peuvent être testés qu'avec un vrai serveur WS. |
| **Email (invitations)** | Mock SMTP (nodemailer-mock ou similaire) | Vérifier que les emails sont envoyés avec le bon contenu sans envoyer réellement. |
| **Services tiers (Jira, Linear)** | Mock HTTP via `msw` (Mock Service Worker) | Tester les flows d'import sans dépendance réseau. |

```typescript
// tests/mocks/llm-provider.ts
import { vi } from 'vitest';

export const mockLLMProvider = {
  generateSummary: vi.fn().mockResolvedValue({
    summary: 'L\'agent a complété l\'étape d\'analyse avec succès.',
    confidence: 0.95,
    tokens: { input: 1500, output: 200 },
  }),
  detectDrift: vi.fn().mockResolvedValue({
    isDrifting: false,
    deviation: 0.05,
    details: null,
  }),
};
```

#### 9.5.4 Test Containers — Docker Compose

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: mnm_test
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: mnm_test
    ports:
      - "5433:5432"  # Port différent pour ne pas confliter avec le dev
    tmpfs:
      - /var/lib/postgresql/data  # RAM pour la vitesse
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mnm_test"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Pour les tests de containerisation réelle
  dind:
    image: docker:24-dind
    privileged: true
    environment:
      DOCKER_TLS_CERTDIR: ""
    ports:
      - "2376:2376"
```

**Utilisation en local** :

```bash
# Démarrer l'infra de test
docker compose -f docker-compose.test.yml up -d

# Lancer les tests d'intégration
DATABASE_URL=postgresql://mnm_test:test_password@localhost:5433/mnm_test pnpm vitest run --project server --testPathPattern='integration'

# Arrêter
docker compose -f docker-compose.test.yml down
```

#### 9.5.5 Organisation Complète des Fichiers de Test

```
mnm/
├── tests/
│   ├── factories/              # Factories partagées
│   │   ├── index.ts
│   │   ├── user.factory.ts
│   │   ├── company.factory.ts
│   │   ├── agent.factory.ts
│   │   └── workflow.factory.ts
│   ├── seed/                   # Données de seed
│   │   ├── e2e-seed.ts
│   │   └── perf-seed.ts
│   ├── mocks/                  # Mocks partagés
│   │   ├── llm-provider.ts
│   │   ├── docker-daemon.ts
│   │   └── email-service.ts
│   ├── helpers/                # Utilitaires de test
│   │   ├── db-transaction.ts   # Setup transaction rollback
│   │   ├── auth-helpers.ts     # createSession(), loginAs()
│   │   └── ws-helpers.ts       # connectWebSocket(), waitForMessage()
│   ├── performance/            # Scripts k6
│   │   ├── api-benchmark.js
│   │   ├── websocket-benchmark.js
│   │   ├── container-benchmark.js
│   │   └── check-thresholds.js
│   ├── smoke/                  # Smoke tests pré-deploy
│   │   ├── run-all.js
│   │   ├── auth.smoke.ts
│   │   ├── agent-workflow.smoke.ts
│   │   ├── websocket.smoke.ts
│   │   ├── rbac.smoke.ts
│   │   ├── container.smoke.ts
│   │   ├── credential-proxy.smoke.ts
│   │   └── tenant-isolation.smoke.ts
│   └── security/               # Tests sécurité OWASP
│       ├── rbac-bypass.test.ts
│       ├── container-escape.test.ts
│       ├── input-validation.test.ts
│       └── session-security.test.ts
├── cypress/                    # Tests E2E
│   ├── e2e/
│   │   ├── auth/
│   │   ├── rbac/
│   │   ├── workflow/
│   │   ├── chat/
│   │   ├── containers/
│   │   └── multi-tenant/
│   ├── fixtures/
│   ├── support/
│   └── plugins/
├── server/src/__tests__/       # Tests unitaires serveur (existants + nouveaux)
├── ui/src/__tests__/           # Tests unitaires UI
├── cli/src/__tests__/          # Tests unitaires CLI (existants)
├── packages/*/                 # Tests par package
├── docker-compose.test.yml     # Infra de test
├── cypress.config.ts           # Config Cypress
└── vitest.config.ts            # Config Vitest workspace (existant)
```

#### 9.5.6 Scripts npm Additionnels

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:unit": "vitest run --testPathPattern='__tests__'",
    "test:integration": "vitest run --project server --testPathPattern='integration'",
    "test:coverage": "vitest run --coverage",
    "test:security": "vitest run --testPathPattern='security'",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:perf": "k6 run tests/performance/api-benchmark.js",
    "test:perf:ws": "k6 run tests/performance/websocket-benchmark.js",
    "test:smoke": "node tests/smoke/run-all.js",
    "test:ci": "pnpm test:run && pnpm test:integration && pnpm test:security",
    "test:all": "pnpm test:ci && pnpm test:e2e && pnpm test:perf"
  }
}
```

#### 9.5.7 Smoke Tests Pré-Deploy (7 obligatoires)

Les 7 smoke tests du PRD 10.5 sont automatisés et exécutés après chaque déploiement staging et production :

| # | Smoke Test | Vérification | Timeout |
|---|-----------|-------------|---------|
| 1 | Login/signup/sign-out | Créer compte → login → vérifier session → sign-out → session invalide | 30s |
| 2 | Création agent + workflow | Créer agent → lancer workflow → vérifier step 1 actif | 60s |
| 3 | WebSocket chat | Connexion WS → envoyer message → recevoir ACK | 15s |
| 4 | RBAC viewer restriction | Login viewer → tenter POST /agents → vérifier 403 | 15s |
| 5 | Container lifecycle | Lancer container → vérifier running → arrêter → vérifier cleanup | 30s |
| 6 | Credential proxy | Requête valide → credential injectée. Requête directe → 403 | 15s |
| 7 | Isolation tenant | Login company A → query agents → 0 agent company B visible | 15s |

---

### Annexe A — Métriques Récapitulatives

| Dimension | Valeur cible |
|-----------|-------------|
| Nombre total de tests (estimé) | ~750 (500 unit + 200 integ + 50 E2E) |
| Couverture globale nouveau code | ≥80% |
| Couverture modules critiques (RBAC, proxy, containers) | ≥90-95% |
| Temps pipeline CI complet | <22 min (cache froid), <15 min (cache chaud) |
| Temps feedback unitaires (PR) | <5 min |
| Tests de sécurité automatisés | 12 catégories, ~30 tests |
| Tests de performance automatisés | 5 scénarios k6 |
| Smoke tests pré-deploy | 7 obligatoires |

### Annexe B — Priorisation d'Implémentation

| Phase | Actions | Effort estimé |
|-------|---------|---------------|
| **Phase 1 (Semaine 1-2)** | Configurer GitHub Actions QG-0/QG-1, écrire factories, setup test DB, premiers tests RBAC | 3-4 jours |
| **Phase 2 (Semaine 3-4)** | Tests intégration routes, matrice RBAC, isolation tenant, QG-2/QG-3 | 3-4 jours |
| **Phase 3 (Semaine 5-6)** | Installer Cypress, E2E flux critiques, QG-5 | 3-4 jours |
| **Phase 4 (Semaine 7-8)** | k6 benchmarks, QG-4, smoke tests, OWASP ZAP | 2-3 jours |
| **Continu** | Tests de régression à chaque nouvelle feature | Intégré au workflow dev |

---


---

## 10. Migration Strategy

### 10.1 Stratégie de Migration Mono-user → Multi-tenant

La migration est structurée en 4 phases séquentielles avec rollback plan à chaque phase. L'objectif est le **zero-downtime** : aucune interruption de service pour les utilisateurs existants.

#### 10.1 Principes Directeurs

1. **Additive-first** : on ajoute avant de modifier, on modifie avant de supprimer
2. **Non-breaking** : chaque phase est compatible avec le code de la phase précédente
3. **Testable** : chaque phase peut être validée indépendamment
4. **Réversible** : chaque phase a un rollback documenté et testé
5. **Zero-downtime** : les migrations SQL sont non-bloquantes (pas de `ALTER TABLE ... LOCK`)

#### 10.2 Phase 1 — Ajout de Colonnes et Nouvelles Tables (Non-Breaking)

**Objectif** : Préparer le schéma DB pour le multi-tenant sans casser le code existant.

**Actions** :

```sql
-- 1. Ajouter company_id aux tables existantes (nullable dans un premier temps)
ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE projects ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE issues ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE workflows ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE agent_sessions ADD COLUMN company_id UUID REFERENCES companies(id);
-- ... (toutes les 38 tables existantes)

-- 2. Créer les nouvelles tables B2B
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',  -- free, team, enterprise
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'contributor',  -- admin, manager, contributor, viewer
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  invited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index pour performance
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_issues_company ON issues(company_id);
CREATE INDEX idx_company_members_company ON company_members(company_id);
CREATE INDEX idx_company_members_user ON company_members(user_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
```

**Code** : Le code existant continue de fonctionner car `company_id` est nullable. Aucune query existante n'est cassée.

**Rollback Phase 1** :
```sql
-- Supprimer les index ajoutés
DROP INDEX IF EXISTS idx_users_company;
-- ... (tous les index)
-- Supprimer les colonnes ajoutées
ALTER TABLE users DROP COLUMN IF EXISTS company_id;
-- ... (toutes les tables)
-- Supprimer les nouvelles tables
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS company_members;
DROP TABLE IF EXISTS companies;
```

**Validation Phase 1** :
- Tous les tests existants passent (aucune régression)
- Les nouvelles tables existent et sont vides
- Les colonnes `company_id` sont présentes et nullable

---

#### 10.3 Phase 2 — Migration des Données Existantes

**Objectif** : Assigner tous les utilisateurs et données existants à une company par défaut ("Legacy Company").

**Actions** :

```sql
-- 1. Créer la company par défaut
INSERT INTO companies (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Legacy Company', 'legacy', 'team');

-- 2. Migrer les utilisateurs existants
INSERT INTO company_members (company_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'admin'
FROM users
WHERE company_id IS NULL;

UPDATE users SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 3. Migrer toutes les données existantes
UPDATE projects SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE issues SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE workflows SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE agent_sessions SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 4. Rendre company_id NOT NULL (après vérification que tout est migré)
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE issues ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE workflows ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE agent_sessions ALTER COLUMN company_id SET NOT NULL;
```

**Script de vérification pré-NOT NULL** :
```sql
-- Vérifier qu'aucune ligne n'a company_id = NULL
SELECT 'users' AS table_name, COUNT(*) AS null_count FROM users WHERE company_id IS NULL
UNION ALL
SELECT 'projects', COUNT(*) FROM projects WHERE company_id IS NULL
UNION ALL
SELECT 'issues', COUNT(*) FROM issues WHERE company_id IS NULL;
-- Résultat attendu : 0 pour toutes les tables
```

**Rollback Phase 2** :
```sql
-- Rendre nullable à nouveau
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;
-- ... (toutes les tables)
-- Supprimer les company_members créés
DELETE FROM company_members WHERE company_id = '00000000-0000-0000-0000-000000000001';
-- Remettre company_id à NULL
UPDATE users SET company_id = NULL WHERE company_id = '00000000-0000-0000-0000-000000000001';
-- ... (toutes les tables)
-- Supprimer la legacy company
DELETE FROM companies WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Validation Phase 2** :
- Tous les utilisateurs ont un `company_id`
- Tous les utilisateurs sont members de la Legacy Company avec rôle `admin`
- Toutes les données (projects, issues, workflows) ont un `company_id`
- L'application fonctionne normalement (tests E2E passent)

---

#### 10.4 Phase 3 — Activation du Row-Level Security (RLS) PostgreSQL

**Objectif** : Isolation tenant au niveau database. Chaque requête ne voit que les données de sa company.

**Actions** :

```sql
-- 1. Activer RLS sur chaque table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
-- ... (toutes les tables avec company_id)

-- 2. Créer les policies
-- Le contexte company_id est passé via SET LOCAL au début de chaque transaction
CREATE POLICY company_isolation ON users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_isolation ON projects
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_isolation ON issues
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- ... (toutes les tables)

-- 3. Policy superadmin pour les opérations cross-tenant (admin AlphaLuppi)
CREATE POLICY superadmin_bypass ON users
  USING (current_setting('app.is_superadmin', true)::boolean = true);

-- ... (toutes les tables)
```

**Middleware applicatif** :
```typescript
// Avant chaque requête DB, le middleware injecte le company_id
async function withTenantContext(companyId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_company_id = ${companyId}`);
    return fn();
  });
}
```

**Rollback Phase 3** :
```sql
-- Désactiver RLS (les policies restent mais ne s'appliquent plus)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ... (toutes les tables)
-- Optionnel : supprimer les policies
DROP POLICY IF EXISTS company_isolation ON users;
-- ...
```

**Validation Phase 3** :
- Test : un utilisateur de Company A ne voit PAS les données de Company B
- Test : le superadmin voit les données de toutes les companies
- Test : une requête sans `SET LOCAL` est rejetée (fail-safe)
- Load test : vérifier que RLS n'ajoute pas >5ms de latence par requête
- Tests E2E multi-company : créer 2 companies, vérifier isolation complète

---

#### 10.5 Phase 4 — Déploiement Multi-Tenant Complet

**Objectif** : Activer le multi-tenant en production avec onboarding de nouvelles companies.

**Actions** :
1. Déployer le code avec support multi-company (signup company, invitations, sélecteur company)
2. Activer les endpoints API multi-tenant (`POST /companies`, `POST /invitations`, etc.)
3. Configurer le middleware d'isolation tenant sur toutes les routes
4. Activer la feature flag `MULTI_TENANT=true` en production (progressive rollout)
5. Onboarder la première company externe (CBA) en parallèle de la Legacy Company

**Progressive rollout** :
```
Semaine 1 : Legacy Company uniquement (feature flag off)
Semaine 2 : CBA ajouté (feature flag on pour CBA seulement)
Semaine 3 : Monitoring, feedback, corrections
Semaine 4 : Feature flag on pour toutes les nouvelles companies
```

**Rollback Phase 4** :
- Feature flag `MULTI_TENANT=false` → retour au mode mono-company
- Les données des nouvelles companies restent en DB mais ne sont plus accessibles
- La Legacy Company continue de fonctionner normalement
- Aucune perte de données

**Validation Phase 4** :
- CBA onboardé avec 10+ utilisateurs sur 3+ rôles RBAC
- Isolation vérifiée : CBA ne voit pas les données Legacy, et vice versa
- Performance : aucune dégradation mesurable (P99 API <500ms)
- Audit trail : toutes les actions cross-company sont loggées
- Uptime pendant la migration : 100% (zero-downtime confirmé)

---

#### 10.6 Chronologie Migration

```
Phase 1 (Colonnes + Tables)     ████░░░░░░░░░░░░░░░░  Semaine 1
Phase 2 (Migration données)     ░░░░████░░░░░░░░░░░░  Semaine 2
Phase 3 (RLS)                   ░░░░░░░░████░░░░░░░░  Semaine 3
Phase 4 (Multi-tenant)          ░░░░░░░░░░░░████████  Semaines 4-5

Chaque ░ = période de stabilisation + tests
Chaque █ = travail actif
```

**Points de décision (go/no-go)** :
- Fin Phase 1 : tous les tests existants passent → go Phase 2
- Fin Phase 2 : 0 lignes avec `company_id` NULL + E2E passent → go Phase 3
- Fin Phase 3 : tests d'isolation passent + latence <5ms overhead → go Phase 4
- Fin Phase 4 : CBA onboardé + 1 semaine sans incident → déclaration multi-tenant stable

---

#### 10.7 Zero-Downtime Migration — Techniques

| Technique | Utilisée en | Détail |
|-----------|-------------|--------|
| **ADD COLUMN nullable** | Phase 1 | PostgreSQL ajoute une colonne nullable sans lock (métadonnées seulement) |
| **CREATE INDEX CONCURRENTLY** | Phase 1 | Index créé sans bloquer les écritures |
| **Backfill en batches** | Phase 2 | UPDATE par lots de 1000 lignes avec `LIMIT` pour ne pas saturer |
| **SET NOT NULL via constraint** | Phase 2 | `ADD CONSTRAINT ... NOT NULL NOT VALID` puis `VALIDATE CONSTRAINT` (non-bloquant) |
| **RLS toggle** | Phase 3 | `ENABLE/DISABLE ROW LEVEL SECURITY` est instantané |
| **Feature flag** | Phase 4 | Le code multi-tenant est déployé mais inactif, activé progressivement |
| **Rolling deployment** | Toutes | K8s RollingUpdate avec `maxUnavailable: 0` |

---


### 10.5 Migration Detaillee des Donnees B2B (Amelia)

#### 10.5.0 Stratégie de Migration

#### Phase 1 — Colonnes ajoutées, pas de breaking changes (~1 semaine)

**Objectif** : Toutes les modifications aux tables existantes. Zero downtime.

**Migrations** :
1. `ALTER TABLE companies ADD COLUMN tier text NOT NULL DEFAULT 'free'`
2. `ALTER TABLE companies ADD COLUMN sso_enabled boolean NOT NULL DEFAULT false`
3. `ALTER TABLE companies ADD COLUMN max_users integer NOT NULL DEFAULT 5`
4. `ALTER TABLE companies ADD COLUMN parent_company_id uuid REFERENCES companies(id)`
5. `ALTER TABLE company_memberships ADD COLUMN business_role text NOT NULL DEFAULT 'contributor'`
6. `ALTER TABLE agents ADD COLUMN container_profile_id uuid` (FK ajoutée après création de `container_profiles`)
7. `ALTER TABLE agents ADD COLUMN isolation_mode text NOT NULL DEFAULT 'process'`
8. `ALTER TABLE activity_log ADD COLUMN ip_address text`
9. `ALTER TABLE activity_log ADD COLUMN user_agent text`
10. `ALTER TABLE activity_log ADD COLUMN severity text NOT NULL DEFAULT 'info'`
11. Ajout index `activity_log_severity_idx`

**Rollback** : `ALTER TABLE ... DROP COLUMN` pour chaque colonne. Aucune donnée perdue car les colonnes ont des defaults.

**Risque** : Minimal. Toutes les colonnes ont des valeurs par défaut. Le code existant continue de fonctionner sans modification.

#### Phase 2 — Nouvelles tables, relations (~2 semaines)

**Objectif** : Créer les 10 nouvelles tables et établir les relations.

**Ordre de création** (respecte les dépendances FK) :
1. `container_profiles` (pas de FK vers nouvelles tables)
2. `container_instances` (FK → container_profiles)
3. `credential_proxy_rules` (FK → container_profiles, company_secrets)
4. `project_memberships` (FK → projects)
5. `automation_cursors` (FK → projects, agents)
6. `chat_channels` (FK → agents, heartbeat_runs, projects)
7. `chat_messages` (FK → chat_channels)
8. `audit_events` (pas de FK — immutable)
9. `sso_configurations` (FK → companies, company_secrets)
10. `import_jobs` (FK → companies)

**Post-création** :
- Ajout FK `agents.container_profile_id → container_profiles.id`
- Création TRIGGER immutabilité sur `audit_events`
- Ajout des 9 nouvelles PERMISSION_KEYS dans constants.ts

**Rollback** : `DROP TABLE` dans l'ordre inverse. Aucun impact sur les tables existantes.

#### Phase 3 — Migration scope JSONB (~1 semaine)

**Objectif** : Activer la lecture du scope JSONB dans `hasPermission()` et mettre à jour les 22 fichiers de routes.

**Étapes** :
1. Modifier `hasPermission()` dans `server/src/services/access.ts` (voir section 3.2)
2. Modifier `canUser()` pour accepter le `resourceScope` optionnel
3. Auditer les 22 fichiers de routes :
   - Routes avec contexte projet → passer `{ projectId }`
   - Routes company-wide → pas de scope (comportement existant préservé)
4. Peupler les `project_memberships` pour les membres existants (migration de données)
5. Migrer les grants existants sans scope → ils restent company-wide (backward compatible)

**Fichiers à modifier** :
- `server/src/services/access.ts` — core logic
- `server/src/routes/issues.ts` — projectId disponible
- `server/src/routes/agents.ts` — scopedToWorkspaceId → projectId
- `server/src/routes/workflows.ts` — projectId via workflowInstance
- `server/src/routes/stages.ts` — projectId via workflow
- `server/src/routes/projects.ts` — projectId direct
- `server/src/routes/goals.ts` — via project
- `server/src/routes/approvals.ts` — via agent/project
- `server/src/routes/costs.ts` — via project
- `server/src/routes/secrets.ts` — company-wide (pas de scope)
- `server/src/routes/dashboard.ts` — agrégé (pas de scope)
- `server/src/routes/activity.ts` — filtrage post-query par scope
- Autres : `authz.ts`, `access.ts`, `companies.ts`, `health.ts`, etc.

**Rollback** : Revert du code `hasPermission()` à la version sans scope. Les grants JSONB restent en base mais sont ignorés (comportement actuel).

#### Phase 4 — Données existantes (~1 semaine, parallélisable avec Phase 3)

**Objectif** : Migrer les données existantes vers le nouveau modèle.

**Étapes** :
1. **Promouvoir le créateur de chaque company en admin** :
   ```sql
   UPDATE company_memberships
   SET business_role = 'admin'
   WHERE id IN (
     SELECT cm.id FROM company_memberships cm
     JOIN companies c ON cm.company_id = c.id
     WHERE cm.principal_type = 'user'
     AND cm.created_at = (
       SELECT MIN(cm2.created_at) FROM company_memberships cm2
       WHERE cm2.company_id = cm.company_id AND cm2.principal_type = 'user'
     )
   );
   ```

2. **Créer des project_memberships pour les membres existants** :
   Les membres company-wide sans scope → accès à tous les projets (pas besoin de créer des entrées — le scope null = company-wide).

3. **Peupler les presets de permissions** :
   Pour chaque membre avec un `businessRole`, insérer les `principal_permission_grants` correspondant au preset du rôle (si pas déjà présents).

4. **Migrer activity_log → audit_events** :
   Copier les entrées critiques existantes dans `audit_events` pour rétention historique.

**Rollback** : Les données migrées sont additives (nouvelles lignes, nouvelles colonnes). Aucune suppression de données existantes.

---

#### Resume des Risques de Migration

| Phase | Risque | Mitigation |
|-------|--------|------------|
| Phase 1 | Aucun — colonnes avec defaults | ALTER TABLE est non-bloquant avec defaults |
| Phase 2 | Ordre FK | Script de migration avec ordre explicite |
| Phase 3 | Régression scope | Feature flag `ENABLE_SCOPE_CHECK=false` pendant la transition |
| Phase 4 | Données incohérentes | Transaction + validation post-migration |

#### Convention de Nommage des Migrations Drizzle

```
0001_add_company_tier_columns.sql
0002_add_membership_business_role.sql
0003_add_agent_container_columns.sql
0004_add_activity_log_columns.sql
0005_create_container_profiles.sql
0006_create_container_instances.sql
0007_create_credential_proxy_rules.sql
0008_create_project_memberships.sql
0009_create_automation_cursors.sql
0010_create_chat_channels.sql
0011_create_chat_messages.sql
0012_create_audit_events_with_triggers.sql
0013_create_sso_configurations.sql
0014_create_import_jobs.sql
0015_add_agent_container_profile_fk.sql
0016_seed_admin_roles.sql
0017_enable_scope_check.sql
```


---

## 11. Compliance Architecture

#### 11.11.1. Architecture RGPD — Implementation Technique

L'architecture RGPD de MnM doit garantir la conformité dès la conception (Privacy by Design, Article 25) tout en maintenant les performances et la cohérence du système d'orchestration d'agents IA. Chaque requirement réglementaire identifié dans le PRD est traduit ci-dessous en architecture technique concrète.

#### 11.1.1 REQ-REG-02 — Droit à l'Effacement (Article 17)

#### Cartographie des données utilisateur

Un utilisateur dans MnM génère des données dans **7 domaines** distincts qui doivent tous être couverts par le mécanisme d'effacement :

| Domaine | Tables concernées | Type de données | Stratégie |
|---------|------------------|-----------------|-----------|
| **Identité** | `user`, `account`, `session`, `verification` | Email, nom, hash mot de passe, tokens | Suppression complète |
| **Membership** | `company_memberships`, `instance_user_roles`, `principal_permission_grants` | Rôles, permissions, scope | Suppression complète |
| **Activité agents** | `agents` (créés par user), `agent_task_sessions`, `agent_runtime_state` | Configs, sessions, état runtime | Suppression si agent personnel, anonymisation si agent partagé |
| **Communication** | `chat_messages`, `chat_channels` | Messages de dialogue humain-agent | Anonymisation (remplacer userId par `DELETED_USER_<hash>`) |
| **Audit** | `audit_events`, `activity_log` | Traces d'actions | Anonymisation obligatoire (l'audit doit rester pour la conformité) |
| **Contenu projet** | `issues`, `issue_comments`, `issue_attachments` | Stories, commentaires, fichiers | Anonymisation de l'auteur, contenu conservé |
| **Savoir tacite** | Contextes d'agents, résultats intermédiaires dans `stage_instances` | Connaissances capturées | Anonymisation si lié à un user spécifique |

#### Architecture du service d'effacement

```
UserDeletionService
├── discover(userId)         → Inventaire complet des données dans les 7 domaines
├── preview(userId)          → Rapport prévisuel : ce qui sera supprimé vs anonymisé
├── execute(userId)          → Transaction distribuée d'effacement/anonymisation
├── verify(userId)           → Vérification post-suppression (scan exhaustif)
└── audit(userId, requestId) → Trace de la demande d'effacement dans l'audit log
```

**Règles d'implémentation :**

1. **Transaction atomique** : L'effacement s'exécute dans une transaction PostgreSQL. Si une étape échoue, tout est rollbacké. Aucun état intermédiaire n'est acceptable.

2. **Anonymisation vs suppression** : Les données d'audit et les contenus partagés (issues, commentaires) sont ANONYMISÉS (remplacement du userId par un identifiant pseudonymisé irréversible `DELETED_USER_<SHA256(userId + salt)>`), pas supprimés. Cela préserve l'intégrité de l'audit trail tout en respectant le droit à l'effacement.

3. **Délai 30 jours** : La demande est enregistrée immédiatement dans `audit_events` avec un statut `PENDING`. Un job planifié (cron) exécute l'effacement. Le délai de 30 jours inclut une période de grâce de 7 jours pendant laquelle l'utilisateur peut annuler sa demande.

4. **Vérification post-suppression** : Après exécution, le service lance un scan exhaustif sur toutes les tables pour confirmer qu'aucune référence directe au userId ne subsiste. Le résultat du scan est loggé dans l'audit.

5. **Agents en cours d'exécution** : Si l'utilisateur a des agents actifs au moment de la demande d'effacement, ceux-ci sont arrêtés proprement (kill+cleanup) avant l'effacement. Les résultats intermédiaires sont anonymisés et conservés uniquement si nécessaires au workflow en cours.

#### Table de suivi des demandes d'effacement

```sql
CREATE TABLE deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId TEXT NOT NULL REFERENCES "user"(id),
    companyId UUID NOT NULL REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'GRACE_PERIOD', 'EXECUTING', 'COMPLETED', 'CANCELLED', 'FAILED')),
    requestedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    graceDeadline TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    executedAt TIMESTAMPTZ,
    verifiedAt TIMESTAMPTZ,
    deletionReport JSONB, -- détail par domaine : nombre de lignes supprimées/anonymisées
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 11.1.2 REQ-REG-03 — Portabilité des Données (Article 20)

#### Périmètre de l'export

L'utilisateur peut exporter TOUTES ses données personnelles dans un format structuré et lisible par machine. L'export couvre :

| Catégorie | Données exportées | Format |
|-----------|------------------|--------|
| **Profil** | Nom, email, date de création, rôles | JSON |
| **Agents** | Configurations, rôles, historique d'exécution | JSON |
| **Messages** | Conversations chat avec agents | JSON/CSV |
| **Issues** | Stories créées/modifiées, commentaires | JSON/CSV |
| **Activité** | Log d'actions personnelles | CSV |
| **Consentements** | Historique des choix de consentement | JSON |

#### Architecture du service d'export

```
DataPortabilityService
├── buildManifest(userId)    → Liste de toutes les catégories exportables
├── export(userId, format)   → Génère l'archive (ZIP contenant JSON/CSV)
├── stream(userId, format)   → Export streaming pour gros volumes
└── notify(userId, downloadUrl) → Notification quand l'export est prêt
```

**API dédiée** : `POST /api/v1/users/:userId/data-export` avec authentification renforcée (re-saisie mot de passe ou 2FA). L'export est généré de manière asynchrone. L'utilisateur reçoit une notification avec un lien de téléchargement temporaire (expiration 24h, single-use).

**Délai** : L'export doit être disponible dans un délai de 72h maximum (cible : <1h pour les comptes standards, <24h pour les comptes avec historique volumineux).

#### 11.1.3 REQ-REG-04 — Consentement Granulaire

#### Modèle de consentement

Le consentement dans MnM est granulaire : l'utilisateur consent séparément à chaque type de traitement IA. Le retrait d'un consentement spécifique désactive uniquement le traitement concerné, pas l'ensemble de la plateforme.

```sql
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    userId TEXT NOT NULL REFERENCES "user"(id),
    companyId UUID NOT NULL REFERENCES companies(id),
    consentType TEXT NOT NULL CHECK (consentType IN (
        'AI_PROCESSING',        -- Traitement par agents IA
        'A2A_COMMUNICATION',    -- Communication inter-agents
        'TACIT_KNOWLEDGE',      -- Capture du savoir tacite
        'ANALYTICS_AGGREGATED', -- Métriques agrégées (Vérité #20)
        'LLM_EXTERNAL',         -- Envoi de données vers un LLM externe (cloud)
        'ONBOARDING_ORAL'       -- Mode oral (transcription voix)
    )),
    granted BOOLEAN NOT NULL,
    grantedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revokedAt TIMESTAMPTZ,
    ipAddress INET,
    userAgent TEXT,
    version INTEGER NOT NULL DEFAULT 1, -- version de la politique de consentement
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_consents_user ON user_consents(userId, companyId, consentType);
```

#### Mécanisme de retrait

Le retrait du consentement est effectif immédiatement :

1. `AI_PROCESSING` retiré : Les agents de l'utilisateur sont suspendus. Les workflows en cours sont mis en pause avec notification au manager.
2. `A2A_COMMUNICATION` retiré : Les requêtes inter-agents impliquant cet utilisateur sont bloquées (403).
3. `TACIT_KNOWLEDGE` retiré : Le savoir tacite déjà capturé reste (base légale : intérêt légitime de l'entreprise), mais aucune nouvelle capture n'est effectuée pour cet utilisateur.
4. `LLM_EXTERNAL` retiré : Les agents de l'utilisateur basculent sur le LLM on-premise/EU. Si aucun n'est configuré, les agents sont suspendus.

#### UI de gestion du consentement

Page accessible depuis le profil utilisateur. Pour chaque type de consentement :
- Description claire en langage non-technique de ce que le traitement implique
- Toggle on/off avec confirmation modale pour le retrait
- Historique des changements (date, action)
- Lien vers la politique de confidentialité correspondante

#### 11.1.4 REQ-REG-05 — Privacy by Design

#### Chiffrement

| Couche | Mécanisme | Détail |
|--------|-----------|--------|
| **In transit** | TLS 1.3 | Obligatoire sur toutes les connexions HTTP et WebSocket. HSTS activé. |
| **At rest** | AES-256 | PostgreSQL avec chiffrement transparent du tablespace (pgcrypto ou chiffrement disque). Les secrets agents sont déjà chiffrés via les 4 providers (local, AWS, GCP, Vault). |
| **Credentials** | Credential proxy | Les clés API ne sont jamais stockées en clair dans les containers. Le proxy HTTP injecte les credentials à la volée sans les exposer aux agents (REQ-CONT-02). |

#### Pseudonymisation des données agrégées

Les dashboards management (REQ-OBS-03) affichent exclusivement des métriques agrégées. L'architecture EMPÊCHE techniquement l'accès aux données individuelles dans les vues agrégées :

```
AggregationService
├── computeMetrics(companyId, period) → Métriques agrégées par équipe/projet
│   ├── Minimum 5 contributeurs par agrégation (k-anonymity, k=5)
│   ├── Si <5 contributeurs → afficher "Données insuffisantes"
│   └── JAMAIS de drill-down vers l'individuel
├── pseudonymize(dataset)             → Remplacement des identifiants par des pseudonymes
└── validateKAnonymity(dataset, k=5)  → Vérification pré-affichage
```

#### Collecte minimale

- Seules les données strictement nécessaires au fonctionnement de chaque feature sont collectées
- Les logs de debug sont purgés après 30 jours
- Les sessions expirées sont supprimées après 90 jours
- Les containers éphémères sont détruits immédiatement après usage (`--rm`) — aucune persistance de données dans le container

---

#### 11.11.2. Architecture Audit Trail

L'audit trail est le pilier central de la conformité enterprise de MnM. Il doit être immutable, performant, et exploitable.

#### 11.2.1 REQ-AUDIT-01 — Table audit_events Immutable

#### Structure de la table

```sql
CREATE TABLE audit_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    companyId UUID NOT NULL,
    actorType TEXT NOT NULL CHECK (actorType IN ('USER', 'AGENT', 'SYSTEM')),
    actorId TEXT NOT NULL,           -- userId ou agentId
    action TEXT NOT NULL,            -- ex: 'WORKFLOW_STARTED', 'ISSUE_UPDATED', 'AGENT_KILLED'
    category TEXT NOT NULL CHECK (category IN (
        'AUTH', 'RBAC', 'WORKFLOW', 'AGENT', 'A2A', 'AUDIT',
        'DATA', 'CONSENT', 'IMPORT', 'CONTAINER', 'SYSTEM'
    )),
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
    resourceType TEXT,               -- 'issue', 'agent', 'workflow_instance', etc.
    resourceId TEXT,                 -- ID de la ressource affectée
    workflowInstanceId UUID,         -- si action dans un workflow
    stageInstanceId UUID,            -- si action dans une étape spécifique
    details JSONB NOT NULL DEFAULT '{}',  -- payload libre (avant/après, paramètres)
    ipAddress INET,
    userAgent TEXT,
    previousHash TEXT,               -- hash de l'événement précédent (chaîne)
    eventHash TEXT NOT NULL,          -- SHA-256 de cet événement
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, createdAt)      -- clé composite pour le partitionnement
) PARTITION BY RANGE (createdAt);
```

#### Partitionnement mensuel

```sql
-- Création automatique des partitions (job cron mensuel)
CREATE TABLE audit_events_2026_03 PARTITION OF audit_events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit_events_2026_04 PARTITION OF audit_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- Index sur les colonnes les plus fréquemment filtrées
CREATE INDEX idx_audit_company_date ON audit_events (companyId, createdAt DESC);
CREATE INDEX idx_audit_actor ON audit_events (actorId, createdAt DESC);
CREATE INDEX idx_audit_action ON audit_events (action, createdAt DESC);
CREATE INDEX idx_audit_category ON audit_events (category, createdAt DESC);
CREATE INDEX idx_audit_severity ON audit_events (severity) WHERE severity IN ('WARN', 'ERROR', 'CRITICAL');
CREATE INDEX idx_audit_workflow ON audit_events (workflowInstanceId) WHERE workflowInstanceId IS NOT NULL;
CREATE INDEX idx_audit_resource ON audit_events (resourceType, resourceId);
```

#### Immutabilité — TRIGGER deny UPDATE/DELETE

```sql
-- Empêcher toute modification ou suppression
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Les événements d''audit sont immutables. UPDATE et DELETE sont interdits sur audit_events.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();
```

**Note critique** : Le superuser PostgreSQL peut contourner les triggers. En production, le rôle applicatif (`mnm_app`) ne doit JAMAIS être superuser. Un rôle séparé `mnm_audit_admin` est créé pour les opérations de maintenance exceptionnelles (purge après rétention de 3 ans), avec double approbation requise.

#### Rétention 3 ans minimum

- Les partitions de plus de 3 ans sont archivées vers un stockage froid (S3/GCS/stockage on-premise) avant suppression de la partition active
- Un job cron mensuel vérifie les partitions éligibles à l'archivage
- L'archive est chiffrée (AES-256) et signée (HMAC-SHA256) pour garantir l'intégrité
- Les archives restent consultables via une API dédiée (`GET /api/v1/audit/archive`) avec latence acceptable (<5s)

#### 11.2.2 REQ-AUDIT-02 — Non-Répudiation par Hash Chain

#### Mécanisme de chaînage cryptographique

Chaque événement d'audit est lié au précédent par un hash SHA-256, formant une chaîne immutable. Toute modification d'un événement passé brise la chaîne et est détectable.

```
AuditHashChainService
├── computeHash(event)      → SHA-256(companyId + actorId + action + details + previousHash + createdAt)
├── getLastHash(companyId)  → Récupère le hash du dernier événement de la company
├── verify(companyId, from, to) → Vérifie l'intégrité de la chaîne sur une période
└── alert(companyId, brokenAt) → Alerte si chaîne brisée
```

**Algorithme de hash** :

```
eventHash = SHA-256(
    companyId + '|' +
    actorType + '|' +
    actorId + '|' +
    action + '|' +
    JSON.stringify(details) + '|' +
    previousHash + '|' +
    createdAt.toISOString()
)
```

**Initialisation** : Le premier événement d'une company utilise `previousHash = SHA-256('GENESIS_' + companyId)`.

**Vérification** : Un job quotidien vérifie l'intégrité de la chaîne des dernières 24h pour chaque company. Un job hebdomadaire vérifie la chaîne complète. Toute rupture déclenche une alerte CRITICAL.

**Concurrence** : Pour éviter les conflits de hash en cas d'événements simultanés, un lock advisory PostgreSQL par company est utilisé lors de l'insertion. Cela sérialise les insertions par company sans impacter les autres tenants.

```sql
-- Lock advisory par company pour sérialiser les insertions
SELECT pg_advisory_xact_lock(hashtext(companyId::text));
```

#### 11.2.3 REQ-AUDIT-03 — Interface Read-Only de Consultation

#### API de consultation

```
GET /api/v1/audit/events
    ?companyId=<uuid>
    &actorId=<text>          -- filtre par acteur
    &actorType=USER|AGENT|SYSTEM
    &action=<text>           -- filtre par action
    &category=<text>         -- AUTH, RBAC, WORKFLOW, etc.
    &severity=WARN,ERROR,CRITICAL  -- filtre multi-valeurs
    &resourceType=<text>     -- issue, agent, workflow_instance
    &resourceId=<text>
    &workflowInstanceId=<uuid>
    &from=<iso-datetime>     -- période début
    &to=<iso-datetime>       -- période fin
    &page=<int>              -- pagination
    &limit=<int>             -- max 100
    &sort=createdAt:desc     -- tri
```

**Permissions requises** : Seuls les utilisateurs avec le rôle `ADMIN` ou la permission `AUDIT_READ` peuvent consulter l'audit log. Les `MANAGER` voient uniquement les événements de leur scope (projets assignés). Les `CONTRIBUTOR` et `VIEWER` n'ont aucun accès à l'audit log.

#### Export

- `GET /api/v1/audit/export?format=csv|json` avec les mêmes filtres
- Export asynchrone pour les gros volumes (>10 000 événements) : le serveur génère le fichier et notifie l'utilisateur quand il est prêt
- Les exports sont eux-mêmes loggés dans l'audit (action `AUDIT_EXPORTED`)

#### Performance

- Le partitionnement mensuel permet de limiter les scans aux partitions pertinentes
- Les index composites couvrent les patterns de requête les plus fréquents
- Pagination obligatoire (max 100 résultats par page)
- Cache de 30s sur les requêtes identiques (invalidé sur nouvel événement)

---

#### 11.11.3. Data Residency

#### 11.3.1 REQ-RESID-01 — On-Premise Complet & Choix Région SaaS

#### Architecture de déploiement

MnM supporte trois modes de déploiement, chacun avec des garanties de résidence des données :

| Mode | Résidence données | Cible |
|------|------------------|-------|
| **On-Premise** | 100% chez le client, zero data exfiltration | Secteurs réglementés (banque, santé, défense) |
| **SaaS EU** | Hébergé en EU (France/Allemagne), données dans la région choisie | Entreprises EU standard |
| **SaaS Multi-Région** | Choix de la région par le client (EU, US, APAC) | Entreprises internationales |

#### Zero Data Exfiltration (On-Premise)

En mode on-premise, l'architecture garantit qu'AUCUNE donnée ne quitte l'infrastructure du client :

1. **Pas de télémétrie** : Toutes les métriques d'usage sont désactivées. Pas de phone-home, pas de check de licence vers un serveur externe.
2. **LLM local** : Le provider LLM est configuré pour utiliser un modèle hébergé localement (Ollama, vLLM, ou API compatible OpenAI locale).
3. **Mises à jour offline** : Les mises à jour sont distribuées sous forme de packages signés (air-gapped deployment).
4. **DNS/NTP seuls** : Les seules connexions réseau sortantes autorisées sont DNS et NTP.
5. **Audit de conformité** : Un rapport de conformité réseau est générable à la demande, listant toutes les connexions sortantes tentées (et bloquées).

#### Configuration par Company

```sql
-- Extension de la table companies pour la résidence
ALTER TABLE companies ADD COLUMN dataRegion TEXT DEFAULT 'EU_WEST'
    CHECK (dataRegion IN ('EU_WEST', 'EU_CENTRAL', 'US_EAST', 'US_WEST', 'APAC', 'ON_PREMISE'));
ALTER TABLE companies ADD COLUMN llmProvider TEXT DEFAULT 'OPENAI'
    CHECK (llmProvider IN ('OPENAI', 'ANTHROPIC', 'AZURE_OPENAI', 'OLLAMA', 'VLLM', 'CUSTOM'));
ALTER TABLE companies ADD COLUMN llmEndpoint TEXT; -- URL du endpoint LLM (pour custom/on-premise)
ALTER TABLE companies ADD COLUMN llmRegion TEXT;   -- Région du LLM (pour cloud providers)
```

#### 11.3.2 REQ-RESID-02 — Support LLM EU/On-Premise

#### Abstraction du provider LLM

L'architecture existante de MnM utilise déjà un adapter pattern avec 8 types d'adapters. L'abstraction du provider LLM s'inscrit naturellement dans ce pattern :

```
LLMProviderAbstraction
├── LLMProvider (interface)
│   ├── chat(messages, options) → CompletionResponse
│   ├── stream(messages, options) → AsyncIterable<Chunk>
│   └── healthCheck() → ProviderStatus
├── OpenAIProvider (implements LLMProvider)
├── AnthropicProvider (implements LLMProvider)
├── AzureOpenAIProvider (implements LLMProvider)
├── OllamaProvider (implements LLMProvider) -- on-premise
├── VLLMProvider (implements LLMProvider)   -- on-premise
└── CustomProvider (implements LLMProvider) -- endpoint configurable
```

#### Routing par Company

Quand un agent est lancé, le système résout le provider LLM à utiliser selon la configuration de la company :

```
resolveProvider(companyId) {
    company = getCompany(companyId)

    // Vérifier le consentement LLM_EXTERNAL si provider cloud
    if (company.llmProvider in ['OPENAI', 'ANTHROPIC', 'AZURE_OPENAI']) {
        if (!hasConsent(agent.userId, 'LLM_EXTERNAL')) {
            // Fallback vers on-premise ou erreur
            return fallbackToOnPremise(company) || throw ConsentRequired
        }
    }

    // Vérifier la cohérence résidence/provider
    if (company.dataRegion === 'ON_PREMISE' && isCloudProvider(company.llmProvider)) {
        throw DataResidencyViolation('On-premise company cannot use cloud LLM provider')
    }

    return createProvider(company.llmProvider, {
        endpoint: company.llmEndpoint,
        region: company.llmRegion
    })
}
```

**Contrainte architecturale** : En mode `ON_PREMISE`, le système REFUSE de démarrer si le `llmProvider` est configuré sur un provider cloud. Ce contrôle est effectué au boot et à chaque changement de configuration.

---

#### 11.11.4. AI Act Compliance

#### 11.4.1 REQ-IA-01 — Pas de Décision Exclusivement Automatique

#### Le curseur d'automatisation comme garantie architecturale

L'architecture du curseur d'automatisation (REQ-DUAL-01 à 04) garantit structurellement la conformité avec l'Article 22 du RGPD et l'AI Act :

```
Positions du curseur :
├── MANUEL    → L'humain fait tout, l'agent observe et suggère
├── ASSISTE   → L'agent propose, l'humain valide avant exécution
└── AUTOMATIQUE → L'agent exécute, l'humain est notifié et peut intervenir
```

**Garantie architecturale** : Même en mode AUTOMATIQUE, le human-in-the-loop n'est jamais supprimé. L'humain :
1. Est NOTIFIE de chaque action (temps réel via WebSocket)
2. Peut INTERROMPRE à tout moment (commande "Stop" → arrêt immédiat + rollback)
3. Peut CONTESTER toute décision post-facto (interface de review avec explication)
4. Conserve le CONTROLE via le curseur (peut réduire le niveau d'automatisation à tout moment)

**Plafond hiérarchique** : Le CEO/CTO peut imposer un plafond qui empêche tout utilisateur de passer en mode AUTOMATIQUE pour certaines catégories de tâches. Ce plafond est un invariant de l'architecture (INV-05).

#### Explicabilité des décisions

Pour chaque action d'un agent, MnM fournit trois niveaux d'explicabilité :

| Niveau | Contenu | Audience |
|--------|---------|----------|
| **Résumé LLM** | Explication en langage naturel de ce que l'agent a fait et pourquoi | Tous les utilisateurs |
| **Audit trail** | Trace technique complète : prompt envoyé, réponse LLM, action exécutée, résultat | Admin, CTO |
| **Replay** | Capacité à rejouer exactement les mêmes conditions pour reproduire le comportement | Debug, investigation |

#### 11.4.2 REQ-IA-02 — Classification des Agents par Niveau de Risque

#### Table de classification

L'AI Act européen (entré en vigueur en 2024) impose une classification des systèmes IA par niveau de risque. MnM classe ses agents selon cette taxonomie :

```sql
CREATE TABLE agent_risk_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companyId UUID NOT NULL REFERENCES companies(id),
    agentRole TEXT NOT NULL, -- rôle de l'agent (ex: 'code_executor', 'brainstorm', 'reporting')
    riskLevel TEXT NOT NULL CHECK (riskLevel IN (
        'MINIMAL',     -- Agent de reporting, résumé (lecture seule)
        'LIMITED',     -- Agent de brainstorm, suggestion (pas d'exécution)
        'HIGH',        -- Agent d'exécution de code, modification de données
        'UNACCEPTABLE' -- Jamais utilisé dans MnM (scoring social, surveillance, etc.)
    )),
    obligations JSONB NOT NULL DEFAULT '{}',
    -- Obligations proportionnelles au niveau de risque :
    -- MINIMAL: log basique
    -- LIMITED: log + explicabilité
    -- HIGH: log + explicabilité + validation humaine obligatoire + audit renforcé
    maxAutomationLevel TEXT NOT NULL DEFAULT 'MANUAL' CHECK (maxAutomationLevel IN ('MANUAL', 'ASSISTED', 'AUTOMATIC')),
    requiresHumanValidation BOOLEAN NOT NULL DEFAULT true,
    requiresExplainability BOOLEAN NOT NULL DEFAULT true,
    requiresAuditReinforced BOOLEAN NOT NULL DEFAULT false,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Mapping des types d'agents MnM vers les niveaux de risque

| Type d'agent | Niveau de risque | Justification | Obligations |
|-------------|-----------------|---------------|-------------|
| Agent de reporting | MINIMAL | Lecture seule, agrégation | Log basique |
| Agent de brainstorm | LIMITED | Suggestions sans exécution | Log + explicabilité |
| Agent d'onboarding | LIMITED | Guide conversationnel, pas de mutation | Log + explicabilité |
| Agent connecteur | LIMITED | Interactions systèmes externes (lecture) | Log + explicabilité |
| Agent inter-rôle (A2A) | HIGH | Proxy entre agents, potentiel d'action transverse | Log + explicabilité + validation humaine + audit renforcé |
| Agent d'exécution | HIGH | Modification de code, données, infrastructure | Log + explicabilité + validation humaine + audit renforcé |

**Règle architecturale** : Un agent classé HIGH ne peut JAMAIS fonctionner en mode AUTOMATIQUE sans que la company ait explicitement configuré et accepté ce niveau. Par défaut, les agents HIGH sont en mode ASSISTE maximum.

#### Obligations proportionnelles

```
RiskComplianceEnforcer
├── classify(agent)           → Détermine le niveau de risque basé sur le rôle et les capacités
├── enforce(agent, action)    → Vérifie que l'action respecte les obligations du niveau
│   ├── MINIMAL  → logAction()
│   ├── LIMITED  → logAction() + generateExplanation()
│   └── HIGH     → logAction() + generateExplanation() + requireHumanApproval() + auditReinforced()
└── report(companyId)         → Rapport de conformité AI Act par company
```

---

#### 11.11.5. Contraintes Business sur l'Architecture

#### 11.5.1 Métriques Agrégées Uniquement (Vérité #20)

> *"Les dashboard management ne montrent JAMAIS de données individuelles. Pas de flicage."*

Cette vérité fondatrice des cofondateurs impose une contrainte architecturale forte : le système doit EMPÊCHER techniquement le drill-down individuel, pas simplement le masquer dans l'UI.

#### Architecture d'empêchement

1. **Service d'agrégation dédié** : Les dashboards management passent par un `AggregationService` qui ne retourne JAMAIS de données brutes individuelles. Il n'existe aucune API de dashboard qui accepte un `userId` en paramètre de filtre.

2. **K-anonymity (k=5)** : Toute agrégation portant sur moins de 5 contributeurs distincts est remplacée par "Données insuffisantes". Cela empêche la déduction par élimination.

3. **Separation of concerns dans les APIs** :
   - `/api/v1/dashboard/team/*` — Métriques agrégées par équipe/projet. Jamais de userId dans la réponse.
   - `/api/v1/dashboard/personal/*` — Métriques personnelles visibles uniquement par l'utilisateur lui-même.
   - Il n'existe PAS de `/api/v1/dashboard/user/:userId` pour les managers.

4. **PostgreSQL Views** : Les vues matérialisées pour les dashboards management sont construites avec `GROUP BY` obligatoire sur `projectId` ou `teamId`. Aucune vue ne permet un `GROUP BY userId` accessible aux managers.

```sql
-- Vue matérialisée pour le dashboard management (exemple)
CREATE MATERIALIZED VIEW mv_team_productivity AS
SELECT
    wi.companyId,
    p.id AS projectId,
    p.name AS projectName,
    DATE_TRUNC('week', wi.completedAt) AS week,
    COUNT(DISTINCT wi.id) AS workflowsCompleted,
    AVG(EXTRACT(EPOCH FROM (wi.completedAt - wi.startedAt))) AS avgDurationSeconds,
    COUNT(DISTINCT CASE WHEN drift.id IS NOT NULL THEN wi.id END) AS workflowsWithDrift
FROM workflow_instances wi
JOIN projects p ON wi.projectId = p.id
LEFT JOIN audit_events drift ON drift.workflowInstanceId = wi.id AND drift.action = 'DRIFT_DETECTED'
WHERE wi.status = 'COMPLETED'
GROUP BY wi.companyId, p.id, p.name, DATE_TRUNC('week', wi.completedAt)
HAVING COUNT(DISTINCT wi.assigneeId) >= 5;  -- k-anonymity
```

#### 11.5.2 Elevation, pas Remplacement

> *"L'automatisation est présentée comme une élévation du rôle (de producteur à validateur), jamais comme un remplacement."*

#### Contrainte sur le curseur d'automatisation

L'architecture du curseur rend le remplacement structurellement impossible :

1. **Pas de position "Full Auto sans humain"** : Le curseur a 3 positions (Manuel, Assisté, Automatique), mais même en AUTOMATIQUE, l'humain reste dans la boucle (notifié, peut intervenir, peut contester). Il n'existe PAS de position "Autonomous" où l'humain serait exclu.

2. **Rôle minimum requis** : Pour qu'un workflow s'exécute, il DOIT y avoir un `assigneeUserId` humain associé. Un agent ne peut pas exécuter un workflow sans propriétaire humain. Si le propriétaire humain est supprimé (départ), le workflow est suspendu jusqu'à réassignation.

3. **Metrics de valeur** : Le dashboard personnel montre la VALEUR AJOUTEE par l'automatisation (temps économisé, qualité améliorée), pas la quantité de travail remplacée. Le vocabulaire dans l'UI utilise systématiquement "assisté par", "augmenté par", jamais "remplacé par".

#### 11.5.3 Open Source Compatible — Separation Core OSS / Features Enterprise

#### Architecture de séparation

La séparation entre le core open source et les features enterprise est architecturale, pas juste un toggle :

```
mnm/
├── packages/
│   ├── core/              -- OSS : orchestrateur, workflows, observabilité basique
│   │   ├── workflow-engine/
│   │   ├── agent-runtime/
│   │   ├── basic-audit/    -- activity_log (audit basique)
│   │   └── permissions/    -- RBAC basique (admin/member)
│   ├── enterprise/        -- Licence enterprise uniquement
│   │   ├── audit-chain/    -- Hash chain, rétention 3 ans, export
│   │   ├── sso/           -- SAML/OIDC
│   │   ├── compliance/    -- RGPD (effacement, portabilité, consentement)
│   │   ├── data-residency/ -- Multi-région, on-premise config
│   │   ├── advanced-rbac/  -- Scoping projet, 15 permission keys
│   │   └── ai-act/        -- Classification risque, rapport conformité
│   └── shared/            -- Types partagés, utilitaires
```

**Règle de dépendance** : `core` ne dépend JAMAIS de `enterprise`. `enterprise` dépend de `core` et étend ses interfaces via des plugins/hooks. Le core fonctionne de manière autonome sans le package enterprise.

**Feature detection** : Au runtime, le système détecte la présence du package `enterprise` et active les features correspondantes. Sans le package, le système fonctionne en mode OSS avec des fallbacks gracieux :
- Pas de hash chain → audit basique sans chaînage
- Pas de SSO → auth email/password uniquement
- Pas de compliance → pas de gestion de consentement granulaire
- Pas de data residency → déploiement single-region par défaut

---

### Synthèse — Matrice de Traçabilité Compliance

| Requirement PRD | Section Architecture | Priorité | Statut |
|----------------|---------------------|----------|--------|
| REQ-REG-02 (Effacement) | 1.1 — UserDeletionService | P1 | Architecturé |
| REQ-REG-03 (Portabilité) | 1.2 — DataPortabilityService | P2 | Architecturé |
| REQ-REG-04 (Consentement) | 1.3 — user_consents + mécanisme retrait | P1 | Architecturé |
| REQ-REG-05 (Privacy by Design) | 1.4 — Chiffrement, pseudonymisation, collecte minimale | P1 | Architecturé |
| REQ-AUDIT-01 (Log immutable) | 2.1 — audit_events partitionnée + TRIGGER deny | P1 | Architecturé |
| REQ-AUDIT-02 (Hash chain) | 2.2 — SHA-256 chaînage + vérification | P2 | Architecturé |
| REQ-AUDIT-03 (Interface read-only) | 2.3 — API consultation + export | P1 | Architecturé |
| REQ-RESID-01 (On-premise + région) | 3.1 — 3 modes déploiement, zero exfiltration | P1 | Architecturé |
| REQ-RESID-02 (LLM EU/on-premise) | 3.2 — Abstraction provider, routing par company | P2 | Architecturé |
| REQ-IA-01 (Pas de décision auto) | 4.1 — Curseur + human-in-the-loop | P1 | Architecturé |
| REQ-IA-02 (Classification risque) | 4.2 — agent_risk_classifications + obligations | P2 | Architecturé |
| C-01 (Métriques agrégées) | 5.1 — AggregationService + k-anonymity | P1 | Architecturé |
| C-02 (Élévation, pas remplacement) | 5.2 — Contrainte curseur + assigneeUserId requis | P0 | Architecturé |

---


---

## Annexes

### Fichiers Impactes (Winston)

#### Recapitulatif des Fichiers Impactes

### Fichiers a Modifier (existants)

| Fichier | Modification | ADR |
|---------|-------------|-----|
| `packages/shared/src/constants.ts` | +9 permission keys (15 total) | ADR-002 |
| `packages/db/src/schema/workflow_templates.ts` | Enrichir `WorkflowStageTemplateDef` | ADR-003 |
| `packages/db/src/schema/companies.ts` | +tier, ssoEnabled, maxUsers, parentCompanyId | ADR-001 |
| `packages/db/src/schema/company_memberships.ts` | +businessRole | ADR-002 |
| `packages/db/src/schema/agents.ts` | +containerProfileId, isolationMode | ADR-001 |
| `packages/db/src/schema/activity_log.ts` | +ipAddress, userAgent, severity | ADR-002 |
| `server/src/services/access.ts` | hasPermission() + scope JSONB, canUser() | ADR-002 |
| `server/src/realtime/live-events-ws.ts` | +chat bidirectionnel | ADR-003 |
| `packages/adapter-utils/src/server-utils.ts` | stdin pipe au lieu de "ignore" | ADR-003 |
| `server/src/routes/*.ts` (22 fichiers) | Passer scope a canUser() | ADR-002 |

### Fichiers a Creer (nouveaux)

| Fichier | Description | ADR |
|---------|-------------|-----|
| `packages/shared/src/types/rbac.ts` | Types RBAC | ADR-002 |
| `packages/db/src/schema/project_memberships.ts` | Table T1 | ADR-001 |
| `packages/db/src/schema/audit_events.ts` | Table T8 (partitioned) | ADR-001 |
| `packages/db/src/schema/sso_configurations.ts` | Table T9 | ADR-002 |
| `packages/db/src/schema/automation_cursors.ts` | Table T2 | ADR-003 |
| `server/src/services/workflow-enforcer.ts` | State machine | ADR-003 |
| `server/src/services/role-presets.ts` | Presets RBAC | ADR-002 |
| `server/src/services/sso-manager.ts` | Gestion SSO | ADR-002 |
| Migration SQL RLS | Politiques Row-Level Security | ADR-001 |

---

### Annexe — Checklist de Déploiement Production

### Pré-déploiement
- [ ] Tests unitaires passent (>80% couverture)
- [ ] Tests intégration passent (routes API, RBAC, isolation)
- [ ] Tests E2E Cypress passent (7 smoke tests)
- [ ] Load test k6 passé (cibles NFR atteintes)
- [ ] Migrations SQL réversibles et testées
- [ ] Images Docker scannées (Trivy) — 0 vulnérabilité critique
- [ ] Secrets rotés depuis le dernier déploiement
- [ ] Changelog rédigé

### Déploiement
- [ ] Backup PostgreSQL pré-déploiement
- [ ] Helm upgrade `--atomic`
- [ ] Canary 10% → monitoring 15 min
- [ ] Canary 50% → monitoring 15 min
- [ ] Rollout 100%
- [ ] Smoke tests post-déploiement automatisés
- [ ] Vérification health checks OK

### Post-déploiement
- [ ] Monitoring Grafana : aucune anomalie latence/erreur
- [ ] Logs : aucune erreur inattendue
- [ ] WebSocket : connexions stables
- [ ] Notification équipe : deploy OK
- [ ] Tag git créé

---


---

*Architecture B2B MnM v2.0 — Document fusionne complet — 7 contributeurs — 8 ADRs, schema DB (48 tables), API design (~30 endpoints), securite (6 couches), test (7 QG), deploiement (3 modes), compliance (13 requirements).*
