import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://documents/{documentId}", {
    permissions: [PERMISSIONS.DOCUMENTS_READ],
    name: "Document",
    description: "A document with its metadata, ingestion status, and summary",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const doc = await services.documents.getById(actor.companyId, params.documentId);
      if (!doc) {
        return {
          contents: [{
            uri: `mnm://documents/${params.documentId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Document not found" }),
          }],
        };
      }
      return {
        contents: [{
          uri: `mnm://documents/${params.documentId}`,
          mimeType: "application/json",
          text: JSON.stringify(doc),
        }],
      };
    },
  });
});
