import { getDb } from "@/lib/db";
import { agents, specs } from "@/lib/db/schema";
import { like } from "drizzle-orm";

export interface LinkedSpec {
  id: string;
  title: string | null;
  specType: string;
  filePath: string;
  linkReason: string;
}

export function findRelatedSpecs(codeFilePath: string): LinkedSpec[] {
  const db = getDb();
  const results: LinkedSpec[] = [];
  const seenIds = new Set<string>();

  // Strategy 1: Check agents whose scope includes this file
  const allAgents = db.select().from(agents).all();
  for (const agent of allAgents) {
    if (!agent.scope || !agent.specId) continue;
    try {
      const scopeFiles: string[] = JSON.parse(agent.scope);
      if (scopeFiles.some((f) => f === codeFilePath || codeFilePath.includes(f))) {
        const spec = db
          .select()
          .from(specs)
          .where(like(specs.id, agent.specId))
          .get();
        if (spec && !seenIds.has(spec.id)) {
          seenIds.add(spec.id);
          results.push({
            id: spec.id,
            title: spec.title,
            specType: spec.specType,
            filePath: spec.filePath,
            linkReason: `Agent "${agent.name}" worked on this file`,
          });
        }
      }
    } catch {
      // scope parse error, skip
    }
  }

  // Strategy 2: Search spec file paths that mention the code file
  const allSpecs = db.select().from(specs).all();
  for (const spec of allSpecs) {
    if (seenIds.has(spec.id)) continue;
    // Check if the code file path is mentioned in the spec file path (naive)
    const codeDir = codeFilePath.split("/").slice(0, -1).join("/");
    if (codeDir && spec.filePath.includes(codeDir)) {
      seenIds.add(spec.id);
      results.push({
        id: spec.id,
        title: spec.title,
        specType: spec.specType,
        filePath: spec.filePath,
        linkReason: "Same directory context",
      });
    }
  }

  return results;
}
