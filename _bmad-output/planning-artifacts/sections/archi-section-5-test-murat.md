# Section 5 — Architecture de Test & Pipeline CI/CD

> **Auteur** : Murat (Test Architect) | **Date** : 2026-03-14 | **Statut** : Final
> **Sources** : PRD B2B v1.0 (sections 7, 10), Analyse codebase existante, Vitest/Cypress/k6 best practices

---

## Table des Matières

1. [Stratégie de Test](#1-stratégie-de-test)
2. [Pipeline CI/CD](#2-pipeline-cicd)
3. [Quality Gates Automatisées](#3-quality-gates-automatisées)
4. [Stratégie de Tests de Performance](#4-stratégie-de-tests-de-performance)
5. [Infrastructure de Test](#5-infrastructure-de-test)

---

## 1. Stratégie de Test

### 1.1 Philosophie et Pyramide de Tests

La stratégie de test MnM B2B repose sur une pyramide de tests inversée par rapport aux pratiques traditionnelles. Dans un contexte d'orchestration d'agents IA multi-tenant, la **couche d'intégration est la couche la plus critique** — c'est là que se jouent l'isolation tenant, le RBAC, les workflows déterministes et la communication agent-to-agent. Les tests unitaires servent de filet de sécurité rapide ; les tests E2E valident les parcours utilisateurs complets.

```
         ┌─────────────────┐
         │    E2E (Cypress) │  ~50 scénarios — flux critiques
         │   ~15% du volume │  Login, workflow, chat, RBAC
         ├─────────────────┤
         │  Intégration      │  ~200 scénarios — routes API, RBAC,
         │  (Supertest+DB)   │  isolation tenant, WebSocket, containers
         │   ~35% du volume  │
         ├─────────────────┤
         │  Unitaires        │  ~500+ tests — logique métier pure
         │  (Vitest)         │  state machines, parsers, validators,
         │   ~50% du volume  │  permission engine, credential proxy
         └─────────────────┘
```

**Principe directeur** : Ne jamais mocker la base de données. Les tests d'intégration utilisent une vraie instance PostgreSQL avec transactions rollback. Les seuls composants mockés sont les providers LLM externes (Claude, OpenAI, etc.) et les services tiers (Docker daemon pour les tests unitaires du ContainerManager).

### 1.2 Tests Unitaires — Vitest

**Framework** : Vitest 3.x (déjà installé et configuré dans le monorepo via `vitest.config.ts` racine avec workspace projects).

**Configuration existante** : Le projet utilise déjà un workspace Vitest avec 5 projets (`packages/db`, `packages/adapters/opencode-local`, `server`, `ui`, `cli`). Il y a déjà ~55+ tests unitaires côté serveur (`server/src/__tests__/`) et ~12 côté CLI (`cli/src/__tests__/`). Les packages adapteurs ont aussi leurs propres tests (`models.test.ts`, `parse.test.ts`).

**Couverture cible** :

| Couche | Objectif couverture | Justification |
|--------|-------------------|---------------|
| `hasPermission()` / `canUser()` | ≥95% | Noyau sécurité RBAC — un trou = escalade |
| ContainerManager | ≥90% | Isolation agents — un trou = credential leak |
| Credential Proxy | ≥95% | Zero-trust — un trou = secret exposé |
| Workflow state machine | ≥90% | Déterminisme — un trou = agent en roue libre |
| Routes API (auth checks) | 100% branches | Chaque route DOIT vérifier auth+permission |
| Nouveau code (global) | ≥80% | Standard de l'industrie B2B |
| Code legacy non modifié | Pas de régression | Ne pas casser ce qui marche |

**Patterns de tests unitaires** :

```typescript
// server/src/__tests__/rbac-permission-engine.test.ts
describe('hasPermission with scope', () => {
  it('refuse accès quand scope ne contient pas le projectId', () => {
    const grant = makeGrant({
      permission: 'agent:create',
      scope: { projectIds: ['proj-1', 'proj-2'] }
    });
    expect(hasPermission(grant, 'agent:create', 'proj-999')).toBe(false);
  });

  it('autorise accès quand scope est null (company-wide)', () => {
    const grant = makeGrant({
      permission: 'agent:create',
      scope: null
    });
    expect(hasPermission(grant, 'agent:create', 'proj-999')).toBe(true);
  });

  it('bloque escalade deny > allow', () => {
    const grants = [
      makeGrant({ permission: 'agent:create', effect: 'deny' }),
      makeGrant({ permission: 'agent:create', effect: 'allow' }),
    ];
    expect(evaluateGrants(grants, 'agent:create')).toBe(false);
  });
});
```

**Organisation des fichiers tests** :

```
server/src/__tests__/
├── rbac-permission-engine.test.ts     # Tests hasPermission, canUser, scope
├── workflow-state-machine.test.ts     # Tests transitions, validations
├── container-manager.test.ts          # Tests lifecycle containers (Docker mocké)
├── credential-proxy.test.ts           # Tests injection/isolation credentials
├── drift-detector.test.ts             # Tests heuristiques drift detection
├── compaction-handler.test.ts         # Tests kill+relance, réinjection
├── audit-logger.test.ts              # Tests immutabilité, format events
├── chat-rate-limiter.test.ts          # Tests rate limiting WebSocket
├── automation-cursor.test.ts          # Tests plafond hiérarchique
└── ... (tests existants conservés)

ui/src/__tests__/
├── components/
│   ├── PermissionGate.test.tsx        # Tests masquage DOM conditionnel
│   ├── RoleSelector.test.tsx          # Tests presets de rôles
│   └── WorkflowEditor.test.tsx        # Tests drag-and-drop étapes
├── hooks/
│   ├── usePermission.test.ts          # Tests hook permission client-side
│   └── useAgentChat.test.ts           # Tests hook WebSocket reconnexion
└── utils/
    └── scope-filter.test.ts           # Tests filtrage scope côté client
```

### 1.3 Tests d'Intégration — Supertest + PostgreSQL

**Framework** : Supertest 7.x (déjà dans les devDependencies du server) + PostgreSQL de test via `embedded-postgres` (déjà utilisé) ou Docker Compose.

**Principe fondamental** : Chaque test d'intégration s'exécute dans une transaction PostgreSQL qui est **rollback à la fin du test**. Ceci garantit l'isolation entre tests sans coût de re-seeding. Le pattern utilise un `beforeEach` qui démarre une transaction et un `afterEach` qui fait rollback.

```typescript
// server/src/__tests__/integration/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres';

let testTx: ReturnType<typeof db.transaction>;

beforeEach(async () => {
  testTx = await db.transaction();
  // Injecter testTx dans le contexte de l'app Express
});

afterEach(async () => {
  await testTx.rollback();
});
```

**Scénarios d'intégration critiques** (alignés avec PRD section 10) :

| Catégorie | Tests | Priorité |
|-----------|-------|----------|
| **Isolation tenant** | Cross-company data leak (RLS), API scope enforcement, container isolation | P0 |
| **RBAC routes** | 22 fichiers routes × 4 rôles = ~88 cas d'accès. Viewer 403 sur mutation. Admin OK. | P0 |
| **Scope JSONB** | Permission avec scope `{projectIds: [...]}` respectée dans queries SQL | P0 |
| **Invitations** | Création → envoi → acceptation → membership → permissions. Expiration 7j. | P0 |
| **Workflow enforcement** | Création workflow → lancement agent → step-by-step imposé → refus saut | P0 |
| **Audit log** | Toute mutation génère un audit_event. UPDATE/DELETE bloqués par trigger. | P0 |
| **WebSocket chat** | Connexion → envoi message → réception → rate limit → reconnexion | P1 |
| **Container lifecycle** | Profil → lancement → credential proxy → exécution → cleanup | P1 |
| **Compaction** | Kill+relance → résultats intermédiaires persistés → réinjection contexte | P1 |
| **Drift detection** | Agent dévie du workflow → alerte <15min → diff attendu/observé | P1 |

**Tests RBAC exhaustifs** — Matrice d'accès :

```
Route                    | Admin | Manager | Contributor | Viewer |
POST /agents             | ✓     | ✓       | ✓ (own)     | ✗ 403  |
DELETE /agents/:id       | ✓     | ✓ (own) | ✗ 403       | ✗ 403  |
GET /agents              | ✓     | ✓       | ✓ (scoped)  | ✓ (scoped) |
PUT /workflows           | ✓     | ✓       | ✗ 403       | ✗ 403  |
GET /audit-events        | ✓     | ✓       | ✗ 403       | ✗ 403  |
POST /invites            | ✓     | ✓       | ✗ 403       | ✗ 403  |
POST /chat/messages      | ✓     | ✓       | ✓           | ✗ (read-only) |
GET /dashboard/aggregate | ✓     | ✓       | ✗ 403       | ✗ 403  |
```

Chaque cellule de cette matrice est un test d'intégration automatisé. L'objectif est la couverture 100% des combinaisons route × rôle pour les routes critiques.

### 1.4 Tests End-to-End — Cypress

**Framework** : Cypress (à installer — aucune configuration Cypress n'existe actuellement dans le projet actif ; les specs legacy dans `_legacy/web/e2e/` utilisaient Playwright et ne sont plus maintenues).

**Pourquoi Cypress** : L'écosystème React 19 + Vite est parfaitement supporté. Cypress offre le time-travel debugging essentiel pour les flux complexes multi-étapes (workflows, chat temps réel, RBAC). Le Component Testing natif permet aussi de tester les composants shadcn/ui en isolation.

**Flux E2E critiques** (35 scénarios PRD section 10.1) :

| # | Flux | Scénarios | Priorité |
|---|------|-----------|----------|
| E2E-01 | Login / Signup / Sign-out | Login valide, signup désactivé, sign-out invalide session | P0 |
| E2E-02 | Invitation + Onboarding | Admin invite → email → accept → membership → rôle assigné | P0 |
| E2E-03 | RBAC Navigation | Viewer ne voit PAS les items admin dans le DOM (pas masqué CSS) | P0 |
| E2E-04 | Workflow complet | Créer template → lancer agent → observer step-by-step → valider | P0 |
| E2E-05 | Chat WebSocket | Connecter → envoyer message → recevoir réponse → rate limit | P0 |
| E2E-06 | Drift + Intervention | Agent dévie → alerte → diff attendu/observé → action corrective | P1 |
| E2E-07 | Container lifecycle | Lancer agent containerisé → observer logs → credential proxy → stop | P1 |
| E2E-08 | Dashboard agrégé | Manager voit métriques agrégées, JAMAIS données individuelles | P1 |
| E2E-09 | Import Jira | Upload → mapping → validation → données importées | P2 |
| E2E-10 | Multi-company | Switch company → données isolées → pas de leak cross-tenant | P0 |

**Configuration Cypress** :

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Vite dev server
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false, // Activé seulement en CI
    screenshotOnRunFailure: true,
    retries: { runMode: 2, openMode: 0 },
    env: {
      API_URL: 'http://localhost:3000',
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'ui/src/**/*.cy.tsx',
  },
});
```

**Organisation Cypress** :

```
cypress/
├── e2e/
│   ├── auth/
│   │   ├── login.cy.ts
│   │   ├── signup-disabled.cy.ts
│   │   └── signout.cy.ts
│   ├── rbac/
│   │   ├── role-assignment.cy.ts
│   │   ├── navigation-masking.cy.ts
│   │   └── scope-enforcement.cy.ts
│   ├── workflow/
│   │   ├── create-template.cy.ts
│   │   ├── step-by-step-execution.cy.ts
│   │   └── drift-intervention.cy.ts
│   ├── chat/
│   │   ├── websocket-dialog.cy.ts
│   │   └── reconnection.cy.ts
│   ├── containers/
│   │   └── lifecycle.cy.ts
│   └── multi-tenant/
│       └── isolation.cy.ts
├── fixtures/
│   ├── users.json
│   ├── companies.json
│   └── workflows.json
├── support/
│   ├── commands.ts         # cy.login(), cy.createAgent(), cy.asRole()
│   └── e2e.ts
└── plugins/
    └── db-seed.ts          # Seed PostgreSQL avant les tests
```

### 1.5 Tests de Sécurité

**Framework principal** : OWASP ZAP (scan automatisé en CI) + tests manuels ciblés.

**12 catégories de tests sécurité** (alignées PRD 10.3) :

#### RBAC Bypass (3 tests)

1. **Escalade horizontale** : Envoyer un header `X-Company-Id` forgé. Le serveur DOIT utiliser uniquement le `companyId` résolu depuis la session, jamais un header client.
2. **Escalade verticale** : Token d'un viewer tente un `POST /agents`. Résultat attendu : 403 Forbidden.
3. **Injection SQL via JSONB** : Payload malicieux dans le champ `scope` (`{"projectIds": ["'; DROP TABLE users; --"]}"`). Le ORM Drizzle paramétrise les queries, mais le test vérifie que l'injection ne passe pas au niveau applicatif.

#### Container Security (3 tests)

4. **Container escape** : Mount `/etc/shadow` ou `/proc/self/environ`. L'allowlist tamper-proof DOIT refuser avec `realpath` + interdiction des symlinks.
5. **Credential proxy tampering** : Agent tente d'accéder directement aux secrets contournant le proxy. Résultat attendu : 403 + audit event.
6. **Path traversal** : `../../etc/passwd`, null bytes (`%00`), encodage URL double. Blocked par `realpath` + validation strict.

#### Input Validation (3 tests)

7. **XSS via chat** : Message contenant `<script>alert(1)</script>`, SVG avec JS, markdown malicieux. Le serveur applique UTF-8 strict + sanitization. Le client utilise React qui escape par défaut.
8. **CSRF** : Requête cross-origin sans token CSRF. SameSite=Strict sur les cookies + validation Origin/Referer.
9. **SQL injection scope** : Payloads OWASP standard dans les paramètres de query qui alimentent les filtres JSONB.

#### Auth & Session (2 tests)

10. **Session hijacking** : Token expiré ou fixé. Better Auth gère l'expiration ; le test vérifie que les sessions sont invalidées côté DB.
11. **Brute force** : >5 tentatives login en 1 minute. Rate limiting activé, réponse 429.

#### Multi-Tenant (1 test)

12. **Isolation inter-company** : Créer 2 companies avec chacune des agents, issues, workflows. Vérifier qu'aucune query ne retourne des données de l'autre company via RLS PostgreSQL + filtrage applicatif + isolation containers.

**Exécution** : Les tests sécurité OWASP ZAP tournent en mode headless dans le pipeline CI. Les tests RBAC/injection sont des tests d'intégration standards dans Vitest.

---

## 2. Pipeline CI/CD

### 2.1 Architecture du Pipeline

Le pipeline CI/CD utilise **GitHub Actions** avec une stratégie de parallélisation agressive pour maintenir un cycle de feedback rapide (<10 minutes pour le chemin critique).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PUSH / PULL REQUEST                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    QG-0 : Compile     │  ~2 min
                    │  ┌─────────────────┐  │
                    │  │ pnpm install     │  │
                    │  │ pnpm typecheck   │  │
                    │  │ ESLint           │  │
                    │  │ check:tokens     │  │
                    │  └─────────────────┘  │
                    └───────────┬───────────┘
                                │ (gate : 0 erreur)
                    ┌───────────▼───────────┐
                    │   PARALLÈLE            │
                    │                        │
        ┌───────────┤                        ├───────────┐
        │           └────────────────────────┘           │
        ▼                                                ▼
┌───────────────┐                              ┌──────────────────┐
│ QG-1 : Unit   │  ~3 min                      │ QG-2 : Integ    │  ~5 min
│ vitest run    │                              │ Supertest + PG   │
│ --coverage    │                              │ (embedded-pg)    │
│ ≥80% new code │                              │ RBAC + tenant    │
└───────┬───────┘                              └────────┬─────────┘
        │                                               │
        └───────────────────┬───────────────────────────┘
                            │ (gate : 0 failing, coverage OK)
                ┌───────────▼───────────┐
                │   QG-3 : Security     │  ~4 min
                │  ┌─────────────────┐  │
                │  │ OWASP ZAP scan  │  │
                │  │ Secret scan     │  │
                │  │ Dependency audit│  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │ (gate : 0 critique/haute)
                ┌───────────▼───────────┐
                │   Build Production    │  ~3 min
                │  ┌─────────────────┐  │
                │  │ pnpm build      │  │
                │  │ Docker image    │  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │
                ┌───────────▼───────────┐
                │   PARALLÈLE           │
        ┌───────┤                       ├───────┐
        ▼       └───────────────────────┘       ▼
┌───────────────┐                      ┌──────────────────┐
│ QG-4 : Perf   │  ~5 min             │ QG-5 : E2E      │  ~8 min
│ k6 benchmarks │                      │ Cypress          │
│ API + WS      │                      │ Flux critiques   │
└───────┬───────┘                      └────────┬─────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │ (gate : toutes métriques OK)
                ┌───────────▼───────────┐
                │   QG-6 : Review       │
                │  ┌─────────────────┐  │
                │  │ PR review req.  │  │
                │  │ Migration check │  │
                │  │ Audit log check │  │
                │  └─────────────────┘  │
                └───────────┬───────────┘
                            │ (gate : approbation humaine)
                ┌───────────▼───────────┐
                │   DEPLOY              │
                │  staging → production │
                └───────────────────────┘
```

### 2.2 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [master, 'feature/**']
  pull_request:
    branches: [master]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9.15.4'

jobs:
  # ─────────────────────────────────────
  # QG-0 : Compilation & Lint
  # ─────────────────────────────────────
  compile:
    name: QG-0 — Compile & Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: TypeScript strict check
        run: pnpm typecheck

      - name: ESLint
        run: pnpm lint

      - name: Check forbidden tokens (secrets)
        run: pnpm check:tokens

      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: |
            node_modules
            packages/*/node_modules
            server/node_modules
            ui/node_modules
            cli/node_modules
          key: deps-${{ hashFiles('pnpm-lock.yaml') }}

  # ─────────────────────────────────────
  # QG-1 : Tests Unitaires (parallèle)
  # ─────────────────────────────────────
  unit-tests:
    name: QG-1 — Tests Unitaires
    needs: compile
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run unit tests with coverage
        run: pnpm vitest run --coverage --reporter=default --reporter=junit --outputFile=junit.xml

      - name: Check coverage threshold
        run: |
          # Vérifier couverture ≥80% nouveau code
          # Utiliser vitest coverage avec c8/istanbul
          pnpm vitest run --coverage --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.branches=80

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: unit-test-results
          path: junit.xml

  # ─────────────────────────────────────
  # QG-2 : Tests Intégration (parallèle)
  # ─────────────────────────────────────
  integration-tests:
    name: QG-2 — Tests Intégration
    needs: compile
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: mnm_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mnm_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://mnm_test:test_password@localhost:5432/mnm_test
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run database migrations
        run: pnpm db:migrate

      - name: Run integration tests
        run: pnpm vitest run --project server --testPathPattern='integration'

      - name: Upload integration results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: integration-test-results
          path: junit-integration.xml

  # ─────────────────────────────────────
  # QG-3 : Tests Sécurité
  # ─────────────────────────────────────
  security:
    name: QG-3 — Sécurité
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Dependency audit
        run: pnpm audit --audit-level=high

      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

      - name: OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.14.0
        with:
          target: 'http://localhost:3000'
          cmd_options: '-a -j'
          allow_issue_writing: false
        continue-on-error: true  # Alertes informational OK

  # ─────────────────────────────────────
  # Build production
  # ─────────────────────────────────────
  build:
    name: Build Production
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Build Docker image
        run: docker build -t mnm:${{ github.sha }} .

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: |
            server/dist/
            ui/dist/

  # ─────────────────────────────────────
  # QG-4 : Tests Performance (parallèle)
  # ─────────────────────────────────────
  performance:
    name: QG-4 — Performance
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: mnm_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mnm_perf
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Start application
        run: |
          pnpm install --frozen-lockfile
          pnpm db:migrate
          pnpm dev:server &
          sleep 5

      - name: Run API benchmarks
        run: k6 run tests/performance/api-benchmark.js --out json=perf-results.json

      - name: Run WebSocket benchmarks
        run: k6 run tests/performance/websocket-benchmark.js --out json=ws-results.json

      - name: Check thresholds
        run: node tests/performance/check-thresholds.js

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: perf-results
          path: |
            perf-results.json
            ws-results.json

  # ─────────────────────────────────────
  # QG-5 : Tests E2E (parallèle)
  # ─────────────────────────────────────
  e2e:
    name: QG-5 — E2E Cypress
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: mnm_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: mnm_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run migrations & seed
        env:
          DATABASE_URL: postgresql://mnm_test:test_password@localhost:5432/mnm_e2e
        run: |
          pnpm db:migrate
          node tests/e2e/seed.js

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          start: pnpm dev
          wait-on: 'http://localhost:5173'
          wait-on-timeout: 60
          record: false
          config: video=true
        env:
          DATABASE_URL: postgresql://mnm_test:test_password@localhost:5432/mnm_e2e

      - name: Upload Cypress artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-artifacts
          path: |
            cypress/screenshots/
            cypress/videos/

  # ─────────────────────────────────────
  # Deploy (staging → production)
  # ─────────────────────────────────────
  deploy-staging:
    name: Deploy Staging
    needs: [security, performance, e2e]
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        run: echo "Deploy staging — à configurer selon l'infra choisie"

  deploy-production:
    name: Deploy Production
    needs: deploy-staging
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.mnm.dev
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: echo "Deploy production — à configurer selon l'infra choisie"

      - name: Run smoke tests
        run: |
          # 7 smoke tests obligatoires (PRD 10.5)
          node tests/smoke/run-all.js
```

### 2.3 Stratégie de Caching

Le pipeline utilise un caching agressif pour réduire les temps d'exécution :

| Élément | Clé de cache | Invalidation |
|---------|-------------|-------------|
| `node_modules` | `deps-${{ hashFiles('pnpm-lock.yaml') }}` | Changement lockfile |
| Build artifacts | `build-${{ github.sha }}` | Chaque commit |
| Cypress binary | `cypress-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` | Changement version Cypress |
| Docker layers | GitHub Container Registry cache | Changement Dockerfile |
| PostgreSQL image | Docker layer cache | Changement version PG |

**Temps pipeline estimé** :
- Chemin critique (séquentiel) : QG-0 (2min) → QG-1||QG-2 (5min) → QG-3 (4min) → Build (3min) → QG-4||QG-5 (8min) = **~22 minutes**
- Avec cache warm : **~15 minutes**

### 2.4 Environnements

| Environnement | Déclencheur | Base de données | Objectif |
|---------------|-------------|-----------------|----------|
| **Test (CI)** | Chaque push/PR | `embedded-postgres` ou service PG | Validation automatique |
| **Dev local** | `pnpm dev` | `embedded-postgres` (inclus) | Développement quotidien |
| **Staging** | Merge sur `master` | PostgreSQL dédié | Validation pré-production |
| **Production** | Approbation manuelle | PostgreSQL production (RDS/Cloud SQL) | Utilisateurs finaux |

### 2.5 Stratégie de Branches et Déploiement

```
feature/* ──PR──▶ master ──auto──▶ staging ──manual──▶ production
                    │
                    └── tags/v*.*.* ──▶ release (npm, Docker Hub)
```

- **Feature branches** : CI complet (QG-0 à QG-5) sur chaque PR
- **Master** : Déploiement automatique en staging après merge
- **Production** : Déploiement manuel après validation staging (environment protection rule)
- **Hotfix** : Branche `hotfix/*` → PR directe sur master → fast-track CI (skip perf tests si `[hotfix]` dans le message)

---

## 3. Quality Gates Automatisées

### 3.1 Définition des 7 Quality Gates

Chaque Quality Gate est un **point de décision binaire** : le pipeline avance ou s'arrête. Aucune exception, aucun override sans approbation explicite d'un admin.

#### QG-0 — Compilation & Standards

| Critère | Commande | Seuil |
|---------|----------|-------|
| TypeScript strict | `pnpm typecheck` | 0 erreur |
| ESLint | `pnpm lint` | 0 erreur (warnings OK en dev, pas en CI) |
| Secrets check | `pnpm check:tokens` | 0 token interdit détecté |
| Build | `pnpm build` | Exit code 0 |

**Rationale** : Le build TypeScript strict est la première ligne de défense. Avec `strict: true` dans tous les `tsconfig.json` (déjà le cas), les types garantissent la cohérence structurelle du code. Le check de tokens interdit (`check:tokens`) prévient la fuite accidentelle de secrets.

#### QG-1 — Tests Unitaires

| Critère | Seuil |
|---------|-------|
| Tests passants | 100% (0 failing) |
| Couverture lignes (nouveau code) | ≥80% |
| Couverture fonctions (nouveau code) | ≥80% |
| Couverture branches (nouveau code) | ≥80% |
| Couverture RBAC engine | ≥95% |
| Couverture credential proxy | ≥95% |

**Mesure du "nouveau code"** : Utilisation de `vitest --changed` avec la base `origin/master` pour ne mesurer la couverture que sur les fichiers modifiés. Les fichiers existants non modifiés ne sont pas soumis au seuil de couverture.

#### QG-2 — Tests Intégration

| Critère | Seuil |
|---------|-------|
| Routes API protégées | 100% des routes auth-required testées |
| RBAC enforcement | Matrice rôle × route complète |
| Isolation tenant | 0 data leak cross-company |
| Migrations | Toutes les migrations appliquées sans erreur |
| Transactions rollback | Tests isolés (aucun effet de bord entre tests) |

#### QG-3 — Sécurité

| Critère | Outil | Seuil |
|---------|-------|-------|
| Vulnérabilités dépendances | `pnpm audit` | 0 critique, 0 haute |
| Secrets en dur | TruffleHog | 0 secret vérifié trouvé |
| OWASP Top 10 | ZAP Baseline | 0 alerte haute/critique |
| Injection SQL | Tests intégration | Tous les payloads OWASP bloqués |
| XSS | Tests intégration + ZAP | 0 vecteur XSS non-sanitisé |

#### QG-4 — Performance

| Critère | Seuil MVP | Seuil Enterprise |
|---------|----------|-----------------|
| API latence P50 | <100ms | <50ms |
| API latence P95 | <500ms | <200ms |
| API latence P99 | <1000ms | <500ms |
| WebSocket message latence | <50ms | <20ms |
| Container démarrage | <10s | <5s |
| Dashboard chargement | <2s | <1s |
| Requêtes simultanées | 100 | 1000 |

#### QG-5 — Tests E2E

| Critère | Seuil |
|---------|-------|
| Flux critiques P0 | 100% passants |
| Flux P1 | ≥90% passants (retry 2x pour flaky) |
| Screenshots de régression | 0 différence non-approuvée |
| Temps total E2E | <20 minutes |

#### QG-6 — Review & Audit

| Critère | Vérification |
|---------|-------------|
| Code review | ≥1 approbation requise sur la PR |
| Migrations réversibles | Chaque `up()` a un `down()` correspondant |
| Audit log vérifié | Toute mutation dans la PR émet un audit event |
| Changelog | PR contient un changeset si modification visible par l'utilisateur |
| Documentation | API modifiée → OpenAPI spec mise à jour |

### 3.2 Matrice Quality Gate × Environnement

| QG | PR / Feature | Master | Staging | Production |
|----|-------------|--------|---------|-----------|
| QG-0 Compile | Obligatoire | Obligatoire | N/A | N/A |
| QG-1 Unit | Obligatoire | Obligatoire | N/A | N/A |
| QG-2 Integ | Obligatoire | Obligatoire | N/A | N/A |
| QG-3 Security | Obligatoire | Obligatoire | N/A | N/A |
| QG-4 Perf | Informational | Obligatoire | Obligatoire | N/A |
| QG-5 E2E | Obligatoire | Obligatoire | Smoke only | Smoke only |
| QG-6 Review | Obligatoire | N/A (post-merge) | Manual | Sign-off |

**"Informational" sur les PRs** : Les tests de performance ne bloquent pas une PR mais affichent les résultats en commentaire pour comparaison. Ils deviennent bloquants au merge sur master.

---

## 4. Stratégie de Tests de Performance

### 4.1 Benchmarks API — k6

**Framework** : k6 (Grafana Labs) — scriptable en JavaScript, intégration native CI, export métriques.

```javascript
// tests/performance/api-benchmark.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const apiLatency = new Trend('api_latency');
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Scénario 1 : Charge normale (MVP cible)
    normal_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
    },
    // Scénario 2 : Pic de charge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      startTime: '3m',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:agents}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:issues}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:workflows}': ['p(95)<500'],
    'http_req_duration{endpoint:audit}': ['p(95)<500'],
    'http_req_duration{endpoint:dashboard}': ['p(95)<2000'],
    errors: ['rate<0.01'],  // <1% erreurs
  },
};

export default function () {
  // GET /api/agents (liste agents, scoped par company)
  const agents = http.get(`${__ENV.BASE_URL}/api/agents`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
    tags: { endpoint: 'agents' },
  });
  check(agents, { 'agents 200': (r) => r.status === 200 });
  apiLatency.add(agents.timings.duration);

  // GET /api/issues (liste issues, scoped par projet)
  const issues = http.get(`${__ENV.BASE_URL}/api/issues`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
    tags: { endpoint: 'issues' },
  });
  check(issues, { 'issues 200': (r) => r.status === 200 });

  // POST /api/workflow-instances (création workflow)
  const workflow = http.post(`${__ENV.BASE_URL}/api/workflow-instances`,
    JSON.stringify({ templateId: __ENV.TEMPLATE_ID }),
    {
      headers: {
        Authorization: `Bearer ${__ENV.TOKEN}`,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'workflows' },
    }
  );
  check(workflow, { 'workflow 201': (r) => r.status === 201 });

  sleep(1);
}
```

**Endpoints benchmarkés** :

| Endpoint | Opération | Seuil P50 | Seuil P95 | Seuil P99 |
|----------|-----------|----------|----------|----------|
| `GET /api/agents` | Liste agents company | <50ms | <200ms | <500ms |
| `GET /api/issues` | Liste issues projet | <50ms | <200ms | <500ms |
| `POST /api/agents` | Création agent | <100ms | <300ms | <800ms |
| `POST /api/workflow-instances` | Lancement workflow | <200ms | <500ms | <1000ms |
| `GET /api/audit-events` | Query audit log | <100ms | <500ms | <1000ms |
| `GET /api/dashboard` | Dashboard agrégé | <500ms | <2000ms | <3000ms |

### 4.2 WebSocket — k6 + xk6-websocket

```javascript
// tests/performance/websocket-benchmark.js
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const wsLatency = new Trend('ws_message_latency');

export const options = {
  vus: 50,        // 50 connexions simultanées (cible MVP)
  duration: '1m',
  thresholds: {
    ws_message_latency: ['p(95)<50', 'p(99)<100'],
    ws_connecting: ['p(95)<500'],
  },
};

export default function () {
  const url = `ws://${__ENV.WS_HOST}/ws`;

  const res = ws.connect(url, { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }, (socket) => {
    socket.on('open', () => {
      // Envoyer un message de chat
      const sendTime = Date.now();
      socket.send(JSON.stringify({
        type: 'chat_message',
        channelId: __ENV.CHANNEL_ID,
        content: 'Benchmark message',
      }));

      socket.on('message', (data) => {
        const latency = Date.now() - sendTime;
        wsLatency.add(latency);
      });
    });

    socket.setTimeout(() => socket.close(), 5000);
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
}
```

**Métriques WebSocket** :

| Métrique | Seuil MVP | Seuil Enterprise |
|----------|----------|-----------------|
| Messages/seconde (par connexion) | 10 | 50 |
| Latence message P95 | <50ms | <20ms |
| Temps de reconnexion | <2s | <500ms |
| Connexions simultanées | 100 | 10 000 |
| Buffer messages en vol (reconnexion) | 30s | 30s |

### 4.3 Container — Benchmarks de Cycle de Vie

```javascript
// tests/performance/container-benchmark.js
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const containerStartTime = new Trend('container_start_time');
const containerMemory = new Trend('container_memory_mb');

export default function () {
  // Mesurer temps démarrage container
  const start = Date.now();
  const res = http.post(`${__ENV.BASE_URL}/api/containers`,
    JSON.stringify({
      profileId: __ENV.PROFILE_ID,
      agentId: __ENV.AGENT_ID,
    }),
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}`, 'Content-Type': 'application/json' } }
  );

  if (res.status === 201) {
    const containerId = JSON.parse(res.body).id;

    // Attendre que le container soit ready
    let ready = false;
    while (!ready && (Date.now() - start) < 30000) {
      const status = http.get(`${__ENV.BASE_URL}/api/containers/${containerId}/status`,
        { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
      );
      ready = JSON.parse(status.body).state === 'running';
    }

    containerStartTime.add(Date.now() - start);

    // Cleanup
    http.delete(`${__ENV.BASE_URL}/api/containers/${containerId}`,
      { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } }
    );
  }
}
```

**Métriques Container** :

| Métrique | Seuil MVP | Seuil Enterprise |
|----------|----------|-----------------|
| Temps démarrage cold | <10s | <5s |
| Temps démarrage warm (image cached) | <3s | <2s |
| Overhead mémoire par container | <256MB | <128MB |
| Temps cleanup (--rm) | <2s | <1s |
| Containers simultanés par instance | 20 | 500 |

### 4.4 Base de Données — Monitoring Queries

**Outil** : `pg_stat_statements` + script d'analyse automatisé.

| Métrique | Seuil | Action si dépassé |
|----------|-------|-------------------|
| Queries >100ms | <5% du total | EXPLAIN ANALYZE + index candidat |
| Queries >1s | 0% | Alerte immédiate + optimisation |
| Index coverage (tables critiques) | >95% | CREATE INDEX pour queries manquantes |
| Seq scans sur tables >10k rows | 0 | Ajout index obligatoire |
| Connexions pool | <80% max_connections | Alerter si >80% |

**Tables critiques à monitorer** :

```sql
-- Script monitoring queries lentes
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 4.5 Load Testing — Scénarios Utilisateurs

| Scénario | Users | Agents | Durée | Métriques clés |
|----------|-------|--------|-------|---------------|
| **MVP normal** | 50 users | 20 agents | 5min | API P95, WS latence, DB queries |
| **MVP peak** | 100 users | 50 agents | 2min | Erreur rate, temps réponse dégradation |
| **Enterprise steady** | 500 users | 200 agents | 10min | CPU/RAM, connexions pool, GC pauses |
| **Enterprise burst** | 1000 users | 500 agents | 1min | Saturation, queue depth, auto-scaling |
| **Soak test** | 50 users | 20 agents | 2h | Memory leaks, connexion leaks, DB bloat |

---

## 5. Infrastructure de Test

### 5.1 Test Fixtures — Factories

**Pattern** : Factory functions avec des valeurs par défaut sensibles et des overrides typés.

```typescript
// tests/factories/index.ts
import { randomUUID } from 'crypto';

export function createUser(overrides?: Partial<User>): User {
  return {
    id: randomUUID(),
    email: `user-${randomUUID().slice(0, 8)}@test.mnm.dev`,
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createCompany(overrides?: Partial<Company>): Company {
  return {
    id: randomUUID(),
    name: `Company ${randomUUID().slice(0, 6)}`,
    slug: `company-${randomUUID().slice(0, 6)}`,
    tier: 'team',
    maxUsers: 50,
    ssoEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: randomUUID(),
    companyId: randomUUID(),
    name: 'Test Agent',
    role: 'developer',
    status: 'idle',
    adapterType: 'claude_local',
    containerProfileId: null,
    isolationMode: 'process',
    ...overrides,
  };
}

export function createWorkflowTemplate(overrides?: Partial<WorkflowTemplate>): WorkflowTemplate {
  return {
    id: randomUUID(),
    companyId: randomUUID(),
    name: 'Test Workflow',
    steps: [
      { id: 'step-1', name: 'Analyse', requiredFiles: ['spec.md'], prompt: 'Analyse le spec' },
      { id: 'step-2', name: 'Implémentation', requiredFiles: [], prompt: 'Implémente' },
      { id: 'step-3', name: 'Tests', requiredFiles: [], prompt: 'Écris les tests' },
    ],
    autoTransition: false,
    ...overrides,
  };
}

export function createMembership(overrides?: Partial<CompanyMembership>): CompanyMembership {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    companyId: randomUUID(),
    businessRole: 'contributor',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createPermissionGrant(overrides?: Partial<PermissionGrant>): PermissionGrant {
  return {
    id: randomUUID(),
    principalType: 'user',
    principalId: randomUUID(),
    permission: 'agent:read',
    effect: 'allow',
    scope: null,  // null = company-wide
    ...overrides,
  };
}
```

### 5.2 Database Seeding

**Seed de test cohérent** : Un jeu de données standard pour les tests E2E et d'intégration qui représente un cas d'usage réel MnM.

```typescript
// tests/seed/e2e-seed.ts
export async function seedE2EData(db: Database) {
  // Company Alpha (primary test company)
  const companyAlpha = await db.insert(companies).values(
    createCompany({ name: 'Alpha Corp', tier: 'team', maxUsers: 50 })
  ).returning();

  // Company Beta (for isolation tests)
  const companyBeta = await db.insert(companies).values(
    createCompany({ name: 'Beta Inc', tier: 'team', maxUsers: 10 })
  ).returning();

  // Users avec différents rôles
  const adminUser = await createAndInsertUser(db, {
    email: 'admin@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'admin',
  });

  const managerUser = await createAndInsertUser(db, {
    email: 'manager@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'manager',
  });

  const contributorUser = await createAndInsertUser(db, {
    email: 'contributor@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'contributor',
  });

  const viewerUser = await createAndInsertUser(db, {
    email: 'viewer@alpha.test',
    companyId: companyAlpha[0].id,
    businessRole: 'viewer',
  });

  // User dans Beta (pour tests isolation)
  const betaUser = await createAndInsertUser(db, {
    email: 'user@beta.test',
    companyId: companyBeta[0].id,
    businessRole: 'admin',
  });

  // Projet avec scoping
  const project = await db.insert(projects).values({
    id: randomUUID(),
    companyId: companyAlpha[0].id,
    name: 'Projet Test',
    slug: 'projet-test',
  }).returning();

  // Agents (2 dans Alpha, 1 dans Beta)
  const agentAlpha = await db.insert(agents).values(
    createAgent({
      companyId: companyAlpha[0].id,
      name: 'Agent Dev Alpha',
      role: 'developer',
    })
  ).returning();

  const agentBeta = await db.insert(agents).values(
    createAgent({
      companyId: companyBeta[0].id,
      name: 'Agent Dev Beta',
      role: 'developer',
    })
  ).returning();

  // Workflow template
  const template = await db.insert(workflowTemplates).values(
    createWorkflowTemplate({ companyId: companyAlpha[0].id })
  ).returning();

  // Permissions avec scope
  await db.insert(principalPermissionGrants).values([
    createPermissionGrant({
      principalId: contributorUser.id,
      permission: 'agent:create',
      scope: { projectIds: [project[0].id] },
    }),
  ]);

  return {
    companies: { alpha: companyAlpha[0], beta: companyBeta[0] },
    users: { admin: adminUser, manager: managerUser, contributor: contributorUser, viewer: viewerUser, beta: betaUser },
    projects: { test: project[0] },
    agents: { alpha: agentAlpha[0], beta: agentBeta[0] },
    templates: { default: template[0] },
  };
}
```

### 5.3 Mock Strategy

**Règle fondamentale** : Mocker les services externes, JAMAIS la base de données.

| Composant | Stratégie | Justification |
|-----------|-----------|---------------|
| **PostgreSQL** | Vrai DB (embedded-postgres ou Docker service) | L'isolation tenant, le RBAC avec scope JSONB, les triggers audit — tout passe par la DB. Mocker = fausse confiance. |
| **LLM Providers** (Claude, OpenAI) | Mock complet via `vi.mock()` | Les appels LLM sont lents, coûteux, non-déterministes. Le mock retourne des réponses fixes pour les tests de workflow et drift. |
| **Docker daemon** | Mock pour tests unitaires, vrai Docker pour tests intégration | Les tests unitaires du ContainerManager vérifient la logique (allowlist, profils). Les tests intégration vérifient le cycle de vie réel. |
| **WebSocket** | Vrai serveur WS en test intégration, mock client pour tests unitaires UI | La reconnexion, le buffer 30s, le rate limiting ne peuvent être testés qu'avec un vrai serveur WS. |
| **Email (invitations)** | Mock SMTP (nodemailer-mock ou similaire) | Vérifier que les emails sont envoyés avec le bon contenu sans envoyer réellement. |
| **Services tiers (Jira, Linear)** | Mock HTTP via `msw` (Mock Service Worker) | Tester les flows d'import sans dépendance réseau. |

```typescript
// tests/mocks/llm-provider.ts
import { vi } from 'vitest';

export const mockLLMProvider = {
  generateSummary: vi.fn().mockResolvedValue({
    summary: 'L\'agent a complété l\'étape d\'analyse avec succès.',
    confidence: 0.95,
    tokens: { input: 1500, output: 200 },
  }),
  detectDrift: vi.fn().mockResolvedValue({
    isDrifting: false,
    deviation: 0.05,
    details: null,
  }),
};
```

### 5.4 Test Containers — Docker Compose

```yaml
# docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: mnm_test
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: mnm_test
    ports:
      - "5433:5432"  # Port différent pour ne pas confliter avec le dev
    tmpfs:
      - /var/lib/postgresql/data  # RAM pour la vitesse
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mnm_test"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Pour les tests de containerisation réelle
  dind:
    image: docker:24-dind
    privileged: true
    environment:
      DOCKER_TLS_CERTDIR: ""
    ports:
      - "2376:2376"
```

**Utilisation en local** :

```bash
# Démarrer l'infra de test
docker compose -f docker-compose.test.yml up -d

# Lancer les tests d'intégration
DATABASE_URL=postgresql://mnm_test:test_password@localhost:5433/mnm_test pnpm vitest run --project server --testPathPattern='integration'

# Arrêter
docker compose -f docker-compose.test.yml down
```

### 5.5 Organisation Complète des Fichiers de Test

```
mnm/
├── tests/
│   ├── factories/              # Factories partagées
│   │   ├── index.ts
│   │   ├── user.factory.ts
│   │   ├── company.factory.ts
│   │   ├── agent.factory.ts
│   │   └── workflow.factory.ts
│   ├── seed/                   # Données de seed
│   │   ├── e2e-seed.ts
│   │   └── perf-seed.ts
│   ├── mocks/                  # Mocks partagés
│   │   ├── llm-provider.ts
│   │   ├── docker-daemon.ts
│   │   └── email-service.ts
│   ├── helpers/                # Utilitaires de test
│   │   ├── db-transaction.ts   # Setup transaction rollback
│   │   ├── auth-helpers.ts     # createSession(), loginAs()
│   │   └── ws-helpers.ts       # connectWebSocket(), waitForMessage()
│   ├── performance/            # Scripts k6
│   │   ├── api-benchmark.js
│   │   ├── websocket-benchmark.js
│   │   ├── container-benchmark.js
│   │   └── check-thresholds.js
│   ├── smoke/                  # Smoke tests pré-deploy
│   │   ├── run-all.js
│   │   ├── auth.smoke.ts
│   │   ├── agent-workflow.smoke.ts
│   │   ├── websocket.smoke.ts
│   │   ├── rbac.smoke.ts
│   │   ├── container.smoke.ts
│   │   ├── credential-proxy.smoke.ts
│   │   └── tenant-isolation.smoke.ts
│   └── security/               # Tests sécurité OWASP
│       ├── rbac-bypass.test.ts
│       ├── container-escape.test.ts
│       ├── input-validation.test.ts
│       └── session-security.test.ts
├── cypress/                    # Tests E2E
│   ├── e2e/
│   │   ├── auth/
│   │   ├── rbac/
│   │   ├── workflow/
│   │   ├── chat/
│   │   ├── containers/
│   │   └── multi-tenant/
│   ├── fixtures/
│   ├── support/
│   └── plugins/
├── server/src/__tests__/       # Tests unitaires serveur (existants + nouveaux)
├── ui/src/__tests__/           # Tests unitaires UI
├── cli/src/__tests__/          # Tests unitaires CLI (existants)
├── packages/*/                 # Tests par package
├── docker-compose.test.yml     # Infra de test
├── cypress.config.ts           # Config Cypress
└── vitest.config.ts            # Config Vitest workspace (existant)
```

### 5.6 Scripts npm Additionnels

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:unit": "vitest run --testPathPattern='__tests__'",
    "test:integration": "vitest run --project server --testPathPattern='integration'",
    "test:coverage": "vitest run --coverage",
    "test:security": "vitest run --testPathPattern='security'",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:perf": "k6 run tests/performance/api-benchmark.js",
    "test:perf:ws": "k6 run tests/performance/websocket-benchmark.js",
    "test:smoke": "node tests/smoke/run-all.js",
    "test:ci": "pnpm test:run && pnpm test:integration && pnpm test:security",
    "test:all": "pnpm test:ci && pnpm test:e2e && pnpm test:perf"
  }
}
```

### 5.7 Smoke Tests Pré-Deploy (7 obligatoires)

Les 7 smoke tests du PRD 10.5 sont automatisés et exécutés après chaque déploiement staging et production :

| # | Smoke Test | Vérification | Timeout |
|---|-----------|-------------|---------|
| 1 | Login/signup/sign-out | Créer compte → login → vérifier session → sign-out → session invalide | 30s |
| 2 | Création agent + workflow | Créer agent → lancer workflow → vérifier step 1 actif | 60s |
| 3 | WebSocket chat | Connexion WS → envoyer message → recevoir ACK | 15s |
| 4 | RBAC viewer restriction | Login viewer → tenter POST /agents → vérifier 403 | 15s |
| 5 | Container lifecycle | Lancer container → vérifier running → arrêter → vérifier cleanup | 30s |
| 6 | Credential proxy | Requête valide → credential injectée. Requête directe → 403 | 15s |
| 7 | Isolation tenant | Login company A → query agents → 0 agent company B visible | 15s |

---

## Annexe A — Métriques Récapitulatives

| Dimension | Valeur cible |
|-----------|-------------|
| Nombre total de tests (estimé) | ~750 (500 unit + 200 integ + 50 E2E) |
| Couverture globale nouveau code | ≥80% |
| Couverture modules critiques (RBAC, proxy, containers) | ≥90-95% |
| Temps pipeline CI complet | <22 min (cache froid), <15 min (cache chaud) |
| Temps feedback unitaires (PR) | <5 min |
| Tests de sécurité automatisés | 12 catégories, ~30 tests |
| Tests de performance automatisés | 5 scénarios k6 |
| Smoke tests pré-deploy | 7 obligatoires |

## Annexe B — Priorisation d'Implémentation

| Phase | Actions | Effort estimé |
|-------|---------|---------------|
| **Phase 1 (Semaine 1-2)** | Configurer GitHub Actions QG-0/QG-1, écrire factories, setup test DB, premiers tests RBAC | 3-4 jours |
| **Phase 2 (Semaine 3-4)** | Tests intégration routes, matrice RBAC, isolation tenant, QG-2/QG-3 | 3-4 jours |
| **Phase 3 (Semaine 5-6)** | Installer Cypress, E2E flux critiques, QG-5 | 3-4 jours |
| **Phase 4 (Semaine 7-8)** | k6 benchmarks, QG-4, smoke tests, OWASP ZAP | 2-3 jours |
| **Continu** | Tests de régression à chaque nouvelle feature | Intégré au workflow dev |

---

*Section 5 Architecture de Test & CI/CD — ~3200 mots — Murat (Test Architect)*
*Alignée avec PRD B2B v1.0 sections 7 (NFRs, Quality Gates) et 10 (Stratégie de Test)*
