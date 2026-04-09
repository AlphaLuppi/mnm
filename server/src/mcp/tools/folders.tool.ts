import { z } from "zod";
import { PERMISSIONS } from "@mnm/shared";
import { defineMcpTools } from "../registry/define-mcp-tools.js";
import { encodeCursor, decodeCursor } from "./_pagination.js";

export default defineMcpTools(({ tool, services }) => {
  tool("list_folders", {
    permissions: [PERMISSIONS.FOLDERS_READ],
    description:
      "[Folders] List folders visible to the current user.\n" +
      "Returns cursor-paginated results. Visibility is derived from ownership, shares, and tag overlap.\n" +
      "Pass the nextCursor value to fetch subsequent pages.",
    input: z.object({
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(100).default(25).describe("Page size (default 25, max 100)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const limit = input.limit ?? 25;
      const offset = decodeCursor(input.cursor);
      const result = await services.folders.list(
        actor.companyId,
        actor.userId!,
        { limit: limit + 1, offset },
      );
      const items = result.folders;
      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            items: page.map((f: any) => ({
              id: f.id,
              name: f.name,
              description: f.description,
              icon: f.icon,
              ownerUserId: f.ownerUserId,
              createdAt: f.createdAt,
              updatedAt: f.updatedAt,
            })),
            total: page.length,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + limit) : null,
          }),
        }],
      };
    },
  });

  tool("get_folder", {
    permissions: [PERMISSIONS.FOLDERS_READ],
    description:
      "[Folders] Get a single folder by ID with item count and edit permission.\n" +
      "Returns null if the folder is not visible to the requesting user.",
    input: z.object({
      folderId: z.string().uuid().describe("The folder ID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const folder = await services.folders.getById(
        actor.companyId,
        input.folderId,
        actor.userId!,
      );
      if (!folder) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Folder not found" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(folder),
        }],
      };
    },
  });

  tool("create_folder", {
    permissions: [PERMISSIONS.FOLDERS_CREATE],
    description:
      "[Folders] Create a new folder.\n" +
      "The requesting user becomes the owner.",
    input: z.object({
      name: z.string().min(1).describe("Folder name"),
      description: z.string().optional().describe("Folder description"),
      icon: z.string().optional().describe("Icon identifier"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const folder = await services.folders.create(
        actor.companyId,
        {
          name: input.name,
          description: input.description,
          icon: input.icon,
        },
        actor.userId!,
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: folder.id,
            name: folder.name,
            ownerUserId: folder.ownerUserId,
          }),
        }],
      };
    },
  });

  tool("update_folder", {
    permissions: [PERMISSIONS.FOLDERS_EDIT],
    description:
      "[Folders] Update a folder's name, description, or icon.\n" +
      "Only the owner or editors (via folder_shares) can update.",
    input: z.object({
      folderId: z.string().uuid().describe("The folder ID to update"),
      name: z.string().optional().describe("New folder name"),
      description: z.string().optional().describe("New description"),
      icon: z.string().optional().describe("New icon identifier"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.folders.update(
        actor.companyId,
        input.folderId,
        {
          name: input.name,
          description: input.description,
          icon: input.icon,
        },
        actor.userId!,
      );
      if (!result) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Folder not found" }) }],
          isError: true,
        };
      }
      if ("error" in result && result.error === "forbidden") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Not allowed to edit this folder" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: result.id,
            name: result.name,
            updatedAt: result.updatedAt,
          }),
        }],
      };
    },
  });

  tool("delete_folder", {
    permissions: [PERMISSIONS.FOLDERS_DELETE],
    description:
      "[Folders] Delete a folder. Only the owner can delete.\n" +
      "Native documents are soft-deleted unless preserved.",
    input: z.object({
      folderId: z.string().uuid().describe("The folder ID to delete"),
      preserveDocumentIds: z.array(z.string().uuid()).optional().describe("Document IDs to detach instead of deleting"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    handler: async ({ input, actor }) => {
      const result = await services.folders.delete(
        actor.companyId,
        input.folderId,
        actor.userId!,
        input.preserveDocumentIds,
      );
      if (result.error === "not_found") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Folder not found" }) }],
          isError: true,
        };
      }
      if (result.error === "forbidden") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Only the owner can delete this folder" }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ folderId: input.folderId, deleted: true }),
        }],
      };
    },
  });
});
