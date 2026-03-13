import { NextRequest, NextResponse } from "next/server";
import * as driftRepo from "@/lib/db/repositories/drift";
import { detectDrift } from "@/lib/drift";
import { DriftError, MnMError } from "@/lib/core/errors";
import { eventBus } from "@/lib/events/event-bus";

// GET /api/drift -- list drift detections
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const specId = request.nextUrl.searchParams.get("specId");
    const agentId = request.nextUrl.searchParams.get("agentId");

    let results;
    if (status === "pending") {
      results = driftRepo.findPending();
    } else if (specId) {
      results = driftRepo.findBySpec(specId);
    } else if (agentId) {
      results = driftRepo.findByAgent(agentId);
    } else {
      results = driftRepo.findAll();
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

// POST /api/drift -- trigger manual drift detection
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { specId, agentId } = body;

    if (!specId) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "specId is required" } },
        { status: 400 }
      );
    }

    const detection = await detectDrift(agentId ?? "manual", specId);
    eventBus.notifyMany(["drift", "drift-status", "dashboard"]);
    return NextResponse.json(detection, { status: 201 });
  } catch (error) {
    if (error instanceof DriftError) {
      return NextResponse.json(error.toJSON(), { status: 400 });
    }
    if (error instanceof MnMError) {
      return NextResponse.json(error.toJSON(), { status: 400 });
    }
    console.error("Drift detection error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Drift detection failed" } },
      { status: 500 }
    );
  }
}
