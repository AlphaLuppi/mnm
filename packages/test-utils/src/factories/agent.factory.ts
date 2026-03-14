import type { Db } from "@mnm/db";
import { agents } from "@mnm/db";

let agentCounter = 0;

export type TestAgentOverrides = Partial<Omit<typeof agents.$inferInsert, "companyId">>;

/**
 * Build a plain agent object for unit tests (no DB insert).
 * companyId is required and must be provided separately.
 */
export function buildTestAgent(companyId: string, overrides?: TestAgentOverrides) {
  agentCounter++;
  return {
    companyId,
    name: `Test Agent ${agentCounter}`,
    role: "engineer",
    title: `Test Agent Title ${agentCounter}`,
    status: "idle" as const,
    adapterType: "process" as const,
    adapterConfig: { command: "echo", args: ["test"] },
    budgetMonthlyCents: 5000,
    ...overrides,
  };
}

/**
 * Insert an agent into the DB and return the row.
 */
export async function createTestAgent(
  db: Db,
  companyId: string,
  overrides?: TestAgentOverrides,
) {
  const values = buildTestAgent(companyId, overrides);
  const [row] = await db.insert(agents).values(values).returning();
  return row!;
}
