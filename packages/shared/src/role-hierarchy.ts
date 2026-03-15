import type { BusinessRole } from "./constants.js";

// onb-s02-role-levels
/**
 * Hierarchical levels for business roles.
 * Lower number = higher in hierarchy = more power.
 * Only roles with level <= 1 (admin, manager) can invite.
 */
export const BUSINESS_ROLE_LEVELS: Record<BusinessRole, number> = {
  admin: 0,
  manager: 1,
  contributor: 2,
  viewer: 3,
} as const;

/**
 * Maximum role level that is allowed to invite other users.
 * admin (0) and manager (1) can invite; contributor (2) and viewer (3) cannot.
 */
const MAX_INVITER_LEVEL = 1;

// onb-s02-get-role-level
/**
 * Returns the numeric hierarchy level of a business role.
 */
export function getRoleLevel(role: BusinessRole): number {
  return BUSINESS_ROLE_LEVELS[role];
}

// onb-s02-can-invite-role
/**
 * Checks whether an inviter with `inviterRole` is allowed to invite a user
 * with `targetRole`. Rules:
 *  1. The inviter must have level <= MAX_INVITER_LEVEL (admin or manager).
 *  2. The inviter can only assign roles at their own level or below.
 */
export function canInviteRole(inviterRole: BusinessRole, targetRole: BusinessRole): boolean {
  const inviterLevel = BUSINESS_ROLE_LEVELS[inviterRole];
  const targetLevel = BUSINESS_ROLE_LEVELS[targetRole];

  // Only admin/manager can invite
  if (inviterLevel > MAX_INVITER_LEVEL) return false;

  // Inviter can assign roles at their level or below (higher number = lower rank)
  return inviterLevel <= targetLevel;
}

/**
 * Alias for canInviteRole — kept for spec compliance.
 */
export const isHierarchyValid = canInviteRole;

// onb-s02-get-invitable-roles
/**
 * Returns the list of roles that an inviter with `inviterRole` can assign.
 */
export function getInvitableRoles(inviterRole: BusinessRole): BusinessRole[] {
  const allRoles: BusinessRole[] = ["admin", "manager", "contributor", "viewer"];
  return allRoles.filter((role) => canInviteRole(inviterRole, role));
}
