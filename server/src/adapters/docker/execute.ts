import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { containerManagerService } from "../../services/container-manager.js";
import type { Db } from "@mnm/db";
import { asString, parseObject } from "../utils.js";

// Lazy-loaded db reference -- will be set by the heartbeat service or injected at call time
let _dbRef: Db | null = null;

export function setDbRef(db: Db) {
  _dbRef = db;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { agent, config, onLog, onMeta } = ctx;

  const dockerImage = asString(config.dockerImage, "node:20-slim");
  const companyId = agent.companyId;
  const agentId = agent.id;

  if (onMeta) {
    await onMeta({
      adapterType: "docker",
      command: `docker run ${dockerImage}`,
      context: { dockerImage, agentId, companyId },
    });
  }

  if (!_dbRef) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "Docker adapter: database reference not initialized. Call setDbRef() first.",
    };
  }

  try {
    const containerManager = containerManagerService(_dbRef);
    const result = await containerManager.launchContainer(agentId, companyId, "system", {
      dockerImage,
      environmentVars: parseObject(config.env) as Record<string, string>,
    });

    if (onLog) {
      await onLog("stdout", `Container started: ${result.dockerContainerId} (profile: ${result.profileName})\n`);
    }

    // The container runs asynchronously -- the adapter returns immediately
    // The monitoring loop in ContainerManager handles completion/failure
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      resultJson: {
        instanceId: result.instanceId,
        dockerContainerId: result.dockerContainerId,
        status: result.status,
      },
    };
  } catch (err: any) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Docker adapter error: ${err.message}`,
    };
  }
}
