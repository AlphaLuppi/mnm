import { NextResponse } from "next/server";
import * as specChangesRepo from "@/lib/db/repositories/spec-changes";

export async function PATCH() {
  try {
    specChangesRepo.markAllViewed();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: err instanceof Error ? err.message : String(err) } },
      { status: 500 }
    );
  }
}
