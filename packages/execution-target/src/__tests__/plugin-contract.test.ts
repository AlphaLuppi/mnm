import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import {
  __resetExecutionTargetPluginRegistryForTests,
  registerExecutionTargetPlugin,
  getExecutionTargetPlugin,
  listExecutionTargetPlugins,
  type ExecutionTargetPlugin,
  type ExecutionTargetPluginDescriptor,
} from "../plugin-contract.js";
import {
  getExecutionTarget,
  MissingPluginIdError,
  PluginNotRegisteredError,
  UnknownExecutionTargetDriverError,
} from "../factory.js";
import type { ExecutionTarget, RunOptions, RunResult, SetupState } from "../types.js";

class FakeProvider implements ExecutionTarget {
  public readonly driver = "plugin" as const;
  public readonly environmentId: string;
  constructor(environmentId: string) {
    this.environmentId = environmentId;
  }
  async setup(): Promise<SetupState> {
    return { providerLeaseId: `fake-${this.environmentId}` };
  }
  async run(_opts: RunOptions): Promise<RunResult> {
    return {
      exitCode: 0,
      stdout: "fake",
      stderr: "",
      timedOut: false,
      aborted: false,
    };
  }
  async teardown(): Promise<void> {
    // no-op
  }
}

const fakePlugin: ExecutionTargetPlugin = {
  descriptor: {
    driver: "plugin",
    pluginId: "@mnm/test-plugin",
    displayName: "Test Plugin",
    version: "0.0.1",
    capabilities: { streaming: false, supportsConcurrentRuns: true },
  },
  construct: (ctx) => new FakeProvider(ctx.environmentId),
};

describe("plugin-contract types", () => {
  it("ExecutionTargetPluginDescriptor exposes driver + pluginId + version", () => {
    expectTypeOf<ExecutionTargetPluginDescriptor>().toMatchTypeOf<{
      driver: string;
      pluginId: string;
      version: string;
    }>();
  });
});

describe("plugin registry", () => {
  beforeEach(() => __resetExecutionTargetPluginRegistryForTests());
  afterEach(() => __resetExecutionTargetPluginRegistryForTests());

  it("register + lookup roundtrip", () => {
    registerExecutionTargetPlugin(fakePlugin);
    const found = getExecutionTargetPlugin("@mnm/test-plugin");
    expect(found?.descriptor.driver).toBe("plugin");
  });

  it("listExecutionTargetPlugins() returns all registered plugins", () => {
    registerExecutionTargetPlugin(fakePlugin);
    expect(listExecutionTargetPlugins()).toHaveLength(1);
  });

  it("registering the same pluginId twice throws", () => {
    registerExecutionTargetPlugin(fakePlugin);
    expect(() => registerExecutionTargetPlugin(fakePlugin)).toThrow(
      /already registered/i,
    );
  });

  it("lookup of unknown pluginId returns undefined", () => {
    expect(getExecutionTargetPlugin("@mnm/nope")).toBeUndefined();
  });
});

describe("getExecutionTarget factory", () => {
  beforeEach(() => __resetExecutionTargetPluginRegistryForTests());
  afterEach(() => __resetExecutionTargetPluginRegistryForTests());

  it("driver=local builds a LocalProvider without plugin lookup", () => {
    const t = getExecutionTarget({
      id: "env-1",
      companyId: "c1",
      driver: "local",
      config: {},
      metadata: null,
    });
    expect(t.driver).toBe("local");
    expect(t.environmentId).toBe("env-1");
  });

  it("driver=ssh builds an SshProvider stub (does not call setup)", () => {
    const t = getExecutionTarget({
      id: "env-ssh",
      companyId: "c1",
      driver: "ssh",
      config: { host: "h", username: "u" },
      metadata: null,
    });
    expect(t.driver).toBe("ssh");
  });

  it("driver=sandbox without metadata.pluginId throws MissingPluginIdError", () => {
    expect(() =>
      getExecutionTarget({
        id: "env-sb",
        companyId: "c1",
        driver: "sandbox",
        config: {},
        metadata: null,
      }),
    ).toThrow(MissingPluginIdError);
  });

  it("driver=plugin with unregistered pluginId throws PluginNotRegisteredError", () => {
    expect(() =>
      getExecutionTarget({
        id: "env-p",
        companyId: "c1",
        driver: "plugin",
        config: {},
        metadata: { pluginId: "@mnm/missing" },
      }),
    ).toThrow(PluginNotRegisteredError);
  });

  it("driver=plugin with registered plugin builds via plugin.construct()", () => {
    registerExecutionTargetPlugin(fakePlugin);
    const t = getExecutionTarget({
      id: "env-p2",
      companyId: "c1",
      driver: "plugin",
      config: { foo: "bar" },
      metadata: { pluginId: "@mnm/test-plugin" },
    });
    expect(t.driver).toBe("plugin");
    expect(t.environmentId).toBe("env-p2");
  });

  it("unknown driver throws UnknownExecutionTargetDriverError", () => {
    expect(() =>
      getExecutionTarget({
        id: "env-x",
        companyId: "c1",
        driver: "wat" as "local",
        config: {},
        metadata: null,
      }),
    ).toThrow(UnknownExecutionTargetDriverError);
  });

  it("plugin.validateConfig is invoked before construct()", () => {
    let validatedWith: unknown = null;
    const plugin: ExecutionTargetPlugin = {
      descriptor: {
        driver: "plugin",
        pluginId: "@mnm/validating-plugin",
        displayName: "Validating Plugin",
        version: "1.0.0",
        validateConfig: (cfg) => {
          validatedWith = cfg;
          return { ok: true, original: cfg };
        },
      },
      construct: (ctx) => {
        // The validated config (not the raw env.config) must be visible.
        expect((ctx.config as { ok: boolean }).ok).toBe(true);
        return new FakeProvider(ctx.environmentId);
      },
    };
    registerExecutionTargetPlugin(plugin);
    getExecutionTarget({
      id: "env-validate",
      companyId: "c1",
      driver: "plugin",
      config: { hello: "world" },
      metadata: { pluginId: "@mnm/validating-plugin" },
    });
    expect((validatedWith as { hello: string }).hello).toBe("world");
  });
});
