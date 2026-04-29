/**
 * Pre-mount backend health check for packaged desktop builds.
 *
 * Verifies the active connection profile's backend is reachable before
 * mounting the React app. Returns a structured result — never throws.
 */
import type { HealthStatus } from "@/api/health";

export type HealthResult =
  | { ok: true; data: HealthStatus }
  | { ok: false; reason: "timeout" | "network" | "server-error"; message: string };

/**
 * Pings `${apiBaseUrl}/api/health` and returns a structured result.
 * Uses `AbortController` for timeout. Safe to call at any point — the
 * function never throws.
 */
export async function checkBackendHealth(
  apiBaseUrl: string,
  timeoutMs = 8_000,
): Promise<HealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${apiBaseUrl}/api/health`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        ok: false,
        reason: "server-error",
        message: `Backend returned HTTP ${res.status}`,
      };
    }

    // In packaged Tauri builds the custom protocol can serve index.html as
    // a fallback for any unknown path (including /api/*). Verify we got
    // actual JSON from the backend, not the SPA fallback HTML.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        ok: false,
        reason: "server-error",
        message: "Backend did not return JSON — the URL may be incorrect",
      };
    }

    const data = (await res.json()) as HealthStatus;
    if (data.status !== "ok") {
      return {
        ok: false,
        reason: "server-error",
        message: `Backend health status: ${String(data.status ?? "unknown")}`,
      };
    }

    return { ok: true, data };
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        reason: "timeout",
        message: `Backend did not respond within ${timeoutMs}ms`,
      };
    }

    const message =
      error instanceof Error ? error.message : "Network request failed";
    return { ok: false, reason: "network", message };
  } finally {
    clearTimeout(timer);
  }
}
