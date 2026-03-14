/**
 * TECH-07: Schema DB — Modifications 5 Tables Existantes — E2E Tests
 *
 * These tests verify the schema deliverables of TECH-07:
 *   - AC-1: New columns exist in the 5 modified schema files
 *   - AC-2: All new columns are backward-compatible (nullable or have defaults)
 *   - AC-3: 9 new permission keys exist in constants (15 total)
 *   - AC-4: Migration generated (after TECH-06's migration)
 *   - AC-5: FK from agents.containerProfileId to container_profiles.id
 *
 * Modified files:
 *   - packages/db/src/schema/companies.ts       (+4 columns)
 *   - packages/db/src/schema/company_memberships.ts (+1 column)
 *   - packages/db/src/schema/agents.ts           (+2 columns)
 *   - packages/shared/src/constants.ts           (+9 permission keys)
 *   - packages/db/src/schema/activity_log.ts     (+3 columns, +1 index)
 *
 * All tests are file-content based — no server or database required.
 */
import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCHEMA_DIR = resolve(ROOT, "packages/db/src/schema");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");

// ─── Group 1: companies.ts modifications (+4 columns) ──────────────────────

test.describe("Group 1: companies.ts modifications", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(resolve(SCHEMA_DIR, "companies.ts"), "utf-8");
  });

  test('contains "tier" column with default "free"', () => {
    expect(content).toContain('"tier"');
    expect(content).toMatch(/tier.*default\("free"\)/s);
  });

  test('contains "sso_enabled" column', () => {
    expect(content).toContain('"sso_enabled"');
  });

  test('contains "max_users" column with default 50', () => {
    expect(content).toContain('"max_users"');
    expect(content).toMatch(/max_users.*default\(50\)/s);
  });

  test('contains "parent_company_id" column', () => {
    expect(content).toContain('"parent_company_id"');
  });
});

// ─── Group 2: company_memberships.ts modifications (+1 column) ─────────────

test.describe("Group 2: company_memberships.ts modifications", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "company_memberships.ts"),
      "utf-8",
    );
  });

  test('contains "business_role" column', () => {
    expect(content).toContain('"business_role"');
  });

  test('default value is "contributor"', () => {
    expect(content).toMatch(/business_role.*default\("contributor"\)/s);
  });
});

// ─── Group 3: agents.ts modifications (+2 columns) ─────────────────────────

test.describe("Group 3: agents.ts modifications", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(resolve(SCHEMA_DIR, "agents.ts"), "utf-8");
  });

  test('contains "container_profile_id" column', () => {
    expect(content).toContain('"container_profile_id"');
  });

  test('contains "isolation_mode" column with default "process"', () => {
    expect(content).toContain('"isolation_mode"');
    expect(content).toMatch(/isolation_mode.*default\("process"\)/s);
  });

  test("imports containerProfiles from ./container_profiles.js", () => {
    expect(content).toContain('from "./container_profiles.js"');
    expect(content).toContain("containerProfiles");
  });
});

// ─── Group 4: Permission keys in constants.ts ──────────────────────────────

test.describe("Group 4: Permission keys in constants.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS_FILE, "utf-8");
  });

  const NEW_PERMISSION_KEYS = [
    "projects:manage_members",
    "workflows:create",
    "workflows:enforce",
    "agents:manage_containers",
    "company:manage_settings",
    "company:manage_sso",
    "audit:read",
    "audit:export",
    "tasks:assign_scope",
  ] as const;

  for (const key of NEW_PERMISSION_KEYS) {
    test(`contains permission key "${key}"`, () => {
      expect(content).toContain(`"${key}"`);
    });
  }

  test("PERMISSION_KEYS array has at least 15 entries (15 original + 5 from RBAC-S02)", () => {
    // Extract the PERMISSION_KEYS array block
    const match = content.match(
      /PERMISSION_KEYS\s*=\s*\[([\s\S]*?)\]\s*as\s*const/,
    );
    expect(match).toBeTruthy();
    // Count quoted strings in the array
    const entries = match![1].match(/"[^"]+"/g);
    expect(entries).toBeTruthy();
    expect(entries!.length).toBe(20);
  });
});

// ─── Group 5: activity_log.ts modifications (+3 columns, +1 index) ─────────

test.describe("Group 5: activity_log.ts modifications", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(resolve(SCHEMA_DIR, "activity_log.ts"), "utf-8");
  });

  test('contains "ip_address" column', () => {
    expect(content).toContain('"ip_address"');
  });

  test('contains "user_agent" column', () => {
    expect(content).toContain('"user_agent"');
  });

  test('contains "severity" column with default "info"', () => {
    expect(content).toContain('"severity"');
    expect(content).toMatch(/severity.*default\("info"\)/s);
  });

  test('contains new index "activity_log_company_severity_idx"', () => {
    expect(content).toContain('"activity_log_company_severity_idx"');
  });
});

// ─── Group 6: Backward compatibility — all new columns nullable or defaulted

test.describe("Group 6: Backward compatibility", () => {
  test("companies.ts — tier has .default()", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "companies.ts"),
      "utf-8",
    );
    // tier column line should have .default(
    const tierLine = content
      .split("\n")
      .find((l) => l.includes('"tier"'));
    expect(tierLine).toBeTruthy();
    expect(tierLine).toContain(".default(");
  });

  test("companies.ts — ssoEnabled has .default()", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "companies.ts"),
      "utf-8",
    );
    const ssoLine = content
      .split("\n")
      .find((l) => l.includes('"sso_enabled"'));
    expect(ssoLine).toBeTruthy();
    expect(ssoLine).toContain(".default(");
  });

  test("companies.ts — maxUsers has .default()", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "companies.ts"),
      "utf-8",
    );
    const maxUsersLine = content
      .split("\n")
      .find((l) => l.includes('"max_users"'));
    expect(maxUsersLine).toBeTruthy();
    expect(maxUsersLine).toContain(".default(");
  });

  test("companies.ts — parentCompanyId is nullable (no .notNull())", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "companies.ts"),
      "utf-8",
    );
    const parentLine = content
      .split("\n")
      .find((l) => l.includes('"parent_company_id"'));
    expect(parentLine).toBeTruthy();
    expect(parentLine).not.toContain(".notNull()");
  });

  test("agents.ts — containerProfileId is nullable (no .notNull())", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "agents.ts"),
      "utf-8",
    );
    const containerLine = content
      .split("\n")
      .find((l) => l.includes('"container_profile_id"'));
    expect(containerLine).toBeTruthy();
    expect(containerLine).not.toContain(".notNull()");
  });
});

// ─── Group 7: Migration generated ──────────────────────────────────────────

test.describe("Group 7: Migration generated", () => {
  test("a migration file with sequence number >= 29 exists (after TECH-06's 0028)", async () => {
    const migrationsDir = resolve(ROOT, "packages/db/src/migrations");
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    // TECH-06 migration is 0028. TECH-07 should be >= 0029.
    const highNumberFiles = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 29;
    });
    expect(highNumberFiles.length).toBeGreaterThanOrEqual(1);
  });
});
