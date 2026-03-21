// DEPLOY-02: Artifact Deployment lifecycle management
import Docker from "dockerode";
import crypto from "crypto";
import { and, eq, lt, inArray, desc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { artifactDeployments, authUsers, issues, agents } from "@mnm/db";
import type { ArtifactDeployment, DeploymentStatus, DeploymentCreateOptions } from "@mnm/shared";
import { notFound, conflict } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { getDockerClient } from "./docker-client.js";

const PORT_POOL_START = 9000;
const PORT_POOL_END = 9999;
const MAX_DEPLOYMENTS_PER_COMPANY = 10;
const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function deployManagerService(db: Db) {
  const docker = getDockerClient();

  // ---- Port Allocation ----

  async function allocatePort(): Promise<number> {
    const usedPorts = await db
      .select({ port: artifactDeployments.port })
      .from(artifactDeployments)
      .where(inArray(artifactDeployments.status, ["building", "running"]));

    const usedSet = new Set(usedPorts.map((r) => r.port).filter(Boolean));
    for (let port = PORT_POOL_START; port <= PORT_POOL_END; port++) {
      if (!usedSet.has(port)) return port;
    }
    throw conflict("No available ports for deployment");
  }

  // ---- Detect Project Type ----

  function detectProjectType(sourcePath: string): "static" | "node" | "python" | "unknown" {
    // Simple heuristic based on path patterns
    if (sourcePath.endsWith("/dist") || sourcePath.endsWith("/build") || sourcePath.endsWith("/public")) {
      return "static";
    }
    if (sourcePath.includes("package.json") || sourcePath.endsWith("/src")) {
      return "node";
    }
    if (sourcePath.includes("requirements.txt") || sourcePath.endsWith(".py")) {
      return "python";
    }
    return "static"; // Default to static serving
  }

  // ---- Create Deployment ----

  async function createDeployment(
    userId: string,
    companyId: string,
    options: DeploymentCreateOptions,
  ): Promise<ArtifactDeployment> {
    // 1. Check company quota
    const activeDeployments = await db.select().from(artifactDeployments).where(
      and(
        eq(artifactDeployments.companyId, companyId),
        inArray(artifactDeployments.status, ["building", "running"]),
      ),
    );
    if (activeDeployments.length >= MAX_DEPLOYMENTS_PER_COMPANY) {
      throw conflict(`Company has reached the maximum of ${MAX_DEPLOYMENTS_PER_COMPANY} active deployments`);
    }

    // 2. Allocate port
    const port = await allocatePort();

    // 3. Detect project type
    const projectType = detectProjectType(options.sourcePath);

    // 4. Generate share token
    const shareToken = crypto.randomBytes(16).toString("hex");

    const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const name = options.name ?? `Deploy ${new Date().toISOString().slice(0, 16)}`;

    // 5. Insert record
    const [deployment] = await db.insert(artifactDeployments).values({
      companyId,
      userId,
      issueId: options.issueId ?? null,
      runId: options.runId ?? null,
      agentId: options.agentId ?? null,
      projectId: options.projectId ?? null,
      name,
      status: "building",
      projectType,
      port,
      sourcePath: options.sourcePath,
      ttlSeconds,
      shareToken,
      url: `/preview/${undefined}`, // Will be updated after insert with actual ID
      expiresAt,
    }).returning();

    // 6. Update URL with actual ID
    await db.update(artifactDeployments)
      .set({ url: `/preview/${deployment!.id}` })
      .where(eq(artifactDeployments.id, deployment!.id));

    // 7. Start container async
    startDeploymentContainer(deployment!.id, companyId, options.sourcePath, projectType, port)
      .catch((err) => {
        logger.error(`Failed to start deployment ${deployment!.id}: ${err.message}`);
      });

    return mapDeploymentRow(deployment!);
  }

  async function startDeploymentContainer(
    deploymentId: string,
    companyId: string,
    sourcePath: string,
    projectType: string,
    port: number,
  ): Promise<void> {
    try {
      // Use nginx for static, node for apps
      const image = projectType === "node" ? "node:20-slim" : "nginx:alpine";
      const cmd = projectType === "node"
        ? ["sh", "-c", `cd /app && (npm install --production 2>/dev/null || true) && (npm start || node index.js || node server.js || npx serve -s . -l ${port})`]
        : undefined; // nginx uses default CMD

      const container = await docker.createContainer({
        Image: image,
        name: `mnm-deploy-${deploymentId.slice(0, 8)}`,
        Labels: {
          "mnm.type": "deployment",
          "mnm.deploymentId": deploymentId,
          "mnm.companyId": companyId,
        },
        ExposedPorts: { [`${port}/tcp`]: {} },
        HostConfig: {
          PortBindings: {
            [`${projectType === "static" ? "80" : port}/tcp`]: [{ HostPort: `${port}` }],
          },
          Memory: 256 * 1024 * 1024, // 256 MB
          NanoCpus: 500 * 1_000_000, // 500 millicores
          ReadonlyRootfs: false,
          CapDrop: ["ALL"],
          CapAdd: ["NET_BIND_SERVICE"],
        },
        Cmd: cmd,
      });

      await container.start();

      await db.update(artifactDeployments)
        .set({
          dockerContainerId: container.id,
          status: "running",
          url: `/preview/${deploymentId}`,
          updatedAt: new Date(),
        })
        .where(eq(artifactDeployments.id, deploymentId));

      logger.info(`Deployment ${deploymentId} running on port ${port}`);
    } catch (err: any) {
      await db.update(artifactDeployments)
        .set({
          status: "failed",
          buildLog: err.message,
          updatedAt: new Date(),
        })
        .where(eq(artifactDeployments.id, deploymentId));
    }
  }

  // ---- List Deployments ----

  async function listDeployments(
    companyId: string,
    filters?: { issueId?: string; status?: DeploymentStatus },
  ): Promise<ArtifactDeployment[]> {
    const conditions = [eq(artifactDeployments.companyId, companyId)];
    if (filters?.issueId) {
      conditions.push(eq(artifactDeployments.issueId, filters.issueId));
    }
    if (filters?.status) {
      conditions.push(eq(artifactDeployments.status, filters.status));
    }

    const rows = await db
      .select({
        deployment: artifactDeployments,
        userName: authUsers.name,
        issueTitle: issues.title,
        agentName: agents.name,
      })
      .from(artifactDeployments)
      .leftJoin(authUsers, eq(authUsers.id, artifactDeployments.userId))
      .leftJoin(issues, eq(issues.id, artifactDeployments.issueId))
      .leftJoin(agents, eq(agents.id, artifactDeployments.agentId))
      .where(and(...conditions))
      .orderBy(desc(artifactDeployments.createdAt));

    return rows.map((r) => mapDeploymentRow(r.deployment, r.userName, r.issueTitle, r.agentName));
  }

  // ---- Get Deployment ----

  async function getDeployment(deploymentId: string, companyId: string): Promise<ArtifactDeployment> {
    const [row] = await db
      .select({
        deployment: artifactDeployments,
        userName: authUsers.name,
        issueTitle: issues.title,
        agentName: agents.name,
      })
      .from(artifactDeployments)
      .leftJoin(authUsers, eq(authUsers.id, artifactDeployments.userId))
      .leftJoin(issues, eq(issues.id, artifactDeployments.issueId))
      .leftJoin(agents, eq(agents.id, artifactDeployments.agentId))
      .where(and(
        eq(artifactDeployments.id, deploymentId),
        eq(artifactDeployments.companyId, companyId),
      ));
    if (!row) throw notFound("Deployment not found");
    return mapDeploymentRow(row.deployment, row.userName, row.issueTitle, row.agentName);
  }

  // ---- Get Deployment by ID (for proxy, no company check) ----

  async function getDeploymentForProxy(deploymentId: string): Promise<{ port: number; companyId: string; shareToken: string | null } | null> {
    const [row] = await db.select({
      port: artifactDeployments.port,
      companyId: artifactDeployments.companyId,
      shareToken: artifactDeployments.shareToken,
      status: artifactDeployments.status,
    }).from(artifactDeployments).where(eq(artifactDeployments.id, deploymentId));
    if (!row || row.status !== "running" || !row.port) return null;
    return { port: row.port, companyId: row.companyId, shareToken: row.shareToken };
  }

  // ---- Pin/Unpin ----

  async function pinDeployment(deploymentId: string, companyId: string, pin: boolean): Promise<ArtifactDeployment> {
    const deployment = await getDeployment(deploymentId, companyId);
    const expiresAt = pin ? null : new Date(Date.now() + deployment.ttlSeconds * 1000);

    await db.update(artifactDeployments)
      .set({ pinned: pin, expiresAt, updatedAt: new Date() })
      .where(eq(artifactDeployments.id, deploymentId));

    return getDeployment(deploymentId, companyId);
  }

  // ---- Destroy Deployment ----

  async function destroyDeployment(deploymentId: string, companyId: string): Promise<void> {
    const [row] = await db.select().from(artifactDeployments).where(
      and(eq(artifactDeployments.id, deploymentId), eq(artifactDeployments.companyId, companyId)),
    );
    if (!row) throw notFound("Deployment not found");

    if (row.dockerContainerId) {
      try {
        const container = docker.getContainer(row.dockerContainerId);
        await container.stop({ t: 3 }).catch(() => {});
        await container.remove({ force: true });
      } catch (err: any) {
        logger.warn(`Error destroying deployment container: ${err.message}`);
      }
    }

    await db.update(artifactDeployments)
      .set({ status: "destroyed", updatedAt: new Date() })
      .where(eq(artifactDeployments.id, deploymentId));
  }

  // ---- Garbage Collector ----

  async function cleanupExpired(): Promise<{ cleaned: number }> {
    const expired = await db.select().from(artifactDeployments).where(
      and(
        lt(artifactDeployments.expiresAt, new Date()),
        inArray(artifactDeployments.status, ["running", "building"]),
        eq(artifactDeployments.pinned, false),
      ),
    );

    let cleaned = 0;
    for (const row of expired) {
      try {
        if (row.dockerContainerId) {
          const container = docker.getContainer(row.dockerContainerId);
          await container.stop({ t: 3 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
        }
        await db.update(artifactDeployments)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(artifactDeployments.id, row.id));
        cleaned++;
      } catch (err: any) {
        logger.warn(`GC: Failed to clean deployment ${row.id}: ${err.message}`);
      }
    }

    if (cleaned > 0) {
      logger.info(`Deployment GC: cleaned ${cleaned} expired deployments`);
    }
    return { cleaned };
  }

  // ---- Start GC Cron ----

  function startGarbageCollector(): NodeJS.Timeout {
    return setInterval(() => {
      cleanupExpired().catch((err) => {
        logger.error(`Deployment GC error: ${err.message}`);
      });
    }, CLEANUP_INTERVAL_MS);
  }

  // ---- Helper ----

  function mapDeploymentRow(
    row: typeof artifactDeployments.$inferSelect,
    userName?: string | null,
    issueTitle?: string | null,
    agentName?: string | null,
  ): ArtifactDeployment {
    return {
      id: row.id,
      companyId: row.companyId,
      userId: row.userId,
      userName: userName ?? undefined,
      issueId: row.issueId,
      issueTitle: issueTitle ?? undefined,
      runId: row.runId,
      agentId: row.agentId,
      agentName: agentName ?? undefined,
      projectId: row.projectId,
      name: row.name,
      status: row.status as DeploymentStatus,
      projectType: row.projectType as any,
      dockerContainerId: row.dockerContainerId,
      port: row.port,
      sourcePath: row.sourcePath,
      buildLog: row.buildLog,
      ttlSeconds: row.ttlSeconds,
      pinned: row.pinned,
      shareToken: row.shareToken,
      url: row.url ?? `/preview/${row.id}`,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  return {
    createDeployment,
    listDeployments,
    getDeployment,
    getDeploymentForProxy,
    pinDeployment,
    destroyDeployment,
    cleanupExpired,
    startGarbageCollector,
  };
}
