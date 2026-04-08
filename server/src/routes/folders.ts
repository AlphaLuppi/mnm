import { Router, type Request } from "express";
import multer from "multer";
import type { Db } from "@mnm/db";
import { and, eq, sql } from "drizzle-orm";
import { tagAssignments, tags } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { folderService } from "../services/folder.js";
import { folderShareService } from "../services/folder-share.js";
import { documentService } from "../services/document.js";
import { assetService } from "../services/assets.js";
import { PERMISSIONS,
  createFolderSchema,
  updateFolderSchema,
  addFolderItemSchema,
  createFolderShareSchema,
  updateFolderShareSchema,
} from "@mnm/shared";
import { badRequest, forbidden, notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";
import type { StorageService } from "../storage/types.js";

const MAX_DOCUMENT_BYTES = Number(process.env.MNM_DOCUMENT_MAX_BYTES) || 50 * 1024 * 1024;

export function folderRoutes(db: Db, storage: StorageService): Router {
  const router = Router();
  const svc = folderService(db);
  const shareSvc = folderShareService(db);
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

  // POST /api/companies/:companyId/folders — create folder
  router.post(
    "/companies/:companyId/folders",
    requirePermission(db, PERMISSIONS.FOLDERS_CREATE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = createFolderSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const folder = await svc.create(companyId, body.data, actor.actorId);

      res.status(201).json(folder);
    },
  );

  // GET /api/companies/:companyId/folders — list folders
  router.get(
    "/companies/:companyId/folders",
    requirePermission(db, PERMISSIONS.FOLDERS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await svc.list(companyId, actor.actorId, {
        limit,
        offset,
        isAdmin,
      });

      res.json(result);
    },
  );

  // GET /api/companies/:companyId/folders/:id — get folder + items + tags + shares
  router.get(
    "/companies/:companyId/folders/:id",
    requirePermission(db, PERMISSIONS.FOLDERS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );

      if (!folder) {
        throw notFound("Folder not found");
      }

      // Fetch items, tags, and shares in parallel
      const [items, folderTags, shares] = await Promise.all([
        svc.getItems(companyId, folder.id),
        db
          .select({
            tagId: tagAssignments.tagId,
            tagName: tags.name,
            tagSlug: tags.slug,
            tagColor: tags.color,
          })
          .from(tagAssignments)
          .innerJoin(tags, eq(tags.id, tagAssignments.tagId))
          .where(
            and(
              eq(tagAssignments.companyId, companyId),
              eq(tagAssignments.targetType, "folder"),
              sql`${tagAssignments.targetId} = ${folder.id}`,
            ),
          ),
        shareSvc.list(companyId, folder.id),
      ]);

      res.json({
        ...folder,
        items,
        tags: folderTags.map((t) => ({
          id: t.tagId,
          name: t.tagName,
          slug: t.tagSlug,
          color: t.tagColor,
        })),
        shares,
      });
    },
  );

  // PATCH /api/companies/:companyId/folders/:id — update folder
  router.patch(
    "/companies/:companyId/folders/:id",
    requirePermission(db, PERMISSIONS.FOLDERS_EDIT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = updateFolderSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const result = await svc.update(
        companyId,
        req.params.id as string,
        body.data,
        actor.actorId,
        { isAdmin },
      );

      if (result === null) {
        throw notFound("Folder not found");
      }

      if ("error" in result && result.error === "forbidden") {
        throw forbidden("Only the folder owner or editors can update this folder");
      }

      res.json(result);
    },
  );

  // DELETE /api/companies/:companyId/folders/:id — delete folder (with smart document handling)
  router.delete(
    "/companies/:companyId/folders/:id",
    requirePermission(db, PERMISSIONS.FOLDERS_DELETE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const preserveDocumentIds = (req.body?.preserveDocumentIds as string[]) ?? [];
      const result = await svc.delete(
        companyId,
        req.params.id as string,
        actor.actorId,
        preserveDocumentIds,
      );

      if (result.error === "not_found") {
        throw notFound("Folder not found");
      }

      if (result.error === "forbidden") {
        throw forbidden("Only the folder owner can delete this folder");
      }

      res.status(204).end();
    },
  );

  // GET /api/companies/:companyId/folders/:id/deletion-preview
  router.get(
    "/companies/:companyId/folders/:id/deletion-preview",
    requirePermission(db, PERMISSIONS.FOLDERS_DELETE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );

      if (!folder) {
        throw notFound("Folder not found");
      }

      if (folder.ownerUserId !== actor.actorId && !isAdmin) {
        throw forbidden("Only the owner can view deletion preview");
      }

      const preview = await svc.getDeletionPreview(companyId, folder.id);
      res.json(preview);
    },
  );

  // POST /api/companies/:companyId/folders/:id/items — add item to folder
  router.post(
    "/companies/:companyId/folders/:id/items",
    requirePermission(db, PERMISSIONS.FOLDERS_EDIT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = addFolderItemSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;

      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );
      if (!folder) {
        throw notFound("Folder not found");
      }

      const result = await svc.addItem(
        companyId,
        folder.id,
        body.data,
        actor.actorId,
      );

      if ("error" in result) {
        throw badRequest(result.error);
      }

      res.status(201).json(result);
    },
  );

  // DELETE /api/companies/:companyId/folders/:id/items/:itemId — remove item from folder
  router.delete(
    "/companies/:companyId/folders/:id/items/:itemId",
    requirePermission(db, PERMISSIONS.FOLDERS_EDIT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;

      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );
      if (!folder) {
        throw notFound("Folder not found");
      }

      const deleted = await svc.removeItem(
        companyId,
        folder.id,
        req.params.itemId as string,
      );

      if (!deleted) {
        throw notFound("Folder item not found");
      }

      res.status(204).end();
    },
  );

  // POST /api/companies/:companyId/folders/:id/upload — upload document to folder
  router.post(
    "/companies/:companyId/folders/:id/upload",
    requirePermission(db, PERMISSIONS.FOLDERS_EDIT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );
      if (!folder) {
        throw notFound("Folder not found");
      }

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

      // Create document WITH ownedByFolderId
      const doc = await docSvc.create(companyId, asset!.id, {
        title,
        mimeType,
        byteSize: file.buffer.length,
        createdByUserId: actor.actorType === "user" ? actor.actorId : undefined,
        ownedByFolderId: folder.id,
      });

      // Also create a folderItem for unified display
      await svc.addItem(companyId, folder.id, {
        itemType: "document",
        documentId: doc.id,
        displayName: title,
      }, actor.actorId);

      // Enqueue ingestion
      try {
        const { createIngestionQueue } = await import("../services/document-ingestion.js");
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          const queue = createIngestionQueue({ host: new URL(redisUrl).hostname, port: Number(new URL(redisUrl).port) || 6379 });
          await queue.add("ingest", { documentId: doc.id, companyId });
          logger.info({ documentId: doc.id }, "Document ingestion job enqueued");
        } else {
          await docSvc.updateIngestionStatus(doc.id, "ready");
        }
      } catch (err) {
        logger.warn({ err, documentId: doc.id }, "Failed to enqueue ingestion; marking as ready");
        await docSvc.updateIngestionStatus(doc.id, "ready");
      }

      res.status(201).json(doc);
    },
  );

  // POST /api/companies/:companyId/folders/:id/shares — share folder with user
  router.post(
    "/companies/:companyId/folders/:id/shares",
    requirePermission(db, PERMISSIONS.FOLDERS_SHARE_USERS),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = createFolderShareSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );
      if (!folder) {
        throw notFound("Folder not found");
      }

      const share = await shareSvc.create(companyId, folder.id, body.data, actor.actorId);
      res.status(201).json(share);
    },
  );

  // GET /api/companies/:companyId/folders/:id/shares — list shares
  router.get(
    "/companies/:companyId/folders/:id/shares",
    requirePermission(db, PERMISSIONS.FOLDERS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(
        companyId,
        req.params.id as string,
        actor.actorId,
        { isAdmin },
      );
      if (!folder) {
        throw notFound("Folder not found");
      }

      const shares = await shareSvc.list(companyId, folder.id);
      res.json(shares);
    },
  );

  // PATCH /api/companies/:companyId/folders/:id/shares/:shareId — update share permission
  router.patch(
    "/companies/:companyId/folders/:id/shares/:shareId",
    requirePermission(db, PERMISSIONS.FOLDERS_SHARE_USERS),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = updateFolderShareSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const updated = await shareSvc.update(
        companyId,
        req.params.shareId as string,
        body.data.permission,
      );

      if (!updated) {
        throw notFound("Share not found");
      }

      res.json(updated);
    },
  );

  // DELETE /api/companies/:companyId/folders/:id/shares/:shareId — revoke share
  router.delete(
    "/companies/:companyId/folders/:id/shares/:shareId",
    requirePermission(db, PERMISSIONS.FOLDERS_SHARE_USERS),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const deleted = await shareSvc.remove(
        companyId,
        req.params.shareId as string,
      );

      if (!deleted) {
        throw notFound("Share not found");
      }

      res.status(204).end();
    },
  );

  // POST /api/companies/:companyId/folders/:id/tags — assign a tag to a folder
  router.post(
    "/companies/:companyId/folders/:id/tags",
    requirePermission(db, PERMISSIONS.FOLDERS_SHARE_TAGS),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { tagId } = req.body;
      if (!tagId || typeof tagId !== "string") {
        throw badRequest("tagId is required");
      }

      const folderId = req.params.id as string;
      const actor = getActorInfo(req);

      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(companyId, folderId, actor.actorId, { isAdmin });
      if (!folder) {
        throw notFound("Folder not found");
      }

      // Verify tag exists in company
      const [tag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)));
      if (!tag) {
        throw notFound("Tag not found");
      }

      await db
        .insert(tagAssignments)
        .values({
          companyId,
          targetType: "folder",
          targetId: folderId,
          tagId,
          assignedBy: actor.actorId,
        })
        .onConflictDoNothing();

      res.status(201).json({ tagId, folderId });
    },
  );

  // DELETE /api/companies/:companyId/folders/:id/tags/:tagId — remove a tag from a folder
  router.delete(
    "/companies/:companyId/folders/:id/tags/:tagId",
    requirePermission(db, PERMISSIONS.FOLDERS_SHARE_TAGS),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const folderId = req.params.id as string;
      const tagId = req.params.tagId as string;
      const actor = getActorInfo(req);

      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const folder = await svc.getById(companyId, folderId, actor.actorId, { isAdmin });
      if (!folder) {
        throw notFound("Folder not found");
      }

      await db
        .delete(tagAssignments)
        .where(
          and(
            eq(tagAssignments.companyId, companyId),
            eq(tagAssignments.targetType, "folder"),
            sql`${tagAssignments.targetId} = ${folderId}`,
            eq(tagAssignments.tagId, tagId),
          ),
        );

      res.status(204).end();
    },
  );

  return router;
}
