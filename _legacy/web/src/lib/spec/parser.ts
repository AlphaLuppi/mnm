import { createHash } from "node:crypto";
import matter from "gray-matter";
import type { SpecType } from "@/lib/core/types";

export interface ParsedSpec {
  title: string | null;
  specType: SpecType;
  contentHash: string;
  frontmatter: Record<string, unknown> | null;
  body: string;
}

const PATH_PATTERNS: [RegExp, SpecType][] = [
  [/product[-_]?brief/i, "product_brief"],
  [/prd/i, "prd"],
  [/architect/i, "architecture"],
  [/stor(?:y|ies)/i, "story"],
  [/epic/i, "story"],
  [/config/i, "config"],
];

function classifyByPath(filePath: string): SpecType | null {
  for (const [pattern, type] of PATH_PATTERNS) {
    if (pattern.test(filePath)) return type;
  }
  return null;
}

function extractH1(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function parseMarkdown(filePath: string, raw: string): ParsedSpec {
  const { data: frontmatter, content: body } = matter(raw);
  const hasFrontmatter = Object.keys(frontmatter).length > 0;

  // Title: frontmatter title > H1 heading > null
  const title =
    (frontmatter.title as string) ??
    extractH1(body) ??
    null;

  // Spec type: frontmatter spec_type > path pattern > fallback
  let specType: SpecType =
    (frontmatter.spec_type as SpecType) ??
    (frontmatter.specType as SpecType) ??
    classifyByPath(filePath) ??
    "config";

  return {
    title,
    specType,
    contentHash: contentHash(raw),
    frontmatter: hasFrontmatter ? frontmatter : null,
    body,
  };
}

export function parseJson(filePath: string, raw: string): ParsedSpec | null {
  try {
    const data = JSON.parse(raw);
    return {
      title: data.title ?? data.name ?? null,
      specType: classifyByPath(filePath) ?? "config",
      contentHash: contentHash(raw),
      frontmatter: null,
      body: raw,
    };
  } catch {
    return null;
  }
}

export function parseSpecFile(filePath: string, raw: string): ParsedSpec | null {
  if (filePath.endsWith(".json")) {
    return parseJson(filePath, raw);
  }
  if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) {
    return parseMarkdown(filePath, raw);
  }
  return null;
}
