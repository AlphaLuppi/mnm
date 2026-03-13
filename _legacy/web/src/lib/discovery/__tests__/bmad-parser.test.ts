import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseWorkflows, parseAgents } from "../bmad-parser";

describe("bmad-parser", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bmad-parser-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function mkdirp(p: string) {
    fs.mkdirSync(p, { recursive: true });
  }

  function writeFile(relPath: string, content: string) {
    const abs = path.join(tmpDir, relPath);
    mkdirp(path.dirname(abs));
    fs.writeFileSync(abs, content, "utf-8");
  }

  describe("parseWorkflows", () => {
    it("returns empty array when _bmad/bmm/workflows does not exist", () => {
      const result = parseWorkflows(tmpDir);
      expect(result).toEqual([]);
    });

    it("parses workflow files in subdirectories", () => {
      writeFile(
        "_bmad/bmm/workflows/1-analysis/create-brief/workflow.md",
        "---\nname: create-brief\ndescription: Create a brief\n---\n# Workflow"
      );
      writeFile(
        "_bmad/bmm/workflows/1-analysis/create-brief/steps/step-01-init.md",
        "# Step 1"
      );
      writeFile(
        "_bmad/bmm/workflows/1-analysis/create-brief/steps/step-02-done.md",
        "# Step 2"
      );

      const result = parseWorkflows(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("create-brief");
      expect(result[0].description).toBe("Create a brief");
      expect(result[0].phase).toBe("analysis");
      expect(result[0].steps).toHaveLength(2);
      expect(result[0].steps[0].order).toBe(1);
      expect(result[0].steps[1].order).toBe(2);
    });

    it("parses workflow files at phase level (not nested in subdirectory)", () => {
      writeFile(
        "_bmad/bmm/workflows/generate-project-context/workflow.md",
        "---\nname: generate-context\ndescription: Generate project context\n---\n# Workflow"
      );
      writeFile(
        "_bmad/bmm/workflows/generate-project-context/steps/step-01-discover.md",
        "# Step 1"
      );

      const result = parseWorkflows(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("generate-context");
      expect(result[0].phase).toBe("documentation");
      expect(result[0].steps).toHaveLength(1);
    });

    it("handles steps-v, steps-c, steps-e variant directories", () => {
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/workflow-create-prd.md",
        "---\nname: create-prd\ndescription: Create PRD\n---\n# Create PRD"
      );
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-01-init.md",
        "# Create step 1"
      );
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-c/step-02-vision.md",
        "# Create step 2"
      );
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-v/step-v-01-discovery.md",
        "# Validate step 1"
      );
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-v/step-v-02-format.md",
        "# Validate step 2"
      );
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/steps-e/step-e-01-discovery.md",
        "# Edit step 1"
      );

      const result = parseWorkflows(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("create-prd");
      expect(result[0].steps).toHaveLength(5);

      // Check variant tagging
      const names = result[0].steps.map((s) => s.name);
      expect(names).toContain("[c] step-01-init");
      expect(names).toContain("[v] step-v-01-discovery");
      expect(names).toContain("[e] step-e-01-discovery");

      // Check ordering: step 1s first, then step 2s
      expect(result[0].steps[0].order).toBe(1);
      expect(result[0].steps[result[0].steps.length - 1].order).toBe(2);
    });

    it("parses multiple workflow files in the same directory", () => {
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/workflow-create-prd.md",
        "---\nname: create-prd\ndescription: Create PRD\n---"
      );
      writeFile(
        "_bmad/bmm/workflows/2-plan-workflows/create-prd/workflow-validate-prd.md",
        "---\nname: validate-prd\ndescription: Validate PRD\n---"
      );

      const result = parseWorkflows(tmpDir);
      expect(result).toHaveLength(2);
      const names = result.map((w) => w.name).sort();
      expect(names).toEqual(["create-prd", "validate-prd"]);
    });

    it("handles YAML workflow files", () => {
      writeFile(
        "_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml",
        "name: code-review\ndescription: Code review workflow"
      );

      const result = parseWorkflows(tmpDir);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("code-review");
      expect(result[0].phase).toBe("implementation");
    });
  });

  describe("parseAgents", () => {
    it("returns empty array when manifest does not exist", () => {
      const result = parseAgents(tmpDir);
      expect(result).toEqual([]);
    });

    it("parses agent manifest CSV", () => {
      writeFile(
        "_bmad/_config/agent-manifest.csv",
        [
          "name,displayName,title,icon,capabilities,role,identity,communicationStyle,principles,module,path",
          '"analyst","Mary","Business Analyst","icon","capabilities","Strategic Analyst","identity","style","principles","bmm","_bmad/bmm/agents/analyst.md"',
          '"dev","Amelia","Developer Agent","icon","capabilities","Senior Engineer","identity","style","principles","bmm","_bmad/bmm/agents/dev.md"',
        ].join("\n")
      );

      const result = parseAgents(tmpDir);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("analyst");
      expect(result[0].displayName).toBe("Mary");
      expect(result[0].title).toBe("Business Analyst");
      expect(result[0].module).toBe("bmm");
      expect(result[1].name).toBe("dev");
      expect(result[1].displayName).toBe("Amelia");
    });
  });
});
