import { Router } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { inboxItems } from "@mnm/db";
import {
  createInboxItemSchema,
  updateInboxItemSchema,
  inboxItemActionSchema,
  inboxItemFiltersSchema,
} from "@mnm/shared";
import { badRequest, notFound, forbidden } from "../errors.js";

export function inboxItemRoutes(db: Db) {
  const router = Router();

  // ── GET /inbox-items — List inbox items for the current user (with filters + pagination)
  router.get("/companies/:companyId/inbox-items", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const parsed = inboxItemFiltersSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const { status, category, priority, limit, offset } = parsed.data;

    const conditions = [
      eq(inboxItems.companyId, companyId),
      eq(inboxItems.recipientId, userId),
    ];

    if (status) conditions.push(eq(inboxItems.status, status));
    if (category) conditions.push(eq(inboxItems.category, category));
    if (priority) conditions.push(eq(inboxItems.priority, priority));

    const whereClause = and(...conditions);

    const [items, [{ count: total }]] = await Promise.all([
      db
        .select()
        .from(inboxItems)
        .where(whereClause)
        .orderBy(desc(inboxItems.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(inboxItems)
        .where(whereClause),
    ]);

    res.json({ items, total });
  });

  // ── POST /inbox-items — Create an inbox item (agents send notifications)
  router.post("/companies/:companyId/inbox-items", async (req, res) => {
    const companyId = req.params.companyId as string;

    const parsed = createInboxItemSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const data = parsed.data;

    const [created] = await db
      .insert(inboxItems)
      .values({
        companyId,
        recipientId: data.recipientId,
        senderAgentId: req.actor?.type === "agent" ? req.actor.agentId : null,
        senderUserId: req.actor?.type === "board" ? req.actor.userId : null,
        title: data.title,
        body: data.body ?? null,
        contentBlocks: data.contentBlocks ?? null,
        category: data.category,
        priority: data.priority,
        relatedIssueId: data.relatedIssueId ?? null,
        relatedAgentId: data.relatedAgentId ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      })
      .returning();

    res.status(201).json(created);
  });

  // ── PATCH /inbox-items/:id — Update status (read, dismissed)
  router.patch("/companies/:companyId/inbox-items/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    const itemId = req.params.id as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const parsed = updateInboxItemSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const [existing] = await db
      .select()
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ),
      );

    if (!existing) throw notFound("Inbox item not found");

    const updates: Partial<typeof inboxItems.$inferInsert> = {};
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    if (Object.keys(updates).length === 0) {
      res.json(existing);
      return;
    }

    const [updated] = await db
      .update(inboxItems)
      .set(updates)
      .where(
        and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ),
      )
      .returning();

    res.json(updated);
  });

  // ── POST /inbox-items/:id/action — Execute action from a content block
  router.post("/companies/:companyId/inbox-items/:id/action", async (req, res) => {
    const companyId = req.params.companyId as string;
    const itemId = req.params.id as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const parsed = inboxItemActionSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const [existing] = await db
      .select()
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ),
      );

    if (!existing) throw notFound("Inbox item not found");
    if (existing.status === "actioned") throw badRequest("This item has already been actioned");

    const actionTaken = {
      action: parsed.data.action,
      payload: parsed.data.payload,
      timestamp: new Date().toISOString(),
    };

    const [updated] = await db
      .update(inboxItems)
      .set({
        status: "actioned",
        actionTaken,
      })
      .where(
        and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ),
      )
      .returning();

    res.json(updated);
  });

  // ── DELETE /inbox-items/:id — Delete an inbox item
  router.delete("/companies/:companyId/inbox-items/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    const itemId = req.params.id as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const [existing] = await db
      .select()
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ),
      );

    if (!existing) throw notFound("Inbox item not found");

    await db
      .delete(inboxItems)
      .where(
        and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ),
      );

    res.status(204).end();
  });

  return router;
}
