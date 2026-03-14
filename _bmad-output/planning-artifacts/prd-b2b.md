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

### B. Sections Détaillées

Les sections individuelles des contributeurs sont disponibles dans :
- `sections/prd-section-1-executive-john.md` — Executive Summary, Classification, Success Criteria, Scoping
- `sections/prd-section-2-domain-model-winston.md` — Domain Model, Faisabilité technique, NFRs
- `sections/prd-section-3-domain-mary.md` — Domain Analysis, Competitive Requirements, Regulatory
- `ux-journeys-requirements.md` — User Journeys complets avec wireframes textuels (Sally)
- `sections/prd-section-6-effort-amelia.md` — Faisabilité technique détaillée, estimations, dette
- `sections/prd-section-7-nfrs-murat.md` — NFRs testables, Quality Gates, AC Patterns
- `sections/prd-section-8-qa-quinn.md` — Scénarios de test, edge cases, sécurité
- `sections/prd-section-9-tracabilite-bob.md` — Traçabilité, out-of-scope, assumptions, DoD

---

*PRD B2B MnM v1.0 — ~7500 mots — 8 contributeurs — Synthèse complète de la transformation B2B enterprise.*
*Prochaine étape : UX Design B2B (Étape 3 du plan d'orchestration)*
