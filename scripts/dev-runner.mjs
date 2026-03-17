#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Kill any stale embedded postgres process left over from a previous run.
// On Windows we do this unconditionally because the process may survive without a pid file.
const pgDataDir = join(homedir(), ".mnm", "instances", "default", "db");
const pidFile = join(pgDataDir, "postmaster.pid");

if (process.platform === "win32") {
  try {
    execFileSync("taskkill", ["/F", "/IM", "postgres.exe", "/T"], { stdio: "ignore" });
    console.log("[mnm] Killed stale postgres.exe processes");
    // Give Windows a moment to release the shared memory segment
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
  } catch {
    // None running — fine
  }
} else if (existsSync(pidFile)) {
  try {
    const pid = parseInt(readFileSync(pidFile, "utf8").split(/\r?\n/)[0] ?? "", 10);
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, "SIGKILL");
        console.log(`[mnm] Killed stale postgres process (pid=${pid})`);
      } catch {
        // Already dead — fine
      }
    }
  } catch {
    // Malformed pid file — ignore
  }
}

// Kill any stale MnM server process still holding port 3100.
// This happens when tsx watch restarts but the previous node process hasn't released the port yet,
// causing the new server to silently bind on a different port (e.g. 3101) while the browser
// keeps talking to 3100 and sees stale routes.
const MNM_DEV_PORT = Number(process.env.PORT) || 3100;
if (process.platform === "win32") {
  try {
    const netstatOut = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    for (const line of netstatOut.split(/\r?\n/)) {
      if (line.includes(`:${MNM_DEV_PORT}`) && line.includes("LISTENING")) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          try {
            execFileSync("taskkill", ["/F", "/PID", pid], { stdio: "ignore" });
            console.log(`[mnm] Killed stale server on port ${MNM_DEV_PORT} (pid=${pid})`);
          } catch {
            // Already dead — fine
          }
        }
      }
    }
  } catch {
    // netstat unavailable or no match — fine
  }
} else {
  try {
    const out = execFileSync("lsof", ["-ti", `:${MNM_DEV_PORT}`], { encoding: "utf8" });
    for (const pid of out.split("\n").filter(Boolean)) {
      const n = parseInt(pid, 10);
      if (Number.isInteger(n) && n > 0) {
        try { process.kill(n, "SIGKILL"); } catch { /* Already dead */ }
        console.log(`[mnm] Killed stale server on port ${MNM_DEV_PORT} (pid=${n})`);
      }
    }
  } catch {
    // lsof unavailable or no match — fine
  }
}

// Remove stale pid file so postgres doesn't try to reclaim the shared memory segment
if (existsSync(pidFile)) {
  try {
    unlinkSync(pidFile);
    console.log("[mnm] Removed stale postmaster.pid");
  } catch {
    // Already gone — fine
  }
}

const mode = process.argv[2] === "watch" ? "watch" : "dev";
const cliArgs = process.argv.slice(3);

const tailscaleAuthFlagNames = new Set([
  "--tailscale-auth",
  "--authenticated-private",
]);

let tailscaleAuth = false;
const forwardedArgs = [];

for (const arg of cliArgs) {
  if (tailscaleAuthFlagNames.has(arg)) {
    tailscaleAuth = true;
    continue;
  }
  forwardedArgs.push(arg);
}

if (process.env.npm_config_tailscale_auth === "true") {
  tailscaleAuth = true;
}
if (process.env.npm_config_authenticated_private === "true") {
  tailscaleAuth = true;
}

const env = {
  ...process.env,
  MNM_UI_DEV_MIDDLEWARE: "true",
  MNM_MIGRATION_AUTO_APPLY: "true",
  // Provide a dev fallback so local agents get MNM_API_KEY injected without running `mnm onboard`.
  MNM_AGENT_JWT_SECRET: process.env.MNM_AGENT_JWT_SECRET ?? "mnm-dev-secret",
};

if (tailscaleAuth) {
  env.MNM_DEPLOYMENT_MODE = "authenticated";
  env.MNM_DEPLOYMENT_EXPOSURE = "private";
  env.MNM_AUTH_BASE_URL_MODE = "auto";
  env.HOST = "0.0.0.0";
  console.log("[mnm] dev mode: authenticated/private (tailscale-friendly) on 0.0.0.0");
} else {
  console.log("[mnm] dev mode: local_trusted (default)");
}

const bunBin = process.platform === "win32" ? "bun.exe" : "bun";
const serverScript = mode === "watch" ? "dev:watch" : "dev";
const child = spawn(
  bunBin,
  ["run", "--cwd", "server", serverScript, ...forwardedArgs],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

