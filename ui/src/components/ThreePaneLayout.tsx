import { type ReactNode } from "react";

/* ── Simple Three Pane Layout (no resizing for now) ── */

interface ThreePaneLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
  leftTitle?: string;
  centerTitle?: string;
  rightTitle?: string;
}

export function ThreePaneLayout({
  left,
  center,
  right,
  bottom,
  leftTitle = "Context",
  centerTitle = "Work",
  rightTitle = "Tests",
}: ThreePaneLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        {/* Left — Context */}
        <div className="w-[250px] shrink-0 flex flex-col border-r border-border">
          <div className="flex items-center h-9 px-3 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{leftTitle}</span>
          </div>
          <div className="flex-1 overflow-auto p-3">{left}</div>
        </div>

        {/* Center — Work */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center h-9 px-3 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{centerTitle}</span>
          </div>
          <div className="flex-1 overflow-auto">{center}</div>
        </div>

        {/* Right — Tests */}
        <div className="w-[300px] shrink-0 flex flex-col border-l border-border">
          <div className="flex items-center h-9 px-3 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{rightTitle}</span>
          </div>
          <div className="flex-1 overflow-auto p-3">{right}</div>
        </div>
      </div>

      {/* Bottom — Timeline bar */}
      {bottom && (
        <div className="shrink-0 border-t border-border">{bottom}</div>
      )}
    </div>
  );
}
