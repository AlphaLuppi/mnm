import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { importantFiles } from "@/lib/db/schema";

export type ImportantFileRow = typeof importantFiles.$inferSelect;

export function findAll(): ImportantFileRow[] {
  const db = getDb();
  return db.select().from(importantFiles).all();
}

export function findByType(fileType: string): ImportantFileRow[] {
  const db = getDb();
  return db
    .select()
    .from(importantFiles)
    .where(eq(importantFiles.fileType, fileType))
    .all();
}

export function insert(file: typeof importantFiles.$inferInsert): void {
  const db = getDb();
  db.insert(importantFiles).values(file).run();
}

export function update(
  id: string,
  data: Partial<Omit<typeof importantFiles.$inferInsert, "id">>
): ImportantFileRow | undefined {
  const db = getDb();
  db.update(importantFiles)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(importantFiles.id, id))
    .run();
  return db
    .select()
    .from(importantFiles)
    .where(eq(importantFiles.id, id))
    .get();
}
