// server/src/services/__tests__/governed-workflows-interpolation.test.ts

import { describe, it, expect, vi } from "vitest";
import type { GitProvider } from "@mnm/git-provider";
import { interpolatePromptContext } from "../governed-workflows.js";

/** Minimal mock GitProvider for interpolation tests. */
function makeGitProvider(blobContent = "fetched blob content"): GitProvider {
  return {
    fetchBlob: vi.fn(async () => blobContent),
  } as unknown as GitProvider;
}

describe("interpolatePromptContext", () => {
  it("inlines git_file blob content — happy path", async () => {
    const gitProvider = makeGitProvider("# Design AY-1\n\nContent here.");

    const scope = {
      variables: {},
      steps: {
        "tech-design": {
          artifact: {
            outputs: {
              design: {
                name: "design",
                kind: "git_file" as const,
                path: "artifacts/runs/run-1/tech-design/design.md",
                git_sha: "abc123",
                branch: "mnm-runs/run-1",
                bytes: 42,
              },
            },
            data: {},
          },
        },
      },
    };

    const result = await interpolatePromptContext(
      { system: "Use this design:\n{{steps.tech-design.artifact.outputs.design}}" },
      scope,
      gitProvider,
    );

    expect(result).toEqual({
      system: "Use this design:\n# Design AY-1\n\nContent here.",
    });
    expect(gitProvider.fetchBlob).toHaveBeenCalledOnce();
    expect(gitProvider.fetchBlob).toHaveBeenCalledWith({
      ref: "abc123",
      path: "artifacts/runs/run-1/tech-design/design.md",
    });
  });

  it("inlines external_url string without fetching", async () => {
    const gitProvider = makeGitProvider();

    const scope = {
      variables: {},
      steps: {
        review: {
          artifact: {
            outputs: {
              mr: {
                name: "mr",
                kind: "external_url" as const,
                url: "https://gitlab.com/org/repo/-/merge_requests/42",
              },
            },
            data: {},
          },
        },
      },
    };

    const result = await interpolatePromptContext(
      { message: "Review at: {{steps.review.artifact.outputs.mr}}" },
      scope,
      gitProvider,
    );

    expect(result).toEqual({
      message: "Review at: https://gitlab.com/org/repo/-/merge_requests/42",
    });
    expect(gitProvider.fetchBlob).not.toHaveBeenCalled();
  });

  it("returns placeholder string for git_folder (no blob fetch)", async () => {
    const gitProvider = makeGitProvider();

    const scope = {
      variables: {},
      steps: {
        build: {
          artifact: {
            outputs: {
              dist: {
                name: "dist",
                kind: "git_folder" as const,
                path: "artifacts/runs/run-1/build/dist/",
                git_sha: "def456",
                branch: "mnm-runs/run-1",
                files: ["index.js", "index.css"],
              },
            },
            data: {},
          },
        },
      },
    };

    const result = await interpolatePromptContext(
      { message: "Dist folder: {{steps.build.artifact.outputs.dist}}" },
      scope,
      gitProvider,
    );

    expect(result).toEqual({
      message: "Dist folder: <folder: artifacts/runs/run-1/build/dist/, 2 files>",
    });
    expect(gitProvider.fetchBlob).not.toHaveBeenCalled();
  });

  it("leaves unknown placeholder as literal {{path}}", async () => {
    const gitProvider = makeGitProvider();

    const scope = { variables: {}, steps: {} };

    const result = await interpolatePromptContext(
      { prompt: "Hello {{variables.missing}}" },
      scope,
      gitProvider,
    );

    expect(result).toEqual({ prompt: "Hello {{variables.missing}}" });
    expect(gitProvider.fetchBlob).not.toHaveBeenCalled();
  });

  it("resolves plain {{variables.ticket}} scalar — existing behaviour preserved", async () => {
    const gitProvider = makeGitProvider();

    const scope = {
      variables: { ticket: "AY-4321", environment: "qualif1" },
      steps: {},
    };

    const result = await interpolatePromptContext(
      {
        system: "Working on {{variables.ticket}} in {{variables.environment}}",
        nested: { detail: "ticket={{variables.ticket}}" },
      },
      scope,
      gitProvider,
    );

    expect(result).toEqual({
      system: "Working on AY-4321 in qualif1",
      nested: { detail: "ticket=AY-4321" },
    });
    expect(gitProvider.fetchBlob).not.toHaveBeenCalled();
  });

  it("resolves kebab-case step IDs (e.g. tech-design)", async () => {
    const gitProvider = makeGitProvider("kebab content");

    const scope = {
      variables: {},
      steps: {
        "tech-design": {
          artifact: {
            outputs: {
              design: {
                name: "design",
                kind: "git_file" as const,
                path: "path/to/design.md",
                git_sha: "sha1",
                branch: "mnm-runs/r",
                bytes: 10,
              },
            },
            data: {},
          },
        },
      },
    };

    const result = await interpolatePromptContext(
      { text: "{{steps.tech-design.artifact.outputs.design}}" },
      scope,
      gitProvider,
    );

    expect(result).toEqual({ text: "kebab content" });
  });
});
