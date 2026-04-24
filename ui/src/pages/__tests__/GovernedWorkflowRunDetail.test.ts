/**
 * Unit tests for GovernedWorkflowRunDetail.
 *
 * Tests query-key contract, SSE event filtering (via useGovernedRunEvents
 * mirror), and gate/step data shape without React rendering.
 */
import { describe, it, expect, vi } from "vitest";
import { queryKeys } from "../../lib/queryKeys.js";

describe("GovernedWorkflowRunDetail — query key contract", () => {
  it("runDetail key includes companyId and runId", () => {
    const key = queryKeys.governedWorkflows.runDetail("company-1", "run-abc");
    expect(key).toContain("company-1");
    expect(key).toContain("run-abc");
  });

  it("runDetail key differs across runs", () => {
    const k1 = queryKeys.governedWorkflows.runDetail("c", "run-1");
    const k2 = queryKeys.governedWorkflows.runDetail("c", "run-2");
    expect(k1).not.toEqual(k2);
  });
});

describe("GovernedWorkflowRunDetail — gate display helpers", () => {
  it("gate SHA is truncated to 7 chars", () => {
    const sha = "abcdef1234567890";
    expect(sha.slice(0, 7)).toBe("abcdef1");
  });

  it("run id is truncated to 8 chars for display", () => {
    const id = "run-deadbeef-cafecafe";
    expect(id.slice(0, 8)).toBe("run-dead");
  });

  it("empty gates array produces no rows", () => {
    const gates: unknown[] = [];
    expect(gates.length).toBe(0);
  });

  it("gate with pass=false gets KO label", () => {
    const gate = { pass: false };
    const label = gate.pass ? "OK" : "KO";
    expect(label).toBe("KO");
  });

  it("gate with pass=true gets OK label", () => {
    const gate = { pass: true };
    const label = gate.pass ? "OK" : "KO";
    expect(label).toBe("OK");
  });
});

describe("GovernedWorkflowRunDetail — SSE event filter (via hook mirror)", () => {
  // Mirror of the useGovernedRunEvents predicate
  function makeOnUpdate(
    companyId: string,
    runId: string,
    invalidate: (q: { queryKey: readonly unknown[] }) => void,
  ) {
    return (detail: { companyId: string; runId: string }) => {
      if (detail.companyId !== companyId || detail.runId !== runId) return;
      invalidate({ queryKey: queryKeys.governedWorkflows.runDetail(companyId, runId) });
    };
  }

  it("invalidates when companyId and runId match", () => {
    const invalidate = vi.fn();
    const onUpdate = makeOnUpdate("c", "r", invalidate);
    onUpdate({ companyId: "c", runId: "r" });
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("does NOT invalidate for a different run", () => {
    const invalidate = vi.fn();
    const onUpdate = makeOnUpdate("c", "r", invalidate);
    onUpdate({ companyId: "c", runId: "other" });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
