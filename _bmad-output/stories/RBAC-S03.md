# RBAC-S03 : BusinessRole Migration -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S03 |
| **Titre** | BusinessRole sur company_memberships -- Data migration + Validation + API |
| **Epic** | Epic 2 -- RBAC & Permissions |
| **Sprint** | Sprint 1 (Phase 2) |
| **Effort** | S (2 SP, 1j) |
| **Priorite** | P1 |
| **Assignation** | Cofondateur |
| **Bloque par** | TECH-07 (Modifications 5 tables -- business_role column added) |
| **Debloque** | RBAC-S07 (Badges couleur par role), RBAC-S02 (presets par role) |
| **ADR** | ADR-002 (RBAC 4 roles) |
| **Type** | Backend + Shared (pas de composant UI -- l'UI arrive dans RBAC-S07 et MU-S02) |

---

## Description

### Contexte

TECH-07 a ajoute la colonne `business_role` sur `company_memberships` (migration 0029) en tant que `text("business_role").notNull().default("contributor")`. Cependant :

1. **La colonne est un `text` libre** -- aucune validation ne contraint les valeurs possibles
2. **Les membres existants ont `contributor` par defaut** -- mais les fondateurs/premiers utilisateurs devraient etre `admin`
3. **Aucun endpoint API ne permet de modifier le `businessRole`** d'un membre
4. **Aucune constante partagee** n'exporte les 4 roles valides (`admin`, `manager`, `contributor`, `viewer`)
5. **Le type TypeScript `CompanyMembership`** dans `packages/shared/src/types/access.ts` ne contient pas le champ `businessRole`

### Ce que cette story fait

1. **Data migration** : Migration Drizzle qui met a jour TOUS les `company_memberships` existants vers `business_role = 'admin'` (les premiers membres sont les fondateurs)
2. **Constantes partagees** : Exporter `BUSINESS_ROLES` et `BusinessRole` depuis `@mnm/shared`
3. **Validation Zod** : Schema `businessRoleSchema` et `updateMemberBusinessRoleSchema` dans les validators
4. **Type TypeScript** : Ajouter `businessRole` au type `CompanyMembership`
5. **API endpoint** : `PATCH /api/companies/:companyId/members/:memberId/business-role` pour modifier le role
6. **Service** : Ajouter `updateMemberBusinessRole()` dans `accessService()`
7. **Seed** : Mettre a jour le seed pour inclure `businessRole: "admin"` explicitement

---

## Etat Actuel du Code (Analyse)

### Fichiers impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `packages/shared/src/constants.ts` | Constantes partagees (PERMISSION_KEYS, etc.) | MODIFIE : ajout `BUSINESS_ROLES`, `BusinessRole`, `BUSINESS_ROLE_LABELS` |
| `packages/shared/src/types/access.ts` | Types CompanyMembership, etc. | MODIFIE : ajout champ `businessRole` |
| `packages/shared/src/validators/access.ts` | Zod schemas pour invites/permissions | MODIFIE : ajout `businessRoleSchema`, `updateMemberBusinessRoleSchema` |
| `packages/shared/src/validators/index.ts` | Re-exports validators | MODIFIE : re-export nouveaux schemas |
| `packages/shared/src/index.ts` | Re-exports shared package | MODIFIE : re-export `BUSINESS_ROLES`, `BusinessRole`, `BUSINESS_ROLE_LABELS` |
| `server/src/services/access.ts` | Service RBAC, `ensureMembership()`, `listMembers()` | MODIFIE : ajout `updateMemberBusinessRole()` |
| `server/src/routes/access.ts` | Routes API access/invite/members | MODIFIE : ajout endpoint PATCH business-role |
| `packages/db/src/seed.ts` | Seed initial de la DB | MODIFIE : ajout `businessRole: "admin"` dans le membership |
| `packages/db/src/migrations/0031_*.sql` | N'existe pas | CREE : migration data existants -> admin |

### Fichiers de reference (non modifies dans cette story)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/company_memberships.ts` | Schema Drizzle -- `businessRole: text("business_role").notNull().default("contributor")` deja present |
| `packages/db/src/migrations/0029_fearless_chronomancer.sql` | Migration TECH-07 qui a ajoute la colonne |
| `server/src/routes/authz.ts` | `assertCompanyAccess`, helpers auth |
| `server/src/middleware/validate.ts` | Middleware de validation Zod |
| `packages/test-utils/src/factories/membership.factory.ts` | Factory test avec `businessRole: "contributor"` |

### Conventions du codebase (a respecter)

1. **Service pattern** : `accessService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw forbidden("message")`, `throw notFound("message")`, `throw badRequest("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Zod validation** : schemas dans `packages/shared/src/validators/`, `z.enum()` pour les enums
5. **Constantes** : pattern `as const` array + type extrait, dans `packages/shared/src/constants.ts`
6. **API routes** : `router.patch("/path", validate(schema), async (req, res) => { ... })`
7. **Permission check** : `assertCompanyPermission(req, companyId, "users:manage_permissions")` avant les mutations membre
8. **Re-exports** : Toujours ajouter les exports dans `validators/index.ts` et `shared/src/index.ts`

---

## Specification Technique Detaillee

### T1 : Ajouter les constantes `BUSINESS_ROLES` -- `packages/shared/src/constants.ts`

```typescript
export const BUSINESS_ROLES = ["admin", "manager", "contributor", "viewer"] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const BUSINESS_ROLE_LABELS: Record<BusinessRole, string> = {
  admin: "Admin",
  manager: "Manager",
  contributor: "Contributor",
  viewer: "Viewer",
};
```

Ajouter apres la ligne `export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];` (ligne 229 actuelle).

#### Re-export dans `packages/shared/src/index.ts`

Ajouter dans la section des constantes re-exportees :

```typescript
export {
  // ... existants ...
  BUSINESS_ROLES,
  BUSINESS_ROLE_LABELS,
  // ... existants ...
  type BusinessRole,
} from "./constants.js";
```

---

### T2 : Mettre a jour le type `CompanyMembership` -- `packages/shared/src/types/access.ts`

#### Import du type BusinessRole

```typescript
import type {
  // ... existants ...
  BusinessRole,
  // ... existants ...
} from "../constants.js";
```

#### Ajout du champ dans l'interface

```typescript
export interface CompanyMembership {
  id: string;
  companyId: string;
  principalType: PrincipalType;
  principalId: string;
  status: MembershipStatus;
  membershipRole: string | null;
  businessRole: BusinessRole;  // <-- NOUVEAU
  createdAt: Date;
  updatedAt: Date;
}
```

---

### T3 : Ajouter le schema Zod `businessRoleSchema` -- `packages/shared/src/validators/access.ts`

```typescript
import {
  // ... existants ...
  BUSINESS_ROLES,
} from "../constants.js";

export const businessRoleSchema = z.enum(BUSINESS_ROLES);

export const updateMemberBusinessRoleSchema = z.object({
  businessRole: z.enum(BUSINESS_ROLES),
});

export type UpdateMemberBusinessRole = z.infer<typeof updateMemberBusinessRoleSchema>;
```

#### Re-export dans `packages/shared/src/validators/index.ts`

Ajouter dans la section des exports depuis `"./access.js"` :

```typescript
export {
  // ... existants ...
  businessRoleSchema,
  updateMemberBusinessRoleSchema,
  type UpdateMemberBusinessRole,
} from "./access.js";
```

#### Re-export dans `packages/shared/src/index.ts`

Ajouter dans la section des validators re-exportes :

```typescript
export {
  // ... existants ...
  businessRoleSchema,
  updateMemberBusinessRoleSchema,
  type UpdateMemberBusinessRole,
} from "./validators/index.js";
```

---

### T4 : Data migration -- `packages/db/src/migrations/0031_business_role_admin_migration.sql`

**Objectif** : Tous les membres existants deviennent `admin` (ce sont les fondateurs). Les nouveaux membres crees apres cette migration auront `contributor` par defaut (grace au `DEFAULT 'contributor'` de TECH-07).

```sql
-- Data migration: existing members are founders, set them to admin
UPDATE "company_memberships" SET "business_role" = 'admin' WHERE "business_role" = 'contributor';
```

**Important** : Cette migration est idempotente. Si re-executee, elle ne fait que re-setter les `contributor` en `admin`. Les membres deja `admin`, `manager`, ou `viewer` ne sont pas affectes.

**Note** : Le fichier de migration doit etre genere via `pnpm db:generate` apres avoir cree un fichier SQL custom. Si Drizzle ne detecte pas de changement de schema (puisque la colonne existe deja), il faut creer un fichier de migration SQL manuel dans le dossier migrations.

Pour creer la migration custom, ajouter l'entree dans le fichier `meta/_journal.json` du dossier migrations :

```json
{
  "idx": 31,
  "version": "7",
  "when": 1710403200000,
  "tag": "0031_business_role_admin_migration",
  "breakpoints": true
}
```

---

### T5 : Ajouter `updateMemberBusinessRole()` dans le service -- `server/src/services/access.ts`

```typescript
import { BUSINESS_ROLES } from "@mnm/shared";
import type { BusinessRole } from "@mnm/shared";

// Dans accessService(db):

async function updateMemberBusinessRole(
  companyId: string,
  memberId: string,
  businessRole: BusinessRole,
): Promise<MembershipRow | null> {
  const member = await db
    .select()
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.id, memberId),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (!member) return null;

  const [updated] = await db
    .update(companyMemberships)
    .set({
      businessRole,
      updatedAt: new Date(),
    })
    .where(eq(companyMemberships.id, memberId))
    .returning();

  return updated ?? null;
}
```

Ajouter `updateMemberBusinessRole` dans le `return { ... }` de `accessService()`.

#### Mettre a jour `ensureMembership()` pour accepter un businessRole optionnel

```typescript
async function ensureMembership(
  companyId: string,
  principalType: PrincipalType,
  principalId: string,
  membershipRole: string | null = "member",
  status: "pending" | "active" | "suspended" = "active",
  businessRole: string = "contributor",  // <-- NOUVEAU parametre
) {
  const existing = await getMembership(companyId, principalType, principalId);
  if (existing) {
    if (existing.status !== status || existing.membershipRole !== membershipRole) {
      const updated = await db
        .update(companyMemberships)
        .set({ status, membershipRole, updatedAt: new Date() })
        .where(eq(companyMemberships.id, existing.id))
        .returning()
        .then((rows) => rows[0] ?? null);
      return updated ?? existing;
    }
    return existing;
  }

  return db
    .insert(companyMemberships)
    .values({
      companyId,
      principalType,
      principalId,
      status,
      membershipRole,
      businessRole,  // <-- NOUVEAU
    })
    .returning()
    .then((rows) => rows[0]);
}
```

**Backward compatibility** : Le parametre `businessRole` a une valeur par defaut `"contributor"`. Les appels existants (`ensureMembership(companyId, "user", userId, "owner", "active")`) continuent de fonctionner sans changement.

---

### T6 : Ajouter l'endpoint API -- `server/src/routes/access.ts`

Ajouter apres le PATCH permissions existant (ligne ~2559) :

```typescript
router.patch(
  "/companies/:companyId/members/:memberId/business-role",
  validate(updateMemberBusinessRoleSchema),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    const memberId = req.params.memberId as string;
    await assertCompanyPermission(req, companyId, "users:manage_permissions");

    const updated = await access.updateMemberBusinessRole(
      companyId,
      memberId,
      req.body.businessRole,
    );
    if (!updated) throw notFound("Member not found");

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "member.business_role_updated",
      entityType: "company_membership",
      entityId: memberId,
      agentId: actor.agentId,
      runId: actor.runId,
      details: {
        businessRole: req.body.businessRole,
        previousBusinessRole: null, // will be enriched when needed
      },
    });

    res.json(updated);
  },
);
```

#### Import a ajouter dans le fichier

```typescript
import {
  // ... existants ...
  updateMemberBusinessRoleSchema,
} from "@mnm/shared";
```

---

### T7 : Mettre a jour le seed -- `packages/db/src/seed.ts`

Modifier l'insertion du membership admin (ligne ~63-72) :

```typescript
// AVANT
await db
  .insert(companyMemberships)
  .values({
    companyId: company.id,
    principalType: "user",
    principalId: adminUserId,
    status: "active",
    membershipRole: "owner",
  })
  .onConflictDoNothing();

// APRES
await db
  .insert(companyMemberships)
  .values({
    companyId: company.id,
    principalType: "user",
    principalId: adminUserId,
    status: "active",
    membershipRole: "owner",
    businessRole: "admin",  // <-- NOUVEAU : fondateur explicitement admin
  })
  .onConflictDoNothing();
```

---

## data-test-id Attributes

Bien que cette story soit principalement backend, les data-testid sont documentes ici pour les stories UI futures (MU-S02, RBAC-S07) et les tests E2E.

| Element | data-testid | Usage |
|---------|-------------|-------|
| Badge role dans la liste des membres | `data-testid="rbac-s03-role-badge"` | Affiche le badge colore du businessRole (RBAC-S07) |
| Badge role avec valeur specifique | `data-testid="rbac-s03-role-badge-admin"` | Badge variant admin |
| Badge role avec valeur specifique | `data-testid="rbac-s03-role-badge-manager"` | Badge variant manager |
| Badge role avec valeur specifique | `data-testid="rbac-s03-role-badge-contributor"` | Badge variant contributor |
| Badge role avec valeur specifique | `data-testid="rbac-s03-role-badge-viewer"` | Badge variant viewer |
| Selecteur de role dans le panneau membre | `data-testid="rbac-s03-role-selector"` | Dropdown pour changer le role (MU-S02) |
| Option admin dans le selecteur | `data-testid="rbac-s03-role-option-admin"` | Option du dropdown |
| Option manager dans le selecteur | `data-testid="rbac-s03-role-option-manager"` | Option du dropdown |
| Option contributor dans le selecteur | `data-testid="rbac-s03-role-option-contributor"` | Option du dropdown |
| Option viewer dans le selecteur | `data-testid="rbac-s03-role-option-viewer"` | Option du dropdown |
| Confirmation de changement de role | `data-testid="rbac-s03-role-change-confirm"` | Bouton de confirmation |
| Message de succes apres changement | `data-testid="rbac-s03-role-change-success"` | Toast/notification |

---

## Acceptance Criteria

### AC-01 : Constantes BUSINESS_ROLES exportees depuis @mnm/shared

```
Given le package @mnm/shared
When on importe BUSINESS_ROLES
Then le tableau contient exactement ["admin", "manager", "contributor", "viewer"]
And le type BusinessRole est l'union de ces 4 valeurs
And BUSINESS_ROLE_LABELS mappe chaque role a son label affichable
```

### AC-02 : Data migration -- existants mis a jour en admin

```
Given des company_memberships existantes avec business_role = 'contributor' (defaut TECH-07)
When la migration 0031 s'execute
Then TOUTES les lignes existantes ont business_role = 'admin'
And aucune donnee n'est perdue (id, companyId, principalId, status inchanges)
```

### AC-03 : Nouveaux membres recoivent contributor par defaut

```
Given la migration 0031 executee
When un nouveau membre est cree via ensureMembership() sans specifier businessRole
Then son business_role est 'contributor' (valeur par defaut de la colonne)
```

### AC-04 : Validation Zod rejette les roles invalides

```
Given un appel PATCH /api/companies/:companyId/members/:memberId/business-role
When le body contient { businessRole: "superadmin" }
Then la reponse est 400 Bad Request avec les details de validation Zod
And le membership n'est PAS modifie en base
```

### AC-05 : Validation Zod accepte les 4 roles valides

```
Given un appel PATCH /api/companies/:companyId/members/:memberId/business-role
When le body contient { businessRole: "manager" }
And l'appelant a la permission "users:manage_permissions"
Then la reponse est 200 avec le membership mis a jour
And le champ business_role en base est "manager"
```

### AC-06 : Endpoint protege par permission users:manage_permissions

```
Given un utilisateur SANS la permission "users:manage_permissions" sur la company
When il appelle PATCH /api/companies/:companyId/members/:memberId/business-role
Then la reponse est 403 Forbidden
```

### AC-07 : Endpoint retourne 404 pour un membre inexistant

```
Given un appel PATCH /api/companies/:companyId/members/inexistant-uuid/business-role
When le body contient { businessRole: "viewer" }
Then la reponse est 404 Not Found avec le message "Member not found"
```

### AC-08 : Type CompanyMembership inclut businessRole

```
Given le type CompanyMembership dans @mnm/shared
When on verifie sa structure
Then il contient le champ businessRole de type BusinessRole
And la valeur est typee "admin" | "manager" | "contributor" | "viewer"
```

### AC-09 : Seed inclut businessRole admin pour le fondateur

```
Given une execution du seed (pnpm db:seed)
When le membership admin est cree
Then il a businessRole = "admin" explicitement
```

### AC-10 : Activity log enregistre le changement de role

```
Given un appel reussi PATCH /api/companies/:companyId/members/:memberId/business-role
When le role est change de contributor a manager
Then un activity_log avec action "member.business_role_updated" est cree
And les details contiennent le nouveau businessRole
```

### AC-11 : Backward compatibility -- ensureMembership sans businessRole

```
Given du code existant qui appelle ensureMembership(companyId, "user", userId, "owner", "active")
When le nouveau code est deploye
Then l'appel fonctionne identiquement (businessRole = "contributor" par defaut)
And aucune route existante ne casse
```

### AC-12 : Endpoint cross-company isole

```
Given un membre de la company A
When un utilisateur de la company B appelle PATCH business-role pour ce membre
Then la reponse est 403 Forbidden (via assertCompanyPermission)
```

---

## Plan de Tests E2E (Playwright)

### Fichier : `e2e/tests/RBAC-S03.spec.ts`

#### Tests file-content (schema/constants/validators)

| # | Test | Fichier verifie | Pattern attendu |
|---|------|-----------------|-----------------|
| 1 | BUSINESS_ROLES exporte | `packages/shared/src/constants.ts` | `BUSINESS_ROLES.*admin.*manager.*contributor.*viewer` |
| 2 | Type BusinessRole exporte | `packages/shared/src/constants.ts` | `BusinessRole` |
| 3 | BUSINESS_ROLE_LABELS exporte | `packages/shared/src/constants.ts` | `BUSINESS_ROLE_LABELS.*Record<BusinessRole` |
| 4 | businessRoleSchema dans validators | `packages/shared/src/validators/access.ts` | `businessRoleSchema.*z.enum.*BUSINESS_ROLES` |
| 5 | updateMemberBusinessRoleSchema | `packages/shared/src/validators/access.ts` | `updateMemberBusinessRoleSchema.*businessRole.*z.enum` |
| 6 | CompanyMembership inclut businessRole | `packages/shared/src/types/access.ts` | `businessRole.*BusinessRole` |
| 7 | Re-export dans validators/index.ts | `packages/shared/src/validators/index.ts` | `businessRoleSchema` |
| 8 | Re-export dans shared/index.ts (constants) | `packages/shared/src/index.ts` | `BUSINESS_ROLES` |
| 9 | Re-export dans shared/index.ts (validators) | `packages/shared/src/index.ts` | `updateMemberBusinessRoleSchema` |

#### Tests file-content (service/routes)

| # | Test | Fichier verifie | Pattern attendu |
|---|------|-----------------|-----------------|
| 10 | updateMemberBusinessRole dans service | `server/src/services/access.ts` | `updateMemberBusinessRole` |
| 11 | Service retourne updateMemberBusinessRole | `server/src/services/access.ts` | `return.*updateMemberBusinessRole` |
| 12 | Endpoint PATCH business-role existe | `server/src/routes/access.ts` | `business-role` |
| 13 | Endpoint utilise validate schema | `server/src/routes/access.ts` | `validate.*updateMemberBusinessRoleSchema` |
| 14 | Endpoint verifie permission | `server/src/routes/access.ts` | `assertCompanyPermission.*users:manage_permissions` |
| 15 | Activity log pour changement role | `server/src/routes/access.ts` | `member.business_role_updated` |

#### Tests file-content (migration/seed)

| # | Test | Fichier verifie | Pattern attendu |
|---|------|-----------------|-----------------|
| 16 | Migration existe | `packages/db/src/migrations/0031_*.sql` | `UPDATE.*company_memberships.*business_role.*admin` |
| 17 | Seed inclut businessRole admin | `packages/db/src/seed.ts` | `businessRole.*admin` |

#### Tests ensureMembership backward compat

| # | Test | Fichier verifie | Pattern attendu |
|---|------|-----------------|-----------------|
| 18 | ensureMembership accepte businessRole param | `server/src/services/access.ts` | `ensureMembership.*businessRole` |
| 19 | businessRole a une valeur par defaut | `server/src/services/access.ts` | `businessRole.*=.*"contributor"` ou `businessRole.*default` |

#### Tests validation (4 roles valides, rejets invalides)

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 20 | businessRoleSchema accepte "admin" | Parse "admin" avec Zod | Success |
| 21 | businessRoleSchema accepte "manager" | Parse "manager" avec Zod | Success |
| 22 | businessRoleSchema accepte "contributor" | Parse "contributor" avec Zod | Success |
| 23 | businessRoleSchema accepte "viewer" | Parse "viewer" avec Zod | Success |
| 24 | businessRoleSchema rejette "superadmin" | Parse "superadmin" avec Zod | Failure |
| 25 | businessRoleSchema rejette chaine vide | Parse "" avec Zod | Failure |
| 26 | BUSINESS_ROLES.length === 4 | Verifie la longueur du tableau | 4 |

### Couverture cible

| Module | Couverture cible |
|--------|-----------------|
| BUSINESS_ROLES constants | 100% (verifie via file-content) |
| businessRoleSchema validation | 100% (7 tests) |
| updateMemberBusinessRole service | >= 90% |
| PATCH business-role endpoint | >= 90% |
| Data migration | 100% (verifie via file-content) |

---

## Schema de Donnees

### Table `company_memberships` (colonne existante depuis TECH-07)

```sql
-- Colonne ajoutee par TECH-07 (migration 0029)
business_role TEXT NOT NULL DEFAULT 'contributor'
```

### Valeurs valides pour `business_role`

| Valeur | Description | Permissions implicites |
|--------|-------------|----------------------|
| `admin` | Administrateur de la company. Peut tout faire. | Toutes les permission keys |
| `manager` | Gestionnaire. Peut gerer projets, agents, issues. | La plupart des keys sauf company:manage_settings, company:manage_sso |
| `contributor` | Contributeur. Peut travailler sur les taches assignees. | Keys limitees : tasks:assign_scope, workflows:create |
| `viewer` | Observateur. Peut lire mais pas modifier. | Keys en lecture : audit:read, dashboard:view |

**Note** : Les permissions exactes par role seront definies dans RBAC-S02 (presets par role). Cette story pose les fondations du champ ; RBAC-S02 definira la matrice des permissions par role.

### Data migration SQL (0031)

```sql
UPDATE "company_memberships" SET "business_role" = 'admin' WHERE "business_role" = 'contributor';
```

---

## Diagramme de Flux -- PATCH business-role

```
Client
    |
    v
PATCH /api/companies/:companyId/members/:memberId/business-role
    |
    v
validate(updateMemberBusinessRoleSchema)
    |  → Zod: { businessRole: z.enum(["admin","manager","contributor","viewer"]) }
    |  → Rejette si role invalide (400)
    v
assertCompanyPermission(req, companyId, "users:manage_permissions")
    |  → Verifie que l'appelant est admin ou a la permission
    |  → 403 si refuse
    v
access.updateMemberBusinessRole(companyId, memberId, businessRole)
    |  → SELECT member WHERE companyId AND memberId
    |  → Si null → throw notFound("Member not found") → 404
    |  → UPDATE business_role, updated_at
    v
logActivity("member.business_role_updated")
    |  → Trace dans activity_log
    v
res.json(updatedMember)  → 200
```

---

## Risques et Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Migration met a jour des membres qui ne devraient pas etre admin | Faible | Moyen | A ce stade, tous les membres existants sont des fondateurs (pre-invitation). Verification dans les ACs |
| Pas de protection contre la degradation du dernier admin | Moyen | CRITIQUE | Hors scope de cette story. Sera traite dans RBAC-S04 ou MU-S02 avec une regle "au moins 1 admin par company" |
| businessRole vs membershipRole confusion | Faible | Faible | `membershipRole` est le role technique (owner/member), `businessRole` est le role metier (admin/manager/contributor/viewer). Documenter dans le code |
| Backward compat des appels ensureMembership | Faible | Moyen | Parametre avec valeur par defaut, tous les appels existants testables |

---

## Definition of Done

- [ ] `BUSINESS_ROLES` constante exportee depuis `@mnm/shared` avec les 4 valeurs
- [ ] `BusinessRole` type et `BUSINESS_ROLE_LABELS` labels exportes depuis `@mnm/shared`
- [ ] `businessRoleSchema` et `updateMemberBusinessRoleSchema` valident les 4 roles
- [ ] `CompanyMembership` type inclut `businessRole: BusinessRole`
- [ ] Migration 0031 met a jour les existants en `admin`
- [ ] `updateMemberBusinessRole()` ajoute dans `accessService()`
- [ ] `ensureMembership()` accepte un parametre `businessRole` optionnel (default: "contributor")
- [ ] Endpoint `PATCH /api/companies/:companyId/members/:memberId/business-role` fonctionnel
- [ ] Endpoint protege par permission `users:manage_permissions`
- [ ] Activity log enregistre les changements de role
- [ ] Seed mis a jour avec `businessRole: "admin"` pour le fondateur
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm test` passe sans regression
- [ ] Pas de secrets en dur, input sanitise
