import Docker from "dockerode";
import { and, eq, inArray, desc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { containerInstances, containerProfiles, agents } from "@mnm/db";
import { getDockerClient } from "./docker-client.js";
import type {
  ContainerStatus,
  ContainerLaunchOptions,
  ContainerLaunchResult,
  ContainerInfoFull,
  ContainerStopOptions,
  ContainerResourceUsage,
  ContainerHealthCheckStatus,
  CredentialProxySecretMapping,
} from "@mnm/shared";
import { notFound, conflict } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";
import { emitAudit } from "./audit-emitter.js";
import { createLocalAgentJwt } from "../agent-auth-jwt.js";
import { logger } from "../middleware/logger.js";
import { credentialProxyService } from "./credential-proxy.js";
import { credentialProxyRulesService } from "./credential-proxy-rules.js";
import { mountAllowlistService } from "./mount-allowlist.js";
import { networkIsolationService } from "./network-isolation.js";

const DEFAULT_DOCKER_IMAGE = "node:20-slim";
const MONITOR_INTERVAL_MS = 5_000;       // 5 seconds
const DEFAULT_GRACE_PERIOD_SEC = 10;
const MAX_CONTAINERS_PER_COMPANY = 50;

// Track active monitors to allow cleanup
const activeMonitors = new Map<string, NodeJS.Timeout>();

export function containerManagerService(db: Db) {
  const docker = getDockerClient();

  // ---- Health check ----

  async function checkDockerHealth(): Promise<{ available: boolean; version: string | null; error: string | null }> {
    try {
      const info = await docker.version();
      return { available: true, version: info.Version, error: null };
    } catch (err: any) {
      return { available: false, version: null, error: err.message };
    }
  }

  // ---- Launch Container ----

  async function launchContainer(
    agentId: string,
    companyId: string,
    actorId: string,
    options?: ContainerLaunchOptions,
  ): Promise<ContainerLaunchResult> {
    // 1. Load agent
    const [agent] = await db.select().from(agents).where(
      and(eq(agents.id, agentId), eq(agents.companyId, companyId))
    );
    if (!agent) throw notFound("Agent not found");

    // 2. Check company container limit
    const activeContainers = await db.select().from(containerInstances).where(
      and(
        eq(containerInstances.companyId, companyId),
        inArray(containerInstances.status, ["pending", "creating", "running"])
      )
    );
    if (activeContainers.length >= MAX_CONTAINERS_PER_COMPANY) {
      throw conflict(`Company has reached the maximum of ${MAX_CONTAINERS_PER_COMPANY} active containers`);
    }

    // 3. Resolve profile
    const profile = await resolveProfile(companyId, agent.containerProfileId ?? null, options?.profileId);

    // cont-s03-cm-validate
    // 3b. Validate mount paths against allowlist
    const requestedMounts: string[] = options?.mountPaths ?? [];
    let validatedMountPaths: string[] = [];

    if (requestedMounts.length > 0) {
      const allowlistSvc = mountAllowlistService(db);
      const allowedPaths = (profile.allowedMountPaths as string[] | null) ?? [];
      const mountResult = await allowlistSvc.validateAllMounts(requestedMounts, allowedPaths);

      if (!mountResult.valid) {
        // cont-s03-audit-violation
        // Emit critical audit for each violation
        for (const violation of mountResult.violations) {
          await emitAudit({
            req: { actor: { type: "board", userId: actorId, source: "session" }, ip: null, get: () => null } as any,
            db,
            companyId,
            action: "container.mount_violation",
            targetType: "container_instance",
            targetId: agentId,
            metadata: {
              code: violation.code,
              originalPath: violation.originalPath,
              normalizedPath: violation.normalizedPath,
              message: violation.message,
            },
            severity: "critical",
          });
        }

        const violationSummary = mountResult.violations.map((v) => `${v.code}: ${v.originalPath}`).join("; ");
        throw conflict(`Mount validation failed: ${violationSummary}`);
      }

      validatedMountPaths = requestedMounts.map((p) => allowlistSvc.normalizePath(p));
    }

    // 4. Resolve image — CONT-S05: use profile.dockerImage as fallback
    const dockerImage = options?.dockerImage
      ?? (agent.adapterConfig as Record<string, unknown>)?.dockerImage as string
      ?? profile.dockerImage
      ?? DEFAULT_DOCKER_IMAGE;

    // 5. Create instance record
    const [instance] = await db.insert(containerInstances).values({
      companyId,
      profileId: profile.id,
      agentId,
      status: "pending",
    }).returning();

    try {
      // 6. Generate agent JWT for container
      const agentJwt = createLocalAgentJwt(agentId, companyId, "docker", instance!.id);

      // cont-s04-cm-network-resolve
      // 6b. Resolve network mode from profile
      const networkSvc = networkIsolationService();
      const profileNetworkMode = (profile.networkMode ?? "isolated") as import("@mnm/shared").ContainerNetworkMode;
      const networkConfig = await networkSvc.resolveNetworkConfig(profileNetworkMode, companyId);
      let resolvedNetworkId: string | null = networkConfig.networkId;

      // 7. Build container options
      // cont-s03-cm-binds
      const containerOpts = buildDockerCreateOptions({
        instanceId: instance!.id,
        agentId,
        companyId,
        profile,
        dockerImage,
        agentJwt: agentJwt ?? "",
        additionalEnv: options?.environmentVars,
        labels: options?.labels,
        timeout: options?.timeout,
        mountPaths: validatedMountPaths,
        networkMode: networkConfig.dockerNetworkMode,
      });

      // cont-s02-cm-proxy-check
      // 7b. Check if credential proxy is enabled for this profile
      let proxyPort: number | null = null;
      let proxySecretMappings: CredentialProxySecretMapping[] = [];

      if (profile.credentialProxyEnabled) {
        const proxyService = credentialProxyService(db);
        const rulesService = credentialProxyRulesService(db);

        // 7c. Allocate proxy port
        proxyPort = await proxyService.allocateProxyPort();

        // 7d. Resolve credential proxy rules for this agent
        proxySecretMappings = await rulesService.resolveRulesForAgent(companyId, agentId);

        // cont-s02-cm-proxy-env
        // 7e. Add proxy env vars to container
        if (proxySecretMappings.length > 0) {
          const proxyEnv = containerOpts.Env ?? [];
          for (const mapping of proxySecretMappings) {
            proxyEnv.push(`${mapping.envKeyPlaceholder}=mnm-proxy-placeholder`);
          }
          proxyEnv.push(`MNM_CREDENTIAL_PROXY_URL=http://host.docker.internal:${proxyPort}`);
          proxyEnv.push(`MNM_CREDENTIAL_PROXY_PORT=${proxyPort}`);
          containerOpts.Env = proxyEnv;
        }
      }

      // 8. Update status to "creating"
      await updateInstanceStatus(instance!.id, "creating");

      // 9. Create Docker container
      const container = await docker.createContainer(containerOpts);
      const dockerContainerId = container.id;

      // 10. Update instance with Docker container ID, logStreamUrl, and labels — CONT-S05 enrichment
      const effectiveLabels: Record<string, string> = {
        "mnm.agent_id": agentId,
        "mnm.company_id": companyId,
        "mnm.instance_id": instance!.id,
        "mnm.profile": profile.name,
        ...options?.labels,
      };

      await db.update(containerInstances)
        .set({
          dockerContainerId,
          logStreamUrl: `/ws/containers/${instance!.id}/logs`,
          labels: effectiveLabels,
          updatedAt: new Date(),
        })
        .where(eq(containerInstances.id, instance!.id));

      // 11. Start container
      await container.start();
      const startedAt = new Date();

      // cont-s04-cm-network-attach
      // 12a. Attach container to company-bridge network if applicable
      if (profileNetworkMode === "company-bridge" && resolvedNetworkId && dockerContainerId) {
        try {
          await networkSvc.attachContainerToNetwork(dockerContainerId, resolvedNetworkId);
        } catch (netErr: any) {
          logger.warn({ err: netErr, instanceId: instance!.id, networkId: resolvedNetworkId }, "Error attaching container to network");
          resolvedNetworkId = null; // Reset if attach failed
        }
      }

      // Emit audit for new network creation
      if (profileNetworkMode === "company-bridge" && resolvedNetworkId) {
        const networkName = `mnm-company-${companyId}`;
        await emitAudit({
          req: { actor: { type: "board", userId: actorId, source: "session" }, ip: null, get: () => null } as any,
          db,
          companyId,
          // cont-s04-audit-network-created
          action: "container.network_created",
          targetType: "docker_network",
          targetId: resolvedNetworkId,
          metadata: { networkName, companyId, driver: "bridge" },
        });
      }

      // cont-s03-cm-mounted-paths
      // 12. Update status to "running" and record mounted paths + networkId
      await db.update(containerInstances)
        .set({
          status: "running",
          startedAt,
          mountedPaths: validatedMountPaths.length > 0 ? validatedMountPaths : null,
          // cont-s04-instance-network-id
          networkId: resolvedNetworkId,
          updatedAt: new Date(),
        })
        .where(eq(containerInstances.id, instance!.id));

      // cont-s02-cm-proxy-start
      // 12b. Start credential proxy if enabled
      if (proxyPort !== null && proxySecretMappings.length > 0) {
        try {
          const proxyService = credentialProxyService(db);
          await proxyService.startProxy({
            port: proxyPort,
            instanceId: instance!.id,
            agentId,
            companyId,
            secretMappings: proxySecretMappings,
            db,
          });

          // cont-s02-cm-proxy-port-save
          await db.update(containerInstances)
            .set({ credentialProxyPort: proxyPort, updatedAt: new Date() })
            .where(eq(containerInstances.id, instance!.id));
        } catch (proxyErr: any) {
          logger.error({ err: proxyErr, instanceId: instance!.id }, "Failed to start credential proxy");
          // Continue without proxy — container is already running
        }
      }

      // 13. Emit events
      publishLiveEvent({
        companyId,
        type: "container.started",
        payload: {
          instanceId: instance!.id,
          agentId,
          dockerContainerId,
          profileName: profile.name,
        },
      });

      await emitAudit({
        req: { actor: { type: "board", userId: actorId, source: "session" }, ip: null, get: () => null } as any,
        db,
        companyId,
        action: "container.started",
        targetType: "container_instance",
        targetId: instance!.id,
        metadata: { agentId, profileName: profile.name, dockerImage },
      });

      // 14. Start monitoring
      const timeoutSeconds = options?.timeout ?? profile.timeoutSeconds;
      startMonitoring(instance!.id, dockerContainerId, companyId, agentId, timeoutSeconds);

      return {
        instanceId: instance!.id,
        dockerContainerId,
        status: "running",
        profileName: profile.name,
        agentId,
        startedAt: startedAt.toISOString(),
        credentialProxyPort: proxyPort,
        credentialProxyUrl: proxyPort ? `http://host.docker.internal:${proxyPort}` : null,
      };

    } catch (err: any) {
      // Failed to create/start -- update instance to failed
      await db.update(containerInstances)
        .set({
          status: "failed",
          error: err.message,
          stoppedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(containerInstances.id, instance!.id));

      publishLiveEvent({
        companyId,
        type: "container.failed",
        payload: {
          instanceId: instance!.id,
          agentId,
          error: err.message,
        },
      });

      throw conflict(`Failed to launch container: ${err.message}`);
    }
  }

  // ---- Stop Container ----

  async function stopContainer(
    instanceId: string,
    companyId: string,
    actorId: string,
    options?: ContainerStopOptions,
  ): Promise<void> {
    const [instance] = await db.select().from(containerInstances).where(
      and(eq(containerInstances.id, instanceId), eq(containerInstances.companyId, companyId))
    );
    if (!instance) throw notFound("Container instance not found");
    if (!["running", "creating"].includes(instance.status)) {
      throw conflict(`Cannot stop container in status "${instance.status}"`);
    }

    // Update status to "stopping"
    await updateInstanceStatus(instanceId, "stopping");

    // Stop monitoring
    stopMonitoring(instanceId);

    // cont-s04-cm-network-detach
    // Detach container from network if attached
    if (instance.networkId && instance.dockerContainerId) {
      try {
        const networkSvc = networkIsolationService();
        await networkSvc.detachContainerFromNetwork(instance.dockerContainerId, instance.networkId);
      } catch (netErr: any) {
        logger.warn({ err: netErr, instanceId, networkId: instance.networkId }, "Error detaching container from network");
      }
    }

    // cont-s02-cm-proxy-stop
    // Stop credential proxy if running
    try {
      const proxyService = credentialProxyService(db);
      await proxyService.stopProxy(instanceId);
    } catch (proxyErr: any) {
      logger.warn({ err: proxyErr, instanceId }, "Error stopping credential proxy");
    }

    if (instance.dockerContainerId) {
      try {
        const container = docker.getContainer(instance.dockerContainerId);
        const gracePeriod = options?.gracePeriodSeconds ?? DEFAULT_GRACE_PERIOD_SEC;
        await container.stop({ t: gracePeriod });
      } catch (err: any) {
        // Container may already be stopped
        if (!err.message?.includes("is not running") && !err.message?.includes("No such container")) {
          logger.warn({ err, instanceId }, "Error stopping container");
        }
      }
    }

    await db.update(containerInstances)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
        error: options?.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(containerInstances.id, instanceId));

    publishLiveEvent({
      companyId,
      type: "container.stopped",
      payload: { instanceId, agentId: instance.agentId, reason: options?.reason },
    });

    await emitAudit({
      req: { actor: { type: "board", userId: actorId, source: "session" }, ip: null, get: () => null } as any,
      db,
      companyId,
      action: "container.stopped",
      targetType: "container_instance",
      targetId: instanceId,
      metadata: { agentId: instance.agentId, reason: options?.reason },
    });
  }

  // ---- Get Status ----

  async function getContainerStatus(
    instanceId: string,
    companyId: string,
  ): Promise<ContainerInfoFull> {
    const results = await db
      .select({
        instance: containerInstances,
        profile: containerProfiles,
        agent: agents,
      })
      .from(containerInstances)
      .innerJoin(containerProfiles, eq(containerInstances.profileId, containerProfiles.id))
      .innerJoin(agents, eq(containerInstances.agentId, agents.id))
      .where(
        and(eq(containerInstances.id, instanceId), eq(containerInstances.companyId, companyId))
      );

    const row = results[0];
    if (!row) throw notFound("Container instance not found");

    return formatContainerInfo(row);
  }

  // ---- List Containers ----

  async function listContainers(
    companyId: string,
    filters?: { status?: ContainerStatus; agentId?: string },
  ): Promise<ContainerInfoFull[]> {
    const conditions = [eq(containerInstances.companyId, companyId)];
    if (filters?.status) {
      conditions.push(eq(containerInstances.status, filters.status));
    }
    if (filters?.agentId) {
      conditions.push(eq(containerInstances.agentId, filters.agentId));
    }

    const results = await db
      .select({
        instance: containerInstances,
        profile: containerProfiles,
        agent: agents,
      })
      .from(containerInstances)
      .innerJoin(containerProfiles, eq(containerInstances.profileId, containerProfiles.id))
      .innerJoin(agents, eq(containerInstances.agentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(containerInstances.createdAt));

    return results.map(formatContainerInfo);
  }

  // ---- Profile Management ----

  async function resolveProfile(
    companyId: string,
    agentProfileId: string | null,
    overrideProfileId?: string,
  ) {
    // Priority: override > agent config > company default > built-in standard
    const profileId = overrideProfileId ?? agentProfileId;

    if (profileId) {
      const [profile] = await db.select().from(containerProfiles).where(
        and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
      );
      if (profile) return profile;
    }

    // Fallback: company default
    const [defaultProfile] = await db.select().from(containerProfiles).where(
      and(eq(containerProfiles.companyId, companyId), eq(containerProfiles.isDefault, true))
    );
    if (defaultProfile) return defaultProfile;

    // Fallback: create a built-in standard profile
    const [created] = await db.insert(containerProfiles).values({
      companyId,
      name: "standard",
      description: "Default standard profile (auto-created)",
      cpuMillicores: 1000,
      memoryMb: 512,
      diskMb: 1024,
      timeoutSeconds: 3600,
      isDefault: true,
    }).returning();

    return created!;
  }

  async function listProfiles(companyId: string) {
    return db.select().from(containerProfiles).where(eq(containerProfiles.companyId, companyId));
  }

  async function createProfile(companyId: string, data: {
    name: string;
    description?: string;
    cpuMillicores?: number;
    memoryMb?: number;
    diskMb?: number;
    timeoutSeconds?: number;
    gpuEnabled?: boolean;
    networkPolicy?: string;
    isDefault?: boolean;
    // CONT-S05: new fields
    dockerImage?: string;
    maxContainers?: number;
    credentialProxyEnabled?: boolean;
    allowedMountPaths?: string[];
    networkMode?: string;
    maxDiskIops?: number | null;
    labels?: Record<string, string>;
  }) {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.update(containerProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(containerProfiles.companyId, companyId), eq(containerProfiles.isDefault, true)));
    }

    const [profile] = await db.insert(containerProfiles).values({
      companyId,
      ...data,
    }).returning();

    return profile!;
  }

  // ---- CONT-S05: New Profile CRUD functions ----

  // cont-s05-svc-get-profile
  async function getProfile(companyId: string, profileId: string) {
    const [profile] = await db.select().from(containerProfiles).where(
      and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
    );
    if (!profile) throw notFound("Container profile not found");
    return profile;
  }

  // cont-s05-svc-update-profile
  async function updateProfile(companyId: string, profileId: string, data: Partial<{
    name: string;
    description: string | null;
    dockerImage: string | null;
    cpuMillicores: number;
    memoryMb: number;
    diskMb: number;
    timeoutSeconds: number;
    gpuEnabled: boolean;
    mountAllowlist: string[];
    allowedMountPaths: string[];
    networkPolicy: string;
    networkMode: string;
    credentialProxyEnabled: boolean;
    maxContainers: number;
    maxDiskIops: number | null;
    labels: Record<string, string>;
    isDefault: boolean;
  }>) {
    // Verify profile exists and belongs to company
    await getProfile(companyId, profileId);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.update(containerProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(containerProfiles.companyId, companyId), eq(containerProfiles.isDefault, true)));
    }

    const [updated] = await db.update(containerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId)))
      .returning();

    return updated!;
  }

  // cont-s05-svc-delete-profile
  async function deleteProfile(companyId: string, profileId: string) {
    // Verify profile exists
    const profile = await getProfile(companyId, profileId);

    // Check no active containers using this profile
    const activeContainers = await db.select().from(containerInstances).where(
      and(
        eq(containerInstances.profileId, profileId),
        inArray(containerInstances.status, ["pending", "creating", "running"])
      )
    );
    if (activeContainers.length > 0) {
      throw conflict(`Cannot delete profile: ${activeContainers.length} active container(s) using it`);
    }

    // Check no agents referencing this profile
    const referencingAgents = await db.select().from(agents).where(
      eq(agents.containerProfileId, profileId)
    );
    if (referencingAgents.length > 0) {
      throw conflict(`Cannot delete profile: ${referencingAgents.length} agent(s) referencing it`);
    }

    await db.delete(containerProfiles).where(
      and(eq(containerProfiles.id, profileId), eq(containerProfiles.companyId, companyId))
    );

    return profile;
  }

  // cont-s05-svc-duplicate-profile
  async function duplicateProfile(companyId: string, profileId: string, newName: string) {
    const source = await getProfile(companyId, profileId);

    const { id, createdAt, updatedAt, ...data } = source;

    const [duplicated] = await db.insert(containerProfiles).values({
      ...data,
      name: newName,
      isDefault: false, // Never duplicate as default
    }).returning();

    return duplicated!;
  }

  // ---- Monitoring ----

  function startMonitoring(
    instanceId: string,
    dockerContainerId: string,
    companyId: string,
    agentId: string,
    timeoutSeconds: number,
  ): void {
    const startTime = Date.now();

    const interval = setInterval(async () => {
      try {
        const container = docker.getContainer(dockerContainerId);
        const inspection = await container.inspect();
        const state = inspection.State;

        if (!state.Running) {
          // Container has exited
          clearInterval(interval);
          activeMonitors.delete(instanceId);

          const exitCode = state.ExitCode;
          const oomKilled = state.OOMKilled;
          const isSuccess = exitCode === 0 && !oomKilled;

          const status: ContainerStatus = isSuccess ? "exited" : "failed";
          let error: string | null = null;

          if (oomKilled) {
            error = `OOM killed (exit code ${exitCode}). Consider upgrading to a larger profile.`;
            publishLiveEvent({
              companyId,
              type: "container.oom",
              payload: { instanceId, agentId, exitCode },
            });
            await emitAudit({
              req: { actor: { type: "none" }, ip: null, get: () => null } as any,
              db,
              companyId,
              action: "container.oom",
              targetType: "container_instance",
              targetId: instanceId,
              metadata: { exitCode, agentId },
            });
          } else if (!isSuccess) {
            error = `Process exited with code ${exitCode}`;
          }

          await db.update(containerInstances)
            .set({
              status,
              exitCode,
              error,
              stoppedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(containerInstances.id, instanceId));

          const eventType = isSuccess ? "container.completed" : "container.failed";
          publishLiveEvent({
            companyId,
            type: eventType,
            payload: { instanceId, agentId, exitCode, error },
          });

          return;
        }

        // Container is still running -- check timeout
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        if (timeoutSeconds > 0 && elapsedSeconds > timeoutSeconds) {
          clearInterval(interval);
          activeMonitors.delete(instanceId);

          logger.warn({ instanceId, agentId, elapsedSeconds, timeoutSeconds }, "Container timeout");

          // Graceful stop
          try {
            await container.stop({ t: DEFAULT_GRACE_PERIOD_SEC });
          } catch (err: any) {
            logger.warn({ err, instanceId }, "Error stopping timed out container");
          }

          await db.update(containerInstances)
            .set({
              status: "failed",
              error: `Timeout after ${timeoutSeconds}s`,
              stoppedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(containerInstances.id, instanceId));

          publishLiveEvent({
            companyId,
            type: "container.timeout",
            payload: { instanceId, agentId, timeoutSeconds },
          });

          await emitAudit({
            req: { actor: { type: "none" }, ip: null, get: () => null } as any,
            db,
            companyId,
            action: "container.timeout",
            targetType: "container_instance",
            targetId: instanceId,
            metadata: { agentId, timeoutSeconds, elapsedSeconds },
          });

          return;
        }

        // Update resource usage
        try {
          const stats = await container.stats({ stream: false });
          const resourceUsage = parseDockerStats(stats as Docker.ContainerStats);

          await db.update(containerInstances)
            .set({ resourceUsage: resourceUsage as unknown as Record<string, unknown>, updatedAt: new Date() })
            .where(eq(containerInstances.id, instanceId));
        } catch {
          // Stats may fail briefly -- non-critical
        }

      } catch (err: any) {
        // Container disappeared -- mark as failed
        clearInterval(interval);
        activeMonitors.delete(instanceId);

        await db.update(containerInstances)
          .set({
            status: "failed",
            error: `Monitoring error: ${err.message}`,
            stoppedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(containerInstances.id, instanceId));

        publishLiveEvent({
          companyId,
          type: "container.failed",
          payload: { instanceId, agentId, error: err.message },
        });
      }
    }, MONITOR_INTERVAL_MS);

    activeMonitors.set(instanceId, interval);
  }

  function stopMonitoring(instanceId: string): void {
    const interval = activeMonitors.get(instanceId);
    if (interval) {
      clearInterval(interval);
      activeMonitors.delete(instanceId);
    }
  }

  // ---- Cleanup stale containers on startup ----

  async function cleanupStaleContainers(): Promise<number> {
    // cont-s02-cm-cleanup-proxies
    // Cleanup any orphan proxy servers
    try {
      const proxyService = credentialProxyService(db);
      await proxyService.cleanupAllProxies();
    } catch (proxyErr: any) {
      logger.warn({ err: proxyErr }, "Error cleaning up credential proxies");
    }

    // Find instances that are "running" or "creating" in DB but may not be running in Docker
    const staleInstances = await db.select().from(containerInstances).where(
      inArray(containerInstances.status, ["running", "creating", "pending"])
    );

    let cleaned = 0;
    for (const instance of staleInstances) {
      if (instance.dockerContainerId) {
        try {
          const container = docker.getContainer(instance.dockerContainerId);
          const info = await container.inspect();
          if (!info.State.Running) {
            await db.update(containerInstances)
              .set({
                status: "failed",
                error: "Found not running during startup cleanup",
                stoppedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(containerInstances.id, instance.id));
            cleaned++;
          }
        } catch {
          // Container doesn't exist in Docker anymore
          await db.update(containerInstances)
            .set({
              status: "failed",
              error: "Container not found during startup cleanup",
              stoppedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(containerInstances.id, instance.id));
          cleaned++;
        }
      } else {
        // No Docker container ID -- was never created
        await db.update(containerInstances)
          .set({
            status: "failed",
            error: "Never started (stale pending)",
            stoppedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(containerInstances.id, instance.id));
        cleaned++;
      }
    }

    // cont-s04-cm-network-cleanup
    // Cleanup orphan networks after stale container cleanup
    try {
      const networkSvc = networkIsolationService();
      const networkCleanup = await networkSvc.cleanupOrphanNetworks();
      if (networkCleanup.removed.length > 0) {
        logger.info({ removedCount: networkCleanup.removed.length }, "Cleaned up orphan Docker networks");
      }
    } catch (netErr: any) {
      logger.warn({ err: netErr }, "Error cleaning up orphan networks");
    }

    return cleaned;
  }

  // ---- Helpers ----

  async function updateInstanceStatus(instanceId: string, status: ContainerStatus) {
    await db.update(containerInstances)
      .set({ status, updatedAt: new Date() })
      .where(eq(containerInstances.id, instanceId));
  }

  // cont-s05-svc-format-enriched
  function formatContainerInfo(row: {
    instance: typeof containerInstances.$inferSelect;
    profile: typeof containerProfiles.$inferSelect;
    agent: typeof agents.$inferSelect;
  }): ContainerInfoFull {
    return {
      id: row.instance.id,
      agentId: row.instance.agentId,
      agentName: row.agent.name,
      profileId: row.instance.profileId,
      profileName: row.profile.name,
      dockerContainerId: row.instance.dockerContainerId,
      status: row.instance.status as ContainerStatus,
      exitCode: row.instance.exitCode,
      error: row.instance.error,
      resourceUsage: row.instance.resourceUsage as ContainerResourceUsage | null,
      startedAt: row.instance.startedAt?.toISOString() ?? null,
      stoppedAt: row.instance.stoppedAt?.toISOString() ?? null,
      createdAt: row.instance.createdAt.toISOString(),
      // CONT-S05: New fields
      networkId: row.instance.networkId,
      credentialProxyPort: row.instance.credentialProxyPort,
      mountedPaths: row.instance.mountedPaths as string[] | null,
      healthCheckStatus: (row.instance.healthCheckStatus ?? "unknown") as ContainerHealthCheckStatus,
      restartCount: row.instance.restartCount ?? 0,
      lastHealthCheckAt: row.instance.lastHealthCheckAt?.toISOString() ?? null,
      labels: row.instance.labels as Record<string, string> | null,
      logStreamUrl: row.instance.logStreamUrl,
    };
  }

  return {
    checkDockerHealth,
    launchContainer,
    stopContainer,
    getContainerStatus,
    listContainers,
    resolveProfile,
    listProfiles,
    createProfile,
    cleanupStaleContainers,
    stopMonitoring,
    // CONT-S05: New profile CRUD
    getProfile,
    updateProfile,
    deleteProfile,
    duplicateProfile,
  };
}

// ---- Pure utility functions (exported for testing) ----

export function buildDockerCreateOptions(input: {
  instanceId: string;
  agentId: string;
  companyId: string;
  profile: typeof containerProfiles.$inferSelect;
  dockerImage: string;
  agentJwt: string;
  additionalEnv?: Record<string, string>;
  labels?: Record<string, string>;
  timeout?: number;
  mountPaths?: string[]; // cont-s03-cm-binds — validated mount paths
  networkMode?: string; // cont-s04-cm-build-network-mode — Docker NetworkMode
}): Docker.ContainerCreateOptions {
  const { instanceId, agentId, companyId, profile, dockerImage, agentJwt, additionalEnv, labels, mountPaths, networkMode } = input;

  const env: string[] = [
    `MNM_AGENT_ID=${agentId}`,
    `MNM_COMPANY_ID=${companyId}`,
    `MNM_INSTANCE_ID=${instanceId}`,
    `MNM_AGENT_JWT=${agentJwt}`,
    `MNM_SERVER_URL=${process.env.MNM_SERVER_URL ?? "http://host.docker.internal:3000"}`,
  ];

  if (additionalEnv) {
    for (const [key, value] of Object.entries(additionalEnv)) {
      env.push(`${key}=${value}`);
    }
  }

  return {
    Image: dockerImage,
    Env: env,
    Labels: {
      "mnm.agent_id": agentId,
      "mnm.company_id": companyId,
      "mnm.instance_id": instanceId,
      "mnm.profile": profile.name,
      ...labels,
    },
    HostConfig: {
      AutoRemove: true,
      ReadonlyRootfs: true,
      SecurityOpt: ["no-new-privileges"],
      Memory: profile.memoryMb * 1024 * 1024,
      NanoCpus: profile.cpuMillicores * 1_000_000,
      CpuPeriod: 100000,
      PidsLimit: 256,
      // cont-s04-cm-build-network-mode — set NetworkMode from profile config
      NetworkMode: networkMode ?? "none",
      Binds: [
        "/dev/null:/workspace/.env:ro", // Shadow .env
        // cont-s03-cm-binds — add validated mount paths as read-only binds
        ...(mountPaths ?? []).map((p) => `${p}:${p}:ro`),
      ],
      Tmpfs: {
        "/tmp": "rw,noexec,nosuid,size=256m",
      },
    },
  };
}

export function parseDockerStats(stats: Docker.ContainerStats): ContainerResourceUsage {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage ?? 0);
  const numCpus = stats.cpu_stats.online_cpus ?? 1;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

  const memoryUsed = stats.memory_stats.usage ?? 0;
  const memoryLimit = stats.memory_stats.limit ?? 1;
  const cache = (stats.memory_stats.stats as Record<string, number>)?.cache ?? 0;
  const memoryUsedMb = (memoryUsed - cache) / (1024 * 1024);
  const memoryLimitMb = memoryLimit / (1024 * 1024);

  let networkRxBytes = 0;
  let networkTxBytes = 0;
  if (stats.networks) {
    for (const iface of Object.values(stats.networks)) {
      networkRxBytes += (iface as { rx_bytes?: number }).rx_bytes ?? 0;
      networkTxBytes += (iface as { tx_bytes?: number }).tx_bytes ?? 0;
    }
  }

  return {
    cpuPercent: Math.round(cpuPercent * 100) / 100,
    memoryUsedMb: Math.round(memoryUsedMb * 100) / 100,
    memoryLimitMb: Math.round(memoryLimitMb),
    memoryPercent: Math.round((memoryUsedMb / memoryLimitMb) * 100 * 100) / 100,
    networkRxBytes,
    networkTxBytes,
    pidsCount: stats.pids_stats?.current ?? 0,
    timestamp: new Date().toISOString(),
  };
}
