import fs from "node:fs";
import path from "node:path";
import { getMnMRoot } from "./paths";

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

function getDefaultConfig(): MnMConfig {
  return {
    repositoryPath: getMnMRoot(),
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
}

export function getMnMDir(): string {
  return path.join(getMnMRoot(), ".mnm");
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
  const defaults = getDefaultConfig();
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return defaults;
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  // Always override repositoryPath with current active root
  return { ...defaults, ...JSON.parse(raw), repositoryPath: getMnMRoot() };
}

export function saveConfig(config: Partial<MnMConfig>): MnMConfig {
  ensureMnMDir();
  const current = loadConfig();
  const merged = { ...current, ...config, repositoryPath: getMnMRoot() };
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

/**
 * Build the correct auth headers for the Anthropic API.
 * API keys use `x-api-key`. Setup tokens use `Authorization: Bearer`
 * with the `anthropic-beta: oauth-2025-04-20,claude-code-20250219` flag.
 */
export function getAnthropicAuthHeaders(): Record<string, string> | undefined {
  const creds = getAnthropicCredentials();
  if (!creds) return undefined;
  return buildAnthropicAuthHeaders(creds.token, creds.type);
}

/**
 * Build auth headers for a given token and type.
 * Setup tokens (sk-ant-oat*) require the oauth beta flag.
 */
export function buildAnthropicAuthHeaders(
  token: string,
  type: AuthType
): Record<string, string> {
  if (type === "oauth_token") {
    return {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20,claude-code-20250219",
    };
  }
  return { "x-api-key": token };
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
  return path.join(getMnMRoot(), ".mnm", "state.db");
}
