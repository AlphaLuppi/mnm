# Folder Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform folders into full workspaces with native document upload, markdown instructions injected into chat system prompts, granular user+tag sharing (derived visibility), and a 3-column workspace layout.

**Architecture:** Drop stored `visibility` column. Visibility is derived from ownership, `folder_shares` (user-level), and `tag_assignments` (group-level). New `folder_shares` table for user sharing. `documents.ownedByFolderId` distinguishes native vs imported documents. Folder instructions are injected before agent prompt in `buildSystemPrompt()`. Frontend adds workspace mode at `/folders/:folderId/chat/:channelId` with 3-column layout.

**Tech Stack:** PostgreSQL + Drizzle ORM, Express, React 18, React Query, Tailwind CSS, Zod, Anthropic API

---

## File Structure

### New files
- `packages/db/src/schema/folder_shares.ts` — Drizzle schema for folder_shares table
- `packages/db/src/migrations/0056_folder_workspace.sql` — Migration: drop visibility, add instructions, create folder_shares, add ownedByFolderId
- `server/src/services/folder-share.ts` — Folder sharing service (CRUD for folder_shares)
- `ui/src/pages/FolderWorkspace.tsx` — 3-column workspace layout page
- `ui/src/components/folders/FolderSidebar.tsx` — Left sidebar (instructions, docs, shares)
- `ui/src/components/folders/FolderShareManager.tsx` — Share management UI (users + tags)
- `ui/src/components/folders/FolderDeleteDialog.tsx` — Smart delete dialog with document preservation

### Modified files
- `packages/db/src/schema/folders.ts` — Drop visibility, add instructions
- `packages/db/src/schema/documents.ts` — Add ownedByFolderId
- `packages/db/src/schema/index.ts` — Export folderShares
- `packages/shared/src/types/folders.ts` — Remove FolderVisibility, update Folder interface, add FolderShare type
- `packages/shared/src/validators/folders.ts` — Remove FOLDER_VISIBILITIES + visibility field, add instructions, add share schemas
- `packages/shared/src/index.ts` — Update exports
- `server/src/services/permission-seed.ts` — Replace folders:share with folders:share_users + folders:share_tags
- `server/src/services/folder.ts` — Major refactor: derived visibility, editor check on update, smart delete
- `server/src/routes/folders.ts` — Update existing routes, add shares/upload/deletion-preview routes
- `server/src/services/chat-completion.ts` — Inject folder instructions in buildSystemPrompt
- `ui/src/api/folders.ts` — Add shares API, upload, deletion-preview
- `ui/src/lib/queryKeys.ts` — Add folder shares query keys
- `ui/src/App.tsx` — Add workspace route
- `ui/src/pages/Folders.tsx` — Remove visibility filter, always private on create
- `ui/src/pages/FolderDetail.tsx` — Remove visibility UI, add instructions editor, add shares section, add conversations list
- `ui/src/components/folders/FolderCard.tsx` — Show tag badges directly
- `ui/src/components/folders/FolderItemList.tsx` — Distinguish native vs imported visually

---

### Task 1: SQL Migration 0056

**Files:**
- Create: `packages/db/src/migrations/0056_folder_workspace.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- 0056_folder_workspace.sql
-- Folder Workspace: drop visibility, add instructions, create folder_shares, add ownedByFolderId

-- 1. Drop visibility column (early-stage, no prod data to migrate)
DROP INDEX IF EXISTS "folders_company_visibility_idx";
ALTER TABLE "folders" DROP COLUMN IF EXISTS "visibility";

-- 2. Add instructions column
ALTER TABLE "folders" ADD COLUMN "instructions" text;

-- 3. Create folder_shares table
CREATE TABLE IF NOT EXISTS "folder_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "folder_id" uuid NOT NULL REFERENCES "folders"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "shared_with_user_id" text NOT NULL,
  "permission" text NOT NULL DEFAULT 'viewer',
  "shared_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("folder_id", "shared_with_user_id")
);

CREATE INDEX "folder_shares_folder_idx" ON "folder_shares"("folder_id");
CREATE INDEX "folder_shares_user_idx" ON "folder_shares"("shared_with_user_id", "company_id");

-- 4. Add ownedByFolderId to documents
ALTER TABLE "documents" ADD COLUMN "owned_by_folder_id" uuid REFERENCES "folders"("id") ON DELETE SET NULL;
CREATE INDEX "documents_owned_folder_idx" ON "documents"("owned_by_folder_id");

-- 5. Update permissions: replace folders:share with folders:share_users + folders:share_tags
DELETE FROM "role_permissions" WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "slug" = 'folders:share'
);
DELETE FROM "permissions" WHERE "slug" = 'folders:share';

-- New permissions will be seeded by permission-seed.ts on next startup
```

- [ ] **Step 2: Add migration to Drizzle journal**

Read `packages/db/src/migrations/meta/_journal.json`, add entry for 0056_folder_workspace.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0056_folder_workspace.sql packages/db/src/migrations/meta/_journal.json
git commit -m "feat(db): add migration 0056 — folder workspace (shares, instructions, ownedByFolderId)"
```

---

### Task 2: Drizzle Schema — folder_shares + updates to folders & documents

**Files:**
- Create: `packages/db/src/schema/folder_shares.ts`
- Modify: `packages/db/src/schema/folders.ts`
- Modify: `packages/db/src/schema/documents.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create folder_shares.ts**

```typescript
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { folders } from "./folders.js";

export const folderShares = pgTable(
  "folder_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    folderId: uuid("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    sharedWithUserId: text("shared_with_user_id").notNull(),
    permission: text("permission").notNull().default("viewer"),
    sharedByUserId: text("shared_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueShare: uniqueIndex("folder_shares_unique_idx").on(table.folderId, table.sharedWithUserId),
    folderIdx: index("folder_shares_folder_idx").on(table.folderId),
    userIdx: index("folder_shares_user_idx").on(table.sharedWithUserId, table.companyId),
  }),
);
```

- [ ] **Step 2: Update folders.ts — drop visibility, add instructions**

In `packages/db/src/schema/folders.ts`:
- Remove the `visibility` field
- Remove the `companyVisibilityIdx` index
- Add `instructions: text("instructions")`

```typescript
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    instructions: text("instructions"),
    ownerUserId: text("owner_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOwnerIdx: index("folders_company_owner_idx").on(table.companyId, table.ownerUserId),
  }),
);
```

- [ ] **Step 3: Update documents.ts — add ownedByFolderId**

In `packages/db/src/schema/documents.ts`, add after `createdByUserId`:

```typescript
ownedByFolderId: uuid("owned_by_folder_id").references(() => folders.id, { onDelete: "set null" }),
```

Add import: `import { folders } from "./folders.js";`

Add to indexes:
```typescript
ownedFolderIdx: index("documents_owned_folder_idx").on(table.ownedByFolderId),
```

- [ ] **Step 4: Update schema/index.ts — export folderShares**

Add to `packages/db/src/schema/index.ts`:
```typescript
export { folderShares } from "./folder_shares.js";
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/folder_shares.ts packages/db/src/schema/folders.ts packages/db/src/schema/documents.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add folder_shares schema, drop visibility, add instructions + ownedByFolderId"
```

---

### Task 3: Shared Types & Validators

**Files:**
- Modify: `packages/shared/src/types/folders.ts`
- Modify: `packages/shared/src/validators/folders.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update types/folders.ts**

```typescript
export type FolderItemType = "artifact" | "document" | "channel";

export type FolderSharePermission = "viewer" | "editor";

export interface FolderShare {
  id: string;
  folderId: string;
  companyId: string;
  sharedWithUserId: string;
  permission: FolderSharePermission;
  sharedByUserId: string;
  createdAt: string;
}

export interface FolderItem {
  id: string;
  folderId: string;
  companyId: string;
  itemType: FolderItemType;
  artifactId: string | null;
  documentId: string | null;
  channelId: string | null;
  displayName: string | null;
  addedByUserId: string | null;
  addedAt: string;
}

export interface Folder {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  icon: string | null;
  instructions: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  canEdit?: boolean;
}
```

- [ ] **Step 2: Update validators/folders.ts**

```typescript
import { z } from "zod";

export const FOLDER_ITEM_TYPES = ["artifact", "document", "channel"] as const;
export const FOLDER_SHARE_PERMISSIONS = ["viewer", "editor"] as const;

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
});

export type CreateFolder = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
  instructions: z.string().max(10000).optional().nullable(),
});

export type UpdateFolder = z.infer<typeof updateFolderSchema>;

export const addFolderItemSchema = z.object({
  itemType: z.enum(FOLDER_ITEM_TYPES),
  artifactId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  channelId: z.string().uuid().optional().nullable(),
  displayName: z.string().max(255).optional().nullable(),
});

export type AddFolderItem = z.infer<typeof addFolderItemSchema>;

export const createFolderShareSchema = z.object({
  userId: z.string().min(1),
  permission: z.enum(FOLDER_SHARE_PERMISSIONS).default("viewer"),
});

export type CreateFolderShare = z.infer<typeof createFolderShareSchema>;

export const updateFolderShareSchema = z.object({
  permission: z.enum(FOLDER_SHARE_PERMISSIONS),
});

export type UpdateFolderShare = z.infer<typeof updateFolderShareSchema>;
```

- [ ] **Step 3: Update packages/shared/src/index.ts barrel exports**

Remove all references to `FolderVisibility`, `FOLDER_VISIBILITIES`.
Add exports for `FolderShare`, `FolderSharePermission`, `FOLDER_SHARE_PERMISSIONS`, `createFolderShareSchema`, `updateFolderShareSchema`, `CreateFolderShare`, `UpdateFolderShare`.

- [ ] **Step 4: Run typecheck to find all broken references**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run typecheck 2>&1 | head -50
```

Fix any remaining references to `FolderVisibility`, `FOLDER_VISIBILITIES`, or `visibility` on the Folder type across the codebase. Key files to check:
- `ui/src/pages/Folders.tsx` — uses `FolderVisibility` type, visibility filter
- `ui/src/pages/FolderDetail.tsx` — uses `FolderVisibility` type, visibility in edit form
- `ui/src/components/folders/FolderCard.tsx` — shows visibility icon
- `ui/src/api/folders.ts` — visibility in create/update inputs
- `server/src/services/folder.ts` — visibility in create/update/list
- `server/src/routes/folders.ts` — visibility query param

**Do NOT fix these files yet** — they will be refactored in later tasks. Just note them for now.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): update folder types — remove visibility, add instructions + shares"
```

---

### Task 4: Permission Seed Update

**Files:**
- Modify: `server/src/services/permission-seed.ts`

- [ ] **Step 1: Replace folders:share with folders:share_users + folders:share_tags**

In `server/src/services/permission-seed.ts`, replace:
```typescript
{ slug: "folders:share", description: "Partager des folders", category: "folders" },
```

With:
```typescript
{ slug: "folders:share_users", description: "Partager un folder à des utilisateurs", category: "folders" },
{ slug: "folders:share_tags", description: "Assigner des tags à un folder", category: "folders" },
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/permission-seed.ts
git commit -m "feat(permissions): split folders:share into folders:share_users + folders:share_tags"
```

---

### Task 5: Backend — Folder Share Service

**Files:**
- Create: `server/src/services/folder-share.ts`

- [ ] **Step 1: Create the folder share service**

```typescript
import { and, eq } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { folderShares } from "@mnm/db";

export function folderShareService(db: Db) {
  return {
    async create(
      companyId: string,
      folderId: string,
      input: { userId: string; permission?: string },
      sharedByUserId: string,
    ) {
      const [share] = await db
        .insert(folderShares)
        .values({
          folderId,
          companyId,
          sharedWithUserId: input.userId,
          permission: input.permission ?? "viewer",
          sharedByUserId,
        })
        .onConflictDoUpdate({
          target: [folderShares.folderId, folderShares.sharedWithUserId],
          set: { permission: input.permission ?? "viewer" },
        })
        .returning();
      return share!;
    },

    async list(companyId: string, folderId: string) {
      return db
        .select()
        .from(folderShares)
        .where(
          and(
            eq(folderShares.folderId, folderId),
            eq(folderShares.companyId, companyId),
          ),
        );
    },

    async update(companyId: string, shareId: string, permission: string) {
      const [updated] = await db
        .update(folderShares)
        .set({ permission })
        .where(
          and(
            eq(folderShares.id, shareId),
            eq(folderShares.companyId, companyId),
          ),
        )
        .returning();
      return updated ?? null;
    },

    async remove(companyId: string, shareId: string) {
      const [deleted] = await db
        .delete(folderShares)
        .where(
          and(
            eq(folderShares.id, shareId),
            eq(folderShares.companyId, companyId),
          ),
        )
        .returning();
      return deleted ?? null;
    },

    async getPermissionForUser(
      companyId: string,
      folderId: string,
      userId: string,
    ): Promise<string | null> {
      const [share] = await db
        .select({ permission: folderShares.permission })
        .from(folderShares)
        .where(
          and(
            eq(folderShares.folderId, folderId),
            eq(folderShares.companyId, companyId),
            eq(folderShares.sharedWithUserId, userId),
          ),
        );
      return share?.permission ?? null;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/folder-share.ts
git commit -m "feat(folders): add folder share service — CRUD for folder_shares"
```

---

### Task 6: Backend — Folder Service Refactor

**Files:**
- Modify: `server/src/services/folder.ts`

This is the biggest refactor. The service needs:
1. **create()** — remove visibility parameter (folders are always private by default)
2. **getById()** — new derived visibility (owner + shares + tag overlap + admin)
3. **list()** — new visibility query (owner + shares + tag overlap + admin)
4. **update()** — allow owner OR editors (from folder_shares), add instructions field
5. **delete()** — add deletion preview + smart delete with preserveDocumentIds
6. Remove all references to `visibility` field

- [ ] **Step 1: Refactor create() — remove visibility**

In the `create` method, remove `visibility` from input type and from the insert values. The `visibility` column no longer exists.

```typescript
async create(
  companyId: string,
  input: {
    name: string;
    description?: string | null;
    icon?: string | null;
  },
  ownerUserId: string,
) {
  const [folder] = await db
    .insert(folders)
    .values({
      companyId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      ownerUserId,
    })
    .returning();
  // ... live event unchanged
  return folder!;
},
```

- [ ] **Step 2: Refactor getById() — derived visibility**

Replace the entire getById method. New logic:
- Admin → always sees
- Owner → always sees
- User in folder_shares → sees (canEdit if permission='editor')
- User shares >=1 tag with folder → sees (viewer only)
- Otherwise → null

```typescript
async getById(
  companyId: string,
  folderId: string,
  requestingUserId: string,
  opts?: { isAdmin?: boolean },
) {
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.companyId, companyId)));

  if (!folder) return null;

  const itemCount = await this.getItemCount(folderId);
  let canEdit = false;

  // Admin bypass
  if (opts?.isAdmin) {
    return { ...folder, itemCount, canEdit: true };
  }

  // Owner always sees + can edit
  if (folder.ownerUserId === requestingUserId) {
    return { ...folder, itemCount, canEdit: true };
  }

  // Check folder_shares
  const sharePermission = await db
    .select({ permission: folderShares.permission })
    .from(folderShares)
    .where(
      and(
        eq(folderShares.folderId, folderId),
        eq(folderShares.companyId, companyId),
        eq(folderShares.sharedWithUserId, requestingUserId),
      ),
    );

  if (sharePermission.length > 0) {
    canEdit = sharePermission[0]!.permission === "editor";
    return { ...folder, itemCount, canEdit };
  }

  // Check tag overlap
  const tagOverlap = await db.execute(sql`
    SELECT 1 FROM tag_assignments fa
    JOIN tag_assignments ua ON fa.tag_id = ua.tag_id
    WHERE fa.target_type = 'folder' AND fa.target_id = ${folderId}::text
      AND fa.company_id = ${companyId}
      AND ua.target_type = 'user' AND ua.target_id = ${requestingUserId}
      AND ua.company_id = ${companyId}
    LIMIT 1
  `);

  if (tagOverlap.rows.length > 0) {
    return { ...folder, itemCount, canEdit: false };
  }

  return null;
},
```

Note: Add `import { folderShares } from "@mnm/db";` at the top.

- [ ] **Step 3: Refactor list() — derived visibility query**

Replace the visibility logic in list(). Remove `visibility` filter parameter entirely.

```typescript
async list(
  companyId: string,
  requestingUserId: string,
  opts?: { limit?: number; offset?: number; isAdmin?: boolean },
) {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const conditions: SQL[] = [eq(folders.companyId, companyId)];

  if (!opts?.isAdmin) {
    const visibilityCondition = sql`(
      ${folders.ownerUserId} = ${requestingUserId}
      OR EXISTS (
        SELECT 1 FROM folder_shares
        WHERE folder_id = ${folders.id} AND shared_with_user_id = ${requestingUserId}
          AND company_id = ${companyId}
      )
      OR EXISTS (
        SELECT 1 FROM tag_assignments fa
        JOIN tag_assignments ua ON fa.tag_id = ua.tag_id
        WHERE fa.target_type = 'folder' AND fa.target_id = ${folders.id}::text
          AND fa.company_id = ${companyId}
          AND ua.target_type = 'user' AND ua.target_id = ${requestingUserId}
          AND ua.company_id = ${companyId}
      )
    )`;
    conditions.push(visibilityCondition);
  }

  const whereClause = and(...conditions);

  const [folderRows, totalResult] = await Promise.all([
    db.select().from(folders).where(whereClause).orderBy(desc(folders.updatedAt)).limit(limit).offset(offset),
    db.select({ count: drizzleCount() }).from(folders).where(whereClause),
  ]);

  return {
    folders: folderRows,
    total: Number(totalResult[0]?.count ?? 0),
  };
},
```

- [ ] **Step 4: Refactor update() — owner OR editor can update, add instructions**

```typescript
async update(
  companyId: string,
  folderId: string,
  input: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    instructions?: string | null;
  },
  requestingUserId: string,
  opts?: { isAdmin?: boolean },
) {
  const [existing] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.companyId, companyId)));

  if (!existing) return null;

  // Check edit permission: owner, admin, or editor share
  let canEdit = opts?.isAdmin || existing.ownerUserId === requestingUserId;

  if (!canEdit) {
    const [share] = await db
      .select({ permission: folderShares.permission })
      .from(folderShares)
      .where(
        and(
          eq(folderShares.folderId, folderId),
          eq(folderShares.companyId, companyId),
          eq(folderShares.sharedWithUserId, requestingUserId),
        ),
      );
    canEdit = share?.permission === "editor";
  }

  if (!canEdit) {
    return { error: "forbidden" as const };
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.instructions !== undefined) updates.instructions = input.instructions;

  const [updated] = await db
    .update(folders)
    .set(updates)
    .where(and(eq(folders.id, folderId), eq(folders.companyId, companyId)))
    .returning();

  publishLiveEvent({
    companyId,
    type: "folder.updated",
    payload: { folderId: updated!.id, name: updated!.name },
  });

  return updated!;
},
```

- [ ] **Step 5: Add deletion preview + smart delete**

Add two new methods:

```typescript
async getDeletionPreview(companyId: string, folderId: string) {
  const [nativeDocs, importedItems, channels] = await Promise.all([
    // Native documents (ownedByFolderId = this folder)
    db
      .select({ id: documents.id, title: documents.title, mimeType: documents.mimeType })
      .from(documents)
      .where(
        and(
          eq(documents.companyId, companyId),
          eq(documents.ownedByFolderId, folderId),
          sql`${documents.deletedAt} IS NULL`,
        ),
      ),
    // Imported items via folderItems
    db
      .select({
        id: folderItems.id,
        itemType: folderItems.itemType,
        displayName: folderItems.displayName,
        artifactId: folderItems.artifactId,
        documentId: folderItems.documentId,
        channelId: folderItems.channelId,
      })
      .from(folderItems)
      .where(
        and(
          eq(folderItems.folderId, folderId),
          eq(folderItems.companyId, companyId),
        ),
      ),
    // Chat channels in this folder
    db
      .select({ id: chatChannels.id, name: chatChannels.name })
      .from(chatChannels)
      .where(
        and(
          eq(chatChannels.companyId, companyId),
          eq(chatChannels.folderId, folderId),
        ),
      ),
  ]);

  return { nativeDocuments: nativeDocs, importedItems, channels };
},
```

Update the existing `delete` method to accept `preserveDocumentIds`:

```typescript
async delete(
  companyId: string,
  folderId: string,
  requestingUserId: string,
  preserveDocumentIds?: string[],
) {
  const [existing] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.companyId, companyId)));

  if (!existing) return { error: "not_found" as const };
  if (existing.ownerUserId !== requestingUserId) {
    return { error: "forbidden" as const };
  }

  // Handle native documents
  const preserveSet = new Set(preserveDocumentIds ?? []);

  // Get native docs
  const nativeDocs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.companyId, companyId),
        eq(documents.ownedByFolderId, folderId),
        sql`${documents.deletedAt} IS NULL`,
      ),
    );

  for (const doc of nativeDocs) {
    if (preserveSet.has(doc.id)) {
      // Preserve: detach from folder
      await db
        .update(documents)
        .set({ ownedByFolderId: null })
        .where(eq(documents.id, doc.id));
    } else {
      // Soft-delete
      await db
        .update(documents)
        .set({ deletedAt: new Date() })
        .where(eq(documents.id, doc.id));
    }
  }

  // Delete folder (CASCADE handles folder_items, SET NULL on chatChannels.folderId)
  await db
    .delete(folders)
    .where(and(eq(folders.id, folderId), eq(folders.companyId, companyId)));

  publishLiveEvent({
    companyId,
    type: "folder.deleted",
    payload: { folderId },
  });

  return { error: null };
},
```

- [ ] **Step 6: Run typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run typecheck 2>&1 | head -80
```

Fix any remaining type errors in the service.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/folder.ts
git commit -m "feat(folders): refactor folder service — derived visibility, editor shares, smart delete"
```

---

### Task 7: Backend — Folder Routes Refactor

**Files:**
- Modify: `server/src/routes/folders.ts`

- [ ] **Step 1: Update existing routes**

1. **POST /folders** — remove visibility from body (createFolderSchema already updated)
2. **GET /folders** — remove `visibility` query param
3. **GET /folders/:id** — return `canEdit`, `shares[]`, `instructions`
4. **PATCH /folders/:id** — pass `isAdmin` to service, update error message
5. **DELETE /folders/:id** — accept `preserveDocumentIds` body
6. **POST /folders/:id/tags** — change permission to `folders:share_tags`
7. **DELETE /folders/:id/tags/:tagId** — change permission to `folders:share_tags`

Key changes to the route file:

**List route** — remove visibility param:
```typescript
router.get(
  "/companies/:companyId/folders",
  requirePermission(db, "folders:read"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const isAdmin = req.tagScope?.bypassTagFilter ?? false;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const result = await svc.list(companyId, actor.actorId, { limit, offset, isAdmin });
    res.json(result);
  },
);
```

**Get by ID route** — return shares and canEdit:
```typescript
router.get(
  "/companies/:companyId/folders/:id",
  requirePermission(db, "folders:read"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const isAdmin = req.tagScope?.bypassTagFilter ?? false;
    const folder = await svc.getById(companyId, req.params.id as string, actor.actorId, { isAdmin });
    if (!folder) throw notFound("Folder not found");

    const [items, folderTags, shares] = await Promise.all([
      svc.getItems(companyId, folder.id),
      db.select({
        tagId: tagAssignments.tagId,
        tagName: tags.name,
        tagSlug: tags.slug,
        tagColor: tags.color,
      }).from(tagAssignments)
        .innerJoin(tags, eq(tags.id, tagAssignments.tagId))
        .where(and(
          eq(tagAssignments.companyId, companyId),
          eq(tagAssignments.targetType, "folder"),
          sql`${tagAssignments.targetId} = ${folder.id}`,
        )),
      shareSvc.list(companyId, folder.id),
    ]);

    res.json({
      ...folder,
      items,
      tags: folderTags.map((t) => ({ id: t.tagId, name: t.tagName, slug: t.tagSlug, color: t.tagColor })),
      shares,
    });
  },
);
```

**Update route** — pass isAdmin:
```typescript
const result = await svc.update(
  companyId,
  req.params.id as string,
  body.data,
  actor.actorId,
  { isAdmin: req.tagScope?.bypassTagFilter ?? false },
);
// Update error message to reflect editors too:
if ("error" in result && result.error === "forbidden") {
  throw forbidden("Only the folder owner or editors can update this folder");
}
```

**Delete route** — accept body:
```typescript
const preserveDocumentIds = (req.body?.preserveDocumentIds as string[]) ?? [];
const result = await svc.delete(companyId, req.params.id as string, actor.actorId, preserveDocumentIds);
```

**Tag routes** — change permission:
```typescript
requirePermission(db, "folders:share_tags"),  // was "folders:edit"
```

- [ ] **Step 2: Add new routes**

Add imports at top:
```typescript
import { folderShareService } from "../services/folder-share.js";
import { createFolderShareSchema, updateFolderShareSchema } from "@mnm/shared";
```

Create share service instance:
```typescript
const shareSvc = folderShareService(db);
```

Add new routes before `return router;`:

```typescript
// GET /folders/:id/deletion-preview
router.get(
  "/companies/:companyId/folders/:id/deletion-preview",
  requirePermission(db, "folders:delete"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const isAdmin = req.tagScope?.bypassTagFilter ?? false;
    const folder = await svc.getById(companyId, req.params.id as string, actor.actorId, { isAdmin });
    if (!folder) throw notFound("Folder not found");
    if (folder.ownerUserId !== actor.actorId) throw forbidden("Only the owner can delete");
    const preview = await svc.getDeletionPreview(companyId, folder.id);
    res.json(preview);
  },
);

// POST /folders/:id/shares
router.post(
  "/companies/:companyId/folders/:id/shares",
  requirePermission(db, "folders:share_users"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const body = createFolderShareSchema.safeParse(req.body);
    if (!body.success) throw badRequest("Invalid request body", body.error.issues);
    const actor = getActorInfo(req);
    const isAdmin = req.tagScope?.bypassTagFilter ?? false;
    const folder = await svc.getById(companyId, req.params.id as string, actor.actorId, { isAdmin });
    if (!folder) throw notFound("Folder not found");
    const share = await shareSvc.create(companyId, folder.id, body.data, actor.actorId);
    res.status(201).json(share);
  },
);

// GET /folders/:id/shares
router.get(
  "/companies/:companyId/folders/:id/shares",
  requirePermission(db, "folders:read"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const isAdmin = req.tagScope?.bypassTagFilter ?? false;
    const folder = await svc.getById(companyId, req.params.id as string, actor.actorId, { isAdmin });
    if (!folder) throw notFound("Folder not found");
    const shares = await shareSvc.list(companyId, folder.id);
    res.json(shares);
  },
);

// PATCH /folders/:id/shares/:shareId
router.patch(
  "/companies/:companyId/folders/:id/shares/:shareId",
  requirePermission(db, "folders:share_users"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const body = updateFolderShareSchema.safeParse(req.body);
    if (!body.success) throw badRequest("Invalid request body", body.error.issues);
    const updated = await shareSvc.update(companyId, req.params.shareId as string, body.data.permission);
    if (!updated) throw notFound("Share not found");
    res.json(updated);
  },
);

// DELETE /folders/:id/shares/:shareId
router.delete(
  "/companies/:companyId/folders/:id/shares/:shareId",
  requirePermission(db, "folders:share_users"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const deleted = await shareSvc.remove(companyId, req.params.shareId as string);
    if (!deleted) throw notFound("Share not found");
    res.status(204).end();
  },
);

// POST /folders/:id/upload — upload document directly to folder
router.post(
  "/companies/:companyId/folders/:id/upload",
  requirePermission(db, "folders:edit"),
  async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const isAdmin = req.tagScope?.bypassTagFilter ?? false;
    const folder = await svc.getById(companyId, req.params.id as string, actor.actorId, { isAdmin });
    if (!folder) throw notFound("Folder not found");

    // Reuse document upload logic
    // Import multer, storage, document service, asset service at top of file
    try {
      await runSingleFileUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(422).json({ error: `File exceeds max size` });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const file = (req as any).file;
    if (!file) throw badRequest("Missing file field 'file'");

    const title = (req.body.title as string) || file.originalname || "Untitled";
    const mimeType = file.mimetype || "application/octet-stream";

    // Create asset via storage
    const stored = await storage.putFile({
      companyId,
      namespace: "documents",
      originalFilename: file.originalname || null,
      contentType: mimeType,
      body: file.buffer,
    });

    const asset = await assetSvc.create(companyId, {
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    // Create document WITH ownedByFolderId
    const doc = await docSvc.create(companyId, asset!.id, {
      title,
      mimeType,
      byteSize: file.buffer.length,
      createdByUserId: actor.actorType === "user" ? actor.actorId : undefined,
      ownedByFolderId: folder.id,
    });

    // Also create a folderItem for unified display
    await svc.addItem(companyId, folder.id, {
      itemType: "document",
      documentId: doc.id,
      displayName: title,
    }, actor.actorId);

    // Enqueue ingestion (same as documents route)
    try {
      const { createIngestionQueue } = await import("../services/document-ingestion.js");
      const { Redis } = await import("ioredis");
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const queue = createIngestionQueue({ host: new URL(redisUrl).hostname, port: Number(new URL(redisUrl).port) || 6379 });
        await queue.add("ingest", { documentId: doc.id, companyId });
      } else {
        await docSvc.updateIngestionStatus(doc.id, "ready");
      }
    } catch {
      await docSvc.updateIngestionStatus(doc.id, "ready");
    }

    res.status(201).json(doc);
  },
);
```

Note: The upload route needs multer, storage, and document service. These need to be passed into `folderRoutes()`:

```typescript
export function folderRoutes(db: Db, storage: StorageService): Router {
```

Update the function signature and add the necessary imports and instances (multer, assetService, documentService). The caller in the main routes setup must also pass `storage`.

- [ ] **Step 3: Update the route registration in the main server file**

Find where `folderRoutes(db)` is called and add the storage parameter: `folderRoutes(db, storage)`.

- [ ] **Step 4: Update documentService.create() to accept ownedByFolderId**

In `server/src/services/document.ts`, update the `create` method's input type to include `ownedByFolderId?: string` and pass it through to the insert.

- [ ] **Step 5: Run typecheck**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run typecheck 2>&1 | head -80
```

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/folders.ts server/src/services/document.ts server/src/routes/index.ts
git commit -m "feat(folders): refactor routes — shares CRUD, upload, deletion-preview, remove visibility"
```

---

### Task 8: Chat Completion — Inject Folder Instructions

**Files:**
- Modify: `server/src/services/chat-completion.ts`

- [ ] **Step 1: Fetch folder instructions in prepareContext**

In `prepareContext()` (around line 136), after fetching the channel, check if it has a `folderId` and fetch the folder's instructions:

```typescript
// After fetching channel (around line 145)
let folderInstructions: string | null = null;
if (channel.folderId) {
  const [folder] = await db
    .select({ instructions: folders.instructions })
    .from(folders)
    .where(eq(folders.id, channel.folderId));
  folderInstructions = folder?.instructions ?? null;
}
```

Add `folders` import from `@mnm/db`.

Pass `folderInstructions` to `buildSystemPrompt`:
```typescript
const systemPrompt = buildSystemPrompt(agent, useTools, folderInstructions);
```

- [ ] **Step 2: Update buildSystemPrompt to inject folder instructions first**

Update function signature and inject before agent prompt:

```typescript
function buildSystemPrompt(
  agent: typeof agents.$inferSelect | undefined,
  useTools = false,
  folderInstructions?: string | null,
): string {
  const featuresPrompt = useTools ? CHAT_FEATURES_PROMPT_TOOLS : CHAT_FEATURES_PROMPT_BLOCKS;
  const parts: string[] = [];

  // Folder instructions first (highest priority context)
  if (folderInstructions) {
    parts.push(`[Folder instructions — these instructions apply to this conversation]\n${folderInstructions}`);
  }

  if (!agent) {
    parts.push("You are a helpful AI assistant. Respond concisely and helpfully.");
    parts.push(featuresPrompt);
    return parts.join("\n\n");
  }

  if (agent.name) parts.push(`You are ${agent.name}.`);
  if (agent.title) parts.push(agent.title);

  const config = agent.adapterConfig as Record<string, unknown> | null;
  if (config?.systemPrompt && typeof config.systemPrompt === "string") {
    parts.push(config.systemPrompt);
  }

  if (agent.capabilities) {
    parts.push(`Your capabilities: ${agent.capabilities}`);
  }

  parts.push(featuresPrompt);

  if (parts.length <= 1) {
    return "You are a helpful AI assistant.\n\n" + featuresPrompt;
  }

  return parts.join("\n\n");
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/chat-completion.ts
git commit -m "feat(chat): inject folder instructions into system prompt before agent prompt"
```

---

### Task 9: Frontend — API Layer Updates

**Files:**
- Modify: `ui/src/api/folders.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Update foldersApi**

```typescript
import { api } from "./client";
import type { Folder, FolderItem, FolderShare } from "@mnm/shared";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

interface FolderDetail extends Folder {
  items: FolderItem[];
  tags: { id: string; name: string; slug: string; color: string | null }[];
  shares: FolderShare[];
}

interface DeletionPreview {
  nativeDocuments: { id: string; title: string; mimeType: string }[];
  importedItems: { id: string; itemType: string; displayName: string | null }[];
  channels: { id: string; name: string | null }[];
}

export const foldersApi = {
  create(companyId: string, input: { name: string; description?: string; icon?: string }) {
    return api.post<Folder>(`/companies/${companyId}/folders`, input);
  },

  list(companyId: string, opts?: { limit?: number; offset?: number }) {
    return api.get<{ folders: Folder[]; total: number }>(
      `/companies/${companyId}/folders${buildQuery(opts as Record<string, string | number | undefined> ?? {})}`,
    );
  },

  getById(companyId: string, id: string) {
    return api.get<FolderDetail>(`/companies/${companyId}/folders/${id}`);
  },

  update(companyId: string, id: string, input: { name?: string; description?: string; icon?: string; instructions?: string | null }) {
    return api.patch<Folder>(`/companies/${companyId}/folders/${id}`, input);
  },

  delete(companyId: string, id: string, preserveDocumentIds?: string[]) {
    return api.delete(`/companies/${companyId}/folders/${id}`, {
      body: preserveDocumentIds ? JSON.stringify({ preserveDocumentIds }) : undefined,
    });
  },

  getDeletionPreview(companyId: string, id: string) {
    return api.get<DeletionPreview>(`/companies/${companyId}/folders/${id}/deletion-preview`);
  },

  addItem(companyId: string, folderId: string, input: { itemType: string; artifactId?: string; documentId?: string; channelId?: string; displayName?: string }) {
    return api.post<FolderItem>(`/companies/${companyId}/folders/${folderId}/items`, input);
  },

  removeItem(companyId: string, folderId: string, itemId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/items/${itemId}`);
  },

  upload(companyId: string, folderId: string, file: File, title?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    return api.post<any>(`/companies/${companyId}/folders/${folderId}/upload`, formData);
  },

  // Shares
  listShares(companyId: string, folderId: string) {
    return api.get<FolderShare[]>(`/companies/${companyId}/folders/${folderId}/shares`);
  },

  addShare(companyId: string, folderId: string, input: { userId: string; permission?: string }) {
    return api.post<FolderShare>(`/companies/${companyId}/folders/${folderId}/shares`, input);
  },

  updateShare(companyId: string, folderId: string, shareId: string, input: { permission: string }) {
    return api.patch<FolderShare>(`/companies/${companyId}/folders/${folderId}/shares/${shareId}`, input);
  },

  removeShare(companyId: string, folderId: string, shareId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/shares/${shareId}`);
  },

  // Tags (unchanged)
  addTag(companyId: string, folderId: string, tagId: string) {
    return api.post(`/companies/${companyId}/folders/${folderId}/tags`, { tagId });
  },

  removeTag(companyId: string, folderId: string, tagId: string) {
    return api.delete(`/companies/${companyId}/folders/${folderId}/tags/${tagId}`);
  },
};
```

- [ ] **Step 2: Update queryKeys.ts**

```typescript
folders: {
  list: (companyId: string) => ["folders", companyId] as const,
  detail: (companyId: string, id: string) => ["folders", companyId, id] as const,
  shares: (companyId: string, id: string) => ["folders", companyId, id, "shares"] as const,
  deletionPreview: (companyId: string, id: string) => ["folders", companyId, id, "deletion-preview"] as const,
},
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/api/folders.ts ui/src/lib/queryKeys.ts
git commit -m "feat(ui): update folder API — shares, upload, deletion-preview, remove visibility"
```

---

### Task 10: Frontend — Folders List Page Refactor

**Files:**
- Modify: `ui/src/pages/Folders.tsx`
- Modify: `ui/src/components/folders/FolderCard.tsx`

- [ ] **Step 1: Refactor Folders.tsx — remove visibility**

Remove:
- `FolderVisibility` import
- `VISIBILITY_OPTIONS` constant
- `visibilityFilter` state
- `VisibilityFilterButton` component
- Visibility filter UI section
- Client-side visibility filter on `folders`
- Visibility field in create dialog form and mutation

Create form becomes just `name` + `description`. No visibility picker.

- [ ] **Step 2: Refactor FolderCard.tsx — show tag badges directly**

Replace visibility icons (Lock/Globe) with actual tag badges. Show shared indicator if folder has shares.

```typescript
import { Folder as FolderIcon } from "lucide-react";
import type { Folder } from "@mnm/shared";

interface FolderCardProps {
  folder: Folder & { tags?: { id: string; name: string; color: string | null }[] };
  onClick: () => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const tags = folder.tags ?? [];

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-muted">
          {folder.icon ? (
            <span className="text-lg">{folder.icon}</span>
          ) : (
            <FolderIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{folder.name}</span>
          {folder.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {folder.description}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {tag.color && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  )}
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {folder.itemCount != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {folder.itemCount} items
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/Folders.tsx ui/src/components/folders/FolderCard.tsx
git commit -m "feat(ui): refactor folder list — remove visibility, show tag badges on cards"
```

---

### Task 11: Frontend — FolderDetail Refactor

**Files:**
- Modify: `ui/src/pages/FolderDetail.tsx`
- Create: `ui/src/components/folders/FolderDeleteDialog.tsx`
- Create: `ui/src/components/folders/FolderShareManager.tsx`

- [ ] **Step 1: Create FolderDeleteDialog.tsx**

Smart delete dialog that fetches deletion preview and lets user select which native documents to preserve.

```typescript
// ui/src/components/folders/FolderDeleteDialog.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Trash2 } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { queryKeys } from "../../lib/queryKeys";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";

interface FolderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  folderId: string;
  folderName: string;
  onConfirm: (preserveDocumentIds: string[]) => void;
  isPending: boolean;
}

export function FolderDeleteDialog({
  open, onOpenChange, companyId, folderId, folderName, onConfirm, isPending,
}: FolderDeleteDialogProps) {
  const [preserveIds, setPreserveIds] = useState<Set<string>>(new Set());

  const { data: preview, isLoading } = useQuery({
    queryKey: queryKeys.folders.deletionPreview(companyId, folderId),
    queryFn: () => foldersApi.getDeletionPreview(companyId, folderId),
    enabled: open,
  });

  const togglePreserve = (id: string) => {
    setPreserveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nativeDocs = preview?.nativeDocuments ?? [];
  const hasNativeDocs = nativeDocs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete "{folderName}"</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : (
          <div className="space-y-4 py-2">
            {hasNativeDocs ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This folder contains {nativeDocs.length} native document(s).
                  Select the ones you want to <strong>keep</strong> as standalone documents.
                  Unselected documents will be deleted.
                </p>
                <div className="max-h-60 overflow-auto rounded-md border divide-y">
                  {nativeDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => togglePreserve(doc.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2",
                        preserveIds.has(doc.id) && "bg-primary/5",
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{doc.title}</span>
                      {preserveIds.has(doc.id) && (
                        <span className="text-xs text-primary font-medium">Keep</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete "{folderName}"?
                Imported items will be unlinked but not deleted. This cannot be undone.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(Array.from(preserveIds))}
            disabled={isPending || isLoading}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {isPending ? "Deleting..." : "Delete Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create FolderShareManager.tsx**

Component to manage user shares + tag assignments on a folder.

```typescript
// ui/src/components/folders/FolderShareManager.tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Tag, Trash2 } from "lucide-react";
import { foldersApi } from "../../api/folders";
import { tagsApi } from "../../api/tags";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FolderShare } from "@mnm/shared";

interface FolderShareManagerProps {
  companyId: string;
  folderId: string;
  shares: FolderShare[];
  folderTags: { id: string; name: string; color: string | null }[];
  canEdit: boolean;
}

export function FolderShareManager({
  companyId, folderId, shares, folderTags, canEdit,
}: FolderShareManagerProps) {
  const queryClient = useQueryClient();
  const [newUserId, setNewUserId] = useState("");
  const [newPermission, setNewPermission] = useState("viewer");
  const [tagsOpen, setTagsOpen] = useState(false);

  const { data: companyTags } = useQuery({
    queryKey: queryKeys.tags.list(companyId, false),
    queryFn: () => tagsApi.list(companyId),
    enabled: canEdit,
  });

  const addShareMutation = useMutation({
    mutationFn: () => foldersApi.addShare(companyId, folderId, { userId: newUserId, permission: newPermission }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folderId) });
      setNewUserId("");
    },
  });

  const removeShareMutation = useMutation({
    mutationFn: (shareId: string) => foldersApi.removeShare(companyId, folderId, shareId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folderId) }),
  });

  const updateShareMutation = useMutation({
    mutationFn: ({ shareId, permission }: { shareId: string; permission: string }) =>
      foldersApi.updateShare(companyId, folderId, shareId, { permission }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folderId) }),
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) => foldersApi.addTag(companyId, folderId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folderId) }),
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) => foldersApi.removeTag(companyId, folderId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folderId) }),
  });

  const folderTagIds = folderTags.map((t) => t.id);
  const availableTags = (companyTags ?? []).filter((t) => !folderTagIds.includes(t.id));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Sharing</h3>

      {/* User shares */}
      <div className="space-y-2">
        {shares.map((share) => (
          <div key={share.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{share.sharedWithUserId}</span>
            {canEdit ? (
              <>
                <Select
                  value={share.permission}
                  onValueChange={(v) => updateShareMutation.mutate({ shareId: share.id, permission: v })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost" size="icon-xs"
                  onClick={() => removeShareMutation.mutate(share.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{share.permission}</span>
            )}
          </div>
        ))}

        {canEdit && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="User ID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Select value={newPermission} onValueChange={setNewPermission}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm" variant="outline"
              onClick={() => addShareMutation.mutate()}
              disabled={!newUserId.trim() || addShareMutation.isPending}
            >
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Tag shares */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Tags (group access)</h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {folderTags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs">
              {tag.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />}
              {tag.name}
              {canEdit && (
                <button className="ml-0.5 text-muted-foreground hover:text-foreground" onClick={() => removeTagMutation.mutate(tag.id)}>
                  &times;
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                  <Tag className="h-3 w-3" /> Add tag
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {availableTags.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">All tags assigned</p>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                      onClick={() => { setTagsOpen(false); addTagMutation.mutate(tag.id); }}
                    >
                      {tag.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />}
                      {tag.name}
                    </button>
                  ))
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Refactor FolderDetail.tsx**

Major refactor:
- Remove all `FolderVisibility` references, visibility state, visibility filter/picker
- Remove old delete dialog, use `FolderDeleteDialog` component
- Remove old tag section, use `FolderShareManager` component
- Add instructions editor (textarea)
- Add conversations list section (chats linked to this folder)
- Add "New Chat" button that creates a channel with `folderId`
- Use `folder.canEdit` from API to control edit permissions
- Keep existing items section

The detailed code for this is large. Key structure:

```
<BackButton />
<Header: icon, name, description, edit/delete buttons />
<InstructionsEditor: textarea, save on blur />
<FolderItemList />
<Conversations: list of channels in this folder />
<FolderShareManager />
<FolderDeleteDialog />
<EditDialog: name + description only (no visibility) />
<AddItemDialog: unchanged />
```

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/folders/FolderDeleteDialog.tsx ui/src/components/folders/FolderShareManager.tsx ui/src/pages/FolderDetail.tsx
git commit -m "feat(ui): refactor folder detail — instructions, shares, smart delete, remove visibility"
```

---

### Task 12: Frontend — Workspace Layout & Route

**Files:**
- Create: `ui/src/pages/FolderWorkspace.tsx`
- Create: `ui/src/components/folders/FolderSidebar.tsx`
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Create FolderSidebar.tsx**

Collapsible left sidebar for workspace mode. Shows:
- Folder name + icon
- Instructions (editable textarea)
- Documents list (with upload drop zone)
- Imported items
- Share info (FolderShareManager)

```typescript
// ui/src/components/folders/FolderSidebar.tsx
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, ChevronDown, ChevronRight, ArrowLeft,
} from "lucide-react";
import { foldersApi } from "../../api/folders";
import { queryKeys } from "../../lib/queryKeys";
import { FolderShareManager } from "./FolderShareManager";
import { FolderItemList } from "./FolderItemList";
import { Button } from "@/components/ui/button";
import type { Folder, FolderItem, FolderShare } from "@mnm/shared";

interface FolderSidebarProps {
  companyId: string;
  folder: Folder & {
    items: FolderItem[];
    tags: { id: string; name: string; slug: string; color: string | null }[];
    shares: FolderShare[];
  };
  onBack: () => void;
}

export function FolderSidebar({ companyId, folder, onBack }: FolderSidebarProps) {
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState(folder.instructions ?? "");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    instructions: true,
    documents: true,
    sharing: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateMutation = useMutation({
    mutationFn: (input: { instructions?: string | null }) =>
      foldersApi.update(companyId, folder.id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folder.id) }),
  });

  const saveInstructions = useCallback(() => {
    const value = instructions.trim() || null;
    if (value !== (folder.instructions ?? null)) {
      updateMutation.mutate({ instructions: value });
    }
  }, [instructions, folder.instructions, updateMutation]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => foldersApi.upload(companyId, folder.id, file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folder.id) }),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => foldersApi.removeItem(companyId, folder.id, itemId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.detail(companyId, folder.id) }),
  });

  const canEdit = folder.canEdit ?? false;

  return (
    <div className="h-full flex flex-col border-r border-border bg-background overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <Button variant="ghost" size="sm" className="gap-1 mb-2" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {folder.icon ? <span className="text-lg">{folder.icon}</span> : null}
          <h2 className="text-sm font-semibold truncate">{folder.name}</h2>
        </div>
        {folder.description && (
          <p className="text-xs text-muted-foreground mt-1">{folder.description}</p>
        )}
      </div>

      {/* Instructions section */}
      <div className="border-b border-border">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
          onClick={() => toggleSection("instructions")}
        >
          {expandedSections.instructions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Instructions
        </button>
        {expandedSections.instructions && (
          <div className="px-3 pb-3">
            <textarea
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Markdown instructions injected into every chat..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onBlur={saveInstructions}
              readOnly={!canEdit}
            />
          </div>
        )}
      </div>

      {/* Documents section */}
      <div className="border-b border-border">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
          onClick={() => toggleSection("documents")}
        >
          {expandedSections.documents ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Documents & Items ({folder.items.length})
        </button>
        {expandedSections.documents && (
          <div className="px-3 pb-3 space-y-2">
            {canEdit && (
              <div
                className="border border-dashed border-border rounded-md p-3 text-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.onchange = () => {
                    if (input.files) {
                      Array.from(input.files).forEach((f) => uploadMutation.mutate(f));
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="h-4 w-4 mx-auto mb-1" />
                Drop files or click to upload
              </div>
            )}
            <FolderItemList
              items={folder.items}
              onRemove={(itemId) => removeItemMutation.mutate(itemId)}
            />
          </div>
        )}
      </div>

      {/* Sharing section */}
      <div>
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/40"
          onClick={() => toggleSection("sharing")}
        >
          {expandedSections.sharing ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Sharing
        </button>
        {expandedSections.sharing && (
          <div className="px-3 pb-3">
            <FolderShareManager
              companyId={companyId}
              folderId={folder.id}
              shares={folder.shares}
              folderTags={folder.tags}
              canEdit={canEdit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create FolderWorkspace.tsx**

3-column layout: sidebar | chat | artifact preview

```typescript
// ui/src/pages/FolderWorkspace.tsx
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "../lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { foldersApi } from "../api/folders";
import { agentsApi } from "../api/agents";
import { chatApi } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { FolderSidebar } from "../components/folders/FolderSidebar";
import { AgentChatPanel } from "../components/AgentChatPanel";
import { PageSkeleton } from "../components/PageSkeleton";

export function FolderWorkspace() {
  const { folderId, channelId } = useParams<{ folderId: string; channelId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();

  // Remove parent padding for full-bleed layout
  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const prev = {
      padding: main.style.padding,
      overflow: main.style.overflow,
      position: main.style.position,
    };
    main.style.padding = "0";
    main.style.overflow = "hidden";
    main.style.position = "relative";
    return () => {
      main.style.padding = prev.padding;
      main.style.overflow = prev.overflow;
      main.style.position = prev.position;
    };
  }, []);

  const folderQuery = useQuery({
    queryKey: queryKeys.folders.detail(selectedCompanyId!, folderId!),
    queryFn: () => foldersApi.getById(selectedCompanyId!, folderId!),
    enabled: !!selectedCompanyId && !!folderId,
  });

  const channelQuery = useQuery({
    queryKey: queryKeys.chat.detail(selectedCompanyId!, channelId!),
    queryFn: () => chatApi.getChannel(selectedCompanyId!, channelId!),
    enabled: !!selectedCompanyId && !!channelId,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentName = useMemo(() => {
    if (!channelQuery.data) return "Agent";
    return agentsQuery.data?.find((a) => a.id === channelQuery.data.agentId)?.name ?? "Agent";
  }, [channelQuery.data, agentsQuery.data]);

  useEffect(() => {
    if (folderQuery.data) {
      setBreadcrumbs([
        { label: "Folders", href: "/folders" },
        { label: folderQuery.data.name, href: `/folders/${folderId}` },
        { label: "Chat" },
      ]);
    }
    return () => setBreadcrumbs([]);
  }, [folderQuery.data, folderId, setBreadcrumbs]);

  if (folderQuery.isLoading || channelQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (!folderQuery.data || !channelQuery.data) {
    return <p className="p-6 text-sm text-destructive">Folder or chat not found.</p>;
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Left: Folder sidebar */}
      <div className="w-72 shrink-0">
        <FolderSidebar
          companyId={selectedCompanyId!}
          folder={folderQuery.data}
          onBack={() => navigate(`/folders/${folderId}`)}
        />
      </div>

      {/* Center + Right: Chat with artifact panel (handled by AgentChatPanel) */}
      <div className="flex-1 relative">
        <AgentChatPanel
          channel={channelQuery.data}
          agentName={agentName}
          onBack={() => navigate(`/folders/${folderId}`)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.tsx**

Import and add route:

```typescript
import { FolderWorkspace } from "./pages/FolderWorkspace";
```

In `boardRoutes()`, add:
```typescript
<Route path="folders/:folderId/chat/:channelId" element={<RequirePermission permission="folders:read" showForbidden><FolderWorkspace /></RequirePermission>} />
```

Also add unprefixed redirect:
```typescript
<Route path="folders/:folderId/chat/:channelId" element={<UnprefixedBoardRedirect />} />
```

- [ ] **Step 4: Update FolderDetail to link to workspace mode**

In FolderDetail.tsx, add a "Conversations" section that lists channels linked to this folder. Clicking a channel navigates to `/folders/:folderId/chat/:channelId` (workspace mode).

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/FolderWorkspace.tsx ui/src/components/folders/FolderSidebar.tsx ui/src/App.tsx ui/src/pages/FolderDetail.tsx
git commit -m "feat(ui): add folder workspace — 3-column layout (sidebar, chat, artifacts)"
```

---

### Task 13: Typecheck & Dead Code Cleanup

**Files:**
- Various files across the codebase

- [ ] **Step 1: Run typecheck and fix all errors**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run typecheck 2>&1
```

Fix all TypeScript errors. Key things to clean up:
- Any remaining `FolderVisibility` references
- Any remaining `FOLDER_VISIBILITIES` references
- Any remaining `visibility` field usage on Folder type
- Any remaining `folders:share` permission references

- [ ] **Step 2: Search and destroy dead code**

```bash
# Search for all dead references
grep -r "FolderVisibility" --include="*.ts" --include="*.tsx"
grep -r "FOLDER_VISIBILITIES" --include="*.ts" --include="*.tsx"
grep -r "folders\.visibility" --include="*.ts" --include="*.tsx"
grep -r "folder\.visibility" --include="*.ts" --include="*.tsx"
grep -r '"folders:share"' --include="*.ts" --include="*.tsx"
```

Remove all found references.

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead code — FolderVisibility, FOLDER_VISIBILITIES, folders:share"
```

---

### Task 14: Integration Verification

- [ ] **Step 1: Start dev server and verify**

```bash
cd C:/Users/tom.andrieu/IdeaProjects/perso/alphalup/mnm && bun run dev
```

Verify:
1. Migration 0056 runs without errors
2. Folder list loads (no visibility filter)
3. Create folder works (no visibility field)
4. Folder detail shows instructions editor, share manager
5. Upload to folder works
6. Workspace mode loads at `/folders/:id/chat/:channelId`
7. Folder instructions appear in chat system prompt
8. Smart delete dialog shows native documents
9. Tag badges show on folder cards

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(folders): integration fixes after folder workspace implementation"
```
