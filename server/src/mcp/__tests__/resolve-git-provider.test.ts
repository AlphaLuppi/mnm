import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import type { Db } from "@mnm/db";
import { createResolveGitProvider } from "../build-mcp-services.js";

// Integration tests: seed real rows into config_layers + config_layer_items
// and assert createResolveGitProvider picks them up via the direct SQL query.
// We seed a fresh company per test to avoid cross-test interference (the
// resolver caches per companyId for process lifetime).
describe("createResolveGitProvider (integration)", () => {
  let db: Db;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper — seeds a company and optionally a git_provider config_layer_item
  // in a company-scoped enforced layer. Returns the new companyId (uuid).
  async function seedCompany(
    configJson: Record<string, unknown> | null,
    opts: {
      enforced?: boolean;
      scope?: string;
      visibility?: string;
      enabled?: boolean;
      archived?: boolean;
    } = {},
  ): Promise<string> {
    const companyId = crypto.randomUUID();
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    await db.execute(
      sql`INSERT INTO companies (id, name, issue_prefix) VALUES (${companyId}, ${"RGP-" + suffix}, ${"RGP" + suffix})`,
    );
    if (configJson !== null) {
      const scope = opts.scope ?? "company";
      // Check-constraint: (private,private) | (shared,team|public) | (company,public)
      const defaultVisibility =
        scope === "private" ? "private" : scope === "shared" ? "team" : "public";
      const layerRows = await db.execute(
        sql`INSERT INTO config_layers
              (company_id, name, scope, enforced, visibility, created_by_user_id, archived_at)
            VALUES
              (${companyId}, ${"git-" + suffix}, ${scope}, ${opts.enforced ?? true}, ${opts.visibility ?? defaultVisibility}, 'test-user',
               ${opts.archived ? sql`NOW()` : sql`NULL`})
            RETURNING id::text AS id`,
      );
      const layerId = (layerRows as unknown as Array<{ id: string }>)[0]!.id;
      await db.execute(
        sql`INSERT INTO config_layer_items
              (company_id, layer_id, item_type, name, config_json, enabled)
            VALUES
              (${companyId}, ${layerId}::uuid, 'git_provider', 'default', ${JSON.stringify(configJson)}::jsonb, ${opts.enabled ?? true})`,
      );
    }
    return companyId;
  }

  it("returns company-specific GitlabProvider when git_provider item exists", async () => {
    const companyId = await seedCompany({
      kind: "gitlab",
      providerId: "gitlab:acme",
      baseUrl: "https://gitlab.acme.internal",
      projectId: "42",
      token: "ACME_TOKEN",
    });

    const resolve = createResolveGitProvider(db);
    const provider = await resolve(companyId);

    expect(provider.constructor.name).toBe("GitlabProvider");
    expect((provider as unknown as { providerId: string }).providerId).toBe("gitlab:acme");
  });

  it("caches providers per companyId (same instance across calls)", async () => {
    const companyId = await seedCompany({
      kind: "gitlab",
      providerId: "gitlab:acme",
      baseUrl: "x",
      projectId: "1",
      token: "t",
    });
    const resolve = createResolveGitProvider(db);
    const p1 = await resolve(companyId);
    const p2 = await resolve(companyId);
    expect(p1).toBe(p2);
  });

  it("returns distinct providers for distinct companies", async () => {
    const acmeId = await seedCompany({
      kind: "gitlab", providerId: "gitlab:acme", baseUrl: "x", projectId: "1", token: "t1",
    });
    const globexId = await seedCompany({
      kind: "gitlab", providerId: "gitlab:globex", baseUrl: "y", projectId: "2", token: "t2",
    });
    const resolve = createResolveGitProvider(db);
    const pA = await resolve(acmeId);
    const pG = await resolve(globexId);
    expect(pA).not.toBe(pG);
    expect((pA as unknown as { providerId: string }).providerId).toBe("gitlab:acme");
    expect((pG as unknown as { providerId: string }).providerId).toBe("gitlab:globex");
  });

  it("falls back to env-var provider when company has no git_provider item (dev mode)", async () => {
    const companyId = await seedCompany(null);
    process.env.MNM_GIT_PROVIDER = "local";
    process.env.MNM_GIT_LOCAL_PATH = "./_fixtures/mnm-workflows-bare";
    const resolve = createResolveGitProvider(db);
    const provider = await resolve(companyId);
    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
  });

  it("falls back to env-var provider when the layer is archived", async () => {
    const companyId = await seedCompany(
      { kind: "gitlab", providerId: "p", baseUrl: "x", projectId: "1", token: "t" },
      { archived: true },
    );
    process.env.MNM_GIT_PROVIDER = "local";
    process.env.MNM_GIT_LOCAL_PATH = "./_fixtures/mnm-workflows-bare";
    const resolve = createResolveGitProvider(db);
    const provider = await resolve(companyId);
    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
  });

  it("falls back to env-var provider when layer scope is not 'company'", async () => {
    const companyId = await seedCompany(
      { kind: "gitlab", providerId: "p", baseUrl: "x", projectId: "1", token: "t" },
      { scope: "private", enforced: false },
    );
    process.env.MNM_GIT_PROVIDER = "local";
    process.env.MNM_GIT_LOCAL_PATH = "./_fixtures/mnm-workflows-bare";
    const resolve = createResolveGitProvider(db);
    const provider = await resolve(companyId);
    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
  });

  it("throws GovernedWorkflowError with code GIT_PROVIDER_MISCONFIG when kind is unknown", async () => {
    const companyId = await seedCompany({ kind: "unknown-vendor" });
    const resolve = createResolveGitProvider(db);
    await expect(resolve(companyId)).rejects.toMatchObject({
      name: "GovernedWorkflowError",
      code: "GIT_PROVIDER_MISCONFIG",
      message: expect.stringContaining("unknown kind"),
      hints: [expect.stringContaining("'gitlab' and 'local'")],
    });
  });

  it("throws GIT_PROVIDER_MISCONFIG when gitlab fields are missing", async () => {
    const companyId = await seedCompany({ kind: "gitlab", baseUrl: "x" });
    const resolve = createResolveGitProvider(db);
    await expect(resolve(companyId)).rejects.toMatchObject({
      name: "GovernedWorkflowError",
      code: "GIT_PROVIDER_MISCONFIG",
      message: expect.stringContaining("gitlab"),
      hints: [expect.stringContaining("providerId")],
    });
  });

  it("throws GIT_PROVIDER_MISCONFIG when local fields are missing", async () => {
    const companyId = await seedCompany({ kind: "local", providerId: "p" }); // missing repoDir
    const resolve = createResolveGitProvider(db);
    await expect(resolve(companyId)).rejects.toMatchObject({
      name: "GovernedWorkflowError",
      code: "GIT_PROVIDER_MISCONFIG",
      message: expect.stringContaining("local"),
      hints: [expect.stringContaining("repoDir")],
    });
  });

  it("builds LocalBareRepoProvider when kind='local' with all fields", async () => {
    const companyId = await seedCompany({
      kind: "local",
      providerId: "local:acme",
      repoDir: "/tmp/acme-repo",
    });
    const resolve = createResolveGitProvider(db);
    const provider = await resolve(companyId);
    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
    expect((provider as unknown as { providerId: string }).providerId).toBe("local:acme");
  });
});
