import { NextRequest, NextResponse } from "next/server";
import * as specsRepo from "@/lib/db/repositories/specs";
import { indexSpecs } from "@/lib/spec/indexer";
import { ensureBootstrapped } from "@/lib/bootstrap";
import type { SpecType } from "@/lib/core/types";

export async function GET(request: NextRequest) {
  await ensureBootstrapped();

  const type = request.nextUrl.searchParams.get("type") as SpecType | null;

  const allSpecs = type ? specsRepo.findByType(type) : specsRepo.findAll();

  return NextResponse.json({ specs: allSpecs });
}

export async function POST() {
  const repoRoot = process.env.MNM_REPO_ROOT ?? process.cwd();
  const result = await indexSpecs(repoRoot);
  const allSpecs = specsRepo.findAll();

  return NextResponse.json({ result, specs: allSpecs }, { status: 201 });
}
