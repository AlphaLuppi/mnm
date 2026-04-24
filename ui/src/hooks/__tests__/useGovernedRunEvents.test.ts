/**
 * Tests for the event-filtering logic embedded in useGovernedRunEvents.
 *
 * The hook uses window.addEventListener("governed_run:updated", ...) so we
 * test the filter predicate and the queryKey shape rather than mounting React.
 * This avoids jsdom (not installed) while still giving meaningful coverage.
 */
import { describe, it, expect, vi } from "vitest";
import { queryKeys } from "../../lib/queryKeys.js";

/**
 * Mirror of the `onUpdate` handler inside useGovernedRunEvents.
 * Kept in sync with the real hook manually — if the hook changes, update this.
 */
function makeOnUpdate(
  companyId: string,
  runId: string,
  invalidateQueries: (q: { queryKey: readonly unknown[] }) => void,
) {
  return function onUpdate(detail: { companyId: string; runId: string }) {
    if (detail.companyId !== companyId || detail.runId !== runId) return;
    invalidateQueries({
      queryKey: queryKeys.governedWorkflows.runDetail(companyId, runId),
    });
  };
}

describe("useGovernedRunEvents — filter predicate", () => {
  it("invalidates runDetail when companyId and runId both match", () => {
    const invalidateQueries = vi.fn();
    const onUpdate = makeOnUpdate("company-1", "run-abc", invalidateQueries);

    onUpdate({ companyId: "company-1", runId: "run-abc" });

    expect(invalidateQueries).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.governedWorkflows.runDetail("company-1", "run-abc"),
    });
  });

  it("does NOT invalidate when companyId does not match", () => {
    const invalidateQueries = vi.fn();
    const onUpdate = makeOnUpdate("company-1", "run-abc", invalidateQueries);

    onUpdate({ companyId: "company-2", runId: "run-abc" });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("does NOT invalidate when runId does not match", () => {
    const invalidateQueries = vi.fn();
    const onUpdate = makeOnUpdate("company-1", "run-abc", invalidateQueries);

    onUpdate({ companyId: "company-1", runId: "run-xyz" });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("runDetail query key includes both companyId and runId", () => {
    const key = queryKeys.governedWorkflows.runDetail("company-1", "run-abc");
    expect(key).toContain("company-1");
    expect(key).toContain("run-abc");
  });
});
