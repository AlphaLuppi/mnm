import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Visibility } from "@mnm/shared";
import { companies } from "./companies.js";

/**
 * Hook configuration declared at company level. Resolved by the orchestrator
 * before each hook phase via `workflow-hooks` service. Visibility follows the
 * 3-tier invariant — private / tags (2a) / principals (2b) / company (3,
 * enforced).
 *
 * `created_by_principal_id` is `text` (no FK) because the principals table
 * does not exist as a real DB table — the concept maps to user|agent ids
 * (mirrors `tag_assignments.target_id`).
 */
export const workflowHooksConfig = pgTable(
  "workflow_hooks_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** "canonical:<slug>" | "shared:<slug>" | "local:<slug>" — hook ref. */
    hookRef: text("hook_ref").notNull(),
    /** Default `with` config merged into runtime call. JSON object, frozen at read. */
    defaultConfigJson: jsonb("default_config_json").$type<Record<string, unknown>>().notNull().default({}),
    visibility: text("visibility").$type<Visibility>().notNull().default("private"),
    createdByPrincipalId: text("created_by_principal_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    /** When true, the hook runs even if the user did not opt-in (admin-imposed). */
    enforced: boolean("enforced").notNull().default(false),
    /** Optional per-phase enforcement subset (empty = enforced on every phase). */
    enforcedPhases: text("enforced_phases").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUq: uniqueIndex("workflow_hooks_config_company_name_idx").on(
      table.companyId,
      table.name,
    ),
    companyEnforcedIdx: index("workflow_hooks_config_company_enforced_idx")
      .on(table.companyId, table.enforced, table.enabled)
      .where(sql`${table.enforced} = true`),
    visibilityCheck: check(
      "workflow_hooks_config_visibility_check",
      sql`${table.visibility} IN ('private','tags','principals','company')`,
    ),
    hookRefCheck: check(
      "workflow_hooks_config_hook_ref_check",
      sql`${table.hookRef} ~ '^(canonical|shared|local):[a-z0-9][a-z0-9-]*$'`,
    ),
  }),
);

export type WorkflowHookConfigRow = typeof workflowHooksConfig.$inferSelect;
export type NewWorkflowHookConfig = typeof workflowHooksConfig.$inferInsert;
