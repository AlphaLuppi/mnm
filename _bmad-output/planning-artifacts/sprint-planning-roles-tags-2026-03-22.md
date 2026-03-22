# Sprint Plan — Roles + Tags + Dynamic Permissions

> **Date** : 2026-03-22 | **Updated** : 2026-03-23
> **Source** : epics-roles-tags-2026-03-22.md, architecture-roles-tags-2026-03-22.md (v2)
> **Equipe** : Tom + Claude (1 dev humain + AI pair programming)
> **Sprint** : 1 semaine (cadence rapide, pas en prod)
> **Capacite** : ~40 SP/sprint (velocite elevee grace au pair programming Claude)

---

## Resume

| Metrique | Planifie | Realise |
|----------|----------|---------|
| Stories | 34 | 30 done + 4 deferred |
| Story Points | 132 | 108 done |
| Sprints planifies | 5 | 2 jours (sessions intensives) |
| Bonus fixes | 0 | 13 |

---

## Sprint 1 -- Foundation (Schema + Nuke + Single-Tenant) -- DONE

| Story | Titre | SP | Status |
|-------|-------|----|--------|
| SCHEMA-01 | Tables permissions, roles, role_permissions | 3 | DONE |
| SCHEMA-02 | Tables tags, tag_assignments | 3 | DONE |
| SCHEMA-03 | Modifier company_memberships (role_id FK) | 2 | DONE |
| SCHEMA-04 | Modifier agents (drop role, add created_by_user_id) | 2 | DONE |
| SCHEMA-05 | Nuke code legacy (constantes, presets, grants) | 5 | DONE |
| TENANT-01 | Auto-inject companyId middleware | 3 | DONE |
| TENANT-02 | Route rewriting (simplified API URLs) | 5 | DONE |
| TENANT-03 | Supprimer company UI | 2 | DEFERRED |

**Total : 23/25 SP**

---

## Sprint 2 -- Permission Engine (PERM + API) -- DONE

| Story | Titre | SP | Status |
|-------|-------|----|--------|
| PERM-05 | Seed permissions standard | 2 | DONE |
| PERM-01 | Rewrite hasPermission() role-based + tag intersection | 5 | DONE |
| PERM-02 | TagScope middleware | 3 | DONE |
| PERM-03 | Cache permissions + tags | 3 | DONE |
| PERM-04 | Validation permissions au startup | 3 | DONE |
| API-01 | Routes CRUD Roles | 5 | DONE |
| API-04 | Routes Permissions + Member Role | 3 | DONE |

**Total : 24/24 SP**

---

## Sprint 3 -- Tags + Isolation -- DONE (partial)

| Story | Titre | SP | Status |
|-------|-------|----|--------|
| API-02 | Routes CRUD Tags | 5 | DONE |
| API-03 | Routes Tag Assignments | 5 | DONE |
| ISO-01 | Tag filtering sur les agents | 5 | DONE |
| ISO-02 | Tag filtering sur les issues | 5 | DONE |
| ISO-03 | Tag filtering sur traces et runs | 3 | DONE |
| ISO-04 | Tests E2E isolation inter-tags | 5 | DEFERRED |

**Total : 23/28 SP**

---

## Sprint 4 -- Agents + UI -- DONE

| Story | Titre | SP | Status |
|-------|-------|----|--------|
| AGENT-01 | Agent creation avec tags obligatoires | 3 | DONE |
| AGENT-02 | Partage d'agent par ajout de tag | 3 | DONE |
| AGENT-03 | Sandbox routing -- resolveRunActor | 3 | DONE |
| AGENT-04 | Liste agents filtree dans le dashboard | 3 | DONE |
| UI-01 | Admin panel -- Gestion des roles | 5 | DONE |
| UI-02 | Admin panel -- Gestion des tags | 5 | DONE |
| UI-03 | Admin panel -- Gestion des membres | 5 | DONE |

**Total : 27/27 SP**

---

## Sprint 5 -- Onboarding + Task Pool + CAO -- PARTIAL

| Story | Titre | SP | Status |
|-------|-------|----|--------|
| UI-04 | Onboarding wizard repense (5 steps) | 8 | DONE |
| UI-05 | Issue assignment par tag (Task Pool) | 5 | DEFERRED |
| CAO-01 | Agent CAO system (auto-creation) | 3 | DONE |
| CAO-02 | Hook auto-tagging (nouveau tag -> CAO) | 2 | DONE |
| CAO-03 | CAO watchdog (mode silencieux) | 5 | DEFERRED |
| CAO-04 | CAO interactif (@cao) | 5 | DEFERRED |

**Total : 13/28 SP**

---

## Bonus Fixes (non planifies)

| Fix | Description |
|-----|-------------|
| Sandbox docker exec routing | runChildProcess routes through docker exec when dockerContainerId set |
| localhost -> host.docker.internal | Env vars rewritten for Docker container network access |
| Issue context injection | issueTitle + issueDescription injected into agent prompt |
| Default prompt template | Agents receive task info automatically |
| Agent permission inheritance | Agents inherit creator's permissions |
| UTF-8 embedded PostgreSQL | template0 + encoding UTF8 for Windows |
| Stale container cleanup | docker rm -f before recreating sandbox |
| Auto-provision after onboarding | Sandbox created automatically |
| CAO prompt template | Rich system prompt with platform context + API docs |
| Permission editor UI | Checkbox grid in AdminRoles create/edit dialogs |
| Permission presets | Startup/Structured presets with correct permission slugs |
| CEO -> CAO migration | NewAgentDialog, adapter type, metadata identification |
| Onboarding bootstrap | bootstrapCompany() in company creation route |

---

## Remaining Stories

### P0 -- Blocking
| Story | SP | Description |
|-------|----|-------------|
| TENANT-03 | 2 | Remove company selector sidebar |
| ISO-04 | 5 | E2E tests for tag isolation |

### P1 -- Important
| Story | SP | Description |
|-------|----|-------------|
| UI-05 | 5 | Task Pool UI (assign by tag, pool view, take action) |
| CAO-03 | 5 | Watchdog mode (event hooks, anomaly detection) |
| CAO-04 | 5 | Interactive @cao (chat integration) |
| AGENT-TAGS-UI | 3 | Tag selector in agent creation dialog |

### P2 -- Technical Debt
| Story | SP | Description |
|-------|----|-------------|
| BOARD-RENAME | 8 | Rename "board" actor type to "user" across codebase |
| CEO-CLEANUP | 3 | Remove remaining CEO references |
| SANDBOX-AUTH | 3 | Auto-persist claude credentials across container recreation |
