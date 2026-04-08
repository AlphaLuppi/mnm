import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  agents,
  authUsers,
  companyMemberships,
  instanceUserRoles,
  invites,
  roles,
  rolePermissions,
  permissions,
  tags,
  tagAssignments,
} from "@mnm/db";
import { isNull, gt } from "drizzle-orm";
import { normalizeAgentPermissions } from "./agent-permissions.js";
import type { PrincipalType } from "@mnm/shared";
import { badRequest } from "../errors.js";
import { logger } from "../middleware/logger.js";

type MembershipRow = typeof companyMemberships.$inferSelect;

// ── Cache ────────────────────────────────────────────────────────────────────
// NOTE: In-process Map caches. Works for single-instance deployment only.
// For multi-instance (horizontal scaling), replace with Redis or shared cache.
// MnM is currently single-tenant/single-instance — this is fine for now.

interface CachedRole {
  roleId: string;
  slug: string;
  bypassTagFilter: boolean;
  hierarchyLevel: number;
  permissionSlugs: Set<string>;
  cachedAt: number;
}

interface CachedTags {
  tagIds: Set<string>;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const roleCache = new Map<string, CachedRole>(); // key = `${companyId}:${principalType}:${principalId}`
const tagCache = new Map<string, CachedTags>(); // same key pattern

function cacheKey(companyId: string, principalType: string, principalId: string) {
  return `${companyId}:${principalType}:${principalId}`;
}

function isStale(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

// ── Service ──────────────────────────────────────────────────────────────────

export function accessService(db: Db) {

  // ── Instance Admin ───────────────────────────────────────────────────────

  async function isInstanceAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const row = await db
      .select({ id: instanceUserRoles.id })
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);
    return Boolean(row);
  }

  // ── Membership ───────────────────────────────────────────────────────────

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

  // ── Role + Permission Resolution ─────────────────────────────────────────

  /**
   * Load role + permissions for a principal. Cached for 5 minutes.
   * Resolution: membership → role → role_permissions ∪ parent role_permissions (1 level)
   */
  async function resolveRole(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
  ): Promise<CachedRole | null> {
    const key = cacheKey(companyId, principalType, principalId);
    const cached = roleCache.get(key);
    if (cached && !isStale(cached.cachedAt)) return cached;

    const membership = await getMembership(companyId, principalType, principalId);
    if (!membership || membership.status !== "active" || !membership.roleId) return null;

    // Load the role
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, membership.roleId));
    if (!role) return null;

    // Load permission slugs for this role
    const ownPerms = await db
      .select({ slug: permissions.slug })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, role.id));

    const slugs = new Set(ownPerms.map((p) => p.slug));

    // 1-level inheritance: load parent permissions
    if (role.inheritsFromId) {
      const parentPerms = await db
        .select({ slug: permissions.slug })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(eq(rolePermissions.roleId, role.inheritsFromId));
      for (const p of parentPerms) slugs.add(p.slug);
    }

    const result: CachedRole = {
      roleId: role.id,
      slug: role.slug,
      bypassTagFilter: role.bypassTagFilter,
      hierarchyLevel: role.hierarchyLevel,
      permissionSlugs: slugs,
      cachedAt: Date.now(),
    };

    roleCache.set(key, result);
    return result;
  }

  /**
   * Load tag IDs for a principal. Cached for 5 minutes.
   */
  async function getTagIds(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
  ): Promise<Set<string>> {
    const key = cacheKey(companyId, principalType, principalId);
    const cached = tagCache.get(key);
    if (cached && !isStale(cached.cachedAt)) return cached.tagIds;

    const rows = await db
      .select({ tagId: tagAssignments.tagId })
      .from(tagAssignments)
      .where(
        and(
          eq(tagAssignments.companyId, companyId),
          eq(tagAssignments.targetType, principalType),
          eq(tagAssignments.targetId, principalId),
        ),
      );

    const tagIds = new Set(rows.map((r) => r.tagId));
    tagCache.set(key, { tagIds, cachedAt: Date.now() });
    return tagIds;
  }

  // ── Permission Check ─────────────────────────────────────────────────────

  /**
   * Core permission check:
   * 1. Check membership is active
   * 2. Check role has the required permission
   *
   * Tag-based isolation is enforced at the QUERY level (TagScope middleware + tagFilterService),
   * NOT in this function. This function only checks role-based permissions.
   */
  async function hasPermission(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
    permissionKey: string,
  ): Promise<boolean> {
    // For agents: also check direct permissionSlugs stored on the agent record
    if (principalType === "agent") {
      const agentRow = await db
        .select({ permissions: agents.permissions })
        .from(agents)
        .where(and(eq(agents.id, principalId), eq(agents.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (agentRow) {
        const normalized = normalizeAgentPermissions(agentRow.permissions);
        if (normalized.permissionSlugs.includes(permissionKey)) return true;
      }
    }

    const role = await resolveRole(companyId, principalType, principalId);
    if (!role) return false;

    // Check the permission exists in the role (+ inherited)
    return role.permissionSlugs.has(permissionKey);
  }

  /**
   * Convenience: check permission for a board user.
   * Instance admins bypass all checks.
   */
  async function canUser(
    companyId: string,
    userId: string | null | undefined,
    permissionKey: string,
  ): Promise<boolean> {
    if (!userId) return false;
    if (await isInstanceAdmin(userId)) return true;
    return hasPermission(companyId, "user", userId, permissionKey);
  }

  /**
   * Check if the user's role has bypass_tag_filter (Admin-level visibility).
   */
  async function hasGlobalScope(companyId: string, userId: string): Promise<boolean> {
    const membership = await getMembership(companyId, "user", userId);
    if (!membership || membership.status !== "active") return false;

    const role = await resolveRole(companyId, "user", userId);
    if (!role) return false;
    return role.bypassTagFilter;
  }

  /**
   * Returns the effective permissions for a principal (for the API response).
   */
  async function getEffectivePermissions(
    companyId: string,
    principalType: PrincipalType,
    principalId: string,
  ): Promise<{
    roleId: string | null;
    roleName: string | null;
    bypassTagFilter: boolean;
    effectivePermissions: string[];
  }> {
    const role = await resolveRole(companyId, principalType, principalId);
    if (!role) {
      return { roleId: null, roleName: null, bypassTagFilter: false, effectivePermissions: [] };
    }

    // Also fetch the role name for display
    const [roleRow] = await db
      .select({ name: roles.name })
      .from(roles)
      .where(eq(roles.id, role.roleId));

    return {
      roleId: role.roleId,
      roleName: roleRow?.name ?? null,
      bypassTagFilter: role.bypassTagFilter,
      effectivePermissions: [...role.permissionSlugs].sort(),
    };
  }

  // ── Cache Invalidation ───────────────────────────────────────────────────

  function invalidateRoleCache(companyId?: string, principalId?: string) {
    if (principalId && companyId) {
      // Targeted: clear specific user
      for (const key of roleCache.keys()) {
        if (key.startsWith(`${companyId}:`) && key.endsWith(`:${principalId}`)) {
          roleCache.delete(key);
        }
      }
    } else {
      // Global: clear all
      roleCache.clear();
    }
  }

  function invalidateTagCache(companyId?: string, targetId?: string) {
    if (targetId && companyId) {
      for (const key of tagCache.keys()) {
        if (key.startsWith(`${companyId}:`) && key.endsWith(`:${targetId}`)) {
          tagCache.delete(key);
        }
      }
    } else {
      tagCache.clear();
    }
  }

  // ── Member Management ────────────────────────────────────────────────────

  async function listMembers(companyId: string) {
    // Active human members
    const members = await db
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
      .where(and(eq(companyMemberships.companyId, companyId), eq(companyMemberships.principalType, "user")))
      .orderBy(sql`${companyMemberships.createdAt} desc`);

    // Pending invites (not accepted, not revoked, not expired)
    const now = new Date();
    const pendingInvites = await db
      .select({
        id: invites.id,
        targetEmail: invites.targetEmail,
        createdAt: invites.createdAt,
        expiresAt: invites.expiresAt,
      })
      .from(invites)
      .where(and(
        eq(invites.companyId, companyId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, now),
      ));

    // Merge: pending invites as "pending" members
    const pendingRows = pendingInvites.map((inv) => ({
      id: inv.id,
      companyId,
      principalType: "user" as const,
      principalId: inv.id,
      status: "pending",
      membershipRole: null,
      roleId: null,
      createdAt: inv.createdAt,
      updatedAt: inv.createdAt,
      userName: null,
      userEmail: inv.targetEmail,
      userImage: null,
    }));

    return [...members, ...pendingRows];
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

    // Invalidate cache for this member
    invalidateRoleCache(companyId, member.principalId);
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

    // Invalidate cache — role changed means new permissions
    invalidateRoleCache(companyId, member.principalId);
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
      .values({ userId, role: "instance_admin" })
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
    _membershipRole: string | null = "member", // Legacy param — ignored, always "member". Roles are in the `roles` table now.
    status: "pending" | "active" | "suspended" = "active",
    roleId?: string | null,
  ) {
    const existing = await getMembership(companyId, principalType, principalId);
    if (existing) {
      const updates: Record<string, unknown> = {};
      if (existing.status !== status) updates.status = status;
      if (roleId && !existing.roleId) updates.roleId = roleId;
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        const updated = await db
          .update(companyMemberships)
          .set(updates)
          .where(eq(companyMemberships.id, existing.id))
          .returning()
          .then((rows) => rows[0] ?? null);
        if (roleId) invalidateRoleCache(companyId, principalId);
        return updated ?? existing;
      }
      return existing;
    }

    const row = await db
      .insert(companyMemberships)
      .values({
        companyId,
        principalType,
        principalId,
        status,
        membershipRole: "member",
        ...(roleId ? { roleId } : {}),
      })
      .returning()
      .then((rows) => rows[0]);
    if (roleId) invalidateRoleCache(companyId, principalId);
    return row;
  }

  /**
   * Find the lowest-hierarchy-level role for a company (the most restricted / default role).
   */
  async function getDefaultRoleId(companyId: string): Promise<string | null> {
    const [lowest] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.companyId, companyId), eq(roles.bypassTagFilter, false)))
      .orderBy(asc(roles.hierarchyLevel))
      .limit(1);
    return lowest?.id ?? null;
  }

  /**
   * Auto-assign a default tag to a user when they join a company.
   * If no tags exist in the company, creates a personal tag for the user.
   */
  async function assignDefaultTagOnJoin(
    companyId: string,
    userId: string,
    userName: string | null,
    assignedBy: string,
  ): Promise<void> {
    // Check if user already has tags
    const existingTags = await getTagIds(companyId, "user", userId);
    if (existingTags.size > 0) return;

    // Wrap in transaction to prevent race condition where concurrent joins
    // create duplicate personal tags
    await db.transaction(async (tx) => {
      // Look for an existing default/general tag
      const allTags = await tx
        .select({ id: tags.id, slug: tags.slug })
        .from(tags)
        .where(and(eq(tags.companyId, companyId), isNull(tags.archivedAt)));

      // Prefer a tag with slug "default" or "general" or "everyone"
      const defaultTag = allTags.find((t) =>
        ["default", "general", "everyone", "all"].includes(t.slug),
      );

      if (defaultTag) {
        await tx
          .insert(tagAssignments)
          .values({
            companyId,
            targetType: "user",
            targetId: userId,
            tagId: defaultTag.id,
            assignedBy,
          })
          .onConflictDoNothing();
        invalidateTagCache(companyId, userId);
        return;
      }

      // No default tag — create a personal tag for the user
      const baseName = userName || userId.slice(0, 8);
      const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";

      // Ensure slug uniqueness
      const existingSlugs = new Set(allTags.map((t) => t.slug));
      let finalSlug = slug;
      let counter = 1;
      while (existingSlugs.has(finalSlug)) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }

      // Use onConflictDoNothing to handle concurrent inserts of the same slug
      const [createdTag] = await tx
        .insert(tags)
        .values({
          companyId,
          name: baseName,
          slug: finalSlug,
          description: `Personal tag for ${baseName}`,
        })
        .onConflictDoNothing()
        .returning();

      // If conflict occurred, re-query to get the existing tag
      const tagId = createdTag?.id ?? (await tx
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.companyId, companyId), eq(tags.slug, finalSlug)))
        .then((rows) => rows[0]?.id ?? null));

      if (tagId) {
        await tx
          .insert(tagAssignments)
          .values({
            companyId,
            targetType: "user",
            targetId: userId,
            tagId,
            assignedBy,
          })
          .onConflictDoNothing();
        invalidateTagCache(companyId, userId);

        if (createdTag) {
          logger.info(
            { companyId, userId, tagId, tagSlug: finalSlug },
            "Created personal tag for new user on join",
          );
        }
      }
    });
  }

  return {
    isInstanceAdmin,
    canUser,
    hasPermission,
    hasGlobalScope,
    getMembership,
    ensureMembership,
    getDefaultRoleId,
    assignDefaultTagOnJoin,
    listMembers,
    updateMemberRole,
    updateMemberStatus,
    getEffectivePermissions,
    getTagIds,
    resolveRole,
    promoteInstanceAdmin,
    demoteInstanceAdmin,
    listUserCompanyAccess,
    setUserCompanyAccess,
    invalidateRoleCache,
    invalidateTagCache,
  };
}
