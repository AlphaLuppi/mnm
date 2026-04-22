#!/usr/bin/env node
// =============================================================================
// MnM — Seed hello-world governed workflow into local dev
// =============================================================================
//
// Prepares everything needed to run `/mnm--onboard` → `launch hello-world`
// against a local `bun run dev` server:
//   1. Creates (or reuses) a bare git repo at ~/.mnm/dev-workflows-bare/
//      seeded with the hello-world workflow + greeter/shouter agents
//      (mirrors server/src/mcp/tools/__tests__/fixtures/seed-bare-repo.ts).
//   2. Inserts/updates governed_workflow_definitions + agents rows in the
//      local dev DB (embedded postgres @ 127.0.0.1:54329 by default).
//   3. Prints the values you need to paste into ~/.claude/settings.json
//      (company_id, server_url) and the env vars to start the server with
//      (MNM_GIT_PROVIDER=local + MNM_GIT_LOCAL_PATH=...).
//
// Usage:
//   bun run seed:hello-world
//   (or: node scripts/seed-hello-world-dev.mjs)
//
// Idempotent: running twice reuses the existing repo + rows.
// =============================================================================

import { execFile } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";

const execFileAsync = promisify(execFile);

// Script lives in server/scripts/, so ../../ is the repo root. Used purely
// to print the absolute plugin path in the final settings.json snippet.
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_PATH = resolve(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_URL =
  process.env.DATABASE_URL ?? "postgres://mnm:mnm@127.0.0.1:54329/mnm";

const REPO_ROOT = join(homedir(), ".mnm", "dev-workflows-bare");
const BARE_DIR = join(REPO_ROOT, "repo.git");
const WORK_DIR = join(REPO_ROOT, "work");
const BRANCH = "main";
const TAG = "v1.0.0";

// ---------------------------------------------------------------------------
// Seed file contents (keep in sync with seed-bare-repo.ts fixture)
// ---------------------------------------------------------------------------

const WORKFLOW_JSON = JSON.stringify(
  {
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "hello-world",
    variables: { name: { type: "string", required: true } },
    steps: [
      {
        id: "greet",
        deps: [],
        agent: "greeter",
        prompt_context: { name: "{{variables.name}}" },
        gates: {
          exit: [{ id: "greeting-ok", source: "./gates/greet-exit.gate.ts" }],
        },
      },
      {
        id: "shout",
        deps: ["greet"],
        agent: "shouter",
        prompt_context: { greeting: "{{steps.greet.artifact.greeting}}" },
        gates: {
          exit: [{ id: "uppercase-ok", source: "./gates/shout-exit.gate.ts" }],
        },
      },
    ],
  },
  null,
  2,
);

const GREET_GATE = `import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a.greeting !== "string" || !a.greeting) {
    return { pass: false, report: "no greeting", error_code: "MISSING_GREETING" };
  }
  return { pass: true, report: "ok" };
});
`;

const SHOUT_GATE = `import { defineGate } from "@mnm/governed-workflows";
export default defineGate(async (ctx) => {
  const a = ctx.artifact;
  if (!a || typeof a.shouted !== "string" || a.shouted !== a.shouted.toUpperCase()) {
    return { pass: false, report: "not uppercase" };
  }
  return { pass: true, report: "ok" };
});
`;

const GREETER_AGENT_MD = `---
name: greeter
description: Says hello
---

# Greeter agent
Greet the user warmly. Return JSON { "greeting": "<short hello message>" }.
`;

const SHOUTER_AGENT_MD = `---
name: shouter
description: Shouts in uppercase
---

# Shouter agent
Uppercase the greeting you receive. Return JSON { "shouted": "<GREETING IN ALL CAPS>" }.
`;

const SEED_FILES = {
  "hello-world/workflow.json": WORKFLOW_JSON,
  "hello-world/gates/greet-exit.gate.ts": GREET_GATE,
  "hello-world/gates/shout-exit.gate.ts": SHOUT_GATE,
  "greeter/agent.md": GREETER_AGENT_MD,
  "shouter/agent.md": SHOUTER_AGENT_MD,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`\x1b[36m[seed]\x1b[0m ${msg}`);
}

function ok(msg) {
  console.log(`\x1b[32m[seed]\x1b[0m ${msg}`);
}

function warn(msg) {
  console.warn(`\x1b[33m[seed]\x1b[0m ${msg}`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runGit(cwd, args) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// Step 1: bare repo
// ---------------------------------------------------------------------------

async function seedBareRepo() {
  const alreadySeeded = await exists(join(BARE_DIR, "HEAD"));
  if (alreadySeeded) {
    log(`Bare repo already exists at ${BARE_DIR} — reusing.`);
    return;
  }

  log(`Creating bare repo at ${BARE_DIR}...`);
  await mkdir(BARE_DIR, { recursive: true });
  await mkdir(WORK_DIR, { recursive: true });

  await runGit(BARE_DIR, ["init", "--bare", "--initial-branch", BRANCH]);
  await runGit(WORK_DIR, ["init", "--initial-branch", BRANCH]);
  await runGit(WORK_DIR, ["remote", "add", "origin", BARE_DIR]);

  for (const [relPath, content] of Object.entries(SEED_FILES)) {
    const abs = join(WORK_DIR, relPath);
    await mkdir(join(abs, ".."), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  await runGit(WORK_DIR, ["add", "-A"]);
  await runGit(WORK_DIR, [
    "-c", "user.name=mnm-dev",
    "-c", "user.email=mnm-dev@local",
    "commit", "-m", "seed hello-world",
  ]);
  await runGit(WORK_DIR, ["push", "origin", BRANCH]);

  const seedSha = await runGit(WORK_DIR, ["rev-parse", "HEAD"]);
  await runGit(BARE_DIR, ["tag", TAG, seedSha]);

  ok(`Bare repo seeded at ${BARE_DIR} (tag ${TAG} @ ${seedSha.slice(0, 7)}).`);
}

// ---------------------------------------------------------------------------
// Step 2: DB rows
// ---------------------------------------------------------------------------

async function seedDb() {
  const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });

  try {
    // Pick the first company — in local_trusted mode there's exactly one
    // auto-created at server boot.
    const companyRows = await sql`SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`;
    if (companyRows.length === 0) {
      throw new Error(
        "No company found in DB. Start the server once with `bun run dev` " +
          "so the default company is auto-created, then re-run this script.",
      );
    }
    const companyId = companyRows[0].id;
    log(`Using companyId = ${companyId}`);

    // Upsert hello-world workflow definition.
    await sql`
      INSERT INTO governed_workflow_definitions (company_id, name, latest_git_tag)
      VALUES (${companyId}, 'hello-world', ${TAG})
      ON CONFLICT (company_id, name) DO UPDATE SET latest_git_tag = EXCLUDED.latest_git_tag
    `;
    ok("governed_workflow_definitions row ready (hello-world).");

    // Upsert greeter + shouter agent rows. We match on (company_id, name).
    for (const agentName of ["greeter", "shouter"]) {
      const existing = await sql`
        SELECT id FROM agents WHERE company_id = ${companyId} AND name = ${agentName}
      `;
      if (existing.length > 0) {
        await sql`UPDATE agents SET latest_git_tag = ${TAG} WHERE id = ${existing[0].id}`;
      } else {
        // Minimal insert — adapter_type + metadata depend on schema; leave
        // at schema defaults where possible. Adjust if your schema rejects.
        await sql`
          INSERT INTO agents (company_id, name, adapter_type, latest_git_tag, created_at)
          VALUES (${companyId}, ${agentName}, 'claude_local', ${TAG}, NOW())
        `;
      }
      ok(`agents row ready (${agentName}).`);
    }

    return companyId;
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  log(`DATABASE_URL = ${DB_URL}`);
  await seedBareRepo();
  const companyId = await seedDb();

  console.log("");
  console.log("================================================================");
  ok("Seed complete.");
  console.log("================================================================");
  console.log("");
  console.log("Next steps:");
  console.log("");
  console.log("  1. Start the server with the local git provider (new terminal):");
  console.log("");
  console.log(`       MNM_GIT_PROVIDER=local \\`);
  console.log(`       MNM_GIT_LOCAL_PATH="${BARE_DIR}" \\`);
  console.log(`       bun run dev`);
  console.log("");
  console.log("  2. Add this block to ~/.claude/settings.json and restart Claude Code:");
  console.log("");
  console.log(`       {`);
  console.log(`         "extraLocalPlugins": [`);
  console.log(`           {`);
  console.log(`             "id": "mnm",`);
  console.log(`             "source": {`);
  console.log(`               "type": "local",`);
  console.log(`               "path": "${REPO_ROOT_PATH.replace(/\\/g, "/")}/plugins/mnm"`);
  console.log(`             }`);
  console.log(`           }`);
  console.log(`         ]`);
  console.log(`       }`);
  console.log("");
  console.log("  3. In the new Claude Code session configure the plugin when prompted:");
  console.log(`       company_id = ${companyId}`);
  console.log(`       server_url = http://127.0.0.1:3100`);
  console.log("");
  console.log("  4. Run /mnm--onboard and follow the skill's instructions.");
  console.log("");
})().catch((e) => {
  console.error("\x1b[31m[seed]\x1b[0m", e);
  process.exit(1);
});
