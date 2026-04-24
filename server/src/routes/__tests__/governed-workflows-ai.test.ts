/**
 * Integration tests for the Workflow Studio AI SSE endpoint (U14.1).
 *
 * We mock the service layer (`streamWorkflowAiChat`) so tests focus on:
 *   - body validation (422 on invalid input)
 *   - SSE framing + content-type headers
 *   - the per-actor concurrency limit (429 on the Nth+1 request)
 *
 * The `governedWorkflowsAiRoutes` factory accepts an `anthropicStreaming`
 * override, but we go one step further and mock the whole generator so the
 * service's DB + resolveGitProvider dependencies don't need a stub here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express, Router } from "express";
import request from "supertest";

// ── Mock the service layer ──────────────────────────────────────────────────

const streamWorkflowAiChatMock = vi.fn();

vi.mock("../../services/workflow-ai-assistant.js", async (importOriginal) => {
  const orig = await importOriginal<
    typeof import("../../services/workflow-ai-assistant.js")
  >();
  return {
    ...orig,
    streamWorkflowAiChat: (...args: unknown[]) =>
      streamWorkflowAiChatMock(...args),
    defaultAnthropicStreaming: vi.fn(async () => ""),
  };
});

vi.mock("../../mcp/build-mcp-services.js", () => ({
  createResolveGitProvider: vi.fn(() => async () => ({}) as any),
}));

vi.mock("@mnm/git-provider", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@mnm/git-provider")>();
  return {
    ...orig,
    ShaCache: class {
      get() {
        return undefined;
      }
      set() {}
    },
  };
});

// ── Imports after mocks ─────────────────────────────────────────────────────

import { governedWorkflowsAiRoutes } from "../governed-workflows-ai.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function withLocalImplicitActor(app: Express) {
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      source: "local_implicit",
      userId: "dev-user",
      companyIds: [],
      isInstanceAdmin: false,
    };
    next();
  });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  withLocalImplicitActor(app);

  const outer = Router();
  outer.use(
    "/companies/:companyId/governed-workflows/:name/ai",
    governedWorkflowsAiRoutes({} as any),
  );
  app.use("/api", outer);
  return app;
}

/** Build an async generator that yields a scripted sequence of events. */
async function* scriptedEvents(events: any[]) {
  for (const ev of events) {
    yield ev;
  }
}

/** Build an async generator that waits on a signal before each event. */
function pausedGenerator(release: Promise<void>) {
  return (async function* () {
    await release;
    yield { type: "done" };
  })();
}

beforeEach(() => {
  streamWorkflowAiChatMock.mockReset();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/companies/:companyId/governed-workflows/:name/ai/chat", () => {
  it("returns 422 when the body is missing messages", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
      .send({})
      .expect(422);
    expect(res.body.error_code).toBe("AI_CHAT_VALIDATION");
  });

  it("returns 422 when content exceeds 10000 chars", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
      .send({ messages: [{ role: "user", content: "x".repeat(10_001) }] })
      .expect(422);
    expect(res.body.error_code).toBe("AI_CHAT_VALIDATION");
  });

  it("streams SSE frames with token + done events", async () => {
    streamWorkflowAiChatMock.mockImplementationOnce(() =>
      scriptedEvents([
        { type: "token", value: "Salut " },
        { type: "token", value: "Tom" },
        {
          type: "file-proposal",
          path: "workflow.json",
          content: '{"ok":true}',
        },
        { type: "done" },
      ]),
    );

    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
      .send({ messages: [{ role: "user", content: "hi" }] })
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);

    // supertest may expose the body as either `res.text` (string) or
    // `res.body` (Buffer for unknown content types). Normalise.
    const raw =
      typeof res.text === "string" && res.text.length > 0
        ? res.text
        : Buffer.isBuffer(res.body)
          ? res.body.toString("utf8")
          : String(res.body ?? "");
    const frames = raw
      .split(/\r?\n\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.startsWith("data: "))
      .map((f) => JSON.parse(f.slice("data: ".length).trim()));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.some((f) => f.type === "token" && f.value === "Salut ")).toBe(
      true,
    );
    expect(frames.some((f) => f.type === "file-proposal")).toBe(true);
    expect(frames[frames.length - 1]).toEqual({ type: "done" });
  });

  it("emits a terminal done even if the generator throws mid-stream", async () => {
    // eslint-disable-next-line require-yield
    streamWorkflowAiChatMock.mockImplementationOnce(async function* () {
      throw new Error("service-level boom");
    });

    const app = makeApp();
    const res = await request(app)
      .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
      .send({ messages: [{ role: "user", content: "hi" }] })
      .expect(200);

    const raw =
      typeof res.text === "string" && res.text.length > 0
        ? res.text
        : Buffer.isBuffer(res.body)
          ? res.body.toString("utf8")
          : String(res.body ?? "");
    const frames = raw
      .split(/\r?\n\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.startsWith("data: "))
      .map((f) => JSON.parse(f.slice("data: ".length).trim()));
    expect(frames.some((f) => f.type === "error")).toBe(true);
    expect(frames[frames.length - 1]).toEqual({ type: "done" });
  });

  it(
    "rejects the 4th concurrent request with 429 AI_RATE_LIMIT",
    async () => {
      // Use 3 paused generators to hold slots, then fire a 4th that should
      // get rejected immediately before ever invoking streamWorkflowAiChat.
      const releases: Array<() => void> = [];
      streamWorkflowAiChatMock.mockImplementation(() => {
        let release!: () => void;
        const p = new Promise<void>((r) => {
          release = r;
        });
        releases.push(release);
        return pausedGenerator(p);
      });

      const app = makeApp();
      // supertest doesn't dispatch a Test object until you `.then()` /
      // `.end()` / `await` it. We chain `.then()` explicitly so the request
      // actually hits the server in parallel with the polling loop below.
      const inFlight = [
        request(app)
          .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
          .send({ messages: [{ role: "user", content: "a" }] })
          .then((r) => r),
        request(app)
          .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
          .send({ messages: [{ role: "user", content: "b" }] })
          .then((r) => r),
        request(app)
          .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
          .send({ messages: [{ role: "user", content: "c" }] })
          .then((r) => r),
      ];

      // Poll until all 3 handlers have entered the route — busy-wait with a
      // setImmediate yield keeps supertest's internal scheduling happy.
      const deadline = Date.now() + 10_000;
      while (releases.length < 3) {
        if (Date.now() > deadline) {
          throw new Error(
            `Only ${releases.length}/3 handlers entered within 10s`,
          );
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      const fourth = await request(app)
        .post("/api/companies/c-1/governed-workflows/hello-world/ai/chat")
        .send({ messages: [{ role: "user", content: "d" }] });
      expect(fourth.status).toBe(429);
      expect(fourth.body.error_code).toBe("AI_RATE_LIMIT");

      // Let the 3 in-flight requests finish so the test process exits cleanly.
      for (const r of releases) r();
      await Promise.all(inFlight);
    },
    15_000,
  );
});
