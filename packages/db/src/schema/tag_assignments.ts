import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { tags } from "./tags.js";

export const tagAssignments = pgTable(
  "tag_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    targetType: text("target_type").notNull(), // 'user' | 'agent'
    targetId: text("target_id").notNull(),
    tagId: uuid("tag_id").notNull().references(() => tags.id),
    assignedBy: text("assigned_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTagAssignmentIdx: uniqueIndex("tag_assignments_unique_idx").on(
      table.companyId,
      table.targetType,
      table.targetId,
      table.tagId,
    ),
    targetIdx: index("tag_assignments_target_idx").on(
      table.companyId,
      table.targetType,
      table.targetId,
    ),
    tagIdx: index("tag_assignments_tag_idx").on(table.companyId, table.tagId),
  }),
);
