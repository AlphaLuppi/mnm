import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  companyMemberships,
  instanceUserRoles,
  principalPermissionGrants,
} from "@mnm/db";
import type { BusinessRole, PermissionKey, PrincipalType, ResourceScope } from "@mnm/shared";
import { BUSINESS_ROLES, isPermissionInPreset, getPresetPermissions } from "@mnm/shared";
import { scopeSchema } from "@mnm/shared";
import { badRequest } from "../errors.js";

type MembershipRow = typeof companyMemberships.$inferSelect;
type GrantInput = {
  permissionKey: PermissionKey;
  scope?: Record<string, unknown> | null;
};

function validateScope(scope: unknown): void {
  if (scope === undefined || scope === null) return;
  const result = scopeSchema.safeParse(scope);
  if (!result.success) {
    throw badRequest("Invalid permission scope", {
      issues: result.error.issues,
    });
  }
}

export function accessService(db: Db) {
  async function isInstanceAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const row = await db
      .select({ id: instanceUserRoles.id })
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);
    return Boolean(row);
  }

  async function getMembership(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
  ): Promise<MembershipRow | null> {
    return db
      .select()
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, principalType),
          eq(companyMemberships.principalId, principalId),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  async function hasPermission(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
    permissionKey: PermissionKey,
    resourceScope?: ResourceScope,
  ): Promise<boolean> {
    const membership = await getMembership(companyId, principalType, principalId);
    if (!membership || membership.status !== "active") return false;
    const grant = await db
      .select({
        id: principalPermissionGrants.id,
        scope: principalPermissionGrants.scope,
      })
      .from(principalPermissionGrants)
      .where(
        and(
          eq(principalPermissionGrants.companyId, companyId),
          eq(principalPermissionGrants.principalType, principalType),
          eq(principalPermissionGrants.principalId, principalId),
          eq(principalPermissionGrants.permissionKey, permissionKey),
        ),
      )
      .then((rows) => rows[0] ?? null);
    // If an explicit grant exists, evaluate it (with scope)
    if (grant) {
      // No resource scope requested — grant alone is sufficient
      if (!resourceScope) return true;

      // Grant has no scope (null or empty) — wildcard access
      const grantScope = grant.scope as Record<string, unknown> | null | undefined;
      if (!grantScope || Object.keys(grantScope).length === 0) return true;

      // Check projectIds coverage
      const requestedProjectIds = resourceScope.projectIds;
      if (requestedProjectIds && requestedProjectIds.length > 0) {
        const grantedProjectIds = Array.isArray(grantScope.projectIds)
          ? new Set(grantScope.projectIds as string[])
          : null;
        // Grant has no projectIds restriction — wildcard for projects
        if (!grantedProjectIds) return true;
        // All requested projectIds must be covered by the grant
        const allCovered = requestedProjectIds.every((id) => grantedProjectIds.has(id));
        if (!allCovered) return false;
      }

      return true;
    }

    // No explicit grant — fallback to businessRole preset
    const businessRole = membership.businessRole as BusinessRole | null;
    if (!businessRole) return false;

    // Preset grants company-wide access (no scope restriction).
    // If the permission is in the preset, it covers any resourceScope.
    return isPermissionInPreset(businessRole, permissionKey);
  }

  async function canUser(
    companyId: string,
    userId: string | null | undefined,
    permissionKey: PermissionKey,
    resourceScope?: ResourceScope,
  ): Promise<boolean> {
    if (!userId) return false;
    // Instance admins bypass ALL permission and scope checks
    if (await isInstanceAdmin(userId)) return true;
    return hasPermission(companyId, "user", userId, permissionKey, resourceScope);
  }

  async function listMembers(companyId: string) {
    return db
      .select()
      .from(companyMemberships)
      .where(eq(companyMemberships.companyId, companyId))
      .orderBy(sql`${companyMemberships.createdAt} desc`);
  }

  async function setMemberPermissions(
    companyId: string,
    memberId: string,
    grants: GrantInput[],
    grantedByUserId: string | null,
  ) {
    // Validate all scopes before touching the DB
    for (const grant of grants) {
      validateScope(grant.scope);
    }

    const member = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.id, memberId)))
      .then((rows) => rows[0] ?? null);
    if (!member) return null;

    await db.transaction(async (tx) => {
      await tx
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.companyId, companyId),
            eq(principalPermissionGrants.principalType, member.principalType),
            eq(principalPermissionGrants.principalId, member.principalId),
          ),
        );
      if (grants.length > 0) {
        await tx.insert(principalPermissionGrants).values(
          grants.map((grant) => ({
            companyId,
            principalType: member.principalType,
            principalId: member.principalId,
            permissionKey: grant.permissionKey,
            scope: grant.scope ?? null,
            grantedByUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    });

    return member;
  }

  async function promoteInstanceAdmin(userId: string) {
    const existing = await db
      .select()
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;
    return db
      .insert(instanceUserRoles)
      .values({
        userId,
        role: "instance_admin",
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function demoteInstanceAdmin(userId: string) {
    return db
      .delete(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function listUserCompanyAccess(userId: string) {
    return db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.principalType, "user"), eq(companyMemberships.principalId, userId)))
      .orderBy(sql`${companyMemberships.createdAt} desc`);
  }

  async function setUserCompanyAccess(userId: string, companyIds: string[]) {
    const existing = await listUserCompanyAccess(userId);
    const existingByCompany = new Map(existing.map((row) => [row.companyId, row]));
    const target = new Set(companyIds);

    await db.transaction(async (tx) => {
      const toDelete = existing.filter((row) => !target.has(row.companyId)).map((row) => row.id);
      if (toDelete.length > 0) {
        await tx.delete(companyMemberships).where(inArray(companyMemberships.id, toDelete));
      }

      for (const companyId of target) {
        if (existingByCompany.has(companyId)) continue;
        await tx.insert(companyMemberships).values({
          companyId,
          principalType: "user",
          principalId: userId,
          status: "active",
          membershipRole: "member",
        });
      }
    });

    return listUserCompanyAccess(userId);
  }

  async function ensureMembership(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
    membershipRole: string | null = "member",
    status: "pending" | "active" | "suspended" = "active",
    businessRole: BusinessRole = "contributor",
  ) {
    const existing = await getMembership(companyId, principalType, principalId);
    if (existing) {
      if (existing.status !== status || existing.membershipRole !== membershipRole) {
        const updated = await db
          .update(companyMemberships)
          .set({ status, membershipRole, updatedAt: new Date() })
          .where(eq(companyMemberships.id, existing.id))
          .returning()
          .then((rows) => rows[0] ?? null);
        return updated ?? existing;
      }
      return existing;
    }

    return db
      .insert(companyMemberships)
      .values({
        companyId,
        principalType,
        principalId,
        status,
        membershipRole,
        businessRole,
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function updateMemberBusinessRole(
    companyId: string,
    memberId: string,
    businessRole: BusinessRole,
  ) {
    const member = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.id, memberId)))
      .then((rows) => rows[0] ?? null);
    if (!member) return null;

    const updated = await db
      .update(companyMemberships)
      .set({ businessRole, updatedAt: new Date() })
      .where(eq(companyMemberships.id, member.id))
      .returning()
      .then((rows) => rows[0] ?? null);
    return updated ?? member;
  }

  async function setPrincipalGrants(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
    grants: GrantInput[],
    grantedByUserId: string | null,
  ) {
    // Validate all scopes before touching the DB
    for (const grant of grants) {
      validateScope(grant.scope);
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(principalPermissionGrants)
        .where(
          and(
            eq(principalPermissionGrants.companyId, companyId),
            eq(principalPermissionGrants.principalType, principalType),
            eq(principalPermissionGrants.principalId, principalId),
          ),
        );
      if (grants.length === 0) return;
      await tx.insert(principalPermissionGrants).values(
        grants.map((grant) => ({
          companyId,
          principalType,
          principalId,
          permissionKey: grant.permissionKey,
          scope: grant.scope ?? null,
          grantedByUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    });
  }

  async function getEffectivePermissions(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
  ): Promise<{
    businessRole: BusinessRole | null;
    presetPermissions: PermissionKey[];
    explicitGrants: Array<{
      permissionKey: PermissionKey;
      scope: Record<string, unknown> | null;
    }>;
    effectivePermissions: PermissionKey[];
  }> {
    const membership = await getMembership(companyId, principalType, principalId);
    if (!membership || membership.status !== "active") {
      return {
        businessRole: null,
        presetPermissions: [],
        explicitGrants: [],
        effectivePermissions: [],
      };
    }

    const businessRole = membership.businessRole as BusinessRole | null;
    const presetPerms = businessRole ? [...getPresetPermissions(businessRole)] : [];

    const grants = await db
      .select({
        permissionKey: principalPermissionGrants.permissionKey,
        scope: principalPermissionGrants.scope,
      })
      .from(principalPermissionGrants)
      .where(
        and(
          eq(principalPermissionGrants.companyId, companyId),
          eq(principalPermissionGrants.principalType, principalType),
          eq(principalPermissionGrants.principalId, principalId),
        ),
      );

    const explicitGrants = grants.map((g) => ({
      permissionKey: g.permissionKey as PermissionKey,
      scope: g.scope as Record<string, unknown> | null,
    }));

    // Effective permissions = union of preset + explicit grants
    const effectiveSet = new Set<PermissionKey>(presetPerms);
    for (const grant of explicitGrants) {
      effectiveSet.add(grant.permissionKey);
    }

    return {
      businessRole,
      presetPermissions: presetPerms,
      explicitGrants,
      effectivePermissions: [...effectiveSet].sort(),
    };
  }

  return {
    isInstanceAdmin,
    canUser,
    hasPermission,
    getMembership,
    ensureMembership,
    listMembers,
    setMemberPermissions,
    updateMemberBusinessRole,
    getEffectivePermissions,
    promoteInstanceAdmin,
    demoteInstanceAdmin,
    listUserCompanyAccess,
    setUserCompanyAccess,
    setPrincipalGrants,
  };
}
