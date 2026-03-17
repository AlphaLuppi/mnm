/**
 * TECH-01: PostgreSQL Externe — E2E API Tests
 *
 * These tests verify the infrastructure deliverables of TECH-01:
 *   - Health check endpoint with DB connectivity info (AC-5, AC-6)
 *   - .env.example template exists and is documented (AC-8)
 *   - docker-compose.dev.yml exists and is valid (AC-2)
 *
 * Prerequisites:
 *   - MnM server running (`pnpm dev`) with a PostgreSQL connection
 *   - Or run via `pnpm test:e2e` (Playwright starts the server in CI)
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// ─── AC-5: Health check with DB connectivity ────────────────────────────────

test.describe("GET /health — DB connectivity (AC-5)", () => {
  test("returns 200 with status ok and db info when DB is connected", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");

    // DB connectivity fields must be present when connected to PostgreSQL
    expect(body.db).toBeDefined();
    expect(body.db.connected).toBe(true);
    expect(typeof body.db.latencyMs).toBe("number");
    expect(body.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof body.db.version).toBe("string");
    // PostgreSQL version string should start with a number (e.g., "17.2")
    expect(body.db.version).toMatch(/^\d+\./);
  });

  test("returns deployment metadata alongside db info", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    const body = await res.json();

    // Existing fields should still be present when db is passed
    expect(body.status).toBe("ok");
    // deploymentMode, deploymentExposure, authReady are optional depending on
    // whether a db is passed to healthRoutes. When running with db, they should exist.
    if (body.deploymentMode) {
      expect(["local_trusted", "authenticated"]).toContain(
        body.deploymentMode,
      );
    }
  });

  test("db.latencyMs is within a reasonable range (< 5000ms)", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(body.db?.latencyMs).toBeLessThan(5000);
  });
});

// ─── AC-8: .env.example present and documented ──────────────────────────────

test.describe(".env.example template (AC-8)", () => {
  let envContent: string;

  test.beforeAll(async () => {
    envContent = await readFile(resolve(ROOT, ".env.example"), "utf-8");
  });

  test(".env.example file exists", () => {
    expect(envContent).toBeTruthy();
  });

  test("contains DATABASE_URL with default docker-compose.dev.yml value", () => {
    expect(envContent).toContain("DATABASE_URL=");
    // Default value should point to the docker-compose.dev.yml PostgreSQL
    expect(envContent).toContain(
      "postgres://mnm:mnm_dev@127.0.0.1:5432/mnm",
    );
  });

  test("documents all major environment variable sections", () => {
    // Must have section headers for the key config areas
    expect(envContent).toContain("Database");
    expect(envContent).toContain("Server");
    expect(envContent).toContain("Deployment");
    expect(envContent).toContain("Auth");
  });

  test("contains explanatory comments", () => {
    // Lines starting with # are comments — there should be many
    const commentLines = envContent
      .split("\n")
      .filter((line) => line.startsWith("#"));
    expect(commentLines.length).toBeGreaterThan(5);
  });

  test("contains PORT and HOST variables", () => {
    expect(envContent).toMatch(/PORT/);
    expect(envContent).toMatch(/HOST/);
  });

  test("contains deployment mode variable", () => {
    expect(envContent).toMatch(/MNM_DEPLOYMENT_MODE/);
  });
});

// ─── AC-2: docker-compose.dev.yml exists and is valid ───────────────────────

test.describe("docker-compose.dev.yml (AC-2)", () => {
  let composeContent: string;

  test.beforeAll(async () => {
    composeContent = await readFile(
      resolve(ROOT, "docker-compose.dev.yml"),
      "utf-8",
    );
  });

  test("docker-compose.dev.yml file exists", () => {
    expect(composeContent).toBeTruthy();
  });

  test("uses postgres:17-alpine image", () => {
    expect(composeContent).toContain("postgres:17-alpine");
  });

  test("configures POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB", () => {
    expect(composeContent).toContain("POSTGRES_USER: mnm");
    expect(composeContent).toContain("POSTGRES_PASSWORD: mnm_dev");
    expect(composeContent).toContain("POSTGRES_DB: mnm");
  });

  test("includes a healthcheck with pg_isready", () => {
    expect(composeContent).toContain("pg_isready");
    expect(composeContent).toContain("healthcheck");
  });

  test("exposes configurable port via POSTGRES_PORT", () => {
    expect(composeContent).toContain("POSTGRES_PORT");
    // Default port should be 5432
    expect(composeContent).toContain("5432");
  });

  test("uses a named volume for data persistence", () => {
    expect(composeContent).toContain("pgdata-dev");
    expect(composeContent).toContain("volumes:");
  });

  test("does NOT include a server service (dev runs locally)", () => {
    // The docker-compose.dev.yml should ONLY have the db service
    // It should not try to run the MnM server in Docker
    const serviceMatches = composeContent.match(/^\s{2}\w+:/gm) ?? [];
    const serviceNames = serviceMatches.map((s) => s.trim().replace(":", ""));
    expect(serviceNames).toContain("db");
    expect(serviceNames).not.toContain("server");
    expect(serviceNames).not.toContain("app");
  });
});

// ─── AC-7 & AC-9: .gitignore includes .env ──────────────────────────────────

test.describe(".gitignore includes .env (AC-7 partial)", () => {
  test(".env is listed in .gitignore", async () => {
    const gitignoreContent = await readFile(
      resolve(ROOT, ".gitignore"),
      "utf-8",
    );
    // .env should be ignored but .env.example should NOT be
    const lines = gitignoreContent
      .split("\n")
      .map((l) => l.trim());
    expect(lines).toContain(".env");
    expect(lines).toContain("!.env.example");
  });
});
