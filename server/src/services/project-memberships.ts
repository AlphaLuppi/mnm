import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { projectMemberships, projects, authUsers } from "@mnm/db";
import { conflict, notFound } from "../errors.js";

const PROJECT_MEMBERSHIP_ROLES = ["owner", "manager", "contributor", "viewer"] as const;
type ProjectMembershipRole = (typeof PROJECT_MEMBERSHIP_ROLES)[number];

// --- PROJ-S02 types ---

interface BulkResult {
  userId: string;
  status: "added" | "skipped" | "removed";
  reason?: string;
}

interface PaginationOpts {
  limit: number;
  cursor?: string | null; // cursor = membership id
}

interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

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

  // --- PROJ-S02: Internal scope synchronization ---
  // TODO [PERM-01]: Reimplement using tag_assignments instead of principalPermissionGrants
  async function syncUserProjectScope(_companyId: string, _userId: string): Promise<void> {
    // STUB: principalPermissionGrants table removed, scope sync via tags in Sprint 4
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
        // PROJ-S02: sync scope after add
        await syncUserProjectScope(companyId, userId);
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
      // PROJ-S02: sync scope after remove
      await syncUserProjectScope(companyId, userId);
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

    // --- PROJ-S02: New service functions ---

    getUserProjectIds: async (companyId: string, userId: string): Promise<string[]> => {
      const rows = await db
        .select({ projectId: projectMemberships.projectId })
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            eq(projectMemberships.userId, userId),
          ),
        );
      return rows.map((r) => r.projectId);
    },

    bulkAddMembers: async (
      companyId: string,
      projectId: string,
      userIds: string[],
      role: ProjectMembershipRole = "contributor",
      grantedBy: string | null = null,
    ): Promise<{ added: number; skipped: number; results: BulkResult[] }> => {
      await assertProjectExists(companyId, projectId);

      const results: BulkResult[] = [];
      const usersToSync: string[] = [];

      for (const userId of userIds) {
        try {
          await db
            .insert(projectMemberships)
            .values({ companyId, projectId, userId, role, grantedBy });
          results.push({ userId, status: "added" });
          usersToSync.push(userId);
        } catch (err: any) {
          if (err?.code === "23505") {
            results.push({ userId, status: "skipped", reason: "already_member" });
          } else {
            throw err;
          }
        }
      }

      // Sync scope for all successfully added users
      for (const userId of usersToSync) {
        await syncUserProjectScope(companyId, userId);
      }

      const added = results.filter((r) => r.status === "added").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      return { added, skipped, results };
    },

    bulkRemoveMembers: async (
      companyId: string,
      projectId: string,
      userIds: string[],
    ): Promise<{ removed: number; skipped: number; results: BulkResult[] }> => {
      const results: BulkResult[] = [];
      const usersToSync: string[] = [];

      for (const userId of userIds) {
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
        if (row) {
          results.push({ userId, status: "removed" });
          usersToSync.push(userId);
        } else {
          results.push({ userId, status: "skipped", reason: "not_member" });
        }
      }

      // Sync scope for all successfully removed users
      for (const userId of usersToSync) {
        await syncUserProjectScope(companyId, userId);
      }

      const removed = results.filter((r) => r.status === "removed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      return { removed, skipped, results };
    },

    countMembersByProject: async (
      companyId: string,
      projectIds: string[],
    ): Promise<Record<string, number>> => {
      if (projectIds.length === 0) return {};

      const rows = await db
        .select({
          projectId: projectMemberships.projectId,
          count: sql<number>`count(*)::int`,
        })
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.companyId, companyId),
            inArray(projectMemberships.projectId, projectIds),
          ),
        )
        .groupBy(projectMemberships.projectId);

      const counts: Record<string, number> = {};
      for (const pid of projectIds) {
        counts[pid] = 0;
      }
      for (const row of rows) {
        counts[row.projectId] = row.count;
      }
      return counts;
    },

    listMembersPaginated: async (
      companyId: string,
      projectId: string,
      opts: PaginationOpts,
    ): Promise<PaginatedResult<{
      id: string;
      userId: string;
      role: string;
      grantedBy: string | null;
      createdAt: Date;
      userName: string | null;
      userEmail: string | null;
      userImage: string | null;
    }>> => {
      await assertProjectExists(companyId, projectId);

      const limit = Math.min(opts.limit, 100);
      const conditions = [
        eq(projectMemberships.companyId, companyId),
        eq(projectMemberships.projectId, projectId),
      ];

      if (opts.cursor) {
        conditions.push(sql`${projectMemberships.id} > ${opts.cursor}`);
      }

      const rows = await db
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
        .where(and(...conditions))
        .orderBy(projectMemberships.id)
        .limit(limit + 1); // fetch one extra to determine nextCursor

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]!.id : null;

      return { data, nextCursor };
    },
  };
}
