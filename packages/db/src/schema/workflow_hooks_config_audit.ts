import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { workflowHooksConfig } from "./workflow_hooks_config.js";

export const WORKFLOW_HOOK_CONFIG_AUDIT_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "enforced_on",
  "enforced_off",
  "enabled_on",
  "enabled_off",
] as const;
export type WorkflowHookConfigAuditAction =
  (typeof WORKFLOW_HOOK_CONFIG_AUDIT_ACTIONS)[number];

/**
 * Append-only admin audit trail for hook config CRUD + flag flips.
 * Used to surface "who turned `enforced` on, when, with what diff" in the
 * Hooks admin UI and the company audit log. `actor_principal_id` is text
 * (no FK) for the same reasons as the configs table.
 */
export const workflowHooksConfigAudit = pgTable(
  "workflow_hooks_config_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    configId: uuid("config_id").references(() => workflowHooksConfig.id, {
      onDelete: "set null",
    }),
    actorPrincipalId: text("actor_principal_id"),
    action: text("action").$type<WorkflowHookConfigAuditAction>().notNull(),
    diffJson: jsonb("diff_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyConfigIdx: index("workflow_hooks_config_audit_company_config_idx").on(
      table.companyId,
      table.configId,
      table.createdAt,
    ),
    actionCheck: check(
      "workflow_hooks_config_audit_action_check",
      sql`${table.action} IN (
        'created','updated','deleted',
        'enforced_on','enforced_off',
        'enabled_on','enabled_off'
      )`,
    ),
  }),
);

export type WorkflowHookConfigAuditRow =
  typeof workflowHooksConfigAudit.$inferSelect;
export type NewWorkflowHookConfigAudit =
  typeof workflowHooksConfigAudit.$inferInsert;
