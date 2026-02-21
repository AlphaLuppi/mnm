import { NextRequest } from "next/server";
import { getAnthropicApiKey, getAnthropicAuthHeaders, loadConfig } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";
import { buildOnboardingSystemPrompt } from "@/lib/onboarding/system-prompt";
import { getClaudeCLIStatus, streamPromptToCLI } from "@/lib/claude/cli";
import type { ProjectContext } from "@/lib/onboarding/types";
import * as specRepo from "@/lib/db/repositories/specs";
import * as workflowRepo from "@/lib/db/repositories/workflows";

const log = createChildLogger({ module: "onboarding-chat" });

interface ChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: ProjectContext;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages } = body;

    // Build project context
    const config = loadConfig();
    const specs = specRepo.findAll();
    const workflows = workflowRepo.findAll();
    const apiKey = getAnthropicApiKey();

    // Check CLI status for canChat
    const cliStatus = await getClaudeCLIStatus();
    const canChat = (cliStatus.installed && cliStatus.authenticated) || !!apiKey;

    const context: ProjectContext = body.context ?? {
      hasRepository: !!config.repositoryPath,
      repositoryPath: config.repositoryPath,
      specCount: specs.length,
      workflowCount: workflows.length,
      hasApiKey: !!apiKey,
      discoveryComplete: specs.length > 0 || workflows.length > 0,
      claudeCLIAuthenticated: cliStatus.authenticated,
      claudeCLIVersion: cliStatus.version,
      canChat,
    };

    const systemPrompt = buildOnboardingSystemPrompt(context);

    // Use Claude CLI if available
    if (cliStatus.installed && cliStatus.authenticated) {
      // Use Claude CLI
      return handleCLIChat(messages, systemPrompt, request.signal);
    }

    // Fall back to API if we have credentials
    const authHeaders = getAnthropicAuthHeaders();
    if (authHeaders) {
      return handleAPIChat(messages, systemPrompt, authHeaders);
    }

    // No auth available
    return new Response(
      JSON.stringify({
        error: {
          code: "AUTH_REQUIRED",
          message: "Please configure your Claude API key or install Claude CLI.",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : "unknown" }, "Chat endpoint error");
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle chat using Claude CLI
 */
function handleCLIChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  signal?: AbortSignal
): Response {
  // Build conversation context for CLI
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  if (!lastUserMessage) {
    return new Response(
      JSON.stringify({ error: { code: "NO_MESSAGE", message: "No user message" } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Include recent conversation context in the prompt
  const conversationContext = messages
    .slice(-6) // Last 6 messages for context
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const fullPrompt = conversationContext
    ? `Previous conversation:\n${conversationContext}\n\nRespond to the user's last message.`
    : lastUserMessage.content;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const { abort } = streamPromptToCLI(
        fullPrompt,
        systemPrompt,
        (chunk) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          );
        },
        () => {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        },
        (error) => {
          log.error({ error }, "CLI stream error");
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error })}\n\n`)
          );
          controller.close();
        },
        60000
      );

      // Handle client disconnect
      signal?.addEventListener("abort", () => {
        abort();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Handle chat using Anthropic API directly
 */
async function handleAPIChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  systemPrompt: string,
  authHeaders: Record<string, string>
): Promise<Response> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ status: response.status, error: errorText }, "Claude API error");
    return new Response(
      JSON.stringify({
        error: {
          code: "CLAUDE_API_ERROR",
          message: `Claude API returned ${response.status}`,
        },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Forward the streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === "content_block_delta") {
                  const delta = parsed.delta;
                  if (delta?.type === "text_delta" && delta.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`)
                    );
                  }
                } else if (parsed.type === "message_stop") {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        log.error({ error: err instanceof Error ? err.message : "unknown" }, "Stream error");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
