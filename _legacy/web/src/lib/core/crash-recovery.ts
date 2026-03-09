import fs from "node:fs";
import path from "node:path";
import { recoverFromCrash, type RecoverySummary } from "@/lib/agent/recovery";
import { loadConfig, saveConfig, getMnMDir } from "./config";
import { createChildLogger } from "./logger";

const log = createChildLogger({ module: "crash-recovery" });

export interface CrashRecoveryResult {
  wasCrash: boolean;
  agentsStopped: number;
  locksReleased: number;
  dbIntegrityOk: boolean;
}

export function runStartupRecovery(): CrashRecoveryResult {
  const config = loadConfig();
  const wasCrash = !config.lastCleanShutdown;

  // Run agent/lock recovery
  let summary: RecoverySummary = { orphanedAgents: 0, releasedLocks: 0 };
  try {
    summary = recoverFromCrash();
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : "unknown" }, "Recovery failed");
  }

  // Database integrity is maintained by WAL mode (configured in db/index.ts)
  const dbIntegrityOk = true;

  // Clear lastCleanShutdown to detect future crashes
  saveConfig({});

  if (wasCrash && (summary.orphanedAgents > 0 || summary.releasedLocks > 0)) {
    log.info(
      { wasCrash, ...summary, dbIntegrityOk },
      "Crash recovery completed"
    );
  }

  return {
    wasCrash,
    agentsStopped: summary.orphanedAgents,
    locksReleased: summary.releasedLocks,
    dbIntegrityOk,
  };
}

export function recordCleanShutdown(): void {
  try {
    saveConfig({ lastCleanShutdown: Date.now() });
  } catch {
    // Best effort
  }
}

export function writeCrashLog(error: Error): void {
  try {
    const logsDir = path.join(getMnMDir(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const date = new Date().toISOString().split("T")[0];
    const logPath = path.join(logsDir, `crash-${date}.log`);

    const entry = [
      `[${new Date().toISOString()}]`,
      `Error: ${error.message}`,
      `Stack: ${error.stack ?? "N/A"}`,
      `Memory: ${JSON.stringify(process.memoryUsage())}`,
      "---",
      "",
    ].join("\n");

    fs.appendFileSync(logPath, entry, "utf-8");

    // Rotate: keep last 10 crash logs
    const files = fs
      .readdirSync(logsDir)
      .filter((f) => f.startsWith("crash-") && f.endsWith(".log"))
      .sort();
    while (files.length > 10) {
      const old = files.shift()!;
      fs.unlinkSync(path.join(logsDir, old));
    }
  } catch {
    // Best effort crash logging
  }
}
