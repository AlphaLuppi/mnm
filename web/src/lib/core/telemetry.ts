import { loadConfig } from "./config";

export function isTelemetryEnabled(): boolean {
  try {
    const config = loadConfig();
    return config.telemetryEnabled === true;
  } catch {
    return false;
  }
}

// Stubbed telemetry - no actual collection in POC
export function trackEvent(_name: string, _properties?: Record<string, unknown>): void {
  if (!isTelemetryEnabled()) return;
  // Stub: telemetry collection not implemented in POC
}
