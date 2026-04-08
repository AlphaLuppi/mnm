import type { z } from "zod";
import type { PermissionSlug } from "@mnm/shared";

/** Actor resolved from OAuth token or Agent JWT. */
export interface McpActor {
  type: "user" | "agent";
  userId?: string;
  agentId?: string;
  companyId: string;
  /** Permissions granted by scopes ∩ role permissions. */
  effectivePermissions: Set<PermissionSlug>;
  /** Tags for data isolation (user_tags ∩ agent_tags for agents). */
  effectiveTags: string[];
  /** The MCP session ID. */
  mcpSessionId: string;
}

/** Definition of a single MCP tool (used by tool-registry). */
export interface McpToolDefinition {
  name: string;
  permissions: PermissionSlug[];
  description: string;
  input: z.ZodType<any>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
  };
  handler: (ctx: { input: any; actor: McpActor }) => Promise<McpToolResult>;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Definition of a single MCP resource template. */
export interface McpResourceDefinition {
  uriTemplate: string;
  permissions: PermissionSlug[];
  name: string;
  description: string;
  mimeType: string;
  handler: (ctx: { uri: string; params: Record<string, string>; actor: McpActor }) => Promise<McpResourceResult>;
}

export interface McpResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

/** Services injected into tool/resource handlers. */
export interface McpServices {
  [key: string]: any;
}
