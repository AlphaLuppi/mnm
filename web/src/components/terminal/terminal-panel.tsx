"use client";

import { useState } from "react";
import { Terminal } from "./terminal";
import { TerminalSquare, X, Maximize2, Minimize2 } from "lucide-react";

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  autoLaunchClaude?: boolean;
}

export function TerminalPanel({ isOpen, onClose, autoLaunchClaude = true }: TerminalPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed bg-zinc-900 border-t border-zinc-800 shadow-2xl z-50 transition-all duration-200 ${
        isMaximized
          ? "inset-0"
          : "bottom-0 left-0 right-0 h-[400px]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-zinc-300">Claude Code Terminal</span>
          {autoLaunchClaude && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
              Auto-launched
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
            title="Close terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div className={isMaximized ? "h-[calc(100%-40px)]" : "h-[calc(100%-40px)]"}>
        <Terminal autoLaunchClaude={autoLaunchClaude} />
      </div>
    </div>
  );
}
