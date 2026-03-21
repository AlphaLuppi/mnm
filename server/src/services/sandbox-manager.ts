// POD-03: Per-User Sandbox lifecycle management (renamed from pod-manager.ts)
import Docker from "dockerode";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userPods, authUsers } from "@mnm/db";
import type { SandboxStatus, UserSandbox } from "@mnm/shared";
import { notFound, conflict } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { getDockerClient } from "./docker-client.js";

const DEFAULT_SANDBOX_IMAGE = "mnm-agent:latest";
const MAX_SANDBOXES_PER_COMPANY = 25;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function sandboxManagerService(db: Db) {
  const docker = getDockerClient();

  // ---- Pre-pull image on startup ----

  async function prePullImage(image: string = DEFAULT_SANDBOX_IMAGE): Promise<void> {
    try {
      // Check if image exists locally first
      const images = await docker.listImages({ filters: { reference: [image] } });
      if (images.length > 0) {
        logger.info(`Sandbox image ${image} already available`);
        return;
      }
      logger.info(`Pre-pulling sandbox image: ${image}`);
      await new Promise<void>((resolve, reject) => {
        docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });
      logger.info(`Sandbox image ${image} pulled successfully`);
    } catch (err: any) {
      logger.warn(`Failed to pre-pull sandbox image ${image}: ${err.message}`);
    }
  }

  // ---- Provision Sandbox ----

  async function provisionSandbox(
    userId: string,
    companyId: string,
    options?: { image?: string; cpuMillicores?: number; memoryMb?: number },
  ): Promise<UserSandbox> {
    // 1. Check if user already has a sandbox
    const [existing] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (existing && !["destroyed", "failed"].includes(existing.status)) {
      throw conflict("User already has an active sandbox. Use wake or destroy first.");
    }

    // 2. Check company quota
    const activeSandboxes = await db.select().from(userPods).where(
      and(
        eq(userPods.companyId, companyId),
        inArray(userPods.status, ["provisioning", "running", "idle", "hibernated"]),
      ),
    );
    if (activeSandboxes.length >= MAX_SANDBOXES_PER_COMPANY) {
      throw conflict(`Company has reached the maximum of ${MAX_SANDBOXES_PER_COMPANY} sandboxes`);
    }

    const image = options?.image ?? DEFAULT_SANDBOX_IMAGE;
    const cpuMillicores = options?.cpuMillicores ?? 1000;
    const memoryMb = options?.memoryMb ?? 1024;
    const volumeName = `mnm-sandbox-home-${userId}`;
    const workspaceVolume = `mnm-sandbox-workspace-${userId}`;

    // 3. Delete old failed/destroyed record if exists
    if (existing) {
      await db.delete(userPods).where(eq(userPods.id, existing.id));
    }

    // 4. Create DB record
    const [sandbox] = await db.insert(userPods).values({
      userId,
      companyId,
      dockerImage: image,
      status: "provisioning",
      volumeName,
      workspaceVolume,
      cpuMillicores,
      memoryMb,
    }).returning();

    // 5. Create and start container async
    createAndStartSandbox(sandbox!.id, userId, companyId, image, volumeName, workspaceVolume, cpuMillicores, memoryMb)
      .catch((err) => {
        logger.error(`Failed to provision sandbox ${sandbox!.id}: ${err.message}`);
      });

    return mapSandboxRow(sandbox!);
  }

  async function createAndStartSandbox(
    sandboxId: string,
    userId: string,
    companyId: string,
    image: string,
    volumeName: string,
    workspaceVolume: string,
    cpuMillicores: number,
    memoryMb: number,
  ): Promise<void> {
    try {
      const container = await docker.createContainer({
        Image: image,
        name: `mnm-sandbox-${userId.slice(0, 8)}`,
        Labels: {
          "mnm.type": "user-sandbox",
          "mnm.userId": userId,
          "mnm.companyId": companyId,
          "mnm.sandboxId": sandboxId,
        },
        HostConfig: {
          Binds: [
            `${volumeName}:/home/agent`,
            `${workspaceVolume}:/workspace`,
          ],
          Memory: memoryMb * 1024 * 1024,
          NanoCpus: cpuMillicores * 1_000_000, // millicores -> nanocpus
          CapDrop: ["ALL"],
          CapAdd: ["NET_BIND_SERVICE"],
          ReadonlyRootfs: false, // Need writable for package installs
          SecurityOpt: ["no-new-privileges"],
          RestartPolicy: { Name: "unless-stopped" },
        },
        Tty: true,
        OpenStdin: true,
      });

      await container.start();

      await db.update(userPods)
        .set({
          dockerContainerId: container.id,
          status: "running",
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userPods.id, sandboxId));

      logger.info(`Sandbox ${sandboxId} started: container ${container.id.slice(0, 12)}`);
    } catch (err: any) {
      await db.update(userPods)
        .set({
          status: "failed",
          error: err.message,
          updatedAt: new Date(),
        })
        .where(eq(userPods.id, sandboxId));
      throw err;
    }
  }

  // ---- Get My Sandbox ----

  async function getMySandbox(userId: string, companyId: string): Promise<UserSandbox | null> {
    const [row] = await db
      .select({
        pod: userPods,
        userName: authUsers.name,
      })
      .from(userPods)
      .leftJoin(authUsers, eq(authUsers.id, userPods.userId))
      .where(
        and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
      );
    if (!row) return null;
    return mapSandboxRow(row.pod, row.userName);
  }

  // ---- List Sandboxes (admin) ----

  async function listSandboxes(companyId: string): Promise<UserSandbox[]> {
    const rows = await db
      .select({
        pod: userPods,
        userName: authUsers.name,
      })
      .from(userPods)
      .leftJoin(authUsers, eq(authUsers.id, userPods.userId))
      .where(eq(userPods.companyId, companyId))
      .orderBy(userPods.createdAt);
    return rows.map((r) => mapSandboxRow(r.pod, r.userName));
  }

  // ---- Hibernate Sandbox ----

  async function hibernateSandbox(userId: string, companyId: string): Promise<UserSandbox> {
    const [row] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!row) throw notFound("Sandbox not found");
    if (!["running", "idle"].includes(row.status)) {
      throw conflict(`Cannot hibernate sandbox in status ${row.status}`);
    }

    if (row.dockerContainerId) {
      try {
        const container = docker.getContainer(row.dockerContainerId);
        await container.stop({ t: 10 });
      } catch (err: any) {
        logger.warn(`Error stopping sandbox container: ${err.message}`);
      }
    }

    const [updated] = await db.update(userPods)
      .set({ status: "hibernated", updatedAt: new Date() })
      .where(eq(userPods.id, row.id))
      .returning();
    return mapSandboxRow(updated!);
  }

  // ---- Wake Sandbox ----

  async function wakeSandbox(userId: string, companyId: string): Promise<UserSandbox> {
    const [row] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!row) throw notFound("Sandbox not found");
    if (row.status !== "hibernated") {
      throw conflict(`Cannot wake sandbox in status ${row.status}`);
    }

    if (row.dockerContainerId) {
      try {
        const container = docker.getContainer(row.dockerContainerId);
        await container.start();
        await db.update(userPods)
          .set({ status: "running", lastActiveAt: new Date(), updatedAt: new Date() })
          .where(eq(userPods.id, row.id));
      } catch (err: any) {
        await db.update(userPods)
          .set({ status: "failed", error: err.message, updatedAt: new Date() })
          .where(eq(userPods.id, row.id));
        throw err;
      }
    }

    const [updated] = await db.select().from(userPods).where(eq(userPods.id, row.id));
    return mapSandboxRow(updated!);
  }

  // ---- Destroy Sandbox ----

  async function destroySandbox(userId: string, companyId: string): Promise<void> {
    const [row] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!row) throw notFound("Sandbox not found");

    if (row.dockerContainerId) {
      try {
        const container = docker.getContainer(row.dockerContainerId);
        await container.stop({ t: 5 }).catch(() => {});
        await container.remove({ force: true });
      } catch (err: any) {
        logger.warn(`Error destroying sandbox container: ${err.message}`);
      }
    }

    // Remove volumes
    if (row.volumeName) {
      try { await docker.getVolume(row.volumeName).remove(); } catch {}
    }
    if (row.workspaceVolume) {
      try { await docker.getVolume(row.workspaceVolume).remove(); } catch {}
    }

    await db.update(userPods)
      .set({ status: "destroyed", updatedAt: new Date() })
      .where(eq(userPods.id, row.id));
  }

  // ---- Exec into Sandbox (for terminal) ----

  async function execInSandbox(userId: string, companyId: string): Promise<{ exec: Docker.Exec; containerId: string }> {
    const [row] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!row) throw notFound("Sandbox not found");
    if (row.status !== "running" && row.status !== "idle") {
      throw conflict(`Sandbox is not running (status: ${row.status})`);
    }
    if (!row.dockerContainerId) {
      throw conflict("Sandbox has no container");
    }

    const container = docker.getContainer(row.dockerContainerId);
    const exec = await container.exec({
      Cmd: ["/bin/bash"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    // Update last active
    await db.update(userPods)
      .set({ lastActiveAt: new Date(), status: "running", updatedAt: new Date() })
      .where(eq(userPods.id, row.id));

    return { exec, containerId: row.dockerContainerId };
  }

  // ---- Helper: map DB row to API type ----

  function mapSandboxRow(row: typeof userPods.$inferSelect, userName?: string | null): UserSandbox {
    return {
      id: row.id,
      userId: row.userId,
      userName: userName ?? undefined,
      companyId: row.companyId,
      dockerContainerId: row.dockerContainerId,
      dockerImage: row.dockerImage,
      status: row.status as SandboxStatus,
      volumeName: row.volumeName,
      workspaceVolume: row.workspaceVolume,
      cpuMillicores: row.cpuMillicores,
      memoryMb: row.memoryMb,
      claudeAuthStatus: row.claudeAuthStatus as any,
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  return {
    prePullImage,
    provisionSandbox,
    getMySandbox,
    listSandboxes,
    hibernateSandbox,
    wakeSandbox,
    destroySandbox,
    execInSandbox,
  };
}
