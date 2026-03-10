#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Kill any stale embedded postgres process left over from a previous run
const pgDataDir = join(homedir(), ".mnm", "instances", "default", "db");
const pidFile = join(pgDataDir, "postmaster.pid");
if (existsSync(pidFile)) {
  try {
    const pid = parseInt(readFileSync(pidFile, "utf8").split(/\r?\n/)[0] ?? "", 10);
    if (Number.isInteger(pid) && pid > 0) {
      try {
        if (process.platform === "win32") {
          execFileSync("taskkill", ["/F", "/PID", String(pid), "/T"], { stdio: "ignore" });
        } else {
          process.kill(pid, "SIGKILL");
        }
        console.log(`[mnm] Killed stale postgres process (pid=${pid})`);
      } catch {
        // Already dead — fine
      }
    }
  } catch {
    // Malformed or missing pid file — ignore
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
  MNM_MIGRATION_PROMPT: "never",
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

const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const serverScript = mode === "watch" ? "dev:watch" : "dev";
const child = spawn(
  pnpmBin,
  ["--filter", "@mnm/server", serverScript, ...forwardedArgs],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

