// POD-05: Sandbox command execution (chat-style console)
// Simple: run commands via docker exec, return output
import { Router } from "express";
import { z } from "zod";
import type { Db } from "@mnm/db";
import { sandboxManagerService } from "../services/sandbox-manager.js";
import { requirePermission } from "../middleware/require-permission.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import { getDockerClient } from "../services/docker-client.js";
import { logger } from "../middleware/logger.js";

const execSchema = z.object({
  command: z.string().min(1).max(10000),
});

export function sandboxExecRoutes(db: Db) {
  const router = Router();
  const manager = sandboxManagerService(db);
  const docker = getDockerClient();

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
      if (!sandbox) { res.status(404).json({ error: "No sandbox found." }); return; }
      if (sandbox.status !== "running" && sandbox.status !== "idle") {
        res.status(409).json({ error: `Sandbox is ${sandbox.status}, not running.` }); return;
      }
      if (!sandbox.dockerContainerId) {
        res.status(409).json({ error: "Sandbox has no container." }); return;
      }

      try {
        const container = docker.getContainer(sandbox.dockerContainerId);
        const exec = await container.exec({
          Cmd: ["bash", "-lc", parsed.data.command], // -l for login shell (reads .bashrc)
          AttachStdout: true,
          AttachStderr: true,
          Tty: false,
        });

        const stream = await exec.start({ Detach: false, Tty: false });
        const chunks: Buffer[] = [];

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { stream.destroy(); resolve(); }, 30_000);
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => { clearTimeout(timer); resolve(); });
          stream.on("error", (err: Error) => { clearTimeout(timer); reject(err); });
        });

        const raw = Buffer.concat(chunks);
        const output = demuxDockerStream(raw);
        const info = await exec.inspect();

        res.json({
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: info.ExitCode ?? 0,
        });
      } catch (err: any) {
        logger.error(`Sandbox exec error: ${err.message}`);
        res.status(500).json({ error: `Exec failed: ${err.message}` });
      }
    },
  );

  return router;
}

function demuxDockerStream(data: Buffer): { stdout: string; stderr: string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let offset = 0;
  while (offset < data.length) {
    if (offset + 8 > data.length) { stdout.push(data.subarray(offset).toString("utf-8")); break; }
    const type = data[offset]!;
    const size = data.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + size > data.length) {
      const p = data.subarray(offset).toString("utf-8");
      (type === 2 ? stderr : stdout).push(p); break;
    }
    const p = data.subarray(offset, offset + size).toString("utf-8");
    (type === 2 ? stderr : stdout).push(p);
    offset += size;
  }
  return { stdout: stdout.join(""), stderr: stderr.join("") };
}
