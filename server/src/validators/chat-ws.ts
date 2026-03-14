import { z } from "zod";

export const chatClientMessageSchema = z.object({
  type: z.literal("chat_message"),
  content: z.string().min(1).max(4096),
  metadata: z.record(z.unknown()).optional(),
  clientMessageId: z.string().uuid().optional(),
});

const chatClientTypingSchema = z.object({
  type: z.enum(["typing_start", "typing_stop"]),
});

const chatClientSyncSchema = z.object({
  type: z.literal("sync_request"),
  lastMessageId: z.string().uuid(),
});

const chatClientPingSchema = z.object({
  type: z.literal("ping"),
});

export const chatClientPayloadSchema = z.discriminatedUnion("type", [
  chatClientMessageSchema,
  chatClientTypingSchema,
  chatClientSyncSchema,
  chatClientPingSchema,
]);

export const createChannelSchema = z.object({
  agentId: z.string().uuid(),
  heartbeatRunId: z.string().uuid().optional(),
  name: z.string().max(255).optional(),
  // CHAT-S02: new fields
  projectId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
});

export type CreateChannel = z.infer<typeof createChannelSchema>;

// CHAT-S02: update message validator
export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4096).optional(),
  deleted: z.boolean().optional(),
});
