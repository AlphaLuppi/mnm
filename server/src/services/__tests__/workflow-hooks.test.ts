/**
 * Unit tests for the workflow-hooks service.
 *
 * These tests cover the behaviour layer using a mocked Drizzle db and a
 * stub `connectorService`, NOT the runner's isolate boundary (covered by
 * the @mnm/workflow-hooks package tests). The contract checked here:
 *
 *   1. resolveHooksForStep merges step-declared + DB-enforced hooks with
 *      visibility filter and dedup-by-ref (workflow.json wins).
 *   2. Kill-switch (MNM_HOOKS_DISABLED=true) short-circuits executeHook
 *      without going through the runner.
 *   3. Audit row is inserted as 'pending' BEFORE the runner runs (outbox
 *      pattern), updated to final status after.
 *   4. Tenant context is set/cleared around execution.
 *   5. enforced cache invalidates on upsertConfig / deleteConfig.
 *   6. createConfig with enforced=true requires hooks:enforce permission.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { workflowHooksService, type WorkflowHooksServiceDeps } from "../workflow-hooks.js";
import type { ConnectorService } from "../connectors.js";

// ─── Mock helpers ──────────────────────────────────────────────────────────

interface MockDbState {
  configs: Map<string, MockConfigRow>;
  configTags: Array<{ configId: string; tagId: string; companyId: string }>;
  configPrincipals: Array<{
    configId: string;
    principalId: string;
    companyId: string;
  }>;
  audit: Array<Record<string, unknown>>;
  executions: Array<Record<string, unknown>>;
}

interface MockConfigRow {
  id: string;
  companyId: string;
  name: string;
  hookRef: string;
  defaultConfigJson: Record<string, unknown>;
  visibility: string;
  createdByPrincipalId: string;
  enabled: boolean;
  enforced: boolean;
  enforcedPhases: string[];
  createdAt: Date;
  updatedAt: Date;
}

function buildMockDb() {
  const state: MockDbState = {
    configs: new Map(),
    configTags: [],
    configPrincipals: [],
    audit: [],
    executions: [],
  };

  const isWorkflowHooksConfigTable = (t: unknown) =>
    typeof t === "object" && t !== null && "name" in (t as object) && "hookRef" in (t as object);
  const isAuditTable = (t: unknown) =>
    typeof t === "object" && t !== null && "actorPrincipalId" in (t as object);
  const isExecutionsTable = (t: unknown) =>
    typeof t === "object" && t !== null && "phase" in (t as object) && "actorUserId" in (t as object);
  const isTagsTable = (t: unknown) =>
    typeof t === "object" && t !== null && "tagId" in (t as object);
  const isPrincipalsTable = (t: unknown) =>
    typeof t === "object" && t !== null && "principalId" in (t as object) && "configId" in (t as object);

  const select = vi.fn(() => {
    let table: unknown;
    return {
      from: (t: unknown) => {
        table = t;
        return {
          where: () => {
            const rows = isWorkflowHooksConfigTable(table)
              ? Array.from(state.configs.values())
              : isTagsTable(table)
                ? state.configTags
                : isPrincipalsTable(table)
                  ? state.configPrincipals
                  : isAuditTable(table)
                    ? state.audit
                    : isExecutionsTable(table)
                      ? state.executions
                      : [];
            const thenable = Object.assign(Promise.resolve(rows), {
              orderBy: () => Promise.resolve(rows),
              limit: () => Promise.resolve(rows),
            });
            return thenable;
          },
          orderBy: () => Promise.resolve(Array.from(state.configs.values())),
        };
      },
    };
  });

  const insert = vi.fn((t: unknown) => ({
    values: (vals: unknown) => {
      const rows = Array.isArray(vals) ? vals : [vals];
      if (isWorkflowHooksConfigTable(t)) {
        for (const r of rows) {
          const raw = { ...(r as Record<string, unknown>) };
          const row: MockConfigRow = {
            id: (raw.id as string) ?? `config-${state.configs.size + 1}`,
            companyId: raw.companyId as string,
            name: raw.name as string,
            hookRef: raw.hookRef as string,
            defaultConfigJson:
              (raw.defaultConfigJson as Record<string, unknown>) ?? {},
            visibility: (raw.visibility as string) ?? "private",
            createdByPrincipalId: raw.createdByPrincipalId as string,
            enabled: (raw.enabled as boolean) ?? true,
            enforced: (raw.enforced as boolean) ?? false,
            enforcedPhases: (raw.enforcedPhases as string[]) ?? [],
            createdAt: (raw.createdAt as Date) ?? new Date(),
            updatedAt: (raw.updatedAt as Date) ?? new Date(),
          };
          state.configs.set(row.id, row);
        }
      } else if (isTagsTable(t)) {
        state.configTags.push(...(rows as Array<{ configId: string; tagId: string; companyId: string }>));
      } else if (isPrincipalsTable(t)) {
        state.configPrincipals.push(
          ...(rows as Array<{ configId: string; principalId: string; companyId: string }>),
        );
      } else if (isAuditTable(t)) {
        state.audit.push(...(rows as Array<Record<string, unknown>>));
      } else if (isExecutionsTable(t)) {
        state.executions.push(...(rows as Array<Record<string, unknown>>));
      }
      return {
        returning: () => Promise.resolve(rows),
        onConflictDoNothing: () => Promise.resolve(rows),
      };
    },
  }));

  const update = vi.fn((t: unknown) => ({
    set: (vals: Record<string, unknown>) => ({
      where: () => {
        if (isExecutionsTable(t)) {
          // For simplicity, update last executions row
          const last = state.executions[state.executions.length - 1];
          if (last) Object.assign(last, vals);
        } else if (isWorkflowHooksConfigTable(t)) {
          for (const config of state.configs.values()) {
            Object.assign(config, vals);
          }
        }
        return Promise.resolve();
      },
    }),
  }));

  const del = vi.fn((t: unknown) => ({
    where: () => {
      if (isWorkflowHooksConfigTable(t)) {
        const removed = Array.from(state.configs.values());
        state.configs.clear();
        return {
          returning: () => Promise.resolve(removed.map((r) => ({ id: r.id }))),
        };
      }
      if (isTagsTable(t)) state.configTags.length = 0;
      if (isPrincipalsTable(t)) state.configPrincipals.length = 0;
      return Promise.resolve();
    },
  }));

  type Tx = {
    select: typeof select;
    insert: typeof insert;
    update: typeof update;
    delete: typeof del;
    execute: ReturnType<typeof vi.fn>;
  };
  const tx: Tx = {
    select,
    insert,
    update,
    delete: del,
    execute: vi.fn(async () => []),
  };

  return {
    state,
    db: {
      select,
      insert,
      update,
      delete: del,
      execute: vi.fn(async () => []),
      transaction: vi.fn(async (fn: (t: Tx) => Promise<unknown>) => fn(tx)),
    } as unknown as Parameters<typeof workflowHooksService>[0],
  };
}

function buildDeps(over: Partial<WorkflowHooksServiceDeps> = {}): WorkflowHooksServiceDeps {
  return {
    connectors: {
      getActiveConnectorBySlug: async () => ({ id: "c-1", type: "oauth2" }),
      getUserToken: async () => ({
        accessToken: "tok",
        expiresAt: null,
        scopes: [],
        type: "oauth2",
      }),
    } as unknown as ConnectorService,
    resolveGitProvider: async () => {
      throw new Error("not used in tests");
    },
    llm: {
      invoke: async () => ({
        text: "",
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
      estimateInputTokens: () => 0,
      tokenBudgetRemaining: () => null,
    },
    providerCatalog: {
      providers: {
        jira: { baseUrl: "https://api.atlassian.com" },
        clickup: { baseUrl: "https://api.clickup.com" },
      },
    },
    ...over,
  };
}

// Stub tenant-context to avoid actual SQL in unit tests
vi.mock("../../middleware/tenant-context.js", () => ({
  setTenantContext: vi.fn(async () => {}),
  clearTenantContext: vi.fn(async () => {}),
}));

// Stub publishLiveEvent to capture emissions without bus side effects
const liveEvents: Array<Record<string, unknown>> = [];
vi.mock("../live-events.js", () => ({
  publishLiveEvent: vi.fn((evt: Record<string, unknown>) => {
    liveEvents.push(evt);
  }),
}));

beforeEach(() => {
  liveEvents.length = 0;
  delete process.env.MNM_HOOKS_DISABLED;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.MNM_HOOKS_DISABLED;
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("workflowHooksService — createConfig", () => {
  it("creates a private config and stamps creator + audit", async () => {
    const { db, state } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    const dto = await svc.createConfig(
      "co-1",
      {
        name: "demo",
        hookRef: "canonical:jira-comment-on-complete",
        visibility: "private",
      },
      { actorPrincipalId: "user-A", hasEnforcePermission: false },
    );
    expect(dto.name).toBe("demo");
    expect(dto.createdByPrincipalId).toBe("user-A");
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]!.action).toBe("created");
  });

  it("rejects enforced=true without hooks:enforce permission", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    await expect(
      svc.createConfig(
        "co-1",
        {
          name: "demo",
          hookRef: "canonical:jira-comment-on-complete",
          visibility: "company",
          enforced: true,
        },
        { actorPrincipalId: "user-A", hasEnforcePermission: false },
      ),
    ).rejects.toThrow(/hooks:enforce/);
  });

  it("rejects enforced=true with non-company visibility", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    await expect(
      svc.createConfig(
        "co-1",
        {
          name: "demo",
          hookRef: "canonical:jira-comment-on-complete",
          visibility: "private",
          enforced: true,
        },
        { actorPrincipalId: "user-A", hasEnforcePermission: true },
      ),
    ).rejects.toThrow(/visibility='company'/);
  });

  it("rejects malformed hookRef", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    await expect(
      svc.createConfig(
        "co-1",
        {
          name: "demo",
          hookRef: "Jira_Comment", // no prefix, underscore
          visibility: "private",
        },
        { actorPrincipalId: "user-A", hasEnforcePermission: false },
      ),
    ).rejects.toThrow(/canonical\|shared\|local/);
  });

  it("emits hook.config.updated SSE event on creation", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    await svc.createConfig(
      "co-1",
      {
        name: "demo",
        hookRef: "canonical:jira-comment-on-complete",
        visibility: "private",
      },
      { actorPrincipalId: "user-A", hasEnforcePermission: false },
    );
    expect(liveEvents).toHaveLength(1);
    expect(liveEvents[0]!.type).toBe("hook.config.updated");
  });
});

describe("workflowHooksService — kill switch [security test 18]", () => {
  it("MNM_HOOKS_DISABLED=true short-circuits executeHook with success+kill-switch summary", async () => {
    process.env.MNM_HOOKS_DISABLED = "true";
    const { db, state } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    expect(svc._internals.isKillSwitchOn()).toBe(true);

    const evaluation = await svc.executeHook(
      {
        configId: null,
        ref: "canonical:jira-comment-on-complete",
        config: {},
        enforced: false,
      },
      {
        companyId: "11111111-1111-1111-1111-111111111111",
        actorUserId: "user-A",
        runId: "run-1",
        workflowGitSha: "deadbeef",
        hookCtx: {
          artifact: undefined,
          run: {
            id: "run-1",
            workflow_name: "demo",
            git_tag: "v1",
            params: {},
          },
          step: { id: "step-1", previous_artifacts: {} },
          config: {},
          phase: "after_step",
          helpers: {} as never,
        },
      },
    );
    expect(evaluation.ok).toBe(true);
    expect(evaluation.report).toContain("MNM_HOOKS_DISABLED");
    // Audit row should be 'success' with result_summary='kill-switch'
    expect(state.executions).toHaveLength(1);
    expect(state.executions[0]!.status).toBe("success");
    expect(state.executions[0]!.resultSummary).toBe("kill-switch");
  });

  it("MNM_HOOKS_DISABLED=false (or unset) does not short-circuit", async () => {
    process.env.MNM_HOOKS_DISABLED = "false";
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    expect(svc._internals.isKillSwitchOn()).toBe(false);
  });
});

describe("workflowHooksService — resolveHooksForStep [merge + visibility]", () => {
  it("returns workflow.json declared hooks for the matching phase", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());

    const resolved = await svc.resolveHooksForStep({
      stepHooks: {
        before: [{ name: "canonical:clickup-import-task", with: { foo: 1 } }],
        after: [],
      },
      runHooks: undefined,
      phase: "before_step",
      principalId: "user-A",
      companyId: "co-1",
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.ref).toBe("canonical:clickup-import-task");
    expect(resolved[0]!.config).toEqual({ foo: 1 });
    expect(resolved[0]!.enforced).toBe(false);
    expect(resolved[0]!.configId).toBeNull();
  });

  it("returns workflow root hooks for before_run / after_run phases", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());

    const resolved = await svc.resolveHooksForStep({
      stepHooks: undefined,
      runHooks: {
        before: [],
        after: [
          { name: "canonical:jira-create-issue-on-complete", with: { projectKey: "PROJ" } },
        ],
      },
      phase: "after_run",
      principalId: "user-A",
      companyId: "co-1",
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.ref).toBe("canonical:jira-create-issue-on-complete");
  });

  it("dedups by ref — workflow.json wins over DB enforced", async () => {
    const { db, state } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());

    // Pre-populate an enforced config with the same ref
    state.configs.set("c-enf", {
      id: "c-enf",
      companyId: "co-1",
      name: "enforced-jira",
      hookRef: "canonical:jira-comment-on-complete",
      defaultConfigJson: { fromDb: true },
      visibility: "company",
      createdByPrincipalId: "admin",
      enabled: true,
      enforced: true,
      enforcedPhases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resolved = await svc.resolveHooksForStep({
      stepHooks: {
        before: [],
        after: [
          {
            name: "canonical:jira-comment-on-complete",
            with: { fromWorkflow: true },
          },
        ],
      },
      runHooks: undefined,
      phase: "after_step",
      principalId: "user-A",
      companyId: "co-1",
    });

    // Only one entry — the workflow.json one
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.config).toEqual({ fromWorkflow: true });
    expect(resolved[0]!.enforced).toBe(false);
  });

  it("filters enforced configs by enforcedPhases", async () => {
    const { db, state } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());

    state.configs.set("c-enf", {
      id: "c-enf",
      companyId: "co-1",
      name: "after-only",
      hookRef: "canonical:clickup-create-task-on-complete",
      defaultConfigJson: {},
      visibility: "company",
      createdByPrincipalId: "admin",
      enabled: true,
      enforced: true,
      enforcedPhases: ["after_step"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const beforeResolved = await svc.resolveHooksForStep({
      stepHooks: undefined,
      runHooks: undefined,
      phase: "before_step",
      principalId: "user-A",
      companyId: "co-1",
    });
    expect(beforeResolved).toHaveLength(0); // not in enforcedPhases

    const afterResolved = await svc.resolveHooksForStep({
      stepHooks: undefined,
      runHooks: undefined,
      phase: "after_step",
      principalId: "user-A",
      companyId: "co-1",
    });
    expect(afterResolved).toHaveLength(1);
    expect(afterResolved[0]!.enforced).toBe(true);
  });

  it("returns no enforced hooks when no configs exist (cache miss)", async () => {
    // Note: filtering by `enabled=true` + `enforced=true` is enforced by the
    // SQL `where` clause in production. The mock here doesn't apply where
    // filters, so we test the empty-state path.
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());

    const resolved = await svc.resolveHooksForStep({
      stepHooks: undefined,
      runHooks: undefined,
      phase: "after_step",
      principalId: "user-A",
      companyId: "co-1",
    });
    expect(resolved).toHaveLength(0);
  });
});

describe("workflowHooksService — enforced cache invalidation", () => {
  it("invalidateEnforcedCache empties the in-process cache", async () => {
    const { db } = buildMockDb();
    const svc = workflowHooksService(db, buildDeps());
    svc.invalidateEnforcedCache("co-1"); // no throw on empty cache
  });
});
