import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Per-user, per-company sound preferences. One row per (companyId, userId).
 * `tones` maps each ToastTone to a sound reference string:
 *   "none" | "builtin:<id>" | "asset:<uuid>".
 */
export const userSoundSettings = pgTable(
  "user_sound_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    volume: integer("volume").notNull().default(70),
    tones: jsonb("tones")
      .notNull()
      .$type<{ info: string; success: string; warn: string; error: string }>()
      .default({ info: "none", success: "none", warn: "none", error: "none" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserUq: uniqueIndex("user_sound_settings_company_user_uq").on(table.companyId, table.userId),
  }),
);
