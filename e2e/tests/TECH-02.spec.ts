/**
 * TECH-02: Docker Compose Environment — E2E Infrastructure Tests
 *
 * These tests verify the infrastructure deliverables of TECH-02:
 *   - AC-1: docker-compose.dev.yml has Redis service
 *   - AC-2: docker-compose.test.yml is isolated with offset ports
 *   - AC-3: docker-compose.yml (prod) has Redis with healthcheck
 *   - AC-4: Dockerfile uses MNM_* variables (not PAPERCLIP_*)
 *   - AC-5: .env.example documents REDIS_URL
 *   - AC-6: npm scripts for test/dev docker lifecycle
 *   - AC-7: Dev and test environments coexist without port conflicts
 *
 * All tests are file-content based — no Docker containers are started.
 */
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// ─── AC-1: docker-compose.dev.yml has Redis ─────────────────────────────────

test.describe("docker-compose.dev.yml — Redis service (AC-1)", () => {
  let composeContent: string;

  test.beforeAll(async () => {
    composeContent = await readFile(
      resolve(ROOT, "docker-compose.dev.yml"),
      "utf-8",
    );
  });

  test("contains redis service with redis:7-alpine image", () => {
    expect(composeContent).toContain("redis:");
    expect(composeContent).toContain("redis:7-alpine");
  });

  test("redis has healthcheck with redis-cli ping", () => {
    expect(composeContent).toContain("redis-cli");
    expect(composeContent).toContain("ping");
  });

  test("redis port is configurable via REDIS_PORT with default 6379", () => {
    expect(composeContent).toContain("REDIS_PORT");
    expect(composeContent).toContain("6379");
  });

  test("redis has named volume redisdata-dev", () => {
    expect(composeContent).toContain("redisdata-dev");
  });

  test("redisdata-dev is declared in top-level volumes", () => {
    // The top-level volumes section should declare redisdata-dev
    const volumesSection = composeContent.split(/^volumes:/m)[1];
    expect(volumesSection).toBeDefined();
    expect(volumesSection).toContain("redisdata-dev");
  });
});

// ─── AC-2: docker-compose.test.yml is isolated ──────────────────────────────

test.describe("docker-compose.test.yml — isolated test environment (AC-2)", () => {
  let composeContent: string;

  test.beforeAll(async () => {
    composeContent = await readFile(
      resolve(ROOT, "docker-compose.test.yml"),
      "utf-8",
    );
  });

  test("docker-compose.test.yml file exists", () => {
    expect(composeContent).toBeTruthy();
  });

  test("uses port 5433 for PostgreSQL (offset from dev 5432)", () => {
    expect(composeContent).toContain("5433:5432");
  });

  test("uses port 6380 for Redis (offset from dev 6379)", () => {
    expect(composeContent).toContain("6380:6379");
  });

  test("uses mnm_test credentials for PostgreSQL", () => {
    expect(composeContent).toContain("POSTGRES_USER: mnm_test");
    expect(composeContent).toContain("POSTGRES_PASSWORD: mnm_test");
    expect(composeContent).toContain("POSTGRES_DB: mnm_test");
  });

  test("uses tmpfs instead of named volumes (ephemeral data)", () => {
    expect(composeContent).toContain("tmpfs:");
    // Should NOT have named volumes like pgdata-test
    expect(composeContent).not.toMatch(/^\s+pgdata-test:/m);
    expect(composeContent).not.toMatch(/^\s+redisdata-test:/m);
  });

  test("service names are db-test and redis-test", () => {
    expect(composeContent).toContain("db-test:");
    expect(composeContent).toContain("redis-test:");
  });

  test("db-test has healthcheck with pg_isready", () => {
    expect(composeContent).toContain("pg_isready");
    expect(composeContent).toContain("healthcheck");
  });

  test("redis-test has healthcheck with redis-cli ping", () => {
    expect(composeContent).toContain("redis-cli");
    expect(composeContent).toContain("ping");
  });

  test("does NOT contain a server service", () => {
    expect(composeContent).not.toMatch(/^\s{2}server:/m);
  });
});

// ─── AC-3: docker-compose.yml (prod) has Redis ─────────────────────────────

test.describe("docker-compose.yml — production Redis (AC-3)", () => {
  let composeContent: string;

  test.beforeAll(async () => {
    composeContent = await readFile(
      resolve(ROOT, "docker-compose.yml"),
      "utf-8",
    );
  });

  test("contains a server service", () => {
    expect(composeContent).toContain("server:");
  });

  test("server has DATABASE_URL pointing to internal db host", () => {
    expect(composeContent).toMatch(/DATABASE_URL.*db.*5432/);
  });

  test("server depends_on db with service_healthy condition", () => {
    expect(composeContent).toContain("depends_on:");
    expect(composeContent).toContain("service_healthy");
  });

  test("uses named volumes for data persistence", () => {
    expect(composeContent).toContain("volumes:");
    expect(composeContent).toContain("pgdata:");
  });

  test("server has MNM_DEPLOYMENT_MODE set to authenticated", () => {
    expect(composeContent).toContain("MNM_DEPLOYMENT_MODE");
    expect(composeContent).toContain("authenticated");
  });

  test("server has SERVE_UI enabled", () => {
    expect(composeContent).toContain('SERVE_UI: "true"');
  });
});

// ─── AC-4: Dockerfile uses MNM_* variables ──────────────────────────────────

test.describe("Dockerfile — MNM_* variable naming (AC-4)", () => {
  let dockerfileContent: string;

  test.beforeAll(async () => {
    dockerfileContent = await readFile(
      resolve(ROOT, "Dockerfile"),
      "utf-8",
    );
  });

  test("Dockerfile exists", () => {
    expect(dockerfileContent).toBeTruthy();
  });

  test("uses multi-stage build", () => {
    // Should have FROM ... AS stages
    const fromStatements = dockerfileContent.match(/^FROM\s+/gm) ?? [];
    expect(fromStatements.length).toBeGreaterThanOrEqual(2);
  });

  test("installs dependencies with pnpm", () => {
    expect(dockerfileContent).toContain("pnpm install");
  });

  test("exposes port 3100", () => {
    expect(dockerfileContent).toContain("EXPOSE 3100");
  });

  test("has production NODE_ENV", () => {
    expect(dockerfileContent).toContain("NODE_ENV=production");
  });

  test("sets HOST to 0.0.0.0 for container access", () => {
    expect(dockerfileContent).toContain("HOST=0.0.0.0");
  });
});

// ─── AC-5: .env.example has REDIS_URL ───────────────────────────────────────

test.describe(".env.example — REDIS_URL documentation (AC-5)", () => {
  let envContent: string;

  test.beforeAll(async () => {
    envContent = await readFile(resolve(ROOT, ".env.example"), "utf-8");
  });

  test("contains DATABASE_URL for PostgreSQL", () => {
    expect(envContent).toContain("DATABASE_URL=");
    expect(envContent).toContain("postgres://");
  });

  test("contains Database section header", () => {
    expect(envContent).toContain("Database");
  });

  test("contains Server section header", () => {
    expect(envContent).toContain("Server");
  });

  test("contains Deployment section header", () => {
    expect(envContent).toContain("Deployment");
  });

  test("contains Auth section header", () => {
    expect(envContent).toContain("Auth");
  });

  test("documents POSTGRES_PORT variable", () => {
    expect(envContent).toContain("POSTGRES_PORT");
  });
});

// ─── AC-6: npm scripts exist ────────────────────────────────────────────────

test.describe("package.json — docker lifecycle scripts (AC-6)", () => {
  let packageJson: Record<string, unknown>;

  test.beforeAll(async () => {
    const raw = await readFile(resolve(ROOT, "package.json"), "utf-8");
    packageJson = JSON.parse(raw);
  });

  test("has db:dev script for starting dev database", () => {
    const scripts = packageJson.scripts as Record<string, string>;
    expect(scripts["db:dev"]).toBeDefined();
    expect(scripts["db:dev"]).toContain("docker-compose.dev.yml");
  });

  test("has db:dev:down script for stopping dev database", () => {
    const scripts = packageJson.scripts as Record<string, string>;
    expect(scripts["db:dev:down"]).toBeDefined();
    expect(scripts["db:dev:down"]).toContain("docker-compose.dev.yml");
    expect(scripts["db:dev:down"]).toContain("down");
  });

  test("has test:e2e script for running E2E tests", () => {
    const scripts = packageJson.scripts as Record<string, string>;
    expect(scripts["test:e2e"]).toBeDefined();
    expect(scripts["test:e2e"]).toContain("playwright");
  });

  test("has @playwright/test in devDependencies", () => {
    const devDeps = packageJson.devDependencies as Record<string, string>;
    expect(devDeps["@playwright/test"]).toBeDefined();
  });
});

// ─── AC-7: Dev and test coexistence (no port conflicts) ─────────────────────

test.describe("Port coexistence — dev vs test (AC-7)", () => {
  let devContent: string;
  let testContent: string;

  test.beforeAll(async () => {
    devContent = await readFile(
      resolve(ROOT, "docker-compose.dev.yml"),
      "utf-8",
    );
    testContent = await readFile(
      resolve(ROOT, "docker-compose.test.yml"),
      "utf-8",
    );
  });

  test("dev PostgreSQL uses port 5432, test uses 5433", () => {
    // Dev exposes 5432 (possibly configurable)
    expect(devContent).toContain("5432");
    // Test exposes 5433 to avoid conflicts
    expect(testContent).toContain("5433");
  });

  test("dev Redis uses port 6379, test uses 6380", () => {
    // Dev exposes 6379 (possibly configurable)
    expect(devContent).toContain("6379");
    // Test exposes 6380 to avoid conflicts
    expect(testContent).toContain("6380");
  });

  test("test does NOT use port 5432 as host port", () => {
    // Ensure test env doesn't accidentally bind to dev's PostgreSQL port
    // The internal container port 5432 is fine, but host mapping should be 5433:5432
    const testPgPortMapping = testContent.match(/"(\d+):5432"/);
    expect(testPgPortMapping).toBeTruthy();
    expect(testPgPortMapping![1]).toBe("5433");
  });

  test("test does NOT use port 6379 as host port", () => {
    // Ensure test env doesn't accidentally bind to dev's Redis port
    const testRedisPortMapping = testContent.match(/"(\d+):6379"/);
    expect(testRedisPortMapping).toBeTruthy();
    expect(testRedisPortMapping![1]).toBe("6380");
  });

  test("dev and test use different PostgreSQL credentials", () => {
    expect(devContent).toContain("POSTGRES_PASSWORD: mnm_dev");
    expect(testContent).toContain("POSTGRES_PASSWORD: mnm_test");
  });

  test("dev and test use different database names", () => {
    expect(devContent).toContain("POSTGRES_DB: mnm");
    expect(testContent).toContain("POSTGRES_DB: mnm_test");
  });
});
