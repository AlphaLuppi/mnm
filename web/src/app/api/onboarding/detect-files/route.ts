import { NextRequest, NextResponse } from "next/server";
import fg from "fast-glob";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "onboarding" });

const SPEC_PATTERNS = [
  "**/*.md",
  "**/*.mdx",
  "**/package.json",
  "**/tsconfig.json",
  "**/Dockerfile",
  "**/docker-compose.yml",
];

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.mnm/**",
  "**/dist/**",
  "**/.next/**",
];

function classifyFile(filePath: string): string {
  if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) return "spec";
  if (filePath.includes("package.json")) return "config";
  if (filePath.includes("tsconfig")) return "config";
  if (filePath.includes("Dockerfile") || filePath.includes("docker-compose"))
    return "infra";
  return "other";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { getMnMRoot } = await import("@/lib/core/paths");
    const repoPath = body.repoPath || getMnMRoot();

    const entries = await fg(SPEC_PATTERNS, {
      cwd: repoPath,
      ignore: IGNORE_PATTERNS,
      dot: false,
      onlyFiles: true,
      absolute: false,
    });

    const files = entries.slice(0, 100).map((p) => ({
      path: p,
      type: classifyFile(p),
    }));

    return NextResponse.json({ files });
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : "unknown" }, "File detection failed");
    return NextResponse.json({ files: [] });
  }
}
