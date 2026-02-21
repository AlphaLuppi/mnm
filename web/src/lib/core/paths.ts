import fs from "node:fs";
import path from "node:path";

/**
 * Find the repository root by walking up from cwd looking for `.git`.
 * Cached after first resolution.
 */
let _resolvedRoot: string | undefined;

function findRepoRoot(): string {
  let dir = process.cwd();
  // Walk up until we find .git or hit the filesystem root
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback to cwd if no .git found
  return process.cwd();
}

export function getMnMRoot(): string {
  if (process.env.MNM_REPO_ROOT) return process.env.MNM_REPO_ROOT;
  if (!_resolvedRoot) {
    _resolvedRoot = findRepoRoot();
  }
  return _resolvedRoot;
}

export function setMnMRoot(newRoot: string): void {
  _resolvedRoot = newRoot;
}

export function resetMnMRoot(): void {
  _resolvedRoot = undefined;
}

export function mnmPath(...segments: string[]): string {
  return path.join(getMnMRoot(), ".mnm", ...segments);
}

export const MNM_PATHS = {
  root: () => mnmPath(),
  config: () => mnmPath("config.json"),
  database: () => mnmPath("state.db"),
  databaseBackup: () => mnmPath("state.db.backup"),
  logs: () => mnmPath("logs"),
  crashLog: (date: string) => mnmPath("logs", `crash-${date}.log`),
  agentLog: (id: string) => mnmPath("logs", `${id}.log`),
  scopeViolations: () => mnmPath("logs", "scope-violations.log"),
  uiState: () => mnmPath("ui-state.json"),
  importantFiles: () => path.join(getMnMRoot(), ".mnm", "important-files.json"),
} as const;
