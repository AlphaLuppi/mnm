import type { DashboardWidget, WidgetPlacement, UserWidget } from "@mnm/shared";
import { WIDGET_DEFAULT_HEIGHTS } from "@mnm/shared";

const GRID_COLS = 12;

/** Map old span values (1-4) to direct column widths */
const SPAN_TO_WIDTH: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };

/**
 * Generate a WidgetPlacement[] from preset widgets + user widgets
 * when no V2 layout override exists.
 */
export function materializeLayout(
  presetWidgets: DashboardWidget[],
  userWidgets: UserWidget[],
): WidgetPlacement[] {
  const placements: WidgetPlacement[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  for (const w of presetWidgets) {
    const span = w.span ?? 2;
    const gridW = Math.min(SPAN_TO_WIDTH[span] ?? span * 3, GRID_COLS);
    const gridH = WIDGET_DEFAULT_HEIGHTS[w.type] ?? 5;

    if (cursorX + gridW > GRID_COLS) {
      cursorY += rowMaxH;
      cursorX = 0;
      rowMaxH = 0;
    }

    placements.push({
      widgetId: `preset:${w.type}`,
      x: cursorX,
      y: cursorY,
      w: gridW,
      h: gridH,
      props: w.props,
    });

    cursorX += gridW;
    rowMaxH = Math.max(rowMaxH, gridH);
  }

  // Advance past preset widgets
  if (cursorX > 0) {
    cursorY += rowMaxH;
    cursorX = 0;
    rowMaxH = 0;
  }

  for (const uw of userWidgets) {
    const span = Math.min(Math.max(uw.span || 2, 1), 4);
    const gridW = Math.min(SPAN_TO_WIDTH[span] ?? 6, GRID_COLS);
    const gridH = 5;

    if (cursorX + gridW > GRID_COLS) {
      cursorY += rowMaxH;
      cursorX = 0;
      rowMaxH = 0;
    }

    placements.push({
      widgetId: uw.id,
      x: cursorX,
      y: cursorY,
      w: gridW,
      h: gridH,
    });

    cursorX += gridW;
    rowMaxH = Math.max(rowMaxH, gridH);
  }

  return placements;
}

/**
 * Merge a saved V2 layout with any new widgets that weren't placed yet.
 * New widgets are appended at y=9999 (bottom), react-grid-layout compacts them.
 */
export function mergeNewWidgets(
  savedLayout: WidgetPlacement[],
  presetWidgets: DashboardWidget[],
  userWidgets: UserWidget[],
): WidgetPlacement[] {
  const existingIds = new Set(savedLayout.map((p) => p.widgetId));
  const missingPlacements: WidgetPlacement[] = [];

  for (const w of presetWidgets) {
    const id = `preset:${w.type}`;
    if (!existingIds.has(id)) {
      const span = Math.min(Math.max(w.span ?? 2, 1), 4);
      missingPlacements.push({
        widgetId: id,
        x: 0,
        y: 9999,
        w: Math.min(SPAN_TO_WIDTH[span] ?? span * 3, GRID_COLS),
        h: WIDGET_DEFAULT_HEIGHTS[w.type] ?? 5,
        props: w.props,
      });
    }
  }

  for (const uw of userWidgets) {
    if (!existingIds.has(uw.id)) {
      const span = Math.min(Math.max(uw.span || 2, 1), 4);
      missingPlacements.push({
        widgetId: uw.id,
        x: 0,
        y: 9999,
        w: Math.min(SPAN_TO_WIDTH[span] ?? 6, GRID_COLS),
        h: 5,
      });
    }
  }

  return [...savedLayout, ...missingPlacements];
}
