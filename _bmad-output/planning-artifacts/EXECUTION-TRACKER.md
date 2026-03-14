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
| TECH-01 | PostgreSQL externe | PENDING | | | | | |
| TECH-02 | Docker Compose | PENDING | | | | | |
| MU-S06 | Sign-out invalidation | PENDING | | | | | |

### BATCH 2 — Schema + Redis (← TECH-01/02)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| TECH-06 | 10 nouvelles tables | PENDING | | | | | |
| TECH-07 | Modifications 5 tables | PENDING | | | | | |
| TECH-04 | Redis setup | PENDING | | | | | |
| TECH-03 | Infrastructure test | PENDING | | | | | |

### BATCH 3 — RLS + Auth (← TECH-06/07)

| Story | Description | Status | Agent PM | Agent Dev | Agent QA | Agent Review | Notes |
|-------|-------------|--------|----------|-----------|----------|-------------|-------|
| TECH-05 | RLS PostgreSQL 14 tables | PENDING | | | | | |
| RBAC-S01 | Fix hasPermission ⚠️ P0 | PENDING | | | | | |
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
| Stories DONE | 0 |
| Stories IN_PROGRESS | 0 |
| Stories PENDING | 69 |
| Batch courant | 1 |
| Dernière story complétée | — |
| Prochain batch débloqué | BATCH 1 (pas de dépendances) |

---

## Journal d'exécution

| Date | Story | Étape | Agent | Commit | Notes |
|------|-------|-------|-------|--------|-------|
| — | — | — | — | — | Pipeline pas encore démarré |
