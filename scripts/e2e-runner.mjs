#!/usr/bin/env node
/**
 * MnM — Isolated E2E Test Runner
 *
 * Spins up a completely isolated test environment:
 *   1. Starts ephemeral PostgreSQL + Redis via docker-compose.test.yml (tmpfs, no persistence)
 *   2. Starts a dedicated MnM server on port 3101 pointing to the test DB
 *   3. Runs Playwright E2E tests
 *   4. Stops and DESTROYS everything (docker down -v)
 *
 * Usage:
 *   node scripts/e2e-runner.mjs              # run all tests
 *   node scripts/e2e-runner.mjs --headed     # run with browser visible
 *   node scripts/e2e-runner.mjs --grep "tenant"  # filter tests
 *   node scripts/e2e-runner.mjs --project browser # only browser tests
 *
 * The dev database on port 54329/5432 is NEVER touched.
 */

import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const TEST_PORT = 3101;
const TEST_DB_URL = "postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test";
const TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const HEALTH_URL = `${TEST_BASE_URL}/api/health`;
const COMPOSE_FILE = "docker-compose.test.yml";

const playwrightArgs = process.argv.slice(2);

let serverProcess = null;

// ── Helpers ─────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toLocaleTimeString("fr-FR");
  console.log(`\x1b[36m[e2e ${ts}]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[e2e ERROR]\x1b[0m ${msg}`);
}

function run(cmd, opts = {}) {
  log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

async function waitForHealth(url, maxWaitMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await sleep(1000);
  }
  return false;
}

async function waitForPostgres(maxWaitMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      execSync(
        `docker compose -f ${COMPOSE_FILE} exec -T db-test pg_isready -U mnm_test -d mnm_test`,
        { stdio: "pipe" },
      );
      return true;
    } catch {
      await sleep(1000);
    }
  }
  return false;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  let exitCode = 1;

  try {
    // ── Step 1: Start test infrastructure ────────────────────────────
    log("Starting ephemeral test database (docker-compose.test.yml)...");
    run(`docker compose -f ${COMPOSE_FILE} down -v 2>/dev/null || true`);
    run(`docker compose -f ${COMPOSE_FILE} up -d --wait`);

    log("Waiting for PostgreSQL to be ready...");
    const pgReady = await waitForPostgres();
    if (!pgReady) {
      throw new Error("Test PostgreSQL failed to start within 30s");
    }
    log("PostgreSQL ready on port 5433");

    // ── Step 2: Start dedicated MnM server ──────────────────────────
    log(`Starting MnM test server on port ${TEST_PORT}...`);

    const serverEnv = {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
      REDIS_URL: TEST_REDIS_URL,
      PORT: String(TEST_PORT),
      MNM_E2E_SEED: "true",
      MNM_MIGRATION_AUTO_APPLY: "true",
      MNM_UI_DEV_MIDDLEWARE: "true",
      MNM_AGENT_JWT_SECRET: "mnm-e2e-test-secret",
      // Don't start embedded postgres — we're using external docker
      // The server detects DATABASE_URL and skips embedded postgres
    };

    serverProcess = spawn("bun", ["run", "--cwd", "server", "dev"], {
      env: serverEnv,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    // Stream server output with prefix
    serverProcess.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (line.includes("listening on") || line.includes("error") || line.includes("migration")) {
          log(`[server] ${line}`);
        }
      }
    });
    serverProcess.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (!line.includes("ExperimentalWarning")) {
          logError(`[server] ${line}`);
        }
      }
    });

    log("Waiting for server health check...");
    const serverReady = await waitForHealth(HEALTH_URL, 60_000);
    if (!serverReady) {
      throw new Error(`MnM server failed to start on ${TEST_BASE_URL} within 60s`);
    }
    log(`Server ready at ${TEST_BASE_URL}`);

    // ── Step 3: Run Playwright tests ────────────────────────────────
    log("Running Playwright E2E tests...");

    const pwArgs = ["npx", "playwright", "test", ...playwrightArgs];
    const pwEnv = {
      ...process.env,
      MNM_BASE_URL: TEST_BASE_URL,
      MNM_E2E_SEED: "true",
    };

    const result = spawn(pwArgs[0], pwArgs.slice(1), {
      env: pwEnv,
      stdio: "inherit",
      shell: true,
    });

    exitCode = await new Promise((resolve) => {
      result.on("close", (code) => resolve(code ?? 1));
    });

    if (exitCode === 0) {
      log("All E2E tests passed!");
    } else {
      logError(`E2E tests failed with exit code ${exitCode}`);
    }
  } catch (err) {
    logError(err.message);
  } finally {
    // ── Step 4: Cleanup — DESTROY everything ────────────────────────
    log("Cleaning up...");

    // Kill server process
    if (serverProcess) {
      log("Stopping test server...");
      try {
        // On Windows, spawn with shell=true creates a cmd.exe wrapper.
        // Kill the entire process tree.
        if (process.platform === "win32") {
          execSync(`taskkill /F /T /PID ${serverProcess.pid} 2>NUL`, { stdio: "pipe" });
        } else {
          serverProcess.kill("SIGTERM");
        }
      } catch {
        // already dead
      }
    }

    // Destroy docker containers + volumes (ephemeral data wiped)
    log("Destroying test database and containers...");
    try {
      run(`docker compose -f ${COMPOSE_FILE} down -v`);
    } catch {
      logError("Failed to stop docker containers (may need manual cleanup)");
    }

    log("Cleanup complete. Your dev database was never touched.");
  }

  process.exit(exitCode);
}

main();
