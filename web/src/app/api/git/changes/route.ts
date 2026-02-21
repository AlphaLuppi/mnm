import { NextRequest, NextResponse } from "next/server";
import * as specChangesRepo from "@/lib/db/repositories/spec-changes";
import { runChangeDetection } from "@/lib/git/change-detector";
import { eventBus } from "@/lib/events/event-bus";

export async function GET(request: NextRequest) {
  try {
    const viewed = request.nextUrl.searchParams.get("viewed");

    let changes;
    if (viewed === "false") {
      changes = specChangesRepo.findUnviewed();
    } else {
      changes = specChangesRepo.findAll();
    }

    return NextResponse.json({ changes });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await runChangeDetection();
    eventBus.notifyMany(["git", "dashboard"]);
    return NextResponse.json({
      headChanged: result.headChanged,
      changesDetected: result.changes.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DETECTION_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
