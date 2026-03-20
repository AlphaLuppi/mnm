import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { projects } from "./projects.js";

export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
    name: text("name"),
    status: text("status").notNull().default("open"),
    // CHAT-S02: new columns
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdBy: text("created_by"),
    description: text("description"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("chat_channels_company_agent_idx").on(table.companyId, table.agentId),
    companyStatusIdx: index("chat_channels_company_status_idx").on(table.companyId, table.status),
    heartbeatRunIdx: index("chat_channels_heartbeat_run_idx").on(table.heartbeatRunId),
    // CHAT-S02: new indexes
    companyProjectIdx: index("chat_channels_company_project_idx").on(table.companyId, table.projectId),
    companyLastMsgIdx: index("chat_channels_company_last_msg_idx").on(table.companyId, table.lastMessageAt),
  }),
);
