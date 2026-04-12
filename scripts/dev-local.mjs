#!/usr/bin/env node
// =============================================================================
// MnM — Local Development with Docker Infrastructure
// =============================================================================
//
// Launches Docker containers (PostgreSQL + Redis) then starts the MnM server
// and UI on the host machine. This is the recommended setup for anyone with
// a local Claude subscription who wants persistent data between sessions.
//
// Why this exists:
//   In production, the database and Redis live on infrastructure servers while
//   each user consumes MnM through a local client (web UI, desktop app, or
//   MCP from Claude Code / Cursor). This script replicates that topology
//   locally: Docker handles the infra, the app runs natively so it can call
//   the Claude CLI directly via the claude_local adapter — no credential
//   forwarding, no Docker-in-Docker, just your own Claude subscription.
//
// Usage:
//   bun run local              # start everything
//   bun run local:down         # stop Docker infra
//
// Requires: Docker running, .env with DATABASE_URL + REDIS_URL pointing to
//           127.0.0.1 (see .env.example).
// =============================================================================

import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`\x1b[36m[mnm:local]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[mnm:local]\x1b[0m ${msg}`);
}

function exec(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.stdio ?? "pipe",
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

// 1. .env must have DATABASE_URL (otherwise server falls back to embedded PG)
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf8");
  if (!envContent.includes("DATABASE_URL=")) {
    error(
      ".env exists but does not contain DATABASE_URL.\n" +
      "   Add these lines to .env:\n" +
      "     DATABASE_URL=postgres://mnm:mnm_dev@127.0.0.1:5432/mnm\n" +
      "     REDIS_URL=redis://127.0.0.1:6379\n" +
      "   Or copy from .env.example."
    );
    process.exit(1);
  }
} else {
  error(
    ".env not found. Copy .env.example to .env and set DATABASE_URL + REDIS_URL."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Start Docker infra
// ---------------------------------------------------------------------------

log("Starting Docker infrastructure (PostgreSQL + Redis)...");

try {
  exec(
    "docker",
    ["compose", "-f", "docker-compose.dev.yml", "up", "-d", "--wait"],
    { stdio: "inherit" },
  );
} catch {
  error("Failed to start Docker containers. Check docker compose logs.");
  process.exit(1);
}

log("Docker infrastructure is healthy.");

// ---------------------------------------------------------------------------
// Launch MnM dev server (delegates to existing dev-runner.mjs)
// ---------------------------------------------------------------------------

log("Starting MnM server + UI on host...");
log("  Server  → http://localhost:3100");
log("  UI      → http://localhost:5173");
log("  Adapter → claude_local (your local Claude CLI)");
log("");
log("Press Ctrl+C to stop the server. Docker infra stays running.");
log("To stop everything: bun run local:down");
log("");

const child = spawn("node", ["scripts/dev-runner.mjs", "watch"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env },
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

// Forward signals so Ctrl+C stops the dev server cleanly
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
