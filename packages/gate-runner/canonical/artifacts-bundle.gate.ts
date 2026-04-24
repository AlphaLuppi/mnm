/**
 * Canonical gate: artifacts-bundle
 *
 * Verifies that a bundle of required paths is listed across the run's
 * artifacts. Typically used as an `entry` gate: the caller declares a list
 * of paths that MUST have been produced by some previous step before the
 * current step is allowed to start.
 *
 * Lookup scope:
 *   For every required path the gate scans, in order:
 *     1. `ctx.artifact` (if defined),
 *     2. every value of `ctx.step.previous_artifacts`.
 *   Each candidate is checked against the same two shapes understood by
 *   artifact-exists: `{files: {[path]: ...}}` or `{paths: string[]}`.
 *   First missing path short-circuits with a failure — the remaining ones
 *   are not evaluated.
 *
 * Config:
 *   - `required_paths` (required, string[]): non-empty list of paths.
 *   - `hint` (optional, string): surfaced verbatim in `hints[]` on failure
 *     to guide the next actor.
 *
 * Error codes:
 *   - GATE_INVALID_CONFIG          — `required_paths` missing or malformed.
 *   - ARTIFACTS_BUNDLE_INCOMPLETE  — at least one required path is absent.
 */
import { defineGate } from "@mnm/governed-workflows";

interface ArtifactLike {
  files?: Record<string, unknown>;
  paths?: string[];
}

function hasPath(artifact: unknown, path: string): boolean {
  if (!artifact || typeof artifact !== "object") return false;
  const a = artifact as ArtifactLike;
  if (a.files && typeof a.files === "object" && path in a.files) return true;
  if (Array.isArray(a.paths) && a.paths.includes(path)) return true;
  return false;
}

export default defineGate<
  ArtifactLike,
  { required_paths?: unknown; hint?: unknown }
>(async (ctx) => {
  const required = ctx.config.required_paths;
  if (
    !Array.isArray(required) ||
    required.length === 0 ||
    !required.every((p) => typeof p === "string" && p.length > 0)
  ) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "artifacts-bundle: config.required_paths must be a non-empty string[]",
    };
  }
  const hint = typeof ctx.config.hint === "string" ? ctx.config.hint : undefined;

  const candidates: unknown[] = [];
  if (ctx.artifact !== undefined) candidates.push(ctx.artifact);
  for (const prev of Object.values(ctx.step.previous_artifacts)) {
    candidates.push(prev);
  }

  for (const path of required as string[]) {
    const found = candidates.some((c) => hasPath(c, path));
    if (!found) {
      const hints: string[] = [];
      if (hint) hints.push(hint);
      return {
        pass: false,
        error_code: "ARTIFACTS_BUNDLE_INCOMPLETE",
        report: `artifacts-bundle: missing required path ${path}`,
        ...(hints.length > 0 ? { hints } : {}),
      };
    }
  }

  return {
    pass: true,
    report: `artifacts-bundle: all ${required.length} required path(s) present`,
  };
});
