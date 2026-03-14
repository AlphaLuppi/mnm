# PRD Section 2 — Domain Model, Faisabilité Technique & NFRs

*Par Winston l'Architecte 🏗️* | Task #2 | 2026-03-13

---

## 1. Domain Model Technique Détaillé

### 1.1 Inventaire du schéma existant (38 tables)

**Domaine Auth & Identity (4 tables)** : `user`, `session`, `account`, `verification`

**Domaine Tenant & Access (6 tables)** : `companies`, `company_memberships`, `instance_user_roles`, `principal_permission_grants`, `invites`, `join_requests`

**Domaine Agents (6 tables)** : `agents` (11 rôles, 7 statuts, 8 adapter types), `agent_api_keys`, `agent_runtime_state`, `agent_task_sessions`, `agent_config_revisions`, `agent_wakeup_requests`

**Domaine Project Management (9 tables)** : `projects`, `project_workspaces`, `project_goals`, `goals`, `issues`, `issue_labels`, `issue_comments`, `issue_read_states`, `issue_attachments`

**Domaine Workflow (3 tables)** : `workflow_templates`, `workflow_instances`, `stage_instances`

**Domaine Execution & Observabilité (4 tables)** : `heartbeat_runs`, `heartbeat_run_events`, `cost_events`, `activity_log`

**Domaine Secrets (2 tables)** : `company_secrets`, `company_secret_versions`

**Autres (4 tables)** : `approvals`, `approval_comments`, `assets`, `inbox_dismissals`

### 1.2 Diagramme ER Simplifié

```
                    ┌──────────────┐
                    │  user (auth) │
                    │  PK: id(text)│
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │ 1:N            │ 1:N            │ 1:N
          ▼                ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐
   │   session    │ │   account    │ │instance_user_    │
   │              │ │   (OAuth)    │ │roles             │
   └──────────────┘ └──────────────┘ └─────────────────┘
          │
          │ N:M (via company_memberships)
          ▼
   ┌──────────────┐ 1:N  ┌──────────────┐ 1:N  ┌──────────────┐
   │  companies   │─────▶│   projects   │─────▶│project_      │
   │              │      │              │      │workspaces    │
   └──────┬───────┘      └──────┬───────┘      └──────────────┘
          │                     │
          │ 1:N                 │ 1:N
          ▼                     ▼
   ┌──────────────┐      ┌──────────────┐
   │   agents     │      │   issues     │
   │ reportsTo    │◀─┐   │ assignee:    │
   │ (self-ref)   │  │   │  agentId/    │
   └──────┬───────┘  │   │  userId      │
          │          │   └──────┬───────┘
          │ 1:N      │          │ 1:N
          ▼          │          ▼
   ┌──────────────┐  │   ┌──────────────┐
   │heartbeat_runs│  │   │issue_comments│
   │(execution)   │  │   └──────────────┘
   └──────┬───────┘  │
          │ 1:N      │   ┌──────────────────┐ 1:N ┌──────────────┐
          ▼          │   │workflow_templates │────▶│workflow_     │
   ┌──────────────┐  │   └──────────────────┘     │instances     │
   │heartbeat_run │  │                             └──────┬───────┘
   │_events       │  │                                    │ 1:N
   └──────────────┘  │                             ┌──────────────┐
                     └─────────────────────────────│stage_        │
   ┌──────────────┐                                │instances     │
   │principal_    │                                └──────────────┘
   │permission_   │
   │grants        │
   │scope(jsonb)  │
   │← NON LU     │
   └──────────────┘
```

### 1.3 Tables NOUVELLES requises pour le B2B (10 tables)

| # | Table | Description |
|---|-------|-------------|
| T1 | `project_memberships` | Scoping d'accès par projet |
| T2 | `automation_cursors` | Curseur d'automatisation par user/agent/project/company |
| T3 | `chat_channels` | Canaux de chat temps réel humain-agent |
| T4 | `chat_messages` | Messages dans les canaux |
| T5 | `container_profiles` | Profils de containerisation par agent type |
| T6 | `container_instances` | Instances de container actives |
| T7 | `credential_proxy_rules` | Règles de proxy pour credentials |
| T8 | `audit_events` | Audit log enterprise immutable (PARTITIONED BY createdAt) |
| T9 | `sso_configurations` | Config SSO par company |
| T10 | `import_jobs` | Jobs d'import Jira/Linear |

### 1.4 Modifications aux tables existantes

- `companies` : + `tier`, `ssoEnabled`, `maxUsers`, `parentCompanyId`
- `company_memberships` : + `businessRole` (admin/manager/contributor/viewer)
- `agents` : + `containerProfileId`, `isolationMode`
- `principal_permission_grants` : + 9 nouvelles PERMISSION_KEYS
- `activity_log` : + `ipAddress`, `userAgent`, `severity`

---

## 2. Faisabilité Technique par Bloc Fonctionnel

### FR-MU : Multi-user & Auth
- **Existe** : Better Auth complet, company_memberships, invites, join_requests
- **Manque** : UI invitations, page Membres, sign-out, disable signup
- **Effort : 1 semaine** (principalement frontend)

### FR-RBAC : Roles & Permissions
- **Existe** : principal_permission_grants avec 6 clés, scope JSONB (non lu!)
- **Manque** : Rôles métier, 9 nouvelles permission keys, hasPermission() lit scope, enforcement routes, UI admin
- **Trou critique** : `hasPermission()` ne lit JAMAIS `scope`
- **Effort : 2 semaines**

### FR-ORCH : Orchestrateur Déterministe
- **Existe** : workflow_templates, instances, stage_instances, CRUD complet
- **Manque** : State machine d'enforcement, compaction strategy, pré-prompts, fichiers obligatoires, auto-transition
- **Effort : 3-4 semaines**

### FR-OBS : Observabilité & Audit
- **Existe** : activity_log basique, heartbeat_run_events, cost_events, live events WebSocket
- **Manque** : Résumé LLM temps réel, audit immutable enterprise, dashboards agrégés, rétention/export
- **Effort : 3 semaines**

### FR-ONB : Onboarding Cascade
- **Existe** : invites avec defaultsPayload, join_requests, requireBoardApprovalForNewAgents
- **Manque** : Cascade hiérarchique, agent conversationnel, import Jira/Linear/ClickUp
- **Effort : 3-4 semaines**

### FR-A2A : Agent-to-Agent & Permissions
- **Existe** : agents.permissions, reportsTo, principal_permission_grants pour agents, approvals
- **Manque** : Bus messages inter-agents, validation humaine A2A, connecteurs MCP, query contexte
- **Effort : 4-5 semaines**

### FR-DUAL : Dual-speed Workflow
- **Existe** : workflow_templates.autoTransition, approvals
- **Manque** : Table automation_cursors, hiérarchie d'override, catégorisation tâches
- **Effort : 2-3 semaines**

### FR-CHAT : Chat Temps Réel
- **Existe** : WebSocket read-only via live-events.ts
- **Manque** : WebSocket bidirectionnel, tables chat, pipe vers stdin agent, historique, typing
- **Effort : 3 semaines**

### FR-CONT : Containerisation
- **Existe** : adapter pattern extensible, secrets.ts avec 4 providers
- **Manque** : ContainerManager, container profiles, credential proxy HTTP, shadow .env, mount allowlist
- **Effort : 4-5 semaines**

---

## 3. NFRs Techniques — Chiffres Cibles

### Performance
| Métrique | MVP | Enterprise |
|----------|-----|-----------|
| Latence API P50 | <100ms | <50ms |
| Latence API P99 | <500ms | <200ms |
| WebSocket message | <50ms | <20ms |
| Démarrage container | <10s | <5s |
| Requêtes simultanées | 100 | 1000 |
| Dashboard chargement | <2s | <1s |

### Sécurité
- Isolation tenant : PostgreSQL RLS + filtrage companyId (P0)
- Chiffrement at rest + in transit TLS 1.3 (P0)
- Credential isolation via proxy HTTP (P0)
- Audit immutable TRIGGER deny UPDATE/DELETE (P1)
- SSO SAML/OIDC (P1 Enterprise)
- Container isolation : namespaces Linux, no-root, resource limits (P1)

### Scalabilité
| Dimension | MVP | Enterprise |
|-----------|-----|-----------|
| Users/instance | 50 | 10 000 |
| Companies/instance | 5 | 500 |
| Agents actifs | 20 | 500 |
| Issues/company | 10 000 | 1 000 000 |
| WebSocket connexions | 100 | 10 000 |

### Disponibilité
| Métrique | MVP | Enterprise |
|----------|-----|-----------|
| Uptime | 99.5% | 99.9% |
| RTO | <4h | <30min |
| RPO | <1h | <5min |

---

## 4. Synthèse Stratégique

### Points forts du codebase
1. Schema DB remarquablement préparé (companyId sur CHAQUE table)
2. Adapter pattern extensible (ajout Docker naturel)
3. Secret management avancé (4 providers, versioning)
4. Workflow engine fonctionnel (templates → instances → stages)

### Trous critiques
1. `hasPermission()` ne lit pas `scope` — trou sécurité #1
2. Routes non protégées par permissions
3. WebSocket unidirectionnel
4. Pas de containerisation

### Ordre recommandé : 14-16 semaines total, MVP vendable 6-8 semaines

*~4000+ mots — Domain model complet, faisabilité par FR, NFRs techniques.*
