# Brainstorming — View Presets : Dashboard & Navigation par Persona

> **Date** : 4 avril 2026
> **Session ID** : `1dd57728-2da7-4c08-8cba-b3f28b149221`
> **Participants** : Tom (direction produit), Claude (architecture)
> **Statut** : Brainstorming termine, architecture validee, pret pour implementation

---

## 1. Demande initiale (Tom)

> Je veux brainstormer sur le fait de faire un Dashboard et une navigation differente selon les utilisateurs et leurs roles. Et pouvoir config cela depuis l'admin. Par exemple un PM devrait avoir le chat et les folders mis en avant plutot que les issues. Les issues ne seront qu'un outil utilise par leurs sessions de chat pour envoyer des tickets aux devs/market. C'est qu'un exemple mais voila l'idee. Plusieurs persona vont utiliser l'app et j'aimerais pouvoir customiser les affichages. Est-ce que json-render pourrait nous aider ?

## 2. Direction architecturale (Tom)

> Vas-y moi j'ai pas de soucis a faire le truc le plus style possible. On a le temps, l'argent et les ressources pour. Mais faut prendre le temps, reflechir comme un architecte proprement a un modele scalable et qui rajoute pas trop de complexite a la DB et qui reste simple en logique meme si complexe en pratique. Pas 25 tables etc…

---

## 3. Etat des lieux

**Ce qui existe deja :**
- Sidebar avec ~25 items, chacun protege par une permission (`issues:read`, `chat:read`, etc.)
- `RequirePermission` component + `usePermissions()` hook
- 140+ permissions, 5 roles presets (Viewer → Owner), tags pour la visibilite
- Dashboard unique avec KPIs fixes (agents, issues, costs, security)
- **Aucune table DB pour la config de dashboard/layout par role**

**Constat :** Tout est permission-based (show/hide), mais il n'y a aucune notion de priorite, d'ordre, ou de layout par role. Un PM et un Dev voient les memes items dans le meme ordre — juste certains sont caches.

---

## 4. Brainstorming structure

### 4.1 Mind Map — Les dimensions du probleme

```
                    ┌─ Sidebar order (quels items en premier)
                    ├─ Sidebar grouping (sections differentes par persona)
       Navigation ──├─ Default landing page (PM → /chat, Dev → /issues)
                    ├─ Pinned/favorite items
                    └─ Hidden items (pas juste par permission, par choix)

                    ┌─ Widget grid (quels widgets, quel ordre)
                    ├─ KPI cards (PM: chat activity, Dev: open issues)
       Dashboard ───├─ Charts (different datasets per persona)
                    ├─ Quick actions (PM: new chat, Dev: take issue)
                    └─ Layout (2-col, 3-col, full-width)

                    ┌─ Role-level defaults (admin configure)
       Config ──────├─ User-level overrides (personal customization)
                    ├─ Storage: DB table vs JSON column
                    └─ Live preview dans l'admin

                    ┌─ JSON schema stored in DB
       Rendering ───├─ Component registry (map string → React component)
                    ├─ json-render (Vercel) for AI-generated layouts
                    └─ Custom lightweight engine
```

### 4.2 SCAMPER — Transformer l'existant

| Transformation | Application |
|---|---|
| **Substitute** | Remplacer la sidebar hardcodee par un tableau `nav_items` en DB, resolu par role |
| **Combine** | Fusionner permissions + layout config dans un seul concept "Role Profile" (permissions + dashboard + nav + landing page) |
| **Adapt** | Adapter le systeme de Config Layers (deja fait pour les agents) pour les **UI Layouts** — un layer = un preset de dashboard |
| **Modify** | Modifier le dashboard actuel pour devenir un **widget grid** ou chaque widget est un composant independant |
| **Put to other uses** | Reutiliser le tag system : un tag "pm-view" pourrait porter un layout, pas juste de la visibilite |
| **Eliminate** | Eliminer le concept de "sidebar fixe" — chaque section devient un widget/module qu'on place ou on veut |
| **Reverse** | Au lieu que l'admin definisse tout, l'utilisateur **choisit son persona** a l'onboarding et peut ensuite personnaliser |

### 4.3 SWOT — json-render vs alternatives

**Option A : json-render (Vercel)**

| | |
|---|---|
| **Forces** | Cross-framework, streaming JSON→components, type-safe, AI-friendly (l'admin pourrait decrire un layout en langage naturel) |
| **Faiblesses** | Dependance LLM pour generer les layouts, overhead pour un cas relativement simple, lib recente (risque de breaking changes) |
| **Opportunites** | MnM a deja des agents IA — un agent pourrait generer le dashboard optimal pour un role. Coherent avec la vision "AI-first" |
| **Menaces** | Over-engineering : on n'a pas besoin de generation dynamique a l'execution, on a besoin de **presets configurables** |

**Option B : Schema JSON custom + Component Registry**

| | |
|---|---|
| **Forces** | Simple, pas de dependance externe, controle total, facile a stocker en DB (JSONB), facile a editer dans l'admin |
| **Faiblesses** | Faut construire le renderer soi-meme (mais c'est ~50 lignes en React) |
| **Opportunites** | S'integre parfaitement avec le RBAC existant (role → layout JSON → renderer) |
| **Menaces** | Risque de reinventer la roue si les besoins grandissent (drag-and-drop, nested layouts) |

**Option C : Server-Driven UI (SDUI) pattern (Airbnb/Shopify)**

| | |
|---|---|
| **Forces** | Pattern prouve a l'echelle enterprise, separe completement le layout du code |
| **Faiblesses** | Massif overkill pour MnM (on n'a pas iOS/Android), complexite GraphQL |
| **Opportunites** | Si MnM scale vers mobile un jour, le travail est deja fait |
| **Menaces** | Temps de dev enorme, perte d'agilite frontend |

---

## 5. Synthese des idees generees

### Categorie 1 : Modele de donnees
1. **Table `role_layouts`** — Un JSON layout par role (sidebar order, dashboard widgets, landing page)
2. **Table `user_layout_overrides`** — Overrides personnels par utilisateur (sur la base de son role)
3. **Colonne JSONB sur `roles`** — Plus simple : ajouter `dashboard_config JSONB` directement sur la table `roles`
4. **Reutiliser Config Layers** — Un "UI Layer" attache au role, meme mecanique de merge/priority

### Categorie 2 : Architecture frontend
5. **Component Registry** — Map `{ "kpi-agents": KpiAgentsWidget, "recent-activity": RecentActivity, ... }`
6. **Widget system** — Chaque widget est un composant auto-suffisant avec `id`, `title`, `size`, `permissions`
7. **Nav Priority System** — Chaque nav item a un `order: number` resolu par role (au lieu de hardcode)
8. **Landing Page Router** — Le role definit la page par defaut apres login (`/chat` pour PM, `/issues` pour Dev)

### Categorie 3 : Admin UX
9. **Visual Layout Editor** — Drag-and-drop dans l'admin pour composer le dashboard par role
10. **Preview Mode** — "Voir comme [PM]" dans l'admin pour tester les layouts
11. **Preset Templates** — PM, Dev, Manager, Exec — modifiables par l'admin
12. **AI Layout Generator** — L'admin decrit "je veux que les PMs voient surtout le chat" → layout JSON genere

### Categorie 4 : Personnalisation utilisateur
13. **Persona picker a l'onboarding** — L'utilisateur choisit son profil (PM, Dev, etc.) et recoit le layout associe
14. **Pin/Unpin sidebar items** — Chaque utilisateur peut pin ses items favoris en haut
15. **Dashboard widget toggle** — Montrer/cacher des widgets sans toucher au layout global
16. **"Focus mode"** — L'utilisateur peut temporairement passer en mode "chat-only" ou "issues-only"

---

## 6. Insights cles

### Insight 1 : JSON custom + Component Registry > json-render
json-render est seduisant mais overkill. Le besoin est des **presets configurables**, pas de la generation dynamique. Un schema JSON en DB + un registry de ~15 widgets React est plus simple, plus fiable, et zero dependance.
**Impact :** High | **Effort :** Low

### Insight 2 : Table separee `view_presets` (pas JSONB sur roles)
Un role = qui tu es (permissions). Un preset = ce que tu vois (layout). Ce sont deux concepts orthogonaux. Un meme preset pourrait etre partage entre plusieurs roles. La colonne `roles` est deja chargee dans le cache RBAC (5min TTL) — y ajouter un gros JSONB pollue le cache.
**Impact :** High | **Effort :** Low

### Insight 3 : 3 niveaux — Role default → User override → Permission filter
Le layout final est une composition : (1) Le role definit le layout par defaut, (2) L'utilisateur peut override, (3) Les permissions filtrent en dernier (safety net).
**Impact :** High | **Effort :** Medium

### Insight 4 : Le landing page par role est le quick win le plus impactant
Avant meme de toucher au dashboard ou aux widgets, juste router le PM vers `/chat` et le Dev vers `/issues` apres login change radicalement l'experience.
**Impact :** High | **Effort :** Very Low (1 champ sur le role, 3 lignes dans le router)

---

## 7. Architecture retenue — View Presets

### 7.1 Principe directeur

**Une seule abstraction : le View Preset.** Un preset est un document JSON qui decrit l'experience complete d'un persona — landing page, sidebar, dashboard. Stocke en DB, attache a un role, overridable par l'utilisateur. Le frontend le consomme via un hook unique et rend tout dynamiquement.

### 7.2 Data Model — 1 table + 2 colonnes

```sql
CREATE TABLE view_presets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  slug          TEXT NOT NULL,                    -- "pm", "dev", "exec", "default"
  name          TEXT NOT NULL,                    -- "Product Manager"
  description   TEXT,
  icon          TEXT,                             -- lucide icon name
  color         TEXT,                             -- hex color for admin UI
  layout        JSONB NOT NULL DEFAULT '{}',
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

-- Link roles → presets (M:1 — many roles can share one preset)
ALTER TABLE roles ADD COLUMN view_preset_id UUID REFERENCES view_presets(id);

-- User overrides — stored on the existing company_memberships table
ALTER TABLE company_memberships ADD COLUMN layout_overrides JSONB;
```

**Bilan : 1 nouvelle table + 2 colonnes. C'est tout.**
- `view_presets` — les presets (5-10 rows par company)
- `roles.view_preset_id` — le lien role → preset
- `company_memberships.layout_overrides` — les overrides perso de l'utilisateur

### 7.3 JSON Schema du Layout

```typescript
// packages/shared/src/types/view-preset.ts

type NavItemId =
  | "dashboard" | "inbox" | "issues" | "workflows" | "workflow-editor"
  | "routines" | "goals" | "chat" | "folders" | "cursors" | "projects"
  | "agents" | "members" | "roles" | "tags" | "config-layers" | "feedback"
  | "org" | "costs" | "activity" | "audit" | "traces" | "containers"
  | "deployments" | "settings" | "sso" | "import-jira";

interface SidebarSection {
  label: string;
  items: NavItemId[];
  collapsed?: boolean;
}

interface DashboardWidget {
  type: string;
  span?: 1 | 2 | 3 | 4;
  props?: Record<string, unknown>;
}

interface ViewPresetLayout {
  landingPage: string;
  sidebar: {
    sections: SidebarSection[];
    showProjects?: boolean;
    showAgents?: boolean;
  };
  dashboard: {
    widgets: DashboardWidget[];
  };
}

interface LayoutOverrides {
  landingPage?: string;
  sidebar?: {
    pinnedItems?: NavItemId[];
    hiddenItems?: NavItemId[];
    sectionOrder?: string[];
  };
  dashboard?: {
    hiddenWidgets?: string[];
    extraWidgets?: DashboardWidget[];
  };
}
```

### 7.4 Exemples concrets de presets

**Preset PM :**
```json
{
  "landingPage": "/chat",
  "sidebar": {
    "sections": [
      { "label": "Mon espace", "items": ["chat", "folders", "inbox"] },
      { "label": "Suivi", "items": ["issues", "goals", "projects", "dashboard"] },
      { "label": "Equipe", "items": ["members", "agents", "org"] }
    ],
    "showProjects": false,
    "showAgents": false
  },
  "dashboard": {
    "widgets": [
      { "type": "chat-activity", "span": 2 },
      { "type": "my-folders", "span": 2 },
      { "type": "recent-issues", "span": 2 },
      { "type": "team-activity", "span": 2 }
    ]
  }
}
```

**Preset Dev :**
```json
{
  "landingPage": "/issues",
  "sidebar": {
    "sections": [
      { "label": "Mon travail", "items": ["issues", "inbox", "chat"] },
      { "label": "Execution", "items": ["agents", "workflows", "traces", "containers"] },
      { "label": "Projets", "items": ["projects", "goals", "dashboard"] }
    ]
  },
  "dashboard": {
    "widgets": [
      { "type": "kpi-bar", "span": 4 },
      { "type": "active-agents", "span": 2 },
      { "type": "my-issues", "span": 2 },
      { "type": "run-activity", "span": 2 },
      { "type": "success-rate", "span": 2 }
    ]
  }
}
```

**Preset Exec :**
```json
{
  "landingPage": "/dashboard",
  "sidebar": {
    "sections": [
      { "label": "Vue d'ensemble", "items": ["dashboard", "costs", "org"] },
      { "label": "Suivi", "items": ["goals", "projects", "feedback"] },
      { "label": "Audit", "items": ["audit", "traces", "activity"] }
    ],
    "showProjects": false,
    "showAgents": false
  },
  "dashboard": {
    "widgets": [
      { "type": "kpi-bar", "span": 4 },
      { "type": "cost-overview", "span": 2 },
      { "type": "health-summary", "span": 2 },
      { "type": "team-activity", "span": 4 }
    ]
  }
}
```

### 7.5 Moteur de resolution frontend (3 couches)

```
┌─────────────────────────────────────────┐
│ 1. Role's View Preset (from DB)         │  ← Admin defines
│    Full layout: sidebar + dashboard     │
├─────────────────────────────────────────┤
│ 2. User Overrides (from DB)             │  ← User customizes
│    Sparse patches: pin, hide, reorder   │
├─────────────────────────────────────────┤
│ 3. Permission Filter (runtime)          │  ← System enforces
│    Remove items user can't access       │
└─────────────────────────────────────────┘
         ↓
    Final Resolved Layout
```

**Hook `useViewPreset()` :**
```typescript
function useViewPreset() {
  const { selectedCompanyId } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.viewPreset(selectedCompanyId!),
    queryFn: () => viewPresetApi.getMine(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });
  const { hasPermission } = usePermissions();
  const resolvedLayout = useMemo(() => {
    if (!data) return DEFAULT_LAYOUT;
    return resolveLayout(data.preset.layout, data.overrides, hasPermission);
  }, [data, hasPermission]);
  return { layout: resolvedLayout, isLoading, presetName: data?.preset.name };
}
```

**Fonction `resolveLayout()` :**
```typescript
function resolveLayout(
  base: ViewPresetLayout,
  overrides: LayoutOverrides | null,
  hasPermission: (key: string) => boolean,
): ResolvedLayout {
  // Step 1: Start with base preset
  let sidebar = base.sidebar;
  let dashboard = base.dashboard;
  let landingPage = base.landingPage;

  // Step 2: Apply user overrides (sparse merge)
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

  // Step 3: Permission filter (the safety net)
  sidebar = filterByPermission(sidebar, hasPermission);

  // Step 4: Validate landing page is accessible
  if (!isRouteAccessible(landingPage, hasPermission)) {
    landingPage = findFirstAccessibleRoute(sidebar);
  }

  return { landingPage, sidebar, dashboard };
}
```

### 7.6 NAV_ITEM_REGISTRY — 26 items

```typescript
const NAV_ITEM_REGISTRY: Record<NavItemId, NavItemDef> = {
  dashboard:       { to: "/dashboard",         icon: LayoutDashboard, label: "Dashboard",       permission: "dashboard:view" },
  inbox:           { to: "/inbox",             icon: Inbox,           label: "Inbox",            permission: "issues:read" },
  issues:          { to: "/issues",            icon: CircleDot,       label: "Issues",           permission: "issues:read" },
  chat:            { to: "/chat",              icon: MessageSquare,   label: "Chat",             permission: "chat:read" },
  folders:         { to: "/folders",           icon: FolderOpen,      label: "Folders",          permission: "folders:read" },
  workflows:       { to: "/workflows",         icon: Workflow,        label: "Workflows",        permission: "workflows:read" },
  "workflow-editor": { to: "/workflow-editor/new", icon: PenTool,     label: "Workflow Editor",  permission: "workflows:create" },
  routines:        { to: "/routines",          icon: CalendarClock,   label: "Routines",         permission: "routines:read" },
  goals:           { to: "/goals",             icon: Target,          label: "Goals",            permission: "projects:read" },
  agents:          { to: "/agents",            icon: Bot,             label: "Agents",           permission: "agents:read" },
  projects:        { to: "/projects",          icon: FolderKanban,    label: "Projects",         permission: "projects:read" },
  members:         { to: "/members",           icon: Users,           label: "Members",          permission: "users:read" },
  roles:           { to: "/admin/roles",       icon: Shield,          label: "Roles",            permission: "roles:read" },
  tags:            { to: "/admin/tags",        icon: Tag,             label: "Tags",             permission: "tags:read" },
  "config-layers": { to: "/admin/config-layers", icon: Layers,       label: "Config Layers",    permission: "config_layers:read" },
  feedback:        { to: "/feedback",          icon: MessageSquareHeart, label: "Feedback",      permission: "feedback:read" },
  org:             { to: "/org",               icon: Network,         label: "Org",              permission: "org:view" },
  costs:           { to: "/costs",             icon: DollarSign,      label: "Costs",            permission: "dashboard:view" },
  activity:        { to: "/activity",          icon: History,         label: "Activity",         permission: "audit:read" },
  audit:           { to: "/audit",             icon: ScrollText,      label: "Audit Log",        permission: "audit:read" },
  traces:          { to: "/traces",            icon: Scan,            label: "Traces",           permission: "traces:read" },
  containers:      { to: "/containers",        icon: Box,             label: "Sandboxes",        permission: "agents:manage_containers" },
  deployments:     { to: "/deployments",       icon: Globe,           label: "Deployments",      permission: "agents:launch" },
  settings:        { to: "/company/settings",  icon: Settings,        label: "Settings",         permission: "company:manage_settings" },
  sso:             { to: "/admin/sso",         icon: KeyRound,        label: "SSO",              permission: "company:manage_sso" },
  "import-jira":   { to: "/import/jira",       icon: Upload,          label: "Import Jira",      permission: "projects:manage" },
};
```

### 7.7 WIDGET_REGISTRY — 15 widgets

```typescript
const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  // KPIs
  "kpi-bar":         { component: lazy(() => import("../components/widgets/KpiBar")),          defaultSpan: 4, label: "KPI Bar" },

  // Charts
  "run-activity":    { component: lazy(() => import("../components/widgets/RunActivityWidget")), defaultSpan: 1, label: "Run Activity" },
  "priority-chart":  { component: lazy(() => import("../components/widgets/PriorityWidget")),   defaultSpan: 1, label: "Issues by Priority" },
  "status-chart":    { component: lazy(() => import("../components/widgets/StatusWidget")),     defaultSpan: 1, label: "Issues by Status" },
  "success-rate":    { component: lazy(() => import("../components/widgets/SuccessRateWidget")), defaultSpan: 1, label: "Success Rate" },

  // Panels
  "active-agents":   { component: lazy(() => import("../components/widgets/ActiveAgentsWidget")), defaultSpan: 2, label: "Active Agents" },
  "recent-issues":   { component: lazy(() => import("../components/widgets/RecentIssuesWidget")), defaultSpan: 2, label: "Recent Issues" },
  "recent-activity": { component: lazy(() => import("../components/widgets/RecentActivityWidget")), defaultSpan: 2, label: "Recent Activity" },
  "team-activity":   { component: lazy(() => import("../components/widgets/TeamActivityWidget")),  defaultSpan: 2, label: "Team Activity" },
  "chat-activity":   { component: lazy(() => import("../components/widgets/ChatActivityWidget")),  defaultSpan: 2, label: "Chat Activity" },
  "my-folders":      { component: lazy(() => import("../components/widgets/MyFoldersWidget")),    defaultSpan: 2, label: "My Folders" },
  "my-issues":       { component: lazy(() => import("../components/widgets/MyIssuesWidget")),    defaultSpan: 2, label: "My Issues" },
  "cost-overview":   { component: lazy(() => import("../components/widgets/CostOverviewWidget")), defaultSpan: 2, label: "Cost Overview" },
  "health-summary":  { component: lazy(() => import("../components/widgets/HealthSummaryWidget")), defaultSpan: 2, label: "Health Summary" },

  // Enterprise
  "kpi-enterprise":  { component: lazy(() => import("../components/widgets/KpiEnterpriseWidget")), defaultSpan: 4, label: "Enterprise KPIs" },
  "timeline":        { component: lazy(() => import("../components/widgets/TimelineWidget")),   defaultSpan: 2, label: "Timeline" },
  "breakdown":       { component: lazy(() => import("../components/widgets/BreakdownWidget")),  defaultSpan: 2, label: "Breakdown" },
};
```

Interface commune :
```typescript
interface WidgetProps {
  companyId: string;
  span: number;
  props?: Record<string, unknown>;
}
```

### 7.8 API Design — 6 routes + 1 modifiee

```
# Admin — CRUD view presets
GET    /companies/:companyId/view-presets          → list all presets
POST   /companies/:companyId/view-presets          → create preset
PATCH  /companies/:companyId/view-presets/:id      → update preset
DELETE /companies/:companyId/view-presets/:id      → delete preset

# Admin — assign preset to role
PATCH  /companies/:companyId/roles/:roleId         → { viewPresetId: "..." }
       (existing route, just add viewPresetId field)

# User — get MY resolved view
GET    /companies/:companyId/my-view               → { preset, overrides }

# User — save MY overrides
PATCH  /companies/:companyId/my-view/overrides      → { pinnedItems, hiddenItems, ... }
```

**Response `GET /my-view` :**
```json
{
  "preset": {
    "id": "uuid",
    "slug": "pm",
    "name": "Product Manager",
    "layout": { }
  },
  "overrides": { }
}
```

**Query SQL backend (une seule requete) :**
```sql
SELECT vp.*, cm.layout_overrides
FROM company_memberships cm
JOIN roles r ON r.id = cm.role_id
LEFT JOIN view_presets vp ON vp.id = r.view_preset_id
WHERE cm.company_id = $1
  AND cm.principal_type = 'user'
  AND cm.principal_id = $2;
```

Fallback : Si `view_preset_id` est null → retourner le preset `is_default = true`. Si aucun preset → `DEFAULT_LAYOUT` (le layout actuel hardcode).

---

## 8. Plan de migration progressive (zero breaking change)

### Phase 0 : DEFAULT_LAYOUT

Encoder la sidebar actuelle comme un `ViewPresetLayout` constant. C'est le fallback.

```typescript
const DEFAULT_LAYOUT: ViewPresetLayout = {
  landingPage: "/dashboard",
  sidebar: {
    sections: [
      { label: "", items: ["dashboard", "inbox"] },
      { label: "Work", items: ["issues", "workflows", "workflow-editor", "routines", "goals", "chat", "folders", "cursors"] },
      { label: "Company", items: ["members", "roles", "tags", "config-layers", "feedback", "org", "costs", "activity", "audit", "traces", "containers", "deployments", "settings", "sso", "import-jira"] },
    ],
    showProjects: true,
    showAgents: true,
  },
  dashboard: {
    widgets: [
      { type: "kpi-bar", span: 4 },
      { type: "run-activity", span: 1 },
      { type: "priority-chart", span: 1 },
      { type: "status-chart", span: 1 },
      { type: "success-rate", span: 1 },
      { type: "kpi-enterprise", span: 4 },
      { type: "timeline", span: 2 },
      { type: "breakdown", span: 2 },
      { type: "recent-activity", span: 2 },
      { type: "recent-issues", span: 2 },
    ],
  },
};
```

### Phase 1 : Migration DB + API + hook
1. Migration : creer `view_presets` table + colonnes sur `roles` et `company_memberships`
2. Seed : creer un preset "Default" avec `is_default = true` contenant `DEFAULT_LAYOUT`
3. API : 6 routes (CRUD + my-view + overrides)
4. Hook : `useViewPreset()`
5. **Ne pas encore toucher la Sidebar ni le Dashboard** — le hook existe mais n'est pas consomme

### Phase 2 : Sidebar dynamique

Remplacer `Sidebar.tsx` pour consommer `useViewPreset().layout.sidebar`.

**Avant :**
```tsx
{canViewIssues && <SidebarNavItem to="/issues" label="Issues" icon={CircleDot} />}
{canViewWorkflows && <SidebarNavItem to="/workflows" label="Workflows" icon={Workflow} />}
```

**Apres :**
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

### Phase 3 : Dashboard dynamique

```tsx
<div className="grid grid-cols-4 gap-4">
  {layout.dashboard.widgets.map((widget, i) => {
    const def = WIDGET_REGISTRY[widget.type];
    if (!def) return null;
    const Widget = def.component;
    return (
      <div key={i} className={`col-span-${widget.span ?? def.defaultSpan}`}>
        <Suspense fallback={<WidgetSkeleton />}>
          <Widget companyId={companyId} span={widget.span} props={widget.props} />
        </Suspense>
      </div>
    );
  })}
</div>
```

### Phase 4 : Landing page dynamique

```tsx
function CompanyRootRedirect() {
  const { layout } = useViewPreset();
  const targetCompany = selectedCompany ?? companies[0];
  return <Navigate to={`/${targetCompany.issuePrefix}${layout.landingPage}`} replace />;
}
```

### Phase 5 : Admin UI + User customization

- Page admin `/admin/view-presets` — CRUD des presets avec un editeur visuel
- Dropdown dans AdminRoles pour lier un preset a un role
- Dans les Settings utilisateur — toggle pour pin/hide des items

---

## 9. Diagramme d'architecture

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
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                      DATABASE                                 │
│  ┌──────────────┐  ┌───────┐  ┌────────────────────┐        │
│  │ view_presets  │←─│ roles │  │ company_memberships │        │
│  │ (layout JSONB)│  │ (FK)  │  │ (overrides JSONB)   │        │
│  └──────────────┘  └───────┘  └────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
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
│       ├──→ Sidebar (sections from layout, items from registry)│
│       ├──→ Dashboard (widgets from layout, components lazy)   │
│       └──→ Landing Page (redirect after login)                │
│                                                               │
│  NAV_ITEM_REGISTRY ── static map { id → icon, route, perm } │
│  WIDGET_REGISTRY   ── static map { type → Component, span }  │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Trade-offs documentes

| Decision | Gain | Cout |
|---|---|---|
| Table separee vs JSONB sur roles | Presets partageables, cache RBAC propre | 1 jointure de plus sur /my-view |
| Overrides sur company_memberships vs table separee | Pas de table supplementaire, 1 ALTER | Colonne nullable sur une table existante |
| Registries statiques (nav + widgets) | Type-safe, pas de code injection, lazy loading | Faut rebuild pour ajouter un widget |
| Sparse overrides (pas de copie complete) | User override ne casse pas si l'admin change le preset | Merge logic un peu plus complexe |
| DEFAULT_LAYOUT comme fallback | Zero breaking change, migration progressive | Faut maintenir le fallback |
| is_default sur un seul preset | Pas besoin de config "no role" | Faut s'assurer qu'un seul est default par company |

---

## 11. Resume final

| Metrique | Valeur |
|---|---|
| **Nouvelles tables DB** | 1 (`view_presets`) |
| **Colonnes ajoutees** | 2 (`roles.view_preset_id`, `company_memberships.layout_overrides`) |
| **Nouvelles routes API** | 6 |
| **Nouveaux hooks frontend** | 1 (`useViewPreset`) |
| **Registries frontend** | 2 (`NAV_ITEM_REGISTRY`, `WIDGET_REGISTRY`) |
| **Breaking changes** | 0 (fallback sur DEFAULT_LAYOUT) |
| **Presets seedes** | 4-5 (Default, PM, Dev, Exec, Admin) |
| **Estimation** | ~5 jours |

---

## 12. Prochaines etapes

**Recommandation :** Ne pas utiliser json-render. Approche Schema JSON custom + Component Registry en 5 phases progressives.

Ce document sert de reference pour l'implementation. L'agent dev peut l'utiliser directement pour implementer les phases 0-1 (data model + API + hook + registries) sans toucher a la sidebar ni au dashboard existants.
