import type { Db } from "@mnm/db";
import { accessService } from "./access.js";

export interface ActorTagContext {
  tagIds: ReadonlySet<string>;
  bypassTagFilter: boolean;
}

/**
 * Shared tag-scope resolution for both HTTP middleware and WS handshake.
 * Returns the actor's tag context for visibility filtering.
 */
export async function resolveActorTagContext(
  db: Db,
  companyId: string,
  actorType: "user" | "agent",
  actorId: string,
  opts?: { isInstanceAdmin?: boolean },
): Promise<ActorTagContext> {
  const access = accessService(db);

  if (opts?.isInstanceAdmin) {
    return { tagIds: new Set<string>(), bypassTagFilter: true };
  }

  if (actorType === "user") {
    const role = await access.resolveRole(companyId, "user", actorId);
    const bypassTagFilter = role?.bypassTagFilter ?? false;
    if (bypassTagFilter) {
      return { tagIds: new Set<string>(), bypassTagFilter: true };
    }
    const tagIds = await access.getTagIds(companyId, "user", actorId);
    return { tagIds, bypassTagFilter: false };
  }

  // Agent actors
  const tagIds = await access.getTagIds(companyId, "agent", actorId);
  return { tagIds, bypassTagFilter: false };
}
