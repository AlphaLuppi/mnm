import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_artifacts", {
    permissions: [PERMISSIONS.ARTIFACTS_READ],
    description:
      "[Artifacts] List artifacts with optional filters by channel, type, or creator.\n" +
      "Returns artifacts ordered by most recently created.",
    input: z.object({
      channelId: z.string().uuid().optional().describe("Filter by source channel ID"),
      artifactType: z.string().optional().describe("Filter by type: markdown, code, html, spreadsheet"),
      createdByUserId: z.string().uuid().optional().describe("Filter by creator user ID"),
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Offset for pagination"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.artifacts.list(actor.companyId, {
        channelId: input.channelId,
        artifactType: input.artifactType,
        createdByUserId: input.createdByUserId,
        limit: input.limit,
        offset: input.offset,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: result.artifacts.map((a: any) => ({
              id: a.id,
              title: a.title,
              artifactType: a.artifactType,
              language: a.language,
              sourceChannelId: a.sourceChannelId,
              createdByUserId: a.createdByUserId,
              createdByAgentId: a.createdByAgentId,
              createdAt: a.createdAt,
            })),
            total: result.total,
          }),
        }],
      };
    },
  });

  tool("get_artifact", {
    permissions: [PERMISSIONS.ARTIFACTS_READ],
    description:
      "[Artifacts] Get a single artifact by ID with its current version content.\n" +
      "Returns full artifact details including the latest version.",
    input: z.object({
      artifactId: z.string().uuid().describe("The artifact ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const artifact = await services.artifacts.getById(actor.companyId, input.artifactId);
      if (!artifact) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Artifact not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(artifact),
        }],
      };
    },
  });

  tool("create_artifact", {
    permissions: [PERMISSIONS.ARTIFACTS_CREATE],
    description:
      "[Artifacts] Create a new artifact with initial content.\n" +
      "The artifact type is auto-detected from content if not specified.",
    input: z.object({
      title: z.string().min(1).describe("Artifact title"),
      content: z.string().min(1).describe("Initial content"),
      artifactType: z.string().optional().describe("Type: markdown, code, html, spreadsheet (auto-detected if omitted)"),
      language: z.string().optional().describe("Programming language (for code artifacts)"),
      sourceChannelId: z.string().uuid().optional().describe("Channel this artifact originated from"),
      sourceMessageId: z.string().uuid().optional().describe("Message this artifact originated from"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const artifact = await services.artifacts.create(
        actor.companyId,
        {
          title: input.title,
          content: input.content,
          artifactType: input.artifactType,
          language: input.language,
          sourceChannelId: input.sourceChannelId,
          sourceMessageId: input.sourceMessageId,
        },
        { userId: actor.userId, agentId: actor.agentId },
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: artifact.id,
            title: artifact.title,
            artifactType: artifact.artifactType,
            versionNumber: artifact.currentVersion?.versionNumber ?? 1,
          }),
        }],
      };
    },
  });

  tool("deploy_artifact", {
    permissions: [PERMISSIONS.ARTIFACTS_DEPLOY],
    description:
      "[Artifacts] Deploy an artifact to a preview environment.\n" +
      "Creates a running container serving the artifact content.",
    input: z.object({
      artifactId: z.string().uuid().describe("The artifact ID to deploy"),
      ttlSeconds: z.number().optional().describe("Time-to-live in seconds (default 86400 = 24h)"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const artifact = await services.artifacts.getById(actor.companyId, input.artifactId);
      if (!artifact) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Artifact not found" }) }],
          isError: true,
        };
      }
      const deployment = await services.deployManager.deploy(
        actor.companyId,
        input.artifactId,
        { ttlSeconds: input.ttlSeconds, deployedByUserId: actor.userId },
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: deployment.id,
            artifactId: deployment.artifactId,
            status: deployment.status,
            port: deployment.port,
            url: deployment.url,
          }),
        }],
      };
    },
  });

  tool("delete_artifact", {
    permissions: [PERMISSIONS.ARTIFACTS_DELETE],
    description:
      "[Artifacts] Permanently delete an artifact and all its versions.\n" +
      "This action cannot be undone.",
    input: z.object({
      artifactId: z.string().uuid().describe("The artifact ID to delete"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const existing = await services.artifacts.getById(actor.companyId, input.artifactId);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Artifact not found" }) }],
          isError: true,
        };
      }
      await services.artifacts.delete(actor.companyId, input.artifactId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ artifactId: input.artifactId, deleted: true }),
        }],
      };
    },
  });
});
