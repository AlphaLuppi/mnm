# DASH-S01 — API Dashboards Agregees (KPIs, Timeline, Breakdown)

> **Epic** : DASH — Dashboards par Role
> **Sprint** : Batch 13
> **Assignation** : Tom (backend)
> **Effort** : M (5 SP, 3-4j)
> **Bloque par** : OBS-S01 (table audit_events + service audit)
> **Debloque** : DASH-S02 (DashboardCards UI), DASH-S03 (Dashboard temps reel)
> **ADR** : ADR-007

---

## Contexte

Le service `dashboard.ts` existant fournit un endpoint unique `summary(companyId)` qui retourne des KPIs basiques (agents, tasks, costs, pendingApprovals, staleTasks). Pour le B2B enterprise, il faut des endpoints plus riches :

1. **KPIs enrichis** : incluant les metriques workflows, audit, drift, containers
2. **Timeline** : evolution des metriques dans le temps (7j, 30j, 90j)
3. **Breakdown par categorie** : repartition agents par statut, workflows par etat, audit par action
4. **k-anonymity (k=5)** : les metriques agrégées ne permettent jamais de drill-down individuel
5. **Filtrage par role** : chaque role voit les metriques autorisees

Le service dashboard aggregation s'appuie sur les tables existantes :
- `agents` — statuts agents
- `issues` — statuts taches
- `cost_events` — depenses
- `approvals` — validations en attente
- `audit_events` — evenements audit (OBS-S01)
- `workflow_instances` + `stage_instances` — etats workflows
- `container_instances` — statuts containers
- `drift_reports` — alertes drift
- `heartbeat_runs` — activite agents

Ce service est backend-only (pas de verification Chrome MCP).

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| OBS-S01 | DONE | Table `audit_events`, service audit avec list/count/emit |
| TECH-06 | DONE | Tables workflow_instances, stage_instances, container_instances |
| TECH-07 | DONE | Colonnes enrichies sur companies, agents |
| RBAC-S01 | DONE | hasPermission() avec scope |
| RBAC-S04 | DONE | requirePermission middleware |
| OBS-S02 | DONE | emitAudit helper |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — KPIs enrichis
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/kpis
**Then** il recoit les KPIs complets : agents (active/running/paused/error), tasks (open/inProgress/blocked/done), costs (monthSpend/budget/utilization), workflows (active/completed/failed), audit (eventsToday/eventsWeek), containers (running/stopped), drift (openAlerts), pendingApprovals, staleTasks

### AC2 — Timeline 7j/30j/90j
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/timeline?period=7d
**Then** il recoit un tableau de points (date, agents_active, tasks_completed, audit_events, cost_cents) pour chaque jour de la periode

### AC3 — Timeline period validation
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/timeline?period=invalid
**Then** l'API retourne 400 avec message de validation Zod

### AC4 — Breakdown agents
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/breakdown/agents
**Then** il recoit la repartition des agents par statut (idle, running, paused, error, terminated) avec count pour chaque

### AC5 — Breakdown workflows
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/breakdown/workflows
**Then** il recoit la repartition des workflow instances par etat (created, in_progress, completed, failed, paused)

### AC6 — Breakdown audit
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/breakdown/audit
**Then** il recoit la repartition des audit events par action (top 10) et par severity pour les 30 derniers jours

### AC7 — k-anonymity enforcement (k=5)
**Given** une categorie avec moins de 5 entites
**When** le breakdown est calcule
**Then** le count est arrondi a 0 ou agrege dans "other" pour empecher le drill-down individuel

### AC8 — Permission enforcement
**Given** un utilisateur SANS permission `dashboard:read`
**When** il appelle un endpoint /dashboard/*
**Then** il recoit 403 Forbidden avec requiredPermission="dashboard:read"

### AC9 — Audit emission on access
**Given** un utilisateur qui accede aux dashboards
**When** il appelle GET /companies/:companyId/dashboard/kpis
**Then** un audit event `dashboard.viewed` severity="info" est emis

### AC10 — Backward compatibility
**Given** l'endpoint legacy GET /companies/:companyId/dashboard
**When** un client l'appelle
**Then** il continue de fonctionner et retourne le format DashboardSummary existant

### AC11 — Breakdown categories validation
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/breakdown/invalid_category
**Then** l'API retourne 400 avec les categories valides (agents, workflows, audit, costs, containers)

### AC12 — Costs breakdown
**Given** un utilisateur avec permission `dashboard:read`
**When** il appelle GET /companies/:companyId/dashboard/breakdown/costs
**Then** il recoit la repartition des couts par agent (top 10) pour le mois en cours, avec k-anonymity

---

## Deliverables

### D1 — Types shared (`packages/shared/src/types/dashboard.ts`)
Enrichir le fichier existant avec les nouveaux types :
- `DashboardKpis` — KPIs complets
- `DashboardTimelinePoint` — point de timeline
- `DashboardTimeline` — tableau de points + metadata
- `DashboardBreakdownItem` — item de breakdown
- `DashboardBreakdown` — tableau d'items + metadata
- `DASHBOARD_PERIODS` — constante des periodes valides
- `DASHBOARD_BREAKDOWN_CATEGORIES` — constante des categories valides
- `DashboardPeriod` — type union des periodes
- `DashboardBreakdownCategory` — type union des categories

### D2 — Validators (`packages/shared/src/validators/dashboard.ts`)
Nouveau fichier :
- `dashboardTimelineFiltersSchema` — Zod schema pour query params timeline (period: "7d"|"30d"|"90d")
- `dashboardBreakdownFiltersSchema` — Zod schema pour query params breakdown (category)

### D3 — Service enrichi (`server/src/services/dashboard.ts`)
Etendre le service existant avec de nouvelles fonctions :
- `kpis(companyId)` — KPIs enrichis agrégés depuis toutes les tables
- `timeline(companyId, period)` — serie temporelle avec aggregation par jour
- `breakdown(companyId, category)` — repartition par categorie avec k-anonymity
- Conserver `summary(companyId)` pour backward compatibility

### D4 — Routes enrichies (`server/src/routes/dashboard.ts`)
Ajouter 4 routes sous `/companies/:companyId/dashboard/` :
- `GET .../dashboard/kpis` — KPIs enrichis
- `GET .../dashboard/timeline` — timeline avec query param `period`
- `GET .../dashboard/breakdown/:category` — breakdown par categorie
- Conserver la route legacy `GET .../dashboard`

### D5 — Barrel exports
- `server/src/services/index.ts` : `dashboardService` deja exporte
- `server/src/routes/index.ts` : `dashboardRoutes` deja exporte
- `packages/shared/src/validators/index.ts` : ajouter exports dashboard
- `packages/shared/src/index.ts` : ajouter exports dashboard types + validators
- `packages/shared/src/types/index.ts` : ajouter exports dashboard types

---

## Data-test-id Mapping

| data-testid | Element | Fichier |
|-------------|---------|---------|
| `dash-s01-kpis-route` | Route GET /dashboard/kpis | routes/dashboard.ts |
| `dash-s01-timeline-route` | Route GET /dashboard/timeline | routes/dashboard.ts |
| `dash-s01-breakdown-route` | Route GET /dashboard/breakdown/:category | routes/dashboard.ts |
| `dash-s01-kpis-fn` | Function kpis() | services/dashboard.ts |
| `dash-s01-timeline-fn` | Function timeline() | services/dashboard.ts |
| `dash-s01-breakdown-fn` | Function breakdown() | services/dashboard.ts |
| `dash-s01-k-anonymity` | k-anonymity enforcement | services/dashboard.ts |
| `dash-s01-types` | Dashboard types file | types/dashboard.ts |
| `dash-s01-validators` | Dashboard validators file | validators/dashboard.ts |
| `dash-s01-permission` | requirePermission("dashboard:read") | routes/dashboard.ts |
| `dash-s01-audit-emit` | emitAudit("dashboard.viewed") | routes/dashboard.ts |
| `dash-s01-legacy-compat` | Legacy summary route preserved | routes/dashboard.ts |

---

## Test Cases (E2E file-content based)

### Groupe 1: File existence and barrel exports (T01-T08)
- T01 — Service file exists and exports dashboardService with kpis function
- T02 — Routes file exists and exports dashboardRoutes with new routes
- T03 — Types file exports DashboardKpis, DashboardTimeline, DashboardBreakdown
- T04 — Validators file exists and exports dashboard schemas
- T05 — Service barrel (services/index.ts) exports dashboardService
- T06 — Routes barrel (routes/index.ts) exports dashboardRoutes
- T07 — Validators barrel exports dashboard validators
- T08 — Shared index exports dashboard types and validators

### Groupe 2: KPIs service (T09-T18)
- T09 — kpis function queries agents table with groupBy status
- T10 — kpis function queries issues table for task counts
- T11 — kpis function queries cost_events for monthly spend
- T12 — kpis function queries workflow_instances for workflow stats
- T13 — kpis function queries audit_events for event counts
- T14 — kpis function queries container_instances for container stats
- T15 — kpis function queries drift_reports for open alerts
- T16 — kpis function queries approvals for pending count
- T17 — kpis function returns correct shape with all KPI sections
- T18 — Legacy summary function still exists for backward compatibility

### Groupe 3: Timeline service (T19-T24)
- T19 — timeline function accepts period parameter (7d, 30d, 90d)
- T20 — timeline function generates date range based on period
- T21 — timeline function aggregates data by day
- T22 — timeline function queries audit_events by date range
- T23 — timeline function queries cost_events by date range
- T24 — timeline function returns array of DashboardTimelinePoint

### Groupe 4: Breakdown service (T25-T32)
- T25 — breakdown function accepts category parameter
- T26 — breakdown function handles "agents" category with groupBy status
- T27 — breakdown function handles "workflows" category with groupBy state
- T28 — breakdown function handles "audit" category with groupBy action
- T29 — breakdown function handles "costs" category with groupBy agent
- T30 — breakdown function handles "containers" category with groupBy status
- T31 — k-anonymity applied: counts below 5 are zeroed or grouped
- T32 — breakdown function validates category against allowed list

### Groupe 5: Routes (T33-T40)
- T33 — GET /dashboard/kpis route registered with requirePermission
- T34 — GET /dashboard/timeline route registered with requirePermission
- T35 — GET /dashboard/breakdown/:category route registered with requirePermission
- T36 — Legacy GET /dashboard route still registered
- T37 — All new routes use "dashboard:read" permission key
- T38 — KPIs route calls emitAudit for dashboard.viewed
- T39 — Timeline route validates period query param with Zod
- T40 — Breakdown route validates category param

### Groupe 6: Types and constants (T41-T48)
- T41 — DashboardKpis type includes agents, tasks, costs, workflows, audit, containers, drift sections
- T42 — DashboardTimelinePoint type includes date, agents_active, tasks_completed, audit_events, cost_cents
- T43 — DashboardTimeline type includes points array and period metadata
- T44 — DashboardBreakdownItem type includes label and count fields
- T45 — DashboardBreakdown type includes items array and category metadata
- T46 — DASHBOARD_PERIODS constant includes "7d", "30d", "90d"
- T47 — DASHBOARD_BREAKDOWN_CATEGORIES constant includes agents, workflows, audit, costs, containers
- T48 — DashboardPeriod and DashboardBreakdownCategory types exported

### Groupe 7: Validators (T49-T52)
- T49 — dashboardTimelineFiltersSchema validates period enum
- T50 — dashboardTimelineFiltersSchema rejects invalid period values
- T51 — dashboardBreakdownFiltersSchema is not needed (category in path)
- T52 — Validator file imports from zod

### Groupe 8: Permission enforcement (T53-T56)
- T53 — All new routes use requirePermission middleware
- T54 — Permission key is "dashboard:read" (not "dashboard.view")
- T55 — requirePermission is imported from middleware/require-permission
- T56 — assertCompanyAccess called in each route handler

### Groupe 9: Audit integration (T57-T60)
- T57 — emitAudit imported in dashboard routes
- T58 — KPIs route emits audit event with action "dashboard.viewed"
- T59 — emitAudit uses req, db, companyId parameters
- T60 — Audit emission is non-blocking (fire-and-forget pattern)

### Groupe 10: k-anonymity and aggregation (T61-T65)
- T61 — K_ANONYMITY_THRESHOLD constant defined (value 5)
- T62 — applyKAnonymity helper function exists
- T63 — Breakdown function applies k-anonymity to results
- T64 — Items below k threshold are grouped into "other" or zeroed
- T65 — k-anonymity does not affect total/aggregate counts

---

## Notes techniques

- **k-anonymity** : Implementer une function `applyKAnonymity(items, k=5)` qui agrege les items avec count < k dans un bucket "other"
- **Timeline** : Utiliser SQL `date_trunc('day', created_at)` pour grouper par jour
- **Performance** : Les requetes dashboard peuvent etre couteuses, mais pas de cache Redis pour le MVP (DASH-S03 ajoutera le temps reel)
- **Permission key** : Utiliser `dashboard:read` (format colon, coherent avec le codebase existant)
