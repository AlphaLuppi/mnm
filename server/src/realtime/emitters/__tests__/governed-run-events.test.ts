import { describe, it, expect, vi } from "vitest";
import { emitStepUpdated, emitGateEvaluated, type PublishFn } from "../governed-run-events.js";

describe("emitStepUpdated", () => {
  it("calls publish with governed_run.step_updated and the correct payload", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;
    emitStepUpdated({
      publish,
      companyId: "company-1",
      runId: "run-abc",
      stepExecId: "step-exec-xyz",
    });

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({
      companyId: "company-1",
      type: "governed_run.step_updated",
      payload: { runId: "run-abc", stepExecId: "step-exec-xyz" },
    });
  });
});

describe("emitGateEvaluated", () => {
  it("calls publish with governed_run.gate_evaluated and the correct payload", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;
    emitGateEvaluated({
      publish,
      companyId: "company-1",
      runId: "run-abc",
      stepExecId: "step-exec-xyz",
      gateResultId: "gate-result-123",
    });

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({
      companyId: "company-1",
      type: "governed_run.gate_evaluated",
      payload: {
        runId: "run-abc",
        stepExecId: "step-exec-xyz",
        gateResultId: "gate-result-123",
      },
    });
  });
});
