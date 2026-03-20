/**
 * SSO-S03 — UI Configuration SSO
 *
 * File-content-based E2E tests verifying:
 * - SSO API client (list, getById, create, update, delete, toggle, verify, sync)
 * - Query keys (sso.list, sso.detail)
 * - SsoConfig page structure (header, empty state, provider list, loading, error)
 * - SsoProviderCard component (name, type badge, status badge, toggle, domain, timestamps, actions)
 * - CreateSsoDialog (provider select, SAML fields, OIDC fields, submit/cancel)
 * - EditSsoDialog (pre-populated fields, submit/cancel)
 * - DeleteSsoDialog (message, confirm/cancel)
 * - Route + Sidebar integration (admin/sso, RequirePermission, sidebar nav item)
 * - Switch UI component
 * - Barrel exports
 *
 * 51 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_FILE = resolve(ROOT, "ui/src/api/sso.ts");
const API_INDEX = resolve(ROOT, "ui/src/api/index.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const PAGE_FILE = resolve(ROOT, "ui/src/pages/SsoConfig.tsx");
const CARD_FILE = resolve(ROOT, "ui/src/components/SsoProviderCard.tsx");
const CREATE_DIALOG = resolve(ROOT, "ui/src/components/CreateSsoDialog.tsx");
const EDIT_DIALOG = resolve(ROOT, "ui/src/components/EditSsoDialog.tsx");
const DELETE_DIALOG = resolve(ROOT, "ui/src/components/DeleteSsoDialog.tsx");
const SWITCH_FILE = resolve(ROOT, "ui/src/components/ui/switch.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");

// ============================================================
// API Client Tests (T01–T08)
// ============================================================

test.describe("SSO-S03 — API Client: ssoApi functions", () => {
  // T01 — ssoApi.list calls GET /companies/:companyId/sso
  test("T01 — ssoApi.list calls GET /companies/:companyId/sso", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-list");
    expect(src).toMatch(/list:\s*\(companyId/);
    expect(src).toContain("`/companies/${companyId}/sso`");
  });

  // T02 — ssoApi.getById calls GET /companies/:companyId/sso/:configId
  test("T02 — ssoApi.getById calls GET /companies/:companyId/sso/:configId", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-get");
    expect(src).toMatch(/getById:\s*\(companyId.*configId/);
    expect(src).toContain("`/companies/${companyId}/sso/${configId}`");
  });

  // T03 — ssoApi.create calls POST /companies/:companyId/sso
  test("T03 — ssoApi.create calls POST /companies/:companyId/sso", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-create");
    expect(src).toMatch(/create:\s*\(companyId.*body/);
    expect(src).toContain("api.post");
    expect(src).toContain("`/companies/${companyId}/sso`");
  });

  // T04 — ssoApi.update calls PUT /companies/:companyId/sso/:configId
  test("T04 — ssoApi.update calls PUT /companies/:companyId/sso/:configId", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-update");
    expect(src).toMatch(/update:\s*\(companyId.*configId.*body/);
    expect(src).toContain("api.put");
  });

  // T05 — ssoApi.delete calls DELETE /companies/:companyId/sso/:configId
  test("T05 — ssoApi.delete calls DELETE /companies/:companyId/sso/:configId", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-delete");
    expect(src).toMatch(/delete:\s*\(companyId.*configId/);
    expect(src).toContain("api.delete");
  });

  // T06 — ssoApi.toggle calls POST /companies/:companyId/sso/:configId/toggle
  test("T06 — ssoApi.toggle calls POST /companies/:companyId/sso/:configId/toggle", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-toggle");
    expect(src).toMatch(/toggle:\s*\(companyId.*configId/);
    expect(src).toContain("/toggle");
  });

  // T07 — ssoApi.verify calls POST /companies/:companyId/sso/:configId/verify
  test("T07 — ssoApi.verify calls POST /companies/:companyId/sso/:configId/verify", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-verify");
    expect(src).toMatch(/verify:\s*\(companyId.*configId/);
    expect(src).toContain("/verify");
  });

  // T08 — ssoApi.sync calls POST /companies/:companyId/sso/:configId/sync
  test("T08 — ssoApi.sync calls POST /companies/:companyId/sso/:configId/sync", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toContain("sso-s03-api-sync");
    expect(src).toMatch(/sync:\s*\(companyId.*configId/);
    expect(src).toContain("/sync");
  });
});

// ============================================================
// Query Keys Tests (T09–T10)
// ============================================================

test.describe("SSO-S03 — Query Keys: sso namespace", () => {
  // T09 — queryKeys.sso.list returns correct key array
  test("T09 — queryKeys.sso.list returns correct key array with companyId", async () => {
    const src = await readFile(QUERY_KEYS, "utf-8");
    expect(src).toContain("SSO-S03");
    expect(src).toMatch(/sso:\s*\{/);
    expect(src).toMatch(/list:\s*\(companyId:\s*string\)/);
    expect(src).toMatch(/\["sso",\s*companyId,\s*"list"\]/);
  });

  // T10 — queryKeys.sso.detail returns correct key array
  test("T10 — queryKeys.sso.detail returns correct key array with configId", async () => {
    const src = await readFile(QUERY_KEYS, "utf-8");
    expect(src).toMatch(/detail:\s*\(companyId:\s*string,\s*configId:\s*string\)/);
    expect(src).toMatch(/\["sso",\s*companyId,\s*"detail",\s*configId\]/);
  });
});

// ============================================================
// Page Structure Tests (T11–T19)
// ============================================================

test.describe("SSO-S03 — Page: SsoConfig structure", () => {
  // T11 — page container has data-testid="sso-s03-page"
  test("T11 — page container has data-testid sso-s03-page", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-page"');
  });

  // T12 — page title "SSO Configuration" has data-testid="sso-s03-title"
  test("T12 — page title has data-testid sso-s03-title with SSO Configuration text", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-title"');
    expect(src).toContain("SSO Configuration");
  });

  // T13 — "Add SSO Provider" button has data-testid="sso-s03-btn-add"
  test("T13 — Add SSO Provider button has data-testid sso-s03-btn-add", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-btn-add"');
    expect(src).toContain("Add SSO Provider");
  });

  // T14 — loading state has data-testid="sso-s03-loading"
  test("T14 — loading state has data-testid sso-s03-loading with PageSkeleton", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-loading"');
    expect(src).toContain("PageSkeleton");
  });

  // T15 — error state has data-testid="sso-s03-error"
  test("T15 — error state has data-testid sso-s03-error", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-error"');
    expect(src).toContain("Failed to load SSO configurations");
  });

  // T16 — empty state has data-testid="sso-s03-empty-state"
  test("T16 — empty state container has data-testid sso-s03-empty-state", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-empty-state"');
  });

  // T17 — empty state title has data-testid="sso-s03-empty-title"
  test("T17 — empty state title has data-testid sso-s03-empty-title with correct text", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-empty-title"');
    expect(src).toContain("No SSO providers configured");
  });

  // T18 — empty state description has data-testid="sso-s03-empty-description"
  test("T18 — empty state description has data-testid sso-s03-empty-description", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-empty-description"');
    expect(src).toContain("SAML 2.0 or OpenID Connect");
  });

  // T19 — provider count badge has data-testid="sso-s03-provider-count"
  test("T19 — provider count badge has data-testid sso-s03-provider-count", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-count"');
    expect(src).toMatch(/configurations\.length/);
  });
});

// ============================================================
// Provider Card Tests (T20–T30)
// ============================================================

test.describe("SSO-S03 — Component: SsoProviderCard", () => {
  // T20 — provider card has data-testid="sso-s03-provider-card"
  test("T20 — provider card has data-testid sso-s03-provider-card", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-card"');
  });

  // T21 — provider name has data-testid="sso-s03-provider-name"
  test("T21 — provider name span has data-testid sso-s03-provider-name", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-name"');
    expect(src).toMatch(/config\.displayName/);
  });

  // T22 — provider type badge has data-testid="sso-s03-provider-type"
  test("T22 — provider type badge has data-testid sso-s03-provider-type", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-type"');
    expect(src).toMatch(/config\.provider\.toUpperCase\(\)/);
  });

  // T23 — provider status badge has data-testid="sso-s03-provider-status"
  test("T23 — provider status badge has data-testid sso-s03-provider-status with status variant", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-status"');
    expect(src).toMatch(/statusVariant\(config\.status\)/);
    expect(src).toMatch(/statusLabel\(config\.status\)/);
  });

  // T24 — provider enabled switch has data-testid="sso-s03-provider-enabled"
  test("T24 — provider enabled Switch has data-testid sso-s03-provider-enabled", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-enabled"');
    expect(src).toContain("Switch");
    expect(src).toMatch(/checked=\{config\.enabled\}/);
  });

  // T25 — provider domain has data-testid="sso-s03-provider-domain"
  test("T25 — provider domain span has data-testid sso-s03-provider-domain", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-domain"');
    expect(src).toMatch(/config\.emailDomain/);
  });

  // T26 — provider verified-at has data-testid="sso-s03-provider-verified-at"
  test("T26 — provider verified-at span has data-testid sso-s03-provider-verified-at", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-verified-at"');
    expect(src).toMatch(/config\.verifiedAt/);
  });

  // T27 — provider last-sync has data-testid="sso-s03-provider-last-sync"
  test("T27 — provider last-sync span has data-testid sso-s03-provider-last-sync", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-last-sync"');
    expect(src).toMatch(/config\.lastSyncAt/);
  });

  // T28 — provider sync error has data-testid="sso-s03-provider-sync-error"
  test("T28 — provider sync error has data-testid sso-s03-provider-sync-error", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-provider-sync-error"');
    expect(src).toMatch(/config\.lastSyncError/);
  });

  // T29 — edit button has data-testid="sso-s03-btn-edit"
  test("T29 — edit button has data-testid sso-s03-btn-edit", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-btn-edit"');
    expect(src).toContain("onEdit");
  });

  // T30 — verify, sync, delete buttons have correct data-testid
  test("T30 — verify, sync, delete buttons have correct data-testid values", async () => {
    const src = await readFile(CARD_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-btn-verify"');
    expect(src).toContain('data-testid="sso-s03-btn-sync"');
    expect(src).toContain('data-testid="sso-s03-btn-delete"');
  });
});

// ============================================================
// Create Dialog Tests (T31–T38)
// ============================================================

test.describe("SSO-S03 — Component: CreateSsoDialog", () => {
  // T31 — create dialog has data-testid="sso-s03-create-dialog"
  test("T31 — create dialog has data-testid sso-s03-create-dialog", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-dialog"');
  });

  // T32 — create dialog title has data-testid="sso-s03-create-title"
  test("T32 — create dialog title has data-testid sso-s03-create-title with Add SSO Provider text", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-title"');
    expect(src).toContain("Add SSO Provider");
  });

  // T33 — provider type select has data-testid="sso-s03-create-provider-select"
  test("T33 — provider type select has data-testid sso-s03-create-provider-select with SAML and OIDC options", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-provider-select"');
    expect(src).toContain('value="saml"');
    expect(src).toContain('value="oidc"');
    expect(src).toContain("SAML 2.0");
    expect(src).toContain("OIDC (OpenID Connect)");
  });

  // T34 — display name input has data-testid="sso-s03-create-display-name"
  test("T34 — display name input has data-testid sso-s03-create-display-name", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-display-name"');
  });

  // T35 — email domain input has data-testid="sso-s03-create-email-domain"
  test("T35 — email domain input has data-testid sso-s03-create-email-domain", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-email-domain"');
  });

  // T36 — SAML-specific fields have correct data-testid values
  test("T36 — SAML fields (metadata-url, entity-id, certificate) have correct data-testid", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-metadata-url"');
    expect(src).toContain('data-testid="sso-s03-create-entity-id"');
    expect(src).toContain('data-testid="sso-s03-create-certificate"');
    // Verify they're inside the SAML conditional
    expect(src).toMatch(/provider\s*===\s*["']saml["']/);
  });

  // T37 — OIDC-specific fields have correct data-testid values
  test("T37 — OIDC fields (client-id, client-secret, discovery-url) have correct data-testid", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-client-id"');
    expect(src).toContain('data-testid="sso-s03-create-client-secret"');
    expect(src).toContain('data-testid="sso-s03-create-discovery-url"');
    // Verify they're inside the OIDC conditional
    expect(src).toMatch(/provider\s*===\s*["']oidc["']/);
  });

  // T38 — submit and cancel buttons have correct data-testid
  test("T38 — submit and cancel buttons have correct data-testid values", async () => {
    const src = await readFile(CREATE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-create-btn-submit"');
    expect(src).toContain('data-testid="sso-s03-create-btn-cancel"');
    expect(src).toContain("Create Provider");
  });
});

// ============================================================
// Edit Dialog Tests (T39–T43)
// ============================================================

test.describe("SSO-S03 — Component: EditSsoDialog", () => {
  // T39 — edit dialog has data-testid="sso-s03-edit-dialog"
  test("T39 — edit dialog has data-testid sso-s03-edit-dialog", async () => {
    const src = await readFile(EDIT_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-edit-dialog"');
  });

  // T40 — edit dialog title has data-testid="sso-s03-edit-title"
  test("T40 — edit dialog title has data-testid sso-s03-edit-title with Edit SSO Provider text", async () => {
    const src = await readFile(EDIT_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-edit-title"');
    expect(src).toContain("Edit SSO Provider");
  });

  // T41 — edit fields present with correct data-testid
  test("T41 — edit fields (display-name, email-domain, metadata-url, entity-id, certificate) present", async () => {
    const src = await readFile(EDIT_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-edit-display-name"');
    expect(src).toContain('data-testid="sso-s03-edit-email-domain"');
    expect(src).toContain('data-testid="sso-s03-edit-metadata-url"');
    expect(src).toContain('data-testid="sso-s03-edit-entity-id"');
    expect(src).toContain('data-testid="sso-s03-edit-certificate"');
  });

  // T42 — edit submit and cancel buttons have correct data-testid
  test("T42 — edit submit and cancel buttons have correct data-testid", async () => {
    const src = await readFile(EDIT_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-edit-btn-submit"');
    expect(src).toContain('data-testid="sso-s03-edit-btn-cancel"');
    expect(src).toContain("Save Changes");
  });

  // T43 — edit dialog pre-populates with existing config values
  test("T43 — edit dialog pre-populates state from config props using useEffect", async () => {
    const src = await readFile(EDIT_DIALOG, "utf-8");
    expect(src).toContain("useEffect");
    expect(src).toMatch(/setDisplayName\(config\.displayName/);
    expect(src).toMatch(/setEmailDomain\(config\.emailDomain/);
    expect(src).toMatch(/setMetadataUrl\(config\.metadataUrl/);
    expect(src).toMatch(/setEntityId\(config\.entityId/);
    expect(src).toMatch(/setCertificate\(config\.certificate/);
  });
});

// ============================================================
// Delete Dialog Tests (T44–T47)
// ============================================================

test.describe("SSO-S03 — Component: DeleteSsoDialog", () => {
  // T44 — delete dialog has data-testid="sso-s03-delete-dialog"
  test("T44 — delete dialog has data-testid sso-s03-delete-dialog", async () => {
    const src = await readFile(DELETE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-delete-dialog"');
  });

  // T45 — delete title has data-testid="sso-s03-delete-title"
  test("T45 — delete title has data-testid sso-s03-delete-title with Delete SSO Provider text", async () => {
    const src = await readFile(DELETE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-delete-title"');
    expect(src).toContain("Delete SSO Provider");
  });

  // T46 — delete message has data-testid="sso-s03-delete-message"
  test("T46 — delete message has data-testid sso-s03-delete-message with enabled/disabled logic", async () => {
    const src = await readFile(DELETE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-delete-message"');
    expect(src).toContain("config.enabled");
    expect(src).toContain("must disable it before deleting");
    expect(src).toContain("cannot be undone");
  });

  // T47 — delete confirm and cancel buttons have correct data-testid
  test("T47 — delete confirm and cancel buttons have correct data-testid with destructive variant", async () => {
    const src = await readFile(DELETE_DIALOG, "utf-8");
    expect(src).toContain('data-testid="sso-s03-delete-btn-confirm"');
    expect(src).toContain('data-testid="sso-s03-delete-btn-cancel"');
    expect(src).toContain('variant="destructive"');
    // Confirm button is disabled when enabled
    expect(src).toMatch(/disabled=\{config\.enabled/);
  });
});

// ============================================================
// Route + Sidebar Integration Tests (T48–T51)
// ============================================================

test.describe("SSO-S03 — Integration: route + sidebar", () => {
  // T48 — route admin/sso registered in App.tsx with RequirePermission "company:manage_sso"
  test("T48 — route admin/sso registered with RequirePermission company:manage_sso", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toContain("SsoConfig");
    expect(src).toMatch(/path="admin\/sso"/);
    expect(src).toMatch(/RequirePermission.*permission="company:manage_sso".*SsoConfig/s);
  });

  // T49 — sidebar SSO nav item has data-testid="sso-s03-nav-sso" with KeyRound icon
  test("T49 — sidebar SSO nav item has data-testid sso-s03-nav-sso with KeyRound icon", async () => {
    const src = await readFile(SIDEBAR_FILE, "utf-8");
    expect(src).toContain('data-testid="sso-s03-nav-sso"');
    expect(src).toContain("KeyRound");
    expect(src).toMatch(/to="\/admin\/sso"/);
    expect(src).toMatch(/label="SSO"/);
  });

  // T50 — sidebar SSO nav item permission-gated by company:manage_sso
  test("T50 — sidebar SSO nav item permission-gated by canViewSso", async () => {
    const src = await readFile(SIDEBAR_FILE, "utf-8");
    expect(src).toMatch(/canViewSso\s*=\s*hasPermission\("company:manage_sso"\)/);
    expect(src).toMatch(/\{canViewSso\s*&&/);
  });

  // T51 — ssoApi exported from api/index.ts barrel
  test("T51 — ssoApi exported from api/index.ts barrel", async () => {
    const src = await readFile(API_INDEX, "utf-8");
    expect(src).toContain("ssoApi");
    expect(src).toMatch(/export\s*\{.*ssoApi.*\}\s*from\s*["']\.\/sso["']/);
  });
});
