"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { isTauri as checkIsTauri } from "@/lib/tauri";

interface NativeTerminalProps {
  className?: string;
  autoLaunchClaude?: boolean;
  onReady?: () => void;
  onExit?: (code: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XTermType = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FitAddonType = any;

export function NativeTerminal({
  className = "",
  autoLaunchClaude = false,
  onReady,
  onExit,
}: NativeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTauri, setIsTauri] = useState(false);

  // Check Tauri on mount
  useEffect(() => {
    const detected = checkIsTauri();
    console.log("[NativeTerminal] Tauri detected:", detected);
    setIsTauri(detected);
  }, []);

  const connect = useCallback(async () => {
    console.log("[NativeTerminal] connect() called");
    if (!terminalRef.current) {
      console.log("[NativeTerminal] No terminalRef, returning");
      return;
    }

    const tauriAvailable = checkIsTauri();
    console.log("[NativeTerminal] Tauri available:", tauriAvailable);
    if (!tauriAvailable) {
      setError("Native terminal requires the desktop app");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

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

      // Load xterm CSS via link tag if not already loaded
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

      // Create terminal with native-feeling theme
      const xterm = new XTerm({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: 1.2,
        theme: {
          background: "#1a1a1a",
          foreground: "#d4d4d4",
          cursor: "#d4d4d4",
          cursorAccent: "#1a1a1a",
          selectionBackground: "#264f78",
          selectionForeground: "#ffffff",
          selectionInactiveBackground: "#3a3d41",
          black: "#1a1a1a",
          red: "#f14c4c",
          green: "#23d18b",
          yellow: "#f5f543",
          blue: "#3b8eea",
          magenta: "#d670d6",
          cyan: "#29b8db",
          white: "#d4d4d4",
          brightBlack: "#666666",
          brightRed: "#f14c4c",
          brightGreen: "#23d18b",
          brightYellow: "#f5f543",
          brightBlue: "#3b8eea",
          brightMagenta: "#d670d6",
          brightCyan: "#29b8db",
          brightWhite: "#ffffff",
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

      // Create native terminal session
      console.log("[NativeTerminal] Creating terminal session...");
      console.log("[NativeTerminal] invoke function:", typeof invoke);

      const sessionId = await invoke<string>("terminal_create", {
        cols: xterm.cols,
        rows: xterm.rows,
        launchClaude: autoLaunchClaude,
      });
      console.log("[NativeTerminal] Session created:", sessionId);
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
            onExit?.(event.payload.exit_code);
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
        fitAddon.fit();
        if (sessionIdRef.current) {
          try {
            await invoke("terminal_resize", {
              sessionId: sessionIdRef.current,
              cols: xterm.cols,
              rows: xterm.rows,
            });
          } catch (e) {
            console.error("Failed to resize terminal:", e);
          }
        }
      };

      window.addEventListener("resize", handleResize);

      setIsLoading(false);
      setConnected(true);
      setError(null);
      xterm.focus();
      onReady?.();

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
  }, [autoLaunchClaude, onReady, onExit]);

  // Only attempt to connect once we've determined we're in Tauri
  useEffect(() => {
    if (!isTauri) return;

    let cleanup: (() => void) | undefined;

    connect().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
      xtermRef.current?.dispose();
    };
  }, [connect, isTauri]);

  // Show loading while determining environment
  if (!isTauri && isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-zinc-900 text-zinc-400 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-zinc-500 border-t-orange-500 rounded-full animate-spin" />
          <span>Initializing...</span>
        </div>
      </div>
    );
  }

  // Not in Tauri - show fallback message
  if (!isTauri && !isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-zinc-900 text-zinc-400 ${className}`}>
        <div className="text-center p-6">
          <div className="text-4xl mb-4">🖥️</div>
          <h3 className="text-lg font-medium text-zinc-200 mb-2">Desktop App Required</h3>
          <p className="text-sm text-zinc-500 max-w-xs">
            The native terminal is only available in the MnM desktop app.
            Run <code className="bg-zinc-800 px-2 py-0.5 rounded">bun tauri:dev</code> to launch it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
          <div className="font-medium">Terminal Error</div>
          <div className="text-red-400/70 mt-1">{error}</div>
          <button
            onClick={() => connect()}
            className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm"
          >
            Retry
          </button>
        </div>
      )}
      {isLoading && (
        <div className="flex items-center gap-2 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-400">
          <div className="w-3 h-3 border-2 border-zinc-500 border-t-orange-500 rounded-full animate-spin" />
          Initializing terminal...
        </div>
      )}
      {!isLoading && !connected && !error && (
        <div className="bg-zinc-800/50 px-4 py-2 text-sm text-zinc-400">
          Connecting...
        </div>
      )}
      <div
        ref={terminalRef}
        className="flex-1 bg-[#1a1a1a]"
        style={{ minHeight: "200px" }}
      />
    </div>
  );
}
