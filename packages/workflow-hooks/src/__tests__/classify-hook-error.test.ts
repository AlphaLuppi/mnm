import { describe, it, expect } from "vitest";
import { classifyHookError } from "../classify-hook-error.js";

describe("classifyHookError", () => {
  it("maps ivm 'Script execution timed out.' → HOOK_TIMEOUT", () => {
    const r = classifyHookError(new Error("Script execution timed out."));
    expect(r.errorCode).toBe("HOOK_TIMEOUT");
  });

  it("maps 'Helper call timed out.' → HOOK_TIMEOUT", () => {
    const r = classifyHookError(new Error("Helper call timed out."));
    expect(r.errorCode).toBe("HOOK_TIMEOUT");
  });

  it("maps 'Outer hook timeout' → HOOK_TIMEOUT", () => {
    const r = classifyHookError(new Error("Outer hook timeout"));
    expect(r.errorCode).toBe("HOOK_TIMEOUT");
  });

  it("maps 'Isolate was disposed' → HOOK_SANDBOX_CRASH", () => {
    const r = classifyHookError(new Error("Isolate was disposed during execution"));
    expect(r.errorCode).toBe("HOOK_SANDBOX_CRASH");
  });

  it("maps generic Error → HOOK_EXCEPTION", () => {
    const r = classifyHookError(new Error("user threw"));
    expect(r.errorCode).toBe("HOOK_EXCEPTION");
    expect(r.report).toContain("user threw");
  });

  it("handles null / undefined / non-Error throws", () => {
    expect(classifyHookError(null).errorCode).toBe("HOOK_EXCEPTION");
    expect(classifyHookError(undefined).errorCode).toBe("HOOK_EXCEPTION");
    expect(classifyHookError("plain string").errorCode).toBe("HOOK_EXCEPTION");
    expect(classifyHookError({ random: "obj" }).errorCode).toBe("HOOK_EXCEPTION");
  });
});
