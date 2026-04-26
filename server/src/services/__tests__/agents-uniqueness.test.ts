import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";

// B-FIX-2: assert the partial unique index on (company_id, name) WHERE
// archived_at IS NULL is enforced at the DB layer.
describe("agents schema — UNIQUE(company_id, name) partial index (B-FIX-2)", () => {
  let db: Db;
  const companyId = "00000000-0000-0000-0000-0000000ba001";

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, 'UniqueCo', 'UNQT') ON CONFLICT DO NOTHING`,
    );
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  it("rejects a second active row with the same (company_id, name)", async () => {
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, enabled)
      VALUES (${companyId}, 'duplicate-target', 'claude_local', true)
    `);
    await expect(
      db.execute(sql`
        INSERT INTO agents (company_id, name, adapter_type, enabled)
        VALUES (${companyId}, 'duplicate-target', 'claude_local', true)
      `),
    ).rejects.toThrow(/duplicate key|unique|23505/i);
  });

  it("allows a new active row when the previous one is archived (partial index excludes archived rows)", async () => {
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, enabled, archived_at)
      VALUES (${companyId}, 'recreate-target', 'claude_local', true, NOW())
    `);
    // Recreate as active — must succeed because archived_at IS NOT NULL on the previous row.
    await expect(
      db.execute(sql`
        INSERT INTO agents (company_id, name, adapter_type, enabled)
        VALUES (${companyId}, 'recreate-target', 'claude_local', true)
      `),
    ).resolves.not.toThrow();
  });

  it("allows the same name in two different companies", async () => {
    const otherCompany = "00000000-0000-0000-0000-0000000ba002";
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${otherCompany}, 'OtherCo', 'OTHC') ON CONFLICT DO NOTHING`,
    );
    await db.execute(sql`
      INSERT INTO agents (company_id, name, adapter_type, enabled)
      VALUES (${companyId}, 'cross-tenant-name', 'claude_local', true)
    `);
    await expect(
      db.execute(sql`
        INSERT INTO agents (company_id, name, adapter_type, enabled)
        VALUES (${otherCompany}, 'cross-tenant-name', 'claude_local', true)
      `),
    ).resolves.not.toThrow();
  });
});
