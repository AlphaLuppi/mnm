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

// =============================================
// A2A-S02: Permission rule validators
// =============================================

import { A2A_DEFAULT_POLICIES } from "../types/a2a.js";
import { AGENT_ROLES } from "../constants.js";

// a2a-s02-validator-create-rule
export const createA2APermissionRuleSchema = z.object({
  sourceAgentId: z.string().uuid().nullable().optional(),
  sourceAgentRole: z.string().nullable().optional(),
  targetAgentId: z.string().uuid().nullable().optional(),
  targetAgentRole: z.string().nullable().optional(),
  allowed: z.boolean().default(true),
  bidirectional: z.boolean().default(false),
  priority: z.number().int().min(0).max(1000).default(0),
  description: z.string().max(500).nullable().optional(),
});
export type CreateA2APermissionRule = z.infer<typeof createA2APermissionRuleSchema>;

// a2a-s02-validator-update-rule
export const updateA2APermissionRuleSchema = z.object({
  sourceAgentId: z.string().uuid().nullable().optional(),
  sourceAgentRole: z.string().nullable().optional(),
  targetAgentId: z.string().uuid().nullable().optional(),
  targetAgentRole: z.string().nullable().optional(),
  allowed: z.boolean().optional(),
  bidirectional: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  description: z.string().max(500).nullable().optional(),
});
export type UpdateA2APermissionRule = z.infer<typeof updateA2APermissionRuleSchema>;

// a2a-s02-validator-default-policy
export const updateA2ADefaultPolicySchema = z.object({
  policy: z.enum(A2A_DEFAULT_POLICIES),
});
export type UpdateA2ADefaultPolicy = z.infer<typeof updateA2ADefaultPolicySchema>;

// =============================================
// A2A-S04: MCP Connector validators
// =============================================

import { MCP_TRANSPORT_TYPES, MCP_AUTH_TYPES, MCP_CONNECTOR_STATUSES } from "../types/a2a.js";

// a2a-s04-validator-create
export const createMcpConnectorSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  url: z.string().url().max(2048),
  transport: z.enum(MCP_TRANSPORT_TYPES),
  authType: z.enum(MCP_AUTH_TYPES).default("none"),
  authConfig: z.record(z.unknown()).nullable().optional(),
});
export type CreateMcpConnector = z.infer<typeof createMcpConnectorSchema>;

// a2a-s04-validator-update
export const updateMcpConnectorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  url: z.string().url().max(2048).optional(),
  transport: z.enum(MCP_TRANSPORT_TYPES).optional(),
  authType: z.enum(MCP_AUTH_TYPES).optional(),
  authConfig: z.record(z.unknown()).nullable().optional(),
  status: z.enum(MCP_CONNECTOR_STATUSES).optional(),
});
export type UpdateMcpConnector = z.infer<typeof updateMcpConnectorSchema>;

// a2a-s04-validator-filters
export const mcpConnectorFiltersSchema = z.object({
  status: z.enum(MCP_CONNECTOR_STATUSES).optional(),
  transport: z.enum(MCP_TRANSPORT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type McpConnectorFiltersInput = z.infer<typeof mcpConnectorFiltersSchema>;

// a2a-s04-validator-invoke
export const invokeMcpToolSchema = z.object({
  args: z.record(z.unknown()).default({}),
});
export type InvokeMcpTool = z.infer<typeof invokeMcpToolSchema>;
