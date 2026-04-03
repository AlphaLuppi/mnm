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

      // 5. Call LLM with priority fallback
      return await callLlm(systemPrompt, messages);
    },
  };
}

// ─── Prompt Building ───────────────────────────────────────────────────────

function buildSystemPrompt(agent: typeof agents.$inferSelect | undefined): string {
  if (!agent) return "You are a helpful AI assistant. Respond concisely and helpfully.";

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

  if (parts.length === 0) {
    return "You are a helpful AI assistant. Respond concisely and helpfully.";
  }

  return parts.join("\n");
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
