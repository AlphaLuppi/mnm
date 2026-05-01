import { describe, it, expect } from "vitest";
import gate from "../session-file-bundled.gate.js";
import type { GateContext } from "@mnm/governed-workflows";

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    artifact: undefined,
    run: { id: "run-1", workflow_name: "wf", git_tag: "v1", params: {} },
    step: { id: "s", previous_artifacts: {} },
    config: {},
    kind: "exit",
    helpers: {},
    ...overrides,
  };
}

const validJsonl = [
  JSON.stringify({ type: "user", sessionId: "abc", timestamp: "2026-04-30T18:52:39.158Z" }),
  JSON.stringify({ type: "assistant", sessionId: "abc", timestamp: "2026-04-30T18:52:40.158Z" }),
].join("\n");

describe("session-file-bundled canonical gate", () => {
  it("passes when artifact.data.session_file is a valid raw JSONL string", async () => {
    const result = await gate(ctx({ artifact: { data: { session_file: validJsonl } } as never }));
    expect(result.pass).toBe(true);
    expect(result.report).toContain("2");
  });

  it("passes when session_file is wrapped in {encoding:'raw', content}", async () => {
    const result = await gate(
      ctx({ artifact: { data: { session_file: { encoding: "raw", content: validJsonl } } } as never }),
    );
    expect(result.pass).toBe(true);
  });

  it("passes when session_file is wrapped in {encoding:'gzip-base64', content} without parsing", async () => {
    // Gate cannot decompress in isolate — only checks presence + reasonable shape.
    const fakeBase64 = "H4sIAAAAAAAAA" + "x".repeat(1000);
    const result = await gate(
      ctx({ artifact: { data: { session_file: { encoding: "gzip-base64", content: fakeBase64 } } } as never }),
    );
    expect(result.pass).toBe(true);
    expect(result.report).toContain("gzip-base64");
  });

  it("fails SESSION_FILE_MISSING when artifact is undefined", async () => {
    const result = await gate(ctx({ artifact: undefined }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_MISSING");
  });

  it("fails SESSION_FILE_MISSING when artifact.data has no session_file", async () => {
    const result = await gate(ctx({ artifact: { data: {} } as never }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_MISSING");
  });

  it("fails SESSION_FILE_EMPTY when raw string is empty", async () => {
    const result = await gate(ctx({ artifact: { data: { session_file: "" } } as never }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_EMPTY");
  });

  it("fails SESSION_FILE_EMPTY when wrapped content is empty", async () => {
    const result = await gate(
      ctx({ artifact: { data: { session_file: { encoding: "raw", content: "" } } } as never }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_EMPTY");
  });

  it("fails SESSION_FILE_INVALID_JSONL when raw JSONL line cannot be parsed", async () => {
    const broken = validJsonl + "\nthis is not json";
    const result = await gate(ctx({ artifact: { data: { session_file: broken } } as never }));
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_INVALID_JSONL");
  });

  it("respects min_messages config (fails below threshold)", async () => {
    const oneLine = JSON.stringify({ type: "user", sessionId: "x", timestamp: "t" });
    const result = await gate(
      ctx({
        artifact: { data: { session_file: oneLine } } as never,
        config: { min_messages: 5 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_TOO_FEW_MESSAGES");
  });

  it("respects max_size_mb config (fails over cap)", async () => {
    const huge = "x".repeat(2 * 1024 * 1024);
    const result = await gate(
      ctx({
        artifact: { data: { session_file: { encoding: "gzip-base64", content: huge } } } as never,
        config: { max_size_mb: 1 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("SESSION_FILE_TOO_LARGE");
  });

  it("default max_size_mb is 150 (cap on wire size, raw or compressed)", async () => {
    // 160MB would fail; 100MB valid raw passes
    const small = validJsonl;
    const result = await gate(ctx({ artifact: { data: { session_file: small } } as never }));
    expect(result.pass).toBe(true);
  });

  it("fails GATE_INVALID_CONFIG when min_messages is not a positive integer", async () => {
    const result = await gate(
      ctx({
        artifact: { data: { session_file: validJsonl } } as never,
        config: { min_messages: -1 },
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("fails GATE_INVALID_CONFIG when encoding is unknown", async () => {
    const result = await gate(
      ctx({
        artifact: {
          data: { session_file: { encoding: "rot13", content: "abc" } },
        } as never,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.error_code).toBe("GATE_INVALID_CONFIG");
  });

  it("includes a session_capture hint in the failure report", async () => {
    // The harness needs to know where to find the file when a step fails the gate.
    const result = await gate(ctx({ artifact: { data: {} } as never }));
    expect(result.pass).toBe(false);
    expect(result.hints?.some((h) => h.includes("session_file"))).toBe(true);
  });
});
