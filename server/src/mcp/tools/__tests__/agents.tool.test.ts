import { describe, it, expect, vi } from "vitest";
import agentTools from "../agents.tool.js";
import { collectTools } from "../../registry/define-mcp-tools.js";
import { GitProviderError } from "@mnm/git-provider";
import { PERMISSIONS } from "@mnm/shared";
import type { McpActor } from "../../registry/types.js";

const COMPANY_ID = "00000000-0000-0000-0000-000000000a01";
const AGENT_ID = "00000000-0000-0000-0000-000000000b01";

function mkActor(overrides: Partial<McpActor> = {}): McpActor {
  return {
    type: "user",
    userId: "u-1",
    companyId: COMPANY_ID,
    effectivePermissions: new Set([
      PERMISSIONS.AGENTS_READ,
      PERMISSIONS.AGENTS_CREATE,
      PERMISSIONS.AGENTS_EDIT,
      PERMISSIONS.AGENTS_DELETE,
      PERMISSIONS.AGENTS_LAUNCH,
      PERMISSIONS.AGENTS_CONFIGURE,
    ]),
    effectiveTags: [],
    mcpSessionId: "sess-1",
    ...overrides,
  };
}

function mkProvider(blobs: Record<string, string> = {}) {
  return {
    paths: { agents: "agents" },
    fetchBlob: vi.fn(async ({ path, ref }: { path: string; ref: string }) => {
      const key = `${path}@${ref}`;
      if (key in blobs) return blobs[key];
      throw new GitProviderError("not_found", `blob not found: ${path}@${ref}`);
    }),
    resolveRef: vi.fn(async () => "sha-abc"),
    listTags: vi.fn(async () => []),
    pathExists: vi.fn(async () => true),
    commitFile: vi.fn(async () => ({ sha: "new-sha" })),
    providerId: "local:test",
  };
}

function mkServices(
  agentsOverrides: Record<string, any> = {},
  resolveGitProvider?: any,
) {
  return {
    db: { execute: vi.fn() },
    resolveGitProvider: resolveGitProvider ?? vi.fn(async () => mkProvider()),
    agents: {
      list: vi.fn(async () => []),
      getById: vi.fn(async () => null),
      create: vi.fn(async (companyId: string, data: any) => ({
        id: AGENT_ID,
        name: data.name,
        status: "active",
        urlKey: data.name,
        adapterType: data.adapterType ?? "claude_local",
        latestGitTag: data.latestGitTag ?? null,
        ...data,
      })),
      update: vi.fn(async () => null),
      remove: vi.fn(async () => null),
      runningForAgent: vi.fn(async () => []),
      ...agentsOverrides,
    },
    heartbeat: {
      wakeup: vi.fn(async () => null),
    },
  };
}

describe("create_agent — latestGitTag validation", () => {
  // Behavior: after create_agent with valid latestGitTag,
  // the agent row is created and latestGitTag is stored.
  it("after create_agent with valid latestGitTag, the row is created with latestGitTag set", async () => {
    const provider = mkProvider({ "agents/senior-dev/agent.md@v1": "# senior dev" });
    const resolveGitProvider = vi.fn(async () => provider);
    const services = mkServices({}, resolveGitProvider);

    const tools = collectTools(agentTools, services as any, services.db as any);
    const createTool = tools.find((t) => t.name === "create_agent")!;

    const r = await createTool.handler({
      input: { name: "senior-dev", latestGitTag: "v1", adapterType: "claude_local" },
      actor: mkActor(),
    });

    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0]!.text);
    expect(body.id).toBeDefined();
    // resolveGitProvider was called with resourceType: "agent"
    expect(resolveGitProvider).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "agent", userId: "u-1" }),
    );
    // agents.create was called with latestGitTag
    expect(services.agents.create).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ latestGitTag: "v1" }),
    );
  });

  // Behavior: throws AGENT_GIT_FILE_MISSING when latestGitTag supplied but .md absent
  it("throws AGENT_GIT_FILE_MISSING when latestGitTag is supplied but the .md is not in the repo", async () => {
    const provider = mkProvider({}); // empty repo
    const resolveGitProvider = vi.fn(async () => provider);
    const services = mkServices({}, resolveGitProvider);

    const tools = collectTools(agentTools, services as any, services.db as any);
    const createTool = tools.find((t) => t.name === "create_agent")!;

    const r = await createTool.handler({
      input: { name: "ghost", latestGitTag: "v1", adapterType: "claude_local" },
      actor: mkActor(),
    });

    expect(r.isError).toBe(true);
    const body = JSON.parse(r.content[0]!.text);
    expect(body.error_code).toBe("AGENT_GIT_FILE_MISSING");
    expect(body.hints).toEqual(
      expect.arrayContaining([expect.stringMatching(/agents\/ghost\/agent\.md/)]),
    );
    // M-FIX-2: error envelope must spread err.data so consumers can switch
    // on structured fields (agent_name, latest_git_tag, full_path) just like
    // the governed-workflows.tool wrap() helper does (cf. P1 contract).
    expect(body).toMatchObject({
      agent_name: "ghost",
      latest_git_tag: "v1",
      full_path: "agents/ghost/agent.md",
    });
  });

  // Behavior: omitting latestGitTag produces a row with latestGitTag NULL
  it("when latestGitTag is omitted, the agent row is created with latestGitTag NULL", async () => {
    const services = mkServices();
    const tools = collectTools(agentTools, services as any, services.db as any);
    const createTool = tools.find((t) => t.name === "create_agent")!;

    const r = await createTool.handler({
      input: { name: "legacy", adapterType: "claude_local" },
      actor: mkActor(),
    });

    expect(r.isError).toBeFalsy();
    // resolveGitProvider must NOT have been called (no git validation)
    expect(services.resolveGitProvider).not.toHaveBeenCalled();
    // agents.create called with latestGitTag null
    expect(services.agents.create).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ latestGitTag: null }),
    );
  });

  // Behavior: rejects latestGitTag that is whitespace-only (zod validation)
  it("rejects latestGitTag that is whitespace-only", async () => {
    const services = mkServices();
    const tools = collectTools(agentTools, services as any, services.db as any);
    const createTool = tools.find((t) => t.name === "create_agent")!;

    // Zod validation runs inside the registry wrapper which catches and returns
    // the error as isError. We call the raw handler schema parse here.
    // The zod schema will throw a ZodError which the registry converts to VALIDATION_ERROR.
    // We assert via the tool handler directly.
    const parsed = (createTool.input as any).safeParse({
      name: "spaced",
      latestGitTag: "   ",
      adapterType: "claude_local",
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error)).toMatch(/latestGitTag|empty/i);
  });
});
