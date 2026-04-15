import { Component, type ErrorInfo, type ReactNode } from "react";
import { isTauri } from "@/lib/runtime";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

/**
 * TauriErrorBoundary — catches render/mount errors in the Tauri packaged app
 * and shows the same developer-preview explanation as TauriPreviewGate.
 *
 * In the web build this boundary is a transparent pass-through: if something
 * throws, it re-throws to let the normal web error handling kick in.
 */
export class TauriErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isTauri()) {
      // eslint-disable-next-line no-console
      console.error("[TauriErrorBoundary]", error, info.componentStack);
    }
    this.setState({ componentStack: info.componentStack ?? null });
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
    const componentStack = this.state.componentStack ?? "(no component stack)";

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
                v0.1.1 — developer preview
              </span>
            </div>

            {/* Heading */}
            <h1
              style={{
                fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
                fontSize: "2rem",
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                marginBottom: "1rem",
                color: "#fafaf9",
              }}
            >
              Something went wrong.
            </h1>

            {/* Error message rendered front-and-center so it is readable
                without expanding collapsed panels. */}
            <pre
              style={{
                fontSize: "0.875rem",
                color: "#fca5a5",
                backgroundColor: "#1c1917",
                border: "1px solid #7f1d1d",
                borderRadius: "0.375rem",
                padding: "0.875rem 1rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                marginBottom: "1.5rem",
              }}
            >
              {errorMessage}
            </pre>

            <p
              style={{
                fontSize: "0.9rem",
                color: "#d6d3d1",
                fontWeight: 300,
                lineHeight: 1.6,
                marginBottom: "1.5rem",
                maxWidth: "36rem",
              }}
            >
              MnM Desktop hit an unexpected error while starting up.
            </p>

            {/* Two paths */}
            <div
              style={{
                display: "grid",
                gap: "1px",
                backgroundColor: "#292524",
                border: "1px solid #292524",
                marginBottom: "2rem",
              }}
            >
              <div style={{ backgroundColor: "#0c0a09", padding: "1.5rem" }}>
                <p
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "#78716c",
                    marginBottom: "0.75rem",
                  }}
                >
                  Already have a backend
                </p>
                <p
                  style={{
                    color: "#d6d3d1",
                    fontSize: "0.875rem",
                    fontWeight: 300,
                    lineHeight: 1.6,
                    marginBottom: "1.25rem",
                  }}
                >
                  Make sure it is running. The desktop app currently expects it
                  at{" "}
                  <code
                    style={{
                      backgroundColor: "#1c1917",
                      border: "1px solid #292524",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      color: "#fafaf9",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                    }}
                  >
                    http://localhost:3100
                  </code>
                  .
                </p>
              </div>

              <div style={{ backgroundColor: "#0c0a09", padding: "1.5rem" }}>
                <p
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "#78716c",
                    marginBottom: "0.75rem",
                  }}
                >
                  Don&apos;t have the backend yet
                </p>
                <p
                  style={{
                    color: "#d6d3d1",
                    fontSize: "0.875rem",
                    fontWeight: 300,
                    lineHeight: 1.6,
                    marginBottom: "1.25rem",
                  }}
                >
                  The MnM backend is distributed on request. Visit the setup
                  guide to learn how to deploy it.
                </p>
                <a
                  href="https://mnm.alphaluppi.fr/#setup"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 1.25rem",
                    border: "1px solid #57534e",
                    color: "#fafaf9",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    letterSpacing: "0.025em",
                    borderRadius: "0.375rem",
                    textDecoration: "none",
                  }}
                >
                  Open setup guide
                  <span style={{ fontSize: "0.625rem", opacity: 0.6 }}>↗</span>
                </a>
              </div>
            </div>

            {/* Error details — open by default so users can paste the
                message into a bug report without hunting for it */}
            <details
              open
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
              <pre
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.7rem",
                  color: "#a8a29e",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  maxHeight: "16rem",
                  overflowY: "auto",
                }}
              >
                {componentStack}
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
