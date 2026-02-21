import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, getAnthropicAuthHeaders } from "@/lib/core/config";
import * as specRepo from "@/lib/db/repositories/specs";
import * as workflowRepo from "@/lib/db/repositories/workflows";

export async function POST(request: NextRequest) {
  const authHeaders = getAnthropicAuthHeaders();
  if (!authHeaders) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { messages, pageContext } = await request.json();
  const config = loadConfig();

  const specs = specRepo.findAll();
  const workflows = workflowRepo.findAll();

  // Load command summaries
  const commandsDir = path.join(config.repositoryPath, ".claude", "commands");
  let commandSummaries = "No custom commands found.";
  try {
    if (fs.existsSync(commandsDir)) {
      const files = fs
        .readdirSync(commandsDir)
        .filter((f) => f.endsWith(".md"))
        .slice(0, 20);
      if (files.length > 0) {
        commandSummaries = files
          .map((f) => {
            const content = fs.readFileSync(path.join(commandsDir, f), "utf-8");
            const summary = content.slice(0, 200);
            return `- /${f.replace(/\.md$/, "")}: ${summary}${content.length > 200 ? "..." : ""}`;
          })
          .join("\n");
      }
    }
  } catch {
    // Ignore errors reading commands directory
  }

  const specNames = specs.map((s) => s.title || s.filePath).join(", ") || "none";
  const workflowNames = workflows.map((w) => w.name).join(", ") || "none";

  const systemPrompt = `You are the MnM Assistant — the AI orchestrator embedded in MnM (Mindful Management), a Product-First Agile Development Environment.

MnM helps development teams maintain alignment between product specs and code through:
- Spec-as-Interface: specifications are the source of truth
- Cross-Document Drift Detection: keeping specs and code in sync
- BMAD Workflows: structured AI-driven development phases

## Project Context
- Repository: ${config.repositoryPath}
- Specs: ${specs.length} spec(s) — ${specNames}
- Workflows: ${workflows.length} workflow(s) — ${workflowNames}
- Current page: ${pageContext || "Dashboard"}

## Available Commands
${commandSummaries}

## Your Role
- Guide users through MnM workflows concisely
- Ask ONE clarifying question at a time when needed
- Reference specs and workflows by name
- Be concise and action-oriented
- After completing an action, suggest next steps
- When users ask to scan for drift or run workflows, explain what would happen and guide them through the process`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      ...authHeaders,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown API error");
    return NextResponse.json(
      { error: `Anthropic API error: ${response.status} - ${errText}` },
      { status: response.status }
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return NextResponse.json(
      { error: "No response stream" },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (
                event.type === "content_block_delta" &&
                event.delta?.text
              ) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
                  )
                );
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: `\n\n[Error: ${message}]` })}\n\n`
          )
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
