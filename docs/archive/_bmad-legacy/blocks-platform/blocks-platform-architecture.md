# MnM Blocks Platform — Technical Architecture Blueprint

> **Author**: System Architect
> **Date**: 2026-04-06
> **Status**: COMPLETE — ready for PM sprint planning
> **Source**: brainstorming-mnm-blocks-platform-unifie-2026-04-05.md
> **Existing WIP**: commit 079fc418 (F1 View Presets foundation)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Migration Plan](#2-migration-plan)
3. [Shared Package Changes](#3-shared-package-changes)
4. [Server Changes](#4-server-changes)
5. [Frontend Changes](#5-frontend-changes)
6. [Dependency Map & Critical Path](#6-dependency-map--critical-path)
7. [API Contract Details](#7-api-contract-details)
8. [Conventions to Follow](#8-conventions-to-follow)

---

## 1. Executive Summary

### What Exists (F1 View Presets — DONE)

| Layer | Files | Status |
|-------|-------|--------|
| DB Schema | `packages/db/src/schema/view_presets.ts`, `roles.ts` (viewPresetId), `company_memberships.ts` (layoutOverrides) | Done |
| Migration | `packages/db/src/migrations/0057_view_presets.sql` | Done |
| Shared types | `packages/shared/src/types/view-preset.ts` — NavItemId, SidebarSection, DashboardWidget, ViewPresetLayout, LayoutOverrides, ResolvedLayout, MyViewResponse, ViewPreset, DEFAULT_LAYOUT, PRESET_LAYOUTS | Done |
| Server | `server/src/routes/view-presets.ts` — 6 endpoints, `server/src/services/view-preset-seed.ts` | Done |
| Frontend | `ui/src/api/view-presets.ts`, `ui/src/hooks/useViewPreset.ts`, `ui/src/lib/resolve-layout.ts`, `ui/src/lib/nav-registry.ts`, `ui/src/lib/widget-registry.ts`, DashboardGrid.tsx, Sidebar dynamic rendering | Done |

### What This Blueprint Covers

| Epic | Feature | New Tables | New Columns | New Routes | New Components |
|------|---------|------------|-------------|------------|----------------|
| E2 | Blocks Foundation | 0 | 0 | 2 | ~16 |
| E3 | Dashboard Intelligent | 1 (`user_widgets`) | 0 | 4 | 3 |
| E4 | Agent Forms in Issues | 0 | 1 (`content_blocks`) | 0 (modify existing) | 0 (reuse ContentRenderer) |
| E5 | Inbox Interactive | 1 (`inbox_items`) | 0 | 5 | 2 |
| F1 gap | Admin UI for View Presets | 0 | 0 | 0 | 1 page |

---

## 2. Migration Plan

Latest existing migration: `0057_view_presets.sql`

### Migration 0058: `user_widgets` + `issue_comments.content_blocks`

**File**: `packages/db/src/migrations/0058_blocks_foundation.sql`

```sql
-- BLOCKS-PLATFORM: user_widgets table (F2) + issue_comments.content_blocks (F3)

-- ── F2: User dashboard widgets (AI-generated custom widgets) ──
CREATE TABLE IF NOT EXISTS "user_widgets" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"          UUID NOT NULL REFERENCES "companies"("id"),
  "user_id"             TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "blocks"              JSONB NOT NULL,
  "data_source"         JSONB,
  "position"            INTEGER NOT NULL DEFAULT 0,
  "span"                INTEGER NOT NULL DEFAULT 2,
  "created_by_agent_id" UUID REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_user_widgets_company_user"
  ON "user_widgets"("company_id", "user_id");

-- ── F3: Content blocks on issue comments ──
ALTER TABLE "issue_comments"
  ADD COLUMN IF NOT EXISTS "content_blocks" JSONB;
```

### Migration 0059: `inbox_items`

**File**: `packages/db/src/migrations/0059_inbox_items.sql`

```sql
-- BLOCKS-PLATFORM: inbox_items table (F4)

CREATE TABLE IF NOT EXISTS "inbox_items" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"        UUID NOT NULL REFERENCES "companies"("id"),
  "recipient_id"      TEXT NOT NULL,
  "sender_agent_id"   UUID REFERENCES "agents"("id") ON DELETE SET NULL,
  "sender_user_id"    TEXT,
  "title"             TEXT NOT NULL,
  "body"              TEXT,
  "content_blocks"    JSONB,
  "category"          TEXT NOT NULL DEFAULT 'notification',
  "priority"          TEXT NOT NULL DEFAULT 'normal',
  "status"            TEXT NOT NULL DEFAULT 'unread',
  "action_taken"      JSONB,
  "related_issue_id"  UUID REFERENCES "issues"("id") ON DELETE SET NULL,
  "related_agent_id"  UUID REFERENCES "agents"("id") ON DELETE SET NULL,
  "expires_at"        TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_inbox_items_recipient"
  ON "inbox_items"("company_id", "recipient_id", "status");
CREATE INDEX IF NOT EXISTS "idx_inbox_items_created"
  ON "inbox_items"("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_inbox_items_category"
  ON "inbox_items"("company_id", "recipient_id", "category");
```

---

## 3. Shared Package Changes

### 3.1 New file: `packages/shared/src/types/content-blocks.ts`

The complete Zod catalogue — 14 block types (8 display + 2 interactive + 2 layout + 2 utility).

```typescript
import { z } from "zod";

// ─── DISPLAY ──────��──────────────────────────────────

export const MetricCardBlock = z.object({
  type: z.literal("metric-card"),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(["up", "down", "flat"]).optional(),
  description: z.string().optional(),
});

export const StatusBadgeBlock = z.object({
  type: z.literal("status-badge"),
  text: z.string(),
  variant: z.enum(["success", "warning", "error", "info", "neutral"]),
});

export const DataTableBlock = z.object({
  type: z.literal("data-table"),
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    align: z.enum(["left", "center", "right"]).optional(),
  })),
  rows: z.array(z.record(z.unknown())),
  maxRows: z.number().optional(),
});

export const CodeBlockBlock = z.object({
  type: z.literal("code-block"),
  language: z.string().optional(),
  code: z.string(),
  title: z.string().optional(),
});

export const ProgressBarBlock = z.object({
  type: z.literal("progress-bar"),
  label: z.string(),
  value: z.number().min(0).max(100),
  variant: z.enum(["default", "success", "warning", "error"]).optional(),
});

export const MarkdownBlockBlock = z.object({
  type: z.literal("markdown"),
  content: z.string(),
});

export const ChartBlock = z.object({
  type: z.literal("chart"),
  chartType: z.enum(["line", "bar", "pie", "donut"]),
  title: z.string().optional(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
});

export const DividerBlock = z.object({
  type: z.literal("divider"),
});

// ─── INTERACTIVE ───────��─────────────────────────────

export const ActionButtonBlock = z.object({
  type: z.literal("action-button"),
  label: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
  variant: z.enum(["default", "destructive", "outline", "ghost"]).optional(),
  confirm: z.string().optional(),
  permission: z.string().optional(),
  icon: z.string().optional(),
});

export const QuickFormBlock = z.object({
  type: z.literal("quick-form"),
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "select", "checkbox", "number", "date"]),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
  })),
  submitLabel: z.string().optional(),
  submitAction: z.string(),
  submitPayload: z.record(z.unknown()).optional(),
});

// ─── LAYOUT ──────���───────────────────────────────────

// Forward reference for recursive types
export const ContentBlock: z.ZodType = z.lazy(() =>
  z.discriminatedUnion("type", [
    MetricCardBlock,
    StatusBadgeBlock,
    DataTableBlock,
    CodeBlockBlock,
    ProgressBarBlock,
    MarkdownBlockBlock,
    ChartBlock,
    DividerBlock,
    ActionButtonBlock,
    QuickFormBlock,
    StackBlock,
    SectionBlock,
  ]),
);

export const StackBlock = z.object({
  type: z.literal("stack"),
  direction: z.enum(["horizontal", "vertical"]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  children: z.array(ContentBlock),
});

export const SectionBlock = z.object({
  type: z.literal("section"),
  title: z.string().optional(),
  collapsible: z.boolean().optional(),
  children: z.array(ContentBlock),
});

// ─── DOCUMENT ────────────────────────────────────────

export const ContentDocument = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(ContentBlock),
});

// ─── TYPE EXPORTS ────────────────────────────────────

export type ContentBlock = z.infer<typeof ContentBlock>;
export type ContentDocument = z.infer<typeof ContentDocument>;
export type MetricCardBlock = z.infer<typeof MetricCardBlock>;
export type StatusBadgeBlock = z.infer<typeof StatusBadgeBlock>;
export type DataTableBlock = z.infer<typeof DataTableBlock>;
export type CodeBlockBlock = z.infer<typeof CodeBlockBlock>;
export type ProgressBarBlock = z.infer<typeof ProgressBarBlock>;
export type MarkdownBlockBlock = z.infer<typeof MarkdownBlockBlock>;
export type ChartBlock = z.infer<typeof ChartBlock>;
export type DividerBlock = z.infer<typeof DividerBlock>;
export type ActionButtonBlock = z.infer<typeof ActionButtonBlock>;
export type QuickFormBlock = z.infer<typeof QuickFormBlock>;
export type StackBlock = z.infer<typeof StackBlock>;
export type SectionBlock = z.infer<typeof SectionBlock>;

// ─── BLOCK TYPE LIST (for catalogue endpoint) ────────

export const BLOCK_TYPES = [
  "metric-card", "status-badge", "data-table", "code-block",
  "progress-bar", "markdown", "chart", "divider",
  "action-button", "quick-form", "stack", "section",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
```

### 3.2 New file: `packages/shared/src/types/user-widget.ts`

```typescript
import type { ContentDocument } from "./content-blocks.js";

export interface UserWidgetDataSource {
  endpoint: string;
  params?: Record<string, unknown>;
  refreshInterval?: number; // seconds, minimum 60
}

export interface UserWidget {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  description: string | null;
  blocks: ContentDocument;
  dataSource: UserWidgetDataSource | null;
  position: number;
  span: number;
  createdByAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 New file: `packages/shared/src/types/inbox-item.ts`

```typescript
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
```

### 3.4 New file: `packages/shared/src/validators/content-blocks.ts`

```typescript
import { z } from "zod";
import { ContentDocument } from "../types/content-blocks.js";

/** Validation schema for content_blocks JSONB fields */
export const contentBlocksSchema = ContentDocument.optional().nullable();

/** Standalone validation — used by POST /blocks/validate */
export const validateContentDocumentSchema = z.object({
  document: ContentDocument,
});

export type ValidateContentDocument = z.infer<typeof validateContentDocumentSchema>;
```

### 3.5 New file: `packages/shared/src/validators/user-widget.ts`

```typescript
import { z } from "zod";
import { ContentDocument } from "../types/content-blocks.js";

export const createUserWidgetSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  blocks: ContentDocument,
  dataSource: z.object({
    endpoint: z.string().min(1),
    params: z.record(z.unknown()).optional(),
    refreshInterval: z.number().min(60).optional(),
  }).optional().nullable(),
  position: z.number().int().min(0).optional(),
  span: z.number().int().min(1).max(4).optional().default(2),
});

export type CreateUserWidget = z.infer<typeof createUserWidgetSchema>;

export const updateUserWidgetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  blocks: ContentDocument.optional(),
  dataSource: z.object({
    endpoint: z.string().min(1),
    params: z.record(z.unknown()).optional(),
    refreshInterval: z.number().min(60).optional(),
  }).optional().nullable(),
  position: z.number().int().min(0).optional(),
  span: z.number().int().min(1).max(4).optional(),
});

export type UpdateUserWidget = z.infer<typeof updateUserWidgetSchema>;
```

### 3.6 New file: `packages/shared/src/validators/inbox-item.ts`

```typescript
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
```

### 3.7 Modify: `packages/shared/src/validators/issue.ts`

Add `content_blocks` to the addIssueCommentSchema:

```typescript
// BEFORE:
export const addIssueCommentSchema = z.object({
  body: z.string().min(1),
  reopen: z.boolean().optional(),
  interrupt: z.boolean().optional(),
});

// AFTER:
import { ContentDocument } from "../types/content-blocks.js";

export const addIssueCommentSchema = z.object({
  body: z.string().min(1),
  contentBlocks: ContentDocument.optional().nullable(),
  reopen: z.boolean().optional(),
  interrupt: z.boolean().optional(),
});
```

### 3.8 Modify: `packages/shared/src/types/issue.ts`

Add `contentBlocks` to IssueComment:

```typescript
// BEFORE:
export interface IssueComment {
  id: string;
  companyId: string;
  issueId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

// AFTER:
import type { ContentDocument } from "./content-blocks.js";

export interface IssueComment {
  id: string;
  companyId: string;
  issueId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  contentBlocks: ContentDocument | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.9 Modify: `packages/shared/src/validators/index.ts`

Add new validator exports:

```typescript
// Add at end:
export { contentBlocksSchema, validateContentDocumentSchema } from "./content-blocks.js";
export type { ValidateContentDocument } from "./content-blocks.js";
export { createUserWidgetSchema, updateUserWidgetSchema } from "./user-widget.js";
export type { CreateUserWidget, UpdateUserWidget } from "./user-widget.js";
export {
  createInboxItemSchema,
  updateInboxItemSchema,
  inboxItemActionSchema,
  inboxItemFiltersSchema,
} from "./inbox-item.js";
export type {
  CreateInboxItem,
  UpdateInboxItem,
  InboxItemAction,
  InboxItemFilters,
} from "./inbox-item.js";
```

### 3.10 Modify: `packages/shared/src/types/index.ts`

Add new type exports:

```typescript
// Add at end:

// BLOCKS-PLATFORM: Content blocks catalogue
export {
  ContentDocument,
  ContentBlock,
  BLOCK_TYPES,
} from "./content-blocks.js";
export type {
  MetricCardBlock,
  StatusBadgeBlock,
  DataTableBlock,
  CodeBlockBlock,
  ProgressBarBlock,
  MarkdownBlockBlock,
  ChartBlock,
  DividerBlock,
  ActionButtonBlock,
  QuickFormBlock,
  StackBlock,
  SectionBlock,
  BlockType,
} from "./content-blocks.js";

// BLOCKS-PLATFORM: User widgets
export type { UserWidget, UserWidgetDataSource } from "./user-widget.js";

// BLOCKS-PLATFORM: Inbox items
export {
  INBOX_ITEM_CATEGORIES,
  INBOX_ITEM_PRIORITIES,
  INBOX_ITEM_STATUSES,
} from "./inbox-item.js";
export type {
  InboxItem,
  InboxItemCategory,
  InboxItemPriority,
  InboxItemStatus,
  InboxItemActionTaken,
} from "./inbox-item.js";
```

---

## 4. Server Changes

### 4.1 New schema files in `packages/db/src/schema/`

#### `packages/db/src/schema/user_widgets.ts`

```typescript
import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const userWidgets = pgTable(
  "user_widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    blocks: jsonb("blocks").notNull(),
    dataSource: jsonb("data_source"),
    position: integer("position").notNull().default(0),
    span: integer("span").notNull().default(2),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("idx_user_widgets_company_user").on(table.companyId, table.userId),
  }),
);
```

#### `packages/db/src/schema/inbox_items.ts`

```typescript
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";

export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    recipientId: text("recipient_id").notNull(),
    senderAgentId: uuid("sender_agent_id").references(() => agents.id, { onDelete: "set null" }),
    senderUserId: text("sender_user_id"),
    title: text("title").notNull(),
    body: text("body"),
    contentBlocks: jsonb("content_blocks"),
    category: text("category").notNull().default("notification"),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("unread"),
    actionTaken: jsonb("action_taken"),
    relatedIssueId: uuid("related_issue_id").references(() => issues.id, { onDelete: "set null" }),
    relatedAgentId: uuid("related_agent_id").references(() => agents.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    recipientIdx: index("idx_inbox_items_recipient").on(table.companyId, table.recipientId, table.status),
    createdIdx: index("idx_inbox_items_created").on(table.companyId, table.createdAt),
    categoryIdx: index("idx_inbox_items_category").on(table.companyId, table.recipientId, table.category),
  }),
);
```

#### Modify: `packages/db/src/schema/issue_comments.ts`

Add `contentBlocks` column:

```typescript
// Add to the column definitions in issueComments:
contentBlocks: jsonb("content_blocks"),
```

#### Modify: `packages/db/src/schema/index.ts`

Add exports:

```typescript
// BLOCKS-PLATFORM: User widgets
export { userWidgets } from "./user_widgets.js";
// BLOCKS-PLATFORM: Inbox items
export { inboxItems } from "./inbox_items.js";
```

### 4.2 New route files

#### `server/src/routes/user-widgets.ts`

```typescript
import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { userWidgets } from "@mnm/db";
import { createUserWidgetSchema, updateUserWidgetSchema } from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { badRequest, notFound } from "../errors.js";

export function userWidgetRoutes(db: Db) {
  const router = Router();

  // GET /my-widgets — List current user's custom widgets
  router.get(
    "/companies/:companyId/my-widgets",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.actor?.userId;
      if (!userId) { res.json([]); return; }

      const widgets = await db
        .select()
        .from(userWidgets)
        .where(and(eq(userWidgets.companyId, companyId), eq(userWidgets.userId, userId)))
        .orderBy(userWidgets.position);

      res.json(widgets);
    },
  );

  // POST /my-widgets ��� Create a custom widget
  router.post(
    "/companies/:companyId/my-widgets",
    validate(createUserWidgetSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.actor?.userId;
      if (!userId) throw badRequest("User ID required");

      const { title, description, blocks, dataSource, position, span } = req.body;

      const [created] = await db
        .insert(userWidgets)
        .values({
          companyId,
          userId,
          title,
          description: description ?? null,
          blocks,
          dataSource: dataSource ?? null,
          position: position ?? 0,
          span: span ?? 2,
          createdByAgentId: req.actor?.agentId ?? null,
        })
        .returning();

      res.status(201).json(created);
    },
  );

  // PATCH /my-widgets/:id — Update a widget
  router.patch(
    "/companies/:companyId/my-widgets/:widgetId",
    validate(updateUserWidgetSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const widgetId = req.params.widgetId as string;
      const userId = req.actor?.userId;
      if (!userId) throw badRequest("User ID required");

      const [existing] = await db
        .select()
        .from(userWidgets)
        .where(and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ));

      if (!existing) throw notFound("Widget not found");

      const updates: Partial<typeof userWidgets.$inferInsert> = { updatedAt: new Date() };
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.blocks !== undefined) updates.blocks = req.body.blocks;
      if (req.body.dataSource !== undefined) updates.dataSource = req.body.dataSource;
      if (req.body.position !== undefined) updates.position = req.body.position;
      if (req.body.span !== undefined) updates.span = req.body.span;

      const [updated] = await db
        .update(userWidgets)
        .set(updates)
        .where(and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ))
        .returning();

      res.json(updated);
    },
  );

  // DELETE /my-widgets/:id — Delete a widget
  router.delete(
    "/companies/:companyId/my-widgets/:widgetId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const widgetId = req.params.widgetId as string;
      const userId = req.actor?.userId;
      if (!userId) throw badRequest("User ID required");

      const [existing] = await db
        .select()
        .from(userWidgets)
        .where(and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ));

      if (!existing) throw notFound("Widget not found");

      await db
        .delete(userWidgets)
        .where(and(
          eq(userWidgets.id, widgetId),
          eq(userWidgets.companyId, companyId),
          eq(userWidgets.userId, userId),
        ));

      res.status(204).end();
    },
  );

  return router;
}
```

#### `server/src/routes/inbox-items.ts`

```typescript
import { Router } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { inboxItems } from "@mnm/db";
import {
  createInboxItemSchema,
  updateInboxItemSchema,
  inboxItemActionSchema,
  inboxItemFiltersSchema,
} from "@mnm/shared";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/require-permission.js";
import { badRequest, notFound } from "../errors.js";

export function inboxItemRoutes(db: Db) {
  const router = Router();

  // GET /inbox — List inbox items for current user
  router.get(
    "/companies/:companyId/inbox-items",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = req.actor?.userId;
      if (!userId) { res.json({ items: [], total: 0 }); return; }

      const filters = inboxItemFiltersSchema.parse(req.query);

      const conditions = [
        eq(inboxItems.companyId, companyId),
        eq(inboxItems.recipientId, userId),
      ];

      if (filters.status) conditions.push(eq(inboxItems.status, filters.status));
      if (filters.category) conditions.push(eq(inboxItems.category, filters.category));
      if (filters.priority) conditions.push(eq(inboxItems.priority, filters.priority));

      const [items, countResult] = await Promise.all([
        db.select()
          .from(inboxItems)
          .where(and(...conditions))
          .orderBy(desc(inboxItems.createdAt))
          .limit(filters.limit)
          .offset(filters.offset),
        db.select({ count: sql<number>`count(*)::int` })
          .from(inboxItems)
          .where(and(...conditions)),
      ]);

      res.json({
        items,
        total: countResult[0]?.count ?? 0,
      });
    },
  );

  // POST /inbox-items — Create an inbox item (agent API)
  router.post(
    "/companies/:companyId/inbox-items",
    validate(createInboxItemSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const actor = req.actor;

      const {
        recipientId,
        title,
        body,
        contentBlocks,
        category,
        priority,
        relatedIssueId,
        relatedAgentId,
        expiresAt,
      } = req.body;

      const [created] = await db
        .insert(inboxItems)
        .values({
          companyId,
          recipientId,
          senderAgentId: actor?.agentId ?? null,
          senderUserId: actor?.userId ?? null,
          title,
          body: body ?? null,
          contentBlocks: contentBlocks ?? null,
          category: category ?? "notification",
          priority: priority ?? "normal",
          relatedIssueId: relatedIssueId ?? null,
          relatedAgentId: relatedAgentId ?? null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        })
        .returning();

      // TODO: emit SSE event for real-time inbox update
      // emitLiveEvent(companyId, { type: "inbox_item_created", ... })

      res.status(201).json(created);
    },
  );

  // PATCH /inbox-items/:id — Update status (read, dismissed)
  router.patch(
    "/companies/:companyId/inbox-items/:itemId",
    validate(updateInboxItemSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const itemId = req.params.itemId as string;
      const userId = req.actor?.userId;
      if (!userId) throw badRequest("User ID required");

      const [existing] = await db
        .select()
        .from(inboxItems)
        .where(and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ));

      if (!existing) throw notFound("Inbox item not found");

      const updates: Partial<typeof inboxItems.$inferInsert> = {};
      if (req.body.status) updates.status = req.body.status;

      const [updated] = await db
        .update(inboxItems)
        .set(updates)
        .where(eq(inboxItems.id, itemId))
        .returning();

      res.json(updated);
    },
  );

  // POST /inbox-items/:id/action — Execute an action from a block
  router.post(
    "/companies/:companyId/inbox-items/:itemId/action",
    validate(inboxItemActionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const itemId = req.params.itemId as string;
      const userId = req.actor?.userId;
      if (!userId) throw badRequest("User ID required");

      const [existing] = await db
        .select()
        .from(inboxItems)
        .where(and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ));

      if (!existing) throw notFound("Inbox item not found");

      if (existing.status === "actioned") {
        throw badRequest("Action already taken on this item");
      }

      const actionTaken = {
        action: req.body.action,
        payload: req.body.payload ?? {},
        timestamp: new Date().toISOString(),
      };

      const [updated] = await db
        .update(inboxItems)
        .set({
          status: "actioned",
          actionTaken,
        })
        .where(eq(inboxItems.id, itemId))
        .returning();

      // The action handler logic routes to the appropriate service
      // based on the action string. This is extensible.
      // For now, the action is recorded and the client handles
      // the API call via useBlockActions().

      res.json(updated);
    },
  );

  // DELETE /inbox-items/:id — Delete an inbox item
  router.delete(
    "/companies/:companyId/inbox-items/:itemId",
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const itemId = req.params.itemId as string;
      const userId = req.actor?.userId;
      if (!userId) throw badRequest("User ID required");

      const [existing] = await db
        .select()
        .from(inboxItems)
        .where(and(
          eq(inboxItems.id, itemId),
          eq(inboxItems.companyId, companyId),
          eq(inboxItems.recipientId, userId),
        ));

      if (!existing) throw notFound("Inbox item not found");

      await db.delete(inboxItems).where(eq(inboxItems.id, itemId));
      res.status(204).end();
    },
  );

  return router;
}
```

#### `server/src/routes/block-catalogue.ts`

```typescript
import { Router } from "express";
import type { Db } from "@mnm/db";
import { ContentDocument, BLOCK_TYPES } from "@mnm/shared";
import zodToJsonSchema from "zod-to-json-schema";
import { validate } from "../middleware/validate.js";
import { validateContentDocumentSchema } from "@mnm/shared";

export function blockCatalogueRoutes(db: Db) {
  const router = Router();

  // GET /block-catalogue — Return JSON Schema for agent prompts
  router.get(
    "/companies/:companyId/block-catalogue",
    (_req, res) => {
      const jsonSchema = zodToJsonSchema(ContentDocument, {
        name: "ContentDocument",
        $refStrategy: "none",
      });

      res.json({
        schemaVersion: 1,
        blockTypes: BLOCK_TYPES,
        jsonSchema,
      });
    },
  );

  // POST /blocks/validate — Validate a ContentDocument
  router.post(
    "/companies/:companyId/blocks/validate",
    validate(validateContentDocumentSchema),
    (_req, res) => {
      // If validation passes (via the validate middleware), the document is valid
      res.json({ valid: true });
    },
  );

  return router;
}
```

> **Note**: The `zod-to-json-schema` package needs to be added as a dependency to `server/package.json`:
> ```bash
> cd server && bun add zod-to-json-schema
> ```

### 4.3 Modify existing routes

#### Modify: `server/src/routes/issues.ts`

In the `addComment` handler (line ~1005), pass `contentBlocks` through:

```typescript
// In POST /issues/:id/comments handler, after existing body extraction:
const commentBody = req.body.body;
const contentBlocks = req.body.contentBlocks ?? null;

// In the svc.addComment call, pass contentBlocks:
const comment = await svc.addComment(id, commentBody, actor, contentBlocks);
```

#### Modify: `server/src/services/issues.ts`

Update `addComment` to accept and store `contentBlocks`:

```typescript
// BEFORE (line ~1069):
addComment: async (issueId: string, body: string, actor: { agentId?: string; userId?: string }) => {

// AFTER:
addComment: async (
  issueId: string,
  body: string,
  actor: { agentId?: string; userId?: string },
  contentBlocks?: unknown | null,
) => {
  // ... existing issue lookup ...

  const [comment] = await db
    .insert(issueComments)
    .values({
      companyId: issue.companyId,
      issueId,
      authorAgentId: actor.agentId ?? null,
      authorUserId: actor.userId ?? null,
      body,
      contentBlocks: contentBlocks ?? null,
    })
    .returning();

  // ... rest unchanged ...
```

### 4.4 Modify: `server/src/routes/index.ts`

Add new route exports:

```typescript
// BLOCKS-PLATFORM: User widgets
export { userWidgetRoutes } from "./user-widgets.js";
// BLOCKS-PLATFORM: Inbox items
export { inboxItemRoutes } from "./inbox-items.js";
// BLOCKS-PLATFORM: Block catalogue
export { blockCatalogueRoutes } from "./block-catalogue.js";
```

### 4.5 Modify: `server/src/app.ts`

Mount new routes in the `api` Router, following the existing pattern:

```typescript
// Add imports:
import { userWidgetRoutes } from "./routes/user-widgets.js";
import { inboxItemRoutes } from "./routes/inbox-items.js";
import { blockCatalogueRoutes } from "./routes/block-catalogue.js";

// Mount alongside existing routes (after viewPresetRoutes):
// BLOCKS-PLATFORM: User widgets
api.use(userWidgetRoutes(db));
// BLOCKS-PLATFORM: Inbox items
api.use(inboxItemRoutes(db));
// BLOCKS-PLATFORM: Block catalogue
api.use(blockCatalogueRoutes(db));
```

---

## 5. Frontend Changes

### 5.1 Directory structure for blocks

```
ui/src/components/blocks/
  BlockRenderer.tsx         — Main entry: renders a single ContentBlock
  ContentRenderer.tsx       — Meta-component: blocks or markdown fallback
  MetricCardBlock.tsx       — metric-card renderer
  StatusBadgeBlock.tsx      — status-badge renderer
  DataTableBlock.tsx        — data-table renderer
  CodeBlockComp.tsx         — code-block renderer
  ProgressBarBlock.tsx      — progress-bar renderer
  MarkdownBlock.tsx         — markdown renderer (reuse MarkdownBody)
  ChartBlock.tsx            — chart renderer (simple SVG or recharts)
  DividerBlock.tsx          — divider renderer
  ActionButtonBlock.tsx     — action-button renderer
  QuickFormBlock.tsx        — quick-form renderer
  StackBlock.tsx            — stack layout renderer
  SectionBlock.tsx          — section layout renderer
  index.ts                  — barrel exports
```

### 5.2 `ui/src/components/blocks/BlockRenderer.tsx`

```tsx
import type { ContentBlock } from "@mnm/shared";
import { MetricCardBlock } from "./MetricCardBlock";
import { StatusBadgeBlock } from "./StatusBadgeBlock";
import { DataTableBlock } from "./DataTableBlock";
import { CodeBlockComp } from "./CodeBlockComp";
import { ProgressBarBlock } from "./ProgressBarBlock";
import { MarkdownBlock } from "./MarkdownBlock";
import { ChartBlock } from "./ChartBlock";
import { DividerBlock } from "./DividerBlock";
import { ActionButtonBlock } from "./ActionButtonBlock";
import { QuickFormBlock } from "./QuickFormBlock";
import { StackBlock } from "./StackBlock";
import { SectionBlock } from "./SectionBlock";

export interface BlockContext {
  /** Context for action handling: "issue", "inbox", "dashboard" */
  surface: "issue" | "inbox" | "dashboard";
  /** IDs relevant to the surface — issueId, inboxItemId, etc. */
  surfaceId?: string;
  companyId: string;
  /** Callback when an action is triggered */
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  /** Check if user has permission */
  hasPermission?: (key: string) => boolean;
}

interface BlockRendererProps {
  block: ContentBlock;
  context: BlockContext;
}

const BLOCK_COMPONENTS: Record<string, React.ComponentType<{ block: any; context: BlockContext }>> = {
  "metric-card": MetricCardBlock,
  "status-badge": StatusBadgeBlock,
  "data-table": DataTableBlock,
  "code-block": CodeBlockComp,
  "progress-bar": ProgressBarBlock,
  "markdown": MarkdownBlock,
  "chart": ChartBlock,
  "divider": DividerBlock,
  "action-button": ActionButtonBlock,
  "quick-form": QuickFormBlock,
  "stack": StackBlock,
  "section": SectionBlock,
};

export function BlockRenderer({ block, context }: BlockRendererProps) {
  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Unknown block type: {block.type}
      </div>
    );
  }
  return <Component block={block} context={context} />;
}
```

### 5.3 `ui/src/components/blocks/ContentRenderer.tsx`

The meta-component that decides between blocks or markdown:

```tsx
import type { ContentDocument } from "@mnm/shared";
import { BlockRenderer, type BlockContext } from "./BlockRenderer";
import { MarkdownBody } from "../MarkdownBody";

interface ContentRendererProps {
  /** The markdown body (always present as fallback) */
  body: string;
  /** Optional structured blocks */
  contentBlocks?: ContentDocument | null;
  /** Block action context */
  context: BlockContext;
  /** Additional className for the markdown fallback */
  className?: string;
}

export function ContentRenderer({
  body,
  contentBlocks,
  context,
  className,
}: ContentRendererProps) {
  // If valid content blocks exist, render them
  if (contentBlocks?.schemaVersion === 1 && contentBlocks.blocks?.length > 0) {
    return (
      <div className="space-y-2">
        {contentBlocks.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} context={context} />
        ))}
      </div>
    );
  }

  // Fallback to markdown body
  return <MarkdownBody className={className}>{body}</MarkdownBody>;
}
```

### 5.4 Individual block components

Each follows this pattern. Here are the key ones:

#### `MetricCardBlock.tsx`

```tsx
import type { MetricCardBlock as MetricCardBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export function MetricCardBlock({ block }: { block: MetricCardBlockType; context: BlockContext }) {
  const TrendIcon = block.trend ? TREND_ICONS[block.trend] : null;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{block.label}</p>
        {TrendIcon && (
          <TrendIcon className={`h-3.5 w-3.5 ${
            block.trend === "up" ? "text-green-500" :
            block.trend === "down" ? "text-red-500" :
            "text-muted-foreground"
          }`} />
        )}
      </div>
      <p className="text-lg font-semibold mt-0.5">{block.value}</p>
      {block.description && (
        <p className="text-xs text-muted-foreground mt-0.5">{block.description}</p>
      )}
    </Card>
  );
}
```

#### `ActionButtonBlock.tsx`

```tsx
import { useState } from "react";
import type { ActionButtonBlock as ActionButtonBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ActionButtonBlock({ block, context }: { block: ActionButtonBlockType; context: BlockContext }) {
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);

  const isDisabled = block.permission && context.hasPermission
    ? !context.hasPermission(block.permission)
    : false;

  async function handleClick() {
    if (block.confirm) {
      setConfirming(true);
      return;
    }
    await execute();
  }

  async function execute() {
    setExecuting(true);
    setConfirming(false);
    try {
      await context.onAction(block.action, block.payload);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <>
      <Button
        variant={block.variant ?? "default"}
        size="sm"
        disabled={isDisabled || executing}
        onClick={handleClick}
        title={isDisabled ? "You don't have permission for this action" : undefined}
      >
        {executing ? "..." : block.label}
      </Button>

      {block.confirm && (
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm action</DialogTitle>
              <DialogDescription>{block.confirm}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant={block.variant ?? "default"} onClick={execute} disabled={executing}>
                {executing ? "..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
```

#### `QuickFormBlock.tsx`

```tsx
import { useState } from "react";
import type { QuickFormBlock as QuickFormBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuickFormBlock({ block, context }: { block: QuickFormBlockType; context: BlockContext }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const field of block.fields) {
      init[field.name] = field.defaultValue ?? (field.type === "checkbox" ? false : "");
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  function setValue(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await context.onAction(block.submitAction, {
        ...block.submitPayload,
        formData: values,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border rounded-md p-3">
      {block.title && <p className="text-sm font-medium">{block.title}</p>}
      {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}

      {block.fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <Label htmlFor={`qf-${field.name}`} className="text-xs">
            {field.label}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </Label>

          {field.type === "text" && (
            <Input
              id={`qf-${field.name}`}
              value={values[field.name] as string}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}

          {field.type === "textarea" && (
            <Textarea
              id={`qf-${field.name}`}
              value={values[field.name] as string}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}

          {field.type === "number" && (
            <Input
              id={`qf-${field.name}`}
              type="number"
              value={values[field.name] as string}
              onChange={(e) => setValue(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}

          {field.type === "date" && (
            <Input
              id={`qf-${field.name}`}
              type="date"
              value={values[field.name] as string}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.required}
            />
          )}

          {field.type === "select" && field.options && (
            <Select
              value={values[field.name] as string}
              onValueChange={(v) => setValue(field.name, v)}
            >
              <SelectTrigger id={`qf-${field.name}`}>
                <SelectValue placeholder={field.placeholder ?? "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === "checkbox" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`qf-${field.name}`}
                checked={!!values[field.name]}
                onCheckedChange={(v) => setValue(field.name, v)}
              />
              <span className="text-xs">{field.placeholder}</span>
            </div>
          )}
        </div>
      ))}

      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Submitting..." : block.submitLabel ?? "Submit"}
      </Button>
    </form>
  );
}
```

#### `StackBlock.tsx` (recursive)

```tsx
import type { StackBlock as StackBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { BlockRenderer } from "./BlockRenderer";
import { cn } from "@/lib/utils";

const GAP_CLASSES = { sm: "gap-1", md: "gap-2", lg: "gap-4" };

export function StackBlock({ block, context }: { block: StackBlockType; context: BlockContext }) {
  const direction = block.direction ?? "vertical";
  const gap = GAP_CLASSES[block.gap ?? "md"];

  return (
    <div className={cn(
      "flex",
      direction === "horizontal" ? "flex-row flex-wrap items-start" : "flex-col",
      gap,
    )}>
      {block.children.map((child, i) => (
        <BlockRenderer key={i} block={child} context={context} />
      ))}
    </div>
  );
}
```

#### `SectionBlock.tsx` (recursive)

```tsx
import { useState } from "react";
import type { SectionBlock as SectionBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { BlockRenderer } from "./BlockRenderer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionBlock({ block, context }: { block: SectionBlockType; context: BlockContext }) {
  const [open, setOpen] = useState(true);

  if (!block.collapsible) {
    return (
      <div className="space-y-2">
        {block.title && <p className="text-sm font-medium">{block.title}</p>}
        {block.children.map((child, i) => (
          <BlockRenderer key={i} block={child} context={context} />
        ))}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:text-foreground">
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {block.title}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1 ml-4">
        {block.children.map((child, i) => (
          <BlockRenderer key={i} block={child} context={context} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

#### Remaining simple block components

| Component | File | Renders as |
|-----------|------|------------|
| `StatusBadgeBlock` | `StatusBadgeBlock.tsx` | `<Badge>` with variant color mapping |
| `DataTableBlock` | `DataTableBlock.tsx` | Simple `<table>` with columns/rows, optional maxRows |
| `CodeBlockComp` | `CodeBlockComp.tsx` | `<pre><code>` with optional title and copy button |
| `ProgressBarBlock` | `ProgressBarBlock.tsx` | Label + `<div>` bar with width percentage |
| `MarkdownBlock` | `MarkdownBlock.tsx` | Delegates to `<MarkdownBody>` component |
| `ChartBlock` | `ChartBlock.tsx` | Simple bar/pie chart using CSS or recharts |
| `DividerBlock` | `DividerBlock.tsx` | `<Separator />` from shadcn/ui |

Each follows the signature:
```tsx
export function XxxBlock({ block, context }: { block: XxxBlockType; context: BlockContext }) { ... }
```

### 5.5 `ui/src/hooks/useBlockActions.ts`

```tsx
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useCompany } from "../context/CompanyContext";
import { usePermissions } from "./usePermissions";
import type { BlockContext } from "../components/blocks/BlockRenderer";
import { queryKeys } from "../lib/queryKeys";

interface UseBlockActionsOptions {
  surface: "issue" | "inbox" | "dashboard";
  surfaceId?: string;
}

/**
 * Unified action handler for all block surfaces.
 *
 * Routes actions based on the surface:
 * - issue: posts a reply comment with action data
 * - inbox: calls POST /inbox-items/:id/action
 * - dashboard: no actions (display only)
 */
export function useBlockActions({ surface, surfaceId }: UseBlockActionsOptions) {
  const { selectedCompanyId } = useCompany();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload?: Record<string, unknown> }) => {
      if (!selectedCompanyId) throw new Error("No company selected");

      if (surface === "inbox" && surfaceId) {
        // Record action on the inbox item
        return api.post(
          `/companies/${selectedCompanyId}/inbox-items/${surfaceId}/action`,
          { action, payload },
        );
      }

      if (surface === "issue" && surfaceId) {
        // Post a structured reply as a new comment on the issue
        const body = `**Action:** ${action}${payload ? `\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` : ""}`;
        return api.post(
          `/companies/${selectedCompanyId}/issues/${surfaceId}/comments`,
          { body },
        );
      }

      throw new Error(`Unsupported action surface: ${surface}`);
    },
    onSuccess: () => {
      if (surface === "inbox" && selectedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.inboxItems.list(selectedCompanyId) });
      }
      if (surface === "issue" && surfaceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(surfaceId) });
      }
    },
  });

  const onAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      await actionMutation.mutateAsync({ action, payload });
    },
    [actionMutation],
  );

  const context: BlockContext = {
    surface,
    surfaceId,
    companyId: selectedCompanyId ?? "",
    onAction,
    hasPermission,
  };

  return { context, isExecuting: actionMutation.isPending };
}
```

### 5.6 New API client: `ui/src/api/user-widgets.ts`

```typescript
import { api } from "./client";
import type { UserWidget } from "@mnm/shared";

export const userWidgetsApi = {
  list: (companyId: string) =>
    api.get<UserWidget[]>(`/companies/${companyId}/my-widgets`),

  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<UserWidget>(`/companies/${companyId}/my-widgets`, data),

  update: (companyId: string, widgetId: string, data: Record<string, unknown>) =>
    api.patch<UserWidget>(`/companies/${companyId}/my-widgets/${widgetId}`, data),

  delete: (companyId: string, widgetId: string) =>
    api.delete(`/companies/${companyId}/my-widgets/${widgetId}`),
};
```

### 5.7 New API client: `ui/src/api/inbox-items.ts`

```typescript
import { api } from "./client";
import type { InboxItem } from "@mnm/shared";

export interface InboxItemsListResponse {
  items: InboxItem[];
  total: number;
}

export const inboxItemsApi = {
  list: (companyId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<InboxItemsListResponse>(`/companies/${companyId}/inbox-items${qs}`);
  },

  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<InboxItem>(`/companies/${companyId}/inbox-items`, data),

  update: (companyId: string, itemId: string, data: Record<string, unknown>) =>
    api.patch<InboxItem>(`/companies/${companyId}/inbox-items/${itemId}`, data),

  action: (companyId: string, itemId: string, data: { action: string; payload?: Record<string, unknown> }) =>
    api.post<InboxItem>(`/companies/${companyId}/inbox-items/${itemId}/action`, data),

  delete: (companyId: string, itemId: string) =>
    api.delete(`/companies/${companyId}/inbox-items/${itemId}`),
};
```

### 5.8 Modify: `ui/src/lib/queryKeys.ts`

Add new query keys:

```typescript
// Add alongside existing keys:
userWidgets: {
  list: (companyId: string) => ["user-widgets", companyId] as const,
},
inboxItems: {
  list: (companyId: string) => ["inbox-items", companyId] as const,
  detail: (companyId: string, itemId: string) => ["inbox-items", companyId, itemId] as const,
},
```

### 5.9 Modify: `ui/src/components/CommentThread.tsx`

The `TimelineList` component (line ~126) renders each comment with `<MarkdownBody>`. Change to use `<ContentRenderer>`:

**In the comment rendering section (line ~215):**

```tsx
// BEFORE:
<MarkdownBody className="text-sm">{comment.body}</MarkdownBody>

// AFTER:
import { ContentRenderer } from "./blocks/ContentRenderer";
import { useBlockActions } from "../hooks/useBlockActions";

// Inside the TimelineList component, need a context. Since TimelineList is a pure 
// rendering component, pass the context from the parent CommentThread:

// In CommentThread (the parent), create the context:
const { context: blockContext } = useBlockActions({
  surface: "issue",
  surfaceId: issueId,
});

// Pass it to TimelineList as a prop, then in the comment rendering:
<ContentRenderer
  body={comment.body}
  contentBlocks={comment.contentBlocks}
  context={blockContext}
  className="text-sm"
/>
```

The `CommentThread` component already receives `issueId` as a prop, so this is straightforward.

**CommentThreadProps** update:

```typescript
// No new props needed — issueId is already available.
// useBlockActions is called inside CommentThread.
```

### 5.10 Modify: `ui/src/components/DashboardGrid.tsx`

Add hybrid rendering — predefined widgets from WIDGET_REGISTRY + custom widgets via BlockRenderer:

```tsx
// BEFORE: Only renders predefined widgets
// AFTER: Renders predefined + custom widgets

import { Suspense } from "react";
import type { DashboardWidget, UserWidget } from "@mnm/shared";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { BlockRenderer, type BlockContext } from "./blocks/BlockRenderer";
import { cn } from "../lib/utils";

const SPAN_CLASSES: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-1 md:col-span-2",
  3: "col-span-1 md:col-span-3",
  4: "col-span-1 md:col-span-4",
};

function WidgetSkeleton() {
  return <div className="animate-pulse bg-muted rounded-lg min-h-[120px]" />;
}

interface DashboardGridProps {
  companyId: string;
  widgets: DashboardWidget[];
  customWidgets?: UserWidget[];
  blockContext?: BlockContext;
}

export function DashboardGrid({ companyId, widgets, customWidgets, blockContext }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Predefined widgets from View Preset */}
      {widgets.map((widget, i) => {
        const def = WIDGET_REGISTRY[widget.type];
        if (!def) return null;
        const Widget = def.component;
        const span = widget.span ?? def.defaultSpan;
        return (
          <div key={`${widget.type}-${i}`} className={cn(SPAN_CLASSES[span] ?? "col-span-1")}>
            <Suspense fallback={<WidgetSkeleton />}>
              <Widget companyId={companyId} span={span} props={widget.props} />
            </Suspense>
          </div>
        );
      })}

      {/* Custom AI-generated widgets */}
      {customWidgets?.map((widget) => {
        const span = widget.span ?? 2;
        const doc = widget.blocks;
        if (!doc?.blocks?.length || !blockContext) return null;
        return (
          <div key={widget.id} className={cn(SPAN_CLASSES[span] ?? "col-span-1", "border rounded-lg p-3")}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{widget.title}</p>
            </div>
            <div className="space-y-2">
              {doc.blocks.map((block, i) => (
                <BlockRenderer key={i} block={block} context={blockContext} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 5.11 Modify: `ui/src/pages/Dashboard.tsx`

Fetch custom widgets and pass to DashboardGrid:

```tsx
// Add imports:
import { useQuery } from "@tanstack/react-query";
import { userWidgetsApi } from "../api/user-widgets";
import { useBlockActions } from "../hooks/useBlockActions";

// Inside Dashboard component, add:
const { data: customWidgets } = useQuery({
  queryKey: queryKeys.userWidgets.list(selectedCompanyId!),
  queryFn: () => userWidgetsApi.list(selectedCompanyId!),
  enabled: !!selectedCompanyId,
});

const { context: dashboardBlockContext } = useBlockActions({
  surface: "dashboard",
});

// Update the DashboardGrid usage:
<DashboardGrid
  companyId={selectedCompanyId!}
  widgets={layout.dashboard.widgets}
  customWidgets={customWidgets}
  blockContext={dashboardBlockContext}
/>
```

### 5.12 Inbox page updates

The existing `Inbox.tsx` is a large component (~400 lines) that aggregates data from multiple sources (issues, approvals, failed runs, stale work). The new `inbox_items` table will be an **additional source** alongside the existing ones.

**Approach**: Add a new section/tab for "Agent Notifications" that queries `inbox_items`. The existing categories remain unchanged initially.

```tsx
// In Inbox.tsx, add:
import { useQuery } from "@tanstack/react-query";
import { inboxItemsApi } from "../api/inbox-items";
import { ContentRenderer } from "../components/blocks/ContentRenderer";
import { useBlockActions } from "../hooks/useBlockActions";

// Inside Inbox component:
const { data: inboxItemsData } = useQuery({
  queryKey: queryKeys.inboxItems.list(selectedCompanyId!),
  queryFn: () => inboxItemsApi.list(selectedCompanyId!),
  enabled: !!selectedCompanyId,
});

// Add to the category filter type:
// "agent_notifications" as a new InboxCategoryFilter option

// Render inbox items with ContentRenderer in the appropriate section
```

### 5.13 Admin View Presets page (F1 gap)

**File**: `ui/src/pages/AdminViewPresets.tsx`

A CRUD page for managing view presets and assigning them to roles. This follows existing admin page patterns (like `/admin/roles` and `/admin/tags`).

Key features:
- List all presets with name, slug, icon, color, isDefault
- Create/edit preset (name, slug, layout JSON editor or structured form)
- Assign preset to roles (dropdown on the role edit page)
- Set default preset

This page should be registered in the router and in `NAV_ITEM_REGISTRY` (add a `"view-presets"` NavItemId pointing to `/admin/view-presets` with permission `"roles:manage"`).

---

## 6. Dependency Map & Critical Path

### Build Order

```
Phase 1: Foundation (MUST be first)
├── 6.1  Migration 0058 (user_widgets + issue_comments.content_blocks)
├── 6.2  Migration 0059 (inbox_items)
├── 6.3  DB schema files (user_widgets.ts, inbox_items.ts, modify issue_comments.ts)
├── 6.4  Shared types (content-blocks.ts, user-widget.ts, inbox-item.ts)
��── 6.5  Shared validators (content-blocks.ts, user-widget.ts, inbox-item.ts, modify issue.ts)
├── 6.6  Shared type/validator index exports
└── 6.7  DB schema index exports

Phase 2: Block rendering (depends on Phase 1 types)
├── 6.8  All block components (ui/src/components/blocks/*.tsx)
├── 6.9  BlockRenderer.tsx
├── 6.10 ContentRenderer.tsx
└── 6.11 useBlockActions.ts hook

Phase 3: Server routes (depends on Phase 1)
├── 6.12 block-catalogue.ts route
├── 6.13 user-widgets.ts route
├── 6.14 inbox-items.ts route
├── 6.15 Modify issues.ts route (accept content_blocks)
��── 6.16 Modify issues service (pass content_blocks)
├── 6.17 Mount routes in app.ts
└─��� 6.18 Route barrel exports in routes/index.ts

Phase 4: Frontend integration (depends on Phase 2 + 3)
├── 6.19 API clients (user-widgets.ts, inbox-items.ts)
├── 6.20 queryKeys updates
├── 6.21 Modify CommentThread.tsx (use ContentRenderer)
├── 6.22 Modify DashboardGrid.tsx (hybrid rendering)
├── 6.23 Modify Dashboard.tsx (fetch custom widgets)
├── 6.24 Modify Inbox.tsx (add inbox_items section)
└── 6.25 AdminViewPresets.tsx page (F1 gap)
```

### Critical Path

```
content-blocks.ts (types) → BlockRenderer.tsx → ContentRenderer.tsx
                                                      ↓
                                              CommentThread.tsx modification
                                              DashboardGrid.tsx modification
                                              Inbox.tsx modification
```

### Parallel Work Opportunities

These can be done in parallel by different teams:

1. **Team A**: Migrations + schema + shared types/validators (Phase 1)
2. **Team B**: Block components (can start once types are defined, Phase 2)
3. **Team C**: Server routes (can start once schema + validators exist, Phase 3)
4. **Team D**: Frontend integration (needs Phase 2 + 3, Phase 4)

In practice, Team A finishes first, then B+C in parallel, then D.

---

## 7. API Contract Details

### 7.1 Block Catalogue

**`GET /companies/:companyId/block-catalogue`**

Response:
```json
{
  "schemaVersion": 1,
  "blockTypes": ["metric-card", "status-badge", ...],
  "jsonSchema": { /* JSON Schema from zod-to-json-schema */ }
}
```

**`POST /companies/:companyId/blocks/validate`**

Request:
```json
{
  "document": {
    "schemaVersion": 1,
    "blocks": [{ "type": "metric-card", "label": "Test", "value": 42 }]
  }
}
```

Response (200): `{ "valid": true }`
Response (400): Zod validation error

### 7.2 User Widgets

**`GET /companies/:companyId/my-widgets`**

Response: `UserWidget[]`

**`POST /companies/:companyId/my-widgets`**

Request:
```json
{
  "title": "Burn-down — Equipe Product",
  "blocks": {
    "schemaVersion": 1,
    "blocks": [{ "type": "metric-card", "label": "Open", "value": 12 }]
  },
  "dataSource": {
    "endpoint": "/api/companies/{companyId}/issues",
    "params": { "status": ["open"] },
    "refreshInterval": 300
  },
  "span": 4
}
```

Response (201): `UserWidget`

**`PATCH /companies/:companyId/my-widgets/:widgetId`**

Request: Partial `{ title?, blocks?, dataSource?, position?, span? }`
Response: `UserWidget`

**`DELETE /companies/:companyId/my-widgets/:widgetId`**

Response: 204

### 7.3 Inbox Items

**`GET /companies/:companyId/inbox-items?status=unread&category=alert&limit=50&offset=0`**

Response:
```json
{
  "items": [InboxItem, ...],
  "total": 42
}
```

**`POST /companies/:companyId/inbox-items`** (agent API)

Request:
```json
{
  "recipientId": "user-id-xxx",
  "title": "Cost spike detected — DataPipeline",
  "body": "Agent DataPipeline consumed $45 in 2h",
  "contentBlocks": {
    "schemaVersion": 1,
    "blocks": [
      { "type": "metric-card", "label": "Cost 2h", "value": "$45", "trend": "up" },
      { "type": "action-button", "label": "Pause agent", "action": "pause-agent", "payload": { "agentId": "xxx" } }
    ]
  },
  "category": "alert",
  "priority": "high",
  "relatedAgentId": "agent-uuid"
}
```

Response (201): `InboxItem`

**`PATCH /companies/:companyId/inbox-items/:id`**

Request: `{ "status": "read" }`
Response: `InboxItem`

**`POST /companies/:companyId/inbox-items/:id/action`**

Request: `{ "action": "pause-agent", "payload": { "agentId": "xxx" } }`
Response: `InboxItem` (with actionTaken populated)

**`DELETE /companies/:companyId/inbox-items/:id`**

Response: 204

### 7.4 Issue Comments (modified)

**`POST /companies/:companyId/issues/:id/comments`** (existing, extended)

Request:
```json
{
  "body": "CI/CD report",
  "contentBlocks": {
    "schemaVersion": 1,
    "blocks": [
      { "type": "metric-card", "label": "Tests", "value": "47/50" },
      { "type": "action-button", "label": "Retry", "action": "retry-tests" }
    ]
  }
}
```

Response: `IssueComment` (now includes `contentBlocks` field)

**`GET /companies/:companyId/issues/:id/comments`** (existing, unchanged)

Response: `IssueComment[]` — each may have `contentBlocks: null | ContentDocument`

### 7.5 Content Blocks Validation

All JSONB `content_blocks` fields are validated server-side:
- **User widgets**: `blocks` field validated via `createUserWidgetSchema` (which includes `ContentDocument`)
- **Issue comments**: `contentBlocks` field validated via the updated `addIssueCommentSchema`
- **Inbox items**: `contentBlocks` field validated via `createInboxItemSchema`

If validation fails, the standard Zod error middleware returns a 400 with details.

---

## 8. Conventions to Follow

### 8.1 Route Patterns (from existing code)

All routes follow this pattern from `server/src/routes/view-presets.ts`:

```typescript
export function xxxRoutes(db: Db) {
  const router = Router();

  router.get(
    "/companies/:companyId/xxx",
    requirePermission(db, "xxx:read"),  // or skip for user-scoped
    async (req, res) => {
      const companyId = req.params.companyId as string;
      // ... logic ...
      res.json(result);
    },
  );

  return router;
}
```

- Routes take `(db: Db)` factory parameter
- Routes use `/companies/:companyId/` prefix (auto-rewritten by tenant middleware)
- Use `requirePermission(db, "key")` middleware for admin routes
- Use `req.actor?.userId` for user-scoped routes (no permission check needed)
- Error helpers: `badRequest()`, `notFound()`, `forbidden()` from `../errors.js`
- Validation via `validate(zodSchema)` middleware
- Return `res.status(201).json(created)` for creates, `res.status(204).end()` for deletes

### 8.2 Schema Patterns (from existing code)

```typescript
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const tableName = pgTable(
  "table_name",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // ... columns ...
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    xxxIdx: index("xxx_idx").on(table.column),
  }),
);
```

### 8.3 Frontend API Client Pattern (from `ui/src/api/view-presets.ts`)

```typescript
import { api } from "./client";
import type { TypeName } from "@mnm/shared";

export const xxxApi = {
  list: (companyId: string) =>
    api.get<TypeName[]>(`/companies/${companyId}/xxx`),
  create: (companyId: string, data: Partial<TypeName>) =>
    api.post<TypeName>(`/companies/${companyId}/xxx`, data),
  // ...
};
```

### 8.4 React Query Pattern (from `ui/src/hooks/useViewPreset.ts`)

```typescript
const { data, isLoading } = useQuery({
  queryKey: queryKeys.xxx.list(companyId!),
  queryFn: () => xxxApi.list(companyId!),
  enabled: !!companyId,
  staleTime: 60_000,  // optional
});
```

### 8.5 Component Patterns

- Use shadcn/ui components from `@/components/ui/` (Card, Button, Dialog, Input, Select, etc.)
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Use Lucide icons from `lucide-react`
- Follow existing component structure: export named function components
- No inline custom UI primitives

### 8.6 Migration Patterns

- SQL files in `packages/db/src/migrations/` (source) and `packages/db/dist/migrations/` (built)
- Use `IF NOT EXISTS` / `IF NOT EXISTS` for idempotency
- Include all indexes in the migration
- Number sequentially after the latest (0058, 0059)

### 8.7 Rules (from CLAUDE.md)

- **NEVER use polling** — all real-time updates via SSE/WebSocket (`/events/ws`)
- **Dynamic RBAC** — permissions from DB, never hardcoded
- **Tag-based isolation** — enforced via TagScope middleware (user-scoped routes bypass this since they're self-scoped)
- **Single-tenant** — `company_id` auto-injected via tenant middleware
- **content_blocks is OPTIONAL** — always coexists with `body` TEXT. If blocks are invalid or absent, fall back to markdown body

---

## Appendix: Dependency Install

One new server dependency needed:

```bash
cd server && bun add zod-to-json-schema
```

No new frontend dependencies — all block renderers use existing shadcn/ui components.
