// Phase 3 — Port of upstream PR #4297 (BETA Environments).
// Multi-tenant: company_id is the RLS isolation key. Driver enum =
// local|ssh|sandbox|plugin (MnM extension over upstream). Status state
// machine kept simple (active|archived) — provider-side state lives in
// metadata + leases.

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const ENVIRONMENT_DRIVERS = ["local", "ssh", "sandbox", "plugin"] as const;
export type EnvironmentDriver = (typeof ENVIRONMENT_DRIVERS)[number];

export const ENVIRONMENT_STATUSES = ["active", "archived"] as const;
export type EnvironmentStatus = (typeof ENVIRONMENT_STATUSES)[number];

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    driver: text("driver").$type<EnvironmentDriver>().notNull().default("local"),
    status: text("status").$type<EnvironmentStatus>().notNull().default("active"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("environments_company_status_idx").on(
      table.companyId,
      table.status,
    ),
    companyDriverIdx: uniqueIndex("environments_company_driver_idx").on(
      table.companyId,
      table.driver,
    ),
    companyNameIdx: index("environments_company_name_idx").on(
      table.companyId,
      table.name,
    ),
  }),
);
