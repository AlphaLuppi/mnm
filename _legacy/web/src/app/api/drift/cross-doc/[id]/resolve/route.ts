import { NextRequest, NextResponse } from "next/server";
import * as crossDocDriftRepo from "@/lib/db/repositories/cross-doc-drifts";
import { createChildLogger } from "@/lib/core/logger";
import { eventBus } from "@/lib/events/event-bus";

const log = createChildLogger({ module: "api-cross-doc-resolve" });

/**
 * POST /api/drift/cross-doc/[id]/resolve - Resolve a cross-doc drift alert
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, rationale } = body as {
      status: "resolved" | "dismissed";
      rationale?: string;
    };

    if (status !== "resolved" && status !== "dismissed") {
      return NextResponse.json(
        { error: 'Status must be "resolved" or "dismissed"' },
        { status: 400 }
      );
    }

    const driftId = parseInt(id, 10);
    if (isNaN(driftId)) {
      return NextResponse.json({ error: "Invalid drift ID" }, { status: 400 });
    }

    const existing = crossDocDriftRepo.findById(driftId);
    if (!existing) {
      return NextResponse.json(
        { error: "Drift not found" },
        { status: 404 }
      );
    }

    const updated = crossDocDriftRepo.resolve(driftId, status, rationale);

    log.info({ driftId, status }, "Cross-doc drift resolved");
    eventBus.notifyMany(["cross-doc-drift", "dashboard"]);

    return NextResponse.json({ success: true, drift: updated });
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Failed to resolve cross-doc drift"
    );
    return NextResponse.json(
      { error: "Failed to resolve drift" },
      { status: 500 }
    );
  }
}
