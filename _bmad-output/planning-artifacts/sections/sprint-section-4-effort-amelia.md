# Sprint Section 4 — Estimation d'Effort & Faisabilité Technique

*Par Amelia la Dev* | Task #4 | 2026-03-14

---

## 1. Méthodologie d'Estimation

### 1.1 Échelle d'Effort

| Taille | Story Points | Durée 1 dev | Caractéristiques |
|--------|-------------|-------------|------------------|
| **S** | 1-2 SP | 1-2 jours | Modification mineure, fichier unique, pattern existant |
| **M** | 3-5 SP | 3-5 jours | Nouveau service ou composant, 3-5 fichiers, tests inclus |
| **L** | 8 SP | 1-2 semaines | Nouveau système complet, 5-10 fichiers, intégration multi-couches |
| **XL** | 13 SP | 2-4 semaines | Nouveau sous-système, R&D nécessaire, risque technique élevé |

### 1.2 Contexte Équipe

- **Tom** : Cofondateur technique, expertise backend Node/Express, observabilité, WebSocket, connaissance profonde de la codebase MnM (heartbeat.ts 2396 lignes, agents.ts, drift.ts)
- **Cofondateur technique (à recruter)** : Profil senior fullstack, focus orchestration + agents + containerisation Docker
- **Velocity estimée** : 15-20 SP par dev par sprint de 2 semaines (hypothèse conservatrice pour un projet en phase de transformation majeure)
- **Velocity équipe (2 devs)** : 30-40 SP par sprint

### 1.3 Principes d'Estimation

1. **Inclure les tests** : chaque estimation inclut tests unitaires (Vitest) + tests d'intégration (Supertest)
2. **Inclure les migrations DB** : chaque nouvelle table = migration Drizzle + seed + rollback
3. **Inclure la review** : temps de review croisée entre les 2 devs
4. **Buffer 20%** : appliqué sur le total pour imprévus, debugging, et montée en charge du cofondateur technique
5. **Pas de parallélisme parfait** : les 2 devs ne peuvent pas travailler en isolation totale — des points de sync sont nécessaires

---

## 2. Estimation Détaillée par Story

### 2.1 Epic 1 — Multi-User & Auth (FR-MU)

**Total Epic : 16-19 SP | ~1.5 semaine (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| MU-01 | Invitation par email avec lien signé (expire 7j) | S | 2 | 1-2j | Tom | `invites` table existe déjà, route `/api/invites` partielle dans routes/access.ts (2604 lignes). Besoin : endpoint POST complet, email sending (nodemailer ou Resend), lien signé avec token. Complexité modérée car l'infra email n'existe pas encore. |
| MU-02 | Page Membres avec tableau, filtres, actions | M | 3 | 2-3j | Cofondateur | Frontend shadcn/ui + React Query. `company_memberships` existe. Besoin : GET /api/members enrichi (join user), composant DataTable avec filtres, actions bulk. Pattern existant dans issues list. |
| MU-03 | Invitation bulk (CSV ou liste emails) | S | 2 | 1-2j | Tom | Extension de MU-01 : parsing CSV côté client, boucle sur le endpoint d'invitation, feedback par ligne. |
| MU-04 | Sélecteur de Company (multi-company) | S | 2 | 1j | Cofondateur | UI dropdown dans header, stockage company active en Zustand, filtrage API par companyId. Pattern simple. |
| MU-05 | Désactivation signup libre (invitation-only) | S | 1 | 0.5j | Tom | Flag `invitationOnly` sur `companies`, check dans auth middleware. Trivial. |
| MU-06 | Sign-out avec invalidation session | S | 1 | 0.5j | Tom | Better Auth a déjà le mécanisme. Besoin : bouton UI + appel endpoint + cleanup local. |
| MU-07 | Migration PostgreSQL externe | M | 5 | 3-4j | Tom | **Story technique critique**. docker-compose.dev.yml avec PostgreSQL 16, config connexion .env, migration du SQLite embarqué, scripts de seed, documentation setup. Prérequis pour tout le reste. |

**Risques Epic 1** :
- MU-07 est un **bloquant** pour toutes les autres epics (RLS, multi-tenant, etc.)
- L'infra email (MU-01) doit être choisie tôt : Resend (SaaS) vs Nodemailer (self-hosted)

---

### 2.2 Epic 2 — RBAC Métier (FR-RBAC)

**Total Epic : 21-26 SP | ~2 semaines (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| RBAC-01 | Fix hasPermission() — lire scope JSONB | M | 3 | 2j | Tom | **DETTE TECHNIQUE CRITIQUE (DT1)**. access.ts:45-66 ignore complètement `scope`. Requiert : lecture scope, parsing Zod, validation projectId. Impact : chaque route qui appelle hasPermission() est potentiellement vulnérable. Code existant = 268 lignes dans services/access.ts. Risque modéré car le fix est bien défini dans l'architecture (ADR-002). |
| RBAC-02 | 9 nouvelles permission keys + presets par rôle | S | 2 | 1-2j | Tom | constants.ts : ajouter 9 keys (workflows.create/manage, agents.launch, stories.create/edit, audit.view/export, dashboard.view, chat.agent). role-presets.ts : matrice admin/manager/contributor/viewer. Modification simple, bien définie. |
| RBAC-03 | businessRole sur company_memberships | S | 2 | 1j | Cofondateur | Migration Drizzle : ajouter colonne `businessRole` enum (admin/manager/contributor/viewer) sur company_memberships. Migration data : tous les membres existants → admin. |
| RBAC-04 | Enforcement dans 22 fichiers routes | L | 8 | 5-7j | Tom + Cofondateur | **La plus grosse story de l'epic.** Audit des 22 fichiers dans server/src/routes/. 3 fichiers critiques sans aucun check (approvals.ts, assets.ts, secrets.ts). Besoin : middleware `requirePermission(key, scopeExtractor?)` appliqué systématiquement. Travail mécanique mais volumineux et critique pour la sécurité. Splitting recommandé : Tom fait les routes critiques (approvals, assets, secrets, agents, workflows), Cofondateur fait le reste. |
| RBAC-05 | Navigation UI masquée selon permissions | M | 3 | 2-3j | Cofondateur | Hook `usePermissions()` côté React, `canUser()` basé sur les permissions du token. Items masqués du DOM (pas grisés). Impacte sidebar, menus contextuels, boutons d'action. |
| RBAC-06 | UI admin matrice permissions + page rôles | M | 3 | 2-3j | Cofondateur | Composants shadcn/ui : PermissionMatrix (grille checkboxes), RoleSelector (dropdown), page /admin/roles. Pattern CRUD standard. |
| RBAC-07 | Badges couleur par rôle | S | 1 | 0.5j | Cofondateur | Composant Badge shadcn/ui avec variant par rôle. Trivial. |

**Risques Epic 2** :
- RBAC-01 est un **prérequis sécurité** — doit être fait AVANT toute autre story RBAC
- RBAC-04 est volumineuse et doit être splittée pour la review (par lots de 5-6 routes)
- Régression possible : chaque route modifiée nécessite un test d'intégration

**Dépendances** :
- RBAC-01 bloque toutes les autres stories RBAC
- Epic 1 (MU-07 PostgreSQL externe) doit être terminée avant les migrations RBAC

---

### 2.3 Epic 3 — Scoping par Projet (FR-PROJ)

**Total Epic : 13-16 SP | ~1-1.5 semaine (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| PROJ-01 | Table project_memberships + migration | S | 2 | 1j | Tom | Nouvelle table Drizzle : id, userId, projectId, companyId, role, grantedBy, createdAt. Relations → users, projects, companies. Migration straightforward. |
| PROJ-02 | Service project-memberships.ts | M | 3 | 2-3j | Tom | CRUD complet + validation scope JSONB dans hasPermission(). Intégration avec le fix RBAC-01. Filtrage des projets visibles par user. |
| PROJ-03 | Filtrage agents/issues par scope projet | M | 5 | 3-5j | Tom | Modification de agents.ts (22782 lignes service, 52248 lignes routes) et issues.ts (50807 lignes service). Ajout de WHERE projectId IN (user_project_ids) sur toutes les queries. **Attention** : ces fichiers sont massifs, risque de régression élevé. Tests d'intégration obligatoires. |
| PROJ-04 | Page ProjectAccess.tsx | M | 3 | 2-3j | Cofondateur | UI de gestion d'accès par projet : liste membres, ajout/retrait, sélection rôle. Composant shadcn/ui standard avec React Query. |

**Risques Epic 3** :
- PROJ-03 touche aux deux plus gros fichiers du projet (agents.ts, issues.ts) — splitting en sous-PRs recommandé
- Interaction complexe entre scope JSONB et project_memberships — bien tester les cas limites (scope null = accès global, scope avec projectIds, etc.)

---

### 2.4 Epic 4 — Orchestrateur Déterministe (FR-ORCH)

**Total Epic : 29-36 SP | ~3-3.5 semaines (2 devs, principalement Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| ORCH-01 | State machine workflow-state-machine.ts | L | 8 | 5-7j | Cofondateur | **Nouveau système complet.** 12 transitions (CREATED→READY→IN_PROGRESS→VALIDATING→COMPLETED + PAUSED/FAILED/COMPACTING/SKIPPED). Guards sur chaque transition. Persistance état dans stage_instances. Base existante : workflow_templates + instances + stage_instances (3 tables) et workflows.ts service (266 lignes). Le service existant est un CRUD simple — il faut ajouter toute la logique d'enforcement. |
| ORCH-02 | WorkflowEnforcer + fichiers obligatoires | L | 8 | 5-7j | Cofondateur | Vérification fichiers obligatoires avant transition. Injection pré-prompts par étape. Persistance résultats intermédiaires. Intégration avec la state machine ORCH-01. Nouveau fichier workflow-enforcer.ts ~300-500 lignes. |
| ORCH-03 | Validation humaine configurable (HITL) | M | 5 | 3-4j | Cofondateur | Extension du système approvals existant (approvals.ts, 7614 lignes service). Ajout d'un step de validation humaine configurable par étape de workflow. WebSocket notification pour demande d'approbation. |
| ORCH-04 | API routes orchestrateur | M | 3 | 2-3j | Tom | POST /workflows/:id/enforce, GET /drift/alerts, POST /drift/alerts/:id/resolve. Routes Express standard avec auth + RBAC. |
| ORCH-05 | UI éditeur de workflow drag-and-drop | M | 5 | 3-5j | Cofondateur | Composant React : drag-and-drop d'étapes, configuration prompts/fichiers par étape, preview. Librairie dnd-kit ou react-beautiful-dnd. **P1 — peut être reporté au Sprint 3.** |

**Risques Epic 4** :
- **Risque majeur** : la state machine est le coeur du produit MnM (ADR-003). Si elle est mal conçue, tout le flux workflow est compromis.
- Le Cofondateur technique doit avoir une solide expérience des state machines (XState ou équivalent).
- L'intégration avec le heartbeat existant (2396 lignes, monolithique) sera délicate.

---

### 2.5 Epic 5 — Drift Detection (FR-DRIFT)

**Total Epic : 13-16 SP | ~1.5-2 semaines (principalement Tom)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| DRIFT-01 | Fix drift en mémoire → persistance DB | M | 3 | 2-3j | Tom | **DETTE TECHNIQUE (DT2)**. drift.ts (405 lignes) utilise `reportCache = new Map()` — perdu au restart. Besoin : tables drift_reports + drift_items dans PostgreSQL. Migration des données in-memory vers DB. Tom connaît bien ce code. |
| DRIFT-02 | Drift monitor service | M | 5 | 3-5j | Tom | Nouveau service drift-monitor.ts : comparaison attendu (workflow template) vs observé (heartbeat events). Alertes temps réel via WebSocket (live-events.ts existant). Intégration avec la state machine ORCH-01. |
| DRIFT-03 | UI diff visuel drift | M | 5 | 3-5j | Cofondateur | Composant DriftAlert.tsx : vue comparée attendu/observé, diff visuel (similaire à un git diff), actions (recharger, kill+relance, ignorer). Notification badge dans sidebar. |

**Risques Epic 5** :
- Dépend de l'Epic 4 (state machine) pour la comparaison attendu/observé
- Le drift-analyzer.ts existant (6787 lignes) est déjà complexe — attention à ne pas le dupliquer

---

### 2.6 Epic 6 — Observabilité & Audit (FR-OBS)

**Total Epic : 18-22 SP | ~2-2.5 semaines (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| OBS-01 | Table audit_events + migration | M | 5 | 3-4j | Tom | **Table critique.** Partitionnée par mois (PARTITION BY RANGE createdAt). TRIGGER deny UPDATE/DELETE. Colonnes : companyId, actorId, actorType, action, targetType, targetId, metadata JSONB, ipAddress, prevHash, createdAt. Rôles PostgreSQL séparés (mnm_app vs mnm_audit_admin). Plus complexe qu'une migration standard à cause du partitionnement et des triggers. |
| OBS-02 | Service audit.ts + emission systématique | M | 5 | 3-5j | Tom | Service centralisé pour émettre des audit events depuis toutes les routes. Intégration avec les 22 fichiers de routes. Pattern : middleware ou helper `emitAudit(action, target, metadata)`. Volume de travail mécanique mais important. |
| OBS-03 | Résumé LLM actions agent (<5s) | M | 3 | 2-3j | Tom | audit-summarizer.ts : appel Haiku pour traduire les logs techniques en langage naturel. Intégration avec heartbeat_run_events. Cache Redis pour éviter les appels LLM redondants. Tom connaît bien le heartbeat. |
| OBS-04 | UI AuditLog.tsx + filtres + export | M | 5 | 3-5j | Cofondateur | Composant DataTable avec 12 filtres (acteur, action, target, date range, company, etc.). Export CSV/JSON. Virtualisation TanStack Virtual pour les grandes listes. Pattern similaire à la page issues existante. |

**Risques Epic 6** :
- Le partitionnement PostgreSQL (OBS-01) est une opération DB avancée — à tester en staging avant production
- L'émission systématique (OBS-02) impacte toutes les routes — risque de régression sur les performances

---

### 2.7 Epic 7 — Chat Temps Réel (FR-CHAT)

**Total Epic : 18-23 SP | ~2-2.5 semaines (2 devs)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| CHAT-01 | WebSocket bidirectionnel | L | 8 | 5-7j | Tom | **DETTE TECHNIQUE (DT3)**. live-events.ts actuel = 40 lignes, unidirectionnel (serveur→client). Besoin : protocole de messages typé bidirectionnel, routing par channelId, authentification WebSocket. Extension majeure du système WebSocket existant. Tom connaît ce code. |
| CHAT-02 | Tables chat_channels + chat_messages | S | 2 | 1j | Tom | 2 tables Drizzle : chat_channels (id, agentId, heartbeatRunId, companyId, status), chat_messages (id, channelId, senderId, senderType, content, createdAt). Migration standard. |
| CHAT-03 | ChatService + pipe stdin agent | M | 5 | 3-5j | Tom | Service chat-service.ts : réception message WebSocket → persistance DB → pipe vers stdin de l'agent containerisé. Reconnexion avec buffer 30s. Rate limiting 10 msg/min. Dépend de la containerisation (Epic 8) pour le pipe stdin. |
| CHAT-04 | AgentChatPanel.tsx + useAgentChat hook | M | 3 | 2-3j | Cofondateur | Composant React : panel de chat dans la vue agent, messages en temps réel, indicateur de frappe, scroll auto. Hook useAgentChat avec WebSocket client. Pattern existant dans les composants issues. |

**Risques Epic 7** :
- CHAT-03 dépend de la containerisation (Epic 8) pour le pipe stdin → **dépendance forte**
- WebSocket bidirectionnel (CHAT-01) est une transformation architecturale, pas un simple ajout
- Reconnexion avec sync messages manqués est un problème classiquement sous-estimé

---

### 2.8 Epic 8 — Containerisation (FR-CONT)

**Total Epic : 34-42 SP | ~3.5-4.5 semaines (principalement Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| CONT-01 | ContainerManager + Docker API | XL | 13 | 2-3 sem | Cofondateur | **Le plus gros chantier technique du projet.** Nouveau dossier server/src/adapters/docker/. Intégration dockerode. Lifecycle complet : create → start → monitor → stop → cleanup. 4 profils de ressources (light/standard/heavy/gpu). Container éphémère `--rm --read-only --no-new-privileges`. Interaction avec l'adapter pattern existant (8 types dans packages/adapters/). |
| CONT-02 | Credential Proxy HTTP | L | 8 | 5-7j | Cofondateur | Nouveau service credential-proxy.ts. Serveur HTTP interne (port 8090). Résolution secrets via le provider existant (secrets.ts, 4 providers : local/AWS/GCP/Vault). Mount bind `/dev/null` sur `.env` dans le container. Pattern Nanoclaw. |
| CONT-03 | Mount allowlist tamper-proof | M | 5 | 3-4j | Cofondateur | Validation `realpath()` + interdiction symlinks + blocage null bytes + URL encoding. Configuration allowlist par company dans container_profiles. Tests de sécurité exhaustifs (path traversal). |
| CONT-04 | Isolation réseau Docker | M | 3 | 2-3j | Cofondateur | Bridge Docker par company. Pas de communication inter-company. Configuration réseau dans docker-compose. |
| CONT-05 | Tables container_profiles + container_instances | S | 2 | 1j | Tom | 2 tables Drizzle + migration. container_profiles (name, cpu, memory, disk, timeout, mountAllowlist, companyId), container_instances (profileId, agentId, containerId, status, startedAt, stoppedAt). |
| CONT-06 | UI ContainerStatus.tsx | M | 3 | 2-3j | Cofondateur | Composant : statut container en temps réel, métriques CPU/RAM, logs, boutons start/stop. Intégration WebSocket pour les updates live. |

**Risques Epic 8** :
- **Risque technique le plus élevé de tout le projet.** Docker en production avec isolation sécurisée est un domaine où les erreurs sont coûteuses.
- Le Cofondateur technique DOIT avoir de l'expérience Docker/containerisation en production.
- La credential proxy (CONT-02) est security-critical — revue de sécurité obligatoire.
- Interaction avec le système d'adapters existant (packages/adapters/) peut être complexe — les 8 types d'adapters doivent tous fonctionner en mode containerisé.
- **Spike technique recommandé** (2-3 jours) avant de commencer : POC container éphémère + credential proxy basique.

---

### 2.9 Epic 9 — Gestion Compaction (FR-COMP)

**Total Epic : 21-26 SP | ~2.5-3 semaines (Cofondateur, support Tom)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| COMP-01 | CompactionWatcher — détection | L | 8 | 5-7j | Cofondateur | **RIEN N'EXISTE.** Monitoring des heartbeats pour détecter la compaction (réduction soudaine de contexte). Intégration avec heartbeat.ts (2396 lignes, monolithique — DT7). Heuristiques de détection à définir. |
| COMP-02 | Stratégie kill+relance | L | 8 | 5-7j | Cofondateur | Kill agent → relance avec contexte frais + résultats intermédiaires déjà produits. Table compaction_snapshots pour sauvegarder l'état pré-compaction. Circuit breaker : max 3 relances par session. |
| COMP-03 | Stratégie réinjection post-compaction | M | 5 | 3-5j | Cofondateur | Réinjection pré-prompts + définition workflow après détection compaction. Alternative au kill+relance pour les cas où la compaction est partielle. Configurable par étape de workflow. |

**Risques Epic 9** :
- **C'est le risque le plus critique du projet** (ADR-008, hypothèse H-T1).
- La détection de compaction est heuristique — pas de signal clair des LLM providers.
- **Spike technique obligatoire** (1 semaine) avant de commencer : observer le comportement de compaction sur Claude, GPT-4, etc.
- L'interaction avec heartbeat.ts monolithique (2396 lignes) est un risque en soi (DT7).

---

### 2.10 Epic 10 — Curseur d'Automatisation (FR-DUAL)

**Total Epic : 10-13 SP | ~1-1.5 semaine (Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| DUAL-01 | Table automation_cursors + service | M | 5 | 3-4j | Cofondateur | Nouvelle table : id, level (action/agent/project/company), position (manual/assisted/auto), targetId, companyId, ceiling. Service avec logique de hiérarchie : plafond supérieur l'emporte (CEO > CTO > Manager > Contributeur). |
| DUAL-02 | UI curseur 3 positions | M | 3 | 2-3j | Cofondateur | Composant slider 3 positions avec label. Intégré dans les paramètres agent, projet, et company. Affichage du plafond imposé par la hiérarchie. |
| DUAL-03 | Enforcement curseur dans workflow | S | 2 | 1-2j | Cofondateur | Intégration avec la state machine (ORCH-01) : si curseur=manuel → validation humaine systématique. Si curseur=assisté → suggestion + validation. Si curseur=auto → exécution directe. |

---

### 2.11 Epic 11 — SSO (FR-SSO)

**Total Epic : 8-10 SP | ~1 semaine (Tom)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| SSO-01 | Table sso_configurations + config | S | 2 | 1j | Tom | Table Drizzle : id, companyId, provider (saml/oidc), config JSONB, enabled. Migration standard. |
| SSO-02 | Better Auth plugins SAML/OIDC | M | 3 | 2-3j | Tom | Intégration plugins Better Auth. Config dynamique par company (chaque company peut avoir son propre IdP). Flux : user → login page → redirect IdP → callback → création/mapping user → session. |
| SSO-03 | UI configuration SSO | M | 3 | 2-3j | Cofondateur | Formulaire admin : choix provider (SAML/OIDC), champs de configuration (entity ID, SSO URL, certificate, etc.), bouton de test, statut connexion. Guide pas-à-pas intégré. |

**Risques Epic 11** :
- Dépend des plugins Better Auth disponibles — vérifier la maturité de l'écosystème plugins
- Test SSO nécessite un IdP de test (Keycloak ou similaire) dans docker-compose

---

### 2.12 Epic 12 — Dashboards par Rôle (FR-DASH)

**Total Epic : 10-13 SP | ~1-1.5 semaine (Cofondateur)**

| Story | Description | Taille | SP | Effort | Assignation | Justification |
|-------|-------------|--------|-----|--------|-------------|---------------|
| DASH-01 | API dashboards agrégés | M | 5 | 3-4j | Tom | Endpoints GET /dashboards/:type (executive, technical, operational). Queries agrégées avec k-anonymity (k=5). Vues matérialisées PostgreSQL avec GROUP BY obligatoire. Interdiction architecturale du drill-down individuel (Vérité #20). |
| DASH-02 | DashboardCards.tsx par rôle | M | 3 | 2-3j | Cofondateur | Composants : cards KPI, graphiques (recharts ou visx), filtres par période. Vue différente par rôle : CEO (vue stratégique), CTO (vue technique), Manager (vue opérationnelle). |
| DASH-03 | Dashboard temps réel via WebSocket | S | 2 | 1-2j | Tom | Push updates dashboard via WebSocket existant. Rafraîchissement automatique des métriques toutes les 30s. |

---

## 3. Stories Techniques Manquantes (Infrastructure)

Ces stories ne correspondent à aucun FR mais sont **indispensables** pour que le projet fonctionne.

| # | Story | Taille | SP | Effort | Assignation | Justification | Bloque |
|---|-------|--------|-----|--------|-------------|---------------|--------|
| TECH-01 | Docker Compose dev/test/prod | M | 5 | 3-4j | Tom | docker-compose.dev.yml (PostgreSQL 16, Redis 7, server, ui), docker-compose.test.yml (PostgreSQL de test), Dockerfile server + ui. **Prérequis pour toute containerisation.** | Epic 8 |
| TECH-02 | CI/CD Pipeline GitHub Actions | L | 8 | 5-7j | Tom | Pipeline complet : QG-0 (lint+TS) → QG-1 (unit) → QG-2 (integration) → QG-3 (security) → QG-4 (perf) → QG-5 (E2E) → QG-6 (review). Caching pnpm, Docker layers, Cypress binary. ~15-22 min. | Déploiement |
| TECH-03 | Infrastructure de test (factories + seed) | M | 5 | 3-4j | Tom | Factories TypeScript : createTestUser(), createTestCompany(), createTestAgent(), createTestWorkflow(). Seed E2E pour Cypress. Embedded-postgres pour tests d'intégration. Pattern mock : mocker LLM providers, JAMAIS la DB. | Tous les tests |
| TECH-04 | Redis setup + session/cache | M | 3 | 2-3j | Tom | Redis pour : sessions (au lieu de DB), query cache, WebSocket pub/sub (multi-instance), rate limiting. docker-compose + config Node. | Performance, scaling |
| TECH-05 | RLS PostgreSQL (14 tables) | L | 8 | 5-7j | Tom | **Story de sécurité critique.** CREATE POLICY sur 14 tables (toutes sauf user, session, account, verification, instance_user_roles, migrations, assets, inbox_dismissals). SET LOCAL app.current_company_id au début de chaque requête. Tests d'isolation cross-company. | Multi-tenant |
| TECH-06 | Migration DB : 10 nouvelles tables | M | 5 | 3-4j | Tom | Création des 10 tables listées dans le domain model (Section 5.3 PRD). Migration Drizzle avec rollback scripts. Seed de données de test. | Toutes les epics |
| TECH-07 | Migration DB : colonnes ajoutées sur 5 tables | S | 2 | 1j | Tom | companies (+tier, ssoEnabled, maxUsers, parentCompanyId), company_memberships (+businessRole), agents (+containerProfileId, isolationMode), principal_permission_grants (+9 keys), activity_log (+ipAddress, userAgent, severity). | Epic 2, 3 |
| TECH-08 | Refactoring heartbeat.ts (2396 → modules) | M | 5 | 3-5j | Tom | **DETTE TECHNIQUE (DT7)**. Splitting en modules : heartbeat-core.ts, heartbeat-events.ts, heartbeat-compaction.ts, heartbeat-metrics.ts. Nécessaire avant d'intégrer le CompactionWatcher (Epic 9). | Epic 9 |

**Total Stories Techniques : 41 SP | ~4-5 semaines**

---

## 4. Dette Technique à Résoudre AVANT le Sprint

| # | Dette | Sévérité | SP | Effort | Sprint | Justification |
|---|-------|----------|-----|--------|--------|---------------|
| DT1 | hasPermission() ignore scope JSONB | **CRITIQUE** | 3 | 2j | Sprint 1 | Trou de sécurité. Doit être fixé AVANT toute extension RBAC. Inclus dans RBAC-01. |
| DT2 | Drift en mémoire (Map) | Élevée | 3 | 2-3j | Sprint 1-2 | Données perdues au restart. Inclus dans DRIFT-01. |
| DT3 | WebSocket unidirectionnel | Moyenne | 8 | 5-7j | Sprint 2-3 | Bloque le chat temps réel. Inclus dans CHAT-01. |
| DT4 | 6 permission keys seulement | Moyenne | 2 | 1j | Sprint 1 | Insuffisant pour RBAC métier. Inclus dans RBAC-02. |
| DT5 | Activity log sans query/filtrage | Faible | 5 | 3-4j | Sprint 2 | Inclus dans OBS-01/02 (remplacement par audit_events). |
| DT6 | Pas de tests automatisés | Moyenne | 5 | 3-5j | Sprint 1 | Vitest configuré mais 0 tests. Inclus dans TECH-03. |
| DT7 | heartbeat.ts monolithique (2396 lignes) | Faible | 5 | 3-5j | Sprint 2-3 | Bloque intégration compaction. Inclus dans TECH-08. |

**Total dette : ~31 SP** — la plupart est absorbée dans les stories fonctionnelles.

---

## 5. Dépendances Techniques Inter-Stories

### 5.1 Graphe de Dépendances Critique

```
TECH-01 (Docker Compose) ─────────────────────────────────────┐
     │                                                         │
     ▼                                                         ▼
MU-07 (PostgreSQL externe) ──► TECH-06 (10 tables) ──► TECH-05 (RLS)
     │                              │
     ▼                              ▼
RBAC-01 (fix scope) ──► RBAC-04 (enforcement routes)
     │                       │
     ▼                       ▼
PROJ-01/02 (project scope)  OBS-02 (audit emission)
     │
     ▼
ORCH-01 (state machine) ──► ORCH-02 (enforcer) ──► DRIFT-02 (monitor)
     │                                                  │
     ▼                                                  ▼
COMP-01 (compaction watcher)                     DRIFT-03 (UI diff)

TECH-01 (Docker Compose) ──► CONT-01 (ContainerManager)
                                  │
                                  ├──► CONT-02 (Credential Proxy)
                                  │
                                  └──► CHAT-03 (pipe stdin agent)
```

### 5.2 Chemins Critiques

**Chemin A (Product/RBAC)** — Tom principalement :
```
MU-07 → TECH-06/07 → RBAC-01 → RBAC-02 → RBAC-04 → PROJ-01 → PROJ-03
Durée : ~5-6 semaines
```

**Chemin B (Orchestration/Agents)** — Cofondateur principalement :
```
TECH-01 → CONT-01 → CONT-02 → ORCH-01 → ORCH-02 → COMP-01 → COMP-02
Durée : ~8-10 semaines
```

**Le chemin B est le chemin critique du projet** — la containerisation + orchestration + compaction définissent la durée totale.

---

## 6. Répartition Tom vs Cofondateur

### 6.1 Tom (Cofondateur existant — Backend + Observabilité)

Tom connaît la codebase, donc il prend :
- **Infra & migrations** : TECH-01 à TECH-08, MU-07
- **RBAC backend** : RBAC-01, RBAC-02, RBAC-04 (routes critiques)
- **Observabilité** : OBS-01, OBS-02, OBS-03, DRIFT-01
- **WebSocket & Chat backend** : CHAT-01, CHAT-02, CHAT-03
- **SSO backend** : SSO-01, SSO-02
- **API routes** : ORCH-04, DASH-01, DASH-03, CONT-05

**Charge Tom : ~115-140 SP | ~12-14 semaines full-time**

### 6.2 Cofondateur Technique (À recruter — Orchestration + Agents + Frontend)

Le Cofondateur technique prend les systèmes nouveaux qui ne requièrent pas de connaissance historique de la codebase :
- **Containerisation** : CONT-01, CONT-02, CONT-03, CONT-04, CONT-06
- **Orchestration** : ORCH-01, ORCH-02, ORCH-03, ORCH-05
- **Compaction** : COMP-01, COMP-02, COMP-03
- **Frontend** : MU-02, MU-04, RBAC-03, RBAC-05, RBAC-06, RBAC-07, PROJ-04, DRIFT-03, OBS-04, CHAT-04, SSO-03, DASH-02, DUAL-01/02/03

**Charge Cofondateur : ~110-135 SP | ~11-14 semaines full-time**

### 6.3 Points de Sync Obligatoires

| Semaine | Sujet | Participants |
|---------|-------|-------------|
| S1 | Setup Docker + PostgreSQL + premiers tests | Tom + Cofondateur |
| S2 | Review RBAC-01 (fix sécurité scope) | Tom → Cofondateur review |
| S4 | Intégration state machine + heartbeat | Cofondateur → Tom review |
| S6 | Review credential proxy + container security | Cofondateur → Tom + externe |
| S8 | POC compaction : spike technique 1 semaine | Les deux devs ensemble |
| S10 | Intégration complète + smoke tests | Les deux devs ensemble |

---

## 7. Velocity et Planification par Sprint

### 7.1 Hypothèses de Velocity

| Paramètre | Valeur | Justification |
|-----------|--------|---------------|
| Durée sprint | 2 semaines | Standard Scrum |
| SP par dev par sprint | 15-20 | Conservateur — nouveau cofondateur, codebase complexe, transformation majeure |
| SP équipe par sprint | 30-40 | 2 devs, pas de parallélisme parfait |
| Buffer imprévus | 20% | Bugs, debugging, montée en charge cofondateur |
| SP utiles par sprint | 24-32 | Après buffer |

### 7.2 Total Story Points

| Catégorie | SP Min | SP Max |
|-----------|--------|--------|
| Epic 1 — Multi-User | 16 | 19 |
| Epic 2 — RBAC | 21 | 26 |
| Epic 3 — Scoping Projet | 13 | 16 |
| Epic 4 — Orchestrateur | 29 | 36 |
| Epic 5 — Drift Detection | 13 | 16 |
| Epic 6 — Observabilité | 18 | 22 |
| Epic 7 — Chat | 18 | 23 |
| Epic 8 — Containerisation | 34 | 42 |
| Epic 9 — Compaction | 21 | 26 |
| Epic 10 — Curseur | 10 | 13 |
| Epic 11 — SSO | 8 | 10 |
| Epic 12 — Dashboards | 10 | 13 |
| Stories Techniques | 41 | 45 |
| **TOTAL** | **252** | **307** |

### 7.3 Durée Estimée

| Scénario | SP/sprint | Sprints nécessaires | Durée |
|----------|-----------|--------------------|----- |
| Optimiste | 32 SP/sprint | 8 sprints | **16 semaines** |
| Réaliste | 26 SP/sprint | 10-11 sprints | **20-22 semaines** |
| Pessimiste | 20 SP/sprint | 13-15 sprints | **26-30 semaines** |

### 7.4 Proposition de Sprint Plan (Scénario Réaliste)

| Sprint | Semaines | Focus | SP cible | Stories principales |
|--------|----------|-------|---------|---------------------|
| **Sprint 0** | S1-S2 | Infrastructure | 28 | TECH-01, TECH-03, TECH-06, TECH-07, MU-07, MU-05, MU-06 |
| **Sprint 1** | S3-S4 | RBAC + Multi-User | 30 | RBAC-01, RBAC-02, RBAC-03, RBAC-04, MU-01, MU-02, MU-03, MU-04 |
| **Sprint 2** | S5-S6 | Scoping + Orchestrateur v1 | 28 | PROJ-01/02/03/04, ORCH-01, ORCH-02 |
| **Sprint 3** | S7-S8 | Orchestrateur v2 + Drift | 30 | ORCH-03, ORCH-04, DRIFT-01, DRIFT-02, DRIFT-03, TECH-05 (RLS) |
| **Sprint 4** | S9-S10 | Containerisation P1 | 26 | CONT-01 (spike + impl), CONT-05, TECH-08 (heartbeat refactor) |
| **Sprint 5** | S11-S12 | Containerisation P2 + Chat | 30 | CONT-02, CONT-03, CONT-04, CHAT-01, CHAT-02 |
| **Sprint 6** | S13-S14 | Chat + Observabilité | 28 | CHAT-03, CHAT-04, OBS-01, OBS-02, OBS-03 |
| **Sprint 7** | S15-S16 | Observabilité + SSO | 26 | OBS-04, SSO-01, SSO-02, SSO-03, CONT-06 |
| **Sprint 8** | S17-S18 | Compaction (spike + impl) | 26 | COMP-01, COMP-02, COMP-03 |
| **Sprint 9** | S19-S20 | Curseur + Dashboards + Polish | 25 | DUAL-01/02/03, DASH-01/02/03, ORCH-05, TECH-02 (CI/CD) |
| **Sprint 10** | S21-S22 | Stabilisation + Tests E2E | 20 | TECH-04 (Redis), smoke tests, performance, bug fixes |

**Jalon CBA (juin 2026)** : Après Sprint 5 (~S12 = début juin), le MVP est **vendable** avec : multi-user, RBAC, scoping, orchestrateur v1, drift basique, containerisation P1. C'est le moment de la démo CBA.

---

## 8. Faisabilité — Ce qui est Simple vs Complexe

### 8.1 Simple (Pattern existant, modification incrémentale)

| Story | Pourquoi c'est simple |
|-------|----------------------|
| MU-05, MU-06 | Flag boolean + endpoint existant. <1j chacun. |
| RBAC-02, RBAC-07 | Constants + CRUD UI. Pattern existant dans la codebase. |
| RBAC-03 | Migration colonne simple. 1h de code, 2h de tests. |
| PROJ-01, CHAT-02, CONT-05, SSO-01 | Nouvelles tables Drizzle. Pattern identique aux 38 tables existantes. |
| DUAL-03 | If/else dans la state machine. Trivial si ORCH-01 est bien conçu. |

### 8.2 Modéré (Nouveau code mais pattern connu)

| Story | Pourquoi c'est modéré |
|-------|----------------------|
| MU-01 | Infra email à choisir (Resend vs Nodemailer), mais le flow est classique. |
| RBAC-01 | Fix bien défini (ADR-002), mais impacte toute la sécurité. |
| RBAC-04 | Volume de travail (22 fichiers) mais chaque modification est mécanique. |
| OBS-01 | Partitionnement PostgreSQL est avancé mais bien documenté. |
| SSO-02 | Dépend de la maturité des plugins Better Auth — risque si immature. |

### 8.3 Complexe (Nouveau système, R&D nécessaire)

| Story | Pourquoi c'est complexe |
|-------|------------------------|
| ORCH-01 | State machine de 12 transitions avec guards. Coeur du produit. Aucune erreur permise. |
| CONT-01 | Docker en production avec isolation sécurisée. Domaine spécialisé. |
| CONT-02 | Credential proxy HTTP security-critical. Erreur = fuite de secrets. |
| COMP-01/02 | **Le plus complexe du projet.** Détection compaction = heuristique, pas de signal clair. Spike obligatoire. |
| CHAT-01 | Transformation WebSocket unidirectionnel → bidirectionnel. Impact toute l'architecture real-time. |

### 8.4 Risque R&D (Spike recommandé)

| Sujet | Durée spike | Objectif | Décision si échec |
|-------|------------|---------|-------------------|
| Compaction detection | 1 semaine | Observer comportement compaction sur 3 LLMs | Report compaction à post-MVP, focus sur monitoring basique |
| Container + credential proxy POC | 2-3 jours | Prouver que le pattern Nanoclaw fonctionne avec dockerode | Évaluer alternative (processus isolés au lieu de containers) |
| SSO Better Auth | 1 jour | Vérifier maturité plugins SAML/OIDC | Si immature → implémentation custom ou librairie tierce (passport-saml) |

---

## 9. Recommandations

### 9.1 Priorités Sprint 0 et 1

1. **TECH-01 + MU-07** en premier — sans PostgreSQL externe et Docker, rien ne fonctionne
2. **RBAC-01** en deuxième — le trou de sécurité scope JSONB doit être corrigé immédiatement
3. **TECH-03** en parallèle — l'infrastructure de test conditionne la qualité de tout le reste

### 9.2 Décisions à Prendre Maintenant

| Décision | Options | Recommandation |
|----------|---------|----------------|
| Service email | Resend (SaaS) vs Nodemailer (self-hosted) | **Resend** pour le MVP (rapide à intégrer, transactional emails) |
| State machine lib | Custom vs XState vs Robot | **XState** — mature, typé, visualiseur intégré |
| Drag-and-drop UI | dnd-kit vs react-beautiful-dnd | **dnd-kit** — plus moderne, mieux maintenu |
| Redis provider | Upstash (serverless) vs Redis self-hosted | **Self-hosted** en dev (docker-compose), Upstash en production |
| LLM provider pour résumés | Haiku direct vs abstraction multi-provider | **Haiku direct** pour le MVP, abstraction en post-MVP |

### 9.3 Ce qui peut être Reporté au Post-MVP

| Story | Raison du report | Impact |
|-------|-----------------|--------|
| ORCH-05 (UI drag-and-drop workflow) | P1, éditeur YAML suffit pour le MVP CBA | Faible — CTO CBA peut configurer en YAML |
| COMP-03 (réinjection post-compaction) | P1, kill+relance suffit pour le MVP | Moyen — fonctionnel mais moins élégant |
| DASH-02/03 (dashboards temps réel) | P1, des dashboards statiques suffisent | Faible — refresh manuel acceptable |
| SSO-01/02/03 | P1 Enterprise, pas nécessaire pour le POC CBA | Nul pour le POC — CBA utilise email/password |
| OBS-03 (résumé LLM) | P1, les logs techniques bruts suffisent pour le MVP | Moyen — expérience dégradée mais fonctionnelle |

**En reportant ces stories (~25-30 SP), le MVP CBA tombe à ~220-275 SP soit 8-10 sprints (16-20 semaines).**

### 9.4 Alerte sur la Timeline PRD

Le PRD annonce **8-10 semaines**. Mon estimation réaliste est **20-22 semaines (2 devs)**. La divergence s'explique par :

1. Les **stories techniques** (41 SP) ne sont pas comptées dans le PRD
2. La **dette technique** (DT1-DT7) n'est pas comptée
3. Le **temps de montée en charge du cofondateur technique** (2-4 semaines pour être productif sur la codebase)
4. Les **spikes R&D** (compaction, container POC) ne sont pas comptés
5. Les **tests et CI/CD** ne sont pas comptés

**Pour respecter la deadline CBA (juin 2026)**, il faut :
- Reporter SSO, dashboards avancés, et résumé LLM au post-MVP
- Focus Sprint 0-5 (12 semaines) sur le core : multi-user, RBAC, orchestrateur, containerisation v1
- Accepter un MVP "rugueux" pour le POC CBA et polir en Sprint 6-10

---

*~4000 mots — Estimation détaillée par story, stories techniques identifiées, dépendances, répartition devs, velocity, sprint plan 10 sprints, analyse faisabilité, recommandations.*
