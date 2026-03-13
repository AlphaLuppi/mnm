import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync } from "fs";
import { join } from "path";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  try {
    const stat = statSync(path);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }
    const gitDir = join(path, ".git");
    if (!existsSync(gitDir)) {
      return NextResponse.json(
        { error: "Not a git repository" },
        { status: 400 }
      );
    }
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ error: "Path not found" }, { status: 400 });
  }
}
