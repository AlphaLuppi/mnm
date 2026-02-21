import { createChildLogger } from "@/lib/core/logger";
import { getAnthropicAuthHeaders } from "@/lib/core/config";
import { MnMError } from "@/lib/core/errors";
import type { RepoOverview } from "./repo-scanner";

const log = createChildLogger({ module: "llm-classifier" });

const MODEL = "claude-sonnet-4-20250514";
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

export interface ClassificationResult {
  path: string;
  type: "spec" | "workflow" | "agent" | "command" | "config";
  classification: string;
  name: string;
  confidence: number;
}

/** Classify discovered files using Claude API. */
export async function classifyWithLLM(
  overview: RepoOverview
): Promise<ClassificationResult[]> {
  const authHeaders = getAnthropicAuthHeaders();
  if (!authHeaders) {
    log.warn("No ANTHROPIC_API_KEY configured, skipping LLM classification");
    return classifyWithHeuristics(overview);
  }

  const prompt = buildClassificationPrompt(overview);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    const startTime = Date.now();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const status = response.status;
        log.warn({ status, duration, attempt }, "Claude API returned non-OK status");

        if (status === 400 || status === 401) {
          log.warn("Non-retryable API error, falling back to heuristics");
          return classifyWithHeuristics(overview);
        }

        lastError = new Error(`HTTP ${status}`);
        continue;
      }

      const data = await response.json();
      log.info(
        { duration, inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
        "LLM classification completed"
      );

      return parseClassificationResponse(data);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn({ error: lastError.message, attempt }, "LLM classification call failed");
    }
  }

  log.warn(
    { error: lastError?.message },
    "LLM classification failed after retries, falling back to heuristics"
  );
  return classifyWithHeuristics(overview);
}

function buildClassificationPrompt(overview: RepoOverview): string {
  const summaryLines: string[] = [
    `Repository at: ${overview.repoRoot}`,
    `Total files: ${overview.totalFiles}`,
    "",
    "Tool directories found:",
  ];

  for (const td of overview.toolDirectories) {
    summaryLines.push(`  - ${td.name} (${td.type}, ${td.fileCount} files)`);
  }

  summaryLines.push("", "Files by category:");
  for (const [category, files] of Object.entries(overview.filesByCategory)) {
    // Only show first 10 files per category to keep prompt manageable
    const shown = files.slice(0, 10);
    const extra = files.length > 10 ? ` ... and ${files.length - 10} more` : "";
    summaryLines.push(`  ${category} (${files.length}):`);
    for (const f of shown) {
      summaryLines.push(`    - ${f}`);
    }
    if (extra) summaryLines.push(`    ${extra}`);
  }

  return `You are analyzing a software repository that uses the BMAD (Business Method Agile Development) framework. Based on the repository structure below, classify noteworthy files into these categories: spec, workflow, agent, command, config.

For each file, provide:
- path: the file path
- type: one of "spec", "workflow", "agent", "command", "config"
- classification: a short description of what this file represents
- name: a human-readable name
- confidence: a number from 0 to 1

Focus on the most important files - BMAD workflow definitions, agent configurations, planning artifacts (PRD, architecture, epics), and tool configs. Skip source code files and trivial configs.

Return your response as a JSON array. Example:
[{"path": "_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml", "type": "workflow", "classification": "Development story execution workflow", "name": "dev-story", "confidence": 0.95}]

Repository structure:
${summaryLines.join("\n")}

Respond ONLY with the JSON array, no explanation.`;
}

function parseClassificationResponse(data: Record<string, unknown>): ClassificationResult[] {
  const content = data.content as Array<{ type: string; text: string }>;
  if (!content?.[0] || content[0].type !== "text") {
    log.warn("No text content in LLM classification response");
    return [];
  }

  let text = content[0].text.trim();

  // Strip markdown code fences if present
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      log.warn("LLM classification response is not an array");
      return [];
    }

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.path === "string" &&
          typeof item.type === "string" &&
          ["spec", "workflow", "agent", "command", "config"].includes(item.type as string)
      )
      .map((item: Record<string, unknown>) => ({
        path: item.path as string,
        type: item.type as ClassificationResult["type"],
        classification: (item.classification as string) ?? "",
        name: (item.name as string) ?? "",
        confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
      }));
  } catch {
    log.warn({ text: text.slice(0, 200) }, "Failed to parse LLM classification response");
    return [];
  }
}

/** Fallback: classify files using path-based heuristics when no API key is available. */
export function classifyWithHeuristics(overview: RepoOverview): ClassificationResult[] {
  const results: ClassificationResult[] = [];

  for (const [category, files] of Object.entries(overview.filesByCategory)) {
    for (const filePath of files) {
      const mapped = mapCategoryToType(category, filePath);
      if (mapped) {
        results.push({
          path: filePath,
          type: mapped.type,
          classification: mapped.classification,
          name: mapped.name,
          confidence: 0.7,
        });
      }
    }
  }

  return results;
}

function mapCategoryToType(
  category: string,
  filePath: string
): { type: ClassificationResult["type"]; classification: string; name: string } | null {
  const basename = filePath.split("/").pop()?.replace(/\.(md|yaml|yml|json|csv)$/, "") ?? filePath;

  switch (category) {
    case "workflow":
      if (filePath.includes("workflow"))
        return { type: "workflow", classification: "BMAD workflow definition", name: basename };
      return null;
    case "agent-config":
      return { type: "agent", classification: "BMAD agent definition", name: basename };
    case "config":
      return { type: "config", classification: "Configuration file", name: basename };
    case "command":
      return { type: "command", classification: "Claude Code command", name: basename };
    case "story":
      return { type: "spec", classification: "User story", name: basename };
    case "planning-artifact":
      return { type: "spec", classification: "Planning artifact", name: basename };
    default:
      return null;
  }
}
