import type { Db } from "@mnm/db";
import { projects } from "@mnm/db";

let projectCounter = 0;

export type TestProjectOverrides = Partial<Omit<typeof projects.$inferInsert, "companyId">>;

/**
 * Build a plain project object for unit tests (no DB insert).
 * companyId is required and must be provided separately.
 */
export function buildTestProject(companyId: string, overrides?: TestProjectOverrides) {
  projectCounter++;
  return {
    companyId,
    name: `Test Project ${projectCounter}`,
    description: `Description for test project ${projectCounter}`,
    status: "backlog" as const,
    ...overrides,
  };
}

/**
 * Insert a project into the DB and return the row.
 */
export async function createTestProject(
  db: Db,
  companyId: string,
  overrides?: TestProjectOverrides,
) {
  const values = buildTestProject(companyId, overrides);
  const [row] = await db.insert(projects).values(values).returning();
  return row!;
}
