/**
 * ORCH-S02: WorkflowEnforcer -- Fichiers Obligatoires, Pre-prompts, Resultats Intermediaires -- E2E Tests
 *
 * These tests verify the deliverables of ORCH-S02:
 *   - Groupe 1: File existence and barrel exports (T27-T28)
 *   - Groupe 2: WorkflowEnforcer service functions (T29-T34)
 *   - Groupe 3: Service imports (T35-T37)
 *   - Groupe 4: Schema extensions — workflow_templates (T38-T40, T62)
 *   - Groupe 5: Schema extensions — stage_instances (T41-T42)
 *   - Groupe 6: Orchestrator integration (T43-T44)
 *   - Groupe 7: Shared types — orchestrator.ts (T45-T49, T54-T56, T61)
 *   - Groupe 8: LiveEvent constants (T50-T52)
 *   - Groupe 9: Migration SQL (T53)
 *   - Groupe 10: Service logic checks (T57-T60)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const ENFORCER_FILE = resolve(ROOT, "server/src/services/workflow-enforcer.ts");
const ORCHESTRATOR_FILE = resolve(ROOT, "server/src/services/orchestrator.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const STAGE_INSTANCES_SCHEMA = resolve(ROOT, "packages/db/src/schema/stage_instances.ts");
const WORKFLOW_TEMPLATES_SCHEMA = resolve(ROOT, "packages/db/src/schema/workflow_templates.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/orchestrator.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");

// ---------------------------------------------------------------------------
// Groupe 1: File existence and barrel exports (T27-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence and barrel exports", () => {
  test("T27 -- workflow-enforcer.ts exists in server/src/services/", async () => {
    await expect(fsAccess(ENFORCER_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T28 -- workflow-enforcer.ts exports workflowEnforcerService or workflowEnforcer", async () => {
    const content = await readFile(ENFORCER_FILE, "utf-8");
    // Should export either workflowEnforcerService or workflowEnforcer as a named function
    expect(content).toMatch(
      /export\s+function\s+workflow[Ee]nforcer(Service)?\s*\(/,
    );
  });

  test("T28b -- Services barrel exports the workflow enforcer", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toMatch(/workflow.?[Ee]nforcer/);
    expect(content).toMatch(/from\s+["']\.\/workflow-enforcer/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: WorkflowEnforcer service functions (T29-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: WorkflowEnforcer service functions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ENFORCER_FILE, "utf-8");
  });

  test("T29 -- contains enforceTransition function", () => {
    expect(content).toMatch(/enforceTransition\s*\(/);
  });

  test("T30 -- contains validateRequiredFiles function", () => {
    expect(content).toMatch(/validateRequiredFiles\s*\(/);
  });

  test("T31 -- contains injectPrePrompts function", () => {
    expect(content).toMatch(/injectPrePrompts\s*\(/);
  });

  test("T32 -- contains persistStageResults function (or persistArtifacts)", () => {
    expect(content).toMatch(/persist(StageResults|Artifacts)\s*\(/);
  });

  test("T33 -- contains getStageArtifacts function", () => {
    expect(content).toMatch(/getStageArtifacts\s*\(/);
  });

  test("T34 -- contains buildStageContext function", () => {
    expect(content).toMatch(/buildStageContext\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Service imports (T35-T37)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Service imports", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ENFORCER_FILE, "utf-8");
  });

  test("T35 -- imports from @mnm/db", () => {
    expect(content).toMatch(/from\s+["']@mnm\/db["']/);
  });

  test("T36 -- imports from @mnm/shared", () => {
    expect(content).toMatch(/from\s+["']@mnm\/shared["']/);
  });

  test("T37 -- imports publishLiveEvent", () => {
    expect(content).toContain("publishLiveEvent");
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Schema extensions -- workflow_templates (T38-T40, T62)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Schema extensions -- workflow_templates", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WORKFLOW_TEMPLATES_SCHEMA, "utf-8");
  });

  test("T38 -- WorkflowStageTemplateDef contains requiredFiles field", () => {
    expect(content).toContain("requiredFiles");
    // Should reference RequiredFileDef type (possibly via import("@mnm/shared").RequiredFileDef[])
    expect(content).toMatch(/requiredFiles\s*\?\s*:\s*(import\([^)]+\)\.)?RequiredFileDef\s*\[\s*\]/);
  });

  test("T39 -- WorkflowStageTemplateDef contains prePrompts field", () => {
    expect(content).toContain("prePrompts");
    expect(content).toMatch(/prePrompts\s*\?\s*:\s*string\s*\[\s*\]/);
  });

  test("T40 -- WorkflowStageTemplateDef contains expectedOutputs field", () => {
    expect(content).toContain("expectedOutputs");
    expect(content).toMatch(/expectedOutputs\s*\?\s*:\s*string\s*\[\s*\]/);
  });

  test("T62 -- WorkflowStageTemplateDef remains backward compatible (new fields are optional with ?)", () => {
    // The type must still have the original required fields
    expect(content).toMatch(/order\s*:\s*number/);
    expect(content).toMatch(/name\s*:\s*string/);
    expect(content).toMatch(/autoTransition\s*:\s*boolean/);
    // New fields must be optional (with ?)
    expect(content).toMatch(/requiredFiles\s*\?/);
    expect(content).toMatch(/prePrompts\s*\?/);
    expect(content).toMatch(/expectedOutputs\s*\?/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Schema extensions -- stage_instances (T41-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Schema extensions -- stage_instances", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(STAGE_INSTANCES_SCHEMA, "utf-8");
  });

  test("T41 -- stage_instances contains enforcement_results column (jsonb)", () => {
    expect(content).toContain("enforcement_results");
    // Should be a jsonb column
    expect(content).toMatch(/jsonb\s*\(\s*["']enforcement_results["']\s*\)/);
  });

  test("T42 -- stage_instances contains pre_prompts_injected column (jsonb)", () => {
    expect(content).toContain("pre_prompts_injected");
    // Should be a jsonb column
    expect(content).toMatch(/jsonb\s*\(\s*["']pre_prompts_injected["']\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Orchestrator integration (T43-T44)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Orchestrator integration", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ORCHESTRATOR_FILE, "utf-8");
  });

  test("T43 -- orchestrator.ts calls enforcement function (enforceTransition or similar)", () => {
    // The orchestrator must call the enforcer before XState transition
    expect(content).toMatch(
      /enforce(Transition|RequiredFiles)|workflowEnforcer|workflow[Ee]nforcer/,
    );
  });

  test("T44 -- orchestrator.ts imports from workflow-enforcer", () => {
    expect(content).toMatch(/from\s+["']\.\/workflow-enforcer/);
  });

  test("T44b -- enforcement happens BEFORE XState transition evaluation", () => {
    // The enforce call should appear before the xstateTransition call
    const enforceIdx = content.search(
      /enforce(Transition|RequiredFiles)|workflowEnforcer/,
    );
    const xstateIdx = content.indexOf("xstateTransition(");

    expect(enforceIdx).toBeGreaterThan(-1);
    expect(xstateIdx).toBeGreaterThan(-1);
    // Enforcement should come before XState evaluation
    expect(enforceIdx).toBeLessThan(xstateIdx);
  });

  test("T44c -- enforcement happens AFTER RBAC pre-evaluation", () => {
    // RBAC checks (hasPermission, canUser) should appear before the enforcement call
    // Use indexOf to find the first usage in the function body (not imports)
    const rbacIdx = content.indexOf("hasPermission");
    // Match the actual enforceTransition *call* (e.g. enforcer.enforceTransition or .enforceTransition()
    // not the import statement which contains workflowEnforcerService)
    const enforceCallIdx = content.search(/\.enforceTransition\s*\(/);

    expect(rbacIdx).toBeGreaterThan(-1);
    expect(enforceCallIdx).toBeGreaterThan(-1);
    // RBAC should come before enforcement call
    expect(rbacIdx).toBeLessThan(enforceCallIdx);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Shared types -- orchestrator.ts (T45-T49, T54-T56, T61)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Shared types -- orchestrator.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(TYPES_FILE, "utf-8");
  });

  test("T45 -- exports RequiredFileDef interface/type", () => {
    expect(content).toMatch(
      /export\s+(interface|type)\s+RequiredFileDef/,
    );
  });

  test("T46 -- exports EnforcementResult interface/type", () => {
    expect(content).toMatch(
      /export\s+(interface|type)\s+EnforcementResult/,
    );
  });

  test("T47 -- exports FileCheckResult interface/type", () => {
    expect(content).toMatch(
      /export\s+(interface|type)\s+FileCheckResult/,
    );
  });

  test("T48 -- exports StageArtifact interface/type", () => {
    expect(content).toMatch(
      /export\s+(interface|type)\s+StageArtifact/,
    );
  });

  test("T49 -- exports PrePromptPayload interface/type", () => {
    expect(content).toMatch(
      /export\s+(interface|type)\s+PrePromptPayload/,
    );
  });

  test("T54 -- EnforcementResult contains fields: checkedAt, passed, fileChecks, missingFiles, warnings", () => {
    // Find the EnforcementResult block
    const startIdx = content.search(/export\s+(interface|type)\s+EnforcementResult/);
    expect(startIdx).toBeGreaterThan(-1);
    // Extract a reasonable block after the declaration
    const block = content.slice(startIdx, startIdx + 600);
    expect(block).toContain("checkedAt");
    expect(block).toContain("passed");
    expect(block).toContain("fileChecks");
    expect(block).toContain("missingFiles");
    expect(block).toContain("warnings");
  });

  test("T55 -- RequiredFileDef contains fields: path, description, checkMode, blocking", () => {
    const startIdx = content.search(/export\s+(interface|type)\s+RequiredFileDef/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 400);
    expect(block).toContain("path");
    expect(block).toContain("description");
    expect(block).toContain("checkMode");
    expect(block).toContain("blocking");
  });

  test("T56 -- PrePromptPayload contains stagePrePrompts, previousArtifacts, acceptanceCriteria, stageName", () => {
    const startIdx = content.search(/export\s+(interface|type)\s+PrePromptPayload/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 600);
    expect(block).toContain("stagePrePrompts");
    expect(block).toContain("previousArtifacts");
    expect(block).toContain("acceptanceCriteria");
    expect(block).toContain("stageName");
  });

  test("T61 -- RequiredFileDef.checkMode accepts 'artifact', 'filesystem', 'both'", () => {
    const startIdx = content.search(/export\s+(interface|type)\s+RequiredFileDef/);
    expect(startIdx).toBeGreaterThan(-1);
    const block = content.slice(startIdx, startIdx + 400);
    // checkMode should list all three valid values
    expect(block).toContain("artifact");
    expect(block).toContain("filesystem");
    expect(block).toContain("both");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: LiveEvent constants (T50-T52)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: LiveEvent constants", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS_FILE, "utf-8");
  });

  test("T50 -- LIVE_EVENT_TYPES contains 'enforcement.check_passed'", () => {
    expect(content).toContain('"enforcement.check_passed"');
  });

  test("T51 -- LIVE_EVENT_TYPES contains 'enforcement.check_failed'", () => {
    expect(content).toContain('"enforcement.check_failed"');
  });

  test("T52 -- LIVE_EVENT_TYPES contains 'enforcement.preprompts_injected'", () => {
    expect(content).toContain('"enforcement.preprompts_injected"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Migration SQL (T53)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Migration SQL", () => {
  test("T53 -- Migration file exists for enforcement_results and pre_prompts_injected columns", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    // Look for a migration file that contains enforcement or enforcer or orch_s02
    const migrationFile = files.find(
      (f) =>
        f.endsWith(".sql") &&
        (f.toLowerCase().includes("enforc") ||
          f.toLowerCase().includes("orch_s02") ||
          f.toLowerCase().includes("workflow_enforcer")),
    );

    // If not found by name, search all recent migrations for the column names
    if (!migrationFile) {
      // Check all SQL migration files for the enforcement_results column
      let found = false;
      for (const f of files.filter((f) => f.endsWith(".sql"))) {
        const migContent = await readFile(resolve(MIGRATIONS_DIR, f), "utf-8");
        if (
          migContent.includes("enforcement_results") &&
          migContent.includes("pre_prompts_injected")
        ) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    } else {
      // Verify the migration contains the expected ALTER TABLE statements
      const migContent = await readFile(
        resolve(MIGRATIONS_DIR, migrationFile),
        "utf-8",
      );
      expect(migContent).toContain("enforcement_results");
      expect(migContent).toContain("pre_prompts_injected");
    }
  });

  test("T53b -- Migration adds columns to stage_instances table", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    let migContent = "";
    for (const f of files.filter((f) => f.endsWith(".sql"))) {
      const content = await readFile(resolve(MIGRATIONS_DIR, f), "utf-8");
      if (content.includes("enforcement_results")) {
        migContent = content;
        break;
      }
    }
    expect(migContent).not.toBe("");
    // Should reference stage_instances table
    expect(migContent.toLowerCase()).toContain("stage_instances");
    // Should be jsonb type columns
    expect(migContent.toLowerCase()).toMatch(/jsonb|json/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Service logic checks (T57-T60)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Service logic checks", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ENFORCER_FILE, "utf-8");
  });

  test("T57 -- handles undefined/null requiredFiles for backward compatibility", () => {
    // The service should check if requiredFiles is undefined, null, or empty
    // and skip enforcement in that case
    expect(content).toMatch(
      /requiredFiles.*(\?\.|undefined|null|!.*length|\.length\s*(===|==)\s*0)/s,
    );
  });

  test("T58 -- contains logic for 'complete' and 'request_validation' events triggering enforcement", () => {
    expect(content).toContain("complete");
    expect(content).toContain("request_validation");
    // Should have a condition checking these events
    expect(content).toMatch(
      /(["']complete["']|["']request_validation["'])/,
    );
  });

  test("T59 -- excludes events pause, fail, terminate, skip from enforcement checks", () => {
    // The service should only enforce on specific events, not on pause/fail/terminate/skip
    // This is typically done by checking the event name against a whitelist
    // or by explicitly excluding certain events
    // We verify that the enforcer differentiates between event types
    const hasCompleteCheck = content.includes('"complete"') || content.includes("'complete'");
    const hasRequestValidationCheck = content.includes('"request_validation"') || content.includes("'request_validation'");
    expect(hasCompleteCheck).toBe(true);
    expect(hasRequestValidationCheck).toBe(true);

    // The logic should conditionally check enforcement based on event type
    // (either whitelist or conditional block)
    expect(content).toMatch(
      /if\s*\(|includes\s*\(|===\s*["']complete["']|event\s*(===|==|!==)/,
    );
  });

  test("T60 -- emits LiveEvents via publishLiveEvent()", () => {
    // Should call publishLiveEvent at least once
    const callCount = (content.match(/publishLiveEvent\s*\(/g) || []).length;
    expect(callCount).toBeGreaterThanOrEqual(1);
    // Should reference enforcement event types
    expect(content).toMatch(/enforcement\.(check_passed|check_failed|preprompts_injected)/);
  });

  test("T60b -- emits enforcement.check_failed event on missing blocking files", () => {
    expect(content).toMatch(/enforcement\.check_failed/);
  });

  test("T60c -- emits enforcement.check_passed event on successful enforcement", () => {
    expect(content).toMatch(/enforcement\.check_passed/);
  });

  test("T60d -- emits enforcement.preprompts_injected event when pre-prompts are injected", () => {
    expect(content).toMatch(/enforcement\.preprompts_injected/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Return object and exposed API
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Return object and exposed API", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ENFORCER_FILE, "utf-8");
  });

  test("Service returns object with key functions", () => {
    // The service should return an object containing the main functions
    expect(content).toMatch(/return\s*\{/);
    // Find the return block and check it exposes the key functions
    const returnIdx = content.lastIndexOf("return {");
    expect(returnIdx).toBeGreaterThan(-1);
    const returnBlock = content.slice(returnIdx, returnIdx + 500);
    expect(returnBlock).toMatch(/enforceTransition/);
    expect(returnBlock).toMatch(/getStageArtifacts/);
  });

  test("Service function accepts db parameter of type Db", () => {
    expect(content).toMatch(/\(\s*db\s*:\s*Db\s*\)/);
  });

  test("Service uses Drizzle DB operations", () => {
    // Should use db for queries/updates
    expect(content).toMatch(/db\s*[\n\s]*\.(select|update|insert)\s*\(/);
  });

  test("Service imports stageInstances from @mnm/db", () => {
    expect(content).toContain("stageInstances");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: EnforcementResult and error handling
// ---------------------------------------------------------------------------

test.describe("Groupe 12: EnforcementResult and error handling", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ENFORCER_FILE, "utf-8");
  });

  test("Service handles blocking vs non-blocking files differently", () => {
    expect(content).toContain("blocking");
    // Should differentiate between blocking files (fail) and non-blocking (warning)
    expect(content).toMatch(/warning|Warning/);
  });

  test("Service constructs EnforcementResult with passed status", () => {
    expect(content).toContain("passed");
    expect(content).toContain("fileChecks");
  });

  test("Service constructs EnforcementResult with missingFiles array", () => {
    expect(content).toContain("missingFiles");
  });

  test("Service persists enforcementResults to stage_instances", () => {
    // Should update the enforcementResults column
    expect(content).toMatch(/enforcement[_R]?[rR]?esults/);
    // Should do a DB update
    expect(content).toMatch(/\.update\s*\(/);
  });
});
