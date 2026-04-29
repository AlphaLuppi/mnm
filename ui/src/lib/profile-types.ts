/**
 * Transient local types for profile storage.
 *
 * Will be replaced by imports from `apps/desktop/src/bindings.ts` once the
 * Rust side lands and bindings are regenerated. Types must stay in sync with
 * `apps/desktop/src-tauri/src/profile.rs`.
 *
 * Note: Rust serializes fields as snake_case on the wire, but tauri-specta
 * converts them to camelCase in the generated TS bindings. The camelCase
 * forms below are what `invoke` will return.
 */

export interface Profile {
  id: string;
  displayName: string;
  apiBaseUrl: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ProfileCreateInput {
  displayName: string;
  apiBaseUrl: string;
}

export interface ProfilePatch {
  displayName?: string | null;
  apiBaseUrl?: string | null;
}
