import { api } from "./client";
import type { ChatShare, ChatContextLink } from "@mnm/shared";

export const chatSharingApi = {
  // Shares
  createShare(companyId: string, channelId: string, input: { permission?: string; expiresAt?: string }) {
    return api.post<ChatShare>(`/companies/${companyId}/chat/channels/${channelId}/share`, input);
  },

  listShares(companyId: string, channelId: string) {
    return api.get<ChatShare[]>(`/companies/${companyId}/chat/channels/${channelId}/shares`);
  },

  revokeShare(companyId: string, shareId: string) {
    return api.delete(`/companies/${companyId}/chat/shares/${shareId}`);
  },

  getSharedChat(companyId: string, token: string) {
    return api.get<{ channel: any; messages: any[]; share: ChatShare; hasMore: boolean }>(
      `/companies/${companyId}/shared/chat/${token}`,
    );
  },

  forkChat(companyId: string, token: string, agentId: string) {
    return api.post<any>(`/companies/${companyId}/shared/chat/${token}/fork`, { agentId });
  },

  // Context links
  addContextLink(companyId: string, channelId: string, input: { linkType: string; documentId?: string; artifactId?: string; folderId?: string; linkedChannelId?: string }) {
    return api.post<ChatContextLink>(`/companies/${companyId}/chat/channels/${channelId}/context`, input);
  },

  getContextLinks(companyId: string, channelId: string) {
    return api.get<ChatContextLink[]>(`/companies/${companyId}/chat/channels/${channelId}/context`);
  },

  removeContextLink(companyId: string, channelId: string, linkId: string) {
    return api.delete(`/companies/${companyId}/chat/channels/${channelId}/context/${linkId}`);
  },
};
