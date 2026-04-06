import type { EventVisibility, LiveEvent } from "@mnm/shared";

/**
 * Actor context for WS filtering — represents a connected user or agent.
 */
export interface WsActor {
  actorId: string;
  tagIds: ReadonlySet<string>;
  bypassTagFilter: boolean;
}

/**
 * Callback to check if a user's tags overlap with an agent's tags.
 * Returns true if the user should be able to see events from that agent.
 * This is async-free — the WS handler pre-resolves and caches results.
 */
export type ResolveAgentTagOverlap = (agentId: string) => boolean;

/**
 * Pure, synchronous filter: should the given actor receive this event?
 *
 * - company-wide: everyone
 * - actor-only: only the targeted actor
 * - tag-filtered: actors sharing >= 1 tag with the event's tagIds
 * - agents: actors who can see at least one of the event's agents
 * - bypassTagFilter = true: always receives (admin/CAO)
 * - unknown scope: deny by default
 */
export function canReceiveEvent(
  event: LiveEvent,
  actor: WsActor,
  resolveAgentTagOverlap: ResolveAgentTagOverlap,
): boolean {
  // Admin/CAO bypass — sees everything
  if (actor.bypassTagFilter) return true;

  const vis: EventVisibility = event.visibility;

  switch (vis.scope) {
    case "company-wide":
      return true;

    case "actor-only":
      return actor.actorId === vis.actorId;

    case "tag-filtered": {
      if (vis.tagIds.length === 0 || actor.tagIds.size === 0) return false;
      for (const tagId of vis.tagIds) {
        if (actor.tagIds.has(tagId)) return true;
      }
      return false;
    }

    case "agents": {
      if (vis.agentIds.length === 0) return false;
      for (const agentId of vis.agentIds) {
        if (resolveAgentTagOverlap(agentId)) return true;
      }
      return false;
    }

    default:
      // Unknown scope — deny by default (security)
      return false;
  }
}
