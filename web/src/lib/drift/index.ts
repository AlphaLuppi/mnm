import { agentEventBus } from "@/lib/agent/event-bus";
import { detectDrift } from "./detector";
import * as agentRepo from "@/lib/db/repositories/agents";
import { createChildLogger } from "@/lib/core/logger";

export { detectDrift, type DriftDetectionOptions } from "./detector";
export { analyzeDrift, type DriftResult } from "./analyzer";
export { loadCustomInstructions } from "./instructions";
export { buildDriftPrompt } from "./prompts";
export {
  inferScopeFromSpec,
  getSuggestedScope,
  scanRepositoryForCodeFiles,
  type InferredScope,
} from "./scope-inference";

const log = createChildLogger({ module: "drift" });

let _initialized = false;

export function initDriftDetection(): void {
  if (_initialized) return;
  _initialized = true;

  agentEventBus.on("completed", (event: { agentId: string }) => {
    const agent = agentRepo.findById(event.agentId);
    if (!agent?.specId) return;

    // Fire-and-forget: don't block the completion handler
    detectDrift(event.agentId, agent.specId).catch((err) => {
      log.error(
        { agentId: event.agentId, error: err instanceof Error ? err.message : String(err) },
        "Automatic drift detection failed"
      );
    });
  });

  log.info("Drift detection auto-trigger initialized");
}
