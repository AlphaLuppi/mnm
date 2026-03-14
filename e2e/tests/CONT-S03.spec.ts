/**
 * CONT-S03: Mount Allowlist Tamper-proof -- Validation chemins montes containers -- E2E Tests
 *
 * These tests verify the deliverables of CONT-S03:
 *   - Groupe 1: File existence (T01-T03)
 *   - Groupe 2: MountAllowlistService core functions (T04-T14)
 *   - Groupe 3: Validation logic (T15-T22)
 *   - Groupe 4: ContainerManager integration (T23-T28)
 *   - Groupe 5: Routes (T29-T34)
 *   - Groupe 6: Types and validators (T35-T40)
 *   - Groupe 7: Barrel exports (T41-T43)
 *   - Groupe 8: Audit emission (T44-T46)
 *   - Groupe 9: Launch options integration (T47-T50)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const MOUNT_ALLOWLIST_FILE = resolve(ROOT, "server/src/services/mount-allowlist.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/mount-allowlist.ts");
const VALIDATORS_FILE = resolve(ROOT, "packages/shared/src/validators/mount-allowlist.ts");
const CONTAINER_MANAGER_FILE = resolve(ROOT, "server/src/services/container-manager.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/containers.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VALIDATORS_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const CONTAINER_TYPES_FILE = resolve(ROOT, "packages/shared/src/types/container.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01-T03)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 -- mount-allowlist.ts exists and exports mountAllowlistService", async () => {
    await expect(fsAccess(MOUNT_ALLOWLIST_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+mountAllowlistService/);
  });

  test("T02 -- types/mount-allowlist.ts exists with MountValidationResult and MountViolation", async () => {
    await expect(fsAccess(TYPES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s03-type-result
    expect(content).toContain("cont-s03-type-result");
    expect(content).toMatch(/interface\s+MountValidationResult/);
    // cont-s03-type-violation
    expect(content).toContain("cont-s03-type-violation");
    expect(content).toMatch(/interface\s+MountViolation/);
  });

  test("T03 -- validators/mount-allowlist.ts exists with Zod schemas", async () => {
    await expect(fsAccess(VALIDATORS_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    // cont-s03-validator-paths
    expect(content).toContain("cont-s03-validator-paths");
    expect(content).toMatch(/export\s+const\s+mountPathsSchema/);
    // cont-s03-validator-validate
    expect(content).toContain("cont-s03-validator-validate");
    expect(content).toMatch(/export\s+const\s+mountValidateSchema/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: MountAllowlistService core functions (T04-T14)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: MountAllowlistService core functions", () => {
  test("T04 -- validateMountPath function exists with cont-s03-svc-validate-mount marker", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-validate-mount");
    expect(content).toMatch(/(?:async\s+)?function\s+validateMountPath\s*\(/);
  });

  test("T05 -- validateAllMounts function exists with cont-s03-svc-validate-all marker", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-validate-all");
    expect(content).toMatch(/(?:async\s+)?function\s+validateAllMounts\s*\(/);
  });

  test("T06 -- normalizePath function exists with cont-s03-svc-normalize marker", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-normalize");
    expect(content).toMatch(/function\s+normalizePath\s*\(/);
  });

  test("T07 -- detectPathTraversal detects .. patterns", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-detect-traversal");
    expect(content).toMatch(/function\s+detectPathTraversal\s*\(/);
    // Must check for '..' in the path
    expect(content).toMatch(/includes\s*\(\s*["']\.\.["']\s*\)/);
  });

  test("T08 -- detectPathTraversal detects encoded %2e%2e patterns", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    // Must check URL-encoded traversal
    expect(content).toMatch(/%2e%2e/i);
    expect(content).toMatch(/%2E%2E/);
  });

  test("T09 -- detectNullBytes detects \\0 and %00", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-detect-null");
    expect(content).toMatch(/function\s+detectNullBytes\s*\(/);
    // Must check for raw null byte
    expect(content).toMatch(/includes\s*\(\s*["']\\0["']\s*\)/);
    // Must check for URL-encoded null byte
    expect(content).toMatch(/includes\s*\(\s*["']%00["']\s*\)/);
  });

  test("T10 -- detectSymlinkEscape uses realpath or similar resolution", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-detect-symlink");
    expect(content).toMatch(/(?:async\s+)?function\s+detectSymlinkEscape\s*\(/);
    // Must use fs.realpath or similar
    expect(content).toMatch(/realpath/);
  });

  test("T11 -- isSensitivePath checks against SENSITIVE_PATHS list", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toMatch(/function\s+isSensitivePath\s*\(/);
    expect(content).toMatch(/SENSITIVE_PATHS/);
  });

  test("T12 -- SENSITIVE_PATHS includes critical system paths", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    // cont-s03-svc-sensitive-paths
    expect(content).toContain("cont-s03-svc-sensitive-paths");
    const criticalPaths = [
      "/etc/passwd",
      "/etc/shadow",
      "/var/run/docker.sock",
      "/proc",
      "/sys",
      "/root",
      "/.ssh",
      "/.gnupg",
    ];
    for (const p of criticalPaths) {
      expect(content, `SENSITIVE_PATHS should include ${p}`).toContain(`"${p}"`);
    }
  });

  test("T13 -- addToAllowlist updates profile allowedMountPaths in DB", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-add-allowlist");
    expect(content).toMatch(/(?:async\s+)?function\s+addToAllowlist\s*\(/);
    // Must update containerProfiles
    expect(content).toMatch(/db\.update\s*\(\s*containerProfiles\s*\)/);
    expect(content).toMatch(/allowedMountPaths/);
  });

  test("T14 -- removeFromAllowlist updates profile allowedMountPaths in DB", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("cont-s03-svc-remove-allowlist");
    expect(content).toMatch(/(?:async\s+)?function\s+removeFromAllowlist\s*\(/);
    expect(content).toMatch(/db\.update\s*\(\s*containerProfiles\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Validation logic (T15-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Validation logic", () => {
  test("T15 -- Path within allowlist is accepted (uses startsWith or equivalent)", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    // The validation logic must check if normalized path starts with allowed path
    expect(content).toMatch(/startsWith/);
  });

  test("T16 -- Subpath of allowed path is accepted (child directory check)", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    // Must append separator for exact prefix matching to avoid /workspace/project-a matching /workspace/project-ab
    expect(content).toMatch(/normalizedAllowed\s*\+\s*(?:path\.sep|["']\/["'])/);
  });

  test("T17 -- Path outside allowlist is rejected with MOUNT_PATH_NOT_ALLOWED", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("MOUNT_PATH_NOT_ALLOWED");
  });

  test("T18 -- Empty allowlist rejects all mounts with MOUNT_ALLOWLIST_EMPTY", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("MOUNT_ALLOWLIST_EMPTY");
    // Must check if allowedPaths.length === 0
    expect(content).toMatch(/allowedPaths\.length\s*===?\s*0/);
  });

  test("T19 -- Path traversal ../ is detected and rejected with MOUNT_PATH_TRAVERSAL", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("MOUNT_PATH_TRAVERSAL");
    expect(content).toContain("Path traversal detected");
  });

  test("T20 -- Null byte in path is detected and rejected with MOUNT_NULL_BYTES", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("MOUNT_NULL_BYTES");
    expect(content).toContain("Null bytes detected");
  });

  test("T21 -- URL-encoded traversal %2e%2e%2f is detected", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    // Must decode URL-encoded characters
    expect(content).toMatch(/decodeURIComponent/);
    // Must check for encoded traversal patterns
    expect(content).toMatch(/%2e%2e/i);
  });

  test("T22 -- Sensitive paths are always rejected with MOUNT_SENSITIVE_PATH", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    expect(content).toContain("MOUNT_SENSITIVE_PATH");
    // isSensitivePath check must happen before allowlist membership check
    // Verify the order: null bytes first, then traversal, then sensitive, then allowlist
    const sensitiveIdx = content.indexOf("isSensitivePath");
    const allowlistCheckIdx = content.indexOf("MOUNT_PATH_NOT_ALLOWED");
    expect(sensitiveIdx).toBeLessThan(allowlistCheckIdx);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: ContainerManager integration (T23-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: ContainerManager integration", () => {
  test("T23 -- launchContainer calls mount validation before docker.createContainer", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s03-cm-validate marker
    expect(content).toContain("cont-s03-cm-validate");
    // Must import mountAllowlistService
    expect(content).toMatch(/import.*mountAllowlistService.*from/);
    // Must call validateAllMounts
    expect(content).toMatch(/validateAllMounts/);
    // Validation must happen before docker.createContainer
    const validateIdx = content.indexOf("validateAllMounts");
    const createContainerIdx = content.indexOf("docker.createContainer");
    expect(validateIdx).toBeGreaterThan(0);
    expect(createContainerIdx).toBeGreaterThan(0);
    expect(validateIdx).toBeLessThan(createContainerIdx);
  });

  test("T24 -- buildDockerCreateOptions includes validated paths in Binds", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s03-cm-binds marker
    expect(content).toContain("cont-s03-cm-binds");
    // Must include mountPaths parameter
    expect(content).toMatch(/mountPaths\??\s*:\s*string\[\]/);
    // Must map mount paths to binds with :ro
    expect(content).toMatch(/:ro/);
    expect(content).toMatch(/mountPaths/);
  });

  test("T25 -- mountedPaths is saved to container_instances after launch", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s03-cm-mounted-paths
    expect(content).toContain("cont-s03-cm-mounted-paths");
    // Must set mountedPaths in DB update
    expect(content).toMatch(/mountedPaths\s*:/);
    expect(content).toMatch(/validatedMountPaths/);
  });

  test("T26 -- launchContainer with invalid mount emits audit severity=critical", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s03-audit-violation
    expect(content).toContain("cont-s03-audit-violation");
    // Must emit audit with severity critical on mount violation
    expect(content).toMatch(/severity\s*:\s*["']critical["']/);
    expect(content).toMatch(/container\.mount_violation/);
  });

  test("T27 -- launchContainer accepts mountPaths option", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Must extract mountPaths from options
    expect(content).toMatch(/options\?\.\s*mountPaths/);
  });

  test("T28 -- Shadow .env bind is always included regardless of allowlist", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Shadow .env bind must always be present
    expect(content).toMatch(/\/dev\/null:\/workspace\/\.env:ro/);
    // The mount paths are spread AFTER the shadow .env
    const shadowIdx = content.indexOf("/dev/null:/workspace/.env:ro");
    const mountSpreadIdx = content.indexOf("cont-s03-cm-binds", shadowIdx);
    expect(shadowIdx).toBeGreaterThan(0);
    // The shadow .env must be before any mount path additions in the Binds array
    expect(mountSpreadIdx).toBeGreaterThan(shadowIdx);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Routes (T29-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Routes", () => {
  test("T29 -- GET mount-allowlist route exists with requirePermission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s03-route-get-allowlist
    expect(content).toContain("cont-s03-route-get-allowlist");
    expect(content).toMatch(/router\.get\s*\(\s*\n?\s*["']\/companies\/:companyId\/containers\/profiles\/:profileId\/mount-allowlist["']/);
    // Must use requirePermission
    expect(content).toMatch(/requirePermission\s*\(\s*db\s*,\s*["']agents:manage_containers["']\s*\)/);
  });

  test("T30 -- PUT mount-allowlist route exists with requirePermission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s03-route-put-allowlist
    expect(content).toContain("cont-s03-route-put-allowlist");
    expect(content).toMatch(/router\.put\s*\(\s*\n?\s*["']\/companies\/:companyId\/containers\/profiles\/:profileId\/mount-allowlist["']/);
  });

  test("T31 -- POST mount-validate route exists with requirePermission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s03-route-validate
    expect(content).toContain("cont-s03-route-validate");
    expect(content).toMatch(/router\.post\s*\(\s*\n?\s*["']\/companies\/:companyId\/containers\/mount-validate["']/);
  });

  test("T32 -- PUT mount-allowlist emits audit event", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Find the PUT mount-allowlist route section and verify it calls emitAudit
    const putIdx = content.indexOf("cont-s03-route-put-allowlist");
    const nextRouteIdx = content.indexOf("cont-s03-route-validate");
    expect(putIdx).toBeGreaterThan(0);
    expect(nextRouteIdx).toBeGreaterThan(putIdx);
    const putSection = content.slice(putIdx, nextRouteIdx);
    expect(putSection).toMatch(/emitAudit/);
    expect(putSection).toContain("container.mount_allowlist_updated");
  });

  test("T33 -- POST mount-validate uses Zod validation", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Must use mountValidateSchema for validation
    expect(content).toMatch(/mountValidateSchema\.safeParse/);
  });

  test("T34 -- Routes use assertCompanyAccess", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Find the mount-allowlist routes section
    const getIdx = content.indexOf("cont-s03-route-get-allowlist");
    const healthIdx = content.indexOf("containers/health");
    expect(getIdx).toBeGreaterThan(0);
    expect(healthIdx).toBeGreaterThan(getIdx);
    const routesSection = content.slice(getIdx, healthIdx);
    // Count assertCompanyAccess calls in our 3 routes
    const assertCalls = (routesSection.match(/assertCompanyAccess/g) || []).length;
    expect(assertCalls).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Types and validators (T35-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Types and validators", () => {
  test("T35 -- MountValidationResult type has path, allowed, violation fields", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toContain("cont-s03-type-result");
    expect(content).toMatch(/path\s*:\s*string/);
    expect(content).toMatch(/allowed\s*:\s*boolean/);
    expect(content).toMatch(/violation\s*:\s*MountViolation\s*\|\s*null/);
  });

  test("T36 -- MountViolation type has code, message, severity fields", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toContain("cont-s03-type-violation");
    expect(content).toMatch(/code\s*:\s*MountViolationCode/);
    expect(content).toMatch(/message\s*:\s*string/);
    expect(content).toMatch(/severity\s*:\s*["']critical["']\s*\|\s*["']error["']/);
  });

  test("T37 -- MOUNT_VIOLATION_CODES constant lists all violation codes", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    const expectedCodes = [
      "MOUNT_PATH_NOT_ALLOWED",
      "MOUNT_PATH_TRAVERSAL",
      "MOUNT_NULL_BYTES",
      "MOUNT_SYMLINK_ESCAPE",
      "MOUNT_SENSITIVE_PATH",
      "MOUNT_EMPTY_PATH",
      "MOUNT_ALLOWLIST_EMPTY",
    ];
    for (const code of expectedCodes) {
      expect(content, `MOUNT_VIOLATION_CODES should include ${code}`).toContain(`"${code}"`);
    }
  });

  test("T38 -- Zod mountPathsSchema validates array of paths", async () => {
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    expect(content).toContain("cont-s03-validator-paths");
    // Must validate paths is an array
    expect(content).toMatch(/z\.array\s*\(/);
    // Must require absolute paths (start with /)
    expect(content).toMatch(/startsWith\s*\(\s*["']\/["']\s*\)/);
  });

  test("T39 -- Zod mountValidateSchema validates profileId + paths", async () => {
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    expect(content).toContain("cont-s03-validator-validate");
    expect(content).toMatch(/profileId\s*:\s*z\.string\(\)\.uuid/);
    expect(content).toMatch(/paths\s*:\s*z\.array/);
  });

  test("T40 -- Types are exported from types/index.ts barrel", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    // cont-s03-barrel-types
    expect(content).toContain("cont-s03-barrel-types");
    expect(content).toContain("MountValidationResult");
    expect(content).toContain("MountViolation");
    expect(content).toContain("MOUNT_VIOLATION_CODES");
    expect(content).toContain("MountViolationCode");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Barrel exports (T41-T43)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Barrel exports", () => {
  test("T41 -- mount-allowlist exported from services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    // cont-s03-barrel-svc
    expect(content).toContain("cont-s03-barrel-svc");
    expect(content).toMatch(/export\s*\{.*mountAllowlistService.*\}\s*from\s*["']\.\/mount-allowlist/);
  });

  test("T42 -- mount-allowlist types exported from shared/src/index.ts", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    expect(content).toContain("MountValidationResult");
    expect(content).toContain("MountViolation");
    expect(content).toContain("MountViolationCode");
    expect(content).toContain("MOUNT_VIOLATION_CODES");
  });

  test("T43 -- mount-allowlist validators exported from validators/index.ts", async () => {
    const content = await readFile(VALIDATORS_INDEX, "utf-8");
    // cont-s03-barrel-validators
    expect(content).toContain("cont-s03-barrel-validators");
    expect(content).toContain("mountPathsSchema");
    expect(content).toContain("mountValidateSchema");
    expect(content).toContain("MountPathsInput");
    expect(content).toContain("MountValidateInput");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Audit emission (T44-T46)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Audit emission", () => {
  test("T44 -- Audit event emitted on mount violation with action container.mount_violation", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s03-audit-violation
    expect(content).toContain("cont-s03-audit-violation");
    expect(content).toContain("container.mount_violation");
  });

  test("T45 -- Audit metadata includes violation code and path", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Find the audit emission section for mount violations
    const auditIdx = content.indexOf("container.mount_violation");
    expect(auditIdx).toBeGreaterThan(0);
    // Look at the metadata around the audit call
    const surroundingCode = content.slice(Math.max(0, auditIdx - 500), auditIdx + 500);
    expect(surroundingCode).toContain("violation.code");
    expect(surroundingCode).toContain("violation.originalPath");
  });

  test("T46 -- Audit event emitted on allowlist update with action container.mount_allowlist_updated", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("container.mount_allowlist_updated");
    // Must pass metadata with paths and count
    const updateIdx = content.indexOf("container.mount_allowlist_updated");
    const surroundingCode = content.slice(updateIdx, updateIdx + 300);
    expect(surroundingCode).toMatch(/paths/);
    expect(surroundingCode).toMatch(/count/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Launch options integration (T47-T50)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Launch options integration", () => {
  test("T47 -- ContainerLaunchOptions includes mountPaths parameter", async () => {
    const content = await readFile(CONTAINER_TYPES_FILE, "utf-8");
    expect(content).toMatch(/mountPaths\??\s*:\s*string\[\]/);
  });

  test("T48 -- launchSchema in containers.ts includes mountPaths", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The launch schema must include mountPaths
    const launchSchemaIdx = content.indexOf("const launchSchema");
    expect(launchSchemaIdx).toBeGreaterThan(-1);
    const schemaEnd = content.indexOf("});", launchSchemaIdx);
    const schemaSection = content.slice(launchSchemaIdx, schemaEnd + 3);
    expect(schemaSection).toContain("mountPaths");
  });

  test("T49 -- getEffectiveAllowlist reads from profile allowedMountPaths", async () => {
    const content = await readFile(MOUNT_ALLOWLIST_FILE, "utf-8");
    // cont-s03-svc-get-allowlist
    expect(content).toContain("cont-s03-svc-get-allowlist");
    expect(content).toMatch(/(?:async\s+)?function\s+getEffectiveAllowlist\s*\(/);
    expect(content).toMatch(/allowedMountPaths/);
    expect(content).toMatch(/containerProfiles/);
  });

  test("T50 -- Validated mounts are added as read-only Binds", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // Must map paths to :ro binds
    expect(content).toMatch(/mountPaths.*map.*:ro/s);
  });
});
