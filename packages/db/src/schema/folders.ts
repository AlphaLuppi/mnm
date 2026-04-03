import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    visibility: text("visibility").notNull().default("private"),
    ownerUserId: text("owner_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOwnerIdx: index("folders_company_owner_idx").on(table.companyId, table.ownerUserId),
    companyVisibilityIdx: index("folders_company_visibility_idx").on(table.companyId, table.visibility),
  }),
);
