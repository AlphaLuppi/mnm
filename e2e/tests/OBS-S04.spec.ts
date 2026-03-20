/**
 * OBS-S04: UI AuditLog — Page Audit Log avec Tableau, Filtres et Export — E2E Tests
 *
 * These tests verify the deliverables of OBS-S04:
 *   - Groupe 1: Rendu de la page et navigation (T01-T07)
 *   - Groupe 2: API client audit (T08-T15)
 *   - Groupe 3: Query keys (T16-T19)
 *   - Groupe 4: Structure de la page (T20-T26)
 *   - Groupe 5: Filtres (T27-T40)
 *   - Groupe 6: Tableau (T41-T47)
 *   - Groupe 7: Pagination (T48-T54)
 *   - Groupe 8: Export (T55-T59)
 *   - Groupe 9: Verification (T60-T62)
 *   - Groupe 10: Detail modale (T63-T78)
 *   - Groupe 11: Etats de la page (T79-T83)
 *   - Groupe 12: Integration (T84-T88)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_AUDIT_FILE = resolve(ROOT, "ui/src/api/audit.ts");
const AUDIT_LOG_PAGE = resolve(ROOT, "ui/src/pages/AuditLog.tsx");
const AUDIT_DETAIL_COMPONENT = resolve(ROOT, "ui/src/components/AuditEventDetail.tsx");
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");
const QUERY_KEYS_FILE = resolve(ROOT, "ui/src/lib/queryKeys.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Rendu de la page et navigation (T01-T07)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Rendu de la page et navigation", () => {
  test("T01 — AuditLog page file exists and exports AuditLog", async () => {
    await expect(fsAccess(AUDIT_LOG_PAGE).then(() => true)).resolves.toBe(true);
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/export\s+function\s+AuditLog\s*\(/);
  });

  test("T02 — Route /audit declared with RequirePermission audit:read", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/path=["']audit["']/);
    expect(content).toContain('permission="audit:read"');
  });

  test("T03 — App.tsx imports AuditLog from ./pages/AuditLog", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{?\s*AuditLog\s*\}?\s*from\s*["'].\/pages\/AuditLog["']/);
  });

  test("T04 — Sidebar contains obs-s04-nav-audit link to /audit", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-nav-audit"');
    expect(content).toContain('to="/audit"');
  });

  test("T05 — Sidebar imports ScrollText icon from lucide-react", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*ScrollText[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  test("T06 — Sidebar Audit Log link is conditional on canViewActivity permission", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    // The nav-audit link should be inside a canViewActivity guard
    const navAuditIdx = content.indexOf('obs-s04-nav-audit');
    expect(navAuditIdx).toBeGreaterThan(-1);
    // Find the preceding canViewActivity guard
    const precedingChunk = content.slice(Math.max(0, navAuditIdx - 200), navAuditIdx);
    expect(precedingChunk).toContain("canViewActivity");
  });

  test("T07 — AuditLog page sets breadcrumbs to Audit Log", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/setBreadcrumbs\s*\(\s*\[\s*\{\s*label:\s*["']Audit Log["']\s*\}\s*\]/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: API client audit (T08-T15)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: API client audit", () => {
  test("T08 — api/audit.ts file exists and exports auditApi", async () => {
    await expect(fsAccess(API_AUDIT_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+auditApi\s*=/);
  });

  test("T09 — auditApi.list calls /companies/${companyId}/audit", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/audit");
    expect(content).toMatch(/list\s*:/);
  });

  test("T10 — auditApi.count calls /companies/${companyId}/audit/count", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/audit/count");
    expect(content).toMatch(/count\s*:/);
  });

  test("T11 — auditApi.getById calls /companies/${companyId}/audit/${eventId}", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/audit/${eventId}");
    expect(content).toMatch(/getById\s*:/);
  });

  test("T12 — auditApi.verify calls /companies/${companyId}/audit/verify", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toContain("/companies/${companyId}/audit/verify");
    expect(content).toMatch(/verify\s*:/);
  });

  test("T13 — auditApi.exportCsv uses fetch + blob + createObjectURL for download", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toMatch(/exportCsv\s*:/);
    expect(content).toContain("audit/export/csv");
    expect(content).toContain("res.blob()");
    expect(content).toContain("URL.createObjectURL");
  });

  test("T14 — auditApi.exportJson uses fetch + blob + createObjectURL for download", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toMatch(/exportJson\s*:/);
    expect(content).toContain("audit/export/json");
    // Both export functions use blob download pattern
    const blobCount = (content.match(/res\.blob\(\)/g) || []).length;
    expect(blobCount).toBeGreaterThanOrEqual(2);
  });

  test("T15 — buildQuery filters undefined/null/empty values", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toMatch(/function\s+buildQuery/);
    expect(content).toContain("undefined");
    expect(content).toContain("null");
    expect(content).toContain('""');
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Query keys (T16-T19)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Query keys", () => {
  test("T16 — audit.list query key returns ['audit', companyId, 'list', filters]", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toMatch(/audit\s*:\s*\{/);
    // The query key factory spans multiple lines, so check key parts separately
    const auditBlock = content.slice(content.indexOf("audit:"));
    expect(auditBlock).toContain('"audit"');
    expect(auditBlock).toContain('"list"');
    expect(auditBlock).toContain("companyId");
    expect(auditBlock).toContain("filters");
  });

  test("T17 — audit.detail query key returns ['audit', companyId, 'detail', eventId]", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const auditBlock = content.slice(content.indexOf("audit:"));
    expect(auditBlock).toContain('"detail"');
    expect(auditBlock).toContain("eventId");
  });

  test("T18 — audit.count query key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const auditBlock = content.slice(content.indexOf("audit:"));
    expect(auditBlock).toContain('"count"');
  });

  test("T19 — audit.verify query key exists", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const auditBlock = content.slice(content.indexOf("audit:"));
    expect(auditBlock).toContain('"verify"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Structure de la page (T20-T26)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Structure de la page", () => {
  test("T20 — data-testid obs-s04-page wrapper present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-page"');
  });

  test("T21 — data-testid obs-s04-header present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-header"');
  });

  test("T22 — data-testid obs-s04-title present with Audit Log text", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-title"');
    // Check that the title contains "Audit Log"
    const titleIdx = content.indexOf('obs-s04-title');
    const nearby = content.slice(titleIdx, titleIdx + 200);
    expect(nearby).toContain("Audit Log");
  });

  test("T23 — data-testid obs-s04-verify-button present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-verify-button"');
  });

  test("T24 — data-testid obs-s04-export-menu present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-export-menu"');
  });

  test("T25 — data-testid obs-s04-table present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-table"');
  });

  test("T26 — data-testid obs-s04-pagination present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-pagination"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Filtres (T27-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Filtres", () => {
  test("T27 — data-testid obs-s04-filters container present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filters"');
  });

  test("T28 — data-testid obs-s04-filter-search present as Input", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-search"');
    // It should be an Input element
    const searchIdx = content.indexOf('obs-s04-filter-search');
    const lineStart = content.lastIndexOf("\n", searchIdx);
    const lineEnd = content.indexOf("\n", searchIdx + 100);
    const lineContext = content.slice(Math.max(0, lineStart - 100), lineEnd);
    expect(lineContext).toMatch(/Input/i);
  });

  test("T29 — data-testid obs-s04-filter-actor-type present as SelectTrigger", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-actor-type"');
    const idx = content.indexOf('obs-s04-filter-actor-type');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toContain("SelectTrigger");
  });

  test("T30 — data-testid obs-s04-filter-severity present as SelectTrigger", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-severity"');
    const idx = content.indexOf('obs-s04-filter-severity');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toContain("SelectTrigger");
  });

  test("T31 — data-testid obs-s04-filter-date-from present with datetime-local type", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-date-from"');
    const idx = content.indexOf('obs-s04-filter-date-from');
    // Look further ahead to find the type attribute on the same Input element
    const elementContext = content.slice(Math.max(0, idx - 50), idx + 200);
    expect(elementContext).toContain('type="datetime-local"');
  });

  test("T32 — data-testid obs-s04-filter-date-to present with datetime-local type", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-date-to"');
    const idx = content.indexOf('obs-s04-filter-date-to');
    const elementContext = content.slice(Math.max(0, idx - 50), idx + 200);
    expect(elementContext).toContain('type="datetime-local"');
  });

  test("T33 — data-testid obs-s04-filter-action present as SelectTrigger", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-action"');
    const idx = content.indexOf('obs-s04-filter-action');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toContain("SelectTrigger");
  });

  test("T34 — data-testid obs-s04-filter-target-type present as SelectTrigger", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-target-type"');
    const idx = content.indexOf('obs-s04-filter-target-type');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toContain("SelectTrigger");
  });

  test("T35 — data-testid obs-s04-filter-target-id present as Input", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-target-id"');
    const idx = content.indexOf('obs-s04-filter-target-id');
    const lineStart = content.lastIndexOf("\n", idx);
    const lineEnd = content.indexOf("\n", idx + 50);
    const lineContext = content.slice(Math.max(0, lineStart - 100), lineEnd);
    expect(lineContext).toMatch(/Input/i);
  });

  test("T36 — data-testid obs-s04-filter-clear present as Button", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-filter-clear"');
    const idx = content.indexOf('obs-s04-filter-clear');
    const lineContext = content.slice(Math.max(0, idx - 100), idx + 50);
    expect(lineContext).toMatch(/Button/);
  });

  test("T37 — Actor Type select options include All, user, agent, system", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("All actors");
    expect(content).toContain("AUDIT_ACTOR_TYPES");
  });

  test("T38 — Severity select options include All, info, warning, error, critical", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("All severity");
    expect(content).toContain("AUDIT_SEVERITY_LEVELS");
  });

  test("T39 — Target Type select uses AUDIT_TARGET_TYPES from @mnm/shared", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("AUDIT_TARGET_TYPES");
    expect(content).toContain("All targets");
  });

  test("T40 — Action select uses AUDIT_ACTIONS from @mnm/shared", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("AUDIT_ACTIONS");
    expect(content).toContain("All actions");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Tableau (T41-T47)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Tableau", () => {
  test("T41 — Table header has 5 columns: Timestamp, Action, Actor, Target, Severity", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("Timestamp");
    expect(content).toContain("Action");
    expect(content).toContain("Actor");
    expect(content).toContain("Target");
    expect(content).toContain("Severity");
  });

  test("T42 — data-testid for all 5 column headers present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-col-timestamp"');
    expect(content).toContain('data-testid="obs-s04-col-action"');
    expect(content).toContain('data-testid="obs-s04-col-actor"');
    expect(content).toContain('data-testid="obs-s04-col-target"');
    expect(content).toContain('data-testid="obs-s04-col-severity"');
  });

  test("T43 — Rows are clickable with onClick handler", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    // tr elements should have onClick and role="button"
    expect(content).toContain('role="button"');
    expect(content).toMatch(/onClick=\{.*handleRowClick/s);
  });

  test("T44 — data-testid row pattern obs-s04-row-{eventId}", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`obs-s04-row-\$\{event\.id\}`\}/);
  });

  test("T45 — data-testid cell patterns obs-s04-cell-*-{eventId}", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/data-testid=\{`obs-s04-cell-timestamp-\$\{event\.id\}`\}/);
    expect(content).toMatch(/data-testid=\{`obs-s04-cell-action-\$\{event\.id\}`\}/);
    expect(content).toMatch(/data-testid=\{`obs-s04-cell-actor-\$\{event\.id\}`\}/);
    expect(content).toMatch(/data-testid=\{`obs-s04-cell-target-\$\{event\.id\}`\}/);
    expect(content).toMatch(/data-testid=\{`obs-s04-cell-severity-\$\{event\.id\}`\}/);
  });

  test("T46 — Severity badge uses severityVariant function for correct coloring", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/function\s+severityVariant/);
    expect(content).toContain('"destructive"');
    expect(content).toContain('"outline"');
    expect(content).toContain('"secondary"');
    // Critical gets font-bold
    expect(content).toContain('"critical"');
    expect(content).toContain("font-bold");
  });

  test("T47 — Sort order toggle button present with data-testid obs-s04-sort-order", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-sort-order"');
    // Should toggle between asc and desc
    expect(content).toMatch(/setSortOrder/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Pagination (T48-T54)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Pagination", () => {
  test("T48 — data-testid obs-s04-pagination-info shows Showing X-Y of Z events", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-pagination-info"');
    // Should contain interpolated showing/total text
    expect(content).toMatch(/Showing.*showingFrom.*showingTo.*total.*events/s);
  });

  test("T49 — data-testid obs-s04-pagination-prev present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-pagination-prev"');
    expect(content).toContain("Previous");
  });

  test("T50 — data-testid obs-s04-pagination-next present", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-pagination-next"');
    expect(content).toContain("Next");
  });

  test("T51 — data-testid obs-s04-pagination-page displays page number", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-pagination-page"');
    expect(content).toMatch(/Page\s*\{page\s*\+\s*1\}/);
  });

  test("T52 — Previous button disabled when page === 0", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    // Find the prev button and check for disabled={page === 0}
    const prevIdx = content.indexOf('obs-s04-pagination-prev');
    const prevChunk = content.slice(prevIdx, prevIdx + 300);
    expect(prevChunk).toMatch(/disabled=\{page\s*===\s*0\}/);
  });

  test("T53 — Next button disabled when (page+1)*pageSize >= total", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    // Find the next button and check for disabled condition
    const nextIdx = content.indexOf('obs-s04-pagination-next');
    const nextChunk = content.slice(nextIdx, nextIdx + 300);
    expect(nextChunk).toMatch(/disabled=\{\(page\s*\+\s*1\)\s*\*\s*PAGE_SIZE\s*>=\s*total\}/);
  });

  test("T54 — useQuery calls auditApi.list with limit and offset", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("limit: PAGE_SIZE");
    expect(content).toMatch(/offset:\s*page\s*\*\s*PAGE_SIZE/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Export (T55-T59)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Export", () => {
  test("T55 — Export CSV option present with data-testid obs-s04-export-csv", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-export-csv"');
    expect(content).toContain("Export CSV");
  });

  test("T56 — Export JSON option present with data-testid obs-s04-export-json", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-export-json"');
    expect(content).toContain("Export JSON");
  });

  test("T57 — Export menu is conditional on audit:export permission", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('hasPermission("audit:export")');
    expect(content).toContain("canExport");
    // The DropdownMenu should be inside a canExport guard
    expect(content).toMatch(/\{canExport\s*&&/);
  });

  test("T58 — Export CSV filename follows pattern audit-export-{companyId}-{date}.csv", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toMatch(/audit-export-\$\{companyId\}-.*\.csv/);
  });

  test("T59 — Export JSON filename follows pattern audit-export-{companyId}-{date}.json", async () => {
    const content = await readFile(API_AUDIT_FILE, "utf-8");
    expect(content).toMatch(/audit-export-\$\{companyId\}-.*\.json/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Verification (T60-T62)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Verification", () => {
  test("T60 — Verify button calls auditApi.verify", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("handleVerify");
    expect(content).toContain("auditApi.verify");
  });

  test("T61 — Verify success shows hash chain verified message with events count", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("Hash chain verified");
    expect(content).toContain("eventsChecked");
  });

  test("T62 — Verify failure shows hash chain broken message with brokenAt", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("Hash chain broken at event");
    expect(content).toContain("brokenAt");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Detail modale (T63-T78)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Detail modale", () => {
  test("T63 — AuditEventDetail file exists and exports AuditEventDetail", async () => {
    await expect(fsAccess(AUDIT_DETAIL_COMPONENT).then(() => true)).resolves.toBe(true);
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toMatch(/export\s+function\s+AuditEventDetail\s*\(/);
  });

  test("T64 — data-testid obs-s04-detail-dialog present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-dialog"');
  });

  test("T65 — data-testid obs-s04-detail-title present, displays action", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-title"');
    const titleIdx = content.indexOf('obs-s04-detail-title');
    const nearby = content.slice(titleIdx, titleIdx + 200);
    expect(nearby).toContain("event.action");
  });

  test("T66 — data-testid obs-s04-detail-timestamp present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-timestamp"');
  });

  test("T67 — data-testid obs-s04-detail-id present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-id"');
  });

  test("T68 — data-testid obs-s04-detail-action present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-action"');
  });

  test("T69 — data-testid obs-s04-detail-severity present as Badge", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-severity"');
    // Should be on a Badge component
    const sevIdx = content.indexOf('obs-s04-detail-severity');
    const lineContext = content.slice(Math.max(0, sevIdx - 100), sevIdx + 50);
    expect(lineContext).toContain("Badge");
  });

  test("T70 — data-testid obs-s04-detail-actor-type present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-actor-type"');
  });

  test("T71 — data-testid obs-s04-detail-actor-id present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-actor-id"');
  });

  test("T72 — data-testid obs-s04-detail-target-type present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-target-type"');
  });

  test("T73 — data-testid obs-s04-detail-target-id present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-target-id"');
  });

  test("T74 — data-testid obs-s04-detail-ip present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-ip"');
  });

  test("T75 — data-testid obs-s04-detail-user-agent present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-user-agent"');
  });

  test("T76 — data-testid obs-s04-detail-metadata present with JSON prettified", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-metadata"');
    expect(content).toContain("JSON.stringify");
    expect(content).toContain("null, 2");
    expect(content).toContain("No metadata");
  });

  test("T77 — data-testid obs-s04-detail-prev-hash present", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-prev-hash"');
    // Should show N/A when null
    const hashIdx = content.indexOf('obs-s04-detail-prev-hash');
    const nearby = content.slice(hashIdx, hashIdx + 200);
    expect(nearby).toContain("N/A");
  });

  test("T78 — data-testid obs-s04-detail-close present, is a Button", async () => {
    const content = await readFile(AUDIT_DETAIL_COMPONENT, "utf-8");
    expect(content).toContain('data-testid="obs-s04-detail-close"');
    const closeIdx = content.indexOf('obs-s04-detail-close');
    const lineContext = content.slice(Math.max(0, closeIdx - 100), closeIdx + 50);
    expect(lineContext).toContain("Button");
    // Should close the dialog
    const actionContext = content.slice(closeIdx, closeIdx + 200);
    expect(actionContext).toContain("onOpenChange(false)");
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Etats de la page (T79-T83)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Etats de la page", () => {
  test("T79 — Loading state with obs-s04-loading data-testid", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-loading"');
    expect(content).toContain("PageSkeleton");
  });

  test("T80 — Empty state with obs-s04-empty-state data-testid", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-empty-state"');
    expect(content).toContain("No audit events recorded yet.");
  });

  test("T81 — Error state with obs-s04-error-state data-testid", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain('data-testid="obs-s04-error-state"');
    expect(content).toContain("Failed to load audit events");
  });

  test("T82 — AuditLog uses useCompany() for selectedCompanyId", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("useCompany");
    expect(content).toContain("selectedCompanyId");
  });

  test("T83 — AuditLog uses useBreadcrumbs() and calls setBreadcrumbs", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("useBreadcrumbs");
    expect(content).toContain("setBreadcrumbs");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Integration (T84-T88)
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Integration", () => {
  test("T84 — AuditEvent type imported from @mnm/shared", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AuditEvent[^}]*\}\s*from\s*["']@mnm\/shared["']/);
  });

  test("T85 — AUDIT_ACTOR_TYPES imported and used in filters", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AUDIT_ACTOR_TYPES[^}]*\}\s*from\s*["']@mnm\/shared["']/);
    // Used in map for Select options
    expect(content).toContain("AUDIT_ACTOR_TYPES.map");
  });

  test("T86 — AUDIT_SEVERITY_LEVELS imported and used in filters", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AUDIT_SEVERITY_LEVELS[^}]*\}\s*from\s*["']@mnm\/shared["']/);
    expect(content).toContain("AUDIT_SEVERITY_LEVELS.map");
  });

  test("T87 — AUDIT_TARGET_TYPES imported and used in filters", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AUDIT_TARGET_TYPES[^}]*\}\s*from\s*["']@mnm\/shared["']/);
    expect(content).toContain("AUDIT_TARGET_TYPES.map");
  });

  test("T88 — usePermissions used to check audit:export permission", async () => {
    const content = await readFile(AUDIT_LOG_PAGE, "utf-8");
    expect(content).toContain("usePermissions");
    expect(content).toContain('hasPermission("audit:export")');
  });
});
