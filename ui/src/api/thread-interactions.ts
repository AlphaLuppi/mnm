/**
 * PAPERCLIP-PHASE2 — Inbox Interactive — UI API client.
 * Wraps the REST endpoints under
 * `/api/companies/:companyId/issues/:issueId/interactions/...`.
 */
import type {
  AcceptThreadInteraction,
  CreateThreadInteraction,
  RejectThreadInteraction,
  RespondThreadInteraction,
  ThreadInteraction,
} from "@mnm/shared";
import { api } from "./client";

interface ListResponse {
  items: ThreadInteraction[];
  total: number;
}

export const threadInteractionsApi = {
  list: (companyId: string, issueId: string, status?: string) =>
    api.get<ListResponse>(
      `/companies/${companyId}/issues/${issueId}/interactions${status ? `?status=${status}` : ""}`,
    ),

  get: (companyId: string, issueId: string, interactionId: string) =>
    api.get<ThreadInteraction>(
      `/companies/${companyId}/issues/${issueId}/interactions/${interactionId}`,
    ),

  create: (companyId: string, issueId: string, body: CreateThreadInteraction) =>
    api.post<ThreadInteraction>(
      `/companies/${companyId}/issues/${issueId}/interactions`,
      body,
    ),

  accept: (
    companyId: string,
    issueId: string,
    interactionId: string,
    body: AcceptThreadInteraction = {},
  ) =>
    api.post<ThreadInteraction>(
      `/companies/${companyId}/issues/${issueId}/interactions/${interactionId}/accept`,
      body,
    ),

  reject: (
    companyId: string,
    issueId: string,
    interactionId: string,
    body: RejectThreadInteraction = {},
  ) =>
    api.post<ThreadInteraction>(
      `/companies/${companyId}/issues/${issueId}/interactions/${interactionId}/reject`,
      body,
    ),

  respond: (
    companyId: string,
    issueId: string,
    interactionId: string,
    body: RespondThreadInteraction,
  ) =>
    api.post<ThreadInteraction>(
      `/companies/${companyId}/issues/${issueId}/interactions/${interactionId}/respond`,
      body,
    ),
};
