import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_documents", {
    permissions: [PERMISSIONS.DOCUMENTS_READ],
    description:
      "[Documents] List documents with optional filters.\n" +
      "Returns cursor-paginated documents ordered by most recently created.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      createdByUserId: z.string().uuid().optional().describe("Filter by uploader user ID"),
      status: z.string().optional().describe("Filter by ingestion status: pending, processing, completed, error"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const result = await services.documents.list(actor.companyId, {
        createdByUserId: input.createdByUserId,
        status: input.status,
        limit: limit + 1,
        offset,
      });
      const items = result.documents;
      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((d: any) => ({
              id: d.id,
              title: d.title,
              mimeType: d.mimeType,
              byteSize: d.byteSize,
              ingestionStatus: d.ingestionStatus,
              createdByUserId: d.createdByUserId,
              createdAt: d.createdAt,
            })),
            total: page.length,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + limit) : null,
          }),
        }],
      };
    },
  });

  tool("get_document", {
    permissions: [PERMISSIONS.DOCUMENTS_READ],
    description:
      "[Documents] Get a single document by ID with full metadata.\n" +
      "Includes ingestion status, summary, and token count.",
    input: z.object({
      documentId: z.string().uuid().describe("The document ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const doc = await services.documents.getById(actor.companyId, input.documentId);
      if (!doc) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Document not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(doc),
        }],
      };
    },
  });

  tool("upload_document", {
    permissions: [PERMISSIONS.DOCUMENTS_UPLOAD],
    description:
      "[Documents] Upload a new document.\n" +
      "Requires a pre-uploaded asset ID, title, and MIME type.",
    input: z.object({
      assetId: z.string().uuid().describe("Asset ID from the asset upload endpoint"),
      title: z.string().min(1).describe("Document title"),
      mimeType: z.string().describe("MIME type (e.g. application/pdf, text/plain)"),
      byteSize: z.number().optional().describe("File size in bytes"),
      folderId: z.string().uuid().optional().describe("Folder to place the document in"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const doc = await services.documents.create(actor.companyId, input.assetId, {
        title: input.title,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        createdByUserId: actor.userId,
        ownedByFolderId: input.folderId,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: doc.id,
            title: doc.title,
            mimeType: doc.mimeType,
            ingestionStatus: doc.ingestionStatus,
          }),
        }],
      };
    },
  });

  tool("delete_document", {
    permissions: [PERMISSIONS.DOCUMENTS_DELETE],
    description:
      "[Documents] Soft-delete a document by ID.\n" +
      "The document is marked as deleted but not physically removed.",
    input: z.object({
      documentId: z.string().uuid().describe("The document ID to delete"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const deleted = await services.documents.softDelete(actor.companyId, input.documentId);
      if (!deleted) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Document not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ id: deleted.id, deleted: true }),
        }],
      };
    },
  });
});
