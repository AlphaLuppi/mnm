# Architecture B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 1.0 | **Date** : 2026-03-14 | **Statut** : Final
> **Auteur** : Winston (Architecte Lead)
> **Sources** : PRD B2B v1.0, UX Design B2B v1.0, Nanoclaw Research, Code existant (38 tables, 31 services, 22 routes, 6 adapter packages)

---

## Table des Matieres

1. [Architecture Overview](#1-architecture-overview)
2. [Structure Monorepo](#2-structure-monorepo)
3. [ADR-001 : Multi-tenant](#3-adr-001--multi-tenant)
4. [ADR-002 : Auth (Better Auth + RBAC + SSO)](#4-adr-002--auth-better-auth--rbac--sso)
5. [ADR-003 : Orchestrateur Deterministe](#5-adr-003--orchestrateur-deterministe)

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

## 3. ADR-001 : Multi-tenant

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

## 4. ADR-002 : Auth (Better Auth + RBAC + SSO)

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

## 5. ADR-003 : Orchestrateur Deterministe

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

## Annexe : Recapitulatif des Fichiers Impactes

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

*Architecture B2B MnM v1.0 — ~4500 mots — Section 1 (Overview, Monorepo, ADRs 1-3)*
*Auteur : Winston, Architecte Lead*
*Prochaines sections : ADRs 4-8 (Container, Chat, A2A, Observabilite, Compaction), Database Schema Changes, Security Architecture*
