import { describe, it, expect } from "vitest";
import {
  materializeLayout,
  mergeNewWidgets,
} from "../services/layout-materializer.js";
import type { DashboardWidget, UserWidget } from "@mnm/shared";

function makeUserWidget(overrides: Partial<UserWidget> & { id: string }): UserWidget {
  return {
    companyId: "c1",
    userId: "u1",
    title: "Test",
    description: null,
    blocks: { schemaVersion: 1, blocks: [] },
    dataSource: null,
    position: 0,
    span: 2,
    createdByAgentId: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("materializeLayout", () => {
  it("returns empty array for empty inputs", () => {
    expect(materializeLayout([], [])).toEqual([]);
  });

  it("places preset widgets with correct positions", () => {
    const presets: DashboardWidget[] = [
      { type: "kpi-bar", span: 4 },
      { type: "run-activity", span: 1 },
      { type: "priority-chart", span: 1 },
      { type: "status-chart", span: 1 },
      { type: "success-rate", span: 1 },
    ];
    const result = materializeLayout(presets, []);

    // kpi-bar: span 4 = w:12, full row
    expect(result[0]).toMatchObject({ widgetId: "preset:kpi-bar", x: 0, y: 0, w: 12 });
    // run-activity: span 1 = w:3, new row
    expect(result[1]).toMatchObject({ widgetId: "preset:run-activity", x: 0, w: 3 });
    // priority-chart: span 1 = w:3, same row
    expect(result[2]).toMatchObject({ widgetId: "preset:priority-chart", x: 3, w: 3 });
    // status-chart: same row
    expect(result[3]).toMatchObject({ widgetId: "preset:status-chart", x: 6, w: 3 });
    // success-rate: same row
    expect(result[4]).toMatchObject({ widgetId: "preset:success-rate", x: 9, w: 3 });
    // All 4 small widgets should be on same row
    expect(result[1].y).toBe(result[2].y);
    expect(result[2].y).toBe(result[3].y);
    expect(result[3].y).toBe(result[4].y);
  });

  it("places user widgets after preset widgets", () => {
    const presets: DashboardWidget[] = [{ type: "kpi-bar", span: 4 }];
    const users = [makeUserWidget({ id: "uw-1", span: 2 })];
    const result = materializeLayout(presets, users);

    expect(result).toHaveLength(2);
    expect(result[0].widgetId).toBe("preset:kpi-bar");
    expect(result[1].widgetId).toBe("uw-1");
    // user widget should be on a row below the preset
    expect(result[1].y).toBeGreaterThan(result[0].y);
  });

  it("places only user widgets when no presets", () => {
    const users = [
      makeUserWidget({ id: "uw-1", span: 1 }),
      makeUserWidget({ id: "uw-2", span: 1 }),
    ];
    const result = materializeLayout([], users);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ widgetId: "uw-1", x: 0, y: 0, w: 3 });
    expect(result[1]).toMatchObject({ widgetId: "uw-2", x: 3, y: 0, w: 3 });
  });

  it("wraps to next row when row is full", () => {
    const presets: DashboardWidget[] = [
      { type: "active-agents", span: 3 },
      { type: "recent-issues", span: 2 },
    ];
    const result = materializeLayout(presets, []);

    // span 3 = w:9, span 2 = w:6 → 9+6=15 > 12, so second wraps
    expect(result[0]).toMatchObject({ x: 0, y: 0, w: 9 });
    expect(result[1].y).toBeGreaterThan(0);
    expect(result[1].x).toBe(0);
  });
});

describe("mergeNewWidgets", () => {
  it("returns saved layout unchanged when no new widgets", () => {
    const saved = [
      { widgetId: "preset:kpi-bar", x: 0, y: 0, w: 12, h: 2 },
    ];
    const presets: DashboardWidget[] = [{ type: "kpi-bar", span: 4 }];
    const result = mergeNewWidgets(saved, presets, []);

    expect(result).toEqual(saved);
  });

  it("appends new preset widgets at y=9999", () => {
    const saved = [
      { widgetId: "preset:kpi-bar", x: 0, y: 0, w: 12, h: 2 },
    ];
    const presets: DashboardWidget[] = [
      { type: "kpi-bar", span: 4 },
      { type: "run-activity", span: 1 },
    ];
    const result = mergeNewWidgets(saved, presets, []);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      widgetId: "preset:run-activity",
      x: 0,
      y: 9999,
      w: 3,
    });
  });

  it("appends new user widgets at y=9999", () => {
    const saved = [
      { widgetId: "preset:kpi-bar", x: 0, y: 0, w: 12, h: 2 },
    ];
    const users = [makeUserWidget({ id: "uw-new", span: 2 })];
    const result = mergeNewWidgets(saved, [{ type: "kpi-bar", span: 4 }], users);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      widgetId: "uw-new",
      x: 0,
      y: 9999,
      w: 6,
    });
  });

  it("preserves hidden widgets in saved layout", () => {
    const saved = [
      { widgetId: "preset:kpi-bar", x: 0, y: 0, w: 12, h: 2, hidden: true },
    ];
    const presets: DashboardWidget[] = [{ type: "kpi-bar", span: 4 }];
    const result = mergeNewWidgets(saved, presets, []);

    expect(result).toHaveLength(1);
    expect(result[0].hidden).toBe(true);
  });

  it("handles mixed new preset and user widgets", () => {
    const saved = [
      { widgetId: "preset:kpi-bar", x: 0, y: 0, w: 12, h: 2 },
      { widgetId: "uw-existing", x: 0, y: 2, w: 6, h: 3 },
    ];
    const presets: DashboardWidget[] = [
      { type: "kpi-bar", span: 4 },
      { type: "run-activity", span: 1 },
    ];
    const users = [
      makeUserWidget({ id: "uw-existing", span: 2 }),
      makeUserWidget({ id: "uw-new", span: 1 }),
    ];
    const result = mergeNewWidgets(saved, presets, users);

    expect(result).toHaveLength(4);
    expect(result[0].widgetId).toBe("preset:kpi-bar");
    expect(result[1].widgetId).toBe("uw-existing");
    expect(result[2].widgetId).toBe("preset:run-activity");
    expect(result[3].widgetId).toBe("uw-new");
    expect(result[2].y).toBe(9999);
    expect(result[3].y).toBe(9999);
  });
});
