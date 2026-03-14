/**
 * CHAT-S02: Tables Chat -- Enrichissement Schema et Service -- E2E Tests
 *
 * These tests verify the deliverables of CHAT-S02:
 *   - Groupe 1: Schema chat_channels -- nouvelles colonnes (T01-T07)
 *   - Groupe 2: Schema chat_messages -- nouvelles colonnes (T08-T13)
 *   - Groupe 3: Migration SQL (T14-T18)
 *   - Groupe 4: Service -- createChannel enrichi (T19-T21)
 *   - Groupe 5: Service -- createMessage enrichi (T22-T24)
 *   - Groupe 6: Service -- nouvelles fonctions (T25-T30)
 *   - Groupe 7: Service -- filtrage enrichi (T31-T33)
 *   - Groupe 8: Routes REST (T34-T37)
 *   - Groupe 9: Validators (T38-T40)
 *   - Groupe 10: Types partages (T41-T42)
 *   - Groupe 11: Barrel exports (T43-T45)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCHEMA_CHANNELS_FILE = resolve(
  ROOT,
  "packages/db/src/schema/chat_channels.ts",
);
const SCHEMA_MESSAGES_FILE = resolve(
  ROOT,
  "packages/db/src/schema/chat_messages.ts",
);
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const SERVICE_FILE = resolve(ROOT, "server/src/services/chat.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/chat.ts");
const VALIDATOR_FILE = resolve(ROOT, "server/src/validators/chat-ws.ts");
const SHARED_TYPES_FILE = resolve(
  ROOT,
  "packages/shared/src/types/chat-ws.ts",
);
const SHARED_TYPES_INDEX = resolve(
  ROOT,
  "packages/shared/src/types/index.ts",
);
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");

// ---------------------------------------------------------------------------
// Groupe 1: Schema chat_channels -- nouvelles colonnes (T01-T07)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: Schema chat_channels -- nouvelles colonnes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_CHANNELS_FILE, "utf-8");
  });

  test('T01 -- chat_channels.ts contient la colonne projectId avec uuid("project_id") @chat-s02-channels-project-id', () => {
    expect(content).toContain('"project_id"');
    expect(content).toMatch(/projectId\s*:\s*uuid\(\s*["']project_id["']\s*\)/);
  });

  test('T02 -- chat_channels.ts contient la colonne createdBy avec text("created_by") @chat-s02-channels-created-by', () => {
    expect(content).toContain('"created_by"');
    expect(content).toMatch(/createdBy\s*:\s*text\(\s*["']created_by["']\s*\)/);
  });

  test('T03 -- chat_channels.ts contient la colonne description avec text("description") @chat-s02-channels-description', () => {
    // Verify it's a column definition, not just any string containing "description"
    expect(content).toMatch(
      /description\s*:\s*text\(\s*["']description["']\s*\)/,
    );
  });

  test('T04 -- chat_channels.ts contient la colonne lastMessageAt avec timestamp("last_message_at") @chat-s02-channels-last-message-at', () => {
    expect(content).toContain('"last_message_at"');
    expect(content).toMatch(
      /lastMessageAt\s*:\s*timestamp\(\s*["']last_message_at["']/,
    );
  });

  test("T05 -- chat_channels.ts contient l'index chat_channels_company_project_idx @chat-s02-idx-company-project", () => {
    expect(content).toContain("chat_channels_company_project_idx");
    // Should index on companyId and projectId
    const idxMatch = content.indexOf("chat_channels_company_project_idx");
    const idxBlock = content.slice(idxMatch, idxMatch + 200);
    expect(idxBlock).toContain("companyId");
    expect(idxBlock).toContain("projectId");
  });

  test("T06 -- chat_channels.ts contient l'index chat_channels_company_last_msg_idx @chat-s02-idx-company-last-msg", () => {
    expect(content).toContain("chat_channels_company_last_msg_idx");
    // Should index on companyId and lastMessageAt
    const idxMatch = content.indexOf("chat_channels_company_last_msg_idx");
    const idxBlock = content.slice(idxMatch, idxMatch + 200);
    expect(idxBlock).toContain("companyId");
    expect(idxBlock).toContain("lastMessageAt");
  });

  test('T07 -- chat_channels.ts reference projects.id avec onDelete: "set null" @chat-s02-fk-projects', () => {
    expect(content).toContain("projects");
    expect(content).toMatch(/references\s*\(\s*\(\s*\)\s*=>\s*projects\.id/);
    // Check onDelete: "set null"
    expect(content).toMatch(/onDelete\s*:\s*["']set null["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Schema chat_messages -- nouvelles colonnes (T08-T13)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Schema chat_messages -- nouvelles colonnes", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
  });

  test('T08 -- chat_messages.ts contient la colonne messageType avec text("message_type") et default "text" @chat-s02-messages-message-type', () => {
    expect(content).toContain('"message_type"');
    expect(content).toMatch(
      /messageType\s*:\s*text\(\s*["']message_type["']\s*\)/,
    );
    // Default should be "text"
    expect(content).toMatch(/default\(\s*["']text["']\s*\)/);
  });

  test('T09 -- chat_messages.ts contient la colonne replyToId avec uuid("reply_to_id") @chat-s02-messages-reply-to-id', () => {
    expect(content).toContain('"reply_to_id"');
    expect(content).toMatch(
      /replyToId\s*:\s*uuid\(\s*["']reply_to_id["']\s*\)/,
    );
  });

  test('T10 -- chat_messages.ts contient la colonne editedAt avec timestamp("edited_at") @chat-s02-messages-edited-at', () => {
    expect(content).toContain('"edited_at"');
    expect(content).toMatch(
      /editedAt\s*:\s*timestamp\(\s*["']edited_at["']/,
    );
  });

  test('T11 -- chat_messages.ts contient la colonne deletedAt avec timestamp("deleted_at") @chat-s02-messages-deleted-at', () => {
    expect(content).toContain('"deleted_at"');
    expect(content).toMatch(
      /deletedAt\s*:\s*timestamp\(\s*["']deleted_at["']/,
    );
  });

  test("T12 -- chat_messages.ts contient l'index chat_messages_reply_to_idx @chat-s02-idx-reply-to", () => {
    expect(content).toContain("chat_messages_reply_to_idx");
    // Should index on replyToId
    const idxMatch = content.indexOf("chat_messages_reply_to_idx");
    const idxBlock = content.slice(idxMatch, idxMatch + 200);
    expect(idxBlock).toContain("replyToId");
  });

  test('T13 -- chat_messages.ts contient la FK self-referentielle avec AnyPgColumn et onDelete: "set null" @chat-s02-fk-reply-self-ref', () => {
    // Should import AnyPgColumn
    expect(content).toContain("AnyPgColumn");
    // Self-reference: references(() => chatMessages.id)
    expect(content).toMatch(
      /references\s*\(\s*\(\s*\)\s*:\s*AnyPgColumn\s*=>\s*chatMessages\.id/,
    );
    // onDelete: "set null" for the replyToId FK
    // The file may have multiple onDelete, check replyToId is associated with set null
    const replyToIdx = content.indexOf("reply_to_id");
    expect(replyToIdx).toBeGreaterThan(-1);
    const replyToBlock = content.slice(replyToIdx, replyToIdx + 300);
    expect(replyToBlock).toMatch(/onDelete\s*:\s*["']set null["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Migration SQL (T14-T18)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Migration SQL", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    const files = await readdir(MIGRATIONS_DIR);
    // Find migration file >= 0037 that contains chat enrichment
    const migrationFiles = files
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Look for a migration that contains ALTER TABLE "chat_channels" ADD COLUMN
    let found = false;
    for (const file of migrationFiles) {
      // Only check files >= 0034 (combined migration 0034_tan_sleepwalker.sql)
      const num = parseInt(file.substring(0, 4), 10);
      if (num < 34) continue;

      const content = await readFile(
        resolve(MIGRATIONS_DIR, file),
        "utf-8",
      );
      if (
        content.includes("chat_channels") &&
        content.includes("ADD COLUMN")
      ) {
        migrationContent = content;
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(
        "No CHAT-S02 migration file found (>= 0034) with ALTER TABLE chat_channels ADD COLUMN",
      );
    }
  });

  test("T14 -- Migration contient ALTER TABLE chat_channels ADD COLUMN @chat-s02-migration-file", () => {
    expect(migrationContent).toMatch(
      /ALTER\s+TABLE\s+["']?chat_channels["']?\s+ADD\s+COLUMN/i,
    );
  });

  test("T15 -- Migration contient ALTER TABLE chat_messages ADD COLUMN @chat-s02-migration-file", () => {
    expect(migrationContent).toMatch(
      /ALTER\s+TABLE\s+["']?chat_messages["']?\s+ADD\s+COLUMN/i,
    );
  });

  test("T16 -- Migration contient CREATE INDEX chat_channels_company_project_idx @chat-s02-migration-file", () => {
    expect(migrationContent).toMatch(
      /CREATE\s+INDEX\s+["']?chat_channels_company_project_idx["']?/i,
    );
  });

  test("T17 -- Migration contient CREATE INDEX chat_channels_company_last_msg_idx @chat-s02-migration-file", () => {
    expect(migrationContent).toMatch(
      /CREATE\s+INDEX\s+["']?chat_channels_company_last_msg_idx["']?/i,
    );
  });

  test("T18 -- Migration contient CREATE INDEX chat_messages_reply_to_idx @chat-s02-migration-file", () => {
    expect(migrationContent).toMatch(
      /CREATE\s+INDEX\s+["']?chat_messages_reply_to_idx["']?/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Service -- createChannel enrichi (T19-T21)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Service -- createChannel enrichi", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T19 -- chat.ts createChannel accepte et persiste le parametre projectId @chat-s02-create-channel-project", () => {
    // The createChannel function signature or opts should include projectId
    const createChannelIdx = content.indexOf("createChannel");
    expect(createChannelIdx).toBeGreaterThan(-1);
    const createChannelBlock = content.slice(
      createChannelIdx,
      createChannelIdx + 800,
    );
    expect(createChannelBlock).toContain("projectId");
  });

  test("T20 -- chat.ts createChannel accepte et persiste le parametre createdBy @chat-s02-create-channel-created-by", () => {
    const createChannelIdx = content.indexOf("createChannel");
    expect(createChannelIdx).toBeGreaterThan(-1);
    const createChannelBlock = content.slice(
      createChannelIdx,
      createChannelIdx + 800,
    );
    expect(createChannelBlock).toContain("createdBy");
  });

  test("T21 -- chat.ts createChannel accepte et persiste le parametre description @chat-s02-create-channel-description", () => {
    const createChannelIdx = content.indexOf("createChannel");
    expect(createChannelIdx).toBeGreaterThan(-1);
    const createChannelBlock = content.slice(
      createChannelIdx,
      createChannelIdx + 800,
    );
    expect(createChannelBlock).toContain("description");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Service -- createMessage enrichi (T22-T24)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Service -- createMessage enrichi", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T22 -- chat.ts createMessage met a jour chatChannels.lastMessageAt @chat-s02-last-message-at-update", () => {
    // After inserting a message, the service should update lastMessageAt on the channel
    const createMessageIdx = content.indexOf("createMessage");
    expect(createMessageIdx).toBeGreaterThan(-1);
    // Look for lastMessageAt update in the service -- could be in createMessage or nearby
    // The update should reference chatChannels and lastMessageAt
    expect(content).toContain("lastMessageAt");
    // Should have an update to chatChannels with lastMessageAt
    expect(content).toMatch(/\.update\(\s*chatChannels\s*\)/);
    expect(content).toContain("lastMessageAt");
  });

  test("T23 -- chat.ts createMessage accepte et persiste le parametre messageType @chat-s02-create-message-type", () => {
    const createMessageIdx = content.indexOf("createMessage");
    expect(createMessageIdx).toBeGreaterThan(-1);
    const createMessageBlock = content.slice(
      createMessageIdx,
      createMessageIdx + 800,
    );
    expect(createMessageBlock).toContain("messageType");
  });

  test("T24 -- chat.ts createMessage accepte et persiste le parametre replyToId @chat-s02-create-message-reply", () => {
    const createMessageIdx = content.indexOf("createMessage");
    expect(createMessageIdx).toBeGreaterThan(-1);
    const createMessageBlock = content.slice(
      createMessageIdx,
      createMessageIdx + 800,
    );
    expect(createMessageBlock).toContain("replyToId");
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Service -- nouvelles fonctions (T25-T30)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Service -- nouvelles fonctions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T25 -- chat.ts contient la fonction updateMessage @chat-s02-update-message", () => {
    expect(content).toContain("updateMessage");
    // Should be a function/method in the service
    expect(content).toMatch(/async\s+updateMessage\s*\(/);
  });

  test("T26 -- chat.ts updateMessage met a jour content et set editedAt @chat-s02-update-message", () => {
    const updateIdx = content.indexOf("updateMessage");
    expect(updateIdx).toBeGreaterThan(-1);
    const updateBlock = content.slice(updateIdx, updateIdx + 600);
    expect(updateBlock).toContain("content");
    expect(updateBlock).toContain("editedAt");
  });

  test("T27 -- chat.ts contient la fonction softDeleteMessage @chat-s02-soft-delete-message", () => {
    expect(content).toContain("softDeleteMessage");
    expect(content).toMatch(/async\s+softDeleteMessage\s*\(/);
  });

  test("T28 -- chat.ts softDeleteMessage set deletedAt sans supprimer physiquement @chat-s02-soft-delete-message", () => {
    const softDeleteIdx = content.indexOf("softDeleteMessage");
    expect(softDeleteIdx).toBeGreaterThan(-1);
    const softDeleteBlock = content.slice(softDeleteIdx, softDeleteIdx + 600);
    expect(softDeleteBlock).toContain("deletedAt");
    // Should use update, not delete
    expect(softDeleteBlock).toContain(".update(");
    expect(softDeleteBlock).not.toMatch(/\.delete\(\s*chatMessages\s*\)/);
  });

  test("T29 -- chat.ts contient la fonction getThreadReplies @chat-s02-get-thread-replies", () => {
    expect(content).toContain("getThreadReplies");
    expect(content).toMatch(/async\s+getThreadReplies\s*\(/);
  });

  test("T30 -- chat.ts getThreadReplies filtre par replyToId et ordonne par createdAt @chat-s02-get-thread-replies", () => {
    const threadIdx = content.indexOf("getThreadReplies");
    expect(threadIdx).toBeGreaterThan(-1);
    const threadBlock = content.slice(threadIdx, threadIdx + 600);
    expect(threadBlock).toContain("replyToId");
    expect(threadBlock).toContain("createdAt");
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Service -- filtrage enrichi (T31-T33)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Service -- filtrage enrichi", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("T31 -- chat.ts getMessages filtre les messages avec deletedAt non-null (isNull check) @chat-s02-get-messages-exclude-deleted", () => {
    // getMessages should filter out soft-deleted messages
    const getMessagesIdx = content.indexOf("getMessages");
    expect(getMessagesIdx).toBeGreaterThan(-1);
    // Should use isNull(chatMessages.deletedAt) or similar null check
    expect(content).toMatch(/isNull\(\s*chatMessages\.deletedAt\s*\)/);
  });

  test("T32 -- chat.ts listChannels accepte le filtre projectId @chat-s02-list-channels-project-filter", () => {
    const listChannelsIdx = content.indexOf("listChannels");
    expect(listChannelsIdx).toBeGreaterThan(-1);
    const listChannelsBlock = content.slice(
      listChannelsIdx,
      listChannelsIdx + 1000,
    );
    expect(listChannelsBlock).toContain("projectId");
  });

  test('T33 -- chat.ts listChannels accepte le parametre sortBy avec option "lastMessageAt" @chat-s02-list-channels-sort-last-msg', () => {
    const listChannelsIdx = content.indexOf("listChannels");
    expect(listChannelsIdx).toBeGreaterThan(-1);
    const listChannelsBlock = content.slice(
      listChannelsIdx,
      listChannelsIdx + 1500,
    );
    expect(listChannelsBlock).toContain("sortBy");
    expect(listChannelsBlock).toContain("lastMessageAt");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Routes REST (T34-T37)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Routes REST", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T34 -- routes contient PATCH /companies/:companyId/chat/channels/:channelId/messages/:messageId @chat-s02-patch-message", () => {
    expect(content).toMatch(
      /router\.patch\(\s*\n?\s*["'].*channels\/:channelId\/messages\/:messageId["']/,
    );
  });

  test("T35 -- routes verifie que l'appelant est l'auteur du message (senderId check) @chat-s02-patch-message-author-check", () => {
    // The PATCH message route should check senderId against the current user
    expect(content).toContain("senderId");
    // Should have a forbidden/403 check for non-authors
    const patchIdx = content.indexOf("messages/:messageId");
    expect(patchIdx).toBeGreaterThan(-1);
    const patchBlock = content.slice(patchIdx, patchIdx + 1500);
    expect(patchBlock).toMatch(/(forbidden|403|senderId)/);
  });

  test('T36 -- routes refuse l\'edition des messages avec messageType "system" @chat-s02-patch-message-system-check', () => {
    // Should check for system message type and reject
    expect(content).toContain("system");
    const patchIdx = content.indexOf("messages/:messageId");
    expect(patchIdx).toBeGreaterThan(-1);
    const patchBlock = content.slice(patchIdx, patchIdx + 1500);
    expect(patchBlock).toMatch(/(system|messageType)/);
    // Should reference "system" messages as non-editable
    expect(patchBlock).toMatch(/(system.*cannot|system.*edit|system.*forbid|messageType.*system)/i);
  });

  test("T37 -- routes contient GET /companies/:companyId/chat/channels/:channelId/messages/:messageId/replies @chat-s02-get-replies", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*messages\/:messageId\/replies["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Validators (T38-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Validators", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("T38 -- createChannelSchema contient projectId optional uuid @chat-s02-validator-channel-project", () => {
    const schemaIdx = content.indexOf("createChannelSchema");
    expect(schemaIdx).toBeGreaterThan(-1);
    const schemaBlock = content.slice(schemaIdx, schemaIdx + 500);
    expect(schemaBlock).toContain("projectId");
    expect(schemaBlock).toMatch(/projectId\s*:\s*z\.string\(\)\s*\.uuid\(\)/);
  });

  test("T39 -- createChannelSchema contient description optional max 2000 @chat-s02-validator-channel-description", () => {
    const schemaIdx = content.indexOf("createChannelSchema");
    expect(schemaIdx).toBeGreaterThan(-1);
    const schemaBlock = content.slice(schemaIdx, schemaIdx + 500);
    expect(schemaBlock).toContain("description");
    expect(schemaBlock).toMatch(/description\s*:\s*z\.string\(\)\s*\.max\(\s*2000\s*\)/);
  });

  test("T40 -- chat-ws.ts exporte updateMessageSchema avec content et deleted @chat-s02-validator-update-message", () => {
    expect(content).toContain("updateMessageSchema");
    // Should export updateMessageSchema
    expect(content).toMatch(/export\s+(const|{[^}]*updateMessageSchema)/);
    // updateMessageSchema should have content and deleted fields
    const updateSchemaIdx = content.indexOf("updateMessageSchema");
    expect(updateSchemaIdx).toBeGreaterThan(-1);
    const updateSchemaBlock = content.slice(
      updateSchemaIdx,
      updateSchemaIdx + 400,
    );
    expect(updateSchemaBlock).toContain("content");
    expect(updateSchemaBlock).toContain("deleted");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Types partages (T41-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Types partages", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SHARED_TYPES_FILE, "utf-8");
  });

  test("T41 -- chat-ws.ts exporte le type ChatMessageType @chat-s02-chat-message-type", () => {
    expect(content).toContain("ChatMessageType");
    expect(content).toMatch(/export\s+type\s+ChatMessageType/);
  });

  test('T42 -- ChatMessageType inclut "text", "system", "command", "file_reference" @chat-s02-chat-message-type', () => {
    // Find the ChatMessageType definition and check all 4 values
    const typeIdx = content.indexOf("ChatMessageType");
    expect(typeIdx).toBeGreaterThan(-1);
    const typeBlock = content.slice(typeIdx, typeIdx + 300);
    expect(typeBlock).toContain('"text"');
    expect(typeBlock).toContain('"system"');
    expect(typeBlock).toContain('"command"');
    expect(typeBlock).toContain('"file_reference"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Barrel exports (T43-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Barrel exports", () => {
  test("T43 -- packages/db/src/schema/index.ts exporte chatChannels @chat-s02-channels-project-id", async () => {
    const content = await readFile(SCHEMA_INDEX, "utf-8");
    expect(content).toContain("chatChannels");
    expect(content).toMatch(/export\s+\{[^}]*chatChannels[^}]*\}/);
  });

  test("T44 -- packages/db/src/schema/index.ts exporte chatMessages @chat-s02-messages-message-type", async () => {
    const content = await readFile(SCHEMA_INDEX, "utf-8");
    expect(content).toContain("chatMessages");
    expect(content).toMatch(/export\s+\{[^}]*chatMessages[^}]*\}/);
  });

  test("T45 -- packages/shared/src/types/index.ts re-exporte ChatMessageType @chat-s02-chat-message-type", async () => {
    const content = await readFile(SHARED_TYPES_INDEX, "utf-8");
    expect(content).toContain("ChatMessageType");
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: Backward compatibility et TypeScript
// ---------------------------------------------------------------------------

test.describe("Groupe 12: Backward compatibility", () => {
  test("T46 -- Toutes les nouvelles colonnes chat_channels sont nullable ou ont un default", async () => {
    const content = await readFile(SCHEMA_CHANNELS_FILE, "utf-8");
    // projectId should NOT be notNull (nullable by default or explicitly)
    // Check that the new columns don't have .notNull() chained
    const projectIdLine = content.match(/projectId\s*:[^,\n]+/)?.[0] ?? "";
    expect(projectIdLine).not.toContain(".notNull()");

    const createdByLine = content.match(/createdBy\s*:[^,\n]+/)?.[0] ?? "";
    expect(createdByLine).not.toContain(".notNull()");

    const descriptionLine =
      content.match(/description\s*:\s*text[^,\n]+/)?.[0] ?? "";
    expect(descriptionLine).not.toContain(".notNull()");

    const lastMessageAtLine =
      content.match(/lastMessageAt\s*:[^,\n]+/)?.[0] ?? "";
    expect(lastMessageAtLine).not.toContain(".notNull()");
  });

  test("T47 -- Toutes les nouvelles colonnes chat_messages sont nullable ou ont un default", async () => {
    const content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
    // replyToId should be nullable
    const replyToIdLine =
      content.match(/replyToId\s*:[^,\n]+/)?.[0] ?? "";
    expect(replyToIdLine).not.toContain(".notNull()");

    // editedAt should be nullable
    const editedAtLine =
      content.match(/editedAt\s*:[^,\n]+/)?.[0] ?? "";
    expect(editedAtLine).not.toContain(".notNull()");

    // deletedAt should be nullable
    const deletedAtLine =
      content.match(/deletedAt\s*:[^,\n]+/)?.[0] ?? "";
    expect(deletedAtLine).not.toContain(".notNull()");

    // messageType should have a default (not require an explicit value for existing data)
    expect(content).toMatch(/message_type["']\s*\)[\s\S]*?\.default\(\s*["']text["']\s*\)/);
  });

  test("T48 -- Service existing functions still present (backward compat)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // All original CHAT-S01 functions should still exist
    expect(content).toContain("createChannel");
    expect(content).toContain("getChannel");
    expect(content).toContain("listChannels");
    expect(content).toContain("closeChannel");
    expect(content).toContain("createMessage");
    expect(content).toContain("getMessages");
    expect(content).toContain("getMessagesSince");
    expect(content).toContain("getMessageCount");
  });

  test("T49 -- Service imports isNull from drizzle-orm for soft-delete filtering", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/import\s+\{[^}]*isNull[^}]*\}\s+from\s+["']drizzle-orm["']/);
  });

  test("T50 -- Routes file still has all original CHAT-S01 routes", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Original routes: POST channels, GET channels, GET channel/:id, GET messages, PATCH channel
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*chat\/channels["']/,
    );
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*chat\/channels["']/,
    );
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*channels\/:channelId["']/,
    );
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*channels\/:channelId\/messages["']/,
    );
  });

  test("T51 -- Shared types still export all CHAT-S01 types", async () => {
    const content = await readFile(SHARED_TYPES_FILE, "utf-8");
    expect(content).toContain("ChatChannelStatus");
    expect(content).toContain("ChatSenderType");
    expect(content).toContain("ChatClientPayload");
    expect(content).toContain("ChatServerPayload");
  });

  test("T52 -- Shared index re-exports ChatMessageType alongside existing chat types", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    // Should still export existing chat types
    expect(content).toContain("ChatChannelStatus");
    expect(content).toContain("ChatSenderType");
    // Should also export new ChatMessageType
    expect(content).toContain("ChatMessageType");
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: Migration backward-compatible details
// ---------------------------------------------------------------------------

test.describe("Groupe 13: Migration -- backward-compatible details", () => {
  let migrationContent: string;

  test.beforeAll(async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFiles = files.filter((f) => f.endsWith(".sql")).sort();

    for (const file of migrationFiles) {
      const num = parseInt(file.substring(0, 4), 10);
      if (num < 34) continue;

      const content = await readFile(
        resolve(MIGRATIONS_DIR, file),
        "utf-8",
      );
      if (
        content.includes("chat_channels") &&
        content.includes("ADD COLUMN")
      ) {
        migrationContent = content;
        break;
      }
    }

    if (!migrationContent) {
      throw new Error("No CHAT-S02 migration file found (>= 0034)");
    }
  });

  test("Migration adds project_id column to chat_channels", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?project_id["']?\s+UUID/i,
    );
  });

  test("Migration adds created_by column to chat_channels", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?created_by["']?\s+TEXT/i,
    );
  });

  test("Migration adds description column to chat_channels", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?description["']?\s+TEXT/i,
    );
  });

  test("Migration adds last_message_at column to chat_channels", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?last_message_at["']?\s+TIMESTAMP/i,
    );
  });

  test("Migration adds message_type column to chat_messages with default", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?message_type["']?\s+TEXT/i,
    );
    // Should have DEFAULT 'text'
    expect(migrationContent).toMatch(/DEFAULT\s+['"]text['"]/i);
  });

  test("Migration adds reply_to_id column to chat_messages", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?reply_to_id["']?\s+UUID/i,
    );
  });

  test("Migration adds edited_at column to chat_messages", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?edited_at["']?\s+TIMESTAMP/i,
    );
  });

  test("Migration adds deleted_at column to chat_messages", () => {
    expect(migrationContent).toMatch(
      /ADD\s+COLUMN\s+["']?deleted_at["']?\s+TIMESTAMP/i,
    );
  });
});
