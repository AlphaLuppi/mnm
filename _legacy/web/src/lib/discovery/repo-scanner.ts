import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "repo-scanner" });

export interface RepoOverview {
  repoRoot: string;
  totalFiles: number;
  toolDirectories: ToolDirectory[];
  filesByCategory: Record<string, string[]>;
}

export interface ToolDirectory {
  name: string;
  path: string;
  type: "bmad" | "claude" | "mnm" | "other";
  fileCount: number;
}

export interface ScannedFile {
  path: string;
  category: string;
  size: number;
}

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/target/**",
  "**/.DS_Store",
  "**/coverage/**",
];

const KNOWN_TOOL_DIRS: { pattern: string; type: ToolDirectory["type"] }[] = [
  { pattern: "_bmad", type: "bmad" },
  { pattern: ".claude", type: "claude" },
  { pattern: ".mnm", type: "mnm" },
];

/** Scan a repository to build a structural overview. */
export async function scanRepo(repoRoot: string): Promise<RepoOverview> {
  log.info({ repoRoot }, "Scanning repository structure");

  const toolDirectories = detectToolDirectories(repoRoot);

  const files = await fg(["**/*"], {
    cwd: repoRoot,
    ignore: IGNORE_PATTERNS,
    dot: true,
    onlyFiles: true,
    stats: true,
  });

  const filesByCategory: Record<string, string[]> = {};

  for (const entry of files) {
    const filePath = typeof entry === "string" ? entry : entry.path;
    const category = categorizeFile(filePath, repoRoot);
    if (!filesByCategory[category]) {
      filesByCategory[category] = [];
    }
    filesByCategory[category].push(filePath);
  }

  const overview: RepoOverview = {
    repoRoot,
    totalFiles: files.length,
    toolDirectories,
    filesByCategory,
  };

  log.info(
    {
      totalFiles: overview.totalFiles,
      toolDirs: toolDirectories.length,
      categories: Object.keys(filesByCategory).length,
    },
    "Repository scan complete"
  );

  return overview;
}

function detectToolDirectories(repoRoot: string): ToolDirectory[] {
  const results: ToolDirectory[] = [];

  for (const { pattern, type } of KNOWN_TOOL_DIRS) {
    const dirPath = path.join(repoRoot, pattern);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const fileCount = countFiles(dirPath);
      results.push({
        name: pattern,
        path: pattern,
        type,
        fileCount,
      });
    }
  }

  // Also check for _bmad-output
  const bmadOutput = path.join(repoRoot, "_bmad-output");
  if (fs.existsSync(bmadOutput) && fs.statSync(bmadOutput).isDirectory()) {
    results.push({
      name: "_bmad-output",
      path: "_bmad-output",
      type: "bmad",
      fileCount: countFiles(bmadOutput),
    });
  }

  return results;
}

function countFiles(dirPath: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        count += countFiles(path.join(dirPath, entry.name));
      }
    }
  } catch {
    // ignore permission errors etc.
  }
  return count;
}

function categorizeFile(filePath: string, _repoRoot: string): string {
  if (filePath.startsWith("_bmad/bmm/workflows/")) return "workflow";
  if (filePath.startsWith("_bmad/_config/agents/")) return "agent-config";
  if (filePath.startsWith("_bmad/_config/")) return "config";
  if (filePath.startsWith("_bmad/")) return "bmad-other";
  if (filePath.startsWith("_bmad-output/stories/")) return "story";
  if (filePath.startsWith("_bmad-output/planning-artifacts/")) return "planning-artifact";
  if (filePath.startsWith("_bmad-output/")) return "bmad-output";
  if (filePath.startsWith(".claude/commands/")) return "command";
  if (filePath.startsWith(".claude/")) return "claude-config";
  if (filePath.startsWith("web/src/")) return "source-code";
  if (filePath.endsWith(".md")) return "documentation";
  if (filePath.endsWith(".json") || filePath.endsWith(".yaml") || filePath.endsWith(".yml"))
    return "config";
  return "other";
}
