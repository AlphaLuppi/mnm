import { z } from "zod";

const WORKFLOW_STATUSES = ["active", "paused", "completed", "failed"] as const;
const STAGE_STATUSES = ["pending", "running", "review", "done", "failed", "skipped"] as const;
const WORKFLOW_CREATED_FROM = ["builtin", "onboarding", "custom"] as const;

export const workflowStageTemplateDefSchema = z.object({
  order: z.number().int().nonnegative(),
  name: z.string().min(1),
  description: z.string().optional(),
  agentRole: z.string().optional(),
  autoTransition: z.boolean(),
  acceptanceCriteria: z.array(z.string()).optional(),
});

export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  stages: z.array(workflowStageTemplateDefSchema).min(1),
  isDefault: z.boolean().optional().default(false),
  createdFrom: z.enum(WORKFLOW_CREATED_FROM).optional().default("custom"),
});

export type CreateWorkflowTemplate = z.infer<typeof createWorkflowTemplateSchema>;

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema.partial();

export type UpdateWorkflowTemplate = z.infer<typeof updateWorkflowTemplateSchema>;

export const createWorkflowInstanceSchema = z.object({
  templateId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
});

export type CreateWorkflowInstance = z.infer<typeof createWorkflowInstanceSchema>;

export const updateWorkflowInstanceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(WORKFLOW_STATUSES).optional(),
});

export type UpdateWorkflowInstance = z.infer<typeof updateWorkflowInstanceSchema>;

export const transitionStageSchema = z.object({
  status: z.enum(STAGE_STATUSES),
  agentId: z.string().uuid().optional().nullable(),
  outputArtifacts: z.array(z.string()).optional(),
});

export type TransitionStage = z.infer<typeof transitionStageSchema>;

export const updateStageSchema = z.object({
  agentId: z.string().uuid().optional().nullable(),
  inputArtifacts: z.array(z.string()).optional(),
  outputArtifacts: z.array(z.string()).optional(),
});

export type UpdateStage = z.infer<typeof updateStageSchema>;
