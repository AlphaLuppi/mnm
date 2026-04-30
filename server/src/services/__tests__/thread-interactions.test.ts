/**
 * PAPERCLIP-PHASE2 — Inbox Interactive — service tests.
 *
 * Covers the load-bearing behaviors:
 *   - create() round-trip (suggest_tasks / ask_questions / request_confirmation)
 *   - idempotency: equivalent retry returns the existing row
 *   - idempotency: divergent retry on the same key throws 409
 *   - accept(): only on suggest_tasks / request_confirmation, status transitions
 *   - reject(): rejectRequiresReason enforced on request_confirmation
 *   - respond(): required-question validation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@mnm/test-utils";
import { threadInteractionsService } from "../thread-interactions.js";

const COMPANY_ID = "00000000-0000-0000-0000-0000000ti001";
const ISSUE_ID = "00000000-0000-0000-0000-0000000ti002";

async function seed(db: Db) {
  await db.execute(
    sql`INSERT INTO companies (id, name, issue_prefix)
        VALUES (${COMPANY_ID}, 'TI Test Co', 'TI')
        ON CONFLICT DO NOTHING`,
  );
  await db.execute(
    sql`INSERT INTO issues (id, company_id, title, status, priority)
        VALUES (${ISSUE_ID}, ${COMPANY_ID}, 'Seed issue', 'backlog', 'medium')
        ON CONFLICT DO NOTHING`,
  );
}

async function setRlsContext(db: Db) {
  await db.execute(sql`SELECT set_config('app.current_company_id', ${COMPANY_ID}, true)`);
}

describe("threadInteractionsService", () => {
  let db: Db;
  let svc: ReturnType<typeof threadInteractionsService>;

  beforeAll(async () => {
    db = await setupTestDb();
    await cleanTestDb(db);
    svc = threadInteractionsService(db);
    await seed(db);
  });

  afterAll(async () => {
    await teardownTestDb(db);
  });

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM thread_interactions WHERE company_id = ${COMPANY_ID}`);
    await setRlsContext(db);
  });

  describe("create()", () => {
    it("creates a suggest_tasks interaction and round-trips the payload", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "suggest_tasks",
          continuationPolicy: "wake_assignee",
          payload: {
            version: 1,
            tasks: [
              { clientKey: "t1", title: "Task one" },
              { clientKey: "t2", title: "Task two" },
            ],
          },
        },
        { agentId: null, userId: "user-1" },
      );
      expect(created.kind).toBe("suggest_tasks");
      expect(created.status).toBe("pending");
      if (created.kind === "suggest_tasks") {
        expect(created.payload.tasks).toHaveLength(2);
      }
      expect(created.companyId).toBe(COMPANY_ID);
      expect(created.issueId).toBe(ISSUE_ID);
    });

    it("creates a request_confirmation interaction with default labels", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "request_confirmation",
          payload: {
            version: 1,
            prompt: "Accept this plan?",
          },
        },
        { agentId: null, userId: "user-1" },
      );
      expect(created.kind).toBe("request_confirmation");
      // Defaults filled by the Zod schema:
      if (created.kind === "request_confirmation") {
        expect(created.payload.acceptLabel).toBe("Accept");
        expect(created.payload.rejectLabel).toBe("Request changes");
      }
    });
  });

  describe("idempotency", () => {
    it("returns the existing row on equivalent retry with the same idempotencyKey", async () => {
      const a = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "suggest_tasks",
          idempotencyKey: "run-1:suggest",
          payload: {
            version: 1,
            tasks: [{ clientKey: "t1", title: "T1" }],
          },
        },
        { agentId: null, userId: "user-1" },
      );
      const b = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "suggest_tasks",
          idempotencyKey: "run-1:suggest",
          payload: {
            version: 1,
            tasks: [{ clientKey: "t1", title: "T1" }],
          },
        },
        { agentId: null, userId: "user-1" },
      );
      expect(b.id).toBe(a.id);
      expect(b.status).toBe("pending");
    });

    it("throws 409 when the same idempotencyKey is reused with divergent payload", async () => {
      await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "suggest_tasks",
          idempotencyKey: "run-2:suggest",
          payload: {
            version: 1,
            tasks: [{ clientKey: "t1", title: "Original" }],
          },
        },
        { agentId: null, userId: "user-1" },
      );
      await expect(
        svc.create(
          COMPANY_ID,
          ISSUE_ID,
          {
            kind: "suggest_tasks",
            idempotencyKey: "run-2:suggest",
            payload: {
              version: 1,
              tasks: [{ clientKey: "t1", title: "Different title" }],
            },
          },
          { agentId: null, userId: "user-1" },
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe("accept() / reject()", () => {
    it("accept() flips a request_confirmation to accepted with outcome=accepted", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "request_confirmation",
          payload: { version: 1, prompt: "Plan ok?" },
        },
        { agentId: null, userId: null },
      );
      const { interaction } = await svc.accept(
        COMPANY_ID,
        created.id,
        {},
        { agentId: null, userId: "user-2" },
      );
      expect(interaction.status).toBe("accepted");
      if (interaction.kind === "request_confirmation") {
        expect(interaction.result?.outcome).toBe("accepted");
      }
      expect(interaction.acceptedAt).not.toBeNull();
      expect(interaction.resolvedByUserId).toBe("user-2");
    });

    it("reject() requires a reason when rejectRequiresReason=true", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "request_confirmation",
          payload: {
            version: 1,
            prompt: "Big change ok?",
            rejectRequiresReason: true,
          },
        },
        { agentId: null, userId: null },
      );
      await expect(
        svc.reject(COMPANY_ID, created.id, {}, { agentId: null, userId: "user-2" }),
      ).rejects.toMatchObject({ status: 422 });
      // With a reason it works.
      const interaction = await svc.reject(
        COMPANY_ID,
        created.id,
        { reason: "Need more details" },
        { agentId: null, userId: "user-2" },
      );
      expect(interaction.status).toBe("rejected");
    });

    it("accept() rejects unknown clientKey on a suggest_tasks interaction", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "suggest_tasks",
          payload: {
            version: 1,
            tasks: [{ clientKey: "t1", title: "T1" }],
          },
        },
        { agentId: null, userId: null },
      );
      await expect(
        svc.accept(
          COMPANY_ID,
          created.id,
          { selectedClientKeys: ["does-not-exist"] },
          { agentId: null, userId: "user-2" },
        ),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  describe("respond()", () => {
    it("requires answers for required questions", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "ask_questions",
          payload: {
            version: 1,
            questions: [
              {
                id: "q1",
                prompt: "Pick one",
                kind: "single_choice",
                required: true,
                options: [
                  { id: "a", label: "A" },
                  { id: "b", label: "B" },
                ],
              },
            ],
          },
        },
        { agentId: null, userId: null },
      );
      await expect(
        svc.respond(COMPANY_ID, created.id, { answers: [] }, { agentId: null, userId: "user-2" }),
      ).rejects.toMatchObject({ status: 422 });
      const ok = await svc.respond(
        COMPANY_ID,
        created.id,
        { answers: [{ questionId: "q1", optionIds: ["a"] }] },
        { agentId: null, userId: "user-2" },
      );
      expect(ok.status).toBe("answered");
    });

    it("rejects multi-select on a single_choice question", async () => {
      const created = await svc.create(
        COMPANY_ID,
        ISSUE_ID,
        {
          kind: "ask_questions",
          payload: {
            version: 1,
            questions: [
              {
                id: "q1",
                prompt: "Pick exactly one",
                kind: "single_choice",
                required: true,
                options: [
                  { id: "a", label: "A" },
                  { id: "b", label: "B" },
                ],
              },
            ],
          },
        },
        { agentId: null, userId: null },
      );
      await expect(
        svc.respond(
          COMPANY_ID,
          created.id,
          { answers: [{ questionId: "q1", optionIds: ["a", "b"] }] },
          { agentId: null, userId: "user-2" },
        ),
      ).rejects.toMatchObject({ status: 422 });
    });
  });
});
