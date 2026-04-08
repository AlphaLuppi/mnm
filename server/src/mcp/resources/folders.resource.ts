import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://folders/{folderId}", {
    permissions: [PERMISSIONS.FOLDERS_READ],
    name: "Folder",
    description: "A folder with its metadata, item count, and edit permission",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const folder = await services.folders.getById(
        actor.companyId,
        params.folderId,
        actor.userId!,
      );
      if (!folder) {
        return {
          contents: [{
            uri: `mnm://folders/${params.folderId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Folder not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://folders/${params.folderId}`,
          mimeType: "application/json",
          text: JSON.stringify(folder),
        }],
      };
    },
  });
});
