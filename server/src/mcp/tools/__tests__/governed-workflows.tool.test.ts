import { describe, it, expect, vi } from "vitest";
import governedWorkflowTools from "../governed-workflows.tool.js";
import { collectTools } from "../../registry/define-mcp-tools.js";
import { GovernedWorkflowError } from "../../../services/governed-workflows.js";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { PERMISSIONS } from "@mnm/shared";
import type { McpActor } from "../../registry/types.js";

function mkActor(overrides: Partial<McpActor> = {}): McpActor {
  return {
    type: "user",
    userId: "u-1",
    companyId: "00000000-0000-0000-0000-000000000a01",
    effectivePermissions: new Set([PERMISSIONS.WORKFLOWS_READ, PERMISSIONS.WORKFLOWS_ENFORCE]),
    effectiveTags: [],
    mcpSessionId: "sess-1",
    ...overrides,
  };
}

function mkServices(governedWorkflows: Record<string, any>, extra: Record<string, any> = {}) {
  return {
    db: { execute: vi.fn() },
    resolveGitProvider: vi.fn(),
    governedWorkflows,
    ...extra,
  };
}

describe("governed-workflows.tool", () => {
  it("list_governed_workflows returns the mapped rows", async () => {
    const services = mkServices({
      listDefinitions: vi.fn(async () => [
        { name: "hello-world", description: "demo", latestGitTag: "v1", enabled: true },
      ]),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const list = tools.find((t) => t.name === "list_governed_workflows")!;
    const r = await list.handler({ input: {}, actor: mkActor() });
    const body = JSON.parse(r.content[0]!.text);
    expect(body).toEqual([
      { name: "hello-world", description: "demo", latest_git_tag: "v1", enabled: true },
    ]);
  });

  it("launch_governed_workflow maps GovernedWorkflowError to uniform contract", async () => {
    const services = mkServices({
      launchWorkflow: vi.fn(async () => {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
          "Unknown",
          ["hint-1"],
        );
      }),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const launch = tools.find((t) => t.name === "launch_governed_workflow")!;
    const r = await launch.handler({
      input: { name: "absent", params: {} },
      actor: mkActor(),
    });
    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.code).toBe("WORKFLOW_NOT_FOUND");
    expect(body.hints).toEqual(["hint-1"]);
  });

  it("get_governed_workflow returns workflow + git_tag + git_sha", async () => {
    const fakeWorkflow = { apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "hello-world" };
    const services = mkServices({
      getWorkflowParsed: vi.fn(async () => ({
        workflow: fakeWorkflow,
        gitTag: "v1.0.0",
        gitSha: "deadbeef",
        workflowRepoPath: "hello-world/workflow.json",
      })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const get = tools.find((t) => t.name === "get_governed_workflow")!;
    const r = await get.handler({ input: { name: "hello-world" }, actor: mkActor() });
    const body = JSON.parse(r.content[0]!.text);
    expect(body.git_tag).toBe("v1.0.0");
    expect(body.git_sha).toBe("deadbeef");
    expect(body.workflow.name).toBe("hello-world");
  });

  it("get_governed_workflow_run maps GovernedWorkflowError to uniform contract", async () => {
    const services = mkServices({
      getRun: vi.fn(async () => {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_RUN_NOT_FOUND,
          "Run not found",
          [],
        );
      }),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const getRun = tools.find((t) => t.name === "get_governed_workflow_run")!;
    const r = await getRun.handler({
      input: { run_id: "00000000-0000-0000-0000-000000000001" },
      actor: mkActor(),
    });
    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.code).toBe("WORKFLOW_RUN_NOT_FOUND");
  });

  it("launch_governed_step returns agent_name + prompt_context + subagent_type", async () => {
    const services = mkServices({
      launchStep: vi.fn(async () => ({
        agentName: "greeter",
        promptContext: { greeting: "Hello" },
        subagentType: "claude_local",
      })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const r = await launchStep.handler({
      input: { run_id: "00000000-0000-0000-0000-000000000001", step_id: "greet" },
      actor: mkActor(),
    });
    const body = JSON.parse(r.content[0]!.text);
    expect(body.agent_name).toBe("greeter");
    expect(body.subagent_type).toBe("claude_local");
  });

  it("complete_governed_step maps GovernedWorkflowError for gate failure", async () => {
    const services = mkServices({
      completeStep: vi.fn(async () => {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.WORKFLOW_GATE_FAILED,
          "Gate rejected artifact",
          ["artifact.greeting must be non-empty"],
        );
      }),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const complete = tools.find((t) => t.name === "complete_governed_step")!;
    const r = await complete.handler({
      input: { run_id: "00000000-0000-0000-0000-000000000001", step_id: "greet", artifact: {} },
      actor: mkActor(),
    });
    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.code).toBe("WORKFLOW_GATE_FAILED");
  });

  it("list_governed_workflow_runs returns mapped items + total", async () => {
    const services = mkServices({
      listRuns: vi.fn(async () => ({
        items: [
          {
            id: "00000000-0000-0000-0000-0000000000aa",
            status: "active",
            startedAt: new Date("2026-04-27T01:40:00Z"),
            completedAt: null,
            gitTag: "feature-dev/v1.0.3",
            gitSha: "045419d",
            initiatedByActorType: "user",
            initiatedByActorId: "u-1",
          },
          {
            id: "00000000-0000-0000-0000-0000000000bb",
            status: "completed",
            startedAt: new Date("2026-04-26T10:00:00Z"),
            completedAt: new Date("2026-04-26T10:30:00Z"),
            gitTag: "feature-dev/v1.0.2",
            gitSha: "deadbeef",
            initiatedByActorType: "user",
            initiatedByActorId: "u-1",
          },
        ],
        total: 2,
      })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const list = tools.find((t) => t.name === "list_governed_workflow_runs")!;
    expect(list, "list_governed_workflow_runs tool must be registered").toBeDefined();

    const r = await list.handler({
      input: { name: "feature-dev", status: "active" },
      actor: mkActor(),
    });
    const body = JSON.parse(r.content[0]!.text);
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({
      run_id: "00000000-0000-0000-0000-0000000000aa",
      status: "active",
      started_at: "2026-04-27T01:40:00.000Z",
      completed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      cancelled_by_actor_id: null,
      cancelled_by_actor_type: null,
      git_tag: "feature-dev/v1.0.3",
      git_sha: "045419d",
      initiated_by_actor_type: "user",
      initiated_by_actor_id: "u-1",
    });
    expect(services.governedWorkflows.listRuns).toHaveBeenCalledWith({
      companyId: "00000000-0000-0000-0000-000000000a01",
      workflowName: "feature-dev",
      status: "active",
      limit: 20,
      offset: 0,
    });
  });

  it("list_governed_workflow_runs defaults limit/offset and omits filters when absent", async () => {
    const services = mkServices({
      listRuns: vi.fn(async () => ({ items: [], total: 0 })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const list = tools.find((t) => t.name === "list_governed_workflow_runs")!;
    await list.handler({ input: { name: "feature-dev" }, actor: mkActor() });
    expect(services.governedWorkflows.listRuns).toHaveBeenCalledWith({
      companyId: "00000000-0000-0000-0000-000000000a01",
      workflowName: "feature-dev",
      status: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("sync_governed_environment returns agents + new_sha + has_changes", async () => {
    const services = mkServices({
      syncEnvironment: vi.fn(async () => ({
        agents: [{ name: "greeter", mdContent: "# Greeter", configMerged: { mcp: [], hook: [], setting: [], credential: [] } }],
        newSha: "abc123",
        hasChanges: true,
      })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const sync = tools.find((t) => t.name === "sync_governed_environment")!;
    const r = await sync.handler({ input: {}, actor: mkActor() });
    const body = JSON.parse(r.content[0]!.text);
    expect(body.has_changes).toBe(true);
    expect(body.new_sha).toBe("abc123");
    expect(body.agents).toHaveLength(1);
  });
});

describe("push_local_state tool", () => {
  it("returns the cache payload + relative path with only lastPluginVersion", async () => {
    const pushSpy = vi.fn(async () => ({
      targetRelativePath: "last-session.json",
      content: { lastPluginVersion: "0.1.0" },
    }));
    const services = mkServices({ pushLocalState: pushSpy });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const push = tools.find((t) => t.name === "push_local_state")!;
    const r = await push.handler({
      input: { plugin_version: "0.1.0" },
      actor: mkActor(),
    });
    const parsed = JSON.parse(r.content[0]!.text);
    expect(parsed.target_relative_path).toBe("last-session.json");
    expect(parsed.content).toEqual({ lastPluginVersion: "0.1.0" });
    expect(pushSpy).toHaveBeenCalledWith({
      companyId: "00000000-0000-0000-0000-000000000a01",
      pluginVersion: "0.1.0",
    });
  });
});

// ── P1 — AGENT_NOT_REGISTERED surfaces in MCP envelope ─────────────────────
// Behavior: when launchStep throws GovernedWorkflowError(AGENT_NOT_REGISTERED),
// wrap() surfaces it as `error_code: "AGENT_NOT_REGISTERED"` in the MCP envelope
// (NOT as INTERNAL_ERROR or a re-thrown error). err.data is spread into the payload.
describe("launch_governed_step — AGENT_NOT_REGISTERED MCP envelope (P1)", () => {
  it("AGENT_NOT_REGISTERED from the service surfaces in the MCP envelope as error_code", async () => {
    const services = mkServices({
      launchStep: vi.fn(async () => {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.AGENT_NOT_REGISTERED,
          "Agent 'ghost' is not registered.",
          ["Run create_agent with name='ghost'"],
          { sub_cause: "AGENT_ROW_MISSING" },
        );
      }),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const r = await launchStep.handler({
      input: { run_id: "00000000-0000-0000-0000-000000000001", step_id: "greet" },
      actor: mkActor(),
    });
    expect(r.isError).toBe(true);
    const envelope = JSON.parse(r.content[0]!.text);
    expect(envelope.error_code).toBe("AGENT_NOT_REGISTERED");
    expect(envelope.sub_cause).toBe("AGENT_ROW_MISSING");
  });
});

describe("launch_governed_step tool (T6 enriched)", () => {
  it("bubbles AGENTS_STALE with stale_agents[] in the error payload", async () => {
    const staleAgents = [
      { name: "mnm--greeter", sha: "fresh-sha", content: "# mnm--greeter\n\nHello." },
    ];
    const services = mkServices({
      launchStep: vi.fn(async () => {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.AGENTS_STALE,
          "Local agents are stale",
          [
            "Write the returned content to ~/.claude/agents/mnm--greeter.md",
            "Run /reload-plugins in Claude Code so the new agent becomes dispatchable",
            "Re-call launchStep with the updated sha",
          ],
          { stale_agents: staleAgents },
        );
      }),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const launchStep = tools.find((t) => t.name === "launch_governed_step")!;
    const r = await launchStep.handler({
      input: {
        run_id: "00000000-0000-0000-0000-000000000001",
        step_id: "greet",
        current_agents: { "mnm--greeter": "bogus-sha" },
        session_tools: ["Task", "Write", "Read"],
      },
      actor: mkActor(),
    });
    expect(r.isError).toBe(true);
    const payload = JSON.parse(r.content[0]!.text);
    expect(payload.error_code).toBe("AGENTS_STALE");
    expect(Array.isArray(payload.stale_agents)).toBe(true);
    expect(payload.stale_agents[0]).toMatchObject({
      name: "mnm--greeter",
      sha: expect.any(String),
      content: expect.any(String),
    });
    expect(payload.hints).toEqual([
      expect.stringContaining("Write the returned content"),
      expect.stringContaining("/reload-plugins"),
      expect.stringContaining("Re-call launchStep"),
    ]);
    // Verify the tool passed through current_agents + session_tools to the service
    expect(services.governedWorkflows.launchStep).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAgents: { "mnm--greeter": "bogus-sha" },
        sessionTools: ["Task", "Write", "Read"],
      }),
    );
  });
});

describe("setup_workspace tool", () => {
  it("returns the agents payload and harness instructions", async () => {
    const services = mkServices({
      setupWorkspace: vi.fn(async () => ({
        agents: [
          {
            name: "mnm--greeter",
            content: "# mnm--greeter\n\nHello world agent.",
            sha: "sha-1",
            targetPath: "~/.claude/agents/mnm--greeter.md",
          },
        ],
        instructions:
          "Write each agent.content to its targetPath, then call push_local_state.",
      })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const setup = tools.find((t) => t.name === "setup_workspace")!;
    const r = await setup.handler({ input: {}, actor: mkActor() });
    const parsed = JSON.parse(r.content[0]!.text);
    expect(parsed.agents.length).toBeGreaterThan(0);
    expect(parsed.agents[0].name).toMatch(/^mnm--/);
    expect(parsed.instructions).toContain("Write");
  });

  it("propagates actor.userId to the service so per-user GitLab OAuth tokens are used", async () => {
    const setupSpy = vi.fn(async () => ({ agents: [], instructions: "Write" }));
    const services = mkServices({ setupWorkspace: setupSpy });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const setup = tools.find((t) => t.name === "setup_workspace")!;
    await setup.handler({ input: {}, actor: mkActor({ userId: "u-42" }) });
    expect(setupSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-42" }));
  });
});

// ── U6.1 — createGovernedWorkflow ──────────────────────────────────────────

describe("createGovernedWorkflow tool (U6.1)", () => {
  const COMPANY_ID = "00000000-0000-0000-0000-000000000a01";

  function mkActor6(overrides: Partial<McpActor> = {}): McpActor {
    return mkActor({
      effectivePermissions: new Set([
        PERMISSIONS.WORKFLOWS_READ,
        PERMISSIONS.WORKFLOWS_ENFORCE,
        PERMISSIONS.WORKFLOWS_CREATE,
      ]),
      ...overrides,
    });
  }

  /** Minimal valid workflow definition (steps.min(1) enforced by schema). */
  const validDefinition = {
    apiVersion: "mnm/v1" as const,
    kind: "GovernedWorkflow" as const,
    name: "hello-world",
    description: "Test workflow",
    steps: [{ id: "step-1", agent: "greeter", deps: [], prompt_context: {} }],
  };

  it("success: commits + tags + DB row, returns { commitSha, newGitTag }", async () => {
    const fakeGitProvider = {
      listTags: vi.fn(async () => []),
      commitFile: vi.fn(async () => ({ sha: "abc123" })),
      createTag: vi.fn(async () => {}),
    };
    const services = mkServices(
      { getDefinition: vi.fn(async () => null) },
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );
    // Patch DB select (existing check in saveDefinition) and insert (new row).
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => []) })),
    }));
    (services.db as any).insert = vi.fn(() => ({
      values: vi.fn(async () => {}),
    }));

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const create = tools.find((t) => t.name === "create_governed_workflow")!;
    expect(create, "create_governed_workflow tool must be registered").toBeDefined();

    const r = await create.handler({
      input: { definition: validDefinition, commit_message: "feat: hello world", branch: "main" },
      actor: mkActor6(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.commit_sha).toMatch(/.+/);
    expect(body.new_git_tag).toMatch(/hello-world\/v\d+\.\d+\.\d+/);
  });

  it("WORKFLOW_VALIDATION: invalid definition body returns error", async () => {
    const services = mkServices({ getDefinition: vi.fn(async () => null) });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const create = tools.find((t) => t.name === "create_governed_workflow")!;
    expect(create).toBeDefined();

    // Pass a definition that fails workflowDefinitionSchema (missing required fields).
    const r = await create.handler({
      input: { definition: { name: "" }, commit_message: "feat: bad", branch: "main" },
      actor: mkActor6(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe("WORKFLOW_VALIDATION");
  });

  it("GIT_PROVIDER_MISCONFIG: resolveGitProvider throws, surfaces error", async () => {
    const services = mkServices(
      { getDefinition: vi.fn(async () => null) },
      {
        resolveGitProvider: vi.fn(async () => {
          throw new GovernedWorkflowError(
            WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
            "Missing gitlab fields",
            ["Set token on the git_provider config layer item."],
          );
        }),
      },
    );
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => []) })),
    }));
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const create = tools.find((t) => t.name === "create_governed_workflow")!;
    expect(create).toBeDefined();

    const r = await create.handler({
      input: { definition: validDefinition, commit_message: "feat: hello world", branch: "main" },
      actor: mkActor6(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe("GIT_PROVIDER_MISCONFIG");
  });
});

// ── registerGovernedWorkflow (option C: import from existing tag) ──────────

describe("registerGovernedWorkflow tool (option C)", () => {
  function mkActorReg(overrides: Partial<McpActor> = {}): McpActor {
    return mkActor({
      effectivePermissions: new Set([
        PERMISSIONS.WORKFLOWS_READ,
        PERMISSIONS.WORKFLOWS_ENFORCE,
        PERMISSIONS.WORKFLOWS_CREATE,
      ]),
      ...overrides,
    });
  }

  /** Minimal valid workflow.json content fetched from a git tag. */
  const validWorkflowJson = JSON.stringify({
    apiVersion: "mnm/v1",
    kind: "GovernedWorkflow",
    name: "feature-dev",
    description: "Imported from tag",
    steps: [{ id: "step-1", agent: "senior-dev", deps: [], prompt_context: {} }],
  });

  it("success (new row): fetches blob, validates, inserts, returns created=true", async () => {
    const fakeGitProvider = {
      fetchBlob: vi.fn(async () => validWorkflowJson),
      paths: { workflows: "workflows" },
    };
    const services = mkServices(
      {},
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => []) })),
    }));
    (services.db as any).insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: "wf-new-1" }]),
      })),
    }));

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const register = tools.find((t) => t.name === "register_governed_workflow")!;
    expect(register, "register_governed_workflow tool must be registered").toBeDefined();

    const r = await register.handler({
      input: { name: "feature-dev", git_tag: "feature-dev/v1.0.2" },
      actor: mkActorReg(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body).toEqual({
      id: "wf-new-1",
      name: "feature-dev",
      latest_git_tag: "feature-dev/v1.0.2",
      created: true,
    });
    // Did NOT call commitFile or createTag — that's the whole point of option C.
    expect((fakeGitProvider as any).commitFile).toBeUndefined();
    expect((fakeGitProvider as any).createTag).toBeUndefined();
  });

  it("success (existing row): updates pin, returns created=false", async () => {
    const fakeGitProvider = {
      fetchBlob: vi.fn(async () => validWorkflowJson),
      paths: { workflows: "workflows" },
    };
    const services = mkServices(
      {},
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => [{ id: "wf-existing-1" }]) })),
    }));
    (services.db as any).update = vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => {}) })),
    }));

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const register = tools.find((t) => t.name === "register_governed_workflow")!;

    const r = await register.handler({
      input: { name: "feature-dev", git_tag: "feature-dev/v1.0.3" },
      actor: mkActorReg(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.created).toBe(false);
    expect(body.id).toBe("wf-existing-1");
    expect(body.latest_git_tag).toBe("feature-dev/v1.0.3");
  });

  it("WORKFLOW_FILE_NOT_FOUND: GitProviderError 'not_found' surfaces typed error", async () => {
    const { GitProviderError } = await import("@mnm/git-provider");
    const fakeGitProvider = {
      fetchBlob: vi.fn(async () => {
        throw new GitProviderError("not_found", "blob not found at ref");
      }),
      paths: { workflows: "workflows" },
    };
    const services = mkServices(
      {},
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const register = tools.find((t) => t.name === "register_governed_workflow")!;

    const r = await register.handler({
      input: { name: "feature-dev", git_tag: "feature-dev/v9.9.9" },
      actor: mkActorReg(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe(WORKFLOW_ERROR_CODES.WORKFLOW_FILE_NOT_FOUND);
    expect(body.workflow_name).toBe("feature-dev");
    expect(body.git_tag).toBe("feature-dev/v9.9.9");
  });

  it("WORKFLOW_NAME_MISMATCH: workflow.json declares a different name", async () => {
    const mismatchJson = JSON.stringify({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "another-workflow",
      description: "Wrong name",
      steps: [{ id: "step-1", agent: "greeter", deps: [], prompt_context: {} }],
    });
    const fakeGitProvider = {
      fetchBlob: vi.fn(async () => mismatchJson),
      paths: { workflows: "workflows" },
    };
    const services = mkServices(
      {},
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const register = tools.find((t) => t.name === "register_governed_workflow")!;

    const r = await register.handler({
      input: { name: "feature-dev", git_tag: "feature-dev/v1.0.2" },
      actor: mkActorReg(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe(WORKFLOW_ERROR_CODES.WORKFLOW_NAME_MISMATCH);
    expect(body.definition_name).toBe("another-workflow");
    expect(body.workflow_name).toBe("feature-dev");
  });

  it("WORKFLOW_VALIDATION: workflow.json fails schema validation", async () => {
    const invalidJson = JSON.stringify({ apiVersion: "mnm/v1", kind: "GovernedWorkflow", name: "" });
    const fakeGitProvider = {
      fetchBlob: vi.fn(async () => invalidJson),
      paths: { workflows: "workflows" },
    };
    const services = mkServices(
      {},
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const register = tools.find((t) => t.name === "register_governed_workflow")!;

    const r = await register.handler({
      input: { name: "feature-dev", git_tag: "feature-dev/v1.0.2" },
      actor: mkActorReg(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe(WORKFLOW_ERROR_CODES.WORKFLOW_VALIDATION);
  });
});

// ── U6.2 — updateGovernedWorkflow ──────────────────────────────────────────

describe("updateGovernedWorkflow tool (U6.2)", () => {
  /** Minimal valid workflow definition (steps.min(1) enforced by schema). */
  const validDefinition = {
    apiVersion: "mnm/v1" as const,
    kind: "GovernedWorkflow" as const,
    name: "hello-world",
    description: "Updated workflow",
    steps: [{ id: "step-1", agent: "greeter", deps: [], prompt_context: {} }],
  };

  function mkActor6(overrides: Partial<McpActor> = {}): McpActor {
    return mkActor({
      effectivePermissions: new Set([
        PERMISSIONS.WORKFLOWS_READ,
        PERMISSIONS.WORKFLOWS_ENFORCE,
        PERMISSIONS.WORKFLOWS_CREATE,
      ]),
      ...overrides,
    });
  }

  it("success: bumps patch of existing latestGitTag, returns { commitSha, newGitTag }", async () => {
    const existingDef = { id: "def-1", name: "hello-world", latestGitTag: "hello-world/v1.0.0" };
    const fakeGitProvider = {
      listTags: vi.fn(async () => [{ name: "hello-world/v1.0.0" }]),
      commitFile: vi.fn(async () => ({ sha: "def456" })),
      createTag: vi.fn(async () => {}),
    };
    const services = mkServices(
      { getDefinition: vi.fn(async () => existingDef) },
      { resolveGitProvider: vi.fn(async () => fakeGitProvider) },
    );
    // select: first call returns the existing row (saveDefinition upsert check)
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ id: "def-1" }]),
      })),
    }));
    (services.db as any).update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {}),
      })),
    }));

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const update = tools.find((t) => t.name === "update_governed_workflow")!;
    expect(update, "update_governed_workflow tool must be registered").toBeDefined();

    const r = await update.handler({
      input: { name: "hello-world", definition: validDefinition, commit_message: "fix: update", branch: "main" },
      actor: mkActor6(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.new_git_tag).toBe("hello-world/v1.0.1");
  });

  it("WORKFLOW_NAME_MISMATCH: input.name != definition.name returns error", async () => {
    const services = mkServices({ getDefinition: vi.fn(async () => ({ id: "def-1", name: "hello-world" })) });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const update = tools.find((t) => t.name === "update_governed_workflow")!;
    expect(update).toBeDefined();

    const r = await update.handler({
      input: {
        name: "other-workflow",
        definition: { ...validDefinition, name: "hello-world" },
        commit_message: "fix: mismatch",
      },
      actor: mkActor6(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe("WORKFLOW_NAME_MISMATCH");
  });

  it("WORKFLOW_NOT_FOUND: DB row missing returns error", async () => {
    const services = mkServices({ getDefinition: vi.fn(async () => null) });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const update = tools.find((t) => t.name === "update_governed_workflow")!;
    expect(update).toBeDefined();

    const r = await update.handler({
      input: { name: "hello-world", definition: validDefinition, commit_message: "fix: missing" },
      actor: mkActor6(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe("WORKFLOW_NOT_FOUND");
  });
});

// ── U6.3 — archiveGovernedWorkflow ─────────────────────────────────────────

describe("archiveGovernedWorkflow tool (U6.3)", () => {
  function mkActor6(overrides: Partial<McpActor> = {}): McpActor {
    return mkActor({
      effectivePermissions: new Set([
        PERMISSIONS.WORKFLOWS_READ,
        PERMISSIONS.WORKFLOWS_ENFORCE,
        PERMISSIONS.WORKFLOWS_CREATE,
      ]),
      ...overrides,
    });
  }

  it("success: sets archived_at + enabled=false, returns { archived: true, name }", async () => {
    const services = mkServices({});
    // archiveDefinition is called with (db, { companyId, name }) and returns boolean.
    // The tool imports it directly from extensions, so we patch via services.db
    // by making the DB query chain return a found row then succeed on update.
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [{ id: "def-1", archivedAt: null }]),
      })),
    }));
    (services.db as any).update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {}),
      })),
    }));

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const archive = tools.find((t) => t.name === "archive_governed_workflow")!;
    expect(archive, "archive_governed_workflow tool must be registered").toBeDefined();

    const r = await archive.handler({
      input: { name: "hello-world" },
      actor: mkActor6(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.archived).toBe(true);
    expect(body.name).toBe("hello-world");
  });

  it("WORKFLOW_NOT_FOUND: row not found returns error", async () => {
    const services = mkServices({});
    (services.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    }));

    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const archive = tools.find((t) => t.name === "archive_governed_workflow")!;
    expect(archive).toBeDefined();

    const r = await archive.handler({
      input: { name: "missing-workflow" },
      actor: mkActor6(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe("WORKFLOW_NOT_FOUND");
  });
});

// ── Task 9 — cancel_governed_workflow_run + reactivate_governed_workflow_run ─

describe("MCP — cancel_governed_workflow_run", () => {
  const RUN_ID = "00000000-0000-0000-0000-0000000000aa";
  const CANCELLED_AT = new Date("2026-04-27T12:00:00.000Z");

  it("cancels via MCP, returns run_id + cancelled_at + cancelled_step_ids", async () => {
    const cancelSpy = vi.fn(async () => ({
      runId: RUN_ID,
      cancelledAt: CANCELLED_AT,
      cancelledStepIds: ["step-1", "step-2"],
    }));
    const publishSpy = vi.fn();
    const services = mkServices(
      { cancelRun: cancelSpy },
      { publishLiveEvent: publishSpy },
    );
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const cancel = tools.find((t) => t.name === "cancel_governed_workflow_run")!;
    expect(cancel, "cancel_governed_workflow_run tool must be registered").toBeDefined();

    const r = await cancel.handler({
      input: { run_id: RUN_ID, reason: "tom mis-launched" },
      actor: mkActor(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.run_id).toBe(RUN_ID);
    expect(body.cancelled_at).toBe("2026-04-27T12:00:00.000Z");
    expect(body.cancelled_step_ids).toEqual(["step-1", "step-2"]);

    // Verify the tool forwarded the right shape to the service.
    expect(cancelSpy).toHaveBeenCalledWith(expect.objectContaining({
      runId: RUN_ID,
      companyId: "00000000-0000-0000-0000-000000000a01",
      actor: { type: "user", id: "u-1" },
      reason: "tom mis-launched",
      publishLiveEvent: publishSpy,
    }));
  });

  it("rejects reason < 5 chars at the Zod layer", async () => {
    const cancelSpy = vi.fn();
    const services = mkServices({ cancelRun: cancelSpy });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const cancel = tools.find((t) => t.name === "cancel_governed_workflow_run")!;

    // Zod rejection happens at the input schema, before the handler is invoked.
    // The MCP transport pipes raw input through input.parse(); reproduce that
    // path here by validating the tool's declared input schema directly.
    const parsed = cancel.input.safeParse({ run_id: RUN_ID, reason: "no" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]!.message).toMatch(/at least 5 characters/);
    }
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});

describe("MCP — reactivate_governed_workflow_run", () => {
  const RUN_ID = "00000000-0000-0000-0000-0000000000aa";

  it("reactivates via MCP, returns run_id + reactivated_step_ids", async () => {
    const reactivateSpy = vi.fn(async () => ({
      runId: RUN_ID,
      reactivatedStepIds: ["step-1", "step-2"],
    }));
    const publishSpy = vi.fn();
    const services = mkServices(
      { reactivateRun: reactivateSpy },
      { publishLiveEvent: publishSpy },
    );
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const reactivate = tools.find((t) => t.name === "reactivate_governed_workflow_run")!;
    expect(reactivate, "reactivate_governed_workflow_run tool must be registered").toBeDefined();

    const r = await reactivate.handler({
      input: { run_id: RUN_ID },
      actor: mkActor(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.run_id).toBe(RUN_ID);
    expect(body.reactivated_step_ids).toEqual(["step-1", "step-2"]);

    expect(reactivateSpy).toHaveBeenCalledWith(expect.objectContaining({
      runId: RUN_ID,
      companyId: "00000000-0000-0000-0000-000000000a01",
      actor: { type: "user", id: "u-1" },
      publishLiveEvent: publishSpy,
    }));
  });
});
