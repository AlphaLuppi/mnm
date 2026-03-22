import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  authUsers,
  companyMemberships,
  instanceUserRoles,
} from "@mnm/db";
import type { PrincipalType, ResourceScope } from "@mnm/shared";
import { scopeSchema } from "@mnm/shared";
import { badRequest } from "../errors.js";

type MembershipRow = typeof companyMemberships.$inferSelect;

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

  // TODO [PERM-01]: Rewrite with role-based permission resolution + tag intersection
  // This is a STUB that allows all actions for active members.
  // Sprint 2 will implement the full permission engine.
  async function hasPermission(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
    permissionKey: string,
    resourceScope?: ResourceScope,
  ): Promise<boolean> {
    const membership = await getMembership(companyId, principalType, principalId);
    if (!membership || membership.status !== "active") return false;
    // STUB: allow all actions for active members until PERM-01 implements role-based checks
    return true;
  }

  async function canUser(
    companyId: string,
    userId: string | null | undefined,
    permissionKey: string,
    resourceScope?: ResourceScope,
  ): Promise<boolean> {
    if (!userId) return false;
    // Instance admins bypass ALL permission and scope checks
    if (await isInstanceAdmin(userId)) return true;
    return hasPermission(companyId, "user", userId, permissionKey, resourceScope);
  }

  async function listMembers(companyId: string) {
    const rows = await db
      .select({
        id: companyMemberships.id,
        companyId: companyMemberships.companyId,
        principalType: companyMemberships.principalType,
        principalId: companyMemberships.principalId,
        status: companyMemberships.status,
        membershipRole: companyMemberships.membershipRole,
        roleId: companyMemberships.roleId,
        createdAt: companyMemberships.createdAt,
        updatedAt: companyMemberships.updatedAt,
        userName: authUsers.name,
        userEmail: authUsers.email,
        userImage: authUsers.image,
      })
      .from(companyMemberships)
      .leftJoin(
        authUsers,
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, authUsers.id),
        ),
      )
      .where(eq(companyMemberships.companyId, companyId))
      .orderBy(sql`${companyMemberships.createdAt} desc`);
    return rows;
  }

  async function updateMemberStatus(
    companyId: string,
    memberId: string,
    status: "active" | "suspended",
  ) {
    const member = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.id, memberId)))
      .then((rows) => rows[0] ?? null);
    if (!member) return null;

    const updated = await db
      .update(companyMemberships)
      .set({ status, updatedAt: new Date() })
      .where(eq(companyMemberships.id, member.id))
      .returning()
      .then((rows) => rows[0] ?? null);
    return updated ?? member;
  }

  async function updateMemberRole(
    companyId: string,
    memberId: string,
    roleId: string,
  ) {
    const member = await db
      .select()
      .from(companyMemberships)
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.id, memberId)))
      .then((rows) => rows[0] ?? null);
    if (!member) return null;

    const updated = await db
      .update(companyMemberships)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(companyMemberships.id, member.id))
      .returning()
      .then((rows) => rows[0] ?? null);
    return updated ?? member;
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
      })
      .returning()
      .then((rows) => rows[0]);
  }

  // TODO [PERM-01]: getEffectivePermissions should load from roles + role_permissions tables
  async function getEffectivePermissions(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
  ): Promise<{
    roleId: string | null;
    effectivePermissions: string[];
  }> {
    const membership = await getMembership(companyId, principalType, principalId);
    if (!membership || membership.status !== "active") {
      return { roleId: null, effectivePermissions: [] };
    }
    // STUB: return roleId but no permission resolution until PERM-01
    return {
      roleId: membership.roleId,
      effectivePermissions: [],
    };
  }

  // TODO [PERM-01]: hasGlobalScope should check role.bypass_tag_filter
  async function hasGlobalScope(companyId: string, userId: string): Promise<boolean> {
    const membership = await getMembership(companyId, "user", userId);
    if (!membership || membership.status !== "active") return false;
    // STUB: all active members have global scope until PERM-01
    return true;
  }

  return {
    isInstanceAdmin,
    canUser,
    hasPermission,
    getMembership,
    ensureMembership,
    listMembers,
    updateMemberRole,
    updateMemberStatus,
    getEffectivePermissions,
    promoteInstanceAdmin,
    demoteInstanceAdmin,
    listUserCompanyAccess,
    setUserCompanyAccess,
    hasGlobalScope,
  };
}
