import { z } from "zod";
import { ContentDocument } from "../types/content-blocks.js";
import {
  INBOX_ITEM_CATEGORIES,
  INBOX_ITEM_PRIORITIES,
  INBOX_ITEM_STATUSES,
} from "../types/inbox-item.js";

export const createInboxItemSchema = z.object({
  recipientId: z.string().min(1),
  title: z.string().min(1).max(300),
  body: z.string().optional().nullable(),
  contentBlocks: ContentDocument.optional().nullable(),
  category: z.enum(INBOX_ITEM_CATEGORIES).optional().default("notification"),
  priority: z.enum(INBOX_ITEM_PRIORITIES).optional().default("normal"),
  relatedIssueId: z.string().uuid().optional().nullable(),
  relatedAgentId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export type CreateInboxItem = z.infer<typeof createInboxItemSchema>;

export const updateInboxItemSchema = z.object({
  status: z.enum(INBOX_ITEM_STATUSES).optional(),
});

export type UpdateInboxItem = z.infer<typeof updateInboxItemSchema>;

export const inboxItemActionSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export type InboxItemAction = z.infer<typeof inboxItemActionSchema>;

export const inboxItemFiltersSchema = z.object({
  status: z.enum(INBOX_ITEM_STATUSES).optional(),
  category: z.enum(INBOX_ITEM_CATEGORIES).optional(),
  priority: z.enum(INBOX_ITEM_PRIORITIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type InboxItemFilters = z.infer<typeof inboxItemFiltersSchema>;
