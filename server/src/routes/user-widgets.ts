import { Router } from "express";
import { and, eq, asc, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userWidgets } from "@mnm/db";
import { createUserWidgetSchema, updateUserWidgetSchema } from "@mnm/shared";
import { badRequest, notFound, forbidden } from "../errors.js";

export function userWidgetRoutes(db: Db) {
  const router = Router();

  // ── GET /my-widgets — List current user's widgets
  router.get("/companies/:companyId/my-widgets", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const widgets = await db
      .select()
      .from(userWidgets)
      .where(and(eq(userWidgets.companyId, companyId), eq(userWidgets.userId, userId)))
      .orderBy(asc(userWidgets.position));

    res.json(widgets);
  });

  // ── POST /my-widgets — Create a widget (validate blocks with Zod)
  router.post("/companies/:companyId/my-widgets", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const parsed = createUserWidgetSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const { title, description, blocks, dataSource, position, span } = parsed.data;

    // Auto-position at end if not specified
    let finalPosition = position ?? 0;
    if (position === undefined) {
      const [last] = await db
        .select({ maxPos: sql<number>`coalesce(max(${userWidgets.position}), -1)` })
        .from(userWidgets)
        .where(and(eq(userWidgets.companyId, companyId), eq(userWidgets.userId, userId)));
      finalPosition = (last?.maxPos ?? -1) + 1;
    }

    const [created] = await db
      .insert(userWidgets)
      .values({
        companyId,
        userId,
        title,
        description: description ?? null,
        blocks,
        dataSource: dataSource ?? null,
        position: finalPosition,
        span,
        createdByAgentId: req.actor?.type === "agent" ? req.actor.agentId : null,
      })
      .returning();

    res.status(201).json(created);
  });

  // ── PATCH /my-widgets/:id — Update (title, position, span, blocks)
  router.patch("/companies/:companyId/my-widgets/:widgetId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const widgetId = req.params.widgetId as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const [existing] = await db
      .select()
      .from(userWidgets)
      .where(
        and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ),
      );

    if (!existing) throw notFound("Widget not found");

    const parsed = updateUserWidgetSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.message);

    const updates: Partial<typeof userWidgets.$inferInsert> = { updatedAt: new Date() };
    const data = parsed.data;
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.blocks !== undefined) updates.blocks = data.blocks;
    if (data.dataSource !== undefined) updates.dataSource = data.dataSource;
    if (data.position !== undefined) updates.position = data.position;
    if (data.span !== undefined) updates.span = data.span;

    const [updated] = await db
      .update(userWidgets)
      .set(updates)
      .where(
        and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ),
      )
      .returning();

    res.json(updated);
  });

  // ── DELETE /my-widgets/:id — Delete a widget
  router.delete("/companies/:companyId/my-widgets/:widgetId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const widgetId = req.params.widgetId as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const [existing] = await db
      .select()
      .from(userWidgets)
      .where(
        and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ),
      );

    if (!existing) throw notFound("Widget not found");

    await db
      .delete(userWidgets)
      .where(
        and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ),
      );

    res.status(204).end();
  });

  return router;
}
