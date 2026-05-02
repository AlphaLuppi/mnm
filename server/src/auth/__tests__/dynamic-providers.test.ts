import { describe, it, expect } from "vitest";
import { mergeProviderConfigs } from "../dynamic-providers.js";

describe("dynamic-providers — mergeProviderConfigs (T3.5 backward compat)", () => {
  it("returns env providers when no DB providers", () => {
    const env = { gitlab: { clientId: "env-gl" }, microsoft: { clientId: "env-ms" } };
    const merged = mergeProviderConfigs(env, {});
    expect(merged).toEqual(env);
  });

  it("returns DB providers when no env providers", () => {
    const dbp = { jira: { clientId: "db-jira" } };
    const merged = mergeProviderConfigs({}, dbp);
    expect(merged).toEqual(dbp);
  });

  it("DB wins on slug collision (gitlab env vs DB-configured gitlab)", () => {
    const env = { gitlab: { clientId: "env-gl-fallback" } };
    const dbp = { gitlab: { clientId: "db-gl-override" } };
    const merged = mergeProviderConfigs(env, dbp);
    expect(merged.gitlab).toEqual({ clientId: "db-gl-override" });
  });

  it("preserves env entries that have no DB equivalent (mixed merge)", () => {
    const env = {
      gitlab: { clientId: "env-gl" },
      microsoft: { clientId: "env-ms" },
    };
    const dbp = { jira: { clientId: "db-jira" }, slack: { clientId: "db-sl" } };
    const merged = mergeProviderConfigs(env, dbp);
    expect(Object.keys(merged).sort()).toEqual(["gitlab", "jira", "microsoft", "slack"]);
    expect(merged.gitlab).toEqual({ clientId: "env-gl" });
    expect(merged.microsoft).toEqual({ clientId: "env-ms" });
    expect(merged.jira).toEqual({ clientId: "db-jira" });
    expect(merged.slack).toEqual({ clientId: "db-sl" });
  });

  it("empty + empty = empty (no providers)", () => {
    expect(mergeProviderConfigs({}, {})).toEqual({});
  });
});
