/**
 * Workflow Studio AI assistant service (Tranche U14.1).
 *
 * Builds the French system prompt for the Claude editor assistant, streams the
 * Anthropic Messages API, and yields a typed event stream the SSE route can
 * forward verbatim. The LLM client is injected (`deps.anthropicStreaming`) so
 * tests can stub it without network IO.
 *
 * Event contract:
 *   {type:"token", value: <delta>}              — incremental text chunk
 *   {type:"file-proposal", path, content?, delete?: true}
 *                                               — emitted post-stream once we
 *                                                 have parsed complete <file>
 *                                                 blocks from the final text
 *   {type:"error", error_code, message, hints?} — any failure surfaced mid-flight
 *   {type:"done"}                               — always last
 *
 * The service NEVER commits to git. Proposals are returned to the UI and
 * applied explicitly by the user (see U14.3 / U14.4).
 */

import { and, eq } from "drizzle-orm";
import { governedWorkflowDefinitions, type Db } from "@mnm/db";
import type { GitProvider, ShaCache } from "@mnm/git-provider";
import { workflowJsonSchema } from "@mnm/governed-workflows";
import {
  governedWorkflowService,
  GovernedWorkflowError,
} from "./governed-workflows.js";
import { listWorkflowFiles } from "./governed-workflow-files.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiAssistantInput {
  companyId: string;
  userId: string | null;
  workflowName: string;
  messages: ChatMessage[];
  /** Optional override — defaults to latestGitTag on the definition row. */
  ref?: string;
}

export type AiAssistantEvent =
  | { type: "token"; value: string }
  | {
      type: "file-proposal";
      path: string;
      content?: string;
      delete?: boolean;
    }
  | { type: "done" }
  | {
      type: "error";
      error_code: string;
      message: string;
      hints?: string[];
    };

export interface AnthropicStreamingArgs {
  systemPrompt: string;
  messages: ChatMessage[];
  onToken: (partial: string) => void;
  signal?: AbortSignal;
}

export interface AiAssistantDeps {
  resolveGitProvider: (args: {
    companyId: string;
    userId: string | null;
  }) => Promise<GitProvider>;
  shaCache: ShaCache;
  /**
   * Dependency-injected LLM call. Production uses `defaultAnthropicStreaming`,
   * tests stub it with a scripted sequence. Must resolve with the full final
   * text (also passed incrementally via `onToken(partial)` where `partial` is
   * the cumulative text).
   */
  anthropicStreaming: (args: AnthropicStreamingArgs) => Promise<string>;
}

// ── Prompt building ─────────────────────────────────────────────────────────

const SCHEMA_TRUNCATE_LIMIT = 8_000;

const CANONICAL_GATES_SECTION = `Gates canoniques disponibles dans @mnm/gate-runner/canonical/:
- artifact-exists.gate.ts — vérifie qu'un fichier existe (config: path, min_bytes?)
- artifacts-bundle.gate.ts — vérifie qu'un bundle existe (config: required_paths[])
- step-succeeded.gate.ts — vérifie qu'un step a succeeded (config: step)
- review-pass.gate.ts — vérifie qu'une review passe un seuil (config: min_score, report_path)`;

/**
 * Build the system prompt. Embeds the JSON schema (truncated at 8k chars),
 * the current workflow.json, and the list of local gate files. French, matches
 * the plan §U14.1 Step 1 template verbatim for the static sections.
 */
export function buildSystemPrompt(args: {
  workflow: unknown;
  localGates: string[];
}): string {
  let schemaJson = JSON.stringify(workflowJsonSchema, null, 2);
  if (schemaJson.length > SCHEMA_TRUNCATE_LIMIT) {
    schemaJson =
      schemaJson.slice(0, SCHEMA_TRUNCATE_LIMIT) +
      "\n// ...schema truncated";
  }
  const workflowJson = JSON.stringify(args.workflow, null, 2);
  const gatesList =
    args.localGates.length === 0
      ? "(aucune gate locale pour ce workflow)"
      : args.localGates.map((g) => `- ${g}`).join("\n");

  return `Tu es l'assistant éditeur de Governed Workflows MnM.
Tu aides l'utilisateur à créer, modifier, ou comprendre des workflows JSON et leurs gates TypeScript.

Contrat de réponse:
- Pour une modification de fichier, utilise EXACTEMENT:
  <file path="<repo-relative-path>">
  <content here, NOT escaped>
  </file>
- Pour une suppression:
  <file path="<path>" delete="true" />
- Pour une explication ou question, réponds en français naturellement.
- Ne propose JAMAIS de modifier plusieurs fichiers sans avertir l'utilisateur.

Schema zod du workflow (workflowDefinitionSchema):
${schemaJson}

${CANONICAL_GATES_SECTION}

Contexte courant — workflow.json en cours d'édition:
${workflowJson}

Les gates locales actuellement présentes dans ce workflow:
${gatesList}

Tu NE COMMIT JAMAIS directement. Tes propositions sont revues par l'utilisateur.`;
}

// ── <file> block parser ─────────────────────────────────────────────────────

export interface FileProposal {
  path: string;
  content?: string;
  delete?: boolean;
}

/**
 * Parse `<file path="...">...</file>` blocks (and self-closing
 * `<file path="..." delete="true" />`) out of a text blob. Uses a simple
 * state machine rather than a regex because the inner content can legally
 * contain `>` characters (JSON, TypeScript generics, HTML snippets, etc.).
 *
 * Nested `<file>` tags are not supported — the LLM contract forbids them.
 * If they ever appear we'd read the inner tag as plain text of the outer
 * block, which is acceptable for MVP.
 */
export function parseFileProposals(text: string): FileProposal[] {
  const results: FileProposal[] = [];
  const openTag = "<file ";
  let i = 0;

  while (i < text.length) {
    const open = text.indexOf(openTag, i);
    if (open === -1) break;

    // Locate the end of the opening tag's attributes region. We stop at the
    // first `>` — attribute values are double-quoted strings that never
    // contain `>` in practice (paths are workflow-relative ASCII).
    const tagEnd = text.indexOf(">", open + openTag.length);
    if (tagEnd === -1) break;

    const attrsRegion = text.slice(open + openTag.length, tagEnd).trim();
    const selfClosing = attrsRegion.endsWith("/");
    const attrText = selfClosing ? attrsRegion.slice(0, -1).trim() : attrsRegion;

    const path = extractAttr(attrText, "path");
    const deleteAttr = extractAttr(attrText, "delete");

    if (!path) {
      i = tagEnd + 1;
      continue;
    }

    if (selfClosing) {
      results.push(
        deleteAttr === "true" ? { path, delete: true } : { path, content: "" },
      );
      i = tagEnd + 1;
      continue;
    }

    // Paired form — look for matching `</file>`. We intentionally do NOT
    // support nested `<file>` blocks (LLM contract).
    const closeIdx = text.indexOf("</file>", tagEnd + 1);
    if (closeIdx === -1) {
      // Unterminated block — stop parsing, don't emit a partial.
      break;
    }
    const rawContent = text.slice(tagEnd + 1, closeIdx);
    // Trim exactly one leading/trailing newline if present (common formatting
    // pattern: `<file>\n...\n</file>`). Anything else stays as-is.
    const trimmed = rawContent.replace(/^\r?\n/, "").replace(/\r?\n$/, "");

    if (deleteAttr === "true") {
      results.push({ path, delete: true });
    } else {
      results.push({ path, content: trimmed });
    }
    i = closeIdx + "</file>".length;
  }

  return results;
}

function extractAttr(attrText: string, name: string): string | null {
  // Matches: name="..."  — quoted value, no escapes.
  const needle = `${name}="`;
  const start = attrText.indexOf(needle);
  if (start === -1) return null;
  const valueStart = start + needle.length;
  const end = attrText.indexOf('"', valueStart);
  if (end === -1) return null;
  return attrText.slice(valueStart, end);
}

// ── Async generator helpers ─────────────────────────────────────────────────

type QueueState = "running" | "settled";

// ── Public service ──────────────────────────────────────────────────────────

/**
 * Stream a Claude chat completion enriched with the workflow's current state.
 * Callers (the SSE route) iterate this generator and forward every event as
 * `data: ${JSON.stringify(event)}\n\n`.
 *
 * Error events are terminal in the sense that no more tokens will follow, but
 * we still yield a trailing `{type: "done"}` so the client can cleanly close
 * the stream. That means client code can rely on exactly one `done` per
 * request regardless of success/failure.
 */
export async function* streamWorkflowAiChat(
  db: Db,
  deps: AiAssistantDeps,
  input: AiAssistantInput,
): AsyncGenerator<AiAssistantEvent> {
  // 1. Resolve ref from the definition row if not supplied.
  let ref = input.ref;
  if (!ref) {
    const [row] = await db
      .select({ latestGitTag: governedWorkflowDefinitions.latestGitTag })
      .from(governedWorkflowDefinitions)
      .where(
        and(
          eq(governedWorkflowDefinitions.companyId, input.companyId),
          eq(governedWorkflowDefinitions.name, input.workflowName),
        ),
      )
      .limit(1);
    ref = row?.latestGitTag ?? undefined;
    if (!ref) {
      yield {
        type: "error",
        error_code: "WORKFLOW_NOT_FOUND",
        message: `Workflow '${input.workflowName}' has no latest_git_tag and no ref was supplied`,
        hints: [
          "Create the workflow via POST /governed-workflows first, or pass { ref } in the request body",
        ],
      };
      yield { type: "done" };
      return;
    }
  }

  // 2. Load parsed workflow.json.
  const svc = governedWorkflowService(db, {
    resolveGitProvider: (a) =>
      deps.resolveGitProvider({ companyId: a.companyId, userId: null }),
    shaCache: deps.shaCache,
  });

  let parsed;
  try {
    parsed = await svc.getWorkflowParsed({
      companyId: input.companyId,
      name: input.workflowName,
      gitTag: ref,
    });
  } catch (err) {
    yield errorEventFromWorkflowError(err);
    yield { type: "done" };
    return;
  }

  // 3. Load the file tree, filter to gate files for the prompt.
  let localGates: string[] = [];
  try {
    const treeResult = await listWorkflowFiles(
      { resolveGitProvider: deps.resolveGitProvider, shaCache: deps.shaCache },
      {
        companyId: input.companyId,
        userId: input.userId,
        workflowName: input.workflowName,
        ref,
      },
    );
    localGates = treeResult.tree
      .filter(
        (e) =>
          e.type === "blob" &&
          e.path.startsWith("gates/") &&
          e.path.endsWith(".ts"),
      )
      .map((e) => e.path);
  } catch {
    // Best-effort — an empty gate list is fine, the LLM just sees no locals.
    localGates = [];
  }

  const systemPrompt = buildSystemPrompt({
    workflow: parsed.workflow,
    localGates,
  });

  // 4. Queue + promise-signal bridge between the callback-style streaming
  //    client and this async generator.
  const queue: AiAssistantEvent[] = [];
  // Wrapped in a box so TS doesn't narrow the initial literal type and then
  // flag the "settled" comparison below as unreachable. Mutations happen in
  // the streamingPromise callbacks which are opaque to flow analysis.
  const stateRef: { value: QueueState } = { value: "running" };
  let resolveNext: (() => void) | null = null;

  const signal = () => {
    const r = resolveNext;
    resolveNext = null;
    r?.();
  };
  const push = (ev: AiAssistantEvent) => {
    queue.push(ev);
    signal();
  };

  let lastLen = 0;

  const streamingPromise = deps
    .anthropicStreaming({
      systemPrompt,
      messages: input.messages,
      onToken: (partial) => {
        const delta = partial.slice(lastLen);
        lastLen = partial.length;
        if (delta.length > 0) {
          push({ type: "token", value: delta });
        }
      },
    })
    .then((fullText) => {
      // Post-stream: parse file proposals from the complete text. We do NOT
      // emit proposals incrementally during the stream — the state machine
      // would need to re-scan on every token which is wasteful, and the UX
      // benefit is marginal (file-proposal chips only appear once complete
      // anyway). Note: documented in the completion report.
      const proposals = parseFileProposals(fullText);
      for (const p of proposals) {
        push({ type: "file-proposal", ...p });
      }
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      const isMissingKey = /ANTHROPIC_API_KEY/.test(message);
      push({
        type: "error",
        error_code: isMissingKey ? "ANTHROPIC_NOT_CONFIGURED" : "LLM_ERROR",
        message,
        hints: isMissingKey
          ? ["Set ANTHROPIC_API_KEY in your .mnm/instances/default/.env"]
          : undefined,
      });
    })
    .finally(() => {
      stateRef.value = "settled";
      push({ type: "done" });
    });

  try {
    while (true) {
      while (queue.length > 0) {
        yield queue.shift()!;
      }
      if (stateRef.value === "settled") break;
      await new Promise<void>((r) => {
        resolveNext = r;
      });
    }
    // Drain any final events pushed between the settled flip and the last
    // yield (the `.finally` handler pushes `done` after flipping state).
    while (queue.length > 0) {
      yield queue.shift()!;
    }
  } finally {
    // Never leaks — awaiting here guarantees the consumer sees every event
    // before we return, even if they break out of the loop early.
    await streamingPromise.catch(() => {});
  }
}

function errorEventFromWorkflowError(err: unknown): AiAssistantEvent {
  if (err instanceof GovernedWorkflowError) {
    return {
      type: "error",
      error_code: err.code,
      message: err.message,
      hints: err.hints.length > 0 ? err.hints : undefined,
    };
  }
  return {
    type: "error",
    error_code: "WORKFLOW_PARSE_FAILED",
    message: err instanceof Error ? err.message : String(err),
  };
}

// ── Default Anthropic client ────────────────────────────────────────────────

const AI_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8_192;

/**
 * Production streaming client. Mirrors `callAnthropicApiStreaming` from
 * `chat-completion.ts` — duplicated here rather than exported from that file
 * to keep the workflow assistant module self-contained. If the Messages API
 * returns a non-2xx status or the key is missing we throw; the caller maps
 * that to a typed error event.
 */
export async function defaultAnthropicStreaming(
  args: AnthropicStreamingArgs,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: args.systemPrompt,
      messages: args.messages,
      stream: true,
    }),
    signal: args.signal ?? AbortSignal.timeout(120_000),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`Anthropic streaming error: ${response.status} ${errText}`);
  }

  let fullText = "";
  const decoder = new TextDecoder();
  let buffer = "";

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const event = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text?: string };
          };
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            event.delta.text
          ) {
            fullText += event.delta.text;
            args.onToken(fullText);
          }
        } catch {
          // Skip malformed SSE events — same tolerance as chat-completion.ts.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
