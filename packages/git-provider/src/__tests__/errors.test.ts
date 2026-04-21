import { describe, it, expect } from "vitest";
import {
  GIT_PROVIDER_ERROR_CODES,
  GitProviderError,
  type GitProviderErrorCode,
} from "../errors.js";

describe("GIT_PROVIDER_ERROR_CODES", () => {
  it("is a closed set of 6 codes", () => {
    expect(Object.values(GIT_PROVIDER_ERROR_CODES).sort()).toEqual(
      [
        "conflict",
        "network",
        "not_found",
        "rate_limited",
        "timeout",
        "unauthorized",
        "unknown",
      ].sort(),
    );
  });

  it("is frozen", () => {
    expect(Object.isFrozen(GIT_PROVIDER_ERROR_CODES)).toBe(true);
  });
});

describe("GitProviderError", () => {
  it("exposes code, message, status, cause", () => {
    const cause = new Error("boom");
    const err = new GitProviderError("not_found", "path not at ref", {
      status: 404,
      cause,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GitProviderError");
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("path not at ref");
    expect(err.status).toBe(404);
    expect(err.cause).toBe(cause);
  });

  it("accepts a code without options", () => {
    const err = new GitProviderError("network", "offline");
    expect(err.status).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });

  it("narrows the code type to GitProviderErrorCode", () => {
    // @ts-expect-error — "not-a-code" is not assignable
    new GitProviderError("not-a-code", "x");
    const code: GitProviderErrorCode = "timeout";
    expect(code).toBe("timeout");
  });
});
