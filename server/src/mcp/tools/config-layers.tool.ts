import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_config_layers", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_READ],
    description:
      "[Config Layers] List all config layers for the company.\n" +
      "Returns non-base, non-archived layers by default with item counts and attached agents.\n" +
      "Use scope filter to narrow results (private, shared, company).",
    input: z.object({
      scope: z.string().optional().describe("Filter by scope: private, shared, company"),
      includeArchived: z.boolean().optional().describe("Include archived layers (default false)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const items = await services.configLayers.listLayers(actor.companyId, {
        scope: input.scope,
        includeArchived: input.includeArchived,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: items.map((l: any) => ({
              id: l.id,
              name: l.name,
              description: l.description,
              scope: l.scope,
              enforced: l.enforced,
              visibility: l.visibility,
              itemCount: l.itemCount,
              itemBreakdown: l.itemBreakdown,
              agents: l.agents,
              createdByUserName: l.createdByUserName,
              createdAt: l.createdAt,
            })),
            total: items.length,
          }),
        }],
      };
    },
  });

  tool("get_config_layer", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_READ],
    description:
      "[Config Layers] Get a single config layer by ID with full details including items.",
    input: z.object({
      layerId: z.string().uuid().describe("The config layer ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const layer = await services.configLayers.getLayer(input.layerId);
      if (!layer || layer.companyId !== actor.companyId) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Config layer not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(layer),
        }],
      };
    },
  });

  tool("create_config_layer", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_CREATE],
    description:
      "[Config Layers] Create a new config layer.\n" +
      "Scope determines visibility: private (creator only), shared (team), company (all).\n" +
      "Enforced layers apply to all agents automatically.",
    input: z.object({
      name: z.string().min(1).describe("Layer name"),
      description: z.string().optional().describe("Layer description"),
      icon: z.string().optional().describe("Icon identifier"),
      scope: z.string().describe("Scope: private, shared, or company"),
      enforced: z.boolean().optional().describe("Whether the layer is enforced on all agents (default false)"),
      visibility: z.string().optional().describe("Visibility: private, team, or public (auto-derived from scope if omitted)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const layer = await services.configLayers.createLayer(
        actor.companyId,
        actor.userId!,
        {
          name: input.name,
          description: input.description,
          icon: input.icon,
          scope: input.scope,
          enforced: input.enforced,
          visibility: input.visibility,
        },
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: layer.id,
            name: layer.name,
            scope: layer.scope,
            enforced: layer.enforced,
            visibility: layer.visibility,
          }),
        }],
      };
    },
  });

  tool("update_config_layer", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_EDIT],
    description:
      "[Config Layers] Update an existing config layer's metadata.\n" +
      "Only provided fields are updated. Content changes reset promotion status.",
    input: z.object({
      layerId: z.string().uuid().describe("The config layer ID"),
      name: z.string().min(1).optional().describe("New layer name"),
      description: z.string().optional().describe("New description"),
      icon: z.string().optional().describe("New icon identifier"),
      enforced: z.boolean().optional().describe("Whether the layer is enforced"),
      visibility: z.string().optional().describe("New visibility: private, team, or public"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const { layerId, ...updates } = input;
      const layer = await services.configLayers.updateLayer(
        layerId,
        actor.userId!,
        updates,
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: layer.id,
            name: layer.name,
            scope: layer.scope,
            enforced: layer.enforced,
            visibility: layer.visibility,
            updatedAt: layer.updatedAt,
          }),
        }],
      };
    },
  });

  tool("delete_config_layer", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_DELETE],
    description:
      "[Config Layers] Archive (soft-delete) a config layer.\n" +
      "Base layers cannot be archived. Archived layers are hidden from default listings.",
    input: z.object({
      layerId: z.string().uuid().describe("The config layer ID to archive"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const layer = await services.configLayers.archiveLayer(
        input.layerId,
        actor.userId!,
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: layer.id,
            name: layer.name,
            archivedAt: layer.archivedAt,
          }),
        }],
      };
    },
  });

  tool("attach_config_layer", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_ATTACH],
    description:
      "[Config Layers] Attach a config layer to an agent with a given priority.\n" +
      "Higher priority layers override lower ones. Enforced conflicts block attachment.",
    input: z.object({
      agentId: z.string().uuid().describe("The agent ID to attach the layer to"),
      layerId: z.string().uuid().describe("The config layer ID to attach"),
      priority: z.number().int().min(0).max(498).describe("Priority (0-498). Higher overrides lower."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const conflictResult = await services.configLayerConflict.checkConflicts(
        actor.companyId,
        input.agentId,
        input.layerId,
        input.priority,
      );

      if (!conflictResult.canAttach) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            error: "Cannot attach layer: enforced conflicts detected",
            conflicts: conflictResult.conflicts,
          }) }],
          isError: true,
        };
      }

      const { agentConfigLayers } = await import("@mnm/db");
      const [attachment] = await services.db
        .insert(agentConfigLayers)
        .values({
          companyId: actor.companyId,
          agentId: input.agentId,
          layerId: input.layerId,
          priority: input.priority,
          attachedBy: actor.userId!,
        })
        .onConflictDoNothing()
        .returning();

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            attachment,
            warnings: conflictResult.conflicts.length > 0 ? conflictResult.conflicts : undefined,
          }),
        }],
      };
    },
  });
});
