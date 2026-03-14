import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id),
    name: text("name"),
    status: text("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAgentIdx: index("chat_channels_company_agent_idx").on(table.companyId, table.agentId),
    companyStatusIdx: index("chat_channels_company_status_idx").on(table.companyId, table.status),
    heartbeatRunIdx: index("chat_channels_heartbeat_run_idx").on(table.heartbeatRunId),
  }),
);
