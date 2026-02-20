import { NextResponse } from "next/server";
import { getOrchestrator } from "@/lib/agent";

// GET /api/agents/locks -- list active file locks
export async function GET() {
  try {
    const locks = getOrchestrator().fileLockManager.getActiveLocks();
    return NextResponse.json(locks);
  } catch (error) {
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
}
