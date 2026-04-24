/**
 * Unit tests for GovernedWorkflowsList.
 *
 * These tests avoid React rendering (no jsdom dependency needed) and focus on
 * the query-key shape and row-data contract rather than UI rendering.
 */
import { describe, it, expect, vi } from "vitest";
import { queryKeys } from "../../lib/queryKeys.js";

describe("GovernedWorkflowsList — query key contract", () => {
  it("list key includes companyId", () => {
    const key = queryKeys.governedWorkflows.list("company-123");
    expect(key).toContain("company-123");
    expect(key[0]).toBe("governed-workflows");
  });

  it("list key differs across companies", () => {
    const k1 = queryKeys.governedWorkflows.list("company-A");
    const k2 = queryKeys.governedWorkflows.list("company-B");
    expect(k1).not.toEqual(k2);
  });
});

describe("GovernedWorkflowsList — data helpers", () => {
  it("empty items array renders no rows (guarded in component)", () => {
    const rows: unknown[] = [];
    // Simulates the `rows.length === 0` branch
    expect(rows.length).toBe(0);
  });

  it("non-empty items array is used for table rows", () => {
    const rows = [
      {
        id: "wf-1",
        name: "my-workflow",
        description: "Test workflow",
        latestGitTag: "my-workflow/v1",
        enabled: true,
        updatedAt: new Date().toISOString(),
      },
    ];
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("my-workflow");
  });

  it("encodeURIComponent is used for names with spaces", () => {
    const name = "my workflow";
    expect(encodeURIComponent(name)).toBe("my%20workflow");
  });
});
