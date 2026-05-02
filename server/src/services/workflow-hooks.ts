/**
 * server/src/services/workflow-hooks.ts
 *
 * Centralised workflow-hooks service. Owns:
 *  - CRUD on `workflow_hooks_config` + 3-tier visibility (private / tags /
 *    principals / company) via injected resolvers (mirrors the visibility
 *    helper used elsewhere in the codebase).
 *  - Resolution of hooks for a step phase (workflow.json declared +
 *    instance-level enforced configs, dedup, RBAC + visibility filter).
 *  - Execution of hooks via `@mnm/workflow-hooks` runner with the audit
 *    "outbox" pattern: INSERT pending row BEFORE the call, UPDATE
 *    status final on completion. Tenant context is set/cleared around
 *    every execution (RLS narrowing + cleanup).
 *  - Listing the catalog (canonical + shared + local hooks visible to a
 *    user).
 *  - Light LRU cache `companyId → enforced configs[]` (60 s TTL,
 *    invalidated on PATCH).
 *
 * The service is used by:
 *  - REST routes (T2.8) for the admin UI (`/companies/:co/workflow-hooks/*`).
 *  - The orchestrator (T2.7) — wired in `governed-workflows.ts` at four
 *    insertion points (before_run, before_step, after_step, after_run).
 *
 * Kill-switch: when `MNM_HOOKS_DISABLED=true` is set in the process env,
 * `executeHook` returns immediately with `{ ok: true }` and writes a
 * `success` audit row tagged with `result_summary='kill-switch'`. The
 * V0 kill-switch is env-only (no instance_settings table).
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  companyMemberships,
  tags,
  workflowHookExecutions,
  workflowHooksConfig,
  workflowHooksConfigAudit,
  workflowHooksConfigPrincipals,
  workflowHooksConfigTags,
  type WorkflowHookConfigAuditAction,
  type WorkflowHookConfigRow,
  type WorkflowHookExecutionRow,
  type WorkflowHookPhase,
} from "@mnm/db";
import {
  HOOK_ERROR_CODES,
  type HookBlock,
} from "@mnm/governed-workflows";
import {
  type HookConfigSchema,
  type HookContext,
  type HookEvaluationResult,
  type HookPhase,
  type ResolvedHook,
  buildHostHelpers,
  getCanonicalMetadata,
  loadCanonical,
  listCanonicalHooks,
  resolveHookRef,
  runHook,
} from "@mnm/workflow-hooks";
import type { GitProvider } from "@mnm/git-provider";
import type { Visibility } from "@mnm/shared";
import {
  clearTenantContext,
  setTenantContext,
} from "../middleware/tenant-context.js";
import {
  canPrincipalAccess,
  type VisibilityResolvers,
} from "./visibility.js";
import type { ConnectorService } from "./connectors.js";
import { assertSafePublicUrl } from "./ssrf-guard.js";
import { logger } from "../middleware/logger.js";
import { publishLiveEvent } from "./live-events.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Minimal LLM provider abstraction. V0 = Anthropic only; the service
 * accepts an injected provider so V1 can swap implementations without
 * touching this file. Estimator is a coarse 4-chars-per-token heuristic.
 */
export interface HookLlmProvider {
  invoke(req: {
    prompt: string;
    system?: string;
    model?: string;
    max_tokens?: number;
  }): Promise<{
    text: string;
    usage: { input_tokens: number; output_tokens: number };
  }>;
  estimateInputTokens(req: { prompt: string; system?: string }): number;
  /**
   * Per-run remaining token budget. Returning `null` disables the
   * pre-flight check (unbounded). The service does NOT track usage
   * across calls in V0 — each call sees the budget configured at
   * service-factory time.
   */
  tokenBudgetRemaining(): number | null;
}

export interface HookProviderEntry {
  baseUrl: string;
  apiKeyHeader?: string;
}

/**
 * Static provider catalog. V0 reuses `oauth_connectors` for credentials
 * but ships a hardcoded `{providerSlug: { baseUrl, apiKeyHeader? }}` map
 * so canonical Jira / ClickUp hooks can run without a separate provider
 * whitelist table (RF-2, decision-log §4.5). V1 can move this to DB.
 *
 * For multi-tenant Jira (each company has its own atlassian.net
 * instance), V1 should add a `base_url` override per oauth_connectors
 * row. V0 documents this limitation: companies that need a custom Jira
 * URL must override via the catalog at service-factory time.
 */
export interface HookProviderCatalog {
  /** Provider slug → endpoint metadata. */
  providers: Record<string, HookProviderEntry>;
  /**
   * Test-only escape hatch — when set, replaces the default
   * `assertSafePublicUrl`. Production code should leave this undefined.
   */
  __assertSafeUrl?: (url: string) => Promise<void>;
}

/**
 * Shape returned by `listConfigs` and `getConfig`. Joins config row +
 * tag ids + principal ids into a single client-friendly object so the
 * REST + UI consumers don't have to issue 3 sub-queries per row.
 */
export interface HookConfigDto {
  id: string;
  companyId: string;
  name: string;
  hookRef: string;
  defaultConfigJson: Record<string, unknown>;
  visibility: Visibility;
  createdByPrincipalId: string;
  enabled: boolean;
  enforced: boolean;
  enforcedPhases: string[];
  tagIds: string[];
  principalIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertHookConfigInput {
  name: string;
  hookRef: string;
  defaultConfigJson?: Record<string, unknown>;
  visibility: Visibility;
  enabled?: boolean;
  /**
   * Whether the hook is admin-imposed on every workflow run in the
   * company. Toggling to `true` requires `hooks:enforce` permission
   * (enforced by the route layer + revalidated here).
   */
  enforced?: boolean;
  /**
   * When `enforced=true`, optionally narrow to a subset of phases.
   * Empty array = enforced on every phase.
   */
  enforcedPhases?: string[];
  tagIds?: string[];
  principalIds?: string[];
}

export interface UpsertContext {
  /** The principal id (text "userId" mirroring `actor_user_id`). */
  actorPrincipalId: string;
  /** True if the actor has the `hooks:enforce` permission. Required to flip `enforced=true`. */
  hasEnforcePermission: boolean;
}

export interface ListExecutionsFilter {
  configId?: string;
  runId?: string;
  status?: WorkflowHookExecutionRow["status"];
  phase?: WorkflowHookPhase;
  /** ISO string or Date — `created_at >= since`. */
  since?: Date | string;
  /** ISO string or Date — `created_at <= until`. */
  until?: Date | string;
  limit?: number;
  offset?: number;
}

export interface HookCatalogEntry {
  source: "canonical" | "shared" | "local";
  /** Bare hook name without the prefix. */
  name: string;
  ref: string;
  /** Pinned content sha. */
  sha: string;
  // ─── P4-G: catalog metadata for the picker UI ─────────────────────────
  // For `source: "canonical"` these fields are populated from the metadata
  // captured by `defineHook({ ...metadata, execute })`. For shared / local
  // hooks they remain undefined in V0 — V1 will parse the remote .hook.ts
  // file (TODO below in `listCatalog`).
  /** Author-provided description shown next to the hook in the picker. */
  description?: string;
  /** Phase the hook is meant to run at (constrains where it can be slotted). */
  phase?: HookPhase;
  /** OAuth scopes the hook requires (e.g. `["read:jira-work"]`). */
  requiredScopes?: string[];
  /** Per-field schema for the `with` block — used by the UI to render typed inputs. */
  configSchema?: HookConfigSchema;
  /** Default values pre-filled when the picker selects this hook. */
  defaultConfig?: Record<string, unknown>;
}

export interface HookCatalog {
  canonical: HookCatalogEntry[];
  shared: HookCatalogEntry[];
  local: HookCatalogEntry[];
}

/**
 * Per-call runtime context for `executeHook`. Built by the orchestrator
 * (T2.7) at the wire site.
 */
export interface HookRuntimeCtx {
  companyId: string;
  actorUserId: string;
  runId: string;
  stepExecutionId?: string;
  workflowGitSha: string;
  hookCtx: HookContext;
}

export interface ResolvedHookForStep {
  /** `null` for hooks declared in workflow.json (not stored in DB). */
  configId: string | null;
  ref: string;
  /** Merged config: defaultConfigJson (DB) ⊕ stepWith (workflow.json). */
  config: Record<string, unknown>;
  enforced: boolean;
}

// ─── Service factory ────────────────────────────────────────────────────────

export interface WorkflowHooksServiceDeps {
  /** Connector service used for token + provider lookup (HOST-ONLY). */
  connectors: ConnectorService;
  /**
   * Resolver returning a `GitProvider` for the (companyId, userId) pair.
   * Used for `shared:` and `local:` hook resolution. The service does
   * NOT cache providers — that's the caller's responsibility.
   */
  resolveGitProvider: (args: {
    companyId: string;
    userId: string;
  }) => Promise<GitProvider>;
  /** LLM provider used by `helpers.llm`. */
  llm: HookLlmProvider;
  /** Static map of provider slug → base URL + optional api key header. */
  providerCatalog: HookProviderCatalog;
  /** Optional override of the kill-switch env var (defaults to `MNM_HOOKS_DISABLED`). */
  killSwitchEnv?: string;
}

export type WorkflowHooksService = ReturnType<typeof workflowHooksService>;

const ENFORCED_CACHE_TTL_MS = 60_000;
const CATALOG_CACHE_TTL_MS = 60_000;
const KILL_SWITCH_DEFAULT = "MNM_HOOKS_DISABLED";

export function workflowHooksService(
  db: Db,
  deps: WorkflowHooksServiceDeps,
) {
  /**
   * In-process LRU cache `companyId → enforced configs[]`. TTL bounded
   * (60 s) so a missed invalidation surfaces within a minute. Always
   * invalidated explicitly on `upsertConfig` / `deleteConfig` for
   * immediate consistency.
   */
  const enforcedCache = new Map<
    string,
    { rows: HookConfigDto[]; expiresAt: number }
  >();

  /**
   * In-process LRU cache `companyId:branch:sha:flags → catalog`. Mirrors
   * the enforced cache TTL semantics (60s). Invalidated alongside the
   * enforced cache on config CRUD because new local hooks may surface there.
   */
  const catalogCache = new Map<
    string,
    { catalog: HookCatalog; expiresAt: number }
  >();

  // Fail-fast on ssrf-guard wiring at first call so unit tests can stub it.
  const assertSafeUrl: (url: string) => Promise<void> =
    deps.providerCatalog.__assertSafeUrl ??
    ((url) => assertSafePublicUrl(url));

  function isKillSwitchOn(): boolean {
    const envVar = deps.killSwitchEnv ?? KILL_SWITCH_DEFAULT;
    return process.env[envVar] === "true";
  }

  function invalidateEnforcedCache(companyId: string): void {
    enforcedCache.delete(companyId);
    invalidateCatalogCache(companyId);
  }

  function invalidateCatalogCache(companyId: string): void {
    // Drop every entry whose key starts with `${companyId}:` (different
    // branch / sha permutations all live under the same companyId prefix).
    const prefix = `${companyId}:`;
    for (const key of catalogCache.keys()) {
      if (key.startsWith(prefix)) catalogCache.delete(key);
    }
  }

  // ─── Tag / Principal company-ownership validators (P0.2) ─────────────────

  /**
   * Throws `badRequest` if any tagId is not owned by the given companyId.
   * Defends the join table from cross-tenant pollution: RLS narrows reads
   * downstream but the join row itself would otherwise be insertable from
   * any company.
   */
  async function assertTagsBelongToCompany(
    companyId: string,
    tagIds: readonly string[],
  ): Promise<void> {
    if (tagIds.length === 0) return;
    const rows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.companyId, companyId), inArray(tags.id, [...tagIds])));
    if (rows.length !== new Set(tagIds).size) {
      throw badRequest("Tag does not belong to this company");
    }
  }

  /**
   * Throws `badRequest` if any principalId is not a member of the given
   * company. We rely on `company_memberships` (active or inactive — we
   * just want to confirm the principal is known to the tenant) since
   * principals are typed `text` and can be users or agents.
   */
  async function assertPrincipalsBelongToCompany(
    companyId: string,
    principalIds: readonly string[],
  ): Promise<void> {
    if (principalIds.length === 0) return;
    const rows = await db
      .select({ principalId: companyMemberships.principalId })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          inArray(companyMemberships.principalId, [...principalIds]),
        ),
      );
    const seen = new Set(rows.map((r) => r.principalId));
    for (const p of principalIds) {
      if (!seen.has(p)) {
        throw badRequest("Principal does not belong to this company");
      }
    }
  }

  // ─── Visibility resolvers (DI for canPrincipalAccess) ────────────────────

  const visibilityResolvers: VisibilityResolvers = {
    hasTagIntersection: async (resourceId, principalId) => {
      // Tag intersection: principal is on at least one tag listed for the config.
      // Implementation note: we cross-join tag_assignments via principal_tags.
      // For V0 the join is via `tag_assignments` if the project has it; here we
      // implement the minimal contract — list configs's tags then intersect
      // against principal's tags via raw SQL.
      const rows = (await db.execute(sql`
        SELECT EXISTS (
          SELECT 1
          FROM workflow_hooks_config_tags wct
          JOIN tag_assignments ta ON ta.tag_id = wct.tag_id
          WHERE wct.config_id = ${resourceId}
            AND ta.target_id = ${principalId}
        ) AS has_intersection
      `)) as unknown as Array<{ has_intersection?: boolean }>;
      return Boolean(rows[0]?.has_intersection);
    },
    isPrincipalListed: async (resourceId, principalId) => {
      const rows = (await db.execute(sql`
        SELECT EXISTS (
          SELECT 1
          FROM workflow_hooks_config_principals
          WHERE config_id = ${resourceId}
            AND principal_id = ${principalId}
        ) AS is_listed
      `)) as unknown as Array<{ is_listed?: boolean }>;
      return Boolean(rows[0]?.is_listed);
    },
  };

  // ─── Config CRUD ─────────────────────────────────────────────────────────

  async function rowToDto(
    row: WorkflowHookConfigRow,
  ): Promise<HookConfigDto> {
    const [tags, principals] = await Promise.all([
      db
        .select({ tagId: workflowHooksConfigTags.tagId })
        .from(workflowHooksConfigTags)
        .where(eq(workflowHooksConfigTags.configId, row.id)),
      db
        .select({ principalId: workflowHooksConfigPrincipals.principalId })
        .from(workflowHooksConfigPrincipals)
        .where(eq(workflowHooksConfigPrincipals.configId, row.id)),
    ]);
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      hookRef: row.hookRef,
      defaultConfigJson: (row.defaultConfigJson as Record<string, unknown>) ?? {},
      visibility: row.visibility as Visibility,
      createdByPrincipalId: row.createdByPrincipalId,
      enabled: row.enabled,
      enforced: row.enforced,
      enforcedPhases: row.enforcedPhases ?? [],
      tagIds: tags.map((t) => t.tagId),
      principalIds: principals.map((p) => p.principalId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function listConfigs(
    companyId: string,
    actorPrincipalId: string,
  ): Promise<HookConfigDto[]> {
    const rows = await db
      .select()
      .from(workflowHooksConfig)
      .where(eq(workflowHooksConfig.companyId, companyId))
      .orderBy(desc(workflowHooksConfig.updatedAt));
    const dtos = await Promise.all(rows.map(rowToDto));
    const visible: HookConfigDto[] = [];
    for (const dto of dtos) {
      const allowed = await canPrincipalAccess(
        {
          id: dto.id,
          visibility: dto.visibility,
          createdByPrincipalId: dto.createdByPrincipalId,
        },
        actorPrincipalId,
        visibilityResolvers,
      );
      if (allowed) visible.push(dto);
    }
    return visible;
  }

  async function getConfig(
    companyId: string,
    configId: string,
    actorPrincipalId: string,
  ): Promise<HookConfigDto | null> {
    const [row] = await db
      .select()
      .from(workflowHooksConfig)
      .where(
        and(
          eq(workflowHooksConfig.companyId, companyId),
          eq(workflowHooksConfig.id, configId),
        ),
      );
    if (!row) return null;
    const dto = await rowToDto(row);
    const allowed = await canPrincipalAccess(
      {
        id: dto.id,
        visibility: dto.visibility,
        createdByPrincipalId: dto.createdByPrincipalId,
      },
      actorPrincipalId,
      visibilityResolvers,
    );
    return allowed ? dto : null;
  }

  function validateUpsert(input: UpsertHookConfigInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw badRequest("Hook config name is required");
    }
    if (!/^(canonical|shared|local):[a-z0-9-]+$/.test(input.hookRef)) {
      throw badRequest(
        "hookRef must match canonical|shared|local:[a-z0-9-]+",
      );
    }
    if (
      !["private", "tags", "principals", "company"].includes(input.visibility)
    ) {
      throw badRequest(`Unknown visibility tier: ${input.visibility}`);
    }
    if (input.enforced && input.visibility !== "company") {
      throw badRequest(
        "enforced=true requires visibility='company' (admin-imposed runs apply to everyone)",
      );
    }
  }

  async function writeAudit(
    companyId: string,
    configId: string | null,
    actorPrincipalId: string,
    action: WorkflowHookConfigAuditAction,
    diff: Record<string, unknown>,
  ): Promise<void> {
    await db.insert(workflowHooksConfigAudit).values({
      companyId,
      configId,
      actorPrincipalId,
      action,
      diffJson: diff,
    });
  }

  async function createConfig(
    companyId: string,
    input: UpsertHookConfigInput,
    ctx: UpsertContext,
  ): Promise<HookConfigDto> {
    validateUpsert(input);
    if (input.enforced && !ctx.hasEnforcePermission) {
      throw forbidden("hooks:enforce permission required to set enforced=true");
    }

    // P0.2 — validate tag + principal company ownership BEFORE the tx so
    // the join table cannot be polluted with cross-tenant ids.
    await assertTagsBelongToCompany(companyId, input.tagIds ?? []);
    await assertPrincipalsBelongToCompany(companyId, input.principalIds ?? []);

    const created = await db.transaction(async (tx) => {
      // Uniqueness check (name, company) — DB constraint catches it too,
      // but a clear error message beats a generic 23505.
      const existing = await tx
        .select({ id: workflowHooksConfig.id })
        .from(workflowHooksConfig)
        .where(
          and(
            eq(workflowHooksConfig.companyId, companyId),
            eq(workflowHooksConfig.name, input.name),
          ),
        );
      if (existing.length > 0) {
        throw conflict(`Hook config with name '${input.name}' already exists`);
      }

      const [inserted] = await tx
        .insert(workflowHooksConfig)
        .values({
          companyId,
          name: input.name,
          hookRef: input.hookRef,
          defaultConfigJson: input.defaultConfigJson ?? {},
          visibility: input.visibility,
          createdByPrincipalId: ctx.actorPrincipalId,
          enabled: input.enabled ?? true,
          enforced: input.enforced ?? false,
          enforcedPhases: input.enforcedPhases ?? [],
        })
        .returning();
      const config = inserted!;

      if (input.tagIds && input.tagIds.length > 0) {
        await tx.insert(workflowHooksConfigTags).values(
          input.tagIds.map((tagId) => ({
            configId: config.id,
            tagId,
            companyId,
          })),
        );
      }
      if (input.principalIds && input.principalIds.length > 0) {
        await tx.insert(workflowHooksConfigPrincipals).values(
          input.principalIds.map((principalId) => ({
            configId: config.id,
            principalId,
            companyId,
          })),
        );
      }

      return config;
    });

    await writeAudit(companyId, created.id, ctx.actorPrincipalId, "created", {
      name: input.name,
      hookRef: input.hookRef,
      visibility: input.visibility,
      enforced: input.enforced ?? false,
    });

    invalidateEnforcedCache(companyId);
    publishLiveEvent({
      companyId,
      type: "hook.config.updated",
      payload: { id: created.id, action: "created" },
      visibility:
        input.visibility === "company"
          ? { scope: "company-wide" }
          : { scope: "actor-only", actorId: ctx.actorPrincipalId },
    });

    const dto = await rowToDto(created);
    return dto;
  }

  async function updateConfig(
    companyId: string,
    configId: string,
    input: Partial<UpsertHookConfigInput>,
    ctx: UpsertContext,
  ): Promise<HookConfigDto> {
    const [existing] = await db
      .select()
      .from(workflowHooksConfig)
      .where(
        and(
          eq(workflowHooksConfig.companyId, companyId),
          eq(workflowHooksConfig.id, configId),
        ),
      );
    if (!existing) throw notFound("Hook config not found");

    const enforcingNow =
      input.enforced === true && !existing.enforced;
    if (enforcingNow && !ctx.hasEnforcePermission) {
      throw forbidden("hooks:enforce permission required to flip enforced on");
    }
    if (input.enforced === true && (input.visibility ?? existing.visibility) !== "company") {
      throw badRequest(
        "enforced=true requires visibility='company' (admin-imposed runs apply to everyone)",
      );
    }

    // P0.2 — validate tag + principal company ownership BEFORE the tx.
    if (input.tagIds !== undefined) {
      await assertTagsBelongToCompany(companyId, input.tagIds);
    }
    if (input.principalIds !== undefined) {
      await assertPrincipalsBelongToCompany(companyId, input.principalIds);
    }

    const audits: Array<{
      action: WorkflowHookConfigAuditAction;
      diff: Record<string, unknown>;
    }> = [];

    await db.transaction(async (tx) => {
      const updates: Partial<WorkflowHookConfigRow> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.hookRef !== undefined) updates.hookRef = input.hookRef;
      if (input.defaultConfigJson !== undefined)
        updates.defaultConfigJson = input.defaultConfigJson;
      if (input.visibility !== undefined) updates.visibility = input.visibility;
      if (input.enabled !== undefined) {
        updates.enabled = input.enabled;
        audits.push({
          action: input.enabled ? "enabled_on" : "enabled_off",
          diff: { from: existing.enabled, to: input.enabled },
        });
      }
      if (input.enforced !== undefined) {
        updates.enforced = input.enforced;
        audits.push({
          action: input.enforced ? "enforced_on" : "enforced_off",
          diff: { from: existing.enforced, to: input.enforced },
        });
      }
      if (input.enforcedPhases !== undefined)
        updates.enforcedPhases = input.enforcedPhases;

      // Validate the merged result before applying
      const merged: UpsertHookConfigInput = {
        name: updates.name ?? existing.name,
        hookRef: updates.hookRef ?? existing.hookRef,
        visibility: (updates.visibility ?? existing.visibility) as Visibility,
        enabled: updates.enabled ?? existing.enabled,
        enforced: updates.enforced ?? existing.enforced,
        enforcedPhases: updates.enforcedPhases ?? existing.enforcedPhases,
      };
      validateUpsert(merged);

      await tx
        .update(workflowHooksConfig)
        .set(updates)
        .where(eq(workflowHooksConfig.id, configId));

      if (input.tagIds !== undefined) {
        await tx
          .delete(workflowHooksConfigTags)
          .where(eq(workflowHooksConfigTags.configId, configId));
        if (input.tagIds.length > 0) {
          await tx.insert(workflowHooksConfigTags).values(
            input.tagIds.map((tagId) => ({
              configId,
              tagId,
              companyId,
            })),
          );
        }
      }
      if (input.principalIds !== undefined) {
        await tx
          .delete(workflowHooksConfigPrincipals)
          .where(eq(workflowHooksConfigPrincipals.configId, configId));
        if (input.principalIds.length > 0) {
          await tx.insert(workflowHooksConfigPrincipals).values(
            input.principalIds.map((principalId) => ({
              configId,
              principalId,
              companyId,
            })),
          );
        }
      }
    });

    audits.push({
      action: "updated",
      diff: { fields: Object.keys(input) },
    });
    for (const a of audits) {
      await writeAudit(companyId, configId, ctx.actorPrincipalId, a.action, a.diff);
    }

    invalidateEnforcedCache(companyId);
    publishLiveEvent({
      companyId,
      type: "hook.config.updated",
      payload: { id: configId, action: "updated" },
      visibility:
        (input.visibility ?? existing.visibility) === "company"
          ? { scope: "company-wide" }
          : { scope: "actor-only", actorId: ctx.actorPrincipalId },
    });

    const [refreshed] = await db
      .select()
      .from(workflowHooksConfig)
      .where(eq(workflowHooksConfig.id, configId));
    return await rowToDto(refreshed!);
  }

  async function deleteConfig(
    companyId: string,
    configId: string,
    ctx: UpsertContext,
  ): Promise<boolean> {
    // P1.1 — capture visibility BEFORE the delete so we can broadcast the
    // SSE event on the correct scope. A private/tags/principals config
    // must not leak its existence to the whole company on deletion.
    const [existing] = await db
      .select({
        visibility: workflowHooksConfig.visibility,
      })
      .from(workflowHooksConfig)
      .where(
        and(
          eq(workflowHooksConfig.companyId, companyId),
          eq(workflowHooksConfig.id, configId),
        ),
      );
    if (!existing) return false;

    const result = await db
      .delete(workflowHooksConfig)
      .where(
        and(
          eq(workflowHooksConfig.companyId, companyId),
          eq(workflowHooksConfig.id, configId),
        ),
      )
      .returning({ id: workflowHooksConfig.id });
    if (result.length === 0) return false;

    await writeAudit(companyId, configId, ctx.actorPrincipalId, "deleted", {
      configId,
    });
    invalidateEnforcedCache(companyId);
    publishLiveEvent({
      companyId,
      type: "hook.config.deleted",
      payload: { id: configId },
      visibility:
        existing.visibility === "company"
          ? { scope: "company-wide" }
          : { scope: "actor-only", actorId: ctx.actorPrincipalId },
    });
    return true;
  }

  // ─── Resolution + execution ──────────────────────────────────────────────

  async function loadEnforcedConfigs(
    companyId: string,
  ): Promise<HookConfigDto[]> {
    const cached = enforcedCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) return cached.rows;

    // P1.2 — replace per-row rowToDto (1 + 2N queries) with 3 batched
    // queries: configs, then tags + principals scoped to the resulting ids.
    const rows = await db
      .select()
      .from(workflowHooksConfig)
      .where(
        and(
          eq(workflowHooksConfig.companyId, companyId),
          eq(workflowHooksConfig.enforced, true),
          eq(workflowHooksConfig.enabled, true),
        ),
      );
    if (rows.length === 0) {
      enforcedCache.set(companyId, {
        rows: [],
        expiresAt: Date.now() + ENFORCED_CACHE_TTL_MS,
      });
      return [];
    }

    const ids = rows.map((r) => r.id);
    const [tagRows, principalRows] = await Promise.all([
      db
        .select({
          configId: workflowHooksConfigTags.configId,
          tagId: workflowHooksConfigTags.tagId,
        })
        .from(workflowHooksConfigTags)
        .where(inArray(workflowHooksConfigTags.configId, ids)),
      db
        .select({
          configId: workflowHooksConfigPrincipals.configId,
          principalId: workflowHooksConfigPrincipals.principalId,
        })
        .from(workflowHooksConfigPrincipals)
        .where(inArray(workflowHooksConfigPrincipals.configId, ids)),
    ]);

    const tagsByConfig = new Map<string, string[]>();
    for (const t of tagRows) {
      const arr = tagsByConfig.get(t.configId);
      if (arr) arr.push(t.tagId);
      else tagsByConfig.set(t.configId, [t.tagId]);
    }
    const principalsByConfig = new Map<string, string[]>();
    for (const p of principalRows) {
      const arr = principalsByConfig.get(p.configId);
      if (arr) arr.push(p.principalId);
      else principalsByConfig.set(p.configId, [p.principalId]);
    }

    const dtos: HookConfigDto[] = rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      hookRef: row.hookRef,
      defaultConfigJson:
        (row.defaultConfigJson as Record<string, unknown>) ?? {},
      visibility: row.visibility as Visibility,
      createdByPrincipalId: row.createdByPrincipalId,
      enabled: row.enabled,
      enforced: row.enforced,
      enforcedPhases: row.enforcedPhases ?? [],
      tagIds: tagsByConfig.get(row.id) ?? [],
      principalIds: principalsByConfig.get(row.id) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    enforcedCache.set(companyId, {
      rows: dtos,
      expiresAt: Date.now() + ENFORCED_CACHE_TTL_MS,
    });
    return dtos;
  }

  /**
   * For `phase` and `step.hooks` declared in workflow.json, return all
   * hooks that should fire (in order). Includes:
   *   - workflow.json declared hooks for that phase (always run, even
   *     if not enforced — these are user-opt-in)
   *   - DB-stored enforced configs visible to the actor for that phase
   *     and not already covered by workflow.json (dedup by ref)
   *
   * Visibility check uses `canPrincipalAccess` so private configs only
   * fire for their creator, tag-scoped configs only for matching tags,
   * etc. Enforced + visibility=company short-circuit (always fires).
   */
  async function resolveHooksForStep(
    args: {
      stepHooks: HookBlock | undefined;
      runHooks: HookBlock | undefined;
      phase: WorkflowHookPhase;
      principalId: string;
      companyId: string;
    },
  ): Promise<ResolvedHookForStep[]> {
    const { stepHooks, runHooks, phase, principalId, companyId } = args;

    const declared: ResolvedHookForStep[] = [];
    const block = phase === "before_run" || phase === "after_run" ? runHooks : stepHooks;
    if (block) {
      const arr =
        phase === "before_run" || phase === "before_step"
          ? block.before
          : block.after;
      for (const entry of arr ?? []) {
        declared.push({
          configId: null,
          ref: entry.ref,
          config: (entry.config ?? {}) as Record<string, unknown>,
          enforced: false,
        });
      }
    }

    const enforced = await loadEnforcedConfigs(companyId);
    const enforcedFiltered: ResolvedHookForStep[] = [];
    for (const cfg of enforced) {
      if (
        cfg.enforcedPhases.length > 0 &&
        !cfg.enforcedPhases.includes(phase)
      ) {
        continue;
      }
      // canPrincipalAccess is a no-op for visibility=company (always allow)
      const allowed = await canPrincipalAccess(
        {
          id: cfg.id,
          visibility: cfg.visibility,
          createdByPrincipalId: cfg.createdByPrincipalId,
        },
        principalId,
        visibilityResolvers,
      );
      if (!allowed) continue;
      enforcedFiltered.push({
        configId: cfg.id,
        ref: cfg.hookRef,
        config: cfg.defaultConfigJson,
        enforced: true,
      });
    }

    // Dedup: workflow.json takes precedence over DB enforced for same ref
    // (the user explicitly opted in with potentially different config).
    const seen = new Set(declared.map((h) => h.ref));
    const merged = [...declared];
    for (const e of enforcedFiltered) {
      if (!seen.has(e.ref)) merged.push(e);
    }
    return merged;
  }

  /**
   * Resolve the source code for a given ref via `resolveHookRef` from
   * `@mnm/workflow-hooks`. Always uses canonical loader for
   * `canonical:` refs, otherwise delegates to the company's git
   * provider for `shared:` / `local:`.
   */
  async function resolveSource(
    ref: string,
    args: {
      companyId: string;
      actorUserId: string;
      workflowGitSha: string;
      sharedRepoBranch?: string;
    },
  ): Promise<ResolvedHook> {
    const gitProvider = await deps.resolveGitProvider({
      companyId: args.companyId,
      userId: args.actorUserId,
    });
    return resolveHookRef(ref, {
      companyId: args.companyId,
      gitProvider,
      workflowGitSha: args.workflowGitSha,
      sharedRepoBranch: args.sharedRepoBranch,
      loadCanonical,
    });
  }

  /**
   * Execute one hook end-to-end: outbox audit row pending → load source
   * → run → update audit row final. Tenant context is set/cleared
   * around the call so RLS narrows correctly even for `after_run` (which
   * fires outside any HTTP request cycle in the orchestrator).
   *
   * Kill-switch: when `MNM_HOOKS_DISABLED=true`, returns immediately
   * with ok:true and writes a no-op audit row tagged
   * `result_summary='kill-switch'`.
   */
  async function executeHook(
    resolved: ResolvedHookForStep,
    runtime: HookRuntimeCtx,
  ): Promise<HookEvaluationResult> {
    const auditId = randomUUID();

    // Kill-switch guard — write a stub audit row so users see why nothing fired
    if (isKillSwitchOn()) {
      await setTenantContext(db, runtime.companyId);
      try {
        await db.insert(workflowHookExecutions).values({
          id: auditId,
          companyId: runtime.companyId,
          configId: resolved.configId,
          hookRef: resolved.ref,
          stepExecutionId: runtime.stepExecutionId ?? null,
          runId: runtime.runId,
          phase: runtime.hookCtx.phase,
          status: "success",
          resultSummary: "kill-switch",
          actorUserId: runtime.actorUserId,
        });
      } finally {
        await clearTenantContext(db);
      }
      return {
        ok: true,
        hook_git_sha: "kill-switch",
        hook_source_path: resolved.ref,
        hook_name: resolved.ref,
        phase: runtime.hookCtx.phase,
        report: "Hook execution skipped (MNM_HOOKS_DISABLED=true)",
        evaluated_at: new Date().toISOString(),
        duration_ms: 0,
      };
    }

    // P0.3 — keep the tenant-context window as narrow as possible.
    // Setting / clearing the GUC opens a logical "session" against the
    // pool connection ; holding it across the long `runHook` call (up
    // to 35s) is a pool-leak / RLS-mismatch risk. We bracket each DB
    // op individually; runHook itself is plain JS and does not need it.

    // 1. Outbox INSERT — bracketed.
    await setTenantContext(db, runtime.companyId);
    try {
      await db.insert(workflowHookExecutions).values({
        id: auditId,
        companyId: runtime.companyId,
        configId: resolved.configId,
        hookRef: resolved.ref,
        stepExecutionId: runtime.stepExecutionId ?? null,
        runId: runtime.runId,
        phase: runtime.hookCtx.phase,
        status: "pending",
        actorUserId: runtime.actorUserId,
      });
    } finally {
      await clearTenantContext(db);
    }

    let resolvedHook: ResolvedHook | undefined;
    try {
      // 2. Resolve source (canonical / shared / local). Errors here
      //    surface as HOOK_EXCEPTION (compile / fetch failure).
      try {
        resolvedHook = await resolveSource(resolved.ref, {
          companyId: runtime.companyId,
          actorUserId: runtime.actorUserId,
          workflowGitSha: runtime.workflowGitSha,
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        await setTenantContext(db, runtime.companyId);
        try {
          await db
            .update(workflowHookExecutions)
            .set({
              status: "failed",
              errorCode: HOOK_ERROR_CODES.HOOK_EXCEPTION,
              durationMs: 0,
              resultSummary: `Source resolution failed: ${message}`,
            })
            .where(eq(workflowHookExecutions.id, auditId));
        } finally {
          await clearTenantContext(db);
        }
        return {
          ok: false,
          hook_git_sha: "unresolved",
          hook_source_path: resolved.ref,
          hook_name: resolved.ref,
          phase: runtime.hookCtx.phase,
          error_code: HOOK_ERROR_CODES.HOOK_EXCEPTION,
          report: `Source resolution failed: ${message}`,
          evaluated_at: new Date().toISOString(),
          duration_ms: 0,
        };
      }

      // 3. Build host helpers + merge config + run (no tenant context —
      //    plain JS, no DB ops here).
      const helpers = buildHostHelpersForRuntime(runtime, resolved);
      const ctx: HookContext = {
        ...runtime.hookCtx,
        config: { ...resolved.config, ...runtime.hookCtx.config },
        helpers,
      };
      const evaluation = await runHook(resolvedHook, ctx, helpers);

      // 4. Outbox UPDATE — bracketed.
      await setTenantContext(db, runtime.companyId);
      try {
        await db
          .update(workflowHookExecutions)
          .set({
            status: classifyExecStatus(evaluation),
            errorCode: evaluation.error_code ?? null,
            durationMs: evaluation.duration_ms,
            resultSummary:
              evaluation.result?.report?.slice(0, 500) ??
              evaluation.report.slice(0, 500),
            // V0 — http_calls_count and llm_tokens_in/out tracked in V1
            // via helper interceptors. Currently 0 on every row.
          })
          .where(eq(workflowHookExecutions.id, auditId));
      } finally {
        await clearTenantContext(db);
      }

      return evaluation;
    } catch (cause) {
      // 5. Catch-all — should never trigger since runHook returns a result
      //    rather than throwing, but keep the safety net. Audit row gets
      //    stamped failed before re-throw.
      const message = cause instanceof Error ? cause.message : String(cause);
      logger.error(
        { err: cause, runId: runtime.runId, ref: resolved.ref },
        "[workflow-hooks] unexpected error during executeHook",
      );
      await setTenantContext(db, runtime.companyId);
      try {
        await db
          .update(workflowHookExecutions)
          .set({
            status: "failed",
            errorCode: HOOK_ERROR_CODES.HOOK_EXCEPTION,
            durationMs: 0,
            resultSummary: `Unexpected: ${message}`,
          })
          .where(eq(workflowHookExecutions.id, auditId));
      } finally {
        await clearTenantContext(db);
      }
      throw cause;
    }
  }

  function buildHostHelpersForRuntime(
    runtime: HookRuntimeCtx,
    _resolved: ResolvedHookForStep,
  ): ReturnType<typeof buildHostHelpers> {
    return buildHostHelpers(
      {
        assertSafeUrl,
        connectors: {
          getActiveConnectorBySlug: async (
            companyId: string,
            providerSlug: string,
          ) => {
            const connector = await deps.connectors.getActiveConnectorBySlug(
              companyId,
              providerSlug,
            );
            if (!connector) return null;
            const catalog = deps.providerCatalog.providers[providerSlug];
            if (!catalog) return null;
            return {
              id: connector.id,
              type: connector.type,
              baseUrl: catalog.baseUrl,
              apiKeyHeader: catalog.apiKeyHeader ?? null,
            };
          },
          getUserToken: async (
            userId: string,
            providerSlug: string,
            companyId: string,
          ) => {
            return await deps.connectors.getUserToken(
              userId,
              providerSlug,
              companyId,
            );
          },
        },
        gitProvider: undefined as unknown as GitProvider, // fetchHandoff path uses caller's provider; not exposed in V0 helpers
        llm: deps.llm,
        // Inline a getter so unit tests can stub fetch
        fetchImpl: globalThis.fetch.bind(globalThis),
      },
      {
        companyId: runtime.companyId,
        actorUserId: runtime.actorUserId,
        runId: runtime.runId,
        workflowGitSha: runtime.workflowGitSha,
      },
    );
  }

  function classifyExecStatus(
    evaluation: HookEvaluationResult,
  ): WorkflowHookExecutionRow["status"] {
    if (evaluation.ok) return "success";
    if (evaluation.error_code === HOOK_ERROR_CODES.HOOK_TIMEOUT) {
      return "timeout";
    }
    return "failed";
  }

  // ─── Executions log ──────────────────────────────────────────────────────

  async function listExecutions(
    companyId: string,
    actorPrincipalId: string,
    filter: ListExecutionsFilter = {},
  ): Promise<WorkflowHookExecutionRow[]> {
    // P0.1 — visibility filter. An admin with `hooks:manage` but no
    // visibility on a private/tags/principals config must NOT see those
    // execution rows. Compute the visible config ids first, then narrow.
    const visibleConfigs = await listConfigs(companyId, actorPrincipalId);
    const visibleConfigIds = visibleConfigs.map((c) => c.id);

    if (filter.configId && !visibleConfigIds.includes(filter.configId)) {
      // Caller asked for a config they cannot see — return empty rather
      // than 403 to avoid leaking the existence of the config.
      return [];
    }

    const conditions = [eq(workflowHookExecutions.companyId, companyId)];
    if (filter.configId) {
      conditions.push(eq(workflowHookExecutions.configId, filter.configId));
    } else if (visibleConfigIds.length === 0) {
      return [];
    } else {
      conditions.push(
        inArray(workflowHookExecutions.configId, visibleConfigIds),
      );
    }
    if (filter.runId)
      conditions.push(eq(workflowHookExecutions.runId, filter.runId));
    if (filter.status)
      conditions.push(eq(workflowHookExecutions.status, filter.status));
    if (filter.phase)
      conditions.push(eq(workflowHookExecutions.phase, filter.phase));
    if (filter.since !== undefined) {
      const sinceDate =
        filter.since instanceof Date ? filter.since : new Date(filter.since);
      conditions.push(gte(workflowHookExecutions.createdAt, sinceDate));
    }
    if (filter.until !== undefined) {
      const untilDate =
        filter.until instanceof Date ? filter.until : new Date(filter.until);
      conditions.push(lte(workflowHookExecutions.createdAt, untilDate));
    }

    const limit = Math.min(500, Math.max(1, filter.limit ?? 100));
    const offset = Math.max(0, filter.offset ?? 0);

    return await db
      .select()
      .from(workflowHookExecutions)
      .where(and(...conditions))
      .orderBy(desc(workflowHookExecutions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // ─── Catalog ─────────────────────────────────────────────────────────────

  async function listCatalog(
    args: {
      companyId: string;
      actorUserId: string;
      workflowGitSha?: string;
      sharedRepoBranch?: string;
      includeShared?: boolean;
      includeLocal?: boolean;
    },
  ): Promise<HookCatalog> {
    // P1.3 — LRU 60s cache keyed by (companyId, sharedBranch, workflowSha,
    // includeShared, includeLocal). Two git fetchTree calls per UI open
    // is wasteful when nothing has changed. Invalidated alongside the
    // enforced cache on any config CRUD.
    const cacheKey = `${args.companyId}:${args.sharedRepoBranch ?? "main"}:${args.workflowGitSha ?? "_"}:${args.includeShared !== false ? "S" : "_"}:${args.includeLocal === true ? "L" : "_"}`;
    const cached = catalogCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.catalog;

    // P4-G: hydrate canonical entries with metadata (description, phase,
    // configSchema, defaultConfig, requiredScopes) so the picker UI can
    // render typed inputs + inline help without an extra round-trip.
    // `getCanonicalMetadata` is process-cached alongside the source +
    // sha so this stays cheap on repeated calls.
    const canonical: HookCatalogEntry[] = listCanonicalHooks().map((h) => {
      const meta = getCanonicalMetadata(h.name);
      const entry: HookCatalogEntry = {
        source: "canonical",
        name: h.name,
        ref: `canonical:${h.name}`,
        sha: h.sha,
      };
      if (meta) {
        if (meta.description !== undefined) entry.description = meta.description;
        if (meta.phase !== undefined) entry.phase = meta.phase;
        if (meta.requiredScopes !== undefined)
          entry.requiredScopes = meta.requiredScopes;
        if (meta.configSchema !== undefined)
          entry.configSchema = meta.configSchema;
        if (meta.defaultConfig !== undefined)
          entry.defaultConfig = meta.defaultConfig;
      }
      return entry;
    });
    const shared: HookCatalogEntry[] = [];
    const local: HookCatalogEntry[] = [];

    if (args.includeShared || args.includeLocal) {
      let gitProvider: GitProvider | undefined;
      try {
        gitProvider = await deps.resolveGitProvider({
          companyId: args.companyId,
          userId: args.actorUserId,
        });
      } catch (err) {
        logger.warn(
          { err, companyId: args.companyId },
          "[workflow-hooks] catalog: failed to resolve git provider",
        );
        const earlyResult = { canonical, shared, local };
        catalogCache.set(cacheKey, {
          catalog: earlyResult,
          expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
        });
        return earlyResult;
      }

      if (args.includeShared) {
        try {
          const tree = await gitProvider.fetchTree({
            ref: args.sharedRepoBranch ?? "main",
            subtree: "hooks",
            recursive: false,
          });
          for (const entry of tree) {
            if (entry.type !== "blob" || !entry.path.endsWith(".hook.ts"))
              continue;
            const name = entry.path
              .replace(/^hooks\//, "")
              .replace(/\.hook\.ts$/, "");
            // TODO(P4-G V1): fetch the file content + run the same
            // host-side `extractMetadata` flow used by the canonical
            // registry to surface description / phase / configSchema /
            // defaultConfig for shared hooks too. Keeps the wire format
            // identical between canonical and shared in the picker.
            shared.push({
              source: "shared",
              name,
              ref: `shared:${name}`,
              sha: entry.sha,
            });
          }
        } catch (err) {
          logger.warn(
            { err, companyId: args.companyId },
            "[workflow-hooks] catalog: shared hooks listing failed",
          );
        }
      }

      if (args.includeLocal && args.workflowGitSha) {
        try {
          const tree = await gitProvider.fetchTree({
            ref: args.workflowGitSha,
            subtree: "hooks",
            recursive: false,
          });
          for (const entry of tree) {
            if (entry.type !== "blob" || !entry.path.endsWith(".hook.ts"))
              continue;
            const name = entry.path
              .replace(/^hooks\//, "")
              .replace(/\.hook\.ts$/, "");
            // TODO(P4-G V1): same as shared — fetch content + extract
            // metadata so local hooks expose description / phase /
            // configSchema / defaultConfig in the picker.
            local.push({
              source: "local",
              name,
              ref: `local:${name}`,
              sha: entry.sha,
            });
          }
        } catch (err) {
          logger.warn(
            { err, companyId: args.companyId },
            "[workflow-hooks] catalog: local hooks listing failed",
          );
        }
      }
    }

    const result = { canonical, shared, local };
    catalogCache.set(cacheKey, {
      catalog: result,
      expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    });
    return result;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    listConfigs,
    getConfig,
    createConfig,
    updateConfig,
    deleteConfig,
    resolveHooksForStep,
    executeHook,
    listExecutions,
    listCatalog,
    invalidateEnforcedCache,
    // Test seam
    _internals: {
      isKillSwitchOn,
    },
  };
}

// `__assertSafeUrl` is an optional escape-hatch on HookProviderCatalog
// (declared inline at the type definition above). Tests use it to
// inject a stub for SSRF validation. Production callers should leave
// it undefined.
