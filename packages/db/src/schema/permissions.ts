import { pgTable, uuid, text, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    isCustom: boolean("is_custom").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugIdx: uniqueIndex("permissions_company_slug_idx").on(table.companyId, table.slug),
    companyCategoryIdx: index("permissions_company_category_idx").on(table.companyId, table.category),
  }),
);
