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
  }),
);
