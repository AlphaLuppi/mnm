import { NextRequest, NextResponse } from "next/server";
import * as specChangesRepo from "@/lib/db/repositories/spec-changes";
import { eventBus } from "@/lib/events/event-bus";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    specChangesRepo.markViewed(id);
    eventBus.notify("git");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
