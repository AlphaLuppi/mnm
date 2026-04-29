# MU-S02 : Page Membres avec Tableau et Filtres -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | MU-S02 |
| **Titre** | Page Membres avec Tableau et Filtres |
| **Epic** | Epic 3 -- Multi-User & Auth |
| **Sprint** | Batch 4 -- RBAC + Multi-User |
| **Effort** | M (3 SP, 2-3j) |
| **Assignation** | Cofondateur |
| **Bloque par** | MU-S01 (API Invitations par Email) |
| **Debloque** | RBAC-S07 (Badges role) |
| **Type** | Frontend + Backend enrichment (page UI + API enhancement) |

---

## Description

### Contexte

MnM a besoin d'une page dediee pour gerer les membres d'une company. Actuellement, l'endpoint `GET /api/companies/:companyId/members` existe (`server/src/routes/access.ts` L2662-2667) mais ne retourne que les donnees brutes de `company_memberships` -- sans join sur la table `user` (pas de nom, pas d'email). La page Membres doit afficher un tableau riche avec les informations utilisateur, le role metier, le statut, et la date d'ajout.

### Ce qui existe deja

1. **Endpoint GET `/api/companies/:companyId/members`** (`server/src/routes/access.ts` L2662-2667) :
   - Protege par permission `users:manage_permissions`
   - Appelle `access.listMembers(companyId)` qui fait un simple `SELECT * FROM company_memberships WHERE companyId = :companyId`
   - **Manque** : join sur `authUsers` pour recuperer nom, email, image

2. **Service `listMembers()`** (`server/src/services/access.ts` L128-134) :
   - Simple query sans join
   - **A enrichir** : joindre `authUsers` pour le nom et l'email du principal

3. **Endpoint PATCH `/api/companies/:companyId/members/:memberId/business-role`** (RBAC-S03) :
   - Permet de changer le businessRole d'un membre
   - Protege par `users:manage_permissions`

4. **Endpoint PATCH `/api/companies/:companyId/members/:memberId/permissions`** :
   - Permet de modifier les grants de permissions d'un membre
   - Protege par `users:manage_permissions`

5. **API client frontend** (`ui/src/api/access.ts`) :
   - Contient deja `createCompanyInvite`, `getInvite`, `acceptInvite`, `listJoinRequests`, etc.
   - **Manque** : `listMembers()`, `updateMemberBusinessRole()`, `removeMember()`

6. **Composants shadcn/ui disponibles** :
   - `Badge`, `Button`, `Dialog`, `DropdownMenu`, `Select`, `Input`, `Tabs`, `Card`, `Tooltip`
   - **Manque** : shadcn/ui DataTable (TanStack Table) -- a ajouter

7. **Routing** (`ui/src/App.tsx`) :
   - Pas de route `/members` existante
   - **A ajouter** : `<Route path="members" element={<Members />} />`

8. **Sidebar** (`ui/src/components/Sidebar.tsx`) :
   - Pas d'entree "Members" -- le UX design prevoit un item `[Membres]` dans la sidebar
   - **A ajouter** : lien vers `/members`

9. **Query keys** (`ui/src/lib/queryKeys.ts`) :
   - Pas de cle pour les members
   - **A ajouter** : `access.members: (companyId: string) => ["access", "members", companyId]`

10. **Constants** (`packages/shared/src/constants.ts`) :
    - `BUSINESS_ROLES` : `["admin", "manager", "contributor", "viewer"]`
    - `BUSINESS_ROLE_LABELS` : labels affichables
    - `MEMBERSHIP_STATUSES` : `["pending", "active", "suspended"]`

### Ce qui manque

1. **Backend** : Enrichir `listMembers()` avec un JOIN sur `authUsers` pour retourner nom, email, image
2. **API client** : Ajouter `listMembers()`, `updateMemberBusinessRole()`, `suspendMember()` dans `ui/src/api/access.ts`
3. **Page Members** : Nouveau composant `ui/src/pages/Members.tsx`
4. **Route** : Ajouter `/members` dans `ui/src/App.tsx`
5. **Sidebar** : Ajouter l'item "Members" dans la sidebar
6. **Query keys** : Ajouter les cles pour members
7. **Invite dialog integration** : Bouton "Invite member" qui ouvre un dialog d'invitation par email

---

## Etat Actuel du Code (Analyse)

### Fichiers a modifier

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/access.ts` | Service RBAC + `listMembers()` simple | MODIFIE : enrichir listMembers avec JOIN authUsers |
| `server/src/routes/access.ts` | Routes API access/invite/members | MODIFIE : supprimer le member via PATCH status suspended |
| `ui/src/api/access.ts` | API client access (invites, join-requests) | MODIFIE : ajouter listMembers, updateMemberBusinessRole, suspendMember |
| `ui/src/lib/queryKeys.ts` | Query keys React Query | MODIFIE : ajouter access.members |
| `ui/src/App.tsx` | Routing | MODIFIE : ajouter Route /members |
| `ui/src/components/Sidebar.tsx` | Navigation sidebar | MODIFIE : ajouter lien Members |

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `ui/src/pages/Members.tsx` | Page principale Membres avec DataTable, filtres, actions |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/company_memberships.ts` | Schema Drizzle memberships |
| `packages/db/src/schema/auth.ts` | Schema Drizzle authUsers (id, name, email, image) |
| `packages/shared/src/constants.ts` | BUSINESS_ROLES, MEMBERSHIP_STATUSES, BUSINESS_ROLE_LABELS |
| `packages/shared/src/rbac-presets.ts` | ROLE_PERMISSION_PRESETS |
| `packages/shared/src/types/access.ts` | Type CompanyMembership |
| `ui/src/components/ui/badge.tsx` | Badge shadcn/ui |
| `ui/src/components/ui/dialog.tsx` | Dialog shadcn/ui |
| `ui/src/components/ui/dropdown-menu.tsx` | DropdownMenu shadcn/ui |
| `ui/src/components/ui/select.tsx` | Select shadcn/ui |
| `ui/src/components/ui/input.tsx` | Input shadcn/ui |
| `ui/src/components/FilterBar.tsx` | FilterBar composant existant |
| `ui/src/pages/CompanySettings.tsx` | Reference pattern pour page avec tabs et mutations |
| `ui/src/pages/Agents.tsx` | Reference pattern pour page avec liste, filtres, queries |

### Conventions du codebase (a respecter)

1. **Pages pattern** : `useCompany()` pour le companyId, `useBreadcrumbs()` pour le fil d'Ariane, `useQuery()` pour les donnees
2. **API client** : `api.get<T>(path)`, `api.patch<T>(path, body)`, `api.post<T>(path, body)`
3. **Query keys** : Factories dans `ui/src/lib/queryKeys.ts` avec pattern `[namespace, companyId]`
4. **Error handling** : `isLoading` / `error` / `data` pattern avec `PageSkeleton` en loading
5. **Mutations** : `useMutation()` avec `onSuccess` qui invalide les queries et `onError` pour les messages d'erreur
6. **shadcn/ui imports** : `import { Component } from "@/components/ui/component"`
7. **Lucide icons** : Import depuis `lucide-react`
8. **Tailwind** : Utility-first, classes directes dans JSX
9. **Context** : `useCompany()` fournit `selectedCompanyId`, `selectedCompany`
10. **Breadcrumbs** : `setBreadcrumbs([{ label: "...", href: "..." }, { label: "..." }])`

---

## Specification Technique Detaillee

### T1 : Enrichir `listMembers()` dans le service -- `server/src/services/access.ts`

L'endpoint actuel retourne les donnees brutes de `company_memberships`. Il faut joindre `authUsers` pour obtenir le nom, l'email et l'image de chaque membre.

```typescript
// AVANT (L128-134) :
async function listMembers(companyId: string) {
  return db
    .select()
    .from(companyMemberships)
    .where(eq(companyMemberships.companyId, companyId))
    .orderBy(sql`${companyMemberships.createdAt} desc`);
}

// APRES :
async function listMembers(companyId: string) {
  return db
    .select({
      id: companyMemberships.id,
      companyId: companyMemberships.companyId,
      principalType: companyMemberships.principalType,
      principalId: companyMemberships.principalId,
      status: companyMemberships.status,
      membershipRole: companyMemberships.membershipRole,
      businessRole: companyMemberships.businessRole,
      createdAt: companyMemberships.createdAt,
      updatedAt: companyMemberships.updatedAt,
      // Enriched user fields
      userName: authUsers.name,
      userEmail: authUsers.email,
      userImage: authUsers.image,
    })
    .from(companyMemberships)
    .leftJoin(
      authUsers,
      and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, authUsers.id),
      ),
    )
    .where(eq(companyMemberships.companyId, companyId))
    .orderBy(sql`${companyMemberships.createdAt} desc`);
}
```

**Note** : Le `leftJoin` est necessaire car certains membres peuvent etre des agents (`principalType: "agent"`). Pour les agents, `userName`/`userEmail`/`userImage` seront `null`, et le frontend affichera le `principalId` comme fallback.

**Import a ajouter** (si pas deja present) :

```typescript
import { authUsers } from "@mnm/db";
```

---

### T2 : Ajouter endpoint PATCH suspend member -- `server/src/routes/access.ts`

Ajouter un endpoint pour suspendre/reactiver un membre. Cela permet a un admin de desactiver un membre sans le supprimer.

```typescript
router.patch(
  "/companies/:companyId/members/:memberId/status",
  async (req, res) => {
    const companyId = req.params.companyId as string;
    const memberId = req.params.memberId as string;
    await assertCompanyPermission(req, companyId, "users:manage_permissions");

    const { status } = req.body;
    if (!["active", "suspended"].includes(status)) {
      throw badRequest("Status must be 'active' or 'suspended'");
    }

    const [updated] = await db
      .update(companyMemberships)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.id, memberId),
        ),
      )
      .returning();

    if (!updated) throw notFound("Member not found");

    await logActivity(db, {
      companyId,
      actorType: req.actor.type === "agent" ? "agent" : "user",
      actorId:
        req.actor.type === "agent"
          ? req.actor.agentId ?? "unknown"
          : req.actor.userId ?? "unknown",
      action: `member.status.${status}`,
      entityType: "member",
      entityId: memberId,
      details: { status },
    });

    res.json(updated);
  },
);
```

---

### T3 : Ajouter les fonctions API client -- `ui/src/api/access.ts`

```typescript
// Types pour les membres enrichis
export type EnrichedMember = {
  id: string;
  companyId: string;
  principalType: string;
  principalId: string;
  status: string;
  membershipRole: string | null;
  businessRole: string;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
};

// Ajouter dans l'objet accessApi :

listMembers: (companyId: string) =>
  api.get<EnrichedMember[]>(`/companies/${companyId}/members`),

updateMemberBusinessRole: (
  companyId: string,
  memberId: string,
  businessRole: string,
) =>
  api.patch<EnrichedMember>(
    `/companies/${companyId}/members/${memberId}/business-role`,
    { businessRole },
  ),

updateMemberStatus: (
  companyId: string,
  memberId: string,
  status: "active" | "suspended",
) =>
  api.patch<EnrichedMember>(
    `/companies/${companyId}/members/${memberId}/status`,
    { status },
  ),
```

---

### T4 : Ajouter les query keys -- `ui/src/lib/queryKeys.ts`

```typescript
// Dans l'objet access, ajouter :
access: {
  joinRequests: (companyId: string, status: string = "pending_approval") =>
    ["access", "join-requests", companyId, status] as const,
  invite: (token: string) => ["access", "invite", token] as const,
  members: (companyId: string) => ["access", "members", companyId] as const,  // NOUVEAU
},
```

---

### T5 : Ajouter la route dans App.tsx -- `ui/src/App.tsx`

Dans la fonction `boardRoutes()`, ajouter apres la route `company/settings` :

```typescript
<Route path="members" element={<Members />} />
```

**Import a ajouter** :

```typescript
import { Members } from "./pages/Members";
```

---

### T6 : Ajouter le lien sidebar -- `ui/src/components/Sidebar.tsx`

Ajouter un item `Members` dans la sidebar, apres `Agents` et avant `Settings`. Utiliser l'icone `Users` de lucide-react.

```tsx
<SidebarNavItem
  href="/members"
  icon={Users}
  label="Members"
/>
```

L'item doit etre visible pour les utilisateurs avec la permission `users:manage_permissions` (sera enforce par RBAC-S05 -- pour l'instant, visible pour tous).

---

### T7 : Creer la page Members -- `ui/src/pages/Members.tsx`

La page Members est le composant principal de cette story. Elle contient :

#### 7.1 Structure generale

```
+----------------------------------------------------------+
| [Users icon] Members                    [Invite Member]  |
+----------------------------------------------------------+
| Filters:  [Role: All v]  [Status: All v]  [Search...]   |
+----------------------------------------------------------+
| Members Table                                            |
| +------------------------------------------------------+ |
| | Name/Email | Role      | Status | Joined    | Actions| |
| +------------------------------------------------------+ |
| | Alice T.   | Admin  v  | Active | Mar 2026  |  ...   | |
| | alice@ex.. |           |        |           |        | |
| +------------------------------------------------------+ |
| | Bob K.     | Contrib v | Active | Mar 2026  |  ...   | |
| | bob@ex...  |           |        |           |        | |
| +------------------------------------------------------+ |
| Showing 2 of 2 members                                   |
+----------------------------------------------------------+
|                                                          |
| Pending Invitations (2)                                  |
| +------------------------------------------------------+ |
| | bob@new.co  | Pending | Sent Mar 12 | [Revoke]       | |
| | carol@x.co  | Expired | Sent Mar 10 |                | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

#### 7.2 Composant Members (page)

```tsx
export function Members() {
  // Hooks
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  // State
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Queries
  const { data: members, isLoading } = useQuery({
    queryKey: queryKeys.access.members(selectedCompanyId!),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Breadcrumbs
  useEffect(() => {
    setBreadcrumbs([{ label: "Members" }]);
  }, [setBreadcrumbs]);

  // Filter logic
  const filteredMembers = useMemo(() => { ... }, [members, roleFilter, statusFilter, searchQuery]);

  // Render
  return (
    <div data-testid="mu-s02-page">
      {/* Header */}
      {/* Filters */}
      {/* Table */}
      {/* Invite Dialog */}
    </div>
  );
}
```

#### 7.3 Composant Header

```tsx
<div data-testid="mu-s02-header" className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <Users className="h-5 w-5 text-muted-foreground" />
    <h1 className="text-lg font-semibold">Members</h1>
    <Badge variant="secondary" data-testid="mu-s02-member-count">
      {filteredMembers.length}
    </Badge>
  </div>
  <Button
    size="sm"
    onClick={() => setInviteDialogOpen(true)}
    data-testid="mu-s02-invite-button"
  >
    <UserPlus className="h-4 w-4 mr-1" />
    Invite member
  </Button>
</div>
```

#### 7.4 Composant Filters

```tsx
<div data-testid="mu-s02-filters" className="flex items-center gap-3 mb-4">
  {/* Role filter */}
  <Select value={roleFilter} onValueChange={setRoleFilter}>
    <SelectTrigger
      size="sm"
      className="w-[140px]"
      data-testid="mu-s02-filter-role"
    >
      <SelectValue placeholder="Role" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all" data-testid="mu-s02-filter-role-all">
        All roles
      </SelectItem>
      {BUSINESS_ROLES.map((role) => (
        <SelectItem
          key={role}
          value={role}
          data-testid={`mu-s02-filter-role-${role}`}
        >
          {BUSINESS_ROLE_LABELS[role]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Status filter */}
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger
      size="sm"
      className="w-[140px]"
      data-testid="mu-s02-filter-status"
    >
      <SelectValue placeholder="Status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all" data-testid="mu-s02-filter-status-all">
        All statuses
      </SelectItem>
      <SelectItem value="active" data-testid="mu-s02-filter-status-active">
        Active
      </SelectItem>
      <SelectItem value="pending" data-testid="mu-s02-filter-status-pending">
        Pending
      </SelectItem>
      <SelectItem value="suspended" data-testid="mu-s02-filter-status-suspended">
        Suspended
      </SelectItem>
    </SelectContent>
  </Select>

  {/* Search */}
  <div className="relative flex-1 max-w-xs">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    <Input
      placeholder="Search members..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-8 h-8 text-sm"
      data-testid="mu-s02-search"
    />
  </div>
</div>
```

#### 7.5 Composant Members Table

Le tableau est un `<table>` HTML classique style avec Tailwind (comme les autres listes du projet -- EntityRow pattern). Si TanStack Table n'est pas deja installe, utiliser un tableau HTML natif pour rester coherent avec les patterns existants.

**Colonnes :**

| Colonne | Contenu | data-testid |
|---------|---------|-------------|
| Name / Email | Nom (bold) + email (muted) sous le nom. Avatar si `userImage` disponible. Pour les agents : "Agent: {principalId}" | `mu-s02-member-name-{id}`, `mu-s02-member-email-{id}` |
| Role | Badge colore du businessRole + Select pour changer le role (si permission) | `mu-s02-member-role-{id}`, `mu-s02-role-select-{id}` |
| Status | Badge avec couleur (active=green, pending=yellow, suspended=red) | `mu-s02-member-status-{id}` |
| Joined | Date relative (ex: "Mar 12, 2026") | `mu-s02-member-joined-{id}` |
| Actions | DropdownMenu avec actions | `mu-s02-member-actions-{id}` |

```tsx
<div data-testid="mu-s02-members-table" className="rounded-md border border-border">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-border bg-muted/30">
        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Member
        </th>
        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Role
        </th>
        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Status
        </th>
        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Joined
        </th>
        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Actions
        </th>
      </tr>
    </thead>
    <tbody>
      {filteredMembers.map((member) => (
        <MemberRow key={member.id} member={member} />
      ))}
    </tbody>
  </table>
</div>
```

#### 7.6 Composant MemberRow (inline dans Members.tsx)

```tsx
function MemberRow({ member }: { member: EnrichedMember }) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const displayName = member.userName ?? member.principalId;
  const displayEmail = member.userEmail ?? (member.principalType === "agent" ? "Agent" : "");

  const roleMutation = useMutation({
    mutationFn: ({ businessRole }: { businessRole: string }) =>
      accessApi.updateMemberBusinessRole(selectedCompanyId!, member.id, businessRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.members(selectedCompanyId!) });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: "active" | "suspended" }) =>
      accessApi.updateMemberStatus(selectedCompanyId!, member.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.access.members(selectedCompanyId!) });
    },
  });

  return (
    <tr
      className="border-b border-border last:border-0 hover:bg-muted/20"
      data-testid={`mu-s02-member-row-${member.id}`}
    >
      {/* Name / Email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {member.userImage ? (
            <img
              src={member.userImage}
              className="h-8 w-8 rounded-full"
              alt={displayName}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div
              className="font-medium text-sm"
              data-testid={`mu-s02-member-name-${member.id}`}
            >
              {displayName}
            </div>
            <div
              className="text-xs text-muted-foreground"
              data-testid={`mu-s02-member-email-${member.id}`}
            >
              {displayEmail}
            </div>
          </div>
        </div>
      </td>

      {/* Role (editable) */}
      <td className="px-4 py-3">
        <Select
          value={member.businessRole}
          onValueChange={(value) => roleMutation.mutate({ businessRole: value })}
          data-testid={`mu-s02-role-select-${member.id}`}
        >
          <SelectTrigger
            size="sm"
            className="w-[130px]"
            data-testid={`mu-s02-member-role-${member.id}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_ROLES.map((role) => (
              <SelectItem
                key={role}
                value={role}
                data-testid={`mu-s02-role-option-${role}-${member.id}`}
              >
                {BUSINESS_ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge
          variant={
            member.status === "active"
              ? "secondary"
              : member.status === "suspended"
                ? "destructive"
                : "outline"
          }
          data-testid={`mu-s02-member-status-${member.id}`}
        >
          {member.status}
        </Badge>
      </td>

      {/* Joined date */}
      <td
        className="px-4 py-3 text-sm text-muted-foreground"
        data-testid={`mu-s02-member-joined-${member.id}`}
      >
        {new Date(member.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`mu-s02-member-actions-${member.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.status === "active" ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => statusMutation.mutate({ status: "suspended" })}
                data-testid={`mu-s02-action-suspend-${member.id}`}
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Suspend member
              </DropdownMenuItem>
            ) : member.status === "suspended" ? (
              <DropdownMenuItem
                onClick={() => statusMutation.mutate({ status: "active" })}
                data-testid={`mu-s02-action-reactivate-${member.id}`}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Reactivate member
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
```

#### 7.7 Composant Invite Member Dialog

Un dialog simple pour inviter un nouveau membre par email. Reutilise l'API `createCompanyInvite` deja existante, etendue avec le champ `email` par MU-S01.

```tsx
function InviteMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createCompanyInvite(selectedCompanyId!, {
        allowedJoinTypes: "human",
        email,
      }),
    onSuccess: () => {
      setEmail("");
      setError(null);
      onOpenChange(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.members(selectedCompanyId!),
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="mu-s02-invite-dialog">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send an invitation link via email. The recipient can join your company.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email address</label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="mu-s02-invite-email"
              className="mt-1"
            />
          </div>
          {error && (
            <p
              className="text-sm text-destructive"
              data-testid="mu-s02-invite-error"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="mu-s02-invite-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={!email.trim() || inviteMutation.isPending}
            data-testid="mu-s02-invite-submit"
          >
            {inviteMutation.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 7.8 Empty State

Quand la company n'a aucun membre (cas initial improbable mais possible apres filtres) :

```tsx
<EmptyState
  icon={Users}
  title="No members found"
  description={
    searchQuery || roleFilter !== "all" || statusFilter !== "all"
      ? "Try adjusting your filters."
      : "Invite your first team member to get started."
  }
  data-testid="mu-s02-empty-state"
/>
```

#### 7.9 Loading State

```tsx
if (isLoading) {
  return <PageSkeleton data-testid="mu-s02-loading" />;
}
```

#### 7.10 Footer / Count

```tsx
<div
  className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t border-border"
  data-testid="mu-s02-footer"
>
  <span>
    Showing {filteredMembers.length} of {members?.length ?? 0} members
  </span>
</div>
```

---

## data-test-id Attributes

### Page-level

| Element | data-testid | Usage |
|---------|-------------|-------|
| Page container | `data-testid="mu-s02-page"` | Page principale Members |
| Page header | `data-testid="mu-s02-header"` | Titre + bouton invite |
| Member count badge | `data-testid="mu-s02-member-count"` | Badge avec le nombre de membres |
| Loading skeleton | `data-testid="mu-s02-loading"` | Etat de chargement |
| Empty state | `data-testid="mu-s02-empty-state"` | Etat vide (aucun resultat) |
| Footer | `data-testid="mu-s02-footer"` | Compteur "Showing X of Y" |

### Filters

| Element | data-testid | Usage |
|---------|-------------|-------|
| Filters container | `data-testid="mu-s02-filters"` | Barre de filtres |
| Role filter trigger | `data-testid="mu-s02-filter-role"` | Select trigger pour role |
| Role filter option (all) | `data-testid="mu-s02-filter-role-all"` | Option "All roles" |
| Role filter option (admin) | `data-testid="mu-s02-filter-role-admin"` | Option "Admin" |
| Role filter option (manager) | `data-testid="mu-s02-filter-role-manager"` | Option "Manager" |
| Role filter option (contributor) | `data-testid="mu-s02-filter-role-contributor"` | Option "Contributor" |
| Role filter option (viewer) | `data-testid="mu-s02-filter-role-viewer"` | Option "Viewer" |
| Status filter trigger | `data-testid="mu-s02-filter-status"` | Select trigger pour status |
| Status filter option (all) | `data-testid="mu-s02-filter-status-all"` | Option "All statuses" |
| Status filter option (active) | `data-testid="mu-s02-filter-status-active"` | Option "Active" |
| Status filter option (pending) | `data-testid="mu-s02-filter-status-pending"` | Option "Pending" |
| Status filter option (suspended) | `data-testid="mu-s02-filter-status-suspended"` | Option "Suspended" |
| Search input | `data-testid="mu-s02-search"` | Champ de recherche par nom/email |

### Table

| Element | data-testid | Usage |
|---------|-------------|-------|
| Members table container | `data-testid="mu-s02-members-table"` | Conteneur du tableau |
| Member row | `data-testid="mu-s02-member-row-{id}"` | Ligne de membre (id = membership.id) |
| Member name | `data-testid="mu-s02-member-name-{id}"` | Texte du nom |
| Member email | `data-testid="mu-s02-member-email-{id}"` | Texte de l'email |
| Member role selector | `data-testid="mu-s02-member-role-{id}"` | Trigger du Select role |
| Role select | `data-testid="mu-s02-role-select-{id}"` | Select complet pour le role |
| Role option | `data-testid="mu-s02-role-option-{role}-{id}"` | Option dans le Select role |
| Member status badge | `data-testid="mu-s02-member-status-{id}"` | Badge du statut |
| Member joined date | `data-testid="mu-s02-member-joined-{id}"` | Date d'ajout |
| Member actions trigger | `data-testid="mu-s02-member-actions-{id}"` | Bouton ... (MoreHorizontal) |
| Suspend action | `data-testid="mu-s02-action-suspend-{id}"` | Action "Suspend member" |
| Reactivate action | `data-testid="mu-s02-action-reactivate-{id}"` | Action "Reactivate member" |

### Invite Dialog

| Element | data-testid | Usage |
|---------|-------------|-------|
| Invite button | `data-testid="mu-s02-invite-button"` | Bouton "Invite member" dans le header |
| Invite dialog | `data-testid="mu-s02-invite-dialog"` | Dialog modal d'invitation |
| Email input | `data-testid="mu-s02-invite-email"` | Champ email dans le dialog |
| Error message | `data-testid="mu-s02-invite-error"` | Message d'erreur dans le dialog |
| Cancel button | `data-testid="mu-s02-invite-cancel"` | Bouton "Cancel" |
| Submit button | `data-testid="mu-s02-invite-submit"` | Bouton "Send invitation" |

---

## Acceptance Criteria

### AC-01 : Page Members affiche le tableau des membres

```
Given un Admin sur la page Members
When la page charge
Then le tableau affiche les colonnes : Member (nom + email), Role, Status, Joined, Actions
And chaque membre de la company apparait dans une ligne du tableau
And les membres sont tries par date de creation (plus recent en premier)
```

### AC-02 : Donnees enrichies (nom, email) depuis la table user

```
Given un membre de type "user" dans company_memberships
When le GET /api/companies/:companyId/members est appele
Then la reponse inclut userName, userEmail, userImage depuis la table auth_users
And le tableau affiche le nom reel de l'utilisateur (pas le principalId)
```

### AC-03 : Filtre par role

```
Given le tableau affiche 5 membres (2 admin, 2 contributor, 1 viewer)
When l'Admin selectionne "Admin" dans le filtre Role
Then seuls les 2 membres avec businessRole "admin" s'affichent
And le compteur indique "Showing 2 of 5 members"
```

### AC-04 : Filtre par statut

```
Given le tableau affiche des membres actifs et suspendus
When l'Admin selectionne "Active" dans le filtre Status
Then seuls les membres avec status "active" s'affichent
And le compteur se met a jour
```

### AC-05 : Recherche par nom ou email

```
Given le tableau affiche tous les membres
When l'Admin saisit "alice" dans le champ de recherche
Then seuls les membres dont le nom ou l'email contient "alice" s'affichent
And la recherche est case-insensitive
```

### AC-06 : Changement de role inline

```
Given un Admin sur la page Members
When il clique sur le Select du role d'un membre et selectionne "Manager"
Then une requete PATCH /api/companies/:companyId/members/:memberId/business-role est envoyee
And le role du membre se met a jour dans le tableau sans reload
And une activite "member.business_role.updated" est loguee
```

### AC-07 : Suspension d'un membre

```
Given un Admin sur la page Members
When il ouvre le menu Actions d'un membre actif et clique "Suspend member"
Then une requete PATCH /api/companies/:companyId/members/:memberId/status avec { status: "suspended" } est envoyee
And le statut du membre passe a "suspended" dans le tableau
And le badge de statut devient rouge/destructive
```

### AC-08 : Reactivation d'un membre suspendu

```
Given un membre suspendu dans le tableau
When l'Admin ouvre le menu Actions et clique "Reactivate member"
Then le statut du membre repasse a "active"
And le badge redevient vert/secondary
```

### AC-09 : Dialog d'invitation par email

```
Given un Admin sur la page Members
When il clique le bouton "Invite member"
Then un dialog modal s'ouvre avec un champ email et un bouton "Send invitation"
When il saisit un email valide et clique "Send invitation"
Then une requete POST /api/companies/:companyId/invites est envoyee avec le champ email
And le dialog se ferme
And la liste des membres est rafraichie
```

### AC-10 : Validation email dans le dialog d'invitation

```
Given le dialog d'invitation ouvert
When le champ email est vide
Then le bouton "Send invitation" est desactive
When l'utilisateur saisit un email invalide et soumet
Then un message d'erreur s'affiche dans le dialog
```

### AC-11 : Permission required pour acceder a la page

```
Given un utilisateur connecte
When il navigue vers /members
Then la page Members s'affiche
And l'endpoint GET /api/companies/:companyId/members requiert la permission "users:manage_permissions"
And un utilisateur sans cette permission recoit une 403
```

### AC-12 : Loading state

```
Given un utilisateur sur la page Members
When les donnees sont en cours de chargement
Then un skeleton/loading state s'affiche
And une fois les donnees chargees, le tableau s'affiche
```

### AC-13 : Empty state apres filtrage

```
Given aucun membre ne correspond aux filtres actifs
When le tableau est vide
Then un empty state s'affiche avec le message "No members found" et "Try adjusting your filters."
```

### AC-14 : Agents affiches dans le tableau

```
Given un membre de type "agent" dans company_memberships
When le tableau s'affiche
Then le membre agent apparait avec principalId comme nom et "Agent" comme email
And son role peut etre modifie comme un membre humain
```

### AC-15 : Sidebar avec lien Members

```
Given un utilisateur connecte
When il regarde la sidebar de navigation
Then un item "Members" avec l'icone Users est visible
When il clique sur "Members"
Then il est redirige vers /members
```

---

## Plan de Tests E2E (Playwright)

### Fichier : `e2e/tests/MU-S02.spec.ts`

#### Tests navigation et page

| # | Test | Action | Expected |
|---|------|--------|----------|
| 1 | Page Members se charge | Navigate to /members | Page visible, `[data-testid="mu-s02-page"]` present |
| 2 | Sidebar contient le lien Members | Check sidebar | `Members` item visible |
| 3 | Header affiche le titre et le bouton invite | Check header | Titre "Members" + bouton "Invite member" visibles |
| 4 | Loading state s'affiche | Check initial load | `[data-testid="mu-s02-loading"]` visible avant le chargement |

#### Tests tableau

| # | Test | Action | Expected |
|---|------|--------|----------|
| 5 | Tableau affiche les colonnes | Check table headers | "Member", "Role", "Status", "Joined", "Actions" |
| 6 | Tableau affiche les membres | Check table rows | Au moins 1 row `[data-testid^="mu-s02-member-row-"]` |
| 7 | Nom et email affiches | Check member cell | `[data-testid^="mu-s02-member-name-"]` non vide |
| 8 | Role affiche | Check role cell | `[data-testid^="mu-s02-member-role-"]` visible |
| 9 | Statut affiche | Check status cell | Badge visible |
| 10 | Date d'ajout affichee | Check joined cell | Date formatee visible |

#### Tests filtres

| # | Test | Action | Expected |
|---|------|--------|----------|
| 11 | Filtre role "All" par defaut | Check role filter | Value = "all" |
| 12 | Filtre par role Admin | Select "Admin" | Seuls les admins affiches |
| 13 | Filtre par role Contributor | Select "Contributor" | Seuls les contributors affiches |
| 14 | Filtre par statut Active | Select "Active" | Seuls les actifs affiches |
| 15 | Recherche par nom | Type "alice" | Seul le membre Alice affiche |
| 16 | Recherche case-insensitive | Type "ALICE" | Seul le membre Alice affiche |
| 17 | Compteur se met a jour | Apply filter | "Showing X of Y members" correct |
| 18 | Empty state quand aucun resultat | Search "zzzznonexistent" | Empty state visible |

#### Tests actions

| # | Test | Action | Expected |
|---|------|--------|----------|
| 19 | Changement de role | Select new role in row | PATCH request envoyee, role mis a jour |
| 20 | Suspension d'un membre | Click Suspend in actions | PATCH status=suspended envoyee, badge change |
| 21 | Reactivation d'un membre | Click Reactivate in actions | PATCH status=active envoyee, badge change |
| 22 | Actions menu s'ouvre | Click "..." button | DropdownMenu visible |

#### Tests dialog invitation

| # | Test | Action | Expected |
|---|------|--------|----------|
| 23 | Dialog s'ouvre | Click "Invite member" | Dialog visible `[data-testid="mu-s02-invite-dialog"]` |
| 24 | Bouton submit desactive sans email | Check submit button | Button disabled |
| 25 | Saisie email valide | Type email | Button enabled |
| 26 | Envoi invitation | Click submit | POST request envoyee, dialog ferme |
| 27 | Erreur affichee si echec | Mock 400 response | `[data-testid="mu-s02-invite-error"]` visible |
| 28 | Cancel ferme le dialog | Click Cancel | Dialog ferme |

#### Tests backend

| # | Test | Action | Expected |
|---|------|--------|----------|
| 29 | GET members retourne donnees enrichies | API call | Response contient userName, userEmail |
| 30 | PATCH business-role fonctionne | API call | Member role updated |
| 31 | PATCH status fonctionne | API call | Member status updated |
| 32 | GET members protege par permission | API call sans permission | 403 Forbidden |

### Couverture cible

| Module | Couverture cible |
|--------|-----------------|
| Members page (composant) | >= 90% |
| listMembers enrichi (backend) | >= 95% |
| API client access (nouvelles fonctions) | >= 90% |
| Filtres (role, status, search) | >= 95% |
| Invite dialog | >= 85% |
| Actions (role change, suspend) | >= 90% |

---

## Schema de Donnees

### Response enrichie GET /api/companies/:companyId/members

```json
[
  {
    "id": "uuid-membership",
    "companyId": "uuid-company",
    "principalType": "user",
    "principalId": "user-id",
    "status": "active",
    "membershipRole": "owner",
    "businessRole": "admin",
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z",
    "userName": "Alice Thompson",
    "userEmail": "alice@example.com",
    "userImage": "https://..."
  },
  {
    "id": "uuid-membership-2",
    "companyId": "uuid-company",
    "principalType": "agent",
    "principalId": "agent-uuid",
    "status": "active",
    "membershipRole": "member",
    "businessRole": "contributor",
    "createdAt": "2026-03-10T14:30:00.000Z",
    "updatedAt": "2026-03-10T14:30:00.000Z",
    "userName": null,
    "userEmail": null,
    "userImage": null
  }
]
```

---

## Diagramme de Flux

### Page Load

```
User navigates to /members
    |
    v
Members component renders
    |
    v
useQuery → GET /api/companies/:companyId/members
    |     → assertCompanyPermission("users:manage_permissions")
    |     → JOIN company_memberships + authUsers
    |     → Return enriched members[]
    v
Render table with filteredMembers
    |
    v
User interacts (filter, search, change role, suspend, invite)
```

### Role Change Flow

```
User selects new role in Select
    |
    v
roleMutation.mutate({ businessRole: "manager" })
    |
    v
PATCH /api/companies/:companyId/members/:memberId/business-role
    |  → validate(updateMemberBusinessRoleSchema)
    |  → assertCompanyPermission("users:manage_permissions")
    |  → access.updateMemberBusinessRole()
    |  → logActivity("member.business_role.updated")
    v
onSuccess → invalidateQueries(members)
    |
    v
UI refreshes with updated role
```

### Invite Flow

```
User clicks "Invite member"
    |
    v
Dialog opens (email field)
    |
    v
User enters email + clicks "Send invitation"
    |
    v
POST /api/companies/:companyId/invites
    |  → { email: "...", allowedJoinTypes: "human" }
    |  → assertCompanyPermission("users:invite")
    |  → Create invite with TTL 7 days
    |  → Send email
    v
onSuccess → close dialog, invalidate queries
```

---

## Risques et Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Pas de protection "dernier admin" lors du changement de role | Moyen | Critique | Ajouter un check dans updateMemberBusinessRole : si le membre est le dernier admin, refuser le downgrade. Implementer dans cette story ou creer un ticket suivant |
| Email field dans createCompanyInvite pas encore supporte | Faible | Moyen | MU-S01 a etendu le schema. Verifier que le champ `email` est dans `createCompanyInviteSchema` |
| Performance avec beaucoup de membres | Faible | Faible | Le JOIN est simple et indexe. Pagination client-side suffisante pour < 200 membres. Pagination serveur a considerer pour >200 |
| Agents sans donnees user (nom/email null) | Certain | Faible | Fallback sur `principalId` pour le nom et "Agent" pour le type. Design clair dans le tableau |
| Permission `users:manage_permissions` trop restrictive | Moyen | Moyen | Pour la v1, seuls les admins/managers voient la page. Pourra etre descouple en `users:view` vs `users:manage` plus tard |

---

## Definition of Done

- [ ] `listMembers()` enrichi avec JOIN sur `authUsers` (nom, email, image)
- [ ] Endpoint PATCH `/api/companies/:companyId/members/:memberId/status` pour suspend/reactivate
- [ ] API client `accessApi.listMembers()`, `updateMemberBusinessRole()`, `updateMemberStatus()` ajoutees
- [ ] Query key `access.members` ajoutee dans `queryKeys.ts`
- [ ] Page `Members.tsx` creee avec tableau, filtres, actions
- [ ] Route `/members` ajoutee dans `App.tsx`
- [ ] Lien "Members" ajoute dans la Sidebar avec icone `Users`
- [ ] Filtre par role fonctionne (dropdown avec les 4 business roles)
- [ ] Filtre par statut fonctionne (active, pending, suspended)
- [ ] Recherche par nom/email fonctionne (case-insensitive)
- [ ] Changement de role inline via Select dans le tableau
- [ ] Suspension/reactivation via menu Actions
- [ ] Dialog d'invitation par email fonctionnel
- [ ] Compteur "Showing X of Y members" mis a jour apres filtrage
- [ ] Empty state quand aucun resultat
- [ ] Loading state pendant le chargement
- [ ] Tous les `data-testid` documentes sont presents dans le JSX
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm test` passe sans regression
- [ ] Tests E2E Playwright ecrits (fichier `e2e/tests/MU-S02.spec.ts`)
- [ ] Pas de secrets en dur, input sanitise
