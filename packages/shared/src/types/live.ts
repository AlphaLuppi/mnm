import type { LiveEventType } from "../constants.js";

export type EventVisibility =
  | { scope: "company-wide" }
  | { scope: "tag-filtered"; tagIds: string[] }
  | { scope: "actor-only"; actorId: string }
  | { scope: "agents"; agentIds: string[] };

export interface LiveEvent {
  id: number;
  companyId: string;
  type: LiveEventType;
  createdAt: string;
  payload: Record<string, unknown>;
  visibility: EventVisibility;
}
