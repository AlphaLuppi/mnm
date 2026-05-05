/**
 * Unit tests for the workflow-triggers service.
 *
 * Scope: pure functions + dispatch security guards. CRUD and the public
 * fire happy path are covered by the runtime suite (worker DB), not
 * here — this file stays unit-level so it runs in <1s and gates against
 * obvious regressions in the validation layer.
 */
import { describe, it, expect, vi } from "vitest";
import {
  parseWorkflowDefRef,
  workflowTriggersService,
} from "../workflow-triggers.js";

// ── parseWorkflowDefRef ────────────────────────────────────────────────────

describe("workflow-triggers / parseWorkflowDefRef", () => {
  it("parses 'workflows/<name>@<tag>' as canonical form", () => {
    expect(parseWorkflowDefRef("workflows/release-engineering@v3")).toEqual({
      name: "release-engineering",
      gitTag: "v3",
    });
  });

  it("parses 'workflows/<name>' without a tag", () => {
    expect(parseWorkflowDefRef("workflows/qa-validation")).toEqual({
      name: "qa-validation",
    });
  });

  it("falls back to a plain name with no prefix", () => {
    expect(parseWorkflowDefRef("just-a-name")).toEqual({ name: "just-a-name" });
  });

  it("preserves slashes in the tag (git refs may include slashes)", () => {
    expect(parseWorkflowDefRef("workflows/foo@release/2026.05")).toEqual({
      name: "foo",
      gitTag: "release/2026.05",
    });
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal stub Db that captures every call. We don't exercise
 * Drizzle here — the validation paths under test never reach a real
 * query (they short-circuit before db.insert / db.select).
 */
function stubDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: vi.fn(async () => null),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(async () => []),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  } as unknown as Parameters<typeof workflowTriggersService>[0];
}

function stubGoverned() {
  return {
    launchWorkflow: vi.fn(),
    launchStep: vi.fn(),
    completeStep: vi.fn(),
  } as unknown as Parameters<typeof workflowTriggersService>[1] extends infer P
    ? P extends { governed?: infer G }
      ? G
      : never
    : never;
}

// ── assertCreateInput coverage via svc.create() validation ─────────────────

describe("workflow-triggers / create input validation", () => {
  it("rejects an empty workflowDefRef", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create("c1", { workflowDefRef: "", kind: "schedule", action: "launch_run" }, "u1"),
    ).rejects.toThrow(/workflowDefRef is required/);
  });

  it("rejects an unknown kind", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create(
        "c1",
        // @ts-expect-error — testing runtime guard, not type-level
        { workflowDefRef: "workflows/x", kind: "carrier-pigeon", action: "launch_run" },
        "u1",
      ),
    ).rejects.toThrow(/Invalid trigger kind/);
  });

  it("rejects launch_step trigger with no stepKey", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create(
        "c1",
        { workflowDefRef: "workflows/x", kind: "webhook", action: "launch_step", signingMode: "bearer" },
        "u1",
      ),
    ).rejects.toThrow(/stepKey is required/);
  });

  it("rejects complete_step trigger with empty allowedStepKeys", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create(
        "c1",
        {
          workflowDefRef: "workflows/x",
          kind: "webhook",
          action: "complete_step",
          stepKey: "qa-validation",
          allowedStepKeys: [],
          signingMode: "bearer",
        },
        "u1",
      ),
    ).rejects.toThrow(/allowedStepKeys whitelist must list/);
  });

  it("rejects complete_step trigger when stepKey is not in allowedStepKeys", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create(
        "c1",
        {
          workflowDefRef: "workflows/x",
          kind: "webhook",
          action: "complete_step",
          stepKey: "qa-validation",
          allowedStepKeys: ["other-step"],
          signingMode: "bearer",
        },
        "u1",
      ),
    ).rejects.toThrow(/stepKey must be present in allowedStepKeys/);
  });

  it("rejects schedule trigger with no cronExpression", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create(
        "c1",
        { workflowDefRef: "workflows/x", kind: "schedule", action: "launch_run" },
        "u1",
      ),
    ).rejects.toThrow(/cronExpression is required/);
  });

  it("rejects webhook trigger with no signingMode", async () => {
    const svc = workflowTriggersService(stubDb(), { governed: stubGoverned() });
    await expect(
      svc.create(
        "c1",
        { workflowDefRef: "workflows/x", kind: "webhook", action: "launch_run" },
        "u1",
      ),
    ).rejects.toThrow(/signingMode is required/);
  });
});

// ── requireGoverned guard ──────────────────────────────────────────────────

describe("workflow-triggers / requireGoverned guard", () => {
  it("CRUD methods work without a governed dep (config-only construction)", async () => {
    // The service's CRUD path only uses the DB. Constructing without
    // `governed` is supported for config-only callers (e.g. setup
    // wizards). list() should not throw on a fresh stub DB that
    // returns an empty array.
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(async () => []),
    } as unknown as Parameters<typeof workflowTriggersService>[0];
    const svc = workflowTriggersService(db); // no governed dep
    await expect(svc.list("c1")).resolves.toEqual([]);
  });
});
