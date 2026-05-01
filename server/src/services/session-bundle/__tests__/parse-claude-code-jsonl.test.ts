import { describe, it, expect } from "vitest";
import { parseClaudeCodeJsonl } from "../parse-claude-code-jsonl.js";

const SESSION_ID = "fb8658fc-f19b-4a8c-ad2d-46ed944f509e";
const T1 = "2026-04-30T18:52:39.158Z";
const T2 = "2026-04-30T18:52:43.092Z";
const T3 = "2026-04-30T18:52:50.001Z";
const T4 = "2026-04-30T18:53:00.500Z";

function jsonl(...lines: object[]): string {
  return lines.map((l) => JSON.stringify(l)).join("\n");
}

const userTurn = (timestamp: string, text: string) => ({
  type: "user",
  sessionId: SESSION_ID,
  cwd: "/home/user/mnm",
  gitBranch: "main",
  version: "2.1.123",
  uuid: `u-${timestamp}`,
  timestamp,
  message: { role: "user", content: text },
});

const assistantTurn = (
  timestamp: string,
  opts: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheCreation?: number;
    cacheRead?: number;
    text?: string;
    toolUse?: { id: string; name: string; input: object };
  } = {},
) => ({
  type: "assistant",
  sessionId: SESSION_ID,
  cwd: "/home/user/mnm",
  uuid: `a-${timestamp}`,
  timestamp,
  message: {
    id: `msg-${timestamp}`,
    role: "assistant",
    model: opts.model ?? "claude-opus-4-7",
    content: [
      ...(opts.text ? [{ type: "text", text: opts.text }] : []),
      ...(opts.toolUse
        ? [{ type: "tool_use", id: opts.toolUse.id, name: opts.toolUse.name, input: opts.toolUse.input }]
        : []),
    ],
    usage: {
      input_tokens: opts.inputTokens ?? 0,
      output_tokens: opts.outputTokens ?? 0,
      cache_creation_input_tokens: opts.cacheCreation ?? 0,
      cache_read_input_tokens: opts.cacheRead ?? 0,
    },
  },
});

const toolResultTurn = (timestamp: string, toolUseId: string, output: string, isError = false) => ({
  type: "user",
  sessionId: SESSION_ID,
  uuid: `tr-${timestamp}`,
  timestamp,
  message: {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: [{ type: "text", text: output }],
        is_error: isError,
      },
    ],
  },
});

describe("parseClaudeCodeJsonl", () => {
  it("parses a minimal session: user → assistant text → done", () => {
    const content = jsonl(
      userTurn(T1, "Hello"),
      assistantTurn(T2, { text: "Hi there", inputTokens: 10, outputTokens: 5 }),
    );
    const parsed = parseClaudeCodeJsonl(content);
    expect(parsed.trace.metadata.sessionId).toBe(SESSION_ID);
    expect(parsed.trace.metadata.cwd).toBe("/home/user/mnm");
    expect(parsed.trace.metadata.bundleFormat).toBe("claude-code-jsonl-v1");
    expect(parsed.trace.totalTokensIn).toBe(10);
    expect(parsed.trace.totalTokensOut).toBe(5);
    expect(parsed.trace.startedAt.toISOString()).toBe(T1);
    expect(parsed.trace.completedAt.toISOString()).toBe(T2);
    expect(parsed.observations).toHaveLength(2);
  });

  it("emits one event observation per user turn", () => {
    const content = jsonl(userTurn(T1, "Question 1"));
    const parsed = parseClaudeCodeJsonl(content);
    const userObs = parsed.observations.find((o) => o.type === "event");
    expect(userObs).toBeDefined();
    expect(userObs!.name).toBe("user_message");
    expect(userObs!.input).toEqual({ text: "Question 1" });
  });

  it("emits a generation observation per assistant turn with usage", () => {
    const content = jsonl(
      assistantTurn(T2, {
        model: "claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 50,
        cacheCreation: 20,
        cacheRead: 30,
        text: "answer",
      }),
    );
    const parsed = parseClaudeCodeJsonl(content);
    const gen = parsed.observations.find((o) => o.type === "generation");
    expect(gen).toBeDefined();
    expect(gen!.model).toBe("claude-sonnet-4-6");
    expect(gen!.inputTokens).toBe(100);
    expect(gen!.outputTokens).toBe(50);
    expect(gen!.metadata?.cache_creation_input_tokens).toBe(20);
    expect(gen!.metadata?.cache_read_input_tokens).toBe(30);
  });

  it("emits a span observation per tool_use, linked to its tool_result", () => {
    const content = jsonl(
      assistantTurn(T2, {
        toolUse: { id: "toolu_001", name: "Bash", input: { command: "ls" } },
        outputTokens: 30,
      }),
      toolResultTurn(T3, "toolu_001", "file1.txt\nfile2.txt"),
    );
    const parsed = parseClaudeCodeJsonl(content);
    const span = parsed.observations.find((o) => o.type === "span");
    expect(span).toBeDefined();
    expect(span!.name).toBe("Bash");
    expect(span!.input).toEqual({ command: "ls" });
    expect(span!.output).toEqual({ text: "file1.txt\nfile2.txt", is_error: false });
    expect(span!.startedAt.toISOString()).toBe(T2);
    expect(span!.completedAt?.toISOString()).toBe(T3);
    expect(span!.durationMs).toBe(new Date(T3).getTime() - new Date(T2).getTime());
    expect(span!.status).toBe("completed");
  });

  it("marks tool span as error when tool_result has is_error=true", () => {
    const content = jsonl(
      assistantTurn(T2, { toolUse: { id: "toolu_002", name: "Bash", input: { command: "false" } } }),
      toolResultTurn(T3, "toolu_002", "exit 1", true),
    );
    const parsed = parseClaudeCodeJsonl(content);
    const span = parsed.observations.find((o) => o.type === "span")!;
    expect(span.status).toBe("error");
  });

  it("tolerates an open tool_use with no matching tool_result (trailing entry)", () => {
    // Edge case: complete_governed_step is the LAST tool the harness invokes —
    // its tool_result will never be in the .jsonl because the harness reads
    // the file *before* the result is written. The parser must NOT crash and
    // must emit the span with completedAt undefined.
    const content = jsonl(
      assistantTurn(T2, { toolUse: { id: "toolu_open", name: "complete_governed_step", input: {} } }),
    );
    const parsed = parseClaudeCodeJsonl(content);
    const span = parsed.observations.find((o) => o.type === "span")!;
    expect(span.completedAt).toBeUndefined();
    expect(span.status).toBe("started");
  });

  it("rolls up totals across multiple assistant turns", () => {
    const content = jsonl(
      userTurn(T1, "Q1"),
      assistantTurn(T2, { inputTokens: 10, outputTokens: 5 }),
      userTurn(T3, "Q2"),
      assistantTurn(T4, { inputTokens: 20, outputTokens: 8, model: "claude-haiku-4-5-20251001" }),
    );
    const parsed = parseClaudeCodeJsonl(content);
    expect(parsed.trace.totalTokensIn).toBe(30);
    expect(parsed.trace.totalTokensOut).toBe(13);
    expect(parsed.trace.metadata.modelsUsed).toEqual(
      expect.arrayContaining(["claude-opus-4-7", "claude-haiku-4-5-20251001"]),
    );
  });

  it("ignores non-JSON empty lines and trailing newlines", () => {
    const content = `${JSON.stringify(userTurn(T1, "x"))}\n\n${JSON.stringify(assistantTurn(T2, { outputTokens: 1 }))}\n`;
    const parsed = parseClaudeCodeJsonl(content);
    expect(parsed.observations).toHaveLength(2);
  });

  it("throws on invalid JSON line (caller handles)", () => {
    const content = `${JSON.stringify(userTurn(T1, "x"))}\nthis is not json`;
    expect(() => parseClaudeCodeJsonl(content)).toThrow(/line 2/);
  });

  it("captures attachment entries as 'event' with kind in metadata", () => {
    const attachment = {
      type: "attachment",
      sessionId: SESSION_ID,
      uuid: "att-1",
      timestamp: T1,
      attachment: { type: "deferred_tools_delta", addedNames: ["X"], removedNames: [] },
    };
    const parsed = parseClaudeCodeJsonl(jsonl(attachment));
    const event = parsed.observations.find((o) => o.type === "event");
    expect(event).toBeDefined();
    expect(event!.name).toBe("attachment.deferred_tools_delta");
  });

  it("returns sessionIdAfter from the last entry's sessionId field", () => {
    const content = jsonl(
      userTurn(T1, "x"),
      assistantTurn(T2, { outputTokens: 1 }),
    );
    const parsed = parseClaudeCodeJsonl(content);
    expect(parsed.trace.metadata.sessionId).toBe(SESSION_ID);
  });

  it("infers a trace name from the first user message (truncated)", () => {
    const longText = "A".repeat(200);
    const parsed = parseClaudeCodeJsonl(jsonl(userTurn(T1, longText)));
    expect(parsed.trace.name.length).toBeLessThanOrEqual(100);
    expect(parsed.trace.name).toMatch(/^A+/);
  });

  it("falls back to 'session <id>' name if no user turn", () => {
    const parsed = parseClaudeCodeJsonl(jsonl(assistantTurn(T2, { outputTokens: 1 })));
    expect(parsed.trace.name).toContain(SESSION_ID.slice(0, 8));
  });

  it("returns durationMs on the trace = last - first timestamp", () => {
    const parsed = parseClaudeCodeJsonl(jsonl(userTurn(T1, "x"), assistantTurn(T4, {})));
    const expected = new Date(T4).getTime() - new Date(T1).getTime();
    expect(parsed.trace.totalDurationMs).toBe(expected);
  });
});
