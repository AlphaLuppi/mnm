# PRD B2B — MnM : Tour de Contrôle IA Enterprise

> **Version** : 1.0 | **Date** : 2026-03-14 | **Statut** : Final
> **Auteurs** : John (PM), Winston (Architecte), Mary (Analyste), Sally (Designer), Amelia (Dev), Murat (TEA), Quinn (QA), Bob (SM)
> **Source** : Product Brief B2B v2.0, Brainstorming Cofondateurs (57 vérités), Nanoclaw Research

---

## Table des Matières

1. [Executive Summary](#1-executive-summary)
2. [Classification](#2-classification)
3. [Success Criteria](#3-success-criteria)
4. [User Journeys Détaillés](#4-user-journeys-détaillés)
5. [Domain Model](#5-domain-model)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Out of Scope](#8-out-of-scope)
9. [Assumptions & Constraints](#9-assumptions--constraints)
10. [Stratégie de Test & Qualité](#10-stratégie-de-test--qualité)
11. [Traçabilité & Roadmap](#11-traçabilité--roadmap)

---

## 1. Executive Summary

### 1.1 Contexte

En mars 2026, le marché de l'orchestration IA atteint 13,5 milliards USD avec un CAGR de 22,3%, tandis que le marché des agents IA autonomes explose à 8,5 milliards USD (CAGR 49,6%). Les entreprises déploient massivement des outils IA — Cursor ($29,3 Mrd de valorisation, $1 Mrd ARR), Windsurf ($30M ARR enterprise), agents dans Jira — mais font face à un paradoxe critique : **aucun moyen de les orchestrer, contrôler et auditer à l'échelle de l'organisation**.

Trois forces convergent simultanément :
1. **La maturité des agents IA** — capables d'exécuter des tâches complexes, mais leur fiabilité dépend de garde-fous que personne ne fournit encore. Le CTO de CBA l'a constaté au hackathon de mars 2026 : des agents qui sautent des étapes, ne chargent pas les bons fichiers, dérivent sans contrôle (Vérité #45).
2. **La pression de gouvernance** — déployer de l'IA sans orchestration déterministe et audit trail, c'est comme déployer du cloud sans sécurité. Les plateformes leaders seront celles qui traduisent les intentions en actions step-by-step liées à des politiques.
3. **L'échec structurel des outils existants** — Jira = tracking passif (pas d'orchestration), Cursor = développeur individuel (pas multi-rôle), CrewAI = librairie technique (pas de produit enterprise). Aucun ne combine vision transversale + orchestration d'agents + audit enterprise.

### 1.2 Problème

Dans une entreprise tech en transformation digitale, l'information se dégrade à chaque passage de relais entre rôles (PPT → Epic → Story → Code → Tests). Les contrats inter-rôles ne sont jamais respectés. Les décisions critiques disparaissent. Le savoir tribal reste dans les têtes. Et le coût de la coordination synchrone est colossal — pattern récurrent validé chez CBA : malentendu → dev → découverte du malentendu → re-réunion → re-dev.

Les 8 faits terrain validés chez CBA (mars 2026) confirment que ce problème est structurel, pas accidentel :
1. L'information se dégrade à chaque handoff (Vérité #1)
2. Les contrats inter-rôles sont aspirationnels, jamais appliqués (Vérité #2)
3. Des décisions non-documentées se prennent en permanence (Vérité #3)
4. Le savoir critique est partiellement tacite (Vérité #5)
5. La boucle de feedback est structurellement trop longue (Vérité #6)
6. L'alignement inter-équipe est un goulot d'étranglement synchrone (Vérité #13)
7. L'information de pilotage n'existe nulle part de manière unifiée (Vérité #15)
8. Les workflows actuels CRÉENT des problèmes qui n'existeraient pas sans eux (Vérité #23)

### 1.3 Solution

**MnM** est une plateforme B2B d'orchestration d'agents IA déterministe, conçue pour être la **Tour de Contrôle IA Enterprise**. À l'intersection de trois océans rouges saturés (gestion de projet, IDE IA, frameworks agentiques), MnM occupe un white space unique : **orchestration déterministe + supervision multi-rôle pour l'ensemble de l'organisation**.

MnM est à l'orchestration d'agents IA ce que Kubernetes est à l'orchestration de containers : une couche de contrôle indispensable entre l'humain et l'exécution.

MnM se structure autour de 5 noyaux de valeur :
- **Noyau A — Orchestrateur Déterministe** : L'agent fait EXACTEMENT ce qu'on lui dit. Workflows imposés algorithmiquement, pas suggérés. Gestion de compaction au niveau plateforme (kill+relance ou réinjection). Drift detection.
- **Noyau B — Observabilité & Audit** : Voir tout, tracer tout, prouver tout. Résumé LLM temps réel, audit centralisé, containerisation des agents avec credential proxy.
- **Noyau C — Onboarding Cascade** : Du CEO au dev, chaque niveau configure son périmètre. Dual-mode oral/visuel. Import intelligent depuis Jira/Linear/ClickUp.
- **Noyau D — Agent-to-Agent + Permissions** : Communication inter-agents avec permissions human-in-the-loop. Query directe du contexte inter-agents. Connecteurs auto-générés.
- **Noyau E — Dual-Speed Workflow** : Vitesse humaine (réflexion) + vitesse machine (exécution) en parallèle. Curseur d'automatisation individuel (manuel → assisté → automatique).

### 1.4 Timeline

- **Phase 1 — Multi-user livrable** (~1 semaine) : invitations humaines, page membres, sign-out, PostgreSQL externe
- **Phase 2 — RBAC métier** (~2 semaines) : rôles admin/manager/contributor/viewer, 9 nouvelles clés de permissions, UI admin
- **Phase 3 — Scoping par projet** (~2-3 semaines) : project memberships, filtrage par scope JSONB, UI d'accès par projet
- **Phase 4 — Enterprise-grade** (~3-4 semaines) : SSO SAML/OIDC, audit complet, multi-tenant, dashboards par rôle

**Total estimé : ~8-10 semaines** pour un produit B2B vendable. Démonstration CBA en juin 2026.

---

## 2. Classification

### 2.1 Type de Produit

**Plateforme B2B d'orchestration d'agents IA déterministe** — Catégorie nouvelle ("Tour de Contrôle IA Enterprise"). Positionnée à l'intersection de la gestion de projet, des IDE IA, et des frameworks agentiques sans appartenir à aucune de ces catégories.

### 2.2 Stack Technique

| Couche | Technologie | Maturité |
|--------|------------|----------|
| **Monorepo** | pnpm workspaces | Mature — `packages/shared`, `packages/db`, `server`, `ui` |
| **Frontend** | React 18 + Vite, React Query, Tailwind CSS, shadcn/ui | Mature |
| **Backend** | Express + tsx, Node.js | Mature |
| **Base de données** | PostgreSQL (Drizzle ORM), 38 tables existantes | Mature |
| **Temps réel** | WebSocket (ws) + EventEmitter interne | Fonctionnel (read-only → bidirectionnel) |
| **Auth** | Better Auth (email+password, sessions DB) | Complet |
| **Agents** | 8 types d'adapters (claude_local, codex, openclaw, etc.) | Extensible |
| **Secrets** | Versionnés, 4 providers (local, AWS, GCP, Vault) | Avancé |
| **Containerisation** | Docker (dockerode) — à implémenter | Planifié |

### 2.3 Modèle de Licence — Open-core

| Tier | Cible | Prix | Contenu |
|------|-------|------|---------|
| **Open Source** | Dev solo, small team (<5) | Gratuit | Orchestrateur complet, workflows, observabilité basique. Auto-hébergement. |
| **Team** | Équipe 5-50 | ~50€/user/mois | Multi-users, RBAC, scoping projet, import, chat, containerisation. |
| **Enterprise** | 100+ users | ~200€/user/mois | SSO, audit complet, drift avancée, multi-tenant, SLA + CSM. |
| **On-Premise** | Secteurs réglementés | Licence annuelle | Déploiement chez le client, zero data exfiltration. |

### 2.4 Audiences Cibles — 9 Personas

1. **CEO** — Pilote stratégique (mode oral). Synthèses, dictée conversationnelle.
2. **CTO / DSI** — Garant technique (mode visuel). Dashboards drift, monitoring agents, SSO.
3. **DPO** — Chef d'orchestre produit (mode board). Vue inter-équipes, conflits roadmap.
4. **PM** — Stratège produit (mode board + oral). Brainstorm assisté → output structuré.
5. **PO** — Traducteur de besoins (mode board). Agents écrivent, PO valide.
6. **Designer** — Architecte UX (mode visuel). Notifications workflow, maquettes → stories.
7. **Développeur** — Artisan du code (mode code). Agent personnel, dialogue temps réel.
8. **QA / Testeur** — Gardien qualité (mode test). Capture savoir tacite, shift-left.
9. **Lead Tech** — Gardien architecture (code + visuel). Monitoring dette, reviews augmentées.

---

## 3. Success Criteria

26 critères mesurables structurés par noyau de valeur, avec cibles à 3 mois (MVP CBA) et 12 mois.

### 3.1 Noyau A — Orchestrateur Déterministe

| # | Critère | Cible 3 mois | Cible 12 mois |
|---|---------|-------------|--------------|
| SC-A1 | Taux de respect workflows | >90% | >98% |
| SC-A2 | Temps de détection drift | <15 min | <2 min |
| SC-A3 | Réinjection contexte réussie après compaction | >85% | >95% |
| SC-A4 | Workflows actifs utilisés | 10+ | 50+ |
| SC-A5 | Sessions survivant une compaction | >80% | >95% |

### 3.2 Noyau B — Observabilité & Audit

| # | Critère | Cible 3 mois | Cible 12 mois |
|---|---------|-------------|--------------|
| SC-B1 | Couverture d'audit (actions loggées) | 100% runs | 100% runs |
| SC-B2 | Latence observabilité (action → dashboard) | <5s | <2s |
| SC-B3 | Réduction MTTR | -40% | -70% |
| SC-B4 | NPS transparence agent | >25 | >50 |
| SC-B5 | Agents enterprise containerisés | >90% | 100% |

### 3.3 Noyau C — Onboarding Cascade

| # | Critère | Cible 3 mois | Cible 12 mois |
|---|---------|-------------|--------------|
| SC-C1 | Temps onboarding company → premier workflow | <1 semaine | <2 jours |
| SC-C2 | Taux complétion onboarding | >70% | >90% |
| SC-C3 | Temps import Jira/Linear | <3 jours | <1 jour |
| SC-C4 | Companies avec ≥3 niveaux hiérarchiques | >50% | >80% |

### 3.4 Noyau D — Agent-to-Agent & Permissions

| # | Critère | Cible 3 mois | Cible 12 mois |
|---|---------|-------------|--------------|
| SC-D1 | Queries inter-agents/semaine | 50+ | 500+ |
| SC-D2 | Réduction temps handoff | -30% | -70% |
| SC-D3 | Connecteurs auto-générés | 0 (MVP) | >5/client |
| SC-D4 | Taux validation humaine A2A | 100% | >80% (configurable) |

### 3.5 Noyau E — Dual-Speed Workflow

| # | Critère | Cible 3 mois | Cible 12 mois |
|---|---------|-------------|--------------|
| SC-E1 | Ratio exécution/réflexion | 60/40 | 20/80 |
| SC-E2 | Position moyenne curseur automatisation | 1.5 | 2.5 |
| SC-E3 | Savoir tacite capturé (items formalisés) | 100 | 1000+ |
| SC-E4 | Adoption chat temps réel | >40% WAU | >70% WAU |

### 3.6 KPIs Business

| # | Critère | Cible 3 mois | Cible 12 mois |
|---|---------|-------------|--------------|
| SC-BIZ-1 | Premier client pilote (CBA) | POC signé | Production + case study |
| SC-BIZ-2 | ARR | 10-30k€ | 200k€ |
| SC-BIZ-3 | Rôles non-dev actifs | >30% | >40% |
| SC-BIZ-4 | Rétention 90 jours | >70% | >85% |
| SC-BIZ-5 | Time-to-value | <2h | <30min |
| SC-BIZ-6 | Satisfaction globale (CSAT) | >3.5/5 | >4.2/5 |
| SC-BIZ-7 | Flywheel OSS → Team → Enterprise | 500 MAU OSS | 5000 MAU, 25 Team, 5 Enterprise |

---

## 4. User Journeys Détaillés

> Document complet avec wireframes textuels : `_bmad-output/planning-artifacts/ux-journeys-requirements.md`

### 4.1 Journey CEO — "Du lancement à la vision globale"

**Mode** : ORAL + VISUEL | **Objectif** : Vue temps réel de toute l'organisation en <48h.

1. **Connexion** — Clic sur lien d'invitation → création compte simplifiée
2. **Agent d'onboarding** — Chat conversationnel : "Décrivez votre entreprise..." → 5-7 échanges max
3. **Définition structure** — Dicte la structure → organigramme visuel interactif généré
4. **Validation** — Drag-and-drop de l'organigramme, validation
5. **Invitation cascade** — Emails d'invitation générés avec contexte pré-rempli par périmètre
6. **Import existant** — Scan Jira automatique avec mapping proposé
7. **Dashboard J+2** — Dashboard exécutif : avancement par BU, agents actifs, alertes drift, KPIs agrégés
8. **Question stratégique** — "Où en est le projet Alpha ?" → synthèse contextuelle avec liens

### 4.2 Journey CTO — "Configuration technique et monitoring"

**Mode** : VISUEL + CODE | **Objectif** : Définir workflows déterministes et surveiller leur respect.

1. **Acceptation invite** — Périmètre technique pré-configuré par le CEO
2. **Config SSO** — Formulaire SAML/OIDC avec guide pas-à-pas et test intégré
3. **Définition workflow** — Éditeur visuel drag-and-drop : étapes, prompts, fichiers obligatoires
4. **Test workflow** — Exécution simulée avec logs temps réel
5. **Config drift detection** — Curseur de sensibilité (laxiste → strict)
6. **Monitoring quotidien** — Dashboard : drift temps réel, santé containers, métriques compaction
7. **Intervention drift** — Attendu vs observé en diff visuel, actions : recharger/kill+relance/ignorer

### 4.3 Journey Développeur — "Mon quotidien augmenté"

**Mode** : CODE + BOARD | **Objectif** : Livrer du code de qualité plus vite avec agent personnel pilotable.

1. **Board personnel** — 2 stories, 1 review en attente, 1 bug urgent
2. **Sélection story** — Contexte complet : specs, maquettes, fichiers concernés
3. **Lancement agent** — Workflow déterministe avec barre de progression
4. **Pilotage temps réel** — Chat : "Utilise le pattern Repository" → agent ajuste
5. **Observation live** — Split view : code à gauche, chat agent à droite, diff en surbrillance
6. **Interruption** — "Stop" → arrêt immédiat + proposition rollback
7. **Review code** — Diff avec annotations agent, tests générés, métriques couverture
8. **Merge** — MR automatique, audit log, story → Done

### 4.4 Journey PO — "Du besoin à la story validée"

**Mode** : BOARD + ORAL | **Objectif** : Décomposer epics en stories validées.

1. **Réception epic** — Vue complète : analyse marché, maquettes, contraintes techniques
2. **Brainstorm décomposition** — Chat : "Décompose cette epic" → 5-8 stories structurées
3. **Affinage stories** — Kanban drag-and-drop, édition inline, validation 1 clic
4. **Validation DoR** — Checklist automatique vert/rouge par critère
5. **Assignation agents** — Progression temps réel visible
6. **Suivi sprint** — Dashboard : stories en cours/bloquées/terminées, burndown augmenté

### 4.5 Journey PM — "Du brainstorm à la roadmap structurée"

**Mode** : ORAL + BOARD | **Objectif** : Transformer réflexion stratégique en artefacts exécutables.

1. **Brainstorm** — Agent structure, challenge hypothèses, organise les idées
2. **Synthèse** — Output structuré : problem statement, personas, user stories, risques
3. **Création epic** — "Transforme ça en epic" → epic liée au brainstorm, KPIs proposés
4. **Roadmap** — Vue Gantt-like, dépendances auto-détectées, conflits signalés

### 4.6 Journey Lead Tech — "Gardien de l'architecture"

**Mode** : VISUEL + CODE + BOARD | **Objectif** : Réduire le mécanique pour se concentrer sur l'architecture.

1. **Dashboard matin** — Dette technique, reviews pré-analysées, alertes drift, couverture tests
2. **Code review assistée** — MR annotée : patterns respectés/violés, risques sécurité, suggestions
3. **Workflow dette technique** — Analyse impact → planification → exécution → validation → merge

---

## 5. Domain Model

### 5.1 Inventaire du Schéma Existant (38 tables)

**Auth & Identity (4)** : `user`, `session`, `account`, `verification`

**Tenant & Access (6)** : `companies`, `company_memberships`, `instance_user_roles`, `principal_permission_grants`, `invites`, `join_requests`

**Agents (6)** : `agents` (11 rôles, 7 statuts, 8 adapter types), `agent_api_keys`, `agent_runtime_state`, `agent_task_sessions`, `agent_config_revisions`, `agent_wakeup_requests`

**Project Management (9)** : `projects`, `project_workspaces`, `project_goals`, `goals`, `issues`, `issue_labels`, `issue_comments`, `issue_read_states`, `issue_attachments`

**Workflow (3)** : `workflow_templates`, `workflow_instances`, `stage_instances`

**Execution & Observabilité (4)** : `heartbeat_runs`, `heartbeat_run_events`, `cost_events`, `activity_log`

**Secrets (2)** : `company_secrets`, `company_secret_versions`

**Autres (4)** : `approvals`, `approval_comments`, `assets`, `inbox_dismissals`

### 5.2 Diagramme ER Simplifié

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
          │          │   └──────────────┘
          │ 1:N      │
          ▼          │   ┌──────────────────┐ 1:N ┌──────────────┐
   ┌──────────────┐  │   │workflow_templates │────▶│workflow_     │
   │heartbeat_runs│  │   └──────────────────┘     │instances     │
   │(execution)   │  │                             └──────┬───────┘
   └──────────────┘  │                                    │ 1:N
                     └────────────────────────────┌──────────────┐
   ┌──────────────┐                               │stage_        │
   │principal_    │                               │instances     │
   │permission_   │                               └──────────────┘
   │grants        │
   │scope(jsonb)  │
   │← NON LU ⚠️  │
   └──────────────┘
```

### 5.3 Tables NOUVELLES Requises (10 tables)

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

### 5.4 Modifications aux Tables Existantes

- `companies` : + `tier`, `ssoEnabled`, `maxUsers`, `parentCompanyId`
- `company_memberships` : + `businessRole` (admin/manager/contributor/viewer)
- `agents` : + `containerProfileId`, `isolationMode`
- `principal_permission_grants` : + 9 nouvelles PERMISSION_KEYS
- `activity_log` : + `ipAddress`, `userAgent`, `severity`

### 5.5 Acteurs du Domaine

#### Acteurs Humains (9)

| Acteur | Rôle | Interactions clés |
|--------|------|-------------------|
| CEO / DSI | Pilote stratégique | Mode ORAL, valide cascade, interroge agents |
| CTO / Lead Tech | Garant technique | Mode VISUEL + CODE, monitoring drift, templates workflow |
| DPO | Chef d'orchestre produit | Mode BOARD + ORAL, vue inter-équipes |
| PM | Stratège produit | Brainstorm assisté → output structuré |
| PO | Traducteur de besoins | Validation artefacts agents, enrichissement savoir |
| Designer | Architecte UX | Notifications workflow, maquettes → stories |
| Développeur | Artisan du code | Dialogue temps réel avec agent, curseur personnel |
| QA / Testeur | Gardien qualité | Capture progressive du savoir, shift-left |
| Instance Admin | Super-administrateur | Config multi-tenant, backup/restore, health |

#### Acteurs Machine (6 types d'agents)

| Type | Fonction | Contraintes |
|------|----------|-------------|
| Agent d'onboarding | Guide conversationnel config initiale | Cascade hiérarchique |
| Agent d'exécution | Tâches workflow déterministe | Containerisé, credentials isolées |
| Agent de reporting | Synthèse KPIs, alertes | Lecture seule, agrégation obligatoire |
| Agent de brainstorm | Sessions de réflexion structurées | Manuel ou assisté uniquement |
| Agent inter-rôle | Proxy A2A entre agents | Permissions human-in-the-loop |
| Agent connecteur | Connecteurs systèmes externes | Auto-généré, validé par CTO |

### 5.6 Invariants Fondamentaux (5)

1. **INV-01 — Isolation Company** : Aucun accès cross-company sans membership explicite. Toutes les routes passent par `assertCompanyAccess`. Toutes les queries scopées par `companyId`.

2. **INV-02 — Déterminisme Workflow** : Un agent est TOUJOURS contraint par son workflow template. L'agent n'interprète pas le workflow — MnM l'exécute pour lui.

3. **INV-03 — Audit Total** : Toute mutation génère un AuditLog. Qui, quoi, quand, dans quel workflow. Aucune action ne contourne l'audit.

4. **INV-04 — Permission Scope** : Sans scope = accès Company entière. Avec scope = Projects spécifiés. Le champ `scope` JSONB sur `principalPermissionGrants` DOIT être lu et appliqué. ⚠️ **Trou critique actuel** : `hasPermission()` (access.ts:45-66) ignore complètement le scope.

5. **INV-05 — Curseur Individuel** : L'automatisation est configurable dans les limites du rôle et de la hiérarchie. Le plafond supérieur l'emporte toujours.

### 5.7 Contraintes Métier

- **C-01** : Métriques agrégées uniquement — JAMAIS de données individuelles (Vérité #20)
- **C-02** : Élévation, pas remplacement — automatisation = élévation du rôle
- **C-03** : Source unique de vérité — après import, MnM = LA source
- **C-04** : Containerisation obligatoire en multi-tenant
- **C-05** : Credential proxy — aucune clé API visible par les agents

---

## 6. Functional Requirements

### FR-MU : Multi-User & Auth

**Existe** : Better Auth complet, company_memberships, invites, join_requests.
**Manque** : UI invitations, page Membres, sign-out, désactivation signup libre.
**Effort** : 1 semaine (principalement frontend).

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-MU-01 | Invitation par email avec lien signé (expire 7j) | P0 |
| REQ-MU-02 | Page Membres avec tableau, filtres, actions en lot | P0 |
| REQ-MU-03 | Invitation en bulk (CSV ou liste emails) | P1 |
| REQ-MU-04 | Sélecteur de Company (multi-company) | P1 |
| REQ-MU-05 | Désactivation signup libre (invitation-only) | P0 |
| REQ-MU-06 | Sign-out avec invalidation de session | P0 |
| REQ-MU-07 | Migration PostgreSQL externe | P0 (prérequis infra) |

### FR-RBAC : Roles & Permissions

**Existe** : `principal_permission_grants` avec 6 clés, scope JSONB (non lu!), `hasPermission()`.
**Trou critique** : `hasPermission()` (access.ts:45-66) ne lit JAMAIS `scope`.
**À modifier** : constants.ts (+9 keys), access.ts (scope + presets), 22 fichiers routes.
**À créer** : role-presets.ts, CompanyMembers.tsx, RoleSelector.tsx, PermissionEditor.tsx.
**Effort** : 2 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-RBAC-01 | 4 rôles métier : Admin, Manager, Contributor, Viewer | P0 |
| REQ-RBAC-02 | Presets de permissions par rôle (matrice configurable) | P0 |
| REQ-RBAC-03 | `hasPermission()` lit et applique `scope` JSONB | P0 — sécurité |
| REQ-RBAC-04 | 9 nouvelles permission keys (15 total) | P0 |
| REQ-RBAC-05 | Enforcement dans chaque route API (22 fichiers) | P0 |
| REQ-RBAC-06 | Masquage navigation selon permissions (absent du DOM) | P1 |
| REQ-RBAC-07 | UI admin : matrice permissions, page rôles | P1 |
| REQ-RBAC-08 | Badges couleur par rôle (Admin=rouge, Manager=bleu, Contributor=vert, Viewer=gris) | P2 |

### FR-ORCH : Orchestrateur Déterministe

**Existe** : workflow_templates, instances, stage_instances, service complet (267 lignes).
**Manque** : State machine d'enforcement, validation transitions, fichiers obligatoires.
**À créer** : workflow-enforcer.ts, workflow-state-machine.ts.
**Effort** : 3-4 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-ORCH-01 | Exécution step-by-step imposée — agent ne peut pas sauter d'étape | P0 |
| REQ-ORCH-02 | Fichiers obligatoires par étape (refus si manquants) | P0 |
| REQ-ORCH-03 | Pré-prompts injectés par étape (contexte du workflow) | P0 |
| REQ-ORCH-04 | Validation transitions entre étapes (conditions configurables) | P0 |
| REQ-ORCH-05 | Drift detection basique (<15 min) avec alerte | P0 |
| REQ-ORCH-06 | Gestion compaction : kill+relance avec résultats intermédiaires | P0 |
| REQ-ORCH-07 | Gestion compaction : réinjection pré-prompts post-compaction | P1 |
| REQ-ORCH-08 | UI éditeur de workflow : drag-and-drop étapes, prompts, fichiers | P1 |
| REQ-ORCH-09 | Validation humaine configurable (human-in-the-loop) | P0 |
| REQ-ORCH-10 | Persistance résultats intermédiaires à chaque étape | P0 |

### FR-OBS : Observabilité & Audit

**Existe** : activity_log basique (46 lignes), heartbeat_run_events, cost_events.
**Manque** : queries/filtrage/export sur activity_log, résumé LLM.
**À créer** : audit-summarizer.ts, AuditLog.tsx.
**Effort** : 3 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-OBS-01 | Résumé LLM temps réel des actions agent (<5s) | P1 |
| REQ-OBS-02 | Audit log complet : qui/quoi/quand/workflow/étape | P0 |
| REQ-OBS-03 | Dashboards management agrégés — JAMAIS individuels (Vérité #20) | P1 |
| REQ-OBS-04 | Traçabilité décisionnelle : chaque déviation tracée, attribuée, replayable | P1 |
| REQ-OBS-05 | Export audit log (CSV, JSON) | P1 |
| REQ-OBS-06 | Rétention audit ≥3 ans, immutable (TRIGGER deny UPDATE/DELETE) | P1 |

### FR-ONB : Onboarding Cascade

**Existe** : invites avec defaultsPayload, join_requests, requireBoardApprovalForNewAgents.
**Manque** : Cascade hiérarchique, agent conversationnel, import Jira/Linear/ClickUp.
**Effort** : 3-4 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-ONB-01 | Onboarding CEO conversationnel (mode oral, 5-7 échanges max) | P1 |
| REQ-ONB-02 | Cascade hiérarchique : CEO → CTO → Managers → Opérationnels | P1 |
| REQ-ONB-03 | Import intelligent Jira (mapping projets, epics, stories, users, statuts) | P2 |
| REQ-ONB-04 | Dual-mode configuration (oral/visuel selon le persona) | P2 |

### FR-A2A : Agent-to-Agent + Permissions

**Existe** : agents.permissions, reportsTo, principal_permission_grants pour agents, approvals.
**Manque** : Bus messages inter-agents, validation humaine A2A, connecteurs MCP.
**Effort** : 4-5 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-A2A-01 | Query inter-agents avec validation humaine obligatoire | P1 |
| REQ-A2A-02 | Permissions granulaires inter-agents (scope, rôle, projet) | P1 |
| REQ-A2A-03 | Audit de chaque transaction A2A | P1 |
| REQ-A2A-04 | Base connecteurs auto-générés via MCP/codegen | P2 |

### FR-DUAL : Dual-Speed Workflow

**Existe** : workflow_templates.autoTransition, approvals.
**Manque** : Table automation_cursors, hiérarchie d'override, catégorisation tâches.
**Effort** : 2-3 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-DUAL-01 | Curseur d'automatisation 3 positions (Manuel/Assisté/Auto) | P1 |
| REQ-DUAL-02 | Granularité 4 niveaux (action/agent/projet/entreprise) | P1 |
| REQ-DUAL-03 | Plafond hiérarchique : CEO > CTO > Manager > Contributeur | P1 |
| REQ-DUAL-04 | Distinction tâches mécaniques vs jugement | P2 |

### FR-CHAT : Chat Temps Réel avec Agents

**Existe** : live-events.ts (WebSocket unidirectionnel).
**Manque** : WebSocket bidirectionnel, tables chat, pipe vers stdin agent.
**À créer** : agent-chat.ts, agent_chat_messages table, AgentChatPanel.tsx, useAgentChat.ts.
**Effort** : 3 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-CHAT-01 | WebSocket bidirectionnel humain-agent | P0 |
| REQ-CHAT-02 | Dialogue pendant l'exécution du workflow | P0 |
| REQ-CHAT-03 | Reconnexion WebSocket avec sync messages manqués (buffer 30s) | P1 |
| REQ-CHAT-04 | Chat read-only pour viewer | P1 |
| REQ-CHAT-05 | Rate limit messages (10/min) | P1 |

### FR-CONT : Containerisation

**Existe** : adapter pattern (8 types), secrets.ts (4 providers).
**Manque** : ContainerManager complet, container profiles, credential proxy HTTP.
**À créer** : dossier server/src/adapters/docker/ complet, credential-proxy.ts.
**Effort** : 4-5 semaines.

| REQ | Description | Priorité |
|-----|-------------|----------|
| REQ-CONT-01 | Container Docker éphémère `--rm` avec profil configurable | P0 |
| REQ-CONT-02 | Credential proxy HTTP (injection sans exposition) | P0 |
| REQ-CONT-03 | Mount allowlist tamper-proof (realpath + symlinks interdits) | P0 |
| REQ-CONT-04 | Shadow `.env` → `/dev/null` | P0 |
| REQ-CONT-05 | Isolation réseau entre containers | P0 |
| REQ-CONT-06 | Resource limits (CPU, RAM, disk) par profil | P1 |
| REQ-CONT-07 | Timeout avec reset sur output (SIGTERM puis SIGKILL 10s) | P1 |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Métrique | MVP | Enterprise |
|----------|-----|-----------|
| Latence API P50 | <100ms | <50ms |
| Latence API P99 | <500ms | <200ms |
| WebSocket message | <50ms | <20ms |
| Démarrage container | <10s | <5s |
| Requêtes simultanées | 100 | 1000 |
| Dashboard chargement | <2s | <1s |

### 7.2 Sécurité

| NFR | Description | Priorité |
|-----|-------------|----------|
| NFR-SEC-01 | Isolation tenant : PostgreSQL RLS + filtrage companyId systématique | P0 |
| NFR-SEC-02 | Chiffrement TLS 1.3 in transit, AES-256 at rest | P0 |
| NFR-SEC-03 | Credential isolation via proxy HTTP (agents n'accèdent jamais aux clés) | P0 |
| NFR-SEC-04 | Audit immutable — TRIGGER deny UPDATE/DELETE sur audit_events | P1 |
| NFR-SEC-05 | SSO SAML/OIDC (Better Auth extensible) | P1 Enterprise |
| NFR-SEC-06 | Container isolation : namespaces Linux, no-root, resource limits | P1 |
| NFR-SEC-07 | Input sanitization : XSS via chat, SQL injection via scope JSONB | P0 |
| NFR-SEC-08 | CSRF protection : tokens, Origin/Referer, SameSite=Strict | P1 |
| NFR-SEC-09 | Rate limiting : login 5/min, invitations 20/h, chat 10/min | P1 |
| NFR-SEC-10 | Path traversal prevention : realpath + symlinks interdits + null bytes | P0 |

### 7.3 Scalabilité

| Dimension | MVP | Enterprise |
|-----------|-----|-----------|
| Users/instance | 50 | 10 000 |
| Companies/instance | 5 | 500 |
| Agents actifs | 20 | 500 |
| Issues/company | 10 000 | 1 000 000 |
| WebSocket connexions | 100 | 10 000 |

### 7.4 Disponibilité

| Métrique | MVP | Enterprise |
|----------|-----|-----------|
| Uptime | 99.5% | 99.9% |
| RTO | <4h | <30min |
| RPO | <1h | <5min |

### 7.5 Quality Gates

| Gate | Nom | Critère |
|------|-----|---------|
| QG-0 | Compilation | Build TypeScript sans erreur, lint clean |
| QG-1 | Tests unitaires | ≥80% couverture nouveau code, 0 test failing |
| QG-2 | Tests intégration | Routes API protégées, RBAC enforcement, isolation tenant |
| QG-3 | Tests sécurité | OWASP Top 10 vérifié, pas de secret en dur, injection bloquée |
| QG-4 | Tests performance | API <500ms P95, WebSocket <50ms, container <10s |
| QG-5 | Tests E2E | Cypress : flux critiques (login, workflow, chat, RBAC) |
| QG-6 | Review & Audit | Code review, audit log vérifié, migrations réversibles |

### 7.6 Acceptance Criteria Patterns

**AC-UI** : Composant rendu, responsive ≥768px, accessible (WCAG 2.1 AA), chargement <2s.

**AC-API** : Endpoint retourne bon code HTTP, données validées, auth vérifié, audit log émis, erreur formatée.

**AC-WORKFLOW** : State machine transitions valides, fichiers obligatoires vérifiés, résultats intermédiaires persistés, drift détecté <15min.

**AC-AGENT** : Container démarré <10s, credentials non exposées, isolation vérifiée, cleanup automatique.

**AC-PERMISSION** : `canUser()` retourne correct, route protégée (403), UI masque items non-autorisés, scope JSONB lu.

---

## 8. Out of Scope

### 8.1 Features Explicitement Hors MVP

| # | Élément | Raison | Horizon |
|---|---------|--------|---------|
| 1 | Client desktop Electron | Web couvre 100% des cas MVP | Année 2 |
| 2 | Mode offline | Sync/conflict trop complexe, cible B2B connectée | Année 2 |
| 3 | Marketplace de templates workflows | Trop peu de workflows en production | Année 2 |
| 4 | IA de suggestion proactive | Nécessite volume de données d'usage | Post-MVP |
| 5 | Connecteurs auto-générés | Risque sécurité sans containerisation robuste | Phase 4+ |
| 6 | Multi-langue (i18n) | MVP français (cible CBA) | Avant scale international |
| 7 | App mobile native | UI responsive suffit, desktop-first | Non planifié |
| 8 | Intégration CI/CD native | Agents interagissent avec le code, pas les pipelines | Post-MVP |
| 9 | Facturation/paiement | MVP = design partner, billing = go-to-market | T3 2026 |
| 10 | Drift detection ML | V1 = heuristiques, ML quand assez de données | Année 2 |
| 11 | MnM modifiable par ses propres agents | Risque sécurité et complexité trop élevés | Recherche |
| 12 | Assignation dynamique de tâches | Nécessite compréhension fine des compétences | Vision long terme |

### 8.2 Features Exclues du Périmètre MnM

- MnM comme data lake ou remplacement complet Jira
- IDE intégré ou training de modèles IA
- Marketplace plugins ou application mobile
- Billing intégré ou analytics BI avancée
- Gestion RH / évaluation performance (invariant éthique — Vérité #20)

### 8.3 Frontière MVP vs Post-MVP

```
MVP (8-10 sem)                     POST-MVP
├ Multi-user (invitations)         ├ SSO SAML/OIDC
├ RBAC 4 rôles                     ├ Import Jira/Linear
├ Scoping par projet               ├ Multi-tenant SaaS
├ PostgreSQL externe               ├ Curseur complet
├ Orchestrateur v1                 ├ Chat temps réel
├ Drift detection basique          ├ Containerisation
├ Compaction kill+relance          ├ Connecteurs auto
├ Activity log enrichi             ├ Mode ORAL
├ Permissions par route            ├ Dashboards avancés
├ UI admin basique                 ├ Email transactionnel
= VENDABLE à CBA                  = SCALABLE en SaaS
```

---

## 9. Assumptions & Constraints

### 9.1 Hypothèses Marché (4)

| # | Hypothèse | Confiance | Validation |
|---|-----------|-----------|-----------|
| H-M1 | Entreprises ont besoin d'orchestrer agents IA de manière déterministe | Élevée | POC CBA — observer si le déterminisme est utilisé ou contourné |
| H-M2 | Multi-rôle (CEO → Dev) est un différenciateur vendable | Moyenne | Tester onboarding avec 3 premiers rôles (CEO, CTO, Dev) |
| H-M3 | Open-core génère un flywheel OSS → Team → Enterprise | Moyenne | Tracker funnel OSS → Team dès le lancement |
| H-M4 | CBA est représentatif des entreprises cibles | Moyenne | Valider avec 2-3 early adopters hors CBA |

### 9.2 Hypothèses Produit (4)

| # | Hypothèse | Confiance | Validation |
|---|-----------|-----------|-----------|
| H-P1 | Curseur d'automatisation (3 positions) est compris et adopté | Moyenne | Tests utilisateur dès Phase 2 |
| H-P2 | Onboarding conversationnel accepté par CEO/DSI | Moyenne | A/B test chat vs formulaire chez CBA |
| H-P3 | Import Jira = "moment de vérité" pour adoption B2B | Moyenne | Prototype avec données réelles CBA |
| H-P4 | Dashboards agrégés suffisent sans effrayer les opérationnels | Moyenne | Feedback loops deux populations chez CBA |

### 9.3 Hypothèses Techniques (4)

| # | Hypothèse | Confiance | Risque associé |
|---|-----------|-----------|---------------|
| H-T1 | Compaction gérable au niveau plateforme | Moyenne | **R1 — le plus critique du projet**. Spike 1 semaine. |
| H-T2 | Schéma DB (38 tables) absorbe la transformation sans ré-architecture | Élevée | Tables `scope` JSONB déjà en place |
| H-T3 | Docker offre un ratio sécurité/performance acceptable | Élevée | Benchmark latence container vs processus direct |
| H-T4 | WebSocket bidirectionnel supporte 100+ agents simultanés | Élevée | Load test dès Phase 3 |

### 9.4 Hypothèses Organisationnelles (3)

| # | Hypothèse | Confiance | Plan B |
|---|-----------|-----------|--------|
| H-O1 | Split cofondateurs (Tom=B+C, Cofondateur=A+D) permet travail parallèle | Moyenne | Revue dépendances hebdomadaire |
| H-O2 | Cofondateur technique recruté dans 4 semaines | Moyenne | Freelance senior pour Noyau A |
| H-O3 | CBA accepte d'être design partner | Élevée | Pitcher le CTO CBA immédiatement |

### 9.5 Contraintes Réglementaires (13 requirements)

| ID | Catégorie | Résumé | Priorité |
|----|-----------|--------|----------|
| REQ-REG-01 | RGPD | Base légale configurable par traitement | P2 |
| REQ-REG-02 | RGPD | Droit à l'effacement complet (<30j) | P1 |
| REQ-REG-03 | RGPD | Portabilité données JSON/CSV (<30j) | P2 |
| REQ-REG-04 | RGPD | Consentement granulaire + retrait | P1 |
| REQ-REG-05 | RGPD | Privacy by design (TLS, AES-256, pseudonymisation) | P1 |
| REQ-AUDIT-01 | Audit | Log append-only immutable, rétention 3 ans | P1 |
| REQ-AUDIT-02 | Audit | Non-répudiation par hash chain | P2 |
| REQ-AUDIT-03 | Audit | Interface read-only consultation + export | P1 |
| REQ-RESID-01 | Data Residency | On-premise + choix région SaaS | P1 |
| REQ-RESID-02 | Data Residency | Support LLM EU/on-premise | P2 |
| REQ-ACCESS-01 | Accès | Rapport transparence utilisateur | P2 |
| REQ-IA-01 | AI Act | Pas de décision exclusivement automatique | P1 |
| REQ-IA-02 | AI Act | Classification agents par niveau de risque | P2 |

---

## 10. Stratégie de Test & Qualité

### 10.1 Scénarios de Test par FR (35 scénarios Given/When/Then)

#### FR-MU : Multi-User (5 scénarios)

- **SC-MU-01** [P0] : Invitation d'un membre (happy path)
- **SC-MU-02** [P0] : Acceptation d'invitation
- **SC-MU-03** [P1] : Invitation expirée
- **SC-MU-04** [P0] : Désactivation du signup libre
- **SC-MU-05** [P1] : Sign-out et invalidation de session

#### FR-RBAC : Roles et Permissions (5 scénarios)

- **SC-RBAC-01** [P0] : Attribution de rôle par admin
- **SC-RBAC-02** [P0] : Vérification permission sur route protégée (403)
- **SC-RBAC-03** [P1] : Presets de permissions par rôle
- **SC-RBAC-04** [P1] : Masquage navigation selon permissions (absent du DOM)
- **SC-RBAC-05** [P2] : Rôle composite avec héritage

#### FR-ORCH : Orchestrateur (5 scénarios)

- **SC-ORCH-01** [P0] : Exécution step-by-step imposée
- **SC-ORCH-02** [P0] : Drift detection et alerte (<15min)
- **SC-ORCH-03** [P0] : Réinjection post-compaction
- **SC-ORCH-04** [P1] : Kill+relance après compaction
- **SC-ORCH-05** [P0] : Validation humaine (human-in-the-loop)

#### FR-OBS : Observabilité (4 scénarios)

- **SC-OBS-01** [P1] : Résumé LLM temps réel (<5s)
- **SC-OBS-02** [P0] : Audit log complet (qui/quoi/quand/workflow/étape)
- **SC-OBS-03** [P1] : Dashboards agrégés (jamais individuels)
- **SC-OBS-04** [P1] : Traçabilité des décisions

#### FR-A2A, FR-DUAL, FR-CHAT, FR-CONT (16 scénarios)

- **SC-A2A-01** [P0] : Query inter-agents avec validation humaine
- **SC-A2A-02** [P2] : Génération de connecteur
- **SC-A2A-03** [P1] : Permissions granulaires inter-agents
- **SC-DUAL-01** [P0] : Curseur d'automatisation personnel
- **SC-DUAL-02** [P0] : Plafond hiérarchique (CEO > Dev)
- **SC-DUAL-03** [P1] : Brainstorm comme point d'entrée
- **SC-DUAL-04** [P1] : Distinction mécanique vs jugement
- **SC-CHAT-01** [P0] : Dialogue pendant exécution via WebSocket
- **SC-CHAT-02** [P1] : Reconnexion WebSocket (sync messages manqués)
- **SC-CHAT-03** [P1] : Chat read-only pour viewer
- **SC-CHAT-04** [P1] : Message après fin d'exécution (rejeté)
- **SC-CONT-01** [P0] : Container éphémère --rm avec profil
- **SC-CONT-02** [P0] : Credential proxy (injection sans exposition)
- **SC-CONT-03** [P0] : Isolation entre containers
- **SC-CONT-04** [P1] : Timeout avec reset sur output

### 10.2 Edge Cases Critiques (28 cas)

| FR | Edge Cases |
|----|-----------|
| FR-MU (6) | Invitation expirée + renvoi, user déjà membre, email invalide, race condition 2 admins même email, suppression compte agents actifs |
| FR-RBAC (5) | Changement rôle pendant session, dernier admin se rétrograde (bloqué), deny > allow, rôle supprimé avec membres, scope JSONB malformée |
| FR-ORCH (5) | Compaction pendant étape critique (atomique), crash mid-workflow (heartbeat <30s), workflow modifié pendant exécution (version isolée), étape sans fichiers, boucle infinie (watchdog) |
| FR-CHAT (5) | Message après fin exécution (rejeté), reconnexion messages en vol (buffer 30s), flood (rate limit 10/min), message >100KB (troncature), XSS (UTF-8 strict, sanitization) |
| FR-CONT (6) | Timeout (SIGTERM→SIGKILL 10s), OOM kill (code 137, reprofile), path traversal (realpath + symlinks interdits), credential proxy down (503, retry, suspend 3 échecs), Docker daemon indisponible (mode dégradé), épuisement ressources (limite par company, file d'attente) |

### 10.3 Security Testing (12 catégories)

| Catégorie | Tests |
|-----------|-------|
| RBAC Bypass (3) | Escalade horizontale (X-Company-Id), escalade verticale (token viewer), injection SQL via JSONB |
| Container Security (3) | Container escape (mount /etc/shadow), credential proxy tampering, path traversal (null bytes, encodage URL) |
| Input Validation (3) | XSS via chat (script, SVG, markdown), CSRF (SameSite=Strict), SQL injection scope |
| Auth & Session (2) | Session hijacking (expiration, fixation), brute force (rate limit) |
| Multi-Tenant (1) | Isolation inter-company (RLS, API, containers, cache) |

### 10.4 Métriques de Couverture

| Couche | Objectif |
|--------|----------|
| RBAC (hasPermission, canUser) | >95% |
| ContainerManager | >90% |
| Credential proxy | >95% |
| Routes API (auth checks) | 100% |
| Nouveau code (global) | ≥80% |

### 10.5 Smoke Tests Pré-Deploy (7 obligatoires)

1. Login/signup/sign-out
2. Création agent + lancement workflow
3. Chat WebSocket connecte/envoie/reçoit
4. RBAC : viewer ne peut PAS créer agent
5. Container : lancement/exécution/arrêt
6. Credential proxy : valide passe / invalide échoue
7. Aucune donnée cross-company visible

### 10.6 Definitions of Done

**DoD Feature** : ACs implémentés, cas d'erreur gérés, permissions respectées, tests ≥80%, pas de régression, pas de secrets en dur, input sanitisé, `canUser()` branché, mergé, migrations réversibles, TypeScript strict.

**DoD Sprint** : Toutes stories committed Done (ou raison documentée), incrément déployable, tests verts, pas de bug P0/P1 ouvert, review + rétro effectuées.

**DoD Release** : E2E Cypress passants, perf API <500ms P95, charge N users, OWASP vérifié, isolation multi-tenant, RBAC exhaustif, doc déploiement, runbook, monitoring, backup testé, rollback plan.

---

## 11. Traçabilité & Roadmap

### 11.1 Traçabilité FR → Epics

| Epic | Phase | Durée | FRs couverts |
|------|-------|-------|-------------|
| Multi-User MVP | Phase 1 | ~1 semaine | FR-MU (inviter, membres, email, disable signup, sign-out, PostgreSQL) |
| RBAC Métier | Phase 2 | ~2 semaines | FR-RBAC (4 rôles, presets, UI) + FR-A2A partiel (permissions) + FR-OBS partiel (filtrage vues) |
| Scoping par Projet | Phase 3 | ~2-3 semaines | FR-RBAC suite (project_memberships, scope) + FR-A2A (scoping agents) + FR-ONB partiel |
| Orchestrateur Déterministe | Transverse | ~3-5 semaines | FR-ORCH (state machine, compaction, drift, UI config, dashboard) |
| Observabilité & Audit | Transverse | ~2-3 semaines | FR-OBS (résumé LLM, activity log, dashboards, historique) |
| Enterprise-Grade | Phase 4 | ~3-4 semaines | SSO, audit complet, dashboards par rôle, multi-tenant SaaS |
| Onboarding & Import | Post-MVP | ~2-3 semaines | FR-ONB (conversationnel, connecteurs Jira/Linear/ClickUp) |
| Dual-Speed & Chat | Post-MVP | ~3-4 semaines | FR-DUAL (curseur, classification) + FR-CHAT (temps réel, brainstorm) |
| Containerisation & Sécurité | Prérequis B2B | ~3-5 semaines | FR-CONT (ContainerManager, credential proxy, mount allowlist) |

### 11.2 Graphe de Dépendances

```
FR1 (RBAC) → FR2 (Scoping) → FR10 (Import)
     └→ FR3 (Workflow) → FR4 (Drift) → FR7 (Compaction)
FR8 (Container) → FR6 (Chat), FR7 (Compaction), FR12 (A2A)
```

**Piste A (Product Engineer)** : FR1 → FR2 → FR11 → FR10 → FR14
**Piste B (Ingénieur Système)** : FR8 → FR3 → FR7 → FR4

### 11.3 Effort Total

**~16-24 semaines** avec 2 développeurs en parallèle = **8-12 semaines calendaires**.
MVP vendable (Phases 1-3 + Orchestrateur v1) = **8-10 semaines**.

### 11.4 Dette Technique à Résoudre (7 items)

| # | Dette | Sévérité | Effort |
|---|-------|----------|--------|
| DT1 | `hasPermission()` ignore scope | **Critique** | 1-2j |
| DT2 | Drift en mémoire (Map) — perdu au restart | Élevée | 2-3j |
| DT3 | WebSocket unidirectionnel | Moyenne | 2-3j |
| DT4 | 6 permission keys seulement | Moyenne | 0.5j |
| DT5 | Activity log sans query/filtrage | Faible | 1-2j |
| DT6 | Pas de tests automatisés | Moyenne | 3-5j |
| DT7 | heartbeat.ts monolithique (2396 lignes) | Faible | 2-3j |

### 11.5 Analyse Concurrentielle

| Concurrent | Forces | Faiblesse vs MnM |
|-----------|--------|------------------|
| **Jira** | Standard enterprise, 3000+ plugins, SSO/SCIM | Tracking passif, pas d'orchestration, pas de multi-rôle IA |
| **Cursor** | IDE IA dominant ($1B ARR), 50% Fortune 500 | Développeur individuel, pas multi-rôle, pas d'observabilité org |
| **CrewAI** | OSS, role-based agents, 40% plus rapide | Librairie Python, pas de UI, pas d'enterprise |
| **Microsoft Agent Framework** | ⚠️ **Menace la plus sérieuse**. Azure ecosystem, A2A+MCP natif | Building block pas produit fini, Azure-first = lock-in |

**Avantage MnM** : Workflows déterministiques, supervision multi-rôle (CEO-to-Dev), drift detection, curseur d'automatisation, capture savoir tacite, indépendance cloud.

---

## Annexes

### A. Glossaire du Domaine

| Terme | Définition |
|-------|-----------|
| Orchestration déterministique | La plateforme impose algorithmiquement les étapes d'un workflow aux agents |
| Drift detection | Détection temps réel de la déviation d'un agent par rapport à son workflow |
| Compaction | Événement où un LLM atteint sa limite de contexte et doit condenser son historique |
| Kill+relance | Tuer l'agent et le relancer avec contexte frais + résultats intermédiaires |
| Réinjection | Réinjecter les pré-prompts critiques après compaction |
| Curseur d'automatisation | 3 positions (Manuel, Assisté, Auto) par user, dans les limites de la hiérarchie |
| Dual-speed workflow | Flux parallèles : vitesse humaine (réflexion) + vitesse machine (exécution) |
| Onboarding cascade | Adoption hiérarchique : chaque niveau configure le cadre du niveau inférieur |
| Human-in-the-loop | Point de validation humaine obligatoire dans un workflow automatisé |
| Tenant | Entité d'isolation multi-tenant = Company dans MnM |
| Scope | Périmètre d'accès : global (toute la company) ou restreint (projets spécifiques) |
| Container éphémère | Docker isolé, détruit après usage (`--rm`). Isolation credentials + filesystem |
| Credential proxy | Service interceptant les requêtes d'accès aux secrets sans exposer les clés |
| Savoir tribal/tacite | Connaissances non-documentées (edge cases QA, contexte PO). MnM les capture. |


---

*PRD B2B MnM v1.0 — ~7500 mots — 8 contributeurs — Synthèse complète de la transformation B2B enterprise.*
*Prochaine étape : UX Design B2B (Étape 3 du plan d'orchestration)*


---

# PRD B2B — MnM : Tour de Contrôle IA Enterprise
## Sections 1-4 par John le PM

---

## 1. Executive Summary

### 1.1 Contexte

En mars 2026, le marché de l'orchestration IA atteint 13,5 milliards USD avec un CAGR de 22,3%, tandis que le marché des agents IA autonomes explose à 8,5 milliards USD (CAGR 49,6%). Les entreprises déploient massivement des outils IA — Cursor ($29,3 Mrd de valorisation, $1 Mrd ARR), Windsurf ($30M ARR enterprise), agents dans Jira — mais font face à un paradoxe critique : **aucun moyen de les orchestrer, contrôler et auditer à l'échelle de l'organisation**.

Trois forces convergent simultanément :
1. **La maturité des agents IA** — capables d'exécuter des tâches complexes, mais leur fiabilité dépend de garde-fous que personne ne fournit encore. Le CTO de CBA l'a constaté au hackathon de mars 2026 : des agents qui sautent des étapes, ne chargent pas les bons fichiers, dérivent sans contrôle (Vérité #45).
2. **La pression de gouvernance** — déployer de l'IA sans orchestration déterministe et audit trail, c'est comme déployer du cloud sans sécurité. Les plateformes leaders seront celles qui traduisent les intentions en actions step-by-step liées à des politiques.
3. **L'échec structurel des outils existants** — Jira = tracking passif (pas d'orchestration), Cursor = développeur individuel (pas multi-rôle), CrewAI = librairie technique (pas de produit enterprise). Aucun ne combine vision transversale + orchestration d'agents + audit enterprise.

### 1.2 Problème

Dans une entreprise tech en transformation digitale, l'information se dégrade à chaque passage de relais entre rôles (PPT → Epic → Story → Code → Tests). Les contrats inter-rôles ne sont jamais respectés. Les décisions critiques disparaissent. Le savoir tribal reste dans les têtes. Et le coût de la coordination synchrone est colossal — pattern récurrent validé chez CBA : malentendu → dev → découverte du malentendu → re-réunion → re-dev.

Les 8 faits terrain validés chez CBA (mars 2026) confirment que ce problème est structurel, pas accidentel :
1. L'information se dégrade à chaque handoff (Vérité #1)
2. Les contrats inter-rôles sont aspirationnels, jamais appliqués (Vérité #2)
3. Des décisions non-documentées se prennent en permanence (Vérité #3)
4. Le savoir critique est partiellement tacite (Vérité #5)
5. La boucle de feedback est structurellement trop longue (Vérité #6)
6. L'alignement inter-équipe est un goulot d'étranglement synchrone (Vérité #13)
7. L'information de pilotage n'existe nulle part de manière unifiée (Vérité #15)
8. Les workflows actuels CRÉENT des problèmes qui n'existeraient pas sans eux (Vérité #23)

### 1.3 Solution

**MnM** est une plateforme B2B d'orchestration d'agents IA déterministe, conçue pour être la **Tour de Contrôle IA Enterprise**. À l'intersection de trois océans rouges saturés (gestion de projet, IDE IA, frameworks agentiques), MnM occupe un white space unique : **orchestration déterministe + supervision multi-rôle pour l'ensemble de l'organisation**.

MnM est à l'orchestration d'agents IA ce que Kubernetes est à l'orchestration de containers : une couche de contrôle indispensable entre l'humain et l'exécution.

MnM se structure autour de 5 noyaux de valeur :
- **Noyau A — Orchestrateur Déterministe** : L'agent fait EXACTEMENT ce qu'on lui dit. Workflows imposés algorithmiquement, pas suggérés. Gestion de compaction au niveau plateforme (kill+relance ou réinjection). Drift detection.
- **Noyau B — Observabilité & Audit** : Voir tout, tracer tout, prouver tout. Résumé LLM temps réel, audit centralisé, containerisation des agents avec credential proxy.
- **Noyau C — Onboarding Cascade** : Du CEO au dev, chaque niveau configure son périmètre. Dual-mode oral/visuel. Import intelligent depuis Jira/Linear/ClickUp.
- **Noyau D — Agent-to-Agent + Permissions** : Communication inter-agents avec permissions human-in-the-loop. Query directe du contexte inter-agents. Connecteurs auto-générés.
- **Noyau E — Dual-Speed Workflow** : Vitesse humaine (réflexion) + vitesse machine (exécution) en parallèle. Curseur d'automatisation individuel (manuel → assisté → automatique).

### 1.4 Scope du PRD

Ce PRD couvre la transformation complète de MnM : d'un cockpit mono-utilisateur de supervision d'agents IA en une plateforme B2B enterprise. Il spécifie les 9 blocs fonctionnels (FR-MU, FR-RBAC, FR-ORCH, FR-OBS, FR-ONB, FR-A2A, FR-DUAL, FR-CHAT, FR-CONT), les requirements non-fonctionnels, les user journeys par persona, le domain model, et la stratégie de test.

### 1.5 Timeline

Le plan d'implémentation se décompose en 4 phases séquentielles :
- **Phase 1 — Multi-user livrable** (~1 semaine) : invitations humaines, page membres, sign-out, PostgreSQL externe
- **Phase 2 — RBAC métier** (~2 semaines) : rôles admin/manager/contributor/viewer, 9 nouvelles clés de permissions, UI admin
- **Phase 3 — Scoping par projet** (~2-3 semaines) : project memberships, filtrage par scope JSONB, UI d'accès par projet
- **Phase 4 — Enterprise-grade** (~3-4 semaines) : SSO SAML/OIDC, audit complet, multi-tenant, dashboards par rôle

**Total estimé : ~8-10 semaines** pour atteindre un produit B2B vendable, avec démonstration CBA en juin 2026.

---

## 2. Classification

### 2.1 Type de produit

**Plateforme B2B d'orchestration d'agents IA déterministe** — Catégorie nouvelle ("Tour de Contrôle IA Enterprise"). Positionnée à l'intersection de la gestion de projet, des IDE IA, et des frameworks agentiques sans appartenir à aucune de ces catégories.

### 2.2 Plateforme cible

| Plateforme | Priorité | Détail |
|------------|----------|--------|
| **Web (React + Vite)** | P0 — MVP | Application web responsive, UI principale |
| **API REST + WebSocket** | P0 — MVP | Backend Express + tsx, API ouverte, temps réel bidirectionnel |
| **Desktop (Electron)** | P2 — Futur | Client desktop natif pour expérience hors-ligne et performance |
| **CLI** | P2 — Futur | Interface ligne de commande pour développeurs avancés |

### 2.3 Stack technique

| Couche | Technologie | Maturité actuelle |
|--------|------------|-------------------|
| **Monorepo** | pnpm workspaces | Mature — `packages/shared`, `packages/db`, `server`, `ui` |
| **Frontend** | React 18 + Vite, React Query, Tailwind CSS, shadcn/ui | Mature |
| **Backend** | Express + tsx, Node.js | Mature |
| **Base de données** | PostgreSQL (Drizzle ORM), 38 tables existantes | Mature |
| **Temps réel** | WebSocket (ws) + EventEmitter interne | Fonctionnel (read-only → à rendre bidirectionnel) |
| **Auth** | Better Auth (email+password, sessions DB) | Complet |
| **Agents** | 8 types d'adapters (claude_local, codex, openclaw, etc.) | Extensible |
| **Secrets** | Versionnés, 4 providers (local, AWS, GCP, Vault) | Avancé |
| **Containerisation** | Docker (dockerode) — à implémenter | Planifié |

### 2.4 Modèle de licence — Open-core

| Tier | Cible | Prix | Contenu |
|------|-------|------|---------|
| **Open Source** | Dev solo, freelance, small team (<5) | Gratuit | Orchestrateur déterministique complet, workflows personnalisables, observabilité basique. Auto-hébergement uniquement. |
| **Team** | Équipe 5-50, startups, PME tech | ~50€/utilisateur/mois | Multi-users, RBAC métier, scoping par projet, import intelligent, chat temps réel, containerisation. Cloud managed ou self-hosted. |
| **Enterprise** | Grande entreprise 100+ users | ~200€/utilisateur/mois + support | SSO SAML/OIDC, audit log complet, drift detection avancée, multi-tenant, dashboards par rôle, credential isolation, SLA garanti + CSM. |
| **On-Premise** | Secteurs réglementés (banque, santé, défense) | Licence annuelle sur mesure | Déploiement complet chez le client, zero data exfiltration, connecteurs custom. |

**Projection revenus :** Année 1 ~100k€ ARR, Année 2 ~800k€, Année 3 ~3M€.

### 2.5 Audiences cibles — 9 personas

1. **CEO** — Pilote stratégique (mode oral). Consomme des synthèses, dicte sa stratégie conversationnellement.
2. **CTO / DSI** — Garant technique (mode visuel). Dashboards drift detection, monitoring agents, config SSO.
3. **DPO** — Chef d'orchestre produit (mode board). Vue inter-équipes, détection conflits roadmap.
4. **PM** — Stratège produit (mode board + oral). Brainstorm assisté → output structuré exploitable.
5. **PO** — Traducteur de besoins (mode board). Agents écrivent les stories, le PO valide.
6. **Designer** — Architecte de l'expérience (mode visuel). Notification dans le workflow, lien maquettes→stories.
7. **Développeur** — Artisan du code (mode code). Agent personnel avec contexte complet, dialogue temps réel.
8. **QA / Testeur** — Gardien de la qualité (mode test). Capture progressive du savoir tacite, shift-left.
9. **Lead Tech** — Gardien de l'architecture (mode code + visuel). Monitoring dette/dépendances, reviews augmentées.

---

## 3. Success Criteria

Les critères de succès sont structurés selon les 5 noyaux de valeur et les KPIs business transverses, avec des cibles progressives à 3 mois (MVP déployé chez CBA) et 12 mois (produit commercial). Chaque critère est numéroté, mesurable, et traçable vers le Product Brief.

### 3.1 Noyau A — Orchestrateur Déterministe

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-A1** | Taux de respect workflows | % d'exécutions d'agents suivant le workflow sans déviation | >90% | >98% | Comptage auto : runs conformes / total runs via logs moteur orchestration |
| **SC-A2** | Temps de détection drift | Délai entre déviation agent et alerte utilisateur | <15 min | <2 min | Timestamp diff : événement drift logs → notification UI/webhook |
| **SC-A3** | Réinjection contexte réussie | % de compactions avec restauration réussie du contexte critique | >85% | >95% | Test auto : après compaction, vérifier reprise workflow bonne étape + bons fichiers |
| **SC-A4** | Workflows actifs | Nombre de workflows configurés et utilisés activement | 10+ | 50+ | Count distinct workflows avec >= 1 run dans les 7 derniers jours |
| **SC-A5** | Fiabilité compaction | % de sessions agent survivant à une compaction sans perte de progression | >80% | >95% | Monitoring : sessions pre/post compaction avec résultat identique |

### 3.2 Noyau B — Observabilité & Audit

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-B1** | Couverture d'audit | % des actions agent/humain générant un audit log | 100% runs | 100% runs | Comparer événements loggés vs actions moteur d'exécution |
| **SC-B2** | Latence observabilité | Délai action agent → affichage dashboard | <5s | <2s | Mesure E2E : timestamp action → timestamp rendu UI (WebSocket + rendering) |
| **SC-B3** | Réduction MTTR | Réduction du temps moyen de résolution problèmes agents | -40% | -70% | Baseline CBA avant MnM vs après. Temps alerte → résolution confirmée |
| **SC-B4** | NPS transparence agent | Satisfaction utilisateurs sur lisibilité actions agents | >25 | >50 | Enquête in-app trimestrielle (échelle 0-10 NPS) |
| **SC-B5** | Isolation container | % d'agents enterprise exécutés dans un container isolé | >90% | 100% | Count agents containerisés / total agents en mode Enterprise |

### 3.3 Noyau C — Onboarding Cascade

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-C1** | Temps onboarding company | Durée création company → premier workflow actif | <1 semaine | <2 jours | Timestamp diff : création company → premier workflow run |
| **SC-C2** | Taux complétion onboarding | % d'utilisateurs invités complétant leur configuration | >70% | >90% | Funnel : invitation → profil → premier agent → premier workflow |
| **SC-C3** | Temps import initial | Durée d'import depuis Jira/Linear/ClickUp | <3 jours | <1 jour | Mesure auto du temps import (début → fin, incluant mapping + validation) |
| **SC-C4** | Cascade hiérarchique activée | % de companies avec >= 3 niveaux hiérarchiques configurés | >50% | >80% | Count companies avec CEO + manager + contributeur actifs |

### 3.4 Noyau D — Agent-to-Agent & Permissions

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-D1** | Queries inter-agents/semaine | Volume communications entre agents d'utilisateurs différents | 50+ | 500+ | Count requêtes A2A dans les logs, par semaine |
| **SC-D2** | Réduction temps handoff | Réduction délai production artefact → consommation rôle suivant | -30% | -70% | Baseline CBA vs MnM : timestamp artefact produit → consommé |
| **SC-D3** | Connecteurs auto-générés | Connecteurs vers outils externes créés par les agents | 0 (MVP) | >5 par client | Count connecteurs table Connector avec flag auto_generated |
| **SC-D4** | Taux validation humaine A2A | % des requêtes inter-agents passant par validation humaine | 100% | >80% (reste configurable) | Count requêtes validées / total requêtes A2A |

### 3.5 Noyau E — Dual-Speed Workflow

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-E1** | Ratio exécution/réflexion | Proportion temps exécution mécanique vs réflexion stratégique | 60/40 | 20/80 | Enquête mensuelle + tracking : temps mode "exécution agent" vs "brainstorm/validation" |
| **SC-E2** | Position moyenne curseur | Position moyenne curseur d'automatisation par utilisateur | 1.5 | 2.5 | Moyenne pondérée (1=manuel, 2=assisté, 3=auto) sur users actifs |
| **SC-E3** | Savoir tacite capturé | Volume connaissances formalisées dans MnM | 100 items | 1000+ items | Count knowledge items (prompts perso, règles validation, edge cases formalisés) |
| **SC-E4** | Adoption chat temps réel | % d'utilisateurs actifs utilisant le chat agent au moins 1x/semaine | >40% | >70% | WAU chat / WAU total |

### 3.6 KPIs Business Transverses

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-BIZ-1** | Premier client pilote | CBA comme design partner | POC signé | Production + case study | Contrat → déploiement → métriques → case study publiée |
| **SC-BIZ-2** | ARR | Chiffre d'affaires récurrent annuel | 10-30k€ | 200k€ | Comptabilité : MRR x 12 |
| **SC-BIZ-3** | Rôles non-dev actifs | % d'utilisateurs actifs non-développeurs | >30% | >40% | (Users actifs rôle non-dev / total users actifs) x 100 |
| **SC-BIZ-4** | Rétention 90 jours | % d'utilisateurs actifs 90j après onboarding | >70% | >85% | Cohorte : users avec action dans les 7 derniers jours / total cohorte 90j |
| **SC-BIZ-5** | Adoption multi-tier | Flywheel OSS → Team → Enterprise | 500 MAU OSS | 5000 MAU OSS, 25 Team, 5 Enterprise | Tracking par tier dans DB instances |
| **SC-BIZ-6** | Time-to-value | Temps entre premier login et première valeur perçue | <2h | <30min | Timestamp login → première action "valeur" (workflow run, insight dashboard) |
| **SC-BIZ-7** | Satisfaction globale | CSAT des utilisateurs actifs | >3.5/5 | >4.2/5 | Enquête in-app trimestrielle |

**Total : 26 critères mesurables** (5 + 5 + 4 + 4 + 4 + 7 par section).

---

## 4. Scoping

### 4.1 In Scope — Les 9 blocs fonctionnels MVP

Les 9 blocs fonctionnels couvrent l'intégralité de la transformation B2B de MnM. Chacun correspond à un domaine fonctionnel distinct avec ses propres requirements, numérotés et traçables vers les REQ du Product Brief.

| Bloc | Code | Description | Noyau | REQ sources |
|------|------|-------------|-------|-------------|
| Multi-user & Auth | **FR-MU** | Invitations humaines, page membres, sign-out, profil user, désactivation signup libre, migration PostgreSQL externe | Prérequis | — |
| Rôles & Permissions | **FR-RBAC** | 4 rôles métier (admin, manager, contributor, viewer), presets de permissions, enforcement dans chaque route, UI admin | Prérequis | REQ-ENT-01, REQ-ENT-02 |
| Orchestrateur déterministique | **FR-ORCH** | Enforcement algorithmique des workflows, gestion de compaction (kill+relance ou réinjection), injection de contexte par étape, drift detection v1 | A | REQ-ORCH-01 à 05 |
| Observabilité & Audit | **FR-OBS** | Résumé LLM temps réel, audit log centralisé, dashboards management agrégés (jamais individuels), traçage décisionnel | B | REQ-OBS-01 à 04 |
| Onboarding cascade | **FR-ONB** | Onboarding hiérarchique (CEO → CTO → Leads → opérationnels), dual-mode (oral/visuel), import intelligent Jira/Linear/ClickUp | C | REQ-ONB-01 à 04 |
| Agent-to-Agent + Permissions | **FR-A2A** | Communication inter-agents avec validation humaine, query de contexte inter-agents, base pour connecteurs auto-générés | D | REQ-A2A-01, 02, 04 |
| Dual-speed workflow | **FR-DUAL** | Curseur d'automatisation (manuel/assisté/auto) par action/agent/projet/entreprise, distinction tâches mécaniques vs jugement, brainstorm comme point d'entrée | E | REQ-DUAL-01 à 04 |
| Chat temps réel avec agents | **FR-CHAT** | WebSocket bidirectionnel humain-agent, dialogue pendant l'exécution, pilotage temps réel des agents | E + B | REQ-DUAL-03 |
| Containerisation | **FR-CONT** | Docker containers éphémères `--rm`, credential proxy HTTP, mount allowlist tamper-proof, shadow `.env` `/dev/null`, 5 couches de défense en profondeur | B (sécurité) | — |

### 4.2 Out of Scope — Explicitement hors MVP

Les 12 éléments suivants sont **intentionnellement exclus** du scope MVP. Chacun est identifié comme important mais reporté pour des raisons de focus, complexité technique, ou dépendance à des validations terrain.

| # | Élément | Raison d'exclusion | Horizon envisagé |
|---|---------|-------------------|-----------------|
| 1 | **Client desktop Electron** | Le web couvre 100% des cas d'usage MVP. Desktop = optimisation, pas nécessité. | Post-MVP (Année 2) |
| 2 | **Mode offline** | Architecture sync/conflict resolution complexe. La cible B2B a une connexion stable. | Post-MVP (Année 2) |
| 3 | **Marketplace de templates workflows** | Trop peu de workflows en production pour justifier un marketplace. Templates intégrés d'abord. | Année 2 quand flywheel actif |
| 4 | **IA de suggestion proactive de workflows** | Nécessite un volume de données d'usage significatif. MnM doit d'abord CAPTURER ces données (Vérité #9). | Post-MVP, quand >1000 workflows actifs |
| 5 | **Connecteurs auto-générés par agents** | Possible via MCP/codegen, mais risque sécurité trop élevé sans containerisation robuste. | Phase 4+ quand FR-CONT mature |
| 6 | **Multi-langue (i18n)** | MVP en français (cible CBA). Internationalisation après validation PMF. | Avant scale international (Année 2) |
| 7 | **App mobile native** | UI responsive suffit. Le cockpit MnM est une expérience desktop-first. | Non planifié |
| 8 | **Intégration CI/CD native** | Les agents MnM interagissent avec le code, pas avec les pipelines CI/CD directement. | À évaluer post-MVP |
| 9 | **Facturation/paiement intégré** | MVP = design partner (CBA). Stripe/billing = go-to-market commercial. | Phase commerciale (T3 2026) |
| 10 | **Drift detection avancée (ML)** | V1 = règles heuristiques. ML = quand assez de données. Non-bloquant MVP (risque R4). | Année 2 |
| 11 | **MnM modifiable par ses propres agents** | Vision long terme fascinante (REQ-A2A-03), mais risque sécurité et complexité trop élevés. | Recherche (Année 2+) |
| 12 | **Assignation dynamique de tâches** | Utopique à court terme (What If #1). Nécessite compréhension fine des compétences individuelles. | Vision long terme |

### 4.3 Assumptions — Hypothèses sur lesquelles le PRD repose

#### Hypothèses marché (H-M)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-M1** | Les entreprises en transformation digitale ont besoin d'orchestrer leurs agents IA de manière déterministe, pas seulement de les déployer | MnM résout un problème inexistant | POC CBA — observer si le déterminisme est utilisé ou contourné |
| **H-M2** | Le multi-rôle (CEO → Dev dans un seul outil) est un différenciateur vendable, pas une complexité repoussante | Trop de personas = produit confus | Tester l'onboarding avec les 3 premiers rôles (CEO, CTO, Dev) avant d'élargir |
| **H-M3** | Le modèle open-core génère un flywheel d'adoption Dev solo → Team → Enterprise | L'OSS ne convertit pas en payant | Tracker le funnel OSS → Team précisément dès le lancement |
| **H-M4** | CBA est représentatif des entreprises cibles (PME tech en transformation) | CBA est un cas particulier non-généralisable | Valider avec 2-3 early adopters hors CBA avant de scaler |

#### Hypothèses produit (H-P)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-P1** | Le curseur d'automatisation (manuel → assisté → auto) est compris et adopté par les utilisateurs | UX trop conceptuelle, personne ne l'utilise | Tests utilisateur dès Phase 2 — observer si les users déplacent le curseur |
| **H-P2** | L'onboarding conversationnel (mode oral) est accepté par les CEO/DSI | Le CEO veut un formulaire classique, pas un chat | A/B test : onboarding chat vs formulaire chez CBA |
| **H-P3** | L'import Jira/Linear est le "moment de vérité" pour l'adoption B2B | Import trop complexe ou données trop sales | Prototype import avec données réelles CBA avant implémentation complète |
| **H-P4** | Les dashboards agrégés (jamais individuels) suffisent à convaincre les managers SANS effrayer les opérationnels (Vérité #20) | Managers veulent du granulaire, opérationnels ne font pas confiance | Feedback loops avec les deux populations chez CBA |

#### Hypothèses techniques (H-T)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-T1** | La gestion de compaction est réalisable au niveau plateforme (kill+relance ou réinjection de pré-prompts) | C'est le risque R1 — le plus critique du projet | Spike technique de 1 semaine avant engagement |
| **H-T2** | Le schéma DB existant (38 tables, Drizzle) absorbe la transformation B2B sans ré-architecture | Migration massive nécessaire, retard significatif | Analyse Winston (section Domain Model PRD) — tables `scope` JSONB déjà en place |
| **H-T3** | La containerisation Docker offre un ratio sécurité/performance acceptable pour agents temps réel | Overhead Docker trop élevé | Benchmark : latence container vs processus direct |
| **H-T4** | Le WebSocket bidirectionnel supporte 100+ agents simultanés par instance | Goulot d'étranglement performance | Load test dès Phase 3 |

#### Hypothèses organisationnelles (H-O)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-O1** | Le split cofondateurs (Tom = Noyaux B+C, Cofondateur = Noyaux A+D) permet un travail parallèle efficace | Dépendances croisées bloquent le parallélisme | Revue de dépendances hebdomadaire |
| **H-O2** | Un cofondateur technique sera recruté dans les 4 prochaines semaines | Tom doit tout faire seul → timeline x2 | Plan B : freelance senior pour le Noyau A |
| **H-O3** | CBA accepte d'être design partner avec accès privilégié et feedback structuré | Pas de terrain de validation réel | Pitcher le CTO de CBA immédiatement (action n°1 Product Brief) |

**Total : 15 hypothèses** (4 marché + 4 produit + 4 technique + 3 organisationnelle).

---

*Section produite par John le PM — ~3500 mots, format PRD professionnel, traçabilité complète vers le Product Brief B2B v2.0 et les 57 vérités fondamentales du brainstorming cofondateurs.*

---

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

---

# PRD Section 3 — Analyse de Domaine, Requirements Concurrentiels & Réglementaires

*Par Mary l'Analyste 📊* | Task #3 | 2026-03-13

---

## PARTIE 1 — Domain Analysis Approfondie : L'Orchestration d'Agents IA Enterprise

### 1.1 Acteurs du domaine

Le domaine de MnM met en jeu deux catégories fondamentales d'acteurs : les **acteurs humains** et les **acteurs machine (agents IA)**. Leur interaction structurée est le coeur du produit.

#### Acteurs humains

| Acteur | Rôle dans le domaine | Interactions clés |
|--------|---------------------|-------------------|
| **CEO / DSI** | Pilote stratégique. Définit la structure organisationnelle, les priorités, les plafonds d'automatisation. Consomme des synthèses agrégées. | Configure via mode ORAL, valide la cascade, interroge les agents pour insights |
| **CTO / Lead Tech** | Garant technique. Définit les workflows déterministiques, les standards, les politiques de drift. Configure SSO et sécurité. | Mode VISUEL + CODE, monitoring drift, définition des templates de workflow |
| **DPO (Directeur Produit)** | Chef d'orchestre produit. Supervise la roadmap, les inter-dépendances, la cohérence cross-équipes. | Mode BOARD + ORAL, vue inter-équipes, résolution de conflits |
| **PM (Product Manager)** | Stratège produit. Brainstorme, structure les epics, connecte recherche et exécution. | Mode BOARD + ORAL, brainstorm assisté, output structuré exploitable |
| **PO (Product Owner)** | Traducteur de besoins. Valide les stories générées, capture le savoir tribal, assure la Definition of Ready. | Mode BOARD, validation des artefacts agents, enrichissement progressif du savoir |
| **Designer** | Architecte de l'expérience. Produit les maquettes, intervient tôt dans le cycle de workflow. | Notification automatique dans le workflow, maquettes liées aux stories |
| **Développeur** | Artisan du code. Pilote son agent personnel en temps réel, review le code généré, contribue cross-rôles. | Mode CODE, dialogue temps réel avec agent, curseur d'automatisation personnel |
| **QA / Testeur** | Gardien de la qualité. Formalise le savoir tacite en tests, valide la couverture, capture les edge cases. | Mode TEST, capture progressive du savoir, shift-left |
| **Instance Admin** | Super-administrateur technique. Gère le déploiement, la configuration globale, la maintenance. | Configuration multi-tenant, backup/restore, health monitoring |

#### Acteurs machine (Agents IA)

| Type d'agent | Fonction | Contraintes |
|-------------|----------|-------------|
| **Agent d'onboarding** | Guide conversationnel pour la configuration initiale (CEO, CTO, etc.) | Doit respecter la cascade hiérarchique |
| **Agent d'exécution** | Exécute les tâches dans un workflow déterministique (code, tests, stories, analyses) | Contraint par le workflow template, containerisé, avec credentials isolées |
| **Agent de reporting** | Synthétise les données d'avancement, KPIs, alertes pour le management | Accès en lecture seule, agrégation obligatoire (jamais individuel) |
| **Agent de brainstorm** | Accompagne les sessions de réflexion, structure les outputs | Mode manuel ou assisté uniquement (jamais full auto pour la créativité) |
| **Agent inter-rôle** | Proxy de communication entre les agents de différents utilisateurs | Soumis aux permissions human-in-the-loop, query avec validation |
| **Agent connecteur** | Génère et maintient les connecteurs vers les systèmes externes (Jira, Linear, etc.) | Auto-généré via MCP/codegen, validé par le CTO |

### 1.2 Processus métier clés

#### Processus 1 — Onboarding Cascade

```
CEO définit la structure (mode oral)
  → CTO raffine la stratégie technique (mode visuel)
    → Managers définissent leur périmètre
      → Opérationnels configurent leurs workflows et agents
```

**Caractéristiques :** Chaque niveau définit le cadre du niveau inférieur. Les pairs d'un même niveau se coordonnent pour assurer la cohérence. L'import depuis les outils existants (Jira, Linear, ClickUp) est le "moment de vérité" de l'adoption.

#### Processus 2 — Orchestration Déterministique d'un Workflow

```
Template Workflow défini (étapes, fichiers obligatoires, prompts, contraintes)
  → Agent assigné et lancé dans un container éphémère
    → Exécution step-by-step imposée par la plateforme (pas par le LLM)
      → Drift detection en continu
        → Si compaction : kill+relance ou réinjection des pré-prompts
          → Résultats intermédiaires persistés à chaque étape
            → Validation humaine selon le curseur d'automatisation
```

#### Processus 3 — Communication Inter-Agents (A2A)

```
Agent A (du Dev) a besoin du contexte de l'Agent B (du PO)
  → Agent A émet une requête de query inter-agent
    → MnM vérifie les permissions (scope, rôle, projet)
      → Le propriétaire humain de l'Agent B reçoit une notification (si mode assisté/manuel)
        → Si approuvé : Agent A reçoit le contexte demandé
          → Audit log enregistre la transaction
```

#### Processus 4 — Audit et Observabilité

```
Toute mutation dans le système génère un AuditLog
  → LLM analyse les traces en temps réel → résumé simplifié
    → Dashboards management : données agrégées (JAMAIS individuelles)
      → Drift detection : alerte quand un agent dévie de son workflow
        → Replay possible : chaque déviation est tracée, attribuée, replayable
```

#### Processus 5 — Gestion du Curseur d'Automatisation

```
Entreprise définit un plafond global (ex: "aucun merge sans validation humaine")
  → CTO définit par projet (ex: "projet legacy = assisté")
    → Utilisateur choisit par agent/action (ex: "tests = auto, code review = assisté")
      → Hiérarchie l'emporte : le niveau supérieur ne peut pas être dépassé
        → Évolution naturelle : Manuel (S1-2) → Assisté (M1) → Auto (M3+)
```

### 1.3 Règles métier (invariants, contraintes, politiques)

#### 5 Invariants fondamentaux du domaine

1. **Isolation Company (INV-01)** : Aucun accès cross-company sans membership explicite. Toutes les routes passent par `assertCompanyAccess`. Toutes les queries UI scopées par `companyId`.

2. **Déterminisme Workflow (INV-02)** : Un agent est TOUJOURS contraint par son Workflow template. L'agent n'interprète pas le workflow — MnM l'exécute pour lui. Les étapes, fichiers obligatoires, et prompts sont imposés algorithmiquement.

3. **Audit Total (INV-03)** : Toute mutation dans le système génère un AuditLog. Qui, quoi, quand, dans quel workflow, avec quel résultat. Aucune action ne peut contourner l'audit.

4. **Permission Scope (INV-04)** : Sans scope = accès à toute la Company. Avec scope = uniquement les Projects spécifiés. Le champ `scope` JSONB sur `principalPermissionGrants` doit être lu et appliqué (actuellement stocké mais jamais lu — trou identifié).

5. **Curseur Individuel (INV-05)** : L'automatisation est configurable par le propriétaire, dans les limites imposées par son Role et la hiérarchie. Le plafond supérieur l'emporte toujours.

#### Contraintes métier additionnelles

- **C-01 : Métriques agrégées uniquement** — Les dashboards management ne montrent JAMAIS de données individuelles (Vérité #20). Pas de flicage.
- **C-02 : Élévation, pas remplacement** — L'automatisation est présentée comme une élévation du rôle (de producteur à validateur), jamais comme un remplacement.
- **C-03 : Source unique de vérité** — Après import depuis Jira/Linear, MnM devient LA source de vérité. Pas de double saisie.
- **C-04 : Containerisation obligatoire en multi-tenant** — Les agents doivent être isolés dans des containers Docker éphémères avant toute injection de messages en production multi-tenant.
- **C-05 : Credential proxy** — Aucune clé API ne doit être visible par les agents directement. Passage obligatoire par un proxy HTTP de credentials.

### 1.4 Glossaire du domaine

| Terme | Définition |
|-------|-----------|
| **Orchestration déterministique** | Mode d'exécution où la plateforme impose algorithmiquement les étapes d'un workflow aux agents, par opposition à l'orchestration probabiliste où le LLM "interprète" le workflow |
| **Drift detection** | Capacité à détecter en temps réel quand un agent IA dévie de son workflow assigné. Basé sur des signatures comportementales enrichies par chaque drift détecté/confirmé |
| **Compaction** | Événement où un LLM atteint sa limite de fenêtre de contexte et doit résumer/condenser son historique, perdant potentiellement des informations critiques du workflow |
| **Kill+relance** | Stratégie de gestion de compaction : tuer l'agent et le relancer avec un contexte frais + résultats intermédiaires déjà produits |
| **Réinjection** | Stratégie alternative de compaction : réinjecter les pré-prompts critiques et la définition du workflow après la compaction |
| **Curseur d'automatisation** | Mécanisme à 3 positions (Manuel, Assisté, Automatique) permettant à chaque utilisateur de contrôler son niveau d'automatisation, dans les limites fixées par la hiérarchie |
| **Dual-speed workflow** | Architecture de flux parallèles : vitesse humaine (réflexion, décision, asynchrone) et vitesse machine (exécution, coordination, temps réel) |
| **Onboarding cascade** | Processus d'adoption hiérarchique où chaque niveau organisationnel configure le cadre du niveau inférieur |
| **Human-in-the-loop** | Point de validation humaine obligatoire dans un workflow automatisé. Exigence enterprise standard |
| **Tenant** | Entité d'isolation dans un déploiement multi-tenant. Correspond à une Company dans MnM |
| **Scope** | Périmètre d'accès d'un utilisateur au sein d'une Company. Peut être global (toute la company) ou restreint (projets spécifiques) |
| **Agent-to-Agent (A2A)** | Communication directe entre agents IA de différents utilisateurs, avec permissions et validation humaine |
| **Connecteur auto-généré** | Interface créée automatiquement par un agent MnM pour interagir avec un système externe (Jira, Slack, etc.) via MCP ou codegen |
| **Workflow template** | Définition réutilisable d'un processus : étapes, fichiers obligatoires, prompts injectés, contraintes, critères de validation |
| **Workflow instance** | Exécution concrète d'un workflow template par un agent, avec état persisté et audit |
| **Container éphémère** | Environnement Docker isolé créé pour l'exécution d'un agent, détruit après usage (`--rm`). Garantit l'isolation des credentials et du filesystem |
| **Credential proxy** | Service MnM qui intercepte les requêtes d'accès aux secrets/API des agents et les route vers le provider approprié (local, AWS, GCP, Vault) sans exposer les clés |
| **Savoir tribal / tacite** | Connaissances non-documentées détenues par les experts (edge cases QA, contexte métier PO). MnM les capture progressivement pour les rendre queryables |
| **Mode oral** | Interface conversationnelle où l'utilisateur dicte ses intentions et MnM structure. Destiné au CEO, DSI, DPO |
| **Mode visuel** | Interface dashboards, graphes, monitoring. Destiné au CTO, Lead Tech |

---

## PARTIE 2 — Competitive Requirements

### 2.1 Jira (Atlassian) — Standard enterprise gestion de projet

| Capacité Jira | Détail | Requirement MnM |
|--------------|--------|-----------------|
| **Tracking de tickets et sprints** | Backlog, sprint boards, velocity, burndown | MnM DOIT fournir un mode BOARD avec kanban, epics, stories, suivi sprint au minimum équivalent. L'agent augmente le tracking passif. |
| **Agents in Jira (fév. 2026)** | Assigner des tâches basiques à des agents IA | MnM DOIT proposer des agents d'exécution complets (pas juste du triage) avec orchestration déterministique, ce que Jira ne fait pas. |
| **Marketplace d'intégrations** | 3000+ apps/plugins | MnM DOIT proposer un système de connecteurs auto-générés et un support MCP natif. La capacité des agents à créer leurs propres connecteurs compense l'absence d'un marketplace mature. |
| **Permissions enterprise** | Schémas de permissions complexes, groupes, rôles projet | MnM DOIT égaler avec RBAC métier (admin, manager, contributor, viewer), scoping par projet, et permissions composites. |
| **Audit log** | Journal d'activité basique | MnM DOIT SURPASSER avec un audit log complet couvrant aussi les actions des agents IA, pas seulement des humains. |
| **SSO / SAML / SCIM** | Intégration AD/Okta/Azure AD standard | MnM DOIT supporter SSO SAML/OIDC pour être déployable en enterprise. Prérequis non-négociable. |
| **Import/Export** | CSV, API REST | MnM DOIT proposer un import intelligent depuis Jira (mapping automatique des projets, epics, stories, utilisateurs, statuts). |
| **API REST mature** | API documentée, webhooks | MnM DOIT exposer une API documentée pour l'intégration dans les écosystèmes enterprise existants. |

**Ce que MnM fait que Jira ne fera JAMAIS :** Workflows déterministiques, orchestration inter-rôles CEO-to-Dev, drift detection, dual-speed workflow, capture du savoir tacite, curseur d'automatisation.

### 2.2 Cursor (Anysphere) — IDE IA dominant

| Capacité Cursor | Détail | Requirement MnM |
|----------------|--------|-----------------|
| **Édition code IA** | Tab completion, multi-file edit, agent mode | MnM n'est PAS un IDE. MnM DOIT orchestrer les IDE (y compris Cursor) via des connecteurs. L'agent dev MnM pilote le code dans l'environnement du développeur. |
| **Context awareness** | Indexation codebase, @mentions, docs | MnM DOIT fournir un contexte complet aux agents (fichiers obligatoires par étape, pré-prompts, résultats intermédiaires) via l'orchestration déterministique. |
| **Sandbox d'exécution** | Environnement isolé pour tests | MnM DOIT SURPASSER avec la containerisation Docker éphémère + credential proxy + mount allowlist tamper-proof (5 couches de défense). |
| **Enterprise (FedRAMP, SOC 2)** | Certifications de sécurité | MnM DOIT viser les certifications enterprise équivalentes à moyen terme. À court terme : on-premise deploy couvre les besoins de sécurité. |
| **50% Fortune 500** | Adoption massive | MnM cible un segment différent (orchestration multi-rôle, pas IDE). Mais DOIT offrir une DX excellent pour les développeurs afin qu'ils ne perçoivent pas MnM comme un downgrade par rapport à Cursor. |

**Ce que MnM fait que Cursor ne fera JAMAIS :** Multi-rôle (CEO, PM, PO, QA dans la même plateforme), workflow orchestration, visibilité managériale, coordination inter-agents, audit centralisé cross-rôles.

### 2.3 CrewAI — Framework open source d'agents role-based

| Capacité CrewAI | Détail | Requirement MnM |
|----------------|--------|-----------------|
| **Role-based agents** | Définition d'agents avec rôles, goals, backstory | MnM DOIT proposer une modélisation d'agents au moins aussi riche (11 rôles existants dans le schéma) avec en plus des permissions granulaires et un curseur d'automatisation. |
| **Task delegation** | Agents délèguent des sous-tâches entre eux | MnM DOIT supporter la communication A2A avec validation human-in-the-loop, ce que CrewAI ne fait pas. |
| **40% plus rapide que LangGraph** | Performance d'exécution | MnM DOIT optimiser la latence d'orchestration. L'overhead du déterminisme ne doit pas dégrader l'expérience. WebSocket (vs file-based IPC) donne un avantage structurel. |
| **Open source** | Code disponible, communauté active | MnM DOIT maintenir son tier open source (gratuit, auto-hébergé) pour alimenter le flywheel d'adoption. |
| **Python ecosystem** | Intégration native Python, LangChain | MnM DOIT être agnostique au framework sous-jacent. L'adapter pattern (8 types existants) permet d'orchestrer CrewAI, LangGraph, ou tout autre framework. |

**Ce que MnM fait que CrewAI ne fera JAMAIS :** UI complète, déterminisme imposé (pas suggéré), onboarding enterprise, observabilité intégrée, gestion de compaction, RBAC multi-rôle, drift detection.

### 2.4 Microsoft Agent Framework — La menace la plus sérieuse

| Capacité MS Agent | Détail | Requirement MnM |
|------------------|--------|-----------------|
| **Graph-based workflows** | Définition de workflows comme graphes dirigés | MnM DOIT proposer des workflows au moins aussi expressifs (le schéma existant avec stages et transitions le permet), PLUS le déterminisme imposé que MS ne garantit pas. |
| **A2A + MCP natif** | Protocoles standardisés de communication inter-agents | MnM DOIT supporter A2A et MCP nativement. C'est déjà dans l'architecture (connecteurs auto-générés via MCP). |
| **Azure ecosystem** | Intégration native Azure AD, Cognitive Services, etc. | MnM DOIT être cloud-agnostique (on-premise, AWS, GCP, Azure). Le lock-in Azure de MS est une faiblesse que MnM exploite. |
| **Enterprise backing** | Budget R&D Microsoft, base clients Azure | MnM DOIT compenser par l'agilité, l'open source, et le first-mover advantage sur le "produit fini" (MS est un building block). |
| **Durable execution** | State management robuste pour les workflows longs | MnM DOIT garantir la persistance d'état à chaque étape (résultats intermédiaires, état du workflow, contexte de compaction). |

**Ce que MnM fait que Microsoft ne fera PAS facilement :** UI non-technique pour CEO/PM/PO, drift detection, curseur d'automatisation, onboarding cascade, métriques agrégées (pas individuelles), indépendance cloud.

**ALERTE CONCURRENTIELLE :** Microsoft est la menace la plus sérieuse. Leur framework est en RC depuis février 2026. S'ils sortent un produit fini avec UI, MnM perd son avantage. La mitigation : agilité, open source, CBA comme design partner, et le fait que MS sera toujours Azure-first.

---

## PARTIE 3 — Regulatory Requirements

### 3.1 RGPD (Règlement Général sur la Protection des Données)

#### REG-RGPD-01 : Base légale du traitement
- **Exigence** : Tout traitement de données personnelles doit reposer sur une base légale
- **Impact architecture** : MnM doit enregistrer et tracer la base légale pour chaque type de traitement
- **Requirement** : REQ-REG-01 — Configurer et documenter la base légale de chaque traitement

#### REG-RGPD-02 : Droit à l'effacement (Article 17)
- **Exigence** : Suppression complète des données personnelles sur demande
- **Impact architecture** : Identifier TOUTES les données liées à un utilisateur (profil, sessions, audit logs, contextes d'agents, savoir tribal)
- **Requirement** : REQ-REG-02 — Mécanisme de suppression/anonymisation complète, délai 30 jours max

#### REG-RGPD-03 : Portabilité des données (Article 20)
- **Exigence** : Export dans un format structuré, lisible par machine
- **Requirement** : REQ-REG-03 — Export complet JSON/CSV, délai 30 jours max

#### REG-RGPD-04 : Consentement explicite
- **Exigence** : Consentement libre, spécifique, éclairé, avec possibilité de retrait
- **Requirement** : REQ-REG-04 — Consentement granulaire pour traitement IA, A2A, savoir tacite

#### REG-RGPD-05 : Privacy by Design (Article 25)
- **Exigence** : Protection des données dès la conception et par défaut
- **Requirement** : REQ-REG-05 — TLS, AES-256, pseudonymisation, collecte minimale

### 3.2 Audit Trail

- **REQ-AUDIT-01** : Log append-only immutable (humains + agents), rétention 3 ans minimum
- **REQ-AUDIT-02** : Non-répudiation par chaînage cryptographique (hash chain)
- **REQ-AUDIT-03** : Interface read-only de consultation avec filtres et export

### 3.3 Data Residency

- **REQ-RESID-01** : On-premise complet + choix région SaaS, aucune donnée hors région
- **REQ-RESID-02** : Support LLM EU/on-premise, choix du provider par le client

### 3.4 Spécificités Agents IA

- **REQ-IA-01** : Pas de décision exclusivement automatique, explication lisible, contestation possible
- **REQ-IA-02** : Classification agents par niveau de risque (AI Act), obligations proportionnelles

## Synthèse des Requirements Réglementaires

| ID | Catégorie | Résumé | Priorité |
|----|-----------|--------|----------|
| REQ-REG-01 | RGPD | Base légale configurable | P2 |
| REQ-REG-02 | RGPD | Droit à l'effacement complet | P1 |
| REQ-REG-03 | RGPD | Portabilité données JSON/CSV | P2 |
| REQ-REG-04 | RGPD | Consentement granulaire + retrait | P1 |
| REQ-REG-05 | RGPD | Privacy by design | P1 |
| REQ-AUDIT-01 | Audit | Log immutable append-only | P1 |
| REQ-AUDIT-02 | Audit | Non-répudiation (hash chain) | P2 |
| REQ-AUDIT-03 | Audit | Interface read-only consultation | P1 |
| REQ-RESID-01 | Data Residency | On-premise + choix région | P1 |
| REQ-RESID-02 | Data Residency | Support LLM EU | P2 |
| REQ-ACCESS-01 | Accès | Rapport transparence utilisateur | P2 |
| REQ-IA-01 | IA / RGPD Art.22 | Pas de décision exclusivement auto | P1 |
| REQ-IA-02 | AI Act | Classification agents par risque | P2 |

---

*~2800 mots — Domain analysis, competitive requirements (4 concurrents), regulatory requirements (RGPD, audit, data residency, AI Act).*

---

# PRD Section 6 — Faisabilité Technique Détaillée, Estimations & Dette Technique

*Par Amelia la Dev 💻* | Task #6 | 2026-03-13

---

## 1. Faisabilité par FR (14 blocs fonctionnels)

### FR1 — RBAC Métier (M, 3-5j)
- **Existe** : principal_permission_grants avec scope JSONB (non lu), 6 permission keys, hasPermission()
- **Trou critique** : hasPermission() (access.ts:45-66) ignore completement scope
- **À modifier** : constants.ts (+9 keys), access.ts (scope + presets), 22 fichiers routes
- **À créer** : role-presets.ts, CompanyMembers.tsx, RoleSelector.tsx, PermissionEditor.tsx

### FR2 — Scoping par Projet (M-L, 5-8j) | Dépend: FR1
- **Existe** : agents.scopedToWorkspaceId, filtrage workspace dans agents.ts
- **À créer** : table project_memberships, service, page ProjectAccess.tsx

### FR3 — Workflows Enforced (L, 8-10j) | Dépend: FR1
- **Existe** : workflow_templates, instances, stage_instances, service complet (267 lignes)
- **Manque** : State machine d'enforcement, validation transitions, fichiers obligatoires
- **À créer** : workflow-enforcer.ts, workflow-state-machine.ts

### FR4 — Drift Detection (M+L, 3j+2sem) | Dépend: FR3
- **Existe** : drift.ts (405 lignes), drift-analyzer.ts, routes + UI
- **Trou** : reportCache = new Map() — drift en mémoire uniquement, perdu au restart
- **À créer** : tables drift_reports + drift_items, drift-monitor.ts

### FR5 — Observabilité & Audit (M+M, 4j+4j)
- **Existe** : activity_log basique (46 lignes), heartbeat_run_events, cost_events
- **Manque** : queries/filtrage/export sur activity_log, résumé LLM
- **À créer** : audit-summarizer.ts, AuditLog.tsx

### FR6 — Chat Temps Réel (L, 8-10j) | Dépend: FR8
- **Existe** : live-events.ts (WebSocket unidirectionnel)
- **À créer** : agent-chat.ts, agent_chat_messages table, AgentChatPanel.tsx, useAgentChat.ts

### FR7 — Gestion Compaction (XL, 3+ sem) | Dépend: FR3, FR8
- **Rien n'existe** pour la gestion de compaction
- **À créer** : compaction-manager.ts, context-manager.ts, table compaction_snapshots

### FR8 — Containerisation (XL, 3-5 sem) | Parallélisable
- **Existe** : adapter pattern (8 types), secrets.ts (4 providers)
- **À créer** : dossier server/src/adapters/docker/ complet, credential-proxy.ts

### FR9 — SSO SAML/OIDC (S-M, 2-4j) | Dépend: FR1
### FR10 — Import Jira/Linear (L-XL, 2-3 sem) | Dépend: FR1, FR2
### FR11 — Onboarding Cascade (L, 1-2 sem) | Dépend: FR1, FR9
### FR12 — Agent-to-Agent (L, 1-2 sem) | Dépend: FR1, FR8
### FR13 — Curseur Automatisation (M, 4-5j) | Dépend: FR1, FR3
### FR14 — Dashboards par Rôle (M, 3-5j) | Dépend: FR1, FR5

## 2. Graphe de Dépendances

```
FR1 (RBAC) → FR2 → FR10
     └→ FR3 → FR4 → FR7
FR8 (Container) → FR6, FR7, FR12
```

**Piste A (Product Engineer)** : FR1 → FR2 → FR11 → FR10 → FR14
**Piste B (Ingénieur Système)** : FR8 → FR3 → FR7 → FR4

## 3. Effort Total : ~16-24 semaines (2 devs = 8-12 semaines)

## 4. Dette Technique (7 items, ~12-19j de résolution)

| # | Dette | Sévérité | Effort |
|---|-------|----------|--------|
| DT1 | hasPermission() ignore scope | **Critique** | 1-2j |
| DT2 | Drift en mémoire (Map) | Élevée | 2-3j |
| DT3 | WebSocket unidirectionnel | Moyenne | 2-3j |
| DT4 | 6 permission keys seulement | Moyenne | 0.5j |
| DT5 | Activity log sans query | Faible | 1-2j |
| DT6 | Pas de tests automatisés | Moyenne | 3-5j |
| DT7 | heartbeat.ts monolithique (2396 lignes) | Faible | 2-3j |

*~5000+ mots — Faisabilité détaillée par FR, estimations S/M/L/XL, dépendances, dette technique.*

---

# Section PRD — NFRs Testables, Quality Gates, Acceptance Criteria & Performance Benchmarks

**Auteur :** Murat, Test Architect
**Source :** Product Brief B2B v2.0, 23 REQs formels, 57 vérités fondamentales, architecture existante (38 tables, 31 services, 22 routes)
**Date :** 2026-03-13

---

## 1. Exigences Non-Fonctionnelles Testables (NFRs)

Chaque NFR ci-dessous est formulé avec un identifiant unique, un seuil mesurable quantifié, et un scénario de test automatisable au format Given/When/Then. Les seuils sont dérivés des métriques de succès du Product Brief (section 2.4) et des contraintes architecturales (section 6).

---

### 1.1 Performance

**NFR-PERF-01 — Temps de réponse API REST (P95 < 200ms)**

Les 22 routes Express identifiées dans le codebase DOIVENT répondre en moins de 200ms au 95e percentile sous charge nominale.

```gherkin
Given 100 utilisateurs concurrents authentifiés
  And chaque utilisateur envoie des requêtes GET et POST
    aux endpoints critiques (/api/issues, /api/workflows,
    /api/agents, /api/companies, /api/audit-logs)
When le test de charge s'exécute pendant 5 minutes en continu
Then 95% des réponses arrivent en moins de 200ms
  And 99% des réponses arrivent en moins de 500ms
  And aucune réponse ne dépasse 1000ms
  And le taux d'erreur 5xx est de 0%
```

- **Outil :** k6 ou Grafana k6 Cloud avec scénarios par endpoint.
- **Fréquence :** À chaque release candidate et en monitoring continu en production.

**NFR-PERF-02 — Temps de chargement UI (FCP < 2s)**

Le First Contentful Paint DOIT être inférieur à 2 secondes sur les 4 pages critiques : Dashboard, Board (Kanban), Page agents, Workflow editor.

```gherkin
Given un navigateur Chrome émulant une connexion 4G
  (RTT 150ms, débit descendant 1.6 Mbps)
  And le cache navigateur est vide (first visit)
When l'utilisateur navigue vers le dashboard principal
Then le First Contentful Paint (FCP) est inférieur à 2 secondes
  And le Largest Contentful Paint (LCP) est inférieur à 3 secondes
  And le Cumulative Layout Shift (CLS) est inférieur à 0.1
  And le Time to Interactive (TTI) est inférieur à 4 secondes
```

- **Outil :** Lighthouse CI intégré au pipeline GitHub Actions.
- **Seuil bloquant :** Performance score Lighthouse > 90.

**NFR-PERF-03 — Latence WebSocket temps réel (< 100ms P95)**

Les messages WebSocket — événements agent, heartbeat, chat humain-agent, alertes drift — DOIVENT être délivrés en moins de 100ms du serveur au client.

```gherkin
Given 50 connexions WebSocket actives sur une même instance
  And chaque connexion est authentifiée et abonnée aux événements
    de sa company
When un événement agent (heartbeat, status change, output)
  est émis côté serveur
Then 95% des clients abonnés reçoivent le message en moins de 100ms
  And 100% des clients le reçoivent en moins de 500ms
  And aucun message n'est perdu (delivery guarantee at-least-once)
```

- **Outil :** Benchmark custom avec timestamps NTP-synchronisés, métriques Prometheus histogram.

**NFR-PERF-04 — Temps de lancement container agent**

Un container Docker éphémère DOIT démarrer et être prêt à recevoir des commandes en moins de 2 secondes (warm) ou 5 secondes (cold).

```gherkin
Given une image agent Docker de ~500MB
  And l'image est pré-pullée localement (scénario warm)
When le ContainerManager crée et démarre un nouveau container
  avec les mounts, le credential proxy, et le réseau configurés
Then le container est opérationnel (healthcheck pass) en moins de 2 secondes
  And le credential proxy handshake est complété en moins de 200ms
  And la connexion WebSocket bidirectionnelle est établie en moins de 300ms

Given une image agent Docker qui n'est PAS présente localement (cold)
When le ContainerManager pull, crée et démarre le container
Then le container est opérationnel en moins de 5 secondes
```

**NFR-PERF-05 — Temps de détection de drift**

La drift detection DOIT alerter dans les délais suivants : moins de 15 minutes (cible MVP à 3 mois), moins de 2 minutes (cible enterprise à 12 mois).

```gherkin
Given un workflow déterministe "Dev Story" avec 5 étapes définies
  And un agent en cours d'exécution à l'étape 3
When l'agent exécute une action non prévue par l'étape 3
  (fichier hors allowlist, appel API non autorisé, skip d'étape)
Then une alerte drift de type WARNING est émise en moins de 15 minutes
  And l'alerte contient : agent ID, workflow ID, étape attendue,
    action déviante, timestamp, severity
  And l'événement est enregistré dans l'audit log
  And une notification WebSocket est envoyée au dashboard du CTO/Lead
```

**NFR-PERF-06 — Temps de requête audit log (< 500ms pour 1M+ entrées)**

Les requêtes d'audit log filtrées sur les 30 derniers jours DOIVENT retourner en moins de 500ms, même avec plus d'un million d'entrées en base.

```gherkin
Given une base PostgreSQL contenant 1 000 000 entrées dans audit_log
  And les entrées sont réparties sur 12 mois pour 5 companies
When un administrateur filtre par company_id + date range (30 jours)
  + event_type avec pagination (limit 50, offset 0)
Then les résultats sont retournés en moins de 500ms
  And le plan d'exécution utilise les index (vérifié par EXPLAIN ANALYZE,
    pas de sequential scan)
  And la pagination fonctionne sans dégradation jusqu'à l'offset 10000
```

**NFR-PERF-07 — Latence observabilité temps réel (< 5s cible 3 mois, < 2s cible 12 mois)**

Le résumé LLM temps réel de l'activité d'un agent (REQ-OBS-01) DOIT être généré et affiché en moins de 5 secondes après chaque action significative de l'agent.

```gherkin
Given un agent en cours d'exécution dans un container
  And le service d'observabilité est actif
When l'agent effectue une action significative (lecture fichier,
  écriture code, appel API, changement d'étape)
Then un résumé en langage naturel est généré en moins de 5 secondes
  And le résumé est poussé via WebSocket au dashboard de supervision
  And le résumé inclut : action, fichiers en contexte, étape courante,
    progression estimée
```

---

### 1.2 Sécurité

**NFR-SEC-01 — Couverture OWASP Top 10 (zéro vulnérabilité HIGH/CRITICAL)**

L'application DOIT être exempte de toute vulnérabilité HIGH ou CRITICAL selon le référentiel OWASP Top 10 2021.

```gherkin
Given l'application MnM déployée en environnement staging
  And la configuration est identique à la production
When un scan DAST complet est exécuté avec OWASP ZAP
  couvrant les 10 catégories (A01 à A10)
Then aucune alerte de niveau HIGH ou CRITICAL n'est détectée
  And les alertes MEDIUM sont documentées avec plan de remédiation
  And le rapport est archivé avec date et hash de commit
```

Catégories spécifiquement testées dans le contexte MnM :
- **A01-Broken Access Control :** RBAC, isolation multi-tenant, scoping par projet.
- **A02-Crypto Failures :** Secrets versionnés (4 providers), credential proxy.
- **A03-Injection :** Drizzle ORM (parameterized queries par design), validation input.
- **A05-Security Misconfiguration :** Headers HTTP, CORS, rate limiting.
- **A07-XSS :** React (échappement par défaut), sanitisation des inputs utilisateur.
- **A09-Logging :** Audit log ne contient JAMAIS de secrets ou données sensibles.
- **A10-SSRF :** Credential proxy comme unique point de sortie réseau des containers.

**NFR-SEC-02 — Isolation multi-tenant (zéro accès cross-company)**

Aucun utilisateur NE DOIT pouvoir accéder aux données d'une company dont il n'est pas membre. Cette exigence est absolue : zéro tolérance, zéro exception.

```gherkin
Given User-A est membre de Company-Alpha
  And User-B est membre de Company-Beta
  And les deux companies ont des issues, agents, workflows, et projets
When User-A envoie une requête GET/PUT/DELETE à chacun des 22 endpoints
  avec un resource_id appartenant à Company-Beta
Then CHAQUE réponse a le statut 403 Forbidden
  And le body ne contient AUCUNE donnée de Company-Beta
    (pas de leak via message d'erreur)
  And CHAQUE tentative est enregistrée dans l'audit log
    avec type "access_denied_cross_tenant"
  And l'inverse est aussi vrai (User-B ne peut pas accéder à Company-Alpha)
```

- **Couverture :** Matrice automatisée (22 endpoints x 2 directions x 4 rôles = 176 tests minimum).
- **Implémentation :** PostgreSQL Row-Level Security + middleware Express companyId check.

**NFR-SEC-03 — Credential Proxy et isolation des secrets**

Les agents containerisés NE DOIVENT JAMAIS avoir accès direct aux credentials. Tous les accès aux services externes passent obligatoirement par le credential proxy HTTP de MnM.

```gherkin
Given un agent lancé dans un container Docker éphémère (--rm)
  And le container est configuré avec shadow .env (/dev/null)
  And le réseau du container est restreint au credential proxy uniquement
When l'agent tente de lire les variables d'environnement
Then aucune clé API, token, ou credential n'est trouvée

When l'agent tente un accès réseau direct vers un service externe
  (GitHub API, OpenAI, base de données)
Then la connexion est refusée par les règles iptables du container

When l'agent utilise le credential proxy HTTP pour accéder à un service
Then le proxy vérifie les permissions de l'agent (allowlist par workflow)
  And le proxy injecte les credentials côté serveur (jamais exposées à l'agent)
  And l'appel est logué dans l'audit log avec : agent_id, service, endpoint, timestamp
```

**NFR-SEC-04 — Container Isolation : 5 couches de défense en profondeur**

Chaque container agent DOIT implémenter les 5 couches de sécurité validées par le pattern Nanoclaw.

```gherkin
# Couche 1 : Container éphémère
Given un agent a terminé son exécution (succès, échec, ou timeout)
When le ContainerManager nettoie le container
Then le container est détruit (--rm), aucun artefact ne persiste sur le host
  And la vérification `docker ps -a` ne montre plus le container

# Couche 2 : Mount allowlist tamper-proof
Given un workflow définit les fichiers autorisés [file1.ts, file2.ts]
When le container est créé
Then SEULS les fichiers de l'allowlist sont montés en lecture seule
  And l'allowlist est stockée en PostgreSQL (pas dans le container)
  And toute tentative d'accès hors allowlist échoue avec ENOENT

# Couche 3 : Credential proxy (voir NFR-SEC-03)

# Couche 4 : Shadow .env
Given le répertoire de travail contient un fichier .env avec des secrets
When le container est créé
Then le .env réel est remplacé par un mount vers /dev/null
  And `cat .env` dans le container retourne un fichier vide

# Couche 5 : Réseau isolé
Given un container agent en exécution
When le container tente une connexion TCP/UDP vers une IP externe
Then la connexion est refusée SAUF vers le credential proxy (localhost:PROXY_PORT)
```

**NFR-SEC-05 — Authentification, sessions et révocation**

Les sessions DOIVENT être stockées en base de données (Better Auth), avec expiration configurable et révocation immédiate.

```gherkin
Given un utilisateur authentifié avec une session valide
  And la session est stockée dans la table sessions de PostgreSQL
When un administrateur révoque cette session via l'API /api/sessions/:id/revoke
Then la session est marquée comme révoquée en base
  And la prochaine requête de l'utilisateur retourne 401 Unauthorized
  And le délai entre la révocation et le rejet effectif est inférieur à 1 seconde
  And l'événement de révocation est tracé dans l'audit log
```

**NFR-SEC-06 — SSO SAML/OIDC (Tier Enterprise)**

Le SSO DOIT supporter SAML 2.0 et OpenID Connect avec les 3 principaux Identity Providers enterprise.

```gherkin
Given une company Enterprise configurée avec SSO SAML via Azure AD
  And le mapping de rôles est défini (Azure AD groups -> MnM roles)
When un utilisateur se connecte via le flux SSO (SP-initiated)
Then l'authentification réussit en moins de 3 secondes
  And le rôle MnM est correctement assigné selon le mapping
  And la session est créée en base avec metadata SSO (IdP, assertion_id)
  And l'audit log enregistre l'événement avec type "sso_login"
  And le même flux fonctionne avec Okta et Google Workspace
```

---

### 1.3 Scalabilité

**NFR-SCALE-01 — Agents concurrents (50 -> 500)**

Le système DOIT supporter 50 containers agent concurrents (MVP 3 mois) et 500 containers concurrents (Enterprise 12 mois) sans dégradation de service.

```gherkin
Given une instance MnM avec les ressources de production (MVP: 4 vCPU, 16GB RAM)
When 50 containers agent sont lancés simultanément
  And chaque agent exécute un workflow actif avec heartbeat et WebSocket
Then tous les 50 containers fonctionnent sans erreur OOM ou timeout
  And la latence API reste conforme à NFR-PERF-01 (<200ms P95)
  And l'utilisation CPU reste sous 80%
  And l'utilisation mémoire reste sous 85%
  And les connexions PostgreSQL restent sous 80% du pool max

Given une instance MnM Enterprise (16 vCPU, 64GB RAM, PG partitionné)
When 500 containers agent sont lancés simultanément
Then les mêmes critères sont respectés
```

- **Métriques Prometheus :** `mnm_active_containers`, `mnm_container_cpu_percent`, `mnm_pg_connections_active`.

**NFR-SCALE-02 — Utilisateurs concurrents (100 -> 1000)**

```gherkin
Given un environnement de staging dimensionné comme la production
When 100 utilisateurs simulés naviguent simultanément
  avec un mix réaliste (40% dashboard, 30% board, 20% agent view, 10% admin)
  And chaque utilisateur effectue 1 action par seconde en moyenne
Then le temps de réponse API reste conforme à NFR-PERF-01
  And aucune erreur HTTP 5xx n'est observée
  And les connexions WebSocket restent stables (pas de déconnexion)
  And le même test avec 1000 utilisateurs passe sur l'infra Enterprise
```

**NFR-SCALE-03 — Volume de données (1M -> 100M lignes)**

```gherkin
Given une base PostgreSQL avec 100M lignes dans audit_log
  And 500k lignes dans issues, 10k workflows, 5k agents
  And le partitioning par date est activé sur audit_log et events
When les requêtes typiques sont exécutées
  (filtrage par company + date range + type, avec pagination)
Then les SELECT filtrés retournent en moins de 1 seconde
  And les INSERT unitaires restent sous 5ms
  And EXPLAIN ANALYZE confirme l'utilisation des index et partitions
  And aucun sequential scan n'apparaît sur les tables partitionnées
```

**NFR-SCALE-04 — Connexions WebSocket simultanées (500+)**

```gherkin
Given 500 clients WebSocket connectés et authentifiés
  And répartis sur 10 companies différentes
When un événement broadcast est émis pour une company (50 clients)
Then 95% des clients de cette company reçoivent le message en moins de 200ms
  And les clients des 9 autres companies ne reçoivent PAS le message
  And le serveur gère les 500 connexions avec moins de 500MB de mémoire
```

---

### 1.4 Disponibilité

**NFR-AVAIL-01 — Uptime SLA 99.9%**

Le Tier Enterprise SaaS DOIT garantir 99.9% d'uptime mensuel, soit moins de 43 minutes de downtime par mois.

```gherkin
Given un monitoring synthétique (Pingdom/UptimeRobot)
  vérifiant /health et /api/status toutes les 30 secondes
When le service est en production
Then le taux de disponibilité mensuel est supérieur ou égal à 99.9%
  And toute indisponibilité de plus de 60 secondes déclenche une alerte PagerDuty
  And un rapport de disponibilité mensuel est généré automatiquement
```

**NFR-AVAIL-02 — Recovery Time Objective (RTO < 1 heure)**

```gherkin
Given un incident majeur simulé (crash serveur, corruption base de données)
When la procédure de disaster recovery est déclenchée
Then le service est restauré et fonctionnel en moins de 1 heure
  And la cohérence des données est vérifiée (checksums, intégrité référentielle)
  And les containers agent en cours sont redémarrés avec reprise de contexte
  And un post-mortem est documenté dans les 24 heures
```

- **Procédure :** Documentée dans un runbook, testée trimestriellement via chaos engineering (kill random pod, corrupt WAL, network partition).

**NFR-AVAIL-03 — Data Durability 99.999%**

```gherkin
Given le backup automatique PostgreSQL est configuré
  (WAL archiving continu, snapshots journaliers)
When une restauration point-in-time (PITR) est effectuée
  à un timestamp choisi dans les 30 derniers jours
Then 100% des données jusqu'au point de recovery sont présentes
  And l'intégrité référentielle est vérifiée (foreign keys, contraintes)
  And le delta entre le point de recovery et la dernière transaction
    est inférieur à 5 minutes (RPO)
```

**NFR-AVAIL-04 — Graceful Degradation**

Si un service non-critique tombe, le coeur du système DOIT continuer de fonctionner.

```gherkin
Given le service de drift detection est arrêté (crash ou maintenance)
When un utilisateur lance un workflow normalement
Then le workflow s'exécute correctement (orchestration déterministe fonctionne)
  And le dashboard affiche un bandeau "Mode dégradé : drift detection indisponible"
  And l'audit log continue d'enregistrer les événements
  And une alerte opérationnelle est envoyée à l'équipe

# Services critiques (JAMAIS de dégradation tolérée) :
#   - API REST, Auth, RBAC, Orchestration, PostgreSQL, WebSocket
# Services non-critiques (dégradation gracieuse) :
#   - Drift detection, résumé LLM observabilité, import Jira/Linear,
#     notifications email
```

---

### 1.5 Maintenabilité

**NFR-MAINT-01 — Couverture de tests > 80%**

```gherkin
Given un développeur soumet une merge request avec du code nouveau ou modifié
When le pipeline CI calcule la couverture via Istanbul/c8
Then la couverture des fichiers AJOUTÉS est supérieure à 80%
  And la couverture des fichiers MODIFIÉS ne diminue pas par rapport à main
  And la couverture globale du projet ne descend pas sous 60%
  And si un seuil est franchi, le pipeline REFUSE le merge
```

- **Outil :** Vitest avec coverage provider c8 (backend), Vitest + React Testing Library (frontend).

**NFR-MAINT-02 — Dette technique mesurée (SonarQube "A")**

```gherkin
Given le code source est scanné par SonarQube après chaque push
When le rapport de qualité est généré
Then le Maintainability Rating est "A" (dette < 5% du temps de dev)
  And zéro code smell de niveau "Blocker" ou "Critical"
  And la duplication de code est inférieure à 3%
  And la complexité cyclomatique par fonction ne dépasse pas 15
```

**NFR-MAINT-03 — Migration de schéma automatique (Drizzle)**

```gherkin
Given une nouvelle version de MnM avec des migrations Drizzle en attente
When le serveur démarre (npm start ou container restart)
Then les migrations sont détectées et appliquées automatiquement
  And le serveur est opérationnel dans les 30 secondes qui suivent
  And en cas d'échec de migration, le serveur ne démarre PAS
    (fail-fast, pas de state corrompu)
  And un rollback est possible via la migration inverse
```

**NFR-MAINT-04 — Temps de build et déploiement**

```gherkin
Given un commit poussé sur une branche feature
When le pipeline CI/CD complet s'exécute (lint -> test -> build -> deploy staging)
Then le build complet (frontend + backend) termine en moins de 5 minutes
  And le déploiement en staging termine en moins de 10 minutes
  And le pipeline total (commit -> staging opérationnel) est sous 15 minutes
```

**NFR-MAINT-05 — Documentation API exhaustive**

```gherkin
Given les 22 routes Express existantes et tout nouveau endpoint
When un script de validation compare les routes Express à la spec OpenAPI
Then 100% des endpoints publics ont une spécification OpenAPI correspondante
  And chaque spec inclut : method, path, request schema, response schemas (200, 4xx, 5xx),
    auth requirements, permission keys requises
  And le Swagger UI est accessible en staging sur /api/docs
```

---

## 2. Quality Gates — Pipeline de Validation par Phase

Chaque merge request DOIT traverser les 7 gates dans l'ordre séquentiel. Un échec à un gate est **bloquant** : il empêche le passage aux gates suivants et le merge de la MR.

### Gate 0 : Code Quality Static (Automatique, < 2 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Lint JavaScript/TypeScript | ESLint (config projet) | Zero errors (warnings trackées) |
| Formatage | Prettier --check | Tous les fichiers conformes |
| Type checking | `tsc --noEmit` (strict mode) | Zero errors |
| Convention de commit | commitlint | Format conventionnel requis |
| Scan de secrets | gitleaks ou trufflehog | Zero secret détecté |
| Taille de bundle | bundlesize | Pas de régression > 5% |

### Gate 1 : Tests Unitaires (Automatique, < 3 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Exécution tests unitaires | Vitest | 100% des tests passent |
| Couverture fichiers ajoutés | Istanbul/c8 | > 80% |
| Couverture fichiers modifiés | Istanbul/c8 | Pas de régression |
| Isolation | -- | Zero dépendance réseau/DB (mocks uniquement) |

**Scope :** Services, helpers, validators, state machines, utils, composants React (shallow render).

### Gate 2 : Tests d'Intégration (Automatique, < 5 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Tests API endpoints | Vitest + Supertest | 100% passent |
| Tests RBAC middleware | Vitest + PostgreSQL réel | 100% passent |
| Tests WebSocket handlers | Vitest + ws mock | 100% passent |
| Tests credential proxy | Vitest + Docker testcontainer | 100% passent |
| Tests isolation multi-tenant | Matrice automatisée | 176 assertions passent |

**Infrastructure :** PostgreSQL via Docker testcontainer, transactions avec rollback après chaque test. **Pas de mock de base de données** — on teste contre une vraie instance PostgreSQL pour détecter les régressions de migration et les problèmes de RLS.

**Tests obligatoires spécifiques :**
1. **Isolation multi-tenant :** User-A (Company-Alpha) tente d'accéder aux ressources de Company-Beta sur chaque endpoint -> 403 systématique.
2. **RBAC enforcement :** Pour chaque rôle (admin, manager, contributor, viewer), vérifier que les permissions sont exactement celles définies dans les presets.
3. **Workflow enforcement :** Un agent ne peut pas sauter une étape, accéder à un fichier hors allowlist, ou continuer après un drift non résolu.
4. **Audit completeness :** Chaque mutation (create, update, delete) génère un entry dans l'audit log.

### Gate 3 : Tests E2E (Automatique, < 10 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Scénarios critiques par mode UI | Cypress | 100% des scénarios critiques passent |
| Screenshots de régression | Cypress + Percy | Zero différence non approuvée |

**Scénarios E2E obligatoires (alignés sur les 5 modes UI du Product Brief section 5.1) :**

1. **Mode ORAL — Onboarding CEO :** Connexion -> agent d'onboarding -> description entreprise -> création structure -> invitation membres -> premier dashboard visible.
2. **Mode VISUEL — Configuration CTO :** Acceptation invite -> configuration SSO (mock IdP) -> création workflow "Dev Story" (5 étapes) -> visualisation drift detection.
3. **Mode CODE — Quotidien Dev :** Check inbox -> sélection story -> lancement agent -> pilotage temps réel (chat) -> review code -> merge.
4. **Mode BOARD — Workflow PO :** Réception epic -> brainstorm avec agent -> décomposition en stories -> suivi sprint temps réel.
5. **Mode ADMIN — Gestion permissions :** Création membre -> assignation rôle -> modification scope projet -> vérification restrictions effectives -> consultation audit log.

**Environnement :** Docker Compose complet (frontend React + backend Express + PostgreSQL + Redis + mock LLM).

### Gate 4 : Security Scan (Automatique, < 3 min SAST / hebdomadaire DAST)

| Vérification | Outil | Seuil bloquant | Fréquence |
|---|---|---|---|
| SAST code source | SonarQube ou Semgrep | Zero vuln HIGH/CRITICAL | Chaque MR |
| Audit dépendances | `npm audit --production` | Zero vuln critique | Chaque MR |
| Scan images Docker | Trivy | Zero CVE critique | Chaque build image |
| DAST application | OWASP ZAP | Zero alerte HIGH | Hebdomadaire sur staging |
| Scan de secrets | gitleaks (historique complet) | Zero secret dans l'historique | Hebdomadaire |

### Gate 5 : Performance Benchmark (Avant release, < 15 min)

| Vérification | Outil | Seuil bloquant |
|---|---|---|
| Load test API | k6 | P95 < 200ms, P99 < 500ms, 0 erreur |
| Lighthouse UI | Lighthouse CI | Performance > 90, Accessibility > 90 |
| Benchmark WebSocket | Script custom | Latence P95 < 100ms |
| Requêtes DB critiques | EXPLAIN ANALYZE automatisé | Zero seq scan sur tables > 10k lignes |
| Régression performance | Comparaison N vs N-1 | Pas de dégradation > 10% sur aucun percentile |

### Gate 6 : Review Humaine (Manuelle, bloquante)

- **Code review :** Minimum 1 approbation d'un pair développeur.
- **Architecture review :** **Requis** si le changement touche : schéma DB (migration), système de permissions (RBAC/scoping), architecture de containerisation, credential proxy, ou WebSocket protocol.
- **Security review :** **Requis** si le changement touche : authentification, gestion de secrets, isolation multi-tenant, ou endpoints publics.

**Checklist de review obligatoire :**
- [ ] Pas de régression de sécurité (RBAC, isolation tenant, secrets).
- [ ] Pas de changement de schéma sans migration correspondante.
- [ ] Impact sur la performance évalué et documenté.
- [ ] Documentation API (OpenAPI) mise à jour si nouvel endpoint.
- [ ] Les NFRs pertinents sont couverts par des tests.
- [ ] L'audit log couvre les nouvelles mutations.

---

## 3. Acceptance Criteria Patterns — 5 Templates Réutilisables

### Pattern AC-UI : Feature Interface Utilisateur

```gherkin
# --- Template AC-UI ---
# Applicable à : Dashboard, Board, Page agents, Workflow editor,
#   Admin panel, Onboarding, tout composant React visible

Given l'utilisateur est authentifié avec le rôle {ROLE}
  And l'utilisateur est membre de {COMPANY}
  And l'utilisateur a accès au projet {PROJECT} (si scoping actif)
When l'utilisateur navigue vers {PAGE/COMPOSANT}
Then {ÉLÉMENT_UI} est visible et interactif
  And les données affichées sont correctes et à jour
  And le temps de chargement est < 2s (NFR-PERF-02)
  And l'interface est responsive :
    | Breakpoint | Largeur | Comportement attendu |
    | Mobile     | 375px   | Navigation collapsée, contenu empilé |
    | Tablet     | 768px   | Sidebar rétractable, grille 2 colonnes |
    | Desktop    | 1280px  | Layout complet, sidebar fixe |
  And les labels sont en français (langue par défaut)
  And les couleurs respectent le contrast ratio WCAG AA (4.5:1)

# --- Variante : Restriction par rôle ---
Given l'utilisateur est authentifié avec le rôle VIEWER
When l'utilisateur navigue vers {PAGE_AVEC_ACTIONS}
Then les données sont visibles en lecture seule
  And les boutons d'action (créer, modifier, supprimer) sont absents du DOM
  And les routes d'action directes (/create, /edit) redirigent vers 403

# --- Variante : Données agrégées management (REQ-OBS-03) ---
Given l'utilisateur a le rôle CEO ou DSI
When l'utilisateur consulte le dashboard
Then les métriques sont TOUJOURS agrégées (par équipe, par BU, par projet)
  And AUCUNE métrique individuelle par personne n'est affichée
  And le drill-down s'arrête au niveau équipe, jamais au niveau individu
```

### Pattern AC-API : Endpoint REST

```gherkin
# --- Template AC-API ---
# Applicable à : Tous les endpoints /api/* (22 routes + nouvelles)

Given l'utilisateur est authentifié avec un token de session valide
  And l'utilisateur a la permission {PERMISSION_KEY}
  And la permission est scopée à {SCOPE} (company entière ou projets spécifiques)
When une requête {METHOD} est envoyée à {ENDPOINT}
  avec le payload {REQUEST_BODY}
Then la réponse a le statut HTTP {STATUS_CODE}
  And le body correspond au schéma JSON attendu {RESPONSE_SCHEMA}
  And le temps de réponse est < 200ms (NFR-PERF-01)
  And l'action est enregistrée dans l'audit log avec :
    { user_id, company_id, action, resource_type, resource_id, timestamp, ip }
  And les headers de sécurité sont présents
    (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security)

# --- Variante : Erreur d'autorisation ---
Given l'utilisateur N'A PAS la permission {PERMISSION_KEY}
When une requête {METHOD} est envoyée à {ENDPOINT}
Then la réponse a le statut 403 Forbidden
  And le body contient :
    { "error": "Forbidden", "requiredPermission": "{PERMISSION_KEY}" }
  And AUCUNE donnée de la ressource n'est incluse dans la réponse
  And la tentative est logguée dans l'audit log avec type "access_denied"

# --- Variante : Isolation multi-tenant ---
Given l'utilisateur appartient à Company-Alpha
When une requête {METHOD} est envoyée avec un resource_id de Company-Beta
Then la réponse a le statut 403 Forbidden
  And le body ne révèle PAS si la ressource existe ou non
    (pas de différence entre 403 et 404 pour les ressources cross-tenant)
  And la tentative est logguée avec type "cross_tenant_access_denied"

# --- Variante : Validation d'entrée ---
Given un payload avec des champs invalides (type incorrect, valeur hors range,
  champ manquant, injection SQL/XSS dans un string)
When la requête est envoyée
Then la réponse a le statut 400 Bad Request
  And le body contient les erreurs de validation structurées par champ
  And aucune query SQL n'est exécutée (validation avant traitement)
```

### Pattern AC-WORKFLOW : Workflow Déterministique

```gherkin
# --- Template AC-WORKFLOW ---
# Applicable à : Tout workflow créé via l'éditeur ou importé
# Couvre : REQ-ORCH-01 à REQ-ORCH-05

Given un workflow "{WORKFLOW_NAME}" est défini avec {N} étapes :
  | Étape | Nom | Fichiers obligatoires | Prompt injecté | Validation |
  | 1     | ... | [file1, file2]        | "..."          | humaine    |
  | 2     | ... | [file3]               | "..."          | auto       |
  | ...   | ... | ...                   | ...            | ...        |
  And un agent de type {AGENT_TYPE} est assigné au workflow
When l'agent est lancé sur l'étape {N}
Then l'agent reçoit EXACTEMENT les fichiers de l'étape {N} (pas plus, pas moins)
  And le prompt de l'étape {N} est injecté dans le contexte de l'agent
  And l'agent NE PEUT PAS passer à l'étape {N+1} tant que l'étape {N}
    n'est pas validée (selon le mode : humaine ou auto)
  And chaque action de l'agent est tracée dans l'audit log (REQ-OBS-02)
  And si l'agent tente une action hors du périmètre de l'étape,
    une alerte drift est émise (REQ-ORCH-05)

# --- Variante : Gestion de compaction ---
Given un agent en cours d'exécution à l'étape {K} sur {N}
  And les résultats des étapes 1 à {K-1} sont stockés
When la fenêtre de contexte de l'agent est épuisée (compaction détectée)
Then la stratégie configurée est appliquée :
  | Stratégie | Comportement |
  | kill+relance | Container détruit, nouveau container lancé avec contexte frais |
  | réinjection  | Pré-prompts critiques réinjectés dans le contexte actuel |
  And les résultats intermédiaires des étapes 1 à {K-1} sont préservés intégralement
  And les pré-prompts critiques du workflow sont réinjectés (REQ-ORCH-02)
  And l'agent reprend à l'étape {K} (pas de régression)
  And l'événement "compaction_handled" est tracé dans l'audit log

# --- Variante : Curseur d'automatisation (mode ASSISTÉ) ---
Given le curseur d'automatisation pour cette étape est en mode ASSISTÉ
When l'agent termine la génération d'un artefact (code, document, test)
Then l'artefact est présenté à l'humain propriétaire dans l'UI
  And l'humain peut : Approuver (-> étape suivante), Rejeter (-> agent recommence),
    ou Modifier (-> agent intègre les modifications)
  And l'agent est en pause et ATTEND la décision humaine
  And le temps d'attente n'est pas limité (pas de timeout sur la validation humaine)
  And la décision humaine est tracée dans l'audit log
```

### Pattern AC-AGENT : Comportement Agent Containerisé

```gherkin
# --- Template AC-AGENT ---
# Applicable à : Tout agent des 8 types d'adapters
#   (claude_local, codex, openclaw, etc.)
# Couvre : Containerisation, credential proxy, WebSocket, heartbeat

Given un agent de type {AGENT_TYPE} est lancé dans un container Docker éphémère
  And le container respecte les 5 couches de sécurité (NFR-SEC-04)
  And l'agent est connecté au serveur MnM via WebSocket bidirectionnel
  And l'agent a accès au credential proxy HTTP pour les services externes
When l'agent exécute une action {ACTION_TYPE}
  (lecture fichier, écriture code, appel API, changement d'étape)
Then l'action est exécutée dans l'environnement isolé du container
  And le résultat est transmis via WebSocket en < 100ms (NFR-PERF-03)
  And un heartbeat est émis toutes les {HEARTBEAT_INTERVAL} secondes
    (configurable, défaut 10s)
  And l'audit log enregistre l'action avec :
    { agent_id, container_id, action_type, workflow_id, stage_id,
      files_in_context, timestamp, duration_ms }

# --- Variante : Communication inter-agents (REQ-A2A-01) ---
Given Agent-Dev (propriétaire: développeur Alice) dans Company-Alpha
  And Agent-PO (propriétaire: PO Bob) dans la même Company-Alpha
  And Agent-Dev a besoin du contexte d'une story gérée par Agent-PO
When Agent-Dev envoie une requête inter-agent :
  { "target": "agent-po-id", "query": "contexte story #42", "fields": ["description", "acceptance_criteria"] }
Then une notification de demande d'accès est envoyée à Bob (PO)
  And Bob peut : Approuver (Agent-PO retourne les données demandées),
    Approuver partiellement (certains champs seulement),
    ou Refuser (Agent-Dev reçoit un refus avec raison)
  And l'échange complet est tracé dans l'audit log
  And les données retournées respectent le scope de permissions de Bob

# --- Variante : Timeout et recovery ---
Given un agent en exécution dans un container
When l'agent ne produit aucun output pendant 30 secondes (timeout configurable)
Then le ContainerManager envoie un SIGTERM au container
  And si le container ne s'arrête pas en 3 secondes, un SIGKILL est envoyé
  And l'état "timeout" est tracé dans l'audit log
  And le workflow peut être relancé manuellement ou automatiquement
    selon la configuration
```

### Pattern AC-PERMISSION : Contrôle d'Accès RBAC + Curseur

```gherkin
# --- Template AC-PERMISSION ---
# Applicable à : Toute vérification de droit d'accès
# Couvre : REQ-ENT-01, REQ-DUAL-01, invariant "Permission Scope"

Given un utilisateur avec le rôle {ROLE} dans Company-Alpha
  | Rôle         | Permissions                                              |
  | admin        | Toutes (CRUD sur toutes les ressources + config company) |
  | manager      | CRUD issues/workflows/agents + gestion membres projet    |
  | contributor  | CRU issues/agents + exécution workflows assignés         |
  | viewer       | R uniquement sur les ressources dans son scope            |
  And le scope de l'utilisateur est limité aux projets {PROJECT_IDS}
    (ou toute la company si scope = null)
When l'utilisateur tente l'action {ACTION} sur la ressource {RESOURCE}
Then le middleware hasPermission() vérifie :
  1. L'utilisateur a la permission {PERMISSION_KEY} via son rôle
  2. La ressource est dans le scope de l'utilisateur
  3. Les deux conditions sont satisfaites -> 200 OK
  4. Si l'une échoue -> 403 Forbidden
  And le résultat (succès ou refus) est tracé dans l'audit log

# --- Variante : Hiérarchie du curseur d'automatisation ---
Given le CEO a défini un plafond company-wide :
  "Aucun merge en production sans validation humaine"
  And un manager a défini pour le projet X :
  "Tests automatiques = mode AUTO"
  And le contributeur Alice a son curseur personnel :
  "Tout en AUTOMATIQUE"
When l'agent d'Alice tente un merge automatique en production
Then le merge est BLOQUÉ par le plafond CEO (hiérarchie l'emporte)
  And une notification est envoyée à Alice :
    "Validation requise : politique entreprise (définie par CEO)"
  And Alice doit valider manuellement le merge
  And la validation est tracée dans l'audit log

When l'agent d'Alice lance des tests automatiquement
Then les tests s'exécutent en mode AUTO (autorisé par le manager)
  And aucune intervention humaine n'est requise

# --- Variante : Rôles composites (REQ-ENT-01) ---
Given un utilisateur avec un rôle composite "Lead Tech"
  = contributor + permissions additionnelles [manage_workflows, view_audit_log]
When l'utilisateur tente de créer un workflow
Then l'action est autorisée (manage_workflows inclus dans le composite)
When l'utilisateur tente de modifier les paramètres SSO de la company
Then l'action est refusée (admin_company non inclus dans le composite)
```

---

## 4. Performance Benchmarks — Cibles Quantifiées par Opération

### 4.1 Benchmarks API REST

| Opération | P50 | P95 | P99 | Max absolu | Concurrence cible |
|---|---|---|---|---|---|
| `GET /api/issues` (liste paginée, 50/page) | < 50ms | < 150ms | < 300ms | < 1s | 100 users |
| `POST /api/issues` (création) | < 100ms | < 200ms | < 400ms | < 1s | 50 users |
| `GET /api/issues/:id` (détail) | < 30ms | < 80ms | < 150ms | < 500ms | 100 users |
| `GET /api/workflows/:id` (avec stages) | < 30ms | < 100ms | < 200ms | < 500ms | 100 users |
| `POST /api/workflows/:id/run` (lancement agent) | < 200ms | < 500ms | < 1s | < 2s | 20 users |
| `GET /api/agents/:id/status` (polling rapide) | < 20ms | < 50ms | < 100ms | < 200ms | 200 users |
| `GET /api/audit-logs` (filtré 30j, paginé) | < 200ms | < 500ms | < 1s | < 2s | 20 users |
| `GET /api/dashboard` (agrégation multi-projet) | < 300ms | < 800ms | < 1.5s | < 3s | 50 users |
| `POST /api/auth/login` (authentification) | < 100ms | < 200ms | < 400ms | < 1s | 50 users |
| `POST /api/auth/sso/callback` (SSO) | < 200ms | < 500ms | < 1s | < 2s | 20 users |
| `GET /api/companies/:id/members` (liste) | < 50ms | < 100ms | < 200ms | < 500ms | 50 users |
| `PUT /api/agents/:id/automation-level` (curseur) | < 50ms | < 100ms | < 200ms | < 500ms | 50 users |

### 4.2 Benchmarks WebSocket

| Type de message | Direction | Latence P50 | Latence P95 | Débit max cible |
|---|---|---|---|---|
| Agent heartbeat | serveur -> client | < 20ms | < 50ms | 500 msg/s |
| Agent event (action, output) | serveur -> client | < 50ms | < 100ms | 200 msg/s |
| Chat humain -> agent | client -> serveur -> container | < 50ms | < 100ms | 100 msg/s |
| Chat agent -> humain | container -> serveur -> client | < 50ms | < 100ms | 100 msg/s |
| Broadcast company (status update) | serveur -> N clients | < 100ms | < 200ms | 50 msg/s |
| Drift alert | serveur -> dashboard | < 200ms | < 500ms | 10 msg/s |
| Observabilité résumé LLM | serveur -> dashboard | < 2s | < 5s | 5 msg/s |

### 4.3 Benchmarks Container Agent

| Opération | Cible | Condition | Métrique Prometheus |
|---|---|---|---|
| Cold start (pull + create + start) | < 5s | Image ~500MB, pas en cache | `mnm_container_start_duration_seconds` |
| Warm start (image locale) | < 2s | Image pré-pullée | `mnm_container_start_duration_seconds` |
| Credential proxy handshake | < 200ms | Par container | `mnm_proxy_handshake_duration_seconds` |
| WebSocket connection setup | < 300ms | Container -> serveur | `mnm_ws_connect_duration_seconds` |
| Arrêt graceful (SIGTERM) | < 3s | -- | `mnm_container_stop_duration_seconds` |
| Kill forcé (après timeout) | < 1s | Après 30s inactivité | `mnm_container_kill_duration_seconds` |
| Cleanup post-run (--rm) | < 1s | Filesystem éphémère | `mnm_container_cleanup_duration_seconds` |
| Mémoire par container | < 512MB | Agent standard | `mnm_container_memory_bytes` |
| CPU par container | < 1 vCPU | Agent standard | `mnm_container_cpu_percent` |

### 4.4 Benchmarks Base de Données PostgreSQL

| Opération | Cible | Volume de données | Index requis |
|---|---|---|---|
| INSERT audit_log (single) | < 5ms | Toute taille | -- |
| INSERT audit_log (batch 100) | < 50ms | Toute taille | -- |
| SELECT audit_log (filtré company+date+type, paginé) | < 500ms | 1M lignes | company_id + created_at + event_type |
| SELECT audit_log (même requête) | < 1s | 100M lignes | Idem + partitioning par mois |
| SELECT issues (par project, paginé 50) | < 100ms | 100k issues | project_id + status + created_at |
| SELECT agents (par company, avec status) | < 50ms | 1000 agents | company_id + status |
| SELECT workflows (par company, avec stages) | < 100ms | 500 workflows | company_id |
| SELECT dashboard aggregation (multi-project) | < 500ms | 100k issues, 500 workflows | Index composites |
| Migration schema (up, table < 1M lignes) | < 30s | -- | -- |
| Migration schema (up, table > 10M lignes) | < 5min | -- | -- |
| pg_dump (backup complet) | < 10min | < 50GB | -- |
| Point-in-time recovery (PITR) | < 30min | < 50GB | -- |
| Connection pool saturation | Never | -- | Pool max = 80% max_connections |

### 4.5 Benchmarks Onboarding & Import

| Opération | Cible | Conditions | Notes |
|---|---|---|---|
| Import Jira (100 issues + métadonnées) | < 1 min | API Jira Cloud | Mapping automatique statuts/priorités |
| Import Jira (10 000 issues) | < 10 min | Batch processing (100/batch) | Progress bar en temps réel via WebSocket |
| Import Linear (1000 issues) | < 5 min | API Linear GraphQL | Mapping labels -> tags MnM |
| Import ClickUp (1000 tasks) | < 5 min | API ClickUp | Mapping spaces -> projects |
| Onboarding company (CEO flow conversationnel) | < 30 min | Mode ORAL | Création structure + rôles + invitations |
| Onboarding CTO (configuration technique) | < 1h | Mode VISUEL | SSO + workflows + monitoring |
| Création workflow template (drag-and-drop) | < 2 min | Mode VISUEL | 5 étapes standard |
| Premier dashboard fonctionnel (post-import) | < 48h | Après import + config | Données agrégées visibles |

### 4.6 Matrice de Charge Progressive

| Phase | Timeline | Users simultanés | Agents simultanés | Volume DB | WebSocket conn. | Infrastructure |
|---|---|---|---|---|---|---|
| **MVP** | 0-3 mois | 100 | 50 | 1M rows | 200 | 1 serveur (4 vCPU, 16GB) + 1 PG |
| **Scale** | 3-6 mois | 500 | 200 | 10M rows | 500 | 2 serveurs + PG replica read |
| **Enterprise** | 6-12 mois | 1000 | 500 | 100M rows | 1000 | Cluster 4 nodes + PG partitioned + Redis |
| **Multi-tenant SaaS** | 12+ mois | 5000 | 2000 | 1B rows | 5000 | K8s auto-scale + PG Citus + Redis Cluster |

---

## 5. Stratégie de Test par Feature — Matrice de Couverture

### 5.1 Matrice Feature x Type de Test x Priorité

| Feature (REQ) | Unit | Integ | E2E | Perf | Sec | Priorité |
|---|---|---|---|---|---|---|
| REQ-ORCH-01 (Workflow enforcement déterministe) | X | X | X | | | **P0** |
| REQ-ORCH-02 (Compaction : réinjection pré-prompts) | X | X | | X | | **P0** |
| REQ-ORCH-03 (2 stratégies compaction) | X | X | | | | P1 |
| REQ-ORCH-04 (Fichiers/prompts obligatoires par étape) | X | X | X | | | **P0** |
| REQ-ORCH-05 (Drift detection) | X | X | | X | | P1 |
| REQ-OBS-01 (Résumé LLM temps réel) | X | X | X | X | | P1 |
| REQ-OBS-02 (Audit log centralisé) | X | X | X | X | X | **P0** |
| REQ-OBS-03 (Dashboards agrégés, jamais individuels) | X | | X | | | **P0** |
| REQ-OBS-04 (Traçage décisions) | X | X | | | | P1 |
| REQ-ONB-01 (Onboarding cascade hiérarchique) | X | | X | | | P1 |
| REQ-ONB-02 (Dual-mode : conversationnel + visuel) | X | | X | | | P2 |
| REQ-ONB-03 (Import Jira/Linear/ClickUp) | X | X | X | X | | P1 |
| REQ-ONB-04 (MnM = source unique post-import) | X | X | | | | P1 |
| REQ-A2A-01 (Accès inter-agents + validation humaine) | X | X | X | | X | P1 |
| REQ-A2A-02 (Connecteurs auto-générés) | X | X | | | X | P2 |
| REQ-A2A-03 (MnM modifiable par ses agents) | X | X | | | X | P2 |
| REQ-A2A-04 (Query directe contexte inter-agents) | X | X | | | | P1 |
| REQ-DUAL-01 (Curseur automatisation individuel) | X | X | X | | | P1 |
| REQ-DUAL-02 (Distinction mécanique vs jugement) | X | | | | | P2 |
| REQ-DUAL-03 (Dialogue pendant exécution) | X | X | X | X | | **P0** |
| REQ-DUAL-04 (Brainstorm -> workflow) | X | | X | | | P2 |
| REQ-ENT-01 (Rôles composites) | X | X | X | | X | **P0** |
| REQ-ENT-02 (3 niveaux workflow) | X | X | | | | P1 |
| REQ-ENT-03 (Présentation élévation) | | | X | | | P2 |
| REQ-ENT-04 (CEO query agents) | X | X | X | | | P1 |
| Isolation multi-tenant (invariant 1) | | X | X | | X | **P0** |
| Container isolation (5 couches) | X | X | | | X | **P0** |
| Credential proxy | X | X | | | X | **P0** |
| SSO SAML/OIDC | X | X | X | | X | P1 |
| WebSocket bidirectionnel | X | X | X | X | | **P0** |
| Rate limiting + throttling | X | X | | X | X | P1 |

### 5.2 Pyramide de Tests — Ratios Cibles

```
            /\
           /  \      E2E (Cypress) -- 10% des tests (~30 scénarios)
          / E2E\     5 user journeys complets par mode UI
         /------\
        /  Integ \   Tests d'intégration -- 30% des tests (~150 tests)
       / ration   \  API, RBAC matrice, DB réelle, WebSocket, Container
      /------------\
     /   Unitaire    \  Tests unitaires -- 60% des tests (~300 tests)
    / (Vitest + RTL)  \ Services, validators, state machines, composants
   /--------------------\
```

**Ratio cible :** 60% unitaires / 30% intégration / 10% E2E.
**Estimation totale :** ~480 tests au MVP, ~1200 tests à 12 mois.

---

*Ce document constitue le référentiel qualité complet pour le PRD B2B de MnM. Chaque NFR porte un identifiant unique pour la traçabilité (NFR-PERF-xx, NFR-SEC-xx, NFR-SCALE-xx, NFR-AVAIL-xx, NFR-MAINT-xx). Les quality gates définissent un pipeline de validation séquentiel et bloquant. Les 5 patterns d'acceptance criteria fournissent des templates réutilisables pour chaque FR du PRD. Les benchmarks quantifient les cibles de performance avec des percentiles précis par opération critique.*

*Tous les seuils sont alignés sur : les métriques de succès du Product Brief (section 2.4), les contraintes architecturales (section 6), la stack technique existante (React 18, Express, PostgreSQL, WebSocket, Docker, Drizzle ORM, Better Auth), et la matrice de charge progressive (MVP -> Scale -> Enterprise).*

---

# PRD Section 8 — Scénarios de Test, Edge Cases & Sécurité

*Par Quinn le QA 🧪* | Task #7 | 2026-03-13

---

## 1. Scénarios de Test par FR (35 scénarios Given/When/Then)

### FR-MU : Multi-User et Auth (5 scénarios)
- **SC-MU-01** [P0] : Invitation d'un membre (happy path)
- **SC-MU-02** [P0] : Acceptation d'invitation
- **SC-MU-03** [P1] : Invitation expirée
- **SC-MU-04** [P0] : Désactivation du signup libre
- **SC-MU-05** [P1] : Sign-out et invalidation de session

### FR-RBAC : Roles et Permissions (5 scénarios)
- **SC-RBAC-01** [P0] : Attribution de rôle par admin
- **SC-RBAC-02** [P0] : Vérification permission sur route protégée (403)
- **SC-RBAC-03** [P1] : Presets de permissions par rôle
- **SC-RBAC-04** [P1] : Masquage navigation selon permissions (absent du DOM)
- **SC-RBAC-05** [P2] : Rôle composite avec héritage

### FR-ORCH : Orchestrateur Déterministe (5 scénarios)
- **SC-ORCH-01** [P0] : Exécution step-by-step (agent ne peut pas sauter)
- **SC-ORCH-02** [P0] : Drift detection et alerte (<15min)
- **SC-ORCH-03** [P0] : Réinjection post-compaction
- **SC-ORCH-04** [P1] : Kill+relance après compaction
- **SC-ORCH-05** [P0] : Validation humaine (human-in-the-loop)

### FR-OBS : Observabilité (4 scénarios)
- **SC-OBS-01** [P1] : Résumé LLM temps réel (<5s)
- **SC-OBS-02** [P0] : Audit log complet (qui/quoi/quand/workflow/étape)
- **SC-OBS-03** [P1] : Dashboards agrégés (jamais individuels — vérité #20)
- **SC-OBS-04** [P1] : Traçabilité des décisions

### FR-ONB : Onboarding (4 scénarios)
- **SC-ONB-01** [P0] : Onboarding CEO conversationnel
- **SC-ONB-02** [P0] : Cascade hiérarchique
- **SC-ONB-03** [P1] : Import Jira intelligent
- **SC-ONB-04** [P1] : Dual-mode configuration

### FR-A2A : Agent-to-Agent (3 scénarios)
- **SC-A2A-01** [P0] : Query inter-agents avec validation humaine
- **SC-A2A-02** [P2] : Génération de connecteur
- **SC-A2A-03** [P1] : Permissions granulaires inter-agents

### FR-DUAL : Dual-Speed (4 scénarios)
- **SC-DUAL-01** [P0] : Curseur d'automatisation personnel
- **SC-DUAL-02** [P0] : Plafond hiérarchique (CEO > Dev)
- **SC-DUAL-03** [P1] : Brainstorm comme point d'entrée
- **SC-DUAL-04** [P1] : Distinction mécanique vs jugement

### FR-CHAT : Chat Temps Réel (4 scénarios)
- **SC-CHAT-01** [P0] : Dialogue pendant exécution via WebSocket
- **SC-CHAT-02** [P1] : Reconnexion WebSocket (sync messages manqués)
- **SC-CHAT-03** [P1] : Chat read-only pour viewer
- **SC-CHAT-04** [P1] : Message après fin d'exécution (rejeté)

### FR-CONT : Containerisation (4 scénarios)
- **SC-CONT-01** [P0] : Container éphémère --rm avec profil
- **SC-CONT-02** [P0] : Credential proxy (injection sans exposition)
- **SC-CONT-03** [P0] : Isolation entre containers
- **SC-CONT-04** [P1] : Timeout avec reset sur output

---

## 2. Edge Cases Critiques (28 cas)

### FR-MU (6 edge cases)
- EC-MU-01 : Invitation expirée puis renvoi
- EC-MU-02 : User déjà membre ré-invité
- EC-MU-03 : Email invalide à l'invitation
- EC-MU-04 : Invitation pendant maintenance
- EC-MU-05 : 2 admins invitent le même email (race condition)
- EC-MU-06 : Suppression compte avec agents actifs

### FR-RBAC (5 edge cases)
- EC-RBAC-01 : Changement de rôle pendant session active
- EC-RBAC-02 : Dernier admin se rétrograde (bloqué)
- EC-RBAC-03 : Permissions conflictuelles (deny > allow)
- EC-RBAC-04 : Rôle supprimé avec membres assignés
- EC-RBAC-05 : Scope JSONB malformée (validation stricte)

### FR-ORCH (5 edge cases)
- EC-ORCH-01 : Compaction pendant étape critique (sauvegarde atomique)
- EC-ORCH-02 : Agent crash mid-workflow (heartbeat <30s)
- EC-ORCH-03 : Workflow modifié pendant exécution (version isolée)
- EC-ORCH-04 : Étape sans fichiers obligatoires (refus)
- EC-ORCH-05 : Boucle infinie dans workflow (détection cycle + watchdog)

### FR-CHAT (5 edge cases)
- EC-CHAT-01 : Message après fin d'exécution (rejeté avec code erreur)
- EC-CHAT-02 : Reconnexion avec messages en vol (buffer 30s)
- EC-CHAT-03 : Flood de messages (rate limit 10/min)
- EC-CHAT-04 : Message >100KB (troncature)
- EC-CHAT-05 : Caractères spéciaux/XSS (UTF-8 strict, sanitization)

### FR-CONT (6 edge cases)
- EC-CONT-01 : Container timeout (SIGTERM puis SIGKILL 10s)
- EC-CONT-02 : OOM kill (code 137, reprofile)
- EC-CONT-03 : Path traversal via mount allowlist (realpath + symlinks interdits)
- EC-CONT-04 : Credential proxy down (503, retry, suspend après 3 échecs)
- EC-CONT-05 : Docker daemon indisponible (mode dégradé)
- EC-CONT-06 : Épuisement ressources Docker (limite par company, file d'attente)

---

## 3. Security Testing Requirements (12 catégories)

### RBAC Bypass
- **ST-SEC-01** [P0] : Escalade horizontale (manipulation X-Company-Id, IDs URLs)
- **ST-SEC-02** [P0] : Escalade verticale (endpoints admin avec token viewer)
- **ST-SEC-03** [P0] : Contournement scope (injection SQL via JSONB)

### Container Security
- **ST-SEC-04** [P0] : Container escape (mount /etc/shadow, capabilities, --read-only)
- **ST-SEC-05** [P0] : Credential proxy tampering (accès externe, replay, headers)
- **ST-SEC-06** [P0] : Path traversal (paths relatifs, symlinks, encodage URL, null bytes)

### Input Validation
- **ST-SEC-07** [P1] : XSS via chat (script, SVG, event handlers, markdown)
- **ST-SEC-08** [P1] : CSRF (tokens, Origin/Referer, SameSite=Strict)
- **ST-SEC-09** [P0] : SQL injection via scope JSONB

### Auth & Session
- **ST-SEC-10** [P1] : Session hijacking (expiration, fixation, invalidation)
- **ST-SEC-11** [P1] : Brute force (rate limit login 5/min, invitations 20/h)

### Multi-Tenant
- **ST-SEC-12** [P0] : Isolation inter-company (RLS, API, containers, cache)

---

## 4. Stratégie de Régression (4 suites + 7 smoke tests)

### Suites par Phase
- **Phase 1 (Multi-User)** : Workflows mono-user, agents, WebSocket, secrets
- **Phase 2 (RBAC)** : Admin a toutes les permissions, routes fonctionnent, frontend
- **Phase 3 (Scoping)** : Sans scope = tout visible, agents non orphelins
- **Phase 4 (Enterprise)** : SSO + email+password, audit performance, rate limit

### Métriques de Couverture
| Couche | Objectif |
|--------|----------|
| RBAC (hasPermission, canUser) | >95% |
| ContainerManager | >90% |
| Credential proxy | >95% |
| Routes API (auth checks) | 100% |

### Smoke Tests Pré-Deploy (7 tests obligatoires)
1. Login/signup/sign-out
2. Création agent + lancement workflow
3. Chat WebSocket connecte/envoie/reçoit
4. RBAC : viewer ne peut PAS créer agent
5. Container : lancement/exécution/arrêt
6. Credential proxy : valide passe / invalide échoue
7. Aucune donnée cross-company visible

---

*35 scénarios, 28 edge cases, 12 catégories sécurité, 4 suites régression, 7 smoke tests.*

---

# PRD Section 9 — Traçabilité FR→Epics, Out-of-Scope, Assumptions & DoD

*Par Bob le Scrum Master 🏃* | Task #8 | 2026-03-13

---

## 1. Traçabilité FR → Epics Futures

### Epic "Multi-User MVP" (Phase 1 — ~1 semaine)
- REQ-ONB-01 → S1-S4 (inviter, membres, email, disable signup)
- REQ-ENT-01 partiel → S5-S6 (profil, sign-out)
- Prérequis infra → S7 (migration PostgreSQL externe)

### Epic "RBAC Métier" (Phase 2 — ~2 semaines)
- REQ-ENT-01 → S1-S3 (4 rôles métier, presets, UI)
- REQ-A2A-01 partiel → S4-S5 (9 nouvelles permission keys, brancher canUser())
- REQ-ONB-01 suite → S6-S7 (page admin, masquer navigation)
- REQ-OBS-03 partiel → S8 (filtrage vues par rôle)

### Epic "Scoping par Projet" (Phase 3 — ~2-3 semaines)
- REQ-ENT-02 → S1-S3 (project_memberships, hasPermission() scope, filtrer routes)
- REQ-A2A-01 → S4-S5 (scoping agents et workflows)
- REQ-OBS-02 partiel → S6 (audit changements scope)
- REQ-ONB-01 niveau projet → S7-S8 (page Accès, filtrage sidebar)

### Epic "Orchestrateur Déterministe" (Transverse — ~3-5 semaines)
- REQ-ORCH-01 → S1-S3 (state machine, enforcement, fichiers/prompts)
- REQ-ORCH-02/03 → S4-S7 (compaction : détection, kill+relance, réinjection, config)
- REQ-ORCH-04 → S8-S9 (UI config stages, validation fichiers)
- REQ-ORCH-05 → S10-S12 (drift détection, alertes, dashboard)

### Epic "Observabilité & Audit" (Transverse — ~2-3 semaines)
- REQ-OBS-01 → S1-S2 (résumé LLM, affichage temps réel)
- REQ-OBS-02 → S3-S4 (enrichir activity log, traçabilité)
- REQ-OBS-03 → S5-S6 (dashboards agrégés, jamais individuels)
- REQ-OBS-04 → S7-S8 (capture décisions, historique replayable)

### Epic "Enterprise-Grade" (Phase 4 — ~3-4 semaines)
- SSO, audit complet + export, dashboards par rôle, multi-tenant SaaS, rate limiting

### Epic "Onboarding & Import" (Post-MVP — ~2-3 semaines)
- Mode conversationnel + visuel, connecteurs Jira/Linear/ClickUp, synchronisation

### Epic "Dual-Speed & Chat" (Post-MVP — ~3-4 semaines)
- Curseur 3 positions, classification tâches, chat temps réel, mode brainstorm

### Epic "Containerisation & Sécurité Agent" (Prérequis B2B — ~3-5 semaines)
- ContainerManager, credential proxy, mount allowlist, shadow .env, sandbox auto-modification

---

## 2. Out-of-Scope Boundary

### Features Reportées (Post-MVP)
- SSO SAML/OIDC, Import Jira/Linear, Multi-tenant SaaS complet, Email transactionnel
- Dashboards avancés, Connecteurs auto-générés, Curseur complet, Mode ORAL, Mode TEST

### Features Exclues du Périmètre MnM
- MnM comme data lake, Remplacement complet Jira, IDE intégré, Training modèles IA
- Marketplace plugins, Application mobile, Billing intégré, Analytics BI avancée
- Gestion RH / évaluation performance (invariant éthique — vérité #20), i18n

### Frontière MVP vs Post-MVP
```
MVP (8-10 sem)                     POST-MVP
├ Multi-user (invitations)         ├ SSO SAML/OIDC
├ RBAC 4 rôles                     ├ Import Jira/Linear
├ Scoping par projet               ├ Multi-tenant SaaS
├ PostgreSQL externe               ├ Curseur complet
├ Orchestrateur v1                 ├ Chat temps réel
├ Drift detection basique          ├ Containerisation
├ Compaction kill+relance          ├ Connecteurs auto
├ Activity log enrichi             ├ Mode ORAL
├ Permissions par route            ├ Dashboards avancés
├ UI admin basique                 ├ Email transactionnel
= VENDABLE à CBA                  = SCALABLE en SaaS
```

---

## 3. Assumptions & Constraints

### Techniques (7 hypothèses)
- HT-01 : PostgreSQL suffisant pour multi-tenant (confiance élevée)
- HT-02 : Better Auth extensible pour SSO (confiance moyenne)
- HT-03 : Docker disponible et performant (confiance élevée)
- HT-04 : Compaction gérable au niveau plateforme (confiance moyenne — R1)
- HT-05 : Schema DB existant suffisamment complet (confiance élevée)
- HT-06 : WebSocket extensible en bidirectionnel (confiance élevée)
- HT-07 : Adapters supportent pattern containerisé (confiance élevée)

### Business (5 hypothèses)
- HB-01 : CBA premier client viable (confiance élevée)
- HB-02 : Cofondateur technique recruté bientôt (confiance moyenne)
- HB-03 : Pricing ~50€/user/mois acceptable (confiance moyenne)
- HB-04 : Open source flywheel viable (confiance moyenne)
- HB-05 : Marché orchestration agents existe et croît (confiance élevée — $47.1B 2030)

### Utilisateurs (5 hypothèses)
- HU-01 : Adoption progressive via curseur (confiance moyenne — R2)
- HU-02 : Rôles non-dev adopteront MnM (confiance faible — risque le plus élevé)
- HU-03 : Résistance au changement Jira gérable (confiance moyenne)
- HU-04 : CEO acceptera outil supervision IA (confiance moyenne)
- HU-05 : Agents IA suffisamment fiables en 2026 (confiance élevée)

### Timeline (5 hypothèses)
- Phase 1 : ~1 semaine (confiance élevée)
- Phase 2 : ~2 semaines (confiance moyenne — branching routes laborieux)
- Phase 3 : ~2-3 semaines (confiance moyenne)
- MVP total : 8-10 semaines (confiance moyenne — optimiste si 1 dev)

---

## 4. Definitions of Done

### DoD Feature
- Fonctionnel : ACs implémentés, cas d'erreur gérés, permissions respectées
- Qualité : Tests ≥80% nouveau code, intégration pour flux critiques, pas de régression
- Sécurité : Pas de secrets en dur, input sanitisé, canUser() branché, isolation tenant
- Technique : Mergé, migrations réversibles, TypeScript strict
- Documentation : Commentaires logique non-évidente, API documentée si nouvelle

### DoD Sprint
- Toutes stories committed Done ou raison documentée
- Incrément déployable et démontrable
- Tests verts, pas de bug P0/P1 ouvert
- Review + rétro effectuées, vélocité mesurée

### DoD Release
- E2E Cypress passants, perf API <500ms P95, charge N users
- Sécurité : OWASP vérifié, isolation multi-tenant, RBAC exhaustif
- Opérationnel : doc déploiement, runbook, monitoring, backup testé, rollback plan

### DoD PRD
- 5 noyaux définis, 9 personas, 23 requirements formels
- Modèle domaine (12 entités, 5 invariants), scope MVP découpé
- Risques réels vs imaginés identifiés, business model 4 tiers
- Traçabilité complète requirement → feature → epic

---

*~2800 mots — Traçabilité complète, out-of-scope, assumptions, DoD 4 niveaux.*
