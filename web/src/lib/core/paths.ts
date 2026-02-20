import path from "node:path";

export function getMnMRoot(): string {
  return process.env.MNM_REPO_ROOT ?? process.cwd();
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
