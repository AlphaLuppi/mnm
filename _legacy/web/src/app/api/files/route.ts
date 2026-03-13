import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getMnMRoot } from "@/lib/core/paths";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

const EXCLUDED = new Set([
  ".git",
  "node_modules",
  ".mnm",
  ".next",
  "dist",
  "build",
  "target",
  "__pycache__",
  ".DS_Store",
]);

function buildTree(dirPath: string, relativeTo: string): TreeNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];

  for (const entry of entries) {
    if (EXCLUDED.has(entry.name) || entry.name.startsWith(".")) continue;

    const relPath = path.relative(relativeTo, path.join(dirPath, entry.name));

    if (entry.isDirectory()) {
      dirs.push({
        name: entry.name,
        path: relPath,
        type: "directory",
        children: buildTree(path.join(dirPath, entry.name), relativeTo),
      });
    } else {
      files.push({
        name: entry.name,
        path: relPath,
        type: "file",
      });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return [...dirs, ...files];
}

export async function GET() {
  const repoRoot = getMnMRoot();

  try {
    const tree = buildTree(repoRoot, repoRoot);
    return NextResponse.json({ tree });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "FILE_TREE_ERROR", message: String(err) } },
      { status: 500 }
    );
  }
}
