import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeft, FolderOpen, Wrench, FlaskConical } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { cn } from "../lib/utils";

/* ── Three Pane Layout with maximize/restore ── */

type MaximizedPane = "left" | "center" | "right" | null;
type MobileTab = "left" | "center" | "right";

interface ThreePaneLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
  leftTitle?: string;
  centerTitle?: string;
  rightTitle?: string;
}

/* ── Mobile segmented control ── */

const mobileTabs: { key: MobileTab; label: string; icon: typeof FolderOpen }[] = [
  { key: "left", label: "Context", icon: FolderOpen },
  { key: "center", label: "Work", icon: Wrench },
  { key: "right", label: "Tests", icon: FlaskConical },
];

function MobilePaneSelector({
  active,
  onChange,
  titles,
}: {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  titles: { left: string; center: string; right: string };
}) {
  return (
    <div className="shrink-0 flex items-center gap-1 p-1.5 border-b border-border bg-muted/30">
      {mobileTabs.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            active === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{titles[key]}</span>
        </button>
      ))}
    </div>
  );
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
  const { isMobile } = useSidebar();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [maximized, setMaximized] = useState<MaximizedPane>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("center");

  const toggleMaximize = (pane: "left" | "center" | "right") => {
    setMaximized((prev) => (prev === pane ? null : pane));
  };

  const isHidden = (pane: "left" | "center" | "right") =>
    maximized !== null && maximized !== pane;

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <MobilePaneSelector
          active={mobileTab}
          onChange={setMobileTab}
          titles={{ left: leftTitle, center: centerTitle, right: rightTitle }}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          {mobileTab === "left" && left}
          {mobileTab === "center" && center}
          {mobileTab === "right" && <div className="p-3">{right}</div>}
        </div>
        {bottom && (
          <div className="shrink-0 border-t border-border">{bottom}</div>
        )}
      </div>
    );
  }

  /* ── Desktop layout ── */
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        {/* Left — Context */}
        {!isHidden("left") && (
          <div
            className="shrink-0 flex flex-col border-r border-border transition-[width] duration-200"
            style={{
              width: maximized === "left" ? "100%" : leftCollapsed ? "40px" : "20%",
            }}
          >
            <div
              className="flex items-center h-9 px-2 border-b border-border bg-muted/50 gap-1 select-none"
              onDoubleClick={() => toggleMaximize("left")}
            >
              <button
                onClick={() => setLeftCollapsed((c) => !c)}
                className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors cursor-pointer"
                title={leftCollapsed ? "Show context pane" : "Hide context pane"}
              >
                {leftCollapsed ? (
                  <PanelLeft className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              {!leftCollapsed && (
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{leftTitle}</span>
              )}
            </div>
            {!leftCollapsed && <div className="flex-1 min-h-0 overflow-hidden">{left}</div>}
          </div>
        )}

        {/* Center — Work */}
        {!isHidden("center") && (
          <div className="flex-1 min-w-0 flex flex-col">
            <div
              className="flex items-center h-9 px-3 border-b border-border bg-muted/50 select-none"
              onDoubleClick={() => toggleMaximize("center")}
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{centerTitle}</span>
            </div>
            <div className="flex-1 overflow-auto">{center}</div>
          </div>
        )}

        {/* Right — Tests */}
        {!isHidden("right") && (
          <div
            className="shrink-0 flex flex-col border-l border-border"
            style={{ width: maximized === "right" ? "100%" : "30%" }}
          >
            <div
              className="flex items-center h-9 px-3 border-b border-border bg-muted/50 select-none"
              onDoubleClick={() => toggleMaximize("right")}
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{rightTitle}</span>
            </div>
            <div className="flex-1 overflow-auto p-3">{right}</div>
          </div>
        )}
      </div>

      {/* Bottom — Timeline bar */}
      {bottom && !maximized && (
        <div className="shrink-0 border-t border-border">{bottom}</div>
      )}
    </div>
  );
}
