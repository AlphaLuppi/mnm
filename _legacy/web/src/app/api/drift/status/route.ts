import { NextResponse } from "next/server";
import * as driftScanRepo from "@/lib/db/repositories/drift-scans";
import * as driftRepo from "@/lib/db/repositories/drift";

export interface DriftStatusResponse {
  lastScanAt: number | null;
  lastScanStatus: string | null;
  totalScans: number;
  pendingDriftCount: number;
}

// GET /api/drift/status -- get drift detection status
export async function GET() {
  try {
    const latestScan = driftScanRepo.findLatest();
    const allScans = driftScanRepo.findAll();
    const pendingDrifts = driftRepo.findPending();

    const response: DriftStatusResponse = {
      lastScanAt: latestScan?.completedAt ?? latestScan?.startedAt ?? null,
      lastScanStatus: latestScan?.status ?? null,
      totalScans: allScans.length,
      pendingDriftCount: pendingDrifts.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
