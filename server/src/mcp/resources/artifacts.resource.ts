import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://artifacts/{artifactId}", {
    permissions: [PERMISSIONS.ARTIFACTS_READ],
    name: "Artifact",
    description: "An artifact with its metadata and current version content",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const artifact = await services.artifacts.getById(actor.companyId, params.artifactId);
      if (!artifact) {
        return {
          contents: [{
            uri: `mnm://artifacts/${params.artifactId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Artifact not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://artifacts/${params.artifactId}`,
          mimeType: "application/json",
          text: JSON.stringify(artifact),
        }],
      };
    },
  });
});
