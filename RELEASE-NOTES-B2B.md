# MnM B2B Enterprise Transformation — Release Notes

**Branche :** `feature/b2b-enterprise-transformation`
**Date :** 16 mars 2026
**Commits :** 292 | **Fichiers modifiés :** 503 | **Lignes ajoutées :** ~194,000
**Stories complétées :** 69/69 (14 batches, 16 epics)

---

## TL;DR

MnM passe d'un IDE solo pour agents IA a un **cockpit enterprise multi-utilisateur** avec RBAC, orchestration deterministe, containerisation d'agents, drift detection, audit immutable, chat temps reel, SSO, et dashboards par role. Tout le backend B2B est en place.

---

## Ce qui a ete construit

### Infrastructure (Batch 1-2)

| Feature | Detail |
|---------|--------|
| **PostgreSQL externe** | Migration SQLite -> PostgreSQL, connection pooling, config par environnement |
| **Docker Compose** | 4 configs : dev, test, prod, quickstart |
| **Redis** | Cache, rate limiting, pub/sub pour real-time |
| **10 nouvelles tables** | project_memberships, automation_cursors, chat_channels, chat_messages, container_profiles, container_instances, credential_proxy_rules, audit_events, sso_configurations, import_jobs |
| **5 tables modifiees** | companies (+tier, ssoEnabled), company_memberships (+businessRole), agents (+containerProfileId), permission_grants (+9 keys), activity_log (+severity) |
| **Test factories** | Helpers pour generer des donnees de test coherentes |

### Multi-User & Auth (Batch 3-4)

| Feature | Detail |
|---------|--------|
| **Invitations email** | API complete + email service (envoi, accept, reject, expire) |
| **Page Membres** | Table avec filtres, recherche, pagination, invite dialog |
| **Bulk CSV import** | Upload CSV, preview, validation, progress bar, invite en masse |
| **Company selector** | Switch entre companies dans le header |
| **Sign-out securise** | Invalidation session cote serveur (plus de tokens zombies) |
| **Signup controlable** | Flag invitationOnly par company, join-request guard |

### RBAC — Roles & Permissions (Batch 3-5)

| Feature | Detail |
|---------|--------|
| **Fix hasPermission (P0)** | Corrige la validation de scope JSONB — faille de securite critique fermee |
| **4 roles** | Admin, Manager, Contributor, Viewer avec presets de permissions |
| **20 permission keys** | workflows.create/manage, agents.launch, stories.create/edit, audit.view/export, dashboard.view, chat.agent + 6 existantes |
| **RLS PostgreSQL** | Row-Level Security sur 41 tables avec tenant context middleware |
| **Enforcement 22 routes** | Middleware de permission sur toutes les routes API |
| **Navigation masquee** | Menu items caches (pas grises) selon permissions du user |
| **UI matrice permissions** | Page admin pour configurer les permissions par role |
| **RoleBadge component** | Badge colore par role (Admin=rouge, Manager=bleu, Contributor=vert, Viewer=gris) |
| **businessRole migration** | Nouveau champ sur company_memberships pour le role metier |

### Orchestrateur Deterministe (Batch 6-7)

| Feature | Detail |
|---------|--------|
| **State machine XState** | 12 transitions (CREATED->READY->IN_PROGRESS->VALIDATING->COMPLETED + PAUSED/FAILED/COMPACTING/SKIPPED) |
| **WorkflowEnforcer** | Service qui impose le suivi du workflow — l'agent ne peut pas sauter d'etapes |
| **Validation HITL** | Human-in-the-loop : pause workflow, demande validation humaine, reprise |
| **API orchestrateur** | Routes completes : start/pause/resume/skip/fail/complete + status |
| **Workflow Editor UI** | Interface visuelle pour creer/modifier des workflows (drag & drop des etapes) |

### Drift Detection (Batch 8-9)

| Feature | Detail |
|---------|--------|
| **Persistence DB** | Tables drift_reports + drift_items avec historique complet |
| **Monitor service** | Detection automatique quand un agent devie de son workflow |
| **UI diff viewer** | Visualisation side-by-side du drift (attendu vs reel), badges d'alerte |

### Observabilite & Audit (Batch 6-8, 13)

| Feature | Detail |
|---------|--------|
| **audit_events table** | Immutable (TRIGGER deny UPDATE/DELETE), partitionnee par mois |
| **Audit emitter** | Emission automatique d'events sur toutes les actions critiques |
| **UI AuditLog** | Page de consultation avec filtres, recherche, export |
| **Resume LLM** | Service qui resume les traces d'agents en langage naturel (Claude Haiku) |

### Chat Temps Reel (Batch 6, 10)

| Feature | Detail |
|---------|--------|
| **WebSocket bidirectionnel** | Extension du live-events.ts existant en full-duplex |
| **Tables chat** | chat_channels + chat_messages avec persistence |
| **Pipe stdin** | Le chat envoie les messages directement au stdin de l'agent dans son container |
| **AgentChatPanel** | Composant React split-view : code a gauche, chat a droite |

### Containerisation (Batch 9-10)

| Feature | Detail |
|---------|--------|
| **ContainerManager Docker** | 5 couches de defense : ephemere --rm --read-only, mount allowlist, credential proxy, shadow .env, reseau isole |
| **Credential proxy** | HTTP proxy qui injecte les credentials sans les exposer a l'agent |
| **Mount allowlist** | Whitelist de repertoires montables par container profile |
| **Isolation reseau** | Reseaux Docker isoles par agent/projet |
| **UI container status** | Badges d'etat, metriques, actions (start/stop/restart) |

### Agent-to-Agent (Batch 11-12)

| Feature | Detail |
|---------|--------|
| **A2A Bus** | Bus de communication inter-agents avec validation |
| **Permissions A2A** | Rules table + enforcement : un agent doit avoir la permission de contacter un autre |
| **Audit A2A** | Toute communication inter-agent est tracee dans audit_events |
| **Connecteurs MCP** | Agents peuvent creer des connecteurs MCP pour s'interfacer avec des outils externes |

### Dual-Speed Workflow (Batch 11-12)

| Feature | Detail |
|---------|--------|
| **Automation cursors** | Table + service : 3 positions (Manuel/Assiste/Auto) x 4 niveaux (action/agent/projet/company) |
| **UI curseur** | Slider visuel pour chaque niveau, avec indication du plafond hierarchique |
| **Enforcement** | Le curseur est respecte : un agent en mode Manuel ne peut pas auto-executer |

### Compaction Management (Batch 11-13)

| Feature | Detail |
|---------|--------|
| **CompactionWatcher** | Detecte quand un agent compacte (perte de contexte) via heartbeats |
| **Kill + relance** | Option A : kill l'agent, recup son output, relance avec contexte frais |
| **Reinjection post-compaction** | Option B : reinjecte les pre-prompts critiques du workflow apres compaction |

### Enterprise (Batch 13)

| Feature | Detail |
|---------|--------|
| **SSO tables + service** | sso_configurations table, support multi-provider par company |
| **Better Auth SAML/OIDC** | Integration plugins Better Auth pour SAML 2.0 et OpenID Connect |
| **UI config SSO** | Page admin pour configurer les providers SSO |
| **Dashboard API** | Endpoints agreges par role (CEO voit tout, Manager voit son equipe) |
| **DashboardCards UI** | Cards configurables : KPIs, progression, alertes, metriques agents |
| **Dashboard real-time** | Refresh via WebSocket, pas polling |

### Onboarding (Batch 14)

| Feature | Detail |
|---------|--------|
| **CEO onboarding wizard** | Flow conversationnel : define ta company -> tes equipes -> tes roles -> invite |
| **Cascade hierarchique** | Chaque niveau configure le suivant (CEO->CTO->Manager->Contributor) |
| **Import Jira** | Service basique : connexion API Jira, import projects/issues/users |
| **Dual-mode config** | Mode oral (chat) pour CEO, mode visuel (formulaires) pour CTO |

### DevOps (Batch 14)

| Feature | Detail |
|---------|--------|
| **CI/CD pipeline** | GitHub Actions : lint, typecheck, test, build, deploy staging |
| **Playwright config** | Setup E2E complet avec 70 fichiers de tests |

---

## Chiffres cles

| Metrique | Valeur |
|----------|--------|
| Services backend | 71 |
| Routes API | 35 |
| Tables DB (schema files) | 51 |
| Pages frontend | 38 |
| Composants React | 99+ |
| Tests E2E Playwright | 70 fichiers |
| Docker Compose configs | 4 |

---

## Architecture en place

```
React 18 (shadcn/ui + Tailwind)
    |
Express API (35 routes, auth middleware, rate limiting)
    |
71 Services (RBAC, orchestrator, containers, audit, chat, drift, a2a, compaction...)
    |
PostgreSQL (51 tables, RLS 41 tables) + Redis (cache, pub/sub) + WebSocket (live events, chat)
    |
Agent Runtime (adapters, Docker containers, credential proxy, heartbeat, compaction watcher)
```
