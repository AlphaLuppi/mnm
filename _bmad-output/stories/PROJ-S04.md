# PROJ-S04 : Page ProjectAccess -- Gestion des Membres d'un Projet

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | PROJ-S04 |
| **Titre** | Page ProjectAccess -- Gestion des Membres d'un Projet |
| **Epic** | Epic PROJ -- Scoping par Projet |
| **Sprint** | Batch 8 -- Drift + Audit UI |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P0 -- Interface obligatoire pour gerer l'acces aux projets |
| **Assignation** | Cofondateur (frontend) |
| **Bloque par** | PROJ-S02 (Service project-memberships avance -- DONE), PROJ-S03 (Filtrage par scope -- DONE) |
| **Debloque** | Securite B2B multi-projet complete (toutes les stories PROJ sont DONE apres celle-ci) |
| **ADR** | ADR-001 (Multi-tenant RLS PostgreSQL), ADR-002 (RBAC + Scope JSONB) |
| **Type** | Frontend + API client (page UI + API client module, le backend est deja complet) |
| **FRs couverts** | FR-PROJ (Phase 3 scoping par projet -- UI management) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

L'Epic PROJ a construit trois couches backend pour l'isolation fine des donnees par projet :
- **PROJ-S01** : Table `project_memberships` + service CRUD basique (add/remove/list/updateRole)
- **PROJ-S02** : Service enrichi avec scope sync, bulk ops, pagination, member counts
- **PROJ-S03** : Filtrage par scope dans les routes agents, issues, workflows, drift

Il manque la **page frontend** pour que les Admins et Managers puissent gerer qui a acces a quel projet. Aujourd'hui, les project memberships ne peuvent etre gerees que via l'API REST directement -- aucune interface utilisateur n'existe.

La page ProjectAccess sera un **nouvel onglet** dans la vue projet (`ProjectDetail.tsx`), accessible via l'onglet "Access" a cote de Cockpit, Agents, Workflows, Drift et Settings. Elle suit le meme pattern visuel que la page Members (`Members.tsx`) : tableau avec filtres, recherche, ajout/suppression de membres, changement de role.

### Ce que cette story construit

1. **API client project-memberships** : Nouveau fichier `ui/src/api/project-memberships.ts` avec les appels aux endpoints existants (PROJ-S01 + PROJ-S02) :
   - `listMembers(companyId, projectId)` -- GET tous les membres
   - `addMember(companyId, projectId, userId, role)` -- POST ajout individuel
   - `removeMember(companyId, projectId, userId)` -- DELETE retrait
   - `updateMemberRole(companyId, projectId, userId, role)` -- PATCH changement role
   - `bulkAddMembers(companyId, projectId, userIds, role)` -- POST bulk
   - `bulkRemoveMembers(companyId, projectId, userIds)` -- DELETE bulk
   - `listCompanyMembers(companyId)` -- GET liste des membres de la company (pour la modale d'ajout)

2. **Composant ProjectAccessTab** : Nouveau composant `ui/src/components/ProjectAccessTab.tsx` rendu dans l'onglet "Access" de ProjectDetail :
   - Tableau des membres du projet avec nom, email, role projet, date d'ajout
   - Filtre par role projet (owner/manager/contributor/viewer)
   - Recherche par nom ou email
   - Ajout de membre via modale (selecteur de company members non encore dans le projet)
   - Suppression de membre avec confirmation
   - Changement de role via dropdown
   - Compteur de membres total et filtre
   - Permission guard : seulement visible avec `projects:manage_members`

3. **Composant AddProjectMemberDialog** : Modale d'ajout de membre au projet :
   - Liste des membres de la company qui ne sont PAS deja membres du projet
   - Recherche parmi les membres disponibles
   - Selection du role pour le nouveau membre
   - Ajout individuel ou bulk (selection multiple)
   - Feedback succes/erreur

4. **Integration dans ProjectDetail.tsx** :
   - Nouvel onglet "Access" dans la barre d'onglets du projet
   - Route `/projects/:projectId/access`
   - Onglet masque si l'utilisateur n'a pas `projects:manage_members` (pattern RBAC-S05)

5. **Query keys** : Ajout des cles pour project memberships dans `queryKeys.ts`

### Ce que cette story NE fait PAS (scope)

- Pas de modification du backend (le service et les routes sont complets depuis PROJ-S01/S02)
- Pas de modification du schema DB
- Pas de modification du filtrage par scope (PROJ-S03 est complet)
- Pas d'import CSV de membres (c'est un pattern de MU-S03, pas necessaire pour les project memberships)
- Pas de modification de la page Members (`Members.tsx`) -- c'est une page separee pour les company members

---

## Etat Actuel du Code (Analyse)

### API Backend existant (PROJ-S01 + PROJ-S02 -- DONE)

`server/src/routes/project-memberships.ts` fournit tous les endpoints necessaires :
- `GET /api/companies/:companyId/projects/:projectId/members` -- liste des membres (+ pagination optionnelle via ?limit=&cursor=)
- `POST /api/companies/:companyId/projects/:projectId/members` -- ajout (protege `projects:manage_members`)
- `DELETE /api/companies/:companyId/projects/:projectId/members/:userId` -- suppression (protege `projects:manage_members`)
- `PATCH /api/companies/:companyId/projects/:projectId/members/:userId` -- changement role (protege `projects:manage_members`)
- `POST /api/companies/:companyId/projects/:projectId/members/bulk` -- ajout en masse (protege `projects:manage_members`)
- `DELETE /api/companies/:companyId/projects/:projectId/members/bulk` -- suppression en masse (protege `projects:manage_members`)
- `GET /api/companies/:companyId/users/:userId/projects` -- projets d'un utilisateur
- `GET /api/companies/:companyId/users/:userId/project-ids` -- IDs projets d'un utilisateur
- `POST /api/companies/:companyId/projects/member-counts` -- comptage membres par projet

### Service existant (PROJ-S02 -- DONE)

`server/src/services/project-memberships.ts` expose 11 fonctions :
- `addMember`, `removeMember`, `listMembers`, `listUserProjects`, `isMember`, `updateMemberRole`
- `getUserProjectIds`, `bulkAddMembers`, `bulkRemoveMembers`, `countMembersByProject`, `listMembersPaginated`

Chaque mutation emet un audit_event via `emitAudit()` et un activity_log via `logActivity()`.

### Validators Zod existants (packages/shared)

`packages/shared/src/validators/project-membership.ts` :
- `addProjectMemberSchema` : `{ userId: string, role: ProjectMembershipRole }`
- `updateProjectMemberRoleSchema` : `{ role: ProjectMembershipRole }`
- `bulkAddProjectMembersSchema` : `{ userIds: string[], role: ProjectMembershipRole }`
- `bulkRemoveProjectMembersSchema` : `{ userIds: string[] }`
- `memberCountsSchema` : `{ projectIds: string[] }`
- `PROJECT_MEMBERSHIP_ROLES` : `["owner", "manager", "contributor", "viewer"]`

### Patterns existants a suivre

1. **Members.tsx** (MU-S02) : Pattern de reference pour le tableau de membres :
   - `useQuery` + `useMutation` + `useQueryClient`
   - Filtres (role, recherche) avec `useMemo`
   - `RoleBadge` component pour les badges de role
   - `Avatar` + `AvatarFallback` pour les membres
   - `DropdownMenu` pour les actions par ligne
   - `Select` pour les filtres et changements de role
   - `Dialog` pour la modale d'invitation

2. **ProjectDetail.tsx** : Pattern de reference pour les onglets projet :
   - Tab bar avec 5 onglets (cockpit, agents, workflows, drift, settings)
   - `resolveProjectTab()` pour determiner l'onglet actif depuis l'URL
   - `handleTabChange()` pour naviguer vers un onglet
   - Chaque onglet est un composant dedicate rendu dans un `ScrollArea`

3. **Access API client** (`ui/src/api/access.ts`) : Pattern de reference pour l'API client company members :
   - `accessApi.listMembers(companyId)` retourne `EnrichedMember[]`

4. **usePermissions hook** (RBAC-S05) :
   - `const { hasPermission } = usePermissions()`
   - Masquage de l'onglet si `!hasPermission("projects:manage_members")`

5. **RoleBadge** (`ui/src/components/RoleBadge.tsx`) :
   - Utilise pour les roles company (admin/manager/contributor/viewer)
   - Les roles projet (owner/manager/contributor/viewer) sont similaires -- creer un `ProjectRoleBadge` ou reutiliser `Badge` avec couleurs personnalisees

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `ui/src/api/project-memberships.ts` | API client pour les endpoints project-memberships |
| `ui/src/components/ProjectAccessTab.tsx` | Composant principal de l'onglet Access |
| `ui/src/components/AddProjectMemberDialog.tsx` | Modale d'ajout de membre au projet |

### Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `ui/src/pages/ProjectDetail.tsx` | Ajouter l'onglet "Access" + route + composant |
| `ui/src/lib/queryKeys.ts` | Ajouter les cles pour projectMemberships |

---

## Acceptance Criteria

### AC-1 : Affichage du tableau des membres du projet
**Given** un Admin sur la page d'un projet
**When** il clique sur l'onglet "Access"
**Then** un tableau affiche la liste des membres du projet avec colonnes : Membre (nom + email + avatar), Role projet, Date d'ajout, Actions

### AC-2 : Filtre par role projet
**Given** l'onglet Access affiche le tableau des membres
**When** l'Admin filtre par role "contributor"
**Then** seuls les membres avec le role "contributor" s'affichent
**And** le compteur "Showing X of Y members" est mis a jour

### AC-3 : Recherche par nom ou email
**Given** l'onglet Access affiche le tableau des membres
**When** l'Admin tape "alice" dans le champ de recherche
**Then** seuls les membres dont le nom ou l'email contient "alice" s'affichent

### AC-4 : Ajout d'un membre au projet
**Given** l'Admin clique sur "Add Member"
**When** la modale s'ouvre
**Then** elle affiche la liste des membres de la company qui ne sont PAS deja membres du projet
**And** l'Admin peut selectionner un utilisateur et un role
**And** en cliquant "Add" le membre est ajoute au projet
**And** le tableau se rafraichit automatiquement

### AC-5 : Ajout bulk de membres
**Given** l'Admin dans la modale d'ajout
**When** il selectionne plusieurs utilisateurs avec les checkboxes
**And** clique "Add Selected (N)"
**Then** les N utilisateurs sont ajoutes au projet en une seule requete bulk
**And** un toast affiche "N members added, M skipped"

### AC-6 : Suppression d'un membre du projet
**Given** un membre affiche dans le tableau
**When** l'Admin clique sur le menu actions "..." et choisit "Remove from project"
**Then** une confirmation est demandee
**And** apres confirmation le membre est supprime
**And** le tableau se rafraichit automatiquement

### AC-7 : Changement de role d'un membre
**Given** un membre affiche dans le tableau
**When** l'Admin change le role via le selecteur de role
**Then** le role est mis a jour immediatement
**And** le RoleBadge se met a jour

### AC-8 : Onglet Access masque sans permission
**Given** un Viewer qui n'a PAS la permission `projects:manage_members`
**When** il consulte la page projet
**Then** l'onglet "Access" n'est PAS visible dans la barre d'onglets

### AC-9 : Etat vide
**Given** un projet sans aucun membre
**When** l'Admin ouvre l'onglet Access
**Then** un EmptyState s'affiche avec le message "No members yet. Add someone to get started."
**And** un bouton "Add Member" est present

### AC-10 : Recherche dans la modale d'ajout
**Given** la modale d'ajout ouverte
**When** l'Admin tape dans le champ de recherche
**Then** la liste des membres disponibles est filtree par nom ou email

### AC-11 : Scope sync automatique
**Given** un Contributor ajoute a un projet
**When** l'ajout est confirme
**Then** le champ `scope.projectIds` de ses `principal_permission_grants` est automatiquement mis a jour par le backend
**And** le filtrage des agents/issues/workflows reflette immediatement le nouveau scope

### AC-12 : Compteur de membres
**Given** l'onglet Access affiche
**When** des filtres sont appliques
**Then** le footer affiche "Showing X of Y members" ou X = nombre apres filtres et Y = total

---

## data-test-id Mapping

### Page ProjectAccessTab

| Element | data-testid | Description |
|---------|-------------|-------------|
| Container onglet Access | `proj-s04-access-tab` | Conteneur principal de l'onglet |
| Header de la page | `proj-s04-header` | En-tete avec titre et bouton d'ajout |
| Titre "Project Access" | `proj-s04-title` | h2 titre |
| Bouton "Add Member" | `proj-s04-add-member-button` | Bouton primaire pour ouvrir la modale |
| Zone des filtres | `proj-s04-filters` | Conteneur des filtres |
| Filtre par role | `proj-s04-filter-role` | SelectTrigger pour le filtre de role |
| Option filtre "All roles" | `proj-s04-filter-role-all` | SelectItem "All roles" |
| Option filtre "Owner" | `proj-s04-filter-role-owner` | SelectItem "Owner" |
| Option filtre "Manager" | `proj-s04-filter-role-manager` | SelectItem "Manager" |
| Option filtre "Contributor" | `proj-s04-filter-role-contributor` | SelectItem "Contributor" |
| Option filtre "Viewer" | `proj-s04-filter-role-viewer` | SelectItem "Viewer" |
| Champ de recherche | `proj-s04-search` | Input de recherche par nom/email |
| Tableau des membres | `proj-s04-members-table` | Table HTML des membres |
| Ligne de membre | `proj-s04-member-row-{userId}` | Ligne de table pour un membre |
| Nom du membre | `proj-s04-member-name-{userId}` | Nom affiche |
| Email du membre | `proj-s04-member-email-{userId}` | Email affiche |
| Badge role du membre | `proj-s04-member-role-badge-{userId}` | Badge colore du role |
| Selecteur role du membre | `proj-s04-member-role-select-{userId}` | Select pour changer le role |
| Date d'ajout du membre | `proj-s04-member-date-{userId}` | Date relative |
| Menu actions du membre | `proj-s04-member-actions-{userId}` | Bouton "..." actions |
| Action "Remove from project" | `proj-s04-action-remove-{userId}` | Item du menu dropdown |
| Empty state | `proj-s04-empty-state` | EmptyState quand aucun membre |
| Footer compteur | `proj-s04-footer` | Pied de page avec compteur |
| Compteur de membres | `proj-s04-member-count` | Texte "Showing X of Y members" |
| Message aucun resultat | `proj-s04-no-results` | Message quand les filtres ne matchent rien |

### Modale AddProjectMemberDialog

| Element | data-testid | Description |
|---------|-------------|-------------|
| Modale conteneur | `proj-s04-add-dialog` | DialogContent de la modale d'ajout |
| Titre modale | `proj-s04-add-dialog-title` | DialogTitle "Add Members to Project" |
| Recherche membres disponibles | `proj-s04-add-search` | Input recherche dans la modale |
| Liste des membres disponibles | `proj-s04-available-members-list` | Conteneur de la liste scrollable |
| Ligne membre disponible | `proj-s04-available-member-{userId}` | Ligne d'un membre disponible |
| Checkbox selection | `proj-s04-available-member-check-{userId}` | Checkbox pour selection multiple |
| Nom membre disponible | `proj-s04-available-member-name-{userId}` | Nom du membre disponible |
| Email membre disponible | `proj-s04-available-member-email-{userId}` | Email du membre disponible |
| Select role pour ajout | `proj-s04-add-role-select` | Select du role a assigner |
| Bouton "Add Selected (N)" | `proj-s04-add-submit` | Bouton de soumission bulk |
| Bouton "Cancel" | `proj-s04-add-cancel` | Bouton annulation |
| Compteur selectionnes | `proj-s04-selected-count` | Texte "N selected" |
| Message aucun disponible | `proj-s04-no-available` | Message quand tous les company members sont deja dans le projet |
| Message erreur | `proj-s04-add-error` | Message d'erreur en cas d'echec |
| Message succes | `proj-s04-add-success` | Feedback succes apres ajout |

### Modale de confirmation suppression

| Element | data-testid | Description |
|---------|-------------|-------------|
| Modale confirmation | `proj-s04-remove-confirm-dialog` | Dialog de confirmation |
| Message confirmation | `proj-s04-remove-confirm-message` | Texte "Remove {name} from this project?" |
| Bouton confirmer | `proj-s04-remove-confirm-submit` | Bouton "Remove" destructive |
| Bouton annuler | `proj-s04-remove-confirm-cancel` | Bouton "Cancel" outline |

### Integration ProjectDetail.tsx

| Element | data-testid | Description |
|---------|-------------|-------------|
| Onglet "Access" dans la tab bar | `proj-s04-tab-access` | Bouton onglet dans la barre d'onglets du projet |

---

## Specifications Techniques

### 1. API Client (`ui/src/api/project-memberships.ts`)

```typescript
import { api } from "./client";
import type { ProjectMembershipRole } from "@mnm/shared";

export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  grantedBy: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}

export interface BulkResult {
  added?: number;
  removed?: number;
  skipped: number;
  results: Array<{
    userId: string;
    status: "added" | "skipped" | "removed";
    reason?: string;
  }>;
}

export const projectMembershipsApi = {
  listMembers: (companyId: string, projectId: string) =>
    api.get<ProjectMember[]>(
      `/companies/${companyId}/projects/${projectId}/members`,
    ),

  addMember: (
    companyId: string,
    projectId: string,
    userId: string,
    role: ProjectMembershipRole = "contributor",
  ) =>
    api.post<ProjectMember>(
      `/companies/${companyId}/projects/${projectId}/members`,
      { userId, role },
    ),

  removeMember: (companyId: string, projectId: string, userId: string) =>
    api.delete<ProjectMember>(
      `/companies/${companyId}/projects/${projectId}/members/${userId}`,
    ),

  updateMemberRole: (
    companyId: string,
    projectId: string,
    userId: string,
    role: ProjectMembershipRole,
  ) =>
    api.patch<ProjectMember>(
      `/companies/${companyId}/projects/${projectId}/members/${userId}`,
      { role },
    ),

  bulkAddMembers: (
    companyId: string,
    projectId: string,
    userIds: string[],
    role: ProjectMembershipRole = "contributor",
  ) =>
    api.post<BulkResult>(
      `/companies/${companyId}/projects/${projectId}/members/bulk`,
      { userIds, role },
    ),

  bulkRemoveMembers: (
    companyId: string,
    projectId: string,
    userIds: string[],
  ) =>
    api.delete<BulkResult>(
      `/companies/${companyId}/projects/${projectId}/members/bulk`,
      { userIds },
    ),
};
```

### 2. Query Keys (`ui/src/lib/queryKeys.ts`)

Ajouter dans l'objet `queryKeys` :

```typescript
projectMemberships: {
  list: (companyId: string, projectId: string) =>
    ["project-memberships", companyId, projectId] as const,
},
```

### 3. ProjectAccessTab Component (`ui/src/components/ProjectAccessTab.tsx`)

Structure du composant :

```
ProjectAccessTab ({ projectId, companyId })
  |-- Header (titre + bouton "Add Member")
  |-- Filters (role select + search input)
  |-- Table ou EmptyState
  |   |-- Lignes ProjectMemberRow
  |       |-- Avatar + Nom + Email
  |       |-- Role Badge + Role Select
  |       |-- Date relative
  |       |-- Actions Dropdown (Remove)
  |-- Footer (compteur)
  |-- AddProjectMemberDialog
  |-- Remove Confirmation Dialog
```

**Props** : `{ projectId: string; companyId: string }`

**State** :
- `roleFilter: string` ("all" | "owner" | "manager" | "contributor" | "viewer")
- `searchQuery: string`
- `addDialogOpen: boolean`
- `removeTarget: { userId: string; userName: string | null } | null`

**Queries** :
- `useQuery(queryKeys.projectMemberships.list(companyId, projectId))` -- liste des membres
- `useMutation` pour add, remove, updateRole, bulkAdd

**Pattern** : Suivre exactement le pattern de `Members.tsx` pour la structure visuelle.

### 4. AddProjectMemberDialog Component

**Props** : `{ open: boolean; onOpenChange: (open: boolean) => void; companyId: string; projectId: string; existingMemberIds: string[] }`

**Logique** :
1. Charger la liste des company members via `accessApi.listMembers(companyId)`
2. Filtrer ceux qui sont deja dans `existingMemberIds`
3. Afficher les membres disponibles avec checkboxes
4. Permettre la recherche parmi les disponibles
5. Permettre la selection d'un role (default: "contributor")
6. Si 1 selectionne --> appel `addMember()`
7. Si >1 selectionnes --> appel `bulkAddMembers()`
8. Invalider les queries apres succes

### 5. Integration dans ProjectDetail.tsx

Modifications necessaires :

1. **Type `ProjectTab`** : Ajouter `"access"` a l'union type
2. **`resolveProjectTab()`** : Ajouter `if (tab === "access") return "access";`
3. **Tab bar** : Ajouter l'onglet "Access" -- conditionne a `hasPermission("projects:manage_members")`
4. **Tab content** : Ajouter le rendu de `ProjectAccessTab` quand `activeTab === "access"`
5. **Import** : `import { ProjectAccessTab } from "../components/ProjectAccessTab"`

### 6. Roles Projet vs Roles Company

Les roles projet sont differents des roles company :
- **Roles projet** : `["owner", "manager", "contributor", "viewer"]` (definis dans `PROJECT_MEMBERSHIP_ROLES`)
- **Roles company** : `["admin", "manager", "contributor", "viewer"]` (definis dans `BUSINESS_ROLES`)

La difference cle est que le role projet a "owner" au lieu de "admin". Le composant devra utiliser un label mapping specifique :

```typescript
const PROJECT_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  contributor: "Contributor",
  viewer: "Viewer",
};

const PROJECT_ROLE_COLORS: Record<string, string> = {
  owner: "text-amber-600 bg-amber-50 border-amber-200",
  manager: "text-blue-600 bg-blue-50 border-blue-200",
  contributor: "text-green-600 bg-green-50 border-green-200",
  viewer: "text-gray-600 bg-gray-50 border-gray-200",
};
```

---

## Wireframe ASCII

### Onglet Access -- Etat normal avec membres

```
+============================================================================+
| Cockpit | Agents | Workflows | Drift | Access | Settings                   |
+============================================================================+
|                                                                            |
|  Project Access                                        [+ Add Member]      |
|                                                                            |
|  [All roles v]  [Search by name or email...                          ]     |
|                                                                            |
|  +----------------------------------------------------------------------+  |
|  | Member                | Role           | Added        | Actions      |  |
|  |----------------------------------------------------------------------|  |
|  | (A) Alice Dev         | [Contrib. v]   | 2 days ago   | [...]        |  |
|  |     alice@company.com | [Owner   ]     |              |              |  |
|  |----------------------------------------------------------------------|  |
|  | (B) Bob Manager       | [Manager v]    | 1 week ago   | [...]        |  |
|  |     bob@company.com   |                |              |              |  |
|  |----------------------------------------------------------------------|  |
|  | (C) Carol Viewer      | [Viewer  v]    | 3 weeks ago  | [...]        |  |
|  |     carol@company.com |                |              |              |  |
|  +----------------------------------------------------------------------+  |
|                                                                            |
|  Showing 3 of 3 members                                                   |
|                                                                            |
+============================================================================+
```

### Modale d'ajout de membre

```
+-----------------------------------------------+
| Add Members to Project                    [x]  |
| -----------------------------------------------+
| Select company members to add to this project. |
|                                                |
| [Search members...                       ]     |
| Role: [Contributor v]                          |
|                                                |
| +--------------------------------------------+|
| | [ ] (D) Dave Lead       dave@company.com   ||
| | [x] (E) Eve QA          eve@company.com    ||
| | [x] (F) Frank Dev       frank@company.com  ||
| | [ ] (G) Grace PM        grace@company.com  ||
| +--------------------------------------------+|
|                                                |
| 2 selected                                     |
|                                                |
|              [Cancel]  [Add Selected (2)]      |
+------------------------------------------------+
```

### Etat vide

```
+============================================================================+
| Cockpit | Agents | Workflows | Drift | Access | Settings                   |
+============================================================================+
|                                                                            |
|                    (Users icon)                                             |
|                                                                            |
|          No members yet. Add someone to get started.                       |
|                                                                            |
|                      [+ Add Member]                                        |
|                                                                            |
+============================================================================+
```

---

## Test Cases (Playwright E2E)

### T01-T10 : Fichier API client

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T01 | `project-memberships.ts` exporte `projectMembershipsApi` avec 6 fonctions | `ui/src/api/project-memberships.ts` |
| T02 | `listMembers` appelle `GET /companies/:companyId/projects/:projectId/members` | `ui/src/api/project-memberships.ts` |
| T03 | `addMember` appelle `POST` avec body `{ userId, role }` | `ui/src/api/project-memberships.ts` |
| T04 | `removeMember` appelle `DELETE .../members/:userId` | `ui/src/api/project-memberships.ts` |
| T05 | `updateMemberRole` appelle `PATCH` avec body `{ role }` | `ui/src/api/project-memberships.ts` |
| T06 | `bulkAddMembers` appelle `POST .../members/bulk` avec body `{ userIds, role }` | `ui/src/api/project-memberships.ts` |
| T07 | `bulkRemoveMembers` appelle `DELETE .../members/bulk` avec body `{ userIds }` | `ui/src/api/project-memberships.ts` |
| T08 | `ProjectMember` type exporte `id`, `userId`, `role`, `userName`, `userEmail`, `userImage`, `createdAt` | `ui/src/api/project-memberships.ts` |
| T09 | `BulkResult` type exporte `added/removed`, `skipped`, `results` | `ui/src/api/project-memberships.ts` |
| T10 | Import utilise `api` depuis `./client` | `ui/src/api/project-memberships.ts` |

### T11-T15 : Query Keys

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T11 | `queryKeys.projectMemberships` existe dans `queryKeys.ts` | `ui/src/lib/queryKeys.ts` |
| T12 | `queryKeys.projectMemberships.list(companyId, projectId)` retourne un tuple avec `"project-memberships"` | `ui/src/lib/queryKeys.ts` |

### T16-T40 : Composant ProjectAccessTab

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T16 | Fichier `ProjectAccessTab.tsx` existe et exporte `ProjectAccessTab` | `ui/src/components/ProjectAccessTab.tsx` |
| T17 | Props accepte `projectId: string` et `companyId: string` | `ui/src/components/ProjectAccessTab.tsx` |
| T18 | Utilise `useQuery` avec `queryKeys.projectMemberships.list` | `ui/src/components/ProjectAccessTab.tsx` |
| T19 | Contient `data-testid="proj-s04-access-tab"` | `ui/src/components/ProjectAccessTab.tsx` |
| T20 | Contient `data-testid="proj-s04-header"` | `ui/src/components/ProjectAccessTab.tsx` |
| T21 | Contient `data-testid="proj-s04-add-member-button"` | `ui/src/components/ProjectAccessTab.tsx` |
| T22 | Contient `data-testid="proj-s04-filters"` | `ui/src/components/ProjectAccessTab.tsx` |
| T23 | Contient `data-testid="proj-s04-filter-role"` | `ui/src/components/ProjectAccessTab.tsx` |
| T24 | Contient `data-testid="proj-s04-search"` | `ui/src/components/ProjectAccessTab.tsx` |
| T25 | Contient `data-testid="proj-s04-members-table"` | `ui/src/components/ProjectAccessTab.tsx` |
| T26 | Contient `data-testid` dynamique `proj-s04-member-row-` | `ui/src/components/ProjectAccessTab.tsx` |
| T27 | Contient `data-testid` dynamique `proj-s04-member-name-` | `ui/src/components/ProjectAccessTab.tsx` |
| T28 | Contient `data-testid` dynamique `proj-s04-member-email-` | `ui/src/components/ProjectAccessTab.tsx` |
| T29 | Contient `data-testid` dynamique `proj-s04-member-role-badge-` | `ui/src/components/ProjectAccessTab.tsx` |
| T30 | Contient `data-testid` dynamique `proj-s04-member-role-select-` | `ui/src/components/ProjectAccessTab.tsx` |
| T31 | Contient `data-testid` dynamique `proj-s04-member-actions-` | `ui/src/components/ProjectAccessTab.tsx` |
| T32 | Contient `data-testid` dynamique `proj-s04-action-remove-` | `ui/src/components/ProjectAccessTab.tsx` |
| T33 | Contient `data-testid="proj-s04-empty-state"` | `ui/src/components/ProjectAccessTab.tsx` |
| T34 | Contient `data-testid="proj-s04-footer"` | `ui/src/components/ProjectAccessTab.tsx` |
| T35 | Contient `data-testid="proj-s04-member-count"` | `ui/src/components/ProjectAccessTab.tsx` |
| T36 | Contient `data-testid="proj-s04-no-results"` | `ui/src/components/ProjectAccessTab.tsx` |
| T37 | Filtre par role utilise `useState` et `useMemo` pour filtrer les membres | `ui/src/components/ProjectAccessTab.tsx` |
| T38 | Recherche filtre par `userName` ou `userEmail` (case insensitive) | `ui/src/components/ProjectAccessTab.tsx` |
| T39 | `useMutation` pour `updateMemberRole` avec `invalidateQueries` sur succes | `ui/src/components/ProjectAccessTab.tsx` |
| T40 | `useMutation` pour `removeMember` avec `invalidateQueries` sur succes | `ui/src/components/ProjectAccessTab.tsx` |

### T41-T55 : Composant AddProjectMemberDialog

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T41 | Fichier `AddProjectMemberDialog.tsx` existe et exporte `AddProjectMemberDialog` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T42 | Contient `data-testid="proj-s04-add-dialog"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T43 | Contient `data-testid="proj-s04-add-dialog-title"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T44 | Contient `data-testid="proj-s04-add-search"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T45 | Contient `data-testid="proj-s04-available-members-list"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T46 | Contient `data-testid` dynamique `proj-s04-available-member-` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T47 | Contient `data-testid` dynamique `proj-s04-available-member-check-` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T48 | Contient `data-testid="proj-s04-add-role-select"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T49 | Contient `data-testid="proj-s04-add-submit"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T50 | Contient `data-testid="proj-s04-add-cancel"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T51 | Contient `data-testid="proj-s04-selected-count"` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T52 | Filtre les company members deja dans le projet via `existingMemberIds` | `ui/src/components/AddProjectMemberDialog.tsx` |
| T53 | Recherche dans les membres disponibles par nom ou email | `ui/src/components/AddProjectMemberDialog.tsx` |
| T54 | Utilise `bulkAddMembers` quand >1 selectionne ou `addMember` quand 1 selectionne | `ui/src/components/AddProjectMemberDialog.tsx` |
| T55 | Invalide `queryKeys.projectMemberships.list` apres ajout reussi | `ui/src/components/AddProjectMemberDialog.tsx` |

### T56-T65 : Confirmation de suppression

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T56 | Contient `data-testid="proj-s04-remove-confirm-dialog"` | `ui/src/components/ProjectAccessTab.tsx` |
| T57 | Contient `data-testid="proj-s04-remove-confirm-message"` | `ui/src/components/ProjectAccessTab.tsx` |
| T58 | Contient `data-testid="proj-s04-remove-confirm-submit"` | `ui/src/components/ProjectAccessTab.tsx` |
| T59 | Contient `data-testid="proj-s04-remove-confirm-cancel"` | `ui/src/components/ProjectAccessTab.tsx` |

### T60-T75 : Integration dans ProjectDetail.tsx

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T60 | `ProjectTab` union type contient `"access"` | `ui/src/pages/ProjectDetail.tsx` |
| T61 | `resolveProjectTab()` retourne `"access"` pour un pathname contenant `/access` | `ui/src/pages/ProjectDetail.tsx` |
| T62 | Tab bar contient un onglet "Access" | `ui/src/pages/ProjectDetail.tsx` |
| T63 | Contient `data-testid="proj-s04-tab-access"` | `ui/src/pages/ProjectDetail.tsx` |
| T64 | Onglet Access conditionne par `hasPermission("projects:manage_members")` ou un check equivalent | `ui/src/pages/ProjectDetail.tsx` |
| T65 | Quand `activeTab === "access"`, rend `ProjectAccessTab` avec `projectId` et `companyId` | `ui/src/pages/ProjectDetail.tsx` |
| T66 | Import de `ProjectAccessTab` depuis `"../components/ProjectAccessTab"` | `ui/src/pages/ProjectDetail.tsx` |

### T67-T75 : Roles projet et couleurs

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T67 | Utilise `PROJECT_MEMBERSHIP_ROLES` de `@mnm/shared` ou les roles locaux `["owner","manager","contributor","viewer"]` | `ui/src/components/ProjectAccessTab.tsx` |
| T68 | Labels de role projet : Owner, Manager, Contributor, Viewer | `ui/src/components/ProjectAccessTab.tsx` |
| T69 | Badge de role avec couleurs distinctes pour owner/manager/contributor/viewer | `ui/src/components/ProjectAccessTab.tsx` |

### T70-T80 : Composants UI shadcn/ui utilises

| ID | Test | Fichier verifie |
|----|------|-----------------|
| T70 | Utilise `Avatar` et `AvatarFallback` de shadcn/ui | `ui/src/components/ProjectAccessTab.tsx` |
| T71 | Utilise `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` de shadcn/ui | `ui/src/components/ProjectAccessTab.tsx` |
| T72 | Utilise `DropdownMenu` de shadcn/ui | `ui/src/components/ProjectAccessTab.tsx` |
| T73 | Utilise `Dialog` de shadcn/ui | `ui/src/components/AddProjectMemberDialog.tsx` |
| T74 | Utilise `Input` de shadcn/ui | `ui/src/components/ProjectAccessTab.tsx` |
| T75 | Utilise `Button` de shadcn/ui | `ui/src/components/ProjectAccessTab.tsx` |
| T76 | Utilise `Checkbox` de shadcn/ui pour selection multiple dans la modale d'ajout | `ui/src/components/AddProjectMemberDialog.tsx` |
| T77 | Utilise `EmptyState` existant pour l'etat vide | `ui/src/components/ProjectAccessTab.tsx` |
| T78 | Utilise `Badge` de shadcn/ui pour les role badges (ou composant custom inline) | `ui/src/components/ProjectAccessTab.tsx` |

---

## Definition of Done

### Niveau 1 -- Code
- [ ] `ui/src/api/project-memberships.ts` cree avec 6 fonctions API
- [ ] `ui/src/components/ProjectAccessTab.tsx` cree avec tous les `data-testid`
- [ ] `ui/src/components/AddProjectMemberDialog.tsx` cree avec tous les `data-testid`
- [ ] `ui/src/pages/ProjectDetail.tsx` modifie : onglet "Access" ajoute
- [ ] `ui/src/lib/queryKeys.ts` modifie : cles `projectMemberships` ajoutees
- [ ] Tous les `data-testid` presents dans les fichiers
- [ ] Onglet masque sans permission `projects:manage_members`

### Niveau 2 -- Tests
- [ ] 78 test cases E2E Playwright (file-content based) passent
- [ ] Tests verifient la structure des fichiers et les `data-testid`
- [ ] Aucune regression sur les tests existants (PROJ-S01, PROJ-S02, PROJ-S03)

### Niveau 3 -- Integration
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm build` passe sans erreur
- [ ] L'onglet "Access" est visible pour un Admin dans la page projet
- [ ] L'onglet "Access" est masque pour un Viewer sans la permission

### Niveau 4 -- Verification visuelle (Chrome MCP)
- [ ] L'onglet "Access" est visible dans la tab bar du projet
- [ ] Le tableau des membres s'affiche correctement
- [ ] Le filtre par role fonctionne
- [ ] La recherche fonctionne
- [ ] La modale d'ajout s'ouvre et affiche les membres disponibles
- [ ] Le changement de role met a jour le badge
- [ ] La suppression fonctionne avec confirmation

---

## Notes d'Implementation

### Ordre d'implementation recommande

1. Creer `ui/src/api/project-memberships.ts`
2. Ajouter les query keys dans `queryKeys.ts`
3. Creer `ui/src/components/AddProjectMemberDialog.tsx`
4. Creer `ui/src/components/ProjectAccessTab.tsx`
5. Modifier `ui/src/pages/ProjectDetail.tsx` pour ajouter l'onglet

### Points d'attention

1. **Distinction roles** : Ne pas confondre les `BUSINESS_ROLES` (company-level) avec les `PROJECT_MEMBERSHIP_ROLES` (project-level). Le `RoleBadge` existant est pour les business roles -- utiliser un badge custom pour les roles projet.

2. **Permissions** : L'onglet Access ne doit etre visible que pour les utilisateurs avec `projects:manage_members`. La lecture des membres (GET) n'est pas protegee par permission dans les routes backend (seulement par company access), mais la modification (POST/PATCH/DELETE) l'est.

3. **Modale d'ajout** : Charger les company members via `accessApi.listMembers(companyId)` et filtrer ceux qui sont deja dans le projet. Cela necessite 2 queries : une pour les project members, une pour les company members.

4. **Scope sync** : Le backend gere automatiquement la synchronisation `scope.projectIds` quand un membre est ajoute/retire. Le frontend n'a rien a faire cote scope -- le service PROJ-S02 s'en charge.

5. **api.delete avec body** : La methode `api.delete()` du client doit supporter un body pour `bulkRemoveMembers`. Verifier que le client API existant le supporte, sinon utiliser `fetch()` directement.

6. **Pagination** : Pour le MVP, ne pas implementer la pagination cote frontend. Le GET sans `?limit=` retourne tous les membres. La pagination cursor-based est disponible si necessaire plus tard.
