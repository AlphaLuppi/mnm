import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { discoveryResults } from "@/lib/db/schema";

export type DiscoveryResultRow = typeof discoveryResults.$inferSelect;
export type DiscoveryResultInsert = typeof discoveryResults.$inferInsert;

export type DiscoveryType = "spec" | "workflow" | "agent" | "command" | "config";

export function findAll(): DiscoveryResultRow[] {
  const db = getDb();
  return db.select().from(discoveryResults).all();
}

export function findByType(type: DiscoveryType): DiscoveryResultRow[] {
  const db = getDb();
  return db
    .select()
    .from(discoveryResults)
    .where(eq(discoveryResults.type, type))
    .all();
}

export function upsert(data: {
  type: string;
  path: string;
  classification?: string | null;
  name?: string | null;
  metadata?: string | null;
  llmModel?: string | null;
}): void {
  const db = getDb();
  const now = new Date();

  const existing = db
    .select()
    .from(discoveryResults)
    .where(eq(discoveryResults.path, data.path))
    .get();

  if (existing) {
    db.update(discoveryResults)
      .set({
        type: data.type,
        classification: data.classification ?? null,
        name: data.name ?? null,
        metadata: data.metadata ?? null,
        llmModel: data.llmModel ?? null,
        discoveredAt: now,
      })
      .where(eq(discoveryResults.id, existing.id))
      .run();
  } else {
    db.insert(discoveryResults)
      .values({
        type: data.type,
        path: data.path,
        classification: data.classification ?? null,
        name: data.name ?? null,
        metadata: data.metadata ?? null,
        llmModel: data.llmModel ?? null,
        discoveredAt: now,
      })
      .run();
  }
}

export function deleteAll(): void {
  const db = getDb();
  db.delete(discoveryResults).run();
}

export function getLastScanTime(): Date | null {
  const db = getDb();
  const row = db
    .select({ discoveredAt: discoveryResults.discoveredAt })
    .from(discoveryResults)
    .orderBy(desc(discoveryResults.discoveredAt))
    .limit(1)
    .get();

  return row?.discoveredAt ?? null;
}
