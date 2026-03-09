import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface DirEntry {
  name: string;
  path: string;
  hasGit: boolean;
}

export async function GET(request: NextRequest) {
  const dirPath = request.nextUrl.searchParams.get("path") || os.homedir();
  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: "Not a directory" }, { status: 400 });
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs: DirEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip hidden dirs except .git (we need to detect it but not list it)
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(resolved, entry.name);
      const hasGit = fs.existsSync(path.join(fullPath, ".git"));
      dirs.push({ name: entry.name, path: fullPath, hasGit });
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      current: resolved,
      parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      hasGit: fs.existsSync(path.join(resolved, ".git")),
      dirs,
    });
  } catch {
    return NextResponse.json({ error: "Cannot read directory" }, { status: 403 });
  }
}
