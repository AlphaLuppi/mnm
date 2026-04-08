/// <reference types="vite/client" />
import { isTauri } from "./runtime";

/**
 * Returns the base URL for backend API calls.
 * - Web build: empty string → all calls use relative /api/... paths
 *   handled by Vite dev proxy or same-origin in production.
 * - Desktop build (Sprint 1): also empty — desktop dev runs through
 *   Vite proxy at localhost:5173. Sprint 2 will introduce
 *   VITE_MNM_API_BASE for packaged DMG to talk to a configurable backend.
 */
export const apiBase = (): string => {
  if (isTauri()) {
    return import.meta.env.VITE_MNM_API_BASE ?? "";
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
