import { describe, it, expect, vi } from "vitest";
import { resolveHookRef } from "../resolver.js";
import type { GitProvider } from "@mnm/git-provider";

function fakeGit(): GitProvider {
  return {
    fetchBlob: vi.fn(async ({ path, ref }) => `// content of ${path}@${ref}\n`),
    listTags: vi.fn(),
    resolveRef: vi.fn(),
    pathExists: vi.fn(),
    commitFile: vi.fn(),
    createTag: vi.fn(),
    fetchTree: vi.fn(),
    commitMultipleFiles: vi.fn(),
    mergeBranch: vi.fn(),
    deleteBranch: vi.fn(),
  } as unknown as GitProvider;
}

const CANONICAL_REGISTRY = new Map<string, { code: string; sha: string }>([
  ["jira-comment-on-complete", { code: "// canonical jira", sha: "canon-1" }],
  ["clickup-import-task", { code: "// canonical clickup", sha: "canon-2" }],
]);

const baseCtx = {
  companyId: "co-1",
  workflowGitSha: "sha-runtime-pin",
  loadCanonical: (name: string) => CANONICAL_REGISTRY.get(name) ?? null,
};

describe("resolveHookRef — validation", () => {
  it("rejects ref without prefix", async () => {
    await expect(
      resolveHookRef("jira-comment", { ...baseCtx, gitProvider: fakeGit() }),
    ).rejects.toThrow(/canonical\|shared\|local/);
  });

  it("rejects camelCase (kebab-only)", async () => {
    await expect(
      resolveHookRef("canonical:JiraComment", {
        ...baseCtx,
        gitProvider: fakeGit(),
      }),
    ).rejects.toThrow(/canonical\|shared\|local/);
  });

  it("rejects underscore", async () => {
    await expect(
      resolveHookRef("canonical:jira_comment", {
        ...baseCtx,
        gitProvider: fakeGit(),
      }),
    ).rejects.toThrow(/canonical\|shared\|local/);
  });

  it("rejects empty string", async () => {
    await expect(
      resolveHookRef("", { ...baseCtx, gitProvider: fakeGit() }),
    ).rejects.toThrow(/non-empty string/);
  });

  it("rejects unknown source prefix", async () => {
    await expect(
      resolveHookRef("system:foo", { ...baseCtx, gitProvider: fakeGit() }),
    ).rejects.toThrow(/canonical\|shared\|local/);
  });
});

describe("resolveHookRef — canonical", () => {
  it("loads canonical hook from registry", async () => {
    const result = await resolveHookRef("canonical:jira-comment-on-complete", {
      ...baseCtx,
      gitProvider: fakeGit(),
    });
    expect(result.source).toBe("canonical");
    expect(result.name).toBe("jira-comment-on-complete");
    expect(result.code).toBe("// canonical jira");
    expect(result.sha).toBe("canon-1");
    expect(result.sourcePath).toBe("canonical/jira-comment-on-complete.hook.ts");
  });

  it("throws on unknown canonical hook", async () => {
    await expect(
      resolveHookRef("canonical:does-not-exist", {
        ...baseCtx,
        gitProvider: fakeGit(),
      }),
    ).rejects.toThrow(/unknown canonical hook/);
  });

  it("does NOT call gitProvider for canonical refs", async () => {
    const gitProvider = fakeGit();
    await resolveHookRef("canonical:jira-comment-on-complete", {
      ...baseCtx,
      gitProvider,
    });
    expect(gitProvider.fetchBlob).not.toHaveBeenCalled();
  });
});

describe("resolveHookRef — shared", () => {
  it("loads shared hook from gitProvider at branch 'main' by default", async () => {
    const gitProvider = fakeGit();
    const result = await resolveHookRef("shared:my-custom-hook", {
      ...baseCtx,
      gitProvider,
    });
    expect(gitProvider.fetchBlob).toHaveBeenCalledWith({
      path: "hooks/my-custom-hook.hook.ts",
      ref: "main",
    });
    expect(result.source).toBe("shared");
    expect(result.name).toBe("my-custom-hook");
    expect(result.sourcePath).toBe("hooks/my-custom-hook.hook.ts");
    expect(result.code).toContain("hooks/my-custom-hook.hook.ts@main");
  });

  it("uses custom sharedRepoBranch when provided", async () => {
    const gitProvider = fakeGit();
    await resolveHookRef("shared:my-custom-hook", {
      ...baseCtx,
      gitProvider,
      sharedRepoBranch: "release-2026q2",
    });
    expect(gitProvider.fetchBlob).toHaveBeenCalledWith({
      path: "hooks/my-custom-hook.hook.ts",
      ref: "release-2026q2",
    });
  });
});

describe("resolveHookRef — local", () => {
  it("loads local hook from gitProvider at workflowGitSha", async () => {
    const gitProvider = fakeGit();
    const result = await resolveHookRef("local:project-specific", {
      ...baseCtx,
      gitProvider,
    });
    expect(gitProvider.fetchBlob).toHaveBeenCalledWith({
      path: "hooks/project-specific.hook.ts",
      ref: "sha-runtime-pin",
    });
    expect(result.source).toBe("local");
    expect(result.name).toBe("project-specific");
    expect(result.sha).toBe("sha-runtime-pin");
  });

  it("propagates gitProvider errors", async () => {
    const gitProvider = fakeGit();
    (gitProvider.fetchBlob as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("blob not found"),
    );
    await expect(
      resolveHookRef("local:missing", { ...baseCtx, gitProvider }),
    ).rejects.toThrow(/blob not found/);
  });
});
