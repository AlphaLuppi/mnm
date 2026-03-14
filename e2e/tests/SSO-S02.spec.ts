/**
 * SSO-S02 — Better Auth SAML/OIDC Integration
 *
 * File-content-based E2E tests verifying:
 * - SSO auth types (SsoLoginInitiation, SsoDiscoverResult, SsoAuthResult, etc.)
 * - SSO auth validators (ssoDiscoverSchema, ssoSamlConfigSchema, ssoOidcConfigSchema)
 * - SSO auth service (initiateSamlLogin, handleSamlCallback, initiateOidcLogin, etc.)
 * - SSO auth routes (discover, saml login/acs, oidc login/callback, sync)
 * - Error handling (invalid signature, invalid state, disabled config, unverified config)
 * - Barrel exports across all packages
 *
 * 65 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/sso.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/sso.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SVC_FILE = resolve(ROOT, "server/src/services/sso-auth.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/sso-auth.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");

// ============================================================
// Type Tests (T01–T06)
// ============================================================

test.describe("SSO-S02 — Types: SSO auth types", () => {
  // T01 — SsoLoginInitiation interface
  test("T01 — SsoLoginInitiation interface exists with provider, companyId, loginUrl fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("sso-s02-type-login-initiation");
    expect(src).toMatch(/export\s+interface\s+SsoLoginInitiation/);
    expect(src).toMatch(/provider:\s*SsoProvider/);
    expect(src).toMatch(/companyId:\s*string/);
    expect(src).toMatch(/loginUrl:\s*string/);
  });

  // T02 — SsoDiscoverResult interface
  test("T02 — SsoDiscoverResult interface exists with provider (nullable), companyId, loginUrl", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("sso-s02-type-discover-result");
    expect(src).toMatch(/export\s+interface\s+SsoDiscoverResult/);
    expect(src).toMatch(/provider:\s*SsoProvider\s*\|\s*null/);
    expect(src).toMatch(/companyId\?:\s*string/);
    expect(src).toMatch(/loginUrl\?:\s*string/);
  });

  // T03 — SsoAuthResult interface
  test("T03 — SsoAuthResult interface exists with userId, email, name, isNewUser, companyId, provider", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("sso-s02-type-auth-result");
    expect(src).toMatch(/export\s+interface\s+SsoAuthResult/);
    expect(src).toMatch(/userId:\s*string/);
    expect(src).toMatch(/email:\s*string/);
    expect(src).toMatch(/isNewUser:\s*boolean/);
  });

  // T04 — SsoSamlConfig interface
  test("T04 — SsoSamlConfig interface exists with entityId, acsUrl, metadataUrl, certificate", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("sso-s02-type-saml-config");
    expect(src).toMatch(/export\s+interface\s+SsoSamlConfig/);
    expect(src).toMatch(/entityId:\s*string/);
    expect(src).toMatch(/acsUrl:\s*string/);
    expect(src).toMatch(/metadataUrl\?:\s*string/);
    expect(src).toMatch(/certificate\?:\s*string/);
  });

  // T05 — SsoOidcConfig interface
  test("T05 — SsoOidcConfig interface exists with clientId, clientSecret, discoveryUrl, redirectUri, scopes", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("sso-s02-type-oidc-config");
    expect(src).toMatch(/export\s+interface\s+SsoOidcConfig/);
    expect(src).toMatch(/clientId:\s*string/);
    expect(src).toMatch(/clientSecret:\s*string/);
    expect(src).toMatch(/discoveryUrl:\s*string/);
    expect(src).toMatch(/redirectUri:\s*string/);
    expect(src).toMatch(/scopes\?:\s*string\[\]/);
  });

  // T06 — SsoMetadataSyncResult interface
  test("T06 — SsoMetadataSyncResult interface exists with entityId, certificate, endpoints", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("sso-s02-type-metadata-sync");
    expect(src).toMatch(/export\s+interface\s+SsoMetadataSyncResult/);
    expect(src).toMatch(/entityId:\s*string\s*\|\s*null/);
    expect(src).toMatch(/certificate:\s*string\s*\|\s*null/);
    expect(src).toMatch(/endpoints:\s*Record<string,\s*string>/);
  });
});

// ============================================================
// Validator Tests (T07–T09)
// ============================================================

test.describe("SSO-S02 — Validators: SSO auth validators", () => {
  // T07 — ssoDiscoverSchema validates email
  test("T07 — ssoDiscoverSchema validates email field with z.string().email()", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toContain("sso-s02-validator-discover");
    expect(src).toMatch(/export\s+const\s+ssoDiscoverSchema\s*=/);
    expect(src).toMatch(/email:\s*z\.string\(\)\.email\(\)/);
  });

  // T08 — ssoSamlConfigSchema validates entityId, acsUrl
  test("T08 — ssoSamlConfigSchema validates entityId, acsUrl as required fields", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toContain("sso-s02-validator-saml-config");
    expect(src).toMatch(/export\s+const\s+ssoSamlConfigSchema\s*=/);
    expect(src).toMatch(/entityId:\s*z\.string\(\)/);
    expect(src).toMatch(/acsUrl:\s*z\.string\(\)\.url\(\)/);
  });

  // T09 — ssoOidcConfigSchema validates clientId, clientSecret, discoveryUrl
  test("T09 — ssoOidcConfigSchema validates clientId, clientSecret, discoveryUrl as required fields", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toContain("sso-s02-validator-oidc-config");
    expect(src).toMatch(/export\s+const\s+ssoOidcConfigSchema\s*=/);
    expect(src).toMatch(/clientId:\s*z\.string\(\)/);
    expect(src).toMatch(/clientSecret:\s*z\.string\(\)/);
    expect(src).toMatch(/discoveryUrl:\s*z\.string\(\)\.url\(\)/);
  });
});

// ============================================================
// Service Tests (T10–T23)
// ============================================================

test.describe("SSO-S02 — Service: ssoAuthService", () => {
  // T10 — ssoAuthService function exists and is exported
  test("T10 — ssoAuthService function exists and is exported", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+ssoAuthService\s*\(\s*db:\s*Db\s*\)/);
  });

  // T11 — initiateSamlLogin function exists
  test("T11 — initiateSamlLogin function exists, takes companyId param", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-initiate-saml");
    expect(src).toMatch(/async\s+function\s+initiateSamlLogin\s*\(\s*companyId:\s*string\s*\)/);
  });

  // T12 — initiateSamlLogin validates config enabled+verified
  test("T12 — initiateSamlLogin loads SSO config and verifies enabled+verified status", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/validateConfigReady\s*\(\s*companyId\s*,\s*["']saml["']\s*\)/);
  });

  // T13 — handleSamlCallback function exists
  test("T13 — handleSamlCallback function exists, takes companyId and samlResponse params", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-handle-saml");
    expect(src).toMatch(/async\s+function\s+handleSamlCallback\s*\(/);
    expect(src).toMatch(/companyId:\s*string/);
    expect(src).toMatch(/samlResponse:\s*string/);
  });

  // T14 — handleSamlCallback validates SAML assertion signature
  test("T14 — handleSamlCallback validates SAML assertion signature against certificate", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/config\.certificate/);
    expect(src).toMatch(/Signature|SignatureValue/);
  });

  // T15 — handleSamlCallback extracts email and name
  test("T15 — handleSamlCallback extracts email and name attributes from assertion", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // Regex to find NameID/emailAddress extraction
    expect(src).toMatch(/NameID|emailAddress/);
    expect(src).toMatch(/displayName|name|givenName/);
  });

  // T16 — initiateOidcLogin function exists
  test("T16 — initiateOidcLogin function exists, takes companyId param", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-initiate-oidc");
    expect(src).toMatch(/async\s+function\s+initiateOidcLogin\s*\(\s*companyId:\s*string\s*\)/);
  });

  // T17 — initiateOidcLogin generates random state
  test("T17 — initiateOidcLogin generates random state for CSRF protection", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // Look for crypto.randomBytes in initiateOidcLogin context
    const oidcLoginSection = src.slice(src.indexOf("initiateOidcLogin"), src.indexOf("handleOidcCallback"));
    expect(oidcLoginSection).toMatch(/crypto\.randomBytes/);
    expect(oidcLoginSection).toMatch(/state/);
  });

  // T18 — handleOidcCallback function exists
  test("T18 — handleOidcCallback function exists, takes companyId, code, state params", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-handle-oidc");
    expect(src).toMatch(/async\s+function\s+handleOidcCallback\s*\(/);
    expect(src).toMatch(/code:\s*string/);
    expect(src).toMatch(/state:\s*string/);
  });

  // T19 — handleOidcCallback exchanges authorization code
  test("T19 — handleOidcCallback exchanges authorization code for tokens", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const callbackSection = src.slice(src.indexOf("handleOidcCallback"));
    expect(callbackSection).toMatch(/grant_type.*authorization_code/);
    expect(callbackSection).toMatch(/fetch\s*\(\s*tokenUrl/);
  });

  // T20 — handleOidcCallback extracts user info from id_token
  test("T20 — handleOidcCallback extracts user info from id_token or userinfo endpoint", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const callbackSection = src.slice(src.indexOf("handleOidcCallback"));
    expect(callbackSection).toMatch(/id_token/);
    expect(callbackSection).toMatch(/userinfoUrl|userinfo/);
  });

  // T21 — provisionOrLinkUser creates new user
  test("T21 — provisionOrLinkUser creates new user if email not found", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-provision-link");
    expect(src).toMatch(/async\s+function\s+provisionOrLinkUser/);
    // Checks for insert into authUsers for new user
    expect(src).toMatch(/db\.insert\(authUsers\)/);
    expect(src).toMatch(/isNewUser\s*=\s*true/);
  });

  // T22 — provisionOrLinkUser links to existing user
  test("T22 — provisionOrLinkUser links to existing user if email matches", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // Check for existing user lookup
    expect(src).toMatch(/existingUser/);
    // Check for SSO account link creation
    expect(src).toMatch(/db\.insert\(authAccounts\)/);
    expect(src).toMatch(/sso-.*provider/);
  });

  // T23 — provisionOrLinkUser creates company_membership
  test("T23 — provisionOrLinkUser creates company_membership with businessRole contributor", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/db\.insert\(companyMemberships\)/);
    expect(src).toMatch(/businessRole.*contributor/);
  });
});

// ============================================================
// Session Tests (T24–T26)
// ============================================================

test.describe("SSO-S02 — Session: SSO session creation", () => {
  // T24 — createSsoSession function exists
  test("T24 — createSsoSession function exists and creates auth_sessions record", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-create-session");
    expect(src).toMatch(/async\s+function\s+createSsoSession/);
    expect(src).toMatch(/db\.insert\(authSessions\)/);
  });

  // T25 — createSsoSession returns session token
  test("T25 — createSsoSession returns session token/cookie for client", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const sessionSection = src.slice(src.indexOf("createSsoSession"));
    expect(sessionSection).toMatch(/sessionId/);
    expect(sessionSection).toMatch(/token/);
    expect(sessionSection).toMatch(/expiresAt/);
  });

  // T26 — SSO auth flow redirects to frontend
  test("T26 — SSO auth flow redirects to frontend after successful session creation", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // Both SAML ACS and OIDC callback redirect to /
    expect(src).toMatch(/res\.redirect\(302,\s*["']\/["']\)/);
  });
});

// ============================================================
// Discovery Tests (T27–T30)
// ============================================================

test.describe("SSO-S02 — Discovery: email domain detection", () => {
  // T27 — discoverSsoByEmail extracts domain
  test("T27 — discoverSsoByEmail extracts domain from email", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-discover");
    expect(src).toMatch(/async\s+function\s+discoverSsoByEmail/);
    expect(src).toMatch(/email\.split\(["']@["']\)/);
  });

  // T28 — discoverSsoByEmail calls getByEmailDomain
  test("T28 — discoverSsoByEmail calls ssoConfigurationService.getByEmailDomain", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/configService\.getByEmailDomain\s*\(\s*domain\s*\)/);
  });

  // T29 — discoverSsoByEmail returns provider info when found
  test("T29 — discoverSsoByEmail returns provider info when config found", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const discoverSection = src.slice(src.indexOf("discoverSsoByEmail"));
    expect(discoverSection).toMatch(/provider:\s*config\.provider/);
    expect(discoverSection).toMatch(/companyId:\s*config\.companyId/);
    expect(discoverSection).toMatch(/loginUrl/);
  });

  // T30 — discoverSsoByEmail returns null provider when not found
  test("T30 — discoverSsoByEmail returns null provider when no config found", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/provider:\s*null/);
  });
});

// ============================================================
// Metadata Sync Tests (T31–T34)
// ============================================================

test.describe("SSO-S02 — Metadata Sync: IdP metadata sync", () => {
  // T31 — syncMetadata function exists
  test("T31 — syncMetadata function exists, takes companyId and configId params", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("sso-s02-svc-sync-metadata");
    expect(src).toMatch(/async\s+function\s+syncMetadata\s*\(/);
    expect(src).toMatch(/companyId:\s*string/);
    expect(src).toMatch(/configId:\s*string/);
  });

  // T32 — syncMetadata updates certificate and entityId
  test("T32 — syncMetadata updates certificate and entityId from metadata", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const syncSection = src.slice(src.indexOf("syncMetadata"));
    expect(syncSection).toMatch(/extractedEntityId/);
    expect(syncSection).toMatch(/extractedCertificate/);
    expect(syncSection).toMatch(/X509Certificate/);
    expect(syncSection).toMatch(/entityID/);
  });

  // T33 — syncMetadata sets lastSyncAt
  test("T33 — syncMetadata sets lastSyncAt timestamp", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const syncSection = src.slice(src.indexOf("syncMetadata"));
    expect(syncSection).toMatch(/lastSyncAt:\s*new\s+Date\(\)/);
  });

  // T34 — syncMetadata sets lastSyncError on failure
  test("T34 — syncMetadata sets lastSyncError on failure", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    const syncSection = src.slice(src.indexOf("syncMetadata"));
    expect(syncSection).toMatch(/lastSyncError/);
    expect(syncSection).toMatch(/Metadata fetch failed/);
  });
});

// ============================================================
// Route Tests (T35–T48)
// ============================================================

test.describe("SSO-S02 — Routes: SSO auth routes", () => {
  // T35 — POST /sso/discover route exists (public)
  test("T35 — POST /api/sso/discover route exists (public, no auth required)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-route-discover");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/sso\/discover["']/);
  });

  // T36 — POST /sso/discover returns SSO info for known domain
  test("T36 — POST /api/sso/discover calls discoverSsoByEmail and returns result", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoAuth\.discoverSsoByEmail/);
    expect(src).toMatch(/res\.json\(\s*result\s*\)/);
  });

  // T37 — POST /sso/discover validates email with ssoDiscoverSchema
  test("T37 — POST /api/sso/discover validates body with ssoDiscoverSchema", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoDiscoverSchema\.safeParse\s*\(\s*req\.body\s*\)/);
  });

  // T38 — GET /sso/saml/:companyId/login route exists
  test("T38 — GET /api/sso/saml/:companyId/login route exists (public)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-route-saml-login");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/sso\/saml\/:companyId\/login["']/);
  });

  // T39 — GET /sso/saml/:companyId/login returns redirect
  test("T39 — GET /api/sso/saml/:companyId/login redirects to IdP", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoAuth\.initiateSamlLogin/);
    expect(src).toMatch(/res\.redirect\s*\(\s*302/);
  });

  // T40 — POST /sso/saml/:companyId/acs route exists
  test("T40 — POST /api/sso/saml/:companyId/acs route exists (public)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-route-saml-acs");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/sso\/saml\/:companyId\/acs["']/);
  });

  // T41 — POST /sso/saml/:companyId/acs handles assertion and creates session
  test("T41 — POST /api/sso/saml/:companyId/acs handles assertion and creates session", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoAuth\.handleSamlCallback/);
    expect(src).toMatch(/ssoAuth\.createSsoSession/);
    expect(src).toMatch(/better-auth\.session_token/);
  });

  // T42 — GET /sso/oidc/:companyId/login route exists
  test("T42 — GET /api/sso/oidc/:companyId/login route exists (public)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-route-oidc-login");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/sso\/oidc\/:companyId\/login["']/);
  });

  // T43 — GET /sso/oidc/:companyId/login returns redirect
  test("T43 — GET /api/sso/oidc/:companyId/login redirects to authorize endpoint", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoAuth\.initiateOidcLogin/);
  });

  // T44 — GET /sso/oidc/:companyId/callback route exists
  test("T44 — GET /api/sso/oidc/:companyId/callback route exists (public)", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-route-oidc-callback");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/sso\/oidc\/:companyId\/callback["']/);
  });

  // T45 — GET /sso/oidc/:companyId/callback exchanges code
  test("T45 — GET /api/sso/oidc/:companyId/callback exchanges code for tokens", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoAuth\.handleOidcCallback/);
    expect(src).toMatch(/req\.query\.code/);
    expect(src).toMatch(/req\.query\.state/);
  });

  // T46 — POST /companies/:companyId/sso/:configId/sync requires permission
  test("T46 — POST .../sync requires company:manage_sso permission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-route-sync");
    expect(src).toMatch(/router\.post\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso\/:configId\/sync["']/);
    expect(src).toMatch(/requirePermission\s*\(\s*db\s*,\s*["']company:manage_sso["']\s*\)/);
  });

  // T47 — POST .../sync updates metadata + emits audit
  test("T47 — POST .../sync calls syncMetadata and emits audit", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/ssoAuth\.syncMetadata/);
    expect(src).toContain("sso-s02-audit-synced");
    expect(src).toMatch(/sso\.metadata_synced/);
  });

  // T48 — SSO routes emit appropriate audit events
  test("T48 — SSO routes emit appropriate audit events for all actions", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("sso-s02-audit-provisioned");
    expect(src).toContain("sso-s02-audit-linked");
    expect(src).toContain("sso-s02-audit-failed");
    expect(src).toContain("sso-s02-audit-rejected");
    expect(src).toContain("sso-s02-audit-synced");
    expect(src).toMatch(/sso\.user_provisioned/);
    expect(src).toMatch(/sso\.account_linked/);
    expect(src).toMatch(/sso\.auth_failed/);
    expect(src).toMatch(/sso\.auth_rejected/);
    expect(src).toMatch(/sso\.metadata_synced/);
  });
});

// ============================================================
// Error Handling Tests (T49–T55)
// ============================================================

test.describe("SSO-S02 — Error Handling: auth failures", () => {
  // T49 — SAML with invalid signature returns 401
  test("T49 — SAML with invalid signature triggers unauthorized error", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/SAML assertion signature validation failed/);
    expect(src).toMatch(/unauthorized/);
  });

  // T50 — OIDC with invalid state returns 401
  test("T50 — OIDC with invalid state triggers unauthorized error", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/Invalid SSO state/);
    expect(src).toMatch(/unauthorized.*Invalid SSO state|unauthorized\s*\(\s*["']Invalid SSO state["']\s*\)/);
  });

  // T51 — Disabled SSO config returns 403
  test("T51 — Disabled SSO config returns 403 with 'SSO configuration is disabled'", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/SSO configuration is disabled/);
    expect(src).toMatch(/forbidden/);
  });

  // T52 — Unverified SSO config returns 403
  test("T52 — Unverified SSO config returns 403 with 'SSO configuration is not verified'", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/SSO configuration is not verified/);
    expect(src).toMatch(/forbidden/);
  });

  // T53 — SSO auth failure emits audit with severity warning
  test("T53 — SSO auth failure emits audit event with severity 'warning'", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/sso\.auth_failed/);
    expect(src).toMatch(/["']warning["']/);
  });

  // T54 — SAML ACS with missing SAMLResponse returns 400
  test("T54 — SAML ACS with missing SAMLResponse param returns 400", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/Missing SAMLResponse parameter/);
    expect(src).toMatch(/badRequest/);
  });

  // T55 — OIDC callback with missing code returns 400
  test("T55 — OIDC callback with missing code param returns 400", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/Missing code parameter/);
    expect(src).toMatch(/badRequest/);
  });
});

// ============================================================
// Barrel Export Tests (T56–T65)
// ============================================================

test.describe("SSO-S02 — Barrel Exports", () => {
  // T56 — ssoAuthService exported from services/index.ts
  test("T56 — ssoAuthService exported from services/index.ts", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toContain("sso-s02-barrel-svc");
    expect(src).toMatch(/export\s*\{[^}]*ssoAuthService[^}]*\}\s*from\s*["']\.\/sso-auth/);
  });

  // T57 — ssoAuthRoutes exported from routes/index.ts
  test("T57 — ssoAuthRoutes exported from routes/index.ts", async () => {
    const src = await readFile(ROUTES_INDEX, "utf-8");
    expect(src).toContain("sso-s02-barrel-route");
    expect(src).toMatch(/export\s*\{[^}]*ssoAuthRoutes[^}]*\}\s*from\s*["']\.\/sso-auth/);
  });

  // T58 — ssoAuthRoutes mounted in app.ts
  test("T58 — ssoAuthRoutes mounted in app.ts", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toContain("sso-s02-barrel-app");
    expect(src).toMatch(/ssoAuthRoutes\s*\(\s*db\s*\)/);
  });

  // T59 — SsoLoginInitiation exported from types/index.ts
  test("T59 — SsoLoginInitiation exported from types/index.ts", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("sso-s02-barrel-types");
    expect(src).toContain("SsoLoginInitiation");
  });

  // T60 — SsoDiscoverResult exported from types/index.ts
  test("T60 — SsoDiscoverResult exported from types/index.ts", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("SsoDiscoverResult");
  });

  // T61 — SsoAuthResult exported from types/index.ts
  test("T61 — SsoAuthResult exported from types/index.ts", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("SsoAuthResult");
  });

  // T62 — ssoDiscoverSchema exported from validators/index.ts
  test("T62 — ssoDiscoverSchema exported from validators/index.ts", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("sso-s02-barrel-validators");
    expect(src).toContain("ssoDiscoverSchema");
  });

  // T63 — SSO auth types exported from shared/src/index.ts
  test("T63 — SSO auth types exported from shared/src/index.ts", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("sso-s02-barrel-shared");
    expect(src).toContain("SsoLoginInitiation");
    expect(src).toContain("SsoDiscoverResult");
    expect(src).toContain("SsoAuthResult");
    expect(src).toContain("SsoSamlConfig");
    expect(src).toContain("SsoOidcConfig");
    expect(src).toContain("SsoMetadataSyncResult");
  });

  // T64 — SSO auth validators exported from shared/src/index.ts
  test("T64 — SSO auth validators exported from shared/src/index.ts", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("sso-s02-barrel-validators-shared");
    expect(src).toContain("ssoDiscoverSchema");
    expect(src).toContain("ssoSamlConfigSchema");
    expect(src).toContain("ssoOidcConfigSchema");
  });

  // T65 — sso-auth route file imports emitAudit
  test("T65 — sso-auth route file imports emitAudit from audit-emitter", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*emitAudit[^}]*\}\s*from\s*["']\.\.\/services\/audit-emitter/);
  });
});
