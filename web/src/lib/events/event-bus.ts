import { EventEmitter } from "events";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "event-bus" });

/**
 * Server-side event channels that the frontend can subscribe to.
 * Each channel maps to one or more SWR cache keys that should be invalidated.
 */
export type EventChannel =
  | "tasks"
  | "agents"
  | "drift"
  | "drift-status"
  | "cross-doc-drift"
  | "dashboard"
  | "workflows"
  | "discovery"
  | "projects";

/**
 * Global singleton event bus for server → client push notifications.
 * API routes emit events here; the SSE endpoint streams them to clients.
 */
class ServerEventBus extends EventEmitter {
  private static instance: ServerEventBus;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE clients
  }

  static getInstance(): ServerEventBus {
    if (!ServerEventBus.instance) {
      ServerEventBus.instance = new ServerEventBus();
    }
    return ServerEventBus.instance;
  }

  /**
   * Emit an invalidation event for a channel.
   * Connected SSE clients will receive this and refetch their data.
   */
  notify(channel: EventChannel, detail?: string): void {
    log.debug({ channel, detail }, "Event emitted");
    this.emit("event", { channel, detail, timestamp: Date.now() });
  }

  /**
   * Emit invalidation events for multiple channels at once.
   */
  notifyMany(channels: EventChannel[], detail?: string): void {
    for (const channel of channels) {
      this.notify(channel, detail);
    }
  }
}

// Module-level singleton — survives across API route invocations in the same process
export const eventBus = ServerEventBus.getInstance();
