import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { parseSpecFile } from "./parser";
import { getDb } from "@/lib/db";
import { specs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/core/logger";

function specId(filePath: string): string {
  return createHash("sha256").update(filePath).digest("hex").slice(0, 16);
}

export interface IndexResult {
  total: number;
  indexed: number;
  skipped: number;
  errors: string[];
}

export async function indexSpecs(repoRoot: string): Promise<IndexResult> {
  const result: IndexResult = { total: 0, indexed: 0, skipped: 0, errors: [] };

  const files = await fg(["**/*.md", "**/*.json"], {
    cwd: repoRoot,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.mnm/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/target/**",
      "**/package.json",
      "**/package-lock.json",
      "**/tsconfig.json",
      "**/drizzle.config.ts",
      "**/*.config.*",
    ],
    dot: false,
  });

  result.total = files.length;
  const now = Date.now();
  const db = getDb();

  for (const relPath of files) {
    try {
      const absPath = path.join(repoRoot, relPath);
      const raw = fs.readFileSync(absPath, "utf-8");
      const parsed = parseSpecFile(relPath, raw);

      if (!parsed) {
        result.skipped++;
        continue;
      }

      const id = specId(relPath);
      const stat = fs.statSync(absPath);

      const existing = db.select().from(specs).where(eq(specs.id, id)).get();

      if (existing && existing.contentHash === parsed.contentHash) {
        result.skipped++;
        continue;
      }

      const row = {
        id,
        filePath: relPath,
        specType: parsed.specType,
        title: parsed.title,
        lastModified: Math.floor(stat.mtimeMs),
        gitCommitSha: null,
        contentHash: parsed.contentHash,
        workflowStage: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) {
        db.update(specs).set(row).where(eq(specs.id, id)).run();
      } else {
        db.insert(specs).values(row).run();
      }

      result.indexed++;
    } catch (err) {
      const msg = `Failed to index ${relPath}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(msg);
      result.errors.push(msg);
      result.skipped++;
    }
  }

  return result;
}
