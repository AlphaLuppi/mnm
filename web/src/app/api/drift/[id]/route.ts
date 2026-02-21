import { NextResponse } from "next/server";
import * as driftRepo from "@/lib/db/repositories/drift";
import { eventBus } from "@/lib/events/event-bus";

// GET /api/drift/[id] -- get single drift detection
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const results = driftRepo.findAll();
  const detection = results.find((d) => d.id === id);

  if (!detection) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `Drift detection not found: ${id}` } },
      { status: 404 }
    );
  }

  return NextResponse.json(detection);
}

// PATCH /api/drift/[id] -- update drift decision
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, taskTitle, notes } = body;

    if (decision !== "accepted" && decision !== "rejected") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_DECISION",
            message: 'Decision must be "accepted" or "rejected"',
          },
        },
        { status: 400 }
      );
    }

    const updated = driftRepo.update(id, {
      userDecision: decision,
      decidedAt: Date.now(),
      // Store remediation notes in recommendation field for rejected drifts
      ...(decision === "rejected" && taskTitle
        ? { recommendation: `[REMEDIATION] ${taskTitle}${notes ? ": " + notes : ""}` }
        : {}),
    });

    if (!updated) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Drift detection not found: ${id}` } },
        { status: 404 }
      );
    }

    eventBus.notifyMany(["drift", "drift-status", "dashboard"]);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update drift error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update drift detection" } },
      { status: 500 }
    );
  }
}
