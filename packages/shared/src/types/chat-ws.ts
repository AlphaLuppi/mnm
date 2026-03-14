// ---- Channel / Sender literals ----
export type ChatChannelStatus = "open" | "closed";
export type ChatSenderType = "user" | "agent";

// CHAT-S02: message type discriminator
export type ChatMessageType = "text" | "system" | "command" | "file_reference";

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

export type ChatClientPayload =
  | ChatClientMessage
  | ChatClientTyping
  | ChatClientSync
  | ChatClientPing;

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

export type ChatServerPayload =
  | ChatServerMessage
  | ChatServerAck
  | ChatServerTyping
  | ChatServerSync
  | ChatServerError
  | ChatServerPong
  | ChatServerChannelClosed;
