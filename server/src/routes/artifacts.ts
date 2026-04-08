import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { requireTagScope } from "../middleware/tag-scope.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { artifactService } from "../services/artifact.js";
import { chatService } from "../services/chat.js";
import { tagFilterService } from "../services/tag-filter.js";
import { PERMISSIONS, createArtifactSchema, updateArtifactSchema } from "@mnm/shared";
import { badRequest, forbidden, notFound } from "../errors.js";

export function artifactRoutes(db: Db): Router {
  const router = Router();
  const svc = artifactService(db);
  const chat = chatService(db);
  const tagFilter = tagFilterService(db);

  // POST /api/companies/:companyId/artifacts — create artifact
  router.post(
    "/companies/:companyId/artifacts",
    requirePermission(db, PERMISSIONS.ARTIFACTS_CREATE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = createArtifactSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);
      const creatorInfo =
        actor.actorType === "agent"
          ? { agentId: actor.actorId }
          : { userId: actor.actorId };

      const artifact = await svc.create(companyId, body.data, creatorInfo);

      res.status(201).json(artifact);
    },
  );

  // GET /api/companies/:companyId/artifacts — list artifacts
  router.get(
    "/companies/:companyId/artifacts",
    requirePermission(db, PERMISSIONS.ARTIFACTS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const channelId = (req.query.channelId as string) || undefined;
      const artifactType = (req.query.artifactType as string) || undefined;
      const createdByUserId =
        (req.query.createdByUserId as string) || undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await svc.list(companyId, {
        channelId,
        artifactType,
        createdByUserId,
        limit,
        offset,
      });

      // Tag isolation: filter artifacts by channel agent visibility
      const tagScope = requireTagScope(req);
      if (!tagScope.bypassTagFilter && result.artifacts) {
        const visibleAgents = await tagFilter.listAgentsFiltered(companyId, tagScope);
        const visibleIds = new Set(visibleAgents.map((a) => a.id));
        // For each artifact with a sourceChannelId, check if the channel's agent is visible
        const filtered = [];
        for (const artifact of result.artifacts as any[]) {
          if (!artifact.sourceChannelId) {
            filtered.push(artifact);
            continue;
          }
          const ch = await chat.getChannel(artifact.sourceChannelId);
          if (ch && visibleIds.has(ch.agentId)) {
            filtered.push(artifact);
          }
        }
        result.artifacts = filtered;
      }

      res.json(result);
    },
  );

  // GET /api/companies/:companyId/artifacts/:id — get artifact detail
  router.get(
    "/companies/:companyId/artifacts/:id",
    requirePermission(db, PERMISSIONS.ARTIFACTS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const artifact = await svc.getById(companyId, req.params.id as string);
      if (!artifact) {
        throw notFound("Artifact not found");
      }

      // Tag isolation: check if the artifact's channel agent is visible
      const tagScope = requireTagScope(req);
      if (!tagScope.bypassTagFilter && (artifact as any).sourceChannelId) {
        const ch = await chat.getChannel((artifact as any).sourceChannelId);
        if (ch) {
          const visible = await chat.isChannelVisible(ch, tagScope);
          if (!visible) throw notFound("Artifact not found");
        }
      }

      res.json(artifact);
    },
  );

  // PATCH /api/companies/:companyId/artifacts/:id — update artifact
  router.patch(
    "/companies/:companyId/artifacts/:id",
    requirePermission(db, PERMISSIONS.ARTIFACTS_EDIT),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const body = updateArtifactSchema.safeParse(req.body);
      if (!body.success) {
        throw badRequest("Invalid request body", body.error.issues);
      }

      const actor = getActorInfo(req);

      // Ownership check: user-created artifacts can only be modified by their creator (or admin)
      // Agent-created artifacts (no createdByUserId) are modifiable by any user with permission
      const existing = await svc.getById(companyId, req.params.id as string);
      if (!existing) {
        throw notFound("Artifact not found");
      }
      if (existing.createdByUserId && existing.createdByUserId !== actor.actorId) {
        if (!req.tagScope?.bypassTagFilter) {
          throw forbidden("Only the creator can modify this artifact");
        }
      }

      const creatorInfo =
        actor.actorType === "agent"
          ? { agentId: actor.actorId }
          : { userId: actor.actorId };

      const artifact = await svc.update(
        companyId,
        req.params.id as string,
        body.data,
        creatorInfo,
      );
      if (!artifact) {
        throw notFound("Artifact not found");
      }

      res.json(artifact);
    },
  );

  // DELETE /api/companies/:companyId/artifacts/:id — delete artifact
  router.delete(
    "/companies/:companyId/artifacts/:id",
    requirePermission(db, PERMISSIONS.ARTIFACTS_DELETE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      // Verify artifact exists before deleting
      const existing = await svc.getById(companyId, req.params.id as string);
      if (!existing) {
        throw notFound("Artifact not found");
      }

      // Ownership check: user-created artifacts can only be deleted by their creator (or admin)
      // Agent-created artifacts (no createdByUserId) are deletable by any user with permission
      const actor = getActorInfo(req);
      if (existing.createdByUserId && existing.createdByUserId !== actor.actorId) {
        if (!req.tagScope?.bypassTagFilter) {
          throw forbidden("Only the creator can delete this artifact");
        }
      }

      await svc.delete(companyId, req.params.id as string);

      res.status(204).send();
    },
  );

  // GET /api/companies/:companyId/artifacts/:id/versions — list versions
  router.get(
    "/companies/:companyId/artifacts/:id/versions",
    requirePermission(db, PERMISSIONS.ARTIFACTS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const versions = await svc.getVersions(
        companyId,
        req.params.id as string,
        { limit, offset },
      );
      if (versions === null) {
        throw notFound("Artifact not found");
      }

      res.json({ versions });
    },
  );

  // GET /api/companies/:companyId/artifacts/:id/versions/:versionId — get specific version
  router.get(
    "/companies/:companyId/artifacts/:id/versions/:versionId",
    requirePermission(db, PERMISSIONS.ARTIFACTS_READ),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const version = await svc.getVersion(
        companyId,
        req.params.id as string,
        req.params.versionId as string,
      );
      if (!version) {
        throw notFound("Version not found");
      }

      res.json(version);
    },
  );

  return router;
}
