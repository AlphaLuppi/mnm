import { and, eq, desc, isNull, count as drizzleCount } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { driftReports, driftItems } from "@mnm/db";
import type {
  DriftReport,
  DriftItem,
  DriftDecision,
  DriftReportFilters,
  DriftItemFilters,
  DriftScanStatus,
} from "@mnm/shared";

/** Input for creating a drift report with its items in a single transaction */
export interface CreateDriftReportInput {
  companyId: string;
  projectId: string;
  sourceDoc: string;
  targetDoc: string;
  scanScope?: string;
  status?: string;
  errorMessage?: string;
  items: Array<{
    severity: string;
    driftType: string;
    confidence: number;
    description: string;
    recommendation: string;
    sourceExcerpt?: string;
    targetExcerpt?: string;
    sourceDoc: string;
    targetDoc: string;
  }>;
}

/** Map a DB drift report row + items to the shared DriftReport type */
function toReportDto(
  row: typeof driftReports.$inferSelect,
  items: Array<typeof driftItems.$inferSelect>,
): DriftReport {
  return {
    id: row.id,
    projectId: row.projectId,
    companyId: row.companyId,
    sourceDoc: row.sourceDoc,
    targetDoc: row.targetDoc,
    driftCount: row.driftCount,
    status: row.status as DriftReport["status"],
    scanScope: row.scanScope ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    checkedAt: row.checkedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? undefined,
    drifts: items.map(toItemDto),
  };
}

/** Map a DB drift item row to the shared DriftItem type */
function toItemDto(row: typeof driftItems.$inferSelect): DriftItem {
  return {
    id: row.id,
    reportId: row.reportId,
    companyId: row.companyId,
    severity: row.severity as DriftItem["severity"],
    driftType: row.driftType as DriftItem["driftType"],
    confidence: row.confidence,
    description: row.description,
    recommendation: row.recommendation as DriftItem["recommendation"],
    sourceExcerpt: row.sourceExcerpt ?? "",
    targetExcerpt: row.targetExcerpt ?? "",
    sourceDoc: row.sourceDoc,
    targetDoc: row.targetDoc,
    decision: row.decision as DriftDecision,
    decidedAt: row.decidedAt?.toISOString() ?? undefined,
    decidedBy: row.decidedBy ?? undefined,
    remediationNote: row.remediationNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function driftPersistenceService(db: Db) {
  return {
    /**
     * Create a drift report and its items in a single atomic transaction.
     */
    async createReport(input: CreateDriftReportInput): Promise<DriftReport> {
      return db.transaction(async (tx) => {
        const [report] = await tx.insert(driftReports).values({
          companyId: input.companyId,
          projectId: input.projectId,
          sourceDoc: input.sourceDoc,
          targetDoc: input.targetDoc,
          scanScope: input.scanScope ?? null,
          status: input.status ?? "completed",
          errorMessage: input.errorMessage ?? null,
          driftCount: input.items.length,
          checkedAt: new Date(),
        }).returning();

        let createdItems: Array<typeof driftItems.$inferSelect> = [];

        if (input.items.length > 0) {
          createdItems = await tx.insert(driftItems).values(
            input.items.map((item) => ({
              companyId: input.companyId,
              reportId: report!.id,
              severity: item.severity,
              driftType: item.driftType,
              confidence: item.confidence,
              description: item.description,
              recommendation: item.recommendation,
              sourceExcerpt: item.sourceExcerpt ?? null,
              targetExcerpt: item.targetExcerpt ?? null,
              sourceDoc: item.sourceDoc,
              targetDoc: item.targetDoc,
              decision: "pending",
            })),
          ).returning();
        }

        return toReportDto(report!, createdItems);
      });
    },

    /**
     * Get a single report by ID, scoped by companyId.
     */
    async getReportById(companyId: string, reportId: string): Promise<DriftReport | null> {
      const rows = await db
        .select()
        .from(driftReports)
        .where(and(eq(driftReports.companyId, companyId), eq(driftReports.id, reportId)));

      const row = rows[0];
      if (!row) return null;

      const items = await db
        .select()
        .from(driftItems)
        .where(eq(driftItems.reportId, row.id));

      return toReportDto(row, items);
    },

    /**
     * List reports with filters and pagination.
     * Returns { data, total } for paginated responses.
     */
    async listReports(filters: DriftReportFilters): Promise<{ data: DriftReport[]; total: number }> {
      const conditions = [eq(driftReports.companyId, filters.companyId)];
      if (filters.projectId) {
        conditions.push(eq(driftReports.projectId, filters.projectId));
      }
      if (filters.status) {
        conditions.push(eq(driftReports.status, filters.status));
      }
      if (!filters.includeDeleted) {
        conditions.push(isNull(driftReports.deletedAt));
      }

      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(driftReports)
          .where(and(...conditions))
          .orderBy(desc(driftReports.checkedAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: drizzleCount() })
          .from(driftReports)
          .where(and(...conditions)),
      ]);

      const total = Number(totalResult[0]?.count ?? 0);

      // Fetch items for each report
      const reports: DriftReport[] = [];
      for (const row of data) {
        const items = await db
          .select()
          .from(driftItems)
          .where(eq(driftItems.reportId, row.id));
        reports.push(toReportDto(row, items));
      }

      return { data: reports, total };
    },

    /**
     * Count reports matching filters.
     */
    async countReports(filters: DriftReportFilters): Promise<number> {
      const conditions = [eq(driftReports.companyId, filters.companyId)];
      if (filters.projectId) {
        conditions.push(eq(driftReports.projectId, filters.projectId));
      }
      if (filters.status) {
        conditions.push(eq(driftReports.status, filters.status));
      }
      if (!filters.includeDeleted) {
        conditions.push(isNull(driftReports.deletedAt));
      }

      const result = await db
        .select({ count: drizzleCount() })
        .from(driftReports)
        .where(and(...conditions));

      return Number(result[0]?.count ?? 0);
    },

    /**
     * Get a single drift item by ID, scoped by companyId.
     */
    async getItemById(companyId: string, itemId: string): Promise<DriftItem | null> {
      const rows = await db
        .select()
        .from(driftItems)
        .where(and(eq(driftItems.companyId, companyId), eq(driftItems.id, itemId)));

      const row = rows[0];
      return row ? toItemDto(row) : null;
    },

    /**
     * Resolve a drift item: update decision, decidedAt, decidedBy, and optional note.
     */
    async resolveItem(
      companyId: string,
      itemId: string,
      decision: DriftDecision,
      decidedBy: string,
      note?: string,
    ): Promise<DriftItem | null> {
      const now = new Date();
      const rows = await db
        .update(driftItems)
        .set({
          decision,
          decidedAt: now,
          decidedBy,
          remediationNote: note ?? null,
          updatedAt: now,
        })
        .where(and(eq(driftItems.companyId, companyId), eq(driftItems.id, itemId)))
        .returning();

      const row = rows[0];
      return row ? toItemDto(row) : null;
    },

    /**
     * List drift items with filters and pagination.
     */
    async listItems(filters: DriftItemFilters): Promise<{ data: DriftItem[]; total: number }> {
      const conditions = [eq(driftItems.companyId, filters.companyId)];
      if (filters.reportId) {
        conditions.push(eq(driftItems.reportId, filters.reportId));
      }
      if (filters.severity) {
        conditions.push(eq(driftItems.severity, filters.severity));
      }
      if (filters.decision) {
        conditions.push(eq(driftItems.decision, filters.decision));
      }
      if (filters.driftType) {
        conditions.push(eq(driftItems.driftType, filters.driftType));
      }

      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(driftItems)
          .where(and(...conditions))
          .orderBy(desc(driftItems.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: drizzleCount() })
          .from(driftItems)
          .where(and(...conditions)),
      ]);

      return {
        data: data.map(toItemDto),
        total: Number(totalResult[0]?.count ?? 0),
      };
    },

    /**
     * Derive scan status from persisted reports for a project.
     * Returns a DriftScanStatus compatible with the existing API.
     */
    async getScanStatus(companyId: string, projectId: string): Promise<DriftScanStatus> {
      // Get the last completed report for this project
      const lastReport = await db
        .select()
        .from(driftReports)
        .where(
          and(
            eq(driftReports.companyId, companyId),
            eq(driftReports.projectId, projectId),
            eq(driftReports.status, "completed"),
            isNull(driftReports.deletedAt),
          ),
        )
        .orderBy(desc(driftReports.checkedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      // Check if there's an in-progress report
      const inProgressReport = await db
        .select()
        .from(driftReports)
        .where(
          and(
            eq(driftReports.companyId, companyId),
            eq(driftReports.projectId, projectId),
            eq(driftReports.status, "in_progress"),
            isNull(driftReports.deletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      // Count total drift items from the last completed report
      let lastScanIssueCount: number | null = null;
      if (lastReport) {
        const countResult = await db
          .select({ count: drizzleCount() })
          .from(driftItems)
          .where(eq(driftItems.reportId, lastReport.id));
        lastScanIssueCount = Number(countResult[0]?.count ?? 0);
      }

      return {
        scanning: !!inProgressReport,
        progress: inProgressReport ? "Scan in progress" : null,
        completed: lastReport ? 1 : 0,
        total: inProgressReport ? 1 : (lastReport ? 1 : 0),
        lastScanAt: lastReport?.checkedAt.toISOString() ?? null,
        lastScanIssueCount,
      };
    },

    /**
     * Soft-delete all reports for a project (sets deletedAt).
     */
    async deleteReportsForProject(companyId: string, projectId: string): Promise<number> {
      const now = new Date();
      const rows = await db
        .update(driftReports)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(driftReports.companyId, companyId),
            eq(driftReports.projectId, projectId),
            isNull(driftReports.deletedAt),
          ),
        )
        .returning();

      return rows.length;
    },
  };
}
