import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { finalizeClientRun, decodeBundle } from "../finalize.js";

const SESSION_ID = "fb8658fc-f19b-4a8c-ad2d-46ed944f509e";
const T1 = "2026-04-30T18:52:39.158Z";
const T2 = "2026-04-30T18:52:43.092Z";

const sampleJsonl = [
  JSON.stringify({
    type: "user",
    sessionId: SESSION_ID,
    cwd: "/home/user/mnm",
    uuid: "u1",
    timestamp: T1,
    message: { role: "user", content: "Hi" },
  }),
  JSON.stringify({
    type: "assistant",
    sessionId: SESSION_ID,
    uuid: "a1",
    timestamp: T2,
    message: {
      id: "msg_1",
      role: "assistant",
      model: "claude-opus-4-7",
      content: [{ type: "text", text: "Hello" }],
      usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  }),
].join("\n");

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

interface FakeRun {
  id: string;
  companyId: string;
  agentId: string;
  status: string;
  bundleSha256: string | null;
}

function makeFakeDeps(initialRun: FakeRun) {
  let run = { ...initialRun };
  const updates: Array<Partial<FakeRun & Record<string, unknown>>> = [];
  const traceCalls: Array<{ companyId: string; input: unknown }> = [];
  const obsCalls: Array<{ traceId: string; input: unknown }> = [];
  const completeCalls: Array<{ traceId: string; status: string }> = [];
  const events: Array<{ type: string; payload: unknown }> = [];

  const fakeTrace = { id: "trace-1" };

  return {
    deps: {
      getRun: vi.fn(async (_id: string) => run),
      updateRun: vi.fn(async (_id: string, patch: Partial<FakeRun & Record<string, unknown>>) => {
        updates.push(patch);
        run = { ...run, ...(patch as Partial<FakeRun>) };
      }),
      traceService: {
        create: vi.fn(async (companyId: string, input: unknown) => {
          traceCalls.push({ companyId, input });
          return fakeTrace as never;
        }),
        addObservation: vi.fn(async (_companyId: string, traceId: string, input: unknown) => {
          obsCalls.push({ traceId, input });
          return { id: `obs-${obsCalls.length}` } as never;
        }),
        completeTrace: vi.fn(async (_companyId: string, traceId: string, input: { status: string }) => {
          completeCalls.push({ traceId, status: input.status });
          return run as never;
        }),
      },
      publishLiveEvent: vi.fn((event: { type: string; payload: unknown }) => {
        events.push(event);
      }),
    },
    state: { updates, traceCalls, obsCalls, completeCalls, events, get run() { return run; } },
  };
}

describe("decodeBundle", () => {
  it("returns raw string as-is when input is a plain string", () => {
    expect(decodeBundle("hello").content).toBe("hello");
    expect(decodeBundle("hello").encoding).toBe("raw");
  });

  it("returns raw content from { encoding: 'raw', content }", () => {
    expect(decodeBundle({ encoding: "raw", content: "x" }).content).toBe("x");
  });

  it("decompresses gzip-base64 content", () => {
    const raw = "this is the original jsonl content";
    const gz = gzipSync(Buffer.from(raw, "utf8")).toString("base64");
    const result = decodeBundle({ encoding: "gzip-base64", content: gz });
    expect(result.content).toBe(raw);
    expect(result.encoding).toBe("gzip-base64");
  });

  it("throws on unknown encoding", () => {
    expect(() => decodeBundle({ encoding: "rot13", content: "x" } as never)).toThrow(/encoding/);
  });

  it("throws on null/undefined", () => {
    expect(() => decodeBundle(null as never)).toThrow();
    expect(() => decodeBundle(undefined as never)).toThrow();
  });
});

describe("finalizeClientRun", () => {
  const RUN_ID = "11111111-1111-1111-1111-111111111111";

  let fakeDeps: ReturnType<typeof makeFakeDeps>;

  beforeEach(() => {
    fakeDeps = makeFakeDeps({
      id: RUN_ID,
      companyId: "c1",
      agentId: "a1",
      status: "running",
      bundleSha256: null,
    });
  });

  it("parses, creates trace, adds observations, completes trace, updates run", async () => {
    await finalizeClientRun(fakeDeps.deps as never, { runId: RUN_ID, sessionFile: sampleJsonl });

    expect(fakeDeps.state.traceCalls).toHaveLength(1);
    expect((fakeDeps.state.traceCalls[0]!.input as { name: string }).name).toContain("Hi");
    expect(fakeDeps.state.obsCalls.length).toBeGreaterThan(0);
    expect(fakeDeps.state.completeCalls).toEqual([{ traceId: "trace-1", status: "completed" }]);

    const lastUpdate = fakeDeps.state.updates.at(-1)!;
    expect(lastUpdate.status).toBe("succeeded");
    expect(lastUpdate.bundleSha256).toBe(sha256(sampleJsonl));
    expect(lastUpdate.bundleFormat).toBe("claude-code-jsonl-v1");
    const usage = lastUpdate.usageJson as Record<string, number>;
    expect(usage.totalTokensIn).toBe(10);
    expect(usage.totalTokensOut).toBe(5);
  });

  it("is idempotent on retry with same bundle (matched sha256)", async () => {
    fakeDeps = makeFakeDeps({
      id: RUN_ID,
      companyId: "c1",
      agentId: "a1",
      status: "succeeded",
      bundleSha256: sha256(sampleJsonl),
    });

    await finalizeClientRun(fakeDeps.deps as never, { runId: RUN_ID, sessionFile: sampleJsonl });

    expect(fakeDeps.deps.traceService.create).not.toHaveBeenCalled();
    expect(fakeDeps.deps.updateRun).not.toHaveBeenCalled();
  });

  it("publishes heartbeat.run.status finished event after success", async () => {
    await finalizeClientRun(fakeDeps.deps as never, { runId: RUN_ID, sessionFile: sampleJsonl });
    const evt = fakeDeps.state.events.find((e) => e.type === "heartbeat.run.status");
    expect(evt).toBeDefined();
    expect((evt!.payload as { status: string }).status).toBe("succeeded");
  });

  it("decompresses gzip-base64 sessionFile before parsing", async () => {
    const gz = gzipSync(Buffer.from(sampleJsonl, "utf8")).toString("base64");
    await finalizeClientRun(fakeDeps.deps as never, {
      runId: RUN_ID,
      sessionFile: { encoding: "gzip-base64", content: gz },
    });
    expect(fakeDeps.deps.traceService.create).toHaveBeenCalled();
    const lastUpdate = fakeDeps.state.updates.at(-1)!;
    // sha256 should be of the decompressed content
    expect(lastUpdate.bundleSha256).toBe(sha256(sampleJsonl));
  });

  it("marks run as failed on parse error but does not throw to caller", async () => {
    await finalizeClientRun(fakeDeps.deps as never, { runId: RUN_ID, sessionFile: "not-json" });

    const lastUpdate = fakeDeps.state.updates.at(-1)!;
    expect(lastUpdate.status).toBe("failed");
    expect(lastUpdate.errorCode).toBe("BUNDLE_PARSE_FAILED");
    expect(fakeDeps.deps.traceService.create).not.toHaveBeenCalled();
  });

  it("throws if the run does not exist (caller error)", async () => {
    fakeDeps.deps.getRun = vi.fn(async () => null) as never;
    await expect(
      finalizeClientRun(fakeDeps.deps as never, { runId: RUN_ID, sessionFile: sampleJsonl }),
    ).rejects.toThrow(/not found/);
  });

  it("rejects bundles over 100MB after decompression", async () => {
    const huge = "x".repeat(101 * 1024 * 1024);
    await finalizeClientRun(fakeDeps.deps as never, { runId: RUN_ID, sessionFile: huge });
    const lastUpdate = fakeDeps.state.updates.at(-1)!;
    expect(lastUpdate.status).toBe("failed");
    expect(lastUpdate.errorCode).toBe("BUNDLE_TOO_LARGE");
  });
});
