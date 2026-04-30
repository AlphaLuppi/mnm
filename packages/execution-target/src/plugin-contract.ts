// Phase 3 — Plugin contract for third-party execution-target providers
// (port of upstream PRs #4415 + #4449 — generalized provider core).
//
// External plugins (e2b, Modal, Daytona, …) implement this contract and
// register themselves via the registerExecutionTargetPlugin() helper
// during server boot. The core ships zero vendor implementations; even the
// "sandbox" driver in MnM is provided through a plugin (the in-tree
// Docker Sandbox is wrapped as a plugin under packages/adapters/sandbox).
//
// Why a plugin contract (vs. interface inheritance)?
// - Plugins must work without modifying core types.ts.
// - The factory needs metadata (driverId, config schema) before it can
//   instantiate a provider — schema validation happens upfront, not in
//   setup(). This is the upstream PR #4449 lesson learned: "generalize
//   provider core for plugin-only providers".

import type { ExecutionTarget, ExecutionTargetDriver } from "./types.js";

/**
 * A plugin descriptor — what the plugin tells the core about itself.
 */
export interface ExecutionTargetPluginDescriptor {
  /**
   * Driver tag this plugin handles. Must match `environments.driver` in DB.
   * Use "plugin" + a unique pluginId for vendor implementations to avoid
   * colliding with the built-in local/ssh/sandbox drivers.
   */
  driver: ExecutionTargetDriver;
  /** Stable plugin id (npm-package-style), used in env.metadata.pluginId. */
  pluginId: string;
  /** Human-readable label for ops dashboards. */
  displayName: string;
  /** Plugin SemVer for diagnostics + future capability gating. */
  version: string;
  /**
   * JSON-schema-like (Zod) validator for the per-environment `config` blob.
   * The factory runs this BEFORE construct(), so providers receive
   * already-validated configs.
   */
  validateConfig?: (config: unknown) => unknown;
  /** Optional capability flags surfaced to the orchestration layer. */
  capabilities?: {
    streaming?: boolean;
    teardownIsAsync?: boolean;
    supportsConcurrentRuns?: boolean;
  };
}

/**
 * Construction context passed to `construct()`. Includes the validated
 * config blob and the environment row id so the plugin can correlate
 * itself to a DB record (for telemetry, lease lookup, …).
 */
export interface PluginConstructContext {
  environmentId: string;
  companyId: string;
  /** Already-validated config (output of `descriptor.validateConfig`). */
  config: unknown;
}

/**
 * Plugin factory: takes a construct context, returns an ExecutionTarget.
 * Plugins MUST NOT do any I/O in this method — defer to setup().
 */
export type ExecutionTargetPluginFactory = (
  ctx: PluginConstructContext,
) => ExecutionTarget;

/**
 * Full plugin spec. Bundle this into a single export from the plugin pkg.
 *
 * @example
 * // packages/adapters/sandbox/src/plugin.ts
 * export const sandboxPlugin: ExecutionTargetPlugin = {
 *   descriptor: { driver: "sandbox", pluginId: "@mnm/sandbox", ... },
 *   construct: (ctx) => new SandboxProvider(ctx.environmentId, ctx.config),
 * };
 */
export interface ExecutionTargetPlugin {
  descriptor: ExecutionTargetPluginDescriptor;
  construct: ExecutionTargetPluginFactory;
}

/**
 * Registry — process-local in-memory map keyed by `descriptor.pluginId`.
 * Server boot registers all known plugins; the factory looks them up
 * when an Environment row carries `metadata.pluginId`.
 */
const REGISTRY = new Map<string, ExecutionTargetPlugin>();

export function registerExecutionTargetPlugin(plugin: ExecutionTargetPlugin): void {
  if (REGISTRY.has(plugin.descriptor.pluginId)) {
    throw new Error(
      `Execution-target plugin already registered: ${plugin.descriptor.pluginId}`,
    );
  }
  REGISTRY.set(plugin.descriptor.pluginId, plugin);
}

export function getExecutionTargetPlugin(pluginId: string): ExecutionTargetPlugin | undefined {
  return REGISTRY.get(pluginId);
}

export function listExecutionTargetPlugins(): readonly ExecutionTargetPlugin[] {
  return Array.from(REGISTRY.values());
}

/** Test helper — clear registry between tests. NOT for production code. */
export function __resetExecutionTargetPluginRegistryForTests(): void {
  REGISTRY.clear();
}
