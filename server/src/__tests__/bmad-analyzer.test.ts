import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  analyzeBmadWorkspace,
  parseAcceptanceCriteria,
  parseTasks,
} from "../services/bmad-analyzer.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bmad-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("analyzeBmadWorkspace", () => {
  it("returns null for non-BMAD workspace", async () => {
    const result = await analyzeBmadWorkspace(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null for empty _bmad-output directory", async () => {
    await fs.mkdir(path.join(tmpDir, "_bmad-output"), { recursive: true });
    const result = await analyzeBmadWorkspace(tmpDir);
    expect(result).toBeNull();
  });

  it("detects planning artifacts", async () => {
    const planDir = path.join(tmpDir, "_bmad-output", "planning-artifacts");
    await fs.mkdir(planDir, { recursive: true });
    await fs.writeFile(
      path.join(planDir, "product-brief.md"),
      "# Product Brief\n\nSome content",
    );
    await fs.writeFile(
      path.join(planDir, "prd.md"),
      "# Product Requirements\n\nDetails here",
    );
    await fs.writeFile(
      path.join(planDir, "architecture.md"),
      "# Architecture\n\nArch details",
    );

    const result = await analyzeBmadWorkspace(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.detected).toBe(true);
    expect(result!.planningArtifacts).toHaveLength(3);

    const brief = result!.planningArtifacts.find((a) => a.type === "product-brief");
    expect(brief).toBeDefined();
    expect(brief!.title).toBe("Product Brief");

    const prd = result!.planningArtifacts.find((a) => a.type === "prd");
    expect(prd).toBeDefined();

    const arch = result!.planningArtifacts.find((a) => a.type === "architecture");
    expect(arch).toBeDefined();
  });

  it("parses story files into epic hierarchy", async () => {
    const implDir = path.join(tmpDir, "_bmad-output", "implementation-artifacts");
    await fs.mkdir(implDir, { recursive: true });

    await fs.writeFile(
      path.join(implDir, "1-1-first-story.md"),
      `# Story 1.1: First Story

Status: ready-for-dev

## Acceptance Criteria

### AC1 — Basic detection

**Given** a workspace exists
**When** the analyzer runs
**Then** it detects the structure
**And** returns a result

### AC2 — Second criterion

**Given** another condition
**When** something happens
**Then** the outcome is correct

## Tasks / Subtasks

- [ ] Task 1: Do something
- [x] Task 2: Already done
- [ ] Task 3: More work
`,
    );

    await fs.writeFile(
      path.join(implDir, "1-2-second-story.md"),
      `# Story 1.2: Second Story

Status: done

## Tasks

- [x] Task 1: Complete
- [x] Task 2: Also complete
`,
    );

    await fs.writeFile(
      path.join(implDir, "2-1-epic-two-story.md"),
      `# Story 2.1: Epic Two Story

Status: backlog
`,
    );

    const result = await analyzeBmadWorkspace(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.epics).toHaveLength(2);

    // Epic 1
    const epic1 = result!.epics[0];
    expect(epic1.number).toBe(1);
    expect(epic1.stories).toHaveLength(2);
    expect(epic1.progress.done).toBe(1); // story 1-2 is "done"
    expect(epic1.progress.total).toBe(2);

    // Story 1-1
    const story11 = epic1.stories[0];
    expect(story11.id).toBe("1-1");
    expect(story11.title).toBe("Story 1.1: First Story");
    expect(story11.status).toBe("ready-for-dev");
    expect(story11.acceptanceCriteria).toHaveLength(2);
    expect(story11.tasks).toHaveLength(3);
    expect(story11.taskProgress).toEqual({ done: 1, total: 3 });

    // AC parsing
    const ac1 = story11.acceptanceCriteria[0];
    expect(ac1.id).toBe("AC1");
    expect(ac1.title).toBe("Basic detection");
    expect(ac1.given).toBe("a workspace exists");
    expect(ac1.when).toBe("the analyzer runs");
    expect(ac1.then).toEqual(["it detects the structure", "returns a result"]);

    // Story 1-2
    const story12 = epic1.stories[1];
    expect(story12.status).toBe("done");
    expect(story12.taskProgress).toEqual({ done: 2, total: 2 });

    // Epic 2
    const epic2 = result!.epics[1];
    expect(epic2.number).toBe(2);
    expect(epic2.stories).toHaveLength(1);
  });

  it("parses sprint-status.yaml and merges statuses", async () => {
    const bmadDir = path.join(tmpDir, "_bmad-output");
    const implDir = path.join(bmadDir, "implementation-artifacts");
    await fs.mkdir(implDir, { recursive: true });

    await fs.writeFile(
      path.join(bmadDir, "sprint-status.yaml"),
      `project: test
development_status:
  epic-1: in-progress
  1-1-first-story: in-progress
  1-2-second-story: done
`,
    );

    // Story without inline status — should get status from sprint-status.yaml
    await fs.writeFile(
      path.join(implDir, "1-1-first-story.md"),
      "# First Story\n\nNo status line here\n",
    );
    await fs.writeFile(
      path.join(implDir, "1-2-second-story.md"),
      "# Second Story\n\nNo status line here\n",
    );

    const result = await analyzeBmadWorkspace(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.sprintStatus).not.toBeNull();
    expect(result!.sprintStatus!.project).toBe("test");
    expect(result!.sprintStatus!.statuses["epic-1"]).toBe("in-progress");

    // Epic status merged from sprint status
    const epic1 = result!.epics[0];
    expect(epic1.status).toBe("in-progress");

    // Stories get status from sprint-status.yaml when no inline status
    const story11 = epic1.stories.find((s) => s.id === "1-1");
    expect(story11!.status).toBe("in-progress");
  });

  it("ignores non-markdown and non-numbered files in implementation-artifacts", async () => {
    const implDir = path.join(tmpDir, "_bmad-output", "implementation-artifacts");
    await fs.mkdir(implDir, { recursive: true });

    await fs.writeFile(path.join(implDir, "sprint-status.yaml"), "project: test\n");
    await fs.writeFile(path.join(implDir, "readme.md"), "# Readme\n");
    await fs.writeFile(path.join(implDir, "1-1-real-story.md"), "# Real Story\n");

    const result = await analyzeBmadWorkspace(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.epics).toHaveLength(1);
    expect(result!.epics[0].stories).toHaveLength(1);
    expect(result!.epics[0].stories[0].title).toBe("Real Story");
  });
});

describe("parseAcceptanceCriteria", () => {
  it("extracts Given/When/Then from AC blocks", () => {
    const content = `
### AC1 — Test criterion

**Given** a condition
**When** an action
**Then** a result
**And** another result
`;
    const acs = parseAcceptanceCriteria(content);
    expect(acs).toHaveLength(1);
    expect(acs[0].id).toBe("AC1");
    expect(acs[0].title).toBe("Test criterion");
    expect(acs[0].given).toBe("a condition");
    expect(acs[0].when).toBe("an action");
    expect(acs[0].then).toEqual(["a result", "another result"]);
  });

  it("returns empty array for content without ACs", () => {
    const acs = parseAcceptanceCriteria("# Just a title\n\nSome text");
    expect(acs).toEqual([]);
  });
});

describe("parseTasks", () => {
  it("parses checkbox tasks", () => {
    const content = `
- [ ] Unchecked task
- [x] Checked task
- [X] Also checked
- Not a task
`;
    const tasks = parseTasks(content);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toEqual({ label: "Unchecked task", done: false });
    expect(tasks[1]).toEqual({ label: "Checked task", done: true });
    expect(tasks[2]).toEqual({ label: "Also checked", done: true });
  });

  it("returns empty array when no tasks", () => {
    const tasks = parseTasks("No checkboxes here");
    expect(tasks).toEqual([]);
  });
});
