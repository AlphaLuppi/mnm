# RBAC-S05 : Navigation UI Masquee selon Permissions -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S05 |
| **Titre** | Navigation UI masquee selon permissions |
| **Epic** | Epic RBAC -- Roles & Permissions |
| **Sprint** | Sprint 3 (Phase 2) |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P1 |
| **Assignation** | Cofondateur (frontend) |
| **Bloque par** | RBAC-S04 (Enforcement 22 routes -- backend permissions enforced) |
| **Debloque** | Aucun (leaf story dans l'arbre de dependances RBAC) |
| **ADR** | ADR-002 (RBAC 4 roles) |
| **FRs couverts** | REQ-RBAC-06 (Masquage navigation selon permissions -- absent du DOM) |
| **Type** | Frontend (React hooks, composants sidebar, routes, Command Palette) |

---

## Description

### Contexte

RBAC-S04 a enforce `requirePermission()` sur les 22 fichiers de routes backend. Toute requete non autorisee retourne 403 avec `{ error: "Missing permission: <key>", details: { requiredPermission: "<key>" } }`. Le frontend affiche deja un toast d'erreur via `data-testid="rbac-s04-permission-denied-toast"`.

Cependant, **la navigation UI affiche toujours TOUS les liens a TOUS les utilisateurs**. Un Viewer voit "Members", "Settings", "Costs" dans la sidebar -- quand il clique, il recoit un 403. C'est frustrant et non-professionnel.

RBAC-S02 a cree :
- La matrice de presets `ROLE_PERMISSION_PRESETS` dans `packages/shared/src/rbac-presets.ts`
- L'endpoint `GET /api/companies/:companyId/rbac/effective-permissions/:memberId`
- L'endpoint `GET /api/companies/:companyId/rbac/presets`

Les 20 permission keys sont definies dans `packages/shared/src/constants.ts`.

### Ce que cette story fait

1. **Cree un hook `usePermissions()`** qui fetche les permissions effectives de l'utilisateur courant pour la company selectionnee
2. **Cree une fonction utilitaire `canUser(permissionKey)`** derivee du hook, retournant un boolean
3. **Masque (pas griser) les elements de navigation** pour lesquels l'utilisateur n'a pas la permission requise -- les elements sont absents du DOM, pas caches en CSS
4. **Protege les routes frontend** avec un composant `<RequirePermission>` qui redirige vers `/dashboard` si l'utilisateur n'a pas la permission
5. **Filtre la Command Palette (Ctrl+K)** pour masquer les commandes non autorisees
6. **Masque les boutons d'action** (New Issue, New Project, New Agent) si l'utilisateur n'a pas la permission de creation correspondante

### Principe UX : Masquage > Grisage

Comme specifie dans le UX Design (section 11.4) : "Les items non-autorises sont absents du DOM, pas grises (pas de frustration)". Un Viewer ne doit JAMAIS voir un bouton qu'il ne peut pas utiliser.

### Fallback : page 403

Si un utilisateur accede directement a une URL protegee (via bookmark, lien partage), il voit une page 403 avec le message "Vous n'avez pas acces a cette page. Contactez votre administrateur." et un bouton retour vers Dashboard.

---

## Architecture Technique

### Nouveau : Hook `usePermissions`

```typescript
// ui/src/hooks/usePermissions.ts
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useSession } from "../hooks/useSession"; // ou equivalent
import type { PermissionKey } from "@mnm/shared";

type PermissionsData = {
  businessRole: string | null;
  presetPermissions: PermissionKey[];
  explicitGrants: Array<{ permissionKey: PermissionKey; scope: unknown }>;
  effectivePermissions: PermissionKey[];
};

export function usePermissions() {
  const { selectedCompanyId } = useCompany();
  const { memberId } = useCurrentMember(); // derive du session + company

  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ["permissions", selectedCompanyId, memberId],
    queryFn: () =>
      api.get(`/companies/${selectedCompanyId}/rbac/effective-permissions/${memberId}`),
    enabled: !!selectedCompanyId && !!memberId,
    staleTime: 30_000, // cache 30s -- permissions changent rarement
  });

  const canUser = useCallback(
    (permissionKey: PermissionKey): boolean => {
      if (!data) return false;
      return data.effectivePermissions.includes(permissionKey);
    },
    [data],
  );

  return {
    permissions: data?.effectivePermissions ?? [],
    businessRole: data?.businessRole ?? null,
    canUser,
    isLoading,
  };
}
```

### Nouveau : API endpoint -- current user membership ID

L'endpoint `GET /api/companies/:companyId/rbac/effective-permissions/:memberId` necessite un `memberId`. Il faut un moyen de connaitre le `memberId` de l'utilisateur courant. Deux options :

**Option A (recommandee)** : Ajouter `GET /api/companies/:companyId/my-permissions` qui derive automatiquement le memberId du session token :

```typescript
router.get("/companies/:companyId/my-permissions", async (req, res) => {
  const companyId = req.params.companyId;
  assertCompanyAccess(req, companyId);
  const userId = req.actor.userId;
  const effective = await access.getEffectivePermissions(companyId, "user", userId);
  res.json(effective);
});
```

**Option B** : Inclure le `membershipId` dans la reponse de `GET /api/companies/:companyId/members` et l'utiliser cote client.

L'option A est preferee car elle evite un round-trip supplementaire.

### Nouveau : Composant `<RequirePermission>`

```typescript
// ui/src/components/RequirePermission.tsx
export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canUser, isLoading } = usePermissions();
  if (isLoading) return null; // ou skeleton
  if (!canUser(permission)) return fallback ?? null;
  return <>{children}</>;
}
```

### Nouveau : Page 403

```typescript
// ui/src/pages/Forbidden.tsx
export function ForbiddenPage() {
  return (
    <div data-testid="rbac-s05-forbidden-page">
      <h1>Acces refuse</h1>
      <p data-testid="rbac-s05-forbidden-message">
        Vous n'avez pas acces a cette page. Contactez votre administrateur.
      </p>
      <Link to="/dashboard" data-testid="rbac-s05-forbidden-back-link">
        Retour au Dashboard
      </Link>
    </div>
  );
}
```

---

## Mapping : Element de Navigation -> Permission Requise

### Sidebar principale (`Sidebar.tsx`)

| Element sidebar | Route | Permission requise | Roles avec acces | data-testid masquage |
|----------------|-------|-------------------|-----------------|---------------------|
| **New Issue** (bouton) | action: openNewIssue() | `stories:create` | admin, manager, contributor | `rbac-s05-nav-new-issue` |
| **Dashboard** | `/dashboard` | aucune (acces universel) | tous | `rbac-s05-nav-dashboard` |
| **Inbox** | `/inbox` | aucune (acces universel) | tous | `rbac-s05-nav-inbox` |
| **Issues** | `/issues` | aucune (lecture autorisee) | tous | `rbac-s05-nav-issues` |
| **Workflows** | `/workflows` | `workflows:create` | admin, manager | `rbac-s05-nav-workflows` |
| **Goals** | `/goals` | `projects:create` | admin, manager | `rbac-s05-nav-goals` |
| **Members** | `/members` | `users:invite` | admin, manager | `rbac-s05-nav-members` |
| **Org** | `/org` | aucune (lecture autorisee) | tous | `rbac-s05-nav-org` |
| **Costs** | `/costs` | `dashboard:view` | admin, manager, viewer | `rbac-s05-nav-costs` |
| **Activity** | `/activity` | `audit:read` | admin, manager, viewer | `rbac-s05-nav-activity` |
| **Settings** | `/company/settings` | `company:manage_settings` | admin | `rbac-s05-nav-settings` |

### Sections sidebar

| Section | Regle de visibilite | data-testid |
|---------|-------------------|-------------|
| **Work** | Visible si au moins 1 item enfant est visible | `rbac-s05-section-work` |
| **Projects** (SidebarProjects) | Toujours visible (lecture autorisee), bouton `+` masque si pas `projects:create` | `rbac-s05-section-projects` |
| **Agents** (SidebarAgents) | Toujours visible (lecture autorisee), bouton `+` masque si pas `agents:create` | `rbac-s05-section-agents` |
| **Company** | Visible si au moins 1 item enfant est visible | `rbac-s05-section-company` |

### Boutons d'action dans les sections

| Bouton | Contexte | Permission requise | data-testid |
|--------|---------|-------------------|-------------|
| **+ New Project** (SidebarProjects) | Header section Projects | `projects:create` | `rbac-s05-btn-new-project` |
| **+ New Agent** (SidebarAgents) | Header section Agents | `agents:create` | `rbac-s05-btn-new-agent` |

### CompanyRail (`CompanyRail.tsx`)

| Element | Permission requise | data-testid |
|---------|-------------------|-------------|
| **Company icons** | aucune (acces universel) | inchange |
| **+ Add company** | aucune (creation company = feature instance admin, pas RBAC company) | inchange |
| **User Menu** | aucune | inchange |

### Routes protegees (`App.tsx`)

| Route | Permission requise | Redirect si refuse |
|-------|-------------------|-------------------|
| `/dashboard` | aucune | -- |
| `/inbox`, `/inbox/*` | aucune | -- |
| `/issues`, `/issues/*` | aucune | -- |
| `/workflows`, `/workflows/*` | `workflows:create` | `/dashboard` |
| `/workflows/new` | `workflows:create` | `/dashboard` |
| `/goals`, `/goals/*` | `projects:create` | `/dashboard` |
| `/members` | `users:invite` | `/dashboard` |
| `/costs` | `dashboard:view` | `/dashboard` |
| `/activity` | `audit:read` | `/dashboard` |
| `/company/settings` | `company:manage_settings` | `/dashboard` |
| `/agents/new` | `agents:create` | `/dashboard` |
| `/approvals`, `/approvals/*` | `joins:approve` | `/dashboard` |
| `/projects`, `/projects/*` | aucune | -- |
| `/agents`, `/agents/*` | aucune | -- |
| `/org` | aucune | -- |

### Command Palette (Ctrl+K)

La Command Palette doit filtrer les commandes selon les permissions. Les commandes masquees :

| Commande | Permission requise | data-testid |
|----------|-------------------|-------------|
| "New Issue" | `stories:create` | `rbac-s05-cmd-new-issue` |
| "New Project" | `projects:create` | `rbac-s05-cmd-new-project` |
| "New Agent" | `agents:create` | `rbac-s05-cmd-new-agent` |
| "New Workflow" | `workflows:create` | `rbac-s05-cmd-new-workflow` |
| "Invite Member" | `users:invite` | `rbac-s05-cmd-invite-member` |
| "Settings" | `company:manage_settings` | `rbac-s05-cmd-settings` |
| "Activity" | `audit:read` | `rbac-s05-cmd-activity` |
| "Costs" | `dashboard:view` | `rbac-s05-cmd-costs` |

Les commandes de navigation vers Issues, Projects, Agents, Dashboard, Inbox restent visibles pour tous.

---

## data-test-id -- Liste Exhaustive

### Hook et infrastructure

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s05-permissions-loading` | Skeleton/spinner | Affiche pendant le chargement des permissions |

### Sidebar navigation items

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s05-nav-new-issue` | Bouton New Issue | Present seulement si `stories:create` |
| `rbac-s05-nav-dashboard` | Lien Dashboard | Toujours present |
| `rbac-s05-nav-inbox` | Lien Inbox | Toujours present |
| `rbac-s05-nav-issues` | Lien Issues | Toujours present |
| `rbac-s05-nav-workflows` | Lien Workflows | Present seulement si `workflows:create` |
| `rbac-s05-nav-goals` | Lien Goals | Present seulement si `projects:create` |
| `rbac-s05-nav-members` | Lien Members | Present seulement si `users:invite` |
| `rbac-s05-nav-org` | Lien Org | Toujours present |
| `rbac-s05-nav-costs` | Lien Costs | Present seulement si `dashboard:view` |
| `rbac-s05-nav-activity` | Lien Activity | Present seulement si `audit:read` |
| `rbac-s05-nav-settings` | Lien Settings | Present seulement si `company:manage_settings` |

### Sidebar sections

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s05-section-work` | Section "Work" | Masquee si aucun enfant visible |
| `rbac-s05-section-projects` | Section "Projects" | Toujours visible |
| `rbac-s05-section-agents` | Section "Agents" | Toujours visible |
| `rbac-s05-section-company` | Section "Company" | Masquee si aucun enfant visible |

### Boutons d'action

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s05-btn-new-project` | Bouton + dans Projects | Present seulement si `projects:create` |
| `rbac-s05-btn-new-agent` | Bouton + dans Agents | Present seulement si `agents:create` |

### Page 403

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s05-forbidden-page` | Page 403 | Container de la page "acces refuse" |
| `rbac-s05-forbidden-message` | Message 403 | Texte "Vous n'avez pas acces..." |
| `rbac-s05-forbidden-back-link` | Lien retour | Bouton "Retour au Dashboard" |

### Route guards

| data-testid | Composant | Description |
|-------------|-----------|-------------|
| `rbac-s05-route-guard` | RequirePermission wrapper | Wrapper autour du contenu protege |
| `rbac-s05-route-redirect` | Navigate composant | Redirect vers dashboard si pas de permission |

---

## Acceptance Criteria

### AC1 -- Viewer ne voit pas les liens Settings, Members, Workflows, Goals

```gherkin
Given un utilisateur avec businessRole "viewer" dans la company selectionnee
When la sidebar se charge
Then les liens suivants sont absents du DOM :
  | lien | data-testid |
  | Settings | rbac-s05-nav-settings |
  | Members | rbac-s05-nav-members |
  | Workflows | rbac-s05-nav-workflows |
  | Goals | rbac-s05-nav-goals |
  | New Issue | rbac-s05-nav-new-issue |
And les liens suivants sont presents dans le DOM :
  | lien | data-testid |
  | Dashboard | rbac-s05-nav-dashboard |
  | Inbox | rbac-s05-nav-inbox |
  | Issues | rbac-s05-nav-issues |
  | Org | rbac-s05-nav-org |
  | Costs | rbac-s05-nav-costs |
  | Activity | rbac-s05-nav-activity |
```

### AC2 -- Contributor voit Issues et New Issue, mais pas Settings ni Members

```gherkin
Given un utilisateur avec businessRole "contributor" dans la company
When la sidebar se charge
Then les liens suivants sont presents :
  | lien | data-testid |
  | Dashboard | rbac-s05-nav-dashboard |
  | Issues | rbac-s05-nav-issues |
  | New Issue | rbac-s05-nav-new-issue |
  | Org | rbac-s05-nav-org |
And les liens suivants sont absents :
  | lien | data-testid |
  | Settings | rbac-s05-nav-settings |
  | Members | rbac-s05-nav-members |
  | Workflows | rbac-s05-nav-workflows |
  | Goals | rbac-s05-nav-goals |
  | Costs | rbac-s05-nav-costs |
  | Activity | rbac-s05-nav-activity |
```

### AC3 -- Manager voit tout sauf Settings et SSO

```gherkin
Given un utilisateur avec businessRole "manager" dans la company
When la sidebar se charge
Then les liens suivants sont presents :
  | lien | data-testid |
  | Dashboard | rbac-s05-nav-dashboard |
  | Issues | rbac-s05-nav-issues |
  | Workflows | rbac-s05-nav-workflows |
  | Goals | rbac-s05-nav-goals |
  | Members | rbac-s05-nav-members |
  | Costs | rbac-s05-nav-costs |
  | Activity | rbac-s05-nav-activity |
  | New Issue | rbac-s05-nav-new-issue |
And les liens suivants sont absents :
  | lien | data-testid |
  | Settings | rbac-s05-nav-settings |
```

### AC4 -- Admin voit tout

```gherkin
Given un utilisateur avec businessRole "admin" dans la company
When la sidebar se charge
Then TOUS les liens de navigation sont presents dans le DOM
And le bouton "New Issue" est present
And le bouton "+" dans Projects est present avec data-testid="rbac-s05-btn-new-project"
And le bouton "+" dans Agents est present avec data-testid="rbac-s05-btn-new-agent"
```

### AC5 -- Section masquee quand aucun enfant visible

```gherkin
Given un utilisateur avec businessRole "viewer" (pas de workflows:create, pas de projects:create)
When la sidebar se charge
Then la section "Work" est masquee si le seul enfant visible (Issues) n'est pas suffisant pour la section
  OR la section "Work" reste visible avec seulement Issues
And la section "Company" est visible car Costs et Activity sont presents
```

Note : La section "Work" contient Issues (visible pour tous), donc elle reste toujours visible. La regle "section masquee si aucun enfant" s'applique potentiellement a "Company" dans un scenario theorique.

### AC6 -- Route protegee redirige vers Dashboard

```gherkin
Given un utilisateur avec businessRole "viewer"
When il accede directement a /company/settings via URL
Then il est redirige vers /dashboard
And la page 403 n'est PAS affichee (redirect silencieux)
```

### AC7 -- Route protegee avec page 403 (lien partage)

```gherkin
Given un utilisateur avec businessRole "contributor"
When il clique un lien partage vers /workflows/new
Then la page affiche data-testid="rbac-s05-forbidden-page"
And le message "Vous n'avez pas acces a cette page" est visible
And un lien "Retour au Dashboard" est present
```

Note d'implementation : le choix entre redirect silencieux (AC6) et page 403 (AC7) depend du contexte. Option recommandee : redirect silencieux pour les liens de navigation sidebar (l'utilisateur ne devrait jamais les voir), page 403 pour les URLs accedees directement (bookmark, lien copie-colle).

### AC8 -- Command Palette filtre les commandes

```gherkin
Given un utilisateur avec businessRole "viewer"
When il ouvre la Command Palette (Ctrl+K)
And il tape "New"
Then aucune commande de creation n'apparait (New Issue, New Project, New Agent, New Workflow)
And la commande "Settings" n'apparait pas
```

### AC9 -- Bouton + masque dans SidebarProjects pour Viewer

```gherkin
Given un utilisateur avec businessRole "viewer" (pas de projects:create)
When la sidebar affiche la section Projects
Then le bouton "+" (New Project) est absent du DOM
And les projets existants sont toujours listes (lecture autorisee)
```

### AC10 -- Bouton + masque dans SidebarAgents pour Viewer

```gherkin
Given un utilisateur avec businessRole "viewer" (pas de agents:create)
When la sidebar affiche la section Agents
Then le bouton "+" (New Agent) est absent du DOM
And les agents existants sont toujours listes (lecture autorisee)
```

### AC11 -- Permissions se mettent a jour quand le businessRole change

```gherkin
Given un utilisateur connecte avec businessRole "viewer"
When un admin change son role a "manager"
And l'utilisateur refresh la page (ou les permissions se re-fetchent)
Then la sidebar affiche les liens supplementaires du manager (Members, Workflows, Goals, etc.)
```

### AC12 -- Mode local_trusted affiche tout

```gherkin
Given le deploymentMode est "local_trusted" (pas d'authentification)
When la sidebar se charge
Then TOUS les liens de navigation sont presents (bypass RBAC total)
```

---

## Matrice de Visibilite par Role

Resume compact de la visibilite de chaque element pour chaque businessRole :

| Element | Permission | Admin | Manager | Contributor | Viewer |
|---------|-----------|-------|---------|-------------|--------|
| Dashboard | -- | Y | Y | Y | Y |
| Inbox | -- | Y | Y | Y | Y |
| New Issue | `stories:create` | Y | Y | Y | N |
| Issues | -- | Y | Y | Y | Y |
| Workflows | `workflows:create` | Y | Y | N | N |
| Goals | `projects:create` | Y | Y | N | N |
| Projects (section) | -- | Y | Y | Y | Y |
| + New Project | `projects:create` | Y | Y | N | N |
| Agents (section) | -- | Y | Y | Y | Y |
| + New Agent | `agents:create` | Y | Y | N | N |
| Members | `users:invite` | Y | Y | N | N |
| Org | -- | Y | Y | Y | Y |
| Costs | `dashboard:view` | Y | Y | N | Y |
| Activity | `audit:read` | Y | Y | N | Y |
| Settings | `company:manage_settings` | Y | N | N | N |

---

## Fichiers a Modifier / Creer

### Nouveaux fichiers

| Fichier | Description |
|---------|-------------|
| `ui/src/hooks/usePermissions.ts` | Hook React : fetche les permissions effectives via API |
| `ui/src/components/RequirePermission.tsx` | Composant wrapper pour masquer du contenu selon permission |
| `ui/src/pages/Forbidden.tsx` | Page 403 "Acces refuse" |
| `server/src/routes/access.ts` (modification) | Ajout endpoint `GET /companies/:companyId/my-permissions` |

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `ui/src/components/Sidebar.tsx` | Envelopper chaque `SidebarNavItem` dans `{canUser("key") && ...}` |
| `ui/src/components/SidebarProjects.tsx` | Masquer le bouton `+` si pas `projects:create` |
| `ui/src/components/SidebarAgents.tsx` | Masquer le bouton `+` si pas `agents:create` |
| `ui/src/components/SidebarSection.tsx` | Pas de modification directe (le masquage se fait au niveau du parent) |
| `ui/src/App.tsx` | Ajouter `<RequirePermission>` autour des routes protegees |
| `ui/src/lib/queryKeys.ts` | Ajouter cle `permissions` |
| `ui/src/api/access.ts` | Ajouter `getMyPermissions(companyId)` |

---

## Notes Techniques

### Performance

- **Cache 30s (`staleTime`)** : les permissions changent rarement, pas besoin de refetch a chaque navigation
- **Invalidation manuelle** : quand un admin change le role d'un utilisateur, invalider `queryKey: ["permissions"]` pour forcer un refetch
- **Pas de skeleton excessif** : pendant le loading des permissions, afficher la sidebar normalement (full access) puis masquer quand les permissions arrivent. Alternative : masquer toute la sidebar pendant le loading (avec skeleton) pour eviter un "flash" de liens qui disparaissent. **Recommandation : skeleton rapide (< 300ms stale) pour eviter le flash.**

### Securite

- Le masquage frontend est **uniquement cosmétique**. La vraie securite est assuree par `requirePermission()` cote backend (RBAC-S04). Un utilisateur malicieux qui modifie le DOM ne peut rien faire car le backend refuse les requetes.
- Toujours traiter les permissions comme un cache cote client. Le backend est la source de verite.

### Mode local_trusted

- En mode `local_trusted` (pas d'authentification), le hook `usePermissions` doit retourner toutes les permissions. Deux strategies :
  1. Le hook detecte `deploymentMode === "local_trusted"` et retourne `PERMISSION_KEYS` (toutes les permissions)
  2. Le backend retourne toutes les permissions pour l'acteur `local_implicit`
- **Recommandation : strategie 2** (le backend gere deja le bypass dans `requirePermission`)

### Accessibilite

- Les elements masques sont **absents du DOM** (`{condition && <element>}`), pas caches en CSS (`display: none`). Cela garantit que les lecteurs d'ecran ne les annoncent pas.
- La page 403 doit avoir un `role="alert"` et un `aria-live="polite"` pour les lecteurs d'ecran.

### Changement de company

- Quand l'utilisateur change de company (via CompanyRail), les permissions doivent se re-fetcher car il peut avoir un role different dans chaque company.
- Le `queryKey` inclut `selectedCompanyId`, donc le refetch est automatique.

---

## Cas de Test Suggeres pour l'Agent QA

### Tests E2E Playwright (`e2e/tests/RBAC-S05.spec.ts`)

#### Test 1 : Viewer -- sidebar masquee

```
1. Se connecter en tant que viewer
2. Naviguer vers le dashboard
3. Verifier que les data-testid suivants sont absents du DOM :
   - rbac-s05-nav-settings
   - rbac-s05-nav-members
   - rbac-s05-nav-workflows
   - rbac-s05-nav-goals
   - rbac-s05-nav-new-issue
   - rbac-s05-btn-new-project
   - rbac-s05-btn-new-agent
4. Verifier que les data-testid suivants sont presents :
   - rbac-s05-nav-dashboard
   - rbac-s05-nav-inbox
   - rbac-s05-nav-issues
   - rbac-s05-nav-org
   - rbac-s05-nav-costs
   - rbac-s05-nav-activity
```

#### Test 2 : Contributor -- sidebar partielle

```
1. Se connecter en tant que contributor
2. Verifier presence de : nav-dashboard, nav-issues, nav-new-issue, nav-org
3. Verifier absence de : nav-settings, nav-members, nav-workflows, nav-goals, nav-costs, nav-activity
```

#### Test 3 : Manager -- sidebar etendue

```
1. Se connecter en tant que manager
2. Verifier presence de tous les liens sauf Settings
3. Verifier absence de nav-settings
4. Verifier presence de btn-new-project et btn-new-agent
```

#### Test 4 : Admin -- sidebar complete

```
1. Se connecter en tant que admin
2. Verifier presence de TOUS les liens et boutons
3. Verifier specifiquement : nav-settings present
```

#### Test 5 : Route protegee -- redirect pour viewer

```
1. Se connecter en tant que viewer
2. Naviguer directement vers /company/settings
3. Verifier le redirect vers /dashboard
```

#### Test 6 : Route protegee -- page 403

```
1. Se connecter en tant que contributor
2. Naviguer directement vers /workflows/new
3. Verifier la presence de rbac-s05-forbidden-page
4. Cliquer sur rbac-s05-forbidden-back-link
5. Verifier l'arrivee sur /dashboard
```

#### Test 7 : Command Palette filtree

```
1. Se connecter en tant que viewer
2. Ouvrir la Command Palette (Ctrl+K)
3. Taper "New"
4. Verifier qu'aucune commande de creation n'apparait
5. Taper "Settings"
6. Verifier que la commande Settings n'apparait pas
```

#### Test 8 : Bouton + masque dans Projects

```
1. Se connecter en tant que viewer
2. Verifier que la section Projects est visible (projets listes)
3. Verifier que le bouton + est absent (rbac-s05-btn-new-project absent du DOM)
```

#### Test 9 : Bouton + masque dans Agents

```
1. Se connecter en tant que viewer
2. Verifier que la section Agents est visible (agents listes)
3. Verifier que le bouton + est absent (rbac-s05-btn-new-agent absent du DOM)
```

#### Test 10 : Changement de role -- sidebar se met a jour

```
1. Se connecter en tant que viewer
2. (Via API admin) changer le role a "admin"
3. Recharger la page
4. Verifier que TOUS les liens sont maintenant presents
```

---

## Dependances

### Stories prerequises (DONE)

- **RBAC-S01** : Fix hasPermission() avec scope JSONB
- **RBAC-S02** : 20 permission keys + presets par role + endpoint effective-permissions
- **RBAC-S03** : businessRole sur company_memberships
- **RBAC-S04** : Enforcement requirePermission() sur 22 routes (backend)

### Stories connexes

- **RBAC-S06** : UI admin matrice permissions -- utilise le meme hook `usePermissions()` pour l'affichage
- **RBAC-S07** : Badges couleur par role -- complementaire pour l'UX role

---

## Definition of Done

1. Le hook `usePermissions()` fetche les permissions effectives de l'utilisateur courant
2. L'endpoint `GET /companies/:companyId/my-permissions` retourne les permissions sans connaitre le memberId
3. La sidebar masque les liens selon la matrice de visibilite (cf. tableau ci-dessus)
4. Les boutons + dans Projects et Agents sont masques si pas de permission
5. Les routes protegees redirigent ou affichent une page 403
6. La Command Palette filtre les commandes non autorisees
7. Le mode `local_trusted` affiche tout (bypass)
8. Les tests E2E Playwright couvrent les 4 roles + routes + command palette
9. Aucun element masque n'est grises -- il est absent du DOM
10. Le changement de company declenche un refetch des permissions
