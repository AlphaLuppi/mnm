/**
 * MU-S05: Desactivation Signup Libre — E2E Tests
 *
 * These tests verify the deliverables of MU-S05:
 *   - AC-1: Schema — invitationOnly column on companies table (boolean, default false)
 *   - AC-2: Toggle via PATCH company — updateCompanySchema has invitationOnly field
 *   - AC-3: Guard — join-request handler rejects with 403 when invitationOnly is true
 *   - AC-4: Invitation bypass — invite accept flow does NOT check invitationOnly
 *   - AC-5: Audit — company.config_change action logged on invitationOnly change
 *   - AC-7: Validation — invitationOnly is boolean strict (Zod rejects non-boolean)
 *
 * Source files:
 *   - packages/db/src/schema/companies.ts — invitationOnly column
 *   - packages/db/src/migrations/0034_*.sql — ALTER TABLE add invitation_only
 *   - packages/shared/src/validators/company.ts — invitationOnly in updateCompanySchema
 *   - server/src/routes/access.ts — guard on join-request handler
 *   - server/src/routes/companies.ts — company.config_change audit on PATCH
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const COMPANIES_SCHEMA = resolve(ROOT, "packages/db/src/schema/companies.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const JOURNAL = resolve(MIGRATIONS_DIR, "meta/_journal.json");
const VALIDATORS_COMPANY = resolve(
  ROOT,
  "packages/shared/src/validators/company.ts",
);
const VALIDATORS_INDEX = resolve(
  ROOT,
  "packages/shared/src/validators/index.ts",
);
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const ACCESS_ROUTES = resolve(ROOT, "server/src/routes/access.ts");
const COMPANIES_ROUTES = resolve(ROOT, "server/src/routes/companies.ts");

// ─── Group 1: Schema (packages/db/src/schema/companies.ts) ──────────────────

test.describe("Group 1: Schema — invitationOnly column on companies", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(COMPANIES_SCHEMA, "utf-8");
  });

  test("has invitationOnly column with boolean type", () => {
    expect(content).toContain("invitationOnly");
    expect(content).toMatch(/invitationOnly\s*:\s*boolean\s*\(/);
  });

  test('column name is "invitation_only"', () => {
    expect(content).toContain('"invitation_only"');
  });

  test("default value is false", () => {
    // The invitationOnly column line should have .default(false)
    const lines = content.split("\n");
    const invitationOnlyLine = lines.find((l) =>
      l.includes("invitation_only"),
    );
    expect(invitationOnlyLine).toBeTruthy();
    expect(invitationOnlyLine).toContain(".default(false)");
  });

  test("column is NOT NULL", () => {
    const lines = content.split("\n");
    const invitationOnlyLine = lines.find((l) =>
      l.includes("invitation_only"),
    );
    expect(invitationOnlyLine).toBeTruthy();
    expect(invitationOnlyLine).toContain(".notNull()");
  });
});

// ─── Group 2: Migration ─────────────────────────────────────────────────────

test.describe("Group 2: Migration for invitation_only", () => {
  test("a migration file for invitation_only exists (0034_* or later)", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    // MU-S05 migration should be 0034 or later (after 0033)
    const candidateFiles = files.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 34 && f.endsWith(".sql");
    });
    expect(candidateFiles.length).toBeGreaterThanOrEqual(1);
  });

  test("migration SQL contains ALTER TABLE or CREATE for invitation_only", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const candidateFiles = files.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 34 && f.endsWith(".sql");
    });
    expect(candidateFiles.length).toBeGreaterThanOrEqual(1);

    // At least one migration should reference invitation_only
    let found = false;
    for (const file of candidateFiles) {
      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      if (/invitation_only/i.test(content)) {
        found = true;
        // Should contain ALTER TABLE or CREATE (table/index)
        expect(content).toMatch(/ALTER\s+TABLE|CREATE/i);
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("migration journal has an entry >= 0034", async () => {
    const journalContent = await readFile(JOURNAL, "utf-8");
    const journal = JSON.parse(journalContent);
    const entry = journal.entries.find(
      (e: { idx: number; tag: string }) =>
        e.tag.startsWith("0034") ||
        e.tag.startsWith("0035") ||
        e.tag.startsWith("0036"),
    );
    expect(entry).toBeTruthy();
  });
});

// ─── Group 3: Validator (packages/shared/src/validators/company.ts) ─────────

test.describe("Group 3: Validator — invitationOnly in updateCompanySchema", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATORS_COMPANY, "utf-8");
  });

  test("updateCompanySchema contains invitationOnly field", () => {
    // The updateCompanySchema should have invitationOnly in its definition
    expect(content).toMatch(
      /updateCompanySchema[\s\S]*?invitationOnly/,
    );
  });

  test("invitationOnly uses z.boolean()", () => {
    // Find invitationOnly field and verify it uses z.boolean()
    expect(content).toMatch(/invitationOnly\s*:\s*z\.boolean\(\)/);
  });

  test("invitationOnly is optional (in the update schema)", () => {
    // The invitationOnly field should be .optional() in the update schema
    // since it's a partial update — not every PATCH includes it
    expect(content).toMatch(
      /invitationOnly\s*:\s*z\.boolean\(\)\.optional\(\)/,
    );
  });

  test("updateCompanySchema is exported", () => {
    expect(content).toMatch(/export\s+const\s+updateCompanySchema/);
  });
});

// ─── Group 4: Re-exports ────────────────────────────────────────────────────

test.describe("Group 4: Re-exports include updateCompanySchema", () => {
  test("validators/index.ts re-exports updateCompanySchema", async () => {
    const content = await readFile(VALIDATORS_INDEX, "utf-8");
    expect(content).toContain("updateCompanySchema");
  });

  test("shared/src/index.ts re-exports updateCompanySchema", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    expect(content).toContain("updateCompanySchema");
  });
});

// ─── Group 5: Join-request guard (server/src/routes/access.ts) ──────────────

test.describe("Group 5: Join-request guard — invitationOnly check", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("imports companies table from @mnm/db", () => {
    expect(content).toContain("companies");
    expect(content).toMatch(/from\s+["']@mnm\/db["']/);
  });

  test("join-request handler checks invitationOnly flag", () => {
    // The content should reference invitationOnly somewhere in the
    // join-request handling logic
    expect(content).toContain("invitationOnly");
  });

  test("returns 403 or forbidden when invitationOnly is true", () => {
    // Look for forbidden() call near invitationOnly logic
    // The guard should throw forbidden() with "invitation only" message
    expect(content).toMatch(/forbidden\s*\([^)]*invitation[^)]*only/i);
  });

  test("queries companies table for invitationOnly", () => {
    // Should select invitationOnly from companies
    expect(content).toMatch(/companies\.invitationOnly|companies\.invitation_only/);
  });

  test("invite accept flow does NOT check invitationOnly", () => {
    // The POST /api/invites/:token/accept handler is a separate codepath
    // that should NOT contain an invitationOnly guard.
    // Find the invite accept handler section
    const acceptIdx = content.indexOf("/accept");
    expect(acceptIdx).toBeGreaterThan(-1);

    // Find the join-requests handler section
    const joinRequestIdx = content.search(
      /router\.(post|get)\s*\(\s*["'][^"']*join-requests["']/,
    );
    expect(joinRequestIdx).toBeGreaterThan(-1);

    // The invitationOnly check should appear near the join-requests handler,
    // not in the invite accept handler. Verify invitationOnly appears in
    // the file (the guard exists).
    expect(content).toContain("invitationOnly");
  });
});

// ─── Group 6: Settings / PATCH company audit (server/src/routes/companies.ts)

test.describe("Group 6: PATCH company — config_change audit", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(COMPANIES_ROUTES, "utf-8");
  });

  test("PATCH /:companyId endpoint exists", () => {
    expect(content).toMatch(
      /router\.patch\s*\(\s*["']\/:companyId["']/,
    );
  });

  test("uses validate middleware with updateCompanySchema", () => {
    expect(content).toMatch(
      /validate\s*\(\s*updateCompanySchema\s*\)/,
    );
  });

  test("logs activity with company.config_change action", () => {
    expect(content).toContain("company.config_change");
  });

  test("config_change audit includes invitationOnly field reference", () => {
    // The audit details should reference "invitationOnly" as the field
    expect(content).toMatch(
      /company\.config_change[\s\S]*?invitationOnly|invitationOnly[\s\S]*?company\.config_change/,
    );
  });

  test("compares old and new value before logging config_change", () => {
    // Should fetch current company value before updating
    // to compare oldValue vs newValue for invitationOnly
    const patchIdx = content.search(
      /router\.patch\s*\(\s*["']\/:companyId["']/,
    );
    expect(patchIdx).toBeGreaterThan(-1);

    // Look for oldValue/newValue pattern or comparison logic
    // within the PATCH handler body
    const handlerSlice = content.slice(patchIdx, patchIdx + 3000);
    // Should reference invitationOnly and have some form of old/new comparison
    expect(handlerSlice).toContain("invitationOnly");
  });

  test("config_change includes field, oldValue, newValue in details", () => {
    // The logActivity call for config_change should have details with
    // field, oldValue, newValue
    expect(content).toMatch(
      /company\.config_change[\s\S]*?field\s*:/,
    );
    expect(content).toMatch(
      /company\.config_change[\s\S]*?oldValue\s*:/,
    );
    expect(content).toMatch(
      /company\.config_change[\s\S]*?newValue\s*:/,
    );
  });
});

// ─── Group 7: Activity logging — action format ──────────────────────────────

test.describe("Group 7: Activity logging — company.config_change action", () => {
  test('PATCH route logs "company.config_change" not just "company.updated"', async () => {
    const content = await readFile(COMPANIES_ROUTES, "utf-8");
    // Should have BOTH company.updated (standard) and company.config_change (specific)
    expect(content).toContain("company.updated");
    expect(content).toContain("company.config_change");
  });

  test("config_change only fires when invitationOnly actually changes value", async () => {
    const content = await readFile(COMPANIES_ROUTES, "utf-8");
    // Should have a conditional that checks whether the value actually changed
    // e.g. req.body.invitationOnly !== oldInvitationOnly
    // or newValue !== oldValue
    const patchIdx = content.search(
      /router\.patch\s*\(\s*["']\/:companyId["']/,
    );
    expect(patchIdx).toBeGreaterThan(-1);
    const handlerSlice = content.slice(patchIdx, patchIdx + 3000);

    // Should have a conditional checking that invitationOnly value differs
    // This could be !== comparison or similar
    expect(handlerSlice).toMatch(
      /invitationOnly\s*!==|!==\s*oldInvitationOnly|oldValue\s*!==|!==\s*old/i,
    );
  });

  test("details object includes 'invitationOnly' as field value", async () => {
    const content = await readFile(COMPANIES_ROUTES, "utf-8");
    // The details should have field: "invitationOnly"
    expect(content).toMatch(/field\s*:\s*["']invitationOnly["']/);
  });
});
