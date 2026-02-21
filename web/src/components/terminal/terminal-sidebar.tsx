"use client";

import { useState, useEffect } from "react";
import { NativeTerminal } from "./native-terminal";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, RotateCcw, Sparkles } from "lucide-react";

interface TerminalSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  autoLaunchClaude?: boolean;
  position?: "bottom" | "right";
}

export function TerminalSidebar({
  isOpen,
  onClose,
  autoLaunchClaude = true,
  position = "bottom",
}: TerminalSidebarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [key, setKey] = useState(0); // For forcing re-mount

  // Keyboard shortcut to toggle maximize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        if (isMaximized) {
          setIsMaximized(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isMaximized, onClose]);

  if (!isOpen) return null;

  const isBottom = position === "bottom";
  const isRight = position === "right";

  return (
    <div
      className={`
        fixed bg-[#1e1e1e] border-zinc-700 shadow-2xl z-50
        transition-all duration-200 ease-out
        ${isMaximized ? "inset-0" : ""}
        ${!isMaximized && isBottom ? "bottom-0 left-0 right-0 h-[350px] border-t" : ""}
        ${!isMaximized && isRight ? "top-0 right-0 bottom-0 w-[500px] border-l" : ""}
      `}
    >
      {/* Header - styled like VS Code/native IDEs */}
      <div className="flex items-center justify-between h-9 px-2 bg-[#252526] border-b border-zinc-700/50 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1e1e1e] rounded-t border-t border-x border-zinc-600/30 -mb-[1px]">
            <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">Terminal</span>
            {autoLaunchClaude && (
              <span className="flex items-center gap-1 text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded ml-1">
                <Sparkles className="w-2.5 h-2.5" />
                Claude
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setKey(k => k + 1)}
            className="p-1.5 hover:bg-zinc-700/50 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Restart terminal"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-zinc-700/50 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            title={isMaximized ? "Restore (Esc)" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-500/20 rounded text-zinc-500 hover:text-red-400 transition-colors"
            title="Close terminal (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div className={isMaximized ? "h-[calc(100%-36px)]" : "h-[calc(100%-36px)]"}>
        <NativeTerminal
          key={key}
          autoLaunchClaude={autoLaunchClaude}
          onExit={(code) => {
            console.log("Terminal exited with code:", code);
          }}
        />
      </div>

      {/* Resize handle for non-maximized state */}
      {!isMaximized && isBottom && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-orange-500/50 transition-colors"
          onMouseDown={(e) => {
            // TODO: Implement drag resize
            e.preventDefault();
          }}
        />
      )}
      {!isMaximized && isRight && (
        <div
          className="absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize hover:bg-orange-500/50 transition-colors"
          onMouseDown={(e) => {
            // TODO: Implement drag resize
            e.preventDefault();
          }}
        />
      )}
    </div>
  );
}
