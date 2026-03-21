// POD-05: Pod command execution (chat-style console)
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { podManagerService } from "../services/pod-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import { getDockerClient } from "../services/docker-client.js";
import { logger } from "../middleware/logger.js";

const execSchema = z.object({
  command: z.string().min(1).max(10000),
  stdin: z.string().max(100000).optional(), // Optional stdin data to pipe
});

export function podExecRoutes(db: Db) {
  const router = Router();
  const manager = podManagerService(db);
  const docker = getDockerClient();

  // POST /companies/:companyId/pods/my/exec — run command in pod
  router.post(
    "/companies/:companyId/pods/my/exec",
    requirePermission(db, "agents:launch"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const parsed = execSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.issues.map((i) => i.message).join(", "));
      }

      const pod = await manager.getMyPod(actor.actorId, companyId as string);
      if (!pod) {
        res.status(404).json({ error: "No pod found. Provision one first." });
        return;
      }
      if (pod.status !== "running" && pod.status !== "idle") {
        res.status(409).json({ error: `Pod is ${pod.status}, not running.` });
        return;
      }
      if (!pod.dockerContainerId) {
        res.status(409).json({ error: "Pod has no container." });
        return;
      }

      try {
        const container = docker.getContainer(pod.dockerContainerId);
        const hasStdin = !!parsed.data.stdin;

        // Run command via docker exec
        const exec = await container.exec({
          Cmd: ["bash", "-c", parsed.data.command],
          AttachStdin: hasStdin,
          AttachStdout: true,
          AttachStderr: true,
          Tty: hasStdin, // TTY mode for interactive commands
        });

        const stream = await exec.start({
          Detach: false,
          Tty: hasStdin,
          hijack: hasStdin,
          stdin: hasStdin,
        });

        // If we have stdin data, write it to the stream
        if (hasStdin && parsed.data.stdin) {
          // Small delay to let the process start and show its prompt
          await new Promise((r) => setTimeout(r, 2000));
          stream.write(parsed.data.stdin + "\n");
          // Give the process time to process the input
          await new Promise((r) => setTimeout(r, 1000));
          stream.end();
        }

        // Collect output with timeout
        const chunks: Buffer[] = [];
        const timeout = hasStdin ? 60_000 : 30_000; // Longer timeout for interactive

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

        // In TTY mode, output is not multiplexed — it's raw
        // In non-TTY mode, output is multiplexed with 8-byte headers
        let output: { stdout: string; stderr: string };
        if (hasStdin) {
          output = { stdout: rawOutput.toString("utf-8"), stderr: "" };
        } else {
          output = demuxDockerStream(rawOutput);
        }

        const execInspect = await exec.inspect();

        res.json({
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: execInspect.ExitCode ?? 0,
        });
      } catch (err: any) {
        logger.error(`Pod exec error: ${err.message}`);
        res.status(500).json({ error: `Exec failed: ${err.message}` });
      }
    },
  );

  return router;
}

// Parse Docker's multiplexed stream format
// Header: [stream_type(1), 0, 0, 0, size(4)] + payload
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
