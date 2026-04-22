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

function mkServices(governedWorkflows: Record<string, any>) {
  return {
    db: { execute: vi.fn() },
    governedWorkflows,
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

  it("sync_governed_environment returns agents + new_sha + has_changes", async () => {
    const services = mkServices({
      syncEnvironment: vi.fn(async () => ({
        agents: [{ name: "greeter", mdContent: "# Greeter", configMerged: {} }],
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
  it("returns the cache payload + relative path", async () => {
    const services = mkServices({
      pushLocalState: vi.fn(async () => ({
        targetRelativePath: "last-session.json",
        content: {
          lastSyncedSha: "abc123",
          syncedAt: "2026-04-22T00:00:00.000Z",
          agentNames: ["mnm--greeter"],
          pendingRuns: 0,
          openIssues: 0,
          lastPluginVersion: "0.1.0",
        },
      })),
    });
    const tools = collectTools(governedWorkflowTools, services as any, services.db as any);
    const push = tools.find((t) => t.name === "push_local_state")!;
    const r = await push.handler({
      input: { agents_provisioned: ["mnm--greeter"], plugin_version: "0.1.0" },
      actor: mkActor(),
    });
    const parsed = JSON.parse(r.content[0]!.text);
    expect(parsed.target_relative_path).toBe("last-session.json");
    expect(parsed.content.lastPluginVersion).toBe("0.1.0");
    expect(parsed.content.agentNames).toContain("mnm--greeter");
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
          ["Re-call launchStep with the updated sha"],
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
});
