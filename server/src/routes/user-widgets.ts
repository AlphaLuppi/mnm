import { Router } from "express";
import { and, eq, asc, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userWidgets, agents } from "@mnm/db";
import { createUserWidgetSchema, updateUserWidgetSchema, ContentDocument } from "@mnm/shared";
import { badRequest, notFound, forbidden } from "../errors.js";
import { buildWidgetGenerationPrompt } from "../services/cao-widget-prompt.js";
import { logger } from "../middleware/logger.js";

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

  // ── POST /my-widgets/generate — DI-08: CAO generates a widget from user prompt
  router.post("/companies/:companyId/my-widgets/generate", async (req, res) => {
    const companyId = req.params.companyId as string;
    const userId = req.actor?.userId;
    if (!userId) throw forbidden("User identity required");

    const { prompt: userRequest } = req.body as { prompt?: string };
    if (!userRequest?.trim()) throw badRequest("A prompt description is required");

    // Build enriched CAO prompt
    const systemPrompt = await buildWidgetGenerationPrompt(db, {
      companyId,
      userId,
      userRequest: userRequest.trim(),
    });

    // Call LLM (Anthropic API → claude -p fallback)
    let rawResponse: string | null = null;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const llmEndpoint = process.env.MNM_LLM_SUMMARY_ENDPOINT;
    const llmApiKey = process.env.MNM_LLM_SUMMARY_API_KEY;
    const model = process.env.MNM_LLM_WIDGET_MODEL ?? "claude-3-haiku-20240307";

    if (anthropicKey) {
      // Strategy 1: Direct Anthropic API
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userRequest.trim() }],
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) {
          const data = await response.json() as { content?: Array<{ text: string }> };
          rawResponse = data?.content?.[0]?.text ?? null;
        }
      } catch (err) {
        logger.warn({ err }, "[widget-generate] Anthropic API call failed");
      }
    } else if (llmEndpoint && llmApiKey) {
      // Strategy 2: Configurable endpoint
      try {
        const response = await fetch(llmEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${llmApiKey}`,
            "x-api-key": llmApiKey,
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userRequest.trim() }],
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (response.ok) {
          const data = await response.json() as { content?: Array<{ text: string }> };
          rawResponse = data?.content?.[0]?.text ?? null;
        }
      } catch (err) {
        logger.warn({ err }, "[widget-generate] LLM endpoint call failed");
      }
    }

    if (!rawResponse) {
      // Strategy 3: claude -p CLI fallback
      try {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);

        const combinedPrompt = `${systemPrompt}\n\n---\n\n${userRequest.trim()}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation. Start with { and end with }.`;
        const { stdout } = await execFileAsync(
          "claude",
          ["-p", combinedPrompt, "--output-format", "text", "--model", "haiku"],
          {
            timeout: 90_000,
            maxBuffer: 1024 * 1024,
            env: { ...process.env, CLAUDE_CODE_ENABLE_TELEMETRY: "0" },
          },
        );
        rawResponse = stdout?.trim() ?? null;
      } catch (err) {
        logger.warn({ err }, "[widget-generate] claude -p fallback failed");
      }
    }

    if (!rawResponse) {
      return res.status(503).json({ error: "Widget generation unavailable. No LLM backend configured." });
    }

    // Parse JSON from response (handle markdown code fences)
    let parsed: Record<string, unknown>;
    try {
      const jsonStr = rawResponse.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // Retry: extract JSON between first { and last }
      const start = rawResponse.indexOf("{");
      const end = rawResponse.lastIndexOf("}");
      if (start === -1 || end === -1) {
        return res.status(422).json({ error: "CAO returned invalid JSON. Try rephrasing your request." });
      }
      try {
        parsed = JSON.parse(rawResponse.slice(start, end + 1));
      } catch {
        return res.status(422).json({ error: "CAO returned invalid JSON. Try rephrasing your request." });
      }
    }

    // Validate the blocks
    const blocksRaw = parsed.blocks as unknown;
    const blocksResult = ContentDocument.safeParse(blocksRaw);
    if (!blocksResult.success) {
      logger.warn({ errors: blocksResult.error.issues }, "[widget-generate] Invalid ContentDocument from CAO");
      return res.status(422).json({
        error: "The generated widget has invalid structure. Try rephrasing your request.",
        validationErrors: blocksResult.error.issues.slice(0, 3),
      });
    }

    // Resolve CAO agent ID
    const allAgents = await db
      .select({ id: agents.id, metadata: agents.metadata })
      .from(agents)
      .where(eq(agents.companyId, companyId));
    const cao = allAgents.find((a) => (a.metadata as Record<string, unknown>)?.isCAO === true);

    // Auto-position at end
    const [last] = await db
      .select({ maxPos: sql<number>`coalesce(max(${userWidgets.position}), -1)` })
      .from(userWidgets)
      .where(and(eq(userWidgets.companyId, companyId), eq(userWidgets.userId, userId)));

    const [created] = await db
      .insert(userWidgets)
      .values({
        companyId,
        userId,
        title: (typeof parsed.title === "string" ? parsed.title : userRequest.trim()).slice(0, 200),
        description: typeof parsed.description === "string" ? parsed.description : null,
        blocks: blocksResult.data,
        dataSource: parsed.dataSource && typeof parsed.dataSource === "object" ? parsed.dataSource : null,
        position: (last?.maxPos ?? -1) + 1,
        span: typeof parsed.span === "number" ? Math.min(4, Math.max(1, parsed.span)) : 2,
        createdByAgentId: cao?.id ?? null,
      })
      .returning();

    logger.info({ companyId, userId, widgetId: created.id }, "CAO generated widget");
    res.status(201).json(created);
  });

  return router;
}
