import { and, eq, gte, lte, desc, asc, ilike, or, count as drizzleCount } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Db } from "@mnm/db";
import { auditEvents } from "@mnm/db";
import type { AuditEventInput, AuditListResult, AuditVerifyResult } from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";
import { sanitizeRecord } from "../redaction.js";
import { notFound } from "../errors.js";

interface AuditFilters {
  companyId: string;
  actorId?: string;
  actorType?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

function buildConditions(filters: AuditFilters) {
  const conditions = [eq(auditEvents.companyId, filters.companyId)];
  if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
  if (filters.actorType) conditions.push(eq(auditEvents.actorType, filters.actorType));
  if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
  if (filters.targetType) conditions.push(eq(auditEvents.targetType, filters.targetType));
  if (filters.targetId) conditions.push(eq(auditEvents.targetId, filters.targetId));
  if (filters.severity) conditions.push(eq(auditEvents.severity, filters.severity));
  if (filters.dateFrom) conditions.push(gte(auditEvents.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(auditEvents.createdAt, new Date(filters.dateTo)));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(auditEvents.action, pattern),
        ilike(auditEvents.targetType, pattern),
        ilike(auditEvents.targetId, pattern),
      )!,
    );
  }
  return conditions;
}

function computeHash(event: { id: string; action: string; targetType: string; targetId: string; createdAt: Date }): string {
  const payload = JSON.stringify({
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    createdAt: event.createdAt.toISOString(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_BATCH_SIZE = 500;

export function auditService(db: Db) {
  return {
    emit: async (input: AuditEventInput) => {
      const sanitizedMetadata = input.metadata ? sanitizeRecord(input.metadata) : null;

      // Get the last event's hash for this company (chain)
      const lastEvent = await db
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          targetType: auditEvents.targetType,
          targetId: auditEvents.targetId,
          createdAt: auditEvents.createdAt,
        })
        .from(auditEvents)
        .where(eq(auditEvents.companyId, input.companyId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      const prevHash = lastEvent ? computeHash(lastEvent) : null;

      const [row] = await db.insert(auditEvents).values({
        companyId: input.companyId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: sanitizedMetadata,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        severity: input.severity ?? "info",
        prevHash,
      }).returning();

      publishLiveEvent({
        companyId: input.companyId,
        type: "audit.event_created",
        payload: {
          id: row!.id,
          actorType: row!.actorType,
          actorId: row!.actorId,
          action: row!.action,
          targetType: row!.targetType,
          targetId: row!.targetId,
          severity: row!.severity,
        },
      });

      return row!;
    },

    list: async (filters: AuditFilters): Promise<AuditListResult> => {
      const conditions = buildConditions(filters);
      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;
      const order = filters.sortOrder === "asc" ? asc(auditEvents.createdAt) : desc(auditEvents.createdAt);

      const [data, totalResult] = await Promise.all([
        db.select().from(auditEvents).where(and(...conditions)).orderBy(order).limit(limit).offset(offset),
        db.select({ count: drizzleCount() }).from(auditEvents).where(and(...conditions)),
      ]);

      return {
        data,
        total: Number(totalResult[0]?.count ?? 0),
        limit,
        offset,
      };
    },

    getById: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.companyId, companyId), eq(auditEvents.id, id)))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Audit event not found");
      return row;
    },

    count: async (filters: AuditFilters): Promise<number> => {
      const conditions = buildConditions(filters);
      const result = await db.select({ count: drizzleCount() }).from(auditEvents).where(and(...conditions));
      return Number(result[0]?.count ?? 0);
    },

    exportCsv: async function* (filters: AuditFilters) {
      const conditions = buildConditions(filters);
      const order = desc(auditEvents.createdAt);

      // Header row
      yield "id,createdAt,actorId,actorType,action,targetType,targetId,severity,ipAddress,metadata\n";

      let currentOffset = 0;
      while (true) {
        const rows = await db
          .select()
          .from(auditEvents)
          .where(and(...conditions))
          .orderBy(order)
          .limit(CSV_BATCH_SIZE)
          .offset(currentOffset);

        if (rows.length === 0) break;

        for (const row of rows) {
          yield [
            escapeCsvValue(row.id),
            escapeCsvValue(row.createdAt.toISOString()),
            escapeCsvValue(row.actorId),
            escapeCsvValue(row.actorType),
            escapeCsvValue(row.action),
            escapeCsvValue(row.targetType),
            escapeCsvValue(row.targetId),
            escapeCsvValue(row.severity),
            escapeCsvValue(row.ipAddress),
            escapeCsvValue(row.metadata),
          ].join(",") + "\n";
        }

        currentOffset += rows.length;
        if (rows.length < CSV_BATCH_SIZE) break;
      }
    },

    exportJson: async function* (filters: AuditFilters) {
      const conditions = buildConditions(filters);
      const order = desc(auditEvents.createdAt);

      yield "[";

      let currentOffset = 0;
      let isFirst = true;
      while (true) {
        const rows = await db
          .select()
          .from(auditEvents)
          .where(and(...conditions))
          .orderBy(order)
          .limit(CSV_BATCH_SIZE)
          .offset(currentOffset);

        if (rows.length === 0) break;

        for (const row of rows) {
          if (!isFirst) {
            yield ",";
          }
          isFirst = false;
          yield JSON.stringify(row);
        }

        currentOffset += rows.length;
        if (rows.length < CSV_BATCH_SIZE) break;
      }

      yield "]";
    },

    verifyChain: async (companyId: string, dateFrom?: string, dateTo?: string): Promise<AuditVerifyResult> => {
      const conditions = [eq(auditEvents.companyId, companyId)];
      if (dateFrom) conditions.push(gte(auditEvents.createdAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(auditEvents.createdAt, new Date(dateTo)));

      const events = await db
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(asc(auditEvents.createdAt));

      if (events.length === 0) {
        return {
          valid: true,
          eventsChecked: 0,
          firstEventId: null,
          lastEventId: null,
        };
      }

      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1]!;
        const current = events[i]!;
        const expectedHash = computeHash(prev);

        if (current.prevHash !== expectedHash) {
          return {
            valid: false,
            eventsChecked: i,
            firstEventId: events[0]!.id,
            lastEventId: events[events.length - 1]!.id,
            brokenAt: current.id,
          };
        }
      }

      return {
        valid: true,
        eventsChecked: events.length,
        firstEventId: events[0]!.id,
        lastEventId: events[events.length - 1]!.id,
      };
    },
  };
}
