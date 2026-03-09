import { AgentOrchestrator } from "./orchestrator";
import { recoverFromCrash, type RecoverySummary } from "./recovery";
import { createChildLogger } from "@/lib/core/logger";

export { AgentOrchestrator } from "./orchestrator";
export { ClaudeCodeBridge } from "./claude-code";
export { FileLockManager } from "./file-lock";
export { agentEventBus, type AgentEvent } from "./event-bus";
export { detectConflicts, checkNewAgentConflicts, type Conflict } from "./conflict-detector";
export { recoverFromCrash, type RecoverySummary } from "./recovery";

const log = createChildLogger({ module: "agent" });

let _orchestrator: AgentOrchestrator | null = null;
let _recoverySummary: RecoverySummary | null = null;

export function getOrchestrator(): AgentOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new AgentOrchestrator();

    // Run startup recovery
    _recoverySummary = recoverFromCrash();
    if (
      _recoverySummary.orphanedAgents > 0 ||
      _recoverySummary.releasedLocks > 0
    ) {
      log.info(_recoverySummary, "Startup recovery completed");
    }
  }
  return _orchestrator;
}

export function getRecoverySummary(): RecoverySummary | null {
  return _recoverySummary;
}
