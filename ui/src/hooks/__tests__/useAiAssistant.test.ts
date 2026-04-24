/**
 * Tests for the pure state-transition helpers extracted from useAiAssistant.
 *
 * @testing-library/react-hooks is not installed in this workspace, so we test
 * the reducer shape directly. The hook itself is thin glue between these
 * helpers and `governedWorkflowsApi.streamAiChat`.
 */
import { describe, it, expect } from "vitest";
import {
  applyTokenDelta,
  addProposal,
  markProposalApplied,
  markProposalDismissed,
  stampError,
  endStream,
  type ChatMessage,
  type FileProposal,
} from "../useAiAssistant.js";

function userMsg(id: string, content = "hello"): ChatMessage {
  return { id, role: "user", content };
}

function assistantMsg(
  id: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    role: "assistant",
    content: "",
    streaming: true,
    proposals: [],
    ...overrides,
  };
}

function proposal(id: string, overrides: Partial<FileProposal> = {}): FileProposal {
  return {
    id,
    path: "workflow.json",
    content: "{}",
    applied: false,
    dismissed: false,
    ...overrides,
  };
}

describe("applyTokenDelta", () => {
  it("appends the delta to the matching assistant message", () => {
    const msgs = [userMsg("u1", "hi"), assistantMsg("a1", { content: "Bon" })];
    const next = applyTokenDelta(msgs, "a1", "jour");
    expect(next[1].content).toBe("Bonjour");
    // User message is untouched.
    expect(next[0]).toBe(msgs[0]);
  });

  it("is a no-op when the id is unknown", () => {
    const msgs = [assistantMsg("a1", { content: "x" })];
    const next = applyTokenDelta(msgs, "nope", "y");
    expect(next[0].content).toBe("x");
  });
});

describe("addProposal", () => {
  it("attaches the proposal to the target assistant message", () => {
    const msgs = [assistantMsg("a1")];
    const p = proposal("p1", { path: "gates/new.gate.ts" });
    const next = addProposal(msgs, "a1", p);
    expect(next[0].proposals).toHaveLength(1);
    expect(next[0].proposals?.[0].path).toBe("gates/new.gate.ts");
  });

  it("preserves previously attached proposals", () => {
    const initial = assistantMsg("a1", {
      proposals: [proposal("p0")],
    });
    const next = addProposal([initial], "a1", proposal("p1"));
    expect(next[0].proposals).toHaveLength(2);
    expect(next[0].proposals?.map((p) => p.id)).toEqual(["p0", "p1"]);
  });
});

describe("markProposalApplied / markProposalDismissed", () => {
  it("marks the matching proposal as applied", () => {
    const msgs = [
      assistantMsg("a1", { proposals: [proposal("p1"), proposal("p2")] }),
    ];
    const next = markProposalApplied(msgs, "p1");
    expect(next[0].proposals?.[0]).toMatchObject({ id: "p1", applied: true });
    expect(next[0].proposals?.[1]).toMatchObject({ id: "p2", applied: false });
  });

  it("marks the matching proposal as dismissed", () => {
    const msgs = [assistantMsg("a1", { proposals: [proposal("p1")] })];
    const next = markProposalDismissed(msgs, "p1");
    expect(next[0].proposals?.[0].dismissed).toBe(true);
  });

  it("is a no-op for unknown proposal ids", () => {
    const msgs = [assistantMsg("a1", { proposals: [proposal("p1")] })];
    const next = markProposalApplied(msgs, "nope");
    expect(next[0].proposals?.[0].applied).toBe(false);
  });
});

describe("stampError / endStream", () => {
  it("stamps an error and clears streaming flag", () => {
    const msgs = [assistantMsg("a1", { streaming: true })];
    const next = stampError(msgs, "a1", {
      error_code: "LLM_ERROR",
      message: "boom",
      hints: ["retry"],
    });
    expect(next[0].streaming).toBe(false);
    expect(next[0].error).toEqual({
      error_code: "LLM_ERROR",
      message: "boom",
      hints: ["retry"],
    });
  });

  it("endStream flips streaming off", () => {
    const msgs = [assistantMsg("a1", { streaming: true })];
    const next = endStream(msgs, "a1");
    expect(next[0].streaming).toBe(false);
  });
});

describe("initial composition", () => {
  it("builds a realistic exchange via helpers", () => {
    let msgs: ChatMessage[] = [];
    msgs = [
      ...msgs,
      userMsg("u1", "ajoute une étape"),
      assistantMsg("a1"),
    ];
    msgs = applyTokenDelta(msgs, "a1", "Voici la ");
    msgs = applyTokenDelta(msgs, "a1", "modification...");
    msgs = addProposal(
      msgs,
      "a1",
      proposal("p1", { path: "workflow.json", content: "{\"name\":\"x\"}" }),
    );
    msgs = endStream(msgs, "a1");

    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toBe("Voici la modification...");
    expect(msgs[1].streaming).toBe(false);
    expect(msgs[1].proposals).toHaveLength(1);
    expect(msgs[1].proposals?.[0].applied).toBe(false);
  });
});
