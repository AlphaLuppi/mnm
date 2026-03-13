import { NextRequest, NextResponse } from "next/server";
import * as commitAssociationsRepo from "@/lib/db/repositories/commit-associations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const associations = commitAssociationsRepo.findBySpecId(id);
    return NextResponse.json({ commits: associations });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
