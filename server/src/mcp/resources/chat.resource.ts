import { PERMISSIONS } from "@mnm/shared";
import { defineMcpResources } from "../registry/define-mcp-resources.js";

export default defineMcpResources(({ template, services }) => {
  template("mnm://chat/{channelId}", {
    permissions: [PERMISSIONS.CHAT_READ],
    name: "Chat Channel",
    description: "A chat channel with its metadata and recent messages",
    mimeType: "application/json",
    handler: async ({ params, actor }) => {
      const channel = await services.chat.getChannel(params.channelId);
      if (!channel || channel.companyId !== actor.companyId) {
        return {
          contents: [{
            uri: `mnm://chat/${params.channelId}`,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Channel not found" }),
          }],
        };
      }
      const { messages } = await services.chat.getMessages(params.channelId, { limit: 50 });
      return {
        contents: [{
          uri: `mnm://chat/${params.channelId}`,
          mimeType: "application/json",
          text: JSON.stringify({ ...channel, messages }),
        }],
      };
    },
  });
});
