import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "@/lib/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { CompanyProvider } from "./context/CompanyContext";
import { LiveUpdatesProvider } from "./context/LiveUpdatesProvider";
import { BreadcrumbProvider } from "./context/BreadcrumbContext";
import { PanelProvider } from "./context/PanelContext";
import { SidebarProvider } from "./context/SidebarContext";
import { DialogProvider } from "./context/DialogContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@mdxeditor/editor/style.css";
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
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
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

// Dismiss HTML loader overlay with minimum display time + fade-out
function dismissLoader() {
  const loader = document.getElementById("app-loader");
  if (!loader) return;
  const start = (window as any).__MNM_LOADER_START || performance.now();
  const elapsed = performance.now() - start;
  const minDisplay = 1400;
  const remaining = Math.max(0, minDisplay - elapsed);
  setTimeout(() => {
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 400);
  }, remaining);
}
dismissLoader();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
                          <App />
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
  </StrictMode>
);
