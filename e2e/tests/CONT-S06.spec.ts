/**
 * CONT-S06: UI Container Status -- E2E Tests
 *
 * These tests verify the deliverables of CONT-S06:
 *   - Groupe 1: File existence (T01-T06)
 *   - Groupe 2: API client functions (T07-T13)
 *   - Groupe 3: Query keys (T14-T16)
 *   - Groupe 4: ContainerStatusBadge component (T17-T24)
 *   - Groupe 5: StopContainerDialog component (T25-T30)
 *   - Groupe 6: DestroyContainerDialog component (T31-T36)
 *   - Groupe 7: Containers page structure (T37-T48)
 *   - Groupe 8: Route + Sidebar + Permission (T49-T55)
 *   - Groupe 9: Auto-refresh and Docker health (T56-T62)
 *   - Groupe 10: Barrel exports (T63-T65)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_CONTAINERS_FILE = resolve(ROOT, "ui/src/api/containers.ts");
const API_INDEX_FILE = resolve(ROOT, "ui/src/api/index.ts");
const QUERY_KEYS_FILE = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const STATUS_BADGE_FILE = resolve(ROOT, "ui/src/components/ContainerStatusBadge.tsx");
const STOP_DIALOG_FILE = resolve(ROOT, "ui/src/components/StopContainerDialog.tsx");
const DESTROY_DIALOG_FILE = resolve(ROOT, "ui/src/components/DestroyContainerDialog.tsx");
const CONTAINERS_PAGE_FILE = resolve(ROOT, "ui/src/pages/Containers.tsx");
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const SHARED_TYPES_FILE = resolve(ROOT, "packages/shared/src/types/container.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01-T06)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 -- api/containers.ts exists", async () => {
    await expect(fsAccess(API_CONTAINERS_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 -- ContainerStatusBadge.tsx exists", async () => {
    await expect(fsAccess(STATUS_BADGE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T03 -- StopContainerDialog.tsx exists", async () => {
    await expect(fsAccess(STOP_DIALOG_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T04 -- DestroyContainerDialog.tsx exists", async () => {
    await expect(fsAccess(DESTROY_DIALOG_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T05 -- Containers.tsx page exists", async () => {
    await expect(fsAccess(CONTAINERS_PAGE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T06 -- shared types container.ts exists", async () => {
    await expect(fsAccess(SHARED_TYPES_FILE).then(() => true)).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: API client functions (T07-T13)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: API client containers.ts", () => {
  test("T07 -- exports containersApi object", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toMatch(/export\s+(const|function)\s+containersApi/);
  });

  test("T08 -- containersApi.list calls GET /companies/:companyId/containers", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toContain("list:");
    expect(content).toMatch(/\/companies\/.*\/containers/);
    expect(content).toContain("api.get");
  });

  test("T09 -- containersApi.getById calls GET with containerId", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toContain("getById:");
    expect(content).toMatch(/\/containers\/.*containerId/);
  });

  test("T10 -- containersApi.stop calls POST with stop endpoint", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toContain("stop:");
    expect(content).toContain("/stop");
    expect(content).toContain("api.post");
  });

  test("T11 -- containersApi.destroy calls DELETE", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toContain("destroy:");
    expect(content).toContain("api.delete");
  });

  test("T12 -- containersApi.dockerHealth calls GET /health", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toContain("dockerHealth:");
    expect(content).toContain("/health");
  });

  test("T13 -- imports ContainerInfoFull and ContainerStatus from @mnm/shared", async () => {
    const content = await readFile(API_CONTAINERS_FILE, "utf-8");
    expect(content).toContain("ContainerInfoFull");
    expect(content).toContain("ContainerStatus");
    expect(content).toContain("@mnm/shared");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Query keys (T14-T16)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Query keys", () => {
  test("T14 -- queryKeys has containers.list", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toMatch(/containers\s*:\s*\{/);
    expect(content).toMatch(/list\s*:/);
  });

  test("T15 -- queryKeys has containers.detail", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    // Check within the containers block
    const containersBlock = content.substring(content.indexOf("containers:"));
    expect(containersBlock).toMatch(/detail\s*:/);
  });

  test("T16 -- queryKeys has containers.health", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const containersBlock = content.substring(content.indexOf("containers:"));
    expect(containersBlock).toMatch(/health\s*:/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: ContainerStatusBadge component (T17-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: ContainerStatusBadge component", () => {
  test("T17 -- exports ContainerStatusBadge function", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+ContainerStatusBadge/);
  });

  test("T18 -- has data-testid cont-s06-status-badge", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-status-badge"');
  });

  test("T19 -- defines running status with green colors", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain("running");
    expect(content).toMatch(/bg-green-\d+/);
    expect(content).toMatch(/text-green-\d+/);
  });

  test("T20 -- defines failed status with red colors", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain("failed");
    expect(content).toMatch(/bg-red-\d+/);
    expect(content).toMatch(/text-red-\d+/);
  });

  test("T21 -- defines stopped status with gray colors", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain("stopped");
    expect(content).toMatch(/bg-gray-\d+/);
    expect(content).toMatch(/text-gray-\d+/);
  });

  test("T22 -- defines creating status with amber colors", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain("creating");
    expect(content).toMatch(/bg-amber-\d+/);
    expect(content).toMatch(/text-amber-\d+/);
  });

  test("T23 -- defines pending status with amber colors", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain("pending");
    // pending and creating share amber
    expect(content).toMatch(/bg-amber-\d+/);
  });

  test("T24 -- defines stopping status with orange colors", async () => {
    const content = await readFile(STATUS_BADGE_FILE, "utf-8");
    expect(content).toContain("stopping");
    expect(content).toMatch(/bg-orange-\d+/);
    expect(content).toMatch(/text-orange-\d+/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: StopContainerDialog component (T25-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: StopContainerDialog component", () => {
  test("T25 -- exports StopContainerDialog function", async () => {
    const content = await readFile(STOP_DIALOG_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+StopContainerDialog/);
  });

  test("T26 -- has data-testid cont-s06-stop-dialog", async () => {
    const content = await readFile(STOP_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-stop-dialog"');
  });

  test("T27 -- has data-testid cont-s06-stop-reason for reason textarea", async () => {
    const content = await readFile(STOP_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-stop-reason"');
    expect(content).toContain("textarea");
  });

  test("T28 -- has data-testid cont-s06-stop-confirm button", async () => {
    const content = await readFile(STOP_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-stop-confirm"');
  });

  test("T29 -- has data-testid cont-s06-stop-cancel button", async () => {
    const content = await readFile(STOP_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-stop-cancel"');
  });

  test("T30 -- calls containersApi.stop with reason", async () => {
    const content = await readFile(STOP_DIALOG_FILE, "utf-8");
    expect(content).toContain("containersApi.stop");
    expect(content).toContain("reason");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: DestroyContainerDialog component (T31-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: DestroyContainerDialog component", () => {
  test("T31 -- exports DestroyContainerDialog function", async () => {
    const content = await readFile(DESTROY_DIALOG_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+DestroyContainerDialog/);
  });

  test("T32 -- has data-testid cont-s06-destroy-dialog", async () => {
    const content = await readFile(DESTROY_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-destroy-dialog"');
  });

  test("T33 -- has data-testid cont-s06-destroy-confirm button", async () => {
    const content = await readFile(DESTROY_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-destroy-confirm"');
  });

  test("T34 -- has data-testid cont-s06-destroy-cancel button", async () => {
    const content = await readFile(DESTROY_DIALOG_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-destroy-cancel"');
  });

  test("T35 -- calls containersApi.destroy", async () => {
    const content = await readFile(DESTROY_DIALOG_FILE, "utf-8");
    expect(content).toContain("containersApi.destroy");
  });

  test("T36 -- uses destructive variant for confirm button", async () => {
    const content = await readFile(DESTROY_DIALOG_FILE, "utf-8");
    expect(content).toContain('variant="destructive"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Containers page structure (T37-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Containers page structure", () => {
  test("T37 -- exports Containers function", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+Containers/);
  });

  test("T38 -- has data-testid cont-s06-page", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-page"');
  });

  test("T39 -- has data-testid cont-s06-title", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-title"');
  });

  test("T40 -- has data-testid cont-s06-table", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-table"');
  });

  test("T41 -- has data-testid cont-s06-table-header", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-table-header"');
  });

  test("T42 -- has data-testid cont-s06-table-row", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-table-row"');
  });

  test("T43 -- has data-testid cont-s06-agent-name", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-agent-name"');
  });

  test("T44 -- has data-testid cont-s06-profile-name", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-profile-name"');
  });

  test("T45 -- has data-testid cont-s06-btn-stop", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-btn-stop"');
  });

  test("T46 -- has data-testid cont-s06-btn-destroy", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-btn-destroy"');
  });

  test("T47 -- has data-testid cont-s06-empty-state", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-empty-state"');
  });

  test("T48 -- has data-testid cont-s06-filter-status", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-filter-status"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Route + Sidebar + Permission (T49-T55)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Route + Sidebar + Permission", () => {
  test("T49 -- App.tsx imports Containers page", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/import\s+\{?\s*Containers\s*\}?\s+from/);
  });

  test("T50 -- App.tsx has /containers route", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toContain('"containers"');
  });

  test("T51 -- App.tsx /containers route is protected by agents:manage_containers", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    // Find the line containing "containers" route and verify permission
    const containerRouteIndex = content.indexOf('"containers"');
    expect(containerRouteIndex).toBeGreaterThan(-1);
    // Look for the permission in nearby context (within 200 chars before)
    const context = content.substring(Math.max(0, containerRouteIndex - 200), containerRouteIndex + 100);
    expect(context).toContain("agents:manage_containers");
  });

  test("T52 -- Sidebar.tsx imports Box icon", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain("Box");
  });

  test("T53 -- Sidebar.tsx has cont-s06-nav-containers data-testid", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-nav-containers"');
  });

  test("T54 -- Sidebar.tsx nav item links to /containers", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('to="/containers"');
  });

  test("T55 -- Sidebar.tsx checks agents:manage_containers permission", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain("agents:manage_containers");
    expect(content).toContain("canViewContainers");
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Auto-refresh and Docker health (T56-T62)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Auto-refresh and Docker health", () => {
  test("T56 -- Containers page relies on WebSocket for live updates (no polling)", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    // RT-S01: polling removed, container.* WS events trigger invalidation via LiveUpdatesProvider
    expect(content).not.toContain("refetchInterval");
  });

  test("T57 -- No AUTO_REFRESH_INTERVAL constant (polling removed)", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).not.toContain("AUTO_REFRESH_INTERVAL");
  });

  test("T58 -- has data-testid cont-s06-health-indicator", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-health-indicator"');
  });

  test("T59 -- has data-testid cont-s06-health-available", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-health-available"');
  });

  test("T60 -- has data-testid cont-s06-health-unavailable", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-health-unavailable"');
  });

  test("T61 -- has data-testid cont-s06-refresh-indicator", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-refresh-indicator"');
  });

  test("T62 -- has data-testid cont-s06-container-count", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-container-count"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Barrel exports and cross-references (T63-T65)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Barrel exports and cross-references", () => {
  test("T63 -- api/index.ts exports containersApi", async () => {
    const content = await readFile(API_INDEX_FILE, "utf-8");
    expect(content).toContain("containersApi");
    expect(content).toContain("./containers");
  });

  test("T64 -- Containers page imports containersApi from api/containers", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain("containersApi");
    expect(content).toMatch(/from\s+["']\.\.\/api\/containers/);
  });

  test("T65 -- Containers page imports ContainerStatusBadge", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain("ContainerStatusBadge");
    expect(content).toMatch(/from\s+["']\.\.\/components\/ContainerStatusBadge/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Resource usage display (T66-T70)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Resource usage display", () => {
  test("T66 -- has data-testid cont-s06-cpu-bar", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('cont-s06-cpu-bar');
  });

  test("T67 -- has data-testid cont-s06-cpu-value", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-cpu-value"');
  });

  test("T68 -- has data-testid cont-s06-memory-bar", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('cont-s06-memory-bar');
  });

  test("T69 -- has data-testid cont-s06-memory-value", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-memory-value"');
  });

  test("T70 -- ResourceBar uses cpuPercent from resourceUsage", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain("cpuPercent");
    expect(content).toContain("memoryPercent");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Loading and error states (T71-T75)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Loading and error states", () => {
  test("T71 -- has data-testid cont-s06-loading", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-loading"');
  });

  test("T72 -- has data-testid cont-s06-error", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-error"');
  });

  test("T73 -- has data-testid cont-s06-empty-title", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-empty-title"');
  });

  test("T74 -- has data-testid cont-s06-empty-description", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-empty-description"');
  });

  test("T75 -- has data-testid cont-s06-created-at", async () => {
    const content = await readFile(CONTAINERS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="cont-s06-created-at"');
  });
});
