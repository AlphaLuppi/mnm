# MU-S05 : Desactivation Signup Libre -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | MU-S05 |
| **Titre** | Desactivation Signup Libre |
| **Epic** | Epic 3 -- Multi-User & Auth |
| **Sprint** | Batch 3 -- RLS + Auth |
| **Effort** | S (1 SP, 0.5j) |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-07 (Modifications 5 tables existantes) |
| **Debloque** | Aucun (fin de Batch 3) |
| **Type** | Backend + minimal frontend (API + auth hook + admin toggle UI) |

---

## Description

MnM utilise Better Auth pour l'authentification avec un flag global `disableSignUp` configurable via `MNM_AUTH_DISABLE_SIGN_UP` (env var) ou `auth.disableSignUp` (fichier config). Ce flag est **statique au boot du serveur** et affecte toute l'instance.

Cette story ajoute un flag **dynamique par company** : `invitationOnly` sur la table `companies`. Quand il est active, **seuls les utilisateurs invites** (via le systeme d'invitation MU-S01) peuvent rejoindre cette company. Le signup Better Auth reste ouvert (l'utilisateur peut creer un compte), mais l'auto-join a une company marquee `invitationOnly` est bloque.

### Architecture actuelle du signup

1. **Better Auth** gere `/api/auth/sign-up/email` -- cree un enregistrement dans `auth_users`
2. **Pas de lien automatique** entre signup et company -- l'utilisateur cree un compte, puis :
   - Rejoint via un lien d'invitation (`POST /api/invites/:token/accept`)
   - Ou via un join request (`POST /api/companies/:companyId/join-requests`)
3. **Le flag `disableSignUp`** dans Better Auth bloque la creation de compte au niveau instance (toutes les companies)
4. **Aucun mecanisme per-company** n'existe pour bloquer l'auto-inscription

### Ce que cette story ajoute

1. **Colonne `invitationOnly`** sur la table `companies` (boolean, default `false`)
2. **Guard dans le flow join-request** : quand `invitationOnly = true`, rejeter les join requests spontanes (403)
3. **Le flow invitation reste ouvert** : les invitations par email (MU-S01) et par lien continuent de fonctionner meme quand `invitationOnly = true`
4. **API toggle** : `PATCH /api/companies/:companyId` avec `{ invitationOnly: true/false }`
5. **Audit trail** : action `"company.config_change"` quand le flag change

### Ce qui existe deja

1. **Table `companies`** (`packages/db/src/schema/companies.ts`) :
   - 16 colonnes dont `tier`, `ssoEnabled`, `maxUsers`, `parentCompanyId` (ajoutes par TECH-07)
   - **Manque** : colonne `invitationOnly`

2. **Validator `updateCompanySchema`** (`packages/shared/src/validators/company.ts`) :
   - Accepte : `name`, `description`, `budgetMonthlyCents`, `status`, `spentMonthlyCents`, `requireBoardApprovalForNewAgents`, `brandColor`
   - **Manque** : champ `invitationOnly`

3. **Route PATCH `/api/companies/:companyId`** (`server/src/routes/companies.ts` L128-147) :
   - Utilise `updateCompanySchema`, appelle `svc.update()`, logue `"company.updated"`
   - **Fonctionne deja** -- il suffit d'ajouter `invitationOnly` au validator

4. **Join requests** (`server/src/routes/access.ts`) :
   - Route `POST /api/companies/:companyId/join-requests` -- gere les demandes spontanees
   - **Manque** : verification du flag `invitationOnly` avant de creer un join request

5. **Better Auth signup** (`server/src/auth/better-auth.ts`) :
   - Config `disableSignUp: config.authDisableSignUp` -- flag instance-wide
   - **Pas de modification necessaire** -- le signup cree un compte auth, pas un lien company

6. **Permission `company:manage_settings`** (`packages/shared/src/constants.ts` L268) :
   - Deja dans les 15 permission keys
   - **Sera utilisee** pour proteger le toggle `invitationOnly`

7. **Activity log** (`server/src/services/activity-log.ts`) :
   - Interface `LogActivityInput` avec `action: string` -- pas de contrainte sur le format
   - Action `"company.updated"` deja utilisee -- on ajoute `"company.config_change"` pour le toggle

---

## Etat Actuel du Code (Analyse)

### Fichiers cles

| Fichier | Role | Lignes pertinentes |
|---------|------|-------------------|
| `packages/db/src/schema/companies.ts` | Schema table companies | Tout (29 lignes) |
| `packages/shared/src/validators/company.ts` | Validators Zod company | L12-19 (updateCompanySchema) |
| `server/src/routes/companies.ts` | Routes CRUD companies | L128-147 (PATCH) |
| `server/src/routes/access.ts` | Routes join-requests | Rechercher `join-requests` |
| `server/src/auth/better-auth.ts` | Config Better Auth | L89-93 (disableSignUp) |
| `server/src/services/activity-log.ts` | Service logActivity | Tout (46 lignes) |
| `packages/shared/src/constants.ts` | PERMISSION_KEYS | L256-273 |
| `server/src/middleware/require-permission.ts` | Middleware permissions | Tout (87 lignes) |

### Constats

1. Le flag `disableSignUp` dans Better Auth est **instance-wide** et **statique** (valeur au boot). Il n'y a pas de hook Better Auth pour verifier dynamiquement un flag per-company au moment du signup. La bonne approche est de **ne pas toucher au signup** mais de bloquer le **join-request** (le moment ou l'utilisateur tente de rejoindre une company).

2. La table `companies` a deja des colonnes de configuration enterprise (`tier`, `ssoEnabled`, `maxUsers`). Ajouter `invitationOnly` est coherent avec ce pattern.

3. Le validator `updateCompanySchema` utilise `createCompanySchema.partial().extend(...)`. On doit ajouter `invitationOnly` dans le `.extend()` car c'est un champ de configuration, pas un champ de creation.

4. La route join-request doit verifier le flag `invitationOnly` de la company cible. Cette route est dans `server/src/routes/access.ts` et accede deja au `db` pour les lookups company.

---

## Acceptance Criteria

### AC-1 : Schema -- Colonne `invitationOnly` sur companies
**Given** la table `companies` en base PostgreSQL
**When** la migration MU-S05 est executee
**Then** une colonne `invitation_only` de type `BOOLEAN NOT NULL DEFAULT false` existe
**And** toutes les companies existantes ont `invitation_only = false` (backward compatible)

### AC-2 : Toggle via PATCH company
**Given** un utilisateur avec la permission `company:manage_settings` (admin de la company)
**When** il envoie `PATCH /api/companies/:companyId` avec `{ invitationOnly: true }`
**Then** la company est mise a jour avec `invitationOnly: true`
**And** la reponse contient le champ `invitationOnly: true`
**And** un `activity_log` est cree avec :
  - `action`: `"company.config_change"`
  - `entityType`: `"company"`
  - `details`: `{ field: "invitationOnly", oldValue: false, newValue: true }`

### AC-3 : Blocage join-request quand invitationOnly
**Given** une company avec `invitationOnly: true`
**When** un utilisateur authentifie envoie `POST /api/companies/:companyId/join-requests` avec `{ requestType: "human" }`
**Then** il recoit `403 Forbidden` avec le message `"This company accepts members by invitation only"`
**And** aucun join request n'est cree en base

### AC-4 : Invitation reste ouverte quand invitationOnly
**Given** une company avec `invitationOnly: true`
**When** un Admin envoie `POST /api/companies/:companyId/invites` avec un email
**Then** l'invitation est creee normalement (201)
**And** quand le destinataire accepte via `POST /api/invites/:token/accept`
**Then** le join request est cree normalement (le flow invite bypass le guard `invitationOnly`)

### AC-5 : Desactivation du flag
**Given** une company avec `invitationOnly: true`
**When** un Admin envoie `PATCH /api/companies/:companyId` avec `{ invitationOnly: false }`
**Then** la company est mise a jour avec `invitationOnly: false`
**And** un `activity_log` est cree avec :
  - `action`: `"company.config_change"`
  - `details`: `{ field: "invitationOnly", oldValue: true, newValue: false }`
**And** les join requests spontanes sont a nouveau acceptes

### AC-6 : Agent join-request bloque aussi
**Given** une company avec `invitationOnly: true`
**When** un agent tente `POST /api/companies/:companyId/join-requests` avec `{ requestType: "agent" }`
**Then** il recoit `403 Forbidden` avec le meme message
**And** les agents doivent aussi etre invites pour rejoindre

### AC-7 : Validation -- champ boolean strict
**Given** un Admin qui envoie `PATCH /api/companies/:companyId` avec `{ invitationOnly: "yes" }`
**When** la validation Zod est appliquee
**Then** il recoit `400 Bad Request` avec une erreur de validation (attendu: boolean)

### AC-8 : Permission guard sur le toggle
**Given** un utilisateur `contributor` ou `viewer` (sans permission `company:manage_settings`)
**When** il tente `PATCH /api/companies/:companyId` avec `{ invitationOnly: true }`
**Then** il recoit `403 Forbidden`
**And** le flag n'est pas modifie

---

## data-test-id

| Element | data-testid | Description |
|---------|------------|-------------|
| Toggle "Invitation uniquement" | `mu-s05-invitation-only-toggle` | Switch/checkbox dans les settings company |
| Label du toggle | `mu-s05-invitation-only-label` | Texte "Invitation Only" a cote du toggle |
| Description du toggle | `mu-s05-invitation-only-description` | Texte explicatif sous le toggle |
| Badge "Invitation Only" sur company card | `mu-s05-invitation-only-badge` | Badge affiche quand le flag est actif |
| Message d'erreur join-request bloque | `mu-s05-join-blocked-message` | Message affiche a l'utilisateur quand join est refuse |
| Toast confirmation toggle change | `mu-s05-config-change-toast` | Toast de confirmation apres changement du flag |
| Section Settings dans company page | `mu-s05-company-settings-section` | Section contenant les toggles de configuration |

> **Note** : La plupart de ces `data-testid` UI seront implementes dans des stories futures (page settings company). Cette story est principalement backend. Le Dev agent peut ajouter les `data-testid` sur les composants existants s'il y a une page de settings.

---

## Implementation Technique

### T1 : Migration -- Ajouter `invitationOnly` a la table `companies`

**Fichier schema** : `packages/db/src/schema/companies.ts`

Ajouter la colonne `invitationOnly` apres `maxUsers` :

```typescript
invitationOnly: boolean("invitation_only").notNull().default(false),
```

**Fichier migration** : `packages/db/src/migrations/XXXX_add_company_invitation_only.sql`

```sql
ALTER TABLE companies ADD COLUMN invitation_only BOOLEAN NOT NULL DEFAULT false;
```

> **Note** : Determiner le numero de migration en sequence apres la derniere migration existante. Verifier avec `ls packages/db/src/migrations/`.

### T2 : Modifier le validator `updateCompanySchema`

**Fichier** : `packages/shared/src/validators/company.ts`

Ajouter `invitationOnly` au schema de mise a jour :

```typescript
export const updateCompanySchema = createCompanySchema
  .partial()
  .extend({
    status: z.enum(COMPANY_STATUSES).optional(),
    spentMonthlyCents: z.number().int().nonnegative().optional(),
    requireBoardApprovalForNewAgents: z.boolean().optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    invitationOnly: z.boolean().optional(),  // NEW
  });
```

### T3 : Guard join-request -- verifier `invitationOnly`

**Fichier** : `server/src/routes/access.ts`

Dans le handler de `POST /api/companies/:companyId/join-requests`, ajouter une verification **avant** la creation du join request :

```typescript
// Check invitationOnly flag on the target company
const company = await db
  .select({ invitationOnly: companies.invitationOnly })
  .from(companies)
  .where(eq(companies.id, companyId))
  .then((rows) => rows[0] ?? null);

if (company?.invitationOnly) {
  throw forbidden("This company accepts members by invitation only");
}
```

**Important** : Ce guard s'applique UNIQUEMENT aux join requests spontanes. Les join requests crees via l'accept d'une invitation (`POST /api/invites/:token/accept`) doivent **bypasser** ce guard. Pour cela, deux approches :

- **Approche A** (recommandee) : Le flow d'accept d'invitation utilise une codepath separee qui ne passe pas par le meme handler. Verifier que le accept invite dans `access.ts` ne reutilise pas le meme middleware.

- **Approche B** : Ajouter un flag interne (ex: `req._isInviteAccept = true`) pour distinguer les deux flows. Moins propre mais fonctionnel.

Apres analyse du code, le flow `POST /api/invites/:token/accept` cree directement le join request via une insertion DB, sans passer par le handler `POST /api/companies/:companyId/join-requests`. Donc **l'approche A fonctionne naturellement** -- le guard n'est ajoute que dans le handler des join requests spontanes.

### T4 : Audit trail -- `"company.config_change"`

**Fichier** : `server/src/routes/companies.ts`

Modifier le handler `PATCH /:companyId` pour emettre un audit specifique quand `invitationOnly` change :

```typescript
router.patch("/:companyId", validate(updateCompanySchema), async (req, res) => {
  assertBoard(req);
  const companyId = req.params.companyId as string;
  assertCompanyAccess(req, companyId);

  // If invitationOnly is being changed, fetch current value for audit
  let oldInvitationOnly: boolean | undefined;
  if (req.body.invitationOnly !== undefined) {
    const current = await svc.getById(companyId);
    if (!current) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    oldInvitationOnly = current.invitationOnly;
  }

  const company = await svc.update(companyId, req.body);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  // Standard update log
  await logActivity(db, {
    companyId,
    actorType: "user",
    actorId: req.actor.userId ?? "board",
    action: "company.updated",
    entityType: "company",
    entityId: companyId,
    details: req.body,
  });

  // Specific config_change audit when invitationOnly changes
  if (
    req.body.invitationOnly !== undefined &&
    oldInvitationOnly !== undefined &&
    req.body.invitationOnly !== oldInvitationOnly
  ) {
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "company.config_change",
      entityType: "company",
      entityId: companyId,
      details: {
        field: "invitationOnly",
        oldValue: oldInvitationOnly,
        newValue: req.body.invitationOnly,
      },
    });
  }

  res.json(company);
});
```

### T5 : Permission guard (optionnel si requirePermission middleware pas encore en place)

La route `PATCH /api/companies/:companyId` utilise actuellement `assertBoard(req)` + `assertCompanyAccess(req, companyId)`. Pour la V1, c'est suffisant -- tout board member avec access a la company peut modifier ses settings. Le permission guard `company:manage_settings` sera enforce dans la story RBAC-S04 (Enforcement 22 routes, Batch 5).

Pour le moment, l'acces est controle par :
- `assertBoard(req)` -- seuls les board members (humains, pas les agents)
- `assertCompanyAccess(req, companyId)` -- seuls les membres de la company (ou instance admin)

**Pas de modification de permission necessaire dans cette story.**

---

## Fichiers Modifies (Resume)

| Fichier | Action | Effort |
|---------|--------|--------|
| `packages/db/src/schema/companies.ts` | Ajouter colonne `invitationOnly` | Petit |
| `packages/db/src/migrations/XXXX_add_company_invitation_only.sql` | Migration SQL | Petit |
| `packages/shared/src/validators/company.ts` | Ajouter `invitationOnly` au `updateCompanySchema` | Petit |
| `server/src/routes/access.ts` | Guard `invitationOnly` dans join-requests | Petit |
| `server/src/routes/companies.ts` | Audit `"company.config_change"` dans PATCH | Moyen |

---

## Diagramme de Sequence

```
Admin                     API                          DB
  |                        |                           |
  |--PATCH /companies/:id---->|                        |
  |  { invitationOnly: true } |                        |
  |                        |--SELECT current company----->|
  |                        |<--{ invitationOnly: false }--|
  |                        |--UPDATE companies SET---------->|
  |                        |   invitation_only = true       |
  |                        |<--updated company--------------|
  |                        |--INSERT activity_log----------->|
  |                        |   action: "company.updated"    |
  |                        |--INSERT activity_log----------->|
  |                        |   action: "company.config_change"
  |                        |   { field, oldValue, newValue }|
  |<--200 { company }-----|                           |


User (non-invite)          API                          DB
  |                        |                           |
  |--POST /companies/:id/join-requests-->|             |
  |  { requestType: "human" }           |              |
  |                        |--SELECT company.invitation_only->|
  |                        |<--{ invitationOnly: true }-------|
  |<--403 "invitation only"|                           |


Invite Recipient           API                          DB
  |                        |                           |
  |--POST /invites/:token/accept-------->|             |
  |  { requestType: "human" }           |              |
  |                        |--validate token------------->|
  |                        |   (no invitationOnly check)  |
  |                        |--INSERT join_requests-------->|
  |                        |<--created--------------------|
  |<--200 { joinRequest }--|                           |
```

---

## Edge Cases

1. **Company n'existe pas** : Le `PATCH /api/companies/:companyId` avec un ID inexistant retourne deja 404. Le guard `invitationOnly` dans join-requests doit aussi gerer le cas ou la company n'existe pas (404 avant de verifier le flag).

2. **Toggle sans changement effectif** : Si l'admin envoie `{ invitationOnly: true }` alors que le flag est deja `true`, le `company.updated` est logue mais PAS le `company.config_change` (car `oldValue === newValue`). Pas d'audit inutile.

3. **Join request d'un agent via API key** : Le guard `invitationOnly` s'applique aussi aux agents. Un agent qui tente de rejoindre spontanement une company `invitationOnly` recoit 403. Coherent avec le flow humain.

4. **Mode `local_trusted`** : En mode local, il n'y a pas de signup (pas de Better Auth). Le flag `invitationOnly` n'a pas d'effet car il n'y a pas de join requests. Le toggle est quand meme disponible dans l'API pour la coherence du modele de donnees.

5. **Migration sur donnees existantes** : La colonne `invitation_only` a un DEFAULT `false`. Toutes les companies existantes conservent le comportement ouvert. Aucun utilisateur n'est impacte par la migration.

6. **`invitationOnly` dans le body de creation (POST)** : Le `createCompanySchema` ne contient PAS `invitationOnly`. Les nouvelles companies sont toujours creees avec `invitationOnly: false`. Le toggle est une action explicite post-creation.

7. **Concurrence toggle + join-request** : Si un admin active `invitationOnly` pendant qu'un join request est en cours de creation, la verification est atomique (lecture du flag puis creation). En cas de race condition, le comportement depend de l'ordre des transactions -- acceptable pour la V1.

---

## Hors Scope

- UI d'administration company settings (page dediee avec toggles) -- future story
- Notification aux membres quand le flag change
- Blocage des sign-ups Better Auth per-company (l'inscription reste ouverte, seul le join est bloque)
- Whitelist de domaines email par company
- Expiration automatique du flag (timer)
- Enforcement du flag `invitationOnly` via le middleware `requirePermission` -- RBAC-S04

---

## Dependances Techniques

| Dependance | Statut | Impact |
|-----------|--------|--------|
| TECH-07 (Modifications 5 tables) | DONE | Colonnes `tier`, `ssoEnabled`, `maxUsers` sur companies |
| TECH-01 (PostgreSQL externe) | DONE | Base PostgreSQL operationnelle |
| MU-S01 (API invitations email) | DONE | Flow invitation fonctionnel pour bypass |
| Better Auth signup flow | Existant | Pas de modification -- signup reste instance-wide |

---

## Checklist Dev

- [ ] Migration : ajouter `invitation_only BOOLEAN NOT NULL DEFAULT false` a `companies`
- [ ] Schema Drizzle : ajouter `invitationOnly` dans `companies.ts`
- [ ] Validator : ajouter `invitationOnly: z.boolean().optional()` dans `updateCompanySchema`
- [ ] Guard : verifier `invitationOnly` dans le handler `POST /companies/:companyId/join-requests`
- [ ] Guard : s'assurer que `POST /api/invites/:token/accept` N'est PAS affecte
- [ ] Audit : emettre `"company.config_change"` quand `invitationOnly` change de valeur
- [ ] Audit : inclure `{ field, oldValue, newValue }` dans les details
- [ ] Reponse API : le champ `invitationOnly` est present dans les GET/PATCH company
- [ ] `pnpm typecheck` : aucune erreur
- [ ] `pnpm db:generate` : migration generee
- [ ] Backward compatibility : companies existantes ont `invitationOnly: false`
- [ ] Pas de regression sur les routes existantes de company CRUD

## Checklist QA

- [ ] Test PATCH company avec `invitationOnly: true` -> 200 + company mise a jour
- [ ] Test PATCH company avec `invitationOnly: false` -> 200 + company mise a jour
- [ ] Test PATCH company avec `invitationOnly: "yes"` -> 400 validation error
- [ ] Test POST join-request quand `invitationOnly: true` -> 403
- [ ] Test POST join-request quand `invitationOnly: false` -> comportement normal
- [ ] Test POST accept invite quand `invitationOnly: true` -> 200 (bypass)
- [ ] Test activity_log contient `"company.config_change"` avec field/oldValue/newValue
- [ ] Test activity_log ne contient PAS `"company.config_change"` quand valeur identique
- [ ] Test GET company retourne `invitationOnly` dans la reponse
- [ ] Test migration : companies existantes ont `invitationOnly: false`
- [ ] Test agent join-request quand `invitationOnly: true` -> 403
