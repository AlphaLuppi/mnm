import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "@/lib/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { NoProfileGate } from "./components/NoProfileGate";
import { BackendUnreachable } from "./components/BackendUnreachable";
import { TauriPreviewGate } from "./components/TauriPreviewGate";
import { TauriErrorBoundary } from "./components/TauriErrorBoundary";
import { CompanyProvider } from "./context/CompanyContext";
import { LiveUpdatesProvider } from "./context/LiveUpdatesProvider";
import { BreadcrumbProvider } from "./context/BreadcrumbContext";
import { PanelProvider } from "./context/PanelContext";
import { SidebarProvider } from "./context/SidebarContext";
import { DialogProvider } from "./context/DialogContext";
import { DocumentViewerProvider } from "./components/ui/document-viewer";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isTauri } from "@/lib/runtime";
import {
  getCachedActiveProfile,
  initActiveProfile,
} from "@/lib/profile-client";
import { checkBackendHealth } from "@/lib/health-check";
import type { HealthResult } from "@/lib/health-check";
import { initSessionToken } from "@/lib/secrets-client";
import { applyDynamicCsp } from "@/lib/csp-client";
import "@mdxeditor/editor/style.css";
import "react-grid-layout/css/styles.css";
import "./index.css";

// --- Chunk load failure recovery ---
// After redeployment, old JS chunks no longer exist. Catch the error and reload once.
const RELOAD_KEY = "mnm.chunk-reload";
window.addEventListener("error", (e) => {
  const msg = e.message || "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("Load failed")
  ) {
    const lastReload = sessionStorage.getItem(RELOAD_KEY);
    const now = Date.now();
    // Only auto-reload once per 30s to prevent infinite loops
    if (!lastReload || now - Number(lastReload) > 30_000) {
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e.reason?.message || "";
  if (msg.includes("Failed to fetch dynamically imported module") || msg.includes("Load failed")) {
    const lastReload = sessionStorage.getItem(RELOAD_KEY);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 30_000) {
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }
  }
});

// --- Service worker registration ---
// Skip in Tauri: the custom `tauri://` protocol does not support service
// workers, and navigator.serviceWorker.register("/sw.js") throws a
// DOMException ("The string did not match the expected pattern") that
// crashes the React mount before any error boundary can handle it.
const isTauriRuntime =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

if ("serviceWorker" in navigator && !isTauriRuntime) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silently ignore SW registration failures in edge browsers
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

// Dismiss HTML splash loader (dissolve animation + fade out)
if (typeof (window as any).__dismissMnmLoader === "function") {
  (window as any).__dismissMnmLoader();
}

// Mark the app as successfully mounted so the Tauri early-error handler
// in index.html can step aside. We set this flag BEFORE rendering so the
// 8s watchdog doesn't fire even if the first React render is slow.
(window as unknown as { __mnmMounted?: boolean }).__mnmMounted = true;

// Single React root — created once, re-rendered on retry/switch flows.
let root: Root | null = null;

function renderTree(children: ReactNode): void {
  if (root === null) {
    root = createRoot(document.getElementById("root")!);
  }
  root.render(
    <StrictMode>
      <TauriErrorBoundary>
        <TauriPreviewGate>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <CompanyProvider>
                <ToastProvider>
                  <LiveUpdatesProvider>
                    <BrowserRouter>
                      <TooltipProvider>
                        <BreadcrumbProvider>
                          <SidebarProvider>
                            <PanelProvider>
                              <DialogProvider>
                                <DocumentViewerProvider>
                                  {children}
                                </DocumentViewerProvider>
                              </DialogProvider>
                            </PanelProvider>
                          </SidebarProvider>
                        </BreadcrumbProvider>
                      </TooltipProvider>
                    </BrowserRouter>
                  </LiveUpdatesProvider>
                </ToastProvider>
              </CompanyProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </TauriPreviewGate>
      </TauriErrorBoundary>
    </StrictMode>,
  );
}

/**
 * Renders the BackendUnreachable gate with retry and switch-profile flows.
 * On retry, re-runs the health check; on success, replaces with <App />.
 * On switch-profile, replaces with <NoProfileGate />.
 */
function renderUnreachable(result: HealthResult & { ok: false }): void {
  const profile = getCachedActiveProfile()!;

  const handleRetry = async (): Promise<void> => {
    const retryResult = await checkBackendHealth(profile.apiBaseUrl);
    if (retryResult.ok) {
      renderTree(<App />);
    } else {
      // Re-render with the new error details
      renderUnreachable(retryResult);
    }
  };

  const handleSwitchProfile = (): void => {
    renderTree(<NoProfileGate />);
  };

  renderTree(
    <BackendUnreachable
      profileName={profile.displayName}
      apiBaseUrl={profile.apiBaseUrl}
      reason={result.reason}
      message={result.message}
      onRetry={() => void handleRetry()}
      onSwitchProfile={handleSwitchProfile}
    />,
  );
}

// Boot sequence: populate the profile cache BEFORE mounting React so that
// `apiBase()` has a valid URL on first render in packaged desktop builds.
// In web mode `initActiveProfile()` is a no-op and the regular app mounts.
void (async () => {
  try {
    await initActiveProfile();
  } catch {
    // Swallow profile-bridge errors at boot so the UI still mounts — the
    // profile gate will re-surface the problem if no active profile is set.
  }

  // Gate 1: no profile at all → show profile creation form
  if (isTauri() && !import.meta.env.DEV && getCachedActiveProfile() === null) {
    renderTree(<NoProfileGate />);
    return;
  }

  // Gate 2: profile exists but backend unreachable → show error screen.
  // Before touching the network, lock down connect-src via a dynamic CSP
  // derived from the active profile, so even the health check below is
  // constrained by the policy. In dev mode this is a no-op.
  if (isTauri() && !import.meta.env.DEV && getCachedActiveProfile() !== null) {
    await applyDynamicCsp();
    const healthResult = await checkBackendHealth(
      getCachedActiveProfile()!.apiBaseUrl,
    );
    if (!healthResult.ok) {
      renderUnreachable(healthResult);
      return;
    }

    // Backend reachable — load session token from Keychain into memory
    // so the API client can inject it as a Bearer header.
    await initSessionToken();
  }

  // All gates passed — render the app
  renderTree(<App />);
})();
