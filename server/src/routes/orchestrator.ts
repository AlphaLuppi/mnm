import { Router } from "express";
import type { Db } from "@mnm/db";
import {
  orchestratorTransitionSchema,
  orchestratorApproveSchema,
  orchestratorRejectSchema,
  orchestratorCheckEnforcementSchema,
  orchestratorWorkflowFilterSchema,
  orchestratorStageFilterSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { orchestratorService } from "../services/orchestrator.js";
import { workflowEnforcerService } from "../services/workflow-enforcer.js";
import { logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound } from "../errors.js";

export function orchestratorRoutes(db: Db) {
  const router = Router();
  const orchestrator = orchestratorService(db);
  const enforcer = workflowEnforcerService(db);

  // ──────────────────────────────────────────────────────────
  // Stage Lifecycle
  // ──────────────────────────────────────────────────────────

  // POST /companies/:companyId/orchestrator/stages/:stageId/transition
  router.post(
    "/companies/:companyId/orchestrator/stages/:stageId/transition",
    requirePermission(db, "workflows:enforce"),
    validate(orchestratorTransitionSchema),
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const result = await orchestrator.transitionStage(
        stageId as string,
        req.body.event,
        {
          actorId: actor.actorId,
          actorType: actor.actorType,
          companyId: companyId as string,
          userId: actor.actorType === "user" ? actor.actorId : null,
        },
        {
          outputArtifacts: req.body.outputArtifacts,
          error: req.body.error,
          feedback: req.body.feedback,
          metadata: req.body.metadata,
        },
      );

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "orchestrator.stage_transitioned",
        entityType: "stage",
        entityId: stageId as string,
        details: {
          event: req.body.event,
          fromState: result.fromState,
          toState: result.toState,
        },
      });

      res.json(result);
    },
  );

  // GET /companies/:companyId/orchestrator/stages/:stageId
  router.get(
    "/companies/:companyId/orchestrator/stages/:stageId",
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const stage = await orchestrator.getStageWithState(stageId as string);
      // Verify stage belongs to the company
      if (stage.companyId !== companyId) {
        throw notFound("Stage not found");
      }

      res.json(stage);
    },
  );

  // GET /companies/:companyId/orchestrator/stages/:stageId/context
  router.get(
    "/companies/:companyId/orchestrator/stages/:stageId/context",
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);

      // Verify stage exists and belongs to company
      const stage = await orchestrator.getStageWithState(stageId as string);
      if (stage.companyId !== companyId) {
        throw notFound("Stage not found");
      }

      const context = await enforcer.buildStageContext(stageId as string);
      res.json(context);
    },
  );

  // GET /companies/:companyId/orchestrator/stages/:stageId/artifacts
  router.get(
    "/companies/:companyId/orchestrator/stages/:stageId/artifacts",
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);

      // Verify stage exists and belongs to company
      const stage = await orchestrator.getStageWithState(stageId as string);
      if (stage.companyId !== companyId) {
        throw notFound("Stage not found");
      }

      const artifacts = await enforcer.getStageArtifacts(stage.workflowInstanceId);
      res.json(artifacts);
    },
  );

  // GET /companies/:companyId/orchestrator/stages/:stageId/history
  router.get(
    "/companies/:companyId/orchestrator/stages/:stageId/history",
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const stage = await orchestrator.getStageWithState(stageId as string);
      if (stage.companyId !== companyId) {
        throw notFound("Stage not found");
      }

      res.json(stage.transitionHistory);
    },
  );

  // ──────────────────────────────────────────────────────────
  // Workflow State
  // ──────────────────────────────────────────────────────────

  // GET /companies/:companyId/orchestrator/workflows/:workflowId
  router.get(
    "/companies/:companyId/orchestrator/workflows/:workflowId",
    async (req, res) => {
      const { companyId, workflowId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const workflow = await orchestrator.getWorkflowWithState(workflowId as string);
      if (workflow.companyId !== companyId) {
        throw notFound("Workflow not found");
      }

      res.json(workflow);
    },
  );

  // GET /companies/:companyId/orchestrator/workflows
  router.get(
    "/companies/:companyId/orchestrator/workflows",
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const filters = orchestratorWorkflowFilterSchema.parse(req.query);
      const workflows = await orchestrator.listWorkflowsByState(
        companyId as string,
        filters.workflowState,
      );

      res.json(workflows);
    },
  );

  // GET /companies/:companyId/orchestrator/workflows/:workflowId/stages
  router.get(
    "/companies/:companyId/orchestrator/workflows/:workflowId/stages",
    async (req, res) => {
      const { companyId, workflowId } = req.params;
      assertCompanyAccess(req, companyId as string);

      // Verify workflow belongs to the company
      const workflow = await orchestrator.getWorkflowWithState(workflowId as string);
      if (workflow.companyId !== companyId) {
        throw notFound("Workflow not found");
      }

      const filters = orchestratorStageFilterSchema.parse(req.query);
      const stages = await orchestrator.listStagesByState(
        workflowId as string,
        filters.machineState,
      );

      res.json(stages);
    },
  );

  // ──────────────────────────────────────────────────────────
  // HITL (Human-In-The-Loop)
  // ──────────────────────────────────────────────────────────

  // GET /companies/:companyId/orchestrator/validations/pending
  router.get(
    "/companies/:companyId/orchestrator/validations/pending",
    requirePermission(db, "workflows:enforce"),
    async (req, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const pending = await orchestrator.listPendingValidations(companyId as string);
      res.json(pending);
    },
  );

  // POST /companies/:companyId/orchestrator/stages/:stageId/approve
  router.post(
    "/companies/:companyId/orchestrator/stages/:stageId/approve",
    requirePermission(db, "workflows:enforce"),
    validate(orchestratorApproveSchema),
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const result = await orchestrator.transitionStage(
        stageId as string,
        "approve",
        {
          actorId: actor.actorId,
          actorType: actor.actorType,
          companyId: companyId as string,
          userId: actor.actorType === "user" ? actor.actorId : null,
        },
        {
          metadata: { comment: req.body.comment },
        },
      );

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "orchestrator.stage_approved",
        entityType: "stage",
        entityId: stageId as string,
        details: {
          fromState: result.fromState,
          toState: result.toState,
          comment: req.body.comment,
        },
      });

      res.json(result);
    },
  );

  // POST /companies/:companyId/orchestrator/stages/:stageId/reject
  router.post(
    "/companies/:companyId/orchestrator/stages/:stageId/reject",
    requirePermission(db, "workflows:enforce"),
    validate(orchestratorRejectSchema),
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      const result = await orchestrator.transitionStage(
        stageId as string,
        "reject_with_feedback",
        {
          actorId: actor.actorId,
          actorType: actor.actorType,
          companyId: companyId as string,
          userId: actor.actorType === "user" ? actor.actorId : null,
        },
        {
          feedback: req.body.feedback,
        },
      );

      await logActivity(db, {
        companyId: companyId as string,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "orchestrator.stage_rejected",
        entityType: "stage",
        entityId: stageId as string,
        details: {
          fromState: result.fromState,
          toState: result.toState,
          feedback: req.body.feedback,
        },
      });

      res.json(result);
    },
  );

  // GET /companies/:companyId/orchestrator/stages/:stageId/validation-history
  router.get(
    "/companies/:companyId/orchestrator/stages/:stageId/validation-history",
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);

      // Verify stage exists and belongs to company
      const stage = await orchestrator.getStageWithState(stageId as string);
      if (stage.companyId !== companyId) {
        throw notFound("Stage not found");
      }

      const history = await orchestrator.getValidationHistory(stageId as string);
      res.json(history);
    },
  );

  // ──────────────────────────────────────────────────────────
  // Enforcement
  // ──────────────────────────────────────────────────────────

  // POST /companies/:companyId/orchestrator/stages/:stageId/check-enforcement
  router.post(
    "/companies/:companyId/orchestrator/stages/:stageId/check-enforcement",
    requirePermission(db, "workflows:enforce"),
    validate(orchestratorCheckEnforcementSchema),
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);
      const actor = getActorInfo(req);

      // Dry-run: call enforceTransition with "complete" event but don't transition
      const enforcementResult = await enforcer.enforceTransition(
        stageId as string,
        "complete",
        {
          actorId: actor.actorId,
          actorType: actor.actorType,
          companyId: companyId as string,
        },
        {
          outputArtifacts: req.body.outputArtifacts,
          metadata: req.body.workspacePath
            ? { workspacePath: req.body.workspacePath }
            : undefined,
        },
      );

      res.json(enforcementResult);
    },
  );

  // GET /companies/:companyId/orchestrator/stages/:stageId/enforcement-results
  router.get(
    "/companies/:companyId/orchestrator/stages/:stageId/enforcement-results",
    async (req, res) => {
      const { companyId, stageId } = req.params;
      assertCompanyAccess(req, companyId as string);

      const stage = await orchestrator.getStageWithState(stageId as string);
      if (stage.companyId !== companyId) {
        throw notFound("Stage not found");
      }

      // enforcementResults is a DB column included in the stage object via getStageWithState spread
      res.json(
        (stage as typeof stage & { enforcementResults?: unknown }).enforcementResults ?? null,
      );
    },
  );

  return router;
}
