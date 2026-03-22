import type { Db } from "@mnm/db";
import { rolePermissions } from "@mnm/db";

let permissionCounter = 0;

export type TestPermissionGrantOverrides = Partial<{
  grantedByUserId: string;
}>;

/**
 * Build a plain role-permission mapping object for unit tests (no DB insert).
 *
 * NOTE: The old principalPermissionGrants table was removed.
 * This now builds a rolePermissions row (roleId + permissionId).
 * The overrides parameter is kept for API compatibility but ignored.
 */
export function buildTestPermissionGrant(
  _companyId: string,
  roleId: string,
  permissionId: string,
  _overrides?: TestPermissionGrantOverrides,
) {
  permissionCounter++;
  return {
    roleId,
    permissionId,
  };
}

/**
 * Insert a role-permission mapping into the DB and return the row.
 *
 * NOTE: The old principalPermissionGrants table was removed.
 * This now inserts into rolePermissions. Parameters kept for minimal API change.
 */
export async function createTestPermissionGrant(
  db: Db,
  _companyId: string,
  roleId: string,
  permissionId: string,
  _overrides?: TestPermissionGrantOverrides,
) {
  const values = buildTestPermissionGrant(_companyId, roleId, permissionId, _overrides);
  const [row] = await db.insert(rolePermissions).values(values).returning();
  return row!;
}
