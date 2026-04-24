import { describe, it, expect } from "vitest";
import gate from "../review-pass.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "wf", git_tag: "v1", params: {} },
    step: { id: "review", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

describe("review-pass canonical gate", () => {
  it("passes when review.score >= min_score and path matches", async () => {
    const result = await gate(
      ctx({
        artifact: { review: { score: 5, report_path: "docs/review.md" } },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.report).toContain("5");
  });

  it("passes when score equals min_score", async () => {
    const result = await gate(
      ctx({
        artifact: { review: { score: 4, report_path: "docs/review.md" } },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("supports reviews[] arrays and picks the best matching entry", async () => {
    const result = await gate(
      ctx({
        artifact: {
          reviews: [
            { score: 2, report_path: "docs/review.md" },
            { score: 5, report_path: "docs/review.md" },
            { score: 3, report_path: "docs/other.md" },
          ],
        },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.report).toContain("5");
  });

  it("fails with REVIEW_SCORE_TOO_LOW when score is below threshold", async () => {
    const result = await gate(
      ctx({
        artifact: { review: { score: 2, report_path: "docs/review.md" } },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("REVIEW_SCORE_TOO_LOW");
    expect(result.report).toContain("2");
    expect(result.report).toContain("4");
  });

  it("fails with REVIEW_MISSING when no review matches the path", async () => {
    const result = await gate(
      ctx({
        artifact: { review: { score: 5, report_path: "docs/other.md" } },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("REVIEW_MISSING");
    expect(result.report).toContain("docs/review.md");
  });

  it("fails with REVIEW_MISSING when no review objects are present at all", async () => {
    const result = await gate(
      ctx({
        artifact: { files: {} },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("REVIEW_MISSING");
  });

  it("falls back to previous_artifacts", async () => {
    const result = await gate(
      ctx({
        step: {
          id: "post-review",
          previous_artifacts: {
            "review": { review: { score: 5, report_path: "docs/review.md" } },
          },
        },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("returns GATE_INVALID_CONFIG when report_path is missing", async () => {
    const result = await gate(ctx({ config: { min_score: 4 } }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("returns GATE_INVALID_CONFIG when min_score is missing", async () => {
    const result = await gate(
      ctx({ config: { report_path: "docs/review.md" } }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("returns GATE_INVALID_CONFIG when min_score is not numeric", async () => {
    const result = await gate(
      ctx({ config: { report_path: "docs/review.md", min_score: "four" } }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("reports REVIEW_MISSING when the only matching review has no numeric score", async () => {
    const result = await gate(
      ctx({
        artifact: { review: { report_path: "docs/review.md" } },
        config: { report_path: "docs/review.md", min_score: 4 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("REVIEW_MISSING");
  });
});
