import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Db } from "@mnm/db";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger } from "../middleware/logger.js";
import { McpSessionManager } from "./mcp-session-manager.js";
import { verifyMcpToken } from "./auth/mcp-token-verifier.js";
import { createMcpOAuthRouter, type McpOAuthRouterDeps } from "./auth/mcp-oauth-router.js";
import { ToolRegistry } from "./registry/tool-registry.js";
import { ResourceRegistry } from "./registry/resource-registry.js";
import { collectTools } from "./registry/define-mcp-tools.js";
import { collectResources } from "./registry/define-mcp-resources.js";
import { allToolDefiners } from "./tools/index.js";
import { allResourceDefiners } from "./resources/index.js";
import type { McpActor, McpServices } from "./registry/types.js";

export interface McpRouterDeps {
  db: Db;
  services: McpServices;
  resolveSession: (req: Request) => Promise<BetterAuthSessionResult | null>;
  getPublicUrl: () => string;
}

const sessionManager = new McpSessionManager();
const toolRegistry = new ToolRegistry();
const resourceRegistry = new ResourceRegistry();
let registriesPopulated = false;

/** Extract the principal ID from an actor (userId or agentId). */
function actorPrincipalId(a: Pick<McpActor, "userId" | "agentId">): string {
  return (a.userId ?? a.agentId)!;
}

export function createMcpRouter(deps: McpRouterDeps): Router {
  const { db, services, resolveSession, getPublicUrl } = deps;
  const router = Router();

  // ── Collect all tools and resources (once only) ──────────────────────────
  if (!registriesPopulated) {
    for (const definer of allToolDefiners) {
      toolRegistry.register(collectTools(definer, services, db));
    }
    for (const definer of allResourceDefiners) {
      resourceRegistry.register(collectResources(definer, services));
    }
    registriesPopulated = true;
  }

  logger.info(
    { tools: toolRegistry.allTools.length, resources: resourceRegistry.allResources.length },
    "mcp.registry.loaded",
  );

  // ── Mount OAuth 2.1 AS endpoints ────────────────────────────────────────
  const oauthDeps: McpOAuthRouterDeps = { db, resolveSession, getPublicUrl };
  router.use(createMcpOAuthRouter(oauthDeps));

  // ── Start session cleanup ───────────────────────────────────────────────
  sessionManager.start();

  // ── POST /mcp — Main MCP endpoint (Streamable HTTP) ─────────────────────
  router.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Existing session — route to transport
    if (sessionId) {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found or expired" });
        return;
      }
      await session.transport.handleRequest(req, res);
      return;
    }

    // New session — verify token first
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      const publicUrl = getPublicUrl();
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
        )
        .json({ error: "Authentication required" });
      return;
    }

    const verifiedActor = await verifyMcpToken(db, authHeader);
    if (!verifiedActor) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Create new MCP server + transport for this session
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const mcpSessionId = transport.sessionId!;

      const actor: McpActor = { ...verifiedActor, mcpSessionId };

      const mcpServer = new McpServer(
        { name: "mnm-mcp", version: "1.0.0" },
        { capabilities: { tools: { listChanged: true }, resources: { subscribe: true, listChanged: true } } },
      );

      // Register tools filtered by actor permissions
      const actorTools = toolRegistry.listForActor(actor);
      for (const tool of actorTools) {
        // MCP SDK accepts Zod shapes as paramsSchema
        const zodShape = (tool.input as any)?._def?.shape?.() ?? {};
        mcpServer.tool(
          tool.name,
          tool.description,
          zodShape,
          async (params: any) => {
            // Validate input against Zod schema
            const parsed = tool.input.safeParse(params);
            if (!parsed.success) {
              return {
                content: [{ type: "text" as const, text: JSON.stringify({
                  error: "Validation error",
                  code: "VALIDATION_ERROR",
                  retryable: false,
                  details: parsed.error.issues.map((i: any) => ({ field: i.path.join("."), message: i.message })),
                }) }],
                isError: true,
              };
            }
            const result = await tool.handler({ input: parsed.data, actor });
            return { ...result } as any;
          },
        );
      }

      // Register resource templates filtered by actor permissions
      const actorResources = resourceRegistry.listForActor(actor);
      for (const resource of actorResources) {
        const template = new ResourceTemplate(resource.uriTemplate, { list: undefined });
        mcpServer.resource(
          resource.name,
          template,
          { description: resource.description, mimeType: resource.mimeType },
          async (uri: URL, variables: Record<string, string | string[]>) => {
            // Flatten variables to single strings
            const params: Record<string, string> = {};
            for (const [k, v] of Object.entries(variables)) {
              params[k] = Array.isArray(v) ? v[0] ?? "" : v;
            }
            const result = await resource.handler({ uri: uri.href, params, actor });
            return { ...result } as any;
          },
        );
      }

      // Check session capacity BEFORE connecting to avoid resource leaks
      if (!sessionManager.createSession(mcpSessionId, transport, actor.type, actorPrincipalId(actor))) {
        res.status(503).json({ error: "Too many active sessions" });
        return;
      }

      await mcpServer.connect(transport);

      logger.info(
        { mcpSessionId, actorType: actor.type, tools: actorTools.length },
        "mcp.session.initialized",
      );

      await transport.handleRequest(req, res);
    } catch (err) {
      logger.error({ err }, "mcp.session.init-error");
      res.status(500).json({ error: "Failed to initialize MCP session" });
    }
  });

  // ── GET /mcp — SSE stream for server→client notifications ───────────────
  router.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: "Mcp-Session-Id header required" });
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    // Verify the caller owns this session
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const actor = await verifyMcpToken(db, authHeader);
    if (!actor || actorPrincipalId(actor) !== session.actorId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await session.transport.handleRequest(req, res);
  });

  // ── DELETE /mcp — Session termination ───────────────────────────────────
  router.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: "Mcp-Session-Id header required" });
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    // Verify the caller owns this session
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const actor = await verifyMcpToken(db, authHeader);
    if (!actor || actorPrincipalId(actor) !== session.actorId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    sessionManager.removeSession(sessionId);
    res.status(204).end();
  });

  return router;
}

/** Graceful shutdown — call before HTTP server close. */
export async function shutdownMcp(): Promise<void> {
  await sessionManager.shutdown();
}
