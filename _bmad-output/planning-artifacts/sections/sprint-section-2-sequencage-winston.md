# Sprint Section 2 — Sequencage Technique & Dependances

> **Auteur** : Winston (Lead Architecte) | **Date** : 2026-03-14 | **Statut** : Final
> **Sources** : Architecture B2B v1.0, PRD B2B v1.0, ADR-001 a ADR-008

---

## Table des Matieres

1. [Graphe de Dependances Techniques](#1-graphe-de-dependances-techniques)
2. [Critical Path](#2-critical-path)
3. [Mapping FR vers Stories](#3-mapping-fr-vers-stories)
4. [Stories a Risque Technique](#4-stories-a-risque-technique)
5. [Infrastructure Stories Obligatoires](#5-infrastructure-stories-obligatoires)
6. [Points de Parallelisation](#6-points-de-parallelisation)
7. [ADR Mapping par Epic](#7-adr-mapping-par-epic)

---

## 1. Graphe de Dependances Techniques

### 1.1 Vue d'Ensemble des Couches de Dependances

L'analyse du PRD et de l'architecture revele une structure de dependances en 5 niveaux. Chaque niveau DOIT etre complete avant que le niveau suivant puisse demarrer de maniere fiable. Le non-respect de cet ordre entrainerait des refactorisations couteuses et des regressions en cascade.

```
NIVEAU 0 — INFRASTRUCTURE FONDATION (Semaine 0-1)
├── INFRA-01: PostgreSQL externe (migration SQLite → PostgreSQL)
├── INFRA-02: Docker Compose dev environment
├── INFRA-03: Redis setup (sessions, cache, pub/sub)
├── INFRA-04: CI/CD pipeline GitHub Actions (QG-0: lint+TS)
└── INFRA-05: Monorepo tooling (pnpm workspaces verification)

NIVEAU 1 — FONDATIONS MULTI-TENANT & AUTH (Semaine 1-3)
├── FOUND-01: Schema DB — nouvelles tables (10 tables)
├── FOUND-02: Schema DB — modifications tables existantes (5 tables)
├── FOUND-03: RLS PostgreSQL (14 tables)        ← depend INFRA-01
├── FOUND-04: Fix hasPermission() + scope JSONB  ← depend FOUND-01, FOUND-02
├── FOUND-05: 9 nouvelles permission keys        ← depend FOUND-04
├── FOUND-06: 4 roles metier (presets)           ← depend FOUND-05
├── FOUND-07: Middleware requirePermission()      ← depend FOUND-04
└── FOUND-08: Audit des 22 routes existantes     ← depend FOUND-07

NIVEAU 2 — CAPACITES CORE (Semaine 3-6)
├── CORE-01: Multi-User UI (invitations, membres) ← depend FOUND-06
├── CORE-02: RBAC UI (matrice permissions)         ← depend FOUND-06, FOUND-08
├── CORE-03: WorkflowEnforcer (state machine)      ← depend FOUND-04
├── CORE-04: ContainerManager + Docker             ← depend INFRA-02, FOUND-03
├── CORE-05: Credential Proxy HTTP                 ← depend CORE-04
├── CORE-06: Audit events table + triggers         ← depend FOUND-03
├── CORE-07: WebSocket bidirectionnel              ← depend INFRA-03
└── CORE-08: Project memberships + scoping         ← depend FOUND-06

NIVEAU 3 — FONCTIONNALITES AVANCEES (Semaine 6-9)
├── ADV-01: Drift Detection                       ← depend CORE-03
├── ADV-02: Compaction Manager (kill+relance)      ← depend CORE-03, CORE-04
├── ADV-03: Chat temps reel (channels + messages)  ← depend CORE-07, CORE-04
├── ADV-04: A2A Bus (agent-to-agent)               ← depend CORE-04, CORE-05
├── ADV-05: Audit Summarizer (resume LLM)          ← depend CORE-06
├── ADV-06: Dashboards agreges                     ← depend CORE-06, CORE-02
└── ADV-07: Curseur d'automatisation               ← depend FOUND-06, CORE-08

NIVEAU 4 — ENTERPRISE & POLISH (Semaine 9-12)
├── ENT-01: SSO SAML/OIDC                         ← depend FOUND-06
├── ENT-02: Import Jira/Linear/ClickUp            ← depend CORE-08
├── ENT-03: Onboarding conversationnel             ← depend CORE-01, CORE-02
├── ENT-04: CompactionWatcher (reinject)           ← depend ADV-02
├── ENT-05: Export audit (CSV/JSON)                ← depend ADV-05
└── ENT-06: Smoke tests complets (7)              ← depend TOUT
```

### 1.2 Dependances Critiques Inter-Stories

Le graphe ci-dessous montre les dependances les plus critiques, celles ou un retard propage un blocage en cascade :

```
hasPermission() fix ──→ permission keys ──→ role presets ──→ RBAC UI
       │                                         │
       │                                         └──→ Multi-User UI
       │                                         └──→ Project scoping
       │
       └──→ requirePermission() middleware ──→ audit 22 routes
       └──→ WorkflowEnforcer ──→ Drift Detection
                │                      │
                └──→ Compaction Manager ──→ CompactionWatcher
                              │
Docker Compose ──→ ContainerManager ──→ Credential Proxy
       │                  │                    │
       └──→ RLS setup     └──→ Chat temps reel │
                           └──→ A2A Bus ←──────┘

Redis ──→ WebSocket bidirectionnel ──→ Chat temps reel
                                   ──→ Dashboards live

PostgreSQL externe ──→ Schema migrations ──→ RLS ──→ TOUT le multi-tenant
```

### 1.3 Dependances Implicites (Non Evidentes)

Plusieurs dependances ne sont pas evidentes a premiere vue mais sont cruciales :

1. **RLS depend de PostgreSQL externe** : RLS ne fonctionne pas avec SQLite (REQ-MU-07 est un prerequis bloquant pour toute la strategie multi-tenant).

2. **ContainerManager depend de RLS** : Sans isolation RLS, les containers pourraient etre lances avec des credentials d'une autre company. L'isolation doit etre active AVANT la containerisation.

3. **Chat depend du ContainerManager** : Le chat bidirectionnel pipe vers `stdin` de l'agent. Si l'agent est dans un container, le pipe passe par Docker exec. Sans ContainerManager, le chat ne peut pas atteindre les agents containerises.

4. **Drift Detection depend du WorkflowEnforcer** : La drift se mesure par rapport a l'etat attendu du workflow. Sans state machine, il n'y a pas de reference pour mesurer la deviation.

5. **Audit Summarizer depend de la table audit_events** : Le resume LLM lit les evenements d'audit. La table avec ses triggers MUST exister avant le service de resume.

6. **Curseur d'automatisation depend du RBAC + scoping** : Le plafond hierarchique (CEO > CTO > Manager > Contributeur) repose sur les roles metier. Le scoping par projet determine les limites du curseur.

---

## 2. Critical Path

### 2.1 Identification du Critical Path

Le critical path est la chaine la plus longue de taches dependantes qui determine la duree minimale du projet. Toute tache sur ce chemin qui prend du retard retarde l'ensemble.

```
CRITICAL PATH (10 semaines) :
PostgreSQL externe (1s) → Schema migrations (1s) → RLS (1s) → hasPermission fix (0.5s)
→ Permission keys (0.5s) → Role presets (0.5s) → WorkflowEnforcer (2s)
→ Compaction Manager (1.5s) → CompactionWatcher (1s) → Smoke tests (1s)
                                                        ───────────
                                                        TOTAL: ~10 semaines
```

### 2.2 Analyse du Critical Path

Le critical path traverse deux axes principaux :

**Axe A — Multi-tenant + RBAC (4 semaines)** :
- PostgreSQL externe → Schema → RLS → hasPermission → permissions → roles
- Ce chemin bloque TOUT le reste. C'est la fondation sur laquelle tout repose.
- Risque : La migration PostgreSQL externe et l'activation RLS sont des operations a haut risque.

**Axe B — Orchestration deterministe (6 semaines)** :
- WorkflowEnforcer → Drift → Compaction → CompactionWatcher → Smoke tests
- Ce chemin est le coeur de la valeur produit (Noyau A).
- Risque : La compaction est identifiee comme R1 (risque le plus critique) dans l'architecture.

### 2.3 Opportunites de Raccourcissement

1. **Paralleliser Schema + RLS** : Les migrations de schema et les politiques RLS peuvent etre ecrites en parallele si on definit le schema d'abord sur papier (1 jour de conception collaborative).

2. **hasPermission fix en avance** : Ce fix est autonome (1 fichier, `access.ts:45-66`). Il peut etre fait des le premier jour en parallele avec l'infrastructure, a condition de ne pas merger avant que le schema soit pret.

3. **Spike compaction (1 semaine)** : L'hypothese H-T1 recommande un spike technique d'une semaine pour valider la faisabilite de la gestion de compaction AVANT de commencer le WorkflowEnforcer. Cela pourrait eliminer le risque R1 tot.

### 2.4 Chemin Secondaire (Near-Critical)

```
NEAR-CRITICAL PATH (9 semaines) :
Docker Compose (0.5s) → ContainerManager (2s) → Credential Proxy (1.5s)
→ A2A Bus (2s) → Integration testing (1s) → Smoke tests (1s)
                                               ─────────
                                               TOTAL: ~8 semaines
```

Ce chemin est presque aussi long que le critical path. Si le ContainerManager prend du retard, il devient le nouveau critical path.

---

## 3. Mapping FR vers Stories

### 3.1 Matrice de Couverture Complete

Cette matrice verifie que chaque Functional Requirement du PRD est couvert par au moins une story. Les identifiants sont ceux du PRD section 6.

| REQ ID | Description | Epic | Story Proposee | Couvert |
|--------|-------------|------|----------------|---------|
| **FR-MU** | | | | |
| REQ-MU-01 | Invitation par email avec lien signe | Multi-User | MU-S01: API invitations + UI | OUI |
| REQ-MU-02 | Page Membres avec tableau et filtres | Multi-User | MU-S02: Page Membres | OUI |
| REQ-MU-03 | Invitation en bulk (CSV ou liste) | Multi-User | MU-S03: Bulk invite | OUI |
| REQ-MU-04 | Selecteur de Company | Multi-User | MU-S04: Company switcher | OUI |
| REQ-MU-05 | Desactivation signup libre | Multi-User | MU-S05: Invitation-only mode | OUI |
| REQ-MU-06 | Sign-out avec invalidation session | Multi-User | MU-S06: Sign-out | OUI |
| REQ-MU-07 | Migration PostgreSQL externe | Infrastructure | INFRA-S01: PostgreSQL migration | OUI |
| **FR-RBAC** | | | | |
| REQ-RBAC-01 | 4 roles metier | RBAC | RBAC-S01: Role definitions | OUI |
| REQ-RBAC-02 | Presets permissions par role | RBAC | RBAC-S02: Role presets | OUI |
| REQ-RBAC-03 | hasPermission() lit scope JSONB | RBAC | RBAC-S03: Fix hasPermission | OUI |
| REQ-RBAC-04 | 9 nouvelles permission keys | RBAC | RBAC-S04: Permission keys | OUI |
| REQ-RBAC-05 | Enforcement dans chaque route API | RBAC | RBAC-S05: Route audit | OUI |
| REQ-RBAC-06 | Masquage navigation selon permissions | RBAC | RBAC-S06: UI permissions | OUI |
| REQ-RBAC-07 | UI admin matrice permissions | RBAC | RBAC-S07: Admin UI | OUI |
| REQ-RBAC-08 | Badges couleur par role | RBAC | RBAC-S08: Role badges | OUI |
| **FR-ORCH** | | | | |
| REQ-ORCH-01 | Execution step-by-step imposee | Orchestrateur | ORCH-S01: State machine | OUI |
| REQ-ORCH-02 | Fichiers obligatoires par etape | Orchestrateur | ORCH-S02: File validation | OUI |
| REQ-ORCH-03 | Pre-prompts injectes par etape | Orchestrateur | ORCH-S03: Pre-prompts | OUI |
| REQ-ORCH-04 | Validation transitions entre etapes | Orchestrateur | ORCH-S04: Transitions | OUI |
| REQ-ORCH-05 | Drift detection basique (<15 min) | Orchestrateur | ORCH-S05: Drift detection | OUI |
| REQ-ORCH-06 | Compaction kill+relance | Orchestrateur | ORCH-S06: Kill+relance | OUI |
| REQ-ORCH-07 | Compaction reinjection | Orchestrateur | ORCH-S07: Reinjection | OUI |
| REQ-ORCH-08 | UI editeur de workflow | Orchestrateur | ORCH-S08: Workflow editor | OUI |
| REQ-ORCH-09 | Validation humaine configurable | Orchestrateur | ORCH-S09: HITL validation | OUI |
| REQ-ORCH-10 | Persistance resultats intermediaires | Orchestrateur | ORCH-S10: Checkpoints | OUI |
| **FR-OBS** | | | | |
| REQ-OBS-01 | Resume LLM temps reel (<5s) | Observabilite | OBS-S01: Audit summarizer | OUI |
| REQ-OBS-02 | Audit log complet | Observabilite | OBS-S02: Audit events | OUI |
| REQ-OBS-03 | Dashboards agreges (jamais individuels) | Observabilite | OBS-S03: Dashboards | OUI |
| REQ-OBS-04 | Tracabilite decisionnelle | Observabilite | OBS-S04: Decision trace | OUI |
| REQ-OBS-05 | Export audit log | Observabilite | OBS-S05: Export | OUI |
| REQ-OBS-06 | Retention audit >= 3 ans, immutable | Observabilite | OBS-S06: Retention + triggers | OUI |
| **FR-ONB** | | | | |
| REQ-ONB-01 | Onboarding CEO conversationnel | Onboarding | ONB-S01: Chat onboarding | OUI |
| REQ-ONB-02 | Cascade hierarchique | Onboarding | ONB-S02: Cascade | OUI |
| REQ-ONB-03 | Import Jira | Onboarding | ONB-S03: Import Jira | OUI |
| REQ-ONB-04 | Dual-mode configuration | Onboarding | ONB-S04: Dual-mode | OUI |
| **FR-A2A** | | | | |
| REQ-A2A-01 | Query inter-agents avec validation humaine | A2A | A2A-S01: A2A Bus | OUI |
| REQ-A2A-02 | Permissions granulaires inter-agents | A2A | A2A-S02: A2A permissions | OUI |
| REQ-A2A-03 | Audit chaque transaction A2A | A2A | A2A-S03: A2A audit | OUI |
| REQ-A2A-04 | Connecteurs auto-generes MCP | A2A | A2A-S04: Connecteurs | OUI |
| **FR-DUAL** | | | | |
| REQ-DUAL-01 | Curseur 3 positions | Dual-Speed | DUAL-S01: Curseur | OUI |
| REQ-DUAL-02 | Granularite 4 niveaux | Dual-Speed | DUAL-S02: Granularite | OUI |
| REQ-DUAL-03 | Plafond hierarchique | Dual-Speed | DUAL-S03: Plafond | OUI |
| REQ-DUAL-04 | Distinction mecanique vs jugement | Dual-Speed | DUAL-S04: Classification | OUI |
| **FR-CHAT** | | | | |
| REQ-CHAT-01 | WebSocket bidirectionnel | Chat | CHAT-S01: WebSocket bidir | OUI |
| REQ-CHAT-02 | Dialogue pendant execution | Chat | CHAT-S02: Chat in-workflow | OUI |
| REQ-CHAT-03 | Reconnexion + sync | Chat | CHAT-S03: Reconnexion | OUI |
| REQ-CHAT-04 | Chat read-only viewer | Chat | CHAT-S04: Read-only | OUI |
| REQ-CHAT-05 | Rate limit 10/min | Chat | CHAT-S05: Rate limiting | OUI |
| **FR-CONT** | | | | |
| REQ-CONT-01 | Container Docker ephemere | Containerisation | CONT-S01: ContainerManager | OUI |
| REQ-CONT-02 | Credential proxy HTTP | Containerisation | CONT-S02: Credential proxy | OUI |
| REQ-CONT-03 | Mount allowlist tamper-proof | Containerisation | CONT-S03: Mount security | OUI |
| REQ-CONT-04 | Shadow .env | Containerisation | CONT-S04: Shadow env | OUI |
| REQ-CONT-05 | Isolation reseau | Containerisation | CONT-S05: Network isolation | OUI |
| REQ-CONT-06 | Resource limits par profil | Containerisation | CONT-S06: Profils | OUI |
| REQ-CONT-07 | Timeout avec reset | Containerisation | CONT-S07: Timeout | OUI |

### 3.2 Verification de Couverture

**Resultat : 100% des FRs sont couverts.** 52 REQs identifies dans le PRD, 52 stories proposees. Aucun FR orphelin.

### 3.3 FRs a Risque de Sur-Specification

Certains FRs combinent plusieurs preoccupations et devront etre decomposes en stories plus fines lors du sprint planning detaille :

- **REQ-ORCH-06/07** : La compaction combine detection (CompactionWatcher), strategie (kill+relance vs reinjection), et recovery (checkpoint restore). Minimum 3 stories.
- **REQ-CONT-01** : Le ContainerManager est un systeme complexe avec lifecycle management, health checks, cleanup. Minimum 4 stories.
- **REQ-A2A-01** : Le bus A2A combine routing, permissions, human validation, et anti-boucle. Minimum 3 stories.

---

## 4. Stories a Risque Technique

### 4.1 Risque CRITIQUE (R1) — Gestion de Compaction

**Stories concernees** : ORCH-S06, ORCH-S07, ADV-02, ENT-04

**Nature du risque** : C'est le risque numero 1 identifie dans l'architecture (ADR-008). La compaction est un comportement emergent des LLMs, pas un evenement previsible. Detecter le moment exact ou un agent a compacte son contexte, puis decider de la strategie (kill+relance vs reinjection), puis restaurer l'etat de maniere fiable — tout cela est techniquement non prouve a cette echelle.

**Mitigation** :
- Spike technique d'une semaine AVANT le debut de l'epic Orchestrateur
- Prototype minimal : lancer un agent, forcer la compaction, observer les heartbeats
- Definir les metriques de detection (reduction soudaine de contexte via les heartbeats)
- Circuit breaker des le jour 1 (max 3 relances par session)

**Impact si echec** : La valeur fondamentale de MnM (agents deterministes) est compromisee. Un agent qui perd son contexte sans recovery fiable est inutile.

### 4.2 Risque ELEVE — ContainerManager Docker

**Stories concernees** : CONT-S01 a CONT-S07, CORE-04, CORE-05

**Nature du risque** : L'integration `dockerode` avec mount allowlist tamper-proof, credential proxy HTTP, et isolation reseau est un pattern complexe (5 couches de securite Nanoclaw). Chaque couche interagit avec les autres. Un defaut dans le mount allowlist (ex: symlink escape) compromet TOUTE l'isolation.

**Mitigation** :
- Commencer par un ContainerManager minimal (lancer/arreter) avant d'ajouter les couches de securite
- Tests de penetration dedies pour chaque couche (path traversal, credential leaks, container escape)
- Code review securite obligatoire par un second developpeur

**Impact si echec** : Pas de multi-tenant securise, pas de containerisation enterprise. Le produit reste mono-utilisateur.

### 4.3 Risque ELEVE — RLS PostgreSQL

**Stories concernees** : FOUND-03, NFR-SEC-01

**Nature du risque** : RLS doit etre applique sur 14 tables avec `SET LOCAL app.current_company_id`. Si une seule requete oublie le `SET LOCAL`, la politique RLS est contournee. L'overhead de performance est theoriquement negligeable mais non mesure sur le schema specifique MnM (38+ tables).

**Mitigation** :
- Hook Drizzle pour injecter automatiquement `SET LOCAL` a chaque transaction
- Test d'integration : verifier que chaque route renvoie 0 resultat pour une company non-autorisee
- Benchmark performance avant/apres RLS sur les 5 queries les plus frequentes

### 4.4 Risque MOYEN — WebSocket Bidirectionnel

**Stories concernees** : CHAT-S01, CORE-07

**Nature du risque** : L'existant `live-events-ws.ts` est unidirectionnel (serveur → client). Le passage au bidirectionnel necessite un protocole de messages type, un systeme de reconnexion avec buffer 30s, et le pipe vers `stdin` de l'agent. Le scaling multi-instance via Redis pub/sub ajoute de la complexite.

**Mitigation** :
- Phase 1 : bidirectionnel basique (un serveur, pas de scaling)
- Phase 2 : ajout reconnexion et buffer
- Phase 3 : Redis pub/sub pour multi-instance (post-MVP)

### 4.5 Risque MOYEN — A2A Bus

**Stories concernees** : A2A-S01 a A2A-S04, ADV-04

**Nature du risque** : La communication agent-to-agent avec validation human-in-the-loop introduit des workflows asynchrones complexes. La detection de boucles (max 5 requetes A2A par chaine) est un probleme algorithmique non trivial quand les agents communiquent a travers des containers isoles.

**Mitigation** :
- Pattern Saga avec timeout : chaque requete A2A a un TTL
- Graph de communication en memoire avec detection de cycles
- MVP : communication A2A synchrone uniquement, pas de chaines

### 4.6 Risque FAIBLE mais BLOQUANT — Migration PostgreSQL Externe

**Stories concernees** : INFRA-S01

**Nature du risque** : Le risque technique est faible (PostgreSQL est bien supporte par Drizzle). Mais c'est un bloquant ABSOLU : sans cette migration, aucune feature multi-tenant ne peut etre implementee. Un retard ici retarde TOUT.

**Mitigation** :
- Faire cette migration en PREMIER, avant toute autre story
- Script de migration automatise et idempotent
- Tests avec donnees existantes pour verifier la non-regression

---

## 5. Infrastructure Stories Obligatoires

### 5.1 Stories qui DOIVENT etre completees avant tout developpement fonctionnel

Ces stories ne delivrent aucune valeur utilisateur directe mais sont des prerequis techniques sans lesquels les stories fonctionnelles ne peuvent pas etre implementees correctement.

#### INFRA-S01 : Migration PostgreSQL Externe (REQ-MU-07)
- **Pourquoi** : RLS, partitionnement audit_events, connection pooling — rien de cela ne fonctionne avec SQLite
- **Contenu** : docker-compose.dev.yml avec PostgreSQL 16, script de migration des donnees existantes, mise a jour du fichier de configuration Drizzle
- **Effort** : 2-3 jours
- **Bloque** : FOUND-03 (RLS), CORE-06 (audit partitionne), toute la strategie multi-tenant
- **ADR** : ADR-001

#### INFRA-S02 : Docker Compose Environment
- **Pourquoi** : Le ContainerManager a besoin d'un daemon Docker. L'environnement de dev doit inclure PostgreSQL, Redis, et Docker-in-Docker
- **Contenu** : docker-compose.dev.yml, docker-compose.test.yml, documentation setup
- **Effort** : 1-2 jours
- **Bloque** : CORE-04 (ContainerManager), tests d'integration
- **ADR** : ADR-004

#### INFRA-S03 : Redis Setup
- **Pourquoi** : Sessions (auth), cache (query), pub/sub (WebSocket scaling), rate limiting
- **Contenu** : docker-compose service Redis, client Redis dans le serveur, prefixe tenant
- **Effort** : 1 jour
- **Bloque** : CORE-07 (WebSocket), scaling multi-instance
- **ADR** : ADR-005

#### INFRA-S04 : CI/CD Pipeline Basique
- **Pourquoi** : Quality Gate QG-0 (lint + TypeScript) doit etre en place des le premier push pour eviter la dette technique
- **Contenu** : GitHub Actions workflow, lint, build TypeScript, tests unitaires
- **Effort** : 1 jour
- **Bloque** : Qualite du code, non-regression
- **ADR** : Aucun specifiquement, mais supporte tous

#### INFRA-S05 : Schema DB — Nouvelles Tables (10 tables)
- **Pourquoi** : Toutes les features B2B dependent de ces tables (project_memberships, automation_cursors, chat_channels, chat_messages, container_profiles, container_instances, credential_proxy_rules, audit_events, sso_configurations, import_jobs)
- **Contenu** : Fichiers Drizzle schema, migrations up/down, indexes, relations
- **Effort** : 2-3 jours
- **Bloque** : Tout le niveau CORE
- **ADR** : ADR-001 (companyId sur chaque table)

#### INFRA-S06 : Schema DB — Modifications Tables Existantes (5 tables)
- **Pourquoi** : Les colonnes ajoutees (tier, businessRole, containerProfileId, etc.) sont necessaires pour les roles metier et la containerisation
- **Contenu** : Migrations Drizzle, backward-compatible (colonnes nullable), seed data
- **Effort** : 1-2 jours
- **Bloque** : FOUND-04 (hasPermission), FOUND-06 (roles)
- **ADR** : ADR-001, ADR-002

#### INFRA-S07 : RLS PostgreSQL (14 tables)
- **Pourquoi** : Defense en profondeur — meme si le code applicatif oublie un filtre companyId, RLS bloque l'acces cross-tenant au niveau PostgreSQL
- **Contenu** : CREATE POLICY sur 14 tables, hook Drizzle pour SET LOCAL, tests d'isolation
- **Effort** : 3-5 jours
- **Bloque** : Tout le multi-tenant, containerisation securisee
- **ADR** : ADR-001

### 5.2 Ordre d'Execution des Infrastructure Stories

```
Semaine 0 (Jour 1-3) :
  Tom    : INFRA-S01 (PostgreSQL) + INFRA-S03 (Redis)
  Cofond.: INFRA-S02 (Docker Compose) + INFRA-S04 (CI/CD)

Semaine 0-1 (Jour 3-7) :
  Tom    : INFRA-S05 (10 nouvelles tables) + INFRA-S06 (5 tables modifiees)
  Cofond.: INFRA-S07 (RLS) — commence des que INFRA-S01 + INFRA-S05 sont prets
```

---

## 6. Points de Parallelisation

### 6.1 Split Equipe

Le PRD identifie deux pistes de travail paralleles (section 11.2) :

- **Tom** : Backend + Observabilite (Noyau B + C) — expertise infra, Docker, monitoring
- **Cofondateur technique** : Orchestration + Agents (Noyau A + D) — expertise IA, state machines, agents

### 6.2 Matrice de Parallelisation par Sprint

#### Sprint 1 — Infrastructure + Fondations (Semaine 1-2)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| INFRA-S01: PostgreSQL externe | INFRA-S02: Docker Compose | Independants |
| INFRA-S03: Redis setup | INFRA-S04: CI/CD pipeline | Independants |
| INFRA-S05: Schema 10 tables | INFRA-S07: RLS (apres S05) | S07 attend S05 de Tom |
| INFRA-S06: Schema modifs | RBAC-S03: Fix hasPermission | S03 attend S06 de Tom |

**Point de sync fin Sprint 1** : Schema DB complet, RLS actif, hasPermission corrige. Les deux doivent valider ensemble que l'isolation fonctionne.

#### Sprint 2 — RBAC + Multi-User + Container Base (Semaine 3-4)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| RBAC-S04: Permission keys | ORCH-S01: State machine (WorkflowEnforcer) | Independants |
| RBAC-S05: Audit 22 routes | ORCH-S02: File validation | Independants |
| OBS-S02: Audit events table | ORCH-S03: Pre-prompts injection | Independants |
| MU-S01: API invitations | CONT-S01: ContainerManager base | Independants |

**Point de sync fin Sprint 2** : Routes securisees, audit en place, state machine fonctionnelle. Tom livre les APIs, le Cofondateur livre le moteur d'orchestration.

#### Sprint 3 — Multi-User UI + Container Security + Orchestration avancee (Semaine 5-6)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| MU-S02: Page Membres UI | ORCH-S05: Drift detection | Independants |
| RBAC-S07: Admin UI | CONT-S02: Credential proxy | Independants |
| OBS-S06: Retention + triggers | ORCH-S06: Compaction kill+relance | Independants |
| CHAT-S01: WebSocket bidirectionnel | CONT-S03: Mount security | Chat depend WebSocket |

**Point de sync fin Sprint 3** : Interface multi-user fonctionnelle, drift detection active, containers securises. Demo interne possible.

#### Sprint 4 — Fonctionnalites Avancees (Semaine 7-8)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| CHAT-S02: Chat in-workflow | A2A-S01: A2A Bus | Chat → ContainerManager |
| OBS-S01: Audit summarizer (LLM) | A2A-S02: A2A permissions | Independants |
| OBS-S03: Dashboards agreges | ORCH-S07: Reinjection compaction | Independants |
| DUAL-S01: Curseur automatisation | ORCH-S09: HITL validation | Independants |

**Point de sync fin Sprint 4** : Chat temps reel, A2A basique, dashboards, curseur. Feature complete pour demo CBA.

#### Sprint 5 — Enterprise + Polish (Semaine 9-10)

| Tom (Backend + Observabilite) | Cofondateur (Orchestration + Agents) | Dependances |
|-------------------------------|--------------------------------------|-------------|
| ENT-01: SSO SAML/OIDC | ORCH-S08: Workflow editor UI | Independants |
| OBS-S05: Export audit | ENT-04: CompactionWatcher | Independants |
| ENT-02: Import Jira | A2A-S03: A2A audit | Independants |
| ENT-06: Smoke tests | ENT-06: Smoke tests | Collaboration |

**Point de sync fin Sprint 5** : Produit B2B vendable. Demo CBA possible.

### 6.3 Dependances Bloquantes Inter-Developpeurs

Il y a 4 moments critiques ou un developpeur bloque l'autre :

1. **Sprint 1, Jour 3** : Le Cofondateur ne peut pas commencer RLS avant que Tom finisse les schemas
2. **Sprint 1, Jour 5** : Le Cofondateur ne peut pas commencer hasPermission fix avant que Tom finisse les modifications de tables
3. **Sprint 3** : Le Chat bidirectionnel (Tom) doit etre pret avant que le Chat in-workflow (Sprint 4) puisse etre fait
4. **Sprint 3** : Le ContainerManager (Cofondateur) doit etre pret avant que le Credential Proxy puisse etre complete

### 6.4 Strategies de Deblocage

Pour minimiser les temps d'attente :

1. **Buffer tasks** : Quand un developpeur attend l'autre, il travaille sur des stories independantes (ex: CI/CD, documentation, tests unitaires).
2. **Interfaces stables** : Definir les interfaces TypeScript (types, schemas Zod) en premier jour, avant l'implementation. Les deux peuvent coder contre les interfaces.
3. **Feature branches** : Chaque story sur sa propre branche, merge regulier vers la branche de dev.
4. **Daily sync** : 15 min chaque matin pour identifier les blocages et ajuster les priorites.

---

## 7. ADR Mapping par Epic

### 7.1 Matrice ADR → Epic

| ADR | Titre | Epics Impactees | Stories Cles |
|-----|-------|----------------|--------------|
| **ADR-001** | Multi-tenant (RLS) | Infrastructure, Multi-User, RBAC, **TOUTES** | INFRA-S01, INFRA-S05, INFRA-S07, MU-S01-S06 |
| **ADR-002** | Auth (Better Auth + RBAC + SSO) | RBAC, Multi-User, Enterprise | RBAC-S01-S08, MU-S01, MU-S06, ENT-01 |
| **ADR-003** | Orchestrateur (State Machine) | Orchestrateur, Dual-Speed | ORCH-S01-S10, DUAL-S01-S04 |
| **ADR-004** | Containerisation (Docker + Credential Proxy) | Containerisation, A2A, Chat | CONT-S01-S07, A2A-S01, CHAT-S02 |
| **ADR-005** | Chat Temps Reel (WebSocket bidirectionnel) | Chat, Observabilite | CHAT-S01-S05, OBS-S03 (dashboards live) |
| **ADR-006** | Agent-to-Agent Communication | A2A | A2A-S01-S04 |
| **ADR-007** | Observabilite (Audit + Resume LLM) | Observabilite, Orchestrateur | OBS-S01-S06, ORCH-S05 (drift) |
| **ADR-008** | Gestion de Compaction | Orchestrateur | ORCH-S06, ORCH-S07, ENT-04 |

### 7.2 ADRs Transversaux

Certains ADRs impactent presque toutes les stories :

- **ADR-001 (RLS)** : Toute story qui touche a la base de donnees doit respecter l'isolation multi-tenant. C'est une contrainte transversale — chaque query doit avoir un `companyId`, chaque transaction doit faire `SET LOCAL app.current_company_id`.

- **ADR-002 (Auth)** : Toute story qui expose un endpoint API doit utiliser le middleware `requirePermission()`. Les 22 routes existantes doivent etre auditees.

- **ADR-007 (Observabilite)** : Toute mutation doit emettre un evenement d'audit. C'est un invariant (INV-03). Chaque story doit inclure l'emission d'audit dans ses criteres d'acceptation.

### 7.3 ADRs Concentres

D'autres ADRs sont concentres sur un petit nombre de stories :

- **ADR-003 (State Machine)** : Uniquement l'epic Orchestrateur. La state machine est un composant autonome avec ses propres tests.
- **ADR-006 (A2A)** : Uniquement l'epic A2A. Le bus est isole du reste du systeme.
- **ADR-008 (Compaction)** : Uniquement les stories de compaction dans l'Orchestrateur. C'est le risque le plus critique mais aussi le plus isole.

### 7.4 Impact des ADRs sur l'Ordre d'Implementation

L'ordre d'implementation des ADRs est dicte par leurs dependances :

```
ADR-001 (RLS) ──────────────→ DOIT etre premier (tout depend du multi-tenant)
ADR-002 (Auth) ─────────────→ DOIT etre deuxieme (RBAC depend du schema)
    ↓ ces deux sont prerequis pour tout le reste
ADR-004 (Container) ────────→ Peut etre parallele a ADR-003
ADR-003 (State Machine) ───→ Peut etre parallele a ADR-004
    ↓ ces deux sont prerequis pour le niveau avance
ADR-005 (WebSocket) ────────→ Depend de Redis (INFRA-S03) mais pas des ADRs precedents
ADR-007 (Observabilite) ───→ Depend de ADR-001 (table audit partitionnee)
ADR-006 (A2A) ─────────────→ Depend de ADR-004 (containers) + ADR-002 (permissions)
ADR-008 (Compaction) ──────→ Depend de ADR-003 (state machine) + ADR-004 (containers)
```

---

## Synthese et Recommandations

### Recommandation 1 : Spike Compaction (Semaine 0)
Avant tout developpement, dedier 3-5 jours a un spike technique sur la compaction (ADR-008). C'est le risque R1. Si la detection de compaction via heartbeats ne fonctionne pas, il faut pivoter la strategie AVANT d'investir dans l'orchestrateur.

### Recommandation 2 : PostgreSQL + RLS en Premier
La migration PostgreSQL externe (INFRA-S01) et l'activation RLS (INFRA-S07) sont les deux stories les plus bloquantes du projet. Elles doivent etre terminees dans les 5 premiers jours. Tout retard ici retarde tout le projet.

### Recommandation 3 : Interfaces TypeScript Jour 1
Les types partages (`packages/shared/`) pour les nouvelles tables, les permissions, les etats de workflow, les messages WebSocket doivent etre definis des le premier jour. Cela permet aux deux developpeurs de coder en parallele sans blocage.

### Recommandation 4 : Fix hasPermission Immediat
Le fix de `hasPermission()` (ADR-002, `access.ts:45-66`) est un trou de securite critique qui prend moins d'une journee. Il doit etre la premiere story de code fonctionnel, idealement en Sprint 1, Jour 1.

### Recommandation 5 : Revue de Dependances Hebdomadaire
Avec deux developpeurs travaillant en parallele sur des niveaux de dependances differents, une revue hebdomadaire des blocages est essentielle. Le daily sync de 15 min est complement, mais la revue hebdomadaire permet de re-prioriser les sprints si un chemin prend du retard.

### Recommandation 6 : Tests d'Integration Multi-Tenant des Sprint 1
Ecrire les tests d'isolation cross-company des que RLS est actif, avant toute story fonctionnelle. Ces tests servent de filet de securite pour toutes les stories suivantes.

---

*Section 2 — Sequencage Technique v1.0 — ~2800 mots — Winston (Lead Architecte)*
*Graphe de dependances en 5 niveaux, critical path 10 semaines, 52 FRs couverts, 6 risques techniques identifies, 7 infrastructure stories, parallelisation optimisee sur 5 sprints, 8 ADRs mappes.*
