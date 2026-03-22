import { eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { permissions, companies } from "@mnm/db";
import { getSeedPermissionSlugs } from "./permission-seed.js";
import { logger } from "../middleware/logger.js";

/**
 * All permission slugs referenced in route guards (requirePermission / assertCompanyPermission).
 * This list is maintained manually — if you add a new requirePermission() call,
 * add the slug here too.
 */
const ROUTE_GUARD_SLUGS = new Set([
  "agents:create",
  "agents:launch",
  "agents:configure",
  "agents:delete",
  "agents:manage_containers",
  "issues:create",
  "issues:assign",
  "issues:delete",
  "tasks:assign",
  "stories:create",
  "stories:edit",
  "projects:create",
  "projects:manage",
  "projects:manage_members",
  "users:invite",
  "users:manage",
  "users:manage_permissions",
  "joins:approve",
  "workflows:create",
  "workflows:enforce",
  "traces:read",
  "traces:write",
  "traces:manage",
  "dashboard:view",
  "company:manage_settings",
  "company:manage_sso",
  "audit:read",
  "audit:export",
  "roles:manage",
  "tags:manage",
  "chat:agent",
  "chat:channel",
  "sandbox:manage",
]);

/**
 * Validates at startup that all permission slugs used in route guards
 * exist in the seed permission set.
 *
 * This catches typos at boot time rather than at runtime.
 * Does NOT query the DB — validates against the seed definitions.
 */
export function validatePermissionSlugs(): void {
  const seedSlugs = getSeedPermissionSlugs();
  const missing: string[] = [];

  for (const slug of ROUTE_GUARD_SLUGS) {
    if (!seedSlugs.has(slug)) {
      missing.push(slug);
    }
  }

  if (missing.length > 0) {
    const msg = `Permission validation: ${missing.length} slug(s) used in route guards are NOT in the seed set: ${missing.join(", ")}`;
    if (process.env.NODE_ENV === "production") {
      logger.warn(msg);
    } else {
      logger.error(msg);
      throw new Error(msg);
    }
  }

  logger.info(`Permission validation: ${ROUTE_GUARD_SLUGS.size} route guard slugs verified against ${seedSlugs.size} seed permissions`);
}
