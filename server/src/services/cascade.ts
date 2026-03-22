import type { Db } from "@mnm/db";
import { companyMemberships } from "@mnm/db";
import { and, eq } from "drizzle-orm";
import type { ResourceScope } from "@mnm/shared";

// Stub: roles are now dynamic (loaded from DB in Sprint 4)
// These functions are kept as stubs for compilation
type BusinessRole = string;
function canInviteRole(_inviter: string, _target: string): boolean { return true; }
function getInvitableRoles(_role: string): BusinessRole[] { return []; }
function getRoleLevel(_role: string): number { return 0; }
import { accessService } from "./access.js";

// onb-s02-cascade-service

export interface CascadeValidationResult {
  valid: boolean;
  reason?: string;
  inheritedScope: ResourceScope | null;
}

export interface CascadeChainEntry {
  userId: string;
  businessRole: BusinessRole | null;
  invitedBy: string | null;
}

export interface CascadeInfo {
  userRole: BusinessRole | null;
  invitableRoles: BusinessRole[];
  userScope: ResourceScope | null;
  cascadeChain: CascadeChainEntry[];
}

export function cascadeService(db: Db) {
  const access = accessService(db);

  // onb-s02-validate-cascade
  /**
   * Validates whether a user (inviter) is allowed to send an invitation
   * with the specified target role and scope, enforcing the hierarchical
   * cascade rules.
   */
  async function validateCascadeInvite(
    companyId: string,
    inviterUserId: string,
    _targetEmail: string,
    targetRole: BusinessRole,
    targetScope?: ResourceScope | null,
  ): Promise<CascadeValidationResult> {
    // 1. Fetch inviter's membership
    const membership = await access.getMembership(companyId, "user", inviterUserId);
    if (!membership || membership.status !== "active") {
      return {
        valid: false,
        reason: "Inviter is not an active member of this company",
        inheritedScope: null,
      };
    }

    const inviterRole = membership.roleId as BusinessRole | null;
    if (!inviterRole) {
      return {
        valid: false,
        reason: "Inviter has no business role assigned",
        inheritedScope: null,
      };
    }

    // 2. Check hierarchy: inviter must be allowed to invite targetRole
    if (!canInviteRole(inviterRole, targetRole)) {
      const inviterLevel = getRoleLevel(inviterRole);
      if (inviterLevel > 1) {
        return {
          valid: false,
          reason: `${capitalize(inviterRole)}s cannot invite users`,
          inheritedScope: null,
        };
      }
      return {
        valid: false,
        reason: `${capitalize(inviterRole)} cannot invite ${targetRole}`,
        inheritedScope: null,
      };
    }

    // 3. Determine inviter scope
    const inviterScope = await getEffectiveScope(companyId, inviterUserId, inviterRole);

    // 4. Compute inherited scope
    // onb-s02-scope-containment
    const inheritedScope = computeInheritedScope(inviterScope, targetScope);
    if (inheritedScope === "SCOPE_VIOLATION") {
      return {
        valid: false,
        reason: "Target scope exceeds inviter scope — cannot grant broader access",
        inheritedScope: null,
      };
    }

    return {
      valid: true,
      inheritedScope,
    };
  }

  // onb-s02-compute-inherited-scope
  /**
   * Computes the effective scope that the invitee should inherit.
   *
   * - If inviterScope is null (global) → requestedScope or null (global)
   * - If no requestedScope → inherit inviterScope entirely
   * - If requestedScope provided → intersect with inviterScope
   * - Returns "SCOPE_VIOLATION" if requestedScope is not a subset
   */
  function computeInheritedScope(
    inviterScope: ResourceScope | null,
    requestedScope?: ResourceScope | null,
  ): ResourceScope | null | "SCOPE_VIOLATION" {
    // Inviter has global scope (admin or no scope restriction)
    if (!inviterScope) {
      // Target can have any scope, or global
      return requestedScope ?? null;
    }

    // No specific scope requested → inherit full inviter scope
    if (!requestedScope) {
      return inviterScope;
    }

    // Both have scopes — compute intersection
    const inviterProjectIds = inviterScope.projectIds ?? [];
    const requestedProjectIds = requestedScope.projectIds ?? [];

    if (requestedProjectIds.length === 0) {
      // Requested global but inviter has restricted scope
      return inviterScope;
    }

    const inviterSet = new Set(inviterProjectIds);
    const validProjectIds = requestedProjectIds.filter((id) => inviterSet.has(id));
    const invalidProjectIds = requestedProjectIds.filter((id) => !inviterSet.has(id));

    if (invalidProjectIds.length > 0) {
      return "SCOPE_VIOLATION";
    }

    return { projectIds: validProjectIds };
  }

  // onb-s02-get-cascade-chain
  /**
   * Walks the invitedBy chain for a given user to reconstruct the
   * cascade hierarchy (who invited whom).
   */
  async function getCascadeChain(
    companyId: string,
    userId: string,
  ): Promise<CascadeChainEntry[]> {
    const chain: CascadeChainEntry[] = [];
    const visited = new Set<string>();
    const idsToLookup: string[] = [userId];

    while (idsToLookup.length > 0) {
      const nextId = idsToLookup.shift()!;
      if (visited.has(nextId)) break;
      visited.add(nextId);

      const rows = await db
        .select({
          principalId: companyMemberships.principalId,
          businessRole: companyMemberships.roleId,
          invitedBy: companyMemberships.invitedBy,
        })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, nextId),
          ),
        );

      const row = rows[0];
      if (!row) break;

      const invitedByVal: string | null = (row.invitedBy as string) ?? null;
      chain.push({
        userId: nextId,
        businessRole: row.businessRole as BusinessRole | null,
        invitedBy: invitedByVal,
      });

      if (invitedByVal) {
        idsToLookup.push(invitedByVal);
      }
    }

    return chain;
  }

  /**
   * Returns cascade information for a user: their role, invitable roles,
   * their effective scope, and cascade chain.
   */
  async function getCascadeInfo(
    companyId: string,
    userId: string,
  ): Promise<CascadeInfo> {
    const membership = await access.getMembership(companyId, "user", userId);
    const businessRole = (membership?.roleId as BusinessRole) ?? null;

    const invitableRoles = businessRole ? getInvitableRoles(businessRole) : [];

    const userScope = businessRole
      ? await getEffectiveScope(companyId, userId, businessRole)
      : null;

    const cascadeChain = await getCascadeChain(companyId, userId);

    return {
      userRole: businessRole,
      invitableRoles,
      userScope,
      cascadeChain,
    };
  }

  /**
   * Determines the effective scope for a user based on their businessRole
   * and explicit permission grants.
   *
   * - admin → null (global, no restriction)
   * - manager → null (global from preset), unless explicit grants restrict
   * - contributor/viewer → scope from explicit grants, or null
   */
  async function getEffectiveScope(
    companyId: string,
    userId: string,
    businessRole: BusinessRole,
  ): Promise<ResourceScope | null> {
    // TODO [PERM-01]: getEffectiveScope should resolve from role_permissions + tags
    // Currently all users have global scope until Sprint 4
    return null;
  }

  return {
    validateCascadeInvite,
    computeInheritedScope,
    getCascadeChain,
    getCascadeInfo,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
