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
  companyMemberships,
  oauthConnectors,
  connectorTokens,
} from "@mnm/db";
import { encryptSecret } from "../services/secret-crypto.js";

/**
 * HIGH-Q3 — RLS runtime test on Sprint 1 tables.
 *
 * Validates the migration 0079 RESTRICTIVE FORCE policy via three layers:
 *
 *   1. Policy structure check (pg_policy) — verifies the migration created
 *      `tenant_isolation` policy on each Sprint 1 tenant-scoped table with
 *      RESTRICTIVE permissivity, FOR ALL command, and the expected USING
 *      clause referencing `app.current_company_id::uuid`.
 *
 *   2. Fail-closed runtime check — with `app.current_company_id` empty (or
 *      cast to NULL), any non-superuser SELECT returns 0 rows.
 *
 *   3. Tenant-isolation runtime check — pairs the migration's RESTRICTIVE
 *      policy with a TEMPORARY PERMISSIVE policy created in this test (and
 *      dropped at end). This proves the RESTRICTIVE clause correctly filters
 *      rows by `company_id` when a permissive baseline allows access. The
 *      temporary policy mirrors the future architectural fix that should be
 *      made repo-wide for tables 0030+ (current pattern is RESTRICTIVE-only,
 *      which produces default-deny — works in prod only because the app's
 *      `mnm` user has BYPASSRLS, which itself is a separate finding).
 *
 * Two-client design — RLS bypass on superusers + connection pinning:
 *   • `superDb`: standard `setupTestDb()` (often a superuser → bypass RLS).
 *     Used for migrations + seed.
 *   • `subjectClient`: `postgres()` with `max: 1`, connected as a non-super
 *     `NOBYPASSRLS` role created here. RLS assertions run via this client
 *     inside `begin()` transactions for connection pinning + `SET LOCAL`
 *     scoping.
 *
 * Requires a running test PostgreSQL (DATABASE_URL env or default
 * postgres://postgres:postgres@localhost:5433/mnm_test). Use:
 *   bun run test:docker:up
 * to start it, or point DATABASE_URL at the embedded dev postgres on a
 * dedicated DB (e.g. `mnm_test_rls`).
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
    connection: { application_name: "mnm-rls-subject", client_encoding: "UTF8" },
  });
}, 30_000);

afterAll(async () => {
  await subjectSqlClient?.end();
  await superClearTenant();
  await cleanTestDb(superDb);
  await teardownTestDb(superDb);
});

// ─── 1. Policy structure check ────────────────────────────────────────────────

describe("Sprint 1 tables — RLS policy structure (HIGH-Q3 layer 1)", () => {
  const tables = [
    "oauth_connectors",
    "connector_tokens",
    "user_api_keys",
    "oauth_connectors_audit",
  ];

  it.each(tables)(
    "%s has tenant_isolation RESTRICTIVE + tenant_baseline_permissive PERMISSIVE on company_id",
    async (table) => {
      const policies = await superDb.execute(
        sql`SELECT polname, polcmd::text as polcmd, polpermissive,
                   pg_get_expr(polqual, polrelid) as expr
            FROM pg_policy
            WHERE polrelid::regclass::text = ${table}
            ORDER BY polname`,
      );
      const rows = policies as unknown as Array<{
        polname: string;
        polcmd: string;
        polpermissive: boolean;
        expr: string;
      }>;
      // Post-migration 0080 — every tenant table has TWO policies:
      //   1. tenant_baseline_permissive (PERMISSIVE FOR ALL USING true) — unblocks default-deny
      //   2. tenant_isolation (RESTRICTIVE FOR ALL USING company_id = ...) — narrows to tenant
      expect(rows).toHaveLength(2);

      const baseline = rows.find((p) => p.polname === "tenant_baseline_permissive");
      expect(baseline, "expected tenant_baseline_permissive policy from 0080").toBeDefined();
      expect(baseline?.polcmd).toBe("*");
      expect(baseline?.polpermissive).toBe(true);
      expect(baseline?.expr).toBe("true");

      const tenantIsolation = rows.find((p) => p.polname === "tenant_isolation");
      expect(tenantIsolation, "expected tenant_isolation policy from 0079").toBeDefined();
      expect(tenantIsolation?.polcmd).toBe("*");
      expect(tenantIsolation?.polpermissive).toBe(false);
      expect(tenantIsolation?.expr).toContain("app.current_company_id");
      expect(tenantIsolation?.expr).toContain("company_id");

      // Verify FORCE is enabled (relforcerowsecurity)
      const forceRow = await superDb.execute(
        sql`SELECT relforcerowsecurity FROM pg_class
            WHERE oid = ${table}::regclass`,
      );
      const forceRows = forceRow as unknown as Array<{ relforcerowsecurity: boolean }>;
      expect(forceRows[0].relforcerowsecurity).toBe(true);
    },
  );
});

// ─── 2. + 3. Runtime checks ──────────────────────────────────────────────────

describe("Sprint 1 tables — RLS runtime isolation (HIGH-Q3 layers 2+3)", () => {
  let companyA: { id: string };
  let companyB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let connectorBId: string;

  // Migration 0080 (NEW-S1 fix) now provides a `tenant_baseline_permissive`
  // PERMISSIVE policy on every tenant-scoped table, replacing the temporary
  // `rls_test_permissive_baseline` hack this suite used to inject. The
  // RESTRICTIVE `tenant_isolation` filter narrows the baseline to the matching
  // tenant. See packages/db/src/migrations/0080_rls_permissive_baseline.sql.

  beforeAll(async () => {
    // Seed
    companyA = await createTestCompany(superDb, { name: "RLS-A", issuePrefix: "RA" });
    companyB = await createTestCompany(superDb, { name: "RLS-B", issuePrefix: "RB" });
    userA = await createTestUser(superDb);
    userB = await createTestUser(superDb);

    await superDb.insert(companyMemberships).values([
      {
        companyId: companyA.id,
        principalType: "user",
        principalId: userA.id,
        status: "active",
      },
      {
        companyId: companyB.id,
        principalType: "user",
        principalId: userB.id,
        status: "active",
      },
    ]);

    const csA = encryptSecret("client-secret-A");
    await superSetTenant(companyA.id);
    const [connA] = await superDb
      .insert(oauthConnectors)
      .values({
        companyId: companyA.id,
        providerSlug: "jira",
        displayName: "Jira A",
        type: "oauth2",
        authorizationUrl: "https://example-a.test/auth",
        tokenUrl: "https://example-a.test/token",
        clientId: "client-A",
        clientSecretIv: csA.iv,
        clientSecretCiphertext: csA.ciphertext,
        clientSecretTag: csA.tag,
        createdByUserId: userA.id,
      })
      .returning();
    const accA = encryptSecret("access-A");
    await superDb.insert(connectorTokens).values({
      companyId: companyA.id,
      userId: userA.id,
      connectorId: connA.id,
      accessTokenIv: accA.iv,
      accessTokenCiphertext: accA.ciphertext,
      accessTokenTag: accA.tag,
      scopesGranted: ["read"],
    });

    const csB = encryptSecret("client-secret-B");
    await superSetTenant(companyB.id);
    const [connB] = await superDb
      .insert(oauthConnectors)
      .values({
        companyId: companyB.id,
        providerSlug: "jira",
        displayName: "Jira B",
        type: "oauth2",
        authorizationUrl: "https://example-b.test/auth",
        tokenUrl: "https://example-b.test/token",
        clientId: "client-B",
        clientSecretIv: csB.iv,
        clientSecretCiphertext: csB.ciphertext,
        clientSecretTag: csB.tag,
        createdByUserId: userB.id,
      })
      .returning();
    connectorBId = connB.id;
    const accB = encryptSecret("access-B");
    await superDb.insert(connectorTokens).values({
      companyId: companyB.id,
      userId: userB.id,
      connectorId: connB.id,
      accessTokenIv: accB.iv,
      accessTokenCiphertext: accB.ciphertext,
      accessTokenTag: accB.tag,
      scopesGranted: ["read"],
    });

    await superClearTenant();
    // Migration 0080 already provides the PERMISSIVE baseline globally — no
    // need for a temporary policy injection here.
  }, 30_000);

  // Layer 2: fail-closed. The PERMISSIVE baseline (from migration 0080)
  // unblocks the row from postgres' default-deny; the RESTRICTIVE
  // tenant_isolation policy still rejects when no tenant context is set
  // (current_setting('app.current_company_id', true) → NULL → comparison
  // returns NULL → RESTRICTIVE rejects → 0 rows visible).
  it("layer 2 — fail-closed: empty tenant ctx blocks SELECT (RESTRICTIVE filter)", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      return tx.unsafe(`SELECT id FROM connector_tokens`);
    });
    expect(rows).toHaveLength(0);
  });

  it("layer 3 — tenant A sees only A's connector_tokens row", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(`SELECT id::text, company_id::text, user_id FROM connector_tokens`);
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as unknown as { company_id: string }).company_id).toBe(companyA.id);
    expect((rows[0] as unknown as { user_id: string }).user_id).toBe(userA.id);
  });

  it("layer 3 — tenant B sees only B's connector_tokens row", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(`SELECT id::text, company_id::text, user_id FROM connector_tokens`);
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as unknown as { company_id: string }).company_id).toBe(companyB.id);
    expect((rows[0] as unknown as { user_id: string }).user_id).toBe(userB.id);
  });

  it("layer 3 — oauth_connectors enforces the same isolation under both tenants", async () => {
    const rowsA = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(`SELECT id::text, company_id::text FROM oauth_connectors`);
    });
    expect(rowsA).toHaveLength(1);
    expect((rowsA[0] as unknown as { company_id: string }).company_id).toBe(companyA.id);

    const rowsB = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(`SELECT id::text, company_id::text FROM oauth_connectors`);
    });
    expect(rowsB).toHaveLength(1);
    expect((rowsB[0] as unknown as { company_id: string }).company_id).toBe(companyB.id);
  });

  it("layer 3 — UPDATE under tenant A cannot mutate tenant B rows", async () => {
    const updated = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(
        `UPDATE oauth_connectors SET display_name = 'MUTATED-CROSS-TENANT' WHERE id = '${connectorBId}'::uuid RETURNING id`,
      );
    });
    expect(updated).toHaveLength(0);

    const rowB = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(
        `SELECT display_name FROM oauth_connectors WHERE id = '${connectorBId}'::uuid`,
      );
    });
    expect(rowB).toHaveLength(1);
    expect((rowB[0] as unknown as { display_name: string }).display_name).toBe("Jira B");
  });
});
