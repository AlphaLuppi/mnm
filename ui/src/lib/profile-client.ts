/**
 * Thin typed wrapper around the Tauri `invoke` bridge for connection-profile
 * storage. Safe to import from web builds — all non-init functions throw if
 * called outside Tauri, and `initActiveProfile` no-ops in web mode.
 *
 * Mutation rule: the cached active profile is immutable. Any update assigns a
 * brand-new object to `cachedActiveProfile`.
 */
import { isTauri } from "./runtime";
import type {
  Profile,
  ProfileCreateInput,
  ProfilePatch,
} from "./profile-types";

/**
 * Signature of the Tauri 2 `invoke` function. Declared locally so `ui` does
 * not need to depend on `@tauri-apps/api` at type-check time; the real module
 * is resolved lazily via dynamic import at runtime inside the Tauri webview.
 */
type InvokeFn = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let cachedActiveProfile: Profile | null = null;
let cachedInvoke: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn> {
  if (cachedInvoke) {
    return cachedInvoke;
  }
  // `@tauri-apps/api` is not listed as a dependency of the `ui` workspace
  // (it lives in the desktop workspace), so a plain dynamic import would
  // fail TypeScript module resolution. We launder the specifier through a
  // variable to keep TS silent while Vite still bundles the import for the
  // packaged desktop build where the module is actually available.
  const specifier = "@tauri-apps/api/core";
  const mod = (await import(/* @vite-ignore */ specifier)) as {
    invoke: InvokeFn;
  };
  cachedInvoke = mod.invoke;
  return cachedInvoke;
}

function assertTauri(fn: string): void {
  if (!isTauri()) {
    throw new Error(`profile-client: ${fn} is not available in web mode`);
  }
}

/**
 * Boots the profile cache. MUST be called once at app startup, before any
 * code reads `getCachedActiveProfile()` or calls `apiBase()` in a packaged
 * desktop build. No-ops (and returns null) in web mode.
 */
export async function initActiveProfile(): Promise<Profile | null> {
  if (!isTauri()) {
    cachedActiveProfile = null;
    return null;
  }
  const invoke = await getInvoke();
  const profile = await invoke<Profile | null>("profile_get_active");
  cachedActiveProfile = profile;
  return profile;
}

/**
 * Synchronously returns the cached active profile. Returns null before
 * `initActiveProfile()` has completed or in web mode.
 */
export function getCachedActiveProfile(): Profile | null {
  return cachedActiveProfile;
}

export async function listProfiles(): Promise<Profile[]> {
  assertTauri("listProfiles");
  const invoke = await getInvoke();
  return invoke<Profile[]>("profile_list");
}

export async function addProfile(
  input: ProfileCreateInput,
): Promise<Profile> {
  assertTauri("addProfile");
  const invoke = await getInvoke();
  const created = await invoke<Profile>("profile_add", { input });
  // If no profile was active before, the new one becomes the active one.
  if (cachedActiveProfile === null) {
    cachedActiveProfile = created;
  }
  return created;
}

export async function updateProfile(
  id: string,
  patch: ProfilePatch,
): Promise<Profile> {
  assertTauri("updateProfile");
  const invoke = await getInvoke();
  const updated = await invoke<Profile>("profile_update", { id, patch });
  if (cachedActiveProfile?.id === updated.id) {
    // Assign a brand-new object — never mutate the cached profile.
    cachedActiveProfile = { ...updated };
  }
  return updated;
}

export async function removeProfile(id: string): Promise<void> {
  assertTauri("removeProfile");
  const invoke = await getInvoke();
  await invoke<void>("profile_remove", { id });
  if (cachedActiveProfile?.id === id) {
    cachedActiveProfile = null;
  }
}

export async function setActiveProfile(id: string): Promise<Profile> {
  assertTauri("setActiveProfile");
  const invoke = await getInvoke();
  const active = await invoke<Profile>("profile_set_active", { id });
  cachedActiveProfile = active;
  return active;
}
