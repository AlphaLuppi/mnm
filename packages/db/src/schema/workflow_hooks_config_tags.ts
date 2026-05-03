import { pgTable, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { tags } from "./tags.js";
import { workflowHooksConfig } from "./workflow_hooks_config.js";

/**
 * Tier-2a sharing join — workflow hook configs whose `visibility = "tags"`.
 * Resolved by `hasTagIntersection` resolver in `workflow-hooks` service.
 */
export const workflowHooksConfigTags = pgTable(
  "workflow_hooks_config_tags",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => workflowHooksConfig.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.configId, table.tagId] }),
    companyTagIdx: index("workflow_hooks_config_tags_company_tag_idx").on(
      table.companyId,
      table.tagId,
    ),
  }),
);

export type WorkflowHookConfigTagRow = typeof workflowHooksConfigTags.$inferSelect;
export type NewWorkflowHookConfigTag = typeof workflowHooksConfigTags.$inferInsert;
