import {
  and,
  eq,
  desc,
  isNull,
  count as drizzleCount,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@mnm/db";
import { documents } from "@mnm/db";
import { publishLiveEvent } from "./live-events.js";

export function documentService(db: Db) {
  return {
    async create(
      companyId: string,
      assetId: string,
      opts: {
        title: string;
        mimeType: string;
        byteSize?: number;
        createdByUserId?: string;
      },
    ) {
      const [doc] = await db
        .insert(documents)
        .values({
          companyId,
          assetId,
          title: opts.title,
          mimeType: opts.mimeType,
          byteSize: opts.byteSize ?? null,
          createdByUserId: opts.createdByUserId ?? null,
          ingestionStatus: "pending",
        })
        .returning();

      publishLiveEvent({
        companyId,
        type: "document.uploaded",
        payload: {
          documentId: doc!.id,
          title: opts.title,
          mimeType: opts.mimeType,
        },
      });

      return doc!;
    },

    async getById(companyId: string, documentId: string) {
      const row = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.companyId, companyId),
            isNull(documents.deletedAt),
          ),
        )
        .then((rows) => rows[0] ?? null);
      return row;
    },

    async list(
      companyId: string,
      opts?: {
        createdByUserId?: string;
        status?: string;
        limit?: number;
        offset?: number;
      },
    ) {
      const conditions: SQL[] = [
        eq(documents.companyId, companyId),
        isNull(documents.deletedAt),
      ];

      if (opts?.createdByUserId) {
        conditions.push(eq(documents.createdByUserId, opts.createdByUserId));
      }
      if (opts?.status) {
        conditions.push(eq(documents.ingestionStatus, opts.status));
      }

      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(documents)
          .where(and(...conditions))
          .orderBy(desc(documents.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: drizzleCount() })
          .from(documents)
          .where(and(...conditions)),
      ]);

      return {
        documents: rows,
        total: Number(totalResult[0]?.count ?? 0),
      };
    },

    async softDelete(companyId: string, documentId: string) {
      const now = new Date();
      const [updated] = await db
        .update(documents)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.companyId, companyId),
            isNull(documents.deletedAt),
          ),
        )
        .returning();

      if (updated) {
        publishLiveEvent({
          companyId,
          type: "document.ingestion_error",
          payload: {
            documentId,
            action: "deleted",
          },
        });
      }

      return updated ?? null;
    },

    async updateIngestionStatus(
      documentId: string,
      status: string,
      opts?: {
        error?: string;
        tokenCount?: number;
        pageCount?: number;
        summary?: string;
        extractedText?: string;
      },
    ) {
      const now = new Date();
      const updates: Record<string, unknown> = {
        ingestionStatus: status,
        updatedAt: now,
      };

      if (opts?.error !== undefined) updates.ingestionError = opts.error;
      if (opts?.tokenCount !== undefined) updates.tokenCount = opts.tokenCount;
      if (opts?.pageCount !== undefined) updates.pageCount = opts.pageCount;
      if (opts?.summary !== undefined) updates.summary = opts.summary;
      if (opts?.extractedText !== undefined) updates.extractedText = opts.extractedText;

      const [updated] = await db
        .update(documents)
        .set(updates)
        .where(eq(documents.id, documentId))
        .returning();

      return updated ?? null;
    },
  };
}
