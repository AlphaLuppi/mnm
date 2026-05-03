import { HOOK_ERROR_CODES, type HookErrorCode } from "@mnm/governed-workflows";

export interface ClassifiedHookError {
  errorCode: HookErrorCode;
  report: string;
}

/**
 * Deterministic mapping from an isolated-vm thrown value (or any other
 * runner-internal error) to a `HOOK_ERROR_CODES` member.
 *
 * Mirrors `classifyIsolateError` in `gate-runner` but with hook-specific
 * codes:
 *   - "Script execution timed out." (isolated-vm 6.x)  → HOOK_TIMEOUT
 *   - "Helper call timed out."                          → HOOK_TIMEOUT
 *   - "Isolate was disposed..."                         → HOOK_SANDBOX_CRASH
 *   - "compile failed for ..."                          → HOOK_EXCEPTION
 *   - anything else                                     → HOOK_EXCEPTION
 *
 * Network / connector errors thrown by host helpers are classified
 * separately by the helpers themselves (e.g. `HOOK_PROVIDER_NOT_ALLOWED`,
 * `HOOK_USER_NOT_CONNECTED`) — those are caught upstream and never reach
 * this function. SSRF blocks short-circuit before any fetch is issued.
 */
export function classifyHookError(value: unknown): ClassifiedHookError {
  const message = extractMessage(value);
  if (
    message.includes("Script execution timed out.") ||
    message.includes("Helper call timed out.") ||
    message.includes("Outer hook timeout")
  ) {
    return {
      errorCode: HOOK_ERROR_CODES.HOOK_TIMEOUT,
      report: `Hook timed out: ${message}`,
    };
  }
  if (message.includes("Isolate was disposed")) {
    return {
      errorCode: HOOK_ERROR_CODES.HOOK_SANDBOX_CRASH,
      report: `Sandbox crashed: ${message}`,
    };
  }
  return {
    errorCode: HOOK_ERROR_CODES.HOOK_EXCEPTION,
    report: `Hook threw: ${message}`,
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
