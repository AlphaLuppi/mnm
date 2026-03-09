import { NextRequest, NextResponse } from "next/server";
import * as specsRepo from "@/lib/db/repositories/specs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ specs: [] });
  }

  const results = specsRepo.search(q.trim());
  return NextResponse.json({ specs: results });
}
