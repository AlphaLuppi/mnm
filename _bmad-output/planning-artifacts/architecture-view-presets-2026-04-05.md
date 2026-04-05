# Architecture — View Presets : Dashboard & Navigation par Persona

> **Version** : 1.0 | **Date** : 2026-04-05 | **Statut** : Draft
> **Input** : Brainstorming session 2026-04-04 (Tom), session ID `1dd57728`
> **Scope** : Sidebar dynamique, dashboard par widget, landing page par rôle, overrides utilisateur, admin UI
> **Principe** : 1 nouvelle table + 2 colonnes. Zéro breaking change. Migration progressive en 5 phases.

---

## Table des Matières

1. [Architectural Drivers](#1-architectural-drivers)
2. [Principe Directeur — Le View Preset](#2-principe-directeur--le-view-preset)
3. [Data Architecture](#3-data-architecture)
4. [JSON Schema du Layout](#4-json-schema-du-layout)
5. [Presets de Référence](#5-presets-de-référence)
6. [Moteur de Résolution Frontend](#6-moteur-de-résolution-frontend)
7. [Registries Statiques](#7-registries-statiques)
8. [API Design](#8-api-design)
9. [Plan de Migration (5 phases)](#9-plan-de-migration-5-phases)
10. [Diagramme d'Architecture](#10-diagramme-darchitecture)
11. [Trade-offs & Décisions](#11-trade-offs--décisions)
12. [Résumé des Métriques](#12-résumé-des-métriques)

---

## 1. Architectural Drivers

| # | Driver | Conséquence architecturale |
|---|--------|---------------------------|
| AD-1 | **Personas multiples** | Un PM et un Dev ont des priorités métier différentes — la même sidebar dans le même ordre est un échec d'UX. |
| AD-2 | **Admin configurable** | L'admin doit pouvoir définir/éditer les layouts sans toucher au code. Tout doit être en DB. |
| AD-3 | **Minimaliste en DB** | Pas 25 tables. L'objectif est 1 table + 2 colonnes. Zéro table de jointure intermédiaire si évitable. |
| AD-4 | **Zero breaking change** | La sidebar et le dashboard actuels continuent de fonctionner — `DEFAULT_LAYOUT` est le fallback. |
| AD-5 | **Permissions = filet de sécurité** | Le layout définit ce qu'on VEUT montrer. Les permissions définissent ce qu'on PEUT montrer. Les permissions gagnent toujours. |
| AD-6 | **Registries statiques** | Les composants React (widgets, nav items) sont mappés statiquement. Pas de `eval()`, pas d'injection de code dynamique. |
| AD-7 | **Overrides sparses** | Les préférences utilisateur ne copient pas tout le preset — ils patchent seulement ce qui diffère. Un changement d'admin ne casse pas les overrides. |

---

## 2. Principe Directeur — Le View Preset

**Une seule abstraction : le View Preset.**

Un preset est un document JSON qui décrit l'expérience complète d'un persona :
- **Landing page** — où atterrit l'utilisateur après login
- **Sidebar** — quelles sections, dans quel ordre, quels items dans chaque section
- **Dashboard** — quels widgets, dans quel ordre, quelle taille

Il est stocké en DB (`view_presets`), attaché à un rôle via FK, et overridable par l'utilisateur via une colonne JSONB sur `company_memberships`.

### Séparation des concepts

```
RÔLE         = qui tu es     → permissions (ce que tu peux FAIRE)
VIEW PRESET  = ce que tu vois → layout (sidebar order, dashboard widgets, landing page)
```

Ces deux concepts sont orthogonaux. Un même preset peut être partagé entre plusieurs rôles (ex: "PM" et "Product Lead" ont le même dashboard). Un rôle peut changer de preset sans toucher à ses permissions.

### Couches de résolution

```
┌─────────────────────────────────────────┐
│ 1. Role's View Preset (from DB)         │  ← Admin définit
│    Layout complet : sidebar + dashboard │
├─────────────────────────────────────────┤
│ 2. User Overrides (from DB)             │  ← Utilisateur personnalise
│    Patches sparses : pin, hide, reorder │
├─────────────────────────────────────────┤
│ 3. Permission Filter (runtime)          │  ← Système enforce
│    Retire les items inaccessibles       │
└─────────────────────────────────────────┘
         ↓
    Layout Résolu Final
```

---

## 3. Data Architecture

### 3.1 Nouvelle Table

```sql
-- Migration 00XX_view_presets.sql
CREATE TABLE view_presets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  slug          TEXT NOT NULL,                    -- "pm", "dev", "exec", "default"
  name          TEXT NOT NULL,                    -- "Product Manager"
  description   TEXT,
  icon          TEXT,                             -- nom d'icône Lucide
  color         TEXT,                             -- couleur hex pour l'admin UI

  -- Le layout (le cœur du preset)
  layout        JSONB NOT NULL DEFAULT '{}',

  -- Scoping
  is_default    BOOLEAN NOT NULL DEFAULT false,   -- fallback pour les rôles sans preset

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(company_id, slug)
);

-- Lien roles → presets (M:1 — plusieurs rôles peuvent partager un preset)
ALTER TABLE roles ADD COLUMN view_preset_id UUID REFERENCES view_presets(id);

-- Overrides utilisateur — sur la table company_memberships existante
ALTER TABLE company_memberships ADD COLUMN layout_overrides JSONB;
```

**Bilan : 1 nouvelle table + 2 colonnes.**

| Élément | Rows typiques | Notes |
|---------|--------------|-------|
| `view_presets` | 4-8 par company | Presets par persona |
| `roles.view_preset_id` | 1 FK par rôle | Nullable — fallback sur `is_default` |
| `company_memberships.layout_overrides` | 1 JSONB par user | Nullable — sparse patches |

### 3.2 Seed Initial (Onboarding)

Lors de l'onboarding, on crée 4 presets par défaut et on les assigne aux rôles appropriés :

```
Preset "default" (is_default=true) → rôles sans preset assigné
Preset "pm"                         → rôle "Product Manager"
Preset "dev"                        → rôle "Developer"
Preset "exec"                       → rôle "Executive"
```

### 3.3 Query Backend (une seule requête)

```sql
-- GET /my-view
SELECT vp.*, cm.layout_overrides
FROM company_memberships cm
JOIN roles r ON r.id = cm.role_id
LEFT JOIN view_presets vp ON vp.id = r.view_preset_id
WHERE cm.company_id = $1
  AND cm.principal_type = 'user'
  AND cm.principal_id = $2;
```

**Fallback** : Si `view_preset_id` est NULL → retourner le preset `is_default = true`. Si aucun preset → `DEFAULT_LAYOUT` (le layout actuel hardcodé en TypeScript).

---

## 4. JSON Schema du Layout

```typescript
// packages/shared/src/types/view-preset.ts

/** Identifiants des items de navigation */
type NavItemId =
  | "dashboard" | "inbox" | "issues" | "workflows" | "workflow-editor"
  | "routines" | "goals" | "chat" | "folders" | "cursors" | "projects"
  | "agents" | "members" | "roles" | "tags" | "config-layers" | "feedback"
  | "org" | "costs" | "activity" | "audit" | "traces" | "containers"
  | "deployments" | "settings" | "sso" | "import-jira";

/** Une section de la sidebar */
interface SidebarSection {
  label: string;          // "Mon espace", "Supervision", "Admin"
  items: NavItemId[];     // liste ordonnée d'items
  collapsed?: boolean;    // état initial replié
}

/** Un widget du dashboard */
interface DashboardWidget {
  type: string;           // clé du registry : "kpi-bar", "run-activity", etc.
  span?: 1 | 2 | 3 | 4;  // colonnes occupées (grid 4-col, défaut 1)
  props?: Record<string, unknown>; // config spécifique au widget
}

/** Le document de layout complet */
interface ViewPresetLayout {
  /** Page de destination après login */
  landingPage: string;    // "/chat", "/dashboard", "/issues"

  /** Configuration de la sidebar */
  sidebar: {
    sections: SidebarSection[];
    showProjects?: boolean;   // défaut true
    showAgents?: boolean;     // défaut true
  };

  /** Grille de widgets du dashboard */
  dashboard: {
    widgets: DashboardWidget[];
  };
}

/** Overrides utilisateur (sparse — on ne surcharge que ce qui change) */
interface LayoutOverrides {
  landingPage?: string;
  sidebar?: {
    pinnedItems?: NavItemId[];     // épinglés en haut quelle que soit la section
    hiddenItems?: NavItemId[];     // cachés par choix utilisateur
    sectionOrder?: string[];       // réordonner les sections par label
  };
  dashboard?: {
    hiddenWidgets?: string[];      // cacher des widgets spécifiques par type
    extraWidgets?: DashboardWidget[]; // widgets personnels additionnels
  };
}
```

---

## 5. Presets de Référence

### Preset "PM" (Product Manager)

```json
{
  "landingPage": "/chat",
  "sidebar": {
    "sections": [
      { "label": "Mon espace", "items": ["chat", "folders", "inbox"] },
      { "label": "Suivi", "items": ["issues", "goals", "projects", "dashboard"] },
      { "label": "Équipe", "items": ["members", "agents", "org"] }
    ],
    "showProjects": false,
    "showAgents": false
  },
  "dashboard": {
    "widgets": [
      { "type": "chat-activity", "span": 2 },
      { "type": "my-folders",    "span": 2 },
      { "type": "recent-issues", "span": 2 },
      { "type": "team-activity", "span": 2 }
    ]
  }
}
```

**Logique PM** : Les issues ne sont qu'un outil de ticketing depuis le chat — elles arrivent en 4ème position dans la sidebar. La landing page est `/chat`. Le dashboard montre l'activité conversationnelle et les dossiers en priorité.

---

### Preset "Dev" (Developer)

```json
{
  "landingPage": "/issues",
  "sidebar": {
    "sections": [
      { "label": "Mon travail",  "items": ["issues", "inbox", "chat"] },
      { "label": "Exécution",   "items": ["agents", "workflows", "traces", "containers"] },
      { "label": "Projets",     "items": ["projects", "goals", "dashboard"] }
    ]
  },
  "dashboard": {
    "widgets": [
      { "type": "kpi-bar",       "span": 4 },
      { "type": "active-agents", "span": 2 },
      { "type": "my-issues",     "span": 2 },
      { "type": "run-activity",  "span": 2 },
      { "type": "success-rate",  "span": 2 }
    ]
  }
}
```

**Logique Dev** : Les issues sont le point d'entrée. Le dashboard montre les agents actifs, les issues assignées, l'activité d'exécution. Les traces et containers sont dans "Exécution" pour le debug quotidien.

---

### Preset "Exec" (Executive)

```json
{
  "landingPage": "/dashboard",
  "sidebar": {
    "sections": [
      { "label": "Vue d'ensemble", "items": ["dashboard", "costs", "org"] },
      { "label": "Suivi",         "items": ["goals", "projects", "feedback"] },
      { "label": "Audit",         "items": ["audit", "traces", "activity"] }
    ],
    "showProjects": false,
    "showAgents": false
  },
  "dashboard": {
    "widgets": [
      { "type": "kpi-bar",        "span": 4 },
      { "type": "cost-overview",  "span": 2 },
      { "type": "health-summary", "span": 2 },
      { "type": "team-activity",  "span": 4 }
    ]
  }
}
```

**Logique Exec** : Vue synthétique — coûts, santé globale, activité équipe. Pas de traces ni de containers (trop opérationnel). Landing page sur `/dashboard`.

---

### Preset "Default" (fallback)

Le `DEFAULT_LAYOUT` encode la sidebar **actuelle** en TypeScript — c'est le filet de sécurité pour tout rôle sans preset assigné.

```typescript
const DEFAULT_LAYOUT: ViewPresetLayout = {
  landingPage: "/dashboard",
  sidebar: {
    sections: [
      { label: "", items: ["dashboard", "inbox"] },
      { label: "Work", items: [
          "issues", "workflows", "workflow-editor", "routines",
          "goals", "chat", "folders", "cursors"
        ]
      },
      { label: "Company", items: [
          "members", "roles", "tags", "config-layers", "feedback",
          "org", "costs", "activity", "audit", "traces",
          "containers", "deployments", "settings", "sso", "import-jira"
        ]
      },
    ],
    showProjects: true,
    showAgents: true,
  },
  dashboard: {
    widgets: [
      { type: "kpi-bar",        span: 4 },
      { type: "run-activity",   span: 1 },
      { type: "priority-chart", span: 1 },
      { type: "status-chart",   span: 1 },
      { type: "success-rate",   span: 1 },
      { type: "kpi-enterprise", span: 4 },
      { type: "timeline",       span: 2 },
      { type: "breakdown",      span: 2 },
      { type: "recent-activity",span: 2 },
      { type: "recent-issues",  span: 2 },
    ],
  },
};
```

---

## 6. Moteur de Résolution Frontend

### Hook `useViewPreset()`

```typescript
// ui/src/hooks/useViewPreset.ts

function useViewPreset() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.viewPreset(selectedCompanyId!),
    queryFn: () => viewPresetApi.getMine(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000, // 1 min — les presets changent peu
  });

  const { hasPermission } = usePermissions();

  const resolvedLayout = useMemo(() => {
    if (!data) return DEFAULT_LAYOUT;
    return resolveLayout(data.preset.layout, data.overrides, hasPermission);
  }, [data, hasPermission]);

  return { layout: resolvedLayout, isLoading, presetName: data?.preset.name };
}
```

### Fonction `resolveLayout()`

```typescript
function resolveLayout(
  base: ViewPresetLayout,
  overrides: LayoutOverrides | null,
  hasPermission: (key: string) => boolean,
): ResolvedLayout {
  // Étape 1 : base du preset (rôle)
  let sidebar = base.sidebar;
  let dashboard = base.dashboard;
  let landingPage = base.landingPage;

  // Étape 2 : appliquer les overrides utilisateur (merge sparse)
  if (overrides?.landingPage) landingPage = overrides.landingPage;
  if (overrides?.sidebar?.hiddenItems) {
    sidebar = filterHiddenItems(sidebar, overrides.sidebar.hiddenItems);
  }
  if (overrides?.sidebar?.pinnedItems) {
    sidebar = applyPinnedItems(sidebar, overrides.sidebar.pinnedItems);
  }
  if (overrides?.dashboard?.hiddenWidgets) {
    dashboard = filterHiddenWidgets(dashboard, overrides.dashboard.hiddenWidgets);
  }

  // Étape 3 : filtre permission (le filet de sécurité)
  sidebar = filterByPermission(sidebar, hasPermission);

  // Étape 4 : valider la landing page est accessible
  if (!isRouteAccessible(landingPage, hasPermission)) {
    landingPage = findFirstAccessibleRoute(sidebar);
  }

  return { landingPage, sidebar, dashboard };
}
```

**Invariant de sécurité** : Même si un preset inclut `"audit"` dans la sidebar, si l'utilisateur n'a pas `audit:read`, l'item est retiré au step 3. Le layout définit l'intention, les permissions définissent la réalité.

---

## 7. Registries Statiques

### NAV_ITEM_REGISTRY

```typescript
// ui/src/lib/nav-registry.ts

const NAV_ITEM_REGISTRY: Record<NavItemId, NavItemDef> = {
  dashboard:         { to: "/dashboard",            icon: LayoutDashboard,     label: "Dashboard",       permission: "dashboard:view" },
  inbox:             { to: "/inbox",                icon: Inbox,               label: "Inbox",            permission: "issues:read" },
  issues:            { to: "/issues",               icon: CircleDot,           label: "Issues",           permission: "issues:read" },
  chat:              { to: "/chat",                 icon: MessageSquare,       label: "Chat",             permission: "chat:read" },
  folders:           { to: "/folders",              icon: FolderOpen,          label: "Folders",          permission: "folders:read" },
  workflows:         { to: "/workflows",            icon: Workflow,            label: "Workflows",        permission: "workflows:read" },
  "workflow-editor": { to: "/workflow-editor/new",  icon: PenTool,             label: "Workflow Editor",  permission: "workflows:create" },
  routines:          { to: "/routines",             icon: CalendarClock,       label: "Routines",         permission: "routines:read" },
  goals:             { to: "/goals",                icon: Target,              label: "Goals",            permission: "projects:read" },
  agents:            { to: "/agents",               icon: Bot,                 label: "Agents",           permission: "agents:read" },
  projects:          { to: "/projects",             icon: FolderKanban,        label: "Projects",         permission: "projects:read" },
  members:           { to: "/members",              icon: Users,               label: "Members",          permission: "users:read" },
  roles:             { to: "/admin/roles",          icon: Shield,              label: "Roles",            permission: "roles:read" },
  tags:              { to: "/admin/tags",           icon: Tag,                 label: "Tags",             permission: "tags:read" },
  "config-layers":   { to: "/admin/config-layers",  icon: Layers,              label: "Config Layers",    permission: "config_layers:read" },
  feedback:          { to: "/feedback",             icon: MessageSquareHeart,  label: "Feedback",         permission: "feedback:read" },
  org:               { to: "/org",                  icon: Network,             label: "Org",              permission: "org:view" },
  costs:             { to: "/costs",                icon: DollarSign,          label: "Costs",            permission: "dashboard:view" },
  activity:          { to: "/activity",             icon: History,             label: "Activity",         permission: "audit:read" },
  audit:             { to: "/audit",                icon: ScrollText,          label: "Audit Log",        permission: "audit:read" },
  traces:            { to: "/traces",               icon: Scan,                label: "Traces",           permission: "traces:read" },
  containers:        { to: "/containers",           icon: Box,                 label: "Sandboxes",        permission: "agents:manage_containers" },
  deployments:       { to: "/deployments",          icon: Globe,               label: "Deployments",      permission: "agents:launch" },
  settings:          { to: "/company/settings",     icon: Settings,            label: "Settings",         permission: "company:manage_settings" },
  sso:               { to: "/admin/sso",            icon: KeyRound,            label: "SSO",              permission: "company:manage_sso" },
  "import-jira":     { to: "/import/jira",          icon: Upload,              label: "Import Jira",      permission: "projects:manage" },
};
```

**Interface commune** :
```typescript
interface NavItemDef {
  to: string;
  icon: LucideIcon;
  label: string;
  permission: string;   // clé de permission requise pour voir l'item
}
```

---

### WIDGET_REGISTRY

```typescript
// ui/src/lib/widget-registry.ts

import { lazy } from "react";

const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  // ── KPIs ──
  "kpi-bar":          { component: lazy(() => import("../components/widgets/KpiBar")),              defaultSpan: 4, label: "KPI Bar" },

  // ── Charts ──
  "run-activity":     { component: lazy(() => import("../components/widgets/RunActivityWidget")),    defaultSpan: 1, label: "Run Activity" },
  "priority-chart":   { component: lazy(() => import("../components/widgets/PriorityWidget")),       defaultSpan: 1, label: "Issues by Priority" },
  "status-chart":     { component: lazy(() => import("../components/widgets/StatusWidget")),         defaultSpan: 1, label: "Issues by Status" },
  "success-rate":     { component: lazy(() => import("../components/widgets/SuccessRateWidget")),    defaultSpan: 1, label: "Success Rate" },

  // ── Panels ──
  "active-agents":    { component: lazy(() => import("../components/widgets/ActiveAgentsWidget")),   defaultSpan: 2, label: "Active Agents" },
  "recent-issues":    { component: lazy(() => import("../components/widgets/RecentIssuesWidget")),   defaultSpan: 2, label: "Recent Issues" },
  "recent-activity":  { component: lazy(() => import("../components/widgets/RecentActivityWidget")), defaultSpan: 2, label: "Recent Activity" },
  "team-activity":    { component: lazy(() => import("../components/widgets/TeamActivityWidget")),   defaultSpan: 2, label: "Team Activity" },
  "chat-activity":    { component: lazy(() => import("../components/widgets/ChatActivityWidget")),   defaultSpan: 2, label: "Chat Activity" },
  "my-folders":       { component: lazy(() => import("../components/widgets/MyFoldersWidget")),      defaultSpan: 2, label: "My Folders" },
  "my-issues":        { component: lazy(() => import("../components/widgets/MyIssuesWidget")),       defaultSpan: 2, label: "My Issues" },
  "cost-overview":    { component: lazy(() => import("../components/widgets/CostOverviewWidget")),   defaultSpan: 2, label: "Cost Overview" },
  "health-summary":   { component: lazy(() => import("../components/widgets/HealthSummaryWidget")),  defaultSpan: 2, label: "Health Summary" },

  // ── Enterprise ──
  "kpi-enterprise":   { component: lazy(() => import("../components/widgets/KpiEnterpriseWidget")),  defaultSpan: 4, label: "Enterprise KPIs" },
  "timeline":         { component: lazy(() => import("../components/widgets/TimelineWidget")),        defaultSpan: 2, label: "Timeline" },
  "breakdown":        { component: lazy(() => import("../components/widgets/BreakdownWidget")),       defaultSpan: 2, label: "Breakdown" },
};

interface WidgetDef {
  component: React.LazyExoticComponent<React.ComponentType<WidgetProps>>;
  defaultSpan: 1 | 2 | 3 | 4;
  label: string;  // pour l'éditeur admin
}

interface WidgetProps {
  companyId: string;
  span: number;
  props?: Record<string, unknown>;
}
```

**Stratégie lazy** : Chaque widget est chargé en `React.lazy()` — seuls les widgets du preset actif sont chargés. Un Exec ne charge jamais `ActiveAgentsWidget`.

---

## 8. API Design

### Routes

```
# Admin — CRUD view presets
GET    /companies/:companyId/view-presets          → lister tous les presets
POST   /companies/:companyId/view-presets          → créer un preset
PATCH  /companies/:companyId/view-presets/:id      → modifier un preset
DELETE /companies/:companyId/view-presets/:id      → supprimer un preset

# Admin — assigner un preset à un rôle
PATCH  /companies/:companyId/roles/:roleId         → { viewPresetId: "uuid" }
       (route existante — ajouter juste le champ viewPresetId)

# Utilisateur — obtenir MA vue résolue
GET    /companies/:companyId/my-view               → { preset, overrides }

# Utilisateur — sauvegarder MES overrides
PATCH  /companies/:companyId/my-view/overrides     → { pinnedItems, hiddenItems, ... }
```

### Response `GET /my-view`

```json
{
  "preset": {
    "id": "uuid",
    "slug": "pm",
    "name": "Product Manager",
    "icon": "briefcase",
    "color": "#6366f1",
    "layout": {
      "landingPage": "/chat",
      "sidebar": { "sections": [...] },
      "dashboard": { "widgets": [...] }
    }
  },
  "overrides": {
    "sidebar": {
      "pinnedItems": ["chat", "inbox"]
    }
  }
}
```

Si `overrides` est null, le frontend utilise le layout du preset tel quel.

### Validation

Le backend valide le JSONB `layout` contre le schéma TypeScript à l'écriture (via Zod). Les `NavItemId` invalides et les `type` de widgets inconnus sont rejetés avec une erreur 400 explicite.

---

## 9. Plan de Migration (5 phases)

### Phase 0 — DEFAULT_LAYOUT (Pré-requis, ~1h)

Encoder la sidebar actuelle comme constante TypeScript `DEFAULT_LAYOUT`. C'est le filet de sécurité que toutes les phases suivantes utilisent comme fallback. **Aucune migration DB, aucun changement UI.**

**Sortie** : `packages/shared/src/types/view-preset.ts` + `DEFAULT_LAYOUT` constant.

---

### Phase 1 — DB + API + Hook (~1 jour)

1. Migration SQL : créer `view_presets` + 2 colonnes
2. Seed : créer le preset "Default" (`is_default=true`) avec `DEFAULT_LAYOUT`
3. API : 6 routes (CRUD presets + my-view + overrides)
4. Hook : `useViewPreset()` + `resolveLayout()` + registries

**Ne pas encore toucher la Sidebar ni le Dashboard.** Le hook est prêt mais pas consommé — la sidebar reste hardcodée. C'est intentionnel.

**Sortie** : Migration, routes, hook. Tests unitaires sur `resolveLayout()`.

---

### Phase 2 — Sidebar Dynamique (~0.5 jour)

Remplacer `Sidebar.tsx` pour consommer `useViewPreset().layout.sidebar`.

**Avant :**
```tsx
{canViewIssues && <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />}
{canViewWorkflows && <SidebarNavItem to="/workflows" label="Workflows" icon={Workflow} />}
```

**Après :**
```tsx
{layout.sidebar.sections.map(section => (
  <SidebarSection key={section.label} label={section.label}>
    {section.items.map(itemId => {
      const def = NAV_ITEM_REGISTRY[itemId];
      if (!def || !hasPermission(def.permission)) return null;
      return <SidebarNavItem key={itemId} to={def.to} label={def.label} icon={def.icon} />;
    })}
  </SidebarSection>
))}
```

Tant qu'aucun preset n'est assigné aux rôles, le `DEFAULT_LAYOUT` est utilisé — la sidebar reste identique. Zero régression visible.

---

### Phase 3 — Dashboard Dynamique (~0.5 jour)

Remplacer `Dashboard.tsx` pour rendre les widgets depuis `useViewPreset().layout.dashboard`.

```tsx
<div className="grid grid-cols-4 gap-4">
  {layout.dashboard.widgets.map((widget, i) => {
    const def = WIDGET_REGISTRY[widget.type];
    if (!def) return null;
    const Widget = def.component;
    return (
      <div key={i} className={`col-span-${widget.span ?? def.defaultSpan}`}>
        <Suspense fallback={<WidgetSkeleton />}>
          <Widget companyId={companyId} span={widget.span ?? def.defaultSpan} props={widget.props} />
        </Suspense>
      </div>
    );
  })}
</div>
```

Même logique fallback : tant que le preset = DEFAULT_LAYOUT, le dashboard est identique.

---

### Phase 4 — Landing Page Dynamique (~0.5 jour)

```tsx
function CompanyRootRedirect() {
  const { layout } = useViewPreset();
  const targetCompany = selectedCompany ?? companies[0];
  return <Navigate to={`/${targetCompany.issuePrefix}${layout.landingPage}`} replace />;
}
```

C'est la fonctionnalité la plus impactante : un PM atterrit sur `/chat`, un Dev sur `/issues`, un Exec sur `/dashboard` — sans rien toucher d'autre. **1 ligne de code.**

---

### Phase 5 — Admin UI (~2-3 jours)

- Page `/admin/view-presets` — CRUD des presets avec éditeur JSON + preview live
- Dropdown dans AdminRoles pour assigner un preset à un rôle
- "Preview as [PM]" — mode admin pour tester un layout sans changer de rôle
- Settings utilisateur — toggle pin/hide d'items sidebar

L'éditeur visuel drag-and-drop peut venir en Phase 5+.

---

## 10. Diagramme d'Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        ADMIN                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────┐    │
│  │ Preset CRUD │   │ Role → Preset│   │ Preview "as X" │    │
│  └──────┬──────┘   └──────┬───────┘   └───────┬────────┘    │
└─────────┼─────────────────┼───────────────────┼──────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                      API LAYER                                │
│  POST/PATCH/DELETE /view-presets    GET /my-view              │
│  PATCH /roles/:id {viewPresetId}   PATCH /my-view/overrides  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      DATABASE                                 │
│  ┌───────────────┐  ┌────────┐  ┌────────────────────────┐  │
│  │  view_presets  │←─│ roles  │  │  company_memberships    │  │
│  │ (layout JSONB) │  │  (FK)  │  │  (layout_overrides JSONB)│  │
│  └───────────────┘  └────────┘  └────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND                                   │
│                                                               │
│  useViewPreset() ─── GET /my-view ──┐                        │
│       │                              │                        │
│       ▼                              ▼                        │
│  resolveLayout(preset, overrides, hasPermission)             │
│       │                                                       │
│       ├──→ Sidebar (sections → registry → permission filter)  │
│       ├──→ Dashboard (widgets → registry → lazy load)        │
│       └──→ Landing Page (redirect après login)                │
│                                                               │
│  NAV_ITEM_REGISTRY ── map statique { id → icon, route, perm }│
│  WIDGET_REGISTRY   ── map statique { type → Component, span }│
│                                                               │
│  DEFAULT_LAYOUT ── fallback TypeScript (sidebar actuelle)    │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Trade-offs & Décisions

| Décision | Gain | Coût |
|----------|------|------|
| **Table séparée `view_presets`** vs JSONB sur `roles` | Presets partageables entre rôles, cache RBAC non pollué | 1 jointure de plus sur `/my-view` |
| **Overrides sur `company_memberships`** vs table séparée | Pas de nouvelle table, 1 seul ALTER | Colonne nullable sur table existante |
| **Registries statiques** (nav + widgets) | Type-safe, pas d'injection de code, lazy loading natif | Rebuild requis pour ajouter un widget |
| **Overrides sparses** (pas de copie complète) | Un changement admin ne casse pas les préférences utilisateur | Merge logic légèrement plus complexe |
| **DEFAULT_LAYOUT comme fallback** | Zero breaking change, migration progressive en 5 phases | Faut maintenir le fallback en sync avec la sidebar réelle |
| **`is_default` flag** sur un seul preset | Pas besoin de config "no role assigned" | Contrainte d'unicité à enforcer (CHECK ou application level) |
| **Pas de json-render (Vercel)** | Zéro dépendance externe, contrôle total, pas de génération LLM à l'exécution | On construit le renderer soi-même (~50 lignes React) |
| **Validation Zod côté backend** | Rejette les layouts invalides à l'écriture | Un schema Zod à maintenir en sync avec les types TypeScript |

---

## 12. Résumé des Métriques

| Métrique | Valeur |
|----------|--------|
| **Nouvelles tables DB** | 1 (`view_presets`) |
| **Colonnes ajoutées** | 2 (`roles.view_preset_id`, `company_memberships.layout_overrides`) |
| **Nouvelles routes API** | 6 |
| **Route existante modifiée** | 1 (`PATCH /roles/:roleId` — champ `viewPresetId`) |
| **Nouveaux hooks frontend** | 1 (`useViewPreset`) |
| **Nouvelles fonctions** | 1 (`resolveLayout`) |
| **Registries frontend** | 2 (`NAV_ITEM_REGISTRY`, `WIDGET_REGISTRY`) |
| **Widgets initiaux** | 15 |
| **Breaking changes** | 0 (fallback `DEFAULT_LAYOUT`) |
| **Presets seedés à l'onboarding** | 4 (Default, PM, Dev, Exec) |
| **Effort total estimé** | ~5 jours (Phase 0→5) |
