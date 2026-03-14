import type { Db } from "@mnm/db";
import { issues } from "@mnm/db";

let issueCounter = 0;

export type TestIssueOverrides = Partial<Omit<typeof issues.$inferInsert, "companyId" | "projectId">>;

/**
 * Build a plain issue object for unit tests (no DB insert).
 * companyId and projectId are required and must be provided separately.
 */
export function buildTestIssue(
  companyId: string,
  projectId: string,
  overrides?: TestIssueOverrides,
) {
  issueCounter++;
  return {
    companyId,
    projectId,
    title: `Test Issue ${issueCounter}`,
    description: `Description for test issue ${issueCounter}`,
    status: "backlog" as const,
    priority: "medium" as const,
    ...overrides,
  };
}

/**
 * Insert an issue into the DB and return the row.
 */
export async function createTestIssue(
  db: Db,
  companyId: string,
  projectId: string,
  overrides?: TestIssueOverrides,
) {
  const values = buildTestIssue(companyId, projectId, overrides);
  const [row] = await db.insert(issues).values(values).returning();
  return row!;
}
