import Docker from "dockerode";
import type { Db } from "@mnm/db";
import { containerInstances } from "@mnm/db";
import { and, eq, inArray } from "drizzle-orm";
import type { ChatPipeStatus, ContainerPipeStatus } from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";
import { chatService } from "./chat.js";
import { logger as parentLogger } from "../middleware/logger.js";

const logger = parentLogger.child({ module: "container-pipe" });

const STDOUT_DEBOUNCE_MS = 200;
const STDOUT_MAX_BUFFER = 4000;

// chat-s03-pipe-service
export interface PipeAttachOptions {
  channelId: string;
  instanceId: string;
  companyId: string;
  actorId: string;
  agentId: string;
  execCommand?: string[];
  tty?: boolean;
}

interface ActivePipe {
  channelId: string;
  instanceId: string;
  companyId: string;
  agentId: string;
  status: ContainerPipeStatus;
  attachedAt: Date | null;
  detachedAt: Date | null;
  error: string | null;
  messagesPiped: number;
  // Docker exec resources
  execInstance: Docker.Exec | null;
  stdoutStream: NodeJS.ReadableStream | null;
  stdinStream: NodeJS.WritableStream | null;
  // Debounce state
  stdoutBuffer: string;
  stderrBuffer: string;
  stdoutTimer: ReturnType<typeof setTimeout> | null;
  stderrTimer: ReturnType<typeof setTimeout> | null;
}

// chat-s03-pipe-service
export function createContainerPipeManager(db: Db) {
  const docker = new Docker({ socketPath: "/var/run/docker.sock" });
  const svc = chatService(db);

  // channelId -> ActivePipe
  const activePipes = new Map<string, ActivePipe>();

  // Reference to ChatWsManager broadcastLocal — set externally
  let broadcastFn: ((channelId: string, payload: unknown) => void) | null = null;

  function setBroadcastFunction(fn: (channelId: string, payload: unknown) => void) {
    broadcastFn = fn;
  }

  // chat-s03-debounce-flush
  function flushStdoutBuffer(pipe: ActivePipe) {
    if (pipe.stdoutBuffer.length === 0) return;

    const content = pipe.stdoutBuffer;
    pipe.stdoutBuffer = "";
    pipe.stdoutTimer = null;

    void (async () => {
      try {
        // chat-s03-stdout-handler — create agent message from stdout
        const message = await svc.createMessage(
          pipe.channelId,
          pipe.companyId,
          pipe.agentId,
          "agent",
          content,
          { stream: "stdout" },
          { messageType: "text" },
        );

        pipe.messagesPiped++;

        // Broadcast via live events for connected WS clients
        publishLiveEvent({
          companyId: pipe.companyId,
          type: "chat.message_sent",
          payload: {
            messageId: message.id,
            channelId: pipe.channelId,
            senderId: pipe.agentId,
            senderType: "agent",
          },
        });
      } catch (err) {
        logger.warn({ err, channelId: pipe.channelId }, "Failed to persist stdout message");
      }
    })();
  }

  function flushStderrBuffer(pipe: ActivePipe) {
    if (pipe.stderrBuffer.length === 0) return;

    const content = pipe.stderrBuffer;
    pipe.stderrBuffer = "";
    pipe.stderrTimer = null;

    void (async () => {
      try {
        // chat-s03-stderr-handler — create system message from stderr
        await svc.createMessage(
          pipe.channelId,
          pipe.companyId,
          pipe.agentId,
          "agent",
          content,
          { stream: "stderr" },
          { messageType: "system" },
        );

        pipe.messagesPiped++;
      } catch (err) {
        logger.warn({ err, channelId: pipe.channelId }, "Failed to persist stderr message");
      }
    })();
  }

  function appendToStdoutBuffer(pipe: ActivePipe, chunk: string) {
    pipe.stdoutBuffer += chunk;

    // Flush immediately if buffer exceeds max
    if (pipe.stdoutBuffer.length >= STDOUT_MAX_BUFFER) {
      if (pipe.stdoutTimer) {
        clearTimeout(pipe.stdoutTimer);
        pipe.stdoutTimer = null;
      }
      flushStdoutBuffer(pipe);
      return;
    }

    // Reset debounce timer
    if (pipe.stdoutTimer) {
      clearTimeout(pipe.stdoutTimer);
    }
    pipe.stdoutTimer = setTimeout(() => flushStdoutBuffer(pipe), STDOUT_DEBOUNCE_MS);
  }

  function appendToStderrBuffer(pipe: ActivePipe, chunk: string) {
    pipe.stderrBuffer += chunk;

    if (pipe.stderrBuffer.length >= STDOUT_MAX_BUFFER) {
      if (pipe.stderrTimer) {
        clearTimeout(pipe.stderrTimer);
        pipe.stderrTimer = null;
      }
      flushStderrBuffer(pipe);
      return;
    }

    if (pipe.stderrTimer) {
      clearTimeout(pipe.stderrTimer);
    }
    pipe.stderrTimer = setTimeout(() => flushStderrBuffer(pipe), STDOUT_DEBOUNCE_MS);
  }

  function cleanupPipeResources(pipe: ActivePipe) {
    if (pipe.stdoutTimer) {
      clearTimeout(pipe.stdoutTimer);
      flushStdoutBuffer(pipe);
    }
    if (pipe.stderrTimer) {
      clearTimeout(pipe.stderrTimer);
      flushStderrBuffer(pipe);
    }

    if (pipe.stdinStream) {
      try {
        pipe.stdinStream.end();
      } catch {
        // ignore
      }
      pipe.stdinStream = null;
    }

    if (pipe.stdoutStream) {
      try {
        (pipe.stdoutStream as any).destroy?.();
      } catch {
        // ignore
      }
      pipe.stdoutStream = null;
    }

    pipe.execInstance = null;
  }

  function toPipeStatus(pipe: ActivePipe): ChatPipeStatus {
    return {
      channelId: pipe.channelId,
      instanceId: pipe.instanceId,
      status: pipe.status,
      attachedAt: pipe.attachedAt?.toISOString() ?? null,
      detachedAt: pipe.detachedAt?.toISOString() ?? null,
      error: pipe.error,
      messagesPiped: pipe.messagesPiped,
    };
  }

  // chat-s03-pipe-attach-fn
  async function attachPipe(opts: PipeAttachOptions): Promise<ChatPipeStatus> {
    const { channelId, instanceId, companyId, actorId, agentId } = opts;

    // chat-s03-double-attach — prevent double attach
    if (activePipes.has(channelId)) {
      const existing = activePipes.get(channelId)!;
      if (existing.status === "attached") {
        throw new Error("PIPE_ALREADY_ATTACHED");
      }
    }

    // Verify container instance is running
    const [instance] = await db
      .select()
      .from(containerInstances)
      .where(
        and(
          eq(containerInstances.id, instanceId),
          eq(containerInstances.companyId, companyId),
        ),
      );

    if (!instance) {
      throw new Error("CONTAINER_NOT_FOUND");
    }

    if (instance.status !== "running") {
      throw new Error("CONTAINER_NOT_RUNNING");
    }

    if (!instance.dockerContainerId) {
      throw new Error("CONTAINER_NO_DOCKER_ID");
    }

    const execCommand = opts.execCommand ?? ["/bin/sh"];
    const tty = opts.tty ?? false;

    const pipe: ActivePipe = {
      channelId,
      instanceId,
      companyId,
      agentId,
      status: "attached",
      attachedAt: new Date(),
      detachedAt: null,
      error: null,
      messagesPiped: 0,
      execInstance: null,
      stdoutStream: null,
      stdinStream: null,
      stdoutBuffer: "",
      stderrBuffer: "",
      stdoutTimer: null,
      stderrTimer: null,
    };

    try {
      const container = docker.getContainer(instance.dockerContainerId);

      // Create exec instance with stdin/stdout/stderr attached
      const exec = await container.exec({
        Cmd: execCommand,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: tty,
      });

      const execStream = await exec.start({
        hijack: true,
        stdin: true,
      });

      pipe.execInstance = exec;
      pipe.stdinStream = execStream;

      // Docker multiplexes stdout/stderr on the same stream
      // For non-TTY, Docker uses a header to distinguish stdout vs stderr
      // For TTY mode, everything comes on stdout
      if (tty) {
        execStream.on("data", (chunk: Buffer) => {
          appendToStdoutBuffer(pipe, chunk.toString("utf-8"));
        });
      } else {
        // Use docker's demuxer for stdout/stderr separation
        const { PassThrough } = await import("node:stream");
        const stdoutPassThrough = new PassThrough();
        const stderrPassThrough = new PassThrough();

        docker.modem.demuxStream(execStream, stdoutPassThrough, stderrPassThrough);

        pipe.stdoutStream = stdoutPassThrough;

        stdoutPassThrough.on("data", (chunk: Buffer) => {
          appendToStdoutBuffer(pipe, chunk.toString("utf-8"));
        });

        stderrPassThrough.on("data", (chunk: Buffer) => {
          appendToStderrBuffer(pipe, chunk.toString("utf-8"));
        });

        stdoutPassThrough.on("end", () => {
          // Container exec stream ended — auto-detach
          if (pipe.status === "attached") {
            pipe.status = "detached";
            pipe.detachedAt = new Date();
            cleanupPipeResources(pipe);

            publishLiveEvent({
              companyId: pipe.companyId,
              type: "chat.pipe_detached",
              payload: { channelId, instanceId, reason: "stream_ended" },
            });
          }
        });

        stderrPassThrough.on("end", () => {
          // stderr ended — no action needed
        });
      }

      execStream.on("end", () => {
        if (pipe.status === "attached") {
          pipe.status = "detached";
          pipe.detachedAt = new Date();
          cleanupPipeResources(pipe);

          publishLiveEvent({
            companyId: pipe.companyId,
            type: "chat.pipe_detached",
            payload: { channelId, instanceId, reason: "exec_ended" },
          });
        }
      });

      execStream.on("error", (err: Error) => {
        logger.warn({ err, channelId }, "Pipe exec stream error");
        pipe.status = "error";
        pipe.error = err.message;
        cleanupPipeResources(pipe);

        publishLiveEvent({
          companyId: pipe.companyId,
          type: "chat.pipe_error",
          payload: { channelId, instanceId, error: err.message },
        });
      });

    } catch (err: any) {
      pipe.status = "error";
      pipe.error = err.message;

      publishLiveEvent({
        companyId,
        type: "chat.pipe_error",
        payload: { channelId, instanceId, error: err.message },
      });

      activePipes.set(channelId, pipe);
      throw err;
    }

    activePipes.set(channelId, pipe);

    // Emit attach event
    publishLiveEvent({
      companyId,
      type: "chat.pipe_attached",
      payload: { channelId, instanceId, actorId },
    });

    logger.info({ channelId, instanceId, companyId }, "Pipe attached to container");

    return toPipeStatus(pipe);
  }

  // chat-s03-pipe-detach-fn
  async function detachPipe(channelId: string): Promise<ChatPipeStatus> {
    const pipe = activePipes.get(channelId);
    if (!pipe) {
      throw new Error("PIPE_NOT_FOUND");
    }

    if (pipe.status === "detached") {
      return toPipeStatus(pipe);
    }

    pipe.status = "detached";
    pipe.detachedAt = new Date();
    cleanupPipeResources(pipe);

    publishLiveEvent({
      companyId: pipe.companyId,
      type: "chat.pipe_detached",
      payload: { channelId, instanceId: pipe.instanceId, reason: "manual" },
    });

    logger.info({ channelId, instanceId: pipe.instanceId }, "Pipe detached from container");

    return toPipeStatus(pipe);
  }

  // chat-s03-pipe-status-fn
  function getPipeStatus(channelId: string): ChatPipeStatus | null {
    const pipe = activePipes.get(channelId);
    if (!pipe) return null;
    return toPipeStatus(pipe);
  }

  // chat-s03-pipe-to-container
  async function pipeMessageToContainer(channelId: string, content: string): Promise<boolean> {
    const pipe = activePipes.get(channelId);
    if (!pipe || pipe.status !== "attached" || !pipe.stdinStream) {
      return false;
    }

    try {
      const data = content + "\n";
      pipe.stdinStream.write(data);
      pipe.messagesPiped++;
      return true;
    } catch (err: any) {
      logger.warn({ err, channelId }, "Failed to write to container stdin");
      pipe.status = "error";
      pipe.error = `stdin write failed: ${err.message}`;

      publishLiveEvent({
        companyId: pipe.companyId,
        type: "chat.pipe_error",
        payload: { channelId, instanceId: pipe.instanceId, error: pipe.error },
      });

      return false;
    }
  }

  // chat-s03-list-active-pipes
  function listActivePipes(companyId: string): ChatPipeStatus[] {
    const result: ChatPipeStatus[] = [];
    for (const pipe of activePipes.values()) {
      if (pipe.companyId === companyId) {
        result.push(toPipeStatus(pipe));
      }
    }
    return result;
  }

  // chat-s03-cleanup
  async function cleanup(): Promise<void> {
    for (const [channelId, pipe] of activePipes) {
      if (pipe.status === "attached") {
        pipe.status = "detached";
        pipe.detachedAt = new Date();
        cleanupPipeResources(pipe);
      }
    }
    activePipes.clear();
  }

  return {
    attachPipe,
    detachPipe,
    getPipeStatus,
    pipeMessageToContainer,
    listActivePipes,
    cleanup,
    setBroadcastFunction,
  };
}

export type ContainerPipeManager = ReturnType<typeof createContainerPipeManager>;
