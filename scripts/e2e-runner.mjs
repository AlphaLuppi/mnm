#!/usr/bin/env node
/**
 * MnM — Isolated E2E Test Runner (no Docker required)
 *
 * Spins up a completely isolated test environment using embedded PostgreSQL:
 *   1. Starts the MnM server with its own embedded postgres on port 54331,
 *      data stored in a temp directory (completely separate from dev DB)
 *   2. Runs Playwright E2E tests against this isolated server on port 3101
 *   3. Kills the server and DELETES the temp data directory
 *
 * Usage:
 *   node scripts/e2e-runner.mjs                        # run all tests
 *   node scripts/e2e-runner.mjs --headed               # browser visible
 *   node scripts/e2e-runner.mjs --grep "tenant"        # filter tests
 *   node scripts/e2e-runner.mjs --project browser      # only browser tests
 *
 * The dev database (port 54329 / ~/.mnm/instances/default) is NEVER touched.
 */

import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TEST_PORT = 3101;
const TEST_PG_PORT = 54331;
const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const HEALTH_URL = `${TEST_BASE_URL}/api/health`;
const TEST_DATA_DIR = path.join(os.tmpdir(), `mnm-e2e-${Date.now()}`);

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

async function waitForHealth(url, maxWaitMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await sleep(2000);
  }
  return false;
}

function killProcessTree(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /T /PID ${pid} 2>NUL`, { stdio: "pipe" });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch { /* already dead */ }
}

function killPortProcesses(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        stdio: "pipe",
        encoding: "utf8",
      }).trim();
      const pids = new Set(
        out.split("\n").map((l) => l.trim().split(/\s+/).pop()).filter(Boolean),
      );
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid} 2>NUL`, { stdio: "pipe" }); } catch {}
      }
    }
  } catch { /* nothing listening */ }
}

function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
    log(`Deleted ${dir}`);
  } catch (err) {
    logError(`Could not fully remove ${dir}: ${err.message}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  let exitCode = 1;

  log("╔══════════════════════════════════════════════════════════╗");
  log("║  MnM E2E — Isolated Test Runner (embedded postgres)    ║");
  log("╚══════════════════════════════════════════════════════════╝");
  log(`Server:   ${TEST_BASE_URL}`);
  log(`Postgres: embedded on port ${TEST_PG_PORT}`);
  log(`Data dir: ${TEST_DATA_DIR} (temp, destroyed after tests)`);
  log("");

  try {
    // ── Step 1: Ensure test port is free ─────────────────────────────
    killPortProcesses(TEST_PORT);
    killPortProcesses(TEST_PG_PORT);

    // ── Step 2: Start MnM server with isolated embedded postgres ────
    log("Starting MnM server with isolated embedded postgres...");
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

    const serverEnv = {
      ...process.env,
      PORT: String(TEST_PORT),
      MNM_EMBEDDED_POSTGRES_PORT: String(TEST_PG_PORT),
      MNM_EMBEDDED_POSTGRES_DATA_DIR: TEST_DATA_DIR,
      MNM_E2E_SEED: "true",
      MNM_MIGRATION_AUTO_APPLY: "true",
      MNM_AGENT_JWT_SECRET: "mnm-e2e-test-secret",
    };
    // Ensure no DATABASE_URL so the server uses embedded postgres
    delete serverEnv.DATABASE_URL;
    // Remove NODE_OPTIONS that could interfere with bun/tsx worker threads
    delete serverEnv.NODE_OPTIONS;

    const bunBin = process.platform === "win32" ? "bun.exe" : "bun";
    serverProcess = spawn(bunBin, ["run", "--cwd", "server", "dev"], {
      env: serverEnv,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    serverProcess.stdout?.on("data", (data) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        if (/listen|error|migrat|embedded|postgres/i.test(line)) {
          log(`[server] ${line.trim()}`);
        }
      }
    });
    serverProcess.stderr?.on("data", (data) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        if (!/ExperimentalWarning|DeprecationWarning/.test(line)) {
          logError(`[server] ${line.trim()}`);
        }
      }
    });

    log("Waiting for server (postgres init + 71 migrations)...");
    const ready = await waitForHealth(HEALTH_URL, 120_000);
    if (!ready) throw new Error(`Server failed to start at ${TEST_BASE_URL} within 120s`);
    log(`Server ready at ${TEST_BASE_URL}\n`);

    // ── Step 3: Run Playwright ──────────────────────────────────────
    log("Running Playwright E2E tests...\n");

    // Use the playwright executable directly (bun can't load .ts configs via playwright)
    const pwBin = process.platform === "win32"
      ? "node_modules/.bin/playwright.exe"
      : "node_modules/.bin/playwright";
    const result = spawn(
      pwBin,
      ["test", ...playwrightArgs],
      {
        env: { ...process.env, MNM_BASE_URL: TEST_BASE_URL, MNM_E2E_SEED: "true" },
        stdio: "inherit",
      },
    );

    exitCode = await new Promise((resolve) => {
      result.on("close", (code) => resolve(code ?? 1));
    });

    log(exitCode === 0 ? "\nAll E2E tests passed!" : `\nTests finished with exit code ${exitCode}`);
  } catch (err) {
    logError(err.message);
  } finally {
    // ── Step 4: DESTROY everything ──────────────────────────────────
    log("\nCleaning up...");

    if (serverProcess && !serverProcess.killed) {
      log("Stopping test server...");
      killProcessTree(serverProcess.pid);
      await sleep(2000);
    }

    killPortProcesses(TEST_PG_PORT);
    await sleep(1000);

    log(`Destroying test data: ${TEST_DATA_DIR}`);
    rmrf(TEST_DATA_DIR);

    log("Done. Your dev database was never touched.\n");
  }

  process.exit(exitCode);
}

main();
