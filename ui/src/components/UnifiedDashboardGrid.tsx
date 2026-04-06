import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";
import type {
  Layout,
  LayoutItem,
  ResponsiveLayouts,
  EventCallback,
} from "react-grid-layout";
import type { WidgetPlacement, UserWidget, ContentDocument } from "@mnm/shared";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { ContentRenderer } from "./blocks/ContentRenderer";
import { WidgetCard } from "./WidgetCard";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

const GRID_COLS = { lg: 12, md: 6, sm: 3 };
const BREAKPOINTS = { lg: 1024, md: 768, sm: 0 };
const ROW_HEIGHT = 40;
const MIN_REFRESH_SECONDS = 60;

interface UnifiedDashboardGridProps {
  companyId: string;
  placements: WidgetPlacement[];
  userWidgets: UserWidget[];
  onLayoutChange: (placements: WidgetPlacement[]) => void;
  onDeleteWidget?: (widgetId: string) => void;
  onResizeWidget?: (widgetId: string, span: number) => void;
  onAddWidget?: () => void;
  /** True if the user has never had a V2 layout (first time) */
  isNewUser?: boolean;
}

/** Convert a grid width (in 12-col units) to a visual span (1-4) */
function widthToSpan(w: number): number {
  return Math.max(1, Math.min(4, Math.round(w / 3)));
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2 p-1">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/** Renders a custom (user) widget with optional data source */
function CustomWidgetContent({ widget }: { widget: UserWidget }) {
  const ds = widget.dataSource;
  const refreshMs = ds?.refreshInterval
    ? Math.max(ds.refreshInterval, MIN_REFRESH_SECONDS) * 1000
    : undefined;

  const { data: fetchedBlocks, isLoading, isError } = useQuery({
    queryKey: ["widget-data", widget.id, ds?.endpoint],
    queryFn: async () => {
      if (!ds?.endpoint) return null;
      const params = ds.params
        ? `?${new URLSearchParams(Object.entries(ds.params).map(([k, v]) => [k, String(v)])).toString()}`
        : "";
      return api.get<ContentDocument>(`${ds.endpoint}${params}`);
    },
    enabled: !!ds?.endpoint,
    refetchInterval: refreshMs,
    staleTime: refreshMs ? refreshMs / 2 : undefined,
  });

  const activeBlocks = fetchedBlocks ?? widget.blocks;

  return (
    <>
      {isLoading && !fetchedBlocks ? (
        <WidgetSkeleton />
      ) : (
        <ContentRenderer blocks={activeBlocks} body={widget.description} className="text-sm" />
      )}
      {isError && (
        <p className="mt-2 text-xs text-destructive">Failed to refresh data</p>
      )}
    </>
  );
}

export function UnifiedDashboardGrid({
  companyId,
  placements,
  userWidgets,
  onLayoutChange,
  onDeleteWidget,
  onResizeWidget,
  onAddWidget,
  isNewUser,
}: UnifiedDashboardGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [resizeDims, setResizeDims] = useState<{ w: number; h: number } | null>(null);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>("lg");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  const { width: rawWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });
  const width = Math.max(rawWidth, 300);

  const isDesktop = currentBreakpoint === "lg";
  const isMobile = currentBreakpoint === "sm";
  const dragEnabled = !isMobile;
  const resizeEnabled = isDesktop;

  const userWidgetMap = useMemo(
    () => new Map(userWidgets.map((w) => [w.id, w])),
    [userWidgets],
  );

  const getWidgetTitle = useCallback(
    (widgetId: string): string => {
      if (widgetId.startsWith("preset:")) {
        const type = widgetId.replace("preset:", "");
        return WIDGET_REGISTRY[type]?.label ?? "Widget";
      }
      return userWidgetMap.get(widgetId)?.title ?? "Widget";
    },
    [userWidgetMap],
  );

  // Visible (non-hidden) placements
  const visiblePlacements = useMemo(
    () => placements.filter((p) => !p.hidden),
    [placements],
  );

  // Convert to RGL layout with per-widget constraints from registry
  const rglLayouts = useMemo((): ResponsiveLayouts => {
    const lg: LayoutItem[] = visiblePlacements.map((p) => {
      const isPreset = p.widgetId.startsWith("preset:");
      const widgetType = isPreset ? p.widgetId.replace("preset:", "") : null;
      const def = widgetType ? WIDGET_REGISTRY[widgetType] : null;
      return {
        i: p.widgetId,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        minW: def?.minW ?? 3,
        maxW: def?.maxW ?? 12,
        minH: def?.minH ?? 1,
        maxH: def?.maxH ?? 6,
        isDraggable: dragEnabled,
        isResizable: resizeEnabled,
      };
    });
    return { lg };
  }, [visiblePlacements, dragEnabled, resizeEnabled]);

  const handleLayoutChange = useCallback(
    (currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      // Only persist lg layout — other breakpoints are auto-calculated by RGL
      const lgLayout = allLayouts.lg;
      if (!lgLayout) return;

      const updated: WidgetPlacement[] = lgLayout.map((item) => {
        const existing = placementsRef.current.find((p) => p.widgetId === item.i);
        return {
          widgetId: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          hidden: existing?.hidden,
          props: existing?.props,
        };
      });

      // Re-add hidden placements
      const visibleIds = new Set(lgLayout.map((l) => l.i));
      for (const p of placementsRef.current) {
        if (p.hidden && !visibleIds.has(p.widgetId)) {
          updated.push(p);
        }
      }

      onLayoutChange(updated);
    },
    [onLayoutChange],
  );

  const handleDragStart: EventCallback = useCallback((_layout, _oldItem, newItem) => {
    setIsDragging(true);
    if (newItem) setActiveItem(newItem.i);
  }, []);

  const handleDragStop: EventCallback = useCallback((_layout, _oldItem, newItem) => {
    setIsDragging(false);
    if (newItem) {
      const title = getWidgetTitle(newItem.i);
      setLiveAnnouncement(`Widget ${title} moved to row ${newItem.y + 1}, column ${newItem.x + 1}`);
    }
    setActiveItem(null);
  }, [getWidgetTitle]);

  const handleResizeStart: EventCallback = useCallback((_layout, _oldItem, newItem) => {
    setIsResizing(true);
    if (newItem) {
      setActiveItem(newItem.i);
      setResizeDims({ w: newItem.w, h: newItem.h });
    }
  }, []);

  const handleResize: EventCallback = useCallback((_layout, _oldItem, newItem) => {
    if (newItem) setResizeDims({ w: newItem.w, h: newItem.h });
  }, []);

  const handleResizeStop: EventCallback = useCallback((_layout, _oldItem, newItem) => {
    setIsResizing(false);
    if (newItem) {
      const title = getWidgetTitle(newItem.i);
      setLiveAnnouncement(
        `Widget ${title} resized to ${widthToSpan(newItem.w)} columns, ${newItem.h} rows`,
      );
    }
    setActiveItem(null);
    setResizeDims(null);
  }, [getWidgetTitle]);

  const handleResizeViaMenu = useCallback(
    (widgetId: string, span: number) => {
      if (onResizeWidget) {
        onResizeWidget(widgetId, span);
      }
    },
    [onResizeWidget],
  );

  const handleKeyboardMove = useCallback(
    (widgetId: string, dx: number, dy: number) => {
      const updated = placementsRef.current.map((p) => {
        if (p.widgetId !== widgetId) return p;
        return {
          ...p,
          x: Math.max(0, Math.min(12 - p.w, p.x + dx)),
          y: Math.max(0, p.y + dy),
        };
      });
      onLayoutChange(updated);
      const title = getWidgetTitle(widgetId);
      const moved = updated.find((p) => p.widgetId === widgetId);
      if (moved) {
        setLiveAnnouncement(`Widget ${title} moved to row ${moved.y + 1}, column ${moved.x + 1}`);
      }
    },
    [onLayoutChange, getWidgetTitle],
  );

  const handleKeyboardResize = useCallback(
    (widgetId: string, dw: number, dh: number) => {
      const updated = placementsRef.current.map((p) => {
        if (p.widgetId !== widgetId) return p;
        const isPreset = p.widgetId.startsWith("preset:");
        const type = isPreset ? p.widgetId.replace("preset:", "") : null;
        const def = type ? WIDGET_REGISTRY[type] : null;
        const newW = Math.max(def?.minW ?? 3, Math.min(def?.maxW ?? 12, p.w + dw));
        const newH = Math.max(def?.minH ?? 1, Math.min(def?.maxH ?? 6, p.h + dh));
        return { ...p, w: newW, h: newH };
      });
      onLayoutChange(updated);
      const title = getWidgetTitle(widgetId);
      const resized = updated.find((p) => p.widgetId === widgetId);
      if (resized) {
        setLiveAnnouncement(
          `Widget ${title} resized to ${widthToSpan(resized.w)} columns, ${resized.h} rows`,
        );
      }
    },
    [onLayoutChange, getWidgetTitle],
  );

  // Empty state: no visible widgets
  if (visiblePlacements.length === 0 && onAddWidget) {
    return (
      <div ref={containerRef}>
        <DashboardEmptyState
          variant={isNewUser ? "new-user" : "all-deleted"}
          onAddWidget={onAddWidget}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={isDragging || isResizing ? "dashboard-grid-active" : ""}
      role="region"
      aria-label="Dashboard widget grid"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      <ResponsiveGridLayout
        className="unified-dashboard-grid"
        width={width}
        layouts={rglLayouts}
        breakpoints={BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={ROW_HEIGHT}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        compactor={verticalCompactor}
        dragConfig={{ handle: ".widget-drag-handle" }}
        onBreakpointChange={(bp) => setCurrentBreakpoint(bp)}
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
      >
        {visiblePlacements.map((placement) => {
          const isPreset = placement.widgetId.startsWith("preset:");
          const widgetType = isPreset
            ? placement.widgetId.replace("preset:", "")
            : null;
          const presetDef = widgetType ? WIDGET_REGISTRY[widgetType] : null;
          const userWidget = !isPreset
            ? userWidgetMap.get(placement.widgetId)
            : null;
          const title = presetDef?.label ?? userWidget?.title ?? "Widget";
          const currentSpan = widthToSpan(placement.w);

          const isActive = activeItem === placement.widgetId;
          const resizeLabel =
            isActive && isResizing && resizeDims
              ? `${widthToSpan(resizeDims.w)}x${resizeDims.h}`
              : undefined;

          return (
            <div
              key={placement.widgetId}
              role="listitem"
              aria-label={`${title} widget`}
            >
              <WidgetCard
                title={title}
                widgetId={placement.widgetId}
                currentSpan={currentSpan}
                isDragging={isActive && isDragging}
                isResizing={isActive && isResizing}
                resizeLabel={resizeLabel}
                onResize={handleResizeViaMenu}
                onDelete={onDeleteWidget}
                disableDrag={!dragEnabled}
                disableResize={!resizeEnabled}
                onKeyboardMove={handleKeyboardMove}
                onKeyboardResize={handleKeyboardResize}
              >
                {isPreset && presetDef ? (
                  <Suspense fallback={<WidgetSkeleton />}>
                    <presetDef.component
                      companyId={companyId}
                      span={currentSpan}
                      props={placement.props}
                    />
                  </Suspense>
                ) : userWidget ? (
                  <CustomWidgetContent widget={userWidget} />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Widget not found
                  </div>
                )}
              </WidgetCard>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
