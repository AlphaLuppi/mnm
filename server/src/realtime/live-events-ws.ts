import { createHash } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agentApiKeys, companyMemberships, instanceUserRoles } from "@mnm/db";
import type { DeploymentMode, LiveEvent } from "@mnm/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger } from "../middleware/logger.js";
import { accessService } from "../services/access.js";
import { subscribeCompanyLiveEvents } from "../services/live-events.js";
import { agentTagCache } from "./agent-tag-cache.js";
import { canReceiveEvent } from "./event-visibility.js";

interface WsSocket {
  readyState: number;
  ping(): void;
  send(data: string): void;
  terminate(): void;
  close(code?: number, reason?: string): void;
  on(event: "pong", listener: () => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

interface WsServer {
  clients: Set<WsSocket>;
  on(event: "connection", listener: (socket: WsSocket, req: IncomingMessage) => void): void;
  on(event: "close", listener: () => void): void;
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (ws: WsSocket) => void,
  ): void;
  emit(event: "connection", ws: WsSocket, req: IncomingMessage): boolean;
}

const require = createRequire(import.meta.url);
const { WebSocket, WebSocketServer } = require("ws") as {
  WebSocket: { OPEN: number };
  WebSocketServer: new (opts: { noServer: boolean }) => WsServer;
};

interface UpgradeContext {
  companyId: string;
  actorType: "board" | "agent";
  actorId: string;
  // WS-SEC-05: Tag-based filtering context
  tagIds: ReadonlySet<string>;
  bypassTagFilter: boolean;
  agentVisibilityCache: Map<string, boolean>;
}

interface IncomingMessageWithContext extends IncomingMessage {
  mnmUpgradeContext?: UpgradeContext;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function rejectUpgrade(socket: Duplex, statusLine: string, message: string) {
  const safe = message.replace(/[\r\n]+/g, " ").trim();
  socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${safe}`);
  socket.destroy();
}

function parseCompanyId(pathname: string) {
  const match = pathname.match(/^\/api\/companies\/([^/]+)\/events\/ws$/);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1] ?? "");
  } catch {
    return null;
  }
}

function parseBearerToken(rawAuth: string | string[] | undefined) {
  const auth = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!auth) return null;
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function headersFromIncomingMessage(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, raw] of Object.entries(req.headers)) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) headers.append(key, value);
      continue;
    }
    headers.set(key, raw);
  }
  return headers;
}

async function authorizeUpgrade(
  db: Db,
  req: IncomingMessage,
  companyId: string,
  url: URL,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
  },
): Promise<UpgradeContext | null> {
  const queryToken = url.searchParams.get("token")?.trim() ?? "";
  const authToken = parseBearerToken(req.headers.authorization);
  const token = authToken ?? (queryToken.length > 0 ? queryToken : null);

  const access = accessService(db);

  // Browser board context has no bearer token in local_trusted and authenticated modes.
  if (!token) {
    if (opts.deploymentMode === "local_trusted") {
      return {
        companyId,
        actorType: "board",
        actorId: "board",
        tagIds: new Set<string>(),
        bypassTagFilter: true,
        agentVisibilityCache: new Map(),
      };
    }

    if (opts.deploymentMode !== "authenticated" || !opts.resolveSessionFromHeaders) {
      return null;
    }

    const session = await opts.resolveSessionFromHeaders(headersFromIncomingMessage(req));
    const userId = session?.user?.id;
    if (!userId) return null;

    const [roleRow, memberships] = await Promise.all([
      db
        .select({ id: instanceUserRoles.id })
        .from(instanceUserRoles)
        .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
        .then((rows) => rows[0] ?? null),
      db
        .select({ companyId: companyMemberships.companyId })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
            eq(companyMemberships.status, "active"),
          ),
        ),
    ]);

    const hasCompanyMembership = memberships.some((row) => row.companyId === companyId);
    if (!roleRow && !hasCompanyMembership) return null;

    // WS-SEC-05: Load user's role and tags for filtering
    const isAdmin = !!roleRow;
    let bypassTagFilter = isAdmin;
    let tagIds: ReadonlySet<string> = new Set<string>();

    if (!isAdmin) {
      const role = await access.resolveRole(companyId, "user", userId);
      bypassTagFilter = role?.bypassTagFilter ?? false;
      if (!bypassTagFilter) {
        tagIds = await access.getTagIds(companyId, "user", userId);
      }
    }

    return {
      companyId,
      actorType: "board" as const,
      actorId: userId,
      tagIds,
      bypassTagFilter,
      agentVisibilityCache: new Map(),
    };
  }

  const tokenHash = hashToken(token);
  const key = await db
    .select()
    .from(agentApiKeys)
    .where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
    .then((rows) => rows[0] ?? null);

  if (!key || key.companyId !== companyId) {
    return null;
  }

  await db
    .update(agentApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentApiKeys.id, key.id));

  // WS-SEC-05: Agent actors use their own tags
  const agentTags = await access.getTagIds(companyId, "agent", key.agentId);

  return {
    companyId,
    actorType: "agent" as const,
    actorId: key.agentId,
    tagIds: agentTags,
    bypassTagFilter: false,
    agentVisibilityCache: new Map(),
  };
}

/** WS-SEC-05/10: Strip visibility before sending to client */
function sendFiltered(socket: WsSocket, event: LiveEvent, companyId: string) {
  try {
    const { visibility: _vis, ...clientEvent } = event;
    socket.send(JSON.stringify(clientEvent));
  } catch (err) {
    logger.warn({ err, companyId }, "failed to send live event to client");
  }
}

export function setupLiveEventsWebSocketServer(
  server: HttpServer,
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
  },
) {
  const wss = new WebSocketServer({ noServer: true });
  const cleanupByClient = new Map<WsSocket, () => void>();
  const aliveByClient = new Map<WsSocket, boolean>();

  const pingInterval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!aliveByClient.get(socket)) {
        socket.terminate();
        continue;
      }
      aliveByClient.set(socket, false);
      socket.ping();
    }
  }, 30000);
  pingInterval.unref();

  const cleanupSocket = (socket: WsSocket) => {
    const cleanup = cleanupByClient.get(socket);
    if (cleanup) cleanup();
    cleanupByClient.delete(socket);
    aliveByClient.delete(socket);
  };

  // WS-SEC-05: Shared agent tag cache for all connections
  const tagCache = agentTagCache(db);

  wss.on("connection", (socket: WsSocket, req: IncomingMessage) => {
    const maybeContext = (req as IncomingMessageWithContext).mnmUpgradeContext;
    if (!maybeContext) {
      socket.close(1008, "missing context");
      return;
    }
    const ctx = maybeContext; // narrowed, captured for closures

    // WS-SEC-05: Build the actor and overlap resolver for this connection
    const actor = {
      actorId: ctx.actorId,
      tagIds: ctx.tagIds,
      bypassTagFilter: ctx.bypassTagFilter,
    };

    const resolveAgentTagOverlap = (agentId: string): boolean => {
      const cached = ctx.agentVisibilityCache.get(agentId);
      if (cached !== undefined) return cached;
      // Synchronous check: we pre-warm the cache async below
      // If not cached yet, conservatively return false (will be resolved next event)
      return false;
    };

    // Async pre-warm: when we see an agent scope event, ensure cache is warm for next time
    async function warmAgentCache(agentIds: string[]) {
      for (const agentId of agentIds) {
        if (ctx.agentVisibilityCache.has(agentId)) continue;
        try {
          const agentTags = await tagCache.getAgentTags(ctx.companyId, agentId);
          let overlap = false;
          for (const tagId of agentTags) {
            if (ctx.tagIds.has(tagId)) { overlap = true; break; }
          }
          ctx.agentVisibilityCache.set(agentId, overlap);
        } catch {
          // On error, don't cache — will retry next event
        }
      }
    }

    const unsubscribe = subscribeCompanyLiveEvents(ctx.companyId, (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;

      // WS-SEC-05: Pre-warm agent cache and then filter
      const vis = event.visibility;
      if (vis.scope === "agents" && vis.agentIds.length > 0) {
        const uncached = vis.agentIds.filter((id) => !ctx.agentVisibilityCache.has(id));
        if (uncached.length > 0) {
          void warmAgentCache(vis.agentIds).then(() => {
            if (socket.readyState !== WebSocket.OPEN) return;
            if (!canReceiveEvent(event, actor, resolveAgentTagOverlap)) return;
            sendFiltered(socket, event, ctx.companyId);
          });
          return;
        }
      }

      if (!canReceiveEvent(event, actor, resolveAgentTagOverlap)) return;
      sendFiltered(socket, event, ctx.companyId);
    });

    cleanupByClient.set(socket, unsubscribe);
    aliveByClient.set(socket, true);

    socket.on("pong", () => {
      aliveByClient.set(socket, true);
    });

    socket.on("close", () => {
      cleanupSocket(socket);
    });

    socket.on("error", (err: Error) => {
      logger.warn({ err, companyId: ctx.companyId }, "live websocket client error");
      cleanupSocket(socket);
    });
  });

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url) {
      rejectUpgrade(socket, "400 Bad Request", "missing url");
      return;
    }

    const url = new URL(req.url, "http://localhost");
    const companyId = parseCompanyId(url.pathname);
    if (!companyId) {
      // Don't destroy — other WebSocket servers (e.g. chat-ws) may handle this path
      return;
    }

    void authorizeUpgrade(db, req, companyId, url, {
      deploymentMode: opts.deploymentMode,
      resolveSessionFromHeaders: opts.resolveSessionFromHeaders,
    })
      .then((context) => {
        if (!context) {
          rejectUpgrade(socket, "403 Forbidden", "forbidden");
          return;
        }

        const reqWithContext = req as IncomingMessageWithContext;
        reqWithContext.mnmUpgradeContext = context;

        wss.handleUpgrade(req, socket, head, (ws: WsSocket) => {
          wss.emit("connection", ws, reqWithContext);
        });
      })
      .catch((err) => {
        logger.error({ err, path: req.url }, "failed websocket upgrade authorization");
        rejectUpgrade(socket, "500 Internal Server Error", "upgrade failed");
      });
  });

  return wss;
}
