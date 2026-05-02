import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { oauthConnectors } from "./oauth_connectors.js";

export const oauthConnectorsAudit = pgTable(
  "oauth_connectors_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id").references(() => oauthConnectors.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id").references(() => authUsers.id),
    action: text("action").notNull(),
    diffJson: jsonb("diff_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyActionIdx: index("oauth_connectors_audit_company_action_idx").on(
      table.companyId,
      table.action,
      table.createdAt,
    ),
    actionCheck: check(
      "oauth_connectors_audit_action_check",
      sql`action IN (
        'connector_created','connector_updated','connector_deleted','connector_enabled','connector_disabled',
        'user_connected','user_disconnected','user_refresh_failed','user_token_revoked',
        'token_used','redirect_after_rejected'
      )`,
    ),
  }),
);
