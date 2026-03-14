# SSO-S01 — Table SSO Configurations + Service CRUD + API Routes

> **Epic** : SSO — Enterprise Auth
> **Sprint** : Batch 13
> **Assignation** : Tom (backend)
> **Effort** : S (2 SP, 1j)
> **Bloque par** : TECH-06 (10 nouvelles tables — fournit le schema sso_configurations de base)
> **Debloque** : SSO-S02 (Better Auth SAML/OIDC), SSO-S03 (UI config SSO)
> **ADR** : ADR-002

---

## Contexte

TECH-06 a cree le schema Drizzle de base pour `sso_configurations` avec les colonnes : id, companyId, provider, displayName, config (JSONB), enabled, verifiedAt, createdByUserId, createdAt, updatedAt. Deux indexes existent : un unique index (companyId, provider) et un index (companyId, enabled).

SSO-S01 construit sur cette fondation pour fournir :

1. **Schema enrichi** : ajout de colonnes pour le domain mapping (emailDomain), metadata URL, entity ID, certificat, et statut de verification
2. **Migration Drizzle** : migration SQL pour les colonnes additionnelles
3. **Service CRUD** : `ssoConfigurationService` avec list, get, create, update, delete, getByDomain, verify, toggleEnabled
4. **Types shared** : interfaces TypeScript et validators Zod dans `@mnm/shared`
5. **API Routes** : 7 routes RESTful sous `/companies/:companyId/sso`
6. **Audit integration** : emission d'audit events pour toutes les mutations SSO
7. **RLS compatible** : toutes les queries filtrent par companyId (compatible TECH-05)

Ce service est backend-only (pas de verification Chrome MCP).

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| TECH-06 | DONE | Schema `sso_configurations` de base, index unique (companyId, provider) |
| TECH-05 | DONE | RLS PostgreSQL sur sso_configurations |
| TECH-07 | DONE | Colonne `ssoEnabled` sur companies |
| RBAC-S01 | DONE | hasPermission() avec scope |
| RBAC-S04 | DONE | requirePermission middleware |
| OBS-S02 | DONE | emitAudit helper |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Schema enrichment
**Given** le schema `sso_configurations` de TECH-06
**When** la migration SSO-S01 s'applique
**Then** les colonnes suivantes sont ajoutees : `emailDomain` (text, nullable), `metadataUrl` (text, nullable), `entityId` (text, nullable), `certificate` (text, nullable), `status` (text, default "draft"), `lastSyncAt` (timestamp, nullable), `lastSyncError` (text, nullable)

### AC2 — SSO configuration creation
**Given** un admin de la company avec permission `company:manage_sso`
**When** il cree une configuration SSO (provider="saml", displayName="Okta SSO", emailDomain="acme.com")
**Then** la configuration est persistee dans `sso_configurations` et un audit event `sso.config_created` est emis

### AC3 — Unique provider per company enforcement
**Given** une company avec une config SSO provider="saml" existante
**When** l'admin tente de creer une seconde config avec provider="saml"
**Then** l'API retourne 409 Conflict avec message "SSO configuration for provider saml already exists"

### AC4 — SSO configuration listing
**Given** un admin de la company
**When** il requete GET /companies/:companyId/sso
**Then** il recoit la liste des configurations SSO de la company, triees par createdAt desc

### AC5 — SSO configuration update
**Given** une configuration SSO existante
**When** l'admin modifie les champs (displayName, config, emailDomain, metadataUrl)
**Then** la configuration est mise a jour, `updatedAt` est rafraichi, et un audit event `sso.config_updated` est emis

### AC6 — SSO configuration deletion
**Given** une configuration SSO existante desactivee (enabled=false)
**When** l'admin la supprime
**Then** la configuration est supprimee et un audit event `sso.config_deleted` severity "warning" est emis

### AC7 — Cannot delete enabled SSO config
**Given** une configuration SSO avec enabled=true
**When** l'admin tente de la supprimer
**Then** l'API retourne 400 Bad Request avec message "Cannot delete an enabled SSO configuration. Disable it first."

### AC8 — SSO toggle enabled/disabled
**Given** une configuration SSO existante
**When** l'admin appelle POST /companies/:companyId/sso/:configId/toggle
**Then** le champ `enabled` est inverse (true->false ou false->true), la company `ssoEnabled` est mise a jour en consequence, et un audit event `sso.config_toggled` est emis

### AC9 — SSO lookup by email domain
**Given** une configuration SSO avec emailDomain="acme.com" et enabled=true
**When** le systeme cherche la config SSO pour un email "user@acme.com"
**Then** la configuration SSO est trouvee et retournee

### AC10 — SSO verification status update
**Given** une configuration SSO en statut "draft"
**When** l'admin appelle POST /companies/:companyId/sso/:configId/verify
**Then** le statut passe a "verified", `verifiedAt` est mis a jour, et un audit event `sso.config_verified` est emis

### AC11 — Company ssoEnabled sync
**Given** une company avec 2 configs SSO (une enabled, une disabled)
**When** la config enabled est desactivee via toggle
**Then** la company `ssoEnabled` passe a false (aucune config SSO active)

### AC12 — Permission enforcement
**Given** un utilisateur avec role "viewer" (pas de permission `company:manage_sso`)
**When** il tente d'acceder aux routes SSO
**Then** l'API retourne 403 Forbidden

---

## Deliverables

### D1 — Schema Drizzle enrichi
**Fichier** : `packages/db/src/schema/sso_configurations.ts`
**Modifications** :
- Ajout colonnes : emailDomain, metadataUrl, entityId, certificate, status, lastSyncAt, lastSyncError
- Ajout index sur emailDomain pour lookup rapide

### D2 — Migration SQL
**Fichier** : `packages/db/src/migrations/0042_sso_s01_configuration_enrichment.sql`
**Contenu** : ALTER TABLE pour ajouter les colonnes, CREATE INDEX pour emailDomain

### D3 — Types shared
**Fichier** : `packages/shared/src/types/sso.ts`
**Types** :
- `SsoProvider` : "saml" | "oidc"
- `SsoConfigStatus` : "draft" | "verified" | "error"
- `SsoConfiguration` : interface complete
- `CreateSsoConfigurationInput` : input creation
- `UpdateSsoConfigurationInput` : input update partiel

### D4 — Validators Zod
**Fichier** : `packages/shared/src/validators/sso.ts`
**Schemas** :
- `createSsoConfigurationSchema`
- `updateSsoConfigurationSchema`

### D5 — Service CRUD
**Fichier** : `server/src/services/sso-configurations.ts`
**Fonctions** :
- `listConfigurations(companyId)` : liste triee par createdAt desc
- `getConfigurationById(companyId, configId)` : get by ID
- `createConfiguration(companyId, input, actorId)` : create avec unique check
- `updateConfiguration(companyId, configId, input)` : update partiel
- `deleteConfiguration(companyId, configId)` : delete (only if disabled)
- `toggleEnabled(companyId, configId)` : toggle + sync company ssoEnabled
- `verifyConfiguration(companyId, configId)` : update status to verified
- `getByEmailDomain(emailDomain)` : lookup pour login flow

### D6 — API Routes
**Fichier** : `server/src/routes/sso.ts`
**Routes** :
| Methode | Path | Permission | Description |
|---------|------|------------|-------------|
| GET | `/companies/:companyId/sso` | company:manage_sso | Lister configs SSO |
| GET | `/companies/:companyId/sso/:configId` | company:manage_sso | Get config par ID |
| POST | `/companies/:companyId/sso` | company:manage_sso | Creer config SSO |
| PUT | `/companies/:companyId/sso/:configId` | company:manage_sso | Modifier config SSO |
| DELETE | `/companies/:companyId/sso/:configId` | company:manage_sso | Supprimer config SSO |
| POST | `/companies/:companyId/sso/:configId/toggle` | company:manage_sso | Toggle enabled |
| POST | `/companies/:companyId/sso/:configId/verify` | company:manage_sso | Verifier config |

### D7 — Barrel exports
- `packages/shared/src/types/index.ts` : export SSO types
- `packages/shared/src/validators/index.ts` : export SSO validators
- `packages/shared/src/index.ts` : export SSO types + validators
- `server/src/services/index.ts` : export ssoConfigurationService
- `server/src/routes/index.ts` : export ssoRoutes
- `server/src/app.ts` : mount ssoRoutes

---

## data-testid Mapping

| data-testid | Element | Localisation |
|------------|---------|-------------|
| `sso-s01-schema-id` | Colonne id | sso_configurations.ts |
| `sso-s01-schema-company-id` | Colonne companyId | sso_configurations.ts |
| `sso-s01-schema-provider` | Colonne provider | sso_configurations.ts |
| `sso-s01-schema-display-name` | Colonne displayName | sso_configurations.ts |
| `sso-s01-schema-config` | Colonne config JSONB | sso_configurations.ts |
| `sso-s01-schema-enabled` | Colonne enabled | sso_configurations.ts |
| `sso-s01-schema-email-domain` | Colonne emailDomain | sso_configurations.ts |
| `sso-s01-schema-metadata-url` | Colonne metadataUrl | sso_configurations.ts |
| `sso-s01-schema-entity-id` | Colonne entityId | sso_configurations.ts |
| `sso-s01-schema-certificate` | Colonne certificate | sso_configurations.ts |
| `sso-s01-schema-status` | Colonne status | sso_configurations.ts |
| `sso-s01-schema-verified-at` | Colonne verifiedAt | sso_configurations.ts |
| `sso-s01-schema-last-sync-at` | Colonne lastSyncAt | sso_configurations.ts |
| `sso-s01-schema-last-sync-error` | Colonne lastSyncError | sso_configurations.ts |
| `sso-s01-schema-created-by` | Colonne createdByUserId | sso_configurations.ts |
| `sso-s01-schema-created-at` | Colonne createdAt | sso_configurations.ts |
| `sso-s01-schema-updated-at` | Colonne updatedAt | sso_configurations.ts |
| `sso-s01-idx-unique` | Unique index (companyId, provider) | sso_configurations.ts |
| `sso-s01-idx-enabled` | Index (companyId, enabled) | sso_configurations.ts |
| `sso-s01-idx-email-domain` | Index emailDomain | sso_configurations.ts |
| `sso-s01-migration` | Migration SQL file | 0042_sso_s01*.sql |
| `sso-s01-type-provider` | SsoProvider type | types/sso.ts |
| `sso-s01-type-status` | SsoConfigStatus type | types/sso.ts |
| `sso-s01-type-config` | SsoConfiguration interface | types/sso.ts |
| `sso-s01-type-create-input` | CreateSsoConfigurationInput | types/sso.ts |
| `sso-s01-type-update-input` | UpdateSsoConfigurationInput | types/sso.ts |
| `sso-s01-validator-create` | createSsoConfigurationSchema | validators/sso.ts |
| `sso-s01-validator-update` | updateSsoConfigurationSchema | validators/sso.ts |
| `sso-s01-svc-list` | listConfigurations function | sso-configurations.ts |
| `sso-s01-svc-get` | getConfigurationById function | sso-configurations.ts |
| `sso-s01-svc-create` | createConfiguration function | sso-configurations.ts |
| `sso-s01-svc-update` | updateConfiguration function | sso-configurations.ts |
| `sso-s01-svc-delete` | deleteConfiguration function | sso-configurations.ts |
| `sso-s01-svc-toggle` | toggleEnabled function | sso-configurations.ts |
| `sso-s01-svc-verify` | verifyConfiguration function | sso-configurations.ts |
| `sso-s01-svc-get-by-domain` | getByEmailDomain function | sso-configurations.ts |
| `sso-s01-route-list` | GET /companies/:companyId/sso | sso.ts (route) |
| `sso-s01-route-get` | GET /companies/:companyId/sso/:configId | sso.ts (route) |
| `sso-s01-route-create` | POST /companies/:companyId/sso | sso.ts (route) |
| `sso-s01-route-update` | PUT /companies/:companyId/sso/:configId | sso.ts (route) |
| `sso-s01-route-delete` | DELETE /companies/:companyId/sso/:configId | sso.ts (route) |
| `sso-s01-route-toggle` | POST .../toggle | sso.ts (route) |
| `sso-s01-route-verify` | POST .../verify | sso.ts (route) |
| `sso-s01-audit-created` | Audit event sso.config_created | sso.ts (route) |
| `sso-s01-audit-updated` | Audit event sso.config_updated | sso.ts (route) |
| `sso-s01-audit-deleted` | Audit event sso.config_deleted | sso.ts (route) |
| `sso-s01-audit-toggled` | Audit event sso.config_toggled | sso.ts (route) |
| `sso-s01-audit-verified` | Audit event sso.config_verified | sso.ts (route) |
| `sso-s01-barrel-svc` | Service barrel export | services/index.ts |
| `sso-s01-barrel-route` | Route barrel export | routes/index.ts |
| `sso-s01-barrel-app` | App mount | app.ts |
| `sso-s01-barrel-types` | Types barrel export | types/index.ts |
| `sso-s01-barrel-validators` | Validators barrel export | validators/index.ts |
| `sso-s01-barrel-shared` | Shared index export | shared/src/index.ts |

---

## Test Cases (52 tests)

### Schema Tests (T01-T17)
- T01: sso_configurations table has id column (uuid pk)
- T02: sso_configurations table has companyId column (uuid, FK to companies)
- T03: sso_configurations table has provider column (text, not null)
- T04: sso_configurations table has displayName column (text, nullable)
- T05: sso_configurations table has config column (jsonb, not null, default {})
- T06: sso_configurations table has enabled column (boolean, default false)
- T07: sso_configurations table has emailDomain column (text, nullable)
- T08: sso_configurations table has metadataUrl column (text, nullable)
- T09: sso_configurations table has entityId column (text, nullable)
- T10: sso_configurations table has certificate column (text, nullable)
- T11: sso_configurations table has status column (text, default "draft")
- T12: sso_configurations table has verifiedAt column (timestamp, nullable)
- T13: sso_configurations table has lastSyncAt column (timestamp, nullable)
- T14: sso_configurations table has lastSyncError column (text, nullable)
- T15: unique index on (companyId, provider) exists
- T16: index on (companyId, enabled) exists
- T17: index on emailDomain exists

### Migration Tests (T18-T19)
- T18: migration file 0042_sso_s01 exists
- T19: migration contains ALTER TABLE and CREATE INDEX statements

### Types Tests (T20-T25)
- T20: SsoProvider type = "saml" | "oidc" exists in types/sso.ts
- T21: SsoConfigStatus type exists
- T22: SsoConfiguration interface exists with all fields
- T23: CreateSsoConfigurationInput interface exists
- T24: UpdateSsoConfigurationInput interface exists
- T25: types are exported from types/index.ts and shared/src/index.ts

### Validator Tests (T26-T28)
- T26: createSsoConfigurationSchema validates provider, displayName, emailDomain
- T27: updateSsoConfigurationSchema makes all fields optional
- T28: validators exported from validators/index.ts and shared/src/index.ts

### Service Tests (T29-T36)
- T29: listConfigurations returns array sorted by createdAt desc
- T30: getConfigurationById returns single config or throws notFound
- T31: createConfiguration inserts with unique provider check
- T32: createConfiguration throws conflict on duplicate provider
- T33: updateConfiguration partial update with updatedAt refresh
- T34: deleteConfiguration deletes only if disabled, throws if enabled
- T35: toggleEnabled inverts enabled flag and syncs company.ssoEnabled
- T36: verifyConfiguration updates status to "verified" and sets verifiedAt

### Route Tests (T37-T46)
- T37: GET /companies/:companyId/sso returns list with requirePermission
- T38: GET /companies/:companyId/sso/:configId returns single config
- T39: POST /companies/:companyId/sso creates config + emits audit
- T40: POST duplicate provider returns 409
- T41: PUT /companies/:companyId/sso/:configId updates config + emits audit
- T42: DELETE disabled config succeeds + emits audit with severity "warning"
- T43: DELETE enabled config returns 400
- T44: POST .../toggle inverts enabled + emits audit + syncs company ssoEnabled
- T45: POST .../verify sets status verified + emits audit
- T46: Viewer role gets 403 on all SSO routes

### Service Domain Tests (T47-T49)
- T47: getByEmailDomain finds config by domain match
- T48: getByEmailDomain returns null for unknown domain
- T49: toggling last enabled config sets company.ssoEnabled=false

### Barrel Export Tests (T50-T52)
- T50: ssoConfigurationService exported from services/index.ts
- T51: ssoRoutes exported from routes/index.ts
- T52: ssoRoutes mounted in app.ts
