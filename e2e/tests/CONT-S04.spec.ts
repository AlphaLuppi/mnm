/**
 * CONT-S04: Isolation Reseau Docker -- Networks isoles par company/project -- E2E Tests
 *
 * These tests verify the deliverables of CONT-S04:
 *   - Groupe 1: Service file structure (T01-T03)
 *   - Groupe 2: ensureCompanyNetwork (T04-T08)
 *   - Groupe 3: resolveNetworkConfig (T09-T12)
 *   - Groupe 4: attachContainerToNetwork / detachContainerFromNetwork (T13-T16)
 *   - Groupe 5: listCompanyNetworks / getNetworkInfo (T17-T20)
 *   - Groupe 6: removeNetwork (T21-T23)
 *   - Groupe 7: cleanupOrphanNetworks (T24-T27)
 *   - Groupe 8: ContainerManager integration -- launchContainer (T28-T32)
 *   - Groupe 9: ContainerManager integration -- stopContainer (T33-T35)
 *   - Groupe 10: ContainerManager integration -- cleanup (T36-T37)
 *   - Groupe 11: buildDockerCreateOptions (T38-T40)
 *   - Groupe 12: Routes -- list/get networks (T41-T44)
 *   - Groupe 13: Routes -- delete/cleanup networks (T45-T48)
 *   - Groupe 14: Types and exports (T49-T52)
 *   - Groupe 15: Barrel exports (T53-T55)
 *   - Groupe 16: Audit events (T56-T58)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const NETWORK_ISOLATION_FILE = resolve(ROOT, "server/src/services/network-isolation.ts");
const CONTAINER_MANAGER_FILE = resolve(ROOT, "server/src/services/container-manager.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/containers.ts");
const CONTAINER_TYPES_FILE = resolve(ROOT, "packages/shared/src/types/container.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Service file structure (T01-T03)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Service file structure", () => {
  test("T01 -- network-isolation.ts exists and exports networkIsolationService", async () => {
    await expect(fsAccess(NETWORK_ISOLATION_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+networkIsolationService/);
  });

  test("T02 -- network-isolation.ts imports Docker from dockerode", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/import\s+Docker\s+from\s+["']dockerode["']/);
  });

  test("T03 -- network-isolation.ts defines NETWORK_PREFIX constant", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/const\s+NETWORK_PREFIX\s*=\s*["']mnm-company-["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: ensureCompanyNetwork (T04-T08)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: ensureCompanyNetwork", () => {
  test("T04 -- function ensureCompanyNetwork exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+ensureCompanyNetwork/);
  });

  test("T05 -- builds network name with mnm-company- prefix", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toContain("NETWORK_PREFIX");
    expect(content).toMatch(/`\$\{NETWORK_PREFIX\}\$\{companyId\}`/);
  });

  test("T06 -- calls docker.createNetwork with bridge driver", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/docker\.createNetwork/);
    expect(content).toMatch(/Driver:\s*["']bridge["']/);
  });

  test("T07 -- uses labels managed-by: mnm", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/["']managed-by["']\s*:\s*["']mnm["']/);
  });

  test("T08 -- catches already exists error and returns existing network", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/already exists/);
    expect(content).toMatch(/created:\s*false/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: resolveNetworkConfig (T09-T12)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: resolveNetworkConfig", () => {
  test("T09 -- function resolveNetworkConfig exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+resolveNetworkConfig/);
  });

  test("T10 -- returns dockerNetworkMode none for isolated mode", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/case\s+["']isolated["']/);
    expect(content).toMatch(/dockerNetworkMode:\s*["']none["']/);
  });

  test("T11 -- calls ensureCompanyNetwork for company-bridge mode", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/case\s+["']company-bridge["']/);
    // Should call ensureCompanyNetwork inside the company-bridge case block
    const switchSection = content.split("switch (networkMode)")[1]?.split("default:")[0] ?? "";
    const companyBridgeBlock = switchSection.split("company-bridge")[1]?.split("host-restricted")[0] ?? "";
    expect(companyBridgeBlock).toContain("ensureCompanyNetwork");
  });

  test("T12 -- returns dockerNetworkMode host for host-restricted mode", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/case\s+["']host-restricted["']/);
    expect(content).toMatch(/dockerNetworkMode:\s*["']host["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: attachContainerToNetwork / detachContainerFromNetwork (T13-T16)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: attach/detach container", () => {
  test("T13 -- function attachContainerToNetwork exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+attachContainerToNetwork/);
  });

  test("T14 -- attach calls network.connect with Container", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/network\.connect\(\s*\{\s*Container/);
  });

  test("T15 -- function detachContainerFromNetwork exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+detachContainerFromNetwork/);
  });

  test("T16 -- detach calls network.disconnect with Container", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/network\.disconnect\(\s*\{\s*Container/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: listCompanyNetworks / getNetworkInfo (T17-T20)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: list/get networks", () => {
  test("T17 -- function listCompanyNetworks exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+listCompanyNetworks/);
  });

  test("T18 -- filters networks by label managed-by=mnm and company-id", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    // Should filter by managed-by and company-id labels
    expect(content).toMatch(/managed-by=mnm/);
    expect(content).toMatch(/company-id=/);
  });

  test("T19 -- function getNetworkInfo exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+getNetworkInfo/);
  });

  test("T20 -- returns id, name, containerCount, createdAt", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    // formatNetworkInfo should return these fields
    expect(content).toContain("id: net.Id");
    expect(content).toContain("name: net.Name");
    expect(content).toContain("containerCount");
    expect(content).toContain("createdAt");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: removeNetwork (T21-T23)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: removeNetwork", () => {
  test("T21 -- function removeNetwork exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+removeNetwork/);
  });

  test("T22 -- calls network.inspect to check containers", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    // removeNetwork should inspect before removing
    const removeSection = content.split("async function removeNetwork")[1]?.split("async function")[0];
    expect(removeSection).toMatch(/network\.inspect\(\)/);
  });

  test("T23 -- throws conflict if containers are attached", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    const removeSection = content.split("async function removeNetwork")[1]?.split("async function")[0];
    expect(removeSection).toMatch(/throw\s+conflict/);
    expect(removeSection).toMatch(/container\(s\) still attached/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: cleanupOrphanNetworks (T24-T27)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: cleanupOrphanNetworks", () => {
  test("T24 -- function cleanupOrphanNetworks exists", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+cleanupOrphanNetworks/);
  });

  test("T25 -- lists all networks with mnm-company- prefix filter", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    const cleanupSection = content.split("async function cleanupOrphanNetworks")[1]?.split("async function")[0] ?? "";
    expect(cleanupSection).toContain("NETWORK_PREFIX");
    expect(cleanupSection).toMatch(/startsWith\(NETWORK_PREFIX\)/);
  });

  test("T26 -- removes networks with 0 containers", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    const cleanupSection = content.split("async function cleanupOrphanNetworks")[1]?.split("function formatNetworkInfo")[0] ?? "";
    expect(cleanupSection).toMatch(/containerCount\s*===\s*0/);
    expect(cleanupSection).toMatch(/network\.remove\(\)/);
  });

  test("T27 -- returns removed and errors arrays", async () => {
    const content = await readFile(NETWORK_ISOLATION_FILE, "utf-8");
    const cleanupSection = content.split("async function cleanupOrphanNetworks")[1]?.split("function formatNetworkInfo")[0] ?? "";
    expect(cleanupSection).toContain("removed.push");
    expect(cleanupSection).toContain("errors.push");
    expect(cleanupSection).toMatch(/return\s*\{\s*removed,\s*errors\s*\}/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: ContainerManager integration -- launchContainer (T28-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: ContainerManager launchContainer integration", () => {
  test("T28 -- container-manager.ts imports networkIsolationService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{\s*networkIsolationService\s*\}\s*from\s*["'].\/network-isolation/);
  });

  test("T29 -- launchContainer contains cont-s04-cm-network-resolve comment", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cont-s04-cm-network-resolve");
  });

  test("T30 -- launchContainer calls resolveNetworkConfig with profile networkMode", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/networkSvc\.resolveNetworkConfig\(/);
    expect(content).toContain("profileNetworkMode");
  });

  test("T31 -- launchContainer calls attachContainerToNetwork for company-bridge mode", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cont-s04-cm-network-attach");
    expect(content).toMatch(/networkSvc\.attachContainerToNetwork\(/);
  });

  test("T32 -- launchContainer sets networkId in container_instances update", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cont-s04-instance-network-id");
    expect(content).toMatch(/networkId:\s*resolvedNetworkId/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: ContainerManager integration -- stopContainer (T33-T35)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: ContainerManager stopContainer integration", () => {
  test("T33 -- stopContainer contains cont-s04-cm-network-detach comment", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cont-s04-cm-network-detach");
  });

  test("T34 -- stopContainer calls detachContainerFromNetwork when networkId present", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Should check instance.networkId before detaching
    expect(content).toMatch(/instance\.networkId\s*&&\s*instance\.dockerContainerId/);
    expect(content).toMatch(/networkSvc\.detachContainerFromNetwork\(/);
  });

  test("T35 -- stopContainer handles detach errors gracefully with try/catch", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // The detach section should be wrapped in try/catch
    const detachSection = content.split("cont-s04-cm-network-detach")[1]?.split("cont-s02-cm-proxy-stop")[0] ?? "";
    expect(detachSection).toContain("try {");
    expect(detachSection).toContain("catch");
    expect(detachSection).toMatch(/Error detaching container from network/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: ContainerManager integration -- cleanup (T36-T37)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: ContainerManager cleanup integration", () => {
  test("T36 -- cleanupStaleContainers contains cont-s04-cm-network-cleanup comment", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cont-s04-cm-network-cleanup");
  });

  test("T37 -- cleanupStaleContainers calls cleanupOrphanNetworks", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    const cleanupSection = content.split("cont-s04-cm-network-cleanup")[1]?.split("return cleaned")[0] ?? "";
    expect(cleanupSection).toMatch(/networkSvc\.cleanupOrphanNetworks\(\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: buildDockerCreateOptions (T38-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: buildDockerCreateOptions", () => {
  test("T38 -- buildDockerCreateOptions accepts networkMode parameter", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // The input type should include networkMode
    const buildSection = content.split("export function buildDockerCreateOptions")[1]?.split("): Docker.ContainerCreateOptions")[0] ?? "";
    expect(buildSection).toContain("networkMode");
    expect(buildSection).toContain("cont-s04-cm-build-network-mode");
  });

  test("T39 -- buildDockerCreateOptions sets NetworkMode in HostConfig", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // HostConfig should include NetworkMode
    const hostConfigSection = content.split("HostConfig:")[1]?.split("Binds:")[0] ?? "";
    expect(hostConfigSection).toContain("NetworkMode:");
  });

  test("T40 -- default NetworkMode is none when not specified", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Should default to "none"
    expect(content).toMatch(/NetworkMode:\s*networkMode\s*\?\?\s*["']none["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Routes -- list/get networks (T41-T44)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Routes -- list/get networks", () => {
  test("T41 -- route GET /companies/:companyId/containers/networks exists in containers.ts", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("cont-s04-route-list-networks");
    expect(content).toMatch(/router\.get\(\s*\n?\s*["']\/companies\/:companyId\/containers\/networks["']/);
  });

  test("T42 -- route GET /companies/:companyId/containers/networks/:networkId exists", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("cont-s04-route-get-network");
    expect(content).toMatch(/router\.get\(\s*\n?\s*["']\/companies\/:companyId\/containers\/networks\/:networkId["']/);
  });

  test("T43 -- both network routes use requirePermission agents:manage_containers", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Count occurrences of requirePermission near network routes
    const networkSection = content.split("CONT-S04: Network isolation routes")[1]?.split("GET /companies/:companyId/containers/health")[0] ?? "";
    const permissionMatches = networkSection.match(/requirePermission\(db,\s*["']agents:manage_containers["']\)/g);
    // Should have at least 4 (list, get, delete, cleanup)
    expect(permissionMatches?.length).toBeGreaterThanOrEqual(4);
  });

  test("T44 -- route handlers call networkIsolationService functions", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/networkIsolationService\(\)/);
    expect(content).toMatch(/networkSvc\.listCompanyNetworks/);
    expect(content).toMatch(/networkSvc\.getNetworkInfo/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: Routes -- delete/cleanup networks (T45-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 13: Routes -- delete/cleanup networks", () => {
  test("T45 -- route DELETE /companies/:companyId/containers/networks/:networkId exists", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("cont-s04-route-delete-network");
    expect(content).toMatch(/router\.delete\(\s*\n?\s*["']\/companies\/:companyId\/containers\/networks\/:networkId["']/);
  });

  test("T46 -- route POST /companies/:companyId/containers/networks/cleanup exists", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("cont-s04-route-cleanup-networks");
    expect(content).toMatch(/router\.post\(\s*\n?\s*["']\/companies\/:companyId\/containers\/networks\/cleanup["']/);
  });

  test("T47 -- delete route emits audit event container.network_deleted", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("cont-s04-audit-network-deleted");
    expect(content).toMatch(/action:\s*["']container\.network_deleted["']/);
  });

  test("T48 -- cleanup route emits audit event container.network_cleaned", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("cont-s04-audit-network-cleaned");
    expect(content).toMatch(/action:\s*["']container\.network_cleaned["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 14: Types and exports (T49-T52)
// ---------------------------------------------------------------------------

test.describe("Groupe 14: Types and exports", () => {
  test("T49 -- container.ts in shared types exports NetworkInfo interface", async () => {
    const content = await readFile(CONTAINER_TYPES_FILE, "utf-8");
    expect(content).toContain("cont-s04-type-network-info");
    expect(content).toMatch(/export\s+interface\s+NetworkInfo/);
  });

  test("T50 -- NetworkInfo has fields: id, name, companyId, driver, containerCount, createdAt", async () => {
    const content = await readFile(CONTAINER_TYPES_FILE, "utf-8");
    // Extract the full NetworkInfo interface block using the next interface as delimiter
    const networkInfoSection = content.split("interface NetworkInfo")[1]?.split("interface NetworkCleanupResult")[0] ?? "";
    expect(networkInfoSection).toContain("id: string");
    expect(networkInfoSection).toContain("name: string");
    expect(networkInfoSection).toContain("companyId: string");
    expect(networkInfoSection).toContain("driver: string");
    expect(networkInfoSection).toContain("containerCount: number");
    expect(networkInfoSection).toContain("createdAt: string");
  });

  test("T51 -- container.ts exports NetworkCleanupResult interface", async () => {
    const content = await readFile(CONTAINER_TYPES_FILE, "utf-8");
    expect(content).toContain("cont-s04-type-network-cleanup-result");
    expect(content).toMatch(/export\s+interface\s+NetworkCleanupResult/);
  });

  test("T52 -- types/index.ts exports NetworkInfo and NetworkCleanupResult", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("cont-s04-export-types");
    expect(content).toContain("NetworkInfo");
    expect(content).toContain("NetworkCleanupResult");
  });
});

// ---------------------------------------------------------------------------
// Groupe 15: Barrel exports (T53-T55)
// ---------------------------------------------------------------------------

test.describe("Groupe 15: Barrel exports", () => {
  test("T53 -- server/src/services/index.ts exports networkIsolationService", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("cont-s04-network-isolation-service");
    expect(content).toMatch(/export\s*\{\s*networkIsolationService\s*\}\s*from/);
  });

  test("T54 -- routes use assertCompanyAccess for company isolation", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    const networkSection = content.split("CONT-S04: Network isolation routes")[1]?.split("GET /companies/:companyId/containers/health")[0] ?? "";
    const accessMatches = networkSection.match(/assertCompanyAccess\(req,\s*companyId/g);
    expect(accessMatches?.length).toBeGreaterThanOrEqual(4);
  });

  test("T55 -- routes use getActorInfo for audit actor", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    const networkSection = content.split("CONT-S04: Network isolation routes")[1]?.split("GET /companies/:companyId/containers/health")[0] ?? "";
    expect(networkSection).toMatch(/getActorInfo\(req\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 16: Audit events (T56-T58)
// ---------------------------------------------------------------------------

test.describe("Groupe 16: Audit events", () => {
  test("T56 -- container-manager.ts emits container.network_created audit on new network creation", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cont-s04-audit-network-created");
    expect(content).toMatch(/action:\s*["']container\.network_created["']/);
    expect(content).toMatch(/targetType:\s*["']docker_network["']/);
  });

  test("T57 -- containers.ts routes emit container.network_deleted audit on network deletion", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    const deleteSection = content.split("cont-s04-route-delete-network")[1]?.split("cont-s04-route-cleanup-networks")[0] ?? "";
    expect(deleteSection).toMatch(/action:\s*["']container\.network_deleted["']/);
    expect(deleteSection).toMatch(/targetType:\s*["']docker_network["']/);
  });

  test("T58 -- containers.ts routes emit container.network_cleaned audit on cleanup", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    const cleanupSection = content.split("cont-s04-route-cleanup-networks")[1]?.split("GET /companies/:companyId/containers/health")[0] ?? "";
    expect(cleanupSection).toMatch(/action:\s*["']container\.network_cleaned["']/);
    expect(cleanupSection).toMatch(/targetType:\s*["']docker_network["']/);
  });
});
