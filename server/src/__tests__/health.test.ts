import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { healthRoutes } from "../routes/health.js";

// ─── Helper: create a mock Db that resolves SQL queries ─────────────────────

/**
 * Creates a mock Drizzle `db` object that can resolve `db.execute(sql`...`)`
 * calls. The mock simulates the Drizzle postgres-js driver behaviour.
 */
function createMockDb(overrides?: {
  selectOneResult?: unknown;
  versionResult?: string;
  shouldThrow?: Error;
}) {
  const {
    selectOneResult = [{ "?column?": 1 }],
    versionResult = "17.2",
    shouldThrow,
  } = overrides ?? {};

  let executeCallCount = 0;
  const mockDb = {
    execute: vi.fn().mockImplementation((_query: unknown) => {
      if (shouldThrow) return Promise.reject(shouldThrow);
      executeCallCount++;
      // First call: SELECT 1 connectivity check
      // Second call: SHOW server_version
      if (executeCallCount % 2 === 0) {
        return Promise.resolve([{ server_version: versionResult }]);
      }
      return Promise.resolve(selectOneResult);
    }),
    // Provide select/from/where for the bootstrapStatus query
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: vi.fn().mockImplementation((cb: (rows: unknown[]) => unknown) =>
            Promise.resolve(cb([{ count: 1 }])),
          ),
        }),
      }),
    }),
  } as unknown;

  return mockDb;
}

// ─── Tests: No DB (fallback mode) ──────────────────────────────────────────

describe("GET /health — no DB (fallback mode)", () => {
  const app = express();
  app.use("/health", healthRoutes());

  it("returns 200 with status ok when no db is provided", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not include db info when no db is provided", async () => {
    const res = await request(app).get("/health");
    expect(res.body.db).toBeUndefined();
  });
});

// ─── Tests: DB connected (AC-5) ────────────────────────────────────────────

describe("GET /health — DB connected (AC-5)", () => {
  const mockDb = createMockDb({ versionResult: "17.2" });
  const app = express();
  app.use(
    "/health",
    healthRoutes(mockDb as any, {
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      authReady: true,
      companyDeletionEnabled: true,
    }),
  );

  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("includes db.connected: true", async () => {
    const res = await request(app).get("/health");
    expect(res.body.db).toBeDefined();
    expect(res.body.db.connected).toBe(true);
  });

  it("includes db.latencyMs as a non-negative number", async () => {
    const res = await request(app).get("/health");
    expect(typeof res.body.db.latencyMs).toBe("number");
    expect(res.body.db.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("includes db.version as a version string", async () => {
    const res = await request(app).get("/health");
    expect(typeof res.body.db.version).toBe("string");
    expect(res.body.db.version).toMatch(/^\d+/);
  });

  it("still includes deployment metadata", async () => {
    const res = await request(app).get("/health");
    expect(res.body.deploymentMode).toBe("local_trusted");
    expect(res.body.deploymentExposure).toBe("private");
    expect(res.body.authReady).toBe(true);
  });
});

// ─── Tests: DB disconnected / degraded mode (AC-6) ─────────────────────────

describe("GET /health — DB disconnected / degraded (AC-6)", () => {
  const dbError = new Error("Connection terminated unexpectedly");
  const mockDb = createMockDb({ shouldThrow: dbError });
  const app = express();
  app.use(
    "/health",
    healthRoutes(mockDb as any, {
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      authReady: true,
      companyDeletionEnabled: true,
    }),
  );

  it("returns 503 when DB is unreachable", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
  });

  it("returns status: degraded", async () => {
    const res = await request(app).get("/health");
    expect(res.body.status).toBe("degraded");
  });

  it("returns db.connected: false", async () => {
    const res = await request(app).get("/health");
    expect(res.body.db).toBeDefined();
    expect(res.body.db.connected).toBe(false);
  });

  it("returns db.error with the error message", async () => {
    const res = await request(app).get("/health");
    expect(typeof res.body.db.error).toBe("string");
    expect(res.body.db.error).toContain("Connection terminated unexpectedly");
  });

  it("does NOT include db.latencyMs or db.version when disconnected", async () => {
    const res = await request(app).get("/health");
    expect(res.body.db.latencyMs).toBeUndefined();
    expect(res.body.db.version).toBeUndefined();
  });
});

// ─── Tests: Bootstrap status with authenticated mode ────────────────────────

describe("GET /health — bootstrapStatus in authenticated mode", () => {
  it("returns bootstrap_pending when no instance_admin exists", async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            then: vi
              .fn()
              .mockImplementation((cb: (rows: unknown[]) => unknown) =>
                Promise.resolve(cb([{ count: 0 }])),
              ),
          }),
        }),
      }),
    } as unknown;

    const app = express();
    app.use(
      "/health",
      healthRoutes(mockDb as any, {
        deploymentMode: "authenticated",
        deploymentExposure: "private",
        authReady: true,
        companyDeletionEnabled: true,
      }),
    );

    const res = await request(app).get("/health");
    expect(res.body.bootstrapStatus).toBe("bootstrap_pending");
  });

  it("returns ready when instance_admin exists", async () => {
    const mockDb = createMockDb();
    const app = express();
    app.use(
      "/health",
      healthRoutes(mockDb as any, {
        deploymentMode: "authenticated",
        deploymentExposure: "private",
        authReady: true,
        companyDeletionEnabled: true,
      }),
    );

    const res = await request(app).get("/health");
    expect(res.body.bootstrapStatus).toBe("ready");
  });
});
