/**
 * Canonical gate: artifact-exists
 *
 * Verifies that a single logical "path" is present in a step artifact. The
 * gate does NOT read the filesystem — gates run inside an isolated-vm and
 * have no fs access. Instead it inspects the structured artifact object
 * produced by `completeStep`.
 *
 * Expected artifact shape (either form is accepted):
 *   { files: { "<path>": { bytes: number } } }
 *   { paths: string[] }
 *
 * Lookup order:
 *   1. `ctx.artifact` (typical for `kind: "exit"` gates — the step that just
 *      completed).
 *   2. Every value of `ctx.step.previous_artifacts` (typical for `kind:
 *      "entry"` — any previously-completed step may have produced it).
 *
 * Config:
 *   - `path` (required, string): the file path to look up.
 *   - `min_bytes` (optional, number): if present, the matching `files[path]`
 *     entry must have `bytes >= min_bytes`. Only enforced when the artifact
 *     uses the `files` shape (bytes unknown for `paths`).
 *
 * Error codes:
 *   - GATE_INVALID_CONFIG  — `path` missing or not a string.
 *   - ARTIFACT_MISSING     — path not listed in any artifact.
 *   - ARTIFACT_TOO_SMALL   — path listed but `bytes < min_bytes`.
 */
import { defineGate } from "@mnm/governed-workflows";

interface FilesEntry {
  bytes?: number;
}

interface ArtifactLike {
  files?: Record<string, FilesEntry>;
  paths?: string[];
}

function lookup(
  artifact: unknown,
  path: string,
): { found: true; bytes: number | undefined } | { found: false } {
  if (!artifact || typeof artifact !== "object") return { found: false };
  const a = artifact as ArtifactLike;
  if (a.files && typeof a.files === "object" && path in a.files) {
    const entry = a.files[path];
    const bytes =
      entry && typeof entry === "object" && typeof entry.bytes === "number"
        ? entry.bytes
        : undefined;
    return { found: true, bytes };
  }
  if (Array.isArray(a.paths) && a.paths.includes(path)) {
    return { found: true, bytes: undefined };
  }
  return { found: false };
}

export default defineGate<ArtifactLike, { path?: unknown; min_bytes?: unknown }>(
  async (ctx) => {
    const path = ctx.config.path;
    if (typeof path !== "string" || path.length === 0) {
      return {
        pass: false,
        error_code: "GATE_INVALID_CONFIG",
        report: "artifact-exists: config.path is required (string)",
      };
    }
    const minBytes =
      typeof ctx.config.min_bytes === "number" ? ctx.config.min_bytes : undefined;

    // Try the current step's artifact first, then previously-completed steps.
    const candidates: unknown[] = [ctx.artifact];
    for (const prev of Object.values(ctx.step.previous_artifacts)) {
      candidates.push(prev);
    }

    for (const candidate of candidates) {
      const hit = lookup(candidate, path);
      if (hit.found) {
        if (minBytes !== undefined && typeof hit.bytes === "number" && hit.bytes < minBytes) {
          return {
            pass: false,
            error_code: "ARTIFACT_TOO_SMALL",
            report: `artifact-exists: ${path} is ${hit.bytes} bytes, expected >= ${minBytes}`,
            hints: [`Enrich or expand ${path} so it carries at least ${minBytes} bytes of content.`],
          };
        }
        return {
          pass: true,
          report: `artifact-exists: ${path} present${
            typeof hit.bytes === "number" ? ` (${hit.bytes} bytes)` : ""
          }`,
        };
      }
    }

    return {
      pass: false,
      error_code: "ARTIFACT_MISSING",
      report: `artifact-exists: ${path} not listed in any artifact`,
      hints: [
        `Make sure the step's artifact records ${path} under files[] or paths[].`,
      ],
    };
  },
);
