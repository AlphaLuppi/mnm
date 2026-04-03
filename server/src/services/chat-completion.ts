/**
 * Chat Completion Service
 *
 * Generates LLM responses for user messages in chat channels.
 *
 * Strategy priority:
 *   1. Direct Anthropic API (if ANTHROPIC_API_KEY is set)
 *   2. Configurable LLM endpoint (if MNM_LLM_SUMMARY_ENDPOINT is set)
 *   3. `claude -p` CLI fallback (uses existing Claude Code auth)
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Db } from "@mnm/db";
import { chatMessages, agents, chatChannels } from "@mnm/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { logger as parentLogger } from "../middleware/logger.js";

const execFileAsync = promisify(execFile);
const logger = parentLogger.child({ module: "chat-completion" });

// ─── Config ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const LLM_ENDPOINT = process.env.MNM_LLM_SUMMARY_ENDPOINT;
const LLM_API_KEY = process.env.MNM_LLM_SUMMARY_API_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-4-20250514";
const CLI_MODEL = process.env.CHAT_CLI_MODEL || "sonnet";
const HISTORY_LIMIT = 50;

// ─── Types ─────────────────────────────────────────────────────────────────

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Service ───────────────────────────────────────────────────────────────

export function chatCompletionService(db: Db) {
  /**
   * Shared helper: fetch channel, agent, history, build prompt & messages.
   */
  async function prepareContext(companyId: string, channelId: string, userMessage: string) {
    // 1. Get channel info
    const [channel] = await db
      .select()
      .from(chatChannels)
      .where(eq(chatChannels.id, channelId));

    if (!channel) throw new Error(`Channel ${channelId} not found`);

    // 2. Get agent info (for system prompt / name)
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, channel.agentId));

    // 3. Get recent chat history (last N messages)
    const historyRows = await db
      .select({
        content: chatMessages.content,
        senderType: chatMessages.senderType,
        messageType: chatMessages.messageType,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channelId),
          isNull(chatMessages.deletedAt),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(HISTORY_LIMIT);

    // Reverse to chronological order
    historyRows.reverse();

    // 4. Build system prompt and messages
    const systemPrompt = buildSystemPrompt(agent);
    const messages = buildMessages(historyRows, userMessage);

    return { systemPrompt, messages };
  }

  return {
    /**
     * Generate a response for a user message in a chat channel.
     * Returns the response text.
     */
    async generateResponse(
      companyId: string,
      channelId: string,
      userMessage: string,
    ): Promise<string> {
      const { systemPrompt, messages } = await prepareContext(companyId, channelId, userMessage);
      return await callLlm(systemPrompt, messages);
    },

    /**
     * Generate a streaming response for a user message.
     * Calls onChunk with the accumulated text as it arrives.
     * Falls back to non-streaming if Anthropic API is unavailable.
     */
    async generateResponseStreaming(
      companyId: string,
      channelId: string,
      userMessage: string,
      onChunk: (partialText: string) => void,
    ): Promise<string> {
      const { systemPrompt, messages } = await prepareContext(companyId, channelId, userMessage);

      // Only Anthropic direct API supports streaming
      if (ANTHROPIC_API_KEY) {
        try {
          const result = await callAnthropicApiStreaming(systemPrompt, messages, ANTHROPIC_API_KEY, onChunk);
          if (result) return result;
        } catch (err) {
          logger.warn({ err }, "Anthropic streaming failed, falling back to non-streaming");
        }
      }

      // Fallback: non-streaming (call callLlm which tries all strategies)
      const result = await callLlm(systemPrompt, messages);
      onChunk(result);
      return result;
    },
  };
}

// ─── Prompt Building ───────────────────────────────────────────────────────

const CHAT_FEATURES_PROMPT = `## Chat Features

You are in a collaborative chat session. You have access to special features:

### Artifacts
When generating substantial content (code, documents, PRDs, HTML, diagrams, tables), wrap it in an artifact block:

\`\`\`artifact
---
title: "Title of the artifact"
type: code|markdown|table|structured|html
language: html|typescript|python|etc (for code type)
---
Content here...
\`\`\`

Artifacts are displayed in a side panel and can be saved, versioned, and shared. Use them for:
- Code files (HTML, CSS, JS, Python, etc.)
- PRDs, design docs, specifications
- Data tables
- Any content the user will want to iterate on

For simple answers, short explanations, or conversational responses, just reply normally without an artifact block.

### Documents
The user can upload documents (PDF, images, text files) into the chat. When they do, you'll see the document content in the context. You can reference and discuss these documents.

### Slash Commands
The user can use slash commands like /summarize, /deep-dive, etc. When you receive a command instruction, execute it.

### @Mentions
The user can mention other agents with @name. If you receive a message about another agent being mentioned, coordinate accordingly.

Respond in the same language as the user (French if they write in French, English if English, etc.).`;

function buildSystemPrompt(agent: typeof agents.$inferSelect | undefined): string {
  if (!agent) return "You are a helpful AI assistant. Respond concisely and helpfully.\n\n" + CHAT_FEATURES_PROMPT;

  const parts: string[] = [];

  if (agent.name) parts.push(`You are ${agent.name}.`);
  if (agent.title) parts.push(agent.title);

  // System prompt from adapterConfig
  const config = agent.adapterConfig as Record<string, unknown> | null;
  if (config?.systemPrompt && typeof config.systemPrompt === "string") {
    parts.push(config.systemPrompt);
  }

  // Capabilities as context
  if (agent.capabilities) {
    parts.push(`Your capabilities: ${agent.capabilities}`);
  }

  // Chat feature instructions
  parts.push(CHAT_FEATURES_PROMPT);

  if (parts.length <= 1) {
    return "You are a helpful AI assistant.\n\n" + CHAT_FEATURES_PROMPT;
  }

  return parts.join("\n\n");
}

function buildMessages(
  historyRows: Array<{ content: string; senderType: string; messageType: string | null }>,
  userMessage: string,
): HistoryMessage[] {
  const messages: HistoryMessage[] = historyRows
    .filter((m) => m.messageType === "text" || !m.messageType)
    .map((m) => ({
      role: (m.senderType === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  // Add the new user message
  messages.push({ role: "user", content: userMessage });

  return messages;
}

// ─── LLM Call (priority fallback) ──────────────────────────────────────────

async function callLlm(
  systemPrompt: string,
  messages: HistoryMessage[],
): Promise<string> {
  // Strategy 1: Direct Anthropic API
  if (ANTHROPIC_API_KEY) {
    try {
      const result = await callAnthropicApi(systemPrompt, messages, ANTHROPIC_API_KEY);
      if (result) return result;
    } catch (err) {
      logger.warn({ err }, "Anthropic API call failed, trying next strategy");
    }
  }

  // Strategy 2: Configurable LLM endpoint (same as gold-trace-enrichment)
  if (LLM_ENDPOINT && LLM_API_KEY) {
    try {
      const result = await callLlmEndpoint(systemPrompt, messages);
      if (result) return result;
    } catch (err) {
      logger.warn({ err }, "LLM endpoint call failed, trying claude CLI");
    }
  }

  // Strategy 3: claude -p CLI fallback
  try {
    const result = await callClaudeCli(systemPrompt, messages);
    if (result) return result;
  } catch (err) {
    logger.warn({ err }, "claude CLI call failed");
  }

  return "I'm sorry, I couldn't generate a response. Please check that an LLM backend is configured (ANTHROPIC_API_KEY, MNM_LLM_SUMMARY_ENDPOINT, or claude CLI).";
}

async function callAnthropicApi(
  systemPrompt: string,
  messages: HistoryMessage[],
  apiKey: string,
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const text = data?.content?.[0]?.text;
  if (text) {
    logger.debug(
      { inputTokens: data?.usage?.input_tokens, outputTokens: data?.usage?.output_tokens },
      "Anthropic API call succeeded",
    );
    return text;
  }

  return null;
}

async function callLlmEndpoint(
  systemPrompt: string,
  messages: HistoryMessage[],
): Promise<string | null> {
  const response = await fetch(LLM_ENDPOINT!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
      "x-api-key": LLM_API_KEY!,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
  };

  return data?.content?.[0]?.text ?? null;
}

async function callAnthropicApiStreaming(
  systemPrompt: string,
  messages: HistoryMessage[],
  apiKey: string,
  onChunk: (partialText: string) => void,
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`Anthropic streaming error: ${response.status} ${errText}`);
  }

  let fullText = "";
  const decoder = new TextDecoder();
  let buffer = "";

  // Use getReader() for Node.js ReadableStream compatibility
  const streamReader = (response.body as ReadableStream<Uint8Array>).getReader();

  try {
    while (true) {
      const { done, value } = await streamReader.read();
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
            onChunk(fullText);
          }
        } catch {
          // Skip unparseable SSE events
        }
      }
    }
  } finally {
    streamReader.releaseLock();
  }

  if (!fullText) return null;

  logger.debug({ length: fullText.length }, "Anthropic streaming call succeeded");
  return fullText;
}

async function callClaudeCli(
  systemPrompt: string,
  messages: HistoryMessage[],
): Promise<string | null> {
  // Build a single prompt combining system + conversation history
  // claude -p takes a single prompt string as argument
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const combinedPrompt = `${systemPrompt}\n\n---\n\n${conversationText}\n\nRespond as the assistant. Be concise and helpful.`;

  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", combinedPrompt, "--output-format", "text", "--model", CLI_MODEL],
      {
        timeout: 90_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, CLAUDE_CODE_ENABLE_TELEMETRY: "0" },
      },
    );

    if (!stdout?.trim()) return null;

    logger.debug("claude CLI call succeeded");
    return stdout.trim();
  } catch (err) {
    logger.warn({ err }, "claude -p CLI call failed");
    return null;
  }
}
