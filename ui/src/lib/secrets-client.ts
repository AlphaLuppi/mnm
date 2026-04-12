/**
 * Thin typed wrapper around the Tauri `invoke` bridge for Keychain-backed
 * secret storage. Safe to import from web builds — all functions no-op or
 * throw if called outside Tauri.
 *
 * Secrets are keyed by profile id and stored via the Rust `secrets` module
 * (which uses the macOS Keychain under the hood). An in-memory cache keeps
 * a synchronous copy of the session token for the active profile so the API
 * client can inject it into every request without awaiting IPC.
 */
import { isTauri } from "./runtime";
import { getCachedActiveProfile } from "./profile-client";

type InvokeFn = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let cachedInvoke: InvokeFn | null = null;
let cachedSessionToken: string | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (cachedInvoke) return cachedInvoke;
  const specifier = "@tauri-apps/api/core";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    invoke: InvokeFn;
  };
  cachedInvoke = mod.invoke;
  return cachedInvoke;
}

/**
 * Returns the in-memory session token. Synchronous — safe to call from the
 * fetch interceptor on every request. Returns null in web mode or before
 * `initSessionToken()` completes.
 */
export function getCachedSessionToken(): string | null {
  return cachedSessionToken;
}

/**
 * Loads the session token from the OS Keychain into the in-memory cache.
 * Must be called once at boot (after `initActiveProfile()`). No-ops in
 * web mode or Tauri dev mode (where the Vite proxy handles cookies).
 */
export async function initSessionToken(): Promise<void> {
  if (!isTauri() || import.meta.env.DEV) return;
  const profile = getCachedActiveProfile();
  if (!profile) return;
  try {
    const invoke = await getInvoke();
    const token = await invoke<string | null>("secret_get", {
      profileId: profile.id,
      key: "session_token",
    });
    cachedSessionToken = token;
  } catch {
    cachedSessionToken = null;
  }
}

/**
 * Stores a session token in the OS Keychain for the active profile and
 * updates the in-memory cache. Call after a successful sign-in or sign-up.
 */
export async function setSessionToken(token: string): Promise<void> {
  if (!isTauri() || import.meta.env.DEV) return;
  const profile = getCachedActiveProfile();
  if (!profile) return;
  const invoke = await getInvoke();
  await invoke<void>("secret_set", {
    profileId: profile.id,
    key: "session_token",
    value: token,
  });
  cachedSessionToken = token;
}

/**
 * Wipes all Keychain secrets for the active profile and clears the
 * in-memory cache. Call on sign-out.
 */
export async function clearSessionToken(): Promise<void> {
  cachedSessionToken = null;
  if (!isTauri() || import.meta.env.DEV) return;
  const profile = getCachedActiveProfile();
  if (!profile) return;
  try {
    const invoke = await getInvoke();
    await invoke<void>("secret_delete", { profileId: profile.id });
  } catch {
    // Best-effort cleanup — don't block sign-out on keychain errors.
  }
}
