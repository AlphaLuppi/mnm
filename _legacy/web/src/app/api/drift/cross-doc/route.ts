import { NextResponse } from "next/server";
import * as crossDocDriftRepo from "@/lib/db/repositories/cross-doc-drifts";
import { detectCrossDocDrift } from "@/lib/drift/cross-doc-detector";
import { createChildLogger } from "@/lib/core/logger";
import { eventBus } from "@/lib/events/event-bus";

const log = createChildLogger({ module: "api-cross-doc-drift" });

/**
 * GET /api/drift/cross-doc - Fetch all cross-document drift alerts
 */
export async function GET() {
  try {
    const enriched = crossDocDriftRepo.findAllEnriched();
    return NextResponse.json(enriched);
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Failed to fetch cross-doc drifts"
    );
    return NextResponse.json(
      { error: "Failed to fetch cross-doc drifts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drift/cross-doc - Trigger cross-document drift scan
 */
export async function POST() {
  try {
    log.info("Triggering cross-doc drift scan");
    const drifts = await detectCrossDocDrift();
    const now = new Date();

    let inserted = 0;
    for (const drift of drifts) {
      try {
        crossDocDriftRepo.insert({
          sourceSpecId: drift.sourceSpecId,
          targetSpecId: drift.targetSpecId,
          driftType: drift.driftType,
          severity: drift.severity,
          description: drift.description,
          sourceText: drift.sourceText,
          targetText: drift.targetText,
          status: "open",
          detectedAt: now,
        });
        inserted++;
      } catch (err) {
        log.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to insert cross-doc drift"
        );
      }
    }

    eventBus.notifyMany(["cross-doc-drift", "dashboard"]);
    return NextResponse.json({
      scanned: drifts.length,
      inserted,
      message: `Found ${drifts.length} cross-document inconsistencies`,
    });
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Cross-doc drift scan failed"
    );
    return NextResponse.json(
      { error: "Cross-doc drift scan failed" },
      { status: 500 }
    );
  }
}
