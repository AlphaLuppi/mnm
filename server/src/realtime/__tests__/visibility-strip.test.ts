import { describe, it, expect } from "vitest";
import type { LiveEvent, ClientLiveEvent } from "@mnm/shared";

/**
 * WS-SEC-10: Visibility stripping test.
 * Validates that the destructure pattern used in sendFiltered()
 * produces a ClientLiveEvent (no visibility field).
 */

function stripVisibility(event: LiveEvent): ClientLiveEvent {
  const { visibility: _vis, ...clientEvent } = event;
  return clientEvent;
}

describe("visibility stripping", () => {
  const baseEvent: LiveEvent = {
    id: 1,
    companyId: "c1",
    type: "heartbeat.run" as LiveEvent["type"],
    createdAt: "2026-04-07T00:00:00.000Z",
    payload: { agentId: "a1", status: "running" },
    visibility: { scope: "agents", agentIds: ["a1"] },
  };

  it("removes visibility from company-wide event", () => {
    const event: LiveEvent = {
      ...baseEvent,
      visibility: { scope: "company-wide" },
    };
    const result = stripVisibility(event);
    expect(result).not.toHaveProperty("visibility");
    expect(result).toEqual({
      id: 1,
      companyId: "c1",
      type: "heartbeat.run",
      createdAt: "2026-04-07T00:00:00.000Z",
      payload: { agentId: "a1", status: "running" },
    });
  });

  it("removes visibility from tag-filtered event", () => {
    const event: LiveEvent = {
      ...baseEvent,
      visibility: { scope: "tag-filtered", tagIds: ["t1", "t2"] },
    };
    const result = stripVisibility(event);
    expect(result).not.toHaveProperty("visibility");
    expect(result.id).toBe(1);
  });

  it("removes visibility from actor-only event", () => {
    const event: LiveEvent = {
      ...baseEvent,
      visibility: { scope: "actor-only", actorId: "u1" },
    };
    const result = stripVisibility(event);
    expect(result).not.toHaveProperty("visibility");
  });

  it("removes visibility from agents event", () => {
    const result = stripVisibility(baseEvent);
    expect(result).not.toHaveProperty("visibility");
  });

  it("preserves all other fields", () => {
    const result = stripVisibility(baseEvent);
    expect(result.id).toBe(baseEvent.id);
    expect(result.companyId).toBe(baseEvent.companyId);
    expect(result.type).toBe(baseEvent.type);
    expect(result.createdAt).toBe(baseEvent.createdAt);
    expect(result.payload).toEqual(baseEvent.payload);
  });

  it("result satisfies ClientLiveEvent type", () => {
    const result: ClientLiveEvent = stripVisibility(baseEvent);
    // TypeScript compilation proves the type is correct
    expect(Object.keys(result).sort()).toEqual(
      ["companyId", "createdAt", "id", "payload", "type"],
    );
  });
});
