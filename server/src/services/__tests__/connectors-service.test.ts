import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectorService, ConnectorError } from "../connectors.js";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

type SqlResult = { rows: unknown[] } & Array<unknown>;

function makeArrayResult(rows: unknown[]): SqlResult {
  const arr = rows as unknown as SqlResult;
  // make `result.length` work + `(result as any).rows.length` if some code uses that
  Object.defineProperty(arr, "rows", { value: rows, enumerable: false });
  return arr;
}

function buildDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    execute: vi.fn(async () => makeArrayResult([])),
    select: vi.fn(() => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    })),
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
    ...overrides,
  } as unknown as Parameters<typeof connectorService>[0];
}

// ─── C2 cross-tenant guard ────────────────────────────────────────────────────

describe("connectors — C2 cross-tenant guard (assertUserInCompany)", () => {
  it("throws CONNECTOR_USER_NOT_IN_COMPANY when membership lookup returns empty", async () => {
    const db = buildDb({
      execute: vi.fn(async () => makeArrayResult([])),
    });
    const svc = connectorService(db);
    await expect(
      svc.assertUserInCompany("user-from-tenant-B", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toThrow(ConnectorError);
    await expect(
      svc.assertUserInCompany("user-from-tenant-B", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toMatchObject({ code: "CONNECTOR_USER_NOT_IN_COMPANY" });
  });

  it("does NOT throw when membership lookup returns at least one row", async () => {
    const db = buildDb({
      execute: vi.fn(async () => makeArrayResult([{ "?column?": 1 }])),
    });
    const svc = connectorService(db);
    await expect(
      svc.assertUserInCompany("user-A", "00000000-0000-0000-0000-00000000000A"),
    ).resolves.toBeUndefined();
  });

  it("uses table 'company_memberships' with principal_type='user' and status='active'", async () => {
    const executeSpy = vi.fn(async () => makeArrayResult([]));
    const db = buildDb({ execute: executeSpy });
    const svc = connectorService(db);
    await svc
      .assertUserInCompany("u1", "00000000-0000-0000-0000-000000000001")
      .catch(() => undefined);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    const calls = executeSpy.mock.calls as unknown as Array<[unknown]>;
    const sqlArg = calls[0]?.[0];
    // Drizzle sql template stores raw chunks under queryChunks (or strings depending on version)
    const haystack = JSON.stringify(sqlArg);
    expect(haystack).toContain("company_memberships");
    expect(haystack).toContain("principal_type");
    expect(haystack).toContain("'user'");
    expect(haystack).toContain("status");
    expect(haystack).toContain("'active'");
  });
});

// ─── getUserToken: not connected paths ────────────────────────────────────────

describe("connectors — getUserToken error paths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws CONNECTOR_USER_NOT_IN_COMPANY first when cross-tenant", async () => {
    const db = buildDb({
      execute: vi.fn(async () => makeArrayResult([])), // membership empty
    });
    const svc = connectorService(db);
    await expect(
      svc.getUserToken("user-x", "jira", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toMatchObject({ code: "CONNECTOR_USER_NOT_IN_COMPANY" });
  });

  it("throws CONNECTOR_NOT_CONFIGURED when no enabled connector matches the slug", async () => {
    const db = buildDb({
      execute: vi.fn(async () => makeArrayResult([{ ok: 1 }])), // membership OK
      select: vi.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([]), // no connector found
        }),
      })),
    });
    const svc = connectorService(db);
    await expect(
      svc.getUserToken("user-x", "jira", "00000000-0000-0000-0000-00000000000A"),
    ).rejects.toMatchObject({ code: "CONNECTOR_NOT_CONFIGURED" });
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
