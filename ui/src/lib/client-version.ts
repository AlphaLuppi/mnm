/**
 * Desktop-client version tracking + backend compatibility check.
 *
 * The desktop ships a semver-ish `MAJOR.MINOR.PATCH` version baked into
 * the Tauri bundle (Cargo.toml). At boot we pull it once via the
 * `app_info` command and cache it synchronously. The backend advertises
 * a `minClientVersion` field on `/api/health`; when our cached version
 * compares below the minimum we flag the client as outdated so the
 * update banner can surface.
 *
 * Out of scope for étape 8: WebSocket version negotiation, per-request
 * version header injection, and backend gate-enforcement. Those are
 * tracked as follow-ups in the `api-version-compat` parity entry.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./runtime";

type AppInfo = {
  name: string;
  version: string;
  tauri_version: string;
};

let cachedClientVersion: string | null = null;
let cachedMinVersion: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();

/**
 * Loads the client version from the Tauri bundle into the in-memory
 * cache. Must be called once at boot — idempotent on subsequent calls.
 * No-op in web mode; `getCachedClientVersion()` stays `null` so the
 * banner never triggers outside a packaged desktop build.
 */
export async function initClientVersion(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!isTauri()) return;
  try {
    const info = await invoke<AppInfo>("app_info");
    cachedClientVersion = info.version;
  } catch {
    cachedClientVersion = null;
  }
}

/**
 * Synchronous accessor for the cached client version. Returns `null`
 * before `initClientVersion()` completes or in web mode. Safe to call
 * from the fetch interceptor and React render paths.
 */
export function getCachedClientVersion(): string | null {
  return cachedClientVersion;
}

/**
 * Records the backend-advertised minimum supported client version.
 * Passing `null` (or an empty string) clears the cached minimum —
 * useful when the user switches to a backend that does not enforce
 * one. Notifies subscribers so mounted banners can re-render.
 */
export function setMinClientVersion(min: string | null | undefined): void {
  const next = typeof min === "string" && min.length > 0 ? min : null;
  if (next === cachedMinVersion) return;
  cachedMinVersion = next;
  listeners.forEach((fn) => fn());
}

/** Current backend-advertised minimum. `null` means no minimum known. */
export function getMinClientVersion(): string | null {
  return cachedMinVersion;
}

/**
 * Subscribe to changes in the cached client or minimum version. Returns
 * an unsubscribe function. Designed for `useSyncExternalStore` or a
 * plain `useEffect` subscription.
 */
export function subscribeClientVersion(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Parse a `MAJOR.MINOR.PATCH` string into a tuple. Extra segments and
 * pre-release suffixes are ignored — we only support the numeric
 * triple MnM actually uses. Returns `null` for anything that does not
 * match the expected shape.
 */
function parseSemverLike(input: string): [number, number, number] | null {
  // Strip a leading "v" and anything after "-" (pre-release) or "+"
  // (build metadata); we only care about the numeric triple.
  const cleaned = input.trim().replace(/^v/i, "").split(/[-+]/)[0] ?? "";
  const parts = cleaned.split(".");
  if (parts.length < 3) return null;
  const [rawMajor, rawMinor, rawPatch] = parts;
  const major = Number(rawMajor);
  const minor = Number(rawMinor);
  const patch = Number(rawPatch);
  if (
    !Number.isFinite(major) ||
    !Number.isFinite(minor) ||
    !Number.isFinite(patch) ||
    major < 0 ||
    minor < 0 ||
    patch < 0
  ) {
    return null;
  }
  return [major, minor, patch];
}

/**
 * Compare two version strings. Returns -1 if a < b, 1 if a > b, 0 if
 * equal (or equal enough). Unparseable inputs compare as equal so a
 * malformed backend response never pushes the banner.
 */
export function compareClientVersion(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseSemverLike(a);
  const parsedB = parseSemverLike(b);
  if (parsedA === null || parsedB === null) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (parsedA[i]! < parsedB[i]!) return -1;
    if (parsedA[i]! > parsedB[i]!) return 1;
  }
  return 0;
}

/**
 * `true` only when we know both the client version and the minimum
 * required, and the client compares strictly below the minimum. Any
 * missing data short-circuits to `false` to avoid nagging with a
 * banner we cannot justify.
 */
export function isClientOutdated(): boolean {
  if (cachedClientVersion === null) return false;
  if (cachedMinVersion === null) return false;
  return compareClientVersion(cachedClientVersion, cachedMinVersion) < 0;
}
