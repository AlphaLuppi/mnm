# TECH-08 — CI/CD Pipeline GitHub Actions

> **Epic** : TECH (Infrastructure & Setup)
> **Sprint** : 0 (Infrastructure)
> **Priorite** : MUST-HAVE
> **Effort** : L (8 SP, 5-7j)
> **Assignation** : Cofondateur
> **Bloque par** : TECH-01 (PostgreSQL), TECH-02 (Docker Compose)
> **Debloque** : Qualite code, deploiement, protection branches

---

## Contexte

MnM est un monorepo pnpm avec 69 stories B2B implementees. Le projet a besoin d'un pipeline CI/CD GitHub Actions complet pour garantir la qualite du code a chaque push et PR. Le pipeline suit l'architecture documentee dans `architecture-b2b.md` section 9.2 avec 7 Quality Gates (QG-0 a QG-6).

### Stack technique
- **Monorepo** : pnpm 9.15.4, Node >= 20
- **Backend** : Express + TypeScript + Drizzle ORM
- **Frontend** : React 18 + Vite + Tailwind
- **DB** : PostgreSQL 17 + Redis 7
- **Tests** : Vitest (unit), Playwright (E2E)
- **Build** : tsc (server), vite build (ui)
- **Docker** : Dockerfile multi-stage, docker-compose.yml (prod), docker-compose.dev.yml, docker-compose.test.yml

---

## Acceptance Criteria

### AC1 — CI workflow on push/PR
Given un push sur une branche ou une PR ouverte
When la pipeline CI s'execute
Then les Quality Gates QG-0 (lint+typecheck) et QG-1 (unit tests) passent en < 5 min

### AC2 — Merge blocking on failure
Given un test qui echoue dans la pipeline
When la PR est reviewee
Then le merge est bloque automatiquement (required status checks)

### AC3 — Full pipeline duration
Given le caching pnpm + Docker layers
When la pipeline complete s'execute
Then la duree totale est < 22 min

### AC4 — QG-0: Lint + TypeScript
Given le code source
When QG-0 s'execute
Then typecheck passe sur tous les packages (pnpm typecheck)
And le check des forbidden tokens passe (pnpm check:tokens)

### AC5 — QG-1: Unit tests
Given les tests unitaires
When QG-1 s'execute
Then vitest run passe avec couverture

### AC6 — QG-2: Integration tests
Given docker-compose.test.yml
When QG-2 s'execute
Then PostgreSQL + Redis sont demarres
And les tests d'integration passent

### AC7 — QG-5: E2E tests
Given le serveur MnM
When QG-5 s'execute
Then Playwright tests passent
And les artifacts (screenshots, traces) sont uploades

### AC8 — Docker build validation
Given le Dockerfile
When la pipeline s'execute
Then l'image Docker se build sans erreur
And le build est cache entre les runs

### AC9 — Deploy workflow
Given un merge sur master
When le deploy workflow se declenche
Then l'image Docker est buildee et taguee
And le deploy peut etre declenche manuellement (manual approval)

### AC10 — Dependency caching
Given pnpm store + Docker layers
When les caches sont presents
Then le temps d'installation est reduit de > 50%

### AC11 — Branch protection recommendation
Given le workflow CI
When il est configure
Then un fichier documenta les branch protection rules recommandees

### AC12 — Dockerfile optimise
Given le Dockerfile existant
When il est utilise en CI
Then le build multi-stage est optimise avec cache mounts

---

## Deliverables

### D1 — `.github/workflows/ci.yml`
Pipeline CI principale declenchee sur push et PR.

**Quality Gates** :
- **QG-0** : TypeScript check + forbidden tokens check
- **QG-1** : Vitest unit tests
- **QG-2** : Integration tests (avec docker-compose.test.yml)
- **QG-5** : Playwright E2E tests

**Markers** : `tech-08-ci-workflow`

### D2 — `.github/workflows/deploy.yml`
Pipeline de deploy declenchee sur merge dans master.

- Build Docker image
- Tag avec SHA + latest
- Manual approval gate pour production

**Markers** : `tech-08-deploy-workflow`

### D3 — `.github/workflows/security.yml`
Scan de securite periodique (schedule: weekly).

- Dependency audit (pnpm audit)
- CodeQL analysis (optionnel, si disponible)

**Markers** : `tech-08-security-workflow`

### D4 — `.github/dependabot.yml`
Configuration Dependabot pour les mises a jour automatiques.

**Markers** : `tech-08-dependabot-config`

### D5 — Dockerfile CI-optimized
Optimisation du Dockerfile existant pour CI :
- Cache mounts pour pnpm store
- BuildKit enabled
- Layer ordering optimise

**Markers** : `tech-08-dockerfile-optimized`

---

## Data-test-id Mapping

| Element | data-testid |
|---------|-------------|
| CI workflow file | `tech-08-ci-workflow` |
| Deploy workflow file | `tech-08-deploy-workflow` |
| Security workflow file | `tech-08-security-workflow` |
| Dependabot config | `tech-08-dependabot-config` |
| Dockerfile optimized | `tech-08-dockerfile-optimized` |
| QG-0 typecheck job | `tech-08-qg0-typecheck` |
| QG-1 unit test job | `tech-08-qg1-unit` |
| QG-2 integration job | `tech-08-qg2-integration` |
| QG-5 E2E job | `tech-08-qg5-e2e` |
| Docker build job | `tech-08-docker-build` |
| Deploy job | `tech-08-deploy-job` |
| pnpm cache step | `tech-08-pnpm-cache` |
| Node setup step | `tech-08-node-setup` |
| Playwright cache step | `tech-08-playwright-cache` |

---

## Test Cases (file-content based)

| ID | Description | Type |
|----|-------------|------|
| T01 | CI workflow file exists | file-exists |
| T02 | CI workflow triggers on push and pull_request | content |
| T03 | CI workflow uses pnpm/action-setup | content |
| T04 | CI workflow uses actions/setup-node with cache | content |
| T05 | CI workflow has QG-0 typecheck job | content |
| T06 | QG-0 runs pnpm typecheck | content |
| T07 | QG-0 runs check:tokens | content |
| T08 | CI workflow has QG-1 unit test job | content |
| T09 | QG-1 runs vitest | content |
| T10 | CI workflow has QG-2 integration job | content |
| T11 | QG-2 uses docker-compose.test.yml services | content |
| T12 | QG-2 sets DATABASE_URL for test DB | content |
| T13 | CI workflow has QG-5 E2E job | content |
| T14 | QG-5 installs Playwright browsers | content |
| T15 | QG-5 runs playwright test | content |
| T16 | QG-5 uploads test artifacts | content |
| T17 | CI workflow has Docker build job | content |
| T18 | Docker build uses docker/build-push-action or equivalent | content |
| T19 | Deploy workflow file exists | file-exists |
| T20 | Deploy workflow triggers on push to master | content |
| T21 | Deploy workflow has build+tag job | content |
| T22 | Deploy workflow uses environment protection | content |
| T23 | Security workflow file exists | file-exists |
| T24 | Security workflow runs on schedule (weekly) | content |
| T25 | Security workflow runs pnpm audit | content |
| T26 | Dependabot config file exists | file-exists |
| T27 | Dependabot config covers npm ecosystem | content |
| T28 | Dependabot config covers github-actions ecosystem | content |
| T29 | Dockerfile has multi-stage build | content |
| T30 | Dockerfile has DOCKER_BUILDKIT or cache mount hints | content |
| T31 | CI workflow sets concurrency to cancel stale runs | content |
| T32 | CI workflow has pnpm store cache | content |
| T33 | CI workflow specifies node version >= 20 | content |
| T34 | E2E job depends on QG-1 (unit) passing | content |
| T35 | CI workflow has tech-08 markers in comments | content |

---

## Architecture Notes

### Pipeline Flow (from architecture-b2b.md section 9.2)
```
Push -> QG-0 (Lint+TypeScript) -> QG-1 (Unit) -+-> QG-2 (Integration)
                                                +-> QG-5 (E2E)
                                                    -> Docker Build -> Deploy
```

### Caching Strategy
- **pnpm store** : actions/cache avec `pnpm store path` comme key
- **Docker layers** : docker/build-push-action avec cache-from/cache-to
- **Playwright browsers** : cache basee sur playwright version

### Environments
- **CI** : docker-compose.test.yml (ephemeral PostgreSQL + Redis)
- **Deploy** : docker-compose.yml (production stack)

---

*TECH-08 v1.0 — 12 ACs, 5 deliverables, 14 data-testid, 35 test cases*
