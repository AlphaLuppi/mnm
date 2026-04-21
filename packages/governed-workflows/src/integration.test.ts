import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workflowDefinitionSchema } from "./workflow.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "__fixtures__", "hello-world.workflow.json");
const helloWorld: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("integration: hello-world workflow fixture", () => {
  it("parses the spec's hello-world workflow end-to-end", () => {
    const parsed = workflowDefinitionSchema.parse(helloWorld);

    expect(parsed.apiVersion).toBe("mnm/v1");
    expect(parsed.kind).toBe("GovernedWorkflow");
    expect(parsed.name).toBe("hello-world");
    expect(parsed.steps).toHaveLength(2);

    const [greet, shout] = parsed.steps;
    expect(greet.id).toBe("greet");
    expect(greet.agent).toBe("greeter");
    expect(greet.deps).toEqual([]);
    expect(greet.gates?.exit).toHaveLength(1);

    expect(shout.id).toBe("shout");
    expect(shout.agent).toBe("shouter");
    expect(shout.deps).toEqual(["greet"]);
    expect(shout.gates?.exit).toHaveLength(1);
  });

  it("declares the `name` variable as required string", () => {
    const parsed = workflowDefinitionSchema.parse(helloWorld);
    expect(parsed.variables.name).toEqual({
      type: "string",
      required: true,
    });
  });
});
