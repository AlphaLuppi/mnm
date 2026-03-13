import { ClaudeCodeBridge } from "./claude-code";
import { FileLockManager } from "./file-lock";
import { agentEventBus } from "./event-bus";
import * as agentRepo from "@/lib/db/repositories/agents";
import { AgentError } from "@/lib/core/errors";
import { createChildLogger } from "@/lib/core/logger";
import { loadConfig } from "@/lib/core/config";
import { createInterface } from "readline";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import type { Agent } from "@/lib/core/types";

const log = createChildLogger({ module: "orchestrator" });

export class AgentOrchestrator {
  private processes = new Map<string, ClaudeCodeBridge>();
  private logBuffers = new Map<string, string[]>();
  readonly fileLockManager = new FileLockManager();

  spawn(specId: string, agentType: string, scope: string[]): Agent {
    const config = loadConfig();
    const id = crypto.randomUUID();
    const now = Date.now();
    const name = `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent`;

    // Acquire file locks before spawning
    this.fileLockManager.acquireLocks(id, scope, "write");

    // Create DB record
    agentRepo.insert({
      id,
      name,
      status: "running",
      specId,
      scope: JSON.stringify(scope),
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    let bridge: ClaudeCodeBridge;
    try {
      bridge = ClaudeCodeBridge.spawn(
        specId,
        scope,
        config.repositoryPath
      );
    } catch (err) {
      // Rollback: release locks and mark agent as error
      this.fileLockManager.releaseLocks(id);
      agentRepo.update(id, {
        status: "error",
        errorMessage:
          err instanceof Error ? err.message : "Unknown spawn error",
        completedAt: now,
      });
      throw err instanceof AgentError
        ? err
        : AgentError.spawnFailed(
            err instanceof Error ? err.message : "Unknown error"
          );
    }

    this.processes.set(id, bridge);
    this.logBuffers.set(id, []);

    // Set up log file writer
    const repoRoot = config.repositoryPath;
    const logsDir = join(repoRoot, ".mnm", "logs");
    mkdirSync(logsDir, { recursive: true });
    const logWriter = createWriteStream(join(logsDir, `${id}.log`), {
      flags: "a",
    });

    // Process stdout with readline for line buffering
    if (bridge.stdout) {
      const rl = createInterface({ input: bridge.stdout });
      rl.on("line", (line) => {
        const buffer = this.logBuffers.get(id);
        if (buffer) {
          buffer.push(line);
          // Keep only last 500 lines in memory
          if (buffer.length > 500) buffer.shift();
        }
        logWriter.write(`[stdout] ${line}\n`);
      });
    }

    if (bridge.stderr) {
      const rl = createInterface({ input: bridge.stderr });
      rl.on("line", (line) => {
        const buffer = this.logBuffers.get(id);
        if (buffer) {
          buffer.push(`[stderr] ${line}`);
          if (buffer.length > 500) buffer.shift();
        }
        logWriter.write(`[stderr] ${line}\n`);
      });
    }

    // Handle process exit
    bridge.process.on("close", (code: number | null) => {
      const status = code === 0 ? "completed" : "error";
      const errorMsg =
        code !== 0 ? `Process exited with code ${code}` : undefined;

      agentRepo.update(id, {
        status,
        completedAt: Date.now(),
        ...(errorMsg ? { errorMessage: errorMsg } : {}),
      });

      this.fileLockManager.releaseLocks(id);
      this.processes.delete(id);
      logWriter.end();

      agentEventBus.emitAgentEvent(
        status === "completed"
          ? { type: "completed", agentId: id, filesModified: [] }
          : { type: "error", agentId: id, error: errorMsg! }
      );

      log.info({ agentId: id, code, status }, "Agent process exited");
    });

    // Handle spawn-level errors
    bridge.process.on("error", (err: Error) => {
      log.error({ agentId: id, error: err.message }, "Agent process error");

      agentRepo.update(id, {
        status: "error",
        errorMessage: err.message,
        completedAt: Date.now(),
      });

      this.fileLockManager.releaseLocks(id);
      this.processes.delete(id);
      logWriter.end();

      agentEventBus.emitAgentEvent({
        type: "error",
        agentId: id,
        error: err.message,
      });
    });

    agentEventBus.emitAgentEvent({
      type: "started",
      agentId: id,
      specId,
    });

    log.info({ agentId: id, agentType, specId, scope }, "Agent spawned");

    return agentRepo.findById(id) as Agent;
  }

  pause(agentId: string): void {
    const bridge = this.processes.get(agentId);
    if (!bridge) throw AgentError.notFound(agentId);

    bridge.pause();
    agentRepo.update(agentId, { status: "paused" });
    log.info({ agentId }, "Agent paused");
  }

  resume(agentId: string): void {
    const bridge = this.processes.get(agentId);
    if (!bridge) throw AgentError.notFound(agentId);

    bridge.resume();
    agentRepo.update(agentId, { status: "running" });
    log.info({ agentId }, "Agent resumed");
  }

  terminate(agentId: string): void {
    const bridge = this.processes.get(agentId);
    if (!bridge) {
      // Agent may already be terminated; just release locks
      this.fileLockManager.releaseLocks(agentId);
      return;
    }

    bridge.terminate();

    // Force kill if SIGTERM doesn't work within 5 seconds
    const timeout = setTimeout(() => {
      try {
        bridge.process.kill("SIGKILL");
      } catch {
        // Process may already be gone
      }
    }, 5000);

    bridge.process.once("close", () => {
      clearTimeout(timeout);
    });

    log.info({ agentId }, "Agent terminate requested");
  }

  getStatus(agentId: string): Agent | undefined {
    return agentRepo.findById(agentId) as Agent | undefined;
  }

  list(): Agent[] {
    return agentRepo.findAll() as Agent[];
  }

  getProcess(agentId: string): ClaudeCodeBridge | undefined {
    return this.processes.get(agentId);
  }

  getLogBuffer(agentId: string): string[] {
    return this.logBuffers.get(agentId) ?? [];
  }

  isRunning(agentId: string): boolean {
    return this.processes.has(agentId);
  }
}
