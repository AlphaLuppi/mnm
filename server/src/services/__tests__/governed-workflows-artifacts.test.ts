// server/src/services/__tests__/governed-workflows-artifacts.test.ts

import { describe, it, expect, vi } from "vitest";
import { LocalBareRepoProvider } from "@mnm/git-provider";
import { commitHandoffArtifacts, resolveCommitAuthor, buildHandoffsForStep } from "../governed-workflows-artifacts.js";
import { seedBareRepo } from "../../mcp/tools/__tests__/fixtures/seed-bare-repo.js";
import type { ArtifactInput } from "@mnm/shared";

describe("commitHandoffArtifacts", () => {
  it("transforms file/folder/url outputs and commits to mnm-runs branch", async () => {
    const repo = await seedBareRepo();
    try {
      const provider = new LocalBareRepoProvider({ providerId: "test", repoDir: repo.repoDir });

      const input: ArtifactInput = {
        outputs: [
          { name: "design", kind: "file", filename: "design.md", content: "# Design AY-1\n" },
          { name: "proto", kind: "folder", files: { "index.html": "<html/>", "app.js": "x" } },
          { name: "mr", kind: "external_url", url: "https://lab/x/-/merge_requests/1" },
        ],
        data: { mr_iid: 42, ticket: "AY-1" },
      };

      const persisted = await commitHandoffArtifacts({
        gitProvider: provider,
        runId: "abc-123",
        stepId: "tech-design",
        input,
        author: { name: "Tom", email: "tom@cba.fr" },
        startBranch: "main",
      });

      expect(persisted.outputs).toHaveLength(3);
      expect(persisted.outputs[0]).toMatchObject({
        name: "design",
        kind: "git_file",
        path: "artifacts/runs/abc-123/tech-design/design.md",
        branch: "mnm-runs/abc-123",
        bytes: "# Design AY-1\n".length,
      });
      expect(persisted.outputs[0]).toHaveProperty("git_sha");
      expect(persisted.outputs[1]).toMatchObject({
        name: "proto",
        kind: "git_folder",
        path: "artifacts/runs/abc-123/tech-design/proto/",
        files: ["index.html", "app.js"],
      });
      expect(persisted.outputs[2]).toEqual({
        name: "mr",
        kind: "external_url",
        url: "https://lab/x/-/merge_requests/1",
      });
      expect(persisted.data).toEqual({ mr_iid: 42, ticket: "AY-1" });
    } finally {
      await repo.cleanup();
    }
  });

  it("is idempotent if outputs already contain git_file kinds", async () => {

    const repo = await seedBareRepo();
    try {
      const provider = new LocalBareRepoProvider({ providerId: "test", repoDir: repo.repoDir });

      const alreadyPersisted = {
        outputs: [
          { name: "design", kind: "git_file" as const, path: "x", git_sha: "abc", branch: "mnm-runs/r", bytes: 10 },
        ],
        data: {},
      };
      const result = await commitHandoffArtifacts({
        gitProvider: provider,
        runId: "r",
        stepId: "s",
        input: alreadyPersisted as any,
        author: { name: "T", email: "t@x" },
        startBranch: "main",
      });
      expect(result).toEqual(alreadyPersisted);
    } finally {
      await repo.cleanup();
    }
  });
});

describe("resolveCommitAuthor", () => {
  it("returns user name/email when actor.type === 'user' and user exists in DB", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ name: "Tom Andrieu", email: "tom@cba.fr" }]),
        }),
      }),
    } as any;

    const result = await resolveCommitAuthor({
      db: mockDb,
      companyId: "company-1",
      actor: { type: "user", id: "user-abc" },
    });

    expect(result).toEqual({ name: "Tom Andrieu", email: "tom@cba.fr" });
  });

  it("falls back to env service account when actor is an agent", async () => {
    const mockDb = { select: vi.fn() } as any;

    const result = await resolveCommitAuthor({
      db: mockDb,
      companyId: "company-1",
      actor: { type: "agent", id: "agent-xyz" },
    });

    // select should never be called for non-user actors
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(result).toEqual({
      name: process.env.MNM_GIT_BOT_NAME ?? "MnM bot",
      email: process.env.MNM_GIT_BOT_EMAIL ?? "mnm-bot@mnm.local",
    });
  });
});

describe("buildHandoffsForStep", () => {
  it("extracts handoffs from previous succeeded steps", () => {
    const prevSteps = [
      {
        stepIdInJson: "tech-design",
        state: "succeeded" as const,
        artifactsJson: {
          outputs: [
            { name: "design", kind: "git_file", path: "artifacts/runs/r1/tech-design/design.md", git_sha: "abc", branch: "mnm-runs/r1", bytes: 100 },
            { name: "mr", kind: "external_url", url: "https://x" },
          ],
          data: { mr_iid: 1 },
        },
      },
    ];
    const handoffs = buildHandoffsForStep(prevSteps as any);
    expect(handoffs).toEqual([
      {
        name: "design",
        kind: "git_file",
        git_sha: "abc",
        path: "artifacts/runs/r1/tech-design/design.md",
        branch: "mnm-runs/r1",
        destination: ".mnm/handoffs/design.md",
      },
      {
        name: "mr",
        kind: "external_url",
        url: "https://x",
      },
    ]);
  });

  it("ignores failed and pending steps", () => {
    const prevSteps = [
      { stepIdInJson: "s1", state: "failed", artifactsJson: { outputs: [{ name: "x", kind: "git_file", path: "p", git_sha: "s", branch: "b", bytes: 1 }], data: {} } },
      { stepIdInJson: "s2", state: "pending", artifactsJson: null },
    ];
    expect(buildHandoffsForStep(prevSteps as any)).toEqual([]);
  });
});
