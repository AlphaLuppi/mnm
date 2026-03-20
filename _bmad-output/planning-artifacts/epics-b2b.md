# Epics B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 1.0 | **Date** : 2026-03-14 | **Statut** : Final
> **Auteurs** : Bob (SM Lead), Winston (Architecte), John (PM), Amelia (Dev), Quinn (QA), Sally (UX), Murat (TEA)
> **Sources** : PRD B2B v1.0, Architecture B2B v1.0, UX Design B2B v1.0, Product Brief B2B v2.0

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Epic 0 — Infrastructure & Setup](#2-epic-0--infrastructure--setup)
3. [Epic MU — Multi-User & Auth](#3-epic-mu--multi-user--auth)
4. [Epic RBAC — Rôles & Permissions](#4-epic-rbac--rôles--permissions)
5. [Epic PROJ — Scoping par Projet](#5-epic-proj--scoping-par-projet)
6. [Epic ORCH — Orchestrateur Déterministe (Noyau A)](#6-epic-orch--orchestrateur-déterministe)
7. [Epic DRIFT — Drift Detection](#7-epic-drift--drift-detection)
8. [Epic OBS — Observabilité & Audit (Noyau B)](#8-epic-obs--observabilité--audit)
9. [Epic ONB — Onboarding Cascade (Noyau C)](#9-epic-onb--onboarding-cascade)
10. [Epic A2A — Agent-to-Agent + Permissions (Noyau D)](#10-epic-a2a--agent-to-agent--permissions)
11. [Epic DUAL — Dual-Speed Workflow (Noyau E)](#11-epic-dual--dual-speed-workflow)
12. [Epic CHAT — Chat Temps Réel](#12-epic-chat--chat-temps-réel)
13. [Epic CONT — Containerisation](#13-epic-cont--containerisation)
14. [Epic COMP — Gestion Compaction](#14-epic-comp--gestion-compaction)
15. [Epic DASH — Dashboards par Rôle](#15-epic-dash--dashboards-par-rôle)
16. [Epic SSO — Enterprise Auth](#16-epic-sso--enterprise-auth)
17. [Graphe de Dépendances Global](#17-graphe-de-dépendances-global)
18. [Matrice de Priorisation](#18-matrice-de-priorisation)
19. [Split Cofondateurs](#19-split-cofondateurs)
20. [Récapitulatif Quantitatif](#20-récapitulatif-quantitatif)

---

## 1. Vue d'ensemble

### 1.1 Structure des Epics

**16 epics** décomposées en **~65 stories** couvrant 100% des 52 Functional Requirements du PRD.

| Catégorie | Epics | Stories | SP estimés |
|-----------|-------|---------|-----------|
| **Infrastructure** | Epic 0 (INFRA/TECH) | 8 | 41 |
| **Fondations** | MU, RBAC, PROJ | 18 | 50-61 |
| **Noyau A** | ORCH, DRIFT, COMP | 11 | 63-78 |
| **Noyau B** | OBS, DASH | 7 | 28-35 |
| **Noyau C** | ONB | 4 | 13-16 |
| **Noyau D** | A2A | 4 | 16-21 |
| **Noyau E** | DUAL | 3 | 10-13 |
| **Transverses** | CHAT, CONT, SSO | 14 | 60-75 |
| **TOTAL** | **16** | **~69** | **252-307** |

### 1.2 5 Noyaux de Valeur

| Noyau | Nom | Assignation | Epics |
|-------|-----|------------|-------|
| **A** | Orchestrateur Déterministe | **Cofondateur** | ORCH, DRIFT, COMP |
| **B** | Observabilité & Audit | **Tom** | OBS, DASH |
| **C** | Onboarding Cascade | **Tom** | ONB |
| **D** | Agent-to-Agent + Permissions | **Cofondateur** | A2A |
| **E** | Dual-Speed Workflow | **Partagé** | DUAL |

### 1.3 Timeline

- **Sprint 0** : 1 semaine — Infrastructure
- **Sprints 1-6** : 6 × 2 semaines — Développement
- **Total** : ~13 semaines calendaires
- **Deadline** : Démo CBA juin 2026

### 1.4 Alerte Timeline (Amelia)

Le PRD annonce 8-10 semaines. L'estimation réaliste est **20-22 semaines** avec 2 devs. La divergence vient des stories techniques (41 SP), de la dette technique, de la montée en charge du cofondateur, des spikes R&D, et des tests non comptés. **Pour respecter CBA** : focus strict MUST-HAVE, MVP "rugueux" après Sprint 5 (~S12), polish en S6-10.

---

## 2. Epic 0 — Infrastructure & Setup

**Objectif** : Poser les bases techniques et UX pour tout le développement B2B.
**Phase PRD** : Sprint 0 (prérequis)
**FRs couverts** : REQ-MU-07 (PostgreSQL), infrastructure transverse
**Effort total** : 41 SP | ~4-5 semaines
**Assignation** : Partagé Tom + Cofondateur

### Story TECH-01 : Migration PostgreSQL Externe
**Description** : Migrer de SQLite/embedded vers PostgreSQL 16 externe. docker-compose.dev.yml, config connexion .env, scripts de migration et seed.
**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : Aucun
**Débloque** : TECH-05, TECH-06, toutes les epics B2B
**ADR** : ADR-001

**Acceptance Criteria** :
- Given le serveur MnM When il démarre Then il se connecte à PostgreSQL 16 externe
- Given les 38 tables existantes When la migration s'exécute Then toutes les données sont préservées
- Given un test d'intégration When il s'exécute Then il utilise embedded-postgres pour l'isolation

### Story TECH-02 : Docker Compose Environment
**Description** : Environnement dev/test/prod. docker-compose.dev.yml (PostgreSQL 16, Redis 7, server, ui), docker-compose.test.yml, Dockerfile server + ui.
**Assignation** : Cofondateur
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : Aucun
**Débloque** : CONT-01, tests d'intégration
**ADR** : ADR-004

**Acceptance Criteria** :
- Given un développeur When il lance `docker compose up` Then PostgreSQL, Redis et l'app démarrent
- Given l'environnement de test When les tests s'exécutent Then une DB PostgreSQL isolée est utilisée

### Story TECH-03 : Infrastructure de Test (Factories + Seed)
**Description** : Factories TypeScript (createTestUser, createTestCompany, createTestAgent, createTestWorkflow). Seed E2E Cypress. Embedded-postgres pour intégration. Pattern : mocker LLM providers, JAMAIS la DB.
**Assignation** : Tom
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : TECH-01
**Débloque** : Tous les tests

**Acceptance Criteria** :
- Given les factories When un test unitaire s'exécute Then des données de test réalistes sont générées
- Given le seed E2E When Cypress démarre Then les scénarios ont des données cohérentes

### Story TECH-04 : Redis Setup
**Description** : Redis pour sessions, cache, WebSocket pub/sub, rate limiting. docker-compose service + client Redis dans le serveur.
**Assignation** : Tom
**Effort** : M (3 SP, 2-3j)
**Bloqué par** : TECH-02
**Débloque** : CHAT-01 (WebSocket scaling), performance

**Acceptance Criteria** :
- Given Redis dans docker-compose When le serveur démarre Then les sessions utilisent Redis
- Given le rate limiting When un client dépasse 100 req/min Then il reçoit 429

### Story TECH-05 : RLS PostgreSQL (14 tables)
**Description** : CREATE POLICY sur 14 tables. Hook Drizzle pour SET LOCAL app.current_company_id. Tests d'isolation cross-company. **Sécurité critique**.
**Assignation** : Tom
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : TECH-01, TECH-06
**Débloque** : Tout le multi-tenant, CONT-01
**ADR** : ADR-001

**Acceptance Criteria** :
- Given un user de company A When il requête la DB Then il ne voit AUCUNE donnée de company B
- Given une requête sans SET LOCAL When elle s'exécute Then elle retourne 0 résultats (pas d'erreur)
- Given les 14 tables sous RLS When un test d'isolation s'exécute Then 100% des tables sont protégées

### Story TECH-06 : Schema DB — 10 Nouvelles Tables
**Description** : project_memberships, automation_cursors, chat_channels, chat_messages, container_profiles, container_instances, credential_proxy_rules, audit_events, sso_configurations, import_jobs. Migrations Drizzle + indexes + relations.
**Assignation** : Tom
**Effort** : M (5 SP, 2-3j)
**Bloqué par** : TECH-01
**Débloque** : Tout le niveau CORE
**ADR** : ADR-001 (companyId sur chaque table)

**Acceptance Criteria** :
- Given le serveur When la migration s'exécute Then les 10 tables sont créées avec tous les indexes
- Given le rollback When il s'exécute Then les tables sont supprimées proprement

### Story TECH-07 : Schema DB — Modifications 5 Tables Existantes
**Description** : companies (+tier, ssoEnabled, maxUsers), company_memberships (+businessRole), agents (+containerProfileId, isolationMode), principal_permission_grants (+9 keys), activity_log (+ipAddress, userAgent, severity).
**Assignation** : Tom
**Effort** : S (2 SP, 1j)
**Bloqué par** : TECH-01
**Débloque** : RBAC-01, RBAC-03

**Acceptance Criteria** :
- Given les migrations When elles s'exécutent Then les colonnes sont ajoutées (nullable, backward-compatible)
- Given les données existantes When la migration s'applique Then aucune donnée n'est perdue

### Story TECH-08 : CI/CD Pipeline GitHub Actions
**Description** : Pipeline complète : QG-0 (lint+TS) → QG-1 (unit) → QG-2 (intégration) → QG-3 (security) → QG-4 (perf) → QG-5 (E2E) → QG-6 (review). Caching pnpm, Docker layers, Cypress binary.
**Assignation** : Cofondateur
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : TECH-01
**Débloque** : Qualité code, déploiement

**Acceptance Criteria** :
- Given un push sur une branche When la pipeline CI s'exécute Then QG-0 et QG-1 passent en <5 min
- Given un test qui échoue When la pipeline s'exécute Then le merge est bloqué automatiquement
- Given le caching When la pipeline complète s'exécute Then la durée est <22 min

---

## 3. Epic MU — Multi-User & Auth

**Objectif** : Transformer MnM en application multi-utilisateur avec invitations et gestion des membres.
**Phase PRD** : Phase 1
**FRs couverts** : REQ-MU-01 à REQ-MU-06
**Effort total** : 11-14 SP | ~1 semaine
**Assignation** : Tom (backend) + Cofondateur (frontend)
**Impact Business** : CRITIQUE (9/10) — Quick Win
**Priorisation** : #1 — Débloque tout le reste

### Story MU-S01 : API Invitations par Email
**Description** : Endpoint POST /api/invites avec lien signé (expire 7j), envoi email (Resend recommandé). Table `invites` existe déjà partiellement.
**Assignation** : Tom
**Effort** : S (2 SP, 1-2j)
**Bloqué par** : TECH-01
**Débloque** : MU-S02, MU-S03

**Acceptance Criteria** :
- Given un Admin When il saisit un email et clique "Inviter" Then une invitation est créée avec lien signé (7j)
- Given un email envoyé When le destinataire clique le lien Then il peut s'inscrire et rejoindre la company
- Given un audit_event When l'invitation est créée Then "members.invite" est émis avec actorId, targetEmail, companyId

### Story MU-S02 : Page Membres avec Tableau et Filtres
**Description** : Frontend shadcn/ui DataTable avec filtres. GET /api/members enrichi (join user). Actions bulk.
**Assignation** : Cofondateur
**Effort** : M (3 SP, 2-3j)
**Bloqué par** : MU-S01
**Débloque** : RBAC-S07

**Acceptance Criteria** :
- Given un Admin sur la page Membres When la page charge Then le tableau affiche nom, email, rôle, date d'ajout
- Given les filtres When l'Admin filtre par rôle Then seuls les membres du rôle sélectionné s'affichent

### Story MU-S03 : Invitation Bulk (CSV)
**Description** : Parsing CSV côté client, boucle sur endpoint d'invitation, feedback par ligne.
**Assignation** : Tom
**Effort** : S (2 SP, 1-2j)
**Bloqué par** : MU-S01

### Story MU-S04 : Sélecteur de Company (Multi-Company)
**Description** : UI dropdown dans header, stockage company active en Zustand, filtrage API par companyId.
**Assignation** : Cofondateur
**Effort** : S (2 SP, 1j)
**Bloqué par** : TECH-07

### Story MU-S05 : Désactivation Signup Libre
**Description** : Flag `invitationOnly` sur companies, check dans auth middleware.
**Assignation** : Tom
**Effort** : S (1 SP, 0.5j)
**Bloqué par** : TECH-07

**Acceptance Criteria** :
- Given l'option "Invitation uniquement" activée When un utilisateur tente /signup Then il reçoit 403
- Given un audit_event When le flag change Then "company.config_change" est émis

### Story MU-S06 : Sign-out avec Invalidation Session
**Description** : Bouton UI + appel endpoint + cleanup local. Better Auth a le mécanisme.
**Assignation** : Tom
**Effort** : S (1 SP, 0.5j)
**Bloqué par** : Aucun

**Acceptance Criteria** :
- Given un utilisateur connecté When il clique "Déconnexion" Then la session est invalidée côté serveur
- Given l'ancien token When une requête API est faite Then elle retourne 401

---

## 4. Epic RBAC — Rôles & Permissions

**Objectif** : Implémenter les 4 rôles métier avec enforcement systématique sur toutes les routes.
**Phase PRD** : Phase 2
**FRs couverts** : REQ-RBAC-01 à REQ-RBAC-08
**Effort total** : 21-26 SP | ~2 semaines
**Assignation** : Tom (backend) + Cofondateur (frontend)
**Impact Business** : CRITIQUE (9/10) — Prérequis sécurité démo
**Priorisation** : #2

### Story RBAC-S01 : Fix hasPermission() — Scope JSONB ⚠️ P0 SÉCURITÉ
**Description** : **DETTE TECHNIQUE CRITIQUE (DT1)**. access.ts:45-66 ignore le champ `scope`. Requiert : lecture scope, parsing Zod, validation projectId. Chaque route utilisant hasPermission() est potentiellement vulnérable.
**Assignation** : Tom
**Effort** : M (3 SP, 2j)
**Bloqué par** : TECH-07
**Débloque** : RBAC-S02, RBAC-S04, PROJ-S01, tout le RBAC
**ADR** : ADR-002

**Acceptance Criteria** :
- Given un Contributor avec scope { projectIds: ["proj-A"] } When il requête /api/agents?projectId=proj-B Then 403
- Given un Contributor avec scope { projectIds: ["proj-A"] } When il requête ?projectId=proj-A Then les agents s'affichent
- Given un audit_event When un accès scope est refusé Then "access.scope_denied" est émis

### Story RBAC-S02 : 9 Permission Keys + Presets par Rôle
**Description** : 9 nouvelles keys (workflows.create/manage, agents.launch, stories.create/edit, audit.view/export, dashboard.view, chat.agent). Matrice presets admin/manager/contributor/viewer.
**Assignation** : Tom
**Effort** : S (2 SP, 1-2j)
**Bloqué par** : RBAC-S01
**Débloque** : RBAC-S04

### Story RBAC-S03 : BusinessRole sur Company_Memberships
**Description** : Migration Drizzle : colonne `businessRole` enum (admin/manager/contributor/viewer). Migration data : existants → admin.
**Assignation** : Cofondateur
**Effort** : S (2 SP, 1j)
**Bloqué par** : TECH-07

### Story RBAC-S04 : Enforcement dans 22 Fichiers Routes
**Description** : Middleware `requirePermission(key, scopeExtractor?)` sur toutes les routes. 3 fichiers critiques sans aucun check : approvals.ts, assets.ts, secrets.ts. **Splitting recommandé** : Tom = routes critiques, Cofondateur = reste.
**Assignation** : Tom + Cofondateur
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : RBAC-S01, RBAC-S02
**Débloque** : OBS-S02

**Acceptance Criteria** :
- Given un Viewer When il tente POST /api/agents Then 403 Forbidden
- Given le body Then { error: "PERMISSION_DENIED", requiredPermission: "agents.launch" }
- Given un audit_event Then "access.denied" est émis

### Story RBAC-S05 : Navigation UI Masquée selon Permissions
**Description** : Hook `usePermissions()`, `canUser()` basé sur les permissions token. Items absents du DOM (pas grisés).
**Assignation** : Cofondateur
**Effort** : M (3 SP, 2-3j)
**Bloqué par** : RBAC-S04

### Story RBAC-S06 : UI Admin Matrice Permissions + Page Rôles
**Description** : PermissionMatrix (grille checkboxes), RoleSelector, page /admin/roles.
**Assignation** : Cofondateur
**Effort** : M (3 SP, 2-3j)
**Bloqué par** : RBAC-S02

### Story RBAC-S07 : Badges Couleur par Rôle
**Description** : Composant Badge shadcn/ui avec variant par rôle.
**Assignation** : Cofondateur
**Effort** : S (1 SP, 0.5j)
**Bloqué par** : RBAC-S03

---

## 5. Epic PROJ — Scoping par Projet

**Objectif** : Isolation fine des données par projet au sein d'une company.
**Phase PRD** : Phase 3
**FRs couverts** : FR-PROJ (scoping JSONB)
**Effort total** : 13-16 SP | ~1-1.5 semaine
**Impact Business** : ÉLEVÉ (8/10)

### Story PROJ-S01 : Table project_memberships + Migration
**Assignation** : Tom | **Effort** : S (2 SP, 1j) | **Bloqué par** : TECH-06

### Story PROJ-S02 : Service project-memberships.ts
**Assignation** : Tom | **Effort** : M (3 SP, 2-3j) | **Bloqué par** : RBAC-S01

### Story PROJ-S03 : Filtrage Agents/Issues par Scope Projet
**Description** : Modification agents.ts et issues.ts (fichiers massifs). WHERE projectId IN (user_project_ids). Tests d'intégration obligatoires.
**Assignation** : Tom | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : PROJ-S02
**⚠ Risque** : agents.ts et issues.ts sont les plus gros fichiers du projet — splitting en sous-PRs recommandé.

### Story PROJ-S04 : Page ProjectAccess.tsx
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j) | **Bloqué par** : PROJ-S02

---

## 6. Epic ORCH — Orchestrateur Déterministe (Noyau A)

**Objectif** : Le coeur de MnM — exécution step-by-step imposée, fichiers obligatoires, pré-prompts, validation humaine.
**Phase PRD** : Transverse
**FRs couverts** : REQ-ORCH-01 à REQ-ORCH-05, REQ-ORCH-08 à REQ-ORCH-10
**Effort total** : 29-36 SP | ~3-3.5 semaines
**Impact Business** : CRITIQUE (10/10) — 4 personas sur 7
**Priorisation** : #3 — Coeur de la value prop
**ADR** : ADR-003

### Story ORCH-S01 : State Machine workflow-state-machine.ts
**Description** : **Nouveau système complet.** 12 transitions (CREATED→READY→IN_PROGRESS→VALIDATING→COMPLETED + PAUSED/FAILED/COMPACTING/SKIPPED). Guards sur chaque transition. Persistance dans stage_instances. Librairie recommandée : **XState**.
**Assignation** : Cofondateur
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : RBAC-S01
**Débloque** : ORCH-S02, DRIFT-S02, COMP-S01

**Acceptance Criteria** :
- Given un workflow [Analyse, Design, Code, Test, Review] When l'agent tente de passer à "Code" sans compléter "Design" Then la transition est refusée
- Given un audit_event When une transition est refusée Then "workflow.transition_denied" est émis

### Story ORCH-S02 : WorkflowEnforcer + Fichiers Obligatoires
**Description** : Vérification fichiers obligatoires, injection pré-prompts, persistance résultats intermédiaires. Nouveau fichier workflow-enforcer.ts ~300-500 lignes.
**Assignation** : Cofondateur
**Effort** : L (8 SP, 5-7j)
**Bloqué par** : ORCH-S01

**Acceptance Criteria** :
- Given une étape "Design" avec fichiers obligatoires [design-spec.md, wireframes.md] When wireframes.md manque Then la transition est refusée avec liste des fichiers manquants
- Given les pré-prompts par étape When l'agent démarre une étape Then les pré-prompts sont injectés

### Story ORCH-S03 : Validation Humaine (HITL)
**Description** : Extension du système approvals existant. Step de validation humaine configurable par étape. WebSocket notification.
**Assignation** : Cofondateur
**Effort** : M (5 SP, 3-4j)
**Bloqué par** : ORCH-S01

**Acceptance Criteria** :
- Given un workflow avec HITL sur "Review" When l'agent complète Then l'état passe à VALIDATING
- Given le validateur When il approuve Then le workflow passe à l'étape suivante
- Given le validateur When il rejette Then l'agent revient avec le feedback injecté

### Story ORCH-S04 : API Routes Orchestrateur
**Description** : POST /workflows/:id/enforce, GET /drift/alerts, POST /drift/alerts/:id/resolve.
**Assignation** : Tom
**Effort** : M (3 SP, 2-3j)
**Bloqué par** : ORCH-S01

### Story ORCH-S05 : UI Éditeur de Workflow (P1 — reportable)
**Description** : Drag-and-drop d'étapes, configuration prompts/fichiers, preview. dnd-kit recommandé.
**Assignation** : Cofondateur
**Effort** : M (5 SP, 3-5j)
**Bloqué par** : ORCH-S01
**Note** : P1 — éditeur YAML suffit pour le MVP CBA.

---

## 7. Epic DRIFT — Drift Detection

**Objectif** : Détecter en temps réel quand un agent dévie de son workflow assigné.
**FRs couverts** : REQ-ORCH-05
**Effort total** : 13-16 SP | ~1.5-2 semaines
**ADR** : ADR-007

### Story DRIFT-S01 : Fix Drift en Mémoire → Persistance DB
**Description** : **DT2** — drift.ts utilise `reportCache = new Map()` perdu au restart. Migration vers tables drift_reports + drift_items.
**Assignation** : Tom | **Effort** : M (3 SP, 2-3j)

### Story DRIFT-S02 : Drift Monitor Service
**Description** : Comparaison attendu (workflow template) vs observé (heartbeat events). Alertes via WebSocket.
**Assignation** : Tom | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : ORCH-S01

**Acceptance Criteria** :
- Given un agent en exécution When le DriftDetector détecte une déviation >15 min Then une alerte est créée
- Given une notification WebSocket Then elle est envoyée aux Manager/Admin

### Story DRIFT-S03 : UI Diff Visuel Drift
**Description** : Composant DriftAlert.tsx : vue comparée attendu/observé, diff visuel, actions (recharger, kill+relance, ignorer).
**Assignation** : Cofondateur | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : DRIFT-S02

---

## 8. Epic OBS — Observabilité & Audit (Noyau B)

**Objectif** : Voir tout, tracer tout, prouver tout. Audit immutable, résumés LLM, export.
**FRs couverts** : REQ-OBS-01 à REQ-OBS-06
**Effort total** : 18-22 SP | ~2-2.5 semaines
**Impact Business** : ÉLEVÉ (8/10)
**ADR** : ADR-007

### Story OBS-S01 : Table audit_events + Migration
**Description** : Table partitionnée par mois (PARTITION BY RANGE). TRIGGER deny UPDATE/DELETE. Colonnes : companyId, actorId, actorType, action, targetType, targetId, metadata JSONB, ipAddress, prevHash, createdAt. Rôles PostgreSQL séparés.
**Assignation** : Tom | **Effort** : M (5 SP, 3-4j) | **Bloqué par** : TECH-05

### Story OBS-S02 : Service audit.ts + Émission Systématique
**Description** : Service centralisé `emitAudit(action, target, metadata)` intégré aux 22 fichiers de routes.
**Assignation** : Tom | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : RBAC-S04

**Acceptance Criteria** :
- Given toute mutation When l'action est exécutée Then un audit_event immutable est créé
- Given l'event Then il contient actorId, action, targetType, targetId, companyId, ipAddress

### Story OBS-S03 : Résumé LLM Actions Agent (P1)
**Description** : audit-summarizer.ts : appel Haiku pour traduire logs techniques en langage naturel. Cache Redis.
**Assignation** : Tom | **Effort** : M (3 SP, 2-3j)

### Story OBS-S04 : UI AuditLog.tsx + Filtres + Export
**Description** : DataTable avec 12 filtres, export CSV/JSON, virtualisation TanStack Virtual.
**Assignation** : Cofondateur | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : OBS-S01

---

## 9. Epic ONB — Onboarding Cascade (Noyau C)

**Objectif** : Du CEO au dev, chaque niveau configure son périmètre. Import intelligent.
**FRs couverts** : REQ-ONB-01 à REQ-ONB-04
**Effort total** : 13-16 SP | ~1.5 semaines
**Impact Business** : MOYEN (5/10) — NICE-TO-HAVE pour la démo
**Priorisation** : #9 — Post-MVP acceptable

### Story ONB-S01 : Onboarding CEO Conversationnel
**Assignation** : Tom | **Effort** : M (3 SP) | P1

### Story ONB-S02 : Cascade Hiérarchique
**Assignation** : Tom | **Effort** : S (2 SP) | P1

### Story ONB-S03 : Import Jira Intelligent
**Assignation** : Tom | **Effort** : M (5 SP) | P2

### Story ONB-S04 : Dual-Mode Configuration (Oral/Visuel)
**Assignation** : Cofondateur | **Effort** : M (3 SP) | P1

---

## 10. Epic A2A — Agent-to-Agent + Permissions (Noyau D)

**Objectif** : Communication inter-agents avec validation human-in-the-loop et anti-boucle.
**FRs couverts** : REQ-A2A-01 à REQ-A2A-04
**Effort total** : 16-21 SP | ~2 semaines
**ADR** : ADR-006

### Story A2A-S01 : A2A Bus (agent-to-agent)
**Description** : Pattern Saga avec TTL. Graph de communication avec détection de cycles. Max 5 requêtes par chaîne.
**Assignation** : Cofondateur | **Effort** : L (8 SP, 5-7j) | **Bloqué par** : CONT-S02

**Acceptance Criteria** :
- Given Agent A qui requête Agent B When la requête est émise Then le A2ABus vérifie les permissions
- Given une chaîne A2A When elle atteint 5 requêtes Then la 6e est rejetée
- Given un cycle A→B→A When il est détecté Then la requête est bloquée

### Story A2A-S02 : Permissions Granulaires A2A
**Assignation** : Cofondateur | **Effort** : M (3 SP) | **Bloqué par** : A2A-S01

### Story A2A-S03 : Audit A2A
**Assignation** : Cofondateur | **Effort** : S (2 SP) | **Bloqué par** : A2A-S01, OBS-S01

### Story A2A-S04 : Connecteurs Auto-Générés MCP
**Assignation** : Cofondateur | **Effort** : M (3 SP) | P2

---

## 11. Epic DUAL — Dual-Speed Workflow (Noyau E)

**Objectif** : Curseur d'automatisation 3 positions × 4 niveaux avec plafond hiérarchique.
**FRs couverts** : REQ-DUAL-01 à REQ-DUAL-04
**Effort total** : 10-13 SP | ~1-1.5 semaine
**ADR** : ADR-003

### Story DUAL-S01 : Table automation_cursors + Service
**Description** : Table + service avec logique hiérarchie (CEO > CTO > Manager > Contributeur).
**Assignation** : Cofondateur | **Effort** : M (5 SP, 3-4j) | **Bloqué par** : RBAC-S01, PROJ-S01

**Acceptance Criteria** :
- Given un Manager en "Assisté" And un Contributor en "Auto" When le système évalue Then le curseur effectif = "Assisté" (plafonné)

### Story DUAL-S02 : UI Curseur 3 Positions
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j)

### Story DUAL-S03 : Enforcement Curseur dans Workflow
**Description** : Si curseur=manuel → validation systématique. Si assisté → suggestion+validation. Si auto → exécution directe.
**Assignation** : Cofondateur | **Effort** : S (2 SP, 1-2j) | **Bloqué par** : ORCH-S01

---

## 12. Epic CHAT — Chat Temps Réel

**Objectif** : WebSocket bidirectionnel humain-agent pendant l'exécution.
**FRs couverts** : REQ-CHAT-01 à REQ-CHAT-05
**Effort total** : 18-23 SP | ~2-2.5 semaines
**Impact Business** : ÉLEVÉ (7/10) — Moment émotionnel de la démo
**ADR** : ADR-005

### Story CHAT-S01 : WebSocket Bidirectionnel
**Description** : **DT3** — live-events.ts actuel = unidirectionnel. Protocole de messages typé bidirectionnel, routing par channelId, auth WebSocket.
**Assignation** : Tom | **Effort** : L (8 SP, 5-7j) | **Bloqué par** : TECH-04

### Story CHAT-S02 : Tables chat_channels + chat_messages
**Assignation** : Tom | **Effort** : S (2 SP, 1j) | **Bloqué par** : TECH-06

### Story CHAT-S03 : ChatService + Pipe stdin Agent
**Description** : Réception message → persistance → pipe vers stdin agent containerisé. Reconnexion buffer 30s. Rate limiting 10/min.
**Assignation** : Tom | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : CONT-S01 (dépendance forte)

### Story CHAT-S04 : AgentChatPanel.tsx + useAgentChat
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j)

---

## 13. Epic CONT — Containerisation

**Objectif** : Isolation B2B avec containers Docker éphémères et credential proxy.
**FRs couverts** : REQ-CONT-01 à REQ-CONT-07
**Effort total** : 34-42 SP | ~3.5-4.5 semaines
**Impact Business** : CRITIQUE (9/10) — Prérequis B2B
**ADR** : ADR-004
**⚠ Risque technique ÉLEVÉ** — Spike POC recommandé (2-3j)

### Story CONT-S01 : ContainerManager + Docker API
**Description** : **Le plus gros chantier technique.** dockerode, lifecycle complet (create→start→monitor→stop→cleanup), 4 profils de ressources (light/standard/heavy/gpu), flags --rm --read-only --no-new-privileges.
**Assignation** : Cofondateur | **Effort** : XL (13 SP, 2-3 sem)
**Bloqué par** : TECH-02, TECH-05

**Acceptance Criteria** :
- Given un agent avec profil "standard" When il est lancé Then un container Docker --rm --read-only est créé avec limites (1 CPU, 512MB)
- Given le container When l'agent termine Then le container est détruit automatiquement
- Given le startup When un agent est lancé Then le container est opérationnel en <10s

### Story CONT-S02 : Credential Proxy HTTP
**Description** : Serveur HTTP interne port 8090. Résolution via providers existants. Mount /dev/null sur .env. Pattern Nanoclaw.
**Assignation** : Cofondateur | **Effort** : L (8 SP, 5-7j) | **Bloqué par** : CONT-S01

**Acceptance Criteria** :
- Given un agent When il appelle credential-proxy:8090/api/secret/OPENAI_KEY Then la clé est retournée si autorisé
- Given les logs When la clé est accédée Then elle n'apparaît dans AUCUN log
- Given l'accès externe When un client hors Docker tente le port 8090 Then il est bloqué

### Story CONT-S03 : Mount Allowlist Tamper-proof
**Assignation** : Cofondateur | **Effort** : M (5 SP, 3-4j) | **Bloqué par** : CONT-S01

**Acceptance Criteria** :
- Given un container avec allowlist [/workspace/project-a] When path traversal (../../etc/passwd, symlinks, null bytes) Then accès refusé + audit severity=critical + container tué

### Story CONT-S04 : Isolation Réseau Docker
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j)

### Story CONT-S05 : Tables container_profiles + container_instances
**Assignation** : Tom | **Effort** : S (2 SP, 1j) | **Bloqué par** : TECH-06

### Story CONT-S06 : UI ContainerStatus.tsx
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j)

---

## 14. Epic COMP — Gestion Compaction

**Objectif** : Détecter et gérer la compaction des LLM pour maintenir le déterminisme.
**FRs couverts** : REQ-ORCH-06, REQ-ORCH-07
**Effort total** : 21-26 SP | ~2.5-3 semaines
**ADR** : ADR-008
**⚠ RISQUE CRITIQUE (R1)** — Spike obligatoire 1 semaine AVANT développement

### Story COMP-S01 : CompactionWatcher — Détection
**Description** : **RIEN N'EXISTE.** Monitoring heartbeats pour détecter la compaction (réduction soudaine de contexte). Intégration heartbeat.ts (2396 lignes, monolithique — nécessite TECH-09 refactoring).
**Assignation** : Cofondateur | **Effort** : L (8 SP, 5-7j) | **Bloqué par** : ORCH-S01

### Story COMP-S02 : Stratégie Kill+Relance
**Description** : Kill agent → relance avec contexte frais + résultats intermédiaires. Table compaction_snapshots. Circuit breaker : max 3 relances.
**Assignation** : Cofondateur | **Effort** : L (8 SP, 5-7j) | **Bloqué par** : COMP-S01, CONT-S01

**Acceptance Criteria** :
- Given un agent à l'étape 3/5 When compaction détectée (stratégie kill+relance) Then snapshot sauvegardé, agent tué, nouvel agent lancé avec contexte étapes 1-2
- Given le circuit breaker When 3 relances atteintes Then alerte humaine, workflow en pause

### Story COMP-S03 : Stratégie Réinjection Post-Compaction (P1)
**Assignation** : Cofondateur | **Effort** : M (5 SP, 3-5j) | **Bloqué par** : COMP-S01

---

## 15. Epic DASH — Dashboards par Rôle

**Objectif** : Dashboards agrégés par rôle avec k-anonymity.
**Effort total** : 10-13 SP | ~1-1.5 semaine

### Story DASH-S01 : API Dashboards Agrégés
**Description** : GET /dashboards/:type. k-anonymity (k=5). Vues matérialisées PostgreSQL. Interdiction drill-down individuel (Vérité #20).
**Assignation** : Tom | **Effort** : M (5 SP, 3-4j)

### Story DASH-S02 : DashboardCards.tsx par Rôle
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j)

### Story DASH-S03 : Dashboard Temps Réel via WebSocket
**Assignation** : Tom | **Effort** : S (2 SP, 1-2j)

---

## 16. Epic SSO — Enterprise Auth

**Objectif** : SSO SAML/OIDC pour les clients enterprise.
**Phase PRD** : Phase 4
**Effort total** : 8-10 SP | ~1 semaine
**Priorisation** : P1 — Reportable post-démo CBA

### Story SSO-S01 : Table sso_configurations + Config
**Assignation** : Tom | **Effort** : S (2 SP, 1j)

### Story SSO-S02 : Better Auth Plugins SAML/OIDC
**Assignation** : Tom | **Effort** : M (3 SP, 2-3j)

### Story SSO-S03 : UI Configuration SSO
**Assignation** : Cofondateur | **Effort** : M (3 SP, 2-3j)

---

## 17. Graphe de Dépendances Global

### 17.1 Niveaux de Dépendances (Winston)

```
NIVEAU 0 — INFRASTRUCTURE (S0, Semaine 1)
├── TECH-01: PostgreSQL externe
├── TECH-02: Docker Compose
├── TECH-03: Infrastructure de test
├── TECH-04: Redis
└── TECH-08: CI/CD

NIVEAU 1 — FONDATIONS (S1-S2, Semaine 2-4)
├── TECH-05: RLS PostgreSQL         ← TECH-01
├── TECH-06: 10 nouvelles tables    ← TECH-01
├── TECH-07: Modifs 5 tables        ← TECH-01
├── RBAC-S01: Fix hasPermission     ← TECH-07
├── RBAC-S02: Permission keys       ← RBAC-S01
├── RBAC-S04: Enforcement routes    ← RBAC-S01, RBAC-S02
└── MU-S01 à MU-S06                 ← TECH-01, TECH-07

NIVEAU 2 — CORE (S2-S4, Semaine 4-8)
├── ORCH-S01: State machine         ← RBAC-S01
├── ORCH-S02: WorkflowEnforcer      ← ORCH-S01
├── CONT-S01: ContainerManager      ← TECH-02, TECH-05
├── CONT-S02: Credential Proxy      ← CONT-S01
├── OBS-S01: Audit events           ← TECH-05
├── CHAT-S01: WebSocket bidir       ← TECH-04
└── PROJ-S01-S04: Scoping           ← RBAC-S01

NIVEAU 3 — AVANCÉ (S4-S5, Semaine 8-10)
├── DRIFT-S02: Drift monitor        ← ORCH-S01
├── COMP-S01: CompactionWatcher     ← ORCH-S01, CONT-S01
├── A2A-S01: A2A Bus                ← CONT-S02
├── CHAT-S03: ChatService           ← CONT-S01, CHAT-S01
├── DUAL-S01: Curseur               ← RBAC-S01, PROJ-S01
└── OBS-S03: Résumé LLM            ← OBS-S01

NIVEAU 4 — ENTERPRISE (S6, Semaine 10-13)
├── SSO-S01/S02: SAML/OIDC          ← RBAC-S01
├── ONB-S01: Onboarding             ← MU-S01
├── DASH-S01/S02: Dashboards        ← OBS-S01
└── COMP-S03: Réinjection           ← COMP-S01
```

### 17.2 Critical Path (Winston)

```
CRITICAL PATH (10 semaines) :
PostgreSQL externe (1s) → Schema migrations (1s) → RLS (1s) → hasPermission fix (0.5s)
→ Permission keys (0.5s) → Role presets (0.5s) → WorkflowEnforcer (2s)
→ Compaction Manager (1.5s) → CompactionWatcher (1s) → Smoke tests (1s)
                                                        TOTAL: ~10 semaines

NEAR-CRITICAL PATH (9 semaines) :
Docker Compose (0.5s) → ContainerManager (2s) → Credential Proxy (1.5s)
→ A2A Bus (2s) → Integration testing (1s) → Smoke tests (1s)
                                               TOTAL: ~8 semaines
```

---

## 18. Matrice de Priorisation (John)

```
                          IMPACT BUSINESS
                Faible (1-4)    Moyen (5-7)    Critique (8-10)
              +---------------+---------------+------------------+
 Faible       |               |               | MULTI-USER MVP   |
 (< 1.5 sem) |               |               |                  |
              +---------------+---------------+------------------+
 Moyen        |               | ONBOARDING    | RBAC METIER      |
 (2-3 sem)    |               | & IMPORT      | SCOPING PROJET   |
              |               |               | OBSERVABILITE    |
              +---------------+---------------+------------------+
 Élevé        |               | ENTERPRISE-   | ORCHESTRATEUR    |
 (3-5 sem)    |               | GRADE         | CONTAINERISATION |
              |               | DUAL-SPEED    |                  |
              |               | & CHAT        |                  |
              +---------------+---------------+------------------+

MUST-HAVE (~65-80 jours-dev) : MU, RBAC, ORCH, CONT, OBS basique, CHAT
NICE-TO-HAVE (~45-55 jours-dev) : SSO, ONB, DASH avancé, DUAL avancé, UX polish
```

---

## 19. Split Cofondateurs

### 19.1 Répartition

| Cofondateur | Noyaux | Charge | Stories principales |
|------------|--------|--------|---------------------|
| **Tom** | B (Obs) + C (Onb) + Infra | ~115-140 SP | TECH-01 à 07, RBAC backend, OBS, WebSocket, Chat backend, SSO backend, API routes |
| **Cofondateur** | A (Orch) + D (A2A) + Frontend | ~110-135 SP | TECH-02/08, CONT, ORCH, COMP, A2A, DUAL, frontend React |

### 19.2 Points de Synchronisation

| Semaine | Sync | Décision |
|---------|------|----------|
| Fin S2 | Phase 1 terminée + Spike compaction | Go/No-Go stratégie compaction |
| Fin S4 | RBAC + Orchestrateur v1 | Go/No-Go Phase 3 ou pivot container |
| Fin S6 | Scoping + Observabilité | Phase 4 ou polish MVP ? |
| Fin S8 | Containerisation + Chat | Go/No-Go Démo CBA |
| S9-10 | Préparation démo | Bug fixing, données démo, script, répétition |

---

## 20. Récapitulatif Quantitatif

| Dimension | Quantité |
|-----------|----------|
| Epics | 16 |
| Stories | ~69 |
| Story Points total | 252-307 SP |
| FRs PRD couverts | 52/52 (100%) |
| ADRs mappés | 8 |
| Acceptance Criteria (Given/When/Then) | 31 scénarios critiques |
| Edge Cases documentés | 42 |
| Definition of Done critères | 42 (4 niveaux) |
| Quality Gates par phase | 39 critères de sortie |
| Tests estimés | ~525 (300 unit, 205 intég, 20 E2E) |
| Infrastructure test stories | 8 (13 jours) |
| Durée réaliste (2 devs) | 20-22 semaines |
| Durée MVP CBA (strict) | 12-13 semaines (Sprint 0-5) |
| Risques techniques | 6 identifiés (1 critique, 2 élevés, 2 moyens, 1 faible) |
| Spikes R&D | 3 (compaction 1 sem, container POC 2-3j, SSO 1j) |

---

*Epics B2B v1.0 — ~5000 mots — 7 agents, 16 epics, ~69 stories, 252-307 SP, 100% FRs couverts.*
*Synthèse : Bob (structure), Winston (séquençage), John (priorisation), Amelia (effort), Quinn (ACs/DoD), Sally (UX), Murat (tests).*
