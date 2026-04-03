import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { folders } from "./folders.js";

export const folderShares = pgTable(
  "folder_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    sharedWithUserId: text("shared_with_user_id").notNull(),
    permission: text("permission").notNull().default("viewer"),
    sharedByUserId: text("shared_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueShare: uniqueIndex("folder_shares_unique_idx").on(
      table.folderId,
      table.sharedWithUserId,
    ),
    folderIdx: index("folder_shares_folder_idx").on(table.folderId),
    userIdx: index("folder_shares_user_idx").on(
      table.sharedWithUserId,
      table.companyId,
    ),
  }),
);
