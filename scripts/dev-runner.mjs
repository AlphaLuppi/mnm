#!/usr/bin/env node
import { spawn } from "node:child_process";

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

