import { and, eq, gte, lte, desc, ilike, or, sql, isNull } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { traces, traceObservations, traceLenses, traceLensResults } from "@mnm/db";
import type {
  Trace,
  TraceObservation,
  TraceObservationNode,
  TraceWithTree,
  TraceListResult,
  TraceLens,
  TraceLensResult,
  CreateTrace,
  CompleteTrace,
  CreateObservation,
  CompleteObservation,
  TraceListFilters,
  CreateTraceLens,
  UpdateTraceLens,
} from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";
import { notFound } from "../errors.js";

const MAX_JSONB_SIZE = 10 * 1024; // 10KB

function truncateJsonb(data: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!data) return null;
  const str = JSON.stringify(data);
  if (str.length <= MAX_JSONB_SIZE) return data;
  return { _truncated: true, _preview: str.slice(0, 500) + "...[truncated]" };
}

function buildObservationTree(flat: TraceObservation[]): TraceObservationNode[] {
  const map = new Map<string, TraceObservationNode>();
  const roots: TraceObservationNode[] = [];

  for (const obs of flat) {
    map.set(obs.id, { ...obs, children: [] });
  }

  for (const obs of flat) {
    const node = map.get(obs.id)!;
    if (obs.parentObservationId && map.has(obs.parentObservationId)) {
      map.get(obs.parentObservationId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function traceService(db: Db) {
  return {
    // --- Trace CRUD ---

    create: async (companyId: string, input: CreateTrace): Promise<Trace> => {
      const [row] = await db.insert(traces).values({
        companyId,
        heartbeatRunId: input.heartbeatRunId ?? null,
        workflowInstanceId: input.workflowInstanceId ?? null,
        stageInstanceId: input.stageInstanceId ?? null,
        agentId: input.agentId,
        parentTraceId: input.parentTraceId ?? null,
        name: input.name,
        status: "running",
        metadata: input.metadata ?? null,
        tags: input.tags ?? null,
      }).returning();

      const trace = row as unknown as Trace;

      publishLiveEvent({
        companyId,
        type: "trace.created",
        payload: {
          id: trace.id,
          agentId: trace.agentId,
          name: trace.name,
          status: trace.status,
        },
      });

      return trace;
    },

    getById: async (companyId: string, traceId: string): Promise<Trace> => {
      const row = await db
        .select()
        .from(traces)
        .where(and(eq(traces.companyId, companyId), eq(traces.id, traceId)))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Trace not found");
      return row as unknown as Trace;
    },

    list: async (companyId: string, filters: TraceListFilters): Promise<TraceListResult> => {
      const conditions = [eq(traces.companyId, companyId)];

      if (filters.agentId) conditions.push(eq(traces.agentId, filters.agentId));
      if (filters.status) conditions.push(eq(traces.status, filters.status));
      if (filters.workflowInstanceId) conditions.push(eq(traces.workflowInstanceId, filters.workflowInstanceId));
      if (filters.parentTraceId) {
        conditions.push(eq(traces.parentTraceId, filters.parentTraceId));
      }
      if (filters.dateFrom) conditions.push(gte(traces.startedAt, new Date(filters.dateFrom)));
      if (filters.dateTo) conditions.push(lte(traces.startedAt, new Date(filters.dateTo)));
      if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(ilike(traces.name, pattern));
      }

      // Cursor-based pagination (keyset on startedAt DESC, id)
      if (filters.cursor) {
        try {
          const [cursorDate, cursorId] = JSON.parse(Buffer.from(filters.cursor, "base64url").toString());
          conditions.push(
            or(
              sql`${traces.startedAt} < ${new Date(cursorDate as string)}`,
              and(
                sql`${traces.startedAt} = ${new Date(cursorDate as string)}`,
                sql`${traces.id} < ${cursorId}`,
              ),
            )!,
          );
        } catch {
          // Invalid cursor — ignore
        }
      }

      const limit = filters.limit ?? 20;
      const data = await db
        .select()
        .from(traces)
        .where(and(...conditions))
        .orderBy(desc(traces.startedAt), desc(traces.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (data.length > limit) {
        const last = data[limit - 1]!;
        nextCursor = Buffer.from(JSON.stringify([last.startedAt, last.id])).toString("base64url");
        data.splice(limit);
      }

      return {
        data: data as unknown as Trace[],
        nextCursor,
      };
    },

    getTree: async (companyId: string, traceId: string): Promise<TraceWithTree> => {
      const trace = await db
        .select()
        .from(traces)
        .where(and(eq(traces.companyId, companyId), eq(traces.id, traceId)))
        .then((rows) => rows[0] ?? null);
      if (!trace) throw notFound("Trace not found");

      const observations = await db
        .select()
        .from(traceObservations)
        .where(eq(traceObservations.traceId, traceId))
        .orderBy(traceObservations.startedAt);

      // Get child traces
      const childTraces = await db
        .select()
        .from(traces)
        .where(and(eq(traces.companyId, companyId), eq(traces.parentTraceId, traceId)));

      return {
        ...(trace as unknown as Trace),
        observations: buildObservationTree(observations as unknown as TraceObservation[]),
        childTraces: childTraces as unknown as Trace[],
      };
    },

    completeTrace: async (companyId: string, traceId: string, input: CompleteTrace): Promise<Trace> => {
      // Atomic aggregation — compute totals from observations
      const [row] = await db
        .update(traces)
        .set({
          status: input.status,
          completedAt: new Date(),
          totalDurationMs: sql`EXTRACT(EPOCH FROM (NOW() - ${traces.startedAt})) * 1000`,
          totalTokensIn: sql`COALESCE((SELECT SUM("input_tokens") FROM "trace_observations" WHERE "trace_id" = ${traceId}), 0)`,
          totalTokensOut: sql`COALESCE((SELECT SUM("output_tokens") FROM "trace_observations" WHERE "trace_id" = ${traceId}), 0)`,
          totalCostUsd: sql`COALESCE((SELECT SUM("cost_usd"::numeric) FROM "trace_observations" WHERE "trace_id" = ${traceId}), 0)::text`,
          updatedAt: new Date(),
        })
        .where(and(eq(traces.companyId, companyId), eq(traces.id, traceId)))
        .returning();

      if (!row) throw notFound("Trace not found");

      publishLiveEvent({
        companyId,
        type: "trace.completed",
        payload: {
          id: row.id,
          agentId: row.agentId,
          name: row.name,
          status: row.status,
          totalDurationMs: row.totalDurationMs,
          totalTokensIn: row.totalTokensIn,
          totalTokensOut: row.totalTokensOut,
          totalCostUsd: row.totalCostUsd,
        },
      });

      return row as unknown as Trace;
    },

    // --- Observation CRUD ---

    addObservation: async (
      companyId: string,
      traceId: string,
      input: CreateObservation,
    ): Promise<TraceObservation> => {
      const [row] = await db.insert(traceObservations).values({
        traceId,
        companyId,
        parentObservationId: input.parentObservationId ?? null,
        type: input.type,
        name: input.name,
        status: input.status ?? "started",
        level: input.level ?? null,
        statusMessage: input.statusMessage ?? null,
        input: truncateJsonb(input.input),
        output: truncateJsonb(input.output),
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        totalTokens: input.totalTokens ?? null,
        costUsd: input.costUsd ?? null,
        model: input.model ?? null,
        modelParameters: input.modelParameters ?? null,
        metadata: input.metadata ?? null,
      }).returning();

      const obs = row as unknown as TraceObservation;

      publishLiveEvent({
        companyId,
        type: "trace.observation_created",
        payload: {
          id: obs.id,
          traceId,
          type: obs.type,
          name: obs.name,
          status: obs.status,
        },
      });

      return obs;
    },

    addObservationsBatch: async (
      companyId: string,
      traceId: string,
      inputs: CreateObservation[],
    ): Promise<TraceObservation[]> => {
      const values = inputs.map((input) => ({
        traceId,
        companyId,
        parentObservationId: input.parentObservationId ?? null,
        type: input.type,
        name: input.name,
        status: input.status ?? "started",
        level: input.level ?? null,
        statusMessage: input.statusMessage ?? null,
        input: truncateJsonb(input.input),
        output: truncateJsonb(input.output),
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        totalTokens: input.totalTokens ?? null,
        costUsd: input.costUsd ?? null,
        model: input.model ?? null,
        modelParameters: input.modelParameters ?? null,
        metadata: input.metadata ?? null,
      }));

      const rows = await db.insert(traceObservations).values(values).returning();
      return rows as unknown as TraceObservation[];
    },

    completeObservation: async (
      companyId: string,
      traceId: string,
      obsId: string,
      input: CompleteObservation,
    ): Promise<TraceObservation> => {
      const [row] = await db
        .update(traceObservations)
        .set({
          status: input.status,
          completedAt: new Date(),
          durationMs: sql`EXTRACT(EPOCH FROM (NOW() - ${traceObservations.startedAt})) * 1000`,
          statusMessage: input.statusMessage ?? undefined,
          output: input.output ? truncateJsonb(input.output) : undefined,
          inputTokens: input.inputTokens ?? undefined,
          outputTokens: input.outputTokens ?? undefined,
          totalTokens: input.totalTokens ?? undefined,
          costUsd: input.costUsd ?? undefined,
          model: input.model ?? undefined,
        })
        .where(
          and(
            eq(traceObservations.id, obsId),
            eq(traceObservations.traceId, traceId),
            eq(traceObservations.companyId, companyId),
          ),
        )
        .returning();

      if (!row) throw notFound("Observation not found");

      const obs = row as unknown as TraceObservation;

      publishLiveEvent({
        companyId,
        type: "trace.observation_completed",
        payload: {
          id: obs.id,
          traceId,
          type: obs.type,
          name: obs.name,
          status: obs.status,
          durationMs: obs.durationMs,
        },
      });

      return obs;
    },

    // --- Sub-Agent Linking (TRACE-11) ---

    getRootTrace: async (companyId: string, traceId: string): Promise<Trace> => {
      // Walk up parentTraceId chain to find root
      let currentId = traceId;
      const visited = new Set<string>();

      while (true) {
        if (visited.has(currentId)) throw notFound("Circular trace reference detected");
        visited.add(currentId);

        const row = await db
          .select()
          .from(traces)
          .where(and(eq(traces.companyId, companyId), eq(traces.id, currentId)))
          .then((rows) => rows[0] ?? null);

        if (!row) throw notFound("Trace not found");
        if (!row.parentTraceId) return row as unknown as Trace;
        currentId = row.parentTraceId;
      }
    },

    getChildTraces: async (companyId: string, traceId: string): Promise<Trace[]> => {
      const rows = await db
        .select()
        .from(traces)
        .where(and(eq(traces.companyId, companyId), eq(traces.parentTraceId, traceId)))
        .orderBy(traces.startedAt);
      return rows as unknown as Trace[];
    },

    // --- Lens CRUD (TRACE-07) ---

    createLens: async (companyId: string, userId: string, input: CreateTraceLens): Promise<TraceLens> => {
      const [row] = await db.insert(traceLenses).values({
        companyId,
        userId,
        name: input.name,
        prompt: input.prompt,
        scope: input.scope,
        isTemplate: input.isTemplate,
      }).returning();
      return row as unknown as TraceLens;
    },

    listLenses: async (companyId: string, userId: string): Promise<TraceLens[]> => {
      // Return user's lenses + all templates for this company
      const rows = await db
        .select()
        .from(traceLenses)
        .where(
          and(
            eq(traceLenses.companyId, companyId),
            or(
              eq(traceLenses.userId, userId),
              eq(traceLenses.isTemplate, true),
            ),
          ),
        )
        .orderBy(desc(traceLenses.isTemplate), traceLenses.name);
      return rows as unknown as TraceLens[];
    },

    getLens: async (companyId: string, lensId: string): Promise<TraceLens> => {
      const row = await db
        .select()
        .from(traceLenses)
        .where(and(eq(traceLenses.companyId, companyId), eq(traceLenses.id, lensId)))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Lens not found");
      return row as unknown as TraceLens;
    },

    updateLens: async (companyId: string, lensId: string, input: UpdateTraceLens): Promise<TraceLens> => {
      const [row] = await db
        .update(traceLenses)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.prompt !== undefined && { prompt: input.prompt }),
          ...(input.scope !== undefined && { scope: input.scope }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          updatedAt: new Date(),
        })
        .where(and(eq(traceLenses.companyId, companyId), eq(traceLenses.id, lensId)))
        .returning();
      if (!row) throw notFound("Lens not found");
      return row as unknown as TraceLens;
    },

    deleteLens: async (companyId: string, lensId: string): Promise<void> => {
      const [row] = await db
        .delete(traceLenses)
        .where(and(eq(traceLenses.companyId, companyId), eq(traceLenses.id, lensId)))
        .returning();
      if (!row) throw notFound("Lens not found");
    },

    // --- Lens Results ---

    getLensResult: async (
      companyId: string,
      lensId: string,
      traceId: string,
    ): Promise<TraceLensResult | null> => {
      const row = await db
        .select()
        .from(traceLensResults)
        .where(
          and(
            eq(traceLensResults.companyId, companyId),
            eq(traceLensResults.lensId, lensId),
            eq(traceLensResults.traceId, traceId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      return row as unknown as TraceLensResult | null;
    },

    saveLensResult: async (
      companyId: string,
      userId: string,
      input: {
        lensId: string;
        traceId?: string;
        workflowInstanceId?: string;
        resultMarkdown: string;
        resultStructured?: Record<string, unknown>;
        modelUsed?: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: string;
      },
    ): Promise<TraceLensResult> => {
      const [row] = await db.insert(traceLensResults).values({
        lensId: input.lensId,
        traceId: input.traceId ?? null,
        workflowInstanceId: input.workflowInstanceId ?? null,
        companyId,
        userId,
        resultMarkdown: input.resultMarkdown,
        resultStructured: input.resultStructured ?? null,
        modelUsed: input.modelUsed ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        costUsd: input.costUsd ?? null,
      }).returning();
      return row as unknown as TraceLensResult;
    },
  };
}
