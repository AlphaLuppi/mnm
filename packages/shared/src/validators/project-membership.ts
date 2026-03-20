import { z } from "zod";

export const PROJECT_MEMBERSHIP_ROLES = ["owner", "manager", "contributor", "viewer"] as const;

export type ProjectMembershipRole = (typeof PROJECT_MEMBERSHIP_ROLES)[number];

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum(PROJECT_MEMBERSHIP_ROLES).default("contributor"),
}).strict();

export type AddProjectMember = z.infer<typeof addProjectMemberSchema>;

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(PROJECT_MEMBERSHIP_ROLES),
}).strict();

export type UpdateProjectMemberRole = z.infer<typeof updateProjectMemberRoleSchema>;

// --- PROJ-S02: Bulk operations & member counts ---

export const bulkAddProjectMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 users per bulk operation"),
  role: z.enum(PROJECT_MEMBERSHIP_ROLES).default("contributor"),
}).strict();

export type BulkAddProjectMembers = z.infer<typeof bulkAddProjectMembersSchema>;

export const bulkRemoveProjectMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 users per bulk operation"),
}).strict();

export type BulkRemoveProjectMembers = z.infer<typeof bulkRemoveProjectMembersSchema>;

export const memberCountsSchema = z.object({
  projectIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

export type MemberCounts = z.infer<typeof memberCountsSchema>;
