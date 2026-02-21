"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TerminalProps {
  className?: string;
  autoLaunchClaude?: boolean;
  claudeArgs?: string;
  onReady?: () => void;
  onExit?: (code: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XTermType = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FitAddonType = any;

export function Terminal({
  className = "",
  autoLaunchClaude = false,
  claudeArgs = "",
  onReady,
  onExit,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermType | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const connect = useCallback(async () => {
    if (!terminalRef.current) return;

    setIsLoading(true);

    try {
      // Dynamic imports for client-side only
      const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);

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
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create terminal
      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, monospace',
        theme: {
          background: "#0a0a0a",
          foreground: "#e5e5e5",
          cursor: "#f97316",
          cursorAccent: "#0a0a0a",
          selectionBackground: "#3b3b3b",
          black: "#0a0a0a",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e5e5e5",
          brightBlack: "#525252",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#fafafa",
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

      setIsLoading(false);

      // Connect WebSocket
      const wsUrl = `ws://localhost:3001?claude=${autoLaunchClaude}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        xterm.focus();

        // If we need to launch claude with specific args
        if (autoLaunchClaude && claudeArgs) {
          setTimeout(() => {
            ws.send(JSON.stringify({ type: "launch-claude", args: claudeArgs }));
          }, 600);
        }

        onReady?.();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "output":
              xterm.write(msg.data);
              break;
            case "exit":
              onExit?.(msg.exitCode);
              break;
            case "session":
              console.log("Terminal session:", msg.sessionId);
              break;
          }
        } catch (err) {
          console.error("Terminal message error:", err);
        }
      };

      ws.onerror = () => {
        setError("Failed to connect to terminal server. Make sure it's running.");
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
      };

      // Terminal input -> WebSocket
      xterm.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      // Handle resize
      const handleResize = () => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "resize",
            cols: xterm.cols,
            rows: xterm.rows,
          }));
        }
      };

      window.addEventListener("resize", handleResize);

      // Initial resize after a brief delay
      setTimeout(handleResize, 100);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } catch (err) {
      console.error("Failed to initialize terminal:", err);
      setError("Failed to initialize terminal");
      setIsLoading(false);
    }
  }, [autoLaunchClaude, claudeArgs, onReady, onExit]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    connect().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
      xtermRef.current?.dispose();
      wsRef.current?.close();
    };
  }, [connect]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
          <div className="font-medium">Terminal server not running</div>
          <div className="text-red-400/70 mt-1">
            Run: <code className="bg-red-500/20 px-2 py-0.5 rounded">bun run terminal</code>
          </div>
          <button
            onClick={() => connect()}
            className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm"
          >
            Retry Connection
          </button>
        </div>
      )}
      {isLoading && (
        <div className="bg-zinc-800 px-4 py-2 text-sm text-zinc-400">
          Loading terminal...
        </div>
      )}
      {!isLoading && !connected && !error && (
        <div className="bg-zinc-800 px-4 py-2 text-sm text-zinc-400">
          Connecting to terminal...
        </div>
      )}
      <div
        ref={terminalRef}
        className="flex-1 bg-[#0a0a0a]"
        style={{ minHeight: "300px" }}
      />
    </div>
  );
}

// Hook for terminal control
export function useTerminal() {
  const [isVisible, setIsVisible] = useState(false);

  const toggle = useCallback(() => setIsVisible(v => !v), []);
  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);

  return { isVisible, toggle, show, hide };
}
