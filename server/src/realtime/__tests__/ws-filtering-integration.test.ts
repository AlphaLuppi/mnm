import { describe, it, expect } from "vitest";
import type { LiveEvent, ClientLiveEvent, EventVisibility } from "@mnm/shared";
import {
  canReceiveEvent,
  type WsActor,
  type ResolveAgentTagOverlap,
} from "../event-visibility.js";

/**
 * WS-SEC-11: Integration test — end-to-end WS filtering pipeline.
 *
 * Simulates the full flow: publish event with visibility -> canReceiveEvent filter
 * -> strip visibility -> verify ClientLiveEvent output.
 *
 * Tests realistic multi-user, multi-agent scenarios.
 */

// --- Helpers ---

function stripVisibility(event: LiveEvent): ClientLiveEvent {
  const { visibility: _vis, ...clientEvent } = event;
  return clientEvent;
}

function makeEvent(
  type: string,
  payload: Record<string, unknown>,
  visibility: EventVisibility,
): LiveEvent {
  return {
    id: Math.floor(Math.random() * 10000),
    companyId: "company-1",
    type: type as LiveEvent["type"],
    createdAt: new Date().toISOString(),
    payload,
    visibility,
  };
}

/**
 * Simulates the WS handler dispatch loop: for each connected actor,
 * filter the event and strip visibility if allowed.
 */
function dispatch(
  event: LiveEvent,
  actors: WsActor[],
  resolvers: Map<string, ResolveAgentTagOverlap>,
): Map<string, ClientLiveEvent> {
  const delivered = new Map<string, ClientLiveEvent>();
  for (const actor of actors) {
    const resolver = resolvers.get(actor.actorId) ?? (() => false);
    if (canReceiveEvent(event, actor, resolver)) {
      delivered.set(actor.actorId, stripVisibility(event));
    }
  }
  return delivered;
}

// --- Actors ---

const admin: WsActor = {
  actorId: "user-admin",
  tagIds: new Set(["tag-all"]),
  bypassTagFilter: true,
};

const managerBackend: WsActor = {
  actorId: "user-manager-be",
  tagIds: new Set(["tag-backend", "tag-infra"]),
  bypassTagFilter: false,
};

const devFrontend: WsActor = {
  actorId: "user-dev-fe",
  tagIds: new Set(["tag-frontend"]),
  bypassTagFilter: false,
};

const devFullstack: WsActor = {
  actorId: "user-dev-fs",
  tagIds: new Set(["tag-backend", "tag-frontend"]),
  bypassTagFilter: false,
};

const allActors = [admin, managerBackend, devFrontend, devFullstack];

// Agent tag setup: agent-be has tag-backend, agent-fe has tag-frontend
const agentTags: Record<string, Set<string>> = {
  "agent-be": new Set(["tag-backend"]),
  "agent-fe": new Set(["tag-frontend"]),
  "agent-infra": new Set(["tag-infra"]),
};

function makeResolver(actor: WsActor): ResolveAgentTagOverlap {
  return (agentId: string) => {
    const aTags = agentTags[agentId];
    if (!aTags) return false;
    for (const t of aTags) {
      if (actor.tagIds.has(t)) return true;
    }
    return false;
  };
}

const resolvers = new Map<string, ResolveAgentTagOverlap>(
  allActors.map((a) => [a.actorId, makeResolver(a)]),
);

// --- Tests ---

describe("WS-SEC-11: end-to-end WS filtering", () => {
  describe("company-wide events", () => {
    it("delivers to all connected actors", () => {
      const event = makeEvent(
        "workflow.created",
        { workflowId: "w1" },
        { scope: "company-wide" },
      );
      const delivered = dispatch(event, allActors, resolvers);
      expect(delivered.size).toBe(4);
      for (const [, clientEvent] of delivered) {
        expect(clientEvent).not.toHaveProperty("visibility");
        expect(clientEvent.payload).toEqual({ workflowId: "w1" });
      }
    });
  });

  describe("actor-only events", () => {
    it("delivers only to the targeted actor", () => {
      const event = makeEvent(
        "folder.created",
        { folderId: "f1" },
        { scope: "actor-only", actorId: "user-dev-fe" },
      );
      const delivered = dispatch(event, allActors, resolvers);
      // admin bypasses, plus the targeted actor
      expect(delivered.has("user-admin")).toBe(true);
      expect(delivered.has("user-dev-fe")).toBe(true);
      expect(delivered.has("user-manager-be")).toBe(false);
      expect(delivered.has("user-dev-fs")).toBe(false);
    });
  });

  describe("tag-filtered events", () => {
    it("delivers to actors with overlapping tags", () => {
      const event = makeEvent(
        "drift.detected",
        { driftId: "d1" },
        { scope: "tag-filtered", tagIds: ["tag-backend"] },
      );
      const delivered = dispatch(event, allActors, resolvers);
      expect(delivered.has("user-admin")).toBe(true); // bypass
      expect(delivered.has("user-manager-be")).toBe(true); // has tag-backend
      expect(delivered.has("user-dev-fs")).toBe(true); // has tag-backend
      expect(delivered.has("user-dev-fe")).toBe(false); // only tag-frontend
    });

    it("handles multi-tag events", () => {
      const event = makeEvent(
        "drift.detected",
        { driftId: "d2" },
        { scope: "tag-filtered", tagIds: ["tag-frontend", "tag-infra"] },
      );
      const delivered = dispatch(event, allActors, resolvers);
      expect(delivered.has("user-admin")).toBe(true);
      expect(delivered.has("user-manager-be")).toBe(true); // has tag-infra
      expect(delivered.has("user-dev-fe")).toBe(true); // has tag-frontend
      expect(delivered.has("user-dev-fs")).toBe(true); // has tag-frontend
    });

    it("delivers to nobody when tagIds is empty (except admin)", () => {
      const event = makeEvent(
        "drift.detected",
        { driftId: "d3" },
        { scope: "tag-filtered", tagIds: [] },
      );
      const delivered = dispatch(event, allActors, resolvers);
      expect(delivered.size).toBe(1);
      expect(delivered.has("user-admin")).toBe(true);
    });
  });

  describe("agents scope events", () => {
    it("delivers based on agent tag overlap", () => {
      const event = makeEvent(
        "heartbeat.run",
        { agentId: "agent-be", status: "running" },
        { scope: "agents", agentIds: ["agent-be"] },
      );
      const delivered = dispatch(event, allActors, resolvers);
      expect(delivered.has("user-admin")).toBe(true); // bypass
      expect(delivered.has("user-manager-be")).toBe(true); // tag-backend overlaps agent-be
      expect(delivered.has("user-dev-fs")).toBe(true); // tag-backend overlaps agent-be
      expect(delivered.has("user-dev-fe")).toBe(false); // no overlap with agent-be
    });

    it("delivers for multi-agent events to union of audiences", () => {
      const event = makeEvent(
        "a2a.message_sent",
        { from: "agent-be", to: "agent-fe" },
        { scope: "agents", agentIds: ["agent-be", "agent-fe"] },
      );
      const delivered = dispatch(event, allActors, resolvers);
      // All non-admin actors should see it: manager-be sees agent-be, dev-fe sees agent-fe, dev-fs sees both
      expect(delivered.size).toBe(4);
    });

    it("denies when actor has no overlap with any agent", () => {
      const event = makeEvent(
        "heartbeat.run",
        { agentId: "agent-infra" },
        { scope: "agents", agentIds: ["agent-infra"] },
      );
      const delivered = dispatch(event, allActors, resolvers);
      expect(delivered.has("user-admin")).toBe(true); // bypass
      expect(delivered.has("user-manager-be")).toBe(true); // tag-infra overlaps
      expect(delivered.has("user-dev-fe")).toBe(false);
      expect(delivered.has("user-dev-fs")).toBe(false);
    });
  });

  describe("visibility stripping", () => {
    it("never leaks visibility to the client regardless of scope", () => {
      const scopes: EventVisibility[] = [
        { scope: "company-wide" },
        { scope: "actor-only", actorId: "user-admin" },
        { scope: "tag-filtered", tagIds: ["tag-backend"] },
        { scope: "agents", agentIds: ["agent-be"] },
      ];
      for (const visibility of scopes) {
        const event = makeEvent("test.event", {}, visibility);
        const delivered = dispatch(event, [admin], resolvers);
        const clientEvent = delivered.get("user-admin")!;
        expect(clientEvent).toBeDefined();
        expect(clientEvent).not.toHaveProperty("visibility");
        expect(JSON.stringify(clientEvent)).not.toContain('"visibility"');
      }
    });
  });

  describe("mixed scenario: realistic event burst", () => {
    it("correctly filters a burst of events with different visibilities", () => {
      const events: LiveEvent[] = [
        makeEvent("heartbeat.run", { agentId: "agent-be" }, { scope: "agents", agentIds: ["agent-be"] }),
        makeEvent("folder.created", { folderId: "f1" }, { scope: "actor-only", actorId: "user-dev-fe" }),
        makeEvent("workflow.created", { wfId: "w1" }, { scope: "company-wide" }),
        makeEvent("heartbeat.run", { agentId: "agent-fe" }, { scope: "agents", agentIds: ["agent-fe"] }),
        makeEvent("drift.detected", { id: "d1" }, { scope: "tag-filtered", tagIds: ["tag-infra"] }),
      ];

      // dev-frontend should receive: folder.created (actor-only match), workflow.created (company-wide), heartbeat agent-fe (tag overlap)
      const devFeReceived: ClientLiveEvent[] = [];
      for (const event of events) {
        const resolver = resolvers.get(devFrontend.actorId)!;
        if (canReceiveEvent(event, devFrontend, resolver)) {
          devFeReceived.push(stripVisibility(event));
        }
      }
      expect(devFeReceived).toHaveLength(3);
      expect(devFeReceived.map((e) => e.type)).toEqual([
        "folder.created",
        "workflow.created",
        "heartbeat.run",
      ]);

      // admin receives all 5
      const adminReceived: ClientLiveEvent[] = [];
      for (const event of events) {
        const resolver = resolvers.get(admin.actorId)!;
        if (canReceiveEvent(event, admin, resolver)) {
          adminReceived.push(stripVisibility(event));
        }
      }
      expect(adminReceived).toHaveLength(5);

      // manager-be receives: heartbeat agent-be (tag overlap), workflow (company-wide), drift (tag-infra overlap)
      const mgrBeReceived: ClientLiveEvent[] = [];
      for (const event of events) {
        const resolver = resolvers.get(managerBackend.actorId)!;
        if (canReceiveEvent(event, managerBackend, resolver)) {
          mgrBeReceived.push(stripVisibility(event));
        }
      }
      expect(mgrBeReceived).toHaveLength(3);
      expect(mgrBeReceived.map((e) => e.type)).toEqual([
        "heartbeat.run",
        "workflow.created",
        "drift.detected",
      ]);
    });
  });
});
