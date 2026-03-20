import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("contributor"),
    grantedBy: text("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProjectUserUniqueIdx: uniqueIndex(
      "project_memberships_company_project_user_unique_idx",
    ).on(table.companyId, table.projectId, table.userId),
    companyUserIdx: index("project_memberships_company_user_idx").on(
      table.companyId,
      table.userId,
    ),
    companyProjectIdx: index("project_memberships_company_project_idx").on(
      table.companyId,
      table.projectId,
    ),
  }),
);
