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
