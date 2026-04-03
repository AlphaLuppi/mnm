import { Router } from "express";
import type { Db } from "@mnm/db";
import { and, eq, sql } from "drizzle-orm";
import { tagAssignments, tags } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { folderService } from "../services/folder.js";
import {
  createFolderSchema,
  updateFolderSchema,
  addFolderItemSchema,
} from "@mnm/shared";
import { badRequest, forbidden, notFound } from "../errors.js";

export function folderRoutes(db: Db): Router {
  const router = Router();
  const svc = folderService(db);

  // POST /api/companies/:companyId/folders — create folder
  router.post(
    "/companies/:companyId/folders",
    requirePermission(db, "folders:create"),
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
    requirePermission(db, "folders:read"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;
      const visibility = (req.query.visibility as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await svc.list(companyId, actor.actorId, {
        visibility,
        limit,
        offset,
        isAdmin,
      });

      res.json(result);
    },
  );

  // GET /api/companies/:companyId/folders/:id — get folder + items
  router.get(
    "/companies/:companyId/folders/:id",
    requirePermission(db, "folders:read"),
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

      // Fetch items and folder tags in parallel
      const [items, folderTags] = await Promise.all([
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
      });
    },
  );

  // PATCH /api/companies/:companyId/folders/:id — update folder
  router.patch(
    "/companies/:companyId/folders/:id",
    requirePermission(db, "folders:edit"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = updateFolderSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const result = await svc.update(
        companyId,
        req.params.id as string,
        body.data,
        actor.actorId,
      );

      if (result === null) {
        throw notFound("Folder not found");
      }

      if ("error" in result && result.error === "forbidden") {
        throw forbidden("Only the folder owner can update this folder");
      }

      res.json(result);
    },
  );

  // DELETE /api/companies/:companyId/folders/:id — delete folder
  router.delete(
    "/companies/:companyId/folders/:id",
    requirePermission(db, "folders:delete"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const result = await svc.delete(
        companyId,
        req.params.id as string,
        actor.actorId,
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

  // POST /api/companies/:companyId/folders/:id/items — add item to folder
  router.post(
    "/companies/:companyId/folders/:id/items",
    requirePermission(db, "folders:edit"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = addFolderItemSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;

      // Check folder exists and user has access
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
    requirePermission(db, "folders:edit"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const isAdmin = req.tagScope?.bypassTagFilter ?? false;

      // Check folder exists and user has access
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

  // POST /api/companies/:companyId/folders/:id/tags — assign a tag to a folder
  router.post(
    "/companies/:companyId/folders/:id/tags",
    requirePermission(db, "folders:edit"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const { tagId } = req.body;
      if (!tagId || typeof tagId !== "string") {
        throw badRequest("tagId is required");
      }

      const folderId = req.params.id as string;
      const actor = getActorInfo(req);

      // Verify folder exists
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

      // Insert (ignore conflict on unique index)
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
    requirePermission(db, "folders:edit"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const folderId = req.params.id as string;
      const tagId = req.params.tagId as string;
      const actor = getActorInfo(req);

      // Verify folder exists
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
