/**
 * ARTIFACT-VIEWER T4.1 — OutputRow + permalink helper tests.
 *
 * Pure helpers (permalink builder + click predicates). The visual rendering
 * is exercised manually + via RunArtifactsTree integration; here we lock
 * down the URL contract since hooks consumers rely on it (Inbox card,
 * future T5 sub-run navigation).
 */
import { describe, it, expect } from "vitest";
import { artifactPermalink } from "../OutputRow.js";

describe("artifactPermalink", () => {
  it("builds a /workflows/.../artifacts/<step>/<output> URL", () => {
    const url = artifactPermalink({
      workflowName: "feature-dev",
      runId: "run-abc",
      stepName: "design",
      outputName: "spec.md",
    });
    expect(url).toBe("/workflows/feature-dev/runs/run-abc/artifacts/design/spec.md");
  });

  it("encodes stepName containing slashes (composite sub-step)", () => {
    const url = artifactPermalink({
      workflowName: "feature-dev",
      runId: "run-1",
      stepName: "deploy/staging",
      outputName: "report.json",
    });
    expect(url).toContain("artifacts/deploy%2Fstaging/");
  });

  it("encodes outputName with spaces and special chars", () => {
    const url = artifactPermalink({
      workflowName: "wf",
      runId: "r",
      stepName: "s",
      outputName: "my report (final).pdf",
    });
    expect(url).toContain("/my%20report%20(final).pdf");
  });

  it("encodes workflowName with special chars", () => {
    const url = artifactPermalink({
      workflowName: "feature dev",
      runId: "r",
      stepName: "s",
      outputName: "o",
    });
    expect(url.startsWith("/workflows/feature%20dev/runs/r/")).toBe(true);
  });

  it("two different (step, output) pairs yield distinct URLs", () => {
    const a = artifactPermalink({
      workflowName: "wf",
      runId: "r",
      stepName: "s1",
      outputName: "o",
    });
    const b = artifactPermalink({
      workflowName: "wf",
      runId: "r",
      stepName: "s2",
      outputName: "o",
    });
    expect(a).not.toBe(b);
  });
});
