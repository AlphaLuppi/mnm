import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

export type WorkflowRow = typeof workflows.$inferSelect;
export type WorkflowInsert = typeof workflows.$inferInsert;

export function findAll(): WorkflowRow[] {
  const db = getDb();
  return db.select().from(workflows).all();
}

export function findById(id: number): WorkflowRow | undefined {
  const db = getDb();
  return db.select().from(workflows).where(eq(workflows.id, id)).get();
}

export function upsertFromDiscovery(data: {
  name: string;
  description?: string | null;
  phase?: string | null;
  sourcePath: string;
  stepsJson?: string | null;
  metadata?: string | null;
}): WorkflowRow | undefined {
  const db = getDb();
  const now = new Date();

  const existing = db
    .select()
    .from(workflows)
    .where(eq(workflows.sourcePath, data.sourcePath))
    .get();

  if (existing) {
    db.update(workflows)
      .set({
        name: data.name,
        description: data.description ?? null,
        phase: data.phase ?? null,
        stepsJson: data.stepsJson ?? null,
        metadata: data.metadata ?? null,
        updatedAt: now,
      })
      .where(eq(workflows.id, existing.id))
      .run();
    return findById(existing.id);
  }

  const result = db
    .insert(workflows)
    .values({
      name: data.name,
      description: data.description ?? null,
      phase: data.phase ?? null,
      sourcePath: data.sourcePath,
      stepsJson: data.stepsJson ?? null,
      metadata: data.metadata ?? null,
      discoveredAt: now,
      updatedAt: now,
    })
    .run();

  return findById(Number(result.lastInsertRowid));
}

export function deleteAll(): void {
  const db = getDb();
  db.delete(workflows).run();
}
