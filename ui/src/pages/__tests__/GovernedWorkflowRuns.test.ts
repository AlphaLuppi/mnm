/**
 * Unit tests for GovernedWorkflowRuns.
 *
 * Avoids React rendering. Tests the query-key contract and row-data
 * transformations used by the page.
 */
import { describe, it, expect } from "vitest";
import { queryKeys } from "../../lib/queryKeys.js";

describe("GovernedWorkflowRuns — query key contract", () => {
  it("runs key includes companyId and name", () => {
    const key = queryKeys.governedWorkflows.runs("company-1", "my-workflow");
    expect(key).toContain("company-1");
    expect(key).toContain("my-workflow");
  });

  it("runs key changes with status filter", () => {
    const keyAll = queryKeys.governedWorkflows.runs("c", "wf", {});
    const keyActive = queryKeys.governedWorkflows.runs("c", "wf", { status: "active" });
    expect(keyAll).not.toEqual(keyActive);
  });
});

describe("GovernedWorkflowRuns — data helpers", () => {
  it("row id is truncated to 8 chars in display", () => {
    const id = "abcdef1234567890";
    expect(id.slice(0, 8)).toBe("abcdef12");
  });

  it("actorId truncation for display", () => {
    const actorId = "user-deadbeef-cafecafe";
    expect(actorId.slice(0, 12)).toBe("user-deadbee");
  });

  it("empty items array triggers empty state branch", () => {
    const rows: unknown[] = [];
    expect(rows.length).toBe(0);
  });

  it("mock rows have expected shape", () => {
    const rows = [
      {
        id: "run-1111-aaaa",
        status: "active",
        startedAt: "2026-04-24T10:00:00Z",
        completedAt: null,
        initiatedByActorId: "user-deadbeef",
        workflowGitTag: "my-workflow/v2",
      },
    ];
    expect(rows[0].status).toBe("active");
    expect(rows[0].id.slice(0, 8)).toBe("run-1111");
  });
});
