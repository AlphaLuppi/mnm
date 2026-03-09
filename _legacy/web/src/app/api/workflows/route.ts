import { NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import * as workflowRepo from "@/lib/db/repositories/workflows";
import { handleApiError } from "@/lib/core/api-error-handler";

export async function GET() {
  try {
    await ensureBootstrapped();
    const workflows = workflowRepo.findAll();
    return NextResponse.json({ workflows });
  } catch (err) {
    return handleApiError(err);
  }
}
