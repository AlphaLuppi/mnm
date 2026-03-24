// POD-02: Per-User Sandbox schema
// Table stores user sandboxes (workspace containers) — kept as "user_pods" to avoid DB migration
import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";

export const userPods = pgTable(
  "user_pods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUsers.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    dockerContainerId: text("docker_container_id"),
    dockerImage: text("docker_image").notNull().default("mnm-agent:latest"),
    status: text("status").notNull().default("provisioning"),
    volumeName: text("volume_name"),
    workspaceVolume: text("workspace_volume"),
    cpuMillicores: integer("cpu_millicores").notNull().default(1000),
    memoryMb: integer("memory_mb").notNull().default(1024),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    claudeAuthStatus: text("claude_auth_status").notNull().default("unknown"),
    claudeOauthToken: text("claude_oauth_token"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: uniqueIndex("user_pods_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
    statusIdx: index("user_pods_status_idx").on(table.status),
    lastActiveIdx: index("user_pods_last_active_idx").on(table.lastActiveAt),
  }),
);
