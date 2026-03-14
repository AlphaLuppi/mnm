import type { Db } from "@mnm/db";
import { authUsers } from "@mnm/db";

let userCounter = 0;

export type TestUserOverrides = Partial<typeof authUsers.$inferInsert>;

/**
 * Build a plain auth user object for unit tests (no DB insert).
 * Note: authUsers.id is TEXT, not UUID — must be provided.
 */
export function buildTestUser(overrides?: TestUserOverrides) {
  userCounter++;
  const now = new Date();
  return {
    id: `test-user-${userCounter}-${Date.now()}`,
    name: `Test User ${userCounter}`,
    email: `testuser${userCounter}-${Date.now()}@test.dev`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Insert an auth user into the DB and return the row.
 */
export async function createTestUser(db: Db, overrides?: TestUserOverrides) {
  const values = buildTestUser(overrides);
  const [row] = await db.insert(authUsers).values(values).returning();
  return row!;
}
