/**
 * A2A-S02: A2A Permissions Service — Granular A2A access control
 *
 * Manages permission rules for agent-to-agent communication:
 * - CRUD operations on permission rules
 * - Permission checking with priority-based rule matching
 * - Agent-specific (ID-based) rules override role-based rules
 * - Bidirectional rule support
 * - Default policy (allow/deny) per company
 * - Audit trail for all permission actions
 *
 * Pattern: Same service factory as a2a-bus.ts, credential-proxy-rules.ts
 */

import { and, eq, desc, or, isNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { a2aPermissionRules, companies, agents } from "@mnm/db";
import type {
  A2APermissionRule,
  A2APermissionCheckResult,
  A2ADefaultPolicy,
} from "@mnm/shared";
import { auditService } from "./audit.js";
import { logger as parentLogger } from "../middleware/logger.js";

const logger = parentLogger.child({ module: "a2a-permissions" });

// --- Helper: row to A2APermissionRule ---

function rowToRule(row: typeof a2aPermissionRules.$inferSelect): A2APermissionRule {
  return {
    id: row.id,
    companyId: row.companyId,
    sourceAgentId: row.sourceAgentId,
    sourceAgentRole: row.sourceAgentRole,
    targetAgentId: row.targetAgentId,
    targetAgentRole: row.targetAgentRole,
    allowed: row.allowed,
    bidirectional: row.bidirectional,
    priority: row.priority,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Service factory ---

// a2a-s02-service-factory
export function a2aPermissionsService(db: Db) {
  const audit = auditService(db);

  // a2a-s02-get-default-policy
  async function getDefaultPolicy(companyId: string): Promise<A2ADefaultPolicy> {
    const [row] = await db
      .select({ a2aDefaultPolicy: companies.a2aDefaultPolicy })
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!row) {
      return "allow";
    }

    return (row.a2aDefaultPolicy ?? "allow") as A2ADefaultPolicy;
  }

  // a2a-s02-update-default-policy
  async function updateDefaultPolicy(
    companyId: string,
    policy: A2ADefaultPolicy,
  ): Promise<A2ADefaultPolicy> {
    await db
      .update(companies)
      .set({ a2aDefaultPolicy: policy, updatedAt: new Date() })
      .where(eq(companies.id, companyId));

    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.default_policy_updated",
      targetType: "company",
      targetId: companyId,
      metadata: { policy },
      severity: "info",
    });

    logger.info({ companyId, policy }, "A2A default policy updated");

    return policy;
  }

  // a2a-s02-create-rule
  async function createRule(
    companyId: string,
    input: {
      sourceAgentId?: string | null;
      sourceAgentRole?: string | null;
      targetAgentId?: string | null;
      targetAgentRole?: string | null;
      allowed?: boolean;
      bidirectional?: boolean;
      priority?: number;
      description?: string | null;
    },
  ): Promise<A2APermissionRule> {
    const now = new Date();
    const [row] = await db
      .insert(a2aPermissionRules)
      .values({
        companyId,
        sourceAgentId: input.sourceAgentId ?? null,
        sourceAgentRole: input.sourceAgentRole ?? null,
        targetAgentId: input.targetAgentId ?? null,
        targetAgentRole: input.targetAgentRole ?? null,
        allowed: input.allowed ?? true,
        bidirectional: input.bidirectional ?? false,
        priority: input.priority ?? 0,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const rule = rowToRule(row);

    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.permission_rule_created",
      targetType: "a2a_permission_rule",
      targetId: rule.id,
      metadata: {
        sourceAgentId: rule.sourceAgentId,
        sourceAgentRole: rule.sourceAgentRole,
        targetAgentId: rule.targetAgentId,
        targetAgentRole: rule.targetAgentRole,
        allowed: rule.allowed,
        bidirectional: rule.bidirectional,
        priority: rule.priority,
      },
      severity: "info",
    });

    logger.info({ ruleId: rule.id, companyId }, "A2A permission rule created");

    return rule;
  }

  // a2a-s02-update-rule
  async function updateRule(
    companyId: string,
    ruleId: string,
    input: {
      sourceAgentId?: string | null;
      sourceAgentRole?: string | null;
      targetAgentId?: string | null;
      targetAgentRole?: string | null;
      allowed?: boolean;
      bidirectional?: boolean;
      priority?: number;
      description?: string | null;
    },
  ): Promise<A2APermissionRule> {
    const [existing] = await db
      .select()
      .from(a2aPermissionRules)
      .where(and(eq(a2aPermissionRules.id, ruleId), eq(a2aPermissionRules.companyId, companyId)));

    if (!existing) {
      throw Object.assign(new Error("Permission rule not found"), { statusCode: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.sourceAgentId !== undefined) updates.sourceAgentId = input.sourceAgentId;
    if (input.sourceAgentRole !== undefined) updates.sourceAgentRole = input.sourceAgentRole;
    if (input.targetAgentId !== undefined) updates.targetAgentId = input.targetAgentId;
    if (input.targetAgentRole !== undefined) updates.targetAgentRole = input.targetAgentRole;
    if (input.allowed !== undefined) updates.allowed = input.allowed;
    if (input.bidirectional !== undefined) updates.bidirectional = input.bidirectional;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.description !== undefined) updates.description = input.description;

    const [updated] = await db
      .update(a2aPermissionRules)
      .set(updates)
      .where(and(eq(a2aPermissionRules.id, ruleId), eq(a2aPermissionRules.companyId, companyId)))
      .returning();

    const rule = rowToRule(updated);

    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.permission_rule_updated",
      targetType: "a2a_permission_rule",
      targetId: ruleId,
      metadata: { changes: input },
      severity: "info",
    });

    logger.info({ ruleId, companyId }, "A2A permission rule updated");

    return rule;
  }

  // a2a-s02-delete-rule
  async function deleteRule(companyId: string, ruleId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(a2aPermissionRules)
      .where(and(eq(a2aPermissionRules.id, ruleId), eq(a2aPermissionRules.companyId, companyId)));

    if (!existing) {
      throw Object.assign(new Error("Permission rule not found"), { statusCode: 404 });
    }

    await db
      .delete(a2aPermissionRules)
      .where(and(eq(a2aPermissionRules.id, ruleId), eq(a2aPermissionRules.companyId, companyId)));

    await audit.emit({
      companyId,
      actorId: "system",
      actorType: "system",
      action: "a2a.permission_rule_deleted",
      targetType: "a2a_permission_rule",
      targetId: ruleId,
      metadata: {
        sourceAgentId: existing.sourceAgentId,
        sourceAgentRole: existing.sourceAgentRole,
        targetAgentId: existing.targetAgentId,
        targetAgentRole: existing.targetAgentRole,
      },
      severity: "info",
    });

    logger.info({ ruleId, companyId }, "A2A permission rule deleted");
  }

  // a2a-s02-list-rules
  async function listRules(companyId: string): Promise<A2APermissionRule[]> {
    const rows = await db
      .select()
      .from(a2aPermissionRules)
      .where(eq(a2aPermissionRules.companyId, companyId))
      .orderBy(desc(a2aPermissionRules.priority));

    return rows.map(rowToRule);
  }

  // a2a-s02-get-rule-by-id
  async function getRuleById(companyId: string, ruleId: string): Promise<A2APermissionRule | null> {
    const [row] = await db
      .select()
      .from(a2aPermissionRules)
      .where(and(eq(a2aPermissionRules.id, ruleId), eq(a2aPermissionRules.companyId, companyId)));

    return row ? rowToRule(row) : null;
  }

  // a2a-s02-check-permission
  async function checkPermission(
    companyId: string,
    senderId: string,
    senderRole: string,
    receiverId: string,
    receiverRole: string,
  ): Promise<A2APermissionCheckResult> {
    // Get all rules for this company, sorted by priority DESC
    const rules = await db
      .select()
      .from(a2aPermissionRules)
      .where(eq(a2aPermissionRules.companyId, companyId))
      .orderBy(desc(a2aPermissionRules.priority));

    // Try to find a matching rule (highest priority first)
    for (const rule of rules) {
      const forwardMatch = matchesRule(rule, senderId, senderRole, receiverId, receiverRole);
      const reverseMatch = rule.bidirectional
        ? matchesRule(rule, receiverId, receiverRole, senderId, senderRole)
        : false;

      if (forwardMatch || reverseMatch) {
        return {
          allowed: rule.allowed,
          matchedRuleId: rule.id,
          reason: "explicit_rule",
          defaultPolicy: await getDefaultPolicy(companyId),
        };
      }
    }

    // No matching rule — fall back to default policy
    const defaultPolicy = await getDefaultPolicy(companyId);
    return {
      allowed: defaultPolicy === "allow",
      matchedRuleId: null,
      reason: "default_policy",
      defaultPolicy,
    };
  }

  return {
    getDefaultPolicy,
    updateDefaultPolicy,
    createRule,
    updateRule,
    deleteRule,
    listRules,
    getRuleById,
    checkPermission,
  };
}

// --- Rule matching helper ---

function matchesRule(
  rule: typeof a2aPermissionRules.$inferSelect,
  senderId: string,
  senderRole: string,
  receiverId: string,
  receiverRole: string,
): boolean {
  // Source matching: agent-specific (by ID) takes priority over role-based
  const sourceMatches =
    (rule.sourceAgentId != null && rule.sourceAgentId === senderId) ||
    (rule.sourceAgentId == null && rule.sourceAgentRole != null && rule.sourceAgentRole === senderRole) ||
    (rule.sourceAgentId == null && rule.sourceAgentRole == null); // wildcard

  if (!sourceMatches) return false;

  // Target matching: same logic
  const targetMatches =
    (rule.targetAgentId != null && rule.targetAgentId === receiverId) ||
    (rule.targetAgentId == null && rule.targetAgentRole != null && rule.targetAgentRole === receiverRole) ||
    (rule.targetAgentId == null && rule.targetAgentRole == null); // wildcard

  return targetMatches;
}
