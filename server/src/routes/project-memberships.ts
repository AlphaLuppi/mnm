import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { validate } from "../middleware/validate.js";
import { projectMembershipService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { addProjectMemberSchema, updateProjectMemberRoleSchema } from "@mnm/shared";

export function projectMembershipRoutes(db: Db) {
  const router = Router();
  const svc = projectMembershipService(db);

  // GET /api/companies/:companyId/projects/:projectId/members
  router.get("/companies/:companyId/projects/:projectId/members", async (req, res) => {
    const companyId = req.params.companyId as string;
    const projectId = req.params.projectId as string;
    assertCompanyAccess(req, companyId);
    const members = await svc.listMembers(companyId, projectId);
    res.json(members);
  });

  // POST /api/companies/:companyId/projects/:projectId/members
  router.post(
    "/companies/:companyId/projects/:projectId/members",
    requirePermission(db, "projects:manage_members"),
    validate(addProjectMemberSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      assertCompanyAccess(req, companyId);
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
      res.status(201).json(member);
    },
  );

  // DELETE /api/companies/:companyId/projects/:projectId/members/:userId
  router.delete(
    "/companies/:companyId/projects/:projectId/members/:userId",
    requirePermission(db, "projects:manage_members"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      const userId = req.params.userId as string;
      assertCompanyAccess(req, companyId);
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
      res.json(removed);
    },
  );

  // PATCH /api/companies/:companyId/projects/:projectId/members/:userId
  router.patch(
    "/companies/:companyId/projects/:projectId/members/:userId",
    requirePermission(db, "projects:manage_members"),
    validate(updateProjectMemberRoleSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const projectId = req.params.projectId as string;
      const userId = req.params.userId as string;
      assertCompanyAccess(req, companyId);
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

  return router;
}
