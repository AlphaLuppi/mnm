# RBAC-S06 : UI Admin Matrice Permissions + Page Roles -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S06 |
| **Titre** | UI admin matrice permissions + page roles |
| **Epic** | Epic RBAC -- Roles & Permissions |
| **Sprint** | Sprint 3 (Phase 2) |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P1 |
| **Assignation** | Cofondateur (frontend) |
| **Bloque par** | RBAC-S02 (20 permission keys + presets par role) |
| **Debloque** | Aucun (leaf story) |
| **ADR** | ADR-002 (RBAC 4 roles) |
| **FRs couverts** | REQ-RBAC-07 (UI admin : matrice permissions, page roles) |
| **Type** | Frontend (React page, composants, API calls) |

---

## Description

### Contexte

RBAC-S02 a cree la matrice de presets (`ROLE_PERMISSION_PRESETS` dans `packages/shared/src/rbac-presets.ts`) avec 4 roles et 20 permission keys. L'endpoint backend `GET /companies/:companyId/rbac/presets` retourne cette matrice. L'endpoint `GET /companies/:companyId/rbac/effective-permissions/:memberId` retourne les permissions effectives d'un membre.

RBAC-S05 a cree le hook `usePermissions()` dans `ui/src/hooks/usePermissions.ts` et le composant `RequirePermission` dans `ui/src/components/RequirePermission.tsx` pour proteger les routes et masquer les elements de navigation.

RBAC-S07 a cree le composant `RoleBadge` dans `ui/src/components/RoleBadge.tsx` avec les couleurs par role (admin=rose, manager=bleu, contributor=vert, viewer=gris).

MU-S02 a cree la page Members (`ui/src/pages/Members.tsx`) avec le tableau des membres, filtres, et changement de role via dropdown.

### Ce que cette story fait

1. **Cree une page `/admin/roles`** accessible uniquement aux admins (permission `users:manage_permissions`), qui affiche :
   - **La matrice de permissions** : grille read-only montrant quel role a quelles permissions (checkboxes desactivees ou icones check/cross)
   - **La liste des membres** avec leur role actuel et la possibilite de changer le role
2. **Cree un composant `PermissionMatrix`** : grille avec les 4 roles en colonnes et les 20 permission keys en lignes, montrant un checkmark ou un dash pour chaque combinaison
3. **Cree un composant `RoleOverview`** : resume de chaque role avec son badge, le nombre de permissions, et le nombre de membres avec ce role
4. **Ajoute un lien dans la sidebar** vers `/admin/roles` (visible uniquement pour les admins, permission `users:manage_permissions`)
5. **Ajoute la route** dans `App.tsx` avec `RequirePermission`

### Principe UX

La matrice est **read-only** (visualisation). Les presets ne sont pas editables via l'UI dans cette story -- ils sont definis dans le code (`rbac-presets.ts`). L'admin peut neanmoins changer le role d'un membre, ce qui change automatiquement ses permissions via les presets.

L'objectif est de donner a l'admin une vue claire et complete de "qui peut faire quoi" dans l'organisation.

### Structure de la page

```
/admin/roles
+============================================================+
|  [Breadcrumb: Admin > Roles & Permissions]                  |
|                                                              |
|  Roles & Permissions                                         |
|  Manage roles and view the permission matrix for your org.   |
|                                                              |
|  +-- Tabs ---------------------------------------------------+
|  | [Overview]  [Permission Matrix]  [Members by Role]        |
|  +-----------------------------------------------------------+
|                                                              |
|  Tab: Overview                                               |
|  +----------+ +----------+ +----------+ +----------+        |
|  | Admin    | | Manager  | | Contrib  | | Viewer   |        |
|  | 20 perms | | 14 perms | | 5 perms  | | 2 perms  |        |
|  | 3 users  | | 5 users  | | 12 users | | 2 users  |        |
|  +----------+ +----------+ +----------+ +----------+        |
|                                                              |
|  Tab: Permission Matrix                                      |
|  +------------------------------------------+                |
|  | Permission Key    | Admin | Mgr | Ctrb | View |          |
|  |-------------------|-------|-----|------|------|          |
|  | agents:create     |  [x]  | [x] | [ ] | [ ] |          |
|  | agents:launch     |  [x]  | [x] | [x] | [ ] |          |
|  | ...               |  ...  | ... | ... | ... |          |
|  +------------------------------------------+                |
|                                                              |
|  Tab: Members by Role                                        |
|  [Admin (3)] [Manager (5)] [Contributor (12)] [Viewer (2)]  |
|  Table: name | email | role | change-role-button             |
+============================================================+
```

---

## Architecture Technique

### Nouveau : API call pour presets matrix

L'endpoint existe deja (`GET /companies/:companyId/rbac/presets`), implemente dans `server/src/routes/access.ts`. Il retourne :

```json
{
  "admin": ["agents:create", "agents:launch", ...],
  "manager": ["agents:create", "agents:launch", ...],
  "contributor": ["agents:launch", ...],
  "viewer": ["audit:read", "dashboard:view"]
}
```

Il faut ajouter une fonction `getRbacPresets(companyId)` dans `ui/src/api/access.ts`.

### Nouveau : Page `AdminRoles.tsx`

```
ui/src/pages/AdminRoles.tsx
```

Page avec 3 onglets (Tabs shadcn/ui) :
1. **Overview** : 4 cards (une par role) montrant le badge, le nombre de permissions, et le nombre de membres
2. **Permission Matrix** : grille read-only avec checkmarks
3. **Members by Role** : sous-onglets par role avec la liste des membres et possibilite de changer le role

### Nouveau : Composant `PermissionMatrix.tsx`

```
ui/src/components/PermissionMatrix.tsx
```

Grille HTML table :
- **Lignes** : 20 permission keys groupees par categorie (agents, users, tasks, projects, workflows, company, audit, stories, dashboard, chat)
- **Colonnes** : 4 roles (admin, manager, contributor, viewer)
- **Cellules** : checkmark (Check icon) si la permission est dans le preset, dash (-) sinon

### Nouveau : Composant `RoleOverviewCard.tsx`

```
ui/src/components/RoleOverviewCard.tsx
```

Card affichant :
- Le `RoleBadge` (existant)
- Le nombre de permissions du role
- Le nombre de membres avec ce role
- Une description courte du role

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `ui/src/App.tsx` | Ajouter route `/admin/roles` avec `RequirePermission permission="users:manage_permissions"` |
| `ui/src/components/Sidebar.tsx` | Ajouter lien "Roles" avec icone Shield, conditionne par `users:manage_permissions` |
| `ui/src/api/access.ts` | Ajouter `getRbacPresets(companyId)` |
| `ui/src/lib/queryKeys.ts` | Ajouter cle `rbacPresets` |

---

## Groupement des Permission Keys par Categorie

Pour l'affichage dans la matrice, les 20 permission keys sont groupees ainsi :

| Categorie | Permission Keys |
|-----------|----------------|
| **Agents** | `agents:create`, `agents:launch`, `agents:manage_containers` |
| **Users** | `users:invite`, `users:manage_permissions` |
| **Tasks** | `tasks:assign`, `tasks:assign_scope` |
| **Projects** | `projects:create`, `projects:manage_members` |
| **Workflows** | `workflows:create`, `workflows:enforce` |
| **Company** | `company:manage_settings`, `company:manage_sso` |
| **Audit** | `audit:read`, `audit:export` |
| **Stories** | `stories:create`, `stories:edit` |
| **Dashboard** | `dashboard:view` |
| **Chat** | `chat:agent` |

Les labels affichables pour chaque permission key :

| Permission Key | Label affiche |
|---------------|---------------|
| `agents:create` | Create agents |
| `agents:launch` | Launch agents |
| `agents:manage_containers` | Manage containers |
| `users:invite` | Invite users |
| `users:manage_permissions` | Manage permissions |
| `tasks:assign` | Assign tasks |
| `tasks:assign_scope` | Assign task scope |
| `projects:create` | Create projects |
| `projects:manage_members` | Manage project members |
| `workflows:create` | Create workflows |
| `workflows:enforce` | Enforce workflows |
| `company:manage_settings` | Manage company settings |
| `company:manage_sso` | Manage SSO |
| `audit:read` | View audit log |
| `audit:export` | Export audit data |
| `stories:create` | Create stories |
| `stories:edit` | Edit stories |
| `dashboard:view` | View dashboard |
| `chat:agent` | Chat with agents |

---

## data-test-id -- Liste Exhaustive

### Page container

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-page` | AdminRoles page | Container principal de la page |
| `rbac-s06-page-title` | H1 | Titre "Roles & Permissions" |
| `rbac-s06-page-description` | Paragraphe | Description de la page |

### Onglets (Tabs)

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-tabs` | Tabs container | Container des onglets |
| `rbac-s06-tab-overview` | TabsTrigger | Onglet "Overview" |
| `rbac-s06-tab-matrix` | TabsTrigger | Onglet "Permission Matrix" |
| `rbac-s06-tab-members` | TabsTrigger | Onglet "Members by Role" |
| `rbac-s06-tab-content-overview` | TabsContent | Contenu de l'onglet Overview |
| `rbac-s06-tab-content-matrix` | TabsContent | Contenu de l'onglet Permission Matrix |
| `rbac-s06-tab-content-members` | TabsContent | Contenu de l'onglet Members by Role |

### Overview Tab -- Role Cards

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-role-cards` | Container | Grid des 4 role cards |
| `rbac-s06-role-card-admin` | RoleOverviewCard | Card du role Admin |
| `rbac-s06-role-card-manager` | RoleOverviewCard | Card du role Manager |
| `rbac-s06-role-card-contributor` | RoleOverviewCard | Card du role Contributor |
| `rbac-s06-role-card-viewer` | RoleOverviewCard | Card du role Viewer |
| `rbac-s06-role-card-admin-count` | Span | Nombre de permissions du role Admin (ex: "20 permissions") |
| `rbac-s06-role-card-manager-count` | Span | Nombre de permissions du role Manager |
| `rbac-s06-role-card-contributor-count` | Span | Nombre de permissions du role Contributor |
| `rbac-s06-role-card-viewer-count` | Span | Nombre de permissions du role Viewer |
| `rbac-s06-role-card-admin-members` | Span | Nombre de membres avec le role Admin |
| `rbac-s06-role-card-manager-members` | Span | Nombre de membres avec le role Manager |
| `rbac-s06-role-card-contributor-members` | Span | Nombre de membres avec le role Contributor |
| `rbac-s06-role-card-viewer-members` | Span | Nombre de membres avec le role Viewer |

### Permission Matrix Tab

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-matrix` | Table container | Container de la matrice |
| `rbac-s06-matrix-table` | Table element | Element HTML table de la matrice |
| `rbac-s06-matrix-header-admin` | TH | En-tete colonne Admin |
| `rbac-s06-matrix-header-manager` | TH | En-tete colonne Manager |
| `rbac-s06-matrix-header-contributor` | TH | En-tete colonne Contributor |
| `rbac-s06-matrix-header-viewer` | TH | En-tete colonne Viewer |
| `rbac-s06-matrix-category-agents` | TR (category header) | Ligne d'en-tete de la categorie Agents |
| `rbac-s06-matrix-category-users` | TR | Categorie Users |
| `rbac-s06-matrix-category-tasks` | TR | Categorie Tasks |
| `rbac-s06-matrix-category-projects` | TR | Categorie Projects |
| `rbac-s06-matrix-category-workflows` | TR | Categorie Workflows |
| `rbac-s06-matrix-category-company` | TR | Categorie Company |
| `rbac-s06-matrix-category-audit` | TR | Categorie Audit |
| `rbac-s06-matrix-category-stories` | TR | Categorie Stories |
| `rbac-s06-matrix-category-dashboard` | TR | Categorie Dashboard |
| `rbac-s06-matrix-category-chat` | TR | Categorie Chat |
| `rbac-s06-matrix-row-{permissionKey}` | TR | Ligne d'une permission (ex: `rbac-s06-matrix-row-agents:create`) |
| `rbac-s06-matrix-cell-{permissionKey}-{role}` | TD | Cellule permission x role (ex: `rbac-s06-matrix-cell-agents:create-admin`) |
| `rbac-s06-matrix-check-{permissionKey}-{role}` | Check/X icon | Icone check (granted) ou dash (denied) |

### Members by Role Tab

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-members-section` | Container | Section Members by Role |
| `rbac-s06-members-role-filter` | Select | Filtre par role (dropdown) |
| `rbac-s06-members-search` | Input | Champ de recherche par nom/email |
| `rbac-s06-members-table` | Table | Tableau des membres |
| `rbac-s06-members-row-{memberId}` | TR | Ligne d'un membre |
| `rbac-s06-members-name-{memberId}` | TD | Nom du membre |
| `rbac-s06-members-email-{memberId}` | TD | Email du membre |
| `rbac-s06-members-role-{memberId}` | TD (contient RoleBadge) | Badge du role actuel |
| `rbac-s06-members-change-role-{memberId}` | Select | Dropdown pour changer le role du membre |
| `rbac-s06-members-count` | Span | Compteur total des membres (ex: "22 members") |
| `rbac-s06-members-empty` | Div | Etat vide : aucun membre avec le role filtre |

### Sidebar navigation

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-nav-roles` | SidebarNavItem | Lien "Roles" dans la sidebar (visible si `users:manage_permissions`) |

### Loading & Error states

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s06-loading` | Skeleton | Etat de chargement de la page |
| `rbac-s06-error` | Div | Message d'erreur si le fetch echoue |

---

## Acceptance Criteria

### AC1 -- Page accessible uniquement aux admins

```gherkin
Given un utilisateur avec businessRole "admin" dans la company
When il navigue vers /admin/roles
Then la page RBAC-S06 s'affiche avec data-testid="rbac-s06-page"
And le titre "Roles & Permissions" est visible avec data-testid="rbac-s06-page-title"
And 3 onglets sont visibles : Overview, Permission Matrix, Members by Role
```

### AC2 -- Page interdite aux non-admins

```gherkin
Given un utilisateur avec businessRole "manager" dans la company
When il navigue vers /admin/roles
Then la page 403 (ForbiddenPage) s'affiche avec data-testid="rbac-s05-forbidden-page"
And le lien "Roles" est absent de la sidebar
```

### AC3 -- Overview tab affiche les 4 role cards

```gherkin
Given un admin sur la page /admin/roles
When l'onglet "Overview" est actif (par defaut)
Then 4 cards sont visibles :
  | data-testid | Role | Permissions count |
  | rbac-s06-role-card-admin | Admin | 20 |
  | rbac-s06-role-card-manager | Manager | 14 |
  | rbac-s06-role-card-contributor | Contributor | 5 |
  | rbac-s06-role-card-viewer | Viewer | 2 |
And chaque card affiche le nombre de membres avec ce role
And chaque card contient un RoleBadge avec la couleur correcte
```

### AC4 -- Permission Matrix affiche la grille complete

```gherkin
Given un admin sur la page /admin/roles
When il clique sur l'onglet "Permission Matrix"
Then une grille s'affiche avec data-testid="rbac-s06-matrix-table"
And la grille a 4 colonnes de roles : Admin, Manager, Contributor, Viewer
And la grille a 20 lignes de permissions groupees par categorie
And les permissions sont groupees en 10 categories avec des en-tetes visuels
```

### AC5 -- Permission Matrix montre les checkmarks corrects

```gherkin
Given la matrice de permissions affichee
When je verifie les cellules
Then les combinaisons suivantes ont un checkmark (icone Check) :
  | Permission | Role |
  | agents:create | admin |
  | agents:create | manager |
  | agents:launch | admin |
  | agents:launch | manager |
  | agents:launch | contributor |
  | audit:read | admin |
  | audit:read | manager |
  | audit:read | viewer |
  | dashboard:view | admin |
  | dashboard:view | manager |
  | dashboard:view | viewer |
And les combinaisons suivantes ont un dash/vide (pas de permission) :
  | Permission | Role |
  | agents:create | contributor |
  | agents:create | viewer |
  | agents:launch | viewer |
  | company:manage_settings | manager |
  | company:manage_settings | contributor |
  | company:manage_settings | viewer |
  | users:manage_permissions | manager |
  | users:manage_permissions | contributor |
  | users:manage_permissions | viewer |
```

### AC6 -- Permission Matrix est read-only

```gherkin
Given la matrice de permissions affichee
When l'admin tente de cliquer sur une cellule
Then aucune modification n'est possible (pas de checkbox cliquable)
And les cellules sont des indicateurs visuels (check/dash) et non des inputs
```

### AC7 -- Members by Role tab affiche les membres

```gherkin
Given un admin sur la page /admin/roles
When il clique sur l'onglet "Members by Role"
Then un tableau de membres s'affiche avec data-testid="rbac-s06-members-table"
And le compteur total de membres est visible avec data-testid="rbac-s06-members-count"
And un filtre par role est disponible avec data-testid="rbac-s06-members-role-filter"
And un champ de recherche est disponible avec data-testid="rbac-s06-members-search"
```

### AC8 -- Filtrer les membres par role

```gherkin
Given l'onglet Members by Role actif avec tous les membres affiches
When l'admin selectionne "Manager" dans le filtre de role
Then seuls les membres avec businessRole "manager" sont affiches
And le compteur se met a jour
```

### AC9 -- Rechercher un membre par nom ou email

```gherkin
Given l'onglet Members by Role actif
When l'admin tape "john" dans le champ de recherche
Then seuls les membres dont le nom ou l'email contient "john" sont affiches
```

### AC10 -- Changer le role d'un membre depuis la page

```gherkin
Given l'onglet Members by Role avec un membre "Alice" en role "contributor"
When l'admin change le role d'Alice a "manager" via le dropdown
Then le changement est envoye au backend (PATCH /companies/:companyId/members/:memberId/business-role)
And le tableau se rafraichit avec le nouveau role
And le RoleBadge du membre est mis a jour
```

### AC11 -- Sidebar affiche le lien Roles pour les admins

```gherkin
Given un utilisateur avec businessRole "admin"
When la sidebar se charge
Then un lien "Roles" est visible avec data-testid="rbac-s06-nav-roles"
And le lien navigue vers /admin/roles
And l'icone est Shield (lucide-react)
```

### AC12 -- Sidebar masque le lien Roles pour les non-admins

```gherkin
Given un utilisateur avec businessRole "manager" ou "contributor" ou "viewer"
When la sidebar se charge
Then le lien "Roles" avec data-testid="rbac-s06-nav-roles" est absent du DOM
```

### AC13 -- Loading state

```gherkin
Given un admin qui navigue vers /admin/roles
When les donnees sont en cours de chargement
Then un skeleton est affiche avec data-testid="rbac-s06-loading"
And les onglets ne sont pas encore cliquables
```

### AC14 -- Presets matrix data correspond au code source

```gherkin
Given la matrice affichee
When je compare avec ROLE_PERMISSION_PRESETS dans rbac-presets.ts
Then chaque role a exactement les permissions definies dans le code :
  | Role | Count | Permissions |
  | admin | 20 | toutes les 20 keys |
  | manager | 14 | agents:create, agents:launch, users:invite, tasks:assign, joins:approve, projects:create, projects:manage_members, workflows:create, workflows:enforce, audit:read, stories:create, stories:edit, dashboard:view, chat:agent |
  | contributor | 5 | agents:launch, tasks:assign, stories:create, stories:edit, chat:agent |
  | viewer | 2 | audit:read, dashboard:view |
```

### AC15 -- Mode local_trusted affiche la page

```gherkin
Given le deploymentMode est "local_trusted"
When l'utilisateur navigue vers /admin/roles
Then la page s'affiche normalement (bypass RBAC)
And toutes les permissions sont affichees
```

---

## Matrice Complete des Permissions par Role (Reference)

Cette matrice est la source de verite pour la verification des checkmarks dans la grille UI.

| Permission Key | Admin | Manager | Contributor | Viewer |
|---------------|:-----:|:-------:|:-----------:|:------:|
| `agents:create` | Y | Y | - | - |
| `agents:launch` | Y | Y | Y | - |
| `agents:manage_containers` | Y | - | - | - |
| `users:invite` | Y | Y | - | - |
| `users:manage_permissions` | Y | - | - | - |
| `tasks:assign` | Y | Y | Y | - |
| `tasks:assign_scope` | Y | - | - | - |
| `joins:approve` | Y | Y | - | - |
| `projects:create` | Y | Y | - | - |
| `projects:manage_members` | Y | Y | - | - |
| `workflows:create` | Y | Y | - | - |
| `workflows:enforce` | Y | Y | - | - |
| `company:manage_settings` | Y | - | - | - |
| `company:manage_sso` | Y | - | - | - |
| `audit:read` | Y | Y | - | Y |
| `audit:export` | Y | - | - | - |
| `stories:create` | Y | Y | Y | - |
| `stories:edit` | Y | Y | Y | - |
| `dashboard:view` | Y | Y | - | Y |
| `chat:agent` | Y | Y | Y | - |
| **Total** | **20** | **14** | **5** | **2** |

---

## Fichiers a Modifier / Creer

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `ui/src/pages/AdminRoles.tsx` | Page principale /admin/roles avec 3 onglets |
| `ui/src/components/PermissionMatrix.tsx` | Composant grille read-only des permissions par role |
| `ui/src/components/RoleOverviewCard.tsx` | Card resume d'un role (badge, permissions count, members count) |

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `ui/src/App.tsx` | Ajouter `<Route path="admin/roles" element={<RequirePermission permission="users:manage_permissions" showForbidden><AdminRoles /></RequirePermission>} />` |
| `ui/src/components/Sidebar.tsx` | Ajouter lien "Roles" (Shield icon) dans la section Company, conditionne par `hasPermission("users:manage_permissions")` |
| `ui/src/api/access.ts` | Ajouter `getRbacPresets(companyId: string)` qui appelle `GET /companies/${companyId}/rbac/presets` |
| `ui/src/lib/queryKeys.ts` | Ajouter `rbacPresets: (companyId: string) => ["rbacPresets", companyId]` |

---

## Notes Techniques

### API calls necessaires

1. **GET /companies/:companyId/rbac/presets** -- retourne la matrice presets (existe deja)
2. **GET /companies/:companyId/members** -- retourne la liste des membres enrichis (existe deja, utilise par MU-S02)
3. **PATCH /companies/:companyId/members/:memberId/business-role** -- change le role (existe deja)

Aucun nouveau endpoint backend n'est necessaire pour cette story.

### Performance

- Les donnees de presets sont statiques (definies dans le code). Le cache peut etre tres long (`staleTime: Infinity` ou 5 minutes).
- La liste des membres est deja cachee via React Query par MU-S02.
- La matrice est calculee cote client a partir des presets retournes par l'API.

### Consistance avec MU-S02

La section "Members by Role" reutilise les memes patterns que la page Members (MU-S02) :
- `accessApi.listMembers(companyId)` pour fetcher les membres
- `accessApi.updateMemberBusinessRole(companyId, memberId, role)` pour changer le role
- `RoleBadge` component (RBAC-S07) pour afficher le badge du role
- Meme structure de tableau avec colonnes nom, email, role, actions

### Placement dans la Sidebar

Le lien "Roles" est place dans la section "Company" de la sidebar, entre "Members" et "Org" :

```
Company
  [Members]     -- users:invite
  [Roles]       -- users:manage_permissions (NOUVEAU)
  [Org]         -- toujours visible
  [Costs]       -- dashboard:view
  [Activity]    -- audit:read
  [Settings]    -- company:manage_settings
```

Icone : `Shield` de lucide-react (coherente avec le concept de permissions/securite).

### Accessibilite

- La matrice utilise un element `<table>` semantique avec `<thead>`, `<tbody>`, `<th scope="col">` et `<th scope="row">`
- Les checkmarks utilisent `aria-label` ("Granted" ou "Not granted") pour les lecteurs d'ecran
- Les categories de permissions utilisent `<th colspan="5">` pour regrouper visuellement
- Les onglets utilisent les composants Tabs de shadcn/ui (Radix UI) qui gerent le focus et les roles ARIA nativement

### Breadcrumbs

La page definit les breadcrumbs via `useBreadcrumbs` :
```typescript
setBreadcrumbs([
  { label: "Admin" },
  { label: "Roles & Permissions" },
]);
```

---

## Cas de Test Suggeres pour l'Agent QA

### Tests E2E Playwright (`e2e/tests/RBAC-S06.spec.ts`)

#### Test 1 : Page accessible en tant qu'admin

```
1. Se connecter en tant qu'admin
2. Naviguer vers /admin/roles
3. Verifier la presence de data-testid="rbac-s06-page"
4. Verifier le titre "Roles & Permissions" (data-testid="rbac-s06-page-title")
5. Verifier la presence des 3 onglets
```

#### Test 2 : Page interdite pour manager

```
1. Se connecter en tant que manager
2. Naviguer vers /admin/roles
3. Verifier la presence de data-testid="rbac-s05-forbidden-page"
4. Verifier que rbac-s06-page est absent du DOM
```

#### Test 3 : Page interdite pour contributor

```
1. Se connecter en tant que contributor
2. Naviguer vers /admin/roles
3. Verifier la presence de data-testid="rbac-s05-forbidden-page"
```

#### Test 4 : Page interdite pour viewer

```
1. Se connecter en tant que viewer
2. Naviguer vers /admin/roles
3. Verifier la presence de data-testid="rbac-s05-forbidden-page"
```

#### Test 5 : Overview tab -- 4 role cards

```
1. Se connecter en tant qu'admin
2. Naviguer vers /admin/roles (onglet Overview actif par defaut)
3. Verifier la presence des 4 cards : rbac-s06-role-card-admin, rbac-s06-role-card-manager, rbac-s06-role-card-contributor, rbac-s06-role-card-viewer
4. Verifier les compteurs de permissions :
   - rbac-s06-role-card-admin-count contient "20"
   - rbac-s06-role-card-manager-count contient "14"
   - rbac-s06-role-card-contributor-count contient "5"
   - rbac-s06-role-card-viewer-count contient "2"
5. Verifier que chaque card contient un RoleBadge
```

#### Test 6 : Overview tab -- membres count

```
1. Se connecter en tant qu'admin
2. Naviguer vers /admin/roles
3. Verifier que chaque card affiche un nombre de membres >= 0
4. Verifier que la somme des membres par role = nombre total de membres de la company
```

#### Test 7 : Permission Matrix -- structure de la grille

```
1. Se connecter en tant qu'admin
2. Naviguer vers /admin/roles
3. Cliquer sur l'onglet "Permission Matrix" (data-testid="rbac-s06-tab-matrix")
4. Verifier la presence de data-testid="rbac-s06-matrix-table"
5. Verifier les 4 en-tetes de colonnes : Admin, Manager, Contributor, Viewer
6. Verifier que la grille a 20 lignes de permissions + 10 lignes de categories
```

#### Test 8 : Permission Matrix -- checkmarks corrects pour Admin

```
1. Verifier que TOUTES les 20 cellules de la colonne Admin ont un checkmark
   - data-testid="rbac-s06-matrix-check-agents:create-admin" contient un Check icon
   - ... (tester quelques permissions cles)
```

#### Test 9 : Permission Matrix -- checkmarks corrects pour Viewer

```
1. Verifier que seules 2 cellules de la colonne Viewer ont un checkmark :
   - rbac-s06-matrix-check-audit:read-viewer = check
   - rbac-s06-matrix-check-dashboard:view-viewer = check
2. Verifier que les 18 autres cellules de la colonne Viewer ont un dash :
   - rbac-s06-matrix-check-agents:create-viewer = dash
   - rbac-s06-matrix-check-company:manage_settings-viewer = dash
```

#### Test 10 : Permission Matrix -- read-only (pas de modification)

```
1. Verifier qu'aucune cellule de la matrice n'est un input cliquable
2. Cliquer sur une cellule "dash" et verifier qu'elle ne change pas
```

#### Test 11 : Members tab -- affichage tableau

```
1. Se connecter en tant qu'admin
2. Cliquer sur l'onglet "Members by Role" (data-testid="rbac-s06-tab-members")
3. Verifier la presence de data-testid="rbac-s06-members-table"
4. Verifier que le compteur total est affiche
5. Verifier que chaque ligne a un nom, email, RoleBadge, et dropdown de role
```

#### Test 12 : Members tab -- filtre par role

```
1. Ouvrir le filtre par role (data-testid="rbac-s06-members-role-filter")
2. Selectionner "Manager"
3. Verifier que seuls les membres avec role "manager" sont affiches
4. Selectionner "All" pour reset
5. Verifier que tous les membres sont affiches
```

#### Test 13 : Members tab -- recherche

```
1. Taper un nom dans le champ de recherche (data-testid="rbac-s06-members-search")
2. Verifier que le filtre fonctionne (seuls les membres correspondants sont affiches)
3. Vider le champ de recherche
4. Verifier que tous les membres reapparaissent
```

#### Test 14 : Members tab -- changement de role

```
1. Trouver un membre avec role "contributor"
2. Ouvrir le dropdown de changement de role pour ce membre
3. Selectionner "manager"
4. Verifier que le RoleBadge se met a jour a "Manager"
5. Verifier que les compteurs dans l'onglet Overview se mettent a jour
```

#### Test 15 : Sidebar -- lien Roles visible pour admin

```
1. Se connecter en tant qu'admin
2. Verifier que data-testid="rbac-s06-nav-roles" est present dans la sidebar
3. Cliquer sur le lien
4. Verifier la navigation vers /admin/roles
```

#### Test 16 : Sidebar -- lien Roles masque pour non-admin

```
1. Se connecter en tant que manager
2. Verifier que data-testid="rbac-s06-nav-roles" est absent du DOM
3. Se deconnecter, se connecter en tant que contributor
4. Verifier que data-testid="rbac-s06-nav-roles" est absent du DOM
5. Se deconnecter, se connecter en tant que viewer
6. Verifier que data-testid="rbac-s06-nav-roles" est absent du DOM
```

#### Test 17 : Categories dans la matrice

```
1. Se connecter en tant qu'admin, aller sur l'onglet Permission Matrix
2. Verifier la presence des 10 categories :
   - rbac-s06-matrix-category-agents
   - rbac-s06-matrix-category-users
   - rbac-s06-matrix-category-tasks
   - rbac-s06-matrix-category-projects
   - rbac-s06-matrix-category-workflows
   - rbac-s06-matrix-category-company
   - rbac-s06-matrix-category-audit
   - rbac-s06-matrix-category-stories
   - rbac-s06-matrix-category-dashboard
   - rbac-s06-matrix-category-chat
3. Verifier que les permissions sont regroupees sous la bonne categorie
```

#### Test 18 : Etat vide dans Members tab

```
1. Filtrer par un role qui n'a aucun membre (si possible)
2. Verifier la presence de data-testid="rbac-s06-members-empty"
3. Verifier le message "No members with this role"
```

#### Test 19 : Breadcrumbs

```
1. Se connecter en tant qu'admin
2. Naviguer vers /admin/roles
3. Verifier que le breadcrumb affiche "Admin > Roles & Permissions"
```

#### Test 20 : local_trusted mode

```
1. En mode local_trusted (pas d'authentification)
2. Naviguer vers /admin/roles
3. Verifier que la page s'affiche normalement
4. Verifier que la matrice est complete avec toutes les permissions
```

---

## Dependances

### Stories prerequises (DONE)

- **RBAC-S01** : Fix hasPermission() avec scope JSONB
- **RBAC-S02** : 20 permission keys + presets par role + endpoint presets + effective-permissions
- **RBAC-S03** : businessRole sur company_memberships
- **RBAC-S05** : Navigation masquee -- usePermissions hook + RequirePermission component
- **RBAC-S07** : RoleBadge composant avec couleurs par role
- **MU-S02** : Page membres avec tableau et filtres (patterns reutilises)

### Stories connexes

- **RBAC-S04** : Enforcement routes (backend) -- le lien route /admin/roles sera protege par `users:manage_permissions`

---

## Definition of Done

1. La page /admin/roles est accessible uniquement aux admins (permission `users:manage_permissions`)
2. L'onglet Overview affiche 4 cards avec le nombre de permissions et de membres par role
3. L'onglet Permission Matrix affiche une grille read-only avec 20 permissions x 4 roles
4. Les checkmarks correspondent exactement a `ROLE_PERMISSION_PRESETS` dans `rbac-presets.ts`
5. Les permissions sont groupees par categorie dans la matrice
6. L'onglet Members by Role affiche la liste des membres avec filtre par role et recherche
7. L'admin peut changer le role d'un membre depuis la page
8. Le lien "Roles" apparait dans la sidebar uniquement pour les admins
9. Les non-admins voient la page 403 quand ils tentent d'acceder a /admin/roles
10. Le mode `local_trusted` permet l'acces a la page (bypass RBAC)
11. La grille utilise un element `<table>` semantique avec `aria-label` sur les checkmarks
12. Les tests E2E Playwright couvrent les 4 roles + matrice + membres + sidebar
