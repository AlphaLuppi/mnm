import type { ChatPipeStatus } from "@mnm/shared";
import { api } from "./client";

// chat-s04-api-types
export interface ChatChannel {
  id: string;
  companyId: string;
  agentId: string;
  heartbeatRunId: string | null;
  name: string | null;
  status: "open" | "closed";
  projectId: string | null;
  createdBy: string | null;
  description: string | null;
  lastMessageAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  companyId: string;
  senderId: string;
  senderType: "user" | "agent";
  content: string;
  metadata: Record<string, unknown> | null;
  messageType: string;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ChatChannelListFilters {
  status?: string;
  agentId?: string;
  projectId?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export interface CreateChannelBody {
  agentId: string;
  heartbeatRunId?: string;
  name?: string;
  projectId?: string;
  description?: string;
}

function buildQuery(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// chat-s04-api-client
export const chatApi = {
  listChannels: (companyId: string, filters: ChatChannelListFilters = {}) =>
    api.get<{ channels: ChatChannel[]; total: number }>(
      `/companies/${companyId}/chat/channels${buildQuery(filters as Record<string, string | number | undefined>)}`,
    ),

  getChannel: (companyId: string, channelId: string) =>
    api.get<ChatChannel & { messageCount: number }>(
      `/companies/${companyId}/chat/channels/${channelId}`,
    ),

  createChannel: (companyId: string, body: CreateChannelBody) =>
    api.post<ChatChannel>(
      `/companies/${companyId}/chat/channels`,
      body,
    ),

  closeChannel: (companyId: string, channelId: string) =>
    api.patch<ChatChannel>(
      `/companies/${companyId}/chat/channels/${channelId}`,
      { status: "closed", reason: "manual_close" },
    ),

  getMessages: (
    companyId: string,
    channelId: string,
    opts?: { before?: string; limit?: number },
  ) =>
    api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
      `/companies/${companyId}/chat/channels/${channelId}/messages${buildQuery({
        before: opts?.before,
        limit: opts?.limit,
      } as Record<string, string | number | undefined>)}`,
    ),

  getPipeStatus: (companyId: string, channelId: string) =>
    api.get<ChatPipeStatus>(
      `/companies/${companyId}/chat/channels/${channelId}/pipe`,
    ),
};
