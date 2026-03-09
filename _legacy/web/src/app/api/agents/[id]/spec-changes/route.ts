import { NextRequest, NextResponse } from "next/server";
import * as agentsRepo from "@/lib/db/repositories/agents";
import * as specChangesRepo from "@/lib/db/repositories/spec-changes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = agentsRepo.findById(id);

    if (!agent) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Agent not found" } },
        { status: 404 }
      );
    }

    if (!agent.specId) {
      return NextResponse.json({ changes: [] });
    }

    // Find spec changes for files associated with the agent's spec
    const allChanges = specChangesRepo.findUnviewed();
    // In a full implementation, we'd match spec ID to file path through the specs table
    // For now, return all unviewed changes as potentially relevant
    return NextResponse.json({ changes: allChanges, agentId: id });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
