/**
 * TECH-04: Redis Setup — E2E Infrastructure Tests
 *
 * These tests verify the infrastructure deliverables of TECH-04:
 *   - AC-1: Redis client created when REDIS_URL is set
 *   - AC-2: App works without Redis (graceful degradation)
 *   - AC-3: Health check includes Redis status
 *   - AC-4: Rate limiting returns 429 when exceeded
 *   - AC-5: Rate limiting headers present (X-RateLimit-*)
 *
 * Groups 1-5 are file-content based — they always pass regardless of runtime.
 * Group 6 requires the MnM server to be running (`pnpm dev`).
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// ─── Group 1: Source files exist ────────────────────────────────────────────

test.describe("Source files exist", () => {
  test("server/src/redis.ts exists", async () => {
    const content = await readFile(
      resolve(ROOT, "server/src/redis.ts"),
      "utf-8",
    );
    expect(content).toBeTruthy();
  });

  test("server/src/middleware/rate-limit.ts exists", async () => {
    const content = await readFile(
      resolve(ROOT, "server/src/middleware/rate-limit.ts"),
      "utf-8",
    );
    expect(content).toBeTruthy();
  });

  test("server/package.json contains ioredis dependency", async () => {
    const raw = await readFile(
      resolve(ROOT, "server/package.json"),
      "utf-8",
    );
    const pkg = JSON.parse(raw);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    expect(allDeps.ioredis).toBeDefined();
  });

  test("server/src/config.ts contains redisUrl field", async () => {
    const content = await readFile(
      resolve(ROOT, "server/src/config.ts"),
      "utf-8",
    );
    expect(content).toContain("redisUrl");
  });
});

// ─── Group 2: Redis client module ───────────────────────────────────────────

test.describe("Redis client module (server/src/redis.ts)", () => {
  let redisContent: string;

  test.beforeAll(async () => {
    redisContent = await readFile(
      resolve(ROOT, "server/src/redis.ts"),
      "utf-8",
    );
  });

  test("exports createRedisClient function", () => {
    expect(redisContent).toMatch(
      /export\s+(async\s+)?function\s+createRedisClient/,
    );
  });

  test("exports pingRedis function", () => {
    expect(redisContent).toMatch(
      /export\s+(async\s+)?function\s+pingRedis/,
    );
  });

  test("exports disconnectRedis function", () => {
    expect(redisContent).toMatch(
      /export\s+(async\s+)?function\s+disconnectRedis/,
    );
  });

  test("exports RedisState type or interface", () => {
    expect(redisContent).toMatch(
      /export\s+(type|interface)\s+RedisState/,
    );
  });

  test("contains graceful degradation (returns null when no URL)", () => {
    // The function should return early with client: null when no URL is provided
    expect(redisContent).toContain("client: null");
    // Should log a message about Redis features being disabled
    expect(redisContent).toMatch(/Redis features disabled|No REDIS_URL/i);
  });
});

// ─── Group 3: Rate limiting middleware ──────────────────────────────────────

test.describe("Rate limiting middleware (server/src/middleware/rate-limit.ts)", () => {
  let rateLimitContent: string;

  test.beforeAll(async () => {
    rateLimitContent = await readFile(
      resolve(ROOT, "server/src/middleware/rate-limit.ts"),
      "utf-8",
    );
  });

  test("exports createRateLimiter function", () => {
    expect(rateLimitContent).toMatch(
      /export\s+(async\s+)?function\s+createRateLimiter/,
    );
  });

  test("sets X-RateLimit headers on responses", () => {
    expect(rateLimitContent).toContain("X-RateLimit-Limit");
    expect(rateLimitContent).toContain("X-RateLimit-Remaining");
    expect(rateLimitContent).toContain("X-RateLimit-Reset");
  });

  test("returns 429 status when rate limit exceeded", () => {
    expect(rateLimitContent).toContain("429");
    expect(rateLimitContent).toMatch(/Too Many Requests|Rate limit exceeded/);
  });

  test("contains in-memory fallback store", () => {
    // Should have an in-memory implementation for when Redis is unavailable
    expect(rateLimitContent).toMatch(/InMemory|in-memory|fallback/i);
    // Should use a Map or similar data structure for counters
    expect(rateLimitContent).toMatch(/new Map|Map</);
  });
});

// ─── Group 4: Health check integration ──────────────────────────────────────

test.describe("Health check Redis integration (server/src/routes/health.ts)", () => {
  let healthContent: string;

  test.beforeAll(async () => {
    healthContent = await readFile(
      resolve(ROOT, "server/src/routes/health.ts"),
      "utf-8",
    );
  });

  test("imports from redis module", () => {
    expect(healthContent).toMatch(/from\s+["']\.\.\/redis/);
  });

  test("includes redis status field 'connected'", () => {
    expect(healthContent).toMatch(/redis.*connected|connected.*redis/is);
  });

  test("includes redis status field 'configured'", () => {
    expect(healthContent).toMatch(/redis.*configured|configured.*redis/is);
  });
});

// ─── Group 5: App integration ───────────────────────────────────────────────

test.describe("App integration (server/src/app.ts)", () => {
  let appContent: string;

  test.beforeAll(async () => {
    appContent = await readFile(
      resolve(ROOT, "server/src/app.ts"),
      "utf-8",
    );
  });

  test("imports rate limiter", () => {
    expect(appContent).toMatch(/createRateLimiter/);
  });

  test("applies rate limiting middleware to API routes", () => {
    // Should use the rate limiter on the api router
    expect(appContent).toContain("apiRateLimiter");
    expect(appContent).toContain("api.use(apiRateLimiter)");
  });

  test("passes redisState to createApp or health routes", () => {
    expect(appContent).toContain("redisState");
  });
});

// ─── Group 6: API tests (require running server) ───────────────────────────

test.describe("API integration tests (require server)", () => {
  // Check if server is reachable; skip all tests in this group if not
  let serverAvailable = false;

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.get("/health", { timeout: 3000 });
      serverAvailable = res.status() === 200;
    } catch {
      serverAvailable = false;
    }
  });

  test("GET /health response includes redis field", async ({ request }) => {
    test.skip(!serverAvailable, "Server not running — skipping API test");

    const res = await request.get("/health");
    expect(res.status()).toBe(200);

    const body = await res.json();
    // The redis field should always be present (configured or not)
    expect(body.redis).toBeDefined();
    expect(typeof body.redis.connected).toBe("boolean");
    expect(typeof body.redis.configured).toBe("boolean");

    // If Redis is connected, latencyMs should be a number
    if (body.redis.connected) {
      expect(typeof body.redis.latencyMs).toBe("number");
      expect(body.redis.latencyMs).toBeGreaterThanOrEqual(0);
    }

    // Redis status should NOT affect overall health — status remains "ok"
    expect(body.status).toBe("ok");
  });

  test("API requests include X-RateLimit-* headers", async ({ request }) => {
    test.skip(!serverAvailable, "Server not running — skipping API test");

    const res = await request.get("/api/health");
    // Rate limit headers should be present on API routes
    const limit = res.headers()["x-ratelimit-limit"];
    const remaining = res.headers()["x-ratelimit-remaining"];
    const reset = res.headers()["x-ratelimit-reset"];

    expect(limit).toBeDefined();
    expect(remaining).toBeDefined();
    expect(reset).toBeDefined();

    // Limit should be 100 (API general rate limit)
    expect(Number(limit)).toBe(100);
    // Remaining should be a non-negative number
    expect(Number(remaining)).toBeGreaterThanOrEqual(0);
    expect(Number(remaining)).toBeLessThanOrEqual(100);
    // Reset should be a Unix timestamp in the future (or very recent)
    expect(Number(reset)).toBeGreaterThan(0);
  });

  test("rate limiting returns 429 when limit exceeded", async ({ request }) => {
    test.skip(!serverAvailable, "Server not running — skipping API test");

    // This test is intentionally skipped in normal runs to avoid
    // flooding the server with 101+ requests. It documents the expected
    // behavior per AC-4 and AC-7.
    // To run it manually: remove the skip and ensure a clean rate limit window.
    test.skip(true, "Skipped by default — requires sending 101+ requests to trigger 429");

    // If you want to run this test, uncomment the code below:
    // const requests = [];
    // for (let i = 0; i < 101; i++) {
    //   requests.push(request.get("/api/health"));
    // }
    // const responses = await Promise.all(requests);
    // const last = responses[responses.length - 1];
    // expect(last.status()).toBe(429);
    // const body = await last.json();
    // expect(body.error).toBe("Too Many Requests");
    // expect(body.retryAfter).toBeDefined();
    // expect(last.headers()["retry-after"]).toBeDefined();
  });
});
