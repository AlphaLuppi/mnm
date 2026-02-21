import { NextResponse } from "next/server";
import { getOrchestrator } from "@/lib/agent";
import { AgentError, LockConflictError, MnMError } from "@/lib/core/errors";
import { eventBus } from "@/lib/events/event-bus";

// GET /api/agents -- list all agents
export async function GET() {
  try {
    const agents = getOrchestrator().list();
    return NextResponse.json(agents);
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/agents -- spawn a new agent
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { specId, agentType, scope } = body;

    if (!specId || !agentType || !Array.isArray(scope) || scope.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message:
              "Missing required fields: specId, agentType, and scope (non-empty array)",
          },
        },
        { status: 400 }
      );
    }

    const agent = getOrchestrator().spawn(specId, agentType, scope);
    eventBus.notifyMany(["agents", "dashboard"]);
    return NextResponse.json(agent, { status: 201 });
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
