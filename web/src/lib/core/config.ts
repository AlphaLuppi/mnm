import fs from "node:fs";
import path from "node:path";

export type AuthType = "api_key" | "oauth_token";

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
  anthropicApiKey?: string; // Stored API key
  anthropicOAuthToken?: string; // OAuth token from `claude setup-token`
  authType?: AuthType; // Which auth method to use
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

export interface AuthCredentials {
  token: string;
  type: AuthType;
}

export function getAnthropicCredentials(): AuthCredentials | undefined {
  // Priority: environment variable > stored config
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) {
    // Detect type from token prefix
    const type = envKey.startsWith("sk-ant-oat") ? "oauth_token" : "api_key";
    return { token: envKey, type };
  }

  const config = loadConfig();

  // Check preferred auth type
  if (config.authType === "oauth_token" && config.anthropicOAuthToken) {
    return { token: config.anthropicOAuthToken, type: "oauth_token" };
  }

  if (config.anthropicApiKey) {
    return { token: config.anthropicApiKey, type: "api_key" };
  }

  if (config.anthropicOAuthToken) {
    return { token: config.anthropicOAuthToken, type: "oauth_token" };
  }

  return undefined;
}

// Legacy function for backward compatibility
export function getAnthropicApiKey(): string | undefined {
  return getAnthropicCredentials()?.token;
}

export function setAnthropicApiKey(apiKey: string): void {
  saveConfig({ anthropicApiKey: apiKey, authType: "api_key" });
}

export function setAnthropicOAuthToken(token: string): void {
  saveConfig({ anthropicOAuthToken: token, authType: "oauth_token" });
}

export function validateApiKey(key: string): { valid: boolean; type: AuthType } {
  // OAuth tokens from `claude setup-token` start with sk-ant-oat
  if (key.startsWith("sk-ant-oat") && key.length > 20) {
    return { valid: true, type: "oauth_token" };
  }
  // API keys from console.anthropic.com start with sk-ant-api
  if (key.startsWith("sk-ant-api") && key.length > 20) {
    return { valid: true, type: "api_key" };
  }
  // Legacy format or other valid formats
  if (key.startsWith("sk-ant-") && key.length > 20) {
    return { valid: true, type: "api_key" };
  }
  return { valid: false, type: "api_key" };
}

export function getDatabasePath(): string {
  const repoRoot = process.env.MNM_REPO_ROOT ?? process.cwd();
  return path.join(repoRoot, ".mnm", "state.db");
}
