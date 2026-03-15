/**
 * ONB-S01 — Onboarding CEO (Wizard B2B)
 *
 * File-content-based E2E tests verifying:
 * - Backend service (getOnboardingStatus, updateOnboardingStep, completeOnboarding, resetOnboarding)
 * - Backend routes (GET, PUT, POST /complete, POST /reset) + audit emission
 * - Schema migration (onboarding_step, onboarding_completed, onboarding_data columns)
 * - Frontend API client (getStatus, updateStep, complete, reset)
 * - Query keys (onboarding.status)
 * - OnboardingProgressBar component (progress bar, step icons, labels, states)
 * - OnboardingInviteStep component (email input, role select, add/remove, send/skip)
 * - OnboardingWizard enhancement (data-testid, progress bar, invite step, server sync, localStorage)
 * - Barrel exports (services, routes, api, app.ts)
 *
 * 52 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files — Backend
const SERVICE_FILE = resolve(ROOT, "server/src/services/onboarding.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/onboarding.ts");
const ROUTE_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/companies.ts");
const MIGRATION_FILE = resolve(ROOT, "packages/db/src/migrations/0043_onboarding_tracking.sql");

// Target files — Frontend
const API_FILE = resolve(ROOT, "ui/src/api/onboarding.ts");
const API_INDEX = resolve(ROOT, "ui/src/api/index.ts");
const QUERY_KEYS = resolve(ROOT, "ui/src/lib/queryKeys.ts");
const PROGRESS_BAR = resolve(ROOT, "ui/src/components/OnboardingProgressBar.tsx");
const INVITE_STEP = resolve(ROOT, "ui/src/components/OnboardingInviteStep.tsx");
const WIZARD_FILE = resolve(ROOT, "ui/src/components/OnboardingWizard.tsx");

// ============================================================
// Backend — Service (T01-T06)
// ============================================================

test.describe("ONB-S01 — Backend Service", () => {
  // T01 — Service exports getOnboardingStatus
  test("T01 — Service exports getOnboardingStatus", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getOnboardingStatus/);
    expect(src).toContain("getOnboardingStatus");
  });

  // T02 — Service exports updateOnboardingStep
  test("T02 — Service exports updateOnboardingStep", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+updateOnboardingStep/);
    expect(src).toContain("updateOnboardingStep");
  });

  // T03 — Service exports completeOnboarding
  test("T03 — Service exports completeOnboarding", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+completeOnboarding/);
    expect(src).toContain("completeOnboarding");
  });

  // T04 — Service exports resetOnboarding
  test("T04 — Service exports resetOnboarding", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+resetOnboarding/);
    expect(src).toContain("resetOnboarding");
  });

  // T05 — Service uses companies table
  test("T05 — Service uses companies table", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toContain("companies");
    expect(src).toMatch(/from\s+["']@mnm\/db["']/);
  });

  // T06 — Service barrel export
  test("T06 — Service barrel export in services/index.ts", async () => {
    const src = await readFile(SERVICE_INDEX, "utf-8");
    expect(src).toContain("onboardingService");
    expect(src).toMatch(/from\s+["']\.\/onboarding/);
  });
});

// ============================================================
// Backend — Routes (T07-T14)
// ============================================================

test.describe("ONB-S01 — Backend Routes", () => {
  // T07 — GET route for status
  test("T07 — GET route for onboarding status", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\(/);
    expect(src).toContain("/companies/:companyId/onboarding");
  });

  // T08 — PUT route for update
  test("T08 — PUT route for onboarding update", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.put\(/);
    expect(src).toContain("/companies/:companyId/onboarding");
  });

  // T09 — POST route for complete
  test("T09 — POST route for onboarding complete", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\(/);
    expect(src).toContain("/complete");
  });

  // T10 — POST route for reset
  test("T10 — POST route for onboarding reset", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("/reset");
  });

  // T11 — Routes use assertCompanyAccess
  test("T11 — Routes use assertCompanyAccess", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("assertCompanyAccess");
    // Should be called in all 4 routes
    const matches = src.match(/assertCompanyAccess/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  // T12 — Routes emit audit events
  test("T12 — Routes emit audit events", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("emitAudit");
    // At least 3 audit emissions (update, complete, reset)
    const matches = src.match(/emitAudit/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  // T13 — Routes barrel export
  test("T13 — Routes barrel export in routes/index.ts", async () => {
    const src = await readFile(ROUTE_INDEX, "utf-8");
    expect(src).toContain("onboardingRoutes");
    expect(src).toMatch(/from\s+["']\.\/onboarding/);
  });

  // T14 — App.ts mounts onboarding routes
  test("T14 — App.ts mounts onboarding routes", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toContain("onboardingRoutes");
    // Both import and use
    expect(src).toMatch(/import.*onboardingRoutes/);
    expect(src).toMatch(/api\.use\(onboardingRoutes/);
  });
});

// ============================================================
// Backend — Schema (T15-T18)
// ============================================================

test.describe("ONB-S01 — Schema", () => {
  // T15 — onboardingStep column added
  test("T15 — onboardingStep column in schema", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("onboarding_step");
    expect(src).toContain("onboardingStep");
  });

  // T16 — onboardingCompleted column added
  test("T16 — onboardingCompleted column in schema", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("onboarding_completed");
    expect(src).toContain("onboardingCompleted");
  });

  // T17 — onboardingData column added
  test("T17 — onboardingData column in schema", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("onboarding_data");
    expect(src).toContain("onboardingData");
  });

  // T18 — Migration file exists with correct SQL
  test("T18 — Migration file adds onboarding columns", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toContain("onboarding_step");
    expect(src).toContain("onboarding_completed");
    expect(src).toContain("onboarding_data");
    expect(src).toMatch(/ALTER\s+TABLE/i);
  });
});

// ============================================================
// Frontend — API Client (T19-T23)
// ============================================================

test.describe("ONB-S01 — Frontend API Client", () => {
  // T19 — onboardingApi.getStatus exists
  test("T19 — onboardingApi.getStatus function", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/getStatus:\s*\(companyId/);
    expect(src).toContain("`/companies/${companyId}/onboarding`");
  });

  // T20 — onboardingApi.updateStep exists
  test("T20 — onboardingApi.updateStep function", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/updateStep:\s*\(companyId/);
    expect(src).toContain("api.put");
  });

  // T21 — onboardingApi.complete exists
  test("T21 — onboardingApi.complete function", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/complete:\s*\(companyId/);
    expect(src).toContain("/onboarding/complete");
  });

  // T22 — onboardingApi.reset exists
  test("T22 — onboardingApi.reset function", async () => {
    const src = await readFile(API_FILE, "utf-8");
    expect(src).toMatch(/reset:\s*\(companyId/);
    expect(src).toContain("/onboarding/reset");
  });

  // T23 — API barrel export
  test("T23 — onboardingApi barrel export in api/index.ts", async () => {
    const src = await readFile(API_INDEX, "utf-8");
    expect(src).toContain("onboardingApi");
    expect(src).toMatch(/from\s+["']\.\/onboarding["']/);
  });
});

// ============================================================
// Frontend — Query Keys (T24)
// ============================================================

test.describe("ONB-S01 — Query Keys", () => {
  // T24 — Onboarding query keys exist
  test("T24 — onboarding query keys section", async () => {
    const src = await readFile(QUERY_KEYS, "utf-8");
    expect(src).toContain("onboarding");
    expect(src).toMatch(/onboarding:\s*\{/);
    expect(src).toContain("status");
  });
});

// ============================================================
// Frontend — OnboardingProgressBar (T25-T31)
// ============================================================

test.describe("ONB-S01 — OnboardingProgressBar", () => {
  // T25 — Component exists and is exported
  test("T25 — OnboardingProgressBar is exported", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toMatch(/export\s+function\s+OnboardingProgressBar/);
  });

  // T26 — data-testid progress-bar
  test("T26 — data-testid onb-s01-progress-bar", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain("onb-s01-progress-bar");
  });

  // T27 — data-testid progress-step-1 through 5
  test("T27 — data-testid onb-s01-progress-step- prefix", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain("onb-s01-progress-step-");
  });

  // T28 — Step labels rendered
  test("T28 — data-testid onb-s01-step-label- prefix", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain("onb-s01-step-label-");
  });

  // T29 — Completed state checkmark
  test("T29 — Completed state shows Check icon", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain("Check");
    expect(src).toContain("isCompleted");
  });

  // T30 — Current state pulse animation
  test("T30 — Current state shows animate-pulse", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain("animate-pulse");
    expect(src).toContain("isCurrent");
  });

  // T31 — Step icons present (Building2, Bot, ListTodo, Users, Rocket)
  test("T31 — Step icons imported from lucide-react", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain("Building2");
    expect(src).toContain("Bot");
    expect(src).toContain("ListTodo");
    expect(src).toContain("Users");
    expect(src).toContain("Rocket");
  });
});

// ============================================================
// Frontend — OnboardingInviteStep (T32-T42)
// ============================================================

test.describe("ONB-S01 — OnboardingInviteStep", () => {
  // T32 — Component exists and is exported
  test("T32 — OnboardingInviteStep is exported", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toMatch(/export\s+function\s+OnboardingInviteStep/);
  });

  // T33 — data-testid invite-email
  test("T33 — data-testid onb-s01-invite-email", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-email");
  });

  // T34 — data-testid invite-role
  test("T34 — data-testid onb-s01-invite-role", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-role");
  });

  // T35 — data-testid invite-add
  test("T35 — data-testid onb-s01-invite-add", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-add");
  });

  // T36 — data-testid invite-list
  test("T36 — data-testid onb-s01-invite-list", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-list");
  });

  // T37 — data-testid invite-send
  test("T37 — data-testid onb-s01-invite-send", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-send");
  });

  // T38 — data-testid invite-skip
  test("T38 — data-testid onb-s01-invite-skip", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-skip");
  });

  // T39 — Email validation present
  test("T39 — Email validation with @ check", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("@");
    expect(src).toMatch(/isValidEmail|email.*valid/i);
  });

  // T40 — Role options include 4 roles
  test("T40 — Role options include admin, manager, contributor, viewer", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain('"admin"');
    expect(src).toContain('"manager"');
    expect(src).toContain('"contributor"');
    expect(src).toContain('"viewer"');
  });

  // T41 — data-testid invite-success
  test("T41 — data-testid onb-s01-invite-success", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-success");
  });

  // T42 — data-testid invite-error
  test("T42 — data-testid onb-s01-invite-error", async () => {
    const src = await readFile(INVITE_STEP, "utf-8");
    expect(src).toContain("onb-s01-invite-error");
  });
});

// ============================================================
// Frontend — OnboardingWizard Enhancement (T43-T52)
// ============================================================

test.describe("ONB-S01 — OnboardingWizard Enhancement", () => {
  // T43 — data-testid wizard container
  test("T43 — data-testid onb-s01-wizard", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onb-s01-wizard");
  });

  // T44 — data-testid step-title
  test("T44 — data-testid onb-s01-step-title", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onb-s01-step-title");
  });

  // T45 — data-testid next button
  test("T45 — data-testid onb-s01-next", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onb-s01-next");
  });

  // T46 — data-testid back button
  test("T46 — data-testid onb-s01-back", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onb-s01-back");
  });

  // T47 — data-testid complete button
  test("T47 — data-testid onb-s01-complete", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onb-s01-complete");
  });

  // T48 — OnboardingProgressBar imported
  test("T48 — OnboardingProgressBar imported in wizard", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/import.*OnboardingProgressBar/);
    expect(src).toContain("<OnboardingProgressBar");
  });

  // T49 — OnboardingInviteStep imported
  test("T49 — OnboardingInviteStep imported in wizard", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/import.*OnboardingInviteStep/);
    expect(src).toContain("<OnboardingInviteStep");
  });

  // T50 — Server sync hook present
  test("T50 — Server sync with onboardingApi or updateStep", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onboardingApi");
    expect(src).toMatch(/onboardingApi\.(updateStep|complete)/);
  });

  // T51 — localStorage persistence
  test("T51 — localStorage persistence for offline resilience", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("localStorage");
    expect(src).toContain("mnm-onboarding-");
  });

  // T52 — data-testid sync-status
  test("T52 — data-testid onb-s01-sync-status", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("onb-s01-sync-status");
  });
});
