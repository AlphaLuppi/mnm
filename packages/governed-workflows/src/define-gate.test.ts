import { describe, expect, it } from "vitest";
import { defineGate } from "./define-gate.js";
import type { GateContext } from "./gate-context.js";

function mockContext<A, C extends Record<string, unknown>>(
  artifact: A | undefined,
  config: C,
  kind: string = "exit",
): GateContext<A, C> {
  return {
    artifact,
    run: {
      id: "run-1",
      workflow_name: "hello-world",
      git_tag: "v1.0.0",
      params: {},
    },
    step: { id: "greet", previous_artifacts: {} },
    config,
    kind,
    helpers: {},
  };
}

describe("defineGate", () => {
  it("returns the same function identity (no runtime wrapping)", () => {
    const fn = async () => ({ pass: true, report: "ok" });
    const wrapped = defineGate(fn);
    expect(wrapped).toBe(fn);
  });

  it("supports sync gate functions", async () => {
    const gate = defineGate(() => ({ pass: true, report: "sync ok" }));
    const result = await gate(mockContext(undefined, {}));
    expect(result).toEqual({ pass: true, report: "sync ok" });
  });

  it("supports async gate functions with typed artifact + config", async () => {
    type Artifact = { greeting: string };
    type Config = { minLength: number };

    const gate = defineGate<Artifact, Config>(async (ctx) => {
      if (!ctx.artifact || ctx.artifact.greeting.length < ctx.config.minLength) {
        return { pass: false, report: "too short" };
      }
      return { pass: true, report: `ok: ${ctx.artifact.greeting}` };
    });

    const pass = await gate(
      mockContext<Artifact, Config>({ greeting: "Hello, Tom!" }, { minLength: 3 }),
    );
    expect(pass.pass).toBe(true);
    expect(pass.report).toBe("ok: Hello, Tom!");

    const fail = await gate(
      mockContext<Artifact, Config>({ greeting: "Hi" }, { minLength: 3 }),
    );
    expect(fail.pass).toBe(false);
  });

  it("exposes the kind passed by the runner", async () => {
    const gate = defineGate((ctx) => ({ pass: true, report: `kind=${ctx.kind}` }));
    const result = await gate(mockContext(undefined, {}, "entry"));
    expect(result.report).toBe("kind=entry");
  });
});
