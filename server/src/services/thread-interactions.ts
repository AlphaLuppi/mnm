/**
 * PAPERCLIP-PHASE2 — Inbox Interactive service.
 *
 * CRUD + accept/reject/answer for `thread_interactions`. Patterns adapted
 * from upstream paperclipai/paperclip PR #4244 (`issue_thread_interactions`).
 *
 * Multi-tenant: every method takes `companyId` and filters with it; the DB
 * also enforces tenant isolation via RLS (see migration 0074). The route
 * layer is responsible for `assertCompanyMembership` before calling here.
 *
 * Idempotency: when an agent retries a `create` with the same
 * (company, issue, idempotency_key), we detect the 23505 conflict on
 * `thread_interactions_company_issue_idempotency_uq` and return the
 * existing row instead of erroring (the request must be "equivalent" —
 * same kind / payload / actor / continuation policy).
 *
 * Live events: every state change publishes `thread_interaction.{event}`
 * via `publishLiveEvent` so SSE/WebSocket clients update without polling.
 */
import { isDeepStrictEqual } from "node:util";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import {
  THREAD_INTERACTION_IDEMPOTENCY_CONSTRAINT,
  threadInteractions,
  type NewThreadInteraction,
  type ThreadInteractionRow,
} from "@mnm/db";
import {
  acceptThreadInteractionSchema,
  askQuestionsPayloadSchema,
  askQuestionsResultSchema,
  createThreadInteractionSchema,
  rejectThreadInteractionSchema,
  requestConfirmationPayloadSchema,
  requestConfirmationResultSchema,
  respondThreadInteractionSchema,
  suggestTasksPayloadSchema,
  suggestTasksResultSchema,
  type AcceptThreadInteraction,
  type AskQuestionsAnswer,
  type CreateThreadInteraction,
  type RejectThreadInteraction,
  type RespondThreadInteraction,
  type ThreadInteraction,
} from "@mnm/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { publishLiveEvent } from "./live-events.js";

/** Author of a write operation (an agent or a user/board). */
export interface ThreadInteractionActor {
  agentId?: string | null;
  userId?: string | null;
}

/** Hydrated row → typed discriminated union. */
function hydrate(row: ThreadInteractionRow): ThreadInteraction {
  const base = {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId,
    status: row.status as ThreadInteraction["status"],
    continuationPolicy: row.continuationPolicy as ThreadInteraction["continuationPolicy"],
    idempotencyKey: row.idempotencyKey ?? null,
    sourceCommentId: row.sourceCommentId ?? null,
    sourceRunId: row.sourceRunId ?? null,
    title: row.title ?? null,
    summary: row.summary ?? null,
    createdByAgentId: row.createdByAgentId ?? null,
    createdByUserId: row.createdByUserId ?? null,
    resolvedByAgentId: row.resolvedByAgentId ?? null,
    resolvedByUserId: row.resolvedByUserId ?? null,
    resumeToken: (row.resumeToken ?? null) as Record<string, unknown> | null,
    resolvedAt: row.resolvedAt,
    acceptedAt: row.acceptedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  switch (row.kind) {
    case "suggest_tasks":
      return {
        ...base,
        kind: "suggest_tasks",
        payload: suggestTasksPayloadSchema.parse(row.payload),
        result: row.result ? suggestTasksResultSchema.parse(row.result) : null,
      };
    case "ask_questions":
      return {
        ...base,
        kind: "ask_questions",
        payload: askQuestionsPayloadSchema.parse(row.payload),
        result: row.result ? askQuestionsResultSchema.parse(row.result) : null,
      };
    case "request_confirmation":
      return {
        ...base,
        kind: "request_confirmation",
        payload: requestConfirmationPayloadSchema.parse(row.payload),
        result: row.result
          ? requestConfirmationResultSchema.parse(row.result)
          : null,
      };
    default:
      throw unprocessable(`Unknown thread interaction kind: ${row.kind}`);
  }
}

function isIdempotencyConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: string; constraint?: string; constraint_name?: string };
  const constraint = err.constraint ?? err.constraint_name;
  return err.code === "23505" && constraint === THREAD_INTERACTION_IDEMPOTENCY_CONSTRAINT;
}

function isEquivalentCreate(
  row: ThreadInteractionRow,
  input: CreateThreadInteraction,
  actor: ThreadInteractionActor,
): boolean {
  return (
    row.kind === input.kind
    && row.continuationPolicy === input.continuationPolicy
    && (row.idempotencyKey ?? null) === (input.idempotencyKey ?? null)
    && (row.sourceCommentId ?? null) === (input.sourceCommentId ?? null)
    && (row.sourceRunId ?? null) === (input.sourceRunId ?? null)
    && (row.title ?? null) === (input.title ?? null)
    && (row.summary ?? null) === (input.summary ?? null)
    && (row.createdByAgentId ?? null) === (actor.agentId ?? null)
    && (row.createdByUserId ?? null) === (actor.userId ?? null)
    && isDeepStrictEqual(row.payload, input.payload)
  );
}

function emit(
  event: "thread_interaction.created"
    | "thread_interaction.accepted"
    | "thread_interaction.rejected"
    | "thread_interaction.answered"
    | "thread_interaction.expired"
    | "thread_interaction.superseded",
  interaction: ThreadInteraction,
) {
  publishLiveEvent({
    companyId: interaction.companyId,
    type: event,
    payload: {
      interactionId: interaction.id,
      issueId: interaction.issueId,
      kind: interaction.kind,
      status: interaction.status,
    },
    visibility: { scope: "company-wide" },
  });
}

export function threadInteractionsService(db: Db) {
  /**
   * Create a new interaction. Validates the payload, enforces idempotency
   * (returns the existing row on equivalent retry, throws 409 on divergent
   * retry), and emits `thread_interaction.created`.
   */
  async function create(
    companyId: string,
    issueId: string,
    rawInput: unknown,
    actor: ThreadInteractionActor,
  ): Promise<ThreadInteraction> {
    const input = createThreadInteractionSchema.parse(rawInput);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const insertValues: NewThreadInteraction = {
      companyId,
      issueId,
      kind: input.kind,
      status: "pending",
      continuationPolicy: input.continuationPolicy,
      idempotencyKey: input.idempotencyKey ?? null,
      sourceCommentId: input.sourceCommentId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      title: input.title ?? null,
      summary: input.summary ?? null,
      createdByAgentId: actor.agentId ?? null,
      createdByUserId: actor.userId ?? null,
      payload: input.payload as Record<string, unknown>,
      resumeToken: input.resumeToken ?? null,
      expiresAt,
    };

    let row: ThreadInteractionRow;
    try {
      const [inserted] = await db.insert(threadInteractions).values(insertValues).returning();
      row = inserted;
    } catch (err) {
      if (!isIdempotencyConflict(err) || !input.idempotencyKey) {
        throw err;
      }
      // Look up existing row, return if equivalent, else 409.
      const existing = await db
        .select()
        .from(threadInteractions)
        .where(
          and(
            eq(threadInteractions.companyId, companyId),
            eq(threadInteractions.issueId, issueId),
            eq(threadInteractions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);
      if (!existing) {
        // Race lost — re-throw
        throw err;
      }
      if (!isEquivalentCreate(existing, input, actor)) {
        throw conflict(
          "Thread interaction with this idempotency key already exists with different payload",
          { existingId: existing.id },
        );
      }
      return hydrate(existing);
    }

    const interaction = hydrate(row);
    emit("thread_interaction.created", interaction);
    return interaction;
  }

  async function getById(
    companyId: string,
    interactionId: string,
  ): Promise<ThreadInteraction | null> {
    const row = await db
      .select()
      .from(threadInteractions)
      .where(
        and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.id, interactionId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    return row ? hydrate(row) : null;
  }

  async function listByIssue(
    companyId: string,
    issueId: string,
    options?: { status?: string },
  ): Promise<ThreadInteraction[]> {
    const where = options?.status
      ? and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.issueId, issueId),
          eq(threadInteractions.status, options.status),
        )
      : and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.issueId, issueId),
        );
    const rows = await db
      .select()
      .from(threadInteractions)
      .where(where)
      .orderBy(asc(threadInteractions.createdAt));
    return rows.map(hydrate);
  }

  /**
   * Accept a pending interaction. For suggest_tasks, optionally restrict
   * to a subset of clientKeys. For request_confirmation, marks accepted.
   * Returns the updated row plus, for suggest_tasks, the list of issue IDs
   * the caller should subsequently create. We deliberately do NOT create
   * the issues here — that lives in the route handler so it can use the
   * existing issueService transaction + permission checks.
   */
  async function accept(
    companyId: string,
    interactionId: string,
    rawInput: unknown,
    actor: ThreadInteractionActor,
  ): Promise<{
    interaction: ThreadInteraction;
    /** suggest_tasks only — the clientKeys the caller should create issues for. */
    selectedClientKeys?: string[];
  }> {
    const input: AcceptThreadInteraction =
      acceptThreadInteractionSchema.parse(rawInput ?? {});

    const current = await getById(companyId, interactionId);
    if (!current) throw notFound("Thread interaction not found");
    if (current.status !== "pending") {
      throw conflict(`Cannot accept — interaction is in status '${current.status}'`);
    }

    const now = new Date();
    let selectedClientKeys: string[] | undefined;
    let result: Record<string, unknown>;

    if (current.kind === "suggest_tasks") {
      const allKeys = current.payload.tasks.map((t) => t.clientKey);
      const selected = input.selectedClientKeys ?? allKeys;
      const allKeysSet = new Set(allKeys);
      const unknownKey = selected.find((k) => !allKeysSet.has(k));
      if (unknownKey) {
        throw unprocessable(`Unknown clientKey: ${unknownKey}`);
      }
      selectedClientKeys = selected;
      // The route layer will fill `createdTasks` after creating issues.
      result = {
        createdTasks: [],
        skippedClientKeys: allKeys.filter((k) => !selected.includes(k)),
      };
    } else if (current.kind === "request_confirmation") {
      result = { outcome: "accepted" };
    } else {
      throw unprocessable("ask_questions interactions cannot be 'accepted' — use respond()");
    }

    const [updated] = await db
      .update(threadInteractions)
      .set({
        status: "accepted",
        result: result as Record<string, unknown>,
        resolvedAt: now,
        acceptedAt: now,
        resolvedByAgentId: actor.agentId ?? null,
        resolvedByUserId: actor.userId ?? null,
        updatedAt: now,
      })
      .where(
        and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.id, interactionId),
        ),
      )
      .returning();
    const interaction = hydrate(updated);
    emit("thread_interaction.accepted", interaction);
    return { interaction, selectedClientKeys };
  }

  /**
   * Update the result on an accepted suggest_tasks interaction once the
   * caller has actually created the underlying issues. This is the second
   * half of the accept() transaction — split so the route layer can keep
   * issue creation in its own transactional context.
   */
  async function recordCreatedTasks(
    companyId: string,
    interactionId: string,
    createdTasks: Array<{ clientKey: string; issueId: string; identifier: string | null }>,
  ): Promise<ThreadInteraction> {
    const current = await getById(companyId, interactionId);
    if (!current) throw notFound("Thread interaction not found");
    if (current.kind !== "suggest_tasks") {
      throw unprocessable("recordCreatedTasks only valid on suggest_tasks");
    }
    const result = {
      ...(current.result ?? {}),
      createdTasks,
    };
    const [updated] = await db
      .update(threadInteractions)
      .set({
        result: result as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.id, interactionId),
        ),
      )
      .returning();
    return hydrate(updated);
  }

  async function reject(
    companyId: string,
    interactionId: string,
    rawInput: unknown,
    actor: ThreadInteractionActor,
  ): Promise<ThreadInteraction> {
    const input: RejectThreadInteraction =
      rejectThreadInteractionSchema.parse(rawInput ?? {});
    const current = await getById(companyId, interactionId);
    if (!current) throw notFound("Thread interaction not found");
    if (current.status !== "pending") {
      throw conflict(`Cannot reject — interaction is in status '${current.status}'`);
    }
    let result: Record<string, unknown>;
    if (current.kind === "request_confirmation") {
      if (current.payload.rejectRequiresReason && !input.reason) {
        throw unprocessable("This confirmation requires a reason on reject");
      }
      result = { outcome: "rejected", reason: input.reason };
    } else if (current.kind === "suggest_tasks") {
      result = {
        createdTasks: [],
        skippedClientKeys: current.payload.tasks.map((t) => t.clientKey),
        rejectedReason: input.reason,
      };
    } else {
      throw unprocessable("ask_questions interactions cannot be 'rejected' — use respond()");
    }

    const now = new Date();
    const [updated] = await db
      .update(threadInteractions)
      .set({
        status: "rejected",
        result: result as Record<string, unknown>,
        resolvedAt: now,
        resolvedByAgentId: actor.agentId ?? null,
        resolvedByUserId: actor.userId ?? null,
        updatedAt: now,
      })
      .where(
        and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.id, interactionId),
        ),
      )
      .returning();
    const interaction = hydrate(updated);
    emit("thread_interaction.rejected", interaction);
    return interaction;
  }

  async function respond(
    companyId: string,
    interactionId: string,
    rawInput: unknown,
    actor: ThreadInteractionActor,
  ): Promise<ThreadInteraction> {
    const input: RespondThreadInteraction =
      respondThreadInteractionSchema.parse(rawInput ?? {});
    const current = await getById(companyId, interactionId);
    if (!current) throw notFound("Thread interaction not found");
    if (current.kind !== "ask_questions") {
      throw unprocessable("respond() is only valid on ask_questions interactions");
    }
    if (current.status !== "pending") {
      throw conflict(`Cannot respond — interaction is in status '${current.status}'`);
    }
    const answers: AskQuestionsAnswer[] = input.answers ?? [];
    // Validate that all required questions have an answer.
    for (const q of current.payload.questions) {
      if (!q.required) continue;
      const a = answers.find((x) => x.questionId === q.id);
      if (!a) throw unprocessable(`Missing answer for required question ${q.id}`);
      if (q.kind === "text" && (!a.text || a.text.trim().length === 0)) {
        throw unprocessable(`Question ${q.id} requires a text answer`);
      }
      if (q.kind !== "text" && a.optionIds.length === 0) {
        throw unprocessable(`Question ${q.id} requires at least one selected option`);
      }
      if (q.kind === "single_choice" && a.optionIds.length > 1) {
        throw unprocessable(`Question ${q.id} accepts a single answer only`);
      }
    }

    const now = new Date();
    const [updated] = await db
      .update(threadInteractions)
      .set({
        status: "answered",
        result: { answers } as Record<string, unknown>,
        resolvedAt: now,
        resolvedByAgentId: actor.agentId ?? null,
        resolvedByUserId: actor.userId ?? null,
        updatedAt: now,
      })
      .where(
        and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.id, interactionId),
        ),
      )
      .returning();
    const interaction = hydrate(updated);
    emit("thread_interaction.answered", interaction);
    return interaction;
  }

  /**
   * Mark a pending interaction as superseded — used by the upstream
   * supersedeOnUserComment pattern, but the comment hook is not wired
   * yet (TODO below).
   */
  async function supersede(
    companyId: string,
    interactionId: string,
  ): Promise<ThreadInteraction | null> {
    const current = await getById(companyId, interactionId);
    if (!current || current.status !== "pending") return null;
    const now = new Date();
    const [updated] = await db
      .update(threadInteractions)
      .set({
        status: "superseded",
        result: { outcome: "superseded_by_comment" } as Record<string, unknown>,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(threadInteractions.companyId, companyId),
          eq(threadInteractions.id, interactionId),
        ),
      )
      .returning();
    const interaction = hydrate(updated);
    emit("thread_interaction.superseded", interaction);
    return interaction;
  }

  return { create, getById, listByIssue, accept, recordCreatedTasks, reject, respond, supersede };
}

export type ThreadInteractionsService = ReturnType<typeof threadInteractionsService>;
