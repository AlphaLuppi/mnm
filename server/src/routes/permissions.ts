import { Router } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { permissions, roles, companyMemberships } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { accessService } from "../services/access.js";
import { auditService } from "../services/audit.js";
import { badRequest, notFound, forbidden } from "../errors.js";
import { PERMISSIONS } from "@mnm/shared";

export function permissionsRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const audit = auditService(db);

  // ── GET /api/permissions ── List all permissions for the company
  router.get(
    "/companies/:companyId/permissions",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const allPerms = await db
        .select()
        .from(permissions)
        .where(eq(permissions.companyId, companyId))
        .orderBy(permissions.category, permissions.slug);
      res.json(allPerms);
    },
  );

  // ── POST /api/permissions ── Create a custom permission
  router.post(
    "/companies/:companyId/permissions",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const { slug, description, category } = req.body;

      if (!slug || !description || !category) {
        throw badRequest("slug, description, and category are required");
      }

      const [created] = await db
        .insert(permissions)
        .values({
          companyId,
          slug,
          description,
          category,
          isCustom: true,
        })
        .returning();

      await audit.emit({
        companyId,
        actorId: req.actor.type === "board" ? (req.actor.userId ?? "system") : "system",
        actorType: "user",
        action: "permission.created",
        targetType: "permission",
        targetId: created.id,
        metadata: { slug, category, isCustom: true },
      }).catch(() => {});

      res.status(201).json(created);
    },
  );

  // ── PATCH /api/members/:memberId/role ── Change a member's role
  router.patch(
    "/companies/:companyId/members/:memberId/role",
    requirePermission(db, PERMISSIONS.USERS_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const memberId = req.params.memberId as string;
      const { roleId } = req.body;

      if (!roleId) throw badRequest("roleId is required");

      // Verify the target role exists and belongs to this company
      const [targetRole] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)));

      if (!targetRole) throw notFound("Target role not found");

      // Hierarchy check: actor can only assign roles at their level or below
      if (req.actor.type === "board" && req.actor.userId) {
        const actorRole = await access.resolveRole(companyId, "user", req.actor.userId);
        if (actorRole && !actorRole.bypassTagFilter) {
          if (targetRole.hierarchyLevel < actorRole.hierarchyLevel) {
            throw forbidden("Cannot assign a role above your own hierarchy level");
          }
        }
      }

      const updated = await access.updateMemberRole(companyId, memberId, roleId);
      if (!updated) throw notFound("Member not found");

      await audit.emit({
        companyId,
        actorId: req.actor.type === "board" ? (req.actor.userId ?? "system") : "system",
        actorType: "user",
        action: "member.role_changed",
        targetType: "membership",
        targetId: memberId,
        metadata: { newRoleId: roleId, newRoleName: targetRole.name },
      }).catch(() => {});

      res.json(updated);
    },
  );

  return router;
}
