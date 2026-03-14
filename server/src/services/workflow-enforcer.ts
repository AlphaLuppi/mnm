import fs from "node:fs/promises";
import path from "node:path";
import type { Db } from "@mnm/db";
import {
  stageInstances,
  workflowInstances,
  workflowTemplates,
  type WorkflowStageTemplateDef,
} from "@mnm/db";
import { eq, asc } from "drizzle-orm";
import { publishLiveEvent } from "./live-events.js";
import { conflict } from "../errors.js";
import type {
  StageEvent,
  RequiredFileDef,
  EnforcementResult,
  FileCheckResult,
  StageArtifact,
  PrePromptPayload,
  LiveEventType,
} from "@mnm/shared";

/** Events that trigger required-files enforcement */
const ENFORCEMENT_EVENTS: StageEvent[] = ["complete", "request_validation"];

/** Events that trigger pre-prompt injection */
const PREPROMPT_EVENTS: StageEvent[] = ["start", "initialize"];

export function workflowEnforcerService(db: Db) {
  /**
   * Enforce transition rules before XState evaluation.
   * - For "complete"/"request_validation": validate required files
   * - For "start"/"initialize": inject pre-prompts
   *
   * Returns enforcement metadata to persist alongside the transition.
   */
  async function enforceTransition(
    stageId: string,
    event: StageEvent,
    actor: {
      actorId: string | null;
      actorType: "user" | "agent" | "system";
      companyId: string;
    },
    payload?: {
      outputArtifacts?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<{
    allowed: boolean;
    enforcementResult?: EnforcementResult;
    prePromptPayload?: PrePromptPayload;
    missingFiles?: string[];
    warnings?: string[];
    message?: string;
  }> {
    // Load the stage
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) return { allowed: true };

    // Load the workflow instance to get the template
    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, stage.workflowInstanceId));
    if (!workflow) return { allowed: true };

    // Load the template to get stage definitions
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, workflow.templateId));
    if (!template) return { allowed: true };

    const templateStages = template.stages as WorkflowStageTemplateDef[];
    const templateDef = templateStages.find((s) => s.order === stage.stageOrder);
    if (!templateDef) return { allowed: true };

    // --- Enforcement for outgoing transitions (complete/request_validation) ---
    if (ENFORCEMENT_EVENTS.includes(event)) {
      const requiredFiles = templateDef.requiredFiles;

      // No requiredFiles defined — skip enforcement (backward compat)
      if (!requiredFiles || requiredFiles.length === 0) {
        return { allowed: true };
      }

      // Merge existing outputArtifacts with payload
      const existingArtifacts = (stage.outputArtifacts as string[]) ?? [];
      const newArtifacts = payload?.outputArtifacts ?? [];
      const allArtifacts = [...new Set([...existingArtifacts, ...newArtifacts])];

      // Get project workspace path for filesystem checks
      const workspacePath = payload?.metadata?.workspacePath as string | undefined;

      const result = await validateRequiredFiles(
        requiredFiles,
        allArtifacts,
        workspacePath,
      );

      const enforcementResult: EnforcementResult = {
        checkedAt: new Date().toISOString(),
        passed: result.passed,
        fileChecks: result.fileChecks,
        missingFiles: result.missingFiles,
        warnings: result.warnings,
        triggeredBy: {
          actorId: actor.actorId,
          actorType: actor.actorType,
        },
      };

      // Persist enforcement results
      await db
        .update(stageInstances)
        .set({
          enforcementResults: enforcementResult,
          updatedAt: new Date(),
        })
        .where(eq(stageInstances.id, stageId));

      if (!result.passed) {
        // Emit enforcement.check_failed
        publishLiveEvent({
          companyId: actor.companyId,
          type: "enforcement.check_failed" as LiveEventType,
          payload: {
            workflowInstanceId: stage.workflowInstanceId,
            stageId: stage.id,
            missingFiles: result.missingFiles,
            warnings: result.warnings,
          },
        });

        return {
          allowed: false,
          enforcementResult,
          missingFiles: result.missingFiles,
          warnings: result.warnings,
          message: `Required files missing: ${result.missingFiles.join(", ")}`,
        };
      }

      // Emit enforcement.check_passed
      publishLiveEvent({
        companyId: actor.companyId,
        type: "enforcement.check_passed" as LiveEventType,
        payload: {
          workflowInstanceId: stage.workflowInstanceId,
          stageId: stage.id,
          fileChecks: result.fileChecks,
          warnings: result.warnings,
        },
      });

      return {
        allowed: true,
        enforcementResult,
        warnings: result.warnings,
      };
    }

    // --- Pre-prompt injection for incoming transitions (start/initialize) ---
    if (PREPROMPT_EVENTS.includes(event)) {
      const prePromptPayload = await injectPrePrompts(
        stage,
        templateDef,
        stage.workflowInstanceId,
        workflow.name,
        templateStages.length,
      );

      if (prePromptPayload) {
        // Persist pre-prompts injected
        await db
          .update(stageInstances)
          .set({
            prePromptsInjected: prePromptPayload,
            updatedAt: new Date(),
          })
          .where(eq(stageInstances.id, stageId));

        // Emit enforcement.preprompts_injected
        publishLiveEvent({
          companyId: actor.companyId,
          type: "enforcement.preprompts_injected" as LiveEventType,
          payload: {
            workflowInstanceId: stage.workflowInstanceId,
            stageId: stage.id,
            stageName: templateDef.name,
            prePromptsCount: prePromptPayload.stagePrePrompts.length,
            previousArtifactsCount: prePromptPayload.previousArtifacts.length,
          },
        });
      }

      return {
        allowed: true,
        prePromptPayload: prePromptPayload ?? undefined,
      };
    }

    // All other events (pause, fail, terminate, skip, etc.) — no enforcement
    return { allowed: true };
  }

  /**
   * Validate that all required files exist.
   * Checks against outputArtifacts array and/or filesystem.
   */
  async function validateRequiredFiles(
    requiredFiles: RequiredFileDef[],
    outputArtifacts: string[],
    workspacePath?: string,
  ): Promise<{
    passed: boolean;
    fileChecks: FileCheckResult[];
    missingFiles: string[];
    warnings: string[];
  }> {
    const fileChecks: FileCheckResult[] = [];
    const missingFiles: string[] = [];
    const warnings: string[] = [];

    for (const req of requiredFiles) {
      let found = false;

      if (req.checkMode === "artifact" || req.checkMode === "both") {
        // Check if the path is present in outputArtifacts
        const artifactFound = outputArtifacts.some(
          (a) => a === req.path || a.endsWith(`/${req.path}`) || a.endsWith(`\\${req.path}`),
        );
        if (req.checkMode === "artifact") {
          found = artifactFound;
        } else {
          // "both" mode — artifact must be found AND filesystem must exist
          found = artifactFound;
        }
      }

      if (req.checkMode === "filesystem" || req.checkMode === "both") {
        const fsFound = await checkFileExists(req.path, workspacePath);
        if (req.checkMode === "filesystem") {
          found = fsFound;
        } else {
          // "both" — both must be true
          found = found && fsFound;
        }
      }

      const checkResult: FileCheckResult = {
        path: req.path,
        description: req.description,
        found,
        checkMode: req.checkMode,
        blocking: req.blocking,
      };
      fileChecks.push(checkResult);

      if (!found) {
        if (req.blocking) {
          missingFiles.push(req.path);
        } else {
          warnings.push(`Non-blocking file missing: ${req.path}`);
        }
      }
    }

    return {
      passed: missingFiles.length === 0,
      fileChecks,
      missingFiles,
      warnings,
    };
  }

  /**
   * Check if a file exists on the filesystem.
   */
  async function checkFileExists(
    filePath: string,
    workspacePath?: string,
  ): Promise<boolean> {
    if (!workspacePath) return false;
    try {
      const fullPath = path.resolve(workspacePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject pre-prompts for a stage that is being started/initialized.
   * Collects template pre-prompts + artifacts from previous completed stages.
   */
  async function injectPrePrompts(
    stage: typeof stageInstances.$inferSelect,
    templateDef: WorkflowStageTemplateDef,
    workflowInstanceId: string,
    workflowName: string,
    totalStages: number,
  ): Promise<PrePromptPayload | null> {
    const stagePrePrompts = templateDef.prePrompts ?? [];
    const acceptanceCriteria = templateDef.acceptanceCriteria ?? [];

    // Get artifacts from previous completed stages
    const previousArtifacts = await getStageArtifacts(workflowInstanceId);

    // Filter to only stages before this one
    const previousCompletedArtifacts = previousArtifacts.filter(
      (a) => a.stageOrder < stage.stageOrder,
    );

    // If no pre-prompts and no previous artifacts — nothing to inject
    if (
      stagePrePrompts.length === 0 &&
      previousCompletedArtifacts.length === 0 &&
      acceptanceCriteria.length === 0
    ) {
      return null;
    }

    return {
      stagePrePrompts,
      previousArtifacts: previousCompletedArtifacts,
      acceptanceCriteria,
      stageName: templateDef.name,
      workflowName,
      stageOrder: stage.stageOrder,
      totalStages,
    };
  }

  /**
   * Persist stage results (output artifacts + enforcement results).
   */
  async function persistStageResults(
    stageId: string,
    outputArtifacts: string[],
    enforcementResult?: EnforcementResult,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      outputArtifacts,
      updatedAt: new Date(),
    };

    if (enforcementResult) {
      patch.enforcementResults = enforcementResult;
    }

    await db
      .update(stageInstances)
      .set(patch)
      .where(eq(stageInstances.id, stageId));
  }

  /**
   * Get artifacts from all completed stages of a workflow instance.
   * Used for pre-prompt injection and compaction recovery.
   */
  async function getStageArtifacts(
    workflowInstanceId: string,
  ): Promise<StageArtifact[]> {
    const stages = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.workflowInstanceId, workflowInstanceId))
      .orderBy(asc(stageInstances.stageOrder));

    return stages
      .filter((s) => (s.machineState ?? s.status) === "completed")
      .map((s) => ({
        stageId: s.id,
        stageName: s.name,
        stageOrder: s.stageOrder,
        outputArtifacts: (s.outputArtifacts as string[]) ?? [],
        completedAt: s.completedAt?.toISOString() ?? null,
      }));
  }

  /**
   * Build the complete context for a stage start (pre-prompts + artifacts + criteria).
   * Convenience method combining injectPrePrompts with template data.
   */
  async function buildStageContext(
    stageId: string,
  ): Promise<PrePromptPayload | null> {
    const [stage] = await db
      .select()
      .from(stageInstances)
      .where(eq(stageInstances.id, stageId));
    if (!stage) return null;

    const [workflow] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, stage.workflowInstanceId));
    if (!workflow) return null;

    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, workflow.templateId));
    if (!template) return null;

    const templateStages = template.stages as WorkflowStageTemplateDef[];
    const templateDef = templateStages.find((s) => s.order === stage.stageOrder);
    if (!templateDef) return null;

    return injectPrePrompts(
      stage,
      templateDef,
      stage.workflowInstanceId,
      workflow.name,
      templateStages.length,
    );
  }

  return {
    enforceTransition,
    validateRequiredFiles,
    injectPrePrompts,
    persistStageResults,
    getStageArtifacts,
    buildStageContext,
  };
}
