import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const containerProfiles = pgTable(
  "container_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    cpuMillicores: integer("cpu_millicores").notNull().default(1000),
    memoryMb: integer("memory_mb").notNull().default(512),
    diskMb: integer("disk_mb").notNull().default(1024),
    timeoutSeconds: integer("timeout_seconds").notNull().default(3600),
    gpuEnabled: boolean("gpu_enabled").notNull().default(false),
    mountAllowlist: jsonb("mount_allowlist").$type<string[]>().default([]),
    networkPolicy: text("network_policy").notNull().default("isolated"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameUniqueIdx: uniqueIndex("container_profiles_company_name_unique_idx").on(
      table.companyId,
      table.name,
    ),
    companyIdx: index("container_profiles_company_idx").on(table.companyId),
  }),
);
