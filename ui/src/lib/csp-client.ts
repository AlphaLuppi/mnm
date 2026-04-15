/**
 * Thin typed wrapper around the Tauri `invoke` bridge for the dynamic
 * Content-Security-Policy. Safe to import from web builds — all functions
 * no-op outside a packaged desktop build.
 *
 * The CSP is computed by the Rust `csp` module from the active profile's
 * `apiBaseUrl` (REST origin + derived ws/wss origin + Tauri internal
 * schemes). It is applied as a `<meta http-equiv="Content-Security-Policy">`
 * tag injected into `<head>` BEFORE any network call leaves the webview, so
 * that even the first backend health check is constrained by the policy.
 *
 * Profile switching is handled by reloading the window (see
 * `NoProfileGate`), which triggers a fresh boot and a fresh CSP — we never
 * mutate the tag in place. Trying to "update" a meta CSP at runtime is a
 * well-known footgun: browsers only enforce the first CSP they see.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./runtime";

/** Identifier for the injected meta tag so we never stack duplicates. */
const CSP_META_ID = "mnm-dynamic-csp";

/**
 * Fetch the CSP string for the active profile and inject it into `<head>`.
 *
 * - Web build: no-op (web CSP is served by the HTTP layer, not Tauri).
 * - Tauri dev build: no-op (Vite dev server would conflict with a strict
 *   CSP and HMR would break). The packaged-build invariant is what we
 *   care about security-wise.
 * - Packaged desktop: invoke `csp_for_active_profile`, stamp a meta tag.
 *
 * If the Rust side reports no active profile (or the URL is invalid),
 * we swallow the error and let the caller proceed. The boot gate in
 * `main.tsx` will already have surfaced the missing-profile state; a
 * throw here would mask that with a less helpful message.
 */
export async function applyDynamicCsp(): Promise<void> {
  if (!isTauri() || import.meta.env.DEV) return;
  if (typeof document === "undefined") return;
  // Idempotent: if we already stamped a tag on this document, leave it.
  if (document.getElementById(CSP_META_ID)) return;

  try {
    const csp = await invoke<string>("csp_for_active_profile");
    stampCspMeta(csp);
  } catch {
    // No active profile / invalid URL / IPC failure: silently skip.
    // The boot gate will surface the underlying error path.
  }
}

/**
 * Inject (or reuse) the CSP meta tag in `<head>`. Exposed for tests.
 * Treats the CSP string as opaque — the Rust side is the single source of
 * truth for its content.
 */
export function stampCspMeta(csp: string): void {
  if (typeof document === "undefined") return;
  const head = document.head;
  if (!head) return;
  const existing = document.getElementById(CSP_META_ID);
  if (existing) return;

  const meta = document.createElement("meta");
  meta.id = CSP_META_ID;
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = csp;
  // Insert as the very first child so it applies before any other head
  // resource is considered by the CSP parser.
  head.insertBefore(meta, head.firstChild);
}
