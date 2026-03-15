/**
 * ONB-S04 — Dual-Mode Config (Onboarding)
 *
 * File-content-based E2E tests verifying:
 * - Backend route validation extended to step 0-7 (was 0-6)
 * - Backend service completeOnboarding sets step=7 (was 6)
 * - New OnboardingDualModeStep component (3 position cards, skip, props)
 * - OnboardingWizard integration (6-step wizard, dual-mode state, API call, summary)
 * - OnboardingProgressBar updated to 6 entries with Speed+Launch labels
 * - Regression checks for ONB-S01 and DUAL-S01 compatibility
 *
 * 48 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files — Backend
const SERVICE_FILE = resolve(ROOT, "server/src/services/onboarding.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/onboarding.ts");

// Target files — Frontend
const DUAL_MODE_COMPONENT = resolve(ROOT, "ui/src/components/OnboardingDualModeStep.tsx");
const WIZARD_FILE = resolve(ROOT, "ui/src/components/OnboardingWizard.tsx");
const PROGRESS_BAR = resolve(ROOT, "ui/src/components/OnboardingProgressBar.tsx");

// Regression files — DUAL-S01
const CURSOR_SERVICE = resolve(ROOT, "server/src/services/automation-cursors.ts");
const CURSOR_ROUTES = resolve(ROOT, "server/src/routes/automation-cursors.ts");
const CURSOR_API_CLIENT = resolve(ROOT, "ui/src/api/automation-cursors.ts");

// ============================================================
// Backend — Route validation (T01-T03)
// ============================================================

test.describe("ONB-S04 — Backend Route Validation", () => {
  // T01 — onboarding route accepts step 0-7 range
  test("T01 — onboarding route accepts step 0-7 range", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/step\s*>\s*7/);
    expect(src).toContain("step must be a number between 0 and 7");
  });

  // T02 — onboarding route rejects step > 7
  test("T02 — onboarding route rejects step > 7", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/step\s*<\s*0\s*\|\|\s*step\s*>\s*7/);
  });

  // T03 — onboarding service completeOnboarding sets step=7
  test("T03 — onboarding service completeOnboarding sets step=7", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toMatch(/onboardingStep:\s*7/);
  });
});

// ============================================================
// Frontend — OnboardingDualModeStep component (T04-T16)
// ============================================================

test.describe("ONB-S04 — OnboardingDualModeStep Component", () => {
  // T04 — Component file exists
  test("T04 — Component file exists", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src.length).toBeGreaterThan(0);
  });

  // T05 — Component exports OnboardingDualModeStep function
  test("T05 — Component exports OnboardingDualModeStep function", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toMatch(/export\s+function\s+OnboardingDualModeStep/);
  });

  // T06 — Component has data-testid="onb-s04-dual-mode-step"
  test("T06 — Component has data-testid onb-s04-dual-mode-step", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('data-testid="onb-s04-dual-mode-step"');
  });

  // T07 — Component renders card for "manual"
  test("T07 — Component renders card for manual", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('data-testid={`onb-s04-card-${card.position}`}');
    expect(src).toContain('"manual"');
  });

  // T08 — Component renders card for "assisted"
  test("T08 — Component renders card for assisted", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('"assisted"');
  });

  // T09 — Component renders card for "auto"
  test("T09 — Component renders card for auto", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('"auto"');
  });

  // T10 — Manual card has title data-testid
  test("T10 — Card title data-testid pattern", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('data-testid={`onb-s04-card-title-${card.position}`}');
  });

  // T11 — Assisted card title "Assisted Mode"
  test("T11 — Assisted card title text", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain("Assisted Mode");
  });

  // T12 — Auto card title "Full Automation"
  test("T12 — Auto card title text", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain("Full Automation");
  });

  // T13 — Component has description for each mode
  test("T13 — Component has description data-testid pattern", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('data-testid={`onb-s04-card-desc-${card.position}`}');
  });

  // T14 — Component has radio indicator for each mode
  test("T14 — Component has radio indicator data-testid pattern", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('data-testid={`onb-s04-card-radio-${card.position}`}');
  });

  // T15 — Component has skip button
  test("T15 — Component has skip button", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toContain('data-testid="onb-s04-skip"');
  });

  // T16 — Component accepts props: onSelect, onSkip, selectedPosition, loading
  test("T16 — Component accepts correct props", async () => {
    const src = await readFile(DUAL_MODE_COMPONENT, "utf-8");
    expect(src).toMatch(/onSelect/);
    expect(src).toMatch(/onSkip/);
    expect(src).toMatch(/selectedPosition/);
    expect(src).toMatch(/loading/);
    expect(src).toMatch(/OnboardingDualModeStepProps/);
  });
});

// ============================================================
// Frontend — OnboardingWizard integration (T17-T30)
// ============================================================

test.describe("ONB-S04 — OnboardingWizard Integration", () => {
  // T17 — Wizard type Step includes 6
  test("T17 — Wizard type Step includes 6", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/type\s+Step\s*=.*6/);
  });

  // T18 — Wizard imports OnboardingDualModeStep
  test("T18 — Wizard imports OnboardingDualModeStep", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/import\s+.*OnboardingDualModeStep/);
  });

  // T19 — Wizard has dualModePosition state initialized to "assisted"
  test("T19 — Wizard has dualModePosition state", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/useState.*DualModePosition.*\("assisted"\)/);
  });

  // T20 — Wizard renders step 5 with OnboardingDualModeStep
  test("T20 — Wizard renders step 5 with OnboardingDualModeStep", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/step\s*===\s*5/);
    expect(src).toContain("<OnboardingDualModeStep");
  });

  // T21 — Wizard renders step 6 with launch content
  test("T21 — Wizard renders step 6 with launch content", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/step\s*===\s*6/);
    expect(src).toContain("Ready to launch");
  });

  // T22 — Wizard calls automation-cursors API on dual mode next
  test("T22 — Wizard calls automation-cursors API on handleDualModeNext", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+handleDualModeNext/);
    expect(src).toContain("automationCursorsApi.set");
  });

  // T23 — Wizard has handleDualModeSkip function
  test("T23 — Wizard has handleDualModeSkip function", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/function\s+handleDualModeSkip/);
  });

  // T24 — Wizard shows "Step X of 6" in title area
  test("T24 — Wizard shows Step X of 6", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain("Step {step} of 6");
  });

  // T25 — Wizard passes totalSteps={6} to OnboardingProgressBar
  test("T25 — Wizard passes totalSteps 6 to ProgressBar", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/totalSteps=\{6\}/);
  });

  // T26 — Wizard keyboard shortcut handles step 5
  test("T26 — Wizard keyboard shortcut handles step 5", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/step\s*===\s*5\)\s*handleDualModeNext/);
  });

  // T27 — Wizard step 5 has Next button with data-testid="onb-s04-next"
  test("T27 — Wizard step 5 has Next button", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain('data-testid="onb-s04-next"');
  });

  // T28 — Wizard step 6 summary includes speed line
  test("T28 — Wizard step 6 summary includes speed line", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain('data-testid="onb-s04-speed-summary"');
  });

  // T29 — Wizard step 6 has complete button
  test("T29 — Wizard step 6 has complete button", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    // The complete button is on step === 6 now
    expect(src).toMatch(/step\s*===\s*6[\s\S]{0,200}onb-s01-complete/);
  });

  // T30 — Wizard imports automationCursorsApi
  test("T30 — Wizard imports automationCursorsApi", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/import\s+.*automationCursorsApi/);
  });
});

// ============================================================
// Frontend — OnboardingProgressBar (T31-T34)
// ============================================================

test.describe("ONB-S04 — OnboardingProgressBar", () => {
  // T31 — STEP_CONFIG has 6 entries
  test("T31 — STEP_CONFIG has 6 entries", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    const configMatch = src.match(/const STEP_CONFIG\s*=\s*\[([\s\S]*?)\];/);
    expect(configMatch).not.toBeNull();
    const entries = configMatch![1].match(/\{[^}]+\}/g);
    expect(entries).toHaveLength(6);
  });

  // T32 — STEP_CONFIG[4] has label "Speed"
  test("T32 — STEP_CONFIG has Speed label", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain('"Speed"');
  });

  // T33 — STEP_CONFIG[5] has label "Launch"
  test("T33 — STEP_CONFIG has Launch label", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain('"Launch"');
  });

  // T34 — ProgressBar imports Gauge icon from lucide-react
  test("T34 — ProgressBar imports Gauge icon", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*Gauge[^}]*\}\s*from\s*["']lucide-react["']/);
  });
});

// ============================================================
// Backend — Service onboarding (T35-T37)
// ============================================================

test.describe("ONB-S04 — Backend Service", () => {
  // T35 — completeOnboarding sets onboardingStep to 7
  test("T35 — completeOnboarding sets onboardingStep to 7", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    // Find the completeOnboarding function and verify it sets step 7
    const fnMatch = src.match(/completeOnboarding[\s\S]*?onboardingStep:\s*(\d+)/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![1]).toBe("7");
  });

  // T36 — Service file has onb-s04 marker comment
  test("T36 — Service file has onb-s04 marker", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    expect(src).toContain("onb-s04");
  });

  // T37 — Service handles step 7 as completed state
  test("T37 — Service sets onboardingCompleted true with step 7", async () => {
    const src = await readFile(SERVICE_FILE, "utf-8");
    // The completeOnboarding function sets both onboardingCompleted: true and onboardingStep: 7
    expect(src).toMatch(/onboardingCompleted:\s*true[\s\S]{0,100}onboardingStep:\s*7/);
  });
});

// ============================================================
// Backend — Route onboarding (T38-T40)
// ============================================================

test.describe("ONB-S04 — Backend Route", () => {
  // T38 — Route validation accepts step up to 7
  test("T38 — Route validation accepts step up to 7", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("step > 7");
    expect(src).not.toMatch(/step\s*>\s*6[^7]/);
  });

  // T39 — Route file has onb-s04 marker comment
  test("T39 — Route file has onb-s04 marker", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("onb-s04");
  });

  // T40 — Route rejects step > 7
  test("T40 — Route error message mentions 7", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("between 0 and 7");
  });
});

// ============================================================
// Regression — ONB-S01 compat (T41-T45)
// ============================================================

test.describe("ONB-S04 — Regression ONB-S01", () => {
  // T41 — OnboardingWizard still has data-testid="onb-s01-wizard"
  test("T41 — OnboardingWizard still has onb-s01-wizard testid", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain('data-testid="onb-s01-wizard"');
  });

  // T42 — OnboardingWizard still has data-testid="onb-s01-step-title"
  test("T42 — OnboardingWizard still has onb-s01-step-title testid", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toContain('data-testid="onb-s01-step-title"');
  });

  // T43 — OnboardingProgressBar still has data-testid="onb-s01-progress-bar"
  test("T43 — OnboardingProgressBar still has onb-s01-progress-bar testid", async () => {
    const src = await readFile(PROGRESS_BAR, "utf-8");
    expect(src).toContain('data-testid="onb-s01-progress-bar"');
  });

  // T44 — OnboardingWizard still imports OnboardingProgressBar
  test("T44 — OnboardingWizard still imports OnboardingProgressBar", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/import\s+.*OnboardingProgressBar/);
  });

  // T45 — OnboardingWizard still imports OnboardingInviteStep
  test("T45 — OnboardingWizard still imports OnboardingInviteStep", async () => {
    const src = await readFile(WIZARD_FILE, "utf-8");
    expect(src).toMatch(/import\s+.*OnboardingInviteStep/);
  });
});

// ============================================================
// Regression — DUAL-S01 compat (T46-T48)
// ============================================================

test.describe("ONB-S04 — Regression DUAL-S01", () => {
  // T46 — automation-cursors service still exports automationCursorService
  test("T46 — automation-cursors service exports", async () => {
    const src = await readFile(CURSOR_SERVICE, "utf-8");
    expect(src).toMatch(/export\s+function\s+automationCursorService/);
  });

  // T47 — automation-cursors routes still export automationCursorRoutes
  test("T47 — automation-cursors routes exports", async () => {
    const src = await readFile(CURSOR_ROUTES, "utf-8");
    expect(src).toMatch(/export\s+function\s+automationCursorRoutes/);
  });

  // T48 — automation-cursors API client still exports automationCursorsApi
  test("T48 — automation-cursors API client exports", async () => {
    const src = await readFile(CURSOR_API_CLIENT, "utf-8");
    expect(src).toMatch(/export\s+const\s+automationCursorsApi/);
  });
});
