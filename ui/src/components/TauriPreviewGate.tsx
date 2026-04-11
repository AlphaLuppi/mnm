/// <reference types="vite/client" />
import { useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@/lib/runtime";

type GateStatus = "idle" | "checking" | "ok" | "down";

interface TauriPreviewGateProps {
  children: ReactNode;
}

/**
 * TauriPreviewGate — Sprint 1 developer preview blocker.
 *
 * When the app runs inside a packaged Tauri bundle (no Vite dev proxy),
 * the embedded React UI cannot reach the backend unless the user is also
 * running `bun run dev:server` locally. This component detects that state
 * and renders a full-screen explanation with setup instructions instead
 * of letting users hit a broken app.
 *
 * In the web build (and in Tauri dev mode with Vite proxy), the health
 * check passes and children render normally — the gate is a no-op.
 *
 * Sprint 2 will replace this with a proper first-run onboarding flow
 * that lets users configure a remote backend URL.
 */
export function TauriPreviewGate({ children }: TauriPreviewGateProps) {
  const [status, setStatus] = useState<GateStatus>("idle");
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [loaderGone, setLoaderGone] = useState<boolean>(
    () => typeof document !== "undefined" && !document.getElementById("app-loader"),
  );

  // Wait for the HTML splash loader to finish its dissolve animation and
  // actually remove itself from the DOM before rendering the gate UI. Both
  // the loader and this gate use z-index 9999, but React mounts its output
  // inside #root which comes after #app-loader in document order — so the
  // gate's error screen would otherwise paint over the still-running loader
  // animation instead of appearing once it fades out.
  useEffect(() => {
    if (loaderGone) return;
    if (typeof document === "undefined") return;

    const loader = document.getElementById("app-loader");
    if (!loader) {
      setLoaderGone(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (!document.getElementById("app-loader")) {
        setLoaderGone(true);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: false });

    return () => {
      observer.disconnect();
    };
  }, [loaderGone]);

  useEffect(() => {
    // Only gate when running in Tauri. Web build is always fine.
    if (!isTauri()) {
      setStatus("ok");
      return;
    }

    let cancelled = false;

    const check = async () => {
      setStatus("checking");
      try {
        const res = await fetch("/api/health", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(4000),
        });
        if (cancelled) return;
        if (!res.ok) {
          setStatus("down");
          return;
        }
        // In a packaged Tauri DMG, the custom protocol serves index.html
        // as a fallback for any missing path (including /api/*). A naive
        // res.ok check would false-positive and let the app through, where
        // downstream JSON.parse crashes with a cryptic WebKit error. We
        // must therefore verify the response is an actual JSON health
        // payload from the backend, not the SPA fallback HTML.
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          setStatus("down");
          return;
        }
        const payload = (await res.json().catch(() => null)) as
          | { status?: string }
          | null;
        if (cancelled) return;
        setStatus(payload?.status === "ok" ? "ok" : "down");
      } catch {
        if (cancelled) return;
        setStatus("down");
      }
    };

    void check();

    // Expose retry to the overlay
    (window as unknown as { __mnmRetryBackend?: () => void }).__mnmRetryBackend =
      () => void check();

    return () => {
      cancelled = true;
    };
  }, []);

  // Still checking → render nothing (the HTML loader is already visible)
  if (status === "idle" || status === "checking") {
    return null;
  }

  // Status known but the splash loader animation is still running → hold
  // rendering until it has dissolved so the user sees the intro animation
  // first, then the error screen (or the app) underneath.
  if (status === "down" && !loaderGone) {
    return null;
  }

  // Backend reachable OR user dismissed → pass through
  if (status === "ok" || dismissed) {
    return <>{children}</>;
  }

  // Backend unreachable → full-screen developer-preview explanation
  const retry = () => {
    const fn = (window as unknown as { __mnmRetryBackend?: () => void })
      .__mnmRetryBackend;
    if (fn) fn();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-stone-950 text-stone-100 font-sans"
      style={{ fontFamily: "Inter, -apple-system, sans-serif" }}
    >
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          {/* Badge */}
          <div className="flex items-center gap-3 mb-10">
            <span className="h-px w-12 bg-stone-700"></span>
            <span
              className="text-[11px] uppercase tracking-[0.2em] text-stone-400"
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            >
              v0.1.1 — developer preview
            </span>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl md:text-5xl leading-[1.05] tracking-tight mb-6 text-stone-50"
            style={{ fontFamily: "ui-serif, Georgia, serif", fontWeight: 500 }}
          >
            Backend not reachable.
          </h1>

          <p className="text-lg text-stone-300 font-light leading-relaxed mb-10 max-w-xl">
            MnM Desktop is a client for the MnM backend. The backend runs
            separately — either on your company&apos;s server, or locally on your
            machine.
          </p>

          {/* Two paths */}
          <div className="grid gap-px bg-stone-800 border border-stone-800 mb-10">
            <div className="bg-stone-950 p-6">
              <p
                className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                Already have a backend
              </p>
              <p className="text-stone-300 text-sm font-light leading-relaxed mb-5">
                Make sure it is running. The desktop app currently expects it at{" "}
                <code
                  className="text-stone-100 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded text-xs"
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  }}
                >
                  http://localhost:3100
                </code>
                . Configurable backend URL is coming in a future update.
              </p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-3 px-6 py-3 bg-stone-50 text-stone-950 text-sm font-medium tracking-wide hover:bg-white transition-colors rounded-md"
              >
                Retry connection
                <span className="text-xs opacity-60">↻</span>
              </button>
            </div>

            <div className="bg-stone-950 p-6">
              <p
                className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-3"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                Don&apos;t have the backend yet
              </p>
              <p className="text-stone-300 text-sm font-light leading-relaxed mb-5">
                The MnM backend is distributed on request. Visit the setup guide
                to learn how to deploy it on your company&apos;s server or your
                own machine.
              </p>
              <a
                href="https://mnm.alphaluppi.fr/#setup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 border border-stone-600 text-stone-100 text-sm font-medium tracking-wide hover:bg-stone-900 transition-colors rounded-md"
              >
                Open setup guide
                <span className="text-xs opacity-60">↗</span>
              </a>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-end pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-sm text-stone-500 hover:text-stone-300 transition-colors"
            >
              Continue anyway
            </button>
          </div>

          {/* Footer signature */}
          <p
            className="mt-16 text-[10px] uppercase tracking-[0.2em] text-stone-600"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            MnM — Make No Mistake — Studio Manifeste
          </p>
        </div>
      </div>
    </div>
  );
}
