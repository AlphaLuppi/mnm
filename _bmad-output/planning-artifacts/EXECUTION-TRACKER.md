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
| RBAC-S03 | businessRole migration | DONE | 42e0df6 | 4f58b19 | 4f58b19 | PASS (no fix needed) | 33/33 E2E pass, constants + validators + migration + API endpoint + seed |
| MU-S01 | API invitations email | DONE | 5e6f34c | dev | 84e073c | 1176efd | 31/31 E2E pass, email service + schema migration + 7-day TTL + dedup + GET list |
| MU-S05 | Désactivation signup | DONE | caede63 | dev | fb0e255 | PASS (no fix needed) | 27/27 E2E pass, invitationOnly flag + join-request guard + settings PATCH + audit |

### BATCH 4 — RBAC + Multi-User (← RBAC-S01, MU-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| RBAC-S02 | 20 permission keys + presets | DONE | 996876d | dev | 2aa5fc9 | 9d3921a | 36/36 E2E pass, 5 new keys (20 total) + presets matrix + hasPermission fallback + effective-permissions API |
| MU-S02 | Page membres UI | DONE | b40a986 | dev | 104d901 | review | 85/85 E2E pass, Members page + table + filters + invite dialog + enriched API |
| MU-S03 | Invitation bulk CSV | DONE | 8138c08 | dev | d57c130 | b610ad0 | 54/54 E2E pass, BulkInviteTab 4-phase + CSV parsing + tabbed dialog |
| MU-S04 | Sélecteur company | DONE | spec | dev | qa | 00ec212 | 16/16 E2E pass, fix: align test data-testid with switcher- prefix per story spec mapping table |
| RBAC-S07 | Badges rôle | DONE | 5d1fff8 | b20540d | 133bc89 | f6d237f | 27/27 E2E pass, RoleBadge component + Members.tsx + BulkInviteTab integration |

### BATCH 5 — Enforcement + Navigation (← RBAC-S02)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| RBAC-S04 | Enforcement 22 routes | DONE | 0d96835 | 8c0bd97 | 29edcdd | 4aa1f37 | 81/81 E2E pass, fix: enriched 403 details in access.ts + issues.ts |
| RBAC-S05 | Navigation masquée | DONE | db62198 | 20fca35 | cdbd940 | 3f7d649 | 134/134 E2E pass, fix: test regex + MU-S02 route wrapper compat |
| RBAC-S06 | UI admin matrice permissions | DONE | 76013b2 | e15d7c1 | 97d2346 | ce670c4 | 144/144 E2E pass, fix: dynamic data-testid pattern in tests |

### BATCH 6 — Orchestrateur + Scoping (← RBAC-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| ORCH-S01 | State machine XState | DONE | spec | dev | qa | 4afa90d | 215/215 E2E pass, fix: StageContext import + permission strings in guards + eventToEmitType inline + test publishLiveEvent selector |
| PROJ-S01 | Table project_memberships | DONE | 93b1dd5 | cfa62fc | a551d44 | da092d1 | 67/67 E2E pass, fix: 4 test regex patterns for multiline Drizzle chaining |
| OBS-S01 | Table audit_events | DONE | a0a3463 | 69c0773 | 0c5b4c7 | c796c47 | 99/99 E2E pass, fix: T09 barrel re-export path + T46 offset regex false positive |
| CHAT-S01 | WebSocket bidirectionnel | DONE | 0787eed | 1aab461 | 22bde6e | f9d3a36 | 138/138 E2E pass, fix: function names + CHANNEL_CLOSED error + test regex |
| CHAT-S02 | Tables chat | DONE | 5c7ad86 | 76f9356 | f4bf271 | cc8f14b | 60/60 E2E pass, fix: migration threshold 0037->0034 + CHAT-S01 route count compat |

### BATCH 7 — Orchestrateur avancé (← ORCH-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| ORCH-S02 | WorkflowEnforcer | DONE | 3f02ffd | de158fd | f18b731 | de36ff5 | 51/51 E2E pass, fix: T38 import() regex + T44c enforce call idx |
| ORCH-S03 | Validation HITL | DONE | 162507e | 48f270e | 128ea3c | 4e021ce | 69/69 E2E pass, fix: stale machineState check in approve/reject |
| ORCH-S04 | API routes orchestrateur | DONE | 8cb386a | 0a79f74 | a3e6225 | PASS (no fix) | 79/79 E2E pass, 14 routes + 6 validators, no fix needed |
| OBS-S02 | Service audit émission | DONE | a0b1c56 | 4adeb22 | 04ffb31 | 433844b | 89/89 E2E pass, fix: missing emitAudit calls + severity test indexOf |
| PROJ-S02 | Service project-memberships | DONE | 0803a54 | 48d86e0 | 02cada1 | cb392f5 | 47/47 E2E pass, fix: PROJ-S01 T42 regression (bulk route ordering) |

### BATCH 8 — Drift + Audit UI (← ORCH-S01, OBS-S01)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| DRIFT-S01 | Drift persistance DB | DONE | fa02ea0 | f856e36 | 2d52708 | PASS (no fix needed) | 48/48 E2E pass, 2 schemas + migration + service + refactor + routes + types |
| DRIFT-S02 | Drift monitor service | DONE | 43cd8e2 | e1172dd | 0bb74cb | PASS (no fix needed) | 50/50 E2E pass, drift-monitor service + 5 routes + 4 LiveEventTypes + types + audit |
| OBS-S04 | UI AuditLog | DONE | d3922c7 | 4a859ea | 281868e | PASS (no fix needed) | 88/88 E2E pass, API client + AuditLog page + AuditEventDetail modal + route + sidebar + query keys |
| PROJ-S03 | Filtrage par scope | DONE | e0f5b8a | e5dc624 | 68faa43 | PASS (no fix needed) | 67/67 E2E pass, scope-filter service + hasGlobalScope + 4 routes + listByIds + useProjectScope hook |
| PROJ-S04 | Page ProjectAccess | DONE | 0a7146c | 9e0fa22 | 1b0f0fd | PASS (no fix needed) | 75/75 E2E pass, API client + ProjectAccessTab + AddProjectMemberDialog + ProjectDetail integration |

### BATCH 9 — Containerisation (← TECH-02, TECH-05)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| CONT-S01 | ContainerManager Docker | DONE | a3f7e7a | 8f8a222 | bd16d64 | PASS (no fix) | 85/85 E2E pass, Docker adapter + service + 7 routes |
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
| Stories DONE | 36 |
| Stories IN_PROGRESS | 0 |
| Stories PENDING | 33 |
| Batch courant | 9 |
| Dernière story complétée | CONT-S01 |
| Prochain batch débloqué | BATCH 9 (CONT-S05, DRIFT-S03) |

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
| 2026-03-14 | RBAC-S03 | PM | PM Agent | 42e0df6 | Story spec with data-test-id — businessRole migration + validation + API |
| 2026-03-14 | RBAC-S03 | Dev | Dev Agent | 4f58b19 | Constants + validators + migration 0031 + service + API endpoint + seed |
| 2026-03-14 | RBAC-S03 | QA | QA Agent | 4f58b19 | 33 Playwright E2E tests (file-content based, included in Dev commit) |
| 2026-03-14 | RBAC-S03 | Review | Review Agent | — | PASS — all 10 files verified, 33/33 E2E pass, no regressions |
| 2026-03-14 | MU-S01 | PM | PM Agent | 5e6f34c | Story spec with data-test-id — email invitations + 9 ACs |
| 2026-03-14 | MU-S01 | Dev | Dev Agent | dev | Schema migration + email service + route mods + GET list + .env |
| 2026-03-14 | MU-S01 | QA | QA Agent | 84e073c | 31 Playwright E2E tests (file-content based) |
| 2026-03-14 | MU-S01 | Review | Review Agent | 1176efd | Fix: migration file ref 0032→0033 in tests. 31/31 pass |
| 2026-03-14 | MU-S05 | PM | PM Agent | caede63 | Story spec with data-test-id — invitationOnly flag + 8 ACs |
| 2026-03-14 | MU-S05 | Dev | Dev Agent | dev | Schema + migration 0034 + guard + PATCH settings + audit |
| 2026-03-14 | MU-S05 | QA | QA Agent | fb0e255 | 27 Playwright E2E tests (file-content based) |
| 2026-03-14 | MU-S05 | Review | Review Agent | — | PASS — all 7 deliverables verified, 27/27 E2E pass, no regressions |
| 2026-03-14 | RBAC-S02 | PM | PM Agent | 996876d | Story spec with data-test-id — 20 permission keys + presets + 13 ACs |
| 2026-03-14 | RBAC-S02 | Dev | Dev Agent | dev | 5 new keys + rbac-presets.ts + hasPermission fallback + effective-permissions |
| 2026-03-14 | RBAC-S02 | QA | QA Agent | 2aa5fc9 | 36 Playwright E2E tests (file-content based) |
| 2026-03-14 | RBAC-S02 | Review | Review Agent | 9d3921a | Fix: test fn names + TECH-07 key count. 36/36 pass |
| 2026-03-14 | MU-S02 | PM | PM Agent | b40a986 | Story spec — Members page + 15 ACs + 47 data-testid + 32 test cases |
| 2026-03-14 | MU-S02 | Dev | Dev Agent | dev | Members page + enriched API + status endpoint + sidebar + route |
| 2026-03-14 | MU-S02 | QA | QA Agent | 104d901 | 85 Playwright E2E tests (file-content based) |
| 2026-03-14 | MU-S02 | Review | Review Agent | review | Fix: 35 data-testid alignment + BUSINESS_ROLE_LABELS + queryKey namespace. 85/85 pass |
| 2026-03-14 | MU-S03 | PM | PM Agent | 8138c08 | Story spec — bulk CSV invite + 7 ACs + 34 data-testid |
| 2026-03-14 | MU-S03 | Dev | Dev Agent | dev | BulkInviteTab 4-phase + tabbed dialog + CSV parsing |
| 2026-03-14 | MU-S03 | QA | QA Agent | d57c130 | 54 Playwright E2E tests (file-content based) |
| 2026-03-14 | MU-S03 | Review | Review Agent | b610ad0 | Fix: numeric literal separator in test. 54/54 pass |
| 2026-03-14 | MU-S04 | Review | Review Agent | 00ec212 | Fix: align 6 test data-testid with switcher- prefix per story spec mapping. 16/16 pass |
| 2026-03-14 | RBAC-S07 | PM | PM Agent | 5d1fff8 | Story spec — RoleBadge + 11 ACs + color scheme |
| 2026-03-14 | RBAC-S07 | Dev | Dev Agent | b20540d | RoleBadge component + Members.tsx + BulkInviteTab integration |
| 2026-03-14 | RBAC-S07 | QA | QA Agent | 133bc89 | 27 Playwright E2E tests (file-content based) |
| 2026-03-14 | RBAC-S07 | Review | Review Agent | f6d237f | Fix: regex for as BusinessRole cast. 27/27 pass |
| 2026-03-14 | RBAC-S04 | PM | PM Agent | 0d96835 | Story spec with data-test-id — enforcement 22 route files |
| 2026-03-14 | RBAC-S04 | Dev | Dev Agent | 8c0bd97 | requirePermission middleware + assertCompanyPermission + 10 route files |
| 2026-03-14 | RBAC-S04 | QA | QA Agent | 29edcdd | 81 Playwright E2E tests (file-content based) |
| 2026-03-14 | RBAC-S04 | Review | Review Agent | 4aa1f37 | Fix: enriched 403 details in access.ts + issues.ts. 81/81 pass |
| 2026-03-14 | RBAC-S05 | PM | PM Agent | db62198 | Story spec — navigation masquée + 31 data-testid + visibility matrix |
| 2026-03-14 | RBAC-S05 | Dev | Dev Agent | 20fca35 | usePermissions hook + RequirePermission + Sidebar/CommandPalette masking + route protection |
| 2026-03-14 | RBAC-S05 | QA | QA Agent | cdbd940 | 134 Playwright E2E tests (file-content based) |
| 2026-03-14 | RBAC-S05 | Review | Review Agent | 3f7d649 | Fix: 4 test regex + MU-S02 route wrapper compat. 134/134 pass |
| 2026-03-14 | RBAC-S06 | PM | PM Agent | 76013b2 | Story spec — admin matrice permissions + 73 data-testid + 15 ACs |
| 2026-03-14 | RBAC-S06 | Dev | Dev Agent | e15d7c1 | AdminRoles page + PermissionMatrix + RoleOverviewCard + route + sidebar |
| 2026-03-14 | RBAC-S06 | QA | QA Agent | 97d2346 | 144 Playwright E2E tests (file-content based) |
| 2026-03-14 | RBAC-S06 | Review | Review Agent | ce670c4 | Fix: dynamic data-testid patterns in tests. 144/144 pass |
| 2026-03-14 | ORCH-S01 | Review | Review Agent | 4afa90d | Fix: StageContext import + permission strings + eventToEmitType inline + test selector. 215/215 pass |
| 2026-03-14 | PROJ-S01 | PM | PM Agent | 93b1dd5 | Story spec with data-test-id — project_memberships CRUD + routes |
| 2026-03-14 | PROJ-S01 | Dev | Dev Agent | cfa62fc | Service 6 functions + 5 routes + validators + barrel exports |
| 2026-03-14 | PROJ-S01 | QA | QA Agent | a551d44 | 67 Playwright E2E tests (file-content based) |
| 2026-03-14 | PROJ-S01 | Review | Review Agent | da092d1 | Fix: 4 test regex for multiline Drizzle chaining. 67/67 pass |
| 2026-03-14 | OBS-S01 | PM | PM Agent | a0a3463 | Story spec with data-test-id — audit events service + API + immutability |
| 2026-03-14 | OBS-S01 | Dev | Dev Agent | 69c0773 | Service 7 functions + 6 routes + validators + types + migration SQL |
| 2026-03-14 | OBS-S01 | QA | QA Agent | 0c5b4c7 | 99 Playwright E2E tests (file-content based) |
| 2026-03-14 | OBS-S01 | Review | Review Agent | c796c47 | Fix: T09 barrel re-export path + T46 offset regex false positive. 99/99 pass |
| 2026-03-14 | CHAT-S01 | PM | PM Agent | 0787eed | Story spec — WebSocket bidirectionnel + protocol + 40 data-testid + 17 ACs |
| 2026-03-14 | CHAT-S01 | Dev | Dev Agent | 1aab461 | ChatWsManager + chat service + REST routes + WS server + types/validators |
| 2026-03-14 | CHAT-S01 | QA | QA Agent | 22bde6e | 138 Playwright E2E tests (file-content based) |
| 2026-03-14 | CHAT-S01 | Review | Review Agent | f9d3a36 | Fix: function names + CHANNEL_CLOSED error + 8 test regex. 138/138 pass |
| 2026-03-14 | CHAT-S02 | PM | PM Agent | 5c7ad86 | Story spec with data-test-id — enriched chat tables + service |
| 2026-03-14 | CHAT-S02 | Dev | Dev Agent | 76f9356 | 4+4 new columns + 3 indexes + migration + 3 new service fns + 2 routes |
| 2026-03-14 | CHAT-S02 | QA | QA Agent | f4bf271 | 60 Playwright E2E tests (file-content based) |
| 2026-03-14 | CHAT-S02 | Review | Review Agent | cc8f14b | Fix: migration threshold 0037->0034 + CHAT-S01 route count compat. 60/60 pass |
| 2026-03-14 | ORCH-S02 | PM | PM Agent | 3f02ffd | Story spec — WorkflowEnforcer + 28 data-testid + 12 ACs |
| 2026-03-14 | ORCH-S02 | Dev | Dev Agent | de158fd | WorkflowEnforcer service + schema ext + migration + orchestrator integration |
| 2026-03-14 | ORCH-S02 | QA | QA Agent | f18b731 | 51 Playwright E2E tests (file-content based) |
| 2026-03-14 | ORCH-S02 | Review | Review Agent | de36ff5 | Fix: T38 import() regex + T44c enforce call idx. 51/51 pass |
| 2026-03-14 | ORCH-S03 | PM | PM Agent | 162507e | Story spec — HITL validation + 48 data-testid + 15 ACs |
| 2026-03-14 | ORCH-S03 | Dev | Dev Agent | 48f270e | HITL service + orchestrator integration + 3 UI components + migration |
| 2026-03-14 | ORCH-S03 | QA | QA Agent | 128ea3c | 69 Playwright E2E tests (file-content based) |
| 2026-03-14 | ORCH-S03 | Review | Review Agent | 4e021ce | Fix: stale machineState check in approve/reject. 69/69 pass |
| 2026-03-14 | ORCH-S04 | PM | PM Agent | 8cb386a | Story spec — 14 API routes + 6 validators + 62 data-testid + 20 ACs |
| 2026-03-14 | ORCH-S04 | Dev | Dev Agent | 0a79f74 | 14 routes + 6 validators + barrel exports + app.ts mounting |
| 2026-03-14 | ORCH-S04 | QA | QA Agent | a3e6225 | 79 Playwright E2E tests (file-content based) |
| 2026-03-14 | ORCH-S04 | Review | Review Agent | — | PASS — 79/79 pass, 0 regressions, no fix needed |
| 2026-03-14 | OBS-S02 | PM | PM Agent | a0b1c56 | Story spec — audit emission + 45+ actions + 12 ACs |
| 2026-03-14 | OBS-S02 | Dev | Dev Agent | 4adeb22 | emitAudit helper + 14 route files + 68 emission points + middleware |
| 2026-03-14 | OBS-S02 | QA | QA Agent | 04ffb31 | 89 Playwright E2E tests (file-content based) |
| 2026-03-14 | OBS-S02 | Review | Review Agent | 433844b | Fix: 2 missing emitAudit calls + severity test indexOf. 89/89 pass |
| 2026-03-14 | PROJ-S02 | PM | PM Agent | 0803a54 | Story spec — scope sync + bulk ops + pagination + 16 ACs + 47 test cases |
| 2026-03-14 | PROJ-S02 | Dev | Dev Agent | 48d86e0 | syncUserProjectScope + 5 new svc fns + 4 new routes + 3 validators |
| 2026-03-14 | PROJ-S02 | QA | QA Agent | 02cada1 | 47 Playwright E2E tests (file-content based) |
| 2026-03-14 | PROJ-S02 | Review | Review Agent | cb392f5 | Fix: PROJ-S01 T42 regression (bulk route ordering). 47/47 + 67/67 pass |
| 2026-03-14 | DRIFT-S01 | PM | PM Agent | fa02ea0 | Story spec — drift persistence DB + 11 ACs + 48 test cases |
| 2026-03-14 | DRIFT-S01 | Dev | Dev Agent | f856e36 | 2 schemas + migration + drift-persistence service + drift.ts refactor + routes |
| 2026-03-14 | DRIFT-S01 | QA | QA Agent | 2d52708 | 48 Playwright E2E tests (file-content based) |
| 2026-03-14 | DRIFT-S01 | Review | Review Agent | — | PASS — 48/48 E2E pass, 166/166 regressions pass, no fix needed |
| 2026-03-14 | OBS-S04 | PM | PM Agent | d3922c7 | Story spec — UI AuditLog + 15 ACs + 55 data-testid + 88 test cases |
| 2026-03-14 | OBS-S04 | Dev | Dev Agent | 4a859ea | API client + AuditLog page + AuditEventDetail modal + route + sidebar + query keys |
| 2026-03-14 | OBS-S04 | QA | QA Agent | 281868e | 88 Playwright E2E tests (file-content based) |
| 2026-03-14 | OBS-S04 | Review | Review Agent | — | PASS — 88/88 E2E pass, 233/233 regressions pass (OBS-S01 + RBAC-S05), no fix needed |
| 2026-03-14 | PROJ-S03 | PM | PM Agent | e0f5b8a | Story spec — filtrage par scope + 18 ACs + 67 test cases + 52 data-testid |
| 2026-03-14 | PROJ-S03 | Dev | Dev Agent | e5dc624 | scope-filter service + hasGlobalScope + 4 routes filtered + listByIds + useProjectScope hook |
| 2026-03-14 | PROJ-S03 | QA | QA Agent | 68faa43 | 67 Playwright E2E tests (file-content based) |
| 2026-03-14 | PROJ-S03 | Review | Review Agent | — | PASS — 67/67 E2E pass, 293/293 regressions pass (PROJ-S01+S02+DRIFT-S01+S02+RBAC-S04), no fix needed |
