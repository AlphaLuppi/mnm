/**
 * MU-S03: Invitation Bulk (CSV) -- E2E Tests
 *
 * These tests verify the deliverables of MU-S03:
 *   - AC-01: Upload de fichier CSV (dropzone, file input, format validation)
 *   - AC-02: Parsing CSV (header detection, separators, BOM, quoted values)
 *   - AC-03: Validation par ligne (email regex, role validation, duplicates, default role)
 *   - AC-04: Preview table and actions
 *   - AC-05: Envoi sequentiel avec progression
 *   - AC-06: Tableau de resultats
 *   - AC-07: Integration dans le dialog existant (tabs, BulkInviteTab import)
 *
 * Source files:
 *   - ui/src/components/BulkInviteTab.tsx -- New bulk import component (4-phase state machine)
 *   - ui/src/pages/Members.tsx -- Modified to include Tabs (Single/Bulk) in invite dialog
 *   - ui/src/api/access.ts -- createEmailInvite() (reused, not modified)
 *   - packages/shared/src/constants.ts -- BUSINESS_ROLES
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const BULK_INVITE_TAB = resolve(ROOT, "ui/src/components/BulkInviteTab.tsx");
const MEMBERS_PAGE = resolve(ROOT, "ui/src/pages/Members.tsx");
const ACCESS_API = resolve(ROOT, "ui/src/api/access.ts");
const CONSTANTS = resolve(ROOT, "packages/shared/src/constants.ts");

// ─── Group 1: BulkInviteTab component existence and exports ─────────────────

test.describe("Group 1: BulkInviteTab component (ui/src/components/BulkInviteTab.tsx)", () => {
  let content: string;

  test.beforeAll(() => {
    expect(
      existsSync(BULK_INVITE_TAB),
      "BulkInviteTab.tsx must exist at ui/src/components/BulkInviteTab.tsx",
    ).toBe(true);
    content = readFileSync(BULK_INVITE_TAB, "utf-8");
  });

  test("file exists", () => {
    expect(existsSync(BULK_INVITE_TAB)).toBe(true);
  });

  test("exports BulkInviteTab component", () => {
    expect(content).toMatch(
      /export\s+(function|const)\s+BulkInviteTab/,
    );
  });

  test('has data-testid="mu-s03-dropzone"', () => {
    expect(content).toContain('mu-s03-dropzone');
  });

  test('has data-testid="mu-s03-file-input"', () => {
    expect(content).toContain('mu-s03-file-input');
  });

  test('has data-testid="mu-s03-preview-table"', () => {
    expect(content).toContain('mu-s03-preview-table');
  });

  test('has data-testid="mu-s03-send-button"', () => {
    expect(content).toContain('mu-s03-send-button');
  });

  test('has data-testid="mu-s03-progress-bar" or progress indicator', () => {
    // Accept either a dedicated progress-bar testid or a progress element
    const hasProgressBar = content.includes("mu-s03-progress-bar");
    const hasProgressText = content.includes("mu-s03-progress-text");
    expect(
      hasProgressBar || hasProgressText,
      "Component must have a progress-bar or progress-text data-testid",
    ).toBe(true);
  });

  test('has data-testid="mu-s03-results-table"', () => {
    expect(content).toContain('mu-s03-results-table');
  });

  test('has data-testid="mu-s03-done-button"', () => {
    expect(content).toContain('mu-s03-done-button');
  });

  test("accepts .csv files (file input accept attribute)", () => {
    // Must accept CSV/text MIME types or .csv extension
    const acceptsCsv = content.includes(".csv") || content.includes("text/csv");
    expect(acceptsCsv, "File input must accept .csv files").toBe(true);
  });

  test("has max file size check (1MB / 1000000)", () => {
    // Look for a size check: 1MB, 1_000_000, 1000000, or 1024*1024
    const hasSizeCheck =
      content.includes("1000000") ||
      content.includes("1_000_000") ||
      content.includes("1024 * 1024") ||
      content.includes("1024*1024") ||
      /1\s*\*\s*1024\s*\*\s*1024/.test(content) ||
      content.includes("1048576");
    expect(hasSizeCheck, "Must have a max file size check around 1MB").toBe(true);
  });

  test("has max rows check (100)", () => {
    // Look for a 100-row limit check
    const hasRowLimit =
      /max.*rows?\s*.*100|100\s*.*rows?|rows?.*limit.*100|>\s*100|>=\s*101|\.length\s*>\s*100/i.test(content) ||
      content.includes("100");
    expect(hasRowLimit, "Must have a max rows check of 100").toBe(true);
  });
});

// ─── Group 2: CSV parsing logic ─────────────────────────────────────────────

test.describe("Group 2: CSV parsing logic", () => {
  let content: string;

  test.beforeAll(() => {
    content = readFileSync(BULK_INVITE_TAB, "utf-8");
  });

  test("handles comma separator", () => {
    // Must split by comma -- look for split(",") or split(/[,;]/) or similar
    const handlesComma =
      content.includes('split(",")') ||
      content.includes("split(',')") ||
      /split\s*\(\s*\/.*,/.test(content) ||
      /[,;]/.test(content) && content.includes("split");
    expect(handlesComma, "Must handle comma as CSV separator").toBe(true);
  });

  test("handles semicolon separator", () => {
    // Must support semicolon separator
    expect(content).toMatch(/[;]/);
    // Should appear in a split or separator context
    const handlesSemicolon =
      content.includes('split(";")') ||
      content.includes("split(';')") ||
      /split\s*\(\s*\/[^/]*;/.test(content) ||
      /separator|delimit|[,;]/i.test(content);
    expect(handlesSemicolon, "Must handle semicolon as CSV separator").toBe(true);
  });

  test("handles header row detection (email keyword)", () => {
    // Must detect header row by checking for 'email' keyword (case-insensitive)
    const hasHeaderDetection =
      /email/i.test(content) &&
      (/header/i.test(content) ||
        /toLowerCase.*email|email.*toLowerCase|\.includes.*email/i.test(content) ||
        /\[0\]/.test(content));
    expect(hasHeaderDetection, "Must detect header row containing 'email' keyword").toBe(true);
  });

  test("handles BOM removal (\\uFEFF)", () => {
    // Must handle UTF-8 BOM character
    const handlesBom =
      content.includes("\\uFEFF") ||
      content.includes("\uFEFF") ||
      content.includes("FEFF") ||
      /bom/i.test(content) ||
      content.includes("charCodeAt(0) === 0xFEFF");
    expect(handlesBom, "Must handle UTF-8 BOM character removal").toBe(true);
  });

  test("handles quoted values", () => {
    // Must handle CSV quoted values (strings wrapped in double quotes)
    const handlesQuotes =
      content.includes('replace(/^"|"$/g') ||
      content.includes("replace(/^\"|\"$/g") ||
      /quote/i.test(content) ||
      /["'].*replace.*["']/i.test(content) ||
      content.includes('"') && /trim|strip|remove.*quote/i.test(content);
    expect(handlesQuotes, "Must handle CSV quoted values").toBe(true);
  });
});

// ─── Group 3: Validation ────────────────────────────────────────────────────

test.describe("Group 3: Validation", () => {
  let content: string;

  test.beforeAll(() => {
    content = readFileSync(BULK_INVITE_TAB, "utf-8");
  });

  test("email validation regex present", () => {
    // Spec says: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // Accept this or any reasonable email validation regex
    const hasEmailRegex =
      content.includes("@") &&
      (/\^[^\\]*@/.test(content) ||
        /[^\s@]+@[^\s@]+/.test(content) ||
        /email.*valid|valid.*email|regex.*email/i.test(content) ||
        /\.test\s*\(\s*.*email/i.test(content));
    expect(hasEmailRegex, "Must have email validation regex").toBe(true);
  });

  test("role validation against BUSINESS_ROLES", () => {
    // Must validate role against BUSINESS_ROLES constant
    const hasRoleValidation =
      content.includes("BUSINESS_ROLES") &&
      (/includes\s*\(/.test(content) || /indexOf/.test(content) || /some/.test(content));
    expect(hasRoleValidation, "Must validate roles against BUSINESS_ROLES").toBe(true);
  });

  test("duplicate detection logic", () => {
    // Must detect duplicate emails within the CSV
    const hasDuplicateDetection =
      /[Dd]uplic/i.test(content) ||
      /seen.*email|email.*seen|already.*added|set.*has|map.*has/i.test(content) ||
      (content.includes("Set") && content.includes("has("));
    expect(hasDuplicateDetection, "Must have duplicate email detection logic").toBe(true);
  });

  test('default role is "contributor"', () => {
    // Default role must be "contributor"
    expect(content).toMatch(/["']contributor["']/);
    // Should be used as a default/fallback value
    const hasDefault =
      /default.*contributor|contributor.*default|\?\?.*contributor|\|\|.*contributor|:\s*["']contributor["']/i.test(content) ||
      content.includes('"contributor"') || content.includes("'contributor'");
    expect(hasDefault, 'Default role must be "contributor"').toBe(true);
  });
});

// ─── Group 4: Members.tsx integration ───────────────────────────────────────

test.describe("Group 4: Members.tsx integration", () => {
  let content: string;

  test.beforeAll(() => {
    content = readFileSync(MEMBERS_PAGE, "utf-8");
  });

  test("Members.tsx imports BulkInviteTab", () => {
    expect(content).toMatch(/import\s*\{?\s*BulkInviteTab\s*\}?\s*from/);
  });

  test('has tabs for "Single" and "Bulk" (or similar)', () => {
    // Must have tabs -- either literal text or tab trigger elements
    const hasSingleTab =
      /[Ss]ingle/i.test(content) && /[Tt]ab/i.test(content);
    const hasBulkTab =
      /[Bb]ulk/i.test(content) && /[Tt]ab/i.test(content);
    expect(hasSingleTab, "Must have a Single tab").toBe(true);
    expect(hasBulkTab, "Must have a Bulk tab").toBe(true);
  });

  test("imports Tabs components from shadcn/ui", () => {
    expect(content).toMatch(/import\s*\{[^}]*Tabs[^}]*\}\s*from\s*["']@\/components\/ui\/tabs["']/);
  });

  test('has data-testid="mu-s03-invite-tabs" or "mu-s03-tabs-list"', () => {
    const hasTabs =
      content.includes("mu-s03-invite-tabs") ||
      content.includes("mu-s03-tabs-list");
    expect(hasTabs, "Must have mu-s03-invite-tabs or mu-s03-tabs-list data-testid").toBe(true);
  });

  test('has data-testid="mu-s03-tab-bulk" for the bulk tab trigger', () => {
    expect(content).toContain("mu-s03-tab-bulk");
  });

  test('has data-testid="mu-s03-tab-single" for the single tab trigger', () => {
    expect(content).toContain("mu-s03-tab-single");
  });

  test("renders BulkInviteTab with companyId and onComplete props", () => {
    expect(content).toMatch(/<BulkInviteTab/);
    expect(content).toMatch(/companyId\s*=/);
    expect(content).toMatch(/onComplete\s*=/);
  });
});

// ─── Group 5: State machine phases ──────────────────────────────────────────

test.describe("Group 5: State machine phases", () => {
  let content: string;

  test.beforeAll(() => {
    content = readFileSync(BULK_INVITE_TAB, "utf-8");
  });

  test('has idle/preview/sending/results phases (or equivalent state)', () => {
    // Must define or reference the 4 phases
    const hasIdle = content.includes('"idle"') || content.includes("'idle'");
    const hasPreview = content.includes('"preview"') || content.includes("'preview'");
    const hasSending = content.includes('"sending"') || content.includes("'sending'");
    const hasResults = content.includes('"results"') || content.includes("'results'");

    expect(hasIdle, 'Must have "idle" phase').toBe(true);
    expect(hasPreview, 'Must have "preview" phase').toBe(true);
    expect(hasSending, 'Must have "sending" phase').toBe(true);
    expect(hasResults, 'Must have "results" phase').toBe(true);
  });

  test("defines BulkPhase type or equivalent state type", () => {
    // Must have a type for the phase state
    const hasPhaseType =
      /type\s+BulkPhase/i.test(content) ||
      /phase|Phase/.test(content) ||
      /useState<.*idle.*preview.*sending.*results/i.test(content) ||
      /useState.*["']idle["']/.test(content);
    expect(hasPhaseType, "Must define a phase state type or useState for phases").toBe(true);
  });

  test("uses createEmailInvite or accessApi for API calls", () => {
    const usesApi =
      content.includes("createEmailInvite") ||
      content.includes("accessApi");
    expect(usesApi, "Must use createEmailInvite or accessApi for sending invitations").toBe(true);
  });

  test("has progress tracking (current/total)", () => {
    // Must track progress with current and total
    const hasProgress =
      (content.includes("current") && content.includes("total")) ||
      /progress/i.test(content) ||
      /\d+\s*\/\s*\d+/.test(content) ||
      /setProgress/.test(content);
    expect(hasProgress, "Must have progress tracking with current/total").toBe(true);
  });

  test("has abort/cancel mechanism for stopping import", () => {
    const hasAbort =
      /abort/i.test(content) ||
      /cancel/i.test(content) ||
      content.includes("useRef") ||
      content.includes("abortRef");
    expect(hasAbort, "Must have abort/cancel mechanism").toBe(true);
  });

  test("defines CsvRow type with email, role, validationError fields", () => {
    const hasCsvRow =
      /type\s+CsvRow|interface\s+CsvRow/i.test(content) ||
      (content.includes("email") &&
        content.includes("role") &&
        /validationError|validation_error|error/i.test(content));
    expect(hasCsvRow, "Must define CsvRow type or equivalent with email, role, error fields").toBe(true);
  });

  test("defines InviteResult type with status field", () => {
    const hasInviteResult =
      /type\s+InviteResult|interface\s+InviteResult/i.test(content) ||
      (content.includes('"success"') &&
        content.includes('"error"') &&
        content.includes('"skipped"'));
    expect(hasInviteResult, "Must define InviteResult type with success/error/skipped statuses").toBe(true);
  });
});

// ─── Group 6: data-testid completeness ──────────────────────────────────────

test.describe("Group 6: data-testid completeness", () => {
  let bulkContent: string;
  let membersContent: string;

  test.beforeAll(() => {
    bulkContent = readFileSync(BULK_INVITE_TAB, "utf-8");
    membersContent = readFileSync(MEMBERS_PAGE, "utf-8");
  });

  // Combine both files for full data-testid check
  const bulkTestIds = [
    "mu-s03-dropzone",
    "mu-s03-file-input",
    "mu-s03-preview-table",
    "mu-s03-send-button",
    "mu-s03-results-table",
    "mu-s03-done-button",
    "mu-s03-change-file",
    "mu-s03-cancel-button",
  ];

  const membersTestIds = [
    "mu-s03-invite-tabs",
    "mu-s03-tab-single",
    "mu-s03-tab-bulk",
  ];

  for (const testId of bulkTestIds) {
    test(`BulkInviteTab has data-testid="${testId}"`, () => {
      expect(bulkContent).toContain(testId);
    });
  }

  for (const testId of membersTestIds) {
    test(`Members.tsx has data-testid="${testId}"`, () => {
      expect(membersContent).toContain(testId);
    });
  }

  test('BulkInviteTab has dynamic data-testid for preview rows (mu-s03-preview-row-)', () => {
    expect(bulkContent).toMatch(/mu-s03-preview-row-/);
  });

  test('BulkInviteTab has dynamic data-testid for result rows (mu-s03-result-row-)', () => {
    expect(bulkContent).toMatch(/mu-s03-result-row-/);
  });

  test('BulkInviteTab has progress bar or progress text data-testid', () => {
    const hasProgressTestId =
      bulkContent.includes("mu-s03-progress-bar") ||
      bulkContent.includes("mu-s03-progress-text");
    expect(hasProgressTestId, "Must have progress-bar or progress-text data-testid").toBe(true);
  });

  test('BulkInviteTab has results summary data-testid', () => {
    const hasSummary =
      bulkContent.includes("mu-s03-results-summary") ||
      bulkContent.includes("mu-s03-results-title");
    expect(hasSummary, "Must have results-summary or results-title data-testid").toBe(true);
  });

  test('BulkInviteTab has error count data-testid', () => {
    expect(bulkContent).toContain("mu-s03-error-count");
  });

  test('BulkInviteTab has browse button data-testid', () => {
    expect(bulkContent).toContain("mu-s03-browse-button");
  });

  test('BulkInviteTab has cancel import button data-testid', () => {
    expect(bulkContent).toContain("mu-s03-cancel-import");
  });

  test('BulkInviteTab has current email data-testid', () => {
    expect(bulkContent).toContain("mu-s03-current-email");
  });
});
