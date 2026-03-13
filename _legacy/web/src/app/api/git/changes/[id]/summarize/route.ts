import { NextRequest, NextResponse } from "next/server";
import { summarizeChangeById } from "@/lib/git/change-summarizer";
import { eventBus } from "@/lib/events/event-bus";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const summary = await summarizeChangeById(id);
    eventBus.notify("git");
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SUMMARIZE_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
