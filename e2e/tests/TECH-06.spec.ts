/**
 * TECH-06: Schema DB — 10 Nouvelles Tables — E2E Tests
 *
 * These tests verify the schema deliverables of TECH-06:
 *   - AC-1: 10 schema files exist in packages/db/src/schema/
 *   - AC-2: All 10 exports in index.ts
 *   - AC-5: companyId (company_id) on every table (ADR-001)
 *   - AC-6: Conventions respected (uuid PK, timestamps, snake_case, .js imports)
 *   - AC-9: Foreign keys are valid
 *   - Key design decisions (no updatedAt on audit/chat, CASCADE, etc.)
 *   - Migration file generated
 *
 * All tests are file-content based — no server or database required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCHEMA_DIR = resolve(ROOT, "packages/db/src/schema");

/** The 10 new schema files introduced by TECH-06 */
const SCHEMA_FILES = [
  "project_memberships.ts",
  "automation_cursors.ts",
  "chat_channels.ts",
  "chat_messages.ts",
  "container_profiles.ts",
  "container_instances.ts",
  "credential_proxy_rules.ts",
  "audit_events.ts",
  "sso_configurations.ts",
  "import_jobs.ts",
] as const;

/** Corresponding exported table names (camelCase) */
const EXPORT_NAMES = [
  "projectMemberships",
  "automationCursors",
  "chatChannels",
  "chatMessages",
  "containerProfiles",
  "containerInstances",
  "credentialProxyRules",
  "auditEvents",
  "ssoConfigurations",
  "importJobs",
] as const;

// ─── AC-1: 10 schema files exist ─────────────────────────────────────────────

test.describe("AC-1: 10 schema files exist", () => {
  for (const file of SCHEMA_FILES) {
    test(`${file} exists in packages/db/src/schema/`, async () => {
      const filePath = resolve(SCHEMA_DIR, file);
      await expect(
        access(filePath).then(() => true),
      ).resolves.toBe(true);
    });
  }
});

// ─── AC-2: All 10 exports in index.ts ────────────────────────────────────────

test.describe("AC-2: index.ts exports all 10 new tables", () => {
  let indexContent: string;

  test.beforeAll(async () => {
    indexContent = await readFile(resolve(SCHEMA_DIR, "index.ts"), "utf-8");
  });

  test("index.ts contains all 10 export statements", () => {
    for (let i = 0; i < SCHEMA_FILES.length; i++) {
      const exportName = EXPORT_NAMES[i];
      const fileName = SCHEMA_FILES[i].replace(".ts", ".js");

      // Should contain the named export from the .js file
      expect(indexContent).toContain(exportName);
      expect(indexContent).toContain(fileName);
    }
  });
});

// ─── AC-5: companyId on every table (ADR-001) ───────────────────────────────

test.describe("AC-5: companyId (company_id) on every table — ADR-001", () => {
  for (const file of SCHEMA_FILES) {
    test(`${file} contains company_id column`, async () => {
      const content = await readFile(resolve(SCHEMA_DIR, file), "utf-8");
      // All tables must have a company_id column
      expect(content).toContain('"company_id"');
    });
  }
});

// ─── AC-6: Convention compliance ─────────────────────────────────────────────

test.describe("AC-6: Convention compliance — uuid PK with defaultRandom()", () => {
  for (const file of SCHEMA_FILES) {
    test(`${file} has uuid PK with defaultRandom()`, async () => {
      const content = await readFile(resolve(SCHEMA_DIR, file), "utf-8");
      expect(content).toMatch(/uuid\("id"\)\.primaryKey\(\)\.defaultRandom\(\)/);
    });
  }
});

test.describe("AC-6: Convention compliance — timestamps with withTimezone", () => {
  for (const file of SCHEMA_FILES) {
    test(`${file} has createdAt with withTimezone: true`, async () => {
      const content = await readFile(resolve(SCHEMA_DIR, file), "utf-8");
      // Must have createdAt with timezone
      expect(content).toMatch(
        /timestamp\("created_at",\s*\{\s*withTimezone:\s*true\s*\}\)/,
      );
    });
  }
});

test.describe("AC-6: Convention compliance — imports use .js extension", () => {
  for (const file of SCHEMA_FILES) {
    test(`${file} uses .js extension in imports`, async () => {
      const content = await readFile(resolve(SCHEMA_DIR, file), "utf-8");
      // All relative imports should use .js extension (Drizzle convention)
      const relativeImports = content.match(/from\s+"\.\/[^"]+"/g) ?? [];
      for (const imp of relativeImports) {
        expect(imp).toMatch(/\.js"$/);
      }
    });
  }
});

test.describe("AC-6: Convention compliance — index names prefixed with table name", () => {
  // Map file names to expected SQL table names
  const tableNames: Record<string, string> = {
    "project_memberships.ts": "project_memberships",
    "automation_cursors.ts": "automation_cursors",
    "chat_channels.ts": "chat_channels",
    "chat_messages.ts": "chat_messages",
    "container_profiles.ts": "container_profiles",
    "container_instances.ts": "container_instances",
    "credential_proxy_rules.ts": "credential_proxy_rules",
    "audit_events.ts": "audit_events",
    "sso_configurations.ts": "sso_configurations",
    "import_jobs.ts": "import_jobs",
  };

  for (const file of SCHEMA_FILES) {
    test(`${file} index names are prefixed with table name`, async () => {
      const content = await readFile(resolve(SCHEMA_DIR, file), "utf-8");
      const tableName = tableNames[file];
      // Find all index/uniqueIndex calls with name strings
      const indexMatches =
        content.match(/(?:uniqueIndex|index)\("([^"]+)"\)/g) ?? [];
      for (const match of indexMatches) {
        const nameMatch = match.match(/\("([^"]+)"\)/);
        if (nameMatch) {
          expect(nameMatch[1]).toMatch(new RegExp(`^${tableName}_`));
        }
      }
    });
  }
});

// ─── AC-9: Foreign keys are valid ────────────────────────────────────────────

test.describe("AC-9: Foreign keys — project_memberships", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "project_memberships.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });

  test("references projects.id with CASCADE delete", () => {
    expect(content).toContain("projects.id");
    expect(content).toMatch(/onDelete:\s*"cascade"/);
  });

  test("imports companies from ./companies.js", () => {
    expect(content).toContain('from "./companies.js"');
  });

  test("imports projects from ./projects.js", () => {
    expect(content).toContain('from "./projects.js"');
  });
});

test.describe("AC-9: Foreign keys — automation_cursors", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "automation_cursors.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });

  test("imports companies from ./companies.js", () => {
    expect(content).toContain('from "./companies.js"');
  });
});

test.describe("AC-9: Foreign keys — chat_channels", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "chat_channels.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });

  test("references agents.id", () => {
    expect(content).toContain("agents.id");
  });

  test("references heartbeatRuns.id", () => {
    expect(content).toContain("heartbeatRuns.id");
  });

  test("imports agents from ./agents.js", () => {
    expect(content).toContain('from "./agents.js"');
  });

  test("imports heartbeat_runs from ./heartbeat_runs.js", () => {
    expect(content).toContain('from "./heartbeat_runs.js"');
  });
});

test.describe("AC-9: Foreign keys — chat_messages", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "chat_messages.ts"),
      "utf-8",
    );
  });

  test("references chatChannels.id", () => {
    expect(content).toContain("chatChannels.id");
  });

  test("imports chat_channels from ./chat_channels.js", () => {
    expect(content).toContain('from "./chat_channels.js"');
  });

  test("companyId has NO FK reference (denormalized for RLS)", () => {
    // company_id should exist but should NOT reference companies.id
    expect(content).toContain('"company_id"');
    // The references(() => companies.id) should NOT be present for companyId
    expect(content).not.toMatch(
      /company_id.*references\(\(\)\s*=>\s*companies\.id\)/s,
    );
  });
});

test.describe("AC-9: Foreign keys — container_profiles", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "container_profiles.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });

  test("imports companies from ./companies.js", () => {
    expect(content).toContain('from "./companies.js"');
  });
});

test.describe("AC-9: Foreign keys — container_instances", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "container_instances.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });

  test("references containerProfiles.id", () => {
    expect(content).toContain("containerProfiles.id");
  });

  test("references agents.id", () => {
    expect(content).toContain("agents.id");
  });

  test("imports container_profiles from ./container_profiles.js", () => {
    expect(content).toContain('from "./container_profiles.js"');
  });

  test("imports agents from ./agents.js", () => {
    expect(content).toContain('from "./agents.js"');
  });
});

test.describe("AC-9: Foreign keys — credential_proxy_rules", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "credential_proxy_rules.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });
});

test.describe("AC-9: Foreign keys — audit_events", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "audit_events.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });
});

test.describe("AC-9: Foreign keys — sso_configurations", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "sso_configurations.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });
});

test.describe("AC-9: Foreign keys — import_jobs", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(
      resolve(SCHEMA_DIR, "import_jobs.ts"),
      "utf-8",
    );
  });

  test("references companies.id", () => {
    expect(content).toContain("companies.id");
  });
});

// ─── Key Design Decisions ────────────────────────────────────────────────────

test.describe("Key design: audit_events has NO updatedAt (append-only)", () => {
  test("audit_events.ts does not contain updatedAt / updated_at", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "audit_events.ts"),
      "utf-8",
    );
    expect(content).not.toContain("updated_at");
    expect(content).not.toContain("updatedAt");
  });
});

test.describe("Key design: chat_messages has NO updatedAt (append-only)", () => {
  test("chat_messages.ts does not contain updatedAt / updated_at", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "chat_messages.ts"),
      "utf-8",
    );
    expect(content).not.toContain("updated_at");
    expect(content).not.toContain("updatedAt");
  });
});

test.describe("Key design: project_memberships has CASCADE on projectId", () => {
  test("project_memberships.ts uses onDelete cascade for projectId", async () => {
    const content = await readFile(
      resolve(SCHEMA_DIR, "project_memberships.ts"),
      "utf-8",
    );
    // Should have cascade delete on the projects FK
    expect(content).toMatch(/onDelete:\s*"cascade"/);
  });
});

// ─── Migration generated ─────────────────────────────────────────────────────

test.describe("Migration file generated", () => {
  test("a migration file newer than 0027 exists in packages/db/src/migrations/", async () => {
    const { readdir } = await import("node:fs/promises");
    const migrationsDir = resolve(ROOT, "packages/db/src/migrations");
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    // There should be at least one migration with sequence number > 0027
    // (the last existing one before TECH-06)
    const highNumberFiles = sqlFiles.filter((f) => {
      const numMatch = f.match(/^(\d{4})/);
      return numMatch && parseInt(numMatch[1], 10) >= 28;
    });
    expect(highNumberFiles.length).toBeGreaterThanOrEqual(1);
  });
});
