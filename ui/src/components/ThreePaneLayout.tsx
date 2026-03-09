import { type ReactNode, useState, useCallback } from "react";
import {
  Group as ResizablePanelGroup,
  Panel as ResizablePanel,
  Separator as ResizableHandle,
  usePanelRef,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

/* ── PaneHeader ── */

function PaneHeader({
  title,
  onDoubleClick,
  children,
}: {
  title: string;
  onDoubleClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between h-9 px-3 border-b border-border bg-muted/50 select-none shrink-0"
      onDoubleClick={onDoubleClick}
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </span>
      {children}
    </div>
  );
}

/* ── ThreePaneLayout ── */

interface ThreePaneLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
  leftTitle?: string;
  centerTitle?: string;
  rightTitle?: string;
}

type MaximizedPane = "left" | "center" | "right" | null;

export function ThreePaneLayout({
  left,
  center,
  right,
  bottom,
  leftTitle = "Context",
  centerTitle = "Work",
  rightTitle = "Tests",
}: ThreePaneLayoutProps) {
  const [maximized, setMaximized] = useState<MaximizedPane>(null);

  const leftRef = usePanelRef();
  const centerRef = usePanelRef();
  const rightRef = usePanelRef();

  const toggleMaximize = useCallback(
    (pane: "left" | "center" | "right") => {
      const refs = { left: leftRef, center: centerRef, right: rightRef };
      if (maximized === pane) {
        // Restore defaults
        leftRef.current?.resize(25);
        centerRef.current?.resize(50);
        rightRef.current?.resize(25);
        setMaximized(null);
      } else {
        for (const [key, ref] of Object.entries(refs)) {
          if (key === pane) {
            ref.current?.expand();
            ref.current?.resize(100);
          } else {
            ref.current?.collapse();
          }
        }
        setMaximized(pane);
      }
    },
    [maximized, leftRef, centerRef, rightRef],
  );

  return (
    <div className="flex flex-col h-full">
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1 min-h-0"
      >
        {/* Left — Context */}
        <ResizablePanel
          panelRef={leftRef}
          defaultSize={25}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="flex flex-col"
        >
          <PaneHeader
            title={leftTitle}
            onDoubleClick={() => toggleMaximize("left")}
          />
          <div className="flex-1 overflow-auto p-3">{left}</div>
        </ResizablePanel>

        <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />

        {/* Center — Work */}
        <ResizablePanel
          panelRef={centerRef}
          defaultSize={50}
          minSize={30}
          collapsible
          collapsedSize={0}
          className="flex flex-col"
        >
          <PaneHeader
            title={centerTitle}
            onDoubleClick={() => toggleMaximize("center")}
          />
          <div className="flex-1 overflow-auto p-3">{center}</div>
        </ResizablePanel>

        <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />

        {/* Right — Tests */}
        <ResizablePanel
          panelRef={rightRef}
          defaultSize={25}
          minSize={15}
          collapsible
          collapsedSize={0}
          className="flex flex-col"
        >
          <PaneHeader
            title={rightTitle}
            onDoubleClick={() => toggleMaximize("right")}
          />
          <div className="flex-1 overflow-auto p-3">{right}</div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bottom — Timeline bar */}
      {bottom && (
        <div className="shrink-0 border-t border-border">{bottom}</div>
      )}
    </div>
  );
}
