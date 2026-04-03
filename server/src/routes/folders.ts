import { Router } from "express";
import type { Db } from "@mnm/db";
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

      // Also fetch items
      const items = await svc.getItems(companyId, folder.id);

      res.json({ ...folder, items });
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

  return router;
}
