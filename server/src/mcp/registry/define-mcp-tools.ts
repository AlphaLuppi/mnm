import type { z } from "zod";
import type { Db } from "@mnm/db";
import type { PermissionSlug } from "@mnm/shared";
import { MCP_ERROR_CODES, type McpErrorCode } from "@mnm/shared";
import type { McpToolDefinition, McpToolResult, McpActor, McpServices } from "./types.js";
import { auditService } from "../../services/audit.js";
import { logger } from "../../middleware/logger.js";

const TOOL_TIMEOUT_MS = 30_000;

interface ToolConfig {
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

export interface ToolRegistrar {
  services: McpServices;
  tool: (name: string, config: ToolConfig) => void;
}

export type ToolDefiner = (registrar: ToolRegistrar) => void;

function mcpError(
  error: string,
  code: McpErrorCode,
  retryable: boolean,
  hint?: string,
): McpToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error, code, retryable, hint }) }],
    isError: true,
  };
}

export function defineMcpTools(definer: ToolDefiner) {
  return definer;
}

/**
 * Collects tool definitions from a definer function, wrapping each handler
 * with permission re-check, audit logging, error handling, and timeout.
 */
export function collectTools(
  definer: ToolDefiner,
  services: McpServices,
  db: Db,
): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];
  const audit = auditService(db);

  const registrar: ToolRegistrar = {
    services,
    tool(name, config) {
      const wrappedHandler = async (ctx: { input: any; actor: McpActor }): Promise<McpToolResult> => {
        const start = Date.now();
        const { actor } = ctx;

        // Defense in depth: re-check permissions at execution time
        for (const perm of config.permissions) {
          if (!actor.effectivePermissions.has(perm)) {
            // Fire-and-forget audit for permission denial
            audit.emit({
              companyId: actor.companyId,
              actorId: actor.userId ?? actor.agentId ?? "unknown",
              actorType: actor.type,
              action: "mcp.tool.permission_denied",
              targetType: "mcp_tool",
              targetId: name,
              metadata: { missingPermission: perm, mcpSessionId: actor.mcpSessionId },
              severity: "warning",
            }).catch(() => {});
            return mcpError(
              `Missing permission: ${perm}`,
              MCP_ERROR_CODES.PERMISSION_DENIED,
              false,
              `You need the ${perm} permission. Check your MCP scopes.`,
            );
          }
        }

        try {
          const result = await Promise.race([
            config.handler(ctx),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Tool execution timed out")), TOOL_TIMEOUT_MS),
            ),
          ]);

          const durationMs = Date.now() - start;
          logger.debug({ tool: name, durationMs, actorType: actor.type }, "mcp.tool.ok");

          // Fire-and-forget audit for successful tool call
          audit.emit({
            companyId: actor.companyId,
            actorId: actor.userId ?? actor.agentId ?? "unknown",
            actorType: actor.type,
            action: "mcp.tool.called",
            targetType: "mcp_tool",
            targetId: name,
            metadata: { durationMs, mcpSessionId: actor.mcpSessionId, isError: result.isError ?? false },
            severity: "info",
          }).catch(() => {});

          return result;
        } catch (err: any) {
          const durationMs = Date.now() - start;

          if (err?.message === "Tool execution timed out") {
            logger.warn({ tool: name, durationMs }, "mcp.tool.timeout");
            return mcpError("Tool execution timed out", MCP_ERROR_CODES.TIMEOUT, true);
          }

          if (err?.statusCode === 403) {
            return mcpError(err.message ?? "Permission denied", MCP_ERROR_CODES.PERMISSION_DENIED, false);
          }
          if (err?.statusCode === 404) {
            return mcpError(err.message ?? "Not found", MCP_ERROR_CODES.NOT_FOUND, false);
          }
          if (err?.statusCode === 409) {
            return mcpError(err.message ?? "Conflict", MCP_ERROR_CODES.CONFLICT, false);
          }
          if (err?.statusCode === 422) {
            return mcpError(err.message ?? "Validation error", MCP_ERROR_CODES.VALIDATION_ERROR, false);
          }

          logger.error({ tool: name, durationMs, err }, "mcp.tool.error");
          return mcpError("Internal error", MCP_ERROR_CODES.INTERNAL_ERROR, true);
        }
      };

      tools.push({
        name,
        permissions: config.permissions,
        description: config.description,
        input: config.input,
        annotations: config.annotations,
        handler: wrappedHandler,
      });
    },
  };

  definer(registrar);
  return tools;
}
