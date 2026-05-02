import { pgTable, uuid, text, primaryKey, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { workflowHooksConfig } from "./workflow_hooks_config.js";

/**
 * Tier-2b sharing join — workflow hook configs whose `visibility = "principals"`.
 * Resolved by `isPrincipalListed` resolver in `workflow-hooks` service.
 *
 * `principal_id` is `text` (no FK) — same rationale as
 * `tag_assignments.target_id` : maps to either user.id (text) or agent.id (uuid stringified).
 */
export const workflowHooksConfigPrincipals = pgTable(
  "workflow_hooks_config_principals",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => workflowHooksConfig.id, { onDelete: "cascade" }),
    principalId: text("principal_id").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.configId, table.principalId] }),
    companyPrincipalIdx: index(
      "workflow_hooks_config_principals_company_principal_idx",
    ).on(table.companyId, table.principalId),
  }),
);

export type WorkflowHookConfigPrincipalRow =
  typeof workflowHooksConfigPrincipals.$inferSelect;
export type NewWorkflowHookConfigPrincipal =
  typeof workflowHooksConfigPrincipals.$inferInsert;
