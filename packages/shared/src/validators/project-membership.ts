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
