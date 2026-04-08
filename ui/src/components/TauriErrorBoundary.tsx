import { Component, type ErrorInfo, type ReactNode } from "react";
import { isTauri } from "@/lib/runtime";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * TauriErrorBoundary — catches render/mount errors in the Tauri packaged app
 * and shows the same developer-preview explanation as TauriPreviewGate.
 *
 * In the web build this boundary is a transparent pass-through: if something
 * throws, it re-throws to let the normal web error handling kick in.
 */
export class TauriErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isTauri()) {
      // eslint-disable-next-line no-console
      console.error("[TauriErrorBoundary]", error, info.componentStack);
    }
  }

  private handleRetry = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // In web builds, let the error propagate — this boundary is only
    // meant to give the Tauri packaged app a friendly fallback.
    if (!isTauri()) {
      throw this.state.error;
    }

    const errorMessage = this.state.error?.message ?? "Unknown error";

    return (
      <div
        role="alert"
        className="fixed inset-0 z-[9999] overflow-y-auto"
        style={{
          backgroundColor: "#0c0a09",
          color: "#fafaf9",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        }}
      >
        <div className="min-h-dvh flex items-center justify-center p-6 pt-20">
          <div className="max-w-2xl w-full">
            {/* Badge */}
            <div className="flex items-center gap-3 mb-10">
              <span
                className="h-px w-12"
                style={{ backgroundColor: "#44403c" }}
              ></span>
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "#a8a29e",
                }}
              >
                v0.1.0 — developer preview
              </span>
            </div>

            {/* Heading */}
            <h1
              style={{
                fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
                fontSize: "3rem",
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                marginBottom: "1.5rem",
                color: "#fafaf9",
              }}
            >
              Backend not detected.
            </h1>

            <p
              style={{
                fontSize: "1.125rem",
                color: "#d6d3d1",
                fontWeight: 300,
                lineHeight: 1.6,
                marginBottom: "2.5rem",
                maxWidth: "36rem",
              }}
            >
              This build of MnM Desktop is a{" "}
              <strong style={{ color: "#fafaf9", fontWeight: 500 }}>
                developer preview
              </strong>
              . It needs a locally running MnM backend to function. Follow the
              setup steps below, then reload.
            </p>

            {/* Setup steps */}
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
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
                <li
                  key={s.step}
                  style={{
                    display: "flex",
                    gap: "1.25rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.2em",
                      color: "#78716c",
                      paddingTop: "0.25rem",
                      width: "2.5rem",
                      flexShrink: 0,
                    }}
                  >
                    {s.step}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        color: "#e7e5e4",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {s.title}
                    </p>
                    {s.cmd && (
                      <pre
                        style={{
                          backgroundColor: "#1c1917",
                          border: "1px solid #292524",
                          borderRadius: "0.375rem",
                          padding: "0.75rem 1rem",
                          fontSize: "0.875rem",
                          color: "#d6d3d1",
                          overflowX: "auto",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                          margin: 0,
                        }}
                      >
                        <code>{s.cmd}</code>
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {/* Error details */}
            <details
              style={{
                marginTop: "2rem",
                padding: "1rem",
                backgroundColor: "#1c1917",
                border: "1px solid #292524",
                borderRadius: "0.375rem",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "#a8a29e",
                  fontSize: "0.75rem",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                }}
              >
                Error details
              </summary>
              <pre
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {errorMessage}
              </pre>
            </details>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginTop: "2rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid #292524",
              }}
            >
              <button
                type="button"
                onClick={this.handleRetry}
                style={{
                  padding: "1rem 1.75rem",
                  backgroundColor: "#fafaf9",
                  color: "#0c0a09",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  letterSpacing: "0.025em",
                  borderRadius: "0.375rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Reload and retry
              </button>
            </div>

            {/* Footer */}
            <p
              style={{
                marginTop: "4rem",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#57534e",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              MnM — Make No Mistake — Studio Manifeste
            </p>
          </div>
        </div>
      </div>
    );
  }
}
