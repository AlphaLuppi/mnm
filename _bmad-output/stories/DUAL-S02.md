# DUAL-S02 — UI Curseur 3 Positions

> **Epic** : DUAL — Dual-Speed Workflow (Noyau E)
> **Sprint** : Batch 12
> **Assignation** : Cofondateur
> **Effort** : M (3 SP, 2-3j)
> **Bloqué par** : DUAL-S01 (DONE)
> **Débloque** : DUAL-S03

---

## Contexte

Le backend DUAL-S01 fournit un service complet pour les automation cursors : CRUD, upsert, résolution effective avec plafond hiérarchique. Cette story implémente l'**interface utilisateur** pour visualiser et gérer ces curseurs.

L'UI permet aux utilisateurs (Admin, Manager) de :
- Voir la liste de tous les curseurs configurés pour leur company
- Modifier la position d'un curseur via un segment control (Manual / Assisted / Auto)
- Résoudre le curseur effectif pour un contexte donné (agent + projet)
- Supprimer des curseurs existants
- Visualiser la chaîne hiérarchique de résolution

Le composant central est un **slider segmenté 3 positions** conforme au design UX (section 1.2 du UX Design B2B).

---

## Acceptance Criteria (Given/When/Then)

### AC-01: Page Automation Cursors accessible
- **Given** un utilisateur avec permission `workflows:enforce`
- **When** il navigue vers `/automation-cursors`
- **Then** la page affiche un titre "Automation Cursors" et la liste des curseurs

### AC-02: Table des curseurs
- **Given** des curseurs existants pour la company
- **When** la page charge
- **Then** un tableau affiche pour chaque curseur : level, targetId, position, ceiling, updatedAt
- **And** chaque ligne a un badge de position coloré

### AC-03: Filtre par level
- **Given** la page Automation Cursors
- **When** l'utilisateur sélectionne un filtre level (action/agent/project/company)
- **Then** seuls les curseurs de ce level s'affichent

### AC-04: Modifier la position d'un curseur
- **Given** un curseur existant
- **When** l'utilisateur clique sur le segment control et sélectionne une nouvelle position
- **Then** le curseur est mis à jour via PUT
- **And** un toast de confirmation s'affiche

### AC-05: Créer un nouveau curseur
- **Given** l'utilisateur clique "Add Cursor"
- **When** il remplit le formulaire (level, targetId optionnel, position, ceiling)
- **And** il clique "Save"
- **Then** le curseur est créé/upserted via PUT
- **And** la liste se rafraîchit

### AC-06: Supprimer un curseur
- **Given** un curseur existant dans le tableau
- **When** l'utilisateur clique l'icône "Delete" et confirme
- **Then** le curseur est supprimé via DELETE
- **And** la liste se rafraîchit

### AC-07: Résolution effective
- **Given** la section "Resolve Effective Cursor"
- **When** l'utilisateur saisit un level, targetId, agentId, projectId
- **And** clique "Resolve"
- **Then** le résultat affiche la position effective, le ceiling, le resolvedFrom, et la chaîne de hiérarchie

### AC-08: Empty state
- **Given** aucun curseur configuré pour la company
- **When** la page charge
- **Then** un message "No cursors configured" s'affiche avec une action "Add your first cursor"

### AC-09: Position badge colors
- **Given** un curseur affiché
- **Then** la position est encodée avec couleur + icône + texte :
  - manual = gris + Hand icon
  - assisted = bleu + Zap icon
  - auto = vert + Sparkles icon

### AC-10: Permission guard
- **Given** un utilisateur sans permission `workflows:enforce`
- **When** il tente d'accéder à `/automation-cursors`
- **Then** il voit la page 403 Forbidden

### AC-11: Sidebar navigation
- **Given** un utilisateur avec permission `workflows:enforce`
- **Then** un item "Cursors" apparaît dans la sidebar section "Work"

### AC-12: Hierarchy visualization
- **Given** un résultat de résolution effective
- **When** la hiérarchie contient plusieurs niveaux
- **Then** chaque niveau est affiché avec son level, position, et ceiling
- **And** le niveau effectif est mis en évidence

---

## Deliverables

### D1 — API Client (`ui/src/api/automation-cursors.ts`)

```typescript
export const automationCursorsApi = {
  list: (companyId, filters?) => GET /companies/:companyId/automation-cursors?level=...&targetId=...
  getById: (companyId, cursorId) => GET /companies/:companyId/automation-cursors/:cursorId
  set: (companyId, body) => PUT /companies/:companyId/automation-cursors
  delete: (companyId, cursorId) => DELETE /companies/:companyId/automation-cursors/:cursorId
  resolve: (companyId, body) => POST /companies/:companyId/automation-cursors/resolve
}
```

### D2 — Query Keys (`ui/src/lib/queryKeys.ts`)

Add `automationCursors` key namespace:
```typescript
automationCursors: {
  list: (companyId, filters?) => ["automation-cursors", companyId, "list", filters],
  detail: (companyId, cursorId) => ["automation-cursors", companyId, "detail", cursorId],
  resolve: (companyId, body?) => ["automation-cursors", companyId, "resolve", body],
}
```

### D3 — CursorPositionBadge Component (`ui/src/components/CursorPositionBadge.tsx`)

Badge component showing position with color + icon + text:
- manual: gray variant, Hand icon, "Manual"
- assisted: blue variant (default), Zap icon, "Assisted"
- auto: green variant (success), Sparkles icon, "Auto"

### D4 — CursorHierarchyChain Component (`ui/src/components/CursorHierarchyChain.tsx`)

Displays the hierarchy resolution chain:
- Each level as a step with position badge
- Arrow connectors between levels
- Active (resolvedFrom) level highlighted

### D5 — AutomationCursors Page (`ui/src/pages/AutomationCursors.tsx`)

Page with:
1. Header with title + "Add Cursor" button
2. Level filter dropdown
3. Cursors table (level, target, position segment control, ceiling, updated)
4. Delete button per row
5. "Resolve Effective" section with form + result display
6. Empty state

### D6 — Route + Sidebar + Permission

- `App.tsx`: Add route `automation-cursors` with RequirePermission `workflows:enforce`
- `Sidebar.tsx`: Add "Cursors" nav item with SlidersHorizontal icon, permission `workflows:enforce`

### D7 — API Index Export

- `ui/src/api/index.ts`: export `automationCursorsApi`

---

## data-testid Mapping

| Element | data-testid |
|---------|-------------|
| Page container | `data-testid="dual-s02-page"` |
| Page title | `data-testid="dual-s02-title"` |
| Add cursor button | `data-testid="dual-s02-add-btn"` |
| Level filter select | `data-testid="dual-s02-filter-level"` |
| Cursors table | `data-testid="dual-s02-table"` |
| Table header row | `data-testid="dual-s02-table-header"` |
| Table row | `data-testid="dual-s02-table-row"` |
| Level cell | `data-testid="dual-s02-level"` |
| Target cell | `data-testid="dual-s02-target"` |
| Position badge | `data-testid="dual-s02-position-badge"` |
| Position segment manual | `data-testid="dual-s02-seg-manual"` |
| Position segment assisted | `data-testid="dual-s02-seg-assisted"` |
| Position segment auto | `data-testid="dual-s02-seg-auto"` |
| Ceiling badge | `data-testid="dual-s02-ceiling-badge"` |
| Updated at cell | `data-testid="dual-s02-updated-at"` |
| Delete button | `data-testid="dual-s02-delete-btn"` |
| Empty state container | `data-testid="dual-s02-empty-state"` |
| Empty state title | `data-testid="dual-s02-empty-title"` |
| Empty state description | `data-testid="dual-s02-empty-description"` |
| Add cursor dialog | `data-testid="dual-s02-add-dialog"` |
| Dialog level select | `data-testid="dual-s02-dialog-level"` |
| Dialog targetId input | `data-testid="dual-s02-dialog-target-id"` |
| Dialog position select | `data-testid="dual-s02-dialog-position"` |
| Dialog ceiling select | `data-testid="dual-s02-dialog-ceiling"` |
| Dialog save button | `data-testid="dual-s02-dialog-save"` |
| Dialog cancel button | `data-testid="dual-s02-dialog-cancel"` |
| Resolve section | `data-testid="dual-s02-resolve-section"` |
| Resolve level select | `data-testid="dual-s02-resolve-level"` |
| Resolve targetId input | `data-testid="dual-s02-resolve-target-id"` |
| Resolve agentId input | `data-testid="dual-s02-resolve-agent-id"` |
| Resolve projectId input | `data-testid="dual-s02-resolve-project-id"` |
| Resolve button | `data-testid="dual-s02-resolve-btn"` |
| Resolve result container | `data-testid="dual-s02-resolve-result"` |
| Resolve effective position | `data-testid="dual-s02-resolve-position"` |
| Resolve effective ceiling | `data-testid="dual-s02-resolve-ceiling"` |
| Resolve resolvedFrom | `data-testid="dual-s02-resolve-from"` |
| Hierarchy chain container | `data-testid="dual-s02-hierarchy-chain"` |
| Hierarchy step | `data-testid="dual-s02-hierarchy-step"` |
| Loading state | `data-testid="dual-s02-loading"` |
| Error state | `data-testid="dual-s02-error"` |
| Sidebar nav item | `data-testid="dual-s02-nav-cursors"` |

---

## Test Cases (file-content based)

### API client tests (T01-T07)

| ID | Description | Target file |
|----|-------------|-------------|
| T01 | api/automation-cursors.ts file exists | api/automation-cursors.ts |
| T02 | exports automationCursorsApi object | api/automation-cursors.ts |
| T03 | automationCursorsApi.list calls GET /companies/:companyId/automation-cursors | api/automation-cursors.ts |
| T04 | automationCursorsApi.set calls PUT /companies/:companyId/automation-cursors | api/automation-cursors.ts |
| T05 | automationCursorsApi.delete calls DELETE /companies/:companyId/automation-cursors | api/automation-cursors.ts |
| T06 | automationCursorsApi.resolve calls POST /companies/:companyId/automation-cursors/resolve | api/automation-cursors.ts |
| T07 | automationCursorsApi.getById calls GET with cursorId path param | api/automation-cursors.ts |

### Query keys tests (T08-T10)

| ID | Description | Target file |
|----|-------------|-------------|
| T08 | queryKeys has automationCursors namespace | lib/queryKeys.ts |
| T09 | automationCursors.list returns array with "automation-cursors" | lib/queryKeys.ts |
| T10 | automationCursors.resolve returns array with "resolve" | lib/queryKeys.ts |

### CursorPositionBadge tests (T11-T15)

| ID | Description | Target file |
|----|-------------|-------------|
| T11 | CursorPositionBadge.tsx file exists | components/CursorPositionBadge.tsx |
| T12 | exports CursorPositionBadge function component | components/CursorPositionBadge.tsx |
| T13 | renders "Manual" text for position="manual" | components/CursorPositionBadge.tsx |
| T14 | renders "Assisted" text for position="assisted" | components/CursorPositionBadge.tsx |
| T15 | renders "Auto" text for position="auto" | components/CursorPositionBadge.tsx |

### CursorHierarchyChain tests (T16-T18)

| ID | Description | Target file |
|----|-------------|-------------|
| T16 | CursorHierarchyChain.tsx file exists | components/CursorHierarchyChain.tsx |
| T17 | exports CursorHierarchyChain function component | components/CursorHierarchyChain.tsx |
| T18 | renders data-testid="dual-s02-hierarchy-chain" | components/CursorHierarchyChain.tsx |

### AutomationCursors page tests (T19-T35)

| ID | Description | Target file |
|----|-------------|-------------|
| T19 | AutomationCursors.tsx page file exists | pages/AutomationCursors.tsx |
| T20 | exports AutomationCursors function component | pages/AutomationCursors.tsx |
| T21 | page has data-testid="dual-s02-page" | pages/AutomationCursors.tsx |
| T22 | page has data-testid="dual-s02-title" | pages/AutomationCursors.tsx |
| T23 | page has data-testid="dual-s02-add-btn" | pages/AutomationCursors.tsx |
| T24 | page has data-testid="dual-s02-filter-level" | pages/AutomationCursors.tsx |
| T25 | page has data-testid="dual-s02-table" | pages/AutomationCursors.tsx |
| T26 | page has data-testid="dual-s02-table-row" | pages/AutomationCursors.tsx |
| T27 | page has data-testid="dual-s02-position-badge" | pages/AutomationCursors.tsx |
| T28 | page has data-testid="dual-s02-delete-btn" | pages/AutomationCursors.tsx |
| T29 | page has data-testid="dual-s02-empty-state" | pages/AutomationCursors.tsx |
| T30 | page has data-testid="dual-s02-seg-manual" | pages/AutomationCursors.tsx |
| T31 | page has data-testid="dual-s02-seg-assisted" | pages/AutomationCursors.tsx |
| T32 | page has data-testid="dual-s02-seg-auto" | pages/AutomationCursors.tsx |
| T33 | page has data-testid="dual-s02-resolve-section" | pages/AutomationCursors.tsx |
| T34 | page has data-testid="dual-s02-resolve-btn" | pages/AutomationCursors.tsx |
| T35 | page has data-testid="dual-s02-resolve-result" | pages/AutomationCursors.tsx |

### Add cursor dialog tests (T36-T40)

| ID | Description | Target file |
|----|-------------|-------------|
| T36 | page has data-testid="dual-s02-add-dialog" | pages/AutomationCursors.tsx |
| T37 | dialog has data-testid="dual-s02-dialog-level" | pages/AutomationCursors.tsx |
| T38 | dialog has data-testid="dual-s02-dialog-position" | pages/AutomationCursors.tsx |
| T39 | dialog has data-testid="dual-s02-dialog-ceiling" | pages/AutomationCursors.tsx |
| T40 | dialog has data-testid="dual-s02-dialog-save" | pages/AutomationCursors.tsx |

### Resolve section tests (T41-T44)

| ID | Description | Target file |
|----|-------------|-------------|
| T41 | resolve section has data-testid="dual-s02-resolve-level" | pages/AutomationCursors.tsx |
| T42 | resolve section has data-testid="dual-s02-resolve-agent-id" | pages/AutomationCursors.tsx |
| T43 | resolve section has data-testid="dual-s02-resolve-project-id" | pages/AutomationCursors.tsx |
| T44 | resolve result has data-testid="dual-s02-hierarchy-chain" | pages/AutomationCursors.tsx |

### Route + Sidebar + Permission tests (T45-T52)

| ID | Description | Target file |
|----|-------------|-------------|
| T45 | App.tsx imports AutomationCursors page | App.tsx |
| T46 | App.tsx has route path="automation-cursors" | App.tsx |
| T47 | Route uses RequirePermission with workflows:enforce | App.tsx |
| T48 | Sidebar.tsx has data-testid="dual-s02-nav-cursors" | Sidebar.tsx |
| T49 | Sidebar uses hasPermission("workflows:enforce") | Sidebar.tsx |
| T50 | Sidebar imports SlidersHorizontal icon | Sidebar.tsx |
| T51 | Sidebar nav links to /automation-cursors | Sidebar.tsx |
| T52 | Sidebar Cursors item is inside Work or Company section | Sidebar.tsx |

### Barrel export tests (T53-T54)

| ID | Description | Target file |
|----|-------------|-------------|
| T53 | api/index.ts exports automationCursorsApi | api/index.ts |
| T54 | queryKeys.ts exports automationCursors key namespace | lib/queryKeys.ts |

### Integration tests (T55-T60)

| ID | Description | Target file |
|----|-------------|-------------|
| T55 | AutomationCursors page imports automationCursorsApi | pages/AutomationCursors.tsx |
| T56 | AutomationCursors page imports queryKeys | pages/AutomationCursors.tsx |
| T57 | AutomationCursors page imports useCompany | pages/AutomationCursors.tsx |
| T58 | AutomationCursors page imports CursorPositionBadge | pages/AutomationCursors.tsx |
| T59 | AutomationCursors page imports useQuery from react-query | pages/AutomationCursors.tsx |
| T60 | AutomationCursors page imports useMutation from react-query | pages/AutomationCursors.tsx |

---

## Notes techniques

- L'API client suit le même pattern que `containersApi` dans `ui/src/api/containers.ts`
- La page suit le même pattern que `Containers.tsx` (table + filters + empty state)
- Le segment control pour la position utilise des `Button` shadcn/ui en mode toggle group
- La permission `workflows:enforce` est déjà dans les presets admin et manager (RBAC-S02)
- Le composant CursorPositionBadge réutilise le `Badge` shadcn/ui existant
- Les mutations utilisent `useMutation` de TanStack Query avec `queryClient.invalidateQueries`
- Les icônes Lucide utilisées : SlidersHorizontal (sidebar), Hand (manual), Zap (assisted), Sparkles (auto), Trash2 (delete), Plus (add), Search (resolve)
