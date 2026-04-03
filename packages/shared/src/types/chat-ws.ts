// ---- Channel / Sender literals ----
export type ChatChannelStatus = "open" | "closed";
export type ChatSenderType = "user" | "agent";

// CHAT-S02: message type discriminator
export type ChatMessageType =
  | "text"
  | "system"
  | "command"
  | "file_reference"
  | "artifact_reference"
  | "document_upload"
  | "skill_invocation"
  | "agent_delegation";

// ---- Client -> Server payloads ----
export interface ChatClientMessage {
  type: "chat_message";
  content: string;
  metadata?: Record<string, unknown>;
  clientMessageId?: string;
}

export interface ChatClientTyping {
  type: "typing_start" | "typing_stop";
}

export interface ChatClientSync {
  type: "sync_request";
  lastMessageId: string;
}

export interface ChatClientPing {
  type: "ping";
}

// Collaborative chat: Client -> Server
export interface ChatClientSlashCommand {
  type: "slash_command";
  command: string;
  args: string[];
  channelId: string;
}

export interface ChatClientMentionAgent {
  type: "mention_agent";
  agentId: string;
  content: string;
  channelId: string;
}

export interface ChatClientUploadComplete {
  type: "upload_complete";
  documentId: string;
  channelId: string;
}

export type ChatClientPayload =
  | ChatClientMessage
  | ChatClientTyping
  | ChatClientSync
  | ChatClientPing
  | ChatClientSlashCommand
  | ChatClientMentionAgent
  | ChatClientUploadComplete;

// ---- Server -> Client payloads ----
export interface ChatServerMessage {
  type: "chat_message";
  id: string;
  channelId: string;
  senderId: string;
  senderType: ChatSenderType;
  senderName?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ChatServerAck {
  type: "message_ack";
  clientMessageId: string;
  messageId: string;
  createdAt: string;
}

export interface ChatServerTyping {
  type: "typing_indicator";
  senderId: string;
  senderType: ChatSenderType;
  senderName?: string;
  isTyping: boolean;
}

export interface ChatServerSync {
  type: "sync_response";
  messages: ChatServerMessage[];
  hasMore: boolean;
}

export interface ChatServerError {
  type: "error";
  code:
    | "RATE_LIMITED"
    | "INVALID_MESSAGE"
    | "CHANNEL_CLOSED"
    | "UNAUTHORIZED"
    | "MESSAGE_TOO_LONG";
  message: string;
  retryAfter?: number;
}

export interface ChatServerPong {
  type: "pong";
}

export interface ChatServerChannelClosed {
  type: "channel_closed";
  channelId: string;
  reason: "agent_terminated" | "manual_close" | "timeout";
}

// Collaborative chat: Server -> Client
export interface ChatServerArtifactCreated {
  type: "artifact_created";
  artifactId: string;
  title: string;
  artifactType: string;
  channelId: string;
  createdBy: string;
}

export interface ChatServerArtifactUpdated {
  type: "artifact_updated";
  artifactId: string;
  versionNumber: number;
  channelId: string;
  updatedBy: string;
}

export interface ChatServerDocumentStatus {
  type: "document_status";
  documentId: string;
  status: string;
  channelId: string;
  error?: string;
}

export interface ChatServerAgentDelegating {
  type: "agent_delegating";
  fromAgentId: string;
  toAgentId: string;
  channelId: string;
  reason: string;
}

export interface ChatServerContextAdded {
  type: "context_added";
  linkType: string;
  linkId: string;
  channelId: string;
  addedBy: string;
}

export interface ChatServerCommandResult {
  type: "command_result";
  command: string;
  success: boolean;
  result?: unknown;
  error?: string;
  channelId: string;
}

export interface ChatServerMessageDelta {
  type: "chat_message_delta";
  channelId: string;
  senderId: string;
  senderType: ChatSenderType;
  content: string;
  isStreaming: boolean;
}

export type ChatServerPayload =
  | ChatServerMessage
  | ChatServerAck
  | ChatServerTyping
  | ChatServerSync
  | ChatServerError
  | ChatServerPong
  | ChatServerChannelClosed
  | ChatServerArtifactCreated
  | ChatServerArtifactUpdated
  | ChatServerDocumentStatus
  | ChatServerAgentDelegating
  | ChatServerContextAdded
  | ChatServerCommandResult
  | ChatServerMessageDelta;

// ---- CHAT-S03: Container pipe types ----

// chat-s03-shared-types
export type ContainerPipeStatus = "attached" | "detached" | "error";

export interface ChatPipeStatus {
  channelId: string;
  instanceId: string;
  status: ContainerPipeStatus;
  attachedAt: string | null;
  detachedAt: string | null;
  error: string | null;
  messagesPiped: number;
}

export interface ChatPipeAttachRequest {
  instanceId: string;
  execCommand?: string[];
  tty?: boolean;
}
