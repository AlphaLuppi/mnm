/**
 * E2E test seed endpoints — only available when MNM_E2E_SEED=true.
 *
 * POST /api/e2e-seed/ensure-access
 *   Grants instance_admin role and company membership to the authenticated user.
 *
 * POST /api/e2e-seed/ensure-multi-role-access
 *   Seeds companies, memberships (role-based), agents, projects, goals,
 *   workflow templates, container profiles, automation cursors, and audit events.
 *
 * POST /api/e2e-seed/cleanup
 *   Removes test data seeded by the above endpoints.
 */
import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  instanceUserRoles,
  companyMemberships,
  companies,
  agents,
  projects,
  goals,
  workflowTemplates,
  automationCursors,
  auditEvents,
  chatChannels,
  chatMessages,
  workflowInstances,
  stageInstances,
  ssoConfigurations,
  driftReports,
  driftItems,
  traces,
  traceObservations,
  traceLenses,
  traceLensResults,
} from "@mnm/db";

// ─── Guard ────────────────────────────────────────────────────────────────────

function isE2eEnabled(): boolean {
  return process.env.MNM_E2E_SEED === "true";
}

// ─── Upsert helper (insert if not exists by id) ─────────────────────────────

async function upsertById<T extends { id: string }>(
  db: Db,
  table: any,
  idCol: any,
  rows: T[],
): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    const existing = await db
      .select({ id: idCol })
      .from(table)
      .where(eq(idCol, row.id))
      .then((r: any[]) => r[0] ?? null);
    if (!existing) {
      await db.insert(table).values(row);
      inserted++;
    }
  }
  return inserted;
}

export function e2eSeedRoutes(db: Db) {
  const router = Router();

  // ─── POST /api/e2e-seed/ensure-access ──────────────────────────────────────
  router.post("/e2e-seed/ensure-access", async (req, res) => {
    if (!isE2eEnabled()) { res.status(404).json({ error: "Not found" }); return; }

    const userId = (req as any).actor?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }

    // 1. Grant instance_admin if not already
    const existingRole = await db
      .select()
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows) => rows[0] ?? null);

    if (!existingRole) {
      await db.insert(instanceUserRoles).values({ userId, role: "instance_admin" });
    }

    // 2. Ensure membership in all companies
    const allCompanies = await db.select({ id: companies.id }).from(companies);
    for (const company of allCompanies) {
      const existing = await db
        .select()
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, company.id),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, userId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) {
        await db.insert(companyMemberships).values({
          companyId: company.id,
          principalType: "user",
          principalId: userId,
          status: "active",
          businessRole: "admin",
        });
      }
    }

    res.json({ ok: true, userId, companiesJoined: allCompanies.length });
  });

  // ─── POST /api/e2e-seed/ensure-multi-role-access ───────────────────────────
  router.post("/e2e-seed/ensure-multi-role-access", async (req, res) => {
    if (!isE2eEnabled()) { res.status(404).json({ error: "Not found" }); return; }

    const userId = (req as any).actor?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }

    try {
      const body = req.body as {
        users?: Array<{
          userId: string;
          email: string;
          businessRole: string;
          company: string;
        }>;
        companies?: Record<string, {
          id: string;
          name: string;
          description?: string;
          issuePrefix: string;
          tier?: string;
          ssoEnabled?: boolean;
          invitationOnly?: boolean;
          brandColor?: string;
          budgetMonthlyCents?: number;
          maxUsers?: number;
          a2aDefaultPolicy?: string;
        }>;
        agents?: Array<{
          id: string;
          companyId: string;
          name: string;
          role?: string;
          title?: string;
          icon?: string;
          status?: string;
          adapterType?: string;
          capabilities?: string;
          reportsTo?: string | null;
          budgetMonthlyCents?: number;
          isolationMode?: string;
        }>;
        projects?: Array<{
          id: string;
          companyId: string;
          name: string;
          description?: string;
          status?: string;
          color?: string;
          leadAgentId?: string | null;
        }>;
        goals?: Array<{
          id: string;
          companyId: string;
          title: string;
          description?: string;
          level?: string;
          status?: string;
        }>;
        workflowTemplates?: Array<{
          id: string;
          companyId: string;
          name: string;
          description?: string;
          isDefault?: boolean;
          createdFrom?: string;
          stages: unknown[];
        }>;
        automationCursors?: Array<{
          id: string;
          companyId: string;
          level: string;
          targetId?: string | null;
          position?: string;
          ceiling?: string;
        }>;
        auditEvents?: Array<{
          action: string;
          actorType: string;
          targetType: string;
          severity?: string;
          metadata?: Record<string, unknown>;
        }>;
        traces?: Array<{
          id: string;
          companyId: string;
          agentId: string;
          parentTraceId?: string | null;
          name: string;
          status: string;
          startedAt: string;
          completedAt?: string | null;
          totalDurationMs?: number | null;
          totalTokensIn?: number;
          totalTokensOut?: number;
          totalCostUsd?: string;
          metadata?: Record<string, unknown> | null;
          tags?: string[] | null;
        }>;
        traceObservations?: Array<{
          id: string;
          traceId: string;
          companyId: string;
          parentObservationId?: string | null;
          type: string;
          name: string;
          status: string;
          startedAt: string;
          completedAt?: string | null;
          durationMs?: number | null;
          level?: string | null;
          statusMessage?: string | null;
          input?: Record<string, unknown> | null;
          output?: Record<string, unknown> | null;
          inputTokens?: number | null;
          outputTokens?: number | null;
          totalTokens?: number | null;
          costUsd?: string | null;
          model?: string | null;
          modelParameters?: Record<string, unknown> | null;
          metadata?: Record<string, unknown> | null;
        }>;
        traceLenses?: Array<{
          id: string;
          companyId: string;
          userId: string;
          name: string;
          prompt: string;
          scope?: Record<string, unknown>;
          isTemplate?: boolean;
          isActive?: boolean;
        }>;
        traceLensResults?: Array<{
          id: string;
          lensId: string;
          traceId?: string | null;
          workflowInstanceId?: string | null;
          companyId: string;
          userId: string;
          resultMarkdown: string;
          resultStructured?: Record<string, unknown> | null;
          modelUsed?: string | null;
          inputTokens?: number | null;
          outputTokens?: number | null;
          costUsd?: string | null;
        }>;
      };

      const stats: Record<string, number> = {};

      // ── 1. Seed companies ─────────────────────────────────────────────────
      if (body.companies) {
        let companiesCreated = 0;
        for (const [, companyDef] of Object.entries(body.companies)) {
          const existing = await db
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.id, companyDef.id))
            .then((r) => r[0] ?? null);
          if (!existing) {
            await db.insert(companies).values({
              id: companyDef.id,
              name: companyDef.name,
              description: companyDef.description ?? null,
              issuePrefix: companyDef.issuePrefix,
              tier: companyDef.tier ?? "free",
              ssoEnabled: companyDef.ssoEnabled ?? false,
              invitationOnly: companyDef.invitationOnly ?? false,
              brandColor: companyDef.brandColor ?? null,
              budgetMonthlyCents: companyDef.budgetMonthlyCents ?? 0,
              maxUsers: companyDef.maxUsers ?? 50,
              a2aDefaultPolicy: companyDef.a2aDefaultPolicy ?? "allow",
            });
            companiesCreated++;
          }
        }
        stats.companiesCreated = companiesCreated;
      }

      // ── 2. Seed user memberships (role-based) ────────────────────────────
      if (body.users && body.companies) {
        let membershipsCreated = 0;
        for (const user of body.users) {
          const companyDef = body.companies[user.company];
          if (!companyDef) continue;

          const existing = await db
            .select()
            .from(companyMemberships)
            .where(
              and(
                eq(companyMemberships.companyId, companyDef.id),
                eq(companyMemberships.principalType, "user"),
                eq(companyMemberships.principalId, user.userId),
              ),
            )
            .then((r) => r[0] ?? null);

          if (!existing) {
            await db.insert(companyMemberships).values({
              companyId: companyDef.id,
              principalType: "user",
              principalId: user.userId,
              status: "active",
              businessRole: user.roleId,
            });
            membershipsCreated++;
          } else if (existing.roleId !== user.roleId) {
            // Update businessRole if it changed
            await db
              .update(companyMemberships)
              .set({ businessRole: user.roleId, updatedAt: new Date() })
              .where(eq(companyMemberships.id, existing.id));
          }
        }
        stats.membershipsCreated = membershipsCreated;
      }

      // ── 3. Seed goals (before projects, which may reference them) ────────
      if (body.goals) {
        stats.goalsCreated = await upsertById(db, goals, goals.id, body.goals.map((g) => ({
          id: g.id,
          companyId: g.companyId,
          title: g.title,
          description: g.description ?? null,
          level: g.level ?? "company",
          status: g.status ?? "active",
        })));
      }

      // ── 4. Seed agents (before projects, which may reference leadAgentId) ─
      if (body.agents) {
        // Insert agents without reportsTo first, then update reportsTo
        const agentsToInsert = body.agents.map((a) => ({
          id: a.id,
          companyId: a.companyId,
          name: a.name,
          
          title: a.title ?? null,
          icon: a.icon ?? null,
          status: a.status ?? "idle",
          adapterType: a.adapterType ?? "process",
          capabilities: a.capabilities ?? null,
          reportsTo: null as string | null, // set later
          budgetMonthlyCents: a.budgetMonthlyCents ?? 0,
          isolationMode: a.isolationMode ?? "process",
        }));

        stats.agentsCreated = await upsertById(db, agents, agents.id, agentsToInsert);

        // Update reportsTo after all agents exist
        for (const a of body.agents) {
          if (a.reportsTo) {
            await db
              .update(agents)
              .set({ reportsTo: a.reportsTo })
              .where(eq(agents.id, a.id));
          }
        }
      }

      // ── 5. Seed projects ──────────────────────────────────────────────────
      if (body.projects) {
        stats.projectsCreated = await upsertById(db, projects, projects.id, body.projects.map((p) => ({
          id: p.id,
          companyId: p.companyId,
          name: p.name,
          description: p.description ?? null,
          status: p.status ?? "backlog",
          color: p.color ?? null,
          leadAgentId: p.leadAgentId ?? null,
        })));
      }

      // ── 6. Seed workflow templates ────────────────────────────────────────
      if (body.workflowTemplates) {
        stats.workflowTemplatesCreated = await upsertById(
          db,
          workflowTemplates,
          workflowTemplates.id,
          body.workflowTemplates.map((wt) => ({
            id: wt.id,
            companyId: wt.companyId,
            name: wt.name,
            description: wt.description ?? null,
            isDefault: wt.isDefault ?? false,
            createdFrom: wt.createdFrom ?? "custom",
            stages: wt.stages,
          })),
        );
      }

      // ── 7. Seed automation cursors ────────────────────────────────────────
      if (body.automationCursors) {
        stats.automationCursorsCreated = await upsertById(
          db,
          automationCursors,
          automationCursors.id,
          body.automationCursors.map((ac) => ({
            id: ac.id,
            companyId: ac.companyId,
            level: ac.level,
            targetId: ac.targetId ?? null,
            position: ac.position ?? "assisted",
            ceiling: ac.ceiling ?? "auto",
          })),
        );
      }

      // ── 9. Seed audit events (always create — they're immutable log entries)
      if (body.auditEvents && body.companies) {
        const novatechId = Object.values(body.companies).find((c) => c.issuePrefix === "NTS")?.id;
        if (novatechId) {
          let auditCreated = 0;
          for (const ae of body.auditEvents) {
            await db.insert(auditEvents).values({
              companyId: novatechId,
              actorId: userId,
              actorType: ae.actorType,
              action: ae.action,
              targetType: ae.targetType,
              targetId: novatechId, // generic target
              metadata: ae.metadata ?? null,
              severity: ae.severity ?? "info",
            });
            auditCreated++;
          }
          stats.auditEventsCreated = auditCreated;
        }
      }

      // ── 10. Seed traces (parent first, then children) ─────────────────────
      if (body.traces) {
        // Insert parent traces first (parentTraceId = null), then children
        const parents = body.traces.filter((t) => !t.parentTraceId);
        const children = body.traces.filter((t) => t.parentTraceId);
        const allTraces = [...parents, ...children].map((t) => ({
          id: t.id,
          companyId: t.companyId,
          agentId: t.agentId,
          parentTraceId: t.parentTraceId ?? null,
          name: t.name,
          status: t.status,
          startedAt: new Date(t.startedAt),
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
          totalDurationMs: t.totalDurationMs ?? null,
          totalTokensIn: t.totalTokensIn ?? 0,
          totalTokensOut: t.totalTokensOut ?? 0,
          totalCostUsd: t.totalCostUsd ?? "0",
          metadata: t.metadata ?? null,
          tags: t.tags ?? null,
        }));
        stats.tracesCreated = await upsertById(db, traces, traces.id, allTraces);
      }

      // ── 11. Seed trace observations ─────────────────────────────────────
      if (body.traceObservations) {
        // Insert parent observations first, then children
        const parentObs = body.traceObservations.filter((o) => !o.parentObservationId);
        const childObs = body.traceObservations.filter((o) => o.parentObservationId);
        const allObs = [...parentObs, ...childObs].map((o) => ({
          id: o.id,
          traceId: o.traceId,
          companyId: o.companyId,
          parentObservationId: o.parentObservationId ?? null,
          type: o.type,
          name: o.name,
          status: o.status,
          startedAt: new Date(o.startedAt),
          completedAt: o.completedAt ? new Date(o.completedAt) : null,
          durationMs: o.durationMs ?? null,
          level: o.level ?? null,
          statusMessage: o.statusMessage ?? null,
          input: o.input ?? null,
          output: o.output ?? null,
          inputTokens: o.inputTokens ?? null,
          outputTokens: o.outputTokens ?? null,
          totalTokens: o.totalTokens ?? null,
          costUsd: o.costUsd ?? null,
          model: o.model ?? null,
          modelParameters: o.modelParameters ?? null,
          metadata: o.metadata ?? null,
        }));
        stats.traceObservationsCreated = await upsertById(db, traceObservations, traceObservations.id, allObs);
      }

      // ── 12. Seed trace lenses ───────────────────────────────────────────
      if (body.traceLenses) {
        stats.traceLensesCreated = await upsertById(
          db,
          traceLenses,
          traceLenses.id,
          body.traceLenses.map((l) => ({
            id: l.id,
            companyId: l.companyId,
            userId: l.userId,
            name: l.name,
            prompt: l.prompt,
            scope: l.scope ?? {},
            isTemplate: l.isTemplate ?? false,
            isActive: l.isActive ?? true,
          })),
        );
      }

      // ── 13. Seed trace lens results ─────────────────────────────────────
      if (body.traceLensResults) {
        stats.traceLensResultsCreated = await upsertById(
          db,
          traceLensResults,
          traceLensResults.id,
          body.traceLensResults.map((r) => ({
            id: r.id,
            lensId: r.lensId,
            traceId: r.traceId ?? null,
            workflowInstanceId: r.workflowInstanceId ?? null,
            companyId: r.companyId,
            userId: r.userId,
            resultMarkdown: r.resultMarkdown,
            resultStructured: r.resultStructured ?? null,
            modelUsed: r.modelUsed ?? null,
            inputTokens: r.inputTokens ?? null,
            outputTokens: r.outputTokens ?? null,
            costUsd: r.costUsd ?? null,
          })),
        );
      }

      res.json({ ok: true, stats });
    } catch (err) {
      console.error("[e2e-seed] ensure-multi-role-access error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── POST /api/e2e-seed/cleanup ──────────────────────────────────────────
  router.post("/e2e-seed/cleanup", async (req, res) => {
    if (!isE2eEnabled()) { res.status(404).json({ error: "Not found" }); return; }

    try {
      const stats: Record<string, number> = {};

      // Delete in reverse dependency order
      // Use the deterministic company IDs to scope cleanup
      const seedCompanyIds = [
        "a1000000-0000-4000-8000-000000000001", // NovaTech
        "a2000000-0000-4000-8000-000000000002", // Atelier
      ];

      // Helper to safely delete and count
      async function safeDelete(table: any, col: any): Promise<number> {
        try {
          const result = await db.delete(table).where(inArray(col, seedCompanyIds));
          return Number((result as any).rowCount ?? 0);
        } catch {
          return 0;
        }
      }

      // Trace tables (lens results → lenses → observations → traces)
      stats.traceLensResults = await safeDelete(traceLensResults, traceLensResults.companyId);
      stats.traceLenses = await safeDelete(traceLenses, traceLenses.companyId);
      stats.traceObservations = await safeDelete(traceObservations, traceObservations.companyId);
      // Clear parentTraceId self-ref before deleting traces
      try {
        await db
          .update(traces)
          .set({ parentTraceId: null })
          .where(inArray(traces.companyId, seedCompanyIds));
      } catch { /* ignore */ }
      stats.traces = await safeDelete(traces, traces.companyId);

      // Leaf tables first (no other tables reference them)
      stats.auditEvents = await safeDelete(auditEvents, auditEvents.companyId);
      stats.automationCursors = await safeDelete(automationCursors, automationCursors.companyId);
      stats.driftItems = await safeDelete(driftItems, driftItems.companyId);
      stats.driftReports = await safeDelete(driftReports, driftReports.companyId);
      stats.ssoConfigurations = await safeDelete(ssoConfigurations, ssoConfigurations.companyId);
      stats.chatMessages = await safeDelete(chatMessages, chatMessages.companyId);
      stats.chatChannels = await safeDelete(chatChannels, chatChannels.companyId);

      // Stage instances before workflow instances
      stats.stageInstances = await safeDelete(stageInstances, stageInstances.companyId);
      stats.workflowInstances = await safeDelete(workflowInstances, workflowInstances.companyId);
      stats.workflowTemplates = await safeDelete(workflowTemplates, workflowTemplates.companyId);

      // Projects (clear leadAgentId first)
      try {
        await db
          .update(projects)
          .set({ leadAgentId: null })
          .where(inArray(projects.companyId, seedCompanyIds));
      } catch { /* ignore */ }
      stats.projects = await safeDelete(projects, projects.companyId);

      // Goals
      stats.goals = await safeDelete(goals, goals.companyId);

      // Agents (clear reportsTo first to avoid self-referencing FK)
      try {
        await db
          .update(agents)
          .set({ reportsTo: null })
          .where(inArray(agents.companyId, seedCompanyIds));
      } catch { /* ignore */ }
      stats.agents = await safeDelete(agents, agents.companyId);

      // Company memberships
      stats.memberships = await safeDelete(companyMemberships, companyMemberships.companyId);

      // Companies themselves
      stats.companies = await safeDelete(companies, companies.id);

      res.json({ ok: true, stats });
    } catch (err) {
      console.error("[e2e-seed] cleanup error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
