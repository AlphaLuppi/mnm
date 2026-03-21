// DEPLOY-01: Artifact Deployment schema
import { pgTable, uuid, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { issues } from "./issues.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";

export const artifactDeployments = pgTable(
  "artifact_deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull().references(() => authUsers.id),
    issueId: uuid("issue_id").references(() => issues.id),
    runId: uuid("run_id").references(() => heartbeatRuns.id),
    agentId: uuid("agent_id").references(() => agents.id),
    projectId: uuid("project_id").references(() => projects.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("building"),
    projectType: text("project_type").notNull().default("unknown"),
    dockerContainerId: text("docker_container_id"),
    port: integer("port"),
    sourcePath: text("source_path").notNull(),
    buildLog: text("build_log"),
    ttlSeconds: integer("ttl_seconds").notNull().default(86400),
    pinned: boolean("pinned").notNull().default(false),
    shareToken: text("share_token"),
    url: text("url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("artifact_deployments_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    expiresAtIdx: index("artifact_deployments_expires_at_idx").on(table.expiresAt),
    issueIdIdx: index("artifact_deployments_issue_id_idx").on(table.issueId),
    shareTokenIdx: index("artifact_deployments_share_token_idx").on(table.shareToken),
  }),
);
