import { EventEmitter } from "node:events";
import type { Db } from "@mnm/db";
import type {
  ChatClientPayload,
  ChatServerMessage,
  ChatServerPayload,
} from "@mnm/shared";
import type { RedisState } from "../redis.js";
import { logger as parentLogger } from "../middleware/logger.js";
import { chatService } from "./chat.js";

const logger = parentLogger.child({ module: "chat-ws-manager" });

interface WsSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface ConnectionInfo {
  socket: WsSocket;
  actorId: string;
  actorType: "user" | "agent";
  actorName?: string;
}

interface BufferEntry {
  message: ChatServerMessage;
  timestamp: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WS_OPEN = 1;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const BUFFER_TTL_MS = 30_000;
const BUFFER_MAX_SIZE = 100;
const TYPING_AUTO_CLEAR_MS = 15_000;

export interface ChatWsManagerOptions {
  db: Db;
  redisState?: RedisState | null;
}

export function createChatWsManager(opts: ChatWsManagerOptions) {
  const { db, redisState } = opts;
  const svc = chatService(db);

  // channelId -> Set of connections
  const channelConnections = new Map<string, Set<ConnectionInfo>>();

  // channelId -> recent messages buffer
  const channelBuffers = new Map<string, BufferEntry[]>();

  // Rate limit: "userId:channelId" -> entry
  const rateLimitStore = new Map<string, RateLimitEntry>();

  // Typing auto-clear timers: "senderId:channelId" -> timeout
  const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Local EventEmitter fallback for cross-channel pub/sub
  const localEmitter = new EventEmitter();
  localEmitter.setMaxListeners(0);

  // Redis pub/sub clients
  let redisSub: import("ioredis").Redis | null = null;
  let redisPub: import("ioredis").Redis | null = null;
  const subscribedChannels = new Set<string>();
  let redisErrorLogged = false;

  function initRedis() {
    if (!redisState?.client || !redisState.connected) return;

    try {
      // Duplicate the client for subscriber mode
      redisSub = redisState.client.duplicate();
      redisPub = redisState.client;

      redisSub.on("message", (redisChannel: string, data: string) => {
        // redisChannel = "chat:<channelId>"
        const channelId = redisChannel.replace("chat:", "");
        try {
          const payload = JSON.parse(data) as {
            message: ChatServerPayload;
            fromInstanceId: string;
          };
          // Only relay messages from OTHER instances
          if (payload.fromInstanceId === instanceId) return;
          broadcastLocal(channelId, payload.message);
        } catch {
          logger.warn({ redisChannel }, "Failed to parse Redis chat message");
        }
      });

      redisSub.on("error", (err: Error) => {
        if (!redisErrorLogged) {
          logger.warn({ err }, "Redis subscriber error");
          redisErrorLogged = true;
        }
      });
    } catch (err) {
      logger.warn({ err }, "Failed to initialize Redis pub/sub for chat");
    }
  }

  const instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Periodic cleanup of expired rate limit entries and buffers
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
    // Evict old buffer entries
    for (const [channelId, buffer] of channelBuffers) {
      const filtered = buffer.filter((e) => now - e.timestamp < BUFFER_TTL_MS);
      if (filtered.length === 0) {
        channelBuffers.delete(channelId);
      } else {
        channelBuffers.set(channelId, filtered);
      }
    }
  }, 30_000);
  cleanupInterval.unref();

  function broadcastLocal(
    channelId: string,
    payload: ChatServerPayload,
    excludeSocket?: WsSocket,
  ) {
    const conns = channelConnections.get(channelId);
    if (!conns) return;

    const data = JSON.stringify(payload);
    for (const conn of conns) {
      if (conn.socket === excludeSocket) continue;
      if (conn.socket.readyState !== WS_OPEN) continue;
      try {
        conn.socket.send(data);
      } catch {
        // ignore send errors
      }
    }
  }

  function sendTo(socket: WsSocket, payload: ChatServerPayload) {
    if (socket.readyState !== WS_OPEN) return;
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  async function publishToRedis(
    channelId: string,
    message: ChatServerPayload,
  ) {
    if (!redisPub || !redisState?.connected) return;
    try {
      await redisPub.publish(
        `chat:${channelId}`,
        JSON.stringify({ message, fromInstanceId: instanceId }),
      );
    } catch {
      // Redis unavailable, local-only is fine
    }
  }

  async function subscribeRedisChannel(channelId: string) {
    if (!redisSub || subscribedChannels.has(channelId)) return;
    try {
      await redisSub.subscribe(`chat:${channelId}`);
      subscribedChannels.add(channelId);
    } catch {
      // ignore
    }
  }

  async function unsubscribeRedisChannel(channelId: string) {
    if (!redisSub || !subscribedChannels.has(channelId)) return;
    try {
      await redisSub.unsubscribe(`chat:${channelId}`);
      subscribedChannels.delete(channelId);
    } catch {
      // ignore
    }
  }

  function addToBuffer(channelId: string, message: ChatServerMessage) {
    let buffer = channelBuffers.get(channelId);
    if (!buffer) {
      buffer = [];
      channelBuffers.set(channelId, buffer);
    }
    buffer.push({ message, timestamp: Date.now() });
    // Evict oldest if over max
    while (buffer.length > BUFFER_MAX_SIZE) {
      buffer.shift();
    }
  }

  function checkRateLimit(
    actorId: string,
    channelId: string,
  ): { allowed: boolean; retryAfter?: number } {
    const key = `${actorId}:${channelId}`;
    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      rateLimitStore.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return { allowed: false, retryAfter };
    }
    return { allowed: true };
  }

  function clearTypingTimer(senderId: string, channelId: string) {
    const key = `${senderId}:${channelId}`;
    const timer = typingTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }

  // Initialize Redis if available
  initRedis();

  return {
    async addConnection(
      channelId: string,
      socket: WsSocket,
      actorId: string,
      actorType: "user" | "agent",
      actorName?: string,
    ) {
      let conns = channelConnections.get(channelId);
      if (!conns) {
        conns = new Set();
        channelConnections.set(channelId, conns);
        await subscribeRedisChannel(channelId);
      }
      conns.add({ socket, actorId, actorType, actorName });
    },

    removeConnection(channelId: string, socket: WsSocket) {
      const conns = channelConnections.get(channelId);
      if (!conns) return;

      let removedActorId: string | undefined;
      for (const conn of conns) {
        if (conn.socket === socket) {
          removedActorId = conn.actorId;
          conns.delete(conn);
          break;
        }
      }

      // Auto-clear typing indicator on disconnect
      if (removedActorId) {
        clearTypingTimer(removedActorId, channelId);
      }

      if (conns.size === 0) {
        channelConnections.delete(channelId);
        void unsubscribeRedisChannel(channelId);
      }
    },

    async handleMessage(
      channelId: string,
      socket: WsSocket,
      actorId: string,
      actorType: "user" | "agent",
      actorName: string | undefined,
      companyId: string,
      payload: ChatClientPayload,
    ) {
      switch (payload.type) {
        case "ping": {
          sendTo(socket, { type: "pong" });
          return;
        }

        case "typing_start":
        case "typing_stop": {
          const isTyping = payload.type === "typing_start";
          const indicator = {
            type: "typing_indicator" as const,
            senderId: actorId,
            senderType: actorType,
            senderName: actorName,
            isTyping,
          };

          // Auto-clear typing after 15s if no typing_stop
          clearTypingTimer(actorId, channelId);
          if (isTyping) {
            const timer = setTimeout(() => {
              broadcastLocal(
                channelId,
                {
                  type: "typing_indicator",
                  senderId: actorId,
                  senderType: actorType,
                  senderName: actorName,
                  isTyping: false,
                },
                socket,
              );
              typingTimers.delete(`${actorId}:${channelId}`);
            }, TYPING_AUTO_CLEAR_MS);
            typingTimers.set(`${actorId}:${channelId}`, timer);
          }

          // Broadcast to others (no loop-back)
          broadcastLocal(channelId, indicator, socket);
          await publishToRedis(channelId, indicator);
          return;
        }

        case "sync_request": {
          await this.handleSyncRequest(channelId, socket, payload.lastMessageId);
          return;
        }

        case "chat_message": {
          // Rate limit check
          const rl = checkRateLimit(actorId, channelId);
          if (!rl.allowed) {
            sendTo(socket, {
              type: "error",
              code: "RATE_LIMITED",
              message: "Rate limit exceeded (10/min)",
              retryAfter: rl.retryAfter,
            });
            return;
          }

          // Persist the message
          const dbMessage = await svc.createMessage(
            channelId,
            companyId,
            actorId,
            actorType,
            payload.content,
            payload.metadata,
          );

          const serverMessage: ChatServerMessage = {
            type: "chat_message",
            id: dbMessage.id,
            channelId,
            senderId: actorId,
            senderType: actorType,
            senderName: actorName,
            content: payload.content,
            metadata: payload.metadata,
            createdAt: dbMessage.createdAt.toISOString(),
          };

          // Add to reconnection buffer
          addToBuffer(channelId, serverMessage);

          // Send ack to sender
          if (payload.clientMessageId) {
            sendTo(socket, {
              type: "message_ack",
              clientMessageId: payload.clientMessageId,
              messageId: dbMessage.id,
              createdAt: dbMessage.createdAt.toISOString(),
            });
          }

          // Broadcast to other local clients (exclude sender)
          broadcastLocal(channelId, serverMessage, socket);

          // Publish to Redis for cross-instance distribution
          await publishToRedis(channelId, serverMessage);
          return;
        }
      }
    },

    async handleSyncRequest(
      channelId: string,
      socket: WsSocket,
      lastMessageId: string,
    ) {
      // First try buffer
      const buffer = channelBuffers.get(channelId);
      if (buffer) {
        const idx = buffer.findIndex((e) => e.message.id === lastMessageId);
        if (idx !== -1 && idx < buffer.length - 1) {
          const missed = buffer.slice(idx + 1).map((e) => e.message);
          sendTo(socket, {
            type: "sync_response",
            messages: missed,
            hasMore: false,
          });
          return;
        }
      }

      // Fallback to DB
      const SYNC_LIMIT = 100;
      const messages = await svc.getMessagesSince(
        channelId,
        lastMessageId,
        SYNC_LIMIT + 1,
      );

      const hasMore = messages.length > SYNC_LIMIT;
      const limited = hasMore ? messages.slice(0, SYNC_LIMIT) : messages;

      const serverMessages: ChatServerMessage[] = limited.map((m) => ({
        type: "chat_message",
        id: m.id,
        channelId: m.channelId,
        senderId: m.senderId,
        senderType: m.senderType as "user" | "agent",
        content: m.content,
        metadata: m.metadata ?? undefined,
        createdAt: m.createdAt.toISOString(),
      }));

      sendTo(socket, {
        type: "sync_response",
        messages: serverMessages,
        hasMore,
      });
    },

    async closeChannel(
      channelId: string,
      reason: "agent_terminated" | "manual_close" | "timeout",
    ) {
      // Notify all connected clients
      const closePayload: ChatServerPayload = {
        type: "channel_closed",
        channelId,
        reason,
      };

      broadcastLocal(channelId, closePayload);
      await publishToRedis(channelId, closePayload);

      // Close all WebSocket connections for this channel
      const conns = channelConnections.get(channelId);
      if (conns) {
        for (const conn of conns) {
          try {
            conn.socket.close(1000, "Channel closed");
          } catch {
            // ignore
          }
        }
        channelConnections.delete(channelId);
      }

      // Update DB
      await svc.closeChannel(channelId, reason);

      // Cleanup
      channelBuffers.delete(channelId);
      void unsubscribeRedisChannel(channelId);
    },

    getConnectionCount(channelId: string): number {
      return channelConnections.get(channelId)?.size ?? 0;
    },
  };
}

export type ChatWsManager = ReturnType<typeof createChatWsManager>;
