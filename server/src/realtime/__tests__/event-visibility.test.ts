import { describe, expect, it } from "vitest";
import type { LiveEvent } from "@mnm/shared";
import { canReceiveEvent, type WsActor, type ResolveAgentTagOverlap } from "../event-visibility.js";

function makeEvent(visibility: LiveEvent["visibility"]): LiveEvent {
  return {
    id: 1,
    companyId: "c1",
    type: "heartbeat.run.status" as LiveEvent["type"],
    createdAt: new Date().toISOString(),
    payload: {},
    visibility,
  };
}

function makeActor(opts: Partial<WsActor> = {}): WsActor {
  return {
    actorId: opts.actorId ?? "user-1",
    tagIds: opts.tagIds ?? new Set<string>(),
    bypassTagFilter: opts.bypassTagFilter ?? false,
  };
}

const noOverlap: ResolveAgentTagOverlap = () => false;
const alwaysOverlap: ResolveAgentTagOverlap = () => true;

describe("canReceiveEvent", () => {
  describe("bypassTagFilter (admin/CAO)", () => {
    it("returns true for any scope when bypassTagFilter is true", () => {
      const admin = makeActor({ bypassTagFilter: true });
      expect(canReceiveEvent(makeEvent({ scope: "company-wide" }), admin, noOverlap)).toBe(true);
      expect(canReceiveEvent(makeEvent({ scope: "actor-only", actorId: "other" }), admin, noOverlap)).toBe(true);
      expect(canReceiveEvent(makeEvent({ scope: "tag-filtered", tagIds: ["t1"] }), admin, noOverlap)).toBe(true);
      expect(canReceiveEvent(makeEvent({ scope: "agents", agentIds: ["a1"] }), admin, noOverlap)).toBe(true);
    });
  });

  describe("scope: company-wide", () => {
    it("returns true for any actor", () => {
      const event = makeEvent({ scope: "company-wide" });
      expect(canReceiveEvent(event, makeActor(), noOverlap)).toBe(true);
      expect(canReceiveEvent(event, makeActor({ tagIds: new Set(["t1"]) }), noOverlap)).toBe(true);
    });
  });

  describe("scope: actor-only", () => {
    it("returns true when actorId matches", () => {
      const event = makeEvent({ scope: "actor-only", actorId: "user-1" });
      expect(canReceiveEvent(event, makeActor({ actorId: "user-1" }), noOverlap)).toBe(true);
    });

    it("returns false when actorId does not match", () => {
      const event = makeEvent({ scope: "actor-only", actorId: "user-2" });
      expect(canReceiveEvent(event, makeActor({ actorId: "user-1" }), noOverlap)).toBe(false);
    });
  });

  describe("scope: tag-filtered", () => {
    it("returns true when at least 1 tag overlaps", () => {
      const event = makeEvent({ scope: "tag-filtered", tagIds: ["t1", "t2"] });
      const actor = makeActor({ tagIds: new Set(["t2", "t3"]) });
      expect(canReceiveEvent(event, actor, noOverlap)).toBe(true);
    });

    it("returns false when no tags overlap", () => {
      const event = makeEvent({ scope: "tag-filtered", tagIds: ["t1", "t2"] });
      const actor = makeActor({ tagIds: new Set(["t3", "t4"]) });
      expect(canReceiveEvent(event, actor, noOverlap)).toBe(false);
    });

    it("returns false when event tagIds is empty", () => {
      const event = makeEvent({ scope: "tag-filtered", tagIds: [] });
      const actor = makeActor({ tagIds: new Set(["t1"]) });
      expect(canReceiveEvent(event, actor, noOverlap)).toBe(false);
    });

    it("returns false when actor tagIds is empty", () => {
      const event = makeEvent({ scope: "tag-filtered", tagIds: ["t1"] });
      const actor = makeActor({ tagIds: new Set() });
      expect(canReceiveEvent(event, actor, noOverlap)).toBe(false);
    });
  });

  describe("scope: agents", () => {
    it("returns true when resolveAgentTagOverlap returns true for at least one agent", () => {
      const event = makeEvent({ scope: "agents", agentIds: ["a1", "a2"] });
      const resolver: ResolveAgentTagOverlap = (id) => id === "a2";
      expect(canReceiveEvent(event, makeActor(), resolver)).toBe(true);
    });

    it("returns false when resolveAgentTagOverlap returns false for all agents", () => {
      const event = makeEvent({ scope: "agents", agentIds: ["a1", "a2"] });
      expect(canReceiveEvent(event, makeActor(), noOverlap)).toBe(false);
    });

    it("returns false when agentIds is empty", () => {
      const event = makeEvent({ scope: "agents", agentIds: [] });
      expect(canReceiveEvent(event, makeActor(), alwaysOverlap)).toBe(false);
    });
  });

  describe("unknown scope", () => {
    it("returns false for an unrecognized scope (deny by default)", () => {
      const event = makeEvent({ scope: "company-wide" });
      // Force an unknown scope for safety testing
      (event.visibility as any).scope = "unknown-scope";
      expect(canReceiveEvent(event, makeActor({ bypassTagFilter: false }), alwaysOverlap)).toBe(false);
    });
  });
});
