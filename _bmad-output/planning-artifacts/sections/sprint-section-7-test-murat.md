# Section 7 — Stratégie de Test par Epic & Infrastructure de Test

> **Auteur** : Murat (Test Architect) | **Date** : 2026-03-14 | **Statut** : Final
> **Sources** : Architecture de Test (archi-section-5-test-murat.md), PRD B2B v1.0 (sections 7, 10), Architecture B2B v1.0 (section 9)

---

## Table des Matières

1. [Stratégie de Test par Epic](#1-stratégie-de-test-par-epic)
2. [Test Pyramid par Epic](#2-test-pyramid-par-epic)
3. [Infrastructure de Test — Stories](#3-infrastructure-de-test--stories)
4. [Performance Testing par Phase](#4-performance-testing-par-phase)
5. [Security Testing](#5-security-testing)
6. [CI/CD Quality Gates — Bloquants vs Informatifs](#6-cicd-quality-gates--bloquants-vs-informatifs)
7. [Test Data Management](#7-test-data-management)
8. [Estimation Effort Testing par Epic](#8-estimation-effort-testing-par-epic)

---

## 1. Stratégie de Test par Epic

Chaque epic possède sa propre stratégie de test, ordonnée par priorité de mise en place. L'ordre de test suit le graphe de dépendances techniques : les fondations (infra, RBAC) sont testées en premier car elles conditionnent la sécurité de tout le reste.

### 1.1 Epic 1 — Multi-User MVP (FR-MU)

**Durée estimée** : ~1 semaine dev + 2-3 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - Validation des schémas Zod pour les invitations (email, expiration 7j, lien signé)
   - Logique de désactivation du signup libre (toggle `requireInvite`)
   - Fonction de sign-out avec invalidation de session côté DB
   - Service d'invitation : création lien signé, calcul expiration, vérification doublons

2. **Intégration (Supertest + PostgreSQL)** — jour 2-3
   - `POST /api/invites` : création invitation, envoi email (mock SMTP), lien valide
   - `POST /api/invites/accept` : acceptation → membership créée → permissions assignées
   - Invitation expirée : tentative après 7j → 410 Gone
   - User déjà membre : tentative → 409 Conflict
   - Race condition : 2 admins invitent le même email simultanément → 1 seule membership
   - Sign-out : token invalide après sign-out (401)
   - `GET /api/members` : liste filtrée par companyId (RLS)
   - `DELETE /api/members/:id` : désactivation → agent cleanup

3. **E2E (Cypress)** — jour 3
   - Flux complet : Admin invite → email reçu → clic lien → signup → dashboard membre
   - Sign-out → token expiré → redirect login
   - Signup désactivé : page signup redirige vers "Contactez votre admin"

**Critères de couverture** :
- Unitaires : ≥80% nouveau code
- Intégration : 100% des routes `/api/invites`, `/api/members`
- E2E : 3 flux critiques (invitation, sign-out, signup désactivé)

**Scénarios PRD couverts** : SC-MU-01, SC-MU-02, SC-MU-03, SC-MU-04, SC-MU-05

---

### 1.2 Epic 2 — RBAC Métier (FR-RBAC)

**Durée estimée** : ~2 semaines dev + 4-5 jours test

**C'est l'epic la plus critique en termes de tests.** Un trou dans le RBAC = escalade de privilèges = compromission de données multi-tenant. Chaque route DOIT être testée avec les 4 rôles.

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-3
   - **`hasPermission()` corrigé** (access.ts) : 15 permission keys × scénarios scope (null, projectIds, scope vide, scope malformé) = ~60 cas
   - Presets de rôles : Admin (15/15), Manager (10/15), Contributor (5/15), Viewer (2/15)
   - Scope JSONB validation Zod strict : payloads valides, rejet des payloads malformés
   - Deny > Allow priority : `evaluateGrants()` avec grants conflictuels
   - `canUser()` côté client : retourne correct pour chaque combinaison rôle × permission

2. **Intégration (Supertest + PostgreSQL)** — jour 3-7
   - **Matrice exhaustive route × rôle** : 22 routes API × 4 rôles = ~88 cas d'accès
     - Chaque cellule vérifie : code HTTP correct (200/201/403), body correct, audit event émis
   - Scope JSONB enforcement :
     - Contributor avec scope `{projectIds: ["proj-1"]}` → voit uniquement proj-1
     - Admin avec scope null → voit tout
     - Contributor tente proj-2 → 403
   - Changement de rôle pendant session : token existant reflète le nouveau rôle au prochain appel
   - Dernier admin se rétrograde : bloqué par validation (invariant)
   - Injection SQL via JSONB scope : payloads OWASP → aucun n'injecte

3. **E2E (Cypress)** — jour 7-8
   - Navigation masquée : login Viewer → items admin absents du DOM (pas CSS `display:none`)
   - Attribution de rôle : Admin change Contributor → Manager → accès modifié immédiatement
   - Matrice permissions UI : page admin affiche la matrice configurable
   - Badges couleur par rôle visibles dans la liste membres

**Critères de couverture** :
- `hasPermission()` / `canUser()` : ≥95%
- Matrice route × rôle : 100% des combinaisons critiques
- E2E : 4 flux (navigation masquée, attribution rôle, matrice, scope projet)

**Scénarios PRD couverts** : SC-RBAC-01 à SC-RBAC-05

---

### 1.3 Epic 3 — Orchestrateur Déterministe (FR-ORCH)

**Durée estimée** : ~3-5 semaines dev + 5-7 jours test

**L'orchestrateur est le coeur du produit.** Les tests doivent garantir le déterminisme absolu — un agent ne peut JAMAIS sauter une étape ou contourner une validation.

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-4
   - **State machine** (workflow-state-machine.ts) : 12 transitions (CREATED→READY→IN_PROGRESS→VALIDATING→COMPLETED + PAUSED, FAILED, COMPACTING, SKIPPED)
     - Chaque transition valide : état source → événement → état destination
     - Transitions invalides : refus strict avec erreur typée
     - Guards : fichiers obligatoires absents → refus transition
   - **WorkflowEnforcer** :
     - Injection pré-prompts par étape
     - Vérification fichiers obligatoires avant transition
     - Persistance résultats intermédiaires
     - Human-in-the-loop : étape configurée pour validation → blocage en VALIDATING
   - **DriftDetector** :
     - Heuristiques de détection : comparaison attendu vs observé
     - Seuils configurables : ratio d'activité, fichiers attendus, durée anormale
     - Alerte émise si drift détecté (<15min)
   - **CompactionHandler** :
     - Kill+relance : contexte frais + résultats intermédiaires injectés
     - Réinjection : pré-prompts critiques réinjectés post-compaction
     - Circuit breaker : max 3 relances → alerte humaine

2. **Intégration (Supertest + PostgreSQL)** — jour 4-7
   - Workflow complet : créer template → lancer instance → step-by-step → complete
   - Saut d'étape interdit : tenter transition STEP-1 → STEP-3 → 400 Bad Request
   - Fichiers obligatoires : transition refusée si `requiredFiles` absents
   - Compaction pendant étape critique : atomique (pas de corruption)
   - Crash mid-workflow : heartbeat <30s → état restauré depuis snapshot
   - Workflow modifié pendant exécution : version isolée (pas d'impact)
   - Boucle infinie : watchdog coupe après N itérations configurables

3. **E2E (Cypress)** — jour 7-9
   - Workflow complet UI : créer template → lancer agent → observer step-by-step → valider
   - Drift intervention : agent dévie → alerte visible → diff attendu/observé → action corrective
   - Éditeur de workflow : drag-and-drop étapes, prompts, fichiers obligatoires

**Critères de couverture** :
- State machine : ≥90% (toutes transitions + guards)
- WorkflowEnforcer : ≥90%
- DriftDetector : ≥80%
- E2E : 3 flux critiques

**Scénarios PRD couverts** : SC-ORCH-01 à SC-ORCH-05

---

### 1.4 Epic 4 — Containerisation & Sécurité (FR-CONT)

**Durée estimée** : ~4-5 semaines dev + 5-7 jours test

**L'epic la plus critique en termes de sécurité.** Les tests doivent prouver qu'aucun agent ne peut s'échapper de son container ni accéder aux credentials d'un autre agent/company.

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-3
   - **ContainerManager** (Docker mocké pour tests unitaires) :
     - Création container avec profil (CPU, RAM, disk)
     - Options Docker : `--rm`, `--read-only`, `--no-new-privileges`
     - Timeout avec SIGTERM → SIGKILL (10s)
     - Gestion OOM kill (code 137) → reprofile
   - **Mount Allowlist** :
     - Validation `realpath()` sur chaque path
     - Rejet symlinks : `fs.lstat` → pas de symlink autorisé
     - Rejet null bytes : `\x00` dans le path → erreur immédiate
     - Rejet path traversal : `../../etc/passwd` → bloqué
     - Rejet URL encoding double : `%252e%252e` → bloqué
   - **Credential Proxy** :
     - Résolution secrets : nom → provider (local/AWS/GCP/Vault) → valeur
     - Isolation : agent A ne peut pas résoudre secret de agent B
     - Shadow `.env` : mount bind `/dev/null` vérifié
     - Proxy down : 503 → retry → suspend après 3 échecs

2. **Intégration (Supertest + Docker réel)** — jour 3-6
   - Cycle de vie complet : profil → lancement → credential proxy → exécution → cleanup
   - Container escape test : mount `/etc/shadow` → refusé par allowlist
   - Credential proxy tampering : appel direct aux secrets → 403 + audit event
   - Path traversal : `../../etc/passwd`, null bytes, encodage URL → tous bloqués
   - Isolation réseau : container company A ne peut pas ping container company B
   - Ressources : container dépasse la limite CPU/RAM → throttle/kill approprié
   - Docker daemon indisponible : mode dégradé → alerte admin
   - Épuisement ressources : limite par company → file d'attente

3. **E2E (Cypress)** — jour 6-7
   - Lancer agent containerisé → observer logs temps réel → credential proxy fonctionne → stop
   - Status container visible dans UI (running/stopped/failed)

**Critères de couverture** :
- ContainerManager : ≥90%
- Credential Proxy : ≥95%
- Mount Allowlist : ≥95%
- E2E : 2 flux critiques

**Scénarios PRD couverts** : SC-CONT-01 à SC-CONT-04

---

### 1.5 Epic 5 — Observabilité & Audit (FR-OBS)

**Durée estimée** : ~3 semaines dev + 3-4 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - AuditLogger : format événement (actorId, actorType, action, targetType, targetId, metadata, ipAddress)
   - Hash chain SHA-256 : calcul, vérification, chaîne intacte
   - AuditSummarizer : résumé LLM (mock provider) retourne texte <500 chars en <5s
   - Filtre audit : 12 filtres (acteur, action, date, target, severity, etc.)
   - AggregationService : k-anonymity (k=5) → aucun groupe avec <5 entrées → supprimé ou agrégé

2. **Intégration (Supertest + PostgreSQL)** — jour 2-4
   - Toute mutation API génère un audit_event dans la table
   - TRIGGER deny UPDATE/DELETE : tentative UPDATE sur audit_events → erreur PostgreSQL
   - Export CSV/JSON : `GET /api/audit/export` retourne données correctes
   - Dashboard agrégé : `GET /api/dashboards/agent-activity` → données agrégées, JAMAIS individuelles
   - Partitionnement mensuel : vérifier que les partitions existent et les queries les utilisent
   - Rétention : simulation 3 ans de données → queries performantes

3. **E2E (Cypress)** — jour 4-5
   - Page audit log : filtres, pagination, tri, recherche
   - Dashboard manager : métriques agrégées visibles, pas de drill-down individuel

**Critères de couverture** :
- AuditLogger : ≥85%
- AggregationService : ≥90% (k-anonymity critique)
- E2E : 2 flux

**Scénarios PRD couverts** : SC-OBS-01 à SC-OBS-04

---

### 1.6 Epic 6 — Chat Temps Réel (FR-CHAT)

**Durée estimée** : ~3 semaines dev + 3-4 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - ChatService : création channel, envoi message, pipe vers stdin agent
   - Rate limiter : 10 messages/min par user → 11ème message → rejeté avec erreur
   - Reconnexion : buffer serveur 30s → sync messages manqués
   - Message validation : >100KB → troncature, XSS → sanitisé (UTF-8 strict + DOMPurify)
   - `useAgentChat` hook (UI) : connexion WS, envoi, réception, déconnexion, reconnexion

2. **Intégration (Supertest + WebSocket réel)** — jour 2-4
   - Connexion WS → envoi message → réception réponse agent (mock agent stdin/stdout)
   - Rate limiting : 11 messages en <1min → dernier rejeté avec code 429
   - Reconnexion : déconnexion réseau → reconnexion → sync messages manqués via buffer 30s
   - Message après fin exécution : agent terminé → message chat → rejeté (channel fermé)
   - Viewer read-only : WebSocket connecté en lecture → tentative d'écriture → 403
   - XSS via chat : `<script>alert(1)</script>`, SVG malicieux, markdown injection → tous sanitisés

3. **E2E (Cypress)** — jour 4-5
   - Dialogue complet : connecter → envoyer message → recevoir réponse agent → historique visible
   - Reconnexion visible : perte connexion → spinner → reconnexion → messages rattrappés

**Critères de couverture** :
- ChatService : ≥85%
- Rate limiter : ≥90%
- E2E : 2 flux

**Scénarios PRD couverts** : SC-CHAT-01 à SC-CHAT-04

---

### 1.7 Epic 7 — Dual-Speed & Automatisation (FR-DUAL)

**Durée estimée** : ~2-3 semaines dev + 2-3 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - Curseur d'automatisation : 3 positions (Manuel/Assisté/Auto) × 4 niveaux (action/agent/projet/entreprise)
   - Plafond hiérarchique : CEO fixe plafond "Assisté" → Manager ne peut pas passer en "Auto"
   - Catégorisation tâches : mécanique vs jugement → seuils différents par catégorie

2. **Intégration (Supertest + PostgreSQL)** — jour 2-3
   - CRUD automation_cursors : création, mise à jour, lecture par niveau
   - Plafond enforcement : tentative de dépasser le plafond → 403 avec message explicite
   - Hiérarchie complète : CEO(Auto) → CTO(Assisté) → Manager(Manuel) → vérification cascade

3. **E2E (Cypress)** — jour 3
   - UI curseur : slider 3 positions, indicateur de plafond, tooltip d'explication

**Critères de couverture** :
- Curseur + plafond : ≥85%
- E2E : 1 flux

**Scénarios PRD couverts** : SC-DUAL-01 à SC-DUAL-04

---

### 1.8 Epic 8 — Onboarding & Import (FR-ONB)

**Durée estimée** : ~3-4 semaines dev + 3-4 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - ImportService : mapping Jira → MnM (projets, epics, stories, users, statuts)
   - Validation import : détection doublons, champs obligatoires, formats supportés
   - Cascade onboarding : logique CEO → CTO → Managers → Opérationnels

2. **Intégration (Supertest + PostgreSQL + MSW)** — jour 2-4
   - Import Jira (mock via MSW) : upload → mapping → validation → données importées
   - Import idempotent : même import 2x → pas de doublons
   - Import partiel : erreur au milieu → rollback atomique
   - Cascade hiérarchique : CEO configure → CTO reçoit son onboarding → cascade

3. **E2E (Cypress)** — jour 4-5
   - Import wizard : upload fichier → mapping colonnes → preview → confirmation → succès

**Critères de couverture** :
- ImportService : ≥80%
- E2E : 1 flux

**Scénarios PRD couverts** : REQ-ONB-01 à REQ-ONB-04

---

### 1.9 Epic 9 — Agent-to-Agent Communication (FR-A2A)

**Durée estimée** : ~4-5 semaines dev + 4-5 jours test

**Ordre des tests** :

1. **Unitaires (Vitest)** — jour 1-2
   - A2ABus : émission requête, validation permissions, routing
   - Anti-boucle : max 5 requêtes A2A par chaîne, détection de cycles
   - Permissions inter-agents : scope, rôle, projet vérifiés

2. **Intégration (Supertest + PostgreSQL)** — jour 2-4
   - Flux complet A2A : Agent A émet → A2ABus vérifie → notification humain → approbation → Agent A reçoit contexte
   - Permissions refusées : agent sans scope approprié → 403
   - Anti-boucle : chaîne de 6 requêtes → coupée à la 5ème avec erreur
   - Cycle detection : A→B→A → détecté et bloqué
   - Audit A2A : chaque transaction produit un audit_event

3. **E2E (Cypress)** — jour 4-5
   - Communication inter-agents visible dans l'UI
   - Notification humaine : approbation/rejet avec raison

**Critères de couverture** :
- A2ABus : ≥85%
- E2E : 2 flux

**Scénarios PRD couverts** : SC-A2A-01 à SC-A2A-03

---

## 2. Test Pyramid par Epic

### 2.1 Ratio par Epic

Le ratio unit(70%)/integration(20%)/E2E(10%) est le ratio **cible global**, mais chaque epic a un ratio adapté à sa nature. Les epics à forte composante sécurité (RBAC, Container) ont un ratio d'intégration plus élevé car la sécurité ne peut être validée qu'avec les vrais composants.

| Epic | Unitaires | Intégration | E2E | Justification |
|------|-----------|-------------|-----|---------------|
| **Multi-User (FR-MU)** | 60% (~15 tests) | 30% (~8 tests) | 10% (~3 tests) | Flux invitations nécessitent DB réelle |
| **RBAC (FR-RBAC)** | 50% (~60 tests) | 40% (~88 tests) | 10% (~4 tests) | Matrice route × rôle = intégration massive |
| **Orchestrateur (FR-ORCH)** | 65% (~80 tests) | 25% (~30 tests) | 10% (~3 tests) | State machine testable en unitaire |
| **Container (FR-CONT)** | 55% (~40 tests) | 35% (~25 tests) | 10% (~2 tests) | Sécurité container = intégration obligatoire |
| **Observabilité (FR-OBS)** | 60% (~30 tests) | 30% (~15 tests) | 10% (~2 tests) | Triggers DB, agrégation = intégration |
| **Chat (FR-CHAT)** | 55% (~25 tests) | 35% (~15 tests) | 10% (~2 tests) | WebSocket = intégration nécessaire |
| **Dual-Speed (FR-DUAL)** | 70% (~20 tests) | 20% (~6 tests) | 10% (~1 test) | Logique pure, peu d'I/O |
| **Onboarding (FR-ONB)** | 60% (~15 tests) | 30% (~8 tests) | 10% (~1 test) | Import = mock MSW + DB réelle |
| **A2A (FR-A2A)** | 55% (~15 tests) | 35% (~10 tests) | 10% (~2 tests) | Bus communication = intégration |
| **TOTAL** | ~300 tests | ~205 tests | ~20 tests | **~525 tests** |

### 2.2 Volume Total Estimé

```
         ┌─────────────────────┐
         │    E2E (Cypress)     │  ~20 scénarios — flux critiques
         │   ~4% du volume      │  Login, workflow, chat, RBAC, containers
         ├─────────────────────┤
         │  Intégration          │  ~205 scénarios — routes API, RBAC,
         │  (Supertest+DB)       │  isolation tenant, WebSocket, containers
         │   ~39% du volume      │
         ├─────────────────────┤
         │  Unitaires            │  ~300 tests — logique métier pure
         │  (Vitest)             │  state machines, parsers, validators,
         │   ~57% du volume      │  permission engine, credential proxy
         └─────────────────────┘
```

**Note** : Le ratio global (57/39/4) penche davantage vers l'intégration que la pyramide classique (70/20/10). C'est intentionnel dans un contexte multi-tenant sécurisé où l'isolation tenant, le RBAC et la containerisation ne peuvent être validés qu'avec les vrais composants.

---

## 3. Infrastructure de Test — Stories

### 3.1 STORY-TEST-001 : Setup Vitest Workspace B2B

**Priorité** : P0 — Prérequis pour tous les tests unitaires
**Effort** : 1 jour
**Sprint** : Sprint 0 (Setup)

**Description** :
Étendre la configuration Vitest workspace existante (5 projets) pour supporter les nouveaux modules B2B. Ajouter les configurations de couverture par module.

**Acceptance Criteria** :
- [ ] Vitest workspace inclut les 5 projets existants + les nouveaux fichiers test
- [ ] Configuration de couverture avec seuils différenciés :
  - Global nouveau code : ≥80% (lines, functions, branches)
  - RBAC engine : ≥95%
  - Credential proxy : ≥95%
  - State machine : ≥90%
- [ ] `pnpm test` exécute tous les tests en <3 minutes
- [ ] `pnpm test:coverage` génère le rapport de couverture avec les seuils

**Tâches** :
1. Étendre `vitest.config.ts` avec les nouveaux patterns de test
2. Configurer coverage thresholds par module dans `vitest.config.ts`
3. Ajouter script `test:coverage` dans le `package.json` racine
4. Vérifier que les tests existants (~55+ server, ~12 CLI) passent toujours

---

### 3.2 STORY-TEST-002 : Setup Cypress E2E

**Priorité** : P0 — Prérequis pour tous les tests E2E
**Effort** : 2 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Installer et configurer Cypress pour MnM. Aucune configuration Cypress n'existe actuellement dans le projet actif (les specs legacy dans `_legacy/web/e2e/` utilisaient Playwright).

**Acceptance Criteria** :
- [ ] `cypress.config.ts` configuré (baseUrl, specPattern, viewportWidth/Height)
- [ ] Support React 18 + Vite pour component testing
- [ ] Custom commands : `cy.login(role)`, `cy.createAgent()`, `cy.asRole(role)`, `cy.resetDB()`
- [ ] `cypress/support/e2e.ts` avec setup global (intercepteurs API, gestion sessions)
- [ ] `pnpm test:e2e` exécute les tests en mode headless
- [ ] `pnpm test:e2e:open` ouvre l'UI Cypress en mode interactif
- [ ] Video désactivée en local, activée en CI
- [ ] Retry : 2 en CI, 0 en local

**Tâches** :
1. `pnpm add -D cypress @cypress/vite-dev-server`
2. Créer `cypress.config.ts` (voir archi-section-5-test-murat.md)
3. Créer `cypress/support/commands.ts` avec custom commands
4. Créer `cypress/support/e2e.ts` avec setup global
5. Créer `cypress/plugins/db-seed.ts` pour le seeding DB avant tests
6. Ajouter scripts dans `package.json`
7. Ajouter un premier test smoke `cypress/e2e/smoke.cy.ts`

---

### 3.3 STORY-TEST-003 : Test Database Setup (PostgreSQL de test)

**Priorité** : P0 — Prérequis pour tous les tests d'intégration
**Effort** : 1.5 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Configurer l'infrastructure de base de données de test pour les tests d'intégration. Le projet utilise déjà `embedded-postgres` pour le développement. Il faut étendre cette configuration pour les tests avec le pattern transaction-rollback.

**Acceptance Criteria** :
- [ ] `docker-compose.test.yml` avec PostgreSQL 16 + Redis 7 en mode tmpfs (RAM)
- [ ] Pattern transaction-rollback : `beforeEach` démarre une transaction, `afterEach` rollback
- [ ] Migrations automatiques au démarrage des tests (`pnpm db:migrate` sur la DB de test)
- [ ] RLS policies actives sur la DB de test (identiques à la production)
- [ ] Port de test différent (5433) pour ne pas confliter avec le dev (5432)
- [ ] Variable `DATABASE_URL` configurable par environnement

**Tâches** :
1. Créer `docker-compose.test.yml`
2. Créer `server/src/__tests__/integration/setup.ts` avec le pattern transaction-rollback
3. Configurer la globalSetup Vitest pour démarrer/migrer la DB de test
4. Vérifier que les RLS policies sont correctement appliquées en test
5. Documenter la procédure de setup dans un README de test

---

### 3.4 STORY-TEST-004 : Test Factories & Fixtures

**Priorité** : P0 — Prérequis pour tests d'intégration et E2E
**Effort** : 2 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Créer les factory functions TypeScript pour générer des données de test cohérentes. Ces factories sont utilisées par les tests unitaires, d'intégration et le seed E2E.

**Acceptance Criteria** :
- [ ] Factories pour toutes les entités du domaine :
  - `createUser()`, `createCompany()`, `createAgent()`, `createWorkflowTemplate()`
  - `createMembership()`, `createPermissionGrant()`, `createProject()`
  - `createChatChannel()`, `createChatMessage()`, `createContainerProfile()`
  - `createAuditEvent()`, `createAutomationCursor()`
- [ ] Chaque factory accepte des overrides typés (`Partial<T>`)
- [ ] IDs auto-générés avec `randomUUID()`
- [ ] Emails auto-générés avec suffixe unique (`@test.mnm.dev`)
- [ ] Export depuis `tests/factories/index.ts`

**Tâches** :
1. Créer `tests/factories/index.ts` avec toutes les factories
2. Créer `tests/factories/helpers.ts` pour les utilitaires (génération emails, noms, etc.)
3. Créer `tests/factories/presets.ts` pour les jeux de données prédéfinis (4 rôles, 2 companies)
4. Tests unitaires sur les factories elles-mêmes (types corrects, IDs uniques)

---

### 3.5 STORY-TEST-005 : E2E Seed Data

**Priorité** : P1 — Nécessaire avant les tests E2E métier
**Effort** : 1.5 jours
**Sprint** : Sprint 0 ou Sprint 1

**Description** :
Créer un jeu de données de seed cohérent pour les tests E2E Cypress. Ce seed représente un cas d'usage réel MnM avec 2 companies, 5 users, 4 rôles, 2 agents, 1 workflow template.

**Acceptance Criteria** :
- [ ] `tests/seed/e2e-seed.ts` crée un jeu de données complet
- [ ] 2 companies (Alpha Corp, Beta Inc) pour tests d'isolation
- [ ] 4 users avec rôles différents dans Alpha (admin, manager, contributor, viewer)
- [ ] 1 user dans Beta (admin) pour tests cross-tenant
- [ ] 1 projet avec scoping dans Alpha
- [ ] 2 agents (1 Alpha, 1 Beta)
- [ ] 1 workflow template avec 3 étapes
- [ ] Permissions avec scope JSONB pour le contributor
- [ ] Script exécutable : `node tests/seed/run.js`
- [ ] Idempotent : peut être exécuté plusieurs fois sans erreur

**Tâches** :
1. Créer `tests/seed/e2e-seed.ts` (voir code dans archi-section-5-test-murat.md)
2. Créer `tests/seed/run.ts` avec exécution standalone
3. Intégrer le seed dans le plugin Cypress (`cypress/plugins/db-seed.ts`)
4. Vérifier que le seed est compatible avec les RLS policies

---

### 3.6 STORY-TEST-006 : Mock Strategy Setup

**Priorité** : P1 — Nécessaire pour les tests unitaires métier
**Effort** : 1 jour
**Sprint** : Sprint 0 ou Sprint 1

**Description** :
Configurer les mocks pour les services externes (LLM providers, Docker daemon, SMTP, services tiers).

**Acceptance Criteria** :
- [ ] Mock LLM provider : `mockLLMProvider` avec `generateSummary()` et `detectDrift()`
- [ ] Mock Docker daemon : `mockDockerClient` pour ContainerManager (tests unitaires uniquement)
- [ ] Mock SMTP : `nodemailer-mock` ou équivalent pour vérifier envoi emails
- [ ] Mock services tiers (Jira, Linear) : MSW (Mock Service Worker) handlers
- [ ] Guide documenté : "Quand mocker quoi" aligné avec la règle "JAMAIS mocker la DB"

**Tâches** :
1. Créer `tests/mocks/llm-provider.ts`
2. Créer `tests/mocks/docker-client.ts`
3. Créer `tests/mocks/smtp.ts`
4. Installer et configurer MSW : `pnpm add -D msw`
5. Créer `tests/mocks/msw-handlers.ts` pour Jira/Linear APIs

---

### 3.7 STORY-TEST-007 : CI Pipeline Quality Gates

**Priorité** : P0 — Doit être en place avant le premier merge sur master
**Effort** : 2 jours
**Sprint** : Sprint 0 (Setup)

**Description** :
Implémenter le pipeline CI GitHub Actions avec les 7 quality gates définies dans l'architecture de test.

**Acceptance Criteria** :
- [ ] `.github/workflows/ci.yml` complet avec les 7 QGs
- [ ] QG-0 : TypeScript strict, ESLint, secret scan → bloquant
- [ ] QG-1 : Vitest unitaires avec couverture ≥80% → bloquant
- [ ] QG-2 : Tests intégration avec PostgreSQL service → bloquant
- [ ] QG-3 : OWASP ZAP + dependency audit + secret scan → bloquant (critique/haute)
- [ ] QG-4 : k6 performance → informatif sur PR, bloquant sur master
- [ ] QG-5 : Cypress E2E → bloquant
- [ ] QG-6 : Review humaine → bloquant
- [ ] Parallélisation : QG-1 et QG-2 en parallèle, QG-4 et QG-5 en parallèle
- [ ] Caching : pnpm store, Docker layers, Cypress binary
- [ ] Temps total <22 minutes (chemin critique)

**Tâches** :
1. Créer `.github/workflows/ci.yml` (voir archi-section-5-test-murat.md pour le YAML complet)
2. Configurer les services PostgreSQL dans les jobs d'intégration et E2E
3. Configurer les seuils de couverture dans le job unitaire
4. Ajouter le job OWASP ZAP avec les seuils appropriés
5. Configurer les environment protection rules sur GitHub pour staging/production
6. Ajouter le caching pour pnpm, Cypress, Docker

---

### 3.8 STORY-TEST-008 : Performance Benchmarks Setup (k6)

**Priorité** : P1 — Nécessaire avant le Sprint 2
**Effort** : 2 jours
**Sprint** : Sprint 1

**Description** :
Configurer les benchmarks de performance k6 pour les API REST, WebSocket et containers.

**Acceptance Criteria** :
- [ ] `tests/performance/api-benchmark.js` : 6 endpoints benchmarkés
- [ ] `tests/performance/websocket-benchmark.js` : latence messages, connexions simultanées
- [ ] `tests/performance/container-benchmark.js` : temps démarrage cold/warm
- [ ] `tests/performance/check-thresholds.js` : vérification automatisée des seuils
- [ ] Seuils MVP configurés (API P95 <500ms, WS <50ms, container <10s)
- [ ] Export résultats en JSON pour analyse

**Tâches** :
1. Installer k6 dans le pipeline CI
2. Créer les 3 scripts de benchmark (voir archi-section-5-test-murat.md)
3. Créer le script de vérification des seuils
4. Intégrer dans le job QG-4 du pipeline CI

---

## 4. Performance Testing par Phase

### 4.1 Phase 1 — MVP (Sprints 1-4)

Objectifs de performance MVP : validation que le système répond sous charge normale.

| Métrique | Seuil | Outil | Fréquence |
|----------|-------|-------|-----------|
| API P50 latence | <100ms | k6 | Chaque merge master |
| API P95 latence | <500ms | k6 | Chaque merge master |
| API P99 latence | <1000ms | k6 | Chaque merge master |
| WebSocket message | <50ms | k6 + xk6-websocket | Chaque merge master |
| Container startup cold | <10s | k6 | Sprint 3+ (container ready) |
| Dashboard page load | <2s | Cypress + Performance API | Sprint 2+ |
| 50 users simultanés | 0% error, P95 <500ms | k6 | Hebdomadaire |
| 20 agents actifs | heartbeat stable | k6 | Sprint 3+ |

**Scénarios de charge MVP** :
- **Normal** : 50 VUs pendant 2 minutes → 100% success, P95 <500ms
- **Peak** : 100 VUs pendant 1 minute → <1% errors, P95 <1000ms
- **Soak** : 20 VUs pendant 2 heures → pas de memory leak, pas de connexion leak

### 4.2 Phase 2 — Enterprise (Post-MVP)

| Métrique | Seuil | Outil | Fréquence |
|----------|-------|-------|-----------|
| API P50 latence | <50ms | k6 | Chaque merge master |
| API P95 latence | <200ms | k6 | Chaque merge master |
| WebSocket message | <20ms | k6 + xk6-websocket | Chaque merge master |
| Container startup cold | <5s | k6 | Chaque merge master |
| Dashboard page load | <1s | Lighthouse | Chaque merge master |
| 1000 users simultanés | <1% error | k6 | Hebdomadaire |
| 500 agents actifs | heartbeat stable | k6 | Hebdomadaire |
| 10 000 WebSocket connexions | <20ms latence | k6 | Mensuel |

**Scénarios de charge Enterprise** :
- **Steady** : 500 VUs pendant 10 minutes → CPU <70%, RAM <80%, pool DB <80%
- **Burst** : 1000 VUs pendant 1 minute → saturation gracieuse, file d'attente, pas de crash
- **Soak** : 50 VUs pendant 8 heures → stabilité mémoire, pas de GC long pauses

### 4.3 Benchmarks Base de Données

**Monitoring continu via `pg_stat_statements`** :

| Métrique | Seuil | Action si dépassé |
|----------|-------|-------------------|
| Queries >100ms | <5% du total | EXPLAIN ANALYZE + index candidat |
| Queries >1s | 0% | Alerte immédiate + optimisation obligatoire |
| Seq scans tables >10k rows | 0 | CREATE INDEX obligatoire |
| Pool connexions | <80% max | Alerter si >80% |
| Taille table audit_events | Monitoring mensuel | Vérifier partitionnement |

**Tables critiques à monitorer** :
- `agents` : queries fréquentes avec JOIN heartbeat_runs
- `audit_events` : table partitionnée, volume élevé
- `principal_permission_grants` : queries RBAC sur chaque requête API
- `chat_messages` : volume croissant, queries par channelId

---

## 5. Security Testing

### 5.1 OWASP Testing par Epic

Chaque epic a des vecteurs d'attaque spécifiques. Les tests de sécurité sont intégrés dans les tests d'intégration (pas un effort séparé).

| Epic | Vecteurs OWASP | Tests |
|------|----------------|-------|
| **FR-MU** | A01 Broken Access Control (invitation tampering), A07 Auth Failures (brute force login) | 3 tests |
| **FR-RBAC** | A01 Broken Access Control (escalade horizontale/verticale), A03 Injection (SQL via JSONB scope) | 8 tests |
| **FR-ORCH** | A04 Insecure Design (workflow bypass), A08 Software Integrity (template tampering) | 4 tests |
| **FR-CONT** | A01 Broken Access Control (container escape), A05 Security Misconfiguration (mount paths), A09 Logging Failures (credential leak) | 6 tests |
| **FR-OBS** | A09 Logging Failures (audit tampering), A01 Broken Access Control (données cross-tenant) | 3 tests |
| **FR-CHAT** | A03 Injection (XSS via chat), A07 Auth Failures (WebSocket hijacking) | 4 tests |
| **FR-A2A** | A01 Broken Access Control (A2A sans permission), A04 Insecure Design (boucle infinie) | 3 tests |
| **TOTAL** | | **31 tests de sécurité** |

### 5.2 RBAC Testing Exhaustif

**Matrice de test RBAC** — chaque cellule est un test automatisé :

```
Route                    | Admin | Manager | Contributor | Viewer |
─────────────────────────┼───────┼─────────┼─────────────┼────────┤
POST /api/invites        | 201   | 201     | 403         | 403    |
GET /api/members         | 200   | 200     | 403         | 403    |
PUT /api/members/:id     | 200   | 403     | 403         | 403    |
DELETE /api/members/:id  | 200   | 403     | 403         | 403    |
GET /api/roles           | 200   | 403     | 403         | 403    |
PUT /api/permissions     | 200   | 403     | 403         | 403    |
POST /api/agents         | 201   | 201     | 201(scope)  | 403    |
DELETE /api/agents/:id   | 200   | 200(own)| 403         | 403    |
GET /api/agents          | 200   | 200     | 200(scope)  | 200(scope)|
POST /api/workflows      | 201   | 201     | 403         | 403    |
PUT /api/workflows/:id   | 200   | 200     | 403         | 403    |
POST /api/enforce        | 200   | 200     | 403         | 403    |
GET /api/drift/alerts    | 200   | 200     | 403         | 403    |
GET /api/audit           | 200   | 200     | 403         | 403    |
GET /api/audit/export    | 200   | 403     | 403         | 403    |
GET /api/dashboards      | 200   | 200     | 403         | 403    |
POST /api/containers     | 201   | 201     | 201         | 403    |
GET /api/containers/:id  | 200   | 200     | 200         | 403    |
POST /api/chat/messages  | 201   | 201     | 201         | 403    |
GET /api/chat/history    | 200   | 200     | 200         | 200    |
POST /api/a2a/request    | 201   | 201     | 403         | 403    |
PUT /api/cursors         | 200   | 200     | 200(own)    | 403    |
```

**Total** : 22 routes × 4 rôles = **88 cas de test RBAC**.

### 5.3 Container Isolation Testing

Tests spécifiques à l'isolation des containers, alignés avec les 5 couches Nanoclaw :

| # | Test | Couche | Résultat attendu |
|---|------|--------|-----------------|
| 1 | Mount `/etc/shadow` | Mount allowlist | Refusé par `realpath()` |
| 2 | Symlink vers `/etc/passwd` | Mount allowlist | Refusé (symlink interdit) |
| 3 | Null byte `path%00.txt` | Mount allowlist | Refusé (null byte détecté) |
| 4 | `../../etc/passwd` | Mount allowlist | Refusé (path traversal) |
| 5 | Accès direct secrets | Credential proxy | 403 + audit event |
| 6 | Read `.env` dans container | Shadow .env | Fichier vide (/dev/null) |
| 7 | Ping container autre company | Réseau isolé | Timeout (bridge séparé) |
| 8 | `--privileged` flag | Container config | Refusé par ContainerManager |
| 9 | Fork bomb | Resource limits | cgroup kill |
| 10 | Écriture filesystem | Read-only | Permission denied |

### 5.4 Multi-Tenant Isolation Testing

Test d'isolation critique — chaque test crée 2 companies et vérifie qu'aucune donnée ne fuit :

| # | Test | Vérification |
|---|------|-------------|
| 1 | `GET /api/agents` avec user Alpha | Retourne uniquement agents Alpha, jamais Beta |
| 2 | `GET /api/agents/:betaAgentId` avec user Alpha | 404 Not Found (pas 403 — ne pas révéler l'existence) |
| 3 | SQL direct avec RLS actif | `SET LOCAL app.current_company_id = alpha` → seules les rows Alpha |
| 4 | Redis cache | Clé `tenant:alpha:...` ne retourne jamais données Beta |
| 5 | WebSocket channel | User Alpha ne reçoit pas les events Beta |
| 6 | Audit log | `GET /api/audit` filtré par company, jamais cross-tenant |
| 7 | Container réseau | Bridge Alpha isolé de bridge Beta |

---

## 6. CI/CD Quality Gates — Bloquants vs Informatifs

### 6.1 Matrice Quality Gate × Contexte

| Quality Gate | PR / Feature | Merge Master | Staging | Production |
|-------------|-------------|-------------|---------|-----------|
| **QG-0** Compile + Lint | **BLOQUANT** | **BLOQUANT** | N/A | N/A |
| **QG-1** Unit Tests | **BLOQUANT** | **BLOQUANT** | N/A | N/A |
| **QG-2** Integration Tests | **BLOQUANT** | **BLOQUANT** | N/A | N/A |
| **QG-3** Security Scan | **BLOQUANT** (critique/haute) | **BLOQUANT** | N/A | N/A |
| **QG-4** Performance | INFORMATIF (commentaire PR) | **BLOQUANT** | **BLOQUANT** | N/A |
| **QG-5** E2E Tests | **BLOQUANT** | **BLOQUANT** | Smoke only | Smoke only |
| **QG-6** Review humaine | **BLOQUANT** (1 approbation) | N/A (post-merge) | Manual QA | Sign-off |

### 6.2 Détail des Seuils Bloquants

**QG-0 — Compilation & Standards** (durée : ~2 min)
- `pnpm typecheck` : 0 erreur TypeScript
- `pnpm lint` : 0 erreur ESLint (warnings tolérés en dev, pas en CI)
- `pnpm check:tokens` : 0 token secret détecté dans le code

**QG-1 — Tests Unitaires** (durée : ~3 min)
- 0 test failing
- Couverture nouveau code : ≥80% (lignes, fonctions, branches)
- Couverture RBAC engine : ≥95%
- Couverture credential proxy : ≥95%

**QG-2 — Tests Intégration** (durée : ~5 min)
- 0 test failing
- 100% routes auth-required testées avec les 4 rôles
- 0 data leak cross-company
- Toutes migrations appliquées sans erreur

**QG-3 — Sécurité** (durée : ~4 min)
- `pnpm audit` : 0 vulnérabilité critique/haute
- TruffleHog : 0 secret vérifié trouvé
- OWASP ZAP : 0 alerte haute/critique (informational/low tolérés)

**QG-4 — Performance** (durée : ~5 min)
- MVP : API P95 <500ms, WS <50ms, container startup <10s
- Enterprise : API P95 <200ms, WS <20ms, container <5s
- Sur PR : résultats affichés en commentaire, pas bloquant
- Sur master : bloquant si seuils dépassés

**QG-5 — E2E** (durée : ~8 min)
- Flux P0 : 100% passants (login, workflow, chat, RBAC, container, isolation)
- Flux P1 : ≥90% passants (retry 2x pour les tests flaky)
- Temps total : <20 minutes

**QG-6 — Review & Audit**
- ≥1 approbation requise sur la PR
- Chaque migration a un `up()` ET un `down()` correspondant
- Toute mutation dans la PR émet un audit event (vérifié par reviewer)

### 6.3 Gestion des Tests Flaky

Les tests flaky sont un risque majeur pour la vélocité. Stratégie :

1. **Identification** : tout test qui échoue puis passe au retry est marqué `@flaky`
2. **Budget** : maximum 5% de tests flaky à tout moment
3. **Quarantaine** : un test flaky >3 fois en 1 semaine est isolé et doit être corrigé en priorité
4. **Root causes communes** :
   - Tests E2E avec timing dépendant du réseau → utiliser `cy.intercept()` + `cy.wait()`
   - Tests WebSocket avec race conditions → utiliser des signaux explicites (pas de `setTimeout`)
   - Tests DB avec données partagées → vérifier le pattern transaction-rollback

---

## 7. Test Data Management

### 7.1 Stratégie par Niveau de Test

| Niveau | Source de données | Lifecycle | Isolation |
|--------|------------------|-----------|-----------|
| **Unitaire** | Factories in-memory | Par test | Naturelle (pas de DB) |
| **Intégration** | Factories + insert DB | Transaction rollback par test | Transaction isolation |
| **E2E** | Seed data prédéfini | Avant chaque suite, reset entre suites | DB truncate + reseed |
| **Performance** | Seed data volumétrique | Avant le benchmark, persisté | DB dédiée `mnm_perf` |

### 7.2 Fixtures Prédéfinies

**Jeu de données standard "Alpha-Beta"** — utilisé par tous les tests d'intégration et E2E :

```
Company Alpha Corp (tier: team, maxUsers: 50)
├── admin@alpha.test    (rôle: admin)     — toutes permissions
├── manager@alpha.test  (rôle: manager)   — 10/15 permissions
├── contrib@alpha.test  (rôle: contributor)— 5/15 permissions, scope: {projectIds: ["proj-1"]}
├── viewer@alpha.test   (rôle: viewer)    — 2/15 permissions
├── Projet Test (slug: projet-test)
├── Agent Dev Alpha (adapter: claude_local)
└── Workflow Template (3 étapes: Analyse → Implémentation → Tests)

Company Beta Inc (tier: team, maxUsers: 10)
├── admin@beta.test     (rôle: admin)
└── Agent Dev Beta (adapter: claude_local)
```

### 7.3 Gestion des Données Volumétriques (Performance)

Pour les benchmarks k6, un seed volumétrique est nécessaire :

| Entité | Volume MVP | Volume Enterprise |
|--------|-----------|------------------|
| Companies | 5 | 50 |
| Users | 50 | 1 000 |
| Agents | 20 | 200 |
| Issues | 10 000 | 100 000 |
| Audit events | 50 000 | 1 000 000 |
| Chat messages | 5 000 | 50 000 |
| Workflow instances | 200 | 5 000 |

Script de génération : `tests/seed/perf-seed.ts` — génère les données en batch (insert 1000 rows à la fois) pour un temps de seed <30 secondes.

### 7.4 Environnements de Test

| Environnement | DB | Seed | Usage |
|--------------|-----|------|-------|
| `mnm_test` (port 5433) | PostgreSQL 16 tmpfs | Transaction rollback | Tests intégration locaux + CI |
| `mnm_e2e` (port 5434) | PostgreSQL 16 | Seed complet Alpha-Beta | Tests E2E locaux + CI |
| `mnm_perf` (port 5435) | PostgreSQL 16 | Seed volumétrique | Benchmarks k6 |
| `embedded-postgres` | In-process | Minimal | Tests unitaires rapides |

### 7.5 Nettoyage et Réinitialisation

- **Tests unitaires** : aucun nettoyage nécessaire (in-memory)
- **Tests intégration** : transaction rollback automatique (`afterEach`)
- **Tests E2E** : `cy.resetDB()` custom command qui :
  1. Truncate toutes les tables dans l'ordre des FK
  2. Réapplique le seed Alpha-Beta
  3. Durée : <2 secondes
- **Tests performance** : DB recréée avant chaque run de benchmark

---

## 8. Estimation Effort Testing par Epic

### 8.1 Tableau d'Effort Testing

L'effort de test représente typiquement **30-40% de l'effort de développement** pour un projet B2B avec des exigences de sécurité multi-tenant. Pour MnM, le ratio est plus proche de 35% en raison de la criticité du RBAC et de la containerisation.

| Epic | Effort Dev | Effort Test | % du Dev | Breakdown Test |
|------|-----------|------------|----------|----------------|
| **Multi-User (FR-MU)** | 1 semaine | 2.5 jours | 50% | 1j unitaire, 1j intégration, 0.5j E2E |
| **RBAC (FR-RBAC)** | 2 semaines | 5 jours | 50% | 1.5j unitaire (60 tests), 2.5j intégration (88 cas matrice), 1j E2E |
| **Orchestrateur (FR-ORCH)** | 3-5 semaines | 5-7 jours | 35% | 2j unitaire (state machine), 2-3j intégration, 1-2j E2E |
| **Container (FR-CONT)** | 4-5 semaines | 5-7 jours | 35% | 1.5j unitaire, 3j intégration (Docker réel), 1j E2E |
| **Observabilité (FR-OBS)** | 3 semaines | 3-4 jours | 30% | 1j unitaire, 1.5j intégration, 0.5-1j E2E |
| **Chat (FR-CHAT)** | 3 semaines | 3-4 jours | 30% | 1j unitaire, 1.5j intégration (WS), 0.5-1j E2E |
| **Dual-Speed (FR-DUAL)** | 2-3 semaines | 2-3 jours | 25% | 1j unitaire, 1j intégration, 0.5j E2E |
| **Onboarding (FR-ONB)** | 3-4 semaines | 3-4 jours | 25% | 1j unitaire, 1.5j intégration (MSW), 0.5-1j E2E |
| **A2A (FR-A2A)** | 4-5 semaines | 4-5 jours | 25% | 1j unitaire, 2j intégration, 1-2j E2E |
| **Infra Test (Sprint 0)** | N/A | 8 jours | N/A | Stories TEST-001 à TEST-008 |
| **TOTAL** | ~25-37 sem | ~42-50 jours | **~35%** | |

### 8.2 Justification des Ratios Élevés

- **FR-MU et FR-RBAC (50%)** : Le RBAC est le fondement sécurité. Un bug dans `hasPermission()` compromet tout le système. La matrice 22 routes × 4 rôles = 88 tests d'intégration justifie le ratio élevé.
- **FR-CONT (35%)** : La containerisation manipule Docker, les credentials, le filesystem. Chaque test de sécurité container (10 tests d'isolation) protège contre des vecteurs d'attaque réels.
- **FR-DUAL et FR-ONB (25%)** : Logique métier plus simple, moins de surface d'attaque sécurité.

### 8.3 Sprint 0 — Budget Infrastructure de Test

Le Sprint 0 est entièrement dédié à l'infrastructure de test et de développement. Budget test :

| Story | Effort | Dépendances |
|-------|--------|-------------|
| STORY-TEST-001 : Vitest Workspace | 1 jour | Aucune |
| STORY-TEST-002 : Cypress Setup | 2 jours | Aucune |
| STORY-TEST-003 : Test DB Setup | 1.5 jours | Docker Compose |
| STORY-TEST-004 : Factories | 2 jours | Schema DB |
| STORY-TEST-005 : E2E Seed | 1.5 jours | STORY-TEST-003, TEST-004 |
| STORY-TEST-006 : Mock Setup | 1 jour | Aucune |
| STORY-TEST-007 : CI Pipeline | 2 jours | STORY-TEST-001 à TEST-006 |
| STORY-TEST-008 : k6 Benchmarks | 2 jours | STORY-TEST-003 |
| **TOTAL Sprint 0 Test** | **13 jours** | |

**Note** : Les stories TEST-001, TEST-002, TEST-003 et TEST-006 peuvent être parallélisées (jour 1-2). Les stories TEST-004 et TEST-005 dépendent de TEST-003 (jour 2-4). La story TEST-007 agrège tout le reste (jour 4-5). La story TEST-008 peut être décalée au Sprint 1 si nécessaire.

### 8.4 Calendrier Test par Sprint

| Sprint | Focus Test | Effort Test | Tests Écrits |
|--------|-----------|------------|-------------|
| **Sprint 0** | Infrastructure (8 stories) | 8 jours | ~10 tests (smoke + factories) |
| **Sprint 1** | FR-MU + FR-RBAC (unit + intég) | 5 jours | ~160 tests (15+60 unit, 8+88 intég) |
| **Sprint 2** | FR-RBAC E2E + FR-ORCH (unit) | 5 jours | ~90 tests (4 E2E, 80 unit orch) |
| **Sprint 3** | FR-ORCH (intég + E2E) + FR-CONT (unit) | 6 jours | ~75 tests (30 intég, 3 E2E, 40 unit cont) |
| **Sprint 4** | FR-CONT (intég + E2E) + FR-OBS | 6 jours | ~60 tests (25 intég, 2 E2E, 30+15 obs) |
| **Sprint 5** | FR-CHAT + FR-DUAL | 5 jours | ~70 tests (25+20 unit, 15+6 intég, 2+1 E2E) |
| **Sprint 6** | FR-ONB + FR-A2A | 5 jours | ~50 tests (15+15 unit, 8+10 intég, 1+2 E2E) |
| **Sprint 7** | Performance + sécurité transverse | 4 jours | ~20 tests (k6 scenarios + OWASP) |
| **TOTAL** | | **~44 jours** | **~525 tests** |

---

## Résumé

La stratégie de test MnM B2B repose sur trois piliers :

1. **Sécurité d'abord** : le RBAC et la containerisation sont testés avec une couverture de 95%+. La matrice route × rôle (88 cas) est exhaustive. Les 10 tests d'isolation container prouvent les 5 couches Nanoclaw. Les 7 tests d'isolation multi-tenant vérifient que zéro donnée ne fuit entre companies.

2. **Automatisation complète** : le pipeline CI à 7 quality gates bloque tout code qui ne respecte pas les seuils. Les tests de performance sont informatifs sur les PR et bloquants sur master. Le budget infra test (Sprint 0, 8 stories, 13 jours) garantit que l'infrastructure est prête avant le premier code métier.

3. **Pragmatisme** : le ratio test/dev de 35% est adapté à un produit B2B sécurisé sans être excessif. Les epics avec moins de surface d'attaque (Dual-Speed, Onboarding) ont un ratio plus bas (25%). La règle "jamais mocker la DB" assure que les tests reflètent le comportement réel du système.

**Volume total** : ~525 tests (300 unitaires + 205 intégration + 20 E2E) + 31 tests sécurité + 5 scénarios performance + 7 smoke tests pré-deploy.

---

*Section 7 — Stratégie de Test par Epic — Murat (Test Architect) — ~3200 mots — 14 mars 2026.*
