import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { logger } from "../middleware/logger.js";

/**
 * In-memory cache for custom drift instructions.
 * Key = absolute file path, Value = { hash, content }
 */
const cache = new Map<string, { hash: string; content: string }>();

/**
 * Load custom drift instructions from `.mnm/drift-instructions.md` in the repo root.
 * Returns the instructions content, or null if the file doesn't exist.
 * Caches by content hash to avoid re-reading unchanged files.
 */
export async function loadCustomInstructions(repoRoot: string): Promise<string | null> {
  const filePath = path.join(repoRoot, ".mnm", "drift-instructions.md");

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist — not an error
    return null;
  }

  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const cached = cache.get(filePath);

  if (cached && cached.hash === hash) {
    return cached.content;
  }

  cache.set(filePath, { hash, content });
  logger.info({ filePath, hash: hash.slice(0, 12) }, "Loaded custom drift instructions");
  return content;
}
