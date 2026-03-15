/**
 * OBS-S01: Table audit_events — Service d'audit immutable + Routes API — E2E Tests
 *
 * These tests verify the deliverables of OBS-S01:
 *   - Groupe 1: File existence and barrel exports (T01-T09)
 *   - Groupe 2: Service functions (T10-T22)
 *   - Groupe 3: Routes (T23-T30)
 *   - Groupe 4: Permission enforcement (T31-T36)
 *   - Groupe 5: Types and constants (T37-T44)
 *   - Groupe 6: Validators (T45-T53)
 *   - Groupe 7: Migration SQL / Immutability (T54-T63)
 *   - Groupe 8: Hash chain (T64-T68)
 *   - Groupe 9: Export streams (T69-T75)
 *   - Groupe 10: Integration patterns (T76-T80)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SERVICE_FILE = resolve(ROOT, "server/src/services/audit.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/audit.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/audit.ts");
const VALIDATOR_FILE = resolve(ROOT, "packages/shared/src/validators/audit.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const VALIDATOR_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");

// ---------------------------------------------------------------------------
// Groupe 1: File existence and barrel exports (T01-T09)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence and barrel exports", () => {
  test("T01 — Service file exists and exports auditService", async () => {
    await expect(fsAccess(SERVICE_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+auditService\s*\(/);
  });

  test("T02 — Routes file exists and exports auditRoutes", async () => {
    await expect(fsAccess(ROUTES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+auditRoutes\s*\(/);
  });

  test("T03 — Types file exists and exports types", async () => {
    await expect(fsAccess(TYPES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toContain("AuditEventInput");
    expect(content).toContain("AuditEvent");
    expect(content).toContain("AUDIT_ACTOR_TYPES");
    expect(content).toContain("AUDIT_SEVERITY_LEVELS");
  });

  test("T04 — Validator file exists and exports schemas", async () => {
    await expect(
      fsAccess(VALIDATOR_FILE).then(() => true),
    ).resolves.toBe(true);
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    expect(content).toContain("auditEventFiltersSchema");
    expect(content).toContain("auditExportFiltersSchema");
    expect(content).toContain("auditVerifySchema");
  });

  test("T05 — Migration file for audit_events immutability exists", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFile = files.find(
      (f) =>
        f.endsWith(".sql") &&
        f.toLowerCase().includes("audit"),
    );
    expect(migrationFile).toBeDefined();
  });

  test("T06 — Service barrel export: server/src/services/index.ts contains auditService", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toContain("auditService");
    expect(content).toMatch(/from\s+["']\.\/audit/);
  });

  test("T07 — Routes barrel export: server/src/routes/index.ts contains auditRoutes", async () => {
    const content = await readFile(ROUTES_INDEX, "utf-8");
    expect(content).toContain("auditRoutes");
    expect(content).toMatch(/from\s+["']\.\/audit/);
  });

  test("T08 — Validator barrel export: packages/shared/src/validators/index.ts contains audit exports", async () => {
    const content = await readFile(VALIDATOR_INDEX, "utf-8");
    expect(content).toContain("auditEventFiltersSchema");
    expect(content).toMatch(/from\s+["']\.\/audit/);
  });

  test("T09 — Types barrel export: packages/shared/src/index.ts contains audit types", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    // Should re-export audit types (via ./types/index.js barrel)
    expect(content).toMatch(/audit/i);
    expect(content).toMatch(/from\s+["']\.\/types\/index/);
    // Should contain the audit type names
    expect(content).toContain("AuditEventInput");
    expect(content).toContain("AUDIT_ACTOR_TYPES");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Service functions (T10-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Service functions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T10 — emit function: inserts into auditEvents", () => {
    expect(content).toContain("emit");
    expect(content).toMatch(/db\s*[\n\s]*\.insert\(\s*auditEvents\s*\)/);
  });

  test("T11 — list function: returns paginated result with limit, offset, total", () => {
    expect(content).toContain("list");
    expect(content).toContain("limit");
    expect(content).toContain("offset");
    expect(content).toContain("total");
  });

  test("T12 — getById function: returns event or throws notFound", () => {
    expect(content).toContain("getById");
    expect(content).toMatch(/notFound\(\s*["']Audit event not found["']\s*\)/);
  });

  test("T13 — count function: returns a number using drizzle count", () => {
    expect(content).toContain("count");
    // Should use drizzle count operator
    expect(content).toMatch(/count\s*:\s*(drizzleCount|count)\(\)/);
  });

  test("T14 — exportCsv function: is an async generator", () => {
    expect(content).toContain("exportCsv");
    // Should be async function* or async generator
    expect(content).toMatch(/exportCsv\s*:\s*async\s+function\s*\*/);
  });

  test("T15 — exportJson function: is an async generator", () => {
    expect(content).toContain("exportJson");
    // Should be async function* or async generator
    expect(content).toMatch(/exportJson\s*:\s*async\s+function\s*\*/);
  });

  test("T16 — verifyChain function: returns AuditVerifyResult", () => {
    expect(content).toContain("verifyChain");
    expect(content).toContain("AuditVerifyResult");
  });

  test("T17 — computeHash function: uses createHash('sha256')", () => {
    expect(content).toContain("computeHash");
    expect(content).toMatch(/createHash\(\s*["']sha256["']\s*\)/);
  });

  test("T18 — buildConditions function: constructs Drizzle filters", () => {
    expect(content).toContain("buildConditions");
    // Should use Drizzle operators
    expect(content).toContain("eq(");
    expect(content).toContain("and(");
  });

  test("T19 — emit sanitizes metadata via sanitizeRecord()", () => {
    expect(content).toContain("sanitizeRecord");
    // sanitizeRecord should be called on metadata
    expect(content).toMatch(/sanitizeRecord\s*\(/);
  });

  test("T20 — emit publishes live event with type 'audit.event_created'", () => {
    expect(content).toContain("publishLiveEvent");
    expect(content).toContain('"audit.event_created"');
  });

  test("T21 — emit sets prevHash = null if no previous event", () => {
    // Should have logic for null prevHash when no previous event
    expect(content).toMatch(/prevHash.*null|null.*prevHash/s);
    // The logic: lastEvent ? computeHash(lastEvent) : null
    expect(content).toMatch(/\?\s*computeHash\s*\([^)]*\)\s*:\s*null/);
  });

  test("T22 — emit computes prevHash from last event of the company", () => {
    // Should query last event ordered by createdAt DESC LIMIT 1
    expect(content).toMatch(/orderBy\s*\(\s*desc\s*\(\s*auditEvents\.createdAt\s*\)/);
    expect(content).toMatch(/\.limit\(\s*1\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Routes (T23-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Routes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test('T23 — GET list route: /companies/:companyId/audit', () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit["']/,
    );
  });

  test('T24 — GET detail route: /companies/:companyId/audit/:id', () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit\/:id["']/,
    );
  });

  test('T25 — GET count route: /companies/:companyId/audit/count', () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit\/count["']/,
    );
  });

  test('T26 — GET export CSV route: /companies/:companyId/audit/export/csv', () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit\/export\/csv["']/,
    );
  });

  test('T27 — GET export JSON route: /companies/:companyId/audit/export/json', () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit\/export\/json["']/,
    );
  });

  test('T28 — GET verify route: /companies/:companyId/audit/verify', () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit\/verify["']/,
    );
  });

  test("T29 — Route order: /audit/count, /audit/export/*, /audit/verify declared BEFORE /audit/:id", () => {
    const countIdx = content.indexOf("/audit/count");
    const exportCsvIdx = content.indexOf("/audit/export/csv");
    const exportJsonIdx = content.indexOf("/audit/export/json");
    const verifyIdx = content.indexOf("/audit/verify");
    const detailIdx = content.indexOf("/audit/:id");

    expect(countIdx).toBeGreaterThan(-1);
    expect(exportCsvIdx).toBeGreaterThan(-1);
    expect(exportJsonIdx).toBeGreaterThan(-1);
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(detailIdx).toBeGreaterThan(-1);

    // All specific routes must appear before the parameterized :id route
    expect(countIdx).toBeLessThan(detailIdx);
    expect(exportCsvIdx).toBeLessThan(detailIdx);
    expect(exportJsonIdx).toBeLessThan(detailIdx);
    expect(verifyIdx).toBeLessThan(detailIdx);
  });

  test("T30 — Company access check: all routes call assertCompanyAccess()", () => {
    expect(content).toContain("assertCompanyAccess");
    // Should be called at least 6 times (one per route)
    const occurrences = (content.match(/assertCompanyAccess\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Permission enforcement (T31-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Permission enforcement", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test('T31 — GET /audit list uses requirePermission(db, "audit:read")', () => {
    // Find the list route (first /audit route without sub-path)
    const listMatch = content.match(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/audit["']\s*,\s*\n?\s*requirePermission\(\s*db\s*,\s*["']audit:read["']\s*\)/,
    );
    expect(listMatch).not.toBeNull();
  });

  test('T32 — GET /audit/:id uses requirePermission(db, "audit:read")', () => {
    const detailIdx = content.indexOf('"/companies/:companyId/audit/:id"');
    if (detailIdx === -1) {
      // Try single quotes
      const detailIdx2 = content.indexOf("'/companies/:companyId/audit/:id'");
      expect(detailIdx2).toBeGreaterThan(-1);
    }
    // Check the route block includes audit:read
    const routeBlock = content.slice(
      content.lastIndexOf("router.get(", content.indexOf("/audit/:id")),
      content.indexOf("/audit/:id") + 400,
    );
    expect(routeBlock).toContain('"audit:read"');
  });

  test('T33 — GET /audit/count uses requirePermission(db, "audit:read")', () => {
    const countIdx = content.indexOf("/audit/count");
    expect(countIdx).toBeGreaterThan(-1);
    const routeBlock = content.slice(
      content.lastIndexOf("router.get(", countIdx),
      countIdx + 200,
    );
    expect(routeBlock).toContain('"audit:read"');
  });

  test('T34 — GET /audit/export/csv uses requirePermission(db, "audit:export")', () => {
    const csvIdx = content.indexOf("/audit/export/csv");
    expect(csvIdx).toBeGreaterThan(-1);
    const routeBlock = content.slice(
      content.lastIndexOf("router.get(", csvIdx),
      csvIdx + 200,
    );
    expect(routeBlock).toContain('"audit:export"');
  });

  test('T35 — GET /audit/export/json uses requirePermission(db, "audit:export")', () => {
    const jsonIdx = content.indexOf("/audit/export/json");
    expect(jsonIdx).toBeGreaterThan(-1);
    const routeBlock = content.slice(
      content.lastIndexOf("router.get(", jsonIdx),
      jsonIdx + 200,
    );
    expect(routeBlock).toContain('"audit:export"');
  });

  test('T36 — GET /audit/verify uses requirePermission(db, "audit:read")', () => {
    const verifyIdx = content.indexOf("/audit/verify");
    expect(verifyIdx).toBeGreaterThan(-1);
    const routeBlock = content.slice(
      content.lastIndexOf("router.get(", verifyIdx),
      verifyIdx + 200,
    );
    expect(routeBlock).toContain('"audit:read"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Types and constants (T37-T44)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Types and constants", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test('T37 — AUDIT_ACTOR_TYPES contains ["user", "agent", "system"]', () => {
    expect(content).toContain("AUDIT_ACTOR_TYPES");
    expect(content).toContain('"user"');
    expect(content).toContain('"agent"');
    expect(content).toContain('"system"');
  });

  test('T38 — AUDIT_SEVERITY_LEVELS contains ["info", "warning", "error", "critical"]', () => {
    expect(content).toContain("AUDIT_SEVERITY_LEVELS");
    expect(content).toContain('"info"');
    expect(content).toContain('"warning"');
    expect(content).toContain('"error"');
    expect(content).toContain('"critical"');
  });

  test("T39 — AUDIT_TARGET_TYPES contains at least agent, project, workflow, company", () => {
    expect(content).toContain("AUDIT_TARGET_TYPES");
    expect(content).toContain('"agent"');
    expect(content).toContain('"project"');
    expect(content).toContain('"workflow"');
    expect(content).toContain('"company"');
  });

  test("T40 — AUDIT_ACTIONS contains at least members.invite, access.denied, agent.created", () => {
    expect(content).toContain("AUDIT_ACTIONS");
    expect(content).toContain('"members.invite"');
    expect(content).toContain('"access.denied"');
    expect(content).toContain('"agent.created"');
  });

  test("T41 — AuditEventInput interface: contains companyId, actorId, actorType, action, targetType, targetId", () => {
    expect(content).toContain("AuditEventInput");
    // Check for the key fields in the interface
    expect(content).toMatch(/interface\s+AuditEventInput/);
    expect(content).toMatch(/companyId\s*:\s*string/);
    expect(content).toMatch(/actorId\s*:\s*string/);
    expect(content).toMatch(/actorType\s*:/);
    expect(content).toMatch(/action\s*:\s*string/);
    expect(content).toMatch(/targetType\s*:\s*string/);
    expect(content).toMatch(/targetId\s*:\s*string/);
  });

  test("T42 — AuditEvent interface: contains all schema fields + prevHash", () => {
    expect(content).toMatch(/interface\s+AuditEvent/);
    expect(content).toContain("prevHash");
    expect(content).toContain("createdAt");
    expect(content).toContain("severity");
    expect(content).toContain("ipAddress");
    expect(content).toContain("metadata");
  });

  test("T43 — AuditListResult interface: contains data, total, limit, offset", () => {
    expect(content).toMatch(/interface\s+AuditListResult/);
    // Extract the AuditListResult block
    const listResultIdx = content.indexOf("AuditListResult");
    const listResultBlock = content.slice(listResultIdx, listResultIdx + 300);
    expect(listResultBlock).toContain("data");
    expect(listResultBlock).toContain("total");
    expect(listResultBlock).toContain("limit");
    expect(listResultBlock).toContain("offset");
  });

  test("T44 — AuditVerifyResult interface: contains valid, eventsChecked, firstEventId, lastEventId", () => {
    expect(content).toMatch(/interface\s+AuditVerifyResult/);
    const verifyIdx = content.indexOf("AuditVerifyResult");
    const verifyBlock = content.slice(verifyIdx, verifyIdx + 400);
    expect(verifyBlock).toContain("valid");
    expect(verifyBlock).toContain("eventsChecked");
    expect(verifyBlock).toContain("firstEventId");
    expect(verifyBlock).toContain("lastEventId");
    expect(verifyBlock).toContain("brokenAt");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Validators (T45-T53)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Validators", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T45 — auditEventFiltersSchema has 12 fields", () => {
    expect(content).toContain("auditEventFiltersSchema");
    // Extract the filters schema block
    const schemaIdx = content.indexOf("auditEventFiltersSchema");
    const schemaBlock = content.slice(schemaIdx, content.indexOf("}).strict()", schemaIdx) + 20);
    expect(schemaBlock).toContain("actorId");
    expect(schemaBlock).toContain("actorType");
    expect(schemaBlock).toContain("action");
    expect(schemaBlock).toContain("targetType");
    expect(schemaBlock).toContain("targetId");
    expect(schemaBlock).toContain("severity");
    expect(schemaBlock).toContain("dateFrom");
    expect(schemaBlock).toContain("dateTo");
    expect(schemaBlock).toContain("search");
    expect(schemaBlock).toContain("limit");
    expect(schemaBlock).toContain("offset");
    expect(schemaBlock).toContain("sortOrder");
  });

  test("T46 — auditExportFiltersSchema has 9 fields (no limit, offset, sortOrder)", () => {
    expect(content).toContain("auditExportFiltersSchema");
    const schemaIdx = content.indexOf("auditExportFiltersSchema");
    const nextSchemaIdx = content.indexOf("auditVerifySchema", schemaIdx);
    const schemaBlock = content.slice(schemaIdx, nextSchemaIdx > -1 ? nextSchemaIdx : schemaIdx + 600);
    expect(schemaBlock).toContain("actorId");
    expect(schemaBlock).toContain("dateFrom");
    expect(schemaBlock).toContain("dateTo");
    // Should NOT contain pagination fields as Zod schema property keys
    // (Note: "offset" appears in datetime({ offset: true }) which is fine —
    // so we match only lines starting with the field name followed by z.)
    expect(schemaBlock).not.toMatch(/^\s*limit\s*:/m);
    expect(schemaBlock).not.toMatch(/^\s*offset\s*:/m);
    expect(schemaBlock).not.toMatch(/^\s*sortOrder\s*:/m);
  });

  test("T47 — auditVerifySchema has 2 fields: dateFrom, dateTo", () => {
    expect(content).toContain("auditVerifySchema");
    const schemaIdx = content.indexOf("auditVerifySchema");
    const schemaBlock = content.slice(schemaIdx, schemaIdx + 300);
    expect(schemaBlock).toContain("dateFrom");
    expect(schemaBlock).toContain("dateTo");
  });

  test("T48 — limit default is 50", () => {
    expect(content).toMatch(/limit.*default\(\s*50\s*\)/);
  });

  test("T49 — limit max is 200", () => {
    expect(content).toMatch(/limit.*max\(\s*200\s*\)/);
  });

  test("T50 — offset default is 0", () => {
    expect(content).toMatch(/offset.*default\(\s*0\s*\)/);
  });

  test('T51 — sortOrder default is "desc"', () => {
    expect(content).toMatch(/sortOrder.*default\(\s*["']desc["']\s*\)/);
  });

  test("T52 — All schemas use .strict()", () => {
    const strictCount = (content.match(/\.strict\(\)/g) || []).length;
    expect(strictCount).toBeGreaterThanOrEqual(3);
  });

  test("T53 — dateFrom and dateTo use z.string().datetime()", () => {
    expect(content).toMatch(/dateFrom\s*:\s*z\.string\(\)\s*\.datetime\(/);
    expect(content).toMatch(/dateTo\s*:\s*z\.string\(\)\s*\.datetime\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Migration SQL / Immutability (T54-T63)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Migration SQL / Immutability", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFile = files.find(
      (f) =>
        f.endsWith(".sql") &&
        f.toLowerCase().includes("audit"),
    );
    if (!migrationFile) {
      throw new Error("No audit migration file found in " + MIGRATIONS_DIR);
    }
    migrationContent = await readFile(
      resolve(MIGRATIONS_DIR, migrationFile),
      "utf-8",
    );
  });

  test("T54 — Deny UPDATE trigger: CREATE TRIGGER audit_events_deny_update_trigger", () => {
    expect(migrationContent).toMatch(/CREATE\s+TRIGGER\s+audit_events_deny_update_trigger/i);
  });

  test("T55 — Deny DELETE trigger: CREATE TRIGGER audit_events_deny_delete_trigger", () => {
    expect(migrationContent).toMatch(/CREATE\s+TRIGGER\s+audit_events_deny_delete_trigger/i);
  });

  test("T56 — Deny UPDATE function: CREATE OR REPLACE FUNCTION audit_events_deny_update()", () => {
    expect(migrationContent).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+audit_events_deny_update\s*\(\s*\)/i,
    );
  });

  test("T57 — Deny DELETE function: CREATE OR REPLACE FUNCTION audit_events_deny_delete()", () => {
    expect(migrationContent).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+audit_events_deny_delete\s*\(\s*\)/i,
    );
  });

  test('T58 — UPDATE error message contains "audit_events: UPDATE is denied"', () => {
    expect(migrationContent).toContain("audit_events: UPDATE is denied");
  });

  test('T59 — DELETE error message contains "audit_events: DELETE is denied"', () => {
    expect(migrationContent).toContain("audit_events: DELETE is denied");
  });

  test("T60 — Triggers are BEFORE UPDATE and BEFORE DELETE", () => {
    expect(migrationContent).toMatch(/BEFORE\s+UPDATE\s+ON\s+audit_events/i);
    expect(migrationContent).toMatch(/BEFORE\s+DELETE\s+ON\s+audit_events/i);
  });

  test("T61 — Both triggers are FOR EACH ROW", () => {
    const forEachRowCount = (
      migrationContent.match(/FOR\s+EACH\s+ROW/gi) || []
    ).length;
    expect(forEachRowCount).toBeGreaterThanOrEqual(2);
  });

  test("T62 — Table comment: COMMENT ON TABLE audit_events", () => {
    expect(migrationContent).toMatch(/COMMENT\s+ON\s+TABLE\s+audit_events/i);
  });

  test('T63 — Retention mention: comment mentions "3 years" or "retention"', () => {
    // Case-insensitive search for retention-related terms
    expect(migrationContent).toMatch(/(3\s*year|retention|immutable)/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Hash chain (T64-T68)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Hash chain", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T64 — SHA-256 import: service imports createHash from node:crypto", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*createHash[^}]*\}\s+from\s+["']node:crypto["']/,
    );
  });

  test('T65 — Hash computation: computeHash uses createHash("sha256")', () => {
    expect(content).toContain("computeHash");
    expect(content).toMatch(/createHash\(\s*["']sha256["']\s*\)/);
  });

  test("T66 — Hash payload: hash computed on { id, action, targetType, targetId, createdAt }", () => {
    // Find the computeHash function and check its payload
    const hashIdx = content.indexOf("computeHash");
    expect(hashIdx).toBeGreaterThan(-1);
    const hashBlock = content.slice(hashIdx, hashIdx + 500);
    expect(hashBlock).toContain("id");
    expect(hashBlock).toContain("action");
    expect(hashBlock).toContain("targetType");
    expect(hashBlock).toContain("targetId");
    expect(hashBlock).toContain("createdAt");
  });

  test("T67 — JSON.stringify: hash uses JSON.stringify() before digest", () => {
    const hashIdx = content.indexOf("computeHash");
    const hashBlock = content.slice(hashIdx, hashIdx + 500);
    expect(hashBlock).toContain("JSON.stringify");
  });

  test('T68 — Hex output: hash returns in hex format', () => {
    const hashIdx = content.indexOf("computeHash");
    const hashBlock = content.slice(hashIdx, hashIdx + 500);
    expect(hashBlock).toMatch(/\.digest\(\s*["']hex["']\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Export streams (T69-T75)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Export streams", () => {
  let routesContent: string;
  let serviceContent: string;

  test.beforeAll(async () => {
    routesContent = await readFile(ROUTES_FILE, "utf-8");
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
  });

  test('T69 — CSV Content-Type: route sets Content-Type to text/csv', () => {
    const csvIdx = routesContent.indexOf("/audit/export/csv");
    expect(csvIdx).toBeGreaterThan(-1);
    const csvBlock = routesContent.slice(csvIdx, csvIdx + 600);
    expect(csvBlock).toMatch(/["']text\/csv["']/);
  });

  test('T70 — JSON Content-Type: route sets Content-Type to application/json', () => {
    const jsonIdx = routesContent.indexOf("/audit/export/json");
    expect(jsonIdx).toBeGreaterThan(-1);
    const jsonBlock = routesContent.slice(jsonIdx, jsonIdx + 600);
    expect(jsonBlock).toMatch(/["']application\/json["']/);
  });

  test("T71 — CSV Content-Disposition: route sets attachment filename", () => {
    const csvIdx = routesContent.indexOf("/audit/export/csv");
    expect(csvIdx).toBeGreaterThan(-1);
    const csvBlock = routesContent.slice(csvIdx, csvIdx + 600);
    expect(csvBlock).toContain("Content-Disposition");
    expect(csvBlock).toContain("attachment");
    expect(csvBlock).toContain("audit-export-");
  });

  test("T72 — JSON Content-Disposition: route sets attachment filename", () => {
    const jsonIdx = routesContent.indexOf("/audit/export/json");
    expect(jsonIdx).toBeGreaterThan(-1);
    const jsonBlock = routesContent.slice(jsonIdx, jsonIdx + 600);
    expect(jsonBlock).toContain("Content-Disposition");
    expect(jsonBlock).toContain("attachment");
    expect(jsonBlock).toContain("audit-export-");
  });

  test("T73 — CSV async generator: exportCsv is async function*", () => {
    expect(serviceContent).toMatch(/exportCsv\s*:\s*async\s+function\s*\*/);
  });

  test("T74 — JSON async generator: exportJson is async function*", () => {
    expect(serviceContent).toMatch(/exportJson\s*:\s*async\s+function\s*\*/);
  });

  test("T75 — CSV header: export includes CSV column header line", () => {
    // The CSV should have a header row with column names
    const exportIdx = serviceContent.indexOf("exportCsv");
    expect(exportIdx).toBeGreaterThan(-1);
    const exportBlock = serviceContent.slice(exportIdx, exportIdx + 1000);
    // Should contain column names like id, createdAt, actorId, etc.
    expect(exportBlock).toMatch(/(id|createdAt|actorId|action|severity)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Integration patterns (T76-T80)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Integration patterns", () => {
  let serviceContent: string;

  test.beforeAll(async () => {
    serviceContent = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T76 — Service uses Drizzle: db.select() and db.insert()", () => {
    expect(serviceContent).toMatch(/db\s*[\n\s]*\.select\(/);
    expect(serviceContent).toMatch(/db\s*[\n\s]*\.insert\(/);
  });

  test("T77 — notFound import: service imports notFound from errors", () => {
    expect(serviceContent).toMatch(
      /import\s+\{[^}]*notFound[^}]*\}\s+from\s+["']\.\.\/errors/,
    );
  });

  test("T78 — sanitizeRecord import: service imports sanitizeRecord from redaction", () => {
    expect(serviceContent).toMatch(
      /import\s+\{[^}]*sanitizeRecord[^}]*\}\s+from\s+["']\.\.\/redaction/,
    );
  });

  test("T79 — publishLiveEvent import: service imports publishLiveEvent from live-events", () => {
    expect(serviceContent).toMatch(
      /import\s+\{[^}]*publishLiveEvent[^}]*\}\s+from\s+["']\.\/live-events/,
    );
  });

  test("T80 — auditEvents import: service imports auditEvents from @mnm/db", () => {
    expect(serviceContent).toContain("auditEvents");
    expect(serviceContent).toMatch(/from\s+["']@mnm\/db["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Routes imports and patterns
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Routes imports and patterns", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("Routes imports Router from express", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*Router[^}]*\}\s+from\s+["']express["']/,
    );
  });

  test("Routes imports requirePermission", () => {
    expect(content).toContain("requirePermission");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/require-permission/);
  });

  test("Routes imports assertCompanyAccess from authz", () => {
    expect(content).toContain("assertCompanyAccess");
    expect(content).toMatch(/from\s+["']\.\/authz/);
  });

  test("Routes imports Zod schemas from @mnm/shared", () => {
    expect(content).toContain("auditEventFiltersSchema");
    expect(content).toContain("auditExportFiltersSchema");
    expect(content).toContain("auditVerifySchema");
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("Routes function accepts db parameter of type Db", () => {
    expect(content).toMatch(/auditRoutes\(\s*db\s*:\s*Db\s*\)/);
  });

  test("Routes creates auditService instance with db", () => {
    expect(content).toContain("auditService(db)");
  });

  test("Routes use for await...of for streaming exports", () => {
    expect(content).toMatch(/for\s+await\s*\(/);
    expect(content).toContain("res.write(");
    expect(content).toContain("res.end()");
  });

  test("At least 6 GET routes and only POST for OBS-S03 summary generate (no PUT, DELETE, PATCH)", () => {
    const getCount = (content.match(/router\.get\(/g) || []).length;
    expect(getCount).toBeGreaterThanOrEqual(6);

    // OBS-S03 added 1 POST route for summary/generate
    const postCount = (content.match(/router\.post\(/g) || []).length;
    expect(postCount).toBeLessThanOrEqual(1);

    // Should NOT have PUT, DELETE, PATCH
    expect(content).not.toMatch(/router\.put\(/);
    expect(content).not.toMatch(/router\.delete\(/);
    expect(content).not.toMatch(/router\.patch\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Service pattern and Drizzle operators
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Service pattern and Drizzle operators", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("Service function accepts db parameter of type Db", () => {
    expect(content).toMatch(/auditService\(\s*db\s*:\s*Db\s*\)/);
  });

  test("Service imports Drizzle operators (eq, and, gte, lte, desc, asc, ilike, or)", () => {
    expect(content).toMatch(/import\s+\{[^}]*eq[^}]*\}\s+from\s+["']drizzle-orm["']/);
    expect(content).toContain("and");
    expect(content).toContain("gte");
    expect(content).toContain("lte");
    expect(content).toContain("desc");
    expect(content).toContain("asc");
    expect(content).toContain("ilike");
    expect(content).toContain("or");
  });

  test("buildConditions handles all 9 filter types", () => {
    const buildIdx = content.indexOf("buildConditions");
    expect(buildIdx).toBeGreaterThan(-1);
    const buildBlock = content.slice(buildIdx, buildIdx + 1500);
    // Should check all filters
    expect(buildBlock).toContain("actorId");
    expect(buildBlock).toContain("actorType");
    expect(buildBlock).toContain("action");
    expect(buildBlock).toContain("targetType");
    expect(buildBlock).toContain("targetId");
    expect(buildBlock).toContain("severity");
    expect(buildBlock).toContain("dateFrom");
    expect(buildBlock).toContain("dateTo");
    expect(buildBlock).toContain("search");
  });

  test("Search filter uses ILIKE with % pattern on action, targetType, targetId", () => {
    expect(content).toContain("ilike(");
    // The search pattern should wrap with %
    expect(content).toMatch(/%\$\{.*search.*\}%|`%\$\{.*\}%`/);
  });

  test("List uses parallel queries for data and count (Promise.all)", () => {
    expect(content).toContain("Promise.all");
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: Schema verification (pre-existing from TECH-06)
// ---------------------------------------------------------------------------

test.describe("Groupe 13: Schema verification (TECH-06 prerequisite)", () => {
  let content: string;
  const SCHEMA_FILE = resolve(
    ROOT,
    "packages/db/src/schema/audit_events.ts",
  );

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_FILE, "utf-8");
  });

  test("Schema has prevHash column for hash chain", () => {
    expect(content).toContain('"prev_hash"');
  });

  test("Schema has severity column with default 'info'", () => {
    expect(content).toContain('"severity"');
    expect(content).toMatch(/default\(\s*["']info["']\s*\)/);
  });

  test("Schema has metadata jsonb column", () => {
    expect(content).toContain('"metadata"');
    expect(content).toContain("jsonb");
  });

  test("Schema has company_created_idx index on (companyId, createdAt)", () => {
    expect(content).toContain("audit_events_company_created_idx");
  });

  test("Schema has no updatedAt (append-only immutable table)", () => {
    expect(content).not.toContain("updated_at");
    expect(content).not.toContain("updatedAt");
  });

  test("Schema has ipAddress and userAgent columns", () => {
    expect(content).toContain('"ip_address"');
    expect(content).toContain('"user_agent"');
  });
});
