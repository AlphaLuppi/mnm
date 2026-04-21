import { describe, it, expect, afterEach } from "vitest";
import { LocalBareRepoProvider } from "@mnm/git-provider";
import { seedBareRepo, type BareRepoSeed } from "./seed-bare-repo.js";

describe("seedBareRepo fixture", () => {
  let repo: BareRepoSeed | undefined;

  afterEach(async () => {
    await repo?.cleanup();
    repo = undefined;
  });

  it("creates a bare repo with a resolvable v1.0.0 tag", async () => {
    repo = await seedBareRepo();
    const provider = new LocalBareRepoProvider({ providerId: "local:test", repoDir: repo.repoDir });
    const sha = await provider.resolveRef({ ref: repo.tag });
    expect(sha).toBe(repo.sha);
  });

  it("fetchBlob reads workflow.json at the seed sha", async () => {
    repo = await seedBareRepo();
    const provider = new LocalBareRepoProvider({ providerId: "local:test", repoDir: repo.repoDir });
    const content = await provider.fetchBlob({ path: "hello-world/workflow.json", ref: repo.sha });
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe("hello-world");
    expect(parsed.steps).toHaveLength(2);
  });

  it("fetchBlob reads a gate file at the seed sha", async () => {
    repo = await seedBareRepo();
    const provider = new LocalBareRepoProvider({ providerId: "local:test", repoDir: repo.repoDir });
    const gate = await provider.fetchBlob({ path: "hello-world/gates/greet-exit.gate.ts", ref: repo.sha });
    expect(gate).toContain("defineGate");
    expect(gate).toContain("greeting");
  });
});
