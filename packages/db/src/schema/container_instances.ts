import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { containerProfiles } from "./container_profiles.js";

export const containerInstances = pgTable(
  "container_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    profileId: uuid("profile_id").notNull().references(() => containerProfiles.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    dockerContainerId: text("docker_container_id"),
    status: text("status").notNull().default("pending"),
    exitCode: integer("exit_code"),
    error: text("error"),
    resourceUsage: jsonb("resource_usage").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    // CONT-S05: New columns
    networkId: text("network_id"), // cont-s05-instance-network-id-col
    credentialProxyPort: integer("credential_proxy_port"), // cont-s05-instance-credential-proxy-port-col
    mountedPaths: jsonb("mounted_paths").$type<string[]>(), // cont-s05-instance-mounted-paths-col
    healthCheckStatus: text("health_check_status").notNull().default("unknown"), // cont-s05-instance-health-check-status-col
    restartCount: integer("restart_count").notNull().default(0), // cont-s05-instance-restart-count-col
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }), // cont-s05-instance-last-health-check-col
    labels: jsonb("labels").$type<Record<string, string>>(), // cont-s05-instance-labels-col
    logStreamUrl: text("log_stream_url"), // cont-s05-instance-log-stream-url-col
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("container_instances_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    companyAgentIdx: index("container_instances_company_agent_idx").on(
      table.companyId,
      table.agentId,
    ),
    dockerContainerIdx: index("container_instances_docker_container_idx").on(
      table.dockerContainerId,
    ),
    profileIdx: index("container_instances_profile_idx").on(table.profileId),
    // cont-s05-instance-health-idx
    healthIdx: index("container_instances_health_idx").on(
      table.companyId,
      table.healthCheckStatus,
    ),
    // cont-s05-instance-restart-idx
    restartIdx: index("container_instances_restart_idx").on(
      table.companyId,
      table.restartCount,
    ),
  }),
);
