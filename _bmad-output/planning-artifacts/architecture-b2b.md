# Architecture B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 1.0 | **Date** : 2026-03-14 | **Statut** : Final
> **Auteurs** : Winston (Lead Architecte), Dr. Quinn (Problem Solver), Amelia (Dev), Quinn (QA/Sécurité), Murat (Test Architect), John (PM), Mary (Compliance)
> **Sources** : PRD B2B v1.0, UX Design B2B v1.0, Nanoclaw Research, Code existant MnM

---

## Table des Matières

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [ADRs — Architecture Decision Records](#3-adrs)
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

### 1.1 Diagramme d'Architecture (7 couches)

```
┌─────────────────────────────────────────────────────────────────┐
│                    COUCHE PRÉSENTATION                          │
│  React 18 + Vite │ shadcn/ui + Tailwind │ React Query + Zustand│
│  Routing protégé │ WebSocket client     │ Command Palette       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST + WebSocket
┌────────────────────────────┴────────────────────────────────────┐
│                       COUCHE API                                │
│  Express + tsx │ Routes par FR │ Auth middleware │ Rate limiting │
│  CORS │ Input validation (Zod) │ Error handling │ Audit emit    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    COUCHE SERVICES                              │
│  access.ts (RBAC+scope) │ workflow-enforcer.ts (state machine) │
│  container-manager.ts   │ credential-proxy.ts │ audit.ts        │
│  compaction-manager.ts  │ drift-monitor.ts    │ a2a-bus.ts      │
│  chat-service.ts        │ import-service.ts   │ onboarding.ts   │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
┌──────────┴──────────┐    ┌──────────────┴───────────────────────┐
│    COUCHE DATA       │    │         COUCHE REAL-TIME             │
│  PostgreSQL (Drizzle)│    │  WebSocket bidirectionnel            │
│  48 tables (38+10)   │    │  EventEmitter interne                │
│  RLS multi-tenant    │    │  Redis pub/sub (scaling)             │
│  Migrations versioned│    │  Chat channels                       │
└──────────────────────┘    └──────────────────────────────────────┘
           │
┌──────────┴──────────────────────────────────────────────────────┐
│                  COUCHE AGENT RUNTIME                           │
│  Adapter pattern (8+ types) │ ContainerManager (Docker)         │
│  Credential Proxy HTTP      │ Mount Allowlist                   │
│  HeartbeatService            │ CompactionWatcher                 │
│  WorkflowEnforcer            │ DriftDetector                     │
└─────────────────────────────────────────────────────────────────┘
           │
┌──────────┴──────────────────────────────────────────────────────┐
│                  COUCHE SÉCURITÉ (Transversale)                 │
│  RBAC + Scope JSONB │ RLS PostgreSQL │ Container isolation      │
│  Audit immutable    │ TLS 1.3        │ Rate limiting             │
│  Credential proxy   │ CSRF tokens    │ Input sanitization        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Flux de Données Principaux

**Flux 1 — Lancement Agent** :
```
User → API (auth + RBAC) → WorkflowEnforcer (validate template)
  → ContainerManager (create container) → CredentialProxy (inject secrets)
  → Agent starts → HeartbeatService (monitor) → WebSocket (live updates)
  → DriftDetector (watch) → AuditLog (trace)
```

**Flux 2 — Observabilité Temps Réel** :
```
Agent action → HeartbeatEvent → AuditSummarizer (LLM résumé <5s)
  → WebSocket → Dashboard UI (agrégé, jamais individuel)
```

**Flux 3 — Drift Detection** :
```
DriftDetector (compare attendu vs observé) → DriftAlert
  → WebSocket notification → UI (diff visuel + actions)
  → CompactionWatcher (if context loss) → Kill+Relance ou Réinjection
```

---

## 2. Monorepo Structure

### 2.1 Structure Actuelle

```
mnm/
├── packages/
│   ├── shared/          # Types partagés, utilitaires
│   ├── db/              # Schema Drizzle, migrations, queries
│   ├── adapter-utils/   # Utilitaires pour les adapters
│   └── adapters/        # 6 adapter types (claude, codex, etc.)
├── server/
│   ├── src/services/    # Business logic (access, heartbeat, drift, etc.)
│   ├── src/routes/      # Express routes (22 fichiers)
│   └── src/realtime/    # WebSocket (live-events.ts)
└── ui/
    └── src/             # React frontend (shadcn/ui + Tailwind)
```

### 2.2 Nouveaux Modules B2B

```
packages/db/src/schema/
  + project-memberships.ts, automation-cursors.ts
  + chat-channels.ts, chat-messages.ts
  + container-profiles.ts, container-instances.ts
  + credential-proxy-rules.ts, audit-events.ts
  + sso-configurations.ts, import-jobs.ts

server/src/services/
  + workflow-enforcer.ts, workflow-state-machine.ts
  + container-manager.ts, credential-proxy.ts
  + compaction-manager.ts, compaction-watcher.ts
  + chat-service.ts, a2a-bus.ts
  + audit-summarizer.ts, import-service.ts

server/src/routes/
  + invites.ts, members.ts, roles.ts
  + containers.ts, chat.ts, audit.ts

ui/src/components/
  + WorkflowPipeline, DriftAlert, AutomationCursor
  + ChatPanel, MembersTable, PermissionMatrix
  + ContainerStatus, AuditLogTable, DashboardCards
```

---

## 3. ADRs — Architecture Decision Records

### ADR-001 : Multi-tenant (RLS PostgreSQL)

**Contexte** : MnM doit supporter plusieurs companies sur la même instance.

**Options** : A) Row-Level Security PostgreSQL, B) DB par tenant, C) Schema par tenant.

**Décision** : **Option A — RLS PostgreSQL**.

**Rationale** :
- 37/38 tables ont déjà `companyId` — la structure est prête
- Défense en profondeur : même si le code oublie un filtre, RLS bloque
- Opérations unifiées (migrations, backups, monitoring)
- Compatible Drizzle ORM

**Conséquences** :
- Politique RLS : `SET LOCAL app.current_company_id` au début de chaque requête
- 14 tables sous RLS (toutes sauf les tables système cross-tenant : user, session, account, verification, instance_user_roles, migrations, assets, inbox_dismissals)
- Performance : overhead RLS négligeable avec index sur companyId

### ADR-002 : Auth (Better Auth + RBAC + SSO)

**Contexte** : Étendre le système auth pour RBAC métier + SSO.

**Décision** : Conserver Better Auth + corriger `hasPermission()` + ajouter SSO via plugins.

**Correction critique** (`access.ts:45-66`) :
```typescript
// AVANT (trou sécurité) :
async function hasPermission(principalId, key) {
  // NE LIT PAS scope → accès à tout
}

// APRÈS :
async function hasPermission(principalId, key, projectId?) {
  const grant = await db.query.principalPermissionGrants.findFirst({
    where: and(eq(ppg.principalId, principalId), eq(ppg.permissionKey, key))
  });
  if (!grant) return false;
  if (!grant.scope) return true; // scope null = accès global
  const scope = ScopeSchema.parse(grant.scope);
  if (projectId && scope.projectIds) {
    return scope.projectIds.includes(projectId);
  }
  return true;
}
```

**4 rôles métier** avec presets de 15 permission keys :
- **Admin** : toutes les permissions
- **Manager** : members.invite, projects.*, workflows.*, agents.launch, stories.*, audit.view, chat.agent
- **Contributor** : agents.launch, stories.*, chat.agent
- **Viewer** : audit.view, dashboard.view

**SSO** : via Better Auth plugins (SAML/OIDC) + table `sso_configurations`.

### ADR-003 : Orchestrateur Déterministe (State Machine)

**Contexte** : Les workflows doivent être imposés algorithmiquement, pas suggérés.

**Décision** : State machine avec transitions gardées et enforcement strict.

**12 transitions** : CREATED→READY→IN_PROGRESS→VALIDATING→COMPLETED (+ PAUSED, FAILED, COMPACTING, SKIPPED).

**WorkflowEnforcer** :
- Vérifie les fichiers obligatoires avant chaque transition
- Injecte les pré-prompts par étape
- Persiste les résultats intermédiaires
- Déclenche la validation humaine si configurée
- Détecte la compaction et applique la stratégie (kill+relance ou réinjection)

### ADR-004 : Containerisation Docker + Credential Proxy

**Décision** : 5 couches de défense en profondeur (pattern Nanoclaw) :

1. **Container éphémère** `--rm --read-only` — détruit après usage
2. **Mount allowlist** — `realpath()` + symlinks interdits + null bytes bloqués
3. **Credential proxy HTTP** — les agents appellent `http://credential-proxy:8090/api/secret/{name}`, le proxy résout via le provider (local/AWS/GCP/Vault) sans exposer les clés
4. **Shadow `.env`** — mount bind `/dev/null` sur `.env` dans le container
5. **Réseau isolé** — bridge Docker par company, pas d'accès internet direct

**4 profils de ressources** : light (0.5 CPU, 256MB), standard (1 CPU, 512MB), heavy (2 CPU, 1GB), gpu (4 CPU, 4GB + GPU).

### ADR-005 : Chat Temps Réel (WebSocket Bidirectionnel)

**État actuel** : `live-events-ws.ts` est unidirectionnel (serveur → client).

**Décision** : Étendre en bidirectionnel avec protocole de messages typé.

**Architecture** :
- Client envoie `{ type: "chat_message", channelId, content }` via WebSocket
- Serveur route vers le ChatService → pipe vers stdin de l'agent
- Agent répond → HeartbeatEvent → WebSocket → client
- Tables : `chat_channels` (par agent run) + `chat_messages` (historique)
- Reconnexion : buffer serveur 30s, sync des messages manqués
- Rate limiting : 10 messages/minute par user

### ADR-006 : Agent-to-Agent Communication

**Décision** : Bus A2A applicatif avec validation human-in-the-loop.

**Flux** : Agent A émet requête → A2ABus vérifie permissions (scope, rôle, projet) → notification au propriétaire humain de Agent B → si approuvé → Agent A reçoit le contexte → audit log.

**Protection anti-boucle** : max 5 requêtes A2A par chaîne, détection de cycles.

### ADR-007 : Observabilité (Audit + Résumé LLM)

**Décision** :
- Table `audit_events` partitionnée par mois, TRIGGER deny UPDATE/DELETE
- Résumé LLM via Haiku (<5s) : traduction logs techniques → langage naturel
- Dashboards agrégés avec k-anonymity (k=5) — JAMAIS de drill-down individuel

### ADR-008 : Gestion de Compaction (Risque R1)

**C'est le risque le plus critique du projet.**

**Décision** : Stratégie duale :
1. **Kill+relance** : tuer l'agent, relancer avec contexte frais + résultats intermédiaires déjà produits
2. **Réinjection** : réinjecter pré-prompts + définition workflow post-compaction

**CompactionWatcher** : monitore les heartbeats, détecte la compaction (réduction soudaine de contexte), applique la stratégie configurée par étape.

**Circuit breaker** : max 3 relances par session. Au-delà → alerte humaine.

**Table `compaction_snapshots`** : sauvegarde l'état pré-compaction (résultats intermédiaires, fichiers en contexte, position dans le workflow).

---

## 4. Database Schema Changes

### 4.1 Nouvelles Tables (10)

| Table | Colonnes clés | Relations |
|-------|--------------|-----------|
| `project_memberships` | id, userId, projectId, companyId, role, grantedBy, createdAt | → users, projects, companies |
| `automation_cursors` | id, level (action/agent/project/company), position (manual/assisted/auto), targetId, companyId, ceiling | → companies |
| `chat_channels` | id, agentId, heartbeatRunId, companyId, status, createdAt | → agents, heartbeat_runs |
| `chat_messages` | id, channelId, senderId, senderType (user/agent), content, createdAt | → chat_channels |
| `container_profiles` | id, name, cpu, memory, disk, timeout, mountAllowlist, companyId | → companies |
| `container_instances` | id, profileId, agentId, containerId, status, startedAt, stoppedAt | → container_profiles, agents |
| `credential_proxy_rules` | id, companyId, secretPattern, allowedAgentRoles, proxyEndpoint | → companies |
| `audit_events` | id, companyId, actorId, actorType, action, targetType, targetId, metadata, ipAddress, prevHash, createdAt | PARTITIONED BY createdAt |
| `sso_configurations` | id, companyId, provider (saml/oidc), config (jsonb), enabled | → companies |
| `import_jobs` | id, companyId, source (jira/linear/clickup), status, config, progress, createdAt | → companies |

### 4.2 Tables Modifiées (5)

| Table | Colonnes ajoutées |
|-------|------------------|
| `companies` | `tier` (free/team/enterprise/onprem), `ssoEnabled`, `maxUsers`, `parentCompanyId` |
| `company_memberships` | `businessRole` (admin/manager/contributor/viewer) |
| `agents` | `containerProfileId`, `isolationMode` (none/container/sandbox) |
| `principal_permission_grants` | +9 nouvelles permission keys (15 total) |
| `activity_log` | `ipAddress`, `userAgent`, `severity` (info/warning/error/critical) |

### 4.3 15 Permission Keys

```
// 6 existantes
company.manage, members.invite, members.manage,
projects.create, projects.manage, agents.configure

// 9 nouvelles
workflows.create, workflows.manage, agents.launch,
stories.create, stories.edit, audit.view, audit.export,
dashboard.view, chat.agent
```

---

## 5. API Design

### 5.1 Nouveaux Endpoints (~30)

#### FR-MU (Multi-User)
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/api/invites` | admin, manager | Créer invitation(s) |
| GET | `/api/members` | admin, manager | Lister les membres |
| PUT | `/api/members/:id/role` | admin | Changer le rôle |
| DELETE | `/api/members/:id` | admin | Désactiver membre |

#### FR-RBAC
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/roles` | admin | Lister les rôles |
| GET | `/api/permissions/matrix` | admin | Matrice permissions |
| PUT | `/api/permissions/:roleId` | admin | Modifier permissions |

#### FR-ORCH
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/api/workflows/:id/enforce` | admin, manager | Activer enforcement |
| GET | `/api/drift/alerts` | admin, manager | Alertes drift actives |
| POST | `/api/drift/alerts/:id/resolve` | admin, manager | Résoudre un drift |

#### FR-OBS
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/api/audit` | audit.view | Consulter audit log |
| GET | `/api/audit/export` | audit.export | Exporter CSV/JSON |
| GET | `/api/dashboards/:type` | dashboard.view | Dashboard agrégé |

#### FR-CHAT
| Protocole | Path | Auth | Description |
|-----------|------|------|-------------|
| WebSocket | `/ws/chat/:channelId` | chat.agent | Chat bidirectionnel |
| GET | `/api/chat/:channelId/history` | chat.agent | Historique messages |

#### FR-CONT
| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/api/containers/launch` | agents.launch | Lancer container |
| GET | `/api/containers/:id/status` | agents.launch | Statut container |
| POST | `/api/containers/:id/stop` | agents.configure | Arrêter container |

---

## 6. Security Architecture

### 6.1 RBAC Enforcement

- **Correction `hasPermission()`** : lecture du scope JSONB avec validation Zod stricte
- **Middleware `requirePermission(key, scopeExtractor?)`** : appliqué sur chaque route
- **Audit des 22 fichiers de routes** : 3 fichiers critiques sans aucun check (approvals, assets, secrets)
- **Navigation UI** : items masqués (pas grisés) via `canUser()` côté client

### 6.2 Multi-tenant Isolation

- **RLS PostgreSQL** : `CREATE POLICY` sur 14 tables avec `current_setting('app.current_company_id')`
- **Cache isolation** : préfixe `tenant:{companyId}:` sur toutes les clés Redis
- **Container isolation** : bridge Docker par company, pas de communication inter-company

### 6.3 Container Security (5 couches Nanoclaw)

1. Éphémère `--rm --read-only` + `--no-new-privileges`
2. Mount allowlist avec `realpath()` + symlinks interdits + null bytes bloqués
3. Credential proxy HTTP sur port interne (8090)
4. Shadow `.env` → `/dev/null`
5. Réseau bridge isolé par company

### 6.4 Input Validation

- **XSS** : UTF-8 strict + DOMPurify + CSP headers
- **SQL injection scope JSONB** : Zod `.strict()` + requêtes paramétrées Drizzle
- **CSRF** : tokens + Origin/Referer + SameSite=Strict
- **Path traversal** : realpath + symlinks + null bytes + URL encoding

### 6.5 Rate Limiting

| Endpoint | Limite | Window |
|----------|--------|--------|
| Login | 5 | 1 min |
| Invitations | 20 | 1 h |
| Chat messages | 10 | 1 min |
| API général | 100 | 1 min |

### 6.6 Audit Trail

- Table `audit_events` : TRIGGER deny UPDATE/DELETE
- Hash chain SHA-256 optionnel (P2) avec vérification périodique
- Partitionnement mensuel, rétention 3 ans
- Interface read-only avec 12 filtres

---

## 7. Deployment Architecture

### 7.1 Modes de Déploiement

| Mode | Cible | Infrastructure |
|------|-------|---------------|
| **Self-hosted** | OSS + Team | Docker Compose, single server |
| **Cloud Managed** | Team + Enterprise | Kubernetes, auto-scaling, multi-tenant |
| **On-Premise** | Enterprise réglementé | Déploiement chez le client, zero data exfiltration |

### 7.2 Infrastructure Dev

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mnm_dev
  redis:
    image: redis:7-alpine
  server:
    build: ./server
    depends_on: [postgres, redis]
  ui:
    build: ./ui
    ports: ["5173:5173"]
```

### 7.3 Infrastructure Production

- **Kubernetes** avec HPA (Horizontal Pod Autoscaler)
- **Rolling deployment** avec canary (10% → 50% → 100%)
- **Reverse proxy** : Nginx/Caddy, SSL termination, health checks
- **Monitoring** : Prometheus + Grafana, alertes PagerDuty

---

## 8. Performance & Scalability

### 8.1 Cibles NFR

| Métrique | MVP | Enterprise |
|----------|-----|-----------|
| API P50 | <100ms | <50ms |
| API P99 | <500ms | <200ms |
| WebSocket | <50ms | <20ms |
| Container startup | <10s | <5s |
| Users/instance | 50 | 10 000 |
| Agents actifs | 20 | 500 |

### 8.2 Stratégies

- **Redis** : sessions, query cache, WebSocket pub/sub (scaling multi-instance), rate limiting
- **pgBouncer** : connection pooling PostgreSQL (max 100 connections)
- **WebSocket scaling** : sticky sessions (MVP) → Redis pub/sub (Enterprise)
- **CDN** : assets statiques (Vite build)
- **Code splitting** : lazy loading par route côté frontend
- **Virtualisation** : TanStack Virtual pour les grandes listes

---

## 9. Test Architecture & CI/CD

### 9.1 Pyramide de Tests

| Niveau | Outil | Couverture cible |
|--------|-------|-----------------|
| Unitaires | Vitest (déjà configuré, 5 projets) | ≥80% nouveau code |
| Intégration | Supertest + embedded-postgres | 95% RBAC, 95% credential proxy |
| E2E | Cypress | Flux critiques (login, workflow, chat, RBAC) |
| Sécurité | OWASP ZAP | 12 catégories |
| Performance | k6 | P50/P95/P99 par endpoint |

### 9.2 Pipeline CI/CD (GitHub Actions)

```
Push → QG-0 (Lint+TypeScript) → QG-1 (Unit) ─┬→ QG-3 (Security)
                                               ├→ QG-2 (Integration)
                                               └→ QG-4 (Performance)
                                                   └→ QG-5 (E2E) → QG-6 (Review) → Deploy
```

- **Durée** : ~15-22 min avec parallélisation
- **Caching** : pnpm store, Docker layers, Cypress binary
- **Environnements** : dev (auto), staging (auto), production (manual approval)

### 9.3 7 Smoke Tests Pré-Deploy

1. Login/signup/sign-out
2. Création agent + lancement workflow
3. Chat WebSocket connecte/envoie/reçoit
4. RBAC : viewer ne peut PAS créer agent
5. Container : lancement/exécution/arrêt
6. Credential proxy : valide passe / invalide échoue
7. Aucune donnée cross-company visible

### 9.4 Infrastructure de Test

- **Factories TypeScript** : users, companies, agents, workflows
- **Seed E2E** : données cohérentes pour Cypress
- **Mock strategy** : mocker les LLM providers, JAMAIS la DB (embedded-postgres)
- **Test containers** : docker-compose.test.yml avec PostgreSQL de test

---

## 10. Migration Strategy

### 10.1 Plan en 4 Phases

| Phase | Actions | Durée | Rollback |
|-------|---------|-------|----------|
| **Phase 1** | Ajouter colonnes (non-breaking), créer nouvelles tables | 1 sem | DROP colonnes/tables |
| **Phase 2** | Migrer données existantes, assigner company par défaut | 1 sem | Script inverse |
| **Phase 3** | Activer RLS PostgreSQL | 1 sem | DROP POLICY |
| **Phase 4** | Déployer multi-tenant complet | 2 sem | Feature flag rollback |

**Total** : ~5 semaines. **Zero-downtime** : migrations non-destructives, feature flags pour activation progressive.

### 10.2 Principes

- Chaque migration est réversible
- Pas de `DROP COLUMN` sans période de grâce (2 sprints)
- Feature flags pour activer le multi-tenant progressivement
- Tests de migration sur copie de production avant déploiement

---

## 11. Compliance Architecture

### 11.1 RGPD

- **Droit à l'effacement** : `UserDeletionService` identifie les 7 domaines de données, suppression/anonymisation atomique, délai 30 jours
- **Portabilité** : export JSON/CSV asynchrone via API dédiée
- **Consentement** : table `user_consents` avec 6 types granulaires (AI_PROCESSING, A2A_COMMUNICATION, TACIT_KNOWLEDGE, ANALYTICS_AGGREGATED, LLM_EXTERNAL, ONBOARDING_ORAL)
- **Privacy by Design** : TLS 1.3, AES-256, pseudonymisation, collecte minimale

### 11.2 Audit Trail

- Table `audit_events` partitionnée par mois, append-only
- TRIGGER deny UPDATE/DELETE (rôles séparés : `mnm_app` vs `mnm_audit_admin`)
- Hash chain SHA-256 optionnel avec vérification périodique
- Rétention 3 ans minimum
- Interface read-only avec 12 filtres et export

### 11.3 Data Residency

- 3 modes : On-Premise (zero exfiltration), SaaS EU, SaaS Multi-Région
- Abstraction LLM provider : routing par `company.llmProvider`
- Support LLM EU/on-premise : choix du provider par le client

### 11.4 AI Act

- Curseur d'automatisation = garantie architecturale de conformité (jamais full auto sans option humaine)
- Classification agents par risque : MINIMAL, LIMITED, HIGH, UNACCEPTABLE
- Explicabilité : résumé LLM, audit trail complet, replay possible

### 11.5 Contraintes Business dans l'Architecture

- **Métriques agrégées** : `AggregationService` avec k-anonymity (k=5), vues matérialisées avec GROUP BY obligatoire — le drill-down individuel est architecturalement impossible
- **Élévation, pas remplacement** : le curseur ne peut jamais être en "Full Auto" sans fallback humain possible
- **Open source compatible** : séparation `packages/core/` (OSS) vs `packages/enterprise/` (payant), feature detection au runtime

---

## Annexes

### Fichiers Impactés

| Action | Fichiers |
|--------|---------|
| **À modifier** (10) | access.ts, constants.ts, live-events-ws.ts, heartbeat.ts, drift.ts, activity-log.ts, companies schema, company_memberships schema, agents schema, principal_permission_grants schema |
| **À créer** (19) | workflow-enforcer.ts, workflow-state-machine.ts, container-manager.ts, credential-proxy.ts, compaction-manager.ts, compaction-watcher.ts, chat-service.ts, a2a-bus.ts, audit-summarizer.ts, import-service.ts, + 10 fichiers schema DB |
| **Routes à auditer** (22) | Tous les fichiers dans `server/src/routes/` — 3 critiques sans check canUser |

### Sections Détaillées

| Section | Auteur | Fichier |
|---------|--------|---------|
| Architecture Overview, ADRs 1-3 | Winston | `sections/archi-section-1-overview-winston.md` |
| ADRs 4-8 | Dr. Quinn | `sections/archi-section-2-adrs-quinn.md` |
| Database Schema, API Design | Amelia | `sections/archi-section-3-db-api-amelia.md` |
| Security Architecture | Quinn QA | `sections/archi-section-4-security-quinn.md` |
| Test Architecture, CI/CD | Murat | `sections/archi-section-5-test-murat.md` |
| Deployment, Performance | John | `sections/archi-section-6-deployment-john.md` |
| Compliance | Mary | `sections/archi-section-7-compliance-mary.md` |

---

*Architecture B2B MnM v1.0 — ~6000 mots — 7 contributeurs — 8 ADRs, schema DB, API design, sécurité, CI/CD, compliance.*
*Prochaine étape : Sprint Planning (Étape 5 du plan d'orchestration)*
