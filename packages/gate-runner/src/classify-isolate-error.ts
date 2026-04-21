import {
  GATE_ERROR_CODES,
  type GateErrorCode,
} from "@mnm/governed-workflows";

export interface ClassifiedIsolateError {
  errorCode: GateErrorCode;
  report: string;
}

/**
 * Deterministic mapping from an isolated-vm (or esbuild) thrown value to a
 * `GATE_ERROR_CODES` member. Substring matches are exact and case-sensitive;
 * the reference strings are the verbatim messages emitted by `isolated-vm`
 * 6.x as smoke-tested in the team-lead session on 2026-04-21:
 *
 *   - "Script execution timed out."
 *       → GATE_TIMEOUT
 *   - "Isolate was disposed..."  (any suffix, e.g. "...due to memory limit")
 *       → GATE_SANDBOX_CRASH
 *   - anything else
 *       → GATE_EXCEPTION
 *
 * If a future isolated-vm upgrade changes these strings, the integration
 * tests in `run-single-gate.test.ts` will catch the regression and force a
 * deliberate update here.
 */
export function classifyIsolateError(value: unknown): ClassifiedIsolateError {
  const message = extractMessage(value);
  if (message.includes("Script execution timed out.")) {
    return {
      errorCode: GATE_ERROR_CODES.GATE_TIMEOUT,
      report: `Gate timed out: ${message}`,
    };
  }
  if (message.includes("Isolate was disposed")) {
    return {
      errorCode: GATE_ERROR_CODES.GATE_SANDBOX_CRASH,
      report: `Sandbox crashed: ${message}`,
    };
  }
  return {
    errorCode: GATE_ERROR_CODES.GATE_EXCEPTION,
    report: `Gate threw: ${message}`,
  };
}

function extractMessage(value: unknown): string {
  if (value === null) return "<null thrown>";
  if (value === undefined) return "<undefined thrown>";
  if (value instanceof Error) return value.message || value.toString();
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
