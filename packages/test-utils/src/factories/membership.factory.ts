import type { Db } from "@mnm/db";
import { companyMemberships, projectMemberships } from "@mnm/db";

let companyMembershipCounter = 0;
let projectMembershipCounter = 0;

// ── Company Memberships ────────────────────────────────────────────────────

export type TestCompanyMembershipOverrides = Partial<
  Omit<typeof companyMemberships.$inferInsert, "companyId" | "principalId">
>;

/**
 * Build a plain company membership object for unit tests (no DB insert).
 */
export function buildTestCompanyMembership(
  companyId: string,
  principalId: string,
  overrides?: TestCompanyMembershipOverrides,
) {
  companyMembershipCounter++;
  return {
    companyId,
    principalType: "user" as const,
    principalId,
    status: "active" as const,
    membershipRole: "member" as const,
    businessRole: "contributor" as const,
    ...overrides,
  };
}

/**
 * Insert a company membership into the DB and return the row.
 */
export async function createTestCompanyMembership(
  db: Db,
  companyId: string,
  principalId: string,
  overrides?: TestCompanyMembershipOverrides,
) {
  const values = buildTestCompanyMembership(companyId, principalId, overrides);
  const [row] = await db.insert(companyMemberships).values(values).returning();
  return row!;
}

// ── Project Memberships ────────────────────────────────────────────────────

export type TestProjectMembershipOverrides = Partial<
  Omit<typeof projectMemberships.$inferInsert, "companyId" | "projectId" | "userId">
>;

/**
 * Build a plain project membership object for unit tests (no DB insert).
 */
export function buildTestProjectMembership(
  companyId: string,
  projectId: string,
  userId: string,
  overrides?: TestProjectMembershipOverrides,
) {
  projectMembershipCounter++;
  return {
    companyId,
    projectId,
    userId,
    role: "contributor" as const,
    ...overrides,
  };
}

/**
 * Insert a project membership into the DB and return the row.
 */
export async function createTestProjectMembership(
  db: Db,
  companyId: string,
  projectId: string,
  userId: string,
  overrides?: TestProjectMembershipOverrides,
) {
  const values = buildTestProjectMembership(companyId, projectId, userId, overrides);
  const [row] = await db.insert(projectMemberships).values(values).returning();
  return row!;
}
