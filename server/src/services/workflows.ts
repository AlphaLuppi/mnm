import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { workflowTemplates, workflowInstances, stageInstances, type WorkflowStageTemplateDef } from "@mnm/db";
import { notFound } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";

const BMAD_STAGES: WorkflowStageTemplateDef[] = [
  {
    order: 0,
    name: "Product Brief",
    description: "Define the product vision, goals, and scope",
    agentRole: "product-owner",
    autoTransition: false,
    acceptanceCriteria: ["Product brief document created", "Goals and success metrics defined"],
  },
  {
    order: 1,
    name: "PRD",
    description: "Create detailed product requirements document",
    agentRole: "product-owner",
    autoTransition: false,
    acceptanceCriteria: ["Functional requirements documented", "Non-functional requirements documented"],
  },
  {
    order: 2,
    name: "Architecture",
    description: "Design system architecture and technical approach",
    agentRole: "architect",
    autoTransition: false,
    acceptanceCriteria: ["Architecture document created", "Tech stack decisions documented", "Data model defined"],
  },
  {
    order: 3,
    name: "Stories",
    description: "Break down into implementable stories with acceptance criteria",
    agentRole: "product-owner",
    autoTransition: false,
    acceptanceCriteria: ["Stories created with acceptance criteria", "Stories linked to architecture components"],
  },
  {
    order: 4,
    name: "Development",
    description: "Implement features according to stories",
    agentRole: "developer",
    autoTransition: false,
    acceptanceCriteria: ["Code implemented", "Unit tests passing", "Code review completed"],
  },
  {
    order: 5,
    name: "Testing",
    description: "Validate implementation against acceptance criteria",
    agentRole: "qa",
    autoTransition: false,
    acceptanceCriteria: ["All acceptance criteria verified", "No critical bugs remaining"],
  },
];

type TemplateRow = typeof workflowTemplates.$inferSelect;
type InstanceRow = typeof workflowInstances.$inferSelect;
type StageRow = typeof stageInstances.$inferSelect;

type WorkflowInstanceWithStages = InstanceRow & { stages: StageRow[] };

export function workflowService(db: Db) {
  // ─── Templates ────────────────────────────────────────────────

  async function listTemplates(companyId: string): Promise<TemplateRow[]> {
    return db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.companyId, companyId))
      .orderBy(asc(workflowTemplates.createdAt));
  }

  async function getTemplate(id: string): Promise<TemplateRow> {
    const [row] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));
    if (!row) throw notFound("Workflow template not found");
    return row;
  }

  async function createTemplate(
    companyId: string,
    input: { name: string; description?: string | null; stages: WorkflowStageTemplateDef[]; isDefault?: boolean; createdFrom?: string },
  ): Promise<TemplateRow> {
    const [row] = await db
      .insert(workflowTemplates)
      .values({
        companyId,
        name: input.name,
        description: input.description ?? null,
        stages: input.stages,
        isDefault: input.isDefault ?? false,
        createdFrom: input.createdFrom ?? "custom",
      })
      .returning();
    return row!;
  }

  async function updateTemplate(
    id: string,
    input: Partial<{ name: string; description: string | null; stages: WorkflowStageTemplateDef[]; isDefault: boolean }>,
  ): Promise<TemplateRow> {
    const [row] = await db
      .update(workflowTemplates)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, id))
      .returning();
    if (!row) throw notFound("Workflow template not found");
    return row;
  }

  async function deleteTemplate(id: string): Promise<void> {
    const [row] = await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id)).returning();
    if (!row) throw notFound("Workflow template not found");
  }

  async function ensureBmadTemplate(companyId: string): Promise<TemplateRow> {
    const existing = await db
      .select()
      .from(workflowTemplates)
      .where(and(eq(workflowTemplates.companyId, companyId), eq(workflowTemplates.createdFrom, "builtin")));
    if (existing.length > 0) return existing[0]!;

    return createTemplate(companyId, {
      name: "BMAD Standard",
      description: "Product Brief → PRD → Architecture → Stories → Development → Testing",
      stages: BMAD_STAGES,
      isDefault: true,
      createdFrom: "builtin",
    });
  }

  // ─── Instances ────────────────────────────────────────────────

  async function listInstances(companyId: string, filters?: { status?: string; projectId?: string; allowedProjectIds?: string[] | null }): Promise<WorkflowInstanceWithStages[]> {
    const conditions = [eq(workflowInstances.companyId, companyId)];
    if (filters?.status) conditions.push(eq(workflowInstances.status, filters.status));

    // PROJ-S03: Scope-based project filtering
    if (filters?.allowedProjectIds !== undefined && filters.allowedProjectIds !== null) {
      if (filters.allowedProjectIds.length === 0) {
        conditions.push(sql`${workflowInstances.projectId} IS NULL`);
      } else {
        conditions.push(
          sql`(${workflowInstances.projectId} IS NULL OR ${workflowInstances.projectId} IN (${sql.join(
            filters.allowedProjectIds.map((id) => sql`${id}`),
            sql`, `,
          )}))`,
        );
      }
    }

    // Existing explicit filter
    if (filters?.projectId) conditions.push(eq(workflowInstances.projectId, filters.projectId));

    const instances = await db
      .select()
      .from(workflowInstances)
      .where(and(...conditions))
      .orderBy(desc(workflowInstances.createdAt));

    return attachStages(instances);
  }

  async function getInstance(id: string): Promise<WorkflowInstanceWithStages> {
    const [row] = await db.select().from(workflowInstances).where(eq(workflowInstances.id, id));
    if (!row) throw notFound("Workflow instance not found");
    const [result] = await attachStages([row]);
    return result!;
  }

  async function createInstance(
    companyId: string,
    input: { templateId: string; projectId?: string | null; name: string; description?: string | null },
    userId?: string,
  ): Promise<WorkflowInstanceWithStages> {
    const template = await getTemplate(input.templateId);

    const [instance] = await db
      .insert(workflowInstances)
      .values({
        companyId,
        templateId: input.templateId,
        projectId: input.projectId ?? null,
        name: input.name,
        description: input.description ?? null,
        status: "active",
        createdByUserId: userId ?? null,
        startedAt: new Date(),
      })
      .returning();

    // Create stage instances from template
    const templateStages = template.stages as WorkflowStageTemplateDef[];
    for (const stageDef of templateStages) {
      await db.insert(stageInstances).values({
        companyId,
        workflowInstanceId: instance!.id,
        stageOrder: stageDef.order,
        name: stageDef.name,
        description: stageDef.description ?? null,
        agentRole: stageDef.agentRole ?? null,
        status: stageDef.order === 0 ? "running" : "pending",
        autoTransition: stageDef.autoTransition ? "true" : "false",
        acceptanceCriteria: stageDef.acceptanceCriteria ?? null,
        startedAt: stageDef.order === 0 ? new Date() : null,
      });
    }

    publishLiveEvent({ companyId, type: "workflow.created", payload: { workflowId: instance!.id } });
    return getInstance(instance!.id);
  }

  async function updateInstance(
    id: string,
    input: Partial<{ name: string; description: string | null; status: string }>,
  ): Promise<WorkflowInstanceWithStages> {
    const patch: Record<string, unknown> = { ...input, updatedAt: new Date() };
    if (input.status === "completed") patch.completedAt = new Date();

    const [row] = await db
      .update(workflowInstances)
      .set(patch)
      .where(eq(workflowInstances.id, id))
      .returning();
    if (!row) throw notFound("Workflow instance not found");

    publishLiveEvent({ companyId: row.companyId, type: "workflow.updated", payload: { workflowId: id } });
    return getInstance(id);
  }

  async function deleteInstance(id: string): Promise<void> {
    const [row] = await db.delete(workflowInstances).where(eq(workflowInstances.id, id)).returning();
    if (!row) throw notFound("Workflow instance not found");
    publishLiveEvent({ companyId: row.companyId, type: "workflow.deleted", payload: { workflowId: id } });
  }

  // ─── Stage helpers ────────────────────────────────────────────

  async function attachStages(instances: InstanceRow[]): Promise<WorkflowInstanceWithStages[]> {
    if (instances.length === 0) return [];

    const allStages = await db
      .select()
      .from(stageInstances)
      .where(
        instances.length === 1
          ? eq(stageInstances.workflowInstanceId, instances[0]!.id)
          : undefined,
      )
      .orderBy(asc(stageInstances.stageOrder));

    const stageMap = new Map<string, StageRow[]>();
    for (const stage of allStages) {
      let arr = stageMap.get(stage.workflowInstanceId);
      if (!arr) {
        arr = [];
        stageMap.set(stage.workflowInstanceId, arr);
      }
      arr.push(stage);
    }

    return instances.map((inst) => ({
      ...inst,
      stages: stageMap.get(inst.id) ?? [],
    }));
  }

  return {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    ensureBmadTemplate,
    listInstances,
    getInstance,
    createInstance,
    updateInstance,
    deleteInstance,
  };
}
