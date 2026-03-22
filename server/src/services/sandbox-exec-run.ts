/**
 * Sandbox Execution Router
 *
 * Intercepts agent execution and routes it through the user's Docker sandbox.
 * Instead of spawning `claude` locally, runs `docker exec` in the user's container.
 *
 * All agents run in the triggering user's personal sandbox.
 */

import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userPods, agentWakeupRequests, issues } from "@mnm/db";
import { getDockerClient } from "./docker-client.js";
import { logger } from "../middleware/logger.js";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../adapters/types.js";
import { agents } from "@mnm/db";

/**
 * Resolve the user whose sandbox should execute this run.
 * Priority: wakeup actor → issue assignee → issue creator → agent creator
 */
async function resolveActorUserId(
  db: Db,
  run: { wakeupRequestId: string | null },
  context: Record<string, unknown>,
  agent: { createdByUserId: string | null },
): Promise<string | null> {
  // 1. Manual run: wakeup request has the actor
  if (run.wakeupRequestId) {
    const [wakeup] = await db
      .select({ requestedByActorId: agentWakeupRequests.requestedByActorId })
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.id, run.wakeupRequestId));
    if (wakeup?.requestedByActorId) return wakeup.requestedByActorId;
  }

  // 2. Issue-based run
  const issueId = typeof context.issueId === "string" ? context.issueId : null;
  if (issueId) {
    const [issue] = await db
      .select({ assigneeUserId: issues.assigneeUserId, createdByUserId: issues.createdByUserId })
      .from(issues)
      .where(eq(issues.id, issueId));
    if (issue?.assigneeUserId) return issue.assigneeUserId;
    if (issue?.createdByUserId) return issue.createdByUserId;
  }

  // 3. Agent creator
  if (agent.createdByUserId) return agent.createdByUserId;

  return null;
}

/**
 * Find the running sandbox for a user.
 */
async function findUserSandbox(
  db: Db,
  userId: string,
  companyId: string,
): Promise<{ dockerContainerId: string } | null> {
  const [pod] = await db
    .select({ dockerContainerId: userPods.dockerContainerId, status: userPods.status })
    .from(userPods)
    .where(and(eq(userPods.userId, userId), eq(userPods.companyId, companyId)));

  if (!pod || pod.status !== "running" || !pod.dockerContainerId) return null;
  return { dockerContainerId: pod.dockerContainerId };
}

/**
 * Execute an agent run inside a user's Docker sandbox.
 * Replaces the local `adapter.execute()` call.
 */
export async function executeSandboxRun(
  db: Db,
  ctx: AdapterExecutionContext,
  run: { wakeupRequestId: string | null },
): Promise<AdapterExecutionResult | null> {
  const adapterAgent = ctx.agent;
  const context = ctx.context as Record<string, unknown>;

  // Load full agent from DB (adapter agent type doesn't have createdByUserId)
  const [fullAgent] = await db
    .select({ createdByUserId: agents.createdByUserId, companyId: agents.companyId })
    .from(agents)
    .where(eq(agents.id, adapterAgent.id));

  // 1. Resolve which user's sandbox to use
  const userId = await resolveActorUserId(db, run, context, {
    createdByUserId: fullAgent?.createdByUserId ?? null,
  });
  if (!userId) {
    logger.warn({ runId: ctx.runId, agentId: adapterAgent.id }, "Sandbox routing: no actor resolved — falling back to local");
    return null; // Signal to caller: use local execution fallback
  }

  // 2. Find the sandbox
  const sandbox = await findUserSandbox(db, userId, adapterAgent.companyId);
  if (!sandbox) {
    logger.warn({ runId: ctx.runId, userId, agentId: adapterAgent.id }, "Sandbox routing: no running sandbox for user — falling back to local");
    return null;
  }

  // 3. Build the claude command
  const config = ctx.config as Record<string, unknown>;
  const prompt = typeof context.prompt === "string" ? context.prompt : "";
  const issueTitle = typeof context.issueTitle === "string" ? context.issueTitle : "";
  const issueDescription = typeof context.issueDescription === "string" ? context.issueDescription : "";

  const claudeArgs: string[] = ["-p", "--output-format", "stream-json"];

  // Add model if specified
  const model = typeof config.model === "string" && config.model ? config.model : null;
  if (model) claudeArgs.push("--model", model);

  // Build the prompt text
  let fullPrompt = prompt;
  if (!fullPrompt && issueTitle) {
    fullPrompt = issueDescription
      ? `${issueTitle}\n\n${issueDescription}`
      : issueTitle;
  }
  if (!fullPrompt) fullPrompt = "Hello, please confirm you are operational.";

  // 4. Execute via docker exec
  const docker = getDockerClient();
  const container = docker.getContainer(sandbox.dockerContainerId);

  logger.info({
    runId: ctx.runId,
    agentId: adapterAgent.id,
    userId,
    containerId: sandbox.dockerContainerId,
  }, "Sandbox routing: executing claude in user container");

  // Set up env vars for the agent
  const envVars: string[] = [];
  if (ctx.authToken) envVars.push(`MNM_API_KEY=${ctx.authToken}`);
  envVars.push(`MNM_API_URL=http://host.docker.internal:3100`);
  envVars.push(`MNM_AGENT_ID=${adapterAgent.id}`);
  envVars.push(`MNM_RUN_ID=${ctx.runId}`);
  envVars.push(`MNM_COMPANY_ID=${adapterAgent.companyId}`);

  const envFlags = envVars.flatMap((e) => ["-e", e]);

  try {
    const exec = await container.exec({
      Cmd: ["bash", "-lc", `claude ${claudeArgs.join(" ")} "${fullPrompt.replace(/"/g, '\\"')}"`],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Env: envVars,
    });

    const stream = await exec.start({ Detach: false, Tty: false });

    let stdout = "";
    let stderr = "";

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        stream.destroy();
        resolve();
      }, 10 * 60 * 1000); // 10 min timeout

      stream.on("data", async (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        // Docker mux: first 8 bytes are header (stream type + size)
        // But with Tty:false, dockerode may already demux
        stdout += text;
        if (ctx.onLog) {
          try { await ctx.onLog("stdout", text); } catch { /* ignore */ }
        }
      });

      stream.on("end", () => { clearTimeout(timeout); resolve(); });
      stream.on("error", (err: Error) => {
        clearTimeout(timeout);
        stderr += err.message;
        reject(err);
      });
    });

    // Get exit code
    const inspectResult = await exec.inspect();
    const exitCode = inspectResult.ExitCode ?? 0;

    if (stderr && ctx.onLog) {
      try { await ctx.onLog("stderr", stderr); } catch { /* ignore */ }
    }

    return {
      exitCode,
      signal: null,
      timedOut: false,
      errorMessage: exitCode !== 0 ? `Claude exited with code ${exitCode}` : undefined,
    };
  } catch (err: any) {
    logger.error({ err: err.message, runId: ctx.runId }, "Sandbox execution failed");
    if (ctx.onLog) {
      try { await ctx.onLog("stderr", `Sandbox execution error: ${err.message}`); } catch { /* ignore */ }
    }
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Sandbox execution failed: ${err.message}`,
    };
  }
}
