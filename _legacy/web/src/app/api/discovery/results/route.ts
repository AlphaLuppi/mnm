import { NextRequest, NextResponse } from "next/server";
import { ensureBootstrapped } from "@/lib/bootstrap";
import * as discoveryRepo from "@/lib/db/repositories/discovery-results";
import type { DiscoveryType } from "@/lib/db/repositories/discovery-results";
import { handleApiError } from "@/lib/core/api-error-handler";

const VALID_TYPES = new Set(["spec", "workflow", "agent", "command", "config"]);

export async function GET(request: NextRequest) {
  try {
    await ensureBootstrapped();

    const typeParam = request.nextUrl.searchParams.get("type");

    if (typeParam && !VALID_TYPES.has(typeParam)) {
      return NextResponse.json(
        { error: { code: "INVALID_TYPE", message: `Invalid type filter: ${typeParam}` } },
        { status: 400 }
      );
    }

    const results = typeParam
      ? discoveryRepo.findByType(typeParam as DiscoveryType)
      : discoveryRepo.findAll();

    const lastScan = discoveryRepo.getLastScanTime();

    return NextResponse.json({
      results,
      lastScan: lastScan?.toISOString() ?? null,
      count: results.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
