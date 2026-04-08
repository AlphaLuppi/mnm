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
          signal: AbortSignal.timeout(4000),
        });
        if (cancelled) return;
        setStatus(res.ok ? "ok" : "down");
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
              v0.1.0 — developer preview
            </span>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl md:text-5xl leading-[1.05] tracking-tight mb-6 text-stone-50"
            style={{ fontFamily: "ui-serif, Georgia, serif", fontWeight: 500 }}
          >
            Backend not detected.
          </h1>

          <p className="text-lg text-stone-300 font-light leading-relaxed mb-10 max-w-xl">
            This build of MnM Desktop is a <strong className="text-stone-100 font-medium">developer preview</strong>.
            It relies on a locally running MnM backend. Follow the setup steps below
            to connect, then click <em>Retry</em>.
          </p>

          {/* Setup steps */}
          <ol className="space-y-5 mb-10">
            {[
              {
                step: "01",
                title: "Clone the repository",
                cmd: "git clone git@github.com:AlphaLuppi/mnm.git",
              },
              {
                step: "02",
                title: "Install dependencies",
                cmd: "cd mnm && bun install",
              },
              {
                step: "03",
                title: "Start the backend (keep this terminal open)",
                cmd: "bun run dev:server",
              },
              {
                step: "04",
                title: "Come back here and click Retry",
                cmd: null,
              },
            ].map((s) => (
              <li key={s.step} className="flex gap-5">
                <span
                  className="text-[11px] uppercase tracking-[0.2em] text-stone-500 pt-1 w-10 flex-shrink-0"
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                >
                  {s.step}
                </span>
                <div className="flex-1">
                  <p className="text-stone-200 mb-2">{s.title}</p>
                  {s.cmd && (
                    <pre
                      className="bg-stone-900 border border-stone-800 rounded-md px-4 py-3 text-sm text-stone-300 overflow-x-auto"
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                      }}
                    >
                      <code>{s.cmd}</code>
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-stone-800">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-3 px-7 py-4 bg-stone-50 text-stone-950 text-sm font-medium tracking-wide hover:bg-white transition-colors rounded-md"
            >
              Retry connection
              <span className="text-xs opacity-60">↻</span>
            </button>
            <a
              href="https://mnm.alphaluppi.fr#download"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-stone-400 hover:text-stone-100 transition-colors"
            >
              Read the setup guide ↗
            </a>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-sm text-stone-500 hover:text-stone-300 transition-colors ml-auto"
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
