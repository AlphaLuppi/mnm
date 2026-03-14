# CLAUDE.md

## Project Overview

**MnM** is an open-source IDE for AI agent-driven development. Supervision cockpit for multi-agent workflows.
Stack: React + Express + SQLite (migrating to PostgreSQL) + Drizzle ORM. Monorepo pnpm.
Language: French for planning documents.

## Repository Structure

- `server/src/` — Express backend (routes/, services/, middleware/, realtime/, auth/)
- `ui/src/` — React frontend (pages/, components/, hooks/, api/)
- `packages/db/src/` — Drizzle ORM schema, migrations
- `packages/shared/` — Shared types
- `packages/adapters/` — Agent adapters (claude-local, cursor-local, etc.)
- `_bmad/` — BMAD framework. Do NOT modify.
- `_bmad-output/` — Planning artifacts (epics, PRD, architecture, sprint planning)

## Dev Commands

```bash
pnpm dev          # Start dev (server + ui)
pnpm build        # Build all packages
pnpm test         # Run vitest
pnpm test:run     # Run vitest once
pnpm typecheck    # TypeScript check all packages
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
```

---

## AUTONOMOUS EXECUTION PIPELINE — B2B Transformation

### CRITICAL: Read this FIRST after compaction

**Tu es le CEO autonome.** Tu exécutes le pipeline B2B story par story.

1. Lis `_bmad-output/planning-artifacts/EXECUTION-TRACKER.md` pour savoir OÙ TU EN ES
2. Reprends à la prochaine story PENDING
3. Exécute le pipeline 4-agents pour cette story
4. Mets à jour le tracker
5. Commit
6. Passe à la story suivante

### Le Pipeline 4-Agents (pour chaque story)

```
ÉTAPE A — PM Agent (Spécification)
  → Écrit la story détaillée avec data-test-id pour CHAQUE élément interactif/vérifiable
  → Output: _bmad-output/stories/[STORY-ID].md
  → Commit: "docs(story): [STORY-ID] — detailed spec with data-test-id"

ÉTAPE B — 2 Agents EN PARALLÈLE:
  Agent Dev: Implémente la story
    → Suit la spec, les data-test-id, les acceptance criteria
    → Vérifie avec Chrome MCP que le rendu UI est correct (si story frontend)
    → Commit: "feat([EPIC]): implement [STORY-ID] — [description]"

  Agent QA: Écrit les tests E2E Playwright
    → Basé sur les data-test-id de la story spec
    → Basé sur les acceptance criteria (Given/When/Then)
    → Output: e2e/tests/[STORY-ID].spec.ts
    → Commit: "test(e2e): [STORY-ID] — playwright tests"

ÉTAPE C — Review Agent
  → Review le code du Dev et les tests du QA
  → Run les tests (pnpm test, playwright)
  → Vérifie avec Chrome MCP que les features marchent
  → Corrige les bugs si nécessaire
  → Commit: "fix([EPIC]): [STORY-ID] — review fixes"
```

### Story Execution Queue (ordre par dépendances)

Respecter l'ordre. Ne JAMAIS sauter une story dont les dépendances ne sont pas DONE.

```
BATCH 1 — Infrastructure (Sprint 0) — Pas de dépendances
  TECH-01: PostgreSQL externe (Tom — backend)
  TECH-02: Docker Compose (Cofondateur — infra)
  MU-S06:  Sign-out invalidation (Tom — backend, pas de blocage)

BATCH 2 — Schema + Redis (dépend TECH-01/02)
  TECH-06: 10 nouvelles tables (← TECH-01)
  TECH-07: Modifications 5 tables (← TECH-01)
  TECH-04: Redis setup (← TECH-02)
  TECH-03: Infrastructure test (← TECH-01)

BATCH 3 — RLS + Auth (dépend TECH-06/07)
  TECH-05: RLS PostgreSQL 14 tables (← TECH-01, TECH-06)
  RBAC-S01: Fix hasPermission ⚠️ P0 (← TECH-07)
  RBAC-S03: businessRole migration (← TECH-07)
  MU-S01:  API invitations email (← TECH-01)
  MU-S05:  Désactivation signup (← TECH-07)

BATCH 4 — RBAC + Multi-User (dépend RBAC-S01, MU-S01)
  RBAC-S02: 9 permission keys (← RBAC-S01)
  MU-S02:  Page membres UI (← MU-S01)
  MU-S03:  Invitation bulk CSV (← MU-S01)
  MU-S04:  Sélecteur company (← TECH-07)
  RBAC-S07: Badges rôle (← RBAC-S03)

BATCH 5 — Enforcement + Navigation (dépend RBAC-S02)
  RBAC-S04: Enforcement 22 routes (← RBAC-S01, RBAC-S02)
  RBAC-S05: Navigation masquée (← RBAC-S04)
  RBAC-S06: UI admin matrice permissions (← RBAC-S02)

BATCH 6 — Orchestrateur + Scoping (dépend RBAC-S01)
  ORCH-S01: State machine XState (← RBAC-S01)
  PROJ-S01: Table project_memberships (← TECH-06)
  OBS-S01:  Table audit_events (← TECH-05)
  CHAT-S01: WebSocket bidirectionnel (← TECH-04)
  CHAT-S02: Tables chat (← TECH-06)

BATCH 7 — Orchestrateur avancé (dépend ORCH-S01)
  ORCH-S02: WorkflowEnforcer (← ORCH-S01)
  ORCH-S03: Validation HITL (← ORCH-S01)
  ORCH-S04: API routes orchestrateur (← ORCH-S01)
  OBS-S02:  Service audit émission (← RBAC-S04)
  PROJ-S02: Service project-memberships (← RBAC-S01)

BATCH 8 — Drift + Audit UI (dépend ORCH-S01, OBS-S01)
  DRIFT-S01: Drift persistance DB
  DRIFT-S02: Drift monitor service (← ORCH-S01)
  OBS-S04:  UI AuditLog (← OBS-S01)
  PROJ-S03: Filtrage par scope (← PROJ-S02)
  PROJ-S04: Page ProjectAccess (← PROJ-S02)

BATCH 9 — Containerisation (dépend TECH-02, TECH-05)
  CONT-S01: ContainerManager Docker (← TECH-02, TECH-05)
  CONT-S05: Tables container (← TECH-06)
  DRIFT-S03: UI diff drift (← DRIFT-S02)

BATCH 10 — Container avancé + Chat (dépend CONT-S01)
  CONT-S02: Credential proxy (← CONT-S01)
  CONT-S03: Mount allowlist (← CONT-S01)
  CONT-S04: Isolation réseau (← CONT-S01)
  CONT-S06: UI container status (← CONT-S01)
  CHAT-S03: ChatService pipe stdin (← CONT-S01, CHAT-S01)
  CHAT-S04: AgentChatPanel UI

BATCH 11 — A2A + Dual-Speed + Compaction (dépend CONT-S02, ORCH-S01)
  COMP-S01: CompactionWatcher (← ORCH-S01)
  DUAL-S01: Table automation_cursors (← RBAC-S01, PROJ-S01)
  A2A-S01:  A2A Bus (← CONT-S02)

BATCH 12 — A2A avancé + Dual UI (dépend A2A-S01, DUAL-S01)
  COMP-S02: Kill+relance (← COMP-S01, CONT-S01)
  A2A-S02:  Permissions A2A (← A2A-S01)
  A2A-S03:  Audit A2A (← A2A-S01, OBS-S01)
  DUAL-S02: UI curseur (← DUAL-S01)
  DUAL-S03: Enforcement curseur (← ORCH-S01)

BATCH 13 — Enterprise (dépend divers)
  SSO-S01:  Table SSO (← TECH-06)
  SSO-S02:  Better Auth SAML/OIDC (← SSO-S01)
  SSO-S03:  UI config SSO (← SSO-S02)
  DASH-S01: API dashboards (← OBS-S01)
  DASH-S02: DashboardCards UI
  DASH-S03: Dashboard temps réel
  OBS-S03:  Résumé LLM
  COMP-S03: Réinjection post-compaction (← COMP-S01)

BATCH 14 — Onboarding + Polish
  ONB-S01: Onboarding CEO
  ONB-S02: Cascade hiérarchique
  ONB-S03: Import Jira
  ONB-S04: Dual-mode config
  ORCH-S05: UI éditeur workflow (P1)
  A2A-S04:  Connecteurs MCP (P2)
  TECH-08:  CI/CD pipeline
```

### Règles d'exécution

1. **Un commit par agent** — trace git de qui fait quoi
2. **Playwright pour E2E** — dossier `e2e/tests/`, config dans `playwright.config.ts`
3. **data-test-id obligatoires** — format: `data-testid="[story-id]-[element]"` (ex: `data-testid="mu-s02-members-table"`)
4. **Chrome MCP** — agents Dev et Review vérifient visuellement les features frontend
5. **Tracker** — mettre à jour `EXECUTION-TRACKER.md` après CHAQUE story complétée
6. **Dépendances** — JAMAIS implémenter une story si ses dépendances ne sont pas DONE
7. **Stories backend-only** — pas de Chrome MCP, mais l'agent QA teste quand même via API/intégration
8. **Compact** → `/compact — autonomous B2B pipeline, read CLAUDE.md then EXECUTION-TRACKER.md`

### Sources de vérité

| Document | Chemin |
|----------|--------|
| Epics & Stories | `_bmad-output/planning-artifacts/epics-b2b.md` |
| Sprint Planning | `_bmad-output/planning-artifacts/sprint-planning-b2b.md` |
| Architecture | `_bmad-output/planning-artifacts/architecture-b2b.md` |
| PRD | `_bmad-output/planning-artifacts/prd-b2b.md` |
| UX Design | `_bmad-output/planning-artifacts/ux-design-b2b.md` |
| Tracker | `_bmad-output/planning-artifacts/EXECUTION-TRACKER.md` |
| Story Specs | `_bmad-output/stories/[STORY-ID].md` |
