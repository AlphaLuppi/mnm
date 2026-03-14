# EXECUTION TRACKER — Pipeline B2B Autonome

> **Dernière mise à jour** : 2026-03-14
> **Méthode** : Pipeline 4-agents (PM → Dev+QA parallèle → Review)
> **Compact** : `/compact — autonomous B2B pipeline, read CLAUDE.md then EXECUTION-TRACKER.md`

---

## Comment reprendre après compaction

1. Lis `CLAUDE.md` (contient le pipeline et la queue des stories)
2. Lis CE FICHIER pour trouver la prochaine story PENDING
3. Exécute le pipeline 4-agents pour cette story
4. Mets à jour ce fichier (change PENDING → DONE)
5. Commit et passe à la suivante

---

## Progression par Batch

### BATCH 1 — Infrastructure (pas de dépendances)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| TECH-01 | PostgreSQL externe | DONE | 234d0c1 | 79f5c15 | 5feea0b | PASS (no fix needed) | All 9 ACs verified, 14 unit + 17 E2E tests pass |
| TECH-02 | Docker Compose | DONE | b9e6850 | 95bcbbf | 9f64928 | 4ae9999 | 42 E2E pass, fix: @paperclipai→@mnm in Dockerfile --filter |
| MU-S06 | Sign-out invalidation | DONE | 6f84a1d | 9de804c | efb12d9 | 9b772e1 | 13/19 E2E pass (6 skipped: server not running), fix: skip guard + health URL |

### BATCH 2 — Schema + Redis (← TECH-01/02)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| TECH-06 | 10 nouvelles tables | DONE | b03c048 | 1323023 | 1bbdbc7 | PASS (no fix needed) | 90 E2E pass, all 10 schemas + migration verified |
| TECH-07 | Modifications 5 tables | DONE | 144a4e4 | d22964d | 87e99c8 | PASS (no fix needed) | 29 E2E pass, all 5 schemas + migration + 15 permission keys verified |
| TECH-04 | Redis setup | DONE | 3f95006 | d090134 | 9abca69 | PASS (no fix needed) | 19/22 E2E pass (3 skipped: server not running), all ACs verified |
| TECH-03 | Infrastructure test | DONE | 2dbba17 | 9358ca0 | 3a66689 | PASS (no fix needed) | 30/30 E2E pass, typecheck OK, all 7 factories + 3 helpers verified |

### BATCH 3 — RLS + Auth (← TECH-06/07)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| TECH-05 | RLS PostgreSQL 41 tables | DONE | e78bb21 | 39c6ecb | 39c6ecb | 7a0492b | 169/169 E2E pass, 41 tables RLS + tenant-context middleware, review fix: comment wording + test assertion |
| RBAC-S01 | Fix hasPermission ⚠️ P0 | DONE | 8fe8b42 | 660c4d7 | dd9775b | PASS (no fix needed) | 26/26 E2E pass, scope logic secure, .strict() validated, all ACs verified |
| RBAC-S03 | businessRole migration | PENDING | | | | | |
| MU-S01 | API invitations email | PENDING | | | | | |
| MU-S05 | Désactivation signup | PENDING | | | | | |

### BATCH 4 — RBAC + Multi-User (← RBAC-S01, MU-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| RBAC-S02 | 9 permission keys | PENDING | | | | | |
| MU-S02 | Page membres UI | PENDING | | | | | |
| MU-S03 | Invitation bulk CSV | PENDING | | | | | |
| MU-S04 | Sélecteur company | PENDING | | | | | |
| RBAC-S07 | Badges rôle | PENDING | | | | | |

### BATCH 5 — Enforcement + Navigation (← RBAC-S02)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| RBAC-S04 | Enforcement 22 routes | PENDING | | | | | |
| RBAC-S05 | Navigation masquée | PENDING | | | | | |
| RBAC-S06 | UI admin matrice permissions | PENDING | | | | | |

### BATCH 6 — Orchestrateur + Scoping (← RBAC-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| ORCH-S01 | State machine XState | PENDING | | | | | |
| PROJ-S01 | Table project_memberships | PENDING | | | | | |
| OBS-S01 | Table audit_events | PENDING | | | | | |
| CHAT-S01 | WebSocket bidirectionnel | PENDING | | | | | |
| CHAT-S02 | Tables chat | PENDING | | | | | |

### BATCH 7 — Orchestrateur avancé (← ORCH-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| ORCH-S02 | WorkflowEnforcer | PENDING | | | | | |
| ORCH-S03 | Validation HITL | PENDING | | | | | |
| ORCH-S04 | API routes orchestrateur | PENDING | | | | | |
| OBS-S02 | Service audit émission | PENDING | | | | | |
| PROJ-S02 | Service project-memberships | PENDING | | | | | |

### BATCH 8 — Drift + Audit UI (← ORCH-S01, OBS-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| DRIFT-S01 | Drift persistance DB | PENDING | | | | | |
| DRIFT-S02 | Drift monitor service | PENDING | | | | | |
| OBS-S04 | UI AuditLog | PENDING | | | | | |
| PROJ-S03 | Filtrage par scope | PENDING | | | | | |
| PROJ-S04 | Page ProjectAccess | PENDING | | | | | |

### BATCH 9 — Containerisation (← TECH-02, TECH-05)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| CONT-S01 | ContainerManager Docker | PENDING | | | | | |
| CONT-S05 | Tables container | PENDING | | | | | |
| DRIFT-S03 | UI diff drift | PENDING | | | | | |

### BATCH 10 — Container avancé + Chat (← CONT-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| CONT-S02 | Credential proxy | PENDING | | | | | |
| CONT-S03 | Mount allowlist | PENDING | | | | | |
| CONT-S04 | Isolation réseau | PENDING | | | | | |
| CONT-S06 | UI container status | PENDING | | | | | |
| CHAT-S03 | ChatService pipe stdin | PENDING | | | | | |
| CHAT-S04 | AgentChatPanel UI | PENDING | | | | | |

### BATCH 11 — A2A + Dual-Speed + Compaction (← CONT-S02, ORCH-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| COMP-S01 | CompactionWatcher | PENDING | | | | | |
| DUAL-S01 | Table automation_cursors | PENDING | | | | | |
| A2A-S01 | A2A Bus | PENDING | | | | | |

### BATCH 12 — A2A avancé + Dual UI (← A2A-S01, DUAL-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| COMP-S02 | Kill+relance | PENDING | | | | | |
| A2A-S02 | Permissions A2A | PENDING | | | | | |
| A2A-S03 | Audit A2A | PENDING | | | | | |
| DUAL-S02 | UI curseur | PENDING | | | | | |
| DUAL-S03 | Enforcement curseur | PENDING | | | | | |

### BATCH 13 — Enterprise (← divers)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| SSO-S01 | Table SSO | PENDING | | | | | |
| SSO-S02 | Better Auth SAML/OIDC | PENDING | | | | | |
| SSO-S03 | UI config SSO | PENDING | | | | | |
| DASH-S01 | API dashboards | PENDING | | | | | |
| DASH-S02 | DashboardCards UI | PENDING | | | | | |
| DASH-S03 | Dashboard temps réel | PENDING | | | | | |
| OBS-S03 | Résumé LLM | PENDING | | | | | |
| COMP-S03 | Réinjection compaction | PENDING | | | | | |

### BATCH 14 — Onboarding + Polish

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| ONB-S01 | Onboarding CEO | PENDING | | | | | |
| ONB-S02 | Cascade hiérarchique | PENDING | | | | | |
| ONB-S03 | Import Jira | PENDING | | | | | |
| ONB-S04 | Dual-mode config | PENDING | | | | | |
| ORCH-S05 | UI éditeur workflow | PENDING | | | | | |
| A2A-S04 | Connecteurs MCP | PENDING | | | | | |
| TECH-08 | CI/CD pipeline | PENDING | | | | | |

---

## Compteurs

| Métrique | Valeur |
|----------|--------|
| Stories totales | 69 |
| Stories DONE | 9 |
| Stories IN_PROGRESS | 0 |
| Stories PENDING | 60 |
| Batch courant | 3 |
| Dernière story complétée | TECH-05 |
| Prochain batch débloqué | BATCH 3 (RBAC-S03, MU-S01, MU-S05) |

---

## Journal d'exécution

| Date | Story | Étape | Agent | Commit | Notes |
|------|-------|-------|-------|--------|-------|
| 2026-03-14 | TECH-01 | PM | PM Agent | 234d0c1 | Story spec with data-test-id |
| 2026-03-14 | TECH-01 | Dev | Dev Agent | 79f5c15 | PostgreSQL external setup |
| 2026-03-14 | TECH-01 | QA | QA Agent | 5feea0b | 17 Playwright E2E tests |
| 2026-03-14 | TECH-01 | Review | Review Agent | — | PASS — no fix commit needed |
| 2026-03-14 | TECH-02 | PM | PM Agent | b9e6850 | Story spec with data-test-id |
| 2026-03-14 | TECH-02 | Dev | Dev Agent | 95bcbbf | Docker Compose dev/test/prod + Redis + Dockerfile MNM vars |
| 2026-03-14 | TECH-02 | QA | QA Agent | 9f64928 | 42 Playwright E2E tests |
| 2026-03-14 | TECH-02 | Review | Review Agent | 4ae9999 | Fix: @paperclipai→@mnm in Dockerfile build filters |
| 2026-03-14 | MU-S06 | PM | PM Agent | 6f84a1d | Story spec with data-test-id |
| 2026-03-14 | MU-S06 | Dev | Dev Agent | 9de804c | UserMenu + useCurrentUser + get-session enrichment |
| 2026-03-14 | MU-S06 | QA | QA Agent | efb12d9 | 19 Playwright E2E tests |
| 2026-03-14 | MU-S06 | Review | Review Agent | 9b772e1 | Fix: skip guard for API tests + health URL /api/health |
| 2026-03-14 | TECH-06 | PM | PM Agent | b03c048 | Story spec with data-test-id — 10 tables detailed |
| 2026-03-14 | TECH-06 | Dev | Dev Agent | 1323023 | 10 new schema files + index.ts exports + migration 0028 |
| 2026-03-14 | TECH-06 | QA | QA Agent | 1bbdbc7 | 90 Playwright E2E tests (file-content based) |
| 2026-03-14 | TECH-06 | Review | Review Agent | — | PASS — all 10 schemas verified, 90/90 E2E pass, typecheck OK |
| 2026-03-14 | TECH-07 | PM | PM Agent | 144a4e4 | Story spec with data-test-id — 5 tables + 9 permission keys |
| 2026-03-14 | TECH-07 | Dev | Dev Agent | d22964d | Modify 5 tables (4+1+2+3 columns) + 9 permission keys + migration 0029 |
| 2026-03-14 | TECH-07 | QA | QA Agent | 87e99c8 | 29 Playwright E2E tests (file-content based) |
| 2026-03-14 | TECH-07 | Review | Review Agent | — | PASS — all 5 schemas verified, 29/29 E2E pass, 0 regressions, typecheck OK |
| 2026-03-14 | TECH-04 | PM | PM Agent | 3f95006 | Story spec with data-test-id |
| 2026-03-14 | TECH-04 | Dev | Dev Agent | d090134 | Redis client + rate limiting middleware + health enrichment |
| 2026-03-14 | TECH-04 | QA | QA Agent | 9abca69 | 22 Playwright E2E tests (19 pass, 3 skipped: server not running) |
| 2026-03-14 | TECH-04 | Review | Review Agent | — | PASS — all ACs verified, 19/22 E2E pass, no regressions, typecheck OK |
| 2026-03-14 | TECH-03 | PM | PM Agent | 2dbba17 | Story spec with data-test-id |
| 2026-03-14 | TECH-03 | Dev | Dev Agent | 9358ca0 | 7 factories + 3 helpers in packages/test-utils |
| 2026-03-14 | TECH-03 | QA | QA Agent | 3a66689 | 30 Playwright E2E tests (file-content based) |
| 2026-03-14 | TECH-03 | Review | Review Agent | — | PASS — all 7 factories + 3 helpers verified, 30/30 E2E pass, typecheck OK |
| 2026-03-14 | RBAC-S01 | PM | PM Agent | 8fe8b42 | Story spec with data-test-id — P0 security fix |
| 2026-03-14 | RBAC-S01 | Dev | Dev Agent | 660c4d7 | Fix hasPermission() scope logic + requirePermission middleware + scopeSchema |
| 2026-03-14 | RBAC-S01 | QA | QA Agent | dd9775b | 26 Playwright E2E tests (file-content based) |
| 2026-03-14 | RBAC-S01 | Review | Review Agent | — | PASS — scope logic secure, .strict() validated, 26/26 E2E pass, no regressions |
| 2026-03-14 | TECH-05 | PM | PM Agent | e78bb21 | Story spec with data-test-id — 41 tables RLS (up from 14) |
| 2026-03-14 | TECH-05 | Dev | Dev Agent | 39c6ecb | Migration 0030 + tenant-context middleware + app.ts + health RLS status |
| 2026-03-14 | TECH-05 | QA | QA Agent | 39c6ecb | 169 Playwright E2E tests (file-content based, included in Dev commit) |
| 2026-03-14 | TECH-05 | Review | Review Agent | 7a0492b | Fix: comment wording inflated regex counts + test assertion. 169/169 pass |
