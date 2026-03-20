/**
 * DUAL-S02: UI Curseur -- E2E Tests
 *
 * These tests verify the deliverables of DUAL-S02:
 *   - Groupe 1: File existence (T01-T04)
 *   - Groupe 2: API client functions (T05-T11)
 *   - Groupe 3: Query keys (T12-T14)
 *   - Groupe 4: CursorPositionBadge component (T15-T19)
 *   - Groupe 5: CursorHierarchyChain component (T20-T22)
 *   - Groupe 6: AutomationCursors page structure (T23-T39)
 *   - Groupe 7: Add cursor dialog (T40-T44)
 *   - Groupe 8: Resolve section (T45-T48)
 *   - Groupe 9: Route + Sidebar + Permission (T49-T56)
 *   - Groupe 10: Barrel exports (T57-T58)
 *   - Groupe 11: Integration imports (T59-T64)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const API_CURSORS_FILE = resolve(ROOT, "ui/src/api/automation-cursors.ts");
const API_CLIENT_FILE = resolve(ROOT, "ui/src/api/client.ts");
const API_INDEX_FILE = resolve(ROOT, "ui/src/api/index.ts");
const QUERY_KEYS_FILE = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const POSITION_BADGE_FILE = resolve(ROOT, "ui/src/components/CursorPositionBadge.tsx");
const HIERARCHY_CHAIN_FILE = resolve(ROOT, "ui/src/components/CursorHierarchyChain.tsx");
const CURSORS_PAGE_FILE = resolve(ROOT, "ui/src/pages/AutomationCursors.tsx");
const APP_FILE = resolve(ROOT, "ui/src/App.tsx");
const SIDEBAR_FILE = resolve(ROOT, "ui/src/components/Sidebar.tsx");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01-T04)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 -- api/automation-cursors.ts exists", async () => {
    await expect(fsAccess(API_CURSORS_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T02 -- CursorPositionBadge.tsx exists", async () => {
    await expect(fsAccess(POSITION_BADGE_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T03 -- CursorHierarchyChain.tsx exists", async () => {
    await expect(fsAccess(HIERARCHY_CHAIN_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T04 -- AutomationCursors.tsx page exists", async () => {
    await expect(fsAccess(CURSORS_PAGE_FILE).then(() => true)).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: API client functions (T05-T11)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: API client automation-cursors.ts", () => {
  test("T05 -- exports automationCursorsApi object", async () => {
    const content = await readFile(API_CURSORS_FILE, "utf-8");
    expect(content).toMatch(/export\s+(const|function)\s+automationCursorsApi/);
  });

  test("T06 -- automationCursorsApi.list calls GET /companies/:companyId/automation-cursors", async () => {
    const content = await readFile(API_CURSORS_FILE, "utf-8");
    expect(content).toContain("list:");
    expect(content).toMatch(/\/companies\/.*\/automation-cursors/);
    expect(content).toContain("api.get");
  });

  test("T07 -- automationCursorsApi.set calls PUT /companies/:companyId/automation-cursors", async () => {
    const content = await readFile(API_CURSORS_FILE, "utf-8");
    expect(content).toContain("set:");
    expect(content).toContain("api.put");
    expect(content).toMatch(/\/companies\/.*\/automation-cursors/);
  });

  test("T08 -- automationCursorsApi.delete calls DELETE", async () => {
    const content = await readFile(API_CURSORS_FILE, "utf-8");
    expect(content).toContain("delete:");
    expect(content).toContain("api.delete");
  });

  test("T09 -- automationCursorsApi.resolve calls POST /companies/:companyId/automation-cursors/resolve", async () => {
    const content = await readFile(API_CURSORS_FILE, "utf-8");
    expect(content).toContain("resolve:");
    expect(content).toContain("api.post");
    expect(content).toMatch(/\/automation-cursors\/resolve/);
  });

  test("T10 -- automationCursorsApi.getById calls GET with cursorId path param", async () => {
    const content = await readFile(API_CURSORS_FILE, "utf-8");
    expect(content).toContain("getById:");
    expect(content).toMatch(/\/automation-cursors\/\$\{cursorId\}/);
  });

  test("T11 -- api.put method exists in client.ts", async () => {
    const content = await readFile(API_CLIENT_FILE, "utf-8");
    expect(content).toMatch(/put:\s*<T>/);
    expect(content).toContain('"PUT"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Query keys (T12-T14)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Query keys", () => {
  test("T12 -- queryKeys has automationCursors namespace", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toContain("automationCursors:");
  });

  test("T13 -- automationCursors.list returns array with 'automation-cursors'", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    // list function is defined across multiple lines
    expect(content).toContain('"automation-cursors"');
    expect(content).toContain('"list"');
    const acSection = content.substring(content.indexOf("automationCursors:"));
    expect(acSection).toContain("list:");
  });

  test("T14 -- automationCursors.resolve returns array with 'resolve'", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    const acSection = content.substring(content.indexOf("automationCursors:"));
    expect(acSection).toContain("resolve:");
    expect(acSection).toContain('"resolve"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: CursorPositionBadge component (T15-T19)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: CursorPositionBadge", () => {
  test("T15 -- exports CursorPositionBadge function component", async () => {
    const content = await readFile(POSITION_BADGE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+CursorPositionBadge/);
  });

  test("T16 -- renders 'Manual' text for position='manual'", async () => {
    const content = await readFile(POSITION_BADGE_FILE, "utf-8");
    expect(content).toContain('"Manual"');
  });

  test("T17 -- renders 'Assisted' text for position='assisted'", async () => {
    const content = await readFile(POSITION_BADGE_FILE, "utf-8");
    expect(content).toContain('"Assisted"');
  });

  test("T18 -- renders 'Auto' text for position='auto'", async () => {
    const content = await readFile(POSITION_BADGE_FILE, "utf-8");
    expect(content).toContain('"Auto"');
  });

  test("T19 -- uses Hand, Zap, Sparkles icons from lucide-react", async () => {
    const content = await readFile(POSITION_BADGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*Hand[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(content).toMatch(/import\s*\{[^}]*Zap[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(content).toMatch(/import\s*\{[^}]*Sparkles[^}]*\}\s*from\s*["']lucide-react["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: CursorHierarchyChain component (T20-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: CursorHierarchyChain", () => {
  test("T20 -- exports CursorHierarchyChain function component", async () => {
    const content = await readFile(HIERARCHY_CHAIN_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+CursorHierarchyChain/);
  });

  test("T21 -- renders data-testid='dual-s02-hierarchy-chain'", async () => {
    const content = await readFile(HIERARCHY_CHAIN_FILE, "utf-8");
    expect(content).toContain("dual-s02-hierarchy-chain");
  });

  test("T22 -- renders data-testid='dual-s02-hierarchy-step'", async () => {
    const content = await readFile(HIERARCHY_CHAIN_FILE, "utf-8");
    expect(content).toContain("dual-s02-hierarchy-step");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: AutomationCursors page structure (T23-T39)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: AutomationCursors page", () => {
  test("T23 -- exports AutomationCursors function component", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+AutomationCursors/);
  });

  test("T24 -- page has data-testid='dual-s02-page'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-page"');
  });

  test("T25 -- page has data-testid='dual-s02-title'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-title"');
  });

  test("T26 -- page has data-testid='dual-s02-add-btn'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-add-btn"');
  });

  test("T27 -- page has data-testid='dual-s02-filter-level'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-filter-level"');
  });

  test("T28 -- page has data-testid='dual-s02-table'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-table"');
  });

  test("T29 -- page has data-testid='dual-s02-table-row'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-table-row"');
  });

  test("T30 -- page has data-testid='dual-s02-position-badge'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-position-badge"');
  });

  test("T31 -- page has data-testid='dual-s02-delete-btn'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-delete-btn"');
  });

  test("T32 -- page has data-testid='dual-s02-empty-state'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-empty-state"');
  });

  test("T33 -- page has segment control with dual-s02-seg-${pos} template", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    // Segment data-testid is generated via template literal: `dual-s02-seg-${pos}`
    expect(content).toMatch(/data-testid=\{[`'"]dual-s02-seg-\$\{pos\}/);
  });

  test("T34 -- PositionSegment iterates AUTOMATION_CURSOR_POSITIONS", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain("AUTOMATION_CURSOR_POSITIONS.map");
  });

  test("T35 -- PositionSegment renders manual, assisted, auto labels via capitalize", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    // The PositionSegment renders capitalize(pos) for each position
    expect(content).toContain("capitalize(pos)");
  });

  test("T36 -- page has data-testid='dual-s02-resolve-section'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-resolve-section"');
  });

  test("T37 -- page has data-testid='dual-s02-resolve-btn'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-resolve-btn"');
  });

  test("T38 -- page has data-testid='dual-s02-resolve-result'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-resolve-result"');
  });

  test("T39 -- page has data-testid='dual-s02-table-header'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-table-header"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Add cursor dialog (T40-T44)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Add cursor dialog", () => {
  test("T40 -- page has data-testid='dual-s02-add-dialog'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-add-dialog"');
  });

  test("T41 -- dialog has data-testid='dual-s02-dialog-level'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-dialog-level"');
  });

  test("T42 -- dialog has data-testid='dual-s02-dialog-position'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-dialog-position"');
  });

  test("T43 -- dialog has data-testid='dual-s02-dialog-ceiling'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-dialog-ceiling"');
  });

  test("T44 -- dialog has data-testid='dual-s02-dialog-save'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-dialog-save"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Resolve section (T45-T48)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Resolve section", () => {
  test("T45 -- resolve section has data-testid='dual-s02-resolve-level'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-resolve-level"');
  });

  test("T46 -- resolve section has data-testid='dual-s02-resolve-agent-id'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-resolve-agent-id"');
  });

  test("T47 -- resolve section has data-testid='dual-s02-resolve-project-id'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-resolve-project-id"');
  });

  test("T48 -- resolve result has data-testid='dual-s02-hierarchy-chain'", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-hierarchy-chain"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Route + Sidebar + Permission (T49-T56)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Route + Sidebar + Permission", () => {
  test("T49 -- App.tsx imports AutomationCursors page", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*AutomationCursors[^}]*\}\s*from/);
  });

  test("T50 -- App.tsx has route path='automation-cursors'", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toContain('path="automation-cursors"');
  });

  test("T51 -- Route uses RequirePermission with workflows:enforce", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    // Find the automation-cursors route line
    const lines = content.split("\n");
    const routeLine = lines.find((l) => l.includes("automation-cursors") && l.includes("Route"));
    expect(routeLine).toBeDefined();
    expect(routeLine).toContain("RequirePermission");
    expect(routeLine).toContain("workflows:enforce");
  });

  test("T52 -- Sidebar.tsx has data-testid='dual-s02-nav-cursors'", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('data-testid="dual-s02-nav-cursors"');
  });

  test("T53 -- Sidebar uses hasPermission('workflows:enforce')", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('hasPermission("workflows:enforce")');
  });

  test("T54 -- Sidebar imports SlidersHorizontal icon", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain("SlidersHorizontal");
  });

  test("T55 -- Sidebar nav links to /automation-cursors", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    expect(content).toContain('to="/automation-cursors"');
  });

  test("T56 -- Sidebar Cursors item is inside Work section (near workflows/chat)", async () => {
    const content = await readFile(SIDEBAR_FILE, "utf-8");
    // The cursor nav item should be between chat and the end of Work section
    const workSectionIdx = content.indexOf('data-testid="rbac-s05-section-work"');
    const cursorIdx = content.indexOf('data-testid="dual-s02-nav-cursors"');
    const companySectionIdx = content.indexOf('data-testid="rbac-s05-section-company"');
    expect(workSectionIdx).toBeGreaterThan(-1);
    expect(cursorIdx).toBeGreaterThan(workSectionIdx);
    expect(cursorIdx).toBeLessThan(companySectionIdx);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Barrel exports (T57-T58)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Barrel exports", () => {
  test("T57 -- api/index.ts exports automationCursorsApi", async () => {
    const content = await readFile(API_INDEX_FILE, "utf-8");
    expect(content).toContain("automationCursorsApi");
  });

  test("T58 -- queryKeys.ts exports automationCursors key namespace", async () => {
    const content = await readFile(QUERY_KEYS_FILE, "utf-8");
    expect(content).toContain("automationCursors:");
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Integration imports (T59-T64)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Integration imports", () => {
  test("T59 -- AutomationCursors page imports automationCursorsApi", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*.*automationCursorsApi.*from.*automation-cursors/);
  });

  test("T60 -- AutomationCursors page imports queryKeys", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*queryKeys[^}]*\}\s*from/);
  });

  test("T61 -- AutomationCursors page imports useCompany", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*useCompany[^}]*\}\s*from/);
  });

  test("T62 -- AutomationCursors page imports CursorPositionBadge", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*CursorPositionBadge[^}]*\}\s*from/);
  });

  test("T63 -- AutomationCursors page imports useQuery from react-query", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*useQuery[^}]*\}\s*from\s*["']@tanstack\/react-query["']/);
  });

  test("T64 -- AutomationCursors page imports useMutation from react-query", async () => {
    const content = await readFile(CURSORS_PAGE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*useMutation[^}]*\}\s*from\s*["']@tanstack\/react-query["']/);
  });
});
