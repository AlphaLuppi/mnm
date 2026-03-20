import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const credentialProxyRules = pgTable(
  "credential_proxy_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    secretPattern: text("secret_pattern").notNull(),
    allowedAgentRoles: jsonb("allowed_agent_roles").$type<string[]>().notNull().default([]),
    proxyEndpoint: text("proxy_endpoint").notNull().default("http://credential-proxy:8090"),
    enabled: boolean("enabled").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("credential_proxy_rules_company_name_unique_idx").on(
      table.companyId,
      table.name,
    ),
    companyEnabledIdx: index("credential_proxy_rules_company_enabled_idx").on(
      table.companyId,
      table.enabled,
    ),
    companyPatternIdx: index("credential_proxy_rules_company_pattern_idx").on(
      table.companyId,
      table.secretPattern,
    ),
  }),
);
