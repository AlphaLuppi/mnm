import type { Db } from "@mnm/db";
import { principalPermissionGrants } from "@mnm/db";

let permissionCounter = 0;

export type TestPermissionGrantOverrides = Partial<
  Omit<typeof principalPermissionGrants.$inferInsert, "companyId" | "principalId" | "permissionKey">
>;

/**
 * Build a plain permission grant object for unit tests (no DB insert).
 */
export function buildTestPermissionGrant(
  companyId: string,
  principalId: string,
  permissionKey: string,
  overrides?: TestPermissionGrantOverrides,
) {
  permissionCounter++;
  return {
    companyId,
    principalType: "user" as const,
    principalId,
    permissionKey,
    ...overrides,
  };
}

/**
 * Insert a permission grant into the DB and return the row.
 */
export async function createTestPermissionGrant(
  db: Db,
  companyId: string,
  principalId: string,
  permissionKey: string,
  overrides?: TestPermissionGrantOverrides,
) {
  const values = buildTestPermissionGrant(companyId, principalId, permissionKey, overrides);
  const [row] = await db.insert(principalPermissionGrants).values(values).returning();
  return row!;
}
