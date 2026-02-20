import fs from "node:fs";
import path from "node:path";

export interface MnMConfig {
  repositoryPath: string;
  driftDetectionEnabled: boolean;
  customInstructionsPath?: string;
  maxConcurrentAgents: number;
  agentTimeoutSeconds: number;
  onboardingCompleted: boolean;
  theme: "light" | "dark" | "system";
  fontSize: number;
  defaultAgentType: string;
  autoDetectFiles: boolean;
  gitHooksEnabled: boolean;
  telemetryEnabled: boolean;
  performancePanelEnabled: boolean;
  showHelpHints: boolean;
  lastCleanShutdown?: number;
}

const DEFAULT_CONFIG: MnMConfig = {
  repositoryPath: process.cwd(),
  driftDetectionEnabled: true,
  maxConcurrentAgents: 5,
  agentTimeoutSeconds: 300,
  onboardingCompleted: false,
  theme: "system",
  fontSize: 14,
  defaultAgentType: "implementation",
  autoDetectFiles: true,
  gitHooksEnabled: false,
  telemetryEnabled: false,
  performancePanelEnabled: false,
  showHelpHints: true,
};

export function getMnMDir(): string {
  const repoRoot = process.env.MNM_REPO_ROOT ?? process.cwd();
  return path.join(repoRoot, ".mnm");
}

function getConfigPath(): string {
  return path.join(getMnMDir(), "config.json");
}

export function ensureMnMDir(): void {
  const dir = getMnMDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): MnMConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(config: Partial<MnMConfig>): MnMConfig {
  ensureMnMDir();
  const current = loadConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

export function getDatabasePath(): string {
  const repoRoot = process.env.MNM_REPO_ROOT ?? process.cwd();
  return path.join(repoRoot, ".mnm", "state.db");
}
