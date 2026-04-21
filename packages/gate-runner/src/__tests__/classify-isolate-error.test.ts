import { describe, it, expect } from "vitest";
import { GATE_ERROR_CODES } from "@mnm/governed-workflows";
import { classifyIsolateError } from "../classify-isolate-error.js";

describe("classifyIsolateError", () => {
  it("maps isolated-vm script-timeout message to GATE_TIMEOUT", () => {
    const err = new Error("Script execution timed out.");
    const { errorCode, report } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_TIMEOUT);
    expect(report).toMatch(/timed out/i);
  });

  it("maps isolated-vm memory-limit dispose message to GATE_SANDBOX_CRASH", () => {
    const err = new Error("Isolate was disposed during execution due to memory limit");
    const { errorCode } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_SANDBOX_CRASH);
  });

  it("maps any isolated-vm disposed message to GATE_SANDBOX_CRASH", () => {
    const err = new Error("Isolate was disposed");
    const { errorCode } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_SANDBOX_CRASH);
  });

  it("maps arbitrary Error from user code to GATE_EXCEPTION", () => {
    const err = new Error("boom from user code");
    const { errorCode, report } = classifyIsolateError(err);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(report).toContain("boom from user code");
  });

  it("maps non-Error throws to GATE_EXCEPTION with a stringified message", () => {
    const { errorCode, report } = classifyIsolateError("weird string throw");
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(report).toContain("weird string throw");
  });

  it("handles null / undefined throws safely", () => {
    const { errorCode, report } = classifyIsolateError(null);
    expect(errorCode).toBe(GATE_ERROR_CODES.GATE_EXCEPTION);
    expect(report.length).toBeGreaterThan(0);
  });
});
