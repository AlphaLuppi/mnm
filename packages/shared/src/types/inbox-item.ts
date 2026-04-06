import type { ContentDocument } from "./content-blocks.js";

export const INBOX_ITEM_CATEGORIES = [
  "notification", "approval", "alert", "failed_run", "digest", "action_required",
] as const;

export const INBOX_ITEM_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const INBOX_ITEM_STATUSES = ["unread", "read", "actioned", "dismissed", "expired"] as const;

export type InboxItemCategory = (typeof INBOX_ITEM_CATEGORIES)[number];
export type InboxItemPriority = (typeof INBOX_ITEM_PRIORITIES)[number];
export type InboxItemStatus = (typeof INBOX_ITEM_STATUSES)[number];

export interface InboxItemActionTaken {
  action: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface InboxItem {
  id: string;
  companyId: string;
  recipientId: string;
  senderAgentId: string | null;
  senderUserId: string | null;
  title: string;
  body: string | null;
  contentBlocks: ContentDocument | null;
  category: InboxItemCategory;
  priority: InboxItemPriority;
  status: InboxItemStatus;
  actionTaken: InboxItemActionTaken | null;
  relatedIssueId: string | null;
  relatedAgentId: string | null;
  expiresAt: string | null;
  createdAt: string;
}
