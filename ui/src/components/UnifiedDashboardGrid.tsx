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
}: UnifiedDashboardGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [resizeDims, setResizeDims] = useState<{ w: number; h: number } | null>(null);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>("lg");
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  const { width, containerRef } = useContainerWidth({ initialWidth: 1200 });

  const isDesktop = currentBreakpoint === "lg";
  const isTablet = currentBreakpoint === "md";
  const isMobile = currentBreakpoint === "sm";
  const dragEnabled = !isMobile;
  const resizeEnabled = isDesktop;

  const userWidgetMap = useMemo(
    () => new Map(userWidgets.map((w) => [w.id, w])),
    [userWidgets],
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
  }, [visiblePlacements]);

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

  const handleDragStop: EventCallback = useCallback(() => {
    setIsDragging(false);
    setActiveItem(null);
  }, []);

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

  const handleResizeStop: EventCallback = useCallback(() => {
    setIsResizing(false);
    setActiveItem(null);
    setResizeDims(null);
  }, []);

  const handleResizeViaMenu = useCallback(
    (widgetId: string, span: number) => {
      if (onResizeWidget) {
        onResizeWidget(widgetId, span);
      }
    },
    [onResizeWidget],
  );

  return (
    <div
      ref={containerRef}
      className={isDragging || isResizing ? "dashboard-grid-active" : ""}
    >
      <ResponsiveGridLayout
        className="unified-dashboard-grid"
        width={width}
        layouts={rglLayouts}
        breakpoints={BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={ROW_HEIGHT}
        margin={[16, 16]}
        containerPadding={isMobile ? [0, 0] : [0, 0]}
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
            <div key={placement.widgetId}>
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
