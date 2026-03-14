/**
 * SSO-S01 — SSO Configuration Tables: schema enrichment, service CRUD, API routes
 *
 * File-content-based E2E tests verifying:
 * - Schema definition with enriched columns and indexes
 * - Migration SQL for new columns
 * - Types (SsoProvider, SsoConfigStatus, SsoConfiguration, inputs)
 * - Validators (createSsoConfigurationSchema, updateSsoConfigurationSchema)
 * - Service CRUD (list, get, create, update, delete, toggle, verify, getByDomain)
 * - API routes (7 routes with requirePermission + audit)
 * - Barrel exports across all packages
 *
 * 52 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/sso_configurations.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");
const MIGRATION_FILE = resolve(ROOT, "packages/db/src/migrations/0042_sso_s01_configuration_enrichment.sql");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/sso.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/sso.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SVC_FILE = resolve(ROOT, "server/src/services/sso-configurations.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/sso.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");

// ============================================================
// Schema: sso_configurations.ts (T01–T17)
// ============================================================

test.describe("SSO-S01 — Schema: sso_configurations", () => {
  // T01 — id column (uuid pk)
  test("T01 — id column is uuid primary key", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/id:\s*uuid\s*\(\s*["']id["']\s*\)\.primaryKey\(\)\.defaultRandom\(\)/);
  });

  // T02 — companyId column (FK to companies)
  test("T02 — companyId column with FK to companies", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("company_id");
    expect(src).toMatch(/companyId.*references\s*\(\s*\(\)\s*=>\s*companies\.id\s*\)/);
  });

  // T03 — provider column (text, not null)
  test("T03 — provider column is text notNull", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain('"provider"');
    expect(src).toMatch(/provider:\s*text\s*\(\s*["']provider["']\s*\)\.notNull\(\)/);
  });

  // T04 — displayName column (text, nullable)
  test("T04 — displayName column is text nullable", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("display_name");
    expect(src).toMatch(/displayName:\s*text\s*\(\s*["']display_name["']\s*\)/);
  });

  // T05 — config column (jsonb, not null, default {})
  test("T05 — config column is jsonb with default", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/config:\s*jsonb\s*\(\s*["']config["']\s*\)/);
    expect(src).toMatch(/\.notNull\(\)\.default\(\s*\{\s*\}\s*\)/);
  });

  // T06 — enabled column (boolean, default false)
  test("T06 — enabled column is boolean default false", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/enabled:\s*boolean\s*\(\s*["']enabled["']\s*\)\.notNull\(\)\.default\(false\)/);
  });

  // T07 — emailDomain column (text, nullable)
  test("T07 — emailDomain column exists", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("email_domain");
    expect(src).toMatch(/emailDomain:\s*text\s*\(\s*["']email_domain["']\s*\)/);
  });

  // T08 — metadataUrl column (text, nullable)
  test("T08 — metadataUrl column exists", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("metadata_url");
    expect(src).toMatch(/metadataUrl:\s*text\s*\(\s*["']metadata_url["']\s*\)/);
  });

  // T09 — entityId column (text, nullable)
  test("T09 — entityId column exists", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("entity_id");
    expect(src).toMatch(/entityId:\s*text\s*\(\s*["']entity_id["']\s*\)/);
  });

  // T10 — certificate column (text, nullable)
  test("T10 — certificate column exists", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("certificate");
    expect(src).toMatch(/certificate:\s*text\s*\(\s*["']certificate["']\s*\)/);
  });

  // T11 — status column (text, default "draft")
  test("T11 — status column with default 'draft'", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/status:\s*text\s*\(\s*["']status["']\s*\)\.notNull\(\)\.default\(\s*["']draft["']\s*\)/);
  });

  // T12 — verifiedAt column (timestamp, nullable)
  test("T12 — verifiedAt column is timestamp", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("verified_at");
    expect(src).toMatch(/verifiedAt:\s*timestamp\s*\(/);
  });

  // T13 — lastSyncAt column (timestamp, nullable)
  test("T13 — lastSyncAt column is timestamp", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("last_sync_at");
    expect(src).toMatch(/lastSyncAt:\s*timestamp\s*\(/);
  });

  // T14 — lastSyncError column (text, nullable)
  test("T14 — lastSyncError column is text", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("last_sync_error");
    expect(src).toMatch(/lastSyncError:\s*text\s*\(\s*["']last_sync_error["']\s*\)/);
  });

  // T15 — unique index on (companyId, provider)
  test("T15 — unique index on companyId + provider", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("sso_configurations_company_provider_unique_idx");
    expect(src).toMatch(/uniqueIndex\s*\(\s*["']sso_configurations_company_provider_unique_idx["']\s*\)/);
  });

  // T16 — index on (companyId, enabled)
  test("T16 — index on companyId + enabled", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("sso_configurations_company_enabled_idx");
  });

  // T17 — index on emailDomain
  test("T17 — index on emailDomain", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("sso_configurations_email_domain_idx");
    expect(src).toMatch(/emailDomainIdx.*index\s*\(\s*["']sso_configurations_email_domain_idx["']\s*\)/);
  });
});

// ============================================================
// Migration (T18–T19)
// ============================================================

test.describe("SSO-S01 — Migration", () => {
  // T18 — migration file exists
  test("T18 — migration file 0042_sso_s01 exists", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  // T19 — migration contains ALTER TABLE and CREATE INDEX
  test("T19 — migration has ALTER TABLE and CREATE INDEX", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toMatch(/ALTER\s+TABLE\s+["']?sso_configurations["']?\s+ADD\s+COLUMN/i);
    expect(src).toContain("email_domain");
    expect(src).toContain("metadata_url");
    expect(src).toContain("entity_id");
    expect(src).toContain("certificate");
    expect(src).toContain("status");
    expect(src).toContain("last_sync_at");
    expect(src).toContain("last_sync_error");
    expect(src).toMatch(/CREATE\s+INDEX.*sso_configurations_email_domain_idx/i);
  });
});

// ============================================================
// Types (T20–T25)
// ============================================================

test.describe("SSO-S01 — Types", () => {
  // T20 — SsoProvider type
  test("T20 — SsoProvider type with saml and oidc", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+SSO_PROVIDERS\s*=/);
    expect(src).toContain('"saml"');
    expect(src).toContain('"oidc"');
    expect(src).toMatch(/export\s+type\s+SsoProvider\s*=/);
  });

  // T21 — SsoConfigStatus type
  test("T21 — SsoConfigStatus type with draft, verified, error", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+SSO_CONFIG_STATUSES\s*=/);
    expect(src).toContain('"draft"');
    expect(src).toContain('"verified"');
    expect(src).toContain('"error"');
    expect(src).toMatch(/export\s+type\s+SsoConfigStatus\s*=/);
  });

  // T22 — SsoConfiguration interface with all fields
  test("T22 — SsoConfiguration interface has all fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+SsoConfiguration/);
    expect(src).toContain("companyId");
    expect(src).toContain("provider");
    expect(src).toContain("displayName");
    expect(src).toContain("config");
    expect(src).toContain("enabled");
    expect(src).toContain("emailDomain");
    expect(src).toContain("metadataUrl");
    expect(src).toContain("entityId");
    expect(src).toContain("certificate");
    expect(src).toContain("status");
    expect(src).toContain("verifiedAt");
    expect(src).toContain("lastSyncAt");
    expect(src).toContain("lastSyncError");
    expect(src).toContain("createdByUserId");
    expect(src).toContain("createdAt");
    expect(src).toContain("updatedAt");
  });

  // T23 — CreateSsoConfigurationInput interface
  test("T23 — CreateSsoConfigurationInput interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+CreateSsoConfigurationInput/);
    expect(src).toContain("provider");
    expect(src).toContain("displayName");
    expect(src).toContain("emailDomain");
  });

  // T24 — UpdateSsoConfigurationInput interface
  test("T24 — UpdateSsoConfigurationInput interface", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+UpdateSsoConfigurationInput/);
    expect(src).toContain("displayName");
    expect(src).toContain("config");
    expect(src).toContain("emailDomain");
  });

  // T25 — types exported from types/index.ts and shared/src/index.ts
  test("T25 — SSO types exported from barrel files", async () => {
    const typesIdx = await readFile(TYPES_INDEX, "utf-8");
    expect(typesIdx).toContain("SsoProvider");
    expect(typesIdx).toContain("SsoConfigStatus");
    expect(typesIdx).toContain("SsoConfiguration");
    expect(typesIdx).toContain("CreateSsoConfigurationInput");
    expect(typesIdx).toContain("UpdateSsoConfigurationInput");
    expect(typesIdx).toContain("SSO_PROVIDERS");
    expect(typesIdx).toContain("SSO_CONFIG_STATUSES");

    const sharedIdx = await readFile(SHARED_INDEX, "utf-8");
    expect(sharedIdx).toContain("SsoProvider");
    expect(sharedIdx).toContain("SsoConfiguration");
    expect(sharedIdx).toContain("SSO_PROVIDERS");
    expect(sharedIdx).toContain("SSO_CONFIG_STATUSES");
  });
});

// ============================================================
// Validators (T26–T28)
// ============================================================

test.describe("SSO-S01 — Validators", () => {
  // T26 — createSsoConfigurationSchema validates provider
  test("T26 — createSsoConfigurationSchema with provider enum", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+createSsoConfigurationSchema\s*=\s*z\.object/);
    expect(src).toContain("saml");
    expect(src).toContain("oidc");
    expect(src).toContain("provider");
    expect(src).toContain("displayName");
    expect(src).toContain("emailDomain");
    expect(src).toContain("metadataUrl");
    expect(src).toContain("entityId");
    expect(src).toContain("certificate");
  });

  // T27 — updateSsoConfigurationSchema makes all fields optional
  test("T27 — updateSsoConfigurationSchema with optional fields", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+updateSsoConfigurationSchema\s*=\s*z\.object/);
    // All fields should be optional in update schema
    const updateBlock = src.slice(src.indexOf("updateSsoConfigurationSchema"));
    expect(updateBlock).toContain(".optional()");
    expect(updateBlock).toContain("displayName");
    expect(updateBlock).toContain("config");
    expect(updateBlock).toContain("emailDomain");
  });

  // T28 — validators exported from validators/index.ts and shared/src/index.ts
  test("T28 — SSO validators exported from barrel files", async () => {
    const valIdx = await readFile(VAL_INDEX, "utf-8");
    expect(valIdx).toContain("createSsoConfigurationSchema");
    expect(valIdx).toContain("updateSsoConfigurationSchema");
    expect(valIdx).toContain("CreateSsoConfiguration");
    expect(valIdx).toContain("UpdateSsoConfiguration");

    const sharedIdx = await readFile(SHARED_INDEX, "utf-8");
    expect(sharedIdx).toContain("createSsoConfigurationSchema");
    expect(sharedIdx).toContain("updateSsoConfigurationSchema");
  });
});

// ============================================================
// Service (T29–T36)
// ============================================================

test.describe("SSO-S01 — Service: sso-configurations.ts", () => {
  // T29 — listConfigurations returns array sorted by createdAt desc
  test("T29 — listConfigurations function with desc ordering", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+listConfigurations\s*\(\s*companyId/);
    expect(src).toContain("desc(ssoConfigurations.createdAt)");
  });

  // T30 — getConfigurationById returns single config or throws notFound
  test("T30 — getConfigurationById with notFound throw", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getConfigurationById\s*\(\s*companyId.*configId/);
    expect(src).toContain("notFound");
    expect(src).toContain("SSO configuration not found");
  });

  // T31 — createConfiguration with unique provider check
  test("T31 — createConfiguration inserts with unique provider check", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+createConfiguration\s*\(/);
    expect(src).toContain("conflict");
    expect(src).toMatch(/SSO configuration for provider.*already exists/);
    expect(src).toContain(".insert(ssoConfigurations)");
  });

  // T32 — createConfiguration throws conflict on duplicate
  test("T32 — createConfiguration checks for existing provider before insert", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // Must query existing configs with same provider
    expect(src).toContain("eq(ssoConfigurations.provider, input.provider)");
    expect(src).toContain("existing.length > 0");
  });

  // T33 — updateConfiguration partial update with updatedAt
  test("T33 — updateConfiguration with updatedAt refresh", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+updateConfiguration\s*\(/);
    expect(src).toContain("updatedAt: new Date()");
    expect(src).toContain(".update(ssoConfigurations)");
  });

  // T34 — deleteConfiguration only if disabled
  test("T34 — deleteConfiguration throws if enabled", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+deleteConfiguration\s*\(/);
    expect(src).toContain("config.enabled");
    expect(src).toContain("Cannot delete an enabled SSO configuration");
    expect(src).toContain("badRequest");
  });

  // T35 — toggleEnabled inverts flag and syncs company
  test("T35 — toggleEnabled inverts enabled and syncs company.ssoEnabled", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+toggleEnabled\s*\(/);
    expect(src).toContain("!config.enabled");
    expect(src).toContain("syncCompanySsoEnabled");
  });

  // T36 — verifyConfiguration updates status
  test("T36 — verifyConfiguration sets status to verified", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+verifyConfiguration\s*\(/);
    expect(src).toContain('status: "verified"');
    expect(src).toContain("verifiedAt: new Date()");
  });
});

// ============================================================
// Routes (T37–T46)
// ============================================================

test.describe("SSO-S01 — Routes: sso.ts", () => {
  // T37 — GET /companies/:companyId/sso with requirePermission
  test("T37 — GET list route with company:manage_sso permission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso["']/);
    expect(src).toContain('requirePermission(db, "company:manage_sso")');
    expect(src).toContain("listConfigurations");
  });

  // T38 — GET /companies/:companyId/sso/:configId
  test("T38 — GET single config route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso\/:configId["']/);
    expect(src).toContain("getConfigurationById");
  });

  // T39 — POST /companies/:companyId/sso creates + emits audit
  test("T39 — POST create route with audit emission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso["']/);
    expect(src).toContain("createSsoConfigurationSchema");
    expect(src).toContain("createConfiguration");
    expect(src).toContain("sso.config_created");
    expect(src).toContain("res.status(201)");
  });

  // T40 — POST duplicate provider (conflict handled by service)
  test("T40 — create route delegates to service which checks duplicate", async () => {
    const svcSrc = await readFile(SVC_FILE, "utf-8");
    expect(svcSrc).toContain("conflict");
    expect(svcSrc).toMatch(/SSO configuration for provider.*already exists/);
  });

  // T41 — PUT /companies/:companyId/sso/:configId updates + emits audit
  test("T41 — PUT update route with audit emission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.put\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso\/:configId["']/);
    expect(src).toContain("updateSsoConfigurationSchema");
    expect(src).toContain("updateConfiguration");
    expect(src).toContain("sso.config_updated");
  });

  // T42 — DELETE disabled config succeeds + emits audit warning
  test("T42 — DELETE route with audit severity warning", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.delete\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso\/:configId["']/);
    expect(src).toContain("deleteConfiguration");
    expect(src).toContain("sso.config_deleted");
    expect(src).toContain('severity: "warning"');
  });

  // T43 — DELETE enabled config returns 400 (handled by service)
  test("T43 — delete enabled config throws badRequest in service", async () => {
    const svcSrc = await readFile(SVC_FILE, "utf-8");
    expect(svcSrc).toContain("Cannot delete an enabled SSO configuration");
    expect(svcSrc).toContain("badRequest");
  });

  // T44 — POST .../toggle inverts enabled + emits audit
  test("T44 — POST toggle route with audit emission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso\/:configId\/toggle["']/);
    expect(src).toContain("toggleEnabled");
    expect(src).toContain("sso.config_toggled");
  });

  // T45 — POST .../verify sets verified + emits audit
  test("T45 — POST verify route with audit emission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*\n?\s*["']\/companies\/:companyId\/sso\/:configId\/verify["']/);
    expect(src).toContain("verifyConfiguration");
    expect(src).toContain("sso.config_verified");
  });

  // T46 — all routes use requirePermission("company:manage_sso")
  test("T46 — all 7 routes use company:manage_sso permission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const matches = src.match(/requirePermission\s*\(\s*db\s*,\s*["']company:manage_sso["']\s*\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(7);
  });
});

// ============================================================
// Service Domain Tests (T47–T49)
// ============================================================

test.describe("SSO-S01 — Service Domain Logic", () => {
  // T47 — getByEmailDomain finds config by domain
  test("T47 — getByEmailDomain function exists", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getByEmailDomain\s*\(\s*emailDomain/);
    expect(src).toContain("eq(ssoConfigurations.emailDomain");
    expect(src).toContain("eq(ssoConfigurations.enabled, true)");
  });

  // T48 — getByEmailDomain returns null for unknown
  test("T48 — getByEmailDomain returns null when not found", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    // Should return null, not throw
    expect(src).toMatch(/return\s+row\s*\?\s*formatConfig\(row\)\s*:\s*null/);
  });

  // T49 — syncCompanySsoEnabled function exists
  test("T49 — syncCompanySsoEnabled syncs company.ssoEnabled flag", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+syncCompanySsoEnabled\s*\(\s*companyId/);
    expect(src).toContain("ssoEnabled");
    expect(src).toContain("enabledConfigs.length > 0");
    expect(src).toContain(".update(companies)");
  });
});

// ============================================================
// Barrel Export Tests (T50–T52)
// ============================================================

test.describe("SSO-S01 — Barrel Exports", () => {
  // T50 — ssoConfigurationService exported from services/index.ts
  test("T50 — ssoConfigurationService exported from services barrel", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toContain("ssoConfigurationService");
    expect(src).toContain("sso-configurations");
  });

  // T51 — ssoRoutes exported from routes/index.ts
  test("T51 — ssoRoutes exported from routes barrel", async () => {
    const src = await readFile(ROUTES_INDEX, "utf-8");
    expect(src).toContain("ssoRoutes");
    expect(src).toContain("./sso.js");
  });

  // T52 — ssoRoutes mounted in app.ts
  test("T52 — ssoRoutes mounted in app.ts", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toContain("ssoRoutes");
    expect(src).toMatch(/api\.use\s*\(\s*ssoRoutes\s*\(\s*db\s*\)\s*\)/);
  });
});
