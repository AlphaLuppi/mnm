import { NextRequest, NextResponse } from "next/server";
import { getMnMRoot } from "@/lib/core/paths";
import * as specsRepo from "@/lib/db/repositories/specs";
import { indexSpecs } from "@/lib/spec/indexer";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { eventBus } from "@/lib/events/event-bus";
import type { SpecType } from "@/lib/core/types";

export async function GET(request: NextRequest) {
  await ensureBootstrapped();

  const type = request.nextUrl.searchParams.get("type") as SpecType | null;

  const allSpecs = type ? specsRepo.findByType(type) : specsRepo.findAll();

  return NextResponse.json({ specs: allSpecs });
}

export async function POST() {
  const repoRoot = getMnMRoot();
  const result = await indexSpecs(repoRoot);
  const allSpecs = specsRepo.findAll();

  eventBus.notifyMany(["dashboard"]);
  return NextResponse.json({ result, specs: allSpecs }, { status: 201 });
}
