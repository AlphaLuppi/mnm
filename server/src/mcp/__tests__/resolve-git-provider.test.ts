import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the conflict service so each test can control what mergePreview returns.
// The resolver only uses `items`, so we return a minimal { items } shape.
const mockMergePreview = vi.fn();
vi.mock("../../services/config-layer-conflict.js", () => ({
  configLayerConflictService: () => ({ mergePreview: mockMergePreview }),
}));

import { createResolveGitProvider } from "../build-mcp-services.js";

describe("createResolveGitProvider", () => {
  let originalEnv: NodeJS.ProcessEnv;
  const fakeDb = {} as any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockMergePreview.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns company-specific GitlabProvider when git_provider item exists", async () => {
    mockMergePreview.mockResolvedValue({
      items: [
        {
          itemType: "git_provider",
          name: "default",
          configJson: {
            kind: "gitlab",
            providerId: "gitlab:acme",
            baseUrl: "https://gitlab.acme.internal",
            projectId: "42",
            token: "ACME_TOKEN",
          },
        },
      ],
      layerSources: [],
    });

    const resolve = createResolveGitProvider(fakeDb);
    const provider = await resolve("acme");

    expect(provider.constructor.name).toBe("GitlabProvider");
    expect((provider as unknown as { providerId: string }).providerId).toBe("gitlab:acme");
  });

  it("caches providers per companyId (same instance across calls)", async () => {
    mockMergePreview.mockResolvedValue({
      items: [
        {
          itemType: "git_provider",
          name: "default",
          configJson: { kind: "gitlab", providerId: "gitlab:acme", baseUrl: "x", projectId: "1", token: "t" },
        },
      ],
      layerSources: [],
    });
    const resolve = createResolveGitProvider(fakeDb);
    const p1 = await resolve("acme");
    const p2 = await resolve("acme");
    expect(p1).toBe(p2);
    // Should have called mergePreview at most once for "acme" due to caching
    expect(mockMergePreview).toHaveBeenCalledTimes(1);
  });

  it("returns distinct providers for distinct companies", async () => {
    mockMergePreview.mockImplementation(async (companyId: string) => {
      if (companyId === "acme") {
        return { items: [{ itemType: "git_provider", name: "default", configJson: { kind: "gitlab", providerId: "gitlab:acme", baseUrl: "x", projectId: "1", token: "t1" } }], layerSources: [] };
      }
      return { items: [{ itemType: "git_provider", name: "default", configJson: { kind: "gitlab", providerId: "gitlab:globex", baseUrl: "y", projectId: "2", token: "t2" } }], layerSources: [] };
    });
    const resolve = createResolveGitProvider(fakeDb);
    const pA = await resolve("acme");
    const pG = await resolve("globex");
    expect(pA).not.toBe(pG);
    expect((pA as unknown as { providerId: string }).providerId).toBe("gitlab:acme");
    expect((pG as unknown as { providerId: string }).providerId).toBe("gitlab:globex");
  });

  it("falls back to env-var provider when company has no git_provider item (dev mode)", async () => {
    mockMergePreview.mockResolvedValue({ items: [], layerSources: [] });
    process.env.MNM_GIT_PROVIDER = "local";
    process.env.MNM_GIT_LOCAL_PATH = "./_fixtures/mnm-workflows-bare";
    const resolve = createResolveGitProvider(fakeDb);
    const provider = await resolve("dev-co");
    expect(provider.constructor.name).toBe("LocalBareRepoProvider");
  });

  it("throws GovernedWorkflowError with code GIT_PROVIDER_MISCONFIG when kind is unknown", async () => {
    mockMergePreview.mockResolvedValue({
      items: [{ itemType: "git_provider", name: "default", configJson: { kind: "unknown-vendor" } }],
      layerSources: [],
    });
    const resolve = createResolveGitProvider(fakeDb);
    await expect(resolve("bad-co")).rejects.toMatchObject({
      name: "GovernedWorkflowError",
      code: "GIT_PROVIDER_MISCONFIG",
    });
  });

  it("throws GIT_PROVIDER_MISCONFIG when gitlab fields are missing", async () => {
    mockMergePreview.mockResolvedValue({
      items: [{ itemType: "git_provider", name: "default", configJson: { kind: "gitlab", baseUrl: "x" } }], // missing providerId/projectId/token
      layerSources: [],
    });
    const resolve = createResolveGitProvider(fakeDb);
    await expect(resolve("missing-fields")).rejects.toMatchObject({
      name: "GovernedWorkflowError",
      code: "GIT_PROVIDER_MISCONFIG",
    });
  });
});
