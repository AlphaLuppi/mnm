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
  containerProfiles,
  automationCursors,
  auditEvents,
  chatChannels,
  chatMessages,
  workflowInstances,
  stageInstances,
  ssoConfigurations,
  driftReports,
  driftItems,
  principalPermissionGrants,
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
        containerProfiles?: Array<{
          id: string;
          companyId: string;
          name: string;
          description?: string;
          cpuMillicores?: number;
          memoryMb?: number;
          diskMb?: number;
          timeoutSeconds?: number;
          gpuEnabled?: boolean;
          networkPolicy?: string;
          isDefault?: boolean;
          dockerImage?: string;
          maxContainers?: number;
          credentialProxyEnabled?: boolean;
          networkMode?: string;
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
              businessRole: user.businessRole,
            });
            membershipsCreated++;
          } else if (existing.businessRole !== user.businessRole) {
            // Update businessRole if it changed
            await db
              .update(companyMemberships)
              .set({ businessRole: user.businessRole, updatedAt: new Date() })
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
          role: a.role ?? "general",
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

      // ── 7. Seed container profiles ────────────────────────────────────────
      if (body.containerProfiles) {
        stats.containerProfilesCreated = await upsertById(
          db,
          containerProfiles,
          containerProfiles.id,
          body.containerProfiles.map((cp) => ({
            id: cp.id,
            companyId: cp.companyId,
            name: cp.name,
            description: cp.description ?? null,
            cpuMillicores: cp.cpuMillicores ?? 1000,
            memoryMb: cp.memoryMb ?? 512,
            diskMb: cp.diskMb ?? 1024,
            timeoutSeconds: cp.timeoutSeconds ?? 3600,
            gpuEnabled: cp.gpuEnabled ?? false,
            networkPolicy: cp.networkPolicy ?? "isolated",
            isDefault: cp.isDefault ?? false,
            dockerImage: cp.dockerImage ?? null,
            maxContainers: cp.maxContainers ?? 10,
            credentialProxyEnabled: cp.credentialProxyEnabled ?? false,
            networkMode: cp.networkMode ?? "isolated",
          })),
        );
      }

      // ── 8. Seed automation cursors ────────────────────────────────────────
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

      // Leaf tables first (no other tables reference them)
      stats.auditEvents = await safeDelete(auditEvents, auditEvents.companyId);
      stats.automationCursors = await safeDelete(automationCursors, automationCursors.companyId);
      stats.driftItems = await safeDelete(driftItems, driftItems.companyId);
      stats.driftReports = await safeDelete(driftReports, driftReports.companyId);
      stats.ssoConfigurations = await safeDelete(ssoConfigurations, ssoConfigurations.companyId);
      stats.principalPermissionGrants = await safeDelete(principalPermissionGrants, principalPermissionGrants.companyId);
      stats.chatMessages = await safeDelete(chatMessages, chatMessages.companyId);
      stats.chatChannels = await safeDelete(chatChannels, chatChannels.companyId);

      // Stage instances before workflow instances
      stats.stageInstances = await safeDelete(stageInstances, stageInstances.companyId);
      stats.workflowInstances = await safeDelete(workflowInstances, workflowInstances.companyId);
      stats.workflowTemplates = await safeDelete(workflowTemplates, workflowTemplates.companyId);

      // Container profiles (clear agent FK first)
      try {
        await db
          .update(agents)
          .set({ containerProfileId: null })
          .where(inArray(agents.companyId, seedCompanyIds));
      } catch { /* ignore */ }
      stats.containerProfiles = await safeDelete(containerProfiles, containerProfiles.companyId);

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
