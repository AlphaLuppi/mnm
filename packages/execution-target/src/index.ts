// Phase 3 — @mnm/execution-target public surface.
// Re-export contract + factory + built-in providers + plugin API.

export type {
  ExecutionTarget,
  ExecutionTargetDriver,
  RunOptions,
  RunResult,
  SetupState,
  StreamCallback,
} from "./types.js";

export { LocalProvider, type LocalProviderConfig } from "./local-provider.js";
export {
  SshProvider,
  SshProviderNotImplementedError,
  type SshProviderConfig,
} from "./ssh-provider.js";

export {
  getExecutionTarget,
  type EnvironmentLike,
  UnknownExecutionTargetDriverError,
  MissingPluginIdError,
  PluginNotRegisteredError,
} from "./factory.js";

export {
  registerExecutionTargetPlugin,
  getExecutionTargetPlugin,
  listExecutionTargetPlugins,
  __resetExecutionTargetPluginRegistryForTests,
  type ExecutionTargetPlugin,
  type ExecutionTargetPluginDescriptor,
  type ExecutionTargetPluginFactory,
  type PluginConstructContext,
} from "./plugin-contract.js";
