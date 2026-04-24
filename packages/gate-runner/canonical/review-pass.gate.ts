/**
 * Canonical gate: review-pass
 *
 * Verifies that a review report has been produced for a given path and that
 * its numeric score meets a configured minimum. Used as an `exit` gate on
 * steps that require a human (or agent) review before the run continues.
 *
 * Expected artifact shape (either is accepted):
 *   { review:  { score: number, report_path: string } }
 *   { reviews: Array<{ score: number, report_path: string }> }
 *
 * Lookup scope:
 *   1. `ctx.artifact` (typical for `kind: "exit"` on the review step
 *      itself).
 *   2. Every value of `ctx.step.previous_artifacts` (fallback when a later
 *      step gates on an earlier review).
 *
 * Config:
 *   - `report_path` (required, string): the review must reference this path.
 *   - `min_score`   (required, number): the review's `score` must be `>=`
 *     this value.
 *
 * Error codes:
 *   - GATE_INVALID_CONFIG     — `report_path` missing or `min_score` not numeric.
 *   - REVIEW_MISSING          — no review found for the requested report_path.
 *   - REVIEW_SCORE_TOO_LOW    — review found but `score < min_score`.
 */
import { defineGate } from "@mnm/governed-workflows";

interface ReviewEntry {
  score?: number;
  report_path?: string;
}

interface ArtifactLike {
  review?: ReviewEntry;
  reviews?: ReviewEntry[];
}

function collectReviews(artifact: unknown): ReviewEntry[] {
  if (!artifact || typeof artifact !== "object") return [];
  const a = artifact as ArtifactLike;
  const out: ReviewEntry[] = [];
  if (a.review && typeof a.review === "object") out.push(a.review);
  if (Array.isArray(a.reviews)) {
    for (const r of a.reviews) {
      if (r && typeof r === "object") out.push(r);
    }
  }
  return out;
}

export default defineGate<
  ArtifactLike,
  { report_path?: unknown; min_score?: unknown }
>(async (ctx) => {
  const reportPath = ctx.config.report_path;
  const minScore = ctx.config.min_score;
  if (typeof reportPath !== "string" || reportPath.length === 0) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "review-pass: config.report_path is required (string)",
    };
  }
  if (typeof minScore !== "number" || Number.isNaN(minScore)) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "review-pass: config.min_score is required (number)",
    };
  }

  const candidates: unknown[] = [];
  if (ctx.artifact !== undefined) candidates.push(ctx.artifact);
  for (const prev of Object.values(ctx.step.previous_artifacts)) {
    candidates.push(prev);
  }

  const allReviews: ReviewEntry[] = [];
  for (const c of candidates) allReviews.push(...collectReviews(c));

  const matching = allReviews.filter((r) => r.report_path === reportPath);
  if (matching.length === 0) {
    return {
      pass: false,
      error_code: "REVIEW_MISSING",
      report: `review-pass: no review found for ${reportPath}`,
      hints: [
        `Produce a review artifact referencing report_path="${reportPath}" with a score >= ${minScore}.`,
      ],
    };
  }

  // Pick the highest score we have for this path.
  const best = matching.reduce<ReviewEntry>(
    (acc, r) =>
      typeof r.score === "number" && (typeof acc.score !== "number" || r.score > acc.score)
        ? r
        : acc,
    {},
  );

  if (typeof best.score !== "number") {
    return {
      pass: false,
      error_code: "REVIEW_MISSING",
      report: `review-pass: review for ${reportPath} has no numeric score`,
    };
  }

  if (best.score < minScore) {
    return {
      pass: false,
      error_code: "REVIEW_SCORE_TOO_LOW",
      report: `review-pass: ${reportPath} scored ${best.score}, expected >= ${minScore}`,
      hints: [
        `Address reviewer feedback in ${reportPath} and re-run the review step.`,
      ],
    };
  }

  return {
    pass: true,
    report: `review-pass: ${reportPath} scored ${best.score} (>= ${minScore})`,
  };
});
