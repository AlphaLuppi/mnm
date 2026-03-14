/**
 * A2A-S01: Agent-to-Agent Communication Validators (Zod schemas)
 */

import { z } from "zod";
import { A2A_MESSAGE_TYPES, A2A_MESSAGE_STATUSES } from "../types/a2a.js";

// --- Send a new A2A message ---
// a2a-s01-validator-send
export const sendA2AMessageSchema = z.object({
  receiverId: z.string().uuid(),
  messageType: z.enum(A2A_MESSAGE_TYPES).default("request"),
  content: z.record(z.unknown()),
  metadata: z.record(z.unknown()).nullable().optional(),
  chainId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
  ttlSeconds: z.number().int().min(10).max(86400).default(300),
});
export type SendA2AMessage = z.infer<typeof sendA2AMessageSchema>;

// --- Respond to an A2A message ---
export const respondA2AMessageSchema = z.object({
  content: z.record(z.unknown()),
  metadata: z.record(z.unknown()).nullable().optional(),
});
export type RespondA2AMessage = z.infer<typeof respondA2AMessageSchema>;

// --- Filter A2A messages query params ---
// a2a-s01-validator-filters
export const a2aMessageFiltersSchema = z.object({
  senderId: z.string().uuid().optional(),
  receiverId: z.string().uuid().optional(),
  messageType: z.enum(A2A_MESSAGE_TYPES).optional(),
  status: z.enum(A2A_MESSAGE_STATUSES).optional(),
  chainId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type A2AMessageFiltersInput = z.infer<typeof a2aMessageFiltersSchema>;
