# SSO-S02 — Better Auth SAML/OIDC Integration

> **Epic** : SSO — Enterprise Auth
> **Sprint** : Batch 13
> **Assignation** : Tom (backend)
> **Effort** : M (3 SP, 2-3j)
> **Bloque par** : SSO-S01 (Table SSO + Service CRUD + API routes)
> **Debloque** : SSO-S03 (UI config SSO)
> **ADR** : ADR-002

---

## Contexte

SSO-S01 a cree le schema `sso_configurations` enrichi, le service CRUD, les routes API et les types shared. SSO-S02 integre le SSO (SAML 2.0 et OIDC) dans le systeme d'authentification existant (Better Auth v1.4.18).

Ce story implemente :

1. **SSO Auth Service** : `server/src/services/sso-auth.ts` — orchestration du flux SSO (SAML assertion consumer, OIDC callback, auto-provisioning, account linking)
2. **SSO Auth Routes** : `server/src/routes/sso-auth.ts` — endpoints publics pour initier et terminer les flux SSO
3. **SAML Support** : parsing des assertions SAML, validation des signatures, extraction des attributs utilisateur
4. **OIDC Support** : authorization code flow, token exchange, userinfo extraction
5. **Auto-provisioning** : creation automatique d'utilisateurs et de company_memberships pour les nouveaux SSO users
6. **Account Linking** : liaison entre comptes SSO et comptes existants par email
7. **Session Creation** : creation de sessions Better Auth apres authentification SSO reussie
8. **Domain Detection** : detection automatique du provider SSO par le domaine email de l'utilisateur
9. **Shared Types** : types TypeScript pour les flux SSO dans `@mnm/shared`
10. **Shared Validators** : schemas Zod pour les payloads SSO

Ce story est backend-only (pas de verification Chrome MCP).

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| SSO-S01 | DONE | Schema `sso_configurations` enrichi, service CRUD, routes API, types shared |
| TECH-01 | DONE | PostgreSQL externe |
| TECH-05 | DONE | RLS PostgreSQL |
| RBAC-S01 | DONE | hasPermission() avec scope |
| RBAC-S04 | DONE | requirePermission middleware |
| OBS-S02 | DONE | emitAudit helper |
| MU-S06 | DONE | Sign-out, session management |

---

## Acceptance Criteria (Given/When/Then)

### AC1 — SAML Initiation
**Given** une company avec une config SSO SAML enabled et verified
**When** un utilisateur accede a GET /api/sso/saml/:companyId/login
**Then** il est redirige vers l'IdP SAML avec une AuthnRequest valide contenant l'entityId et le ACS URL

### AC2 — SAML Assertion Consumer
**Given** un IdP SAML qui envoie une assertion signee valide
**When** l'assertion est recue sur POST /api/sso/saml/:companyId/acs
**Then** les attributs utilisateur (email, name) sont extraits, le certificat de signature est verifie, et l'utilisateur est authentifie

### AC3 — OIDC Initiation
**Given** une company avec une config SSO OIDC enabled et verified
**When** un utilisateur accede a GET /api/sso/oidc/:companyId/login
**Then** il est redirige vers l'authorization endpoint de l'IdP OIDC avec client_id, redirect_uri, scope=openid+profile+email, et un state random

### AC4 — OIDC Callback
**Given** un IdP OIDC qui retourne un authorization code valide
**When** le callback est recu sur GET /api/sso/oidc/:companyId/callback?code=xxx&state=yyy
**Then** le code est echange contre des tokens, les informations utilisateur sont extraites du id_token/userinfo, et l'utilisateur est authentifie

### AC5 — Auto-provisioning nouveau utilisateur
**Given** un utilisateur qui s'authentifie via SSO pour la premiere fois (email non existant dans auth_users)
**When** l'authentification SSO reussit
**Then** un nouvel utilisateur est cree dans auth_users, un account est cree dans auth_accounts, une company_membership est creee avec businessRole="contributor", et un audit event `sso.user_provisioned` est emis

### AC6 — Account Linking utilisateur existant
**Given** un utilisateur existant dans auth_users avec le meme email que le SSO assertion
**When** l'authentification SSO reussit
**Then** un account SSO est lie au user existant dans auth_accounts (sans creer de doublon), une company_membership est creee si absente, et un audit event `sso.account_linked` est emis

### AC7 — Session creation apres SSO
**Given** un utilisateur authentifie via SSO (nouveau ou existant)
**When** l'authentification complete
**Then** une session Better Auth est creee, un cookie de session est pose, et l'utilisateur est redirige vers le frontend (/)

### AC8 — Domain detection
**Given** une config SSO avec emailDomain="acme.com" enabled
**When** un utilisateur appelle POST /api/sso/discover avec body { email: "user@acme.com" }
**Then** l'API retourne { provider: "saml"|"oidc", companyId: "xxx", loginUrl: "/api/sso/{provider}/{companyId}/login" }

### AC9 — Domain not found
**Given** aucune config SSO avec emailDomain="unknown.com"
**When** un utilisateur appelle POST /api/sso/discover avec body { email: "user@unknown.com" }
**Then** l'API retourne { provider: null } indiquant qu'aucun SSO n'est configure pour ce domaine

### AC10 — Invalid SAML assertion
**Given** une assertion SAML avec une signature invalide ou un certificat mismatch
**When** l'assertion est recue sur le ACS endpoint
**Then** l'authentification echoue avec erreur 401, un audit event `sso.auth_failed` severity "warning" est emis avec la raison

### AC11 — Disabled SSO config rejection
**Given** une config SSO avec enabled=false
**When** un utilisateur tente de s'authentifier via cette config
**Then** l'API retourne 403 avec message "SSO configuration is disabled" et un audit event `sso.auth_rejected` est emis

### AC12 — Unverified SSO config rejection
**Given** une config SSO avec status="draft" (non verified)
**When** un utilisateur tente de s'authentifier via cette config
**Then** l'API retourne 403 avec message "SSO configuration is not verified" et un audit event `sso.auth_rejected` est emis

### AC13 — OIDC state validation
**Given** un callback OIDC avec un state parameter qui ne correspond pas au state initial
**When** le callback est recu
**Then** l'authentification echoue avec 401 "Invalid SSO state" et un audit event `sso.auth_failed` est emis

### AC14 — SSO metadata sync
**Given** une config SSO SAML avec metadataUrl configure
**When** un admin appelle POST /companies/:companyId/sso/:configId/sync
**Then** le metadata est telecharge, le certificat et l'entityId sont mis a jour, lastSyncAt est rafraichi, et un audit event `sso.metadata_synced` est emis

### AC15 — Audit trail complet
**Given** toute action SSO (login, provisioning, linking, failure)
**When** l'action se produit
**Then** un audit event immutable est cree avec actorId, action, companyId, et metadata pertinente

---

## Deliverables

### D1 — SSO Auth Types
**Fichier** : `packages/shared/src/types/sso.ts` (extension)
**Types ajoutes** :
- `SsoLoginInitiation` : { provider, companyId, loginUrl, state? }
- `SsoDiscoverResult` : { provider: SsoProvider | null, companyId?: string, loginUrl?: string }
- `SsoAuthResult` : { userId, email, name, isNewUser, companyId, provider }
- `SsoSamlConfig` : { entityId, acsUrl, metadataUrl?, certificate?, signatureAlgorithm? }
- `SsoOidcConfig` : { clientId, clientSecret, discoveryUrl, redirectUri, scopes? }
- `SsoMetadataSyncResult` : { entityId, certificate, endpoints }

### D2 — SSO Auth Validators
**Fichier** : `packages/shared/src/validators/sso.ts` (extension)
**Schemas ajoutes** :
- `ssoDiscoverSchema` : { email: z.string().email() }
- `ssoSamlConfigSchema` : SAML-specific config fields validation
- `ssoOidcConfigSchema` : OIDC-specific config fields validation

### D3 — SSO Auth Service
**Fichier** : `server/src/services/sso-auth.ts`
**Fonctions** :
- `initiateSamlLogin(companyId)` : genere AuthnRequest, retourne redirect URL
- `handleSamlCallback(companyId, samlResponse)` : valide assertion, extrait user info
- `initiateOidcLogin(companyId)` : genere authorize URL avec state, retourne redirect URL
- `handleOidcCallback(companyId, code, state)` : echange code, extrait user info
- `provisionOrLinkUser(companyId, ssoUserInfo, provider)` : cree ou lie l'utilisateur
- `createSsoSession(userId)` : cree une session Better Auth et retourne le cookie
- `discoverSsoByEmail(email)` : trouve la config SSO par domaine email
- `syncMetadata(companyId, configId)` : telecharge et met a jour le metadata IdP

### D4 — SSO Auth Routes
**Fichier** : `server/src/routes/sso-auth.ts`
**Routes** :
| Methode | Path | Auth | Description |
|---------|------|------|-------------|
| POST | `/api/sso/discover` | public | Decouvrir le provider SSO par email |
| GET | `/api/sso/saml/:companyId/login` | public | Initier login SAML |
| POST | `/api/sso/saml/:companyId/acs` | public | SAML Assertion Consumer Service |
| GET | `/api/sso/oidc/:companyId/login` | public | Initier login OIDC |
| GET | `/api/sso/oidc/:companyId/callback` | public | OIDC authorization code callback |
| POST | `/companies/:companyId/sso/:configId/sync` | company:manage_sso | Sync metadata IdP |

### D5 — Barrel exports
- `packages/shared/src/types/sso.ts` : export SSO auth types
- `packages/shared/src/types/index.ts` : re-export SSO auth types
- `packages/shared/src/validators/sso.ts` : export SSO auth validators
- `packages/shared/src/validators/index.ts` : re-export SSO auth validators
- `packages/shared/src/index.ts` : re-export SSO auth types + validators
- `server/src/services/index.ts` : export ssoAuthService
- `server/src/routes/index.ts` : export ssoAuthRoutes
- `server/src/app.ts` : mount ssoAuthRoutes

---

## data-testid Mapping

| data-testid | Element | Localisation |
|------------|---------|-------------|
| `sso-s02-type-login-initiation` | SsoLoginInitiation type | types/sso.ts |
| `sso-s02-type-discover-result` | SsoDiscoverResult type | types/sso.ts |
| `sso-s02-type-auth-result` | SsoAuthResult type | types/sso.ts |
| `sso-s02-type-saml-config` | SsoSamlConfig type | types/sso.ts |
| `sso-s02-type-oidc-config` | SsoOidcConfig type | types/sso.ts |
| `sso-s02-type-metadata-sync` | SsoMetadataSyncResult type | types/sso.ts |
| `sso-s02-validator-discover` | ssoDiscoverSchema | validators/sso.ts |
| `sso-s02-validator-saml-config` | ssoSamlConfigSchema | validators/sso.ts |
| `sso-s02-validator-oidc-config` | ssoOidcConfigSchema | validators/sso.ts |
| `sso-s02-svc-initiate-saml` | initiateSamlLogin function | sso-auth.ts |
| `sso-s02-svc-handle-saml` | handleSamlCallback function | sso-auth.ts |
| `sso-s02-svc-initiate-oidc` | initiateOidcLogin function | sso-auth.ts |
| `sso-s02-svc-handle-oidc` | handleOidcCallback function | sso-auth.ts |
| `sso-s02-svc-provision-link` | provisionOrLinkUser function | sso-auth.ts |
| `sso-s02-svc-create-session` | createSsoSession function | sso-auth.ts |
| `sso-s02-svc-discover` | discoverSsoByEmail function | sso-auth.ts |
| `sso-s02-svc-sync-metadata` | syncMetadata function | sso-auth.ts |
| `sso-s02-route-discover` | POST /api/sso/discover | sso-auth.ts (route) |
| `sso-s02-route-saml-login` | GET /api/sso/saml/:companyId/login | sso-auth.ts (route) |
| `sso-s02-route-saml-acs` | POST /api/sso/saml/:companyId/acs | sso-auth.ts (route) |
| `sso-s02-route-oidc-login` | GET /api/sso/oidc/:companyId/login | sso-auth.ts (route) |
| `sso-s02-route-oidc-callback` | GET /api/sso/oidc/:companyId/callback | sso-auth.ts (route) |
| `sso-s02-route-sync` | POST .../sync | sso-auth.ts (route) |
| `sso-s02-audit-provisioned` | Audit event sso.user_provisioned | sso-auth.ts |
| `sso-s02-audit-linked` | Audit event sso.account_linked | sso-auth.ts |
| `sso-s02-audit-failed` | Audit event sso.auth_failed | sso-auth.ts |
| `sso-s02-audit-rejected` | Audit event sso.auth_rejected | sso-auth.ts |
| `sso-s02-audit-synced` | Audit event sso.metadata_synced | sso-auth.ts |
| `sso-s02-barrel-svc` | Service barrel export | services/index.ts |
| `sso-s02-barrel-route` | Route barrel export | routes/index.ts |
| `sso-s02-barrel-app` | App mount | app.ts |
| `sso-s02-barrel-types` | Types barrel export | types/index.ts |
| `sso-s02-barrel-validators` | Validators barrel export | validators/index.ts |
| `sso-s02-barrel-shared` | Shared index export | shared/src/index.ts |

---

## Test Cases (65 tests)

### Type Tests (T01-T06)
- T01: SsoLoginInitiation interface exists with provider, companyId, loginUrl fields
- T02: SsoDiscoverResult interface exists with provider (nullable), companyId, loginUrl fields
- T03: SsoAuthResult interface exists with userId, email, name, isNewUser, companyId, provider fields
- T04: SsoSamlConfig interface exists with entityId, acsUrl, metadataUrl, certificate fields
- T05: SsoOidcConfig interface exists with clientId, clientSecret, discoveryUrl, redirectUri, scopes fields
- T06: SsoMetadataSyncResult interface exists with entityId, certificate, endpoints fields

### Validator Tests (T07-T09)
- T07: ssoDiscoverSchema validates email field with z.string().email()
- T08: ssoSamlConfigSchema validates entityId, acsUrl as required fields
- T09: ssoOidcConfigSchema validates clientId, clientSecret, discoveryUrl as required fields

### Service Tests (T10-T23)
- T10: ssoAuthService function exists and is exported
- T11: initiateSamlLogin function exists, takes companyId param
- T12: initiateSamlLogin loads SSO config and verifies enabled+verified status
- T13: handleSamlCallback function exists, takes companyId and samlResponse params
- T14: handleSamlCallback validates SAML assertion signature against certificate
- T15: handleSamlCallback extracts email and name attributes from assertion
- T16: initiateOidcLogin function exists, takes companyId param
- T17: initiateOidcLogin generates random state for CSRF protection
- T18: handleOidcCallback function exists, takes companyId, code, state params
- T19: handleOidcCallback exchanges authorization code for tokens
- T20: handleOidcCallback extracts user info from id_token or userinfo endpoint
- T21: provisionOrLinkUser creates new user if email not found
- T22: provisionOrLinkUser links to existing user if email matches
- T23: provisionOrLinkUser creates company_membership with businessRole contributor

### Session Tests (T24-T26)
- T24: createSsoSession function exists and creates auth_sessions record
- T25: createSsoSession returns session token/cookie for client
- T26: SSO auth flow redirects to frontend after successful session creation

### Discovery Tests (T27-T30)
- T27: discoverSsoByEmail extracts domain from email
- T28: discoverSsoByEmail calls ssoConfigurationService.getByEmailDomain
- T29: discoverSsoByEmail returns provider info when config found
- T30: discoverSsoByEmail returns null provider when no config found

### Metadata Sync Tests (T31-T34)
- T31: syncMetadata function exists, takes companyId and configId params
- T32: syncMetadata updates certificate and entityId from metadata
- T33: syncMetadata sets lastSyncAt timestamp
- T34: syncMetadata sets lastSyncError on failure

### Route Tests (T35-T48)
- T35: POST /api/sso/discover route exists (public, no auth required)
- T36: POST /api/sso/discover returns SSO info for known email domain
- T37: POST /api/sso/discover returns null provider for unknown domain
- T38: GET /api/sso/saml/:companyId/login route exists (public)
- T39: GET /api/sso/saml/:companyId/login returns redirect to IdP
- T40: POST /api/sso/saml/:companyId/acs route exists (public)
- T41: POST /api/sso/saml/:companyId/acs handles assertion and creates session
- T42: GET /api/sso/oidc/:companyId/login route exists (public)
- T43: GET /api/sso/oidc/:companyId/login returns redirect to authorize endpoint
- T44: GET /api/sso/oidc/:companyId/callback route exists (public)
- T45: GET /api/sso/oidc/:companyId/callback exchanges code for tokens
- T46: POST /companies/:companyId/sso/:configId/sync requires company:manage_sso permission
- T47: POST .../sync updates metadata + emits audit
- T48: SSO routes emit appropriate audit events for all actions

### Error Handling Tests (T49-T55)
- T49: SAML with invalid signature returns 401
- T50: OIDC with invalid state returns 401
- T51: Disabled SSO config returns 403 with "SSO configuration is disabled"
- T52: Unverified SSO config returns 403 with "SSO configuration is not verified"
- T53: SSO auth failure emits audit event with severity "warning"
- T54: SAML ACS with missing SAMLResponse param returns 400
- T55: OIDC callback with missing code param returns 400

### Barrel Export Tests (T56-T65)
- T56: ssoAuthService exported from services/index.ts
- T57: ssoAuthRoutes exported from routes/index.ts
- T58: ssoAuthRoutes mounted in app.ts
- T59: SsoLoginInitiation exported from types/index.ts
- T60: SsoDiscoverResult exported from types/index.ts
- T61: SsoAuthResult exported from types/index.ts
- T62: ssoDiscoverSchema exported from validators/index.ts
- T63: SSO auth types exported from shared/src/index.ts
- T64: SSO auth validators exported from shared/src/index.ts
- T65: sso-auth route file imports emitAudit from audit-emitter

---

## Implementation Notes

### SAML Flow
1. User clicks "Login with SSO" → frontend calls POST /api/sso/discover with email
2. Frontend receives loginUrl → redirects to GET /api/sso/saml/:companyId/login
3. Server generates AuthnRequest XML with entityId + ACS URL → redirects to IdP
4. User authenticates at IdP → IdP POSTs SAML assertion to ACS endpoint
5. Server validates assertion signature, extracts attributes
6. Server provisions/links user, creates session, redirects to frontend

### OIDC Flow
1. User clicks "Login with SSO" → frontend calls POST /api/sso/discover with email
2. Frontend receives loginUrl → redirects to GET /api/sso/oidc/:companyId/login
3. Server generates authorize URL with state → redirects to IdP
4. User authenticates at IdP → IdP redirects to callback with code
5. Server exchanges code for tokens at token endpoint
6. Server extracts user info from id_token or userinfo endpoint
7. Server provisions/links user, creates session, redirects to frontend

### Security Considerations
- SAML: validate XML signature, check assertion conditions (audience, timestamps)
- OIDC: validate state parameter (CSRF), verify id_token signature, nonce validation
- Auto-provisioning: only for enabled+verified SSO configs
- Email matching: case-insensitive, trim whitespace
- Session: use Better Auth session creation for consistency
- SAML assertions stored temporarily in-memory (not DB), cleaned after processing
