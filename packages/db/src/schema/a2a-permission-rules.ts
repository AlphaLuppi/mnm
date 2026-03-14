/**
 * A2A-S02: a2a_permission_rules table — Granular A2A permissions
 *
 * Defines access control rules for agent-to-agent communication.
 * Rules can be role-based or agent-specific (ID-based), with
 * priority ordering and bidirectional support.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

// a2a-s02-schema-table
export const a2aPermissionRules = pgTable(
  "a2a_permission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    sourceAgentId: uuid("source_agent_id").references(() => agents.id, { onDelete: "cascade" }),
    sourceAgentRole: text("source_agent_role"),
    targetAgentId: uuid("target_agent_id").references(() => agents.id, { onDelete: "cascade" }),
    targetAgentRole: text("target_agent_role"),
    allowed: boolean("allowed").notNull().default(true),
    bidirectional: boolean("bidirectional").notNull().default(false),
    priority: integer("priority").notNull().default(0),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // a2a-s02-schema-indexes
  (table) => ({
    companyIdx: index("a2a_perm_rules_company_idx").on(table.companyId),
    sourceRoleIdx: index("a2a_perm_rules_source_role_idx").on(table.companyId, table.sourceAgentRole),
    targetRoleIdx: index("a2a_perm_rules_target_role_idx").on(table.companyId, table.targetAgentRole),
    priorityIdx: index("a2a_perm_rules_priority_idx").on(table.companyId, table.priority),
  }),
);
