import { readdirSync, statSync, existsSync } from "fs";
import { join, dirname, extname, relative } from "path";
import { loadConfig } from "@/lib/core/config";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "scope-inference" });

export interface InferredScope {
  files: string[];
  directories: string[];
  patterns: string[];
  confidence: "high" | "medium" | "low";
  source: "spec_content" | "directory_scan" | "fallback";
}

const CODE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt",
  ".vue", ".svelte", ".astro",
  ".css", ".scss", ".less",
  ".json", ".yaml", ".yml", ".toml",
];

const IGNORE_DIRS = [
  "node_modules", ".git", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", "target",
  "coverage", ".nyc_output", ".cache",
];

/**
 * Infer file scope from spec content by extracting file paths and patterns.
 */
export function inferScopeFromSpec(specContent: string): InferredScope {
  const config = loadConfig();
  const repoRoot = config.repositoryPath;

  const files: Set<string> = new Set();
  const directories: Set<string> = new Set();
  const patterns: Set<string> = new Set();

  // Pattern 1: Explicit file paths (src/components/foo.tsx, lib/utils.ts)
  const filePathPattern = /(?:^|\s|`|"|'|\[)([a-zA-Z0-9_\-./]+\/[a-zA-Z0-9_\-./]+\.[a-zA-Z]{2,4})(?:\s|$|`|"|'|\]|:)/gm;
  let match;
  while ((match = filePathPattern.exec(specContent)) !== null) {
    const filePath = match[1];
    if (existsSync(join(repoRoot, filePath))) {
      files.add(filePath);
      directories.add(dirname(filePath));
    }
  }

  // Pattern 2: Directory references (src/components/, lib/api/)
  const dirPattern = /(?:^|\s|`|"|')([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)+)\/?(?:\s|$|`|"|')/gm;
  while ((match = dirPattern.exec(specContent)) !== null) {
    const dirPath = match[1];
    if (existsSync(join(repoRoot, dirPath)) && statSync(join(repoRoot, dirPath)).isDirectory()) {
      directories.add(dirPath);
    }
  }

  // Pattern 3: Component/module names that might map to files
  const componentPattern = /(?:component|module|service|hook|page|route)\s*[:`]?\s*([A-Z][a-zA-Z0-9]+)/gi;
  while ((match = componentPattern.exec(specContent)) !== null) {
    patterns.add(match[1]);
  }

  // Pattern 4: File references in task lists (- [ ] src/foo/bar.ts)
  const taskFilePattern = /^\s*-\s*\[[ x]\]\s*(?:.*?`)?([a-zA-Z0-9_\-./]+\.[a-zA-Z]{2,4})(?:`.*)?$/gm;
  while ((match = taskFilePattern.exec(specContent)) !== null) {
    const filePath = match[1];
    if (existsSync(join(repoRoot, filePath))) {
      files.add(filePath);
      directories.add(dirname(filePath));
    }
  }

  // Expand directories to include code files
  const expandedFiles = new Set<string>(files);
  for (const dir of directories) {
    const dirFiles = scanDirectory(join(repoRoot, dir), repoRoot, 2);
    dirFiles.forEach((f) => expandedFiles.add(f));
  }

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "low";
  if (expandedFiles.size > 0 && files.size > 0) {
    confidence = "high";
  } else if (directories.size > 0) {
    confidence = "medium";
  }

  log.info(
    { fileCount: expandedFiles.size, directoryCount: directories.size, confidence },
    "Inferred scope from spec content"
  );

  return {
    files: Array.from(expandedFiles),
    directories: Array.from(directories),
    patterns: Array.from(patterns),
    confidence,
    source: expandedFiles.size > 0 ? "spec_content" : "fallback",
  };
}

/**
 * Scan a directory recursively for code files.
 */
function scanDirectory(dirPath: string, repoRoot: string, maxDepth: number): string[] {
  const files: string[] = [];

  if (maxDepth <= 0 || !existsSync(dirPath)) {
    return files;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORE_DIRS.includes(entry.name)) continue;

      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(repoRoot, fullPath).replace(/\\/g, "/");

      if (entry.isFile() && CODE_EXTENSIONS.includes(extname(entry.name))) {
        files.push(relativePath);
      } else if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath, repoRoot, maxDepth - 1));
      }
    }
  } catch (err) {
    log.warn({ dirPath, error: err }, "Failed to scan directory");
  }

  return files;
}

/**
 * Scan repository for all code files (fallback when spec provides no hints).
 */
export function scanRepositoryForCodeFiles(maxFiles: number = 100): string[] {
  const config = loadConfig();
  const repoRoot = config.repositoryPath;

  const files: string[] = [];

  // Prioritize common source directories
  const priorityDirs = ["src", "lib", "app", "components", "pages", "api"];

  for (const dir of priorityDirs) {
    const dirPath = join(repoRoot, dir);
    if (existsSync(dirPath)) {
      files.push(...scanDirectory(dirPath, repoRoot, 3));
      if (files.length >= maxFiles) break;
    }
  }

  // If we still need more files, scan root
  if (files.length < maxFiles) {
    const rootFiles = scanDirectory(repoRoot, repoRoot, 2);
    for (const f of rootFiles) {
      if (!files.includes(f)) {
        files.push(f);
        if (files.length >= maxFiles) break;
      }
    }
  }

  log.info({ fileCount: files.length }, "Scanned repository for code files");
  return files.slice(0, maxFiles);
}

/**
 * Get suggested scope for a spec, combining inference and fallback.
 */
export function getSuggestedScope(specContent: string): InferredScope {
  const inferred = inferScopeFromSpec(specContent);

  // If we found files from spec content, use them
  if (inferred.files.length > 0) {
    return inferred;
  }

  // Fallback: scan repository
  const repoFiles = scanRepositoryForCodeFiles(50);
  return {
    files: repoFiles,
    directories: [],
    patterns: [],
    confidence: "low",
    source: "fallback",
  };
}
