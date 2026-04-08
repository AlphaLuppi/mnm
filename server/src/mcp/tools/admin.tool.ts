import { z } from "zod";
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
      const roles = await services.roles.list(actor.companyId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: roles.map((r: any) => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
              hierarchyLevel: r.hierarchyLevel,
              bypassTagFilter: r.bypassTagFilter,
              inheritsFromId: r.inheritsFromId,
            })),
            total: roles.length,
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
      if (input.action === "create") {
        const role = await services.roles.create(actor.companyId, {
          name: input.name!,
          slug: input.slug!,
          hierarchyLevel: input.hierarchyLevel ?? 0,
          bypassTagFilter: input.bypassTagFilter ?? false,
          inheritsFromId: input.inheritsFromId ?? null,
          permissionSlugs: input.permissionSlugs ?? [],
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: role.id, name: role.name, slug: role.slug }) }],
        };
      }

      if (input.action === "update") {
        if (!input.roleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "roleId is required for update" }) }],
            isError: true,
          };
        }
        const role = await services.roles.update(actor.companyId, input.roleId, {
          name: input.name,
          slug: input.slug,
          hierarchyLevel: input.hierarchyLevel,
          bypassTagFilter: input.bypassTagFilter,
          inheritsFromId: input.inheritsFromId,
          permissionSlugs: input.permissionSlugs,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: role.id, name: role.name, slug: role.slug }) }],
        };
      }

      if (input.action === "delete") {
        if (!input.roleId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "roleId is required for delete" }) }],
            isError: true,
          };
        }
        await services.roles.delete(actor.companyId, input.roleId);
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
      const tags = await services.tags.list(actor.companyId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: tags.map((t: any) => ({
              id: t.id,
              name: t.name,
              slug: t.slug,
              description: t.description,
              color: t.color,
              archivedAt: t.archivedAt,
            })),
            total: tags.length,
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
      if (input.action === "create") {
        const tag = await services.tags.create(actor.companyId, {
          name: input.name!,
          slug: input.slug!,
          description: input.description ?? null,
          color: input.color ?? null,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: tag.id, name: tag.name, slug: tag.slug }) }],
        };
      }

      if (input.action === "update") {
        if (!input.tagId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "tagId is required for update" }) }],
            isError: true,
          };
        }
        const tag = await services.tags.update(actor.companyId, input.tagId, {
          name: input.name,
          slug: input.slug,
          description: input.description,
          color: input.color,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ id: tag.id, name: tag.name, slug: tag.slug }) }],
        };
      }

      if (input.action === "archive") {
        if (!input.tagId) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "tagId is required for archive" }) }],
            isError: true,
          };
        }
        await services.tags.archive(actor.companyId, input.tagId);
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
