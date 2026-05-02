import { describe, it, expect } from "vitest";
import {
  hookRefSchema,
  hookBlockSchema,
  workflowStepSchema,
  workflowDefinitionSchema,
} from "../index.js";

describe("hookRefSchema", () => {
  it("accepts canonical/shared/local kebab-case refs", () => {
    expect(
      hookRefSchema.parse({ name: "canonical:jira-comment-on-complete" }).name,
    ).toBe("canonical:jira-comment-on-complete");
    expect(
      hookRefSchema.parse({ name: "shared:my-custom-hook" }).name,
    ).toBe("shared:my-custom-hook");
    expect(
      hookRefSchema.parse({ name: "local:project-specific" }).name,
    ).toBe("local:project-specific");
  });

  it("accepts optional with config object", () => {
    const parsed = hookRefSchema.parse({
      name: "canonical:jira-comment-on-complete",
      with: { issueKey: "PROJ-1" },
    });
    expect(parsed.with).toEqual({ issueKey: "PROJ-1" });
  });

  it("rejects refs without prefix", () => {
    expect(() => hookRefSchema.parse({ name: "jira-comment" })).toThrow();
  });

  it("rejects camelCase", () => {
    expect(() =>
      hookRefSchema.parse({ name: "canonical:JiraComment" }),
    ).toThrow();
  });

  it("rejects underscores", () => {
    expect(() =>
      hookRefSchema.parse({ name: "canonical:jira_comment" }),
    ).toThrow();
  });

  it("rejects unknown prefix", () => {
    expect(() => hookRefSchema.parse({ name: "system:foo" })).toThrow();
  });

  it("strips additional keys (strict)", () => {
    expect(() =>
      hookRefSchema.parse({
        name: "canonical:jira-comment-on-complete",
        unexpected: 1,
      }),
    ).toThrow();
  });
});

describe("hookBlockSchema", () => {
  it("defaults before/after to empty arrays", () => {
    const parsed = hookBlockSchema.parse({});
    expect(parsed.before).toEqual([]);
    expect(parsed.after).toEqual([]);
  });

  it("accepts mixed before/after entries", () => {
    const parsed = hookBlockSchema.parse({
      before: [{ name: "canonical:clickup-import-task" }],
      after: [
        {
          name: "canonical:jira-create-issue-on-complete",
          with: { projectKey: "PROJ" },
        },
      ],
    });
    expect(parsed.before).toHaveLength(1);
    expect(parsed.after).toHaveLength(1);
  });
});

describe("workflowStepSchema integration", () => {
  it("accepts a step with hooks block", () => {
    const parsed = workflowStepSchema.parse({
      id: "build",
      agent: "claude_code",
      hooks: {
        before: [{ name: "canonical:clickup-import-task" }],
        after: [{ name: "canonical:jira-comment-on-complete" }],
      },
    });
    expect(parsed.hooks?.before).toHaveLength(1);
    expect(parsed.hooks?.after).toHaveLength(1);
  });

  it("hooks is optional", () => {
    const parsed = workflowStepSchema.parse({
      id: "build",
      agent: "claude_code",
    });
    expect(parsed.hooks).toBeUndefined();
  });
});

describe("workflowDefinitionSchema integration", () => {
  it("accepts a workflow with root-level hooks (before_run / after_run)", () => {
    const parsed = workflowDefinitionSchema.parse({
      apiVersion: "mnm/v1",
      kind: "GovernedWorkflow",
      name: "my-workflow",
      steps: [{ id: "build", agent: "claude_code" }],
      hooks: {
        before: [{ name: "canonical:clickup-import-task" }],
        after: [{ name: "canonical:jira-create-issue-on-complete" }],
      },
    });
    expect(parsed.hooks?.before).toHaveLength(1);
    expect(parsed.hooks?.after).toHaveLength(1);
  });

  it("rejects malformed hook ref in step.hooks.after", () => {
    expect(() =>
      workflowDefinitionSchema.parse({
        apiVersion: "mnm/v1",
        kind: "GovernedWorkflow",
        name: "my-workflow",
        steps: [
          {
            id: "build",
            agent: "claude_code",
            hooks: {
              before: [],
              after: [{ name: "BadCamelCase" }],
            },
          },
        ],
      }),
    ).toThrow();
  });
});
