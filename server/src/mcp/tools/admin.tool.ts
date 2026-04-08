import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { roles, rolePermissions, permissions, tags } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  // ── Roles ─────────────────────────────────────────────────────────────────

  tool("list_roles", {
    permissions: [PERMISSIONS.ROLES_READ],
    description:
      "[Admin] List all roles defined in the company.\n" +
      "Returns role name, slug, hierarchy level, and permissions.\n" +
      "Roles control what actions users and agents can perform.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      const db = services.db;
      const allRoles = await db
        .select()
        .from(roles)
        .where(eq(roles.companyId, actor.companyId))
        .orderBy(roles.hierarchyLevel);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: allRoles.map((r: any) => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
              hierarchyLevel: r.hierarchyLevel,
              bypassTagFilter: r.bypassTagFilter,
              inheritsFromId: r.inheritsFromId,
            })),
            total: allRoles.length,
          }),
        }],
      };
    },
  });

  tool("manage_role", {
    permissions: [PERMISSIONS.ROLES_MANAGE],
    description:
      "[Admin] Create or update a role with its permissions.\n" +
      "Actions: create (new role), update (modify existing), delete (remove role).\n" +
      "Roles are dynamic RBAC — permissions are assigned via role_permissions table.",
    input: z.object({
      action: z.enum(["create", "update", "delete"]).describe("Role management action"),
      roleId: z.string().uuid().optional().describe("Role ID (required for update/delete)"),
      name: z.string().optional().describe("Role display name"),
      slug: z.string().optional().describe("Role slug (unique identifier)"),
      hierarchyLevel: z.number().optional().describe("Hierarchy level (higher = more privileged)"),
      bypassTagFilter: z.boolean().optional().describe("Whether this role bypasses tag-based isolation"),
      inheritsFromId: z.string().uuid().optional().describe("Parent role ID to inherit permissions from"),
      permissionSlugs: z.array(z.string()).optional().describe("Permission slugs to assign to this role"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const db = services.db;

      if (input.action === "create") {
        const [created] = await db
          .insert(roles)
          .values({
            companyId: actor.companyId,
            name: input.name!,
            slug: input.slug!,
            hierarchyLevel: input.hierarchyLevel ?? 100,
            bypassTagFilter: input.bypassTagFilter ?? false,
            inheritsFromId: input.inheritsFromId ?? null,
            isSystem: false,
          })
          .returning();

        if (Array.isArray(input.permissionSlugs) && input.permissionSlugs.length > 0) {
          const permRows = await db
            .select({ id: permissions.id })
            .from(permissions)
            .where(and(
              eq(permissions.companyId, actor.companyId),
              inArray(permissions.slug, input.permissionSlugs),
            ));
          if (permRows.length > 0) {
            await db.insert(rolePermissions).values(
              permRows.map((p: any) => ({ roleId: created.id, permissionId: p.id })),
            );
          }
        }

        services.access.invalidateRoleCache();
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: created.id, name: created.name, slug: created.slug }) }],
        };
      }

      if (input.action === "update") {
        if (!input.roleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "roleId is required for update" }) }],
            isError: true,
          };
        }
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name !== undefined) updates.name = input.name;
        if (input.slug !== undefined) updates.slug = input.slug;
        if (input.hierarchyLevel !== undefined) updates.hierarchyLevel = input.hierarchyLevel;
        if (input.bypassTagFilter !== undefined) updates.bypassTagFilter = input.bypassTagFilter;
        if (input.inheritsFromId !== undefined) updates.inheritsFromId = input.inheritsFromId;

        const [updated] = await db
          .update(roles)
          .set(updates)
          .where(and(eq(roles.id, input.roleId), eq(roles.companyId, actor.companyId)))
          .returning();

        if (!updated) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Role not found" }) }],
            isError: true,
          };
        }

        if (Array.isArray(input.permissionSlugs)) {
          await db.delete(rolePermissions).where(eq(rolePermissions.roleId, input.roleId));
          if (input.permissionSlugs.length > 0) {
            const permRows = await db
              .select({ id: permissions.id })
              .from(permissions)
              .where(and(
                eq(permissions.companyId, actor.companyId),
                inArray(permissions.slug, input.permissionSlugs),
              ));
            if (permRows.length > 0) {
              await db.insert(rolePermissions).values(
                permRows.map((p: any) => ({ roleId: input.roleId!, permissionId: p.id })),
              );
            }
          }
        }

        services.access.invalidateRoleCache();
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: updated.id, name: updated.name, slug: updated.slug }) }],
        };
      }

      if (input.action === "delete") {
        if (!input.roleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "roleId is required for delete" }) }],
            isError: true,
          };
        }
        await db.delete(roles).where(and(eq(roles.id, input.roleId), eq(roles.companyId, actor.companyId)));
        services.access.invalidateRoleCache();
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, action: "deleted" }) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown action" }) }],
        isError: true,
      };
    },
  });

  // ── Tags ──────────────────────────────────────────────────────────────────

  tool("list_tags", {
    permissions: [PERMISSIONS.TAGS_READ],
    description:
      "[Admin] List all tags in the company.\n" +
      "Tags control visibility — users only see agents/issues sharing at least 1 tag.\n" +
      "Returns tag name, slug, description, and assignment counts.",
    input: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ actor }) => {
      const db = services.db;
      const allTags = await db
        .select()
        .from(tags)
        .where(and(eq(tags.companyId, actor.companyId), isNull(tags.archivedAt)))
        .orderBy(tags.name);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: allTags.map((t: any) => ({
              id: t.id,
              name: t.name,
              slug: t.slug,
              description: t.description,
              color: t.color,
              archivedAt: t.archivedAt,
            })),
            total: allTags.length,
          }),
        }],
      };
    },
  });

  tool("manage_tag", {
    permissions: [PERMISSIONS.TAGS_MANAGE],
    description:
      "[Admin] Create, update, or archive a tag.\n" +
      "Tags are the primary isolation mechanism — they control data visibility.\n" +
      "Actions: create (new tag), update (modify), archive (soft-delete).",
    input: z.object({
      action: z.enum(["create", "update", "archive"]).describe("Tag management action"),
      tagId: z.string().uuid().optional().describe("Tag ID (required for update/archive)"),
      name: z.string().optional().describe("Tag display name"),
      slug: z.string().optional().describe("Tag slug (unique identifier)"),
      description: z.string().optional().describe("Tag description"),
      color: z.string().optional().describe("Tag color (hex)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const db = services.db;

      if (input.action === "create") {
        const [created] = await db
          .insert(tags)
          .values({
            companyId: actor.companyId,
            name: input.name!,
            slug: input.slug!,
            description: input.description ?? null,
            color: input.color ?? null,
          })
          .returning();
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: created.id, name: created.name, slug: created.slug }) }],
        };
      }

      if (input.action === "update") {
        if (!input.tagId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "tagId is required for update" }) }],
            isError: true,
          };
        }
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name !== undefined) updates.name = input.name;
        if (input.slug !== undefined) updates.slug = input.slug;
        if (input.description !== undefined) updates.description = input.description;
        if (input.color !== undefined) updates.color = input.color;

        const [updated] = await db
          .update(tags)
          .set(updates)
          .where(and(eq(tags.id, input.tagId), eq(tags.companyId, actor.companyId)))
          .returning();

        if (!updated) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Tag not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: updated.id, name: updated.name, slug: updated.slug }) }],
        };
      }

      if (input.action === "archive") {
        if (!input.tagId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "tagId is required for archive" }) }],
            isError: true,
          };
        }
        const [archived] = await db
          .update(tags)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(tags.id, input.tagId), eq(tags.companyId, actor.companyId)))
          .returning();

        if (!archived) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Tag not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, action: "archived" }) }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Unknown action" }) }],
        isError: true,
      };
    },
  });

  // ── Audit ─────────────────────────────────────────────────────────────────

  tool("get_audit_log", {
    permissions: [PERMISSIONS.AUDIT_READ],
    description:
      "[Admin] Query the audit log with filters and pagination.\n" +
      "Returns timestamped events with actor, action, target, and severity.\n" +
      "Supports filtering by actor, action, target, severity, and date range.",
    input: z.object({
      actorId: z.string().optional().describe("Filter by actor ID"),
      actorType: z.string().optional().describe("Filter by actor type (user, agent, system)"),
      action: z.string().optional().describe("Filter by action (e.g. a2a.message_sent)"),
      targetType: z.string().optional().describe("Filter by target type"),
      targetId: z.string().optional().describe("Filter by target ID"),
      severity: z.string().optional().describe("Filter by severity (info, warning, error)"),
      dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
      dateTo: z.string().optional().describe("End date (ISO 8601)"),
      search: z.string().optional().describe("Full-text search across action, target type, target ID"),
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Offset for pagination"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.audit.list({
        companyId: actor.companyId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        severity: input.severity,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        search: input.search,
        limit: input.limit,
        offset: input.offset,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: result.data.map((e: any) => ({
              id: e.id,
              actorId: e.actorId,
              actorType: e.actorType,
              action: e.action,
              targetType: e.targetType,
              targetId: e.targetId,
              severity: e.severity,
              createdAt: e.createdAt,
            })),
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          }),
        }],
      };
    },
  });

  tool("export_audit", {
    permissions: [PERMISSIONS.AUDIT_EXPORT],
    description:
      "[Admin] Export audit log as JSON for compliance or analysis.\n" +
      "Returns filtered audit events in full detail including metadata.\n" +
      "Supports the same filters as get_audit_log.",
    input: z.object({
      actorId: z.string().optional().describe("Filter by actor ID"),
      actorType: z.string().optional().describe("Filter by actor type"),
      action: z.string().optional().describe("Filter by action"),
      targetType: z.string().optional().describe("Filter by target type"),
      severity: z.string().optional().describe("Filter by severity"),
      dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
      dateTo: z.string().optional().describe("End date (ISO 8601)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const filters = {
        companyId: actor.companyId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        targetType: input.targetType,
        severity: input.severity,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      };

      // Collect JSON export from async generator
      const chunks: string[] = [];
      for await (const chunk of services.audit.exportJson(filters)) {
        chunks.push(chunk);
      }

      return {
        content: [{
          type: "text" as const,
          text: chunks.join(""),
        }],
      };
    },
  });
});
