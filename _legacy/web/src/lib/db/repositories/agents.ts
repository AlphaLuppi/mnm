import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import type { AgentStatus } from "@/lib/core/types";

export type AgentRow = typeof agents.$inferSelect;

export function findById(id: string): AgentRow | undefined {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.id, id)).get();
}

export function findByStatus(status: AgentStatus): AgentRow[] {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.status, status)).all();
}

export function findAll(): AgentRow[] {
  const db = getDb();
  return db.select().from(agents).all();
}

export function insert(agent: typeof agents.$inferInsert): void {
  const db = getDb();
  db.insert(agents).values(agent).run();
}

export function update(id: string, data: Partial<Omit<typeof agents.$inferInsert, "id">>): AgentRow | undefined {
  const db = getDb();
  db.update(agents)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(agents.id, id))
    .run();
  return findById(id);
}

export function remove(id: string): void {
  const db = getDb();
  db.delete(agents).where(eq(agents.id, id)).run();
}
