import { z } from "zod";

/**
 * Per-step `assignment` declaration in workflow.json (T3.2). Resolved at
 * `launchRun` time by `governedWorkflowsAssignmentsService.resolveAssignment`,
 * which intersects tags, expands roles, and unions explicit principals to
 * produce the set of principal IDs persisted in `governed_step_assignments`.
 *
 * Semantics (resolveAssignment):
 *  - `tags`        : INTERSECTION (a principal must carry ALL listed tags).
 *  - `roles`       : EXPANSION (any principal whose membership_role or role_id
 *                    matches ANY listed role).
 *  - `principals`  : UNION (each id is added unconditionally).
 *
 * The three groups are then UNION-ed together and de-duplicated to form the
 * final assignment snapshot. The shape is empty-friendly: a step with no
 * assignment means "no human is on the hook" and the step still runs (this
 * is the historical default for steps before T3).
 */
export const stepAssignmentSchema = z
  .object({
    tags: z
      .array(z.string().min(1))
      .optional()
      .describe(
        "Tag slugs ou tag ids — un principal doit porter TOUS les tags listés (intersection)",
      ),
    roles: z
      .array(z.string().min(1))
      .optional()
      .describe(
        "Slugs ou ids de rôles — tout principal dont le rôle correspond est ajouté (expansion)",
      ),
    principals: z
      .array(z.string().min(1))
      .optional()
      .describe(
        "Liste explicite de principal_id (user|agent) — ajoutés sans filtre",
      ),
  })
  .strict();

export type StepAssignment = z.infer<typeof stepAssignmentSchema>;
