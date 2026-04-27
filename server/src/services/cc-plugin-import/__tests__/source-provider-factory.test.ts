import { describe, it, expect } from "vitest";
import { parseGitlabRepoUrl } from "../source-provider-factory.js";

describe("parseGitlabRepoUrl", () => {
  it("parses a GitLab URL with multi-segment path", () => {
    const r = parseGitlabRepoUrl("https://lab.enterprise.example/example-org/hub/creation/lint-pack");
    expect(r.baseUrl).toBe("https://lab.enterprise.example");
    expect(r.projectPath).toBe("example-org/hub/creation/lint-pack");
  });

  it("strips .git suffix", () => {
    const r = parseGitlabRepoUrl("https://lab.enterprise.example/foo/bar.git");
    expect(r.projectPath).toBe("foo/bar");
  });

  it("throws on URLs without a project path", () => {
    expect(() => parseGitlabRepoUrl("https://lab.enterprise.example")).toThrow();
  });

  it("parses a two-segment path", () => {
    const r = parseGitlabRepoUrl("https://gitlab.example.com/group/repo");
    expect(r.baseUrl).toBe("https://gitlab.example.com");
    expect(r.projectPath).toBe("group/repo");
  });

  it("strips leading slashes from the path", () => {
    const r = parseGitlabRepoUrl("https://lab.enterprise.example/org/project");
    expect(r.projectPath).toBe("org/project");
    expect(r.projectPath.startsWith("/")).toBe(false);
  });
});
