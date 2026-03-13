export interface CommitReference {
  type: "refs" | "implements" | "closes";
  specPath: string;
}

// Patterns: refs: <spec>, implements: <spec>, closes: <spec>, story: <spec>, spec: <spec>
// Spec patterns: story-1.2.md, story-1.2, #story-1.2, FR3.2, fr3.2
const REFERENCE_PATTERN =
  /(?:refs|implements|closes|story|spec)\s*:\s*([^\s,;]+)/gi;

const KEYWORD_MAP: Record<string, CommitReference["type"]> = {
  refs: "refs",
  implements: "implements",
  closes: "closes",
  story: "refs",
  spec: "refs",
};

export function parseCommitReferences(message: string): CommitReference[] {
  const results: CommitReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  const regex = new RegExp(REFERENCE_PATTERN.source, "gi");

  while ((match = regex.exec(message)) !== null) {
    const fullMatch = match[0];
    const specRef = match[1];

    // Determine reference type from keyword
    const keyword = fullMatch.split(/\s*:/)[0].toLowerCase();
    const refType = KEYWORD_MAP[keyword] ?? "refs";

    // Normalize spec path
    const normalized = normalizeSpecPath(specRef);

    const key = `${refType}:${normalized}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: refType,
        specPath: normalized,
      });
    }
  }

  return results;
}

function normalizeSpecPath(ref: string): string {
  // Remove leading # or hash symbol
  let path = ref.replace(/^#/, "");

  // Add .md extension if missing a known file extension
  const hasKnownExtension = /\.(md|mdx|yaml|yml|json|toml|txt|rst)$/i.test(path);
  if (
    !hasKnownExtension &&
    !(/^FR\d/i.test(path)) &&
    (path.startsWith("story") ||
      path.startsWith("spec") ||
      path.includes("-") ||
      path.includes("/"))
  ) {
    path = path + ".md";
  }

  // Normalize FR references: fr3.2 -> FR3.2 (keep as-is, used for matching)
  if (/^fr\d/i.test(path)) {
    path = path.toUpperCase();
  }

  return path;
}

export function matchSpecPath(
  reference: string,
  knownPaths: string[]
): string | null {
  const refLower = reference.toLowerCase().replace(/\.md$/, "");

  for (const knownPath of knownPaths) {
    const pathLower = knownPath.toLowerCase();

    // Exact match (with or without extension)
    if (pathLower === refLower || pathLower === refLower + ".md") {
      return knownPath;
    }

    // Basename match
    const basename = pathLower.split("/").pop()?.replace(/\.md$/, "") ?? "";
    if (basename === refLower) {
      return knownPath;
    }

    // Partial match (reference is part of the path)
    if (pathLower.includes(refLower)) {
      return knownPath;
    }
  }

  return null;
}
