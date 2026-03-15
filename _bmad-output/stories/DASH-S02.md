# DASH-S02 — DashboardCards UI (KPIs, Timeline, Breakdown)

> **Epic** : DASH — Dashboards par Role
> **Sprint** : Batch 13
> **Assignation** : Cofondateur (frontend)
> **Effort** : M (3 SP, 2-3j)
> **Bloque par** : DASH-S01 (API dashboards agregees — DONE)
> **Debloque** : DASH-S03 (Dashboard temps reel via WebSocket)
> **ADR** : ADR-007

---

## Contexte

DASH-S01 a livre les endpoints backend :
- `GET /companies/:companyId/dashboard/kpis` — KPIs enrichis (agents, tasks, costs, workflows, audit, containers, drift, pendingApprovals, staleTasks)
- `GET /companies/:companyId/dashboard/timeline?period=7d|30d|90d` — serie temporelle
- `GET /companies/:companyId/dashboard/breakdown/:category` — repartition par categorie (agents, workflows, audit, costs, containers)

Les types shared sont deja disponibles : `DashboardKpis`, `DashboardTimeline`, `DashboardBreakdown`, `DashboardPeriod`, `DashboardBreakdownCategory`, `DASHBOARD_PERIODS`, `DASHBOARD_BREAKDOWN_CATEGORIES`.

La page `Dashboard.tsx` existante utilise l'endpoint legacy `GET /companies/:companyId/dashboard` (type `DashboardSummary`). Elle affiche 5 MetricCards (agents, tasks, costs, approvals, health) + 4 ChartCards + recent activity + recent tasks.

DASH-S02 enrichit cette page en ajoutant :
1. **DashboardKpiCards** — composant affichant les KPIs enrichis depuis le nouvel endpoint `/dashboard/kpis` (workflows, audit, containers, drift)
2. **DashboardTimeline** — composant affichant la timeline avec selecteur de periode (7d/30d/90d)
3. **DashboardBreakdownPanel** — composant affichant les breakdowns par categorie avec selecteur
4. **API client enrichi** — fonctions `dashboardApi.kpis()`, `dashboardApi.timeline()`, `dashboardApi.breakdown()`
5. **Query keys** — namespace `dashboard.kpis`, `dashboard.timeline`, `dashboard.breakdown`

Le dashboard existant reste fonctionnel. Les nouveaux composants s'ajoutent en dessous des charts existants.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| DASH-S01 | DONE | API endpoints kpis/timeline/breakdown + types shared + validators |
| RBAC-S05 | DONE | Navigation masquee + usePermissions hook |
| OBS-S04 | DONE | Pattern API client + page UI (reference d'implementation) |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — DashboardKpiCards renders enriched KPIs
**Given** un utilisateur avec permission `dashboard:view` sur la page Dashboard
**When** la page charge
**Then** les KPI cards enrichies affichent : workflows (active/completed/failed), audit events (today/week/month), containers (running/stopped), drift (open alerts)

### AC2 — API client fetches enriched KPIs
**Given** l'API client
**When** `dashboardApi.kpis(companyId)` est appele
**Then** il retourne un objet `DashboardKpis` depuis GET /companies/:companyId/dashboard/kpis

### AC3 — API client fetches timeline
**Given** l'API client
**When** `dashboardApi.timeline(companyId, "7d")` est appele
**Then** il retourne un objet `DashboardTimeline` depuis GET /companies/:companyId/dashboard/timeline?period=7d

### AC4 — DashboardTimeline displays chart with period selector
**Given** la page Dashboard avec des donnees timeline
**When** l'utilisateur selectionne une periode (7d, 30d, 90d)
**Then** le graphique se met a jour avec les donnees de la periode selectionnee

### AC5 — API client fetches breakdown
**Given** l'API client
**When** `dashboardApi.breakdown(companyId, "agents")` est appele
**Then** il retourne un objet `DashboardBreakdown` depuis GET /companies/:companyId/dashboard/breakdown/agents

### AC6 — DashboardBreakdownPanel renders category breakdown
**Given** la page Dashboard
**When** l'utilisateur selectionne une categorie de breakdown (agents, workflows, audit, costs, containers)
**Then** le panel affiche la repartition sous forme de barres horizontales avec labels et counts

### AC7 — Query keys namespaced correctly
**Given** les React Query keys
**When** les hooks dashboard fetches s'executent
**Then** les keys utilisent le namespace `dashboard.kpis`, `dashboard.timeline`, `dashboard.breakdown`

### AC8 — Loading states display skeletons
**Given** la page Dashboard
**When** les donnees KPI/timeline/breakdown sont en chargement
**Then** des skeletons sont affiches a la place des composants

### AC9 — Error handling graceful
**Given** un endpoint dashboard qui retourne une erreur
**When** la page tente de charger
**Then** un message d'erreur s'affiche sans crasher la page

### AC10 — Backward compatibility with legacy dashboard
**Given** la page Dashboard existante
**When** l'utilisateur la visite
**Then** les MetricCards existantes (agents, tasks, costs, approvals, health) continuent de fonctionner normalement

### AC11 — data-testid on all interactive/verifiable elements
**Given** chaque composant DASH-S02
**When** il est rendu dans le DOM
**Then** il porte un attribut `data-testid="dash-s02-*"` unique

### AC12 — API client barrel export
**Given** le fichier `ui/src/api/dashboard.ts`
**When** il est importe
**Then** il exporte `dashboardApi` avec les methodes `kpis`, `timeline`, `breakdown` en plus de `summary`

---

## Deliverables

### D1 — API client enrichi (`ui/src/api/dashboard.ts`)
Etendre le client API existant avec 3 nouvelles methodes :
- `kpis(companyId)` — GET /companies/:companyId/dashboard/kpis → `DashboardKpis`
- `timeline(companyId, period)` — GET /companies/:companyId/dashboard/timeline?period=X → `DashboardTimeline`
- `breakdown(companyId, category)` — GET /companies/:companyId/dashboard/breakdown/:category → `DashboardBreakdown`

### D2 — Query keys (`ui/src/lib/queryKeys.ts`)
Enrichir le namespace `dashboard` avec :
- `dashboard.kpis(companyId)` → `["dashboard", companyId, "kpis"]`
- `dashboard.timeline(companyId, period)` → `["dashboard", companyId, "timeline", period]`
- `dashboard.breakdown(companyId, category)` → `["dashboard", companyId, "breakdown", category]`

### D3 — DashboardKpiCards component (`ui/src/components/DashboardKpiCards.tsx`)
Composant affichant 4 cartes KPI supplementaires :
- **Workflows** : active/completed/failed/total (icone Workflow)
- **Audit Events** : today/week/month (icone Shield)
- **Containers** : running/stopped/total (icone Container)
- **Drift Alerts** : open alerts count (icone AlertTriangle)

Chaque card suit le pattern MetricCard existant. Couleurs semantiques : success pour completed, warning pour drift/paused, error pour failed.

### D4 — DashboardTimeline component (`ui/src/components/DashboardTimeline.tsx`)
Composant affichant la timeline :
- Selecteur de periode (7d / 30d / 90d) via shadcn Select
- Graphique en barres (pattern ChartCard existant) montrant les metriques par jour
- 4 series : agents actifs, tasks completees, audit events, couts
- Loading skeleton pendant le fetch

### D5 — DashboardBreakdownPanel component (`ui/src/components/DashboardBreakdownPanel.tsx`)
Composant affichant les breakdowns :
- Selecteur de categorie (agents, workflows, audit, costs, containers) via shadcn Select
- Barres horizontales avec label + count + pourcentage
- Couleurs par statut (success pour running/active, error pour failed/error, warning pour paused, muted pour stopped/other)
- Loading skeleton pendant le fetch

### D6 — Dashboard page enrichie (`ui/src/pages/Dashboard.tsx`)
Integrer les 3 nouveaux composants dans la page existante :
- Section "Enterprise KPIs" avec DashboardKpiCards sous les MetricCards existantes
- Section "Activity Timeline" avec DashboardTimeline sous les ChartCards existantes
- Section "Breakdown" avec DashboardBreakdownPanel en bas de page
- Les sections existantes ne sont PAS modifiees

---

## Data-test-id Mapping

| data-testid | Element | Fichier |
|-------------|---------|---------|
| `dash-s02-kpi-cards` | Container DashboardKpiCards | DashboardKpiCards.tsx |
| `dash-s02-kpi-workflows` | Workflow KPI card | DashboardKpiCards.tsx |
| `dash-s02-kpi-audit` | Audit events KPI card | DashboardKpiCards.tsx |
| `dash-s02-kpi-containers` | Containers KPI card | DashboardKpiCards.tsx |
| `dash-s02-kpi-drift` | Drift alerts KPI card | DashboardKpiCards.tsx |
| `dash-s02-timeline` | Container DashboardTimeline | DashboardTimeline.tsx |
| `dash-s02-timeline-select` | Period selector | DashboardTimeline.tsx |
| `dash-s02-timeline-chart` | Timeline chart area | DashboardTimeline.tsx |
| `dash-s02-timeline-loading` | Timeline loading skeleton | DashboardTimeline.tsx |
| `dash-s02-breakdown` | Container DashboardBreakdownPanel | DashboardBreakdownPanel.tsx |
| `dash-s02-breakdown-select` | Category selector | DashboardBreakdownPanel.tsx |
| `dash-s02-breakdown-list` | Breakdown items list | DashboardBreakdownPanel.tsx |
| `dash-s02-breakdown-item` | Individual breakdown bar | DashboardBreakdownPanel.tsx |
| `dash-s02-breakdown-loading` | Breakdown loading skeleton | DashboardBreakdownPanel.tsx |
| `dash-s02-api-client` | (code marker) API client file | api/dashboard.ts |
| `dash-s02-query-keys` | (code marker) Query keys | lib/queryKeys.ts |

---

## Test Cases (E2E file-content based)

### Groupe 1: API client (T01-T06)
- T01 — API client file exports dashboardApi with kpis function
- T02 — API client kpis function calls GET /companies/:companyId/dashboard/kpis
- T03 — API client timeline function calls GET /companies/:companyId/dashboard/timeline with period param
- T04 — API client breakdown function calls GET /companies/:companyId/dashboard/breakdown/:category
- T05 — API client preserves legacy summary function
- T06 — API client imports DashboardKpis, DashboardTimeline, DashboardBreakdown types

### Groupe 2: Query keys (T07-T10)
- T07 — queryKeys.dashboard has kpis function returning namespaced key
- T08 — queryKeys.dashboard has timeline function returning namespaced key with period
- T09 — queryKeys.dashboard has breakdown function returning namespaced key with category
- T10 — Legacy queryKeys.dashboard function still exists for backward compatibility

### Groupe 3: DashboardKpiCards component (T11-T18)
- T11 — DashboardKpiCards file exists and exports named function
- T12 — Component renders dash-s02-kpi-cards container with data-testid
- T13 — Component renders dash-s02-kpi-workflows card with data-testid
- T14 — Component renders dash-s02-kpi-audit card with data-testid
- T15 — Component renders dash-s02-kpi-containers card with data-testid
- T16 — Component renders dash-s02-kpi-drift card with data-testid
- T17 — Component imports DashboardKpis type from @mnm/shared
- T18 — Component uses MetricCard or similar card pattern

### Groupe 4: DashboardTimeline component (T19-T24)
- T19 — DashboardTimeline file exists and exports named function
- T20 — Component renders dash-s02-timeline container with data-testid
- T21 — Component renders dash-s02-timeline-select period selector with data-testid
- T22 — Component renders dash-s02-timeline-chart area with data-testid
- T23 — Component imports DashboardTimeline type from @mnm/shared
- T24 — Component supports DASHBOARD_PERIODS values (7d, 30d, 90d)

### Groupe 5: DashboardBreakdownPanel component (T25-T32)
- T25 — DashboardBreakdownPanel file exists and exports named function
- T26 — Component renders dash-s02-breakdown container with data-testid
- T27 — Component renders dash-s02-breakdown-select category selector with data-testid
- T28 — Component renders dash-s02-breakdown-list items container with data-testid
- T29 — Component renders dash-s02-breakdown-item for each breakdown item with data-testid
- T30 — Component imports DashboardBreakdown type from @mnm/shared
- T31 — Component supports DASHBOARD_BREAKDOWN_CATEGORIES values
- T32 — Component renders bar widths based on percentage of total

### Groupe 6: Dashboard page integration (T33-T40)
- T33 — Dashboard.tsx imports DashboardKpiCards component
- T34 — Dashboard.tsx imports DashboardTimeline component
- T35 — Dashboard.tsx imports DashboardBreakdownPanel component
- T36 — Dashboard.tsx uses queryKeys.dashboard.kpis for useQuery
- T37 — Dashboard.tsx uses queryKeys.dashboard.timeline for useQuery
- T38 — Dashboard.tsx uses queryKeys.dashboard.breakdown for useQuery
- T39 — Dashboard.tsx passes companyId to new components
- T40 — Dashboard.tsx preserves legacy summary useQuery call

### Groupe 7: Type imports and safety (T41-T45)
- T41 — DashboardKpiCards accepts DashboardKpis or undefined as prop
- T42 — DashboardTimeline accepts companyId as prop
- T43 — DashboardBreakdownPanel accepts companyId as prop
- T44 — API dashboard.ts imports from @mnm/shared for type safety
- T45 — All three components handle loading states

### Groupe 8: Data-testid coverage (T46-T52)
- T46 — DashboardKpiCards contains data-testid="dash-s02-kpi-cards"
- T47 — DashboardKpiCards contains data-testid="dash-s02-kpi-workflows"
- T48 — DashboardKpiCards contains data-testid="dash-s02-kpi-audit"
- T49 — DashboardKpiCards contains data-testid="dash-s02-kpi-containers"
- T50 — DashboardKpiCards contains data-testid="dash-s02-kpi-drift"
- T51 — DashboardTimeline contains data-testid="dash-s02-timeline"
- T52 — DashboardBreakdownPanel contains data-testid="dash-s02-breakdown"

---

## Notes techniques

- **Pattern MetricCard** : reutiliser le composant MetricCard existant pour les KPI cards
- **Graphique timeline** : reutiliser le pattern ChartCard + bar chart existant dans ActivityCharts.tsx
- **Breakdowns** : barres horizontales CSS pur (width en %, pas de lib graphique additionnelle)
- **Backward compatibility** : la page Dashboard existante ne doit PAS etre cassee — les nouveaux composants s'ajoutent, pas de remplacement
- **Responsiveness** : grid-cols-2 sur mobile, grid-cols-4 sur desktop pour les KPI cards
- **Permission check** : les endpoints backend verifient deja `dashboard:view`, pas besoin de check cote frontend (le backend retournera 403)
