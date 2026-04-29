import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { roles, rolePermissions, permissions } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { accessService } from "../services/access.js";
import { auditService } from "../services/audit.js";
import { badRequest, notFound, forbidden } from "../errors.js";
import { PERMISSIONS } from "@mnm/shared";

export function rolesRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const audit = auditService(db);

  // ── GET /api/roles ── List all roles for the company
  router.get(
    "/companies/:companyId/roles",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;

      const allRoles = await db
        .select()
        .from(roles)
        .where(eq(roles.companyId, companyId))
        .orderBy(roles.hierarchyLevel);

      // Load all permissions for all roles in one query, then group in-memory
      const roleIds = allRoles.map((r) => r.id);
      const allPerms = roleIds.length > 0
        ? await db
            .select({
              roleId: rolePermissions.roleId,
              slug: permissions.slug,
              id: permissions.id,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(inArray(rolePermissions.roleId, roleIds))
        : [];

      const permsByRole = new Map<string, { slug: string; id: string }[]>();
      for (const p of allPerms) {
        const arr = permsByRole.get(p.roleId) ?? [];
        arr.push({ slug: p.slug, id: p.id });
        permsByRole.set(p.roleId, arr);
      }

      const result = allRoles.map((role) => ({
        ...role,
        permissions: permsByRole.get(role.id) ?? [],
      }));

      res.json(result);
    },
  );

  // ── GET /api/roles/:roleId ── Get role detail + permissions
  router.get(
    "/companies/:companyId/roles/:roleId",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const roleId = req.params.roleId as string;

      const [role] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)));

      if (!role) throw notFound("Role not found");

      const perms = await db
        .select({ slug: permissions.slug, id: permissions.id, description: permissions.description })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(rolePermissions.roleId, role.id));

      res.json({ ...role, permissions: perms });
    },
  );

  // ── POST /api/roles ── Create a new role
  router.post(
    "/companies/:companyId/roles",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const { name, slug, description, hierarchyLevel, inheritsFromId, bypassTagFilter, color, icon, permissionSlugs } = req.body;

      if (!name || !slug) throw badRequest("name and slug are required");

      // Validate inheritsFromId doesn't create a chain
      if (inheritsFromId) {
        const [parent] = await db.select().from(roles).where(eq(roles.id, inheritsFromId));
        if (!parent) throw badRequest("Parent role not found");
        if (parent.inheritsFromId) throw badRequest("Cannot inherit from a role that already inherits (max 1 level)");
      }

      // Hierarchy check: actor can only create roles at their level or below.
      // SEC-T11-03: Also guard bypassTagFilter — only an actor that already
      // holds bypassTagFilter (or is an instance_admin) may create a role
      // that grants the flag to others.
      if (req.actor.type === "board" && req.actor.userId) {
        const actorRole = await access.resolveRole(companyId, "user", req.actor.userId);
        const actorHasBypass = req.actor.isInstanceAdmin || Boolean(actorRole?.bypassTagFilter);

        if (!actorHasBypass) {
          const targetLevel = hierarchyLevel ?? 100;
          if (actorRole && targetLevel < actorRole.hierarchyLevel) {
            throw forbidden("Cannot create a role above your own hierarchy level");
          }
          if (bypassTagFilter) {
            throw forbidden("Cannot grant bypassTagFilter to a role without holding it yourself");
          }
        }
      } else if (req.actor.type !== "board") {
        // Non-board actors (agents) cannot set bypassTagFilter
        if (bypassTagFilter) {
          throw forbidden("Cannot grant bypassTagFilter to a role without holding it yourself");
        }
      }

      const [created] = await db
        .insert(roles)
        .values({
          companyId,
          name,
          slug,
          description: description ?? null,
          hierarchyLevel: hierarchyLevel ?? 100,
          inheritsFromId: inheritsFromId ?? null,
          bypassTagFilter: bypassTagFilter ?? false,
          isSystem: false,
          color: color ?? null,
          icon: icon ?? null,
        })
        .returning();

      // Assign permissions if provided
      if (Array.isArray(permissionSlugs) && permissionSlugs.length > 0) {
        const permRows = await db
          .select({ id: permissions.id })
          .from(permissions)
          .where(and(
            eq(permissions.companyId, companyId),
            inArray(permissions.slug, permissionSlugs),
          ));

        if (permRows.length > 0) {
          await db.insert(rolePermissions).values(
            permRows.map((p) => ({ roleId: created.id, permissionId: p.id })),
          );
        }
      }

      // Audit
      await audit.emit({
        companyId,
        actorId: req.actor.type === "board" ? (req.actor.userId ?? "system") : "system",
        actorType: "user",
        action: "role.created",
        targetType: "role",
        targetId: created.id,
        metadata: { name, slug, permissionSlugs },
      }).catch(() => {});

      // Invalidate cache
      access.invalidateRoleCache();

      res.status(201).json(created);
    },
  );

  // ── PATCH /api/roles/:roleId ── Update a role
  router.patch(
    "/companies/:companyId/roles/:roleId",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const roleId = req.params.roleId as string;
      const { name, description, hierarchyLevel, inheritsFromId, bypassTagFilter, color, icon, permissionSlugs, viewPresetId } = req.body;

      const [existing] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)));

      if (!existing) throw notFound("Role not found");

      // SEC-T11-03: Guard bypassTagFilter escalation on PATCH as well.
      // An actor without bypassTagFilter cannot enable the flag on an
      // existing role (turning false → true) or keep it if it was already
      // true (no-op is fine; explicit true from an unprivileged actor is not).
      if (bypassTagFilter === true) {
        let actorHasBypass = req.actor.isInstanceAdmin ?? false;
        if (!actorHasBypass && req.actor.type === "board" && req.actor.userId) {
          const actorRole = await access.resolveRole(companyId, "user", req.actor.userId);
          actorHasBypass = Boolean(actorRole?.bypassTagFilter);
        }
        if (!actorHasBypass) {
          throw forbidden("Cannot grant bypassTagFilter to a role without holding it yourself");
        }
      }

      // Build update set
      const updates: Partial<typeof roles.$inferInsert> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (hierarchyLevel !== undefined) updates.hierarchyLevel = hierarchyLevel;
      if (inheritsFromId !== undefined) {
        if (inheritsFromId === roleId) throw badRequest("A role cannot inherit from itself");
        if (inheritsFromId) {
          const [parent] = await db.select().from(roles).where(eq(roles.id, inheritsFromId));
          if (parent?.inheritsFromId) throw badRequest("Cannot inherit from a role that already inherits");
        }
        updates.inheritsFromId = inheritsFromId;
      }
      if (bypassTagFilter !== undefined) updates.bypassTagFilter = bypassTagFilter;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;
      if (viewPresetId !== undefined) updates.viewPresetId = viewPresetId;
      updates.updatedAt = new Date();

      const [updated] = await db
        .update(roles)
        .set(updates)
        .where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)))
        .returning();

      // Update permissions if provided
      if (Array.isArray(permissionSlugs)) {
        // Delete existing
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

        // Insert new
        if (permissionSlugs.length > 0) {
          const permRows = await db
            .select({ id: permissions.id })
            .from(permissions)
            .where(and(
              eq(permissions.companyId, companyId),
              inArray(permissions.slug, permissionSlugs),
            ));

          if (permRows.length > 0) {
            await db.insert(rolePermissions).values(
              permRows.map((p) => ({ roleId, permissionId: p.id })),
            );
          }
        }
      }

      // Audit
      await audit.emit({
        companyId,
        actorId: req.actor.type === "board" ? (req.actor.userId ?? "system") : "system",
        actorType: "user",
        action: "role.updated",
        targetType: "role",
        targetId: roleId,
        metadata: { changes: req.body },
      }).catch(() => {});

      // Invalidate cache for all users (role permissions changed)
      access.invalidateRoleCache();

      res.json(updated);
    },
  );

  // ── DELETE /api/roles/:roleId ── Delete a role
  router.delete(
    "/companies/:companyId/roles/:roleId",
    requirePermission(db, PERMISSIONS.ROLES_MANAGE),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const roleId = req.params.roleId as string;

      const [existing] = await db
        .select()
        .from(roles)
        .where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)));

      if (!existing) throw notFound("Role not found");

      // Delete role (role_permissions cascade automatically)
      await db.delete(roles).where(and(eq(roles.id, roleId), eq(roles.companyId, companyId)));

      // Audit
      await audit.emit({
        companyId,
        actorId: req.actor.type === "board" ? (req.actor.userId ?? "system") : "system",
        actorType: "user",
        action: "role.deleted",
        targetType: "role",
        targetId: roleId,
        metadata: { name: existing.name, slug: existing.slug },
      }).catch(() => {});

      access.invalidateRoleCache();

      res.status(204).end();
    },
  );

  return router;
}
