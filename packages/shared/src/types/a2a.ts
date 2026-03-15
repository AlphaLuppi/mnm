/**
 * A2A-S01: Agent-to-Agent Communication Types
 *
 * Defines message types, statuses, and interfaces for the A2A Bus
 * that enables structured inter-agent communication.
 */

// --- Constants ---

// a2a-s01-types-type
export const A2A_MESSAGE_TYPES = ["request", "response", "notification", "error"] as const;

// a2a-s01-types-status
export const A2A_MESSAGE_STATUSES = ["pending", "completed", "expired", "cancelled", "error"] as const;

// --- Types ---

export type A2AMessageType = (typeof A2A_MESSAGE_TYPES)[number];
export type A2AMessageStatus = (typeof A2A_MESSAGE_STATUSES)[number];

// --- Interfaces ---

/**
 * A single A2A message record.
 * Represents a structured message between two agents within a company.
 */
// a2a-s01-types-message
export interface A2AMessage {
  id: string;
  companyId: string;
  chainId: string;
  senderId: string;
  receiverId: string;
  replyToId: string | null;
  messageType: A2AMessageType;
  status: A2AMessageStatus;
  content: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  chainDepth: number;
  ttlSeconds: number;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
}

/**
 * Information about an A2A communication chain.
 */
export interface A2AChainInfo {
  chainId: string;
  depth: number;
  agents: string[];
  messageCount: number;
  status: "active" | "completed" | "expired";
  createdAt: string;
}

/**
 * Aggregated statistics for A2A communication within a company.
 */
export interface A2AStats {
  totalMessages: number;
  pendingCount: number;
  completedCount: number;
  expiredCount: number;
  cancelledCount: number;
  errorCount: number;
  cyclesDetected: number;
  averageResponseTimeMs: number | null;
}

/**
 * Filters for querying A2A messages.
 */
export interface A2AMessageFilters {
  senderId?: string;
  receiverId?: string;
  messageType?: A2AMessageType;
  status?: A2AMessageStatus;
  chainId?: string;
  limit?: number;
  offset?: number;
}

// =============================================
// A2A-S02: Permissions Granulaires A2A
// =============================================

// a2a-s02-types-policy
export const A2A_DEFAULT_POLICIES = ["allow", "deny"] as const;
export type A2ADefaultPolicy = (typeof A2A_DEFAULT_POLICIES)[number];

/**
 * A permission rule controlling which agents can communicate via A2A.
 * Rules can target specific agents (by ID) or agent roles.
 * Agent-specific rules (by ID) take implicit priority over role-based rules.
 */
// a2a-s02-types-rule
export interface A2APermissionRule {
  id: string;
  companyId: string;
  sourceAgentId: string | null;
  sourceAgentRole: string | null;
  targetAgentId: string | null;
  targetAgentRole: string | null;
  allowed: boolean;
  bidirectional: boolean;
  priority: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of a permission check for A2A communication.
 */
// a2a-s02-types-check-result
export interface A2APermissionCheckResult {
  allowed: boolean;
  matchedRuleId: string | null;
  reason: "explicit_rule" | "default_policy";
  defaultPolicy: A2ADefaultPolicy;
}

// =============================================
// A2A-S03: Audit A2A — All audited A2A actions
// =============================================

// a2a-s03-audit-actions
export const A2A_AUDIT_ACTIONS = [
  "a2a.message_sent",
  "a2a.message_responded",
  "a2a.message_expired",
  "a2a.message_cancelled",
  "a2a.permission_allowed",
  "a2a.permission_denied",
  "a2a.cycle_detected",
  "a2a.chain_depth_exceeded",
  "a2a.permission_rule_created",
  "a2a.permission_rule_updated",
  "a2a.permission_rule_deleted",
  "a2a.default_policy_updated",
  "a2a.stats_queried",
] as const;

export type A2AAuditAction = (typeof A2A_AUDIT_ACTIONS)[number];

// =============================================
// A2A-S04: MCP Connector Types
// =============================================

// a2a-s04-types-transport
export const MCP_TRANSPORT_TYPES = ["stdio", "sse", "streamable-http"] as const;
export type McpTransportType = (typeof MCP_TRANSPORT_TYPES)[number];

export const MCP_AUTH_TYPES = ["none", "bearer", "api_key", "oauth2"] as const;
export type McpAuthType = (typeof MCP_AUTH_TYPES)[number];

export const MCP_CONNECTOR_STATUSES = ["active", "inactive", "error"] as const;
export type McpConnectorStatus = (typeof MCP_CONNECTOR_STATUSES)[number];

/**
 * A registered MCP server connector within a company.
 * Allows agents to access external tools via the Model Context Protocol.
 */
// a2a-s04-types-connector
export interface McpConnector {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  url: string;
  transport: McpTransportType;
  authType: McpAuthType;
  authConfig: Record<string, unknown> | null;
  status: McpConnectorStatus;
  toolCount: number;
  lastTestedAt: string | null;
  lastTestResult: McpConnectorTestResult | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A tool exposed by an MCP server.
 */
// a2a-s04-types-tool
export interface McpTool {
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
}

/**
 * Result of invoking an MCP tool.
 */
export interface McpToolInvocationResult {
  connectorId: string;
  toolName: string;
  success: boolean;
  result: unknown;
  error: string | null;
  durationMs: number;
  invokedAt: string;
}

/**
 * Result of testing connectivity to an MCP server.
 */
export interface McpConnectorTestResult {
  reachable: boolean;
  latencyMs: number;
  toolCount: number;
  error: string | null;
  testedAt: string;
}

/**
 * Aggregated statistics for MCP connectors within a company.
 */
export interface McpConnectorStats {
  totalConnectors: number;
  activeCount: number;
  inactiveCount: number;
  errorCount: number;
  totalToolInvocations: number;
  averageLatencyMs: number | null;
}

/**
 * Filters for querying MCP connectors.
 */
export interface McpConnectorFilters {
  status?: McpConnectorStatus;
  transport?: McpTransportType;
  limit?: number;
  offset?: number;
}
