import { eventBus } from "@/lib/events/event-bus";
import type { EventChannel } from "@/lib/events/event-bus";

interface SSEEvent {
  channel: EventChannel;
  detail?: string;
  timestamp: number;
}

/**
 * Single SSE endpoint that streams all server-side state change notifications.
 * Clients connect once and receive lightweight invalidation events.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat so the client knows the connection is live
      controller.enqueue(encoder.encode(": connected\n\n"));

      function onEvent(event: SSEEvent) {
        try {
          const data = JSON.stringify({
            channel: event.channel,
            detail: event.detail,
            ts: event.timestamp,
          });
          controller.enqueue(encoder.encode(`event: ${event.channel}\ndata: ${data}\n\n`));
        } catch {
          // Stream closed, will be cleaned up by abort handler
        }
      }

      // Heartbeat every 30s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      eventBus.on("event", onEvent);

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        eventBus.off("event", onEvent);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
