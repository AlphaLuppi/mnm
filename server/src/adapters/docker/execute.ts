import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import type { Db } from "@mnm/db";

// Lazy-loaded db reference -- will be set by the heartbeat service or injected at call time
let _dbRef: Db | null = null;

export function setDbRef(db: Db) {
  _dbRef = db;
}

/**
 * Docker adapter execute -- legacy container manager has been removed.
 * This adapter is a stub and always returns an error.
 * Use the per-user pod system (sandboxes) instead.
 */
export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { onLog } = ctx;

  if (onLog) {
    await onLog("stderr", "Docker adapter: legacy container manager has been removed. Use the per-user pod system instead.\n");
  }

  return {
    exitCode: 1,
    signal: null,
    timedOut: false,
    errorMessage: "Docker adapter: legacy container manager has been removed. Use the per-user pod system instead.",
  };
}
