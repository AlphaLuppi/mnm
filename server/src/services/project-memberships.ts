import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { projectMemberships, projects, authUsers } from "@mnm/db";
import { conflict, notFound } from "../errors.js";

const PROJECT_MEMBERSHIP_ROLES = ["owner", "manager", "contributor", "viewer"] as const;
type ProjectMembershipRole = (typeof PROJECT_MEMBERSHIP_ROLES)[number];

export function projectMembershipService(db: Db) {
  async function assertProjectExists(companyId: string, projectId: string) {
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!project) {
      throw notFound("Project not found");
    }
    return project;
  }

  return {
    addMember: async (
      companyId: string,
      projectId: string,
      userId: string,
      role: ProjectMembershipRole = "contributor",
      grantedBy: string | null = null,
    ) => {
      await assertProjectExists(companyId, projectId);

      try {
        const [row] = await db
          .insert(projectMemberships)
          .values({ companyId, projectId, userId, role, grantedBy })
          .returning();
        return row!;
      } catch (err: any) {
        if (err?.code === "23505") {
          throw conflict("User is already a member of this project");
        }
        throw err;
      }
    },

    removeMember: async (companyId: string, projectId: string, userId: string) => {
      const [row] = await db
        .delete(projectMemberships)
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            eq(projectMemberships.projectId, projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .returning();
      if (!row) {
        throw notFound("Membership not found");
      }
      return row;
    },

    listMembers: async (companyId: string, projectId: string) => {
      await assertProjectExists(companyId, projectId);

      return db
        .select({
          id: projectMemberships.id,
          userId: projectMemberships.userId,
          role: projectMemberships.role,
          grantedBy: projectMemberships.grantedBy,
          createdAt: projectMemberships.createdAt,
          userName: authUsers.name,
          userEmail: authUsers.email,
          userImage: authUsers.image,
        })
        .from(projectMemberships)
        .leftJoin(authUsers, eq(projectMemberships.userId, authUsers.id))
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            eq(projectMemberships.projectId, projectId),
          ),
        );
    },

    listUserProjects: async (companyId: string, userId: string) => {
      return db
        .select({
          projectId: projectMemberships.projectId,
          projectName: projects.name,
          role: projectMemberships.role,
          createdAt: projectMemberships.createdAt,
        })
        .from(projectMemberships)
        .innerJoin(projects, eq(projectMemberships.projectId, projects.id))
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            eq(projectMemberships.userId, userId),
          ),
        );
    },

    isMember: async (companyId: string, projectId: string, userId: string) => {
      const row = await db
        .select({ id: projectMemberships.id })
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            eq(projectMemberships.projectId, projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      return Boolean(row);
    },

    updateMemberRole: async (
      companyId: string,
      projectId: string,
      userId: string,
      newRole: ProjectMembershipRole,
    ) => {
      const [row] = await db
        .update(projectMemberships)
        .set({ role: newRole, updatedAt: new Date() })
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            eq(projectMemberships.projectId, projectId),
            eq(projectMemberships.userId, userId),
          ),
        )
        .returning();
      if (!row) {
        throw notFound("Membership not found");
      }
      return row;
    },
  };
}
