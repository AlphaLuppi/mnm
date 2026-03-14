# SSO-S03 — UI Configuration SSO

> **Epic** : SSO — Enterprise Auth
> **Sprint** : Batch 13
> **Assignation** : Cofondateur (frontend)
> **Effort** : M (3 SP, 2-3j)
> **Bloque par** : SSO-S02 (Better Auth SAML/OIDC)
> **Debloque** : Rien (story terminale de l'epic SSO)
> **ADR** : ADR-002

---

## Contexte

SSO-S01 a cree le schema `sso_configurations` enrichi, le service CRUD et les routes API admin. SSO-S02 a ajoute les flux d'authentification SAML/OIDC (discover, initiation, callback, provisioning, session creation). SSO-S03 implemente la page frontend d'administration SSO pour permettre aux admins de :

1. **Lister les providers SSO** configures pour leur company
2. **Creer un nouveau provider** SAML ou OIDC avec formulaire dedie
3. **Modifier un provider** existant (display name, config, certificate, etc.)
4. **Tester la connexion** (verify) d'un provider configure
5. **Synchroniser les metadonnees** d'un IdP (metadata URL fetch)
6. **Activer/desactiver** un provider SSO (toggle)
7. **Supprimer** un provider SSO (avec confirmation)

Ce story est frontend-only et s'appuie sur les routes API existantes :
- `GET /api/companies/:companyId/sso` — liste des configurations
- `GET /api/companies/:companyId/sso/:configId` — detail
- `POST /api/companies/:companyId/sso` — creation
- `PUT /api/companies/:companyId/sso/:configId` — mise a jour
- `DELETE /api/companies/:companyId/sso/:configId` — suppression
- `POST /api/companies/:companyId/sso/:configId/toggle` — toggle enabled
- `POST /api/companies/:companyId/sso/:configId/verify` — verification
- `POST /api/companies/:companyId/sso/:configId/sync` — sync metadata

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| SSO-S01 | DONE | Schema, service CRUD, 7 routes API, types shared |
| SSO-S02 | DONE | Auth service SAML/OIDC, public routes, discover, sync |
| RBAC-S05 | DONE | Navigation masquee, RequirePermission component |
| RBAC-S04 | DONE | requirePermission middleware sur les routes SSO |
| OBS-S04 | DONE | AuditLog UI (pattern de reference pour pages admin) |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Page SSO accessible aux admins
**Given** un utilisateur avec permission `company:manage_sso`
**When** il navigue vers `/admin/sso`
**Then** la page "SSO Configuration" s'affiche avec la liste des providers configures

### AC2 — Navigation sidebar
**Given** un utilisateur avec permission `company:manage_sso`
**When** la sidebar charge
**Then** un lien "SSO" est visible dans la section Company, apres "Settings"

### AC3 — Liste vide
**Given** aucune configuration SSO pour la company
**When** la page charge
**Then** un empty state s'affiche avec message explicatif et bouton "Add SSO Provider"

### AC4 — Creation provider SAML
**Given** un admin sur la page SSO
**When** il clique "Add SSO Provider" et selectionne "SAML"
**Then** un dialog s'ouvre avec les champs : Display Name, Email Domain, Metadata URL, Entity ID, Certificate (textarea)
**And** apres soumission, le provider apparait dans la liste avec status "draft"

### AC5 — Creation provider OIDC
**Given** un admin sur la page SSO
**When** il clique "Add SSO Provider" et selectionne "OIDC"
**Then** un dialog s'ouvre avec les champs : Display Name, Email Domain, Client ID, Client Secret, Discovery URL
**And** apres soumission, le provider apparait dans la liste avec status "draft"

### AC6 — Edition provider
**Given** un provider SSO existant dans la liste
**When** l'admin clique le bouton "Edit"
**Then** un dialog s'ouvre pre-rempli avec les donnees actuelles du provider
**And** apres modification et soumission, les changements sont refletes dans la liste

### AC7 — Toggle enable/disable
**Given** un provider SSO existant
**When** l'admin clique le toggle switch
**Then** le provider passe de enabled a disabled (ou inversement) via POST toggle
**And** le badge de statut se met a jour

### AC8 — Verify (test connexion)
**Given** un provider SSO configure
**When** l'admin clique "Verify"
**Then** une requete POST verify est envoyee
**And** le statut passe a "verified" avec un badge vert et la date de verification

### AC9 — Sync metadata
**Given** un provider SSO avec metadataUrl configuree
**When** l'admin clique "Sync Metadata"
**Then** une requete POST sync est envoyee
**And** les champs entityId, certificate, config sont mis a jour
**And** la derniere date de sync s'affiche

### AC10 — Suppression provider
**Given** un provider SSO desactive (enabled=false)
**When** l'admin clique "Delete" et confirme dans le dialog de confirmation
**Then** le provider est supprime de la liste

### AC11 — Suppression bloquee si active
**Given** un provider SSO active (enabled=true)
**When** l'admin tente de le supprimer
**Then** un message d'erreur indique qu'il faut d'abord desactiver le provider

### AC12 — Permission guard
**Given** un utilisateur SANS permission `company:manage_sso`
**When** il tente d'acceder a `/admin/sso`
**Then** la page 403 Forbidden s'affiche

### AC13 — Badges de statut
**Given** un provider SSO dans la liste
**When** la page charge
**Then** le badge de statut affiche : "Draft" (gris), "Verified" (vert), ou "Error" (rouge)
**And** le badge enabled/disabled est aussi visible

### AC14 — Erreur de sync affichee
**Given** un provider dont le dernier sync a echoue (lastSyncError non null)
**When** la page charge
**Then** l'erreur de sync est visible en texte rouge sous le provider

### AC15 — Route protection
**Given** la route `/admin/sso`
**When** un utilisateur non-authentifie tente d'y acceder
**Then** il est redirige vers la page de login

---

## Deliverables

### D1 — API Client SSO
**Fichier** : `ui/src/api/sso.ts`

```typescript
export const ssoApi = {
  list(companyId) → GET /companies/:companyId/sso
  getById(companyId, configId) → GET /companies/:companyId/sso/:configId
  create(companyId, body) → POST /companies/:companyId/sso
  update(companyId, configId, body) → PUT /companies/:companyId/sso/:configId
  delete(companyId, configId) → DELETE /companies/:companyId/sso/:configId
  toggle(companyId, configId) → POST /companies/:companyId/sso/:configId/toggle
  verify(companyId, configId) → POST /companies/:companyId/sso/:configId/verify
  sync(companyId, configId) → POST /companies/:companyId/sso/:configId/sync
}
```

### D2 — Query Keys SSO
**Fichier** : `ui/src/lib/queryKeys.ts`

```typescript
sso: {
  list: (companyId) => ["sso", companyId, "list"],
  detail: (companyId, configId) => ["sso", companyId, "detail", configId],
}
```

### D3 — Page SsoConfig
**Fichier** : `ui/src/pages/SsoConfig.tsx`

Page admin avec :
- Header avec titre "SSO Configuration" et bouton "Add SSO Provider"
- Liste des providers dans des cards
- Chaque card affiche : displayName, provider badge (SAML/OIDC), status badge, enabled toggle, email domain, actions (Edit, Verify, Sync, Delete)
- Empty state quand aucun provider

### D4 — Components
**Fichiers** :
- `ui/src/components/SsoProviderCard.tsx` — card pour chaque provider
- `ui/src/components/CreateSsoDialog.tsx` — dialog de creation (SAML/OIDC)
- `ui/src/components/EditSsoDialog.tsx` — dialog d'edition
- `ui/src/components/DeleteSsoDialog.tsx` — dialog de confirmation de suppression

### D5 — Route + Sidebar Integration
**Fichiers modifies** :
- `ui/src/App.tsx` — ajout route `admin/sso`
- `ui/src/components/Sidebar.tsx` — ajout lien SSO
- `ui/src/api/index.ts` — export ssoApi

---

## Mapping data-testid

| data-testid | Element | Type |
|-------------|---------|------|
| `sso-s03-page` | Page container | div |
| `sso-s03-title` | Page title | h1 |
| `sso-s03-btn-add` | "Add SSO Provider" button | button |
| `sso-s03-loading` | Loading skeleton | div |
| `sso-s03-error` | Error state | div |
| `sso-s03-empty-state` | Empty state container | div |
| `sso-s03-empty-title` | Empty state title | h3 |
| `sso-s03-empty-description` | Empty state description | p |
| `sso-s03-provider-list` | Provider list container | div |
| `sso-s03-provider-card` | Provider card (repeated) | div |
| `sso-s03-provider-name` | Provider display name | span |
| `sso-s03-provider-type` | Provider type badge (SAML/OIDC) | Badge |
| `sso-s03-provider-status` | Provider status badge (draft/verified/error) | Badge |
| `sso-s03-provider-enabled` | Enabled/disabled toggle switch | Switch |
| `sso-s03-provider-domain` | Email domain | span |
| `sso-s03-provider-verified-at` | Verified at timestamp | span |
| `sso-s03-provider-last-sync` | Last sync timestamp | span |
| `sso-s03-provider-sync-error` | Last sync error text | span |
| `sso-s03-btn-edit` | Edit button | button |
| `sso-s03-btn-verify` | Verify button | button |
| `sso-s03-btn-sync` | Sync Metadata button | button |
| `sso-s03-btn-delete` | Delete button | button |
| `sso-s03-create-dialog` | Create SSO dialog container | Dialog |
| `sso-s03-create-title` | Create dialog title | h2 |
| `sso-s03-create-provider-select` | Provider type select (SAML/OIDC) | Select |
| `sso-s03-create-display-name` | Display name input | input |
| `sso-s03-create-email-domain` | Email domain input | input |
| `sso-s03-create-metadata-url` | Metadata URL input (SAML) | input |
| `sso-s03-create-entity-id` | Entity ID input (SAML/OIDC) | input |
| `sso-s03-create-certificate` | Certificate textarea (SAML) | textarea |
| `sso-s03-create-client-id` | Client ID input (OIDC) | input |
| `sso-s03-create-client-secret` | Client Secret input (OIDC) | input |
| `sso-s03-create-discovery-url` | Discovery URL input (OIDC) | input |
| `sso-s03-create-btn-submit` | Create dialog submit button | button |
| `sso-s03-create-btn-cancel` | Create dialog cancel button | button |
| `sso-s03-edit-dialog` | Edit SSO dialog container | Dialog |
| `sso-s03-edit-title` | Edit dialog title | h2 |
| `sso-s03-edit-display-name` | Edit display name input | input |
| `sso-s03-edit-email-domain` | Edit email domain input | input |
| `sso-s03-edit-metadata-url` | Edit metadata URL input | input |
| `sso-s03-edit-entity-id` | Edit entity ID input | input |
| `sso-s03-edit-certificate` | Edit certificate textarea | textarea |
| `sso-s03-edit-btn-submit` | Edit dialog submit button | button |
| `sso-s03-edit-btn-cancel` | Edit dialog cancel button | button |
| `sso-s03-delete-dialog` | Delete confirmation dialog | Dialog |
| `sso-s03-delete-title` | Delete dialog title | h2 |
| `sso-s03-delete-message` | Delete dialog warning message | p |
| `sso-s03-delete-btn-confirm` | Delete confirm button | button |
| `sso-s03-delete-btn-cancel` | Delete cancel button | button |
| `sso-s03-nav-sso` | Sidebar nav link to SSO | NavItem |
| `sso-s03-provider-count` | Provider count badge (header) | Badge |

---

## Test Cases (51 tests)

### Group 1 — API Client (T01–T08)
- T01: ssoApi.list calls GET /companies/:companyId/sso
- T02: ssoApi.getById calls GET /companies/:companyId/sso/:configId
- T03: ssoApi.create calls POST /companies/:companyId/sso
- T04: ssoApi.update calls PUT /companies/:companyId/sso/:configId
- T05: ssoApi.delete calls DELETE /companies/:companyId/sso/:configId
- T06: ssoApi.toggle calls POST /companies/:companyId/sso/:configId/toggle
- T07: ssoApi.verify calls POST /companies/:companyId/sso/:configId/verify
- T08: ssoApi.sync calls POST /companies/:companyId/sso/:configId/sync

### Group 2 — Query Keys (T09–T10)
- T09: queryKeys.sso.list returns correct key array
- T10: queryKeys.sso.detail returns correct key array with configId

### Group 3 — Page SsoConfig Structure (T11–T19)
- T11: page container has data-testid="sso-s03-page"
- T12: page title "SSO Configuration" has data-testid="sso-s03-title"
- T13: "Add SSO Provider" button has data-testid="sso-s03-btn-add"
- T14: loading state has data-testid="sso-s03-loading"
- T15: error state has data-testid="sso-s03-error"
- T16: empty state has data-testid="sso-s03-empty-state" with title and description
- T17: empty state title has data-testid="sso-s03-empty-title"
- T18: empty state description has data-testid="sso-s03-empty-description"
- T19: provider count badge has data-testid="sso-s03-provider-count"

### Group 4 — Provider Card (T20–T30)
- T20: provider card has data-testid="sso-s03-provider-card"
- T21: provider name has data-testid="sso-s03-provider-name"
- T22: provider type badge has data-testid="sso-s03-provider-type"
- T23: provider status badge has data-testid="sso-s03-provider-status"
- T24: provider enabled switch has data-testid="sso-s03-provider-enabled"
- T25: provider domain has data-testid="sso-s03-provider-domain"
- T26: provider verified-at has data-testid="sso-s03-provider-verified-at"
- T27: provider last-sync has data-testid="sso-s03-provider-last-sync"
- T28: provider sync error has data-testid="sso-s03-provider-sync-error"
- T29: edit button has data-testid="sso-s03-btn-edit"
- T30: verify, sync, delete buttons have correct data-testid

### Group 5 — Create Dialog (T31–T38)
- T31: create dialog has data-testid="sso-s03-create-dialog"
- T32: create dialog title has data-testid="sso-s03-create-title"
- T33: provider type select has data-testid="sso-s03-create-provider-select"
- T34: display name input has data-testid="sso-s03-create-display-name"
- T35: email domain input has data-testid="sso-s03-create-email-domain"
- T36: SAML-specific fields (metadata-url, entity-id, certificate) have correct data-testid
- T37: OIDC-specific fields (client-id, client-secret, discovery-url) have correct data-testid
- T38: submit and cancel buttons have correct data-testid

### Group 6 — Edit Dialog (T39–T43)
- T39: edit dialog has data-testid="sso-s03-edit-dialog"
- T40: edit dialog title has data-testid="sso-s03-edit-title"
- T41: edit fields (display-name, email-domain, metadata-url, entity-id, certificate) present
- T42: edit submit and cancel buttons have correct data-testid
- T43: edit dialog pre-populates with existing config values

### Group 7 — Delete Dialog (T44–T47)
- T44: delete dialog has data-testid="sso-s03-delete-dialog"
- T45: delete title has data-testid="sso-s03-delete-title"
- T46: delete message has data-testid="sso-s03-delete-message"
- T47: delete confirm and cancel buttons have correct data-testid

### Group 8 — Route + Sidebar Integration (T48–T51)
- T48: route admin/sso registered in App.tsx with RequirePermission "company:manage_sso"
- T49: sidebar SSO nav item has data-testid="sso-s03-nav-sso" with KeyRound icon
- T50: sidebar SSO nav item permission-gated by company:manage_sso
- T51: ssoApi exported from api/index.ts barrel

---

## Notes techniques

- La page suit le meme pattern que `Containers.tsx`, `AuditLog.tsx`, `AdminRoles.tsx`
- Les mutations utilisent `useMutation` de React Query avec invalidation de `queryKeys.sso.list`
- Le formulaire de creation change dynamiquement selon le type de provider (SAML vs OIDC)
- Le toggle enabled utilise le composant `Switch` de shadcn/ui
- Les badges de statut utilisent les variantes existantes du composant `Badge`
- La permission requise est `company:manage_sso` (cle existante dans RBAC-S02)
- L'icone sidebar est `KeyRound` de lucide-react
