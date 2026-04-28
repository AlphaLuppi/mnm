import { describe, expect, it } from "vitest";
import pino from "pino";

/**
 * Regression test for upstream Paperclip PR #2659:
 * Bearer tokens (and other auth headers) must not leak into structured logs.
 *
 * MnM extends the upstream fix with additional redaction paths:
 * - cookie header (session leak)
 * - x-mnm-api-key / x-api-key (custom headers)
 * - reqBody.password / token / apiKey / secret (request payload)
 */
describe("logger redaction (regression for upstream PR #2659)", () => {
  function makeLogger() {
    const captured: string[] = [];
    const logger = pino(
      {
        level: "debug",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'req.headers["x-mnm-api-key"]',
            'req.headers["x-api-key"]',
            "reqBody.password",
            "reqBody.token",
            "reqBody.apiKey",
            "reqBody.secret",
          ],
          censor: "[REDACTED]",
        },
      },
      {
        write(chunk: string) {
          captured.push(chunk);
        },
      } as any,
    );
    return { logger, captured };
  }

  it("redacts Authorization Bearer tokens from request headers", () => {
    const { logger, captured } = makeLogger();
    logger.info(
      {
        req: {
          method: "GET",
          url: "/api/companies/abc",
          headers: { authorization: "Bearer super-secret-token-xyz" },
        },
      },
      "request",
    );

    const output = captured.join("");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("super-secret-token-xyz");
    expect(output).not.toMatch(/Bearer\s+[A-Za-z0-9._\-]+/);
  });

  it("redacts cookie headers", () => {
    const { logger, captured } = makeLogger();
    logger.info(
      {
        req: {
          headers: { cookie: "session=abc123; csrf=def456" },
        },
      },
      "request",
    );

    const output = captured.join("");
    expect(output).not.toContain("abc123");
    expect(output).not.toContain("def456");
  });

  it("redacts custom MnM API key headers", () => {
    const { logger, captured } = makeLogger();
    logger.info(
      {
        req: {
          headers: {
            "x-mnm-api-key": "mnm-key-secret-xyz",
            "x-api-key": "another-key-secret",
          },
        },
      },
      "request",
    );

    const output = captured.join("");
    expect(output).not.toContain("mnm-key-secret-xyz");
    expect(output).not.toContain("another-key-secret");
  });

  it("redacts password/token/apiKey/secret in request body", () => {
    const { logger, captured } = makeLogger();
    logger.warn(
      {
        reqBody: {
          email: "user@example.com",
          password: "hunter2",
          token: "jwt-leak-1",
          apiKey: "leaked-key",
          secret: "leaked-secret",
        },
      },
      "validation error",
    );

    const output = captured.join("");
    expect(output).toContain("user@example.com");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("jwt-leak-1");
    expect(output).not.toContain("leaked-key");
    expect(output).not.toContain("leaked-secret");
  });
});
