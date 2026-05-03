// Smoke helper — drives a hello-world run from launchStep → completeStep
// via the in-process governedWorkflowService. Bypasses MCP auth.
//
// Usage: bun --cwd server scripts/smoke-complete-hello-world.mjs <runId>

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const runId = process.argv[2];
if (!runId) {
  console.error("usage: smoke-complete-hello-world.mjs <runId>");
  process.exit(1);
}

const COMPANY_ID = "1910e46d-7853-4b68-9c98-e47fae1b5fa8";
const ACTOR_ID = "00000000-0000-0000-0000-000000000001"; // boot-board user (local_trusted)

process.env.DATABASE_URL ||= "postgres://mnm:mnm@127.0.0.1:54329/mnm";
process.env.MNM_GIT_PROVIDER ||= "local";
process.env.MNM_GIT_LOCAL_PATH ||= "C:\\Users\\andri\\.mnm\\dev-workflows-bare\\repo.git";

const { governedWorkflowService } = await import("../src/services/governed-workflows.ts");
const { createResolveGitProvider } = await import("../src/mcp/build-mcp-services.ts");
const { ShaCache } = await import("@mnm/git-provider");

const sql = postgres(process.env.DATABASE_URL, { max: 4 });
const db = drizzle(sql);

// Pick the first board-user from this company so we have a real actor id.
const [actor] = await sql`
  SELECT cm.principal_id AS id
  FROM company_memberships cm
  WHERE cm.company_id = ${COMPANY_ID}
    AND cm.principal_type = 'user'
  LIMIT 1
`;
if (!actor) {
  console.error("no user found in company; aborting");
  process.exit(1);
}
console.log("[smoke] actor:", actor.id);

const resolveGitProvider = createResolveGitProvider(db);
const shaCache = new ShaCache();
const svc = governedWorkflowService(db, { resolveGitProvider, shaCache });

async function go(stepName, artifactPayload, outputs = []) {
  console.log(`[smoke] launchStep(${stepName}) ...`);
  await svc.launchStep({
    companyId: COMPANY_ID,
    runId,
    stepId: stepName,
    actor: { type: "user", id: actor.id },
  });
  console.log(`[smoke] completeStep(${stepName}) ...`);
  const r = await svc.completeStep({
    companyId: COMPANY_ID,
    runId,
    stepId: stepName,
    artifact: { schema_version: "v2c", outputs, data: artifactPayload, ...artifactPayload },
    actor: { type: "user", id: actor.id },
  });
  console.log(`[smoke] step ${stepName} → state=${r?.stepState ?? "?"}, runState=${r?.runState ?? "?"}`);
}

await go(
  "greet",
  { greeting: "Hello tom!" },
  [
    { kind: "external_url", name: "greeter-doc", url: "https://example.com/greet" },
  ],
);
await go(
  "shout",
  { shouted: "HELLO TOM!" },
  [
    { kind: "external_url", name: "shouter-doc", url: "https://example.com/shout" },
  ],
);

await sql.end();
console.log("[smoke] done");
