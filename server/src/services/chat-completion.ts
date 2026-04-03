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
import { chatMessages, agents, chatChannels, artifacts } from "@mnm/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { logger as parentLogger } from "../middleware/logger.js";
import { artifactService } from "./artifact.js";

const execFileAsync = promisify(execFile);
const logger = parentLogger.child({ module: "chat-completion" });

// ─── Config ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const LLM_ENDPOINT = process.env.MNM_LLM_SUMMARY_ENDPOINT;
const LLM_API_KEY = process.env.MNM_LLM_SUMMARY_API_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-4-20250514";
const CLI_MODEL = process.env.CHAT_CLI_MODEL || "sonnet";
const HISTORY_LIMIT = 50;
const TOOL_USE_MAX_ITERATIONS = 10;

// ─── Tool Definitions (Anthropic tool_use) ────────────────────────────────

const CHAT_TOOLS = [
  {
    name: "create_artifact",
    description:
      "Create a new artifact (code, document, HTML page, etc). Use this instead of writing long content directly in the chat.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const, description: "Title of the artifact" },
        type: {
          type: "string" as const,
          enum: ["code", "markdown", "html", "table", "structured"],
          description: "Type of content",
        },
        language: {
          type: "string" as const,
          description:
            "Programming language (for code type): html, typescript, python, css, etc.",
        },
        content: { type: "string" as const, description: "Full content of the artifact" },
      },
      required: ["title", "type", "content"],
    },
  },
  {
    name: "read_artifact",
    description:
      "Read the current content of an existing artifact. Use this before editing to see what's there.",
    input_schema: {
      type: "object" as const,
      properties: {
        artifact_id: {
          type: "string" as const,
          description: "UUID of the artifact to read",
        },
      },
      required: ["artifact_id"],
    },
  },
  {
    name: "edit_artifact",
    description:
      "Edit an existing artifact by replacing a specific section. Much more token-efficient than recreating the whole artifact. Use search/replace pattern.",
    input_schema: {
      type: "object" as const,
      properties: {
        artifact_id: {
          type: "string" as const,
          description: "UUID of the artifact to edit",
        },
        old_text: {
          type: "string" as const,
          description: "Exact text to find and replace (must match exactly)",
        },
        new_text: { type: "string" as const, description: "Replacement text" },
        description: {
          type: "string" as const,
          description: "Brief description of what changed",
        },
      },
      required: ["artifact_id", "old_text", "new_text"],
    },
  },
];

// ─── Types ─────────────────────────────────────────────────────────────────

interface HistoryMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

/** A single content block from the Anthropic Messages API response. */
interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** A tool_result content block sent back to the API. */
interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export interface ToolUseCallbacks {
  onChunk?: (text: string) => void;
  onToolUse?: (toolName: string, input: Record<string, unknown>) => void;
  onArtifactCreated?: (artifact: Record<string, unknown>) => void;
  onArtifactUpdated?: (artifact: Record<string, unknown>) => void;
}

// ─── Service ───────────────────────────────────────────────────────────────

export function chatCompletionService(db: Db) {
  /**
   * Shared helper: fetch channel, agent, history, build prompt & messages.
   */
  async function prepareContext(
    companyId: string,
    channelId: string,
    userMessage: string,
    useTools = false,
  ) {
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
    const systemPrompt = buildSystemPrompt(agent, useTools);
    const messages = buildMessages(historyRows, userMessage);

    return { systemPrompt, messages };
  }

  // ─── Tool Execution ────────────────────────────────────────────────────

  async function executeToolCall(
    companyId: string,
    channelId: string,
    toolName: string,
    input: Record<string, unknown>,
    callbacks: Pick<ToolUseCallbacks, "onArtifactCreated" | "onArtifactUpdated">,
  ): Promise<string> {
    const artSvc = artifactService(db);

    try {
      switch (toolName) {
        case "create_artifact": {
          const artifact = await artSvc.create(
            companyId,
            {
              title: input.title as string,
              artifactType: (input.type as string) || "markdown",
              language: input.language as string | undefined,
              content: input.content as string,
              sourceChannelId: channelId,
            },
            {},
          );
          callbacks.onArtifactCreated?.(artifact as unknown as Record<string, unknown>);
          return JSON.stringify({
            success: true,
            artifact_id: artifact.id,
            message: `Artifact "${input.title}" created successfully.`,
          });
        }

        case "read_artifact": {
          const artifact = await artSvc.getById(companyId, input.artifact_id as string);
          if (!artifact) return JSON.stringify({ error: "Artifact not found" });
          return JSON.stringify({
            id: artifact.id,
            title: artifact.title,
            type: artifact.artifactType,
            language: artifact.language,
            content: artifact.currentVersion?.content ?? "",
          });
        }

        case "edit_artifact": {
          const artifact = await artSvc.getById(companyId, input.artifact_id as string);
          if (!artifact) return JSON.stringify({ error: "Artifact not found" });

          const currentContent = artifact.currentVersion?.content ?? "";
          if (!currentContent.includes(input.old_text as string)) {
            return JSON.stringify({
              error:
                "old_text not found in artifact content. Use read_artifact first to see the current content.",
            });
          }

          const newContent = currentContent.replace(
            input.old_text as string,
            input.new_text as string,
          );
          const updated = await artSvc.update(
            companyId,
            artifact.id,
            {
              content: newContent,
              changeSummary: (input.description as string) || "Edit via chat",
            },
            {},
          );
          if (updated) {
            callbacks.onArtifactUpdated?.(updated as unknown as Record<string, unknown>);
          }
          return JSON.stringify({
            success: true,
            message: `Artifact "${artifact.title}" updated. ${(input.description as string) || ""}`,
          });
        }

        default:
          return JSON.stringify({ error: `Unknown tool: ${toolName}` });
      }
    } catch (err) {
      logger.error({ err, toolName, input }, "Tool execution error");
      return JSON.stringify({
        error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ─── Artifact Context ─────────────────────────────────────────────────

  async function getChannelArtifactContext(
    companyId: string,
    channelId: string,
  ): Promise<string | null> {
    const channelArtifacts = await db
      .select({
        id: artifacts.id,
        title: artifacts.title,
        artifactType: artifacts.artifactType,
        language: artifacts.language,
      })
      .from(artifacts)
      .where(
        and(
          eq(artifacts.companyId, companyId),
          eq(artifacts.sourceChannelId, channelId),
        ),
      )
      .orderBy(desc(artifacts.createdAt))
      .limit(10);

    if (channelArtifacts.length === 0) return null;

    return channelArtifacts
      .map(
        (a) =>
          `- "${a.title}" (id: ${a.id}, type: ${a.artifactType}${a.language ? `, lang: ${a.language}` : ""})`,
      )
      .join("\n");
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

    /**
     * Generate a response with tool_use support for artifact CRUD.
     * Uses the non-streaming Anthropic API with a multi-turn tool loop.
     * Falls back to streaming (block-based artifacts) when API key is unavailable.
     */
    async generateResponseWithTools(
      companyId: string,
      channelId: string,
      userMessage: string,
      toolContext: ToolUseCallbacks,
    ): Promise<string> {
      // Only use tool_use path when Anthropic API key is available
      if (!ANTHROPIC_API_KEY) {
        logger.debug("No ANTHROPIC_API_KEY, falling back to streaming (block-based artifacts)");
        return this.generateResponseStreaming(
          companyId,
          channelId,
          userMessage,
          toolContext.onChunk ?? (() => {}),
        );
      }

      const { systemPrompt, messages: initialMessages } = await prepareContext(
        companyId,
        channelId,
        userMessage,
        true, // useTools = true
      );

      // Enrich system prompt with existing artifact context
      const artifactContext = await getChannelArtifactContext(companyId, channelId);
      const enhancedSystem =
        systemPrompt +
        (artifactContext
          ? `\n\n## Current Artifacts in this conversation\n${artifactContext}`
          : "");

      let messages: HistoryMessage[] = [...initialMessages];
      let fullText = "";

      // Tool use loop (max TOOL_USE_MAX_ITERATIONS to prevent infinite loops)
      for (let i = 0; i < TOOL_USE_MAX_ITERATIONS; i++) {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: CHAT_MODEL,
            max_tokens: 4096,
            system: enhancedSystem,
            messages,
            tools: CHAT_TOOLS,
          }),
          signal: AbortSignal.timeout(120_000),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "unknown");
          throw new Error(`Anthropic API error: ${response.status} ${errText}`);
        }

        const data = (await response.json()) as {
          content: AnthropicContentBlock[];
          stop_reason: string;
          usage?: { input_tokens: number; output_tokens: number };
        };

        logger.debug(
          {
            iteration: i,
            stopReason: data.stop_reason,
            contentBlocks: data.content.length,
            inputTokens: data.usage?.input_tokens,
            outputTokens: data.usage?.output_tokens,
          },
          "Tool loop iteration",
        );

        // Process content blocks
        let hasToolUse = false;
        const toolResults: ToolResultBlock[] = [];

        for (const block of data.content) {
          if (block.type === "text" && block.text) {
            fullText += block.text;
            toolContext.onChunk?.(fullText);
          } else if (block.type === "tool_use" && block.id && block.name) {
            hasToolUse = true;
            toolContext.onToolUse?.(block.name, block.input ?? {});

            // Execute the tool
            const result = await executeToolCall(
              companyId,
              channelId,
              block.name,
              block.input ?? {},
              toolContext,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // If no tool use, or stop_reason is end_turn, we're done
        if (!hasToolUse || data.stop_reason === "end_turn") break;

        // Add assistant message + tool results for next iteration
        messages.push({
          role: "assistant",
          content: data.content,
        });
        messages.push({
          role: "user",
          content: toolResults as unknown as AnthropicContentBlock[],
        });
      }

      return fullText;
    },
  };
}

// ─── Prompt Building ───────────────────────────────────────────────────────

/** Prompt used when tools are available (Anthropic API with tool_use). */
const CHAT_FEATURES_PROMPT_TOOLS = `## Chat Features

You are in a collaborative chat session. You have access to special features:

### Artifacts (via tools)
You have tools to manage artifacts:
- **create_artifact**: Create a new artifact. Use this for any substantial content (code, HTML, documents).
- **read_artifact**: Read an existing artifact's content before editing.
- **edit_artifact**: Edit a part of an existing artifact using search/replace. MUCH more efficient than recreating. Always read first, then edit.

When the user asks to modify an existing artifact, use read_artifact + edit_artifact instead of creating a new one. This saves tokens and preserves history.

When creating new content (code, HTML, PRD, etc), always use create_artifact tool instead of writing it in the chat.

Available artifacts in this conversation are listed in the system context.

### Documents
The user can upload documents (PDF, images, text files) into the chat. When they do, you'll see the document content in the context. You can reference and discuss these documents.

### Slash Commands
The user can use slash commands like /summarize, /deep-dive, etc. When you receive a command instruction, execute it.

### @Mentions
The user can mention other agents with @name. If you receive a message about another agent being mentioned, coordinate accordingly.

Respond in the same language as the user (French if they write in French, English if English, etc.).`;

/** Prompt used when tools are NOT available (CLI fallback, block-based parsing). */
const CHAT_FEATURES_PROMPT_BLOCKS = `## Chat Features

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

function buildSystemPrompt(
  agent: typeof agents.$inferSelect | undefined,
  useTools = false,
): string {
  const featuresPrompt = useTools ? CHAT_FEATURES_PROMPT_TOOLS : CHAT_FEATURES_PROMPT_BLOCKS;

  if (!agent) return "You are a helpful AI assistant. Respond concisely and helpfully.\n\n" + featuresPrompt;

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
  parts.push(featuresPrompt);

  if (parts.length <= 1) {
    return "You are a helpful AI assistant.\n\n" + featuresPrompt;
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
