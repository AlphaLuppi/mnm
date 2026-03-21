// POD-03: Per-User Pod lifecycle management
import Docker from "dockerode";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userPods, authUsers } from "@mnm/db";
import type { PodStatus, UserPod } from "@mnm/shared";
import { notFound, conflict } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { getDockerClient } from "./docker-client.js";

const DEFAULT_POD_IMAGE = "mnm-agent:latest";
const MAX_PODS_PER_COMPANY = 25;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function podManagerService(db: Db) {
  const docker = getDockerClient();

  // ---- Pre-pull image on startup ----

  async function prePullImage(image: string = DEFAULT_POD_IMAGE): Promise<void> {
    try {
      // Check if image exists locally first
      const images = await docker.listImages({ filters: { reference: [image] } });
      if (images.length > 0) {
        logger.info(`Pod image ${image} already available`);
        return;
      }
      logger.info(`Pre-pulling pod image: ${image}`);
      await new Promise<void>((resolve, reject) => {
        docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });
      logger.info(`Pod image ${image} pulled successfully`);
    } catch (err: any) {
      logger.warn(`Failed to pre-pull pod image ${image}: ${err.message}`);
    }
  }

  // ---- Provision Pod ----

  async function provisionPod(
    userId: string,
    companyId: string,
    options?: { image?: string; cpuMillicores?: number; memoryMb?: number },
  ): Promise<UserPod> {
    // 1. Check if user already has a pod
    const [existing] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (existing && !["destroyed", "failed"].includes(existing.status)) {
      throw conflict("User already has an active pod. Use wake or destroy first.");
    }

    // 2. Check company quota
    const activePods = await db.select().from(userPods).where(
      and(
        eq(userPods.companyId, companyId),
        inArray(userPods.status, ["provisioning", "running", "idle", "hibernated"]),
      ),
    );
    if (activePods.length >= MAX_PODS_PER_COMPANY) {
      throw conflict(`Company has reached the maximum of ${MAX_PODS_PER_COMPANY} pods`);
    }

    const image = options?.image ?? DEFAULT_POD_IMAGE;
    const cpuMillicores = options?.cpuMillicores ?? 1000;
    const memoryMb = options?.memoryMb ?? 1024;
    const volumeName = `mnm-pod-home-${userId}`;
    const workspaceVolume = `mnm-pod-workspace-${userId}`;

    // 3. Delete old failed/destroyed record if exists
    if (existing) {
      await db.delete(userPods).where(eq(userPods.id, existing.id));
    }

    // 4. Create DB record
    const [pod] = await db.insert(userPods).values({
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
    createAndStartPod(pod!.id, userId, companyId, image, volumeName, workspaceVolume, cpuMillicores, memoryMb)
      .catch((err) => {
        logger.error(`Failed to provision pod ${pod!.id}: ${err.message}`);
      });

    return mapPodRow(pod!);
  }

  async function createAndStartPod(
    podId: string,
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
        name: `mnm-pod-${userId.slice(0, 8)}`,
        Labels: {
          "mnm.type": "user-pod",
          "mnm.userId": userId,
          "mnm.companyId": companyId,
          "mnm.podId": podId,
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
        .where(eq(userPods.id, podId));

      logger.info(`Pod ${podId} started: container ${container.id.slice(0, 12)}`);
    } catch (err: any) {
      await db.update(userPods)
        .set({
          status: "failed",
          error: err.message,
          updatedAt: new Date(),
        })
        .where(eq(userPods.id, podId));
      throw err;
    }
  }

  // ---- Get My Pod ----

  async function getMyPod(userId: string, companyId: string): Promise<UserPod | null> {
    const [pod] = await db
      .select({
        pod: userPods,
        userName: authUsers.name,
      })
      .from(userPods)
      .leftJoin(authUsers, eq(authUsers.id, userPods.userId))
      .where(
        and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
      );
    if (!pod) return null;
    return mapPodRow(pod.pod, pod.userName);
  }

  // ---- List Pods (admin) ----

  async function listPods(companyId: string): Promise<UserPod[]> {
    const rows = await db
      .select({
        pod: userPods,
        userName: authUsers.name,
      })
      .from(userPods)
      .leftJoin(authUsers, eq(authUsers.id, userPods.userId))
      .where(eq(userPods.companyId, companyId))
      .orderBy(userPods.createdAt);
    return rows.map((r) => mapPodRow(r.pod, r.userName));
  }

  // ---- Hibernate Pod ----

  async function hibernatePod(userId: string, companyId: string): Promise<UserPod> {
    const [pod] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!pod) throw notFound("Pod not found");
    if (!["running", "idle"].includes(pod.status)) {
      throw conflict(`Cannot hibernate pod in status ${pod.status}`);
    }

    if (pod.dockerContainerId) {
      try {
        const container = docker.getContainer(pod.dockerContainerId);
        await container.stop({ t: 10 });
      } catch (err: any) {
        logger.warn(`Error stopping pod container: ${err.message}`);
      }
    }

    const [updated] = await db.update(userPods)
      .set({ status: "hibernated", updatedAt: new Date() })
      .where(eq(userPods.id, pod.id))
      .returning();
    return mapPodRow(updated!);
  }

  // ---- Wake Pod ----

  async function wakePod(userId: string, companyId: string): Promise<UserPod> {
    const [pod] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!pod) throw notFound("Pod not found");
    if (pod.status !== "hibernated") {
      throw conflict(`Cannot wake pod in status ${pod.status}`);
    }

    if (pod.dockerContainerId) {
      try {
        const container = docker.getContainer(pod.dockerContainerId);
        await container.start();
        await db.update(userPods)
          .set({ status: "running", lastActiveAt: new Date(), updatedAt: new Date() })
          .where(eq(userPods.id, pod.id));
      } catch (err: any) {
        await db.update(userPods)
          .set({ status: "failed", error: err.message, updatedAt: new Date() })
          .where(eq(userPods.id, pod.id));
        throw err;
      }
    }

    const [updated] = await db.select().from(userPods).where(eq(userPods.id, pod.id));
    return mapPodRow(updated!);
  }

  // ---- Destroy Pod ----

  async function destroyPod(userId: string, companyId: string): Promise<void> {
    const [pod] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!pod) throw notFound("Pod not found");

    if (pod.dockerContainerId) {
      try {
        const container = docker.getContainer(pod.dockerContainerId);
        await container.stop({ t: 5 }).catch(() => {});
        await container.remove({ force: true });
      } catch (err: any) {
        logger.warn(`Error destroying pod container: ${err.message}`);
      }
    }

    // Remove volumes
    if (pod.volumeName) {
      try { await docker.getVolume(pod.volumeName).remove(); } catch {}
    }
    if (pod.workspaceVolume) {
      try { await docker.getVolume(pod.workspaceVolume).remove(); } catch {}
    }

    await db.update(userPods)
      .set({ status: "destroyed", updatedAt: new Date() })
      .where(eq(userPods.id, pod.id));
  }

  // ---- Exec into Pod (for terminal) ----

  async function execInPod(userId: string, companyId: string): Promise<{ exec: Docker.Exec; containerId: string }> {
    const [pod] = await db.select().from(userPods).where(
      and(eq(userPods.companyId, companyId), eq(userPods.userId, userId)),
    );
    if (!pod) throw notFound("Pod not found");
    if (pod.status !== "running" && pod.status !== "idle") {
      throw conflict(`Pod is not running (status: ${pod.status})`);
    }
    if (!pod.dockerContainerId) {
      throw conflict("Pod has no container");
    }

    const container = docker.getContainer(pod.dockerContainerId);
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
      .where(eq(userPods.id, pod.id));

    return { exec, containerId: pod.dockerContainerId };
  }

  // ---- Helper: map DB row to API type ----

  function mapPodRow(row: typeof userPods.$inferSelect, userName?: string | null): UserPod {
    return {
      id: row.id,
      userId: row.userId,
      userName: userName ?? undefined,
      companyId: row.companyId,
      dockerContainerId: row.dockerContainerId,
      dockerImage: row.dockerImage,
      status: row.status as PodStatus,
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
    provisionPod,
    getMyPod,
    listPods,
    hibernatePod,
    wakePod,
    destroyPod,
    execInPod,
  };
}
