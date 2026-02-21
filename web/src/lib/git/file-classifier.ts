import { getGit } from "@/lib/git/repository";
import { getAnthropicAuthHeaders } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";
import fs from "node:fs";
import path from "node:path";

const logger = createChildLogger({ module: "file-classifier" });

export interface FileClassification {
  filePath: string;
  fileType: "ProductBrief" | "Prd" | "Story" | "Architecture" | "Config" | "Code";
  confidence: "High" | "Medium" | "Low";
}

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".mnm",
  "coverage",
  "__pycache__",
  ".turbo",
  ".cache",
]);

const CANDIDATE_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".yaml",
  ".yml",
  ".json",
  ".toml",
  ".txt",
  ".rst",
]);

export async function scanCandidateFiles(repoRoot: string): Promise<string[]> {
  const git = getGit();
  const result = await git.raw(["ls-files", "--cached", "--others", "--exclude-standard"]);
  const allFiles = result.split("\n").filter(Boolean);

  return allFiles.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    if (!CANDIDATE_EXTENSIONS.has(ext)) return false;
    const parts = f.split("/");
    return !parts.some((p) => EXCLUDED_DIRS.has(p));
  });
}

function readFileHead(repoRoot: string, filePath: string, lines: number = 20): string {
  try {
    const fullPath = path.join(repoRoot, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    return content.split("\n").slice(0, lines).join("\n");
  } catch {
    return "";
  }
}

export async function classifyFiles(
  repoRoot: string,
  files: string[]
): Promise<FileClassification[]> {
  const authHeaders = getAnthropicAuthHeaders();

  if (!authHeaders) {
    logger.warn("No ANTHROPIC_API_KEY set; using heuristic classification");
    return files.map((f) => heuristicClassify(f));
  }

  const BATCH_SIZE = 20;
  const results: FileClassification[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyBatch(repoRoot, batch, authHeaders);
    results.push(...batchResults);
  }

  return results;
}

async function classifyBatch(
  repoRoot: string,
  files: string[],
  authHeaders: Record<string, string>
): Promise<FileClassification[]> {
  const fileInfos = files.map((f) => ({
    path: f,
    head: readFileHead(repoRoot, f),
  }));

  const prompt = `Classify each file as one of: ProductBrief, Prd, Story, Architecture, Config, Code.
Also assign confidence: High, Medium, Low.

Files:
${fileInfos.map((f, i) => `[${i}] ${f.path}\nFirst lines:\n${f.head}\n---`).join("\n")}

Respond with ONLY a JSON array:
[{"index":0,"fileType":"Prd","confidence":"High"},...]`;

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
      logger.error({ status: response.status }, "Claude API error in file classification");
      return files.map((f) => heuristicClassify(f));
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      logger.warn("Could not parse Claude classification response");
      return files.map((f) => heuristicClassify(f));
    }

    const parsed: { index: number; fileType: string; confidence: string }[] =
      JSON.parse(jsonMatch[0]);

    return parsed.map((p) => ({
      filePath: files[p.index] ?? files[0],
      fileType: validateFileType(p.fileType),
      confidence: validateConfidence(p.confidence),
    }));
  } catch (err) {
    logger.error({ err }, "File classification failed");
    return files.map((f) => heuristicClassify(f));
  }
}

function validateFileType(
  t: string
): FileClassification["fileType"] {
  const valid = ["ProductBrief", "Prd", "Story", "Architecture", "Config", "Code"];
  return valid.includes(t) ? (t as FileClassification["fileType"]) : "Code";
}

function validateConfidence(c: string): FileClassification["confidence"] {
  const valid = ["High", "Medium", "Low"];
  return valid.includes(c) ? (c as FileClassification["confidence"]) : "Low";
}

export function heuristicClassify(filePath: string): FileClassification {
  const lower = filePath.toLowerCase();
  const name = path.basename(lower);

  if (
    lower.includes("product-brief") ||
    lower.includes("product_brief") ||
    name === "product-brief.md"
  ) {
    return { filePath, fileType: "ProductBrief", confidence: "High" };
  }
  if (lower.includes("prd") || name.includes("requirements")) {
    return { filePath, fileType: "Prd", confidence: "Medium" };
  }
  if (lower.includes("story") || lower.includes("stories")) {
    return { filePath, fileType: "Story", confidence: "Medium" };
  }
  if (
    lower.includes("architecture") ||
    lower.includes("design") ||
    lower.includes("tech-spec")
  ) {
    return { filePath, fileType: "Architecture", confidence: "Medium" };
  }
  if (
    name.endsWith(".yaml") ||
    name.endsWith(".yml") ||
    name.endsWith(".toml") ||
    name.endsWith(".json") ||
    name.includes("config") ||
    name.includes("setting")
  ) {
    return { filePath, fileType: "Config", confidence: "Low" };
  }
  return { filePath, fileType: "Code", confidence: "Low" };
}

export async function detectImportantFiles(
  repoRoot: string
): Promise<FileClassification[]> {
  const candidates = await scanCandidateFiles(repoRoot);
  const classified = await classifyFiles(repoRoot, candidates);
  return classified.filter((c) => c.fileType !== "Code");
}
