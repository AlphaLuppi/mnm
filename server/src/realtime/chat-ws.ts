import { createHash } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agentApiKeys, chatChannels, companyMemberships, instanceUserRoles } from "@mnm/db";
import type { DeploymentMode } from "@mnm/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger as parentLogger } from "../middleware/logger.js";
import { chatClientPayloadSchema } from "../validators/chat-ws.js";
import {
  createChatWsManager,
  type ChatWsManager,
} from "../services/chat-ws-manager.js";
import type { RedisState } from "../redis.js";

const logger = parentLogger.child({ module: "chat-ws" });

interface WsSocket {
  readyState: number;
  ping(): void;
  send(data: string): void;
  terminate(): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (data: Buffer | string) => void): void;
  on(event: "pong", listener: () => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

interface WsServer {
  clients: Set<WsSocket>;
  on(
    event: "connection",
    listener: (socket: WsSocket, req: IncomingMessage) => void,
  ): void;
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
  channelId: string;
  companyId: string;
  actorType: "user" | "agent";
  actorId: string;
  actorName?: string;
}

interface IncomingMessageWithChatContext extends IncomingMessage {
  mnmChatUpgradeContext?: UpgradeContext;
}

function parseChannelId(pathname: string): string | null {
  const match = pathname.match(/^\/ws\/chat\/([^/?]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1] ?? "");
  } catch {
    return null;
  }
}

function rejectUpgrade(
  socket: Duplex,
  statusLine: string,
  message: string,
) {
  const safe = message.replace(/[\r\n]+/g, " ").trim();
  socket.write(
    `HTTP/1.1 ${statusLine}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${safe}`,
  );
  socket.destroy();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseBearerToken(
  rawAuth: string | string[] | undefined,
): string | null {
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

async function authorizeChatUpgrade(
  db: Db,
  req: IncomingMessage,
  channelId: string,
  url: URL,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (
      headers: Headers,
    ) => Promise<BetterAuthSessionResult | null>;
  },
): Promise<
  | { ok: true; context: UpgradeContext }
  | { ok: false; statusLine: string; message: string }
> {
  // 1. Verify channel exists and is open
  const channel = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId))
    .then((rows) => rows[0] ?? null);

  if (!channel) {
    return { ok: false, statusLine: "404 Not Found", message: "Channel not found" };
  }

  if (channel.status === "closed") {
    return { ok: false, statusLine: "410 Gone", message: "Channel is closed" };
  }

  const companyId = channel.companyId;

  // 2. Authenticate the actor
  const queryToken = url.searchParams.get("token")?.trim() ?? "";
  const authToken = parseBearerToken(req.headers.authorization);
  const token = authToken ?? (queryToken.length > 0 ? queryToken : null);

  if (!token) {
    // No token: local_trusted or session-based auth
    if (opts.deploymentMode === "local_trusted") {
      return {
        ok: true,
        context: {
          channelId,
          companyId,
          actorType: "user",
          actorId: "board",
          actorName: "Local Board",
        },
      };
    }

    if (
      opts.deploymentMode !== "authenticated" ||
      !opts.resolveSessionFromHeaders
    ) {
      return {
        ok: false,
        statusLine: "403 Forbidden",
        message: "Authentication required",
      };
    }

    const session = await opts.resolveSessionFromHeaders(
      headersFromIncomingMessage(req),
    );
    const userId = session?.user?.id;
    if (!userId) {
      return {
        ok: false,
        statusLine: "403 Forbidden",
        message: "Authentication required",
      };
    }

    // Check company membership or instance admin
    const [roleRow, memberships] = await Promise.all([
      db
        .select({ id: instanceUserRoles.id })
        .from(instanceUserRoles)
        .where(
          and(
            eq(instanceUserRoles.userId, userId),
            eq(instanceUserRoles.role, "instance_admin"),
          ),
        )
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

    const hasCompanyMembership = memberships.some(
      (row) => row.companyId === companyId,
    );
    if (!roleRow && !hasCompanyMembership) {
      return {
        ok: false,
        statusLine: "403 Forbidden",
        message: "No access to this company",
      };
    }

    return {
      ok: true,
      context: {
        channelId,
        companyId,
        actorType: "user",
        actorId: userId,
        actorName: session?.user?.name ?? undefined,
      },
    };
  }

  // Token-based: agent API key
  const tokenHash = hashToken(token);
  const key = await db
    .select()
    .from(agentApiKeys)
    .where(
      and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)),
    )
    .then((rows) => rows[0] ?? null);

  if (!key || key.companyId !== companyId) {
    return {
      ok: false,
      statusLine: "403 Forbidden",
      message: "Invalid or unauthorized API key",
    };
  }

  // Update last used
  await db
    .update(agentApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentApiKeys.id, key.id));

  return {
    ok: true,
    context: {
      channelId,
      companyId,
      actorType: "agent",
      actorId: key.agentId,
    },
  };
}

export function setupChatWebSocketServer(
  server: HttpServer,
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (
      headers: Headers,
    ) => Promise<BetterAuthSessionResult | null>;
    redisState?: RedisState | null;
  },
): { wss: WsServer; manager: ChatWsManager } {
  const wss = new WebSocketServer({ noServer: true });
  const aliveByClient = new Map<WsSocket, boolean>();

  const manager = createChatWsManager({
    db,
    redisState: opts.redisState,
  });

  // Heartbeat ping every 30s
  const pingInterval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!aliveByClient.get(socket)) {
        socket.terminate();
        continue;
      }
      aliveByClient.set(socket, false);
      socket.ping();
    }
  }, 30_000);

  wss.on("connection", (socket: WsSocket, req: IncomingMessage) => {
    const context = (req as IncomingMessageWithChatContext)
      .mnmChatUpgradeContext;
    if (!context) {
      socket.close(1008, "missing context");
      return;
    }

    const { channelId, companyId, actorId, actorType, actorName } = context;

    // Register connection
    void manager.addConnection(channelId, socket, actorId, actorType, actorName);
    aliveByClient.set(socket, true);

    socket.on("pong", () => {
      aliveByClient.set(socket, true);
    });

    socket.on("message", (data: Buffer | string) => {
      const raw = typeof data === "string" ? data : data.toString("utf8");

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        try {
          socket.send(
            JSON.stringify({
              type: "error",
              code: "INVALID_MESSAGE",
              message: "Invalid JSON",
            }),
          );
        } catch {
          // ignore
        }
        return;
      }

      // Validate payload
      const result = chatClientPayloadSchema.safeParse(parsed);
      if (!result.success) {
        const firstError = result.error.issues[0];
        let code: "INVALID_MESSAGE" | "MESSAGE_TOO_LONG" = "INVALID_MESSAGE";
        let message = "Invalid message format";

        // Detect content-length issue for better error code
        if (
          firstError &&
          firstError.path.includes("content") &&
          firstError.code === "too_big"
        ) {
          code = "MESSAGE_TOO_LONG";
          message = "Content must be between 1 and 4096 characters";
        } else if (
          firstError &&
          firstError.path.includes("content") &&
          firstError.code === "too_small"
        ) {
          message = "Content must be between 1 and 4096 characters";
        }

        try {
          socket.send(JSON.stringify({ type: "error", code, message }));
        } catch {
          // ignore
        }
        return;
      }

      void manager
        .handleMessage(
          channelId,
          socket,
          actorId,
          actorType,
          actorName,
          companyId,
          result.data,
        )
        .catch((err) => {
          logger.error(
            { err, channelId, actorId },
            "Error handling chat message",
          );
          try {
            socket.send(
              JSON.stringify({
                type: "error",
                code: "INVALID_MESSAGE",
                message: "Internal error processing message",
              }),
            );
          } catch {
            // ignore
          }
        });
    });

    socket.on("close", () => {
      manager.removeConnection(channelId, socket);
      aliveByClient.delete(socket);
    });

    socket.on("error", (err: Error) => {
      logger.warn(
        { err, channelId, actorId },
        "Chat WebSocket client error",
      );
    });
  });

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  // Register upgrade handler for /ws/chat/:channelId
  server.on("upgrade", (req, socket, head) => {
    if (!req.url) return; // let other handlers deal with it

    const url = new URL(req.url, "http://localhost");
    const channelId = parseChannelId(url.pathname);
    if (!channelId) {
      // Not our path — don't touch the socket (let live-events-ws or others handle it)
      return;
    }

    void authorizeChatUpgrade(db, req, channelId, url, {
      deploymentMode: opts.deploymentMode,
      resolveSessionFromHeaders: opts.resolveSessionFromHeaders,
    })
      .then((authResult) => {
        if (!authResult.ok) {
          rejectUpgrade(socket, authResult.statusLine, authResult.message);
          return;
        }

        const reqWithContext = req as IncomingMessageWithChatContext;
        reqWithContext.mnmChatUpgradeContext = authResult.context;

        wss.handleUpgrade(req, socket, head, (ws: WsSocket) => {
          wss.emit("connection", ws, reqWithContext);
        });
      })
      .catch((err) => {
        logger.error(
          { err, path: req.url },
          "Failed chat WebSocket upgrade authorization",
        );
        rejectUpgrade(socket, "500 Internal Server Error", "upgrade failed");
      });
  });

  return { wss, manager };
}
