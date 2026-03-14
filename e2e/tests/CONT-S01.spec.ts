/**
 * CONT-S01: ContainerManager Docker -- Lifecycle Complet Agents Containerises -- E2E Tests
 *
 * These tests verify the deliverables of CONT-S01:
 *   - Groupe 1: File existence (T01-T06)
 *   - Groupe 2: Shared types container.ts (T07-T09)
 *   - Groupe 3: Dependencies (T10)
 *   - Groupe 4: ContainerManager service functions (T11-T18)
 *   - Groupe 5: Security flags in buildDockerCreateOptions (T19-T26)
 *   - Groupe 6: Environment variables and labels (T27-T28)
 *   - Groupe 7: Constants (T29-T31)
 *   - Groupe 8: Monitoring detection (T32-T34)
 *   - Groupe 9: Events (T35-T36)
 *   - Groupe 10: Routes containers.ts (T37-T46)
 *   - Groupe 11: Barrel exports and registry (T47-T49)
 *   - Groupe 12: Profile cascade and cleanup (T50-T53)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const CONTAINER_MANAGER_FILE = resolve(ROOT, "server/src/services/container-manager.ts");
const DOCKER_ADAPTER_INDEX = resolve(ROOT, "server/src/adapters/docker/index.ts");
const DOCKER_EXECUTE_FILE = resolve(ROOT, "server/src/adapters/docker/execute.ts");
const DOCKER_TEST_FILE = resolve(ROOT, "server/src/adapters/docker/test.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/containers.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/container.ts");
const SERVER_PACKAGE_JSON = resolve(ROOT, "server/package.json");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const REGISTRY_FILE = resolve(ROOT, "server/src/adapters/registry.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01-T06)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 -- container-manager.ts exists", async () => {
    await expect(fsAccess(CONTAINER_MANAGER_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 -- Docker adapter index.ts exists", async () => {
    await expect(fsAccess(DOCKER_ADAPTER_INDEX).then(() => true)).resolves.toBe(true);
  });

  test("T03 -- Docker adapter execute.ts exists", async () => {
    await expect(fsAccess(DOCKER_EXECUTE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T04 -- Docker adapter test.ts exists", async () => {
    await expect(fsAccess(DOCKER_TEST_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T05 -- containers routes file exists", async () => {
    await expect(fsAccess(ROUTES_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T06 -- shared types container.ts exists", async () => {
    await expect(fsAccess(TYPES_FILE).then(() => true)).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Shared types container.ts (T07-T09)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Shared types container.ts", () => {
  test("T07 -- CONTAINER_STATUSES defines 7 statuses", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+CONTAINER_STATUSES\s*=/);
    const statuses = ["pending", "creating", "running", "stopping", "exited", "failed", "stopped"];
    for (const s of statuses) {
      expect(content, `Status "${s}" should be defined`).toContain(`"${s}"`);
    }
  });

  test("T08 -- CONTAINER_PROFILE_PRESETS defines 4 presets (light, standard, heavy, gpu)", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+CONTAINER_PROFILE_PRESETS\s*=/);
    const presets = ["light", "standard", "heavy", "gpu"];
    for (const p of presets) {
      expect(content, `Preset "${p}" should be defined`).toContain(p);
    }
    // Verify specific values
    expect(content).toContain("cpuMillicores");
    expect(content).toContain("memoryMb");
    expect(content).toContain("diskMb");
    expect(content).toContain("timeoutSeconds");
  });

  test("T09 -- CONTAINER_EVENT_TYPES defines 8 event types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+CONTAINER_EVENT_TYPES\s*=/);
    const events = [
      "container.created",
      "container.started",
      "container.completed",
      "container.failed",
      "container.timeout",
      "container.oom",
      "container.stopped",
      "container.resource_update",
    ];
    for (const e of events) {
      expect(content, `Event type "${e}" should be defined`).toContain(`"${e}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Dependencies (T10)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Dependencies", () => {
  test("T10 -- dockerode dependency in server/package.json", async () => {
    const content = await readFile(SERVER_PACKAGE_JSON, "utf-8");
    const pkg = JSON.parse(content);
    expect(pkg.dependencies).toHaveProperty("dockerode");
    expect(pkg.devDependencies).toHaveProperty("@types/dockerode");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: ContainerManager service functions (T11-T18)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: ContainerManager service functions", () => {
  test("T11 -- launchContainer function exported via containerManagerService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+launchContainer\s*\(/);
    // Returned in service object
    expect(content).toContain("launchContainer,");
  });

  test("T12 -- stopContainer function exported via containerManagerService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+stopContainer\s*\(/);
    expect(content).toContain("stopContainer,");
  });

  test("T13 -- getContainerStatus function exported via containerManagerService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+getContainerStatus\s*\(/);
    expect(content).toContain("getContainerStatus,");
  });

  test("T14 -- listContainers function exported via containerManagerService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+listContainers\s*\(/);
    expect(content).toContain("listContainers,");
  });

  test("T15 -- checkDockerHealth function exported via containerManagerService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+checkDockerHealth\s*\(/);
    expect(content).toContain("checkDockerHealth,");
  });

  test("T16 -- cleanupStaleContainers function exported via containerManagerService", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+cleanupStaleContainers\s*\(/);
    expect(content).toContain("cleanupStaleContainers,");
  });

  test("T17 -- buildDockerCreateOptions exported as standalone function", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+buildDockerCreateOptions\s*\(/);
  });

  test("T18 -- parseDockerStats exported as standalone function", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+parseDockerStats\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Security flags in buildDockerCreateOptions (T19-T26)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Security flags in buildDockerCreateOptions", () => {
  test("T19 -- AutoRemove flag set to true", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/AutoRemove:\s*true/);
  });

  test("T20 -- ReadonlyRootfs flag set to true", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/ReadonlyRootfs:\s*true/);
  });

  test("T21 -- SecurityOpt includes no-new-privileges", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/SecurityOpt:\s*\[\s*"no-new-privileges"\s*\]/);
  });

  test("T22 -- Shadow .env mount: /dev/null:/workspace/.env:ro", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("/dev/null:/workspace/.env:ro");
  });

  test("T23 -- Memory limit from profile (memoryMb * 1024 * 1024)", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/Memory:\s*profile\.memoryMb\s*\*\s*1024\s*\*\s*1024/);
  });

  test("T24 -- NanoCpus limit from profile (cpuMillicores * 1_000_000)", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/NanoCpus:\s*profile\.cpuMillicores\s*\*\s*1[_,]?000[_,]?000/);
  });

  test("T25 -- PidsLimit set to 256", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/PidsLimit:\s*256/);
  });

  test("T26 -- Tmpfs /tmp mount with noexec,nosuid", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/Tmpfs:\s*\{/);
    expect(content).toContain("/tmp");
    expect(content).toContain("noexec");
    expect(content).toContain("nosuid");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Environment variables and labels (T27-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Environment variables and labels", () => {
  test("T27 -- MNM_* environment variables injected", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    const envVars = [
      "MNM_AGENT_ID",
      "MNM_COMPANY_ID",
      "MNM_INSTANCE_ID",
      "MNM_AGENT_JWT",
      "MNM_SERVER_URL",
    ];
    for (const v of envVars) {
      expect(content, `Env var "${v}" should be injected`).toContain(v);
    }
  });

  test("T28 -- Docker labels mnm.* set", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    const labels = [
      "mnm.agent_id",
      "mnm.company_id",
      "mnm.instance_id",
      "mnm.profile",
    ];
    for (const l of labels) {
      expect(content, `Label "${l}" should be set`).toContain(`"${l}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Constants (T29-T31)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Constants", () => {
  test("T29 -- MONITOR_INTERVAL_MS = 5000 (5 seconds)", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/MONITOR_INTERVAL_MS\s*=\s*5[_,]?000/);
  });

  test("T30 -- MAX_CONTAINERS_PER_COMPANY = 50", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/MAX_CONTAINERS_PER_COMPANY\s*=\s*50/);
  });

  test("T31 -- DEFAULT_GRACE_PERIOD_SEC = 10", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/DEFAULT_GRACE_PERIOD_SEC\s*=\s*10/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Monitoring detection (T32-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Monitoring detection", () => {
  test("T32 -- Timeout detection in monitoring loop", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Check timeout detection logic
    expect(content).toMatch(/elapsedSeconds\s*>\s*timeoutSeconds/);
    expect(content).toContain("Timeout after");
    expect(content).toContain("container.timeout");
  });

  test("T33 -- OOM detection via State.OOMKilled in monitoring", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("OOMKilled");
    expect(content).toContain("OOM killed");
    expect(content).toContain("container.oom");
  });

  test("T34 -- Resource usage update (JSONB) in monitoring loop", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("parseDockerStats");
    // Verify stats are fetched and stored
    expect(content).toMatch(/container\.stats\s*\(\s*\{\s*stream:\s*false\s*\}\s*\)/);
    expect(content).toContain("resourceUsage");
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Events (T35-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Events", () => {
  test("T35 -- publishLiveEvent called for container lifecycle events", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("publishLiveEvent");
    const liveEvents = [
      "container.started",
      "container.completed",
      "container.failed",
      "container.timeout",
      "container.oom",
      "container.stopped",
    ];
    for (const e of liveEvents) {
      expect(content, `Live event "${e}" should be published`).toContain(`"${e}"`);
    }
  });

  test("T36 -- emitAudit called for started/stopped/timeout/oom", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("emitAudit");
    // Count emitAudit calls -- at least 4 (started, stopped, timeout, oom)
    const emitAuditMatches = content.match(/emitAudit\s*\(/g);
    expect(emitAuditMatches).not.toBeNull();
    expect(emitAuditMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Routes containers.ts (T37-T46)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Routes containers.ts", () => {
  test("T37 -- POST route for launching containers with agents:launch permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/router\.post\s*\(\s*\n?\s*["'`]\/companies\/:companyId\/containers["'`]/);
    // Verify permission guard
    expect(content).toContain('"agents:launch"');
  });

  test("T38 -- GET route for container status with agents:launch permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/router\.get\s*\(\s*\n?\s*["'`]\/companies\/:companyId\/containers\/:containerId["'`]/);
    expect(content).toContain('"agents:launch"');
  });

  test("T39 -- POST route for stopping containers with agents:manage_containers permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("/containers/:containerId/stop");
    expect(content).toContain('"agents:manage_containers"');
  });

  test("T40 -- GET route for listing containers with agents:launch permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The list route is GET /companies/:companyId/containers
    const getRoutes = content.match(/router\.get\s*\(\s*\n?\s*["'`]\/companies\/:companyId\/containers["'`]/g);
    expect(getRoutes).not.toBeNull();
    expect(getRoutes!.length).toBeGreaterThanOrEqual(1);
  });

  test("T41 -- GET route for listing profiles with agents:manage_containers permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("/containers/profiles");
    // Profiles routes use agents:manage_containers
    const profilesSection = content.substring(content.indexOf("containers/profiles"));
    expect(profilesSection).toContain("agents:manage_containers");
  });

  test("T42 -- POST route for creating profiles with agents:manage_containers permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // POST profiles route
    expect(content).toMatch(/router\.post\s*\(\s*\n?\s*["'`]\/companies\/:companyId\/containers\/profiles["'`]/);
  });

  test("T43 -- GET health check route with agents:manage_containers permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("/containers/health");
    expect(content).toContain("checkDockerHealth");
  });

  test("T44 -- Zod launchSchema with agentId, profileId, dockerImage, environmentVars, timeout", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/launchSchema\s*=\s*z\.object\s*\(/);
    expect(content).toContain("agentId: z.string().uuid()");
    expect(content).toContain("profileId: z.string().uuid().optional()");
    expect(content).toContain("dockerImage: z.string().optional()");
    expect(content).toContain("environmentVars: z.record(z.string()).optional()");
    expect(content).toContain("timeout: z.number().int().positive().optional()");
  });

  test("T45 -- Zod stopSchema with gracePeriodSeconds and reason", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/stopSchema\s*=\s*z\.object\s*\(/);
    expect(content).toContain("gracePeriodSeconds:");
    expect(content).toContain("reason:");
  });

  test("T46 -- Zod createProfileSchema with name, cpuMillicores, memoryMb, etc.", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/createProfileSchema\s*=\s*z\.object\s*\(/);
    const fields = ["name", "cpuMillicores", "memoryMb", "diskMb", "timeoutSeconds", "gpuEnabled", "networkPolicy", "isDefault"];
    for (const f of fields) {
      expect(content, `Profile schema should have field "${f}"`).toContain(`${f}:`);
    }
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Barrel exports and registry (T47-T49)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Barrel exports and registry", () => {
  test("T47 -- containerManagerService exported in services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toMatch(/export\s*\{?\s*containerManagerService\s*\}?\s*from\s*["'`]\.\/container-manager/);
  });

  test("T48 -- Container types re-exported in shared/types/index.ts", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("CONTAINER_STATUSES");
    expect(content).toContain("CONTAINER_PROFILE_PRESETS");
    expect(content).toContain("CONTAINER_EVENT_TYPES");
    expect(content).toContain("ContainerStatus");
    expect(content).toContain("ContainerLaunchOptions");
    expect(content).toContain("ContainerLaunchResult");
    expect(content).toContain("ContainerInfo");
    expect(content).toContain("ContainerStopOptions");
    expect(content).toContain("ContainerResourceUsage");
    expect(content).toContain("ContainerEventType");
    expect(content).toContain("ContainerProfilePreset");
  });

  test("T49 -- Docker adapter registered in adapter registry", async () => {
    const content = await readFile(REGISTRY_FILE, "utf-8");
    expect(content).toContain("dockerAdapter");
    expect(content).toMatch(/import\s*\{?\s*dockerAdapter\s*\}?\s*from\s*["'`]\.\/docker/);
    // Verify it's in the adaptersByType map
    expect(content).toContain("dockerAdapter,");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Profile cascade, cleanup, and route registration (T50-T53)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Profile cascade, cleanup, and route registration", () => {
  test("T50 -- resolveProfile cascade: override > agent > company default > auto-create", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+resolveProfile\s*\(/);
    // Check cascade: overrideProfileId ?? agentProfileId
    expect(content).toContain("overrideProfileId ?? agentProfileId");
    // Check company default lookup
    expect(content).toContain("isDefault");
    // Check auto-create standard profile
    expect(content).toContain("Default standard profile (auto-created)");
  });

  test("T51 -- cleanupStaleContainers marks orphaned containers as failed", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+cleanupStaleContainers\s*\(/);
    // Check that it handles 3 cases: not running, not found, no docker ID
    expect(content).toContain("Found not running during startup cleanup");
    expect(content).toContain("Container not found during startup cleanup");
    expect(content).toContain("Never started (stale pending)");
  });

  test("T52 -- Container routes registered in app.ts", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{?\s*containerRoutes\s*\}?\s*from\s*["'`]\.\/routes\/containers/);
    expect(content).toContain("containerRoutes(db)");
  });

  test("T53 -- Docker adapter module defines type=docker with execute and testEnvironment", async () => {
    const content = await readFile(DOCKER_ADAPTER_INDEX, "utf-8");
    expect(content).toContain('type: "docker"');
    expect(content).toContain("execute");
    expect(content).toContain("testEnvironment");
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: Docker adapter files (T54-T58)
// ---------------------------------------------------------------------------

test.describe("Groupe 13: Docker adapter files", () => {
  test("T54 -- Docker execute.ts calls containerManagerService.launchContainer", async () => {
    const content = await readFile(DOCKER_EXECUTE_FILE, "utf-8");
    expect(content).toContain("containerManagerService");
    expect(content).toContain("launchContainer");
  });

  test("T55 -- Docker execute.ts returns exitCode 0 with resultJson on success", async () => {
    const content = await readFile(DOCKER_EXECUTE_FILE, "utf-8");
    expect(content).toContain("exitCode: 0");
    expect(content).toContain("resultJson");
    expect(content).toContain("instanceId");
    expect(content).toContain("dockerContainerId");
  });

  test("T56 -- Docker execute.ts returns exitCode 1 on error", async () => {
    const content = await readFile(DOCKER_EXECUTE_FILE, "utf-8");
    expect(content).toContain("exitCode: 1");
    expect(content).toContain("errorMessage");
  });

  test("T57 -- Docker test.ts connects via /var/run/docker.sock", async () => {
    const content = await readFile(DOCKER_TEST_FILE, "utf-8");
    expect(content).toContain("/var/run/docker.sock");
    expect(content).toContain("docker.version()");
  });

  test("T58 -- Docker test.ts returns pass on success and fail on error", async () => {
    const content = await readFile(DOCKER_TEST_FILE, "utf-8");
    // Should handle both success and error cases
    expect(content).toContain("docker_connection");
    expect(content).toMatch(/level:\s*["'`]info["'`]/);
    expect(content).toMatch(/level:\s*["'`]error["'`]/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 14: ContainerManager service internals (T59-T64)
// ---------------------------------------------------------------------------

test.describe("Groupe 14: ContainerManager service internals", () => {
  test("T59 -- launchContainer checks company container limit (50)", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("MAX_CONTAINERS_PER_COMPANY");
    expect(content).toContain("Company has reached the maximum");
    // Checks pending, creating, running statuses
    expect(content).toMatch(/inArray\s*\(\s*containerInstances\.status\s*,\s*\[\s*["'`]pending["'`]/);
  });

  test("T60 -- launchContainer creates instance record then transitions through statuses", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Insert with status pending
    expect(content).toMatch(/status:\s*["'`]pending["'`]/);
    // Update to creating
    expect(content).toContain('"creating"');
    // Update to running
    expect(content).toContain('"running"');
  });

  test("T61 -- stopContainer validates status is running or creating", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain('Cannot stop container in status');
    expect(content).toMatch(/\["running"\s*,\s*"creating"\]\.includes\(instance\.status\)/);
  });

  test("T62 -- stopContainer sends SIGTERM via container.stop with grace period", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/container\.stop\s*\(\s*\{\s*t:\s*gracePeriod\s*\}\s*\)/);
  });

  test("T63 -- getContainerStatus joins containerInstances, containerProfiles, agents", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Verify JOINs
    expect(content).toContain("innerJoin(containerProfiles");
    expect(content).toContain("innerJoin(agents");
  });

  test("T64 -- listContainers orders by createdAt desc", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/orderBy\s*\(\s*desc\s*\(\s*containerInstances\.createdAt\s*\)\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 15: parseDockerStats correctness (T65-T68)
// ---------------------------------------------------------------------------

test.describe("Groupe 15: parseDockerStats correctness", () => {
  test("T65 -- parseDockerStats computes cpuPercent from CPU deltas", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("cpu_stats.cpu_usage.total_usage");
    expect(content).toContain("precpu_stats");
    expect(content).toContain("system_cpu_usage");
    expect(content).toContain("online_cpus");
  });

  test("T66 -- parseDockerStats computes memoryUsedMb subtracting cache", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("memory_stats.usage");
    expect(content).toContain("memory_stats.limit");
    // Subtracts cache from memory usage
    expect(content).toMatch(/cache\s*=.*stats.*cache/);
    expect(content).toContain("memoryUsed - cache");
  });

  test("T67 -- parseDockerStats sums network bytes across all interfaces", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("stats.networks");
    expect(content).toContain("rx_bytes");
    expect(content).toContain("tx_bytes");
  });

  test("T68 -- parseDockerStats reads pidsCount from pids_stats.current", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("pids_stats");
    expect(content).toMatch(/pids_stats\?\.current/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 16: Container types interfaces (T69-T74)
// ---------------------------------------------------------------------------

test.describe("Groupe 16: Container types interfaces", () => {
  test("T69 -- ContainerResourceUsage interface with 8 fields", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+ContainerResourceUsage/);
    const fields = ["cpuPercent", "memoryUsedMb", "memoryLimitMb", "memoryPercent", "networkRxBytes", "networkTxBytes", "pidsCount", "timestamp"];
    for (const f of fields) {
      expect(content, `ContainerResourceUsage should have field "${f}"`).toContain(`${f}:`);
    }
  });

  test("T70 -- ContainerLaunchOptions interface", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+ContainerLaunchOptions/);
    expect(content).toContain("profileId?:");
    expect(content).toContain("dockerImage?:");
    expect(content).toContain("environmentVars?:");
    expect(content).toContain("timeout?:");
    expect(content).toContain("labels?:");
  });

  test("T71 -- ContainerLaunchResult interface", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+ContainerLaunchResult/);
    expect(content).toContain("instanceId:");
    expect(content).toContain("dockerContainerId:");
    expect(content).toContain("status:");
    expect(content).toContain("profileName:");
  });

  test("T72 -- ContainerInfo interface with all required fields", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+ContainerInfo/);
    const fields = ["id:", "agentId:", "agentName:", "profileId:", "profileName:", "dockerContainerId:", "status:", "exitCode:", "error:", "resourceUsage:", "startedAt:", "stoppedAt:", "createdAt:"];
    for (const f of fields) {
      expect(content, `ContainerInfo should have field "${f}"`).toContain(f);
    }
  });

  test("T73 -- ContainerStopOptions interface", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+interface\s+ContainerStopOptions/);
    expect(content).toContain("gracePeriodSeconds?:");
    expect(content).toContain("reason?:");
  });

  test("T74 -- ContainerProfilePreset type derived from CONTAINER_PROFILE_PRESETS", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toMatch(/export\s+type\s+ContainerProfilePreset\s*=\s*keyof\s+typeof\s+CONTAINER_PROFILE_PRESETS/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 17: Route DELETE and audit (T75-T77)
// ---------------------------------------------------------------------------

test.describe("Groupe 17: Route DELETE and additional routes", () => {
  test("T75 -- DELETE route for destroying containers", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/router\.delete\s*\(/);
    expect(content).toContain("container.destroyed");
  });

  test("T76 -- Routes emit audit events (container.profile_created, container.destroyed)", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("emitAudit");
    expect(content).toContain("container.profile_created");
    expect(content).toContain("container.destroyed");
  });

  test("T77 -- Routes use assertCompanyAccess and getActorInfo", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("assertCompanyAccess");
    expect(content).toContain("getActorInfo");
  });
});

// ---------------------------------------------------------------------------
// Groupe 18: createProfile and monitoring cleanup (T78-T80)
// ---------------------------------------------------------------------------

test.describe("Groupe 18: createProfile and monitoring", () => {
  test("T78 -- createProfile unsets previous default when setting new default", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // When isDefault is true, unset other defaults
    expect(content).toContain("data.isDefault");
    expect(content).toMatch(/isDefault:\s*false/);
  });

  test("T79 -- stopMonitoring clears interval and removes from activeMonitors", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/function\s+stopMonitoring\s*\(/);
    expect(content).toContain("clearInterval(interval)");
    expect(content).toContain("activeMonitors.delete");
  });

  test("T80 -- activeMonitors is a Map tracking monitoring intervals", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/const\s+activeMonitors\s*=\s*new\s+Map/);
    expect(content).toContain("activeMonitors.set");
    expect(content).toContain("activeMonitors.get");
    expect(content).toContain("activeMonitors.delete");
  });
});

// ---------------------------------------------------------------------------
// Groupe 19: formatContainerInfo helper (T81-T82)
// ---------------------------------------------------------------------------

test.describe("Groupe 19: formatContainerInfo helper", () => {
  test("T81 -- formatContainerInfo maps DB row to ContainerInfo", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toMatch(/function\s+formatContainerInfo\s*\(/);
    expect(content).toContain("row.instance.id");
    expect(content).toContain("row.agent.name");
    expect(content).toContain("row.profile.name");
  });

  test("T82 -- formatContainerInfo handles null dates with toISOString", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    expect(content).toContain("startedAt?.toISOString() ?? null");
    expect(content).toContain("stoppedAt?.toISOString() ?? null");
    expect(content).toContain("createdAt.toISOString()");
  });
});

// ---------------------------------------------------------------------------
// Groupe 20: Docker adapter execute integration (T83-T85)
// ---------------------------------------------------------------------------

test.describe("Groupe 20: Docker adapter execute integration", () => {
  test("T83 -- Docker execute.ts has setDbRef function for lazy DB injection", async () => {
    const content = await readFile(DOCKER_EXECUTE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+setDbRef\s*\(/);
    expect(content).toContain("_dbRef");
  });

  test("T84 -- Docker execute.ts checks _dbRef before launching container", async () => {
    const content = await readFile(DOCKER_EXECUTE_FILE, "utf-8");
    expect(content).toContain("!_dbRef");
    expect(content).toContain("database reference not initialized");
  });

  test("T85 -- Docker execute.ts reports adapter metadata via onMeta", async () => {
    const content = await readFile(DOCKER_EXECUTE_FILE, "utf-8");
    expect(content).toContain("onMeta");
    expect(content).toContain('adapterType: "docker"');
  });
});
