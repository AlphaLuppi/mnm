/**
 * Parse a Claude Code .jsonl session file into trace + observations.
 *
 * Format: claude-code-jsonl-v1 — one JSON object per line, fields observed
 * across versions 2.1.x:
 *   { type: "user"        ; message: { role: "user", content: string | ContentBlock[] } }
 *   { type: "assistant"   ; message: { role: "assistant", model, content: ContentBlock[], usage } }
 *   { type: "attachment"  ; attachment: { type: "deferred_tools_delta" | "skill_listing" | ... } }
 *   { type: "summary"     ; ... }                                  (rare, treated as event)
 *
 * Common envelope fields: timestamp, uuid, parentUuid, sessionId, cwd, gitBranch, version.
 *
 * Mapping:
 *   user (text)              → event   "user_message"
 *   user (tool_result block) → linked to its tool_use span via tool_use_id
 *   assistant                → generation "assistant_response" (carries usage, model)
 *   tool_use block           → span        "<tool_name>" (input from block, completed when matched tool_result arrives)
 *   attachment               → event       "attachment.<sub_type>"
 *   summary / unknown        → event       "<type>"
 *
 * Robustness contract (Task 3 plan §3.2):
 *   - Tolerate trailing tool_use without a matching tool_result (the harness
 *     reads its own .jsonl BEFORE the complete_governed_step result is
 *     written → the closing entry is always missing).
 *   - Tolerate empty lines.
 *   - Throw on invalid JSON (with line number) so the caller can surface
 *     a precise error to the gate / finalize layer.
 *
 * Cost: NOT computed — the .jsonl does not include a cost field, and the
 * pricing per model varies. We store totalCostUsd="0" and let downstream
 * lenses or a future pricing service enrich.
 */

export interface ParsedSession {
  trace: ParsedTrace;
  observations: ParsedObservation[];
}

export interface ParsedTrace {
  name: string;
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: string;
  metadata: {
    sessionId: string;
    cwd: string | null;
    gitBranch: string | null;
    version: string | null;
    modelsUsed: string[];
    bundleFormat: "claude-code-jsonl-v1";
  };
}

export interface ParsedObservation {
  type: "span" | "generation" | "event";
  name: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  status: "started" | "completed" | "error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: string;
  model?: string;
  metadata?: Record<string, unknown>;
  /** tool_use.id or msg.id — used to link tool_use → tool_result. */
  externalId?: string;
  /** uuid of the source JSONL entry, for traceability. */
  sourceEntryUuid?: string;
}

interface JsonlEntry {
  type?: string;
  uuid?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  timestamp?: string;
  message?: {
    role?: string;
    model?: string;
    content?: unknown;
    usage?: Record<string, unknown>;
  };
  attachment?: { type?: string };
}

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  // tool_use
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  // tool_result
  tool_use_id?: string;
  content?: Array<{ type: string; text?: string }> | string;
  is_error?: boolean;
}

const MAX_TRACE_NAME_LENGTH = 100;

export function parseClaudeCodeJsonl(content: string): ParsedSession {
  const rawLines = content.split("\n");
  const entries: JsonlEntry[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    if (line.length === 0) continue;
    let parsed: JsonlEntry;
    try {
      parsed = JSON.parse(line) as JsonlEntry;
    } catch {
      throw new Error(`parseClaudeCodeJsonl: invalid JSON at line ${i + 1}`);
    }
    entries.push(parsed);
  }

  if (entries.length === 0) {
    throw new Error("parseClaudeCodeJsonl: empty session");
  }

  const observations: ParsedObservation[] = [];
  const toolSpansById = new Map<string, ParsedObservation>();

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const modelsUsed = new Set<string>();
  let firstUserText: string | undefined;
  let sessionId = "";
  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let version: string | null = null;
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  for (const entry of entries) {
    if (typeof entry.sessionId === "string" && !sessionId) sessionId = entry.sessionId;
    if (typeof entry.cwd === "string" && !cwd) cwd = entry.cwd;
    if (typeof entry.gitBranch === "string" && !gitBranch) gitBranch = entry.gitBranch;
    if (typeof entry.version === "string" && !version) version = entry.version;
    if (typeof entry.timestamp === "string") {
      if (!firstTimestamp) firstTimestamp = entry.timestamp;
      lastTimestamp = entry.timestamp;
    }

    const ts = entry.timestamp ? new Date(entry.timestamp) : new Date(0);

    switch (entry.type) {
      case "user": {
        const messageContent = entry.message?.content;
        // Tool results live in message.content as content blocks with type=tool_result.
        if (Array.isArray(messageContent)) {
          let isToolResult = false;
          for (const block of messageContent as ContentBlock[]) {
            if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
              isToolResult = true;
              const span = toolSpansById.get(block.tool_use_id);
              const text = extractTextFromBlock(block);
              if (span) {
                span.completedAt = ts;
                span.durationMs = ts.getTime() - span.startedAt.getTime();
                span.status = block.is_error === true ? "error" : "completed";
                span.output = { text, is_error: block.is_error === true };
              } else {
                // Tool result without a matching open span — emit a standalone event so
                // we don't lose the data. Happens if the bundle was truncated mid-stream.
                observations.push({
                  type: "event",
                  name: "tool_result_orphan",
                  startedAt: ts,
                  status: "completed",
                  output: { text, is_error: block.is_error === true, tool_use_id: block.tool_use_id },
                  sourceEntryUuid: entry.uuid,
                });
              }
            }
          }
          if (isToolResult) break;
        }
        // Plain user message (text or content array of text blocks).
        const userText = typeof messageContent === "string" ? messageContent : extractText(messageContent);
        if (firstUserText === undefined) firstUserText = userText;
        observations.push({
          type: "event",
          name: "user_message",
          startedAt: ts,
          status: "completed",
          input: { text: userText },
          sourceEntryUuid: entry.uuid,
        });
        break;
      }

      case "assistant": {
        const usage = entry.message?.usage ?? {};
        const inputTokens = numberOrZero(usage.input_tokens);
        const outputTokens = numberOrZero(usage.output_tokens);
        totalTokensIn += inputTokens;
        totalTokensOut += outputTokens;
        const model = typeof entry.message?.model === "string" ? entry.message.model : undefined;
        if (model) modelsUsed.add(model);

        const contentArr = Array.isArray(entry.message?.content) ? (entry.message!.content as ContentBlock[]) : [];
        const textBlocks = contentArr.filter((b) => b.type === "text").map((b) => b.text ?? "");
        const thinkingBlocks = contentArr.filter((b) => b.type === "thinking").map((b) => b.thinking ?? "");

        observations.push({
          type: "generation",
          name: "assistant_response",
          startedAt: ts,
          completedAt: ts,
          status: "completed",
          input: undefined,
          output: { text: textBlocks.join("\n"), thinking: thinkingBlocks.join("\n") || undefined },
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          costUsd: undefined,
          model,
          metadata: {
            cache_creation_input_tokens: numberOrZero(usage.cache_creation_input_tokens),
            cache_read_input_tokens: numberOrZero(usage.cache_read_input_tokens),
            stop_reason: extractString(entry.message as Record<string, unknown> | undefined, "stop_reason"),
          },
          externalId: extractString(entry.message as Record<string, unknown> | undefined, "id"),
          sourceEntryUuid: entry.uuid,
        });

        // Each tool_use inside the assistant message becomes its own span.
        for (const block of contentArr) {
          if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
            const span: ParsedObservation = {
              type: "span",
              name: block.name,
              startedAt: ts,
              status: "started", // becomes 'completed' or 'error' when the matching tool_result arrives
              input: block.input ?? {},
              externalId: block.id,
              sourceEntryUuid: entry.uuid,
            };
            observations.push(span);
            toolSpansById.set(block.id, span);
          }
        }
        break;
      }

      case "attachment": {
        observations.push({
          type: "event",
          name: `attachment.${entry.attachment?.type ?? "unknown"}`,
          startedAt: ts,
          status: "completed",
          metadata: { attachment_type: entry.attachment?.type },
          sourceEntryUuid: entry.uuid,
        });
        break;
      }

      default: {
        observations.push({
          type: "event",
          name: entry.type ?? "unknown",
          startedAt: ts,
          status: "completed",
          metadata: { raw_type: entry.type },
          sourceEntryUuid: entry.uuid,
        });
      }
    }
  }

  // Build trace name : first user message excerpt, else session id excerpt.
  let traceName: string;
  if (firstUserText && firstUserText.length > 0) {
    traceName = firstUserText.slice(0, MAX_TRACE_NAME_LENGTH);
  } else {
    traceName = `session ${sessionId.slice(0, 8)}`;
  }

  const startedAt = firstTimestamp ? new Date(firstTimestamp) : new Date(0);
  const completedAt = lastTimestamp ? new Date(lastTimestamp) : startedAt;

  return {
    trace: {
      name: traceName,
      startedAt,
      completedAt,
      totalDurationMs: completedAt.getTime() - startedAt.getTime(),
      totalTokensIn,
      totalTokensOut,
      totalCostUsd: "0",
      metadata: {
        sessionId,
        cwd,
        gitBranch,
        version,
        modelsUsed: Array.from(modelsUsed),
        bundleFormat: "claude-code-jsonl-v1",
      },
    },
    observations,
  };
}

function numberOrZero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function extractString(obj: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");
}

function extractTextFromBlock(block: ContentBlock): string {
  if (typeof block.content === "string") return block.content;
  if (!Array.isArray(block.content)) return "";
  return block.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("\n");
}
