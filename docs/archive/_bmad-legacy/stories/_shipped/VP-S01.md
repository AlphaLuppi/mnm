# VP-S01 — View Presets : Data Model, API & Hook Frontend

> **Epic** : VP — View Presets (Dashboard & Navigation par Persona)
> **Sprint** : Batch 14
> **Assignation** : Agent (fullstack)
> **Effort** : L (8 SP, 4-5j)
> **Bloque par** : Aucune (les tables roles, company_memberships existent deja)
> **Debloque** : VP-S02 (Sidebar dynamique), VP-S03 (Dashboard dynamique), VP-S04 (Landing page dynamique), VP-S05 (Admin UI)
> **ADR** : architecture-view-presets-2026-04-05.md

---

## Contexte

Actuellement, tous les utilisateurs de MnM voient la meme sidebar et le meme dashboard, independamment de leur role. La seule differentiation est le show/hide base sur les permissions. Il n'y a aucune notion de priorite, d'ordre, ou de layout par role.

L'objectif est d'introduire le concept de **View Preset** : un document JSON qui decrit l'experience complete d'un persona (landing page, sidebar, dashboard). Un preset est stocke en DB, attache a un role, et overridable par l'utilisateur.

**Ce qui existe deja :**
- Sidebar avec ~25 items, chacun protege par une permission
- RequirePermission component + usePermissions() hook
- 140+ permissions, roles dynamiques, tags pour la visibilite
- Dashboard unique avec KPIs fixes
- Config Layers (JSONB, priority merge) — pattern reutilisable

**Ce qui manque :**
- Table `view_presets` pour stocker les layouts par persona
- Colonne `view_preset_id` sur `roles` pour lier role → preset
- Colonne `layout_overrides` sur `company_memberships` pour les overrides utilisateur
- API CRUD presets + API my-view + API overrides
- Hook `useViewPreset()` et fonction `resolveLayout()`
- Registries statiques `NAV_ITEM_REGISTRY` et `WIDGET_REGISTRY`

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| RBAC-S01 | DONE | hasPermission() avec scope |
| RBAC-S04 | DONE | requirePermission middleware |
| DASH-S01 | DONE | Service dashboard existant |
| CONF-S01 | DONE | Pattern Config Layers (JSONB, priority merge) |

---

## Principe directeur

**Une seule abstraction : le View Preset.**

- Un preset est un document JSON qui decrit l'experience complete d'un persona
- Stocke en DB dans une table dediee `view_presets`
- Attache a un role via `roles.view_preset_id` (M:1 — many roles can share one preset)
- Overridable par l'utilisateur via `company_memberships.layout_overrides` (sparse merge)
- Le frontend le consomme via un hook unique `useViewPreset()` et rend tout dynamiquement

**3 couches de resolution :**
1. Role's View Preset (from DB) — l'admin definit le layout complet
2. User Overrides (from DB) — l'utilisateur personnalise (pin, hide, reorder)
3. Permission Filter (runtime) — le systeme filtre les items non autorises

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Migration DB
**Given** la base de donnees actuelle
**When** la migration s'execute
**Then** une table `view_presets` est creee avec les colonnes : id (UUID PK), company_id (FK), slug (TEXT UNIQUE per company), name (TEXT), description (TEXT nullable), icon (TEXT nullable), color (TEXT nullable), layout (JSONB NOT NULL DEFAULT '{}'), is_default (BOOLEAN DEFAULT false), created_at, updated_at. La table `roles` a une nouvelle colonne `view_preset_id` (UUID FK nullable). La table `company_memberships` a une nouvelle colonne `layout_overrides` (JSONB nullable).

### AC2 — Seed presets par defaut
**Given** la migration est executee
**When** le seed s'execute pour une company
**Then** un preset "Default" avec is_default=true est cree, contenant le layout actuel (sidebar 3 sections, dashboard 10 widgets)

### AC3 — CRUD presets (Admin)
**Given** un utilisateur avec permission `view_presets:manage`
**When** il appelle POST /companies/:companyId/view-presets avec { slug, name, layout }
**Then** un nouveau preset est cree et retourne avec son id

**Given** un utilisateur avec permission `view_presets:manage`
**When** il appelle GET /companies/:companyId/view-presets
**Then** il recoit la liste de tous les presets de la company

**Given** un utilisateur avec permission `view_presets:manage`
**When** il appelle PATCH /companies/:companyId/view-presets/:id avec { name, layout }
**Then** le preset est mis a jour

**Given** un utilisateur avec permission `view_presets:manage`
**When** il appelle DELETE /companies/:companyId/view-presets/:id
**Then** le preset est supprime (soft delete ou hard delete si pas attache a un role)

### AC4 — Assigner un preset a un role
**Given** un utilisateur avec permission `roles:update`
**When** il appelle PATCH /companies/:companyId/roles/:roleId avec { viewPresetId: "uuid" }
**Then** le role est mis a jour avec le view_preset_id

### AC5 — GET /my-view
**Given** un utilisateur authentifie dont le role a un view_preset_id
**When** il appelle GET /companies/:companyId/my-view
**Then** il recoit { preset: { id, slug, name, layout }, overrides: LayoutOverrides | null }

**Given** un utilisateur dont le role n'a PAS de view_preset_id
**When** il appelle GET /companies/:companyId/my-view
**Then** il recoit le preset is_default=true de la company

**Given** un utilisateur sans aucun preset disponible
**When** il appelle GET /companies/:companyId/my-view
**Then** il recoit le DEFAULT_LAYOUT hardcode (fallback)

### AC6 — PATCH /my-view/overrides
**Given** un utilisateur authentifie
**When** il appelle PATCH /companies/:companyId/my-view/overrides avec { pinnedItems, hiddenItems }
**Then** ses layout_overrides sont mis a jour sur company_memberships

### AC7 — Query SQL en une seule requete
**Given** le backend
**When** il resout le view preset d'un utilisateur
**Then** il execute une seule requete JOIN (company_memberships → roles → view_presets)

### AC8 — Hook useViewPreset()
**Given** le frontend
**When** un composant appelle useViewPreset()
**Then** il recoit { layout: ResolvedLayout, isLoading, presetName } avec staleTime de 60s

### AC9 — Fonction resolveLayout()
**Given** un preset layout, des overrides utilisateur, et une fonction hasPermission
**When** resolveLayout() est appelee
**Then** elle applique dans l'ordre : (1) base preset, (2) user overrides (sparse merge), (3) permission filter, (4) validation landing page accessible

### AC10 — NAV_ITEM_REGISTRY
**Given** le frontend
**When** le registry est charge
**Then** il contient 26 entrees avec pour chacune : to (route), icon (lucide), label, permission requise

### AC11 — WIDGET_REGISTRY
**Given** le frontend
**When** le registry est charge
**Then** il contient 15+ entrees avec lazy loading, chacune avec : component (lazy), defaultSpan, label

### AC12 — DEFAULT_LAYOUT constant
**Given** le code frontend
**When** aucun preset n'est disponible
**Then** le DEFAULT_LAYOUT encode la sidebar actuelle (3 sections) et le dashboard actuel (10 widgets) comme fallback, garantissant zero breaking change

### AC13 — Backward compatibility
**Given** un utilisateur sans preset configure
**When** il navigue dans l'app
**Then** l'experience est identique a avant (meme sidebar, meme dashboard, meme landing page)

---

## Deliverables

### D1 — Migration DB (`server/src/migrations/00XX-view-presets.ts`)

```sql
CREATE TABLE view_presets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  color         TEXT,
  layout        JSONB NOT NULL DEFAULT '{}',
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE roles ADD COLUMN view_preset_id UUID REFERENCES view_presets(id);
ALTER TABLE company_memberships ADD COLUMN layout_overrides JSONB;
```

### D2 — Types shared (`packages/shared/src/types/view-preset.ts`)

Types a creer :
- `NavItemId` — union type des 26 nav item IDs
- `SidebarSection` — { label, items: NavItemId[], collapsed? }
- `DashboardWidget` — { type, span?: 1|2|3|4, props? }
- `ViewPresetLayout` — { landingPage, sidebar: { sections, showProjects?, showAgents? }, dashboard: { widgets } }
- `LayoutOverrides` — { landingPage?, sidebar?: { pinnedItems?, hiddenItems?, sectionOrder? }, dashboard?: { hiddenWidgets?, extraWidgets? } }
- `ResolvedLayout` — le layout final apres resolution des 3 couches
- `ViewPreset` — l'entite complete (id, companyId, slug, name, description, icon, color, layout, isDefault, createdAt, updatedAt)

### D3 — Validators (`packages/shared/src/validators/view-preset.ts`)

Schemas Zod :
- `createViewPresetSchema` — slug, name, layout (ViewPresetLayout)
- `updateViewPresetSchema` — partial de createViewPreset
- `layoutOverridesSchema` — validation des overrides sparse
- `viewPresetLayoutSchema` — validation du JSON layout

### D4 — Drizzle schema (`packages/shared/src/schema/view-presets.ts`)

Table Drizzle `view_presets` avec toutes les colonnes. Ajouter la colonne `viewPresetId` sur la table `roles` existante et `layoutOverrides` sur `companyMemberships`.

### D5 — Service (`server/src/services/view-preset.ts`)

Fonctions :
- `list(companyId)` — liste tous les presets
- `create(companyId, data)` — cree un preset
- `update(id, companyId, data)` — met a jour un preset
- `remove(id, companyId)` — supprime un preset
- `getMyView(companyId, userId)` — requete JOIN pour recuperer preset + overrides
- `updateMyOverrides(companyId, userId, overrides)` — met a jour les overrides

### D6 — Routes (`server/src/routes/view-preset.ts`)

6 routes :
- `GET /companies/:companyId/view-presets` — requirePermission("view_presets:read")
- `POST /companies/:companyId/view-presets` — requirePermission("view_presets:manage")
- `PATCH /companies/:companyId/view-presets/:id` — requirePermission("view_presets:manage")
- `DELETE /companies/:companyId/view-presets/:id` — requirePermission("view_presets:manage")
- `GET /companies/:companyId/my-view` — authenticated
- `PATCH /companies/:companyId/my-view/overrides` — authenticated

Modifier la route existante `PATCH /companies/:companyId/roles/:roleId` pour accepter `viewPresetId`.

### D7 — Hook frontend (`ui/src/hooks/useViewPreset.ts`)

```typescript
function useViewPreset() {
  // GET /my-view avec staleTime 60s
  // resolveLayout(preset.layout, overrides, hasPermission)
  // Return { layout: ResolvedLayout, isLoading, presetName }
}
```

### D8 — Fonction resolveLayout (`ui/src/lib/resolve-layout.ts`)

4 etapes :
1. Start with base preset
2. Apply user overrides (sparse merge : hiddenItems, pinnedItems, hiddenWidgets)
3. Permission filter (safety net via hasPermission)
4. Validate landing page accessible (fallback sur premiere route accessible)

### D9 — NAV_ITEM_REGISTRY (`ui/src/lib/nav-registry.ts`)

Map statique de 26 items. Chaque entree : { to, icon, label, permission }.

Items : dashboard, inbox, issues, chat, folders, workflows, workflow-editor, routines, goals, agents, projects, members, roles, tags, config-layers, feedback, org, costs, activity, audit, traces, containers, deployments, settings, sso, import-jira.

### D10 — WIDGET_REGISTRY (`ui/src/lib/widget-registry.ts`)

Map statique de 15+ widgets avec lazy loading.

Categories :
- KPIs : kpi-bar (span 4), kpi-enterprise (span 4)
- Charts : run-activity (1), priority-chart (1), status-chart (1), success-rate (1)
- Panels : active-agents (2), recent-issues (2), recent-activity (2), team-activity (2), chat-activity (2), my-folders (2), my-issues (2), cost-overview (2), health-summary (2)

Interface commune : `WidgetProps { companyId, span, props? }`

### D11 — DEFAULT_LAYOUT (`ui/src/lib/default-layout.ts`)

Constant encodant la sidebar actuelle (3 sections : vide/Work/Company) et le dashboard actuel (10 widgets). Sert de fallback zero breaking change.

### D12 — Seed presets (`server/src/seeds/view-presets.ts`)

4-5 presets de reference :
- **Default** (is_default=true) — layout actuel
- **PM** — landing /chat, sidebar: Mon espace (chat, folders, inbox) / Suivi (issues, goals, projects, dashboard) / Equipe (members, agents, org)
- **Dev** — landing /issues, sidebar: Mon travail (issues, inbox, chat) / Execution (agents, workflows, traces, containers) / Projets (projects, goals, dashboard)
- **Exec** — landing /dashboard, sidebar: Vue d'ensemble (dashboard, costs, org) / Suivi (goals, projects, feedback) / Audit (audit, traces, activity)

### D13 — Barrel exports

- `packages/shared/src/types/index.ts` : export view-preset types
- `packages/shared/src/validators/index.ts` : export view-preset validators
- `packages/shared/src/schema/index.ts` : export view-presets schema
- `packages/shared/src/index.ts` : re-export tout
- `server/src/services/index.ts` : export viewPresetService
- `server/src/routes/index.ts` : export viewPresetRoutes + enregistrer dans le router principal

---

## Data-test-id Mapping

| data-testid | Element | Fichier |
|-------------|---------|---------|
| `vp-s01-migration` | Migration view_presets table | migrations/00XX-view-presets.ts |
| `vp-s01-types` | View preset types file | types/view-preset.ts |
| `vp-s01-validators` | View preset validators | validators/view-preset.ts |
| `vp-s01-schema` | Drizzle schema view_presets | schema/view-presets.ts |
| `vp-s01-service` | View preset service | services/view-preset.ts |
| `vp-s01-routes` | View preset routes | routes/view-preset.ts |
| `vp-s01-hook` | useViewPreset hook | hooks/useViewPreset.ts |
| `vp-s01-resolve` | resolveLayout function | lib/resolve-layout.ts |
| `vp-s01-nav-registry` | NAV_ITEM_REGISTRY | lib/nav-registry.ts |
| `vp-s01-widget-registry` | WIDGET_REGISTRY | lib/widget-registry.ts |
| `vp-s01-default-layout` | DEFAULT_LAYOUT constant | lib/default-layout.ts |
| `vp-s01-seed` | Seed presets | seeds/view-presets.ts |

---

## Trade-offs documentes

| Decision | Gain | Cout |
|----------|------|------|
| Table separee vs JSONB sur roles | Presets partageables, cache RBAC propre | 1 jointure de plus sur /my-view |
| Overrides sur company_memberships vs table separee | Pas de table supplementaire, 1 ALTER | Colonne nullable sur table existante |
| Registries statiques (nav + widgets) | Type-safe, pas de code injection, lazy loading | Faut rebuild pour ajouter un widget |
| Sparse overrides (pas de copie complete) | User override ne casse pas si l'admin change le preset | Merge logic plus complexe |
| DEFAULT_LAYOUT comme fallback | Zero breaking change, migration progressive | Faut maintenir le fallback |
| is_default sur un seul preset | Pas besoin de config "no role" | S'assurer qu'un seul est default par company |

---

## Notes d'implementation

- La migration doit s'inserer apres la derniere migration existante (verifier le numero)
- Les permissions `view_presets:read` et `view_presets:manage` doivent etre ajoutees en seed
- Le hook useViewPreset() utilise React Query avec staleTime 60s (les presets changent rarement)
- Les widgets du WIDGET_REGISTRY utilisent React.lazy() pour le code splitting
- La query SQL de getMyView est un seul JOIN : company_memberships → roles → view_presets
- Le DEFAULT_LAYOUT doit etre maintenu en sync avec la sidebar actuelle
- Cette story ne modifie PAS la Sidebar ni le Dashboard existants (c'est VP-S02 et VP-S03)
- Pas de json-render : on utilise un schema JSON custom + Component Registry
- Lancer `bun run typecheck` et `bun run build` pour verifier avant de commit
