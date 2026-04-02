import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Config Layers — shareable, versioned configuration bundles for agents.
 * A layer can contain MCP server definitions, env var overrides, tool restrictions, etc.
 * Layers are company-scoped and can be enforced top-down or attached bottom-up.
 */
export const configLayers = pgTable(
  "config_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    /** "company" = platform-wide enforced layer, "project" = team/project-scoped */
    scope: text("scope").notNull().default("project"),
    /** "public" | "team" | "private" */
    visibility: text("visibility").notNull().default("private"),
    /** Payload: MCP entries, env vars, tool restrictions */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** Whether this layer is enforced and cannot be detached by agents */
    enforced: boolean("enforced").notNull().default(false),
    createdByUserId: text("created_by_user_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("config_layers_company_idx").on(table.companyId),
    companyScopeIdx: index("config_layers_company_scope_idx").on(table.companyId, table.scope),
  }),
);
