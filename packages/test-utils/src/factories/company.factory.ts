import type { Db } from "@mnm/db";
import { companies } from "@mnm/db";

let companyCounter = 0;

export type TestCompanyOverrides = Partial<typeof companies.$inferInsert>;

/**
 * Build a plain company object for unit tests (no DB insert).
 */
export function buildTestCompany(overrides?: TestCompanyOverrides) {
  companyCounter++;
  return {
    name: `Test Company ${companyCounter}`,
    description: `Description for test company ${companyCounter}`,
    status: "active" as const,
    issuePrefix: `TC${companyCounter}`,
    budgetMonthlyCents: 10000,
    ...overrides,
  };
}

/**
 * Insert a company into the DB and return the row.
 */
export async function createTestCompany(db: Db, overrides?: TestCompanyOverrides) {
  const values = buildTestCompany(overrides);
  const [row] = await db.insert(companies).values(values).returning();
  return row!;
}
