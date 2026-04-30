// Phase 3 — Environments service (port of upstream PR #4297).
// CRUD over `environments` + lease lifecycle over `environment_leases`.
// All operations are company-scoped; the caller is expected to have
// passed assertCompanyMembership/tenantContextMiddleware before reaching
// this service (RLS gives us a fail-closed safety net).

import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  ENVIRONMENT_DRIVERS,
  ENVIRONMENT_LEASE_CLEANUP_STATUSES,
  ENVIRONMENT_LEASE_POLICIES,
  ENVIRONMENT_LEASE_STATUSES,
  ENVIRONMENT_STATUSES,
  environmentLeases,
  environments,
  type EnvironmentDriver,
  type EnvironmentLeaseCleanupStatus,
  type EnvironmentLeasePolicy,
  type EnvironmentLeaseStatus,
  type EnvironmentStatus,
} from "@mnm/db";

type EnvironmentRow = typeof environments.$inferSelect;
type EnvironmentLeaseRow = typeof environmentLeases.$inferSelect;

const DEFAULT_LOCAL_ENVIRONMENT_NAME = "Local";
const DEFAULT_LOCAL_ENVIRONMENT_DESCRIPTION =
  "Default execution environment — runs on the host machine.";

export interface Environment {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  driver: EnvironmentDriver;
  status: EnvironmentStatus;
  config: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentLease {
  id: string;
  companyId: string;
  environmentId: string;
  issueId: string | null;
  heartbeatRunId: string | null;
  status: EnvironmentLeaseStatus;
  leasePolicy: EnvironmentLeasePolicy;
  provider: string | null;
  providerLeaseId: string | null;
  acquiredAt: Date;
  lastUsedAt: Date;
  expiresAt: Date | null;
  releasedAt: Date | null;
  failureReason: string | null;
  cleanupStatus: EnvironmentLeaseCleanupStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEnvironmentInput {
  name: string;
  description?: string | null;
  driver: EnvironmentDriver;
  status?: EnvironmentStatus;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateEnvironmentInput {
  name?: string;
  description?: string | null;
  driver?: EnvironmentDriver;
  status?: EnvironmentStatus;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
}

export interface AcquireLeaseInput {
  companyId: string;
  environmentId: string;
  issueId?: string | null;
  heartbeatRunId?: string | null;
  leasePolicy?: EnvironmentLeasePolicy;
  provider?: string | null;
  providerLeaseId?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

function cloneRecord(
  value: unknown,
  fallback: Record<string, unknown> | null = null,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return { ...(value as Record<string, unknown>) };
}

function readEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fieldName: string,
): T | null {
  if (value === null) return null;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Unexpected ${fieldName} value: ${value}`);
}

function toEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description ?? null,
    driver: readEnum(row.driver, ENVIRONMENT_DRIVERS, "environment driver") ?? "local",
    status: readEnum(row.status, ENVIRONMENT_STATUSES, "environment status") ?? "active",
    config: cloneRecord(row.config, {}) ?? {},
    metadata: cloneRecord(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEnvironmentLease(row: EnvironmentLeaseRow): EnvironmentLease {
  return {
    id: row.id,
    companyId: row.companyId,
    environmentId: row.environmentId,
    issueId: row.issueId ?? null,
    heartbeatRunId: row.heartbeatRunId ?? null,
    status:
      readEnum(row.status, ENVIRONMENT_LEASE_STATUSES, "environment lease status") ?? "active",
    leasePolicy:
      readEnum(row.leasePolicy, ENVIRONMENT_LEASE_POLICIES, "environment lease policy") ??
      "ephemeral",
    provider: row.provider ?? null,
    providerLeaseId: row.providerLeaseId ?? null,
    acquiredAt: row.acquiredAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt ?? null,
    releasedAt: row.releasedAt ?? null,
    failureReason: row.failureReason ?? null,
    cleanupStatus: readEnum(
      row.cleanupStatus,
      ENVIRONMENT_LEASE_CLEANUP_STATUSES,
      "environment lease cleanup status",
    ),
    metadata: cloneRecord(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function environmentService(db: Db) {
  return {
    list: async (
      companyId: string,
      filters: { status?: EnvironmentStatus; driver?: EnvironmentDriver } = {},
    ): Promise<Environment[]> => {
      const conditions = [eq(environments.companyId, companyId)];
      if (filters.status) conditions.push(eq(environments.status, filters.status));
      if (filters.driver) conditions.push(eq(environments.driver, filters.driver));
      const rows = await db
        .select()
        .from(environments)
        .where(and(...conditions))
        .orderBy(desc(environments.updatedAt), desc(environments.createdAt));
      return rows.map(toEnvironment);
    },

    getById: async (companyId: string, id: string): Promise<Environment | null> => {
      const [row] = await db
        .select()
        .from(environments)
        .where(and(eq(environments.companyId, companyId), eq(environments.id, id)));
      return row ? toEnvironment(row) : null;
    },

    getLeaseById: async (
      companyId: string,
      id: string,
    ): Promise<EnvironmentLease | null> => {
      const [row] = await db
        .select()
        .from(environmentLeases)
        .where(and(eq(environmentLeases.companyId, companyId), eq(environmentLeases.id, id)));
      return row ? toEnvironmentLease(row) : null;
    },

    /**
     * Idempotent: looks up the company's local environment, creates one if
     * absent. Uses ON CONFLICT to be safe against races (we have a UNIQUE
     * INDEX on company_id+driver).
     */
    ensureLocalEnvironment: async (companyId: string): Promise<Environment> => {
      const now = new Date();
      const [inserted] = await db
        .insert(environments)
        .values({
          companyId,
          name: DEFAULT_LOCAL_ENVIRONMENT_NAME,
          description: DEFAULT_LOCAL_ENVIRONMENT_DESCRIPTION,
          driver: "local",
          status: "active",
          config: {},
          metadata: { managedByMnm: true, defaultForCompany: true },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [environments.companyId, environments.driver],
        })
        .returning();
      if (inserted) return toEnvironment(inserted);

      const [existing] = await db
        .select()
        .from(environments)
        .where(and(eq(environments.companyId, companyId), eq(environments.driver, "local")));
      if (!existing) throw new Error("Failed to ensure local environment");
      return toEnvironment(existing);
    },

    create: async (companyId: string, input: CreateEnvironmentInput): Promise<Environment> => {
      const now = new Date();
      const [row] = await db
        .insert(environments)
        .values({
          companyId,
          name: input.name,
          description: input.description ?? null,
          driver: input.driver,
          status: input.status ?? "active",
          config: input.config ?? {},
          metadata: input.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("Failed to create environment");
      return toEnvironment(row);
    },

    update: async (
      companyId: string,
      id: string,
      patch: UpdateEnvironmentInput,
    ): Promise<Environment | null> => {
      const values: Partial<typeof environments.$inferInsert> = { updatedAt: new Date() };
      if (patch.name !== undefined) values.name = patch.name;
      if (patch.description !== undefined) values.description = patch.description ?? null;
      if (patch.driver !== undefined) values.driver = patch.driver;
      if (patch.status !== undefined) values.status = patch.status;
      if (patch.config !== undefined) values.config = patch.config;
      if (patch.metadata !== undefined) values.metadata = patch.metadata ?? null;

      const [row] = await db
        .update(environments)
        .set(values)
        .where(and(eq(environments.companyId, companyId), eq(environments.id, id)))
        .returning();
      return row ? toEnvironment(row) : null;
    },

    archive: async (companyId: string, id: string): Promise<Environment | null> => {
      const [row] = await db
        .update(environments)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(environments.companyId, companyId), eq(environments.id, id)))
        .returning();
      return row ? toEnvironment(row) : null;
    },

    listLeases: async (
      companyId: string,
      environmentId: string,
      filters: { status?: EnvironmentLeaseStatus } = {},
    ): Promise<EnvironmentLease[]> => {
      const conditions = [
        eq(environmentLeases.companyId, companyId),
        eq(environmentLeases.environmentId, environmentId),
      ];
      if (filters.status) conditions.push(eq(environmentLeases.status, filters.status));
      const rows = await db
        .select()
        .from(environmentLeases)
        .where(and(...conditions))
        .orderBy(
          desc(environmentLeases.lastUsedAt),
          desc(environmentLeases.createdAt),
        );
      return rows.map(toEnvironmentLease);
    },

    acquireLease: async (input: AcquireLeaseInput): Promise<EnvironmentLease> => {
      const now = new Date();
      const [row] = await db
        .insert(environmentLeases)
        .values({
          companyId: input.companyId,
          environmentId: input.environmentId,
          issueId: input.issueId ?? null,
          heartbeatRunId: input.heartbeatRunId ?? null,
          status: "active",
          leasePolicy: input.leasePolicy ?? "ephemeral",
          provider: input.provider ?? null,
          providerLeaseId: input.providerLeaseId ?? null,
          acquiredAt: now,
          lastUsedAt: now,
          expiresAt: input.expiresAt ?? null,
          releasedAt: null,
          failureReason: null,
          cleanupStatus: null,
          metadata: input.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("Failed to acquire environment lease");
      return toEnvironmentLease(row);
    },

    releaseLease: async (
      companyId: string,
      id: string,
      status: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed"> = "released",
      options?: {
        failureReason?: string;
        cleanupStatus?: EnvironmentLeaseCleanupStatus;
      },
    ): Promise<EnvironmentLease | null> => {
      const now = new Date();
      const values: Partial<typeof environmentLeases.$inferInsert> = {
        status,
        releasedAt: now,
        lastUsedAt: now,
        updatedAt: now,
      };
      if (options?.failureReason !== undefined) values.failureReason = options.failureReason;
      if (options?.cleanupStatus !== undefined) values.cleanupStatus = options.cleanupStatus;

      const [row] = await db
        .update(environmentLeases)
        .set(values)
        .where(and(eq(environmentLeases.companyId, companyId), eq(environmentLeases.id, id)))
        .returning();
      return row ? toEnvironmentLease(row) : null;
    },

    updateLeaseMetadata: async (
      companyId: string,
      id: string,
      metadata: Record<string, unknown> | null,
    ): Promise<EnvironmentLease | null> => {
      const now = new Date();
      const [row] = await db
        .update(environmentLeases)
        .set({ metadata, lastUsedAt: now, updatedAt: now })
        .where(and(eq(environmentLeases.companyId, companyId), eq(environmentLeases.id, id)))
        .returning();
      return row ? toEnvironmentLease(row) : null;
    },

    /** Bulk-release every active lease attached to a heartbeat run. */
    releaseLeasesForRun: async (
      companyId: string,
      heartbeatRunId: string,
      status: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed"> = "released",
    ): Promise<EnvironmentLease[]> => {
      const now = new Date();
      const rows = await db
        .update(environmentLeases)
        .set({
          status,
          releasedAt: now,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(environmentLeases.companyId, companyId),
            eq(environmentLeases.heartbeatRunId, heartbeatRunId),
            eq(environmentLeases.status, "active"),
          ),
        )
        .returning();
      return rows.map(toEnvironmentLease);
    },
  };
}

export type EnvironmentService = ReturnType<typeof environmentService>;
