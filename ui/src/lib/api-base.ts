/// <reference types="vite/client" />
import { isTauri } from "./runtime";
import { getCachedActiveProfile } from "./profile-client";

/**
 * Returns the base URL for backend API calls.
 * - Web build: empty string → all calls use relative /api/... paths
 *   handled by Vite dev proxy or same-origin in production.
 * - Desktop dev build: `VITE_MNM_API_BASE` if set, otherwise empty (Vite
 *   dev proxy at localhost:5173). The connection-profile system does NOT
 *   kick in during dev so the iterative dev loop stays untouched.
 * - Desktop packaged build: reads the active connection profile's
 *   `apiBaseUrl` from `profile-client`. `initActiveProfile()` must have
 *   been awaited in `main.tsx` before any API call happens; otherwise
 *   this returns an empty string and the call will hit an unset origin.
 */
export const apiBase = (): string => {
  if (isTauri()) {
    // In dev mode, keep the Vite proxy flow untouched — profile system
    // only kicks in for packaged builds.
    if (import.meta.env.DEV) {
      return import.meta.env.VITE_MNM_API_BASE ?? "";
    }
    // In packaged builds, the URL comes from the active connection profile.
    // Must have been initialized by main.tsx before any api call happens.
    return getCachedActiveProfile()?.apiBaseUrl ?? "";
  }
  return "";
};

/**
 * Resolves a WebSocket URL for live-events.
 *
 * Contract:
 * - `path` MUST start with "/" (e.g. "/api/companies/:id/events/ws")
 * - When VITE_MNM_API_BASE is set, only its `origin` is used — the env var
 *   MUST be a bare origin (https://api.example.com), no trailing path.
 *   Sprint 2 will document this in the deployment guide.
 *
 * Sprint 1 behavior:
 * - Web/dev: derives WS URL from window.location.host (Vite proxy upgrades it)
 * - Desktop dev: same as web (Tauri loads from localhost:5173)
 * - Packaged desktop: out of scope (Sprint 2)
 *
 * Throws if called in a non-browser context with no apiBase set, since
 * a relative path cannot become a valid WebSocket URL.
 */
export const resolveWsUrl = (path: string): string => {
  const base = apiBase();
  if (base) {
    const url = new URL(base);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}${path}`;
  }
  if (typeof window === "undefined") {
    throw new Error(
      "resolveWsUrl: cannot resolve WebSocket URL without window.location or VITE_MNM_API_BASE",
    );
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
};
