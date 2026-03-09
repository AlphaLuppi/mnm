import { describe, it, expect } from "vitest";
import {
  parseCommitReferences,
  matchSpecPath,
} from "@/lib/git/commit-parser";

describe("parseCommitReferences", () => {
  it("parses refs: pattern", () => {
    const refs = parseCommitReferences("fix: update layout refs: story-1.2.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "refs", specPath: "story-1.2.md" });
  });

  it("parses implements: pattern", () => {
    const refs = parseCommitReferences("implements: architecture.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      type: "implements",
      specPath: "architecture.md",
    });
  });

  it("parses closes: pattern", () => {
    const refs = parseCommitReferences("closes: story-1.2.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "closes", specPath: "story-1.2.md" });
  });

  it("parses story: pattern as refs", () => {
    const refs = parseCommitReferences("story: story-1.2");
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe("refs");
    expect(refs[0].specPath).toBe("story-1.2.md");
  });

  it("parses spec: pattern as refs", () => {
    const refs = parseCommitReferences("spec: prd.md");
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe("refs");
  });

  it("handles multiple references in one message", () => {
    const refs = parseCommitReferences(
      "feat: add auth refs: story-1.2.md implements: architecture.md"
    );
    expect(refs).toHaveLength(2);
  });

  it("handles FR references (case insensitive)", () => {
    const refs = parseCommitReferences("implements: fr3.2");
    expect(refs).toHaveLength(1);
    expect(refs[0].specPath).toBe("FR3.2");
  });

  it("handles hash-prefixed references", () => {
    const refs = parseCommitReferences("refs: #story-1.2");
    expect(refs).toHaveLength(1);
    expect(refs[0].specPath).toBe("story-1.2.md");
  });

  it("returns empty array for no references", () => {
    const refs = parseCommitReferences("fix: update README");
    expect(refs).toHaveLength(0);
  });

  it("deduplicates references", () => {
    const refs = parseCommitReferences(
      "refs: story-1.2.md refs: story-1.2.md"
    );
    expect(refs).toHaveLength(1);
  });
});

describe("matchSpecPath", () => {
  const knownPaths = [
    "_bmad-output/stories/story-1.2.md",
    "_bmad-output/planning-artifacts/architecture-web.md",
    "docs/prd.md",
  ];

  it("matches exact file name", () => {
    const match = matchSpecPath("story-1.2.md", knownPaths);
    expect(match).toBe("_bmad-output/stories/story-1.2.md");
  });

  it("matches without extension", () => {
    const match = matchSpecPath("story-1.2", knownPaths);
    expect(match).toBe("_bmad-output/stories/story-1.2.md");
  });

  it("matches by basename", () => {
    const match = matchSpecPath("prd.md", knownPaths);
    expect(match).toBe("docs/prd.md");
  });

  it("returns null for unknown reference", () => {
    const match = matchSpecPath("unknown-spec.md", knownPaths);
    expect(match).toBeNull();
  });

  it("matches partial path", () => {
    const match = matchSpecPath("architecture-web", knownPaths);
    expect(match).toBe(
      "_bmad-output/planning-artifacts/architecture-web.md"
    );
  });
});
