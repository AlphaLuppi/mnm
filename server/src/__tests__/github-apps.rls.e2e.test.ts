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
  githubApps,
  githubAppInstallations,
} from "@mnm/db";
import { encryptSecret } from "../services/secret-crypto.js";

/**
 * GITHUB-PROVIDER Phase 1 — RLS runtime test on github_apps + github_app_installations.
 *
 * Mirrors the HIGH-Q3 pattern from `connector-tokens.rls.e2e.test.ts`. Three layers:
 *
 *   1. Policy structure check (pg_policy) — verifies migration 0085 created
 *      `tenant_isolation` (RESTRICTIVE) + `tenant_baseline_permissive`
 *      (PERMISSIVE) on each table.
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
 * Migration 0085 already includes `tenant_baseline_permissive` per
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
    connection: { application_name: "mnm-rls-subject-github", client_encoding: "UTF8" },
  });
}, 30_000);

afterAll(async () => {
  await subjectSqlClient?.end();
  await superClearTenant();
  await cleanTestDb(superDb);
  await teardownTestDb(superDb);
});

// ─── 1. Policy structure check ────────────────────────────────────────────────

describe("github-apps tables — RLS policy structure (layer 1)", () => {
  const tables = ["github_apps", "github_app_installations"];

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
      // Migration 0085 declares both policies up-front (database.md §2).
      expect(rows).toHaveLength(2);

      const baseline = rows.find((p) => p.polname === "tenant_baseline_permissive");
      expect(baseline, "expected tenant_baseline_permissive policy from 0085").toBeDefined();
      expect(baseline?.polcmd).toBe("*");
      expect(baseline?.polpermissive).toBe(true);
      expect(baseline?.expr).toBe("true");

      const tenantIsolation = rows.find((p) => p.polname === "tenant_isolation");
      expect(tenantIsolation, "expected tenant_isolation policy from 0085").toBeDefined();
      expect(tenantIsolation?.polcmd).toBe("*");
      expect(tenantIsolation?.polpermissive).toBe(false);
      expect(tenantIsolation?.expr).toContain("app.current_company_id");
      expect(tenantIsolation?.expr).toContain("company_id");

      // FORCE enabled
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

describe("github-apps tables — RLS runtime isolation (layers 2+3)", () => {
  let companyA: { id: string };
  let companyB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let appBId: string;

  beforeAll(async () => {
    companyA = await createTestCompany(superDb, { name: "RLS-GH-A", issuePrefix: "GA" });
    companyB = await createTestCompany(superDb, { name: "RLS-GH-B", issuePrefix: "GB" });
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

    // Connector A
    const csA = encryptSecret("client-secret-A");
    await superSetTenant(companyA.id);
    const [connA] = await superDb
      .insert(oauthConnectors)
      .values({
        companyId: companyA.id,
        providerSlug: "github",
        displayName: "GitHub A",
        type: "oauth2",
        authorizationUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        clientId: "client-A",
        clientSecretIv: csA.iv,
        clientSecretCiphertext: csA.ciphertext,
        clientSecretTag: csA.tag,
        createdByUserId: userA.id,
      })
      .returning();

    // App for company A
    const pkA = encryptSecret("FAKE-PEM-A");
    await superDb.insert(githubApps).values({
      companyId: companyA.id,
      connectorId: connA.id,
      appId: "111111",
      appSlug: "mnm-app-a",
      privateKeyIv: pkA.iv,
      privateKeyCiphertext: pkA.ciphertext,
      privateKeyTag: pkA.tag,
      createdByUserId: userA.id,
    });

    // Installation row for A
    const [appARow] = await superDb
      .select()
      .from(githubApps)
      .where(sql`company_id = ${companyA.id}::uuid`);
    await superDb.insert(githubAppInstallations).values({
      companyId: companyA.id,
      githubAppId: appARow.id,
      installationId: "1001",
      accountLogin: "acme-a",
      accountType: "Organization",
      accountId: BigInt(42),
      repositorySelection: "all",
    });

    // Connector + App + Installation for company B
    const csB = encryptSecret("client-secret-B");
    await superSetTenant(companyB.id);
    const [connB] = await superDb
      .insert(oauthConnectors)
      .values({
        companyId: companyB.id,
        providerSlug: "github",
        displayName: "GitHub B",
        type: "oauth2",
        authorizationUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        clientId: "client-B",
        clientSecretIv: csB.iv,
        clientSecretCiphertext: csB.ciphertext,
        clientSecretTag: csB.tag,
        createdByUserId: userB.id,
      })
      .returning();
    const pkB = encryptSecret("FAKE-PEM-B");
    const [insertedAppB] = await superDb
      .insert(githubApps)
      .values({
        companyId: companyB.id,
        connectorId: connB.id,
        appId: "222222",
        appSlug: "mnm-app-b",
        privateKeyIv: pkB.iv,
        privateKeyCiphertext: pkB.ciphertext,
        privateKeyTag: pkB.tag,
        createdByUserId: userB.id,
      })
      .returning();
    appBId = insertedAppB.id;
    await superDb.insert(githubAppInstallations).values({
      companyId: companyB.id,
      githubAppId: insertedAppB.id,
      installationId: "2002",
      accountLogin: "acme-b",
      accountType: "Organization",
      accountId: BigInt(43),
      repositorySelection: "selected",
    });

    await superClearTenant();
  }, 30_000);

  it("layer 2 — fail-closed: empty tenant ctx blocks SELECT (RESTRICTIVE filter)", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      return tx.unsafe(`SELECT id FROM github_apps`);
    });
    expect(rows).toHaveLength(0);
  });

  it("layer 2 — fail-closed: empty tenant ctx blocks SELECT on installations", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      return tx.unsafe(`SELECT id FROM github_app_installations`);
    });
    expect(rows).toHaveLength(0);
  });

  it("layer 3 — tenant A sees only A's github_apps row", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(`SELECT app_slug FROM github_apps`);
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as unknown as { app_slug: string }).app_slug).toBe("mnm-app-a");
  });

  it("layer 3 — tenant B sees only B's github_apps row", async () => {
    const rows = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(`SELECT app_slug FROM github_apps`);
    });
    expect(rows).toHaveLength(1);
    expect((rows[0] as unknown as { app_slug: string }).app_slug).toBe("mnm-app-b");
  });

  it("layer 3 — github_app_installations enforces the same isolation", async () => {
    const rowsA = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(`SELECT account_login FROM github_app_installations`);
    });
    expect(rowsA).toHaveLength(1);
    expect((rowsA[0] as unknown as { account_login: string }).account_login).toBe("acme-a");

    const rowsB = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(`SELECT account_login FROM github_app_installations`);
    });
    expect(rowsB).toHaveLength(1);
    expect((rowsB[0] as unknown as { account_login: string }).account_login).toBe("acme-b");
  });

  it("layer 3 — UPDATE under tenant A cannot mutate tenant B github_apps row", async () => {
    const updated = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyA.id}'`);
      return tx.unsafe(
        `UPDATE github_apps SET app_slug = 'MUTATED-CROSS-TENANT' WHERE id = '${appBId}'::uuid RETURNING id`,
      );
    });
    expect(updated).toHaveLength(0);

    const rowB = await subjectSqlClient.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.current_company_id = '${companyB.id}'`);
      return tx.unsafe(
        `SELECT app_slug FROM github_apps WHERE id = '${appBId}'::uuid`,
      );
    });
    expect(rowB).toHaveLength(1);
    expect((rowB[0] as unknown as { app_slug: string }).app_slug).toBe("mnm-app-b");
  });
});
