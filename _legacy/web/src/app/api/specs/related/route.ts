import { NextRequest, NextResponse } from "next/server";
import { findRelatedSpecs } from "@/lib/spec/linker";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("file");

  if (!filePath) {
    return NextResponse.json(
      { error: { code: "MISSING_PARAM", message: "file parameter required" } },
      { status: 400 }
    );
  }

  try {
    const specs = findRelatedSpecs(filePath);
    return NextResponse.json({ specs });
  } catch {
    return NextResponse.json({ specs: [] });
  }
}
