import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { validate } from "../middleware/validate.js";
import { emitAudit, projectMembershipService, logActivity } from "../services/index.js";
import { assertCompanyAccess, assertProjectAccess, getActorInfo } from "./authz.js";
import { PERMISSIONS,
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
  bulkAddProjectMembersSchema,
  bulkRemoveProjectMembersSchema,
  memberCountsSchema,
} from "@mnm/shared";

export function projectMembershipRoutes(db: Db) {
  const router = Router();
  const svc = projectMembershipService(db);

  // GET /api/companies/:companyId/projects/:projectId/members
  // PROJ-S02: supports optional pagination via ?limit=&cursor=
  router.get("/companies/:companyId/projects/:projectId/members", async (req, res) => {
    const companyId = req.params.companyId as string;
    const projectId = req.params.projectId as string;
    assertCompanyAccess(req, companyId);
    await assertProjectAccess(db, req, companyId, projectId);

    const limitParam = req.query.limit as string | undefined;
    if (limitParam) {
      const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 20));
      const cursor = (req.query.cursor as string) || null;
      const result = await svc.listMembersPaginated(companyId, projectId, { limit, cursor });
      return res.json(result);
    }

    const members = await svc.listMembers(companyId, projectId);
    res.json(members);
  });

  // --- PROJ-S02: Bulk routes MUST be registered BEFORE :userId param routes ---

  // POST /api/companies/:companyId/projects/:projectId/members/bulk
  router.post(
    "/companies/:companyId/projects/:projectId/members/bulk",
    requirePermission(db, PERMISSIONS.PROJECTS_MANAGE_MEMBERS),
    validate(bulkAddProjectMembersSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      assertCompanyAccess(req, companyId);
      await assertProjectAccess(db, req, companyId, projectId);
      const { userIds, role } = req.body;
      const actor = getActorInfo(req);
      const result = await svc.bulkAddMembers(companyId, projectId, userIds, role, actor.actorId);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.members_bulk_added",
        entityType: "project",
        entityId: projectId,
        details: { added: result.added, skipped: result.skipped, userIds },
      });

      await emitAudit({
        req, db, companyId,
        action: "project_membership.bulk_added",
        targetType: "project",
        targetId: projectId,
        metadata: { added: result.added, skipped: result.skipped, userCount: userIds.length },
      });

      res.status(200).json(result);
    },
  );

  // DELETE /api/companies/:companyId/projects/:projectId/members/bulk
  router.delete(
    "/companies/:companyId/projects/:projectId/members/bulk",
    requirePermission(db, PERMISSIONS.PROJECTS_MANAGE_MEMBERS),
    validate(bulkRemoveProjectMembersSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      assertCompanyAccess(req, companyId);
      await assertProjectAccess(db, req, companyId, projectId);
      const { userIds } = req.body;
      const actor = getActorInfo(req);
      const result = await svc.bulkRemoveMembers(companyId, projectId, userIds);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.members_bulk_removed",
        entityType: "project",
        entityId: projectId,
        details: { removed: result.removed, skipped: result.skipped, userIds },
      });

      await emitAudit({
        req, db, companyId,
        action: "project_membership.bulk_removed",
        targetType: "project",
        targetId: projectId,
        metadata: { removed: result.removed, skipped: result.skipped, userCount: userIds.length },
      });

      res.json(result);
    },
  );

  // POST /api/companies/:companyId/projects/:projectId/members (single add)
  router.post(
    "/companies/:companyId/projects/:projectId/members",
    requirePermission(db, PERMISSIONS.PROJECTS_MANAGE_MEMBERS),
    validate(addProjectMemberSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      assertCompanyAccess(req, companyId);
      await assertProjectAccess(db, req, companyId, projectId);
      const { userId, role } = req.body;
      const actor = getActorInfo(req);
      const member = await svc.addMember(
        companyId,
        projectId,
        userId,
        role,
        actor.actorId,
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.member_added",
        entityType: "project",
        entityId: projectId,
        details: { userId, role, grantedBy: actor.actorId },
      });

      await emitAudit({
        req, db, companyId,
        action: "project_membership.added",
        targetType: "project",
        targetId: projectId,
        metadata: { userId, role },
      });

      res.status(201).json(member);
    },
  );

  // DELETE /api/companies/:companyId/projects/:projectId/members/:userId
  router.delete(
    "/companies/:companyId/projects/:projectId/members/:userId",
    requirePermission(db, PERMISSIONS.PROJECTS_MANAGE_MEMBERS),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      const userId = req.params.userId as string;
      assertCompanyAccess(req, companyId);
      await assertProjectAccess(db, req, companyId, projectId);
      const actor = getActorInfo(req);
      const removed = await svc.removeMember(companyId, projectId, userId);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.member_removed",
        entityType: "project",
        entityId: projectId,
        details: { userId },
      });

      await emitAudit({
        req, db, companyId,
        action: "project_membership.removed",
        targetType: "project",
        targetId: projectId,
        metadata: { userId },
      });

      res.json(removed);
    },
  );

  // PATCH /api/companies/:companyId/projects/:projectId/members/:userId
  router.patch(
    "/companies/:companyId/projects/:projectId/members/:userId",
    requirePermission(db, PERMISSIONS.PROJECTS_MANAGE_MEMBERS),
    validate(updateProjectMemberRoleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      const userId = req.params.userId as string;
      assertCompanyAccess(req, companyId);
      await assertProjectAccess(db, req, companyId, projectId);
      const actor = getActorInfo(req);
      const updated = await svc.updateMemberRole(
        companyId,
        projectId,
        userId,
        req.body.role,
      );
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "project.member_role_changed",
        entityType: "project",
        entityId: projectId,
        details: { userId, newRole: req.body.role },
      });

      await emitAudit({
        req, db, companyId,
        action: "project_membership.updated",
        targetType: "project",
        targetId: projectId,
        metadata: { userId, newRole: req.body.role },
      });

      res.json(updated);
    },
  );

  // GET /api/companies/:companyId/users/:userId/projects
  router.get("/companies/:companyId/users/:userId/projects", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;
    assertCompanyAccess(req, companyId);
    const userProjects = await svc.listUserProjects(companyId, userId);
    res.json(userProjects);
  });

  // --- PROJ-S02: Additional new routes ---

  // GET /api/companies/:companyId/users/:userId/project-ids
  router.get("/companies/:companyId/users/:userId/project-ids", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;
    assertCompanyAccess(req, companyId);
    const projectIds = await svc.getUserProjectIds(companyId, userId);
    res.json({ projectIds });
  });

  // POST /api/companies/:companyId/projects/member-counts
  router.post(
    "/companies/:companyId/projects/member-counts",
    validate(memberCountsSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const { projectIds } = req.body;
      const counts = await svc.countMembersByProject(companyId, projectIds);
      res.json({ counts });
    },
  );

  return router;
}
