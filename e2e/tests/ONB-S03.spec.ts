/**
 * ONB-S03 — Import Jira Intelligent
 *
 * File-content-based E2E tests verifying:
 * - Backend jira-field-mapping (DEFAULT_STATUS_MAP, DEFAULT_PRIORITY_MAP, mapJiraIssueToMnm, mapJiraProjectToMnm)
 * - Backend jira-client (createJiraClient, fetchProjects, fetchIssuesBatch, pagination, auth)
 * - Backend jira-import service (startImport, processImport, deduplicateIssue, getImportStatus, listImportJobs)
 * - Backend jira-validators (importConfigSchema, jiraConnectionSchema)
 * - Backend routes (connect, preview, start, jobs, job detail, cancel, requirePermission, emitAudit)
 * - Backend barrel exports (services/index.ts, routes/index.ts, app.ts)
 * - Shared types (ImportJobStatus, JiraImportConfig, JiraImportPreview, JiraImportProgress)
 * - Frontend API client (connect, preview, start, listJobs, getJob, cancel)
 * - Frontend query keys (jiraImport.jobs, jiraImport.jobDetail)
 * - Frontend JiraImport page (data-testid coverage, wizard steps, field mapping, history)
 * - Frontend route + sidebar integration
 *
 * 68 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files — Backend
const FIELD_MAPPING_FILE = resolve(ROOT, "server/src/services/jira-field-mapping.ts");
const CLIENT_FILE = resolve(ROOT, "server/src/services/jira-client.ts");
const IMPORT_FILE = resolve(ROOT, "server/src/services/jira-import.ts");
const VALIDATORS_FILE = resolve(ROOT, "server/src/services/jira-validators.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/jira-import.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTE_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");

// Target files — Shared
const SHARED_TYPES_FILE = resolve(ROOT, "packages/shared/src/jira-import-types.ts");

// Target files — Frontend
const API_FILE = resolve(ROOT, "ui/src/api/jira-import.ts");
const API_INDEX = resolve(ROOT, "ui/src/api/index.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const PAGE_FILE = resolve(ROOT, "ui/src/pages/JiraImport.tsx");
const APP_TSX = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");

// ============================================================
// Backend — Jira Field Mapping (T01-T06)
// ============================================================

test.describe("ONB-S03 — Backend Field Mapping", () => {
  // T01 — DEFAULT_STATUS_MAP exists
  test("T01 — DEFAULT_STATUS_MAP exists", async () => {
    const src = await readFile(FIELD_MAPPING_FILE, "utf-8");
    expect(src).toContain("DEFAULT_STATUS_MAP");
    expect(src).toMatch(/export\s+const\s+DEFAULT_STATUS_MAP/);
  });

  // T02 — DEFAULT_PRIORITY_MAP exists
  test("T02 — DEFAULT_PRIORITY_MAP exists", async () => {
    const src = await readFile(FIELD_MAPPING_FILE, "utf-8");
    expect(src).toContain("DEFAULT_PRIORITY_MAP");
    expect(src).toMatch(/export\s+const\s+DEFAULT_PRIORITY_MAP/);
  });

  // T03 — mapJiraIssueToMnm function
  test("T03 — mapJiraIssueToMnm function", async () => {
    const src = await readFile(FIELD_MAPPING_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+mapJiraIssueToMnm/);
  });

  // T04 — mapJiraProjectToMnm function
  test("T04 — mapJiraProjectToMnm function", async () => {
    const src = await readFile(FIELD_MAPPING_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+mapJiraProjectToMnm/);
  });

  // T05 — JiraIssue type exported
  test("T05 — JiraIssue type exported", async () => {
    const src = await readFile(FIELD_MAPPING_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+JiraIssue/);
  });

  // T06 — Status mapping includes backlog
  test("T06 — Status mapping includes backlog", async () => {
    const src = await readFile(FIELD_MAPPING_FILE, "utf-8");
    expect(src).toContain("backlog");
    expect(src).toContain("in_progress");
    expect(src).toContain("done");
  });
});

// ============================================================
// Backend — Jira Client (T07-T13)
// ============================================================

test.describe("ONB-S03 — Backend Jira Client", () => {
  // T07 — createJiraClient factory
  test("T07 — createJiraClient factory", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+createJiraClient/);
  });

  // T08 — fetchProjects function
  test("T08 — fetchProjects function", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toContain("fetchProjects");
    expect(src).toMatch(/async\s+function\s+fetchProjects/);
  });

  // T09 — fetchIssuesBatch function
  test("T09 — fetchIssuesBatch function", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toContain("fetchIssuesBatch");
    expect(src).toMatch(/async\s+function\s+fetchIssuesBatch/);
  });

  // T10 — Uses /rest/api/3/
  test("T10 — Uses Jira REST API v3 path", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toMatch(/rest\/api\/3/);
  });

  // T11 — Pagination support (startAt)
  test("T11 — Pagination support (startAt)", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toContain("startAt");
    expect(src).toContain("maxResults");
  });

  // T12 — Authorization header
  test("T12 — Authorization header", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toMatch(/Authorization/i);
  });

  // T13 — Base64 encoding for auth
  test("T13 — Base64 encoding for auth", async () => {
    const src = await readFile(CLIENT_FILE, "utf-8");
    expect(src).toMatch(/Buffer\.from|btoa|base64/);
  });
});

// ============================================================
// Backend — Import Service (T14-T22)
// ============================================================

test.describe("ONB-S03 — Backend Import Service", () => {
  // T14 — startImport function
  test("T14 — startImport function", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+startImport/);
  });

  // T15 — processImport function
  test("T15 — processImport function", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+processImport/);
  });

  // T16 — deduplicateIssue function
  test("T16 — deduplicateIssue or deduplicate logic", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toMatch(/deduplicateIssue|deduplicate/);
  });

  // T17 — Uses importJobs table
  test("T17 — Uses importJobs table", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toContain("importJobs");
  });

  // T18 — Uses issues table
  test("T18 — Uses issues table", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toContain("issues");
    expect(src).toMatch(/from\s+["']@mnm\/db["']/);
  });

  // T19 — Uses projects table
  test("T19 — Uses projects table", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toContain("projects");
  });

  // T20 — Batch size configured
  test("T20 — Batch size configured", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toMatch(/50|BATCH_SIZE|batchSize/);
  });

  // T21 — getImportStatus function
  test("T21 — getImportStatus function", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toContain("getImportStatus");
  });

  // T22 — listImportJobs function
  test("T22 — listImportJobs function", async () => {
    const src = await readFile(IMPORT_FILE, "utf-8");
    expect(src).toContain("listImportJobs");
  });
});

// ============================================================
// Backend — Validators (T23-T25)
// ============================================================

test.describe("ONB-S03 — Backend Validators", () => {
  // T23 — importConfigSchema Zod
  test("T23 — importConfigSchema Zod", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toContain("importConfigSchema");
    expect(src).toMatch(/export\s+const\s+importConfigSchema/);
  });

  // T24 — jiraConnectionSchema Zod
  test("T24 — jiraConnectionSchema Zod", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toContain("jiraConnectionSchema");
    expect(src).toMatch(/export\s+const\s+jiraConnectionSchema/);
  });

  // T25 — Uses z.object
  test("T25 — Uses z.object", async () => {
    const src = await readFile(VALIDATORS_FILE, "utf-8");
    expect(src).toMatch(/z\.object/);
  });
});

// ============================================================
// Backend — Routes (T26-T35)
// ============================================================

test.describe("ONB-S03 — Backend Routes", () => {
  // T26 — POST connect route
  test("T26 — POST connect route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post[\s\S]*?connect/);
  });

  // T27 — POST preview route
  test("T27 — POST preview route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post[\s\S]*?preview/);
  });

  // T28 — POST start route
  test("T28 — POST start route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post[\s\S]*?start/);
  });

  // T29 — GET jobs list route
  test("T29 — GET jobs list route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get[\s\S]*?jobs/);
  });

  // T30 — GET job detail route
  test("T30 — GET job detail route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get[\s\S]*?:jobId|router\.get[\s\S]*?jobId/);
  });

  // T31 — POST cancel route
  test("T31 — POST cancel route", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post[\s\S]*?cancel/);
  });

  // T32 — Uses requirePermission
  test("T32 — Uses requirePermission", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("requirePermission");
  });

  // T33 — Uses assertCompanyAccess
  test("T33 — Uses assertCompanyAccess", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("assertCompanyAccess");
  });

  // T34 — Uses emitAudit
  test("T34 — Uses emitAudit", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("emitAudit");
  });

  // T35 — Route barrel export
  test("T35 — Route barrel export", async () => {
    const src = await readFile(ROUTE_INDEX, "utf-8");
    expect(src).toContain("jiraImportRoutes");
  });
});

// ============================================================
// Backend — Barrel & App (T36-T39)
// ============================================================

test.describe("ONB-S03 — Backend Barrel & App", () => {
  // T36 — Service barrel export (jira-import)
  test("T36 — Service barrel export (jira-import)", async () => {
    const src = await readFile(SERVICE_INDEX, "utf-8");
    expect(src).toMatch(/jiraImportService|jira-import/);
  });

  // T37 — Service barrel export (jira-client)
  test("T37 — Service barrel export (jira-client)", async () => {
    const src = await readFile(SERVICE_INDEX, "utf-8");
    expect(src).toMatch(/createJiraClient|jira-client/);
  });

  // T38 — Service barrel export (field-mapping)
  test("T38 — Service barrel export (field-mapping)", async () => {
    const src = await readFile(SERVICE_INDEX, "utf-8");
    expect(src).toMatch(/mapJiraIssueToMnm|jira-field-mapping/);
  });

  // T39 — App.ts mounts jira import routes
  test("T39 — App.ts mounts jira import routes", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toMatch(/jiraImport|jira-import/);
  });
});

// ============================================================
// Backend — Shared Types (T40-T43)
// ============================================================

test.describe("ONB-S03 — Shared Types", () => {
  // T40 — ImportJobStatus type
  test("T40 — ImportJobStatus type", async () => {
    const src = await readFile(SHARED_TYPES_FILE, "utf-8");
    expect(src).toContain("ImportJobStatus");
  });

  // T41 — JiraImportConfig type
  test("T41 — JiraImportConfig type", async () => {
    const src = await readFile(SHARED_TYPES_FILE, "utf-8");
    expect(src).toContain("JiraImportConfig");
  });

  // T42 — JiraImportPreview type
  test("T42 — JiraImportPreview type", async () => {
    const src = await readFile(SHARED_TYPES_FILE, "utf-8");
    expect(src).toContain("JiraImportPreview");
  });

  // T43 — JiraImportProgress type
  test("T43 — JiraImportProgress type", async () => {
    const src = await readFile(SHARED_TYPES_FILE, "utf-8");
    expect(src).toContain("JiraImportProgress");
  });
});

// ============================================================
// Frontend — API Client (T44-T50)
// ============================================================

test.describe("ONB-S03 — Frontend API Client", () => {
  // T44 — jiraImportApi.connect exists
  test("T44 — jiraImportApi.connect exists", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/connect.*companyId/);
  });

  // T45 — jiraImportApi.preview exists
  test("T45 — jiraImportApi.preview exists", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/preview.*companyId/);
  });

  // T46 — jiraImportApi.start exists
  test("T46 — jiraImportApi.start exists", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/start.*companyId/);
  });

  // T47 — jiraImportApi.listJobs exists
  test("T47 — jiraImportApi.listJobs exists", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/listJobs.*companyId/);
  });

  // T48 — jiraImportApi.getJob exists
  test("T48 — jiraImportApi.getJob exists", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/getJob.*companyId/);
  });

  // T49 — jiraImportApi.cancel exists
  test("T49 — jiraImportApi.cancel exists", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/cancel.*companyId/);
  });

  // T50 — API barrel export
  test("T50 — API barrel export", async () => {
    const src = await readFile(API_INDEX, "utf-8");
    expect(src).toContain("jiraImportApi");
  });
});

// ============================================================
// Frontend — Query Keys (T51-T52)
// ============================================================

test.describe("ONB-S03 — Frontend Query Keys", () => {
  // T51 — jiraImport jobs query key
  test("T51 — jiraImport jobs query key", async () => {
    const src = await readFile(QUERY_KEYS, "utf-8");
    expect(src).toContain("jiraImport");
  });

  // T52 — jiraImport detail query key
  test("T52 — jiraImport detail query key", async () => {
    const src = await readFile(QUERY_KEYS, "utf-8");
    expect(src).toMatch(/jiraImport[\s\S]*?(detail|jobDetail)/);
  });
});

// ============================================================
// Frontend — JiraImport Page (T53-T65)
// ============================================================

test.describe("ONB-S03 — Frontend JiraImport Page", () => {
  // T53 — Component exported
  test("T53 — Component exported", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toMatch(/export\s+(function|const)\s+JiraImport/);
  });

  // T54 — data-testid import-page
  test("T54 — data-testid import-page", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-import-page");
  });

  // T55 — data-testid jira-url
  test("T55 — data-testid jira-url", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-jira-url");
  });

  // T56 — data-testid jira-email
  test("T56 — data-testid jira-email", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-jira-email");
  });

  // T57 — data-testid jira-token
  test("T57 — data-testid jira-token", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-jira-token");
  });

  // T58 — data-testid test-connection
  test("T58 — data-testid test-connection", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-test-connection");
  });

  // T59 — data-testid connection-status
  test("T59 — data-testid connection-status", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-connection-status");
  });

  // T60 — data-testid project-list
  test("T60 — data-testid project-list", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-project-list");
  });

  // T61 — data-testid start-import
  test("T61 — data-testid start-import", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-start-import");
  });

  // T62 — data-testid progress-bar
  test("T62 — data-testid progress-bar", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-progress-bar");
  });

  // T63 — data-testid history-table
  test("T63 — data-testid history-table", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-history-table");
  });

  // T64 — data-testid cancel-import
  test("T64 — data-testid cancel-import", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-cancel-import");
  });

  // T65 — data-testid field-mapping
  test("T65 — data-testid field-mapping", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toContain("onb-s03-field-mapping");
  });
});

// ============================================================
// Frontend — Route & Sidebar (T66-T68)
// ============================================================

test.describe("ONB-S03 — Frontend Route & Sidebar", () => {
  // T66 — Route registered
  test("T66 — Route registered for import/jira", async () => {
    const src = await readFile(APP_TSX, "utf-8");
    expect(src).toMatch(/JiraImport|import\/jira/);
  });

  // T67 — Sidebar entry
  test("T67 — Sidebar entry for Import Jira", async () => {
    const src = await readFile(SIDEBAR_FILE, "utf-8");
    expect(src).toMatch(/[Ii]mport|Jira/);
    expect(src).toContain("onb-s03-nav-import");
  });

  // T68 — Uses RequirePermission or projects.manage
  test("T68 — Uses RequirePermission or projects.manage", async () => {
    const src = await readFile(PAGE_FILE, "utf-8");
    expect(src).toMatch(/RequirePermission|projects[.:_]manage/);
  });
});
