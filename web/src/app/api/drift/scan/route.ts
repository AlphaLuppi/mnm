import { NextRequest, NextResponse } from "next/server";
import { detectDrift } from "@/lib/drift";
import * as driftScanRepo from "@/lib/db/repositories/drift-scans";
import * as specRepo from "@/lib/db/repositories/specs";
import { DriftError, MnMError } from "@/lib/core/errors";
import { eventBus } from "@/lib/events/event-bus";

export interface ScanDriftRequest {
  specId: string;
  scope?: string[];
  inferFromSpec?: boolean;
  triggerType?: "manual" | "agent_complete" | "discovery" | "spec_save";
}

export interface ScanDriftResponse {
  scanId: string;
  detection: {
    id: string;
    severity: string;
    driftType: string;
    summary: string;
    recommendation: string;
    hasDrift: boolean;
  };
  scope: string[];
}

// POST /api/drift/scan -- trigger drift scan with scope
export async function POST(request: NextRequest) {
  const now = Date.now();
  const scanId = crypto.randomUUID();

  try {
    const body: ScanDriftRequest = await request.json();
    const { specId, scope, inferFromSpec = true, triggerType = "manual" } = body;

    if (!specId) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "specId is required" } },
        { status: 400 }
      );
    }

    // Verify spec exists
    const spec = specRepo.findById(specId);
    if (!spec) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Spec not found" } },
        { status: 404 }
      );
    }

    // Record scan start
    const finalScope = scope ?? [];
    driftScanRepo.insert({
      id: scanId,
      specId,
      scope: JSON.stringify(finalScope),
      triggerType,
      status: "running",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Run drift detection with options
    const detection = await detectDrift("manual", specId, {
      overrideScope: scope,
      inferFromSpec,
    });

    // Update scan record with result
    driftScanRepo.update(scanId, {
      status: "completed",
      driftDetectionId: detection.id,
      completedAt: Date.now(),
    });

    const hasDrift =
      detection.severity !== "minor" ||
      !detection.summary.includes("No code changes detected");

    const response: ScanDriftResponse = {
      scanId,
      detection: {
        id: detection.id,
        severity: detection.severity,
        driftType: detection.driftType,
        summary: detection.summary,
        recommendation: detection.recommendation,
        hasDrift,
      },
      scope: finalScope,
    };

    eventBus.notifyMany(["drift", "drift-status", "dashboard"]);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Update scan as failed
    driftScanRepo.update(scanId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      completedAt: Date.now(),
    });

    if (error instanceof DriftError || error instanceof MnMError) {
      return NextResponse.json(error.toJSON(), { status: 400 });
    }
    console.error("Drift scan error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Drift scan failed" } },
      { status: 500 }
    );
  }
}

// GET /api/drift/scan -- get scan history
export async function GET(request: NextRequest) {
  try {
    const specId = request.nextUrl.searchParams.get("specId");

    let scans;
    if (specId) {
      scans = driftScanRepo.findBySpec(specId);
    } else {
      scans = driftScanRepo.findAll();
    }

    return NextResponse.json(scans);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
