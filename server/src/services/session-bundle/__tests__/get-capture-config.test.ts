import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCaptureConfig, DEFAULT_CAPTURE_CONFIG } from "../get-capture-config.js";

describe("getCaptureConfig", () => {
  const ENV_KEYS = [
    "MNM_SESSION_CAPTURE_METHOD",
    "MNM_SESSION_CAPTURE_PATH_TEMPLATE",
    "MNM_SESSION_CAPTURE_MAX_SIZE_MB",
    "MNM_SESSION_CAPTURE_GZIP_THRESHOLD_MB",
  ];

  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it("returns the Claude Code v1 default when no overrides are set", () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const cfg = getCaptureConfig();
    expect(cfg.method).toBe("claude-code-jsonl-v1");
    expect(cfg.path_template).toContain(".claude/projects");
    expect(cfg.path_template).toContain("${SESSION_ID}");
    expect(cfg.path_template).toContain("${CWD_DASHED}");
    expect(cfg.where_to_put).toBe("artifact.data.session_file");
    expect(cfg.max_size_mb).toBe(100);
    expect(cfg.gzip_threshold_mb).toBe(5);
    expect(cfg.bundle_format).toBe("claude-code-jsonl-v1");
  });

  it("respects MNM_SESSION_CAPTURE_PATH_TEMPLATE override", () => {
    process.env.MNM_SESSION_CAPTURE_PATH_TEMPLATE = "${HOME}/custom/${SESSION_ID}.log";
    const cfg = getCaptureConfig();
    expect(cfg.path_template).toBe("${HOME}/custom/${SESSION_ID}.log");
  });

  it("respects MNM_SESSION_CAPTURE_MAX_SIZE_MB override", () => {
    process.env.MNM_SESSION_CAPTURE_MAX_SIZE_MB = "250";
    const cfg = getCaptureConfig();
    expect(cfg.max_size_mb).toBe(250);
  });

  it("ignores invalid numeric env overrides and falls back to defaults", () => {
    process.env.MNM_SESSION_CAPTURE_MAX_SIZE_MB = "not a number";
    const cfg = getCaptureConfig();
    expect(cfg.max_size_mb).toBe(DEFAULT_CAPTURE_CONFIG.max_size_mb);
  });

  it("respects MNM_SESSION_CAPTURE_METHOD if it matches a known method", () => {
    process.env.MNM_SESSION_CAPTURE_METHOD = "claude-code-jsonl-v1";
    const cfg = getCaptureConfig();
    expect(cfg.method).toBe("claude-code-jsonl-v1");
  });

  it("ignores unknown method override and warns via fallback to default", () => {
    process.env.MNM_SESSION_CAPTURE_METHOD = "totally-fake";
    const cfg = getCaptureConfig();
    expect(cfg.method).toBe(DEFAULT_CAPTURE_CONFIG.method);
  });

  it("includes a human-readable instructions block for the harness", () => {
    const cfg = getCaptureConfig();
    expect(cfg.instructions).toContain("session_file");
    expect(typeof cfg.session_id_source).toBe("string");
  });

  it("accepts a companyId parameter (V1 unused, future per-company override)", () => {
    const cfg = getCaptureConfig({ companyId: "11111111-1111-1111-1111-111111111111" });
    expect(cfg.method).toBe("claude-code-jsonl-v1");
  });
});
