import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const agentApiKeys = pgTable(
  "agent_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // SEC-T8-07: expiry — new keys get 90 days from creation; NULL = no expiry (legacy only)
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyHashIdx: index("agent_api_keys_key_hash_idx").on(table.keyHash),
    companyAgentIdx: index("agent_api_keys_company_agent_idx").on(table.companyId, table.agentId),
    expiresAtIdx: index("agent_api_keys_expires_at_idx").on(table.expiresAt),
  }),
);
