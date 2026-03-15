# DASH-S03 — Dashboard Temps Reel via WebSocket

> **Epic** : DASH — Dashboards par Role
> **Sprint** : Batch 13
> **Assignation** : Tom (backend + integration)
> **Effort** : S (2 SP, 1-2j)
> **Bloque par** : DASH-S01 (API dashboards) + DASH-S02 (DashboardCards UI)
> **ADR** : ADR-007

---

## Contexte

DASH-S02 a livre les composants frontend :
- `DashboardKpiCards` — affiche les KPIs enrichis (workflows, audit, containers, drift)
- `DashboardTimeline` — affiche la timeline avec selecteur de periode (7d/30d/90d)
- `DashboardBreakdownPanel` — affiche les breakdowns par categorie
- L'API client `dashboardApi` avec `kpis()`, `timeline()`, `breakdown()`
- Les query keys : `dashboard.kpis`, `dashboard.timeline`, `dashboard.breakdown`

Le systeme de live events existe deja :
- `server/src/services/live-events.ts` — `publishLiveEvent()` emet des evenements par companyId
- `server/src/realtime/live-events-ws.ts` — serveur WebSocket qui forward les events aux clients
- `ui/src/context/LiveUpdatesProvider.tsx` — ecoute les live events et invalidate les query caches React Query
- Le `LiveUpdatesProvider` gere deja les types : `heartbeat.run.*`, `agent.status`, `activity.logged`, `workflow.*`, `stage.*`, `workspace.context.changed`

**DASH-S03 connecte le dashboard au systeme temps reel** en :
1. Ajoutant un nouveau type de live event `dashboard.refresh` dans les constantes shared
2. Emettant `dashboard.refresh` depuis le serveur quand des events pertinents surviennent (workflow created/completed, agent status change, audit event, container status change, drift alert)
3. Ecoutant `dashboard.refresh` dans le `LiveUpdatesProvider` pour invalidater les queries `dashboard.kpis`, `dashboard.timeline`, `dashboard.breakdown`
4. Ajoutant un indicateur visuel "Live" dans le dashboard UI pour montrer que les donnees se mettent a jour en temps reel
5. Ajoutant un hook `useDashboardLiveIndicator` pour gerer l'animation du live pulse

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| DASH-S01 | DONE | API endpoints kpis/timeline/breakdown + types shared |
| DASH-S02 | DONE | DashboardKpiCards + DashboardTimeline + DashboardBreakdownPanel + API client + query keys |
| CHAT-S01 | DONE | WebSocket bidirectionnel (reference d'implementation) |
| OBS-S02 | DONE | Service audit emission (emet deja des live events) |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Dashboard.refresh live event type exists
**Given** le package shared
**When** on examine les constantes `LIVE_EVENT_TYPES`
**Then** le type `"dashboard.refresh"` est present dans la liste

### AC2 — Dashboard.refresh emitted on workflow events
**Given** un workflow cree ou complete dans la company
**When** le live event `workflow.created` ou `workflow.completed` est emis
**Then** un live event `dashboard.refresh` est emis dans la meme company avec un payload `{ source: "workflow" }`

### AC3 — Dashboard.refresh emitted on agent status change
**Given** un agent change de statut (running, error, etc.)
**When** le live event `agent.status` est emis
**Then** un live event `dashboard.refresh` est emis dans la meme company avec un payload `{ source: "agent" }`

### AC4 — Dashboard.refresh emitted on audit event creation
**Given** un nouvel audit event cree
**When** le live event `audit.event_created` est emis
**Then** un live event `dashboard.refresh` est emis dans la meme company avec un payload `{ source: "audit" }`

### AC5 — Dashboard.refresh emitted on container status change
**Given** un container change de statut (started, completed, failed)
**When** le live event `container.started` ou `container.completed` ou `container.failed` est emis
**Then** un live event `dashboard.refresh` est emis dans la meme company avec un payload `{ source: "container" }`

### AC6 — Dashboard.refresh emitted on drift alert
**Given** un drift alert cree ou resolu
**When** le live event `drift.alert_created` ou `drift.alert_resolved` est emis
**Then** un live event `dashboard.refresh` est emis dans la meme company avec un payload `{ source: "drift" }`

### AC7 — LiveUpdatesProvider invalidates dashboard queries on dashboard.refresh
**Given** le LiveUpdatesProvider connecte au WebSocket
**When** un event `dashboard.refresh` arrive
**Then** les queries `dashboard.kpis`, `dashboard.timeline`, et `dashboard.breakdown` sont invalidees pour la company courante

### AC8 — Live indicator visible on Dashboard page
**Given** un utilisateur sur la page Dashboard
**When** la page est chargee et le WebSocket connecte
**Then** un indicateur "Live" avec un pulse vert anime est visible dans le header du dashboard (data-testid="dash-s03-live-indicator")

### AC9 — Live indicator flashes on dashboard.refresh event
**Given** l'indicateur "Live" visible sur le dashboard
**When** un event `dashboard.refresh` arrive via WebSocket
**Then** l'indicateur pulse brievement plus intensement pendant 2 secondes (classe CSS transition)

### AC10 — Debounce prevents excessive invalidation
**Given** plusieurs events `dashboard.refresh` en rafale (ex: 10 agents changent de statut en 1s)
**When** les events arrivent
**Then** les queries sont invalidees au maximum une fois par seconde (debounce 1000ms)

### AC11 — Last refresh timestamp shown
**Given** un event `dashboard.refresh` recu
**When** l'indicateur "Live" est visible
**Then** un timestamp "Last updated X ago" est affiche a cote de l'indicateur (data-testid="dash-s03-last-refresh")

### AC12 — Existing dashboard invalidation preserved
**Given** les invalidations existantes dans LiveUpdatesProvider (agent.status invalidate dashboard, etc.)
**When** les events existants arrivent
**Then** le comportement existant est preserve — dashboard.refresh est un ajout, pas un remplacement

---

## Data-testid Map

| data-testid | Element | Composant |
|-------------|---------|-----------|
| `dash-s03-live-indicator` | Conteneur indicateur Live (dot + label + timestamp) | Dashboard.tsx |
| `dash-s03-live-dot` | Dot anime vert (pulse) | Dashboard.tsx |
| `dash-s03-live-label` | Label "Live" texte | Dashboard.tsx |
| `dash-s03-last-refresh` | Timestamp "Last updated X ago" | Dashboard.tsx |

---

## Deliverables

### D1 — Shared constants update
**Fichier** : `packages/shared/src/constants.ts`
- Ajouter `"dashboard.refresh"` a `LIVE_EVENT_TYPES`

### D2 — Dashboard refresh emitter service
**Fichier** : `server/src/services/dashboard-refresh.ts`
- `subscribeDashboardRefreshEvents()` — ecoute les live events pertinents (workflow, agent, audit, container, drift) et emet `dashboard.refresh`
- Debounce interne par companyId (max 1 emission par seconde)
- Le service s'initialise au demarrage du serveur

### D3 — Server initialization
**Fichier** : `server/src/services/index.ts`
- Importer et initialiser `subscribeDashboardRefreshEvents` au boot

### D4 — LiveUpdatesProvider update
**Fichier** : `ui/src/context/LiveUpdatesProvider.tsx`
- Ajouter handler pour `dashboard.refresh` dans `handleLiveEvent()`
- Invalidater `queryKeys.dashboard.kpis`, `queryKeys.dashboard.timeline`, `queryKeys.dashboard.breakdown`

### D5 — Dashboard Live Indicator hook
**Fichier** : `ui/src/hooks/useDashboardLiveIndicator.ts`
- Hook `useDashboardLiveIndicator()` qui :
  - Ecoute un custom event `dashboard:refresh` dispatche par le LiveUpdatesProvider
  - Gere un etat `isFlashing` (true pendant 2s apres un refresh)
  - Gere un etat `lastRefreshAt` (timestamp du dernier refresh)
  - Retourne `{ isLive, isFlashing, lastRefreshAt }`

### D6 — Dashboard.tsx integration
**Fichier** : `ui/src/pages/Dashboard.tsx`
- Ajouter le composant `DashboardLiveIndicator` en haut de la page
- Utiliser le hook `useDashboardLiveIndicator`
- Afficher le dot anime, le label "Live", et le timestamp

### D7 — Barrel exports
- `server/src/services/index.ts` — re-export dashboard-refresh
- `ui/src/hooks/` barrel if applicable

---

## Test Cases (Playwright E2E — file-content based)

| ID | Test | Fichier cible | Pattern |
|----|------|---------------|---------|
| T01 | `dashboard.refresh` in LIVE_EVENT_TYPES | `packages/shared/src/constants.ts` | `"dashboard.refresh"` |
| T02 | dashboard-refresh service file exists | `server/src/services/dashboard-refresh.ts` | `subscribeDashboardRefreshEvents` |
| T03 | dashboard-refresh subscribes to workflow events | `server/src/services/dashboard-refresh.ts` | `workflow.created` |
| T04 | dashboard-refresh subscribes to workflow.completed | `server/src/services/dashboard-refresh.ts` | `workflow.completed` |
| T05 | dashboard-refresh subscribes to agent.status | `server/src/services/dashboard-refresh.ts` | `agent.status` |
| T06 | dashboard-refresh subscribes to audit events | `server/src/services/dashboard-refresh.ts` | `audit.event_created` |
| T07 | dashboard-refresh subscribes to container events | `server/src/services/dashboard-refresh.ts` | `container.started` |
| T08 | dashboard-refresh subscribes to container.completed | `server/src/services/dashboard-refresh.ts` | `container.completed` |
| T09 | dashboard-refresh subscribes to container.failed | `server/src/services/dashboard-refresh.ts` | `container.failed` |
| T10 | dashboard-refresh subscribes to drift.alert_created | `server/src/services/dashboard-refresh.ts` | `drift.alert_created` |
| T11 | dashboard-refresh subscribes to drift.alert_resolved | `server/src/services/dashboard-refresh.ts` | `drift.alert_resolved` |
| T12 | dashboard-refresh emits dashboard.refresh | `server/src/services/dashboard-refresh.ts` | `dashboard.refresh` |
| T13 | dashboard-refresh has debounce logic | `server/src/services/dashboard-refresh.ts` | `debounce\|lastEmit\|DEBOUNCE` |
| T14 | dashboard-refresh payload includes source | `server/src/services/dashboard-refresh.ts` | `source` |
| T15 | dashboard-refresh exported from services index | `server/src/services/index.ts` | `dashboard-refresh` |
| T16 | LiveUpdatesProvider handles dashboard.refresh | `ui/src/context/LiveUpdatesProvider.tsx` | `dashboard.refresh` |
| T17 | LiveUpdatesProvider invalidates dashboard.kpis | `ui/src/context/LiveUpdatesProvider.tsx` | `dashboard\.kpis\|kpis` |
| T18 | LiveUpdatesProvider invalidates dashboard.timeline | `ui/src/context/LiveUpdatesProvider.tsx` | `dashboard\.timeline\|timeline` |
| T19 | LiveUpdatesProvider invalidates dashboard.breakdown | `ui/src/context/LiveUpdatesProvider.tsx` | `dashboard\.breakdown\|breakdown` |
| T20 | useDashboardLiveIndicator hook exists | `ui/src/hooks/useDashboardLiveIndicator.ts` | `useDashboardLiveIndicator` |
| T21 | useDashboardLiveIndicator tracks isFlashing | `ui/src/hooks/useDashboardLiveIndicator.ts` | `isFlashing` |
| T22 | useDashboardLiveIndicator tracks lastRefreshAt | `ui/src/hooks/useDashboardLiveIndicator.ts` | `lastRefreshAt` |
| T23 | useDashboardLiveIndicator dispatches custom event | `ui/src/context/LiveUpdatesProvider.tsx` | `dashboard:refresh` |
| T24 | useDashboardLiveIndicator 2s flash timeout | `ui/src/hooks/useDashboardLiveIndicator.ts` | `2000\|2_000\|2e3` |
| T25 | Dashboard.tsx has live indicator testid | `ui/src/pages/Dashboard.tsx` | `dash-s03-live-indicator` |
| T26 | Dashboard.tsx has live dot testid | `ui/src/pages/Dashboard.tsx` | `dash-s03-live-dot` |
| T27 | Dashboard.tsx has live label testid | `ui/src/pages/Dashboard.tsx` | `dash-s03-live-label` |
| T28 | Dashboard.tsx has last-refresh testid | `ui/src/pages/Dashboard.tsx` | `dash-s03-last-refresh` |
| T29 | Dashboard.tsx imports useDashboardLiveIndicator | `ui/src/pages/Dashboard.tsx` | `useDashboardLiveIndicator` |
| T30 | Dashboard.tsx shows "Live" text | `ui/src/pages/Dashboard.tsx` | `Live` |
| T31 | dashboard-refresh uses publishLiveEvent | `server/src/services/dashboard-refresh.ts` | `publishLiveEvent` |
| T32 | dashboard-refresh uses subscribeCompanyLiveEvents | `server/src/services/dashboard-refresh.ts` | `subscribeCompanyLiveEvents\|subscribe` |
| T33 | shared constants export LiveEventType includes dashboard.refresh | `packages/shared/src/constants.ts` | `dashboard\.refresh` |
| T34 | DashboardLiveIndicator uses animate-ping or pulse animation | `ui/src/pages/Dashboard.tsx` | `animate-ping\|pulse` |
| T35 | Existing agent.status handler still invalidates dashboard | `ui/src/context/LiveUpdatesProvider.tsx` | `agent\.status` |
| T36 | Existing dashboard query key still invalidated by heartbeat | `ui/src/context/LiveUpdatesProvider.tsx` | `queryKeys\.dashboard\(` |

---

## Architecture Notes

### Dashboard Refresh Flow
```
Server-side event (e.g., workflow.created)
  -> publishLiveEvent({ type: "workflow.created", ... })
  -> dashboard-refresh service catches it
  -> debounce per companyId (1s)
  -> publishLiveEvent({ type: "dashboard.refresh", companyId, payload: { source: "workflow" } })
  -> WebSocket server forwards to connected clients
  -> LiveUpdatesProvider receives dashboard.refresh
  -> Dispatches custom DOM event "dashboard:refresh"
  -> Invalidates dashboard.kpis, dashboard.timeline, dashboard.breakdown queries
  -> React Query re-fetches stale queries
  -> UI updates with fresh data
  -> useDashboardLiveIndicator catches custom event, flashes indicator
```

### Debounce Strategy
The dashboard-refresh service uses a per-company debounce with 1-second window. When multiple events arrive within the window, only one `dashboard.refresh` is emitted at the end of the window. This prevents excessive re-fetching when many events occur simultaneously (e.g., batch operations, multiple agents completing).

### Backward Compatibility
- The existing `dashboard(companyId)` query key invalidation by `agent.status`, `activity.logged`, etc. in `LiveUpdatesProvider` is PRESERVED
- `dashboard.refresh` adds ADDITIONAL invalidation for the new DASH-S02 queries (kpis, timeline, breakdown)
- No existing behavior is modified or removed
