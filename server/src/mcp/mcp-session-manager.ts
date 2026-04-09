import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { logger } from "../middleware/logger.js";

export type McpTransport = StreamableHTTPServerTransport | SSEServerTransport;

export interface McpSession {
  transport: McpTransport;
  sessionId: string;
  actorType: "user" | "agent";
  actorId: string;
  lastActivity: number;
  createdAt: number;
}

export class McpSessionManager {
  private sessions = new Map<string, McpSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private maxSessions: number;
  private humanTimeoutMs: number;
  private agentTimeoutMs: number;

  constructor(options?: {
    maxSessions?: number;
    humanTimeoutMs?: number;
    agentTimeoutMs?: number;
  }) {
    this.maxSessions = options?.maxSessions ?? 100;
    this.humanTimeoutMs = options?.humanTimeoutMs ?? 30 * 60 * 1000; // 30 min
    this.agentTimeoutMs = options?.agentTimeoutMs ?? 2 * 60 * 60 * 1000; // 2h
  }

  start() {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    // Allow the process to exit even if interval is active
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
    logger.info({ maxSessions: this.maxSessions }, "mcp.session-manager.started");
  }

  createSession(
    sessionId: string,
    transport: McpTransport,
    actorType: "user" | "agent",
    actorId: string,
  ): boolean {
    if (this.sessions.size >= this.maxSessions) {
      logger.warn(
        { maxSessions: this.maxSessions, activeCount: this.sessions.size },
        "mcp.session-manager.limit-reached",
      );
      return false;
    }

    const now = Date.now();
    this.sessions.set(sessionId, {
      transport,
      sessionId,
      actorType,
      actorId,
      lastActivity: now,
      createdAt: now,
    });

    logger.debug({ sessionId, actorType, activeCount: this.sessions.size }, "mcp.session.created");
    return true;
  }

  getSession(sessionId: string): McpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    session.transport.close().catch((err) => {
      logger.warn({ sessionId, err }, "mcp.session.close-error");
    });

    logger.debug({ sessionId, activeCount: this.sessions.size }, "mcp.session.removed");
  }

  private cleanup() {
    const now = Date.now();
    let expired = 0;

    for (const [sessionId, session] of this.sessions) {
      const timeoutMs = session.actorType === "agent" ? this.agentTimeoutMs : this.humanTimeoutMs;
      const idleMs = now - session.lastActivity;

      if (idleMs > timeoutMs) {
        this.removeSession(sessionId);
        expired++;
      }
    }

    if (expired > 0) {
      logger.info({ expired, remaining: this.sessions.size }, "mcp.session-manager.cleanup");
    }
  }

  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const [sessionId, session] of this.sessions) {
      closePromises.push(
        session.transport.close().catch((err) => {
          logger.warn({ sessionId, err }, "mcp.session.shutdown-close-error");
        }),
      );
    }

    await Promise.allSettled(closePromises);
    this.sessions.clear();
    logger.info("mcp.session-manager.shutdown");
  }

  get activeCount(): number {
    return this.sessions.size;
  }
}
