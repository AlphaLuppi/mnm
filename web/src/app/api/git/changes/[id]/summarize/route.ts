import { NextRequest, NextResponse } from "next/server";
import { summarizeChangeById } from "@/lib/git/change-summarizer";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const summary = await summarizeChangeById(id);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SUMMARIZE_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
