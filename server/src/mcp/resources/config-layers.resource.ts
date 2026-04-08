import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://config-layers/{layerId}", {
    permissions: [PERMISSIONS.CONFIG_LAYERS_READ],
    name: "Config Layer",
    description: "A config layer with its items, scope, visibility, and enforcement status",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const layer = await services.configLayers.getLayer(params.layerId);
      if (!layer || layer.companyId !== actor.companyId) {
        return {
          contents: [{
            uri: `mnm://config-layers/${params.layerId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Config layer not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://config-layers/${params.layerId}`,
          mimeType: "application/json",
          text: JSON.stringify(layer),
        }],
      };
    },
  });
});
