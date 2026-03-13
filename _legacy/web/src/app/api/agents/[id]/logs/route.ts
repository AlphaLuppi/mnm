import { getOrchestrator } from "@/lib/agent";

// GET /api/agents/[id]/logs -- SSE stream for agent logs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orchestrator = getOrchestrator();
  const bridge = orchestrator.getProcess(id);

  if (!bridge) {
    return Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Agent not found or not running",
        },
      },
      { status: 404 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (type: string, content: string) => {
        try {
          const data = JSON.stringify({ type, content, timestamp: Date.now() });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Controller may be closed
        }
      };

      const onStdout = (chunk: Buffer) => {
        sendEvent("stdout", chunk.toString());
      };

      const onStderr = (chunk: Buffer) => {
        sendEvent("stderr", chunk.toString());
      };

      const onClose = (code: number | null) => {
        try {
          sendEvent("exit", JSON.stringify({ code }));
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };

      bridge.stdout?.on("data", onStdout);
      bridge.stderr?.on("data", onStderr);
      bridge.process.on("close", onClose);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        bridge.stdout?.off("data", onStdout);
        bridge.stderr?.off("data", onStderr);
        bridge.process.off("close", onClose);
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
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
