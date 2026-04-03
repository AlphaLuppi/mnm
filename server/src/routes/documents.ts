import { Router, type Request } from "express";
import multer from "multer";
import type { Db } from "@mnm/db";
import { documentChunks } from "@mnm/db";
import { eq, and } from "drizzle-orm";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { documentService } from "../services/document.js";
import { assetService } from "../services/assets.js";
import { badRequest, notFound } from "../errors.js";
import { publishLiveEvent } from "../services/live-events.js";
import { logger } from "../middleware/logger.js";
import type { StorageService } from "../storage/types.js";

const MAX_DOCUMENT_BYTES = Number(process.env.MNM_DOCUMENT_MAX_BYTES) || 50 * 1024 * 1024;

export function documentRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const docSvc = documentService(db);
  const assetSvc = assetService(db);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  });

  async function runSingleFileUpload(req: Request, res: any) {
    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // POST /api/companies/:companyId/documents/upload — multipart file upload
  router.post(
    "/companies/:companyId/documents/upload",
    requirePermission(db, "documents:upload"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      try {
        await runSingleFileUpload(req, res);
      } catch (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(422).json({ error: `File exceeds ${MAX_DOCUMENT_BYTES} bytes` });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }

      const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
      if (!file) {
        throw badRequest("Missing file field 'file'");
      }

      if (file.buffer.length <= 0) {
        res.status(422).json({ error: "File is empty" });
        return;
      }

      const title = (req.body.title as string) || file.originalname || "Untitled";
      const mimeType = file.mimetype || "application/octet-stream";

      const actor = getActorInfo(req);

      // Create asset via storage
      const stored = await storage.putFile({
        companyId,
        namespace: "documents",
        originalFilename: file.originalname || null,
        contentType: mimeType,
        body: file.buffer,
      });

      const asset = await assetSvc.create(companyId, {
        provider: stored.provider,
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        originalFilename: stored.originalFilename,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      });

      // Create document
      const doc = await docSvc.create(companyId, asset!.id, {
        title,
        mimeType,
        byteSize: file.buffer.length,
        createdByUserId: actor.actorType === "user" ? actor.actorId : undefined,
      });

      // Enqueue ingestion job if BullMQ queue is available
      try {
        const { createIngestionQueue } = await import("../services/document-ingestion.js");
        const { Redis } = await import("ioredis");
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          const queue = createIngestionQueue({ host: new URL(redisUrl).hostname, port: Number(new URL(redisUrl).port) || 6379 });
          await queue.add("ingest", { documentId: doc.id, companyId });
          logger.info({ documentId: doc.id }, "Document ingestion job enqueued");
        } else {
          logger.warn({ documentId: doc.id }, "No Redis URL configured; document ingestion skipped");
          // Still mark as ready for basic usage without Redis
          await docSvc.updateIngestionStatus(doc.id, "ready");
        }
      } catch (err) {
        logger.warn({ err, documentId: doc.id }, "Failed to enqueue ingestion job; marking as ready");
        await docSvc.updateIngestionStatus(doc.id, "ready");
      }

      res.status(201).json(doc);
    },
  );

  // GET /api/companies/:companyId/documents — list documents
  router.get(
    "/companies/:companyId/documents",
    requirePermission(db, "documents:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const status = (req.query.status as string) || undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await docSvc.list(companyId, { status, limit, offset });

      res.json(result);
    },
  );

  // GET /api/companies/:companyId/documents/:id — document detail
  router.get(
    "/companies/:companyId/documents/:id",
    requirePermission(db, "documents:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const doc = await docSvc.getById(companyId, req.params.id as string);
      if (!doc) {
        throw notFound("Document not found");
      }

      res.json(doc);
    },
  );

  // GET /api/companies/:companyId/documents/:id/content — download file
  router.get(
    "/companies/:companyId/documents/:id/content",
    requirePermission(db, "documents:read"),
    async (req, res, next) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const doc = await docSvc.getById(companyId, req.params.id as string);
      if (!doc) {
        throw notFound("Document not found");
      }

      if (!doc.assetId) {
        res.status(404).json({ error: "Document has no associated asset" });
        return;
      }

      const asset = await assetSvc.getById(doc.assetId);
      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      const object = await storage.getObject(companyId, asset.objectKey);
      res.setHeader("Content-Type", asset.contentType || object.contentType || "application/octet-stream");
      res.setHeader("Content-Length", String(asset.byteSize || object.contentLength || 0));
      res.setHeader("Cache-Control", "private, max-age=60");
      const filename = doc.title || asset.originalFilename || "document";
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replaceAll('"', '')}"`);

      object.stream.on("error", (err) => {
        next(err);
      });
      object.stream.pipe(res);
    },
  );

  // DELETE /api/companies/:companyId/documents/:id — soft delete
  router.delete(
    "/companies/:companyId/documents/:id",
    requirePermission(db, "documents:delete"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const doc = await docSvc.softDelete(companyId, req.params.id as string);
      if (!doc) {
        throw notFound("Document not found");
      }

      res.json(doc);
    },
  );

  // POST /api/companies/:companyId/documents/:id/summarize — trigger summarization (stub)
  router.post(
    "/companies/:companyId/documents/:id/summarize",
    requirePermission(db, "documents:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const doc = await docSvc.getById(companyId, req.params.id as string);
      if (!doc) {
        throw notFound("Document not found");
      }

      res.status(501).json({ error: "Summarization requires LLM integration (not yet implemented)" });
    },
  );

  // GET /api/companies/:companyId/documents/:id/chunks — debug endpoint, list chunks
  router.get(
    "/companies/:companyId/documents/:id/chunks",
    requirePermission(db, "documents:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const doc = await docSvc.getById(companyId, req.params.id as string);
      if (!doc) {
        throw notFound("Document not found");
      }

      const chunks = await db
        .select({
          id: documentChunks.id,
          chunkIndex: documentChunks.chunkIndex,
          content: documentChunks.content,
          tokenCount: documentChunks.tokenCount,
          metadata: documentChunks.metadata,
          createdAt: documentChunks.createdAt,
        })
        .from(documentChunks)
        .where(
          and(
            eq(documentChunks.documentId, doc.id),
            eq(documentChunks.companyId, companyId),
          ),
        )
        .orderBy(documentChunks.chunkIndex);

      res.json({ chunks, total: chunks.length });
    },
  );

  return router;
}
