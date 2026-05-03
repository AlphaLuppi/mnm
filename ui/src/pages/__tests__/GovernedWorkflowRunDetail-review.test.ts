/**
 * ARTIFACT-VIEWER T4.3 — review-mode selection contract.
 *
 * Locks down the small predicate that resolves a (?step=, ?output=) pair
 * to a concrete `OutputPersisted` from the run's step list. The logic
 * lives inline inside `ReviewLayout` (no useful seam to import) — this
 * test mirrors the resolver so a regression on the snake_case payload
 * shape (or on `artifactsJson.outputs` being non-array) is caught at
 * unit-test speed.
 */
import { describe, it, expect } from "vitest";
import type { OutputPersisted } from "@mnm/shared";

interface StepLike {
  stepIdInJson: string;
  artifactsJson: { outputs?: OutputPersisted[]; data?: Record<string, unknown> } | null;
}

function resolveTarget(
  steps: StepLike[],
  selectedStep: string | null,
  selectedOutput: string | null,
): { step: StepLike | undefined; output: OutputPersisted | undefined } {
  const step = steps.find((s) => s.stepIdInJson === selectedStep);
  if (!step || !selectedOutput) return { step, output: undefined };
  const outputs =
    step.artifactsJson && typeof step.artifactsJson === "object"
      ? step.artifactsJson.outputs
      : undefined;
  if (!Array.isArray(outputs)) return { step, output: undefined };
  return { step, output: outputs.find((o) => o.name === selectedOutput) };
}

const steps: StepLike[] = [
  {
    stepIdInJson: "design",
    artifactsJson: {
      outputs: [
        { name: "spec", kind: "external_url", url: "https://example.test/spec" },
        { name: "doc", kind: "git_file", path: "docs/x.md", git_sha: "abc", branch: "b", bytes: 12 },
      ],
    },
  },
  {
    stepIdInJson: "implement",
    artifactsJson: { outputs: [] },
  },
  {
    stepIdInJson: "release",
    artifactsJson: null,
  },
];

describe("ReviewLayout — target resolver", () => {
  it("returns the step + the matching output when both are picked", () => {
    const { step, output } = resolveTarget(steps, "design", "doc");
    expect(step?.stepIdInJson).toBe("design");
    expect(output?.kind).toBe("git_file");
  });

  it("returns step but no output when output name does not match", () => {
    const { step, output } = resolveTarget(steps, "design", "missing");
    expect(step?.stepIdInJson).toBe("design");
    expect(output).toBeUndefined();
  });

  it("returns no step when stepName is unknown", () => {
    const { step, output } = resolveTarget(steps, "ghost", "doc");
    expect(step).toBeUndefined();
    expect(output).toBeUndefined();
  });

  it("handles a step with empty outputs array", () => {
    const { step, output } = resolveTarget(steps, "implement", "anything");
    expect(step?.stepIdInJson).toBe("implement");
    expect(output).toBeUndefined();
  });

  it("handles a step with null artifactsJson (gracefully degrades)", () => {
    const { step, output } = resolveTarget(steps, "release", "anything");
    expect(step?.stepIdInJson).toBe("release");
    expect(output).toBeUndefined();
  });

  it("returns nothing when no step is selected", () => {
    const { step, output } = resolveTarget(steps, null, null);
    expect(step).toBeUndefined();
    expect(output).toBeUndefined();
  });
});
