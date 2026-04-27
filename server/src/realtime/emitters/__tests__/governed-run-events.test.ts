import { describe, it, expect, vi } from "vitest";
import {
  emitStepUpdated,
  emitGateEvaluated,
  emitRunCancelled,
  emitRunReactivated,
  type PublishFn,
} from "../governed-run-events.js";

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

describe("emitRunCancelled", () => {
  it("calls publish with governed_run.cancelled and the correct payload", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;
    emitRunCancelled({
      publish,
      companyId: "company-1",
      runId: "run-1",
      cancelledAt: new Date("2026-04-27T10:00:00Z"),
      cancelledByActorId: "user-1",
      cancelledByActorType: "user",
      reason: "by mistake",
      cancelledStepIds: ["step-1", "step-2"],
    });
    expect(publish).toHaveBeenCalledWith({
      companyId: "company-1",
      type: "governed_run.cancelled",
      payload: {
        runId: "run-1",
        cancelledAt: "2026-04-27T10:00:00.000Z",
        cancelledByActorId: "user-1",
        cancelledByActorType: "user",
        reason: "by mistake",
        cancelledStepIds: ["step-1", "step-2"],
      },
    });
  });
});

describe("emitRunReactivated", () => {
  it("calls publish with governed_run.reactivated and the correct payload", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;
    emitRunReactivated({
      publish,
      companyId: "company-1",
      runId: "run-1",
      reactivatedByActorId: "user-1",
      reactivatedByActorType: "user",
      reactivatedStepIds: ["step-1"],
    });
    expect(publish).toHaveBeenCalledWith({
      companyId: "company-1",
      type: "governed_run.reactivated",
      payload: {
        runId: "run-1",
        reactivatedByActorId: "user-1",
        reactivatedByActorType: "user",
        reactivatedStepIds: ["step-1"],
      },
    });
  });
});
