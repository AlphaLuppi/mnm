/**
 * CONT-S05: Tables Container -- Enrichissement Schema et Service -- E2E Tests
 *
 * These tests verify the deliverables of CONT-S05:
 *   - Groupe 1: Schema container_profiles -- 7 nouvelles colonnes (T01-T07)
 *   - Groupe 2: Schema container_instances -- 8 nouvelles colonnes (T08-T15)
 *   - Groupe 3: Indexes (T16-T18)
 *   - Groupe 4: Relations Drizzle (T19-T20)
 *   - Groupe 5: Migration SQL (T21-T24)
 *   - Groupe 6: Service -- nouvelles fonctions (T25-T32)
 *   - Groupe 7: Routes REST (T33-T38)
 *   - Groupe 8: Validators (T39-T42)
 *   - Groupe 9: Types partages (T43-T48)
 *   - Groupe 10: Barrel exports (T49-T51)
 *   - Groupe 11: Backward compatibility (T52-T54)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCHEMA_PROFILES_FILE = resolve(
  ROOT,
  "packages/db/src/schema/container_profiles.ts",
);
const SCHEMA_INSTANCES_FILE = resolve(
  ROOT,
  "packages/db/src/schema/container_instances.ts",
);
const SCHEMA_RELATIONS_FILE = resolve(
  ROOT,
  "packages/db/src/schema/container_relations.ts",
);
const SCHEMA_INDEX_FILE = resolve(ROOT, "packages/db/src/schema/index.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const SERVICE_FILE = resolve(
  ROOT,
  "server/src/services/container-manager.ts",
);
const ROUTES_FILE = resolve(ROOT, "server/src/routes/containers.ts");
const TYPES_FILE = resolve(
  ROOT,
  "packages/shared/src/types/container.ts",
);
const TYPES_INDEX_FILE = resolve(
  ROOT,
  "packages/shared/src/types/index.ts",
);

// ---------------------------------------------------------------------------
// Groupe 1: Schema container_profiles -- 7 nouvelles colonnes (T01-T07)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Schema container_profiles -- nouvelles colonnes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_PROFILES_FILE, "utf-8");
  });

  test("T01 -- colonne dockerImage text @cont-s05-profile-docker-image-col", () => {
    expect(content).toMatch(/dockerImage\s*:\s*text\(\s*["']docker_image["']\s*\)/);
  });

  test("T02 -- colonne maxContainers integer notNull default(10) @cont-s05-profile-max-containers-col", () => {
    expect(content).toMatch(
      /maxContainers\s*:\s*integer\(\s*["']max_containers["']\s*\)/,
    );
    expect(content).toMatch(/max_containers["']\s*\)\.notNull\(\)\.default\(\s*10\s*\)/);
  });

  test("T03 -- colonne credentialProxyEnabled boolean notNull default(false) @cont-s05-profile-credential-proxy-col", () => {
    expect(content).toMatch(
      /credentialProxyEnabled\s*:\s*boolean\(\s*["']credential_proxy_enabled["']\s*\)/,
    );
    expect(content).toMatch(
      /credential_proxy_enabled["']\s*\)\.notNull\(\)\.default\(\s*false\s*\)/,
    );
  });

  test("T04 -- colonne allowedMountPaths jsonb string[] @cont-s05-profile-allowed-mount-paths-col", () => {
    expect(content).toMatch(
      /allowedMountPaths\s*:\s*jsonb\(\s*["']allowed_mount_paths["']\s*\)/,
    );
    expect(content).toMatch(/allowed_mount_paths["']\s*\)\.\$type<string\[\]>/);
  });

  test("T05 -- colonne networkMode text notNull default 'isolated' @cont-s05-profile-network-mode-col", () => {
    expect(content).toMatch(
      /networkMode\s*:\s*text\(\s*["']network_mode["']\s*\)/,
    );
    expect(content).toMatch(
      /network_mode["']\s*\)\.notNull\(\)\.default\(\s*["']isolated["']\s*\)/,
    );
  });

  test("T06 -- colonne maxDiskIops integer nullable @cont-s05-profile-max-disk-iops-col", () => {
    expect(content).toMatch(
      /maxDiskIops\s*:\s*integer\(\s*["']max_disk_iops["']\s*\)/,
    );
    // Should NOT have .notNull()
    const maxDiskIopsLine = content.split("\n").find((l) => l.includes("max_disk_iops"));
    expect(maxDiskIopsLine).toBeDefined();
    expect(maxDiskIopsLine).not.toMatch(/\.notNull\(\)/);
  });

  test("T07 -- colonne labels jsonb Record<string,string> @cont-s05-profile-labels-col", () => {
    expect(content).toMatch(
      /labels\s*:\s*jsonb\(\s*["']labels["']\s*\)/,
    );
    expect(content).toMatch(/labels["']\s*\)\.\$type<Record<string,\s*string>>/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Schema container_instances -- 8 nouvelles colonnes (T08-T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Schema container_instances -- nouvelles colonnes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_INSTANCES_FILE, "utf-8");
  });

  test("T08 -- colonne networkId text nullable @cont-s05-instance-network-id-col", () => {
    expect(content).toMatch(/networkId\s*:\s*text\(\s*["']network_id["']\s*\)/);
  });

  test("T09 -- colonne credentialProxyPort integer nullable @cont-s05-instance-credential-proxy-port-col", () => {
    expect(content).toMatch(
      /credentialProxyPort\s*:\s*integer\(\s*["']credential_proxy_port["']\s*\)/,
    );
  });

  test("T10 -- colonne mountedPaths jsonb string[] nullable @cont-s05-instance-mounted-paths-col", () => {
    expect(content).toMatch(
      /mountedPaths\s*:\s*jsonb\(\s*["']mounted_paths["']\s*\)/,
    );
    expect(content).toMatch(/mounted_paths["']\s*\)\.\$type<string\[\]>/);
  });

  test("T11 -- colonne healthCheckStatus text notNull default 'unknown' @cont-s05-instance-health-check-status-col", () => {
    expect(content).toMatch(
      /healthCheckStatus\s*:\s*text\(\s*["']health_check_status["']\s*\)/,
    );
    expect(content).toMatch(
      /health_check_status["']\s*\)\.notNull\(\)\.default\(\s*["']unknown["']\s*\)/,
    );
  });

  test("T12 -- colonne restartCount integer notNull default(0) @cont-s05-instance-restart-count-col", () => {
    expect(content).toMatch(
      /restartCount\s*:\s*integer\(\s*["']restart_count["']\s*\)/,
    );
    expect(content).toMatch(
      /restart_count["']\s*\)\.notNull\(\)\.default\(\s*0\s*\)/,
    );
  });

  test("T13 -- colonne lastHealthCheckAt timestamp nullable @cont-s05-instance-last-health-check-col", () => {
    expect(content).toMatch(
      /lastHealthCheckAt\s*:\s*timestamp\(\s*["']last_health_check_at["']/,
    );
  });

  test("T14 -- colonne labels jsonb nullable dans container_instances @cont-s05-instance-labels-col", () => {
    expect(content).toMatch(
      /labels\s*:\s*jsonb\(\s*["']labels["']\s*\)/,
    );
    expect(content).toMatch(/labels["']\s*\)\.\$type<Record<string,\s*string>>/);
  });

  test("T15 -- colonne logStreamUrl text nullable @cont-s05-instance-log-stream-url-col", () => {
    expect(content).toMatch(
      /logStreamUrl\s*:\s*text\(\s*["']log_stream_url["']\s*\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Indexes (T16-T18)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Indexes", () => {
  test("T16 -- index container_profiles_company_default_idx @cont-s05-profile-default-idx", async () => {
    const content = await readFile(SCHEMA_PROFILES_FILE, "utf-8");
    expect(content).toContain("container_profiles_company_default_idx");
    const idxMatch = content.indexOf("container_profiles_company_default_idx");
    const idxBlock = content.slice(idxMatch, idxMatch + 200);
    expect(idxBlock).toContain("companyId");
    expect(idxBlock).toContain("isDefault");
  });

  test("T17 -- index container_instances_health_idx @cont-s05-instance-health-idx", async () => {
    const content = await readFile(SCHEMA_INSTANCES_FILE, "utf-8");
    expect(content).toContain("container_instances_health_idx");
    const idxMatch = content.indexOf("container_instances_health_idx");
    const idxBlock = content.slice(idxMatch, idxMatch + 200);
    expect(idxBlock).toContain("companyId");
    expect(idxBlock).toContain("healthCheckStatus");
  });

  test("T18 -- index container_instances_restart_idx @cont-s05-instance-restart-idx", async () => {
    const content = await readFile(SCHEMA_INSTANCES_FILE, "utf-8");
    expect(content).toContain("container_instances_restart_idx");
    const idxMatch = content.indexOf("container_instances_restart_idx");
    const idxBlock = content.slice(idxMatch, idxMatch + 200);
    expect(idxBlock).toContain("companyId");
    expect(idxBlock).toContain("restartCount");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Relations Drizzle (T19-T20)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Relations Drizzle", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_RELATIONS_FILE, "utf-8");
  });

  test("T19 -- containerProfilesRelations avec company (one) et instances (many) @cont-s05-profiles-relations", () => {
    expect(content).toMatch(/export\s+const\s+containerProfilesRelations\s*=\s*relations\(/);
    // Should have company: one(companies, ...)
    expect(content).toMatch(/company\s*:\s*one\(\s*companies/);
    // Should have instances: many(containerInstances)
    expect(content).toMatch(/instances\s*:\s*many\(\s*containerInstances\s*\)/);
  });

  test("T20 -- containerInstancesRelations avec company (one), profile (one), agent (one) @cont-s05-instances-relations", () => {
    expect(content).toMatch(
      /export\s+const\s+containerInstancesRelations\s*=\s*relations\(/,
    );
    // Should have company: one(companies, ...)
    expect(content).toMatch(/company\s*:\s*one\(\s*companies/);
    // Should have profile: one(containerProfiles, ...)
    expect(content).toMatch(/profile\s*:\s*one\(\s*containerProfiles/);
    // Should have agent: one(agents, ...)
    expect(content).toMatch(/agent\s*:\s*one\(\s*agents/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Migration SQL (T21-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Migration SQL", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFiles = files.filter((f) => f.endsWith(".sql")).sort();

    let found = false;
    for (const file of migrationFiles) {
      const num = parseInt(file.substring(0, 4), 10);
      if (num < 34) continue;

      const content = await readFile(resolve(MIGRATIONS_DIR, file), "utf-8");
      if (
        content.includes("container_profiles") &&
        content.includes("ADD COLUMN") &&
        content.includes("docker_image")
      ) {
        migrationContent = content;
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(
        "No CONT-S05 migration file found (>= 0034) with ALTER TABLE container_profiles ADD COLUMN docker_image",
      );
    }
  });

  test("T21 -- migration contient 7 ALTER TABLE container_profiles ADD COLUMN @cont-s05-migration-profiles-alter", () => {
    const matches = migrationContent.match(
      /ALTER\s+TABLE\s+["']?container_profiles["']?\s+ADD\s+COLUMN/gi,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(7);
  });

  test("T22 -- migration contient 8 ALTER TABLE container_instances ADD COLUMN @cont-s05-migration-instances-alter", () => {
    const matches = migrationContent.match(
      /ALTER\s+TABLE\s+["']?container_instances["']?\s+ADD\s+COLUMN/gi,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(8);
  });

  test("T23 -- migration contient 3 CREATE INDEX @cont-s05-migration-indexes", () => {
    const matches = migrationContent.match(/CREATE\s+INDEX/gi);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  test("T24 -- migration non-destructive (pas de DROP, TRUNCATE, DELETE) @cont-s05-migration-safe", () => {
    expect(migrationContent).not.toMatch(/\bDROP\b/i);
    expect(migrationContent).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationContent).not.toMatch(/\bDELETE\b/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Service -- nouvelles fonctions (T25-T32)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Service -- nouvelles fonctions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T25 -- getProfile existe @cont-s05-svc-get-profile", () => {
    expect(content).toMatch(/async\s+function\s+getProfile\s*\(/);
  });

  test("T26 -- updateProfile existe @cont-s05-svc-update-profile", () => {
    expect(content).toMatch(/async\s+function\s+updateProfile\s*\(/);
  });

  test("T27 -- deleteProfile existe @cont-s05-svc-delete-profile", () => {
    expect(content).toMatch(/async\s+function\s+deleteProfile\s*\(/);
  });

  test("T28 -- deleteProfile verifie containers actifs avec inArray @cont-s05-svc-delete-active-check", () => {
    // Find the deleteProfile function body and check for inArray
    const deleteProfileIdx = content.indexOf("async function deleteProfile");
    expect(deleteProfileIdx).toBeGreaterThan(-1);
    const fnBlock = content.slice(deleteProfileIdx, deleteProfileIdx + 600);
    expect(fnBlock).toMatch(
      /inArray\(\s*containerInstances\.status\s*,\s*\[\s*["']pending["']\s*,\s*["']creating["']\s*,\s*["']running["']\s*\]\s*\)/,
    );
  });

  test("T29 -- deleteProfile verifie agents references @cont-s05-svc-delete-agents-check", () => {
    const deleteProfileIdx = content.indexOf("async function deleteProfile");
    expect(deleteProfileIdx).toBeGreaterThan(-1);
    const fnBlock = content.slice(deleteProfileIdx, deleteProfileIdx + 900);
    expect(fnBlock).toMatch(/agents\.containerProfileId/);
  });

  test("T30 -- duplicateProfile existe @cont-s05-svc-duplicate-profile", () => {
    expect(content).toMatch(/async\s+function\s+duplicateProfile\s*\(/);
  });

  test("T31 -- formatContainerInfo contient les champs enrichis @cont-s05-svc-format-enriched", () => {
    // The formatContainerInfo function contains a return { ... } block with enriched fields
    // We need enough context to capture the full return block
    const formatIdx = content.indexOf("function formatContainerInfo");
    expect(formatIdx).toBeGreaterThan(-1);
    // Find the ContainerInfoFull return type mention to confirm this is the right function
    const returnTypeBlock = content.slice(formatIdx, formatIdx + 250);
    expect(returnTypeBlock).toContain("ContainerInfoFull");
    // Now get enough of the function body to include all enriched fields
    const fnBlock = content.slice(formatIdx, formatIdx + 1500);
    expect(fnBlock).toContain("healthCheckStatus");
    expect(fnBlock).toContain("restartCount");
    expect(fnBlock).toContain("logStreamUrl");
    expect(fnBlock).toContain("networkId");
    expect(fnBlock).toContain("credentialProxyPort");
    expect(fnBlock).toContain("mountedPaths");
    expect(fnBlock).toContain("lastHealthCheckAt");
  });

  test("T32 -- service exporte les 4 nouvelles fonctions @cont-s05-svc-exports", () => {
    // The service return block is the second "return {" after formatContainerInfo definition
    const formatIdx = content.indexOf("function formatContainerInfo");
    expect(formatIdx).toBeGreaterThan(-1);
    // First return { after formatContainerInfo is inside the function body (the return of fields)
    const firstReturnIdx = content.indexOf("return {", formatIdx);
    expect(firstReturnIdx).toBeGreaterThan(-1);
    // Second return { is the service export object
    const serviceReturnIdx = content.indexOf("return {", firstReturnIdx + 10);
    expect(serviceReturnIdx).toBeGreaterThan(-1);
    const returnBlock = content.slice(serviceReturnIdx, serviceReturnIdx + 600);
    expect(returnBlock).toContain("getProfile");
    expect(returnBlock).toContain("updateProfile");
    expect(returnBlock).toContain("deleteProfile");
    expect(returnBlock).toContain("duplicateProfile");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Routes REST (T33-T38)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Routes REST", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T33 -- GET profile by id route @cont-s05-route-get-profile", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["']\/companies\/:companyId\/containers\/profiles\/:profileId["']/,
    );
  });

  test("T34 -- PUT update profile route @cont-s05-route-update-profile", () => {
    expect(content).toMatch(
      /router\.put\(\s*\n?\s*["']\/companies\/:companyId\/containers\/profiles\/:profileId["']/,
    );
  });

  test("T35 -- DELETE profile route @cont-s05-route-delete-profile", () => {
    // There should be a router.delete for profiles (distinct from container delete)
    expect(content).toMatch(
      /router\.delete\(\s*\n?\s*["']\/companies\/:companyId\/containers\/profiles\/:profileId["']/,
    );
  });

  test("T36 -- PUT route emits container.profile_updated audit @cont-s05-route-put-audit", () => {
    expect(content).toContain("container.profile_updated");
  });

  test("T37 -- DELETE profile route emits container.profile_deleted audit @cont-s05-route-delete-audit", () => {
    expect(content).toContain("container.profile_deleted");
  });

  test("T38 -- les 3 nouvelles routes utilisent requirePermission agents:manage_containers @cont-s05-route-permissions", () => {
    // Count occurrences of requirePermission with agents:manage_containers
    const matches = content.match(
      /requirePermission\(\s*db\s*,\s*["']agents:manage_containers["']\s*\)/g,
    );
    expect(matches).not.toBeNull();
    // Should be at least 6 (list profiles, create profile, get profile, update profile, delete profile, duplicate, health, stop, destroy)
    // The original had 3 (list, create, health) + 3 new (get, put, delete) + duplicate + stop + destroy = minimum 6
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Validators (T39-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Validators", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T39 -- updateProfileSchema existe @cont-s05-validator-update-profile", () => {
    expect(content).toMatch(/const\s+updateProfileSchema\s*=\s*z\.object\(\s*\{/);
  });

  test("T40 -- networkMode enum avec isolated, company-bridge, host-restricted @cont-s05-validator-network-mode", () => {
    expect(content).toMatch(
      /z\.enum\(\s*\[\s*["']isolated["']\s*,\s*["']company-bridge["']\s*,\s*["']host-restricted["']\s*\]\s*\)/,
    );
  });

  test("T41 -- createProfileSchema enrichi avec dockerImage, networkMode, credentialProxyEnabled @cont-s05-validator-create-enriched", () => {
    // Find the createProfileSchema block
    const createIdx = content.indexOf("const createProfileSchema");
    expect(createIdx).toBeGreaterThan(-1);
    // Find the next schema definition or a large enough block
    const nextSchemaIdx = content.indexOf("const updateProfileSchema", createIdx);
    const createBlock = content.slice(
      createIdx,
      nextSchemaIdx > createIdx ? nextSchemaIdx : createIdx + 800,
    );
    expect(createBlock).toContain("dockerImage");
    expect(createBlock).toContain("networkMode");
    expect(createBlock).toContain("credentialProxyEnabled");
  });

  test("T42 -- maxContainers validation z.number().int().min(1).max(200) @cont-s05-validator-max-containers", () => {
    expect(content).toMatch(
      /maxContainers\s*:\s*z\.number\(\)\.int\(\)\.min\(\s*1\s*\)\.max\(\s*200\s*\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Types partages (T43-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Types partages", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("T43 -- ContainerNetworkMode type exporte @cont-s05-type-network-mode", () => {
    expect(content).toMatch(/export\s+type\s+ContainerNetworkMode\b/);
  });

  test("T44 -- CONTAINER_NETWORK_MODES const avec isolated, company-bridge, host-restricted @cont-s05-type-network-modes-const", () => {
    expect(content).toMatch(/export\s+const\s+CONTAINER_NETWORK_MODES\s*=/);
    expect(content).toContain('"isolated"');
    expect(content).toContain('"company-bridge"');
    expect(content).toContain('"host-restricted"');
  });

  test("T45 -- ContainerHealthCheckStatus type exporte @cont-s05-type-health-status", () => {
    expect(content).toMatch(/export\s+type\s+ContainerHealthCheckStatus\b/);
  });

  test("T46 -- ContainerProfileInfo interface exportee @cont-s05-type-profile-info", () => {
    expect(content).toMatch(/export\s+interface\s+ContainerProfileInfo\b/);
  });

  test("T47 -- ContainerInfoFull interface extends ContainerInfo @cont-s05-type-info-full", () => {
    expect(content).toMatch(
      /export\s+interface\s+ContainerInfoFull\s+extends\s+ContainerInfo\b/,
    );
  });

  test("T48 -- ContainerProfileUpdate interface exportee @cont-s05-type-profile-update", () => {
    expect(content).toMatch(/export\s+interface\s+ContainerProfileUpdate\b/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Barrel exports (T49-T51)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Barrel exports", () => {
  test("T49 -- schema/index.ts exporte containerProfilesRelations @cont-s05-export-profiles-relations", async () => {
    const content = await readFile(SCHEMA_INDEX_FILE, "utf-8");
    expect(content).toContain("containerProfilesRelations");
  });

  test("T50 -- schema/index.ts exporte containerInstancesRelations @cont-s05-export-instances-relations", async () => {
    const content = await readFile(SCHEMA_INDEX_FILE, "utf-8");
    expect(content).toContain("containerInstancesRelations");
  });

  test("T51 -- types/index.ts exporte les nouveaux types container @cont-s05-export-types", async () => {
    const content = await readFile(TYPES_INDEX_FILE, "utf-8");
    expect(content).toContain("ContainerNetworkMode");
    expect(content).toContain("ContainerHealthCheckStatus");
    expect(content).toContain("ContainerProfileInfo");
    expect(content).toContain("ContainerInfoFull");
    expect(content).toContain("ContainerProfileUpdate");
    expect(content).toContain("CONTAINER_NETWORK_MODES");
    expect(content).toContain("CONTAINER_HEALTH_CHECK_STATUSES");
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Backward compatibility (T52-T54)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Backward compatibility", () => {
  test("T52 -- container_profiles garde ses 13 colonnes originales @cont-s05-compat-profiles-columns", async () => {
    const content = await readFile(SCHEMA_PROFILES_FILE, "utf-8");
    const originalColumns = [
      "id",
      "company_id",
      "name",
      "description",
      "cpu_millicores",
      "memory_mb",
      "disk_mb",
      "timeout_seconds",
      "gpu_enabled",
      "mount_allowlist",
      "network_policy",
      "is_default",
      "created_at",
    ];
    for (const col of originalColumns) {
      expect(content, `Original column "${col}" should be preserved`).toContain(
        `"${col}"`,
      );
    }
  });

  test("T53 -- container_profiles garde ses 2 indexes originaux @cont-s05-compat-profiles-indexes", async () => {
    const content = await readFile(SCHEMA_PROFILES_FILE, "utf-8");
    expect(content).toContain("container_profiles_company_name_unique_idx");
    expect(content).toContain("container_profiles_company_idx");
  });

  test("T54 -- container_instances garde ses 4 indexes originaux @cont-s05-compat-instances-indexes", async () => {
    const content = await readFile(SCHEMA_INSTANCES_FILE, "utf-8");
    expect(content).toContain("container_instances_company_status_idx");
    expect(content).toContain("container_instances_company_agent_idx");
    expect(content).toContain("container_instances_docker_container_idx");
    expect(content).toContain("container_instances_profile_idx");
  });
});
