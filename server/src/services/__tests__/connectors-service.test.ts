import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { connectorService, ConnectorError } from "../connectors.js";
import { encryptSecret } from "../secret-crypto.js";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

interface BuildDbOverrides {
  membership?: unknown[];
  connector?: unknown[] | null;
  selectImpl?: ReturnType<typeof vi.fn>;
  execute?: ReturnType<typeof vi.fn>;
}

/**
 * Builds a minimal Drizzle-shaped mock that supports the chains used by
 * `connectorService`:
 *   - `db.select(...).from(table).where(cond).limit(n)`     → assertUserInCompany
 *   - `db.select().from(table).where(cond)`                  → getActiveConnectorBySlug, etc.
 *   - `db.execute(sql)`                                     → set_config etc.
 *   - `db.insert(...).values(...).returning()`              → createConnector
 *   - `db.update(...).set(...).where(...).returning()`      → updateConnector
 *   - `db.transaction(async (tx) => ...)`                   → getUserToken refresh
 *
 * The mock returns whatever rows the test passes for the membership lookup
 * (first select in `assertUserInCompany`) and connector lookup (subsequent
 * select). To keep the chain shapes simple, every `.where()` returns a
 * thenable that ALSO has `.limit()` for chained `assertUserInCompany`.
 */
function buildDb(opts: BuildDbOverrides = {}) {
  const membershipRows = opts.membership ?? [];
  const connectorRows = opts.connector ?? [];

  let selectCallCount = 0;

  const defaultSelectImpl = vi.fn(() => {
    const callIndex = selectCallCount++;
    // First select call → membership lookup (assertUserInCompany)
    // Subsequent selects → connector / token lookups
    const rows: unknown[] = callIndex === 0 ? membershipRows : (connectorRows as unknown[]);
    const whereResult = Object.assign(Promise.resolve(rows), {
      limit: () => Promise.resolve(rows),
    });
    return {
      from: () => ({
        where: () => whereResult,
      }),
    };
  });

  return {
    execute: opts.execute ?? vi.fn(async () => []),
    select: opts.selectImpl ?? defaultSelectImpl,
    insert: vi.fn(() => ({
      values: () => ({
        returning: () => Promise.resolve([{}]),
        onConflictDoUpdate: () => ({ returning: () => Promise.resolve([{}]) }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{}]) }),
      }),
    })),
    delete: vi.fn(() => ({ where: () => Promise.resolve() })),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  } as unknown as Parameters<typeof connectorService>[0];
}

// ─── C2 cross-tenant guard ────────────────────────────────────────────────────

describe("connectors — C2 cross-tenant guard (assertUserInCompany)", () => {
  it("throws CONNECTOR_USER_NOT_IN_COMPANY when membership lookup returns empty", async () => {
    const db = buildDb({ membership: [] });
    const svc = connectorService(db);
    await expect(
      svc.assertUserInCompany("user-from-tenant-B", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toThrow(ConnectorError);
    await expect(
      svc.assertUserInCompany("user-from-tenant-B", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toMatchObject({ code: "CONNECTOR_USER_NOT_IN_COMPANY" });
  });

  it("does NOT throw when membership lookup returns at least one row", async () => {
    const db = buildDb({ membership: [{ id: "membership-1" }] });
    const svc = connectorService(db);
    await expect(
      svc.assertUserInCompany("user-A", "00000000-0000-0000-0000-00000000000A"),
    ).resolves.toBeUndefined();
  });

  it("calls select().from().where().limit() exactly once per check", async () => {
    const limitSpy = vi.fn(() => Promise.resolve([]));
    const whereSpy = vi.fn(() => ({ limit: limitSpy }));
    const fromSpy = vi.fn(() => ({ where: whereSpy }));
    const selectSpy = vi.fn(() => ({ from: fromSpy }));
    const db = buildDb({ selectImpl: selectSpy as unknown as ReturnType<typeof vi.fn> });
    const svc = connectorService(db);
    await svc
      .assertUserInCompany("u1", "00000000-0000-0000-0000-000000000001")
      .catch(() => undefined);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(whereSpy).toHaveBeenCalledTimes(1);
    expect(limitSpy).toHaveBeenCalledTimes(1);
    // Drizzle's `select({...})` receives the projection map. We don't assert
    // the table identity (Drizzle would catch a wrong table at compile time),
    // but we DO want to know the shape was preserved.
    const firstCallArgs = selectSpy.mock.calls[0] as unknown[] | undefined;
    expect(firstCallArgs?.[0]).toBeTypeOf("object");
  });
});

// ─── getUserToken: not connected paths ────────────────────────────────────────

describe("connectors — getUserToken error paths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws CONNECTOR_USER_NOT_IN_COMPANY first when cross-tenant", async () => {
    const db = buildDb({ membership: [] });
    const svc = connectorService(db);
    await expect(
      svc.getUserToken("user-x", "jira", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toMatchObject({ code: "CONNECTOR_USER_NOT_IN_COMPANY" });
  });

  it("throws CONNECTOR_NOT_CONFIGURED when no enabled connector matches the slug", async () => {
    const db = buildDb({
      membership: [{ id: "membership-1" }],
      connector: [], // no connector found
    });
    const svc = connectorService(db);
    await expect(
      svc.getUserToken("user-x", "jira", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toMatchObject({ code: "CONNECTOR_NOT_CONFIGURED" });
  });
});

// ─── HIGH-Q1: getUserToken full paths ────────────────────────────────────────
//
// Each test wires a small DB mock that returns rows in the order the service
// queries them:
//   1. membership lookup (assertUserInCompany)
//   2. connector lookup (getActiveConnectorBySlug)
//   3. token / api-key lookup
//   4. (oauth2 expired) re-read inside tx
//
// We also stub global `fetch` for the refresh path and the `db.transaction`
// callback for the inner re-read + update.

interface QueueRows {
  rows: unknown[];
  isLimit?: boolean;
}

function buildSelectQueue(queue: QueueRows[]) {
  let i = 0;
  return vi.fn(() => {
    const entry = queue[i++] ?? { rows: [] };
    const promise = Promise.resolve(entry.rows);
    const whereResult: { limit: () => Promise<unknown[]> } & Promise<unknown[]> =
      Object.assign(promise, { limit: () => Promise.resolve(entry.rows) });
    return {
      from: () => ({ where: () => whereResult }),
    };
  });
}

/**
 * `db.update(...).set(...).where(...)` returns a thenable that the service
 * code may chain `.catch(...)` on (fire-and-forget pattern). The base Promise
 * returned by `.where()` already supports `.catch`, so we can just resolve.
 */
function buildUpdateMock() {
  return vi.fn(() => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }));
}

const VALID_COMPANY_UUID = "00000000-0000-0000-0000-00000000000A";

describe("connectors — getUserToken full paths (HIGH-Q1)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("api_key happy path — returns decrypted key with type=api_key, expiresAt=null", async () => {
    const enc = encryptSecret("sk-OPENAI-secret-xyz");
    const apiKeyRow = {
      id: "k1",
      keyIv: enc.iv,
      keyCiphertext: enc.ciphertext,
      keyTag: enc.tag,
    };
    const connectorRow = {
      id: "c1",
      type: "api_key",
      enabled: true,
      providerSlug: "openai",
      companyId: VALID_COMPANY_UUID,
    };
    const db = {
      execute: vi.fn(async () => []),
      select: buildSelectQueue([
        { rows: [{ id: "m1" }] }, // membership
        { rows: [connectorRow] }, // connector by slug
        { rows: [apiKeyRow] }, // api key row
      ]),
      update: buildUpdateMock(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    } as unknown as Parameters<typeof connectorService>[0];

    const svc = connectorService(db);
    const result = await svc.getUserToken("user-1", "openai", VALID_COMPANY_UUID);
    expect(result.type).toBe("api_key");
    expect(result.accessToken).toBe("sk-OPENAI-secret-xyz");
    expect(result.expiresAt).toBeNull();
    expect(result.scopes).toEqual([]);
  });

  it("oauth2 EXPIRED_NO_REFRESH — token expired and no refresh material → throws", async () => {
    const expiredRow = {
      id: "t1",
      expiresAt: new Date(Date.now() - 1000),
      refreshTokenIv: null,
      refreshTokenCiphertext: null,
      refreshTokenTag: null,
    };
    const connectorRow = {
      id: "c1",
      type: "oauth2",
      enabled: true,
      providerSlug: "jira",
      companyId: VALID_COMPANY_UUID,
    };
    const db = {
      execute: vi.fn(async () => []),
      select: buildSelectQueue([
        { rows: [{ id: "m1" }] }, // membership
        { rows: [connectorRow] }, // connector
        { rows: [expiredRow] }, // token row (expired, no refresh)
      ]),
      update: buildUpdateMock(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    } as unknown as Parameters<typeof connectorService>[0];

    const svc = connectorService(db);
    await expect(svc.getUserToken("user-1", "jira", VALID_COMPANY_UUID)).rejects.toMatchObject({
      code: "CONNECTOR_TOKEN_EXPIRED_NO_REFRESH",
    });
  });

  it("oauth2 REVOKED — refresh attempt returns 401, MED-B1 nulls refresh material", async () => {
    const accessEnc = encryptSecret("old-access");
    const refreshEnc = encryptSecret("revoked-refresh");
    const clientSecretEnc = encryptSecret("client-secret-xyz");

    const tokenRow = {
      id: "t1",
      expiresAt: new Date(Date.now() - 1000),
      accessTokenIv: accessEnc.iv,
      accessTokenCiphertext: accessEnc.ciphertext,
      accessTokenTag: accessEnc.tag,
      refreshTokenIv: refreshEnc.iv,
      refreshTokenCiphertext: refreshEnc.ciphertext,
      refreshTokenTag: refreshEnc.tag,
      scopesGranted: ["read"],
    };
    const connectorRow = {
      id: "c1",
      type: "oauth2",
      enabled: true,
      providerSlug: "jira",
      companyId: VALID_COMPANY_UUID,
      tokenUrl: "https://example.test/token",
      clientId: "client-id",
      clientSecretIv: clientSecretEnc.iv,
      clientSecretCiphertext: clientSecretEnc.ciphertext,
      clientSecretTag: clientSecretEnc.tag,
    };

    // Provider returns 401 — refresh refused.
    globalThis.fetch = vi.fn(
      async () => new Response("unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;

    // Capture the update issued by MED-B1 inside the tx.
    let observedPatch: Record<string, unknown> | undefined;
    const tx = {
      execute: vi.fn(async () => []),
      select: buildSelectQueue([
        { rows: [tokenRow] }, // re-read inside tx returns same expired row
      ]),
      update: vi.fn(() => ({
        set: (patch: Record<string, unknown>) => {
          observedPatch = patch;
          return { where: () => Promise.resolve() };
        },
      })),
    };

    const db = {
      execute: vi.fn(async () => []),
      select: buildSelectQueue([
        { rows: [{ id: "m1" }] }, // membership
        { rows: [connectorRow] }, // connector
        { rows: [tokenRow] }, // initial token row
      ]),
      update: buildUpdateMock(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as Parameters<typeof connectorService>[0];

    const svc = connectorService(db);
    await expect(svc.getUserToken("user-1", "jira", VALID_COMPANY_UUID)).rejects.toMatchObject({
      code: "CONNECTOR_TOKEN_REVOKED",
    });

    // MED-B1 — the tx update must have nulled the refresh material.
    expect(observedPatch).toBeDefined();
    expect(observedPatch?.refreshTokenIv).toBeNull();
    expect(observedPatch?.refreshTokenCiphertext).toBeNull();
    expect(observedPatch?.refreshTokenTag).toBeNull();
    expect(observedPatch?.lastRefreshFailedAt).toBeInstanceOf(Date);
  });

  it("oauth2 concurrent already-refreshed — re-read inside lock skips fetch", async () => {
    const oldAccessEnc = encryptSecret("OLD-access");
    const newAccessEnc = encryptSecret("NEW-access-after-concurrent-refresh");
    const refreshEnc = encryptSecret("refresh-tok");
    const clientSecretEnc = encryptSecret("cs-xyz");

    const expiredTokenRow = {
      id: "t1",
      expiresAt: new Date(Date.now() - 60_000),
      accessTokenIv: oldAccessEnc.iv,
      accessTokenCiphertext: oldAccessEnc.ciphertext,
      accessTokenTag: oldAccessEnc.tag,
      refreshTokenIv: refreshEnc.iv,
      refreshTokenCiphertext: refreshEnc.ciphertext,
      refreshTokenTag: refreshEnc.tag,
      scopesGranted: ["read"],
    };
    // Inside the tx, another caller already refreshed → fresh row has a future expiresAt
    const freshTokenRow = {
      ...expiredTokenRow,
      expiresAt: new Date(Date.now() + 60_000),
      accessTokenIv: newAccessEnc.iv,
      accessTokenCiphertext: newAccessEnc.ciphertext,
      accessTokenTag: newAccessEnc.tag,
    };
    const connectorRow = {
      id: "c1",
      type: "oauth2",
      enabled: true,
      providerSlug: "jira",
      companyId: VALID_COMPANY_UUID,
      tokenUrl: "https://example.test/token",
      clientId: "client-id",
      clientSecretIv: clientSecretEnc.iv,
      clientSecretCiphertext: clientSecretEnc.ciphertext,
      clientSecretTag: clientSecretEnc.tag,
    };

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const tx = {
      execute: vi.fn(async () => []),
      select: buildSelectQueue([
        { rows: [freshTokenRow] }, // re-read returns the freshly-refreshed row
      ]),
      update: vi.fn(() => ({
        set: () => ({ where: () => Promise.resolve() }),
      })),
    };

    const db = {
      execute: vi.fn(async () => []),
      select: buildSelectQueue([
        { rows: [{ id: "m1" }] }, // membership
        { rows: [connectorRow] }, // connector
        { rows: [expiredTokenRow] }, // initial token (expired view)
      ]),
      update: buildUpdateMock(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    } as unknown as Parameters<typeof connectorService>[0];

    const svc = connectorService(db);
    const result = await svc.getUserToken("user-1", "jira", VALID_COMPANY_UUID);

    // The fresh row was returned without calling the provider.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.type).toBe("oauth2");
    expect(result.accessToken).toBe("NEW-access-after-concurrent-refresh");
  });
});

// ─── ConnectorError ───────────────────────────────────────────────────────────

describe("ConnectorError", () => {
  it("carries a code prop and a message", () => {
    const err = new ConnectorError("CONNECTOR_X", "explanation");
    expect(err.code).toBe("CONNECTOR_X");
    expect(err.message).toBe("explanation");
    expect(err.name).toBe("ConnectorError");
    expect(err).toBeInstanceOf(Error);
  });

  it("defaults message to code when not provided", () => {
    const err = new ConnectorError("CONNECTOR_FOO");
    expect(err.message).toBe("CONNECTOR_FOO");
  });
});
