/**
 * Runtime detection helpers for distinguishing web vs Tauri desktop builds.
 * Sprint 1: minimal helper for conditional imports/features.
 */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
