import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import {
  setupTestDb,
  teardownTestDb,
  cleanTestDb,
  createTestCompany,
  createTestUser,
} from "@mnm/test-utils";
import {
  type Db,
  userSoundSettings,
} from "@mnm/db";

/**
 * USER-SOUND-SETTINGS — RLS runtime test on user_sound_settings.
 *
 * Mirrors the two-client pattern from `github-apps.rls.e2e.test.ts`. Three layers:
 *
 *   1. Policy structure check (pg_policy) — verifies migration 0086 created
 *      `tenant_isolation` (RESTRICTIVE) + `tenant_baseline_permissive`
 *      (PERMISSIVE) on user_sound_settings.
 *   2. Fail-closed runtime check — empty tenant context → 0 rows visible.
 *   3. Tenant-isolation runtime check — user A can only see A's rows.
 *
 * Two-client design — RLS bypass on superusers + connection pinning:
 *   • `superDb`: setupTestDb() (often superuser → bypass RLS). Used for
 *     migrations + seed.
 *   • `subjectClient`: postgres() with `max:1`, NOBYPASSRLS role. Runs RLS
 *     assertions inside `begin()` transactions for connection pinning +
 *     `SET LOCAL` scoping.
 *
 * Migration 0086 already includes `tenant_baseline_permissive` per
 * database.md §2 (no need for the temporary policy injection that was
 * required for Sprint 1 tables before migration 0080).
 */

const RLS_TEST_ROLE = "mnm_rls_test_subject";
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/mnm_test";

let superDb: Db;
let subjectSqlClient: ReturnType<typeof postgres>;

async function superSetTenant(companyId: string): Promise<void> {
  await superDb.execute(
    sql`SELECT set_config('app.current_company_id', ${companyId}, false)`,
  );
}
async function superClearTenant(): Promise<void> {
  await superDb.execute(sql`SELECT set_config('app.current_company_id', '', false)`);
}

beforeAll(async () => {
  superDb = await setupTestDb();
  await cleanTestDb(superDb);

  await superDb.execute(
    sql.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_TEST_ROLE}') THEN
          CREATE ROLE ${RLS_TEST_ROLE} LOGIN PASSWORD '${RLS_TEST_ROLE}_pw';
        END IF;
      END
      $$;
    `),
  );
  await superDb.execute(sql.raw(`ALTER ROLE ${RLS_TEST_ROLE} NOBYPASSRLS NOSUPERUSER`));
  await superDb.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO ${RLS_TEST_ROLE}`));
  await superDb.execute(
    sql.raw(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RLS_TEST_ROLE}`,
    ),
  );
  await superDb.execute(
    sql.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RLS_TEST_ROLE}`),
  );

  const baseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const parsed = new URL(baseUrl);
  parsed.username = RLS_TEST_ROLE;
  parsed.password = `${RLS_TEST_ROLE}_pw`;
  subjectSqlClient = postgres(parsed.toString(), {
    max: 1,
    connection: { application_name: "mnm-rls-subject-sound", client_encoding: "UTF8" },
  });
}, 30_000);

afterAll(async () => {
  await subjectSqlClient?.end();
  await superClearTenant();
  await cleanTestDb(superDb);
  await teardownTestDb(superDb);
});

// ─── 1. Policy structure check ────────────────────────────────────────────────

describe("user_sound_settings — RLS policy structure (layer 1)", () => {
  it("has tenant_isolation RESTRICTIVE + tenant_baseline_permissive PERMISSIVE on company_id", async () => {
    const policies = await superDb.execute(
      sql`SELECT polname, polcmd::text as polcmd, polpermissive,
                 pg_get_expr(polqual, polrelid) as expr
          FROM pg_policy
          WHERE polrelid::regclass::text = ${"user_sound_settings"}
          ORDER BY polname`,
    );
    const rows = policies as unknown as Array<{
      polname: string;
      polcmd: string;
      polpermissive: boolean;
      expr: string;
    }>;
    // Migration 0086 declares both policies up-front (database.md §2).
    expect(rows).toHaveLength(2);

    const baseline = rows.find((p) => p.polname === "tenant_baseline_permissive");
    expect(baseline, "expected tenant_baseline_permissive policy from 0086").toBeDefined();
    expect(baseline?.polcmd).toBe("*");
    expect(baseline?.polpermissive).toBe(true);
    expect(baseline?.expr).toBe("true");

    const tenantIsolation = rows.find((p) => p.polname === "tenant_isolation");
    expect(tenantIsolation, "expected tenant_isolation policy from 0086").toBeDefined();
    expect(tenantIsolation?.polcmd).toBe("*");
    expect(tenantIsolation?.polpermissive).toBe(false);
    expect(tenantIsolation?.expr).toContain("app.current_company_id");
    expect(tenantIsolation?.expr).toContain("company_id");

    // FORCE enabled
    const forceRow = await superDb.execute(
      sql`SELECT relforcerowsecurity FROM pg_class
          WHERE oid = ${"user_sound_settings"}::regclass`,
    );
    const forceRows = forceRow as unknown as Array<{ relforcerowsecurity: boolean }>;
    expect(forceRows[0].relforcerowsecurity).toBe(true);
  });
});

// ─── 2. + 3. Runtime checks ──────────────────────────────────────────────────

describe("user_sound_settings — RLS runtime isolation (layers 2+3)", () => {
  let companyA: { id: string };
  let companyB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let rowBId: string;

  beforeAll(async () => {
    companyA = await createTestCompany(superDb, { name: "RLS-SND-A", issuePrefix: "SA" });
    companyB = await createTestCompany(superDb, { name: "RLS-SND-B", issuePrefix: "SB" });
    userA = await createTestUser(superDb);
    userB = await createTestUser(superDb);

    // Insert sound settings for company A
    await superSetTenant(companyA.id);
    await superDb.insert(userSoundSettings).values({
      companyId: companyA.id,
      userId: userA.id,
      enabled: true,
      volume: 60,
      tones: { info: "none", success: "builtin:chime", warn: "none", error: "none" },
    });

    // Insert sound settings for company B
    await superSetTenant(companyB.id);
    const [insertedB] = await superDb
      .insert(userSoundSettings)
      .values({
        companyId: companyB.id,
        userId: userB.id,
        enabled: false,
        volume: 80,
        tones: { info: "none", success: "none", warn: "builtin:bell", error: "none" },
      })
      .returning();
    rowBId = insertedB.id;

    await superClearTenant();
  }, 30_000);

  it("layer 2 — fail-closed: empty tenant ctx blocks SELECT (RESTRICTIVE filter)", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      return tx.unsafe(`SELECT id FROM user_sound_settings`);
    });
    expect(rows).toHaveLength(0);
  });

  it("layer 3 — tenant A sees only A's user_sound_settings row", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(`SELECT user_id, volume FROM user_sound_settings`);
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as unknown as { volume: number }).volume).toBe(60);
  });

  it("layer 3 — tenant B sees only B's user_sound_settings row", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(`SELECT user_id, volume FROM user_sound_settings`);
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as unknown as { volume: number }).volume).toBe(80);
  });

  it("layer 3 — UPDATE under tenant A cannot mutate tenant B user_sound_settings row", async () => {
    const updated = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(
        `UPDATE user_sound_settings SET volume = 0 WHERE id = '${rowBId}'::uuid RETURNING id`,
      );
    });
    expect(updated).toHaveLength(0);

    const rowB = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(
        `SELECT volume FROM user_sound_settings WHERE id = '${rowBId}'::uuid`,
      );
    });
    expect(rowB).toHaveLength(1);
    expect((rowB[0] as unknown as { volume: number }).volume).toBe(80);
  });
});
