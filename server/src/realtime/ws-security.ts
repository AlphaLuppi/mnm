/**
 * ws-security.ts — Shared WebSocket security utilities
 *
 * SEC-T8-01  CSWSH: Origin validation
 * SEC-T8-03  Connection limits per actor
 * SEC-T8-06  maxPayload cap (memory bomb prevention)
 */

/** Maximum WebSocket frame payload in bytes (256 KB). */
export const WS_MAX_PAYLOAD_BYTES = 256 * 1024;

/**
 * Maximum concurrent WebSocket connections per actor (companyId:actorId).
 * Applies to both live-events and chat WebSocket servers.
 */
export const MAX_WS_CONNECTIONS_PER_ACTOR = 10;

/**
 * SEC-T8-01: Parse the list of allowed WebSocket upgrade origins.
 *
 * Priority:
 *  1. `MNM_WS_ALLOWED_ORIGINS` env var (comma-separated, explicit override)
 *  2. `MNM_PUBLIC_URL` — derive origin from the public base URL
 *  3. Tauri desktop app origin (`tauri://localhost`)
 *
 * The result is a list of normalized origins (scheme + host + optional port,
 * no trailing slash).  An empty list means no origins are allowed (fail-closed).
 */
export function parseAllowedWsOrigins(): string[] {
  const explicit = process.env.MNM_WS_ALLOWED_ORIGINS;
  if (explicit) {
    return explicit
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, "").toLowerCase())
      .filter((o) => o.length > 0);
  }

  const origins: string[] = [];

  // Derive from public URL if configured
  const publicUrl = process.env.MNM_PUBLIC_URL ?? process.env.MNM_AUTH_PUBLIC_BASE_URL;
  if (publicUrl) {
    try {
      const parsed = new URL(publicUrl);
      origins.push(`${parsed.protocol}//${parsed.host}`.toLowerCase());
    } catch {
      // ignore malformed URL
    }
  }

  // Always allow Tauri desktop origin
  origins.push("tauri://localhost");

  // In dev, also allow localhost variants if no public URL is set
  if (origins.length <= 1) {
    origins.push("http://localhost:3100");
    origins.push("http://localhost:5173");
    origins.push("http://127.0.0.1:3100");
    origins.push("http://127.0.0.1:5173");
  }

  return Array.from(new Set(origins));
}

/**
 * SEC-T8-01: Check whether an incoming WS upgrade Origin header is allowed.
 *
 * Returns `true` if:
 *  - The origin matches one of `allowedOrigins` (case-insensitive)
 *
 * Returns `false` if:
 *  - `origin` is missing (no Origin header)
 *  - `origin` is not in the allowlist
 *
 * Callers should skip this check entirely in `local_trusted` mode.
 */
export function isOriginAllowed(
  origin: string | string[] | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return false;
  const raw = Array.isArray(origin) ? origin[0] : origin;
  if (!raw) return false;
  const normalized = raw.trim().replace(/\/+$/, "").toLowerCase();
  return allowedOrigins.some((allowed) => allowed === normalized);
}
