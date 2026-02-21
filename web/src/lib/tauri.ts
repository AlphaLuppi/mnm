/**
 * Tauri detection and utilities
 */

let _isTauri: boolean | null = null;

/**
 * Check if we're running in a Tauri environment
 * This works by checking for the Tauri IPC internals
 */
export function isTauri(): boolean {
  if (_isTauri !== null) return _isTauri;

  if (typeof window === "undefined") {
    _isTauri = false;
    return false;
  }

  // Check for Tauri v2 IPC
  // In Tauri v2, window.__TAURI_INTERNALS__ is set
  _isTauri = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;

  console.log("[Tauri] Detection result:", _isTauri);
  console.log("[Tauri] __TAURI_INTERNALS__:", "__TAURI_INTERNALS__" in window);
  console.log("[Tauri] __TAURI__:", "__TAURI__" in window);

  return _isTauri;
}

/**
 * Reset the cached detection (useful for testing)
 */
export function resetTauriDetection(): void {
  _isTauri = null;
}
