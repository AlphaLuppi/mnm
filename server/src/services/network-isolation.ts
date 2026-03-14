import Docker from "dockerode";
import type { ContainerNetworkMode, NetworkInfo, NetworkCleanupResult } from "@mnm/shared";
import { conflict, notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";

// cont-s04-network-isolation-service
const NETWORK_PREFIX = "mnm-company-"; // cont-s04-ensure-company-network
const NETWORK_LABELS_BASE: Record<string, string> = {
  "managed-by": "mnm",
  purpose: "container-isolation",
};

export function networkIsolationService() {
  const docker = new Docker({ socketPath: "/var/run/docker.sock" });

  // cont-s04-ensure-company-network
  /**
   * Create or retrieve the company-scoped Docker bridge network.
   * Network name: mnm-company-{companyId}
   * Idempotent — returns existing network if already created.
   */
  async function ensureCompanyNetwork(
    companyId: string,
  ): Promise<{ id: string; name: string; created: boolean }> {
    const networkName = `${NETWORK_PREFIX}${companyId}`;

    // Check if network already exists
    try {
      const networks = await docker.listNetworks({
        filters: JSON.stringify({ name: [networkName] }),
      });

      const existing = networks.find((n) => n.Name === networkName);
      if (existing) {
        return { id: existing.Id, name: networkName, created: false };
      }
    } catch (err: any) {
      logger.warn({ err, companyId }, "Error listing networks, will attempt create");
    }

    // Create new company network
    try {
      const network = await docker.createNetwork({
        Name: networkName,
        Driver: "bridge",
        Internal: true, // No external access — isolated company bridge
        Labels: {
          ...NETWORK_LABELS_BASE,
          "company-id": companyId,
        },
      });

      return { id: network.id, name: networkName, created: true };
    } catch (err: any) {
      // Handle race condition where another process already created it
      if (err.statusCode === 409 || err.message?.includes("already exists")) {
        const networks = await docker.listNetworks({
          filters: JSON.stringify({ name: [networkName] }),
        });
        const existing = networks.find((n) => n.Name === networkName);
        if (existing) {
          return { id: existing.Id, name: networkName, created: false };
        }
      }
      throw err;
    }
  }

  // cont-s04-resolve-network-config
  /**
   * Resolve the Docker NetworkMode and optional networkId based on the profile's networkMode setting.
   * - "isolated" → NetworkMode: "none", no network
   * - "company-bridge" → create/get company network, attach after container start
   * - "host-restricted" → NetworkMode: "host", uses host network
   */
  async function resolveNetworkConfig(
    networkMode: ContainerNetworkMode,
    companyId: string,
  ): Promise<{ dockerNetworkMode: string; networkId: string | null }> {
    switch (networkMode) {
      case "isolated":
        return { dockerNetworkMode: "none", networkId: null };

      case "company-bridge": {
        const result = await ensureCompanyNetwork(companyId);
        return { dockerNetworkMode: result.name, networkId: result.id };
      }

      case "host-restricted":
        return { dockerNetworkMode: "host", networkId: null };

      default:
        // Fallback to isolated for unknown modes
        return { dockerNetworkMode: "none", networkId: null };
    }
  }

  // cont-s04-attach-container
  /**
   * Attach a running Docker container to a network.
   */
  async function attachContainerToNetwork(
    dockerContainerId: string,
    networkId: string,
  ): Promise<void> {
    const network = docker.getNetwork(networkId);
    await network.connect({ Container: dockerContainerId });
  }

  // cont-s04-detach-container
  /**
   * Detach a Docker container from a network.
   */
  async function detachContainerFromNetwork(
    dockerContainerId: string,
    networkId: string,
  ): Promise<void> {
    const network = docker.getNetwork(networkId);
    await network.disconnect({ Container: dockerContainerId });
  }

  // cont-s04-list-networks
  /**
   * List all Docker networks belonging to a company.
   */
  async function listCompanyNetworks(companyId: string): Promise<NetworkInfo[]> {
    const networks = await docker.listNetworks({
      filters: JSON.stringify({
        label: [`managed-by=mnm`, `company-id=${companyId}`],
      }),
    });

    return networks.map((n) => formatNetworkInfo(n, companyId));
  }

  // cont-s04-get-network-info
  /**
   * Get information about a specific Docker network.
   */
  async function getNetworkInfo(networkId: string): Promise<NetworkInfo> {
    try {
      const network = docker.getNetwork(networkId);
      const info = await network.inspect();

      const companyId = (info.Labels as Record<string, string>)?.["company-id"] ?? "unknown";
      const containerCount = info.Containers ? Object.keys(info.Containers).length : 0;

      return {
        id: info.Id,
        name: info.Name,
        companyId,
        driver: info.Driver,
        containerCount,
        createdAt: info.Created,
      };
    } catch (err: any) {
      if (err.statusCode === 404) {
        throw notFound("Docker network not found");
      }
      throw err;
    }
  }

  // cont-s04-remove-network
  /**
   * Remove a Docker network. Refuses if containers are still attached.
   */
  async function removeNetwork(networkId: string): Promise<void> {
    const network = docker.getNetwork(networkId);

    // Check for attached containers
    const info = await network.inspect();
    const containerCount = info.Containers ? Object.keys(info.Containers).length : 0;

    if (containerCount > 0) {
      throw conflict(`Cannot remove network: ${containerCount} container(s) still attached`);
    }

    await network.remove();
  }

  // cont-s04-cleanup-orphans
  /**
   * Clean up orphan MnM networks (networks with no attached containers).
   */
  async function cleanupOrphanNetworks(): Promise<NetworkCleanupResult> {
    const removed: string[] = [];
    const errors: string[] = [];

    try {
      const networks = await docker.listNetworks({
        filters: JSON.stringify({
          label: ["managed-by=mnm"],
        }),
      });

      // Filter to networks with mnm-company- prefix
      const mnmNetworks = networks.filter((n) => n.Name.startsWith(NETWORK_PREFIX));

      for (const net of mnmNetworks) {
        try {
          const network = docker.getNetwork(net.Id);
          const info = await network.inspect();
          const containerCount = info.Containers ? Object.keys(info.Containers).length : 0;

          if (containerCount === 0) {
            await network.remove();
            removed.push(net.Id);
            logger.info({ networkId: net.Id, networkName: net.Name }, "Removed orphan network");
          }
        } catch (err: any) {
          errors.push(net.Id);
          logger.warn({ err, networkId: net.Id }, "Failed to cleanup orphan network");
        }
      }
    } catch (err: any) {
      logger.error({ err }, "Error listing networks for cleanup");
    }

    return { removed, errors };
  }

  // ---- Helpers ----

  function formatNetworkInfo(
    net: Docker.NetworkInspectInfo,
    companyId: string,
  ): NetworkInfo {
    const containerCount = net.Containers ? Object.keys(net.Containers).length : 0;
    return {
      id: net.Id,
      name: net.Name,
      companyId,
      driver: net.Driver ?? "bridge",
      containerCount,
      createdAt: net.Created ?? new Date().toISOString(),
    };
  }

  return {
    ensureCompanyNetwork,
    resolveNetworkConfig,
    attachContainerToNetwork,
    detachContainerFromNetwork,
    listCompanyNetworks,
    getNetworkInfo,
    removeNetwork,
    cleanupOrphanNetworks,
  };
}
