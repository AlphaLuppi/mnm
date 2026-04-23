#!/usr/bin/env node
// =============================================================================
// MnM — Backfill missing read permissions on the admin role
// =============================================================================
//
// The admin role in some older DB snapshots is incomplete (only 33/91 perms):
// it holds create/enforce/manage permissions but NOT the matching :read ones.
// The MCP scope -> permission mapping grants the admin role workflows:read via
// the mcp:read scope only if admin already has it in role_permissions. When
// missing, tools that require workflows:read (list_governed_workflows,
// setup_workspace, push_local_state, sync_governed_environment) are filtered
// out of the MCP tools/list response — breaking /mnm--onboard.
//
// This script grants the baseline VIEWER-level permissions to the admin role
// so the full governed-workflows tool surface becomes visible over MCP.
// Idempotent — safe to rerun.
//
// Usage:
//   bun run backfill:admin-perms
// =============================================================================

import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL ?? "postgres://mnm:mnm@127.0.0.1:54329/mnm";

// All :read / :view / baseline-discover permissions that the admin role
// should carry. Mirrored from VIEWER_PERMS in server/src/services/permission-seed.ts
// so the list stays in one place visually even though we're not importing
// from the server at runtime (this script is a standalone dev aid).
const VIEWER_PERMS = [
  "agents:read",
  "issues:read",
  "projects:read",
  "workflows:read",
  "chat:read",
  "artifacts:read",
  "documents:read",
  "folders:read",
  "config_layers:read",
  "traces:read",
  "dashboard:view",
  "sandbox:read",
  "roles:read",
  "tags:read",
  "feedback:read",
  "routines:read",
  "org:view",
  "inbox:read",
  "users:read",
];

const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });

try {
  const adminRoles = await sql`SELECT id, slug, company_id FROM roles WHERE slug = 'admin'`;
  if (adminRoles.length === 0) {
    console.error("[backfill] No admin role found. Did the server boot successfully?");
    process.exit(1);
  }

  let grantedTotal = 0;
  for (const role of adminRoles) {
    for (const slug of VIEWER_PERMS) {
      const r = await sql`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT ${role.id}, p.id
        FROM permissions p
        WHERE p.slug = ${slug}
        ON CONFLICT DO NOTHING
        RETURNING role_id
      `;
      if (r.length > 0) grantedTotal += 1;
    }
  }

  console.log(`[backfill] admin role(s): ${adminRoles.length}`);
  console.log(`[backfill] new grants: ${grantedTotal}`);
  console.log(`[backfill] done. Reconnect MCP (disconnect in /mcp then Authenticate) so the new tools appear in tools/list.`);
} finally {
  await sql.end();
}
