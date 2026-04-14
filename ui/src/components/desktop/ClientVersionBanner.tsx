/**
 * Non-blocking banner that surfaces when the desktop client is below
 * the backend-advertised minimum supported version. Dismissible per
 * session so one acknowledgement does not follow the user across
 * every page navigation.
 *
 * Relies on the module-level store in `client-version.ts`. The store
 * is fed at boot from `/api/health`'s `minClientVersion` field and
 * from the Tauri `app_info` command — both synchronous by the time
 * React mounts. The banner itself never triggers a network call.
 */
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/runtime";
import {
  getCachedClientVersion,
  getMinClientVersion,
  isClientOutdated,
  subscribeClientVersion,
} from "@/lib/client-version";

const RELEASES_URL =
  "https://github.com/AlphaLuppi/mnm/releases/latest";

const DISMISS_KEY = "mnm.client-version.dismissed";

/**
 * Reads "outdated" state from the version store via useSyncExternalStore
 * so transitions (boot → health check lands a min version) re-render the
 * banner without a manual subscription.
 */
function useClientVersionStatus(): {
  outdated: boolean;
  current: string | null;
  min: string | null;
} {
  const outdated = useSyncExternalStore(
    subscribeClientVersion,
    isClientOutdated,
    () => false,
  );
  const current = useSyncExternalStore(
    subscribeClientVersion,
    getCachedClientVersion,
    () => null,
  );
  const min = useSyncExternalStore(
    subscribeClientVersion,
    getMinClientVersion,
    () => null,
  );
  return { outdated, current, min };
}

/** Builds the dismissal key so each `min` version nags separately. */
function dismissKeyFor(min: string): string {
  return `${DISMISS_KEY}:${min}`;
}

export function ClientVersionBanner(): ReactElement | null {
  const { outdated, current, min } = useClientVersionStatus();
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Whenever the backend changes the minimum (new profile, updated
  // backend), re-check session storage so a previous dismissal for a
  // different `min` does not silence the new one.
  useEffect(() => {
    if (!outdated || min === null) {
      setDismissed(false);
      document.documentElement.classList.remove("tauri-banner-visible");
      return;
    }
    try {
      const previouslyDismissed =
        window.sessionStorage.getItem(dismissKeyFor(min)) === "1";
      setDismissed(previouslyDismissed);
      document.documentElement.classList.toggle(
        "tauri-banner-visible",
        !previouslyDismissed,
      );
    } catch {
      setDismissed(false);
      document.documentElement.classList.add("tauri-banner-visible");
    }
  }, [outdated, min]);

  // The banner only belongs in packaged Tauri builds — same gate as
  // DesktopTitleBar. In web / Tauri dev we never populate the version
  // store, but guard defensively so a misuse does not leak UI.
  if (!isTauri() || import.meta.env.DEV) return null;
  if (!outdated || dismissed || min === null || current === null) return null;

  function handleDismiss(): void {
    if (min === null) return;
    try {
      window.sessionStorage.setItem(dismissKeyFor(min), "1");
    } catch {
      // Session storage may be unavailable in rare sandboxed contexts;
      // fall back to an in-memory dismissal that lasts until reload.
    }
    document.documentElement.classList.remove("tauri-banner-visible");
    setDismissed(true);
  }

  return (
    <div
      data-testid="desktop-client-version-banner"
      className="fixed inset-x-0 top-9 z-[59] flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 backdrop-blur"
      style={{ height: "36px" }}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle
        className="h-3.5 w-3.5 shrink-0 text-amber-300"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 truncate">
        <span className="font-medium">Update available.</span>{" "}
        <span className="text-amber-200/90">
          You're on v{current}. This backend requires v{min} or newer.
        </span>
      </div>
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded border border-amber-300/40 px-2 py-0.5 text-[11px] font-medium text-amber-50 hover:bg-amber-300/10"
        data-testid="desktop-client-version-banner-cta"
      >
        View releases
      </a>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleDismiss}
        aria-label="Dismiss update notice"
        className="shrink-0 text-amber-100/70 hover:bg-amber-300/10 hover:text-amber-50"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
