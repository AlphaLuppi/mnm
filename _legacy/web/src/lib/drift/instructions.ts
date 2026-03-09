import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createChildLogger } from "@/lib/core/logger";

const log = createChildLogger({ module: "drift-instructions" });

let cachedContent: string | null = null;
let cachedHash: string | null = null;

export function loadCustomInstructions(repoRoot: string): string | null {
  const filePath = join(repoRoot, ".mnm", "drift-instructions.md");

  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = readFileSync(filePath, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");

    if (hash !== cachedHash) {
      cachedContent = content;
      cachedHash = hash;
      log.info({ filePath, hash }, "Custom drift instructions loaded");
    }

    return cachedContent;
  } catch (err) {
    log.warn(
      { filePath, error: err instanceof Error ? err.message : String(err) },
      "Failed to load custom drift instructions"
    );
    return null;
  }
}
