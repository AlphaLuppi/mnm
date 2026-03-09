import { describe, it, expect } from "vitest";
import {
  AgentStatus,
  SpecType,
  DriftSeverity,
  DriftType,
  LockType,
  UserDecision,
  WorkflowStage,
} from "@/lib/core/types";

describe("Enums", () => {
  it("AgentStatus has all expected values", () => {
    expect(AgentStatus.Idle).toBe("idle");
    expect(AgentStatus.Pending).toBe("pending");
    expect(AgentStatus.Running).toBe("running");
    expect(AgentStatus.Paused).toBe("paused");
    expect(AgentStatus.Completed).toBe("completed");
    expect(AgentStatus.Error).toBe("error");
  });

  it("SpecType has all expected values", () => {
    expect(SpecType.ProductBrief).toBe("product_brief");
    expect(SpecType.Prd).toBe("prd");
    expect(SpecType.Story).toBe("story");
    expect(SpecType.Architecture).toBe("architecture");
    expect(SpecType.Config).toBe("config");
  });

  it("DriftSeverity has all expected values", () => {
    expect(DriftSeverity.Minor).toBe("minor");
    expect(DriftSeverity.Moderate).toBe("moderate");
    expect(DriftSeverity.Critical).toBe("critical");
  });

  it("DriftType has all expected values", () => {
    expect(DriftType.ScopeExpansion).toBe("scope_expansion");
    expect(DriftType.ApproachChange).toBe("approach_change");
    expect(DriftType.DesignDeviation).toBe("design_deviation");
  });

  it("LockType has all expected values", () => {
    expect(LockType.Read).toBe("read");
    expect(LockType.Write).toBe("write");
  });

  it("UserDecision has all expected values", () => {
    expect(UserDecision.Accepted).toBe("accepted");
    expect(UserDecision.Rejected).toBe("rejected");
    expect(UserDecision.Pending).toBe("pending");
  });

  it("WorkflowStage has all expected values", () => {
    expect(WorkflowStage.Prd).toBe("prd");
    expect(WorkflowStage.Stories).toBe("stories");
    expect(WorkflowStage.Architecture).toBe("architecture");
    expect(WorkflowStage.Dev).toBe("dev");
    expect(WorkflowStage.Test).toBe("test");
    expect(WorkflowStage.Deploy).toBe("deploy");
  });
});
