/**
 * DRIFT-S01: Drift Persistance DB -- Migration In-Memory vers PostgreSQL -- E2E Tests
 *
 * These tests verify the deliverables of DRIFT-S01:
 *   - Groupe 1: Schema drift_reports (T01-T05)
 *   - Groupe 2: Schema drift_items (T06-T10)
 *   - Groupe 3: Barrel exports (T11-T13)
 *   - Groupe 4: Service drift-persistence.ts (T14-T22)
 *   - Groupe 5: Refactoring drift.ts (T23-T28)
 *   - Groupe 6: Routes drift.ts (T29-T34)
 *   - Groupe 7: Types partages (T35-T40)
 *   - Groupe 8: Audit + Transaction (T41-T45)
 *   - Groupe 9: Migration (T46-T48)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCHEMA_REPORTS_FILE = resolve(ROOT, "packages/db/src/schema/drift_reports.ts");
const SCHEMA_ITEMS_FILE = resolve(ROOT, "packages/db/src/schema/drift_items.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");
const SERVICE_PERSISTENCE_FILE = resolve(ROOT, "server/src/services/drift-persistence.ts");
const SERVICE_DRIFT_FILE = resolve(ROOT, "server/src/services/drift.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/drift.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/drift.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");

// ---------------------------------------------------------------------------
// Groupe 1: Schema drift_reports (T01-T05)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Schema drift_reports", () => {
  test("T01 -- Schema drift_reports exists and exports driftReports", async () => {
    await expect(fsAccess(SCHEMA_REPORTS_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SCHEMA_REPORTS_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+driftReports\s*=\s*pgTable/);
  });

  test("T02 -- 13 columns in drift_reports", async () => {
    const content = await readFile(SCHEMA_REPORTS_FILE, "utf-8");
    // Verify all 13 columns are present
    const columns = [
      "id", "company_id", "project_id", "source_doc", "target_doc",
      "drift_count", "scan_scope", "status", "error_message",
      "checked_at", "created_at", "updated_at", "deleted_at",
    ];
    for (const col of columns) {
      expect(content, `Column "${col}" should exist`).toContain(`"${col}"`);
    }
  });

  test("T03 -- FK companyId vers companies", async () => {
    const content = await readFile(SCHEMA_REPORTS_FILE, "utf-8");
    expect(content).toMatch(/references\s*\(\s*\(\)\s*=>\s*companies\.id\s*\)/);
  });

  test("T04 -- FK projectId vers projects", async () => {
    const content = await readFile(SCHEMA_REPORTS_FILE, "utf-8");
    expect(content).toMatch(/references\s*\(\s*\(\)\s*=>\s*projects\.id\s*\)/);
  });

  test("T05 -- 3 indexes on drift_reports", async () => {
    const content = await readFile(SCHEMA_REPORTS_FILE, "utf-8");
    expect(content).toContain("drift_reports_company_project_idx");
    expect(content).toContain("drift_reports_company_checked_idx");
    expect(content).toContain("drift_reports_project_status_idx");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Schema drift_items (T06-T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Schema drift_items", () => {
  test("T06 -- Schema drift_items exists and exports driftItems", async () => {
    await expect(fsAccess(SCHEMA_ITEMS_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SCHEMA_ITEMS_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+driftItems\s*=\s*pgTable/);
  });

  test("T07 -- 18 columns in drift_items", async () => {
    const content = await readFile(SCHEMA_ITEMS_FILE, "utf-8");
    const columns = [
      "id", "company_id", "report_id", "severity", "drift_type",
      "confidence", "description", "recommendation", "source_excerpt",
      "target_excerpt", "source_doc", "target_doc", "decision",
      "decided_at", "decided_by", "remediation_note",
      "created_at", "updated_at",
    ];
    for (const col of columns) {
      expect(content, `Column "${col}" should exist`).toContain(`"${col}"`);
    }
  });

  test("T08 -- FK reportId with onDelete cascade", async () => {
    const content = await readFile(SCHEMA_ITEMS_FILE, "utf-8");
    expect(content).toMatch(/references\s*\(\s*\(\)\s*=>\s*driftReports\.id\s*,\s*\{\s*onDelete\s*:\s*"cascade"\s*\}/);
  });

  test("T09 -- FK companyId vers companies", async () => {
    const content = await readFile(SCHEMA_ITEMS_FILE, "utf-8");
    expect(content).toMatch(/references\s*\(\s*\(\)\s*=>\s*companies\.id\s*\)/);
  });

  test("T10 -- 4 indexes on drift_items", async () => {
    const content = await readFile(SCHEMA_ITEMS_FILE, "utf-8");
    expect(content).toContain("drift_items_report_idx");
    expect(content).toContain("drift_items_company_severity_idx");
    expect(content).toContain("drift_items_company_decision_idx");
    expect(content).toContain("drift_items_company_report_severity_idx");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Barrel exports (T11-T13)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Barrel exports", () => {
  test("T11 -- driftReports exported in schema/index.ts", async () => {
    const content = await readFile(SCHEMA_INDEX, "utf-8");
    expect(content).toContain("driftReports");
    expect(content).toContain("drift_reports");
  });

  test("T12 -- driftItems exported in schema/index.ts", async () => {
    const content = await readFile(SCHEMA_INDEX, "utf-8");
    expect(content).toContain("driftItems");
    expect(content).toContain("drift_items");
  });

  test("T13 -- driftPersistenceService exported in services/index.ts", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toContain("driftPersistenceService");
    expect(content).toMatch(/export\s*\{[^}]*driftPersistenceService[^}]*\}\s*from/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Service drift-persistence.ts (T14-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Service drift-persistence.ts", () => {
  test("T14 -- File drift-persistence.ts exists", async () => {
    await expect(
      fsAccess(SERVICE_PERSISTENCE_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("T15 -- Function createReport present", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+createReport\s*\(/);
  });

  test("T16 -- Function getReportById present with (companyId, reportId)", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+getReportById\s*\(\s*companyId\s*:\s*string\s*,\s*reportId\s*:\s*string\s*\)/);
  });

  test("T17 -- Function listReports present with DriftReportFilters", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+listReports\s*\(\s*filters\s*:\s*DriftReportFilters\s*\)/);
  });

  test("T18 -- Function countReports present with DriftReportFilters", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+countReports\s*\(\s*filters\s*:\s*DriftReportFilters\s*\)/);
  });

  test("T19 -- Function getItemById present with (companyId, itemId)", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+getItemById\s*\(\s*companyId\s*:\s*string\s*,\s*itemId\s*:\s*string\s*\)/);
  });

  test("T20 -- Function resolveItem present with (companyId, itemId, ...)", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+resolveItem\s*\(\s*\n?\s*companyId\s*:\s*string/);
  });

  test("T21 -- Function listItems present with DriftItemFilters", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+listItems\s*\(\s*filters\s*:\s*DriftItemFilters\s*\)/);
  });

  test("T22 -- Function getScanStatus present with (companyId, projectId)", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    expect(content).toMatch(/async\s+getScanStatus\s*\(\s*companyId\s*:\s*string\s*,\s*projectId\s*:\s*string\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Refactoring drift.ts (T23-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Refactoring drift.ts", () => {
  test("T23 -- reportCache removed (no Map<string, DriftReport[]>)", async () => {
    const content = await readFile(SERVICE_DRIFT_FILE, "utf-8");
    expect(content).not.toMatch(/new\s+Map\s*<\s*string\s*,\s*DriftReport\s*\[\s*\]\s*>/);
    expect(content).not.toContain("reportCache");
  });

  test("T24 -- scanStatusMap removed (renamed to activeScanStatus for process-state only)", async () => {
    const content = await readFile(SERVICE_DRIFT_FILE, "utf-8");
    // The original scanStatusMap (used as a data store) must be gone
    expect(content).not.toContain("scanStatusMap");
    // activeScanStatus is acceptable — it tracks in-progress process state, not persisted data
    // (same category as scanAbortMap which the spec explicitly allows in-memory)
    expect(content).toContain("activeScanStatus");
  });

  test("T25 -- cacheReport function removed", async () => {
    const content = await readFile(SERVICE_DRIFT_FILE, "utf-8");
    expect(content).not.toContain("cacheReport");
  });

  test("T26 -- checkDrift accepts db and companyId", async () => {
    const content = await readFile(SERVICE_DRIFT_FILE, "utf-8");
    expect(content).toMatch(/export\s+async\s+function\s+checkDrift\s*\(\s*\n?\s*db\s*:\s*Db/);
    expect(content).toMatch(/checkDrift\s*\([^)]*companyId\s*:\s*string/);
  });

  test("T27 -- getDriftResults uses the persistence service (listReports)", async () => {
    const content = await readFile(SERVICE_DRIFT_FILE, "utf-8");
    // Should call the persistence service, not use a Map
    expect(content).toMatch(/getDriftResults[\s\S]*?listReports/);
    // Should import or use driftPersistenceService
    expect(content).toContain("driftPersistenceService");
  });

  test("T28 -- resolveDrift uses the persistence service (resolveItem)", async () => {
    const content = await readFile(SERVICE_DRIFT_FILE, "utf-8");
    // Should call resolveItem
    expect(content).toMatch(/resolveDrift[\s\S]*?resolveItem/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Routes drift.ts (T29-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Routes drift.ts", () => {
  test("T29 -- companyId used in all routes", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // assertCompanyAccess called with companyId for all routes
    const assertCalls = content.match(/assertCompanyAccess\s*\(\s*req\s*,\s*project\.companyId\s*\)/g);
    // At least 6 routes use assertCompanyAccess
    expect(assertCalls).not.toBeNull();
    expect(assertCalls!.length).toBeGreaterThanOrEqual(6);
  });

  test("T30 -- Pagination on GET results (limit/offset)", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The GET results route should extract limit/offset from query
    expect(content).toMatch(/req\.query\.limit/);
    expect(content).toMatch(/req\.query\.offset/);
  });

  test("T31 -- Filter severity on items", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The items endpoint should accept severity filter
    expect(content).toMatch(/req\.query\.severity/);
  });

  test("T32 -- Filter decision on items", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The items endpoint should accept decision filter
    expect(content).toMatch(/req\.query\.decision/);
  });

  test("T33 -- decidedBy set at resolution", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The PATCH route should call getActorInfo and pass actorId
    expect(content).toContain("getActorInfo");
    expect(content).toMatch(/actorInfo\.actorId/);
  });

  test("T34 -- Route resolve returns updated DriftItem (decidedAt, decidedBy)", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The PATCH handler should call resolveDrift and res.json the updated item
    expect(content).toMatch(/resolveDrift\s*\(/);
    // After resolution, it should return the updated item
    expect(content).toMatch(/res\.json\s*\(\s*updated\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Types partages (T35-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Types partages", () => {
  test("T35 -- DriftReport enriched with companyId", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // DriftReport should have companyId
    expect(content).toMatch(/interface\s+DriftReport[\s\S]*?companyId\s*\??\s*:\s*string/);
  });

  test("T36 -- DriftItem enriched with reportId and decidedBy", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // DriftItem should have reportId and decidedBy
    expect(content).toMatch(/interface\s+DriftItem[\s\S]*?reportId\s*\??\s*:\s*string/);
    expect(content).toMatch(/interface\s+DriftItem[\s\S]*?decidedBy\s*\??\s*:\s*string/);
  });

  test("T37 -- DriftReportFilters exported", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+DriftReportFilters/);

    // Also exported from index
    const indexContent = await readFile(TYPES_INDEX, "utf-8");
    expect(indexContent).toContain("DriftReportFilters");
  });

  test("T38 -- DriftItemFilters exported", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+DriftItemFilters/);

    // Also exported from index
    const indexContent = await readFile(TYPES_INDEX, "utf-8");
    expect(indexContent).toContain("DriftItemFilters");
  });

  test("T39 -- DriftReport.driftCount present", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/interface\s+DriftReport[\s\S]*?driftCount\s*\??\s*:\s*number/);
  });

  test("T40 -- DriftReport.status present with 4 values", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/interface\s+DriftReport[\s\S]*?status\s*\??\s*:/);
    // The DriftReportStatus should define the 4 values
    expect(content).toContain("in_progress");
    expect(content).toContain("completed");
    expect(content).toContain("failed");
    expect(content).toContain("cancelled");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Audit + Transaction (T41-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Audit + Transaction", () => {
  test("T41 -- Transaction in createReport (db.transaction)", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    // createReport should use db.transaction
    expect(content).toMatch(/createReport[\s\S]*?\.transaction\s*\(\s*async/);
  });

  test("T42 -- emitAudit called at resolution (in routes)", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("emitAudit");
    // Should be called after resolveItem completes
    expect(content).toMatch(/resolveDrift[\s\S]*?emitAudit/);
  });

  test("T43 -- Audit action = drift.item_resolved", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain('"drift.item_resolved"');
  });

  test("T44 -- Audit metadata contains decision", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The emitAudit call should include decision in metadata
    expect(content).toMatch(/emitAudit\s*\(\s*\{[\s\S]*?metadata\s*:\s*\{[\s\S]*?decision/);
  });

  test("T45 -- Soft delete with deletedAt (no DELETE FROM)", async () => {
    const content = await readFile(SERVICE_PERSISTENCE_FILE, "utf-8");
    // deleteReportsForProject should use .update().set({ deletedAt })
    expect(content).toMatch(/deleteReportsForProject[\s\S]*?deletedAt\s*:\s*now/);
    // Should NOT use .delete()
    expect(content).not.toMatch(/\.delete\s*\(\s*driftReports\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Migration (T46-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Migration", () => {
  test("T46 -- Migration file exists for drift tables", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFile = files.find(
      (f) => f.endsWith(".sql") && (/drift/i.test(f) || f.includes("0035")),
    );
    // If not named with "drift", look for the content
    if (!migrationFile) {
      // Find any SQL file that contains drift_reports table creation
      let found = false;
      for (const f of files.filter((f) => f.endsWith(".sql"))) {
        const content = await readFile(resolve(MIGRATIONS_DIR, f), "utf-8");
        if (content.includes("drift_reports") && content.includes("CREATE TABLE")) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    } else {
      expect(migrationFile).toBeDefined();
    }
  });

  test("T47 -- Migration creates drift_reports", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    let found = false;
    for (const f of files.filter((f) => f.endsWith(".sql"))) {
      const content = await readFile(resolve(MIGRATIONS_DIR, f), "utf-8");
      if (content.includes("CREATE TABLE") && content.includes('"drift_reports"')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("T48 -- Migration creates drift_items", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    let found = false;
    for (const f of files.filter((f) => f.endsWith(".sql"))) {
      const content = await readFile(resolve(MIGRATIONS_DIR, f), "utf-8");
      if (content.includes("CREATE TABLE") && content.includes('"drift_items"')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
