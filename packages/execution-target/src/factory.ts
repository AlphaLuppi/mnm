// Phase 3 — Factory bridging Environment rows to ExecutionTarget instances.
// This is the only seam server code (heartbeat.ts) touches at runtime.
// Routing rules:
//  - driver === "local"   -> LocalProvider
//  - driver === "ssh"     -> SshProvider (currently throws on use — stub)
//  - driver === "sandbox" -> looked up via plugin registry (in-tree
//                             @mnm/sandbox plugin owns this)
//  - driver === "plugin"  -> looked up via plugin registry, requires
//                             environment.metadata.pluginId to be set
//
// Anything else throws UnknownExecutionTargetDriverError.

import type { ExecutionTarget, ExecutionTargetDriver } from "./types.js";
import { LocalProvider, type LocalProviderConfig } from "./local-provider.js";
import { SshProvider, type SshProviderConfig } from "./ssh-provider.js";
import { getExecutionTargetPlugin } from "./plugin-contract.js";

export class UnknownExecutionTargetDriverError extends Error {
  constructor(driver: string) {
    super(`Unknown execution-target driver: ${driver}`);
    this.name = "UnknownExecutionTargetDriverError";
  }
}

export class MissingPluginIdError extends Error {
  constructor(driver: string) {
    super(
      `Execution-target driver "${driver}" requires environment.metadata.pluginId, but none was provided.`,
    );
    this.name = "MissingPluginIdError";
  }
}

export class PluginNotRegisteredError extends Error {
  constructor(pluginId: string) {
    super(`No execution-target plugin registered for pluginId: ${pluginId}`);
    this.name = "PluginNotRegisteredError";
  }
}

/**
 * Subset of an Environment row needed to build a provider. Kept minimal so
 * we don't drag the full Drizzle row type into client packages.
 */
export interface EnvironmentLike {
  id: string;
  companyId: string;
  driver: ExecutionTargetDriver | string;
  config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Build an ExecutionTarget from an Environment row. Caller is responsible
 * for invoking setup() / teardown() and persisting the lease.
 */
export function getExecutionTarget(env: EnvironmentLike): ExecutionTarget {
  switch (env.driver) {
    case "local":
      return new LocalProvider(env.id, (env.config ?? {}) as LocalProviderConfig);
    case "ssh":
      return new SshProvider(env.id, (env.config ?? {}) as unknown as SshProviderConfig);
    case "sandbox":
    case "plugin": {
      const pluginId = env.metadata?.pluginId;
      if (typeof pluginId !== "string" || pluginId.length === 0) {
        throw new MissingPluginIdError(env.driver);
      }
      const plugin = getExecutionTargetPlugin(pluginId);
      if (!plugin) throw new PluginNotRegisteredError(pluginId);
      const validatedConfig = plugin.descriptor.validateConfig
        ? plugin.descriptor.validateConfig(env.config ?? {})
        : (env.config ?? {});
      return plugin.construct({
        environmentId: env.id,
        companyId: env.companyId,
        config: validatedConfig,
      });
    }
    default:
      throw new UnknownExecutionTargetDriverError(String(env.driver));
  }
}
