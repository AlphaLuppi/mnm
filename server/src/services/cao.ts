import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { agents, roles, rolePermissions, permissions, tags, tagAssignments, companyMemberships } from "@mnm/db";
import { seedPermissions } from "./permission-seed.js";
import { logger } from "../middleware/logger.js";

const CAO_AGENT_NAME = "CAO";
const CAO_AGENT_TITLE = "Chief Agent Officer";
const CAO_ADAPTER_TYPE = "claude_local";
const CAO_ROLE_SLUG = "admin";

const CAO_PROMPT_TEMPLATE = `You are the CAO (Chief Agent Officer) of this MnM instance.

## Platform
MnM is an enterprise B2B supervision cockpit for AI agent orchestration. You manage and oversee all agents in this company's instance.

## Your Role
- You are the top-level supervisory agent with Admin permissions and visibility across all tags
- You monitor agent activity, detect anomalies, and advise the human team
- You can create, configure, and manage other agents
- You NEVER block human decisions — you advise, warn, and suggest, but never prevent action

## Your Capabilities
- Create and configure new agents when asked
- Monitor agent runs and detect issues (errors, timeouts, anomalies)
- Answer questions about the organization's agent fleet
- Suggest improvements to workflows and agent configurations
- Report on agent activity, costs, and performance

## MnM API
You have access to the MnM REST API at the URL in your MNM_API_URL environment variable.
Your API key is in MNM_API_KEY. Your agent ID is in MNM_AGENT_ID.
Use these to interact with the platform programmatically.

Key endpoints:
- GET /api/companies/{companyId}/agents — list all agents
- GET /api/companies/{companyId}/issues — list issues
- POST /api/companies/{companyId}/issues — create an issue
- GET /api/companies/{companyId}/roles — list roles
- GET /api/companies/{companyId}/tags — list tags

## Current Task
You are agent {{agent.id}} ({{agent.name}}).
Company: {{agent.companyId}}

{{#if context.issueTitle}}
You have been assigned this task:
**{{context.issueTitle}}**

{{context.issueDescription}}
{{else}}
Continue your monitoring and advisory work. Check for anomalies, pending issues, or ways to help the team.
{{/if}}`;


/**
 * CAO — Chief Agent Officer
 *
 * Auto-created at company setup. Dual-nature:
 * - Watchdog (silent mode): monitors events, comments issues, traces bypass
 * - Interactive (@cao): responds to questions in comments
 *
 * The CAO:
 * - Has the Admin role (bypass_tag_filter, all permissions)
 * - Receives every new tag automatically (sees everything)
 * - Is is_system (cannot be deleted)
 * - Uses adapter_type "claude_local" (runs in admin's Docker sandbox)
 */

/**
 * Ensures the CAO agent exists for a company.
 * Creates it if missing. Idempotent.
 *
 * Call this after company creation and after roles/permissions are seeded.
 */
export async function ensureCao(db: Db, companyId: string, createdByUserId?: string): Promise<string> {
  // Check if CAO already exists (identified by metadata.isCAO)
  const allAgents = await db
    .select({ id: agents.id, metadata: agents.metadata })
    .from(agents)
    .where(eq(agents.companyId, companyId));
  const existing = allAgents.find((a) => (a.metadata as Record<string, unknown>)?.isCAO === true);

  if (existing) {
    logger.debug({ companyId, caoId: existing.id }, "CAO already exists");
    return existing.id;
  }

  // Create the CAO agent
  const [cao] = await db
    .insert(agents)
    .values({
      companyId,
      name: CAO_AGENT_NAME,
      title: CAO_AGENT_TITLE,
      adapterType: CAO_ADAPTER_TYPE,
      status: "active",
      icon: "crown",
      capabilities: "monitoring, advisory, anomaly detection, interactive Q&A",
      createdByUserId: createdByUserId ?? null,
      adapterConfig: {
        promptTemplate: CAO_PROMPT_TEMPLATE,
      },
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 300,
          wakeOnDemand: true,
          cooldownSec: 10,
          maxConcurrentRuns: 1,
        },
      },
      permissions: { canCreateAgents: true },
      budgetMonthlyCents: 0,
      metadata: { isCAO: true },
    })
    .returning();

  logger.info({ companyId, caoId: cao.id }, "CAO agent created");

  // Assign all existing tags to the CAO
  const allTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.companyId, companyId));

  if (allTags.length > 0) {
    await db
      .insert(tagAssignments)
      .values(
        allTags.map((tag) => ({
          companyId,
          targetType: "agent" as const,
          targetId: cao.id,
          tagId: tag.id,
          assignedBy: "system",
        })),
      )
      .onConflictDoNothing();

    logger.info({ companyId, caoId: cao.id, tagCount: allTags.length }, "CAO assigned all existing tags");
  }

  return cao.id;
}

/**
 * Full company bootstrap: seed permissions, create admin role, create CAO.
 * Call this once at company creation (onboarding step 1).
 */
export async function bootstrapCompany(
  db: Db,
  companyId: string,
  adminUserId: string,
): Promise<{ adminRoleId: string; caoAgentId: string }> {
  return db.transaction(async (tx) => {
    // 1. Seed standard permissions
    await seedPermissions(tx as unknown as Db, companyId);

    // 2. Create the Admin role (is_system, bypass_tag_filter, all permissions)
    const [adminRole] = await tx
      .insert(roles)
      .values({
        companyId,
        name: "Admin",
        slug: CAO_ROLE_SLUG,
        description: "Full access to all features and all tags",
        hierarchyLevel: 0,
        bypassTagFilter: true,
        isSystem: true,
      })
      .onConflictDoNothing()
      .returning();

    const adminRoleId = adminRole?.id;

    // If role already existed (onConflictDoNothing), fetch it
    let resolvedAdminRoleId = adminRoleId;
    if (!resolvedAdminRoleId) {
      const [existing] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.companyId, companyId), eq(roles.slug, CAO_ROLE_SLUG)));
      resolvedAdminRoleId = existing?.id;
    }

    // 3. Assign all permissions to the admin role
    if (resolvedAdminRoleId) {
      const allPerms = await tx
        .select({ id: permissions.id })
        .from(permissions)
        .where(eq(permissions.companyId, companyId));

      if (allPerms.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(allPerms.map((p) => ({ roleId: resolvedAdminRoleId!, permissionId: p.id })))
          .onConflictDoNothing();
      }

      // 4. Assign the admin role to the creating user
      await tx
        .update(companyMemberships)
        .set({ roleId: resolvedAdminRoleId })
        .where(and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, adminUserId),
        ));
    }

    // 5. Create the CAO agent
    const caoAgentId = await ensureCao(tx as unknown as Db, companyId, adminUserId);

    // 6. Create a company_memberships row for the CAO (Admin role, consistency)
    if (resolvedAdminRoleId) {
      await tx
        .insert(companyMemberships)
        .values({
          companyId,
          principalType: "agent",
          principalId: caoAgentId,
          roleId: resolvedAdminRoleId,
          membershipRole: "member",
        })
        .onConflictDoNothing();
    }

    logger.info({
      companyId,
      adminRoleId: resolvedAdminRoleId,
      caoAgentId,
    }, "Company bootstrap complete");

    return {
      adminRoleId: resolvedAdminRoleId ?? "",
      caoAgentId,
    };
  });
}

/**
 * Hook: called when a new tag is created.
 * Auto-assigns the tag to the CAO agent so it never loses visibility.
 */
export async function onTagCreated(db: Db, companyId: string, tagId: string): Promise<void> {
  // Find CAO by metadata.isCAO
  const allAgents = await db
    .select({ id: agents.id, metadata: agents.metadata })
    .from(agents)
    .where(eq(agents.companyId, companyId));
  const cao = allAgents.find((a) => (a.metadata as Record<string, unknown>)?.isCAO === true);

  if (!cao) return; // No CAO yet (shouldn't happen after bootstrap)

  await db
    .insert(tagAssignments)
    .values({
      companyId,
      targetType: "agent",
      targetId: cao.id,
      tagId,
      assignedBy: "system",
    })
    .onConflictDoNothing();
}
