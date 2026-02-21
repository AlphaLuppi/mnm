import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getMnMRoot } from "@/lib/core/paths";

const MAX_SIZE = 1024 * 1024; // 1MB

function validatePath(requestedPath: string, repoRoot: string): string | null {
  if (requestedPath.includes("..")) return null;
  const resolved = path.resolve(repoRoot, requestedPath);
  if (!resolved.startsWith(repoRoot)) return null;
  return resolved;
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path: segments } = await params;
  const repoRoot = getMnMRoot();
  const filePath = segments.join("/");

  const absPath = validatePath(filePath, repoRoot);
  if (!absPath) {
    return NextResponse.json(
      { error: { code: "INVALID_PATH", message: "Invalid file path" } },
      { status: 400 }
    );
  }

  if (!fs.existsSync(absPath)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "File not found" } },
      { status: 404 }
    );
  }

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    return NextResponse.json(
      { error: { code: "IS_DIRECTORY", message: "Path is a directory" } },
      { status: 400 }
    );
  }

  if (stat.size > MAX_SIZE) {
    return NextResponse.json(
      { error: { code: "FILE_TOO_LARGE", message: "File exceeds 1MB limit" } },
      { status: 413 }
    );
  }

  try {
    const content = fs.readFileSync(absPath, "utf-8");
    return NextResponse.json({
      path: filePath,
      content,
      size: stat.size,
      lines: content.split("\n").length,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "READ_ERROR", message: "Cannot read file as text" } },
      { status: 500 }
    );
  }
}
