import { getAnthropicAuthHeaders } from "@/lib/core/config";
import * as specChangesRepo from "@/lib/db/repositories/spec-changes";
import { createChildLogger } from "@/lib/core/logger";

const logger = createChildLogger({ module: "change-summarizer" });

const MAX_CONCURRENT = 3;

export async function summarizeChange(
  oldContent: string,
  newContent: string,
  filePath: string
): Promise<string> {
  const authHeaders = getAnthropicAuthHeaders();

  if (!authHeaders) {
    return `File changed: ${filePath}`;
  }

  const prompt = `You are summarizing a spec file change in a software project.

File: ${filePath}

Old content:
\`\`\`
${oldContent.slice(0, 3000)}
\`\`\`

New content:
\`\`\`
${newContent.slice(0, 3000)}
\`\`\`

Summarize what changed and why it matters in 1-3 sentences. Be specific about the nature of the change (e.g., "Product vision updated: new feature X added to roadmap" or "Architecture decision: switched from PostgreSQL to SQLite"). Do NOT include the file path in your summary.`;

  try {
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
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      logger.error(
        { status: response.status },
        "Claude API error in change summarization"
      );
      return `File changed: ${filePath}`;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    if (!text.trim()) {
      return `File changed: ${filePath}`;
    }

    return text.trim();
  } catch (err) {
    logger.error({ err, filePath }, "Change summarization failed");
    return `File changed: ${filePath}`;
  }
}

export async function summarizeChangeById(changeId: string): Promise<string> {
  const change = specChangesRepo.findById(changeId);
  if (!change) {
    return "Change not found";
  }

  // For now, use the diff content as a proxy for old/new content
  // In a full implementation, we'd read old/new file content from git
  const summary = await summarizeChange(
    change.oldCommitSha ? `Content at ${change.oldCommitSha}` : "",
    `Content at ${change.newCommitSha}`,
    change.filePath
  );

  specChangesRepo.updateSummary(changeId, summary);
  return summary;
}

export async function summarizeChanges(changeIds: string[]): Promise<void> {
  // Process with concurrency limit
  const queue = [...changeIds];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < MAX_CONCURRENT && queue.length > 0) {
      const id = queue.shift()!;
      const promise = summarizeChangeById(id)
        .then(() => {
          const idx = running.indexOf(promise);
          if (idx >= 0) running.splice(idx, 1);
        })
        .catch((err) => {
          logger.error({ err, changeId: id }, "Failed to summarize change");
          const idx = running.indexOf(promise);
          if (idx >= 0) running.splice(idx, 1);
        });
      running.push(promise);
    }

    if (running.length > 0) {
      await Promise.race(running);
    }
  }
}
