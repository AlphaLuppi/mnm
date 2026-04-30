// Phase 3 — Port of upstream PR #4297 (BETA Environments — leases).
// Lease lifecycle: active -> released | expired | failed.
// Adapted for MnM: drop executionWorkspaces FK (no such table here).

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { environments } from "./environments.js";
import { issues } from "./issues.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const ENVIRONMENT_LEASE_STATUSES = ["active", "released", "expired", "failed"] as const;
export type EnvironmentLeaseStatus = (typeof ENVIRONMENT_LEASE_STATUSES)[number];

export const ENVIRONMENT_LEASE_POLICIES = ["ephemeral", "pinned"] as const;
export type EnvironmentLeasePolicy = (typeof ENVIRONMENT_LEASE_POLICIES)[number];

export const ENVIRONMENT_LEASE_CLEANUP_STATUSES = ["pending", "success", "failed"] as const;
export type EnvironmentLeaseCleanupStatus = (typeof ENVIRONMENT_LEASE_CLEANUP_STATUSES)[number];

export const environmentLeases = pgTable(
  "environment_leases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<EnvironmentLeaseStatus>().notNull().default("active"),
    leasePolicy: text("lease_policy")
      .$type<EnvironmentLeasePolicy>()
      .notNull()
      .default("ephemeral"),
    provider: text("provider"),
    providerLeaseId: text("provider_lease_id"),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    cleanupStatus: text("cleanup_status").$type<EnvironmentLeaseCleanupStatus | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyEnvironmentStatusIdx: index("environment_leases_company_environment_status_idx").on(
      table.companyId,
      table.environmentId,
      table.status,
    ),
    companyIssueIdx: index("environment_leases_company_issue_idx").on(
      table.companyId,
      table.issueId,
    ),
    heartbeatRunIdx: index("environment_leases_heartbeat_run_idx").on(table.heartbeatRunId),
    companyLastUsedIdx: index("environment_leases_company_last_used_idx").on(
      table.companyId,
      table.lastUsedAt,
    ),
    providerLeaseIdx: index("environment_leases_provider_lease_idx").on(table.providerLeaseId),
  }),
);
