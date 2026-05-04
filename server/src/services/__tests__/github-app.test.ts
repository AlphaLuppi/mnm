import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  githubAppService,
  GitHubAppError,
  _resetGitHubAppCacheForTests,
} from "../github-app.js";
import { encryptSecret } from "../secret-crypto.js";

// ─── Test PEM (PKCS#8) ────────────────────────────────────────────────────────
// Generated once at module load — small enough (RSA-2048) to keep total test
// time under 300ms while guaranteeing a real, importable PKCS#8 PEM that
// `jose.importPKCS8` accepts.
let TEST_PRIVATE_KEY_PEM = "";

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  TEST_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
});

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const CONNECTOR_ID = "00000000-0000-0000-0000-000000000002";
const APP_ID_TEXT = "12345";
const USER_ID = "user-tom";

beforeEach(() => {
  _resetGitHubAppCacheForTests();
  vi.restoreAllMocks();
});

// ─── DB mock helpers ──────────────────────────────────────────────────────────

interface QueueRows {
  rows: unknown[];
}

function buildSelectQueue(queue: QueueRows[]) {
  let i = 0;
  return vi.fn(() => {
    const entry = queue[i++] ?? { rows: [] };
    const rows = entry.rows;
    return {
      from: () => ({
        where: () => {
          const result = Object.assign(Promise.resolve(rows), {
            limit: () => Promise.resolve(rows),
          });
          return result;
        },
      }),
    };
  });
}

interface BuildDbOpts {
  selectQueue: QueueRows[];
  insertReturning?: unknown[];
  insertImpl?: ReturnType<typeof vi.fn>;
  updateImpl?: ReturnType<typeof vi.fn>;
  txImpl?: (fn: (tx: unknown) => unknown) => unknown;
}

// Recursive shape of the mock — `transaction` callback receives the same
// shape, hence the explicit annotation to satisfy ts strict mode (no
// implicit return any from the recursive call).
type MockDb = Parameters<typeof githubAppService>[0];

function buildDb(opts: BuildDbOpts): MockDb {
  const insertImpl =
    opts.insertImpl ??
    vi.fn(() => ({
      values: () => ({
        returning: () => Promise.resolve(opts.insertReturning ?? [{}]),
        onConflictDoUpdate: () => Promise.resolve(),
      }),
    }));
  const updateImpl =
    opts.updateImpl ??
    vi.fn(() => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }));
  const txFallback = (fn: (tx: unknown) => unknown): unknown => {
    return fn(buildDb({ ...opts, txImpl: undefined }));
  };
  return {
    select: buildSelectQueue(opts.selectQueue),
    insert: insertImpl,
    update: updateImpl,
    delete: vi.fn(() => ({ where: () => Promise.resolve() })),
    execute: vi.fn(async () => []),
    transaction: opts.txImpl ?? vi.fn(async (fn: (tx: unknown) => unknown) => txFallback(fn)),
  } as unknown as MockDb;
}

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("githubAppService.createGitHubApp", () => {
  it("validates connector exists, type=oauth2 and slug=github", async () => {
    const db = buildDb({
      selectQueue: [{ rows: [] }], // no connector found
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    await expect(
      svc.createGitHubApp({
        companyId: COMPANY_ID,
        connectorId: CONNECTOR_ID,
        userId: USER_ID,
        appId: APP_ID_TEXT,
        privateKey: TEST_PRIVATE_KEY_PEM,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects api_key connector with badRequest", async () => {
    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: CONNECTOR_ID,
              companyId: COMPANY_ID,
              providerSlug: "github",
              type: "api_key",
            },
          ],
        },
      ],
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    await expect(
      svc.createGitHubApp({
        companyId: COMPANY_ID,
        connectorId: CONNECTOR_ID,
        userId: USER_ID,
        appId: APP_ID_TEXT,
        privateKey: TEST_PRIVATE_KEY_PEM,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects connector with non-github slug", async () => {
    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: CONNECTOR_ID,
              companyId: COMPANY_ID,
              providerSlug: "gitlab",
              type: "oauth2",
            },
          ],
        },
      ],
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    await expect(
      svc.createGitHubApp({
        companyId: COMPANY_ID,
        connectorId: CONNECTOR_ID,
        userId: USER_ID,
        appId: APP_ID_TEXT,
        privateKey: TEST_PRIVATE_KEY_PEM,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an invalid private key with badRequest", async () => {
    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: CONNECTOR_ID,
              companyId: COMPANY_ID,
              providerSlug: "github",
              type: "oauth2",
            },
          ],
        },
      ],
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    await expect(
      svc.createGitHubApp({
        companyId: COMPANY_ID,
        connectorId: CONNECTOR_ID,
        userId: USER_ID,
        appId: APP_ID_TEXT,
        privateKey: "not-a-pem",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects credentials when GitHub /app returns 401", async () => {
    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: CONNECTOR_ID,
              companyId: COMPANY_ID,
              providerSlug: "github",
              type: "oauth2",
            },
          ],
        },
      ],
    });
    const fetchImpl = vi.fn(async () => jsonResponse(401, { message: "Bad credentials" })) as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    await expect(
      svc.createGitHubApp({
        companyId: COMPANY_ID,
        connectorId: CONNECTOR_ID,
        userId: USER_ID,
        appId: APP_ID_TEXT,
        privateKey: TEST_PRIVATE_KEY_PEM,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("encrypts private key + persists row on happy path", async () => {
    const insertedRow = {
      id: "00000000-0000-0000-0000-000000000099",
      appId: APP_ID_TEXT,
      appSlug: "mnm-test-app",
      createdAt: new Date(),
      revokedAt: null,
    };
    const valuesSpy = vi.fn(() => ({
      returning: () => Promise.resolve([insertedRow]),
      onConflictDoUpdate: () => Promise.resolve(),
    }));
    const insertImpl = vi.fn((_table) => ({ values: valuesSpy }));

    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: CONNECTOR_ID,
              companyId: COMPANY_ID,
              providerSlug: "github",
              type: "oauth2",
            },
          ],
        },
      ],
      insertImpl,
    });
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        id: 12345,
        slug: "mnm-test-app",
        name: "MnM Test App",
      }),
    ) as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    const out = await svc.createGitHubApp({
      companyId: COMPANY_ID,
      connectorId: CONNECTOR_ID,
      userId: USER_ID,
      appId: APP_ID_TEXT,
      privateKey: TEST_PRIVATE_KEY_PEM,
      webhookSecret: "wh-secret",
    });

    expect(out.appSlug).toBe("mnm-test-app");
    // Private key must NEVER be in the returned object.
    expect(JSON.stringify(out)).not.toContain("PRIVATE KEY");
    expect(JSON.stringify(out)).not.toContain("wh-secret");

    // Inspect what was actually persisted: the values arg of the first
    // insert call should hold encrypted columns, NEVER the plaintext PEM
    // or webhook secret. valuesSpy is called twice — once for the App
    // insert (returns insertedRow) and once for the audit log insert.
    // We care about the App insert here (the one with encrypted columns).
    const appInsertCall = (valuesSpy.mock.calls as unknown[][]).find(
      (c) => {
        const arg = c[0] as Record<string, unknown> | undefined;
        return arg !== undefined && typeof arg.privateKeyIv === "string";
      },
    );
    expect(appInsertCall).toBeDefined();
    const insertedValues = (appInsertCall as unknown[])[0] as Record<string, unknown>;
    expect(insertedValues.privateKeyIv).toBeTypeOf("string");
    expect(insertedValues.privateKeyCiphertext).toBeTypeOf("string");
    expect(insertedValues.privateKeyTag).toBeTypeOf("string");
    expect(insertedValues.webhookSecretIv).toBeTypeOf("string");
    // No raw PEM smuggled into the row
    const serialized = JSON.stringify(insertedValues);
    expect(serialized).not.toContain("PRIVATE KEY");
    expect(serialized).not.toContain("wh-secret");
  });

  it("maps unique violation (existing App) to 409 conflict", async () => {
    const valuesSpy = vi.fn(() => ({
      returning: () => {
        const err = new Error("dup") as Error & { code?: string };
        err.code = "23505";
        return Promise.reject(err);
      },
      onConflictDoUpdate: () => Promise.resolve(),
    }));
    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: CONNECTOR_ID,
              companyId: COMPANY_ID,
              providerSlug: "github",
              type: "oauth2",
            },
          ],
        },
      ],
      insertImpl: vi.fn(() => ({ values: valuesSpy })),
    });
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { id: 12345, slug: "mnm", name: "MnM" }),
    ) as unknown as typeof fetch;
    const svc = githubAppService(db, { fetchImpl });

    await expect(
      svc.createGitHubApp({
        companyId: COMPANY_ID,
        connectorId: CONNECTOR_ID,
        userId: USER_ID,
        appId: APP_ID_TEXT,
        privateKey: TEST_PRIVATE_KEY_PEM,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("githubAppService.getGitHubAppByConnector", () => {
  it("returns null when no App is attached to the connector", async () => {
    const db = buildDb({ selectQueue: [{ rows: [] }] });
    const svc = githubAppService(db);
    const out = await svc.getGitHubAppByConnector(COMPANY_ID, CONNECTOR_ID);
    expect(out).toBeNull();
  });

  it("returns app metadata (no private key fields)", async () => {
    const enc = encryptSecret(TEST_PRIVATE_KEY_PEM);
    const db = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: "app-row-id",
              appId: APP_ID_TEXT,
              appSlug: "mnm-test-app",
              createdAt: new Date("2026-05-04T00:00:00Z"),
              revokedAt: null,
              connectorId: CONNECTOR_ID,
              companyId: COMPANY_ID,
              privateKeyIv: enc.iv,
              privateKeyCiphertext: enc.ciphertext,
              privateKeyTag: enc.tag,
            },
          ],
        },
      ],
    });
    const svc = githubAppService(db);
    const out = await svc.getGitHubAppByConnector(COMPANY_ID, CONNECTOR_ID);
    expect(out).toEqual({
      id: "app-row-id",
      appId: APP_ID_TEXT,
      appSlug: "mnm-test-app",
      createdAt: new Date("2026-05-04T00:00:00Z"),
      revokedAt: null,
    });
    // Sanity: serialized form must NEVER include the private key columns
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("privateKey");
  });
});

describe("githubAppService.assertInstallationActive", () => {
  it("notFound when installation row missing", async () => {
    const db = buildDb({ selectQueue: [{ rows: [] }] });
    const svc = githubAppService(db);
    await expect(
      svc.assertInstallationActive("app-1", "inst-1"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("conflict when installation suspended_at IS NOT NULL", async () => {
    const db = buildDb({
      selectQueue: [
        { rows: [{ suspendedAt: new Date("2026-04-01T00:00:00Z") }] },
      ],
    });
    const svc = githubAppService(db);
    await expect(
      svc.assertInstallationActive("app-1", "inst-1"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("resolves when not suspended", async () => {
    const db = buildDb({
      selectQueue: [{ rows: [{ suspendedAt: null }] }],
    });
    const svc = githubAppService(db);
    await expect(
      svc.assertInstallationActive("app-1", "inst-1"),
    ).resolves.toBeUndefined();
  });
});

describe("githubAppService.mintInstallationToken — error paths", () => {
  it("notFound when App is missing or revoked", async () => {
    // The service opens a transaction → inside, the first .select() returns
    // [] (no App row).
    const db = buildDb({
      selectQueue: [{ rows: [] }, { rows: [] }],
    });
    const svc = githubAppService(db);
    await expect(
      svc.mintInstallationToken({
        companyId: COMPANY_ID,
        githubAppId: "app-1",
        installationId: "inst-1",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("GitHubAppError when GitHub returns 401 (suspension marker)", async () => {
    const enc = encryptSecret(TEST_PRIVATE_KEY_PEM);
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { message: "Bad credentials" }),
    ) as unknown as typeof fetch;
    // Inside tx: 1) select App row, 2) select installation row.
    const txDb = buildDb({
      selectQueue: [
        {
          rows: [
            {
              id: "app-1",
              appId: APP_ID_TEXT,
              companyId: COMPANY_ID,
              privateKeyIv: enc.iv,
              privateKeyCiphertext: enc.ciphertext,
              privateKeyTag: enc.tag,
            },
          ],
        },
        {
          rows: [
            {
              id: "inst-row",
              installationId: "inst-1",
              suspendedAt: null,
            },
          ],
        },
      ],
    });
    const db = buildDb({
      selectQueue: [],
      txImpl: async (fn) => fn(txDb),
    });
    const svc = githubAppService(db, { fetchImpl });
    await expect(
      svc.mintInstallationToken({
        companyId: COMPANY_ID,
        githubAppId: "app-1",
        installationId: "inst-1",
      }),
    ).rejects.toBeInstanceOf(GitHubAppError);
  });
});
