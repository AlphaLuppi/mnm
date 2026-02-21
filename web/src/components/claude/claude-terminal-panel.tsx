"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Sparkles, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri as checkIsTauri } from "@/lib/tauri";

interface ClaudeTerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XTermType = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FitAddonType = any;

export function ClaudeTerminalPanel({ isOpen, onClose }: ClaudeTerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTauri, setIsTauri] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Check Tauri on mount
  useEffect(() => {
    const detected = checkIsTauri();
    setIsTauri(detected);
  }, []);

  const connect = useCallback(async () => {
    if (!terminalRef.current) return;

    const tauriAvailable = checkIsTauri();
    if (!tauriAvailable) {
      setError("Native terminal requires the desktop app");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dynamic imports for client-side only
      const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] =
        await Promise.all([
          import("xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
        ]);

      // Import Tauri APIs
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      // Load xterm CSS
      if (!document.querySelector('link[href*="xterm.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css";
        document.head.appendChild(link);
      }

      // Clean up existing
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }

      // Create terminal with app-matching theme
      const xterm = new XTerm({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: 1.3,
        scrollback: 5000,
        theme: {
          // Match the app's dark theme
          background: "hsl(240 10% 3.9%)", // --background
          foreground: "hsl(0 0% 95%)", // --foreground
          cursor: "hsl(24.6 95% 53.1%)", // --primary (orange)
          cursorAccent: "hsl(240 10% 3.9%)",
          selectionBackground: "hsl(24.6 95% 53.1% / 0.3)", // Orange selection
          selectionForeground: "hsl(0 0% 98%)",
          selectionInactiveBackground: "hsl(240 3.7% 15.9%)", // --muted
          black: "hsl(240 10% 3.9%)",
          red: "#f87171",
          green: "#4ade80",
          yellow: "#facc15",
          blue: "#60a5fa",
          magenta: "#c084fc",
          cyan: "#22d3ee",
          white: "hsl(0 0% 95%)",
          brightBlack: "hsl(240 5% 34%)", // --muted-foreground
          brightRed: "#fca5a5",
          brightGreen: "#86efac",
          brightYellow: "#fde047",
          brightBlue: "#93c5fd",
          brightMagenta: "#d8b4fe",
          brightCyan: "#67e8f9",
          brightWhite: "hsl(0 0% 98%)",
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);

      xterm.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Create native terminal session with Claude auto-launch
      const sessionId = await invoke<string>("terminal_create", {
        cols: xterm.cols,
        rows: xterm.rows,
        launchClaude: true, // Auto-launch Claude
      });
      sessionIdRef.current = sessionId;

      // Listen for terminal output
      const unlistenOutput = await listen<{ session_id: string; data: string }>(
        "terminal:output",
        (event) => {
          if (event.payload.session_id === sessionId) {
            xterm.write(event.payload.data);
          }
        }
      );

      // Listen for terminal exit
      const unlistenExit = await listen<{ session_id: string; exit_code: number }>(
        "terminal:exit",
        (event) => {
          if (event.payload.session_id === sessionId) {
            xterm.writeln("\r\n[Session ended]");
            setConnected(false);
          }
        }
      );

      // Handle terminal input
      xterm.onData(async (data: string) => {
        try {
          await invoke("terminal_write", { sessionId, data });
        } catch (e) {
          console.error("Failed to write to terminal:", e);
        }
      });

      // Handle resize
      const handleResize = async () => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
        if (sessionIdRef.current && xtermRef.current) {
          try {
            await invoke("terminal_resize", {
              sessionId: sessionIdRef.current,
              cols: xtermRef.current.cols,
              rows: xtermRef.current.rows,
            });
          } catch (e) {
            console.error("Failed to resize terminal:", e);
          }
        }
      };

      window.addEventListener("resize", handleResize);

      setIsLoading(false);
      setConnected(true);
      xterm.focus();

      // Initial resize after a brief delay
      setTimeout(handleResize, 100);

      // Cleanup function
      return () => {
        window.removeEventListener("resize", handleResize);
        unlistenOutput();
        unlistenExit();
        if (sessionIdRef.current) {
          invoke("terminal_close", { sessionId: sessionIdRef.current }).catch(
            console.error
          );
        }
      };
    } catch (err) {
      console.error("Failed to initialize terminal:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize terminal");
      setIsLoading(false);
    }
  }, []);

  // Connect when panel opens
  useEffect(() => {
    if (!isOpen || !isTauri) return;

    let cleanup: (() => void) | undefined;

    // Small delay to ensure the DOM element is ready
    const timer = setTimeout(() => {
      connect().then((cleanupFn) => {
        cleanup = cleanupFn;
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup?.();
      xtermRef.current?.dispose();
      xtermRef.current = null;
      sessionIdRef.current = null;
      setConnected(false);
    };
  }, [isOpen, isTauri, connect]);

  // Re-fit terminal when maximized state changes
  useEffect(() => {
    if (fitAddonRef.current && connected) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [isMaximized, connected]);

  if (!isOpen) return null;

  const panelWidth = isMaximized ? "w-[60%]" : "w-[480px]";

  return (
    <div className={`fixed top-0 right-0 bottom-0 ${panelWidth} bg-background border-l border-border shadow-xl z-50 flex flex-col transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Claude Code</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Connecting..." : connected ? "Connected" : "Disconnected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {connected && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Restart Claude session
                if (sessionIdRef.current && xtermRef.current) {
                  xtermRef.current.clear();
                  import("@tauri-apps/api/core").then(({ invoke }) => {
                    invoke("terminal_write", {
                      sessionId: sessionIdRef.current,
                      data: "claude\r\n"
                    });
                  });
                }
              }}
              title="Restart Claude"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Minimize" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 relative overflow-hidden">
        {!isTauri && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground">
            <div className="text-center p-6">
              <div className="text-4xl mb-4">🖥️</div>
              <h3 className="text-lg font-medium text-foreground mb-2">Desktop App Required</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Claude Code terminal is only available in the MnM desktop app.
                Run <code className="bg-muted px-2 py-0.5 rounded">bun tauri:dev</code> to launch it.
              </p>
            </div>
          </div>
        )}

        {isTauri && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
            <div className="text-center p-6">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-foreground mb-2">Connection Error</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => connect()} variant="outline">
                Retry Connection
              </Button>
            </div>
          </div>
        )}

        {isTauri && isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              <span>Starting Claude Code...</span>
            </div>
          </div>
        )}

        <div
          ref={terminalRef}
          className="absolute inset-0 p-2"
          style={{
            backgroundColor: "hsl(240 10% 3.9%)",
            opacity: (isTauri && connected && !isLoading) ? 1 : 0,
          }}
        />
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground text-center">
        Type your commands to Claude • Press Ctrl+Shift+C to toggle
      </div>
    </div>
  );
}
