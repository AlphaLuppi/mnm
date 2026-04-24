/**
 * Unit tests verifying that the governed-run SSE emitter helpers are called
 * with the correct arguments. These tests operate at the emitter level only
 * (no Postgres, no isolated-vm) to remain runnable on Windows CI.
 *
 * Integration coverage (that launchStep / completeStep actually call publish)
 * is provided by the live-events wiring in governed-workflows.ts, verified
 * by the server typecheck pass and manual QA.
 */
import { describe, it, expect, vi } from "vitest";
import {
  emitStepUpdated,
  emitGateEvaluated,
  type PublishFn,
} from "../../realtime/emitters/governed-run-events.js";

describe("governed-workflows emission — launchStep step_updated contract", () => {
  it("emits governed_run.step_updated with companyId, runId, stepExecId", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;

    // Simulate what launchStep does immediately after marking step running.
    emitStepUpdated({
      publish,
      companyId: "company-1",
      runId: "run-id-001",
      stepExecId: "step-exec-id-001",
    });

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "governed_run.step_updated",
        companyId: "company-1",
        payload: expect.objectContaining({
          runId: "run-id-001",
          stepExecId: "step-exec-id-001",
        }),
      }),
    );
  });

  it("emits governed_run.gate_evaluated with all required fields", () => {
    const publish = vi.fn() as ReturnType<typeof vi.fn> & PublishFn;

    // Simulate what launchStep does after inserting gate_result rows.
    emitGateEvaluated({
      publish,
      companyId: "company-1",
      runId: "run-id-001",
      stepExecId: "step-exec-id-001",
      gateResultId: "gate-result-id-001",
    });

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "governed_run.gate_evaluated",
        companyId: "company-1",
        payload: expect.objectContaining({
          runId: "run-id-001",
          stepExecId: "step-exec-id-001",
          gateResultId: "gate-result-id-001",
        }),
      }),
    );
  });
});
