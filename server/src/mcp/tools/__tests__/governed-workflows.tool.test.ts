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
