import { Router } from "express";
import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { tags, tagAssignments, agents } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { accessService } from "../services/access.js";
import { auditService } from "../services/audit.js";
import { badRequest, notFound } from "../errors.js";
import { onTagCreated } from "../services/cao.js";

export function tagsRoutes(db: Db) {
  const router = Router();
  const access = accessService(db);
  const audit = auditService(db);

  // ═══════════════════════════════════════════════════════════
  // TAGS CRUD (API-02)
  // ═══════════════════════════════════════════════════════════

  // ── GET /companies/:companyId/tags ── List tags
  router.get(
    "/companies/:companyId/tags",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const includeArchived = req.query.includeArchived === "true";

      const conditions = [eq(tags.companyId, companyId)];
      if (!includeArchived) {
        conditions.push(isNull(tags.archivedAt));
      }

      const allTags = await db
        .select()
        .from(tags)
        .where(and(...conditions))
        .orderBy(tags.name);

      // Count members per tag
      const result = await Promise.all(
        allTags.map(async (tag) => {
          const [count] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(tagAssignments)
            .where(and(
              eq(tagAssignments.companyId, companyId),
              eq(tagAssignments.tagId, tag.id),
            ));
          return { ...tag, memberCount: count?.count ?? 0 };
        }),
      );

      res.json(result);
    },
  );

  // ── POST /companies/:companyId/tags ── Create a tag
  router.post(
    "/companies/:companyId/tags",
    requirePermission(db, "tags:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const { name, slug, description, color, icon } = req.body;

      if (!name || !slug) throw badRequest("name and slug are required");

      const [created] = await db
        .insert(tags)
        .values({
          companyId,
          name,
          slug,
          description: description ?? null,
          color: color ?? null,
          icon: icon ?? null,
        })
        .returning();

      // CAO-02: Auto-assign new tag to CAO agent
      await onTagCreated(db, companyId, created.id);

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";
      await audit.emit({
        companyId,
        actorId,
        actorType: "user",
        action: "tag.created",
        targetType: "tag",
        targetId: created.id,
        metadata: { name, slug },
      }).catch(() => {});

      res.status(201).json(created);
    },
  );

  // ── GET /companies/:companyId/tags/:tagId ── Tag detail
  router.get(
    "/companies/:companyId/tags/:tagId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const tagId = req.params.tagId as string;

      const [tag] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)));

      if (!tag) throw notFound("Tag not found");

      const [count] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tagAssignments)
        .where(and(eq(tagAssignments.companyId, companyId), eq(tagAssignments.tagId, tagId)));

      res.json({ ...tag, memberCount: count?.count ?? 0 });
    },
  );

  // ── PATCH /companies/:companyId/tags/:tagId ── Update a tag
  router.patch(
    "/companies/:companyId/tags/:tagId",
    requirePermission(db, "tags:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const tagId = req.params.tagId as string;

      const [existing] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)));

      if (!existing) throw notFound("Tag not found");

      const { name, description, color, icon } = req.body;
      const updates: Partial<typeof tags.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;

      const [updated] = await db
        .update(tags)
        .set(updates)
        .where(eq(tags.id, tagId))
        .returning();

      res.json(updated);
    },
  );

  // ── POST /companies/:companyId/tags/:tagId/archive ── Archive a tag
  router.post(
    "/companies/:companyId/tags/:tagId/archive",
    requirePermission(db, "tags:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const tagId = req.params.tagId as string;

      const [updated] = await db
        .update(tags)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)))
        .returning();

      if (!updated) throw notFound("Tag not found");

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";
      await audit.emit({
        companyId, actorId, actorType: "user",
        action: "tag.archived", targetType: "tag", targetId: tagId,
        metadata: { name: updated.name },
      }).catch(() => {});

      res.json(updated);
    },
  );

  // ── POST /companies/:companyId/tags/:tagId/unarchive ── Unarchive a tag
  router.post(
    "/companies/:companyId/tags/:tagId/unarchive",
    requirePermission(db, "tags:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const tagId = req.params.tagId as string;

      const [updated] = await db
        .update(tags)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)))
        .returning();

      if (!updated) throw notFound("Tag not found");

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";
      await audit.emit({
        companyId, actorId, actorType: "user",
        action: "tag.unarchived", targetType: "tag", targetId: tagId,
        metadata: { name: updated.name },
      }).catch(() => {});

      res.json(updated);
    },
  );

  // ── DELETE /companies/:companyId/tags/:tagId ── Delete (only if 0 assignments)
  router.delete(
    "/companies/:companyId/tags/:tagId",
    requirePermission(db, "tags:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const tagId = req.params.tagId as string;

      const [count] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tagAssignments)
        .where(and(eq(tagAssignments.companyId, companyId), eq(tagAssignments.tagId, tagId)));

      if ((count?.count ?? 0) > 0) {
        throw badRequest("Cannot delete a tag with active assignments. Archive it instead.");
      }

      await db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.companyId, companyId)));

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";
      await audit.emit({
        companyId, actorId, actorType: "user",
        action: "tag.deleted", targetType: "tag", targetId: tagId,
        metadata: {},
      }).catch(() => {});

      res.status(204).end();
    },
  );

  // ═══════════════════════════════════════════════════════════
  // TAG ASSIGNMENTS (API-03)
  // ═══════════════════════════════════════════════════════════

  // ── GET /companies/:companyId/users/:userId/tags ── User tags
  router.get("/companies/:companyId/users/:userId/tags", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;

    const assignments = await db
      .select({ tag: tags })
      .from(tagAssignments)
      .innerJoin(tags, eq(tags.id, tagAssignments.tagId))
      .where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "user"),
        eq(tagAssignments.targetId, userId),
      ));

    res.json(assignments.map((a) => a.tag));
  });

  // ── PUT /companies/:companyId/users/:userId/tags ── Replace all user tags
  router.put(
    "/companies/:companyId/users/:userId/tags",
    requirePermission(db, "users:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.params.userId as string;
      const { tagIds } = req.body as { tagIds: string[] };

      if (!Array.isArray(tagIds)) throw badRequest("tagIds array is required");

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";

      await db.transaction(async (tx) => {
        // Delete existing
        await tx.delete(tagAssignments).where(and(
          eq(tagAssignments.companyId, companyId),
          eq(tagAssignments.targetType, "user"),
          eq(tagAssignments.targetId, userId),
        ));

        // Insert new
        if (tagIds.length > 0) {
          await tx.insert(tagAssignments).values(
            tagIds.map((tagId) => ({
              companyId,
              targetType: "user" as const,
              targetId: userId,
              tagId,
              assignedBy: actorId,
            })),
          );
        }
      });

      // Invalidate tag cache
      access.invalidateTagCache(companyId, userId);

      res.json({ ok: true });
    },
  );

  // ── POST /companies/:companyId/users/:userId/tags/:tagId ── Add tag to user
  router.post(
    "/companies/:companyId/users/:userId/tags/:tagId",
    requirePermission(db, "users:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.params.userId as string;
      const tagId = req.params.tagId as string;

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";

      await db
        .insert(tagAssignments)
        .values({ companyId, targetType: "user", targetId: userId, tagId, assignedBy: actorId })
        .onConflictDoNothing();

      access.invalidateTagCache(companyId, userId);

      await audit.emit({
        companyId, actorId, actorType: "user",
        action: "tag_assignment.created", targetType: "tag_assignment",
        targetId: `user:${userId}:${tagId}`,
        metadata: { targetType: "user", targetId: userId, tagId },
      }).catch(() => {});

      res.status(201).json({ ok: true });
    },
  );

  // ── DELETE /companies/:companyId/users/:userId/tags/:tagId ── Remove tag from user
  router.delete(
    "/companies/:companyId/users/:userId/tags/:tagId",
    requirePermission(db, "users:manage"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.params.userId as string;
      const tagId = req.params.tagId as string;

      await db.delete(tagAssignments).where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "user"),
        eq(tagAssignments.targetId, userId),
        eq(tagAssignments.tagId, tagId),
      ));

      access.invalidateTagCache(companyId, userId);

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";
      await audit.emit({
        companyId, actorId, actorType: "user",
        action: "tag_assignment.removed", targetType: "tag_assignment",
        targetId: `user:${userId}:${tagId}`,
        metadata: { targetType: "user", targetId: userId, tagId },
      }).catch(() => {});

      res.status(204).end();
    },
  );

  // ── Same 4 routes for agents ──

  router.get("/companies/:companyId/agents/:agentId/tags", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;

    const assignments = await db
      .select({ tag: tags })
      .from(tagAssignments)
      .innerJoin(tags, eq(tags.id, tagAssignments.tagId))
      .where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "agent"),
        eq(tagAssignments.targetId, agentId),
      ));

    res.json(assignments.map((a) => a.tag));
  });

  router.put(
    "/companies/:companyId/agents/:agentId/tags",
    requirePermission(db, "agents:configure"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      const { tagIds } = req.body as { tagIds: string[] };

      if (!Array.isArray(tagIds)) throw badRequest("tagIds array is required");

      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";

      await db.transaction(async (tx) => {
        await tx.delete(tagAssignments).where(and(
          eq(tagAssignments.companyId, companyId),
          eq(tagAssignments.targetType, "agent"),
          eq(tagAssignments.targetId, agentId),
        ));

        if (tagIds.length > 0) {
          await tx.insert(tagAssignments).values(
            tagIds.map((tagId) => ({
              companyId,
              targetType: "agent" as const,
              targetId: agentId,
              tagId,
              assignedBy: actorId,
            })),
          );
        }
      });

      access.invalidateTagCache(companyId, agentId);
      res.json({ ok: true });
    },
  );

  router.post(
    "/companies/:companyId/agents/:agentId/tags/:tagId",
    requirePermission(db, "agents:configure"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      const tagId = req.params.tagId as string;
      const actorId = req.actor.type === "board" ? (req.actor.userId ?? "system") : "system";

      await db
        .insert(tagAssignments)
        .values({ companyId, targetType: "agent", targetId: agentId, tagId, assignedBy: actorId })
        .onConflictDoNothing();

      access.invalidateTagCache(companyId, agentId);
      res.status(201).json({ ok: true });
    },
  );

  router.delete(
    "/companies/:companyId/agents/:agentId/tags/:tagId",
    requirePermission(db, "agents:configure"),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const agentId = req.params.agentId as string;
      const tagId = req.params.tagId as string;

      await db.delete(tagAssignments).where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.targetType, "agent"),
        eq(tagAssignments.targetId, agentId),
        eq(tagAssignments.tagId, tagId),
      ));

      access.invalidateTagCache(companyId, agentId);
      res.status(204).end();
    },
  );

  // ── GET /companies/:companyId/tags/:tagId/members ── All principals with this tag
  router.get("/companies/:companyId/tags/:tagId/members", async (req, res) => {
    const companyId = req.params.companyId as string;
    const tagId = req.params.tagId as string;

    const assignments = await db
      .select({
        id: tagAssignments.id,
        targetType: tagAssignments.targetType,
        targetId: tagAssignments.targetId,
        assignedBy: tagAssignments.assignedBy,
        createdAt: tagAssignments.createdAt,
      })
      .from(tagAssignments)
      .where(and(
        eq(tagAssignments.companyId, companyId),
        eq(tagAssignments.tagId, tagId),
      ));

    res.json(assignments);
  });

  return router;
}
