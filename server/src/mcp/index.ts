import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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
import { createRateLimiter } from "../middleware/rate-limit.js";
import { mcpDbSemaphore } from "./mcp-health.js";
// Side-effect import: starts event loop monitor
import "./mcp-health.js";

// ── MCP rate limiters ───────────────────────────────────────────────────────

const mcpNewSessionLimiter = createRateLimiter({
  max: 10,
  windowMs: 60_000,
  keyGenerator: (req) => `mcp-new:${req.ip ?? "unknown"}`,
});

const mcpExistingSessionLimiter = createRateLimiter({
  max: 200,
  windowMs: 60_000,
  keyGenerator: (req) => `mcp-sess:${req.headers["mcp-session-id"] as string}`,
});

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

/** Create and configure an McpServer with tools/resources filtered for the given actor. */
function createConfiguredMcpServer(actor: McpActor): { mcpServer: McpServer; toolCount: number } {
  const mcpServer = new McpServer(
    { name: "mnm-mcp", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true }, resources: { subscribe: true, listChanged: true } } },
  );

  // Register tools filtered by actor permissions
  const actorTools = toolRegistry.listForActor(actor);
  for (const tool of actorTools) {
    const zodShape = (tool.input as any)?._def?.shape?.() ?? {};
    mcpServer.tool(
      tool.name,
      tool.description,
      zodShape,
      async (params: any) => {
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
        const result = await mcpDbSemaphore.run(() => tool.handler({ input: parsed.data, actor }));
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
        const params: Record<string, string> = {};
        for (const [k, v] of Object.entries(variables)) {
          params[k] = Array.isArray(v) ? v[0] ?? "" : v;
        }
        const result = await resource.handler({ uri: uri.href, params, actor });
        return { ...result } as any;
      },
    );
  }

  return { mcpServer, toolCount: actorTools.length };
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

    // Apply appropriate rate limiter based on session presence
    const limiter = sessionId ? mcpExistingSessionLimiter : mcpNewSessionLimiter;
    const limited = await new Promise<boolean>((resolve) => {
      limiter(req, res, () => resolve(false));
      // If the limiter already sent a 429, the response is finished
      if (res.writableEnded) resolve(true);
    });
    if (limited) return;

    // Existing session — route to transport
    if (sessionId) {
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found or expired" });
        return;
      }
      // Streamable HTTP sessions use handleRequest.
      // Pass req.body explicitly — express.json() has already consumed the stream.
      const transport = session.transport as StreamableHTTPServerTransport;
      await transport.handleRequest(req, res, req.body);
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
      const { mcpServer, toolCount } = createConfiguredMcpServer(actor);

      // Check session capacity BEFORE connecting to avoid resource leaks
      if (!sessionManager.createSession(mcpSessionId, transport, actor.type, actorPrincipalId(actor))) {
        res.status(503).json({ error: "Too many active sessions" });
        return;
      }

      await mcpServer.connect(transport);

      logger.info(
        { mcpSessionId, actorType: actor.type, tools: toolCount },
        "mcp.session.initialized",
      );

      // Pass req.body explicitly — express.json() has already consumed the stream.
      await transport.handleRequest(req, res, req.body);
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

    // Streamable HTTP sessions use handleRequest for GET (SSE notifications)
    const transport = session.transport as StreamableHTTPServerTransport;
    await transport.handleRequest(req, res);
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

  // ── GET /mcp/sse — Legacy SSE transport (backward compatibility) ────────
  router.get("/mcp/sse", async (req: Request, res: Response) => {
    // Rate limit new SSE sessions
    const limited = await new Promise<boolean>((resolve) => {
      mcpNewSessionLimiter(req, res, () => resolve(false));
      if (res.writableEnded) resolve(true);
    });
    if (limited) return;

    // Verify auth token
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

    try {
      // SSEServerTransport sends the `endpoint` event pointing clients to POST /mcp/sse/message
      const transport = new SSEServerTransport("/mcp/sse/message", res);
      const sseSessionId = transport.sessionId;

      const actor: McpActor = { ...verifiedActor, mcpSessionId: sseSessionId };
      const { mcpServer, toolCount } = createConfiguredMcpServer(actor);

      if (!sessionManager.createSession(sseSessionId, transport, actor.type, actorPrincipalId(actor))) {
        res.status(503).json({ error: "Too many active sessions" });
        return;
      }

      // Clean up session when the SSE connection drops
      res.on("close", () => {
        sessionManager.removeSession(sseSessionId);
        logger.debug({ sseSessionId }, "mcp.sse.session.disconnected");
      });

      await mcpServer.connect(transport);

      logger.info(
        { mcpSessionId: sseSessionId, actorType: actor.type, tools: toolCount, transport: "sse" },
        "mcp.sse.session.initialized",
      );

      // start() sets up the SSE stream and sends the endpoint event
      await transport.start();
    } catch (err) {
      logger.error({ err }, "mcp.sse.session.init-error");
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to initialize SSE session" });
      }
    }
  });

  // ── POST /mcp/sse/message — Client→server messages for legacy SSE ──────
  router.post("/mcp/sse/message", async (req: Request, res: Response) => {
    const sseSessionId = req.query.sessionId as string | undefined;
    if (!sseSessionId) {
      res.status(400).json({ error: "sessionId query parameter required" });
      return;
    }

    // Rate limit existing SSE session messages
    const limited = await new Promise<boolean>((resolve) => {
      mcpExistingSessionLimiter(req, res, () => resolve(false));
      if (res.writableEnded) resolve(true);
    });
    if (limited) return;

    const session = sessionManager.getSession(sseSessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const sseTransport = session.transport as SSEServerTransport;
    await sseTransport.handlePostMessage(req, res);
  });

  return router;
}

/** Graceful shutdown — call before HTTP server close. */
export async function shutdownMcp(): Promise<void> {
  await sessionManager.shutdown();
}
