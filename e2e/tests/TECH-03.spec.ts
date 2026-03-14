/**
 * TECH-03: Infrastructure de Test (Factories + Seed) — E2E Tests
 *
 * These tests verify the infrastructure deliverables of TECH-03:
 *   - AC-1: Factory files exist in packages/test-utils/src/factories/
 *   - AC-2: Each factory exports buildTestX and createTestX functions
 *   - AC-3: Helper files exist in packages/test-utils/src/helpers/
 *   - AC-4: Package.json is correct (@mnm/test-utils, type: module, exports)
 *   - AC-5: Factories follow override pattern (counter, overrides param, db param)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const TEST_UTILS_DIR = resolve(ROOT, "packages/test-utils");
const SRC_DIR = resolve(TEST_UTILS_DIR, "src");
const FACTORIES_DIR = resolve(SRC_DIR, "factories");
const HELPERS_DIR = resolve(SRC_DIR, "helpers");

// ─── Group 1: Package structure ─────────────────────────────────────────────

test.describe("Group 1: Package structure", () => {
  test("packages/test-utils/package.json exists with name @mnm/test-utils", async () => {
    const content = await readFile(
      resolve(TEST_UTILS_DIR, "package.json"),
      "utf-8",
    );
    const pkg = JSON.parse(content);
    expect(pkg.name).toBe("@mnm/test-utils");
  });

  test("packages/test-utils/tsconfig.json exists", async () => {
    await expect(
      access(resolve(TEST_UTILS_DIR, "tsconfig.json")).then(() => true),
    ).resolves.toBe(true);
  });

  test("packages/test-utils/src/index.ts exists", async () => {
    await expect(
      access(resolve(SRC_DIR, "index.ts")).then(() => true),
    ).resolves.toBe(true);
  });

  test("packages/test-utils/src/factories/index.ts exists", async () => {
    await expect(
      access(resolve(FACTORIES_DIR, "index.ts")).then(() => true),
    ).resolves.toBe(true);
  });

  test("packages/test-utils/src/helpers/index.ts exists", async () => {
    await expect(
      access(resolve(HELPERS_DIR, "index.ts")).then(() => true),
    ).resolves.toBe(true);
  });
});

// ─── Group 2: Factory files exist ───────────────────────────────────────────

const FACTORY_FILES = [
  "company.factory.ts",
  "user.factory.ts",
  "agent.factory.ts",
  "project.factory.ts",
  "issue.factory.ts",
  "membership.factory.ts",
  "permission.factory.ts",
] as const;

test.describe("Group 2: Factory files exist", () => {
  for (const file of FACTORY_FILES) {
    test(`${file} exists in packages/test-utils/src/factories/`, async () => {
      const filePath = resolve(FACTORIES_DIR, file);
      await expect(
        access(filePath).then(() => true),
      ).resolves.toBe(true);
    });
  }
});

// ─── Group 3: Factory exports (buildTestX and createTestX) ──────────────────

/**
 * Map factory file to expected export function names.
 *
 * membership.factory.ts exports CompanyMembership + ProjectMembership variants.
 * permission.factory.ts exports PermissionGrant variants.
 */
const FACTORY_EXPORTS: Record<
  string,
  { build: string[]; create: string[] }
> = {
  "company.factory.ts": {
    build: ["buildTestCompany"],
    create: ["createTestCompany"],
  },
  "user.factory.ts": {
    build: ["buildTestUser"],
    create: ["createTestUser"],
  },
  "agent.factory.ts": {
    build: ["buildTestAgent"],
    create: ["createTestAgent"],
  },
  "project.factory.ts": {
    build: ["buildTestProject"],
    create: ["createTestProject"],
  },
  "issue.factory.ts": {
    build: ["buildTestIssue"],
    create: ["createTestIssue"],
  },
  "membership.factory.ts": {
    build: ["buildTestCompanyMembership", "buildTestProjectMembership"],
    create: ["createTestCompanyMembership", "createTestProjectMembership"],
  },
  "permission.factory.ts": {
    build: ["buildTestPermissionGrant"],
    create: ["createTestPermissionGrant"],
  },
};

test.describe("Group 3: Factory exports (buildTestX and createTestX)", () => {
  for (const file of FACTORY_FILES) {
    const { build, create } = FACTORY_EXPORTS[file];
    const buildLabel = build.join(", ");
    const createLabel = create.join(", ");

    test(`${file} exports buildTestX (${buildLabel}) and createTestX (${createLabel})`, async () => {
      const content = await readFile(resolve(FACTORIES_DIR, file), "utf-8");

      // Should export buildTestX function(s) (plain object builder)
      for (const fn of build) {
        expect(content).toMatch(
          new RegExp(`export\\s+function\\s+${fn}`),
        );
      }

      // Should export createTestX function(s) (async DB insert)
      for (const fn of create) {
        expect(content).toMatch(
          new RegExp(`export\\s+(async\\s+)?function\\s+${fn}`),
        );
      }
    });
  }
});

// ─── Group 4: Helper files exist ────────────────────────────────────────────

const HELPER_FILES = ["db-setup.ts", "seed-e2e.ts", "mock-llm.ts"] as const;

test.describe("Group 4: Helper files exist", () => {
  for (const file of HELPER_FILES) {
    test(`${file} exists in packages/test-utils/src/helpers/`, async () => {
      const filePath = resolve(HELPERS_DIR, file);
      await expect(
        access(filePath).then(() => true),
      ).resolves.toBe(true);
    });
  }
});

// ─── Group 5: Factory patterns ──────────────────────────────────────────────

test.describe("Group 5: Factory patterns", () => {
  test("factories use counter for unique names", async () => {
    // Check at least company.factory.ts and user.factory.ts for counter pattern
    const companyContent = await readFile(
      resolve(FACTORIES_DIR, "company.factory.ts"),
      "utf-8",
    );
    const userContent = await readFile(
      resolve(FACTORIES_DIR, "user.factory.ts"),
      "utf-8",
    );

    // Each factory should have a counter variable that increments
    expect(companyContent).toMatch(/Counter\s*[=:]/i);
    expect(companyContent).toContain("++");
    expect(userContent).toMatch(/Counter\s*[=:]/i);
    expect(userContent).toContain("++");
  });

  test("factories accept overrides parameter", async () => {
    // buildTestX functions should accept an overrides parameter
    const companyContent = await readFile(
      resolve(FACTORIES_DIR, "company.factory.ts"),
      "utf-8",
    );
    const agentContent = await readFile(
      resolve(FACTORIES_DIR, "agent.factory.ts"),
      "utf-8",
    );

    // Override pattern: function takes an overrides parameter and applies it
    // Implementation uses spread (...overrides) or nullish coalescing (??)
    expect(companyContent).toMatch(/overrides/i);
    expect(agentContent).toMatch(/overrides/i);

    // Overrides should be applied in the return object (spread or ??)
    expect(companyContent).toMatch(/\.\.\.overrides|\?\?/);
    expect(agentContent).toMatch(/\.\.\.overrides|\?\?/);
  });

  test("createTestX functions accept db parameter", async () => {
    // createTestX should take a db parameter for DB insertion
    const companyContent = await readFile(
      resolve(FACTORIES_DIR, "company.factory.ts"),
      "utf-8",
    );
    const userContent = await readFile(
      resolve(FACTORIES_DIR, "user.factory.ts"),
      "utf-8",
    );
    const projectContent = await readFile(
      resolve(FACTORIES_DIR, "project.factory.ts"),
      "utf-8",
    );

    // createTestX(db, ...) pattern — first parameter is db
    expect(companyContent).toMatch(/createTestCompany\([^)]*db/);
    expect(userContent).toMatch(/createTestUser\([^)]*db/);
    expect(projectContent).toMatch(/createTestProject\([^)]*db/);
  });

  test("factories import from @mnm/db", async () => {
    // Factories should import table definitions and Db type from @mnm/db
    const companyContent = await readFile(
      resolve(FACTORIES_DIR, "company.factory.ts"),
      "utf-8",
    );
    const userContent = await readFile(
      resolve(FACTORIES_DIR, "user.factory.ts"),
      "utf-8",
    );
    const agentContent = await readFile(
      resolve(FACTORIES_DIR, "agent.factory.ts"),
      "utf-8",
    );

    expect(companyContent).toMatch(/@mnm\/db/);
    expect(userContent).toMatch(/@mnm\/db/);
    expect(agentContent).toMatch(/@mnm\/db/);
  });

  test("buildTestX returns plain objects without calling db.insert", async () => {
    // buildTestX should NOT call db.insert — it just returns a plain object
    const companyContent = await readFile(
      resolve(FACTORIES_DIR, "company.factory.ts"),
      "utf-8",
    );

    // Extract the buildTestCompany function body (up to the next export)
    const buildMatch = companyContent.match(
      /export\s+function\s+buildTestCompany[\s\S]*?(?=export\s)/,
    );
    expect(buildMatch).toBeTruthy();
    const buildBody = buildMatch![0];

    // buildTestX should NOT contain db.insert — that's for createTestX
    expect(buildBody).not.toContain("db.insert");
    // Should return an object (contains a return statement)
    expect(buildBody).toContain("return");
  });
});

// ─── Group 6: Package configuration ─────────────────────────────────────────

test.describe("Group 6: Package configuration", () => {
  let pkg: Record<string, unknown>;

  test.beforeAll(async () => {
    const raw = await readFile(
      resolve(TEST_UTILS_DIR, "package.json"),
      "utf-8",
    );
    pkg = JSON.parse(raw);
  });

  test("package.json has @mnm/db dependency", () => {
    const deps = pkg.dependencies as Record<string, string> | undefined;
    expect(deps).toBeDefined();
    expect(deps!["@mnm/db"]).toBeDefined();
  });

  test("package.json has correct exports configuration", () => {
    const exports = pkg.exports as Record<string, string> | undefined;
    expect(exports).toBeDefined();
    // Should have at least the main export "."
    expect(exports!["."]).toBeDefined();
    // Should also have subpath exports for factories and helpers
    expect(exports!["./factories"]).toBeDefined();
    expect(exports!["./helpers"]).toBeDefined();
  });

  test("package.json is type: module", () => {
    expect(pkg.type).toBe("module");
  });
});
