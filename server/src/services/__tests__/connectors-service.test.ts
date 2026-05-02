import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectorService, ConnectorError } from "../connectors.js";

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
