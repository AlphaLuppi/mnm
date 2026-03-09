import { NextRequest, NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import * as workflowRepo from "@/lib/db/repositories/workflows";
import { handleApiError } from "@/lib/core/api-error-handler";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureBootstrapped();

    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: { code: "INVALID_ID", message: "Workflow ID must be a number" } },
        { status: 400 }
      );
    }

    const workflow = workflowRepo.findById(numericId);

    if (!workflow) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Workflow ${id} not found` } },
        { status: 404 }
      );
    }

    // Parse JSON fields for the response
    const steps = workflow.stepsJson ? JSON.parse(workflow.stepsJson) : [];
    const metadata = workflow.metadata ? JSON.parse(workflow.metadata) : {};

    return NextResponse.json({
      workflow: {
        ...workflow,
        steps,
        parsedMetadata: metadata,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
