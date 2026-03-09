import { eq, like } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { specs } from "@/lib/db/schema";
import type { SpecType } from "@/lib/core/types";

export type SpecRow = typeof specs.$inferSelect;

export function findById(id: string): SpecRow | undefined {
  const db = getDb();
  return db.select().from(specs).where(eq(specs.id, id)).get();
}

export function findByPath(filePath: string): SpecRow | undefined {
  const db = getDb();
  return db.select().from(specs).where(eq(specs.filePath, filePath)).get();
}

export function findByType(specType: SpecType): SpecRow[] {
  const db = getDb();
  return db.select().from(specs).where(eq(specs.specType, specType)).all();
}

export function search(query: string): SpecRow[] {
  const db = getDb();
  const pattern = `%${query}%`;
  return db
    .select()
    .from(specs)
    .where(like(specs.title, pattern))
    .all();
}

export function findAll(): SpecRow[] {
  const db = getDb();
  return db.select().from(specs).all();
}

export function insert(spec: typeof specs.$inferInsert): void {
  const db = getDb();
  db.insert(specs).values(spec).run();
}

export function update(id: string, data: Partial<Omit<typeof specs.$inferInsert, "id">>): SpecRow | undefined {
  const db = getDb();
  db.update(specs)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(specs.id, id))
    .run();
  return findById(id);
}
