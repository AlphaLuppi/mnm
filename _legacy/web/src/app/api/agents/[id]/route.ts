import { NextResponse } from "next/server";
import { getOrchestrator } from "@/lib/agent";
import { AgentError, LockConflictError, MnMError } from "@/lib/core/errors";
import { eventBus } from "@/lib/events/event-bus";

// GET /api/agents/[id] -- get agent detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = getOrchestrator().getStatus(id);
    if (!agent) {
      return NextResponse.json(
        { error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } },
        { status: 404 }
      );
    }
    return NextResponse.json(agent);
  } catch (error) {
    return handleError(error);
  }
}

// PATCH /api/agents/[id] -- pause/resume/terminate
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await request.json();
    const orchestrator = getOrchestrator();

    switch (action) {
      case "pause":
        orchestrator.pause(id);
        break;
      case "resume":
        orchestrator.resume(id);
        break;
      case "terminate":
        orchestrator.terminate(id);
        break;
      default:
        return NextResponse.json(
          {
            error: {
              code: "INVALID_ACTION",
              message: `Unknown action: ${action}`,
            },
          },
          { status: 400 }
        );
    }

    const agent = orchestrator.getStatus(id);
    eventBus.notifyMany(["agents", "dashboard"]);
    return NextResponse.json(agent);
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/agents/[id] -- terminate and cleanup
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    getOrchestrator().terminate(id);
    eventBus.notifyMany(["agents", "dashboard"]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown): NextResponse {
  if (error instanceof LockConflictError) {
    return NextResponse.json(error.toJSON(), { status: 409 });
  }
  if (error instanceof AgentError) {
    return NextResponse.json(error.toJSON(), { status: 400 });
  }
  if (error instanceof MnMError) {
    return NextResponse.json(error.toJSON(), { status: 400 });
  }
  console.error("Unexpected error:", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
