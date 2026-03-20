import { z } from "zod";
import { STAGE_EVENTS, STAGE_STATES, WORKFLOW_STATES } from "../types/orchestrator.js";

export const orchestratorTransitionSchema = z.object({
  event: z.enum(STAGE_EVENTS),
  outputArtifacts: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  feedback: z.string().optional(),
}).strict();

export type OrchestratorTransition = z.infer<typeof orchestratorTransitionSchema>;

export const orchestratorApproveSchema = z.object({
  comment: z.string().optional(),
}).strict();

export type OrchestratorApprove = z.infer<typeof orchestratorApproveSchema>;

export const orchestratorRejectSchema = z.object({
  feedback: z.string().min(1, "Feedback is required when rejecting"),
}).strict();

export type OrchestratorReject = z.infer<typeof orchestratorRejectSchema>;

export const orchestratorCheckEnforcementSchema = z.object({
  outputArtifacts: z.array(z.string()).optional(),
  workspacePath: z.string().optional(),
}).strict();

export type OrchestratorCheckEnforcement = z.infer<typeof orchestratorCheckEnforcementSchema>;

export const orchestratorWorkflowFilterSchema = z.object({
  workflowState: z.enum(WORKFLOW_STATES).optional(),
}).strict();

export type OrchestratorWorkflowFilter = z.infer<typeof orchestratorWorkflowFilterSchema>;

export const orchestratorStageFilterSchema = z.object({
  machineState: z.enum(STAGE_STATES).optional(),
}).strict();

export type OrchestratorStageFilter = z.infer<typeof orchestratorStageFilterSchema>;
