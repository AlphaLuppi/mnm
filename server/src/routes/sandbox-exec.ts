// POD-05: Sandbox command execution (chat-style console, renamed from pod-exec.ts)
// Supports persistent sessions for interactive commands (e.g., claude auth login)
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { sandboxManagerService } from "../services/sandbox-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import { getDockerClient } from "../services/docker-client.js";
import { logger } from "../middleware/logger.js";
import crypto from "crypto";

const execSchema = z.object({
  command: z.string().min(1).max(10000),
});

const sendInputSchema = z.object({
  sessionId: z.string().min(1),
  input: z.string().min(1).max(100000),
});

// ---- Persistent exec session store ----
// Keeps interactive processes alive so stdin can be sent later
interface ExecSession {
  stream: any; // Docker exec stream
  output: string[]; // Accumulated output chunks
  createdAt: number;
  userId: string;
}

const execSessions = new Map<string, ExecSession>();

// Cleanup stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of execSessions) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      try { session.stream.destroy(); } catch {}
      execSessions.delete(id);
    }
  }
}, 60_000);

export function sandboxExecRoutes(db: Db) {
  const router = Router();
  const manager = sandboxManagerService(db);
  const docker = getDockerClient();

  // POST /companies/:companyId/sandboxes/my/exec — run command in sandbox
  router.post(
    "/companies/:companyId/sandboxes/my/exec",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = execSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const sandbox = await manager.getMySandbox(actor.actorId, companyId as string);
      if (!sandbox) {
        res.status(404).json({ error: "No sandbox found. Provision one first." });
        return;
      }
      if (sandbox.status !== "running" && sandbox.status !== "idle") {
        res.status(409).json({ error: `Sandbox is ${sandbox.status}, not running.` });
        return;
      }
      if (!sandbox.dockerContainerId) {
        res.status(409).json({ error: "Sandbox has no container." });
        return;
      }

      const command = parsed.data.command;
      // Detect interactive commands that need a persistent session
      const isInteractive = /claude\s+auth\s+login|claude\s+setup-token/.test(command);

      try {
        const container = docker.getContainer(sandbox.dockerContainerId);

        if (isInteractive) {
          // Start persistent session — keep process alive for stdin later
          const exec = await container.exec({
            Cmd: ["bash", "-c", command],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
          });

          const stream = await exec.start({
            Detach: false,
            Tty: true,
            hijack: true,
            stdin: true,
          });

          const sessionId = crypto.randomBytes(8).toString("hex");
          const session: ExecSession = {
            stream,
            output: [],
            createdAt: Date.now(),
            userId: actor.actorId,
          };

          stream.on("data", (chunk: Buffer) => {
            session.output.push(chunk.toString("utf-8"));
          });

          execSessions.set(sessionId, session);

          // Wait a moment for the process to produce initial output (the URL)
          await new Promise((r) => setTimeout(r, 3000));

          const initialOutput = session.output.join("");

          res.json({
            stdout: initialOutput,
            stderr: "",
            exitCode: null, // Process still running
            sessionId, // Client uses this to send input later
            interactive: true,
          });
        } else {
          // Non-interactive: run command and collect output
          const exec = await container.exec({
            Cmd: ["bash", "-c", command],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
          });

          const stream = await exec.start({ Detach: false, Tty: false });

          const chunks: Buffer[] = [];
          const timeout = 30_000;

          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              stream.destroy();
              resolve();
            }, timeout);

            stream.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });

            stream.on("end", () => {
              clearTimeout(timer);
              resolve();
            });

            stream.on("error", (err: Error) => {
              clearTimeout(timer);
              reject(err);
            });
          });

          const rawOutput = Buffer.concat(chunks);
          const output = demuxDockerStream(rawOutput);
          const execInspect = await exec.inspect();

          res.json({
            stdout: output.stdout,
            stderr: output.stderr,
            exitCode: execInspect.ExitCode ?? 0,
          });
        }
      } catch (err: any) {
        logger.error(`Sandbox exec error: ${err.message}`);
        res.status(500).json({ error: `Exec failed: ${err.message}` });
      }
    },
  );

  // POST /companies/:companyId/sandboxes/my/exec/input — send stdin to interactive session
  router.post(
    "/companies/:companyId/sandboxes/my/exec/input",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = sendInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const session = execSessions.get(parsed.data.sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found or expired." });
        return;
      }
      if (session.userId !== actor.actorId) {
        res.status(403).json({ error: "Session belongs to another user." });
        return;
      }

      try {
        // Clear accumulated output before sending input
        session.output.length = 0;

        // Write the input to the process stdin
        session.stream.write(parsed.data.input + "\n");

        // Wait for the process to respond
        await new Promise((r) => setTimeout(r, 5000));

        const output = session.output.join("");

        // Clean up session
        try { session.stream.end(); } catch {}
        execSessions.delete(parsed.data.sessionId);

        res.json({
          stdout: output,
          stderr: "",
          exitCode: 0,
          sessionId: null, // Session closed
          interactive: false,
        });
      } catch (err: any) {
        execSessions.delete(parsed.data.sessionId);
        logger.error(`Sandbox exec input error: ${err.message}`);
        res.status(500).json({ error: `Input failed: ${err.message}` });
      }
    },
  );

  return router;
}

// Parse Docker's multiplexed stream format
function demuxDockerStream(data: Buffer): { stdout: string; stderr: string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let offset = 0;

  while (offset < data.length) {
    if (offset + 8 > data.length) {
      stdout.push(data.subarray(offset).toString("utf-8"));
      break;
    }

    const streamType = data[offset]!;
    const size = data.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > data.length) {
      const payload = data.subarray(offset).toString("utf-8");
      if (streamType === 2) stderr.push(payload);
      else stdout.push(payload);
      break;
    }

    const payload = data.subarray(offset, offset + size).toString("utf-8");
    if (streamType === 2) {
      stderr.push(payload);
    } else {
      stdout.push(payload);
    }
    offset += size;
  }

  return { stdout: stdout.join(""), stderr: stderr.join("") };
}
