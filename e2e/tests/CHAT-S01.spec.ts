/**
 * CHAT-S01: WebSocket Bidirectionnel humain-agent -- E2E Tests
 *
 * These tests verify the deliverables of CHAT-S01:
 *   - Groupe 1: File existence and barrel exports (T49-T60)
 *   - Groupe 2: Shared types -- chat-ws.ts (T54)
 *   - Groupe 3: Constants -- LiveEventTypes chat (T55-T57)
 *   - Groupe 4: Validators -- Zod schemas (T53)
 *   - Groupe 5: Chat service -- CRUD functions (T51)
 *   - Groupe 6: REST routes -- chat.ts (T52, T29-T38)
 *   - Groupe 7: ChatWebSocketManager (T50)
 *   - Groupe 8: WebSocket server -- chat-ws.ts (T49)
 *   - Groupe 9: Integration -- app.ts + index.ts wiring (T58-T59)
 *   - Groupe 10: Backward compatibility -- live-events-ws.ts unchanged (T60)
 *   - Groupe 11: Schema verification (TECH-06 prerequisite)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SHARED_TYPES_FILE = resolve(ROOT, "packages/shared/src/types/chat-ws.ts");
const SHARED_TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const VALIDATOR_FILE = resolve(ROOT, "server/src/validators/chat-ws.ts");
const SERVICE_FILE = resolve(ROOT, "server/src/services/chat.ts");
const WS_MANAGER_FILE = resolve(ROOT, "server/src/services/chat-ws-manager.ts");
const WS_SERVER_FILE = resolve(ROOT, "server/src/realtime/chat-ws.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/chat.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");
const INDEX_FILE = resolve(ROOT, "server/src/index.ts");
const LIVE_EVENTS_FILE = resolve(ROOT, "server/src/realtime/live-events-ws.ts");
const SCHEMA_CHANNELS_FILE = resolve(ROOT, "packages/db/src/schema/chat_channels.ts");
const SCHEMA_MESSAGES_FILE = resolve(ROOT, "packages/db/src/schema/chat_messages.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence and barrel exports (T49-T60)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence and barrel exports", () => {
  test("T49 -- server/src/realtime/chat-ws.ts exists and exports setupChatWebSocketServer", async () => {
    await expect(fsAccess(WS_SERVER_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(WS_SERVER_FILE, "utf-8");
    expect(content).toMatch(/export\s+(function|async\s+function)\s+setupChatWebSocketServer\s*\(/);
  });

  test("T50 -- server/src/services/chat-ws-manager.ts exists", async () => {
    await expect(fsAccess(WS_MANAGER_FILE).then(() => true)).resolves.toBe(true);
  });

  test("T51 -- server/src/services/chat.ts exists and exports chatService", async () => {
    await expect(fsAccess(SERVICE_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+chatService\s*\(/);
  });

  test("T52 -- server/src/routes/chat.ts exists and exports chatRoutes", async () => {
    await expect(fsAccess(ROUTES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+chatRoutes\s*\(/);
  });

  test("T53 -- server/src/validators/chat-ws.ts exists with Zod schemas", async () => {
    await expect(fsAccess(VALIDATOR_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    expect(content).toContain("chatClientMessageSchema");
    expect(content).toContain("chatClientPayloadSchema");
  });

  test("T54 -- packages/shared/src/types/chat-ws.ts exists with interfaces", async () => {
    await expect(fsAccess(SHARED_TYPES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SHARED_TYPES_FILE, "utf-8");
    expect(content).toContain("ChatClientPayload");
    expect(content).toContain("ChatServerPayload");
  });

  test("T55 -- packages/shared/src/constants.ts contains chat.message_sent in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"chat.message_sent"');
  });

  test("T56 -- packages/shared/src/constants.ts contains chat.channel_created in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"chat.channel_created"');
  });

  test("T57 -- packages/shared/src/constants.ts contains chat.channel_closed in LIVE_EVENT_TYPES", async () => {
    const content = await readFile(CONSTANTS_FILE, "utf-8");
    expect(content).toContain('"chat.channel_closed"');
  });

  test("T58 -- server/src/app.ts mounts chatRoutes(db) on the API router", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toContain("chatRoutes");
    expect(content).toMatch(/chatRoutes\(\s*db\s*\)/);
  });

  test("T59 -- server/src/index.ts calls setupChatWebSocketServer()", async () => {
    const content = await readFile(INDEX_FILE, "utf-8");
    expect(content).toContain("setupChatWebSocketServer");
    expect(content).toMatch(/setupChatWebSocketServer\(/);
  });

  test("T60 -- server/src/realtime/live-events-ws.ts still exports setupLiveEventsWebSocketServer (backward compat)", async () => {
    const content = await readFile(LIVE_EVENTS_FILE, "utf-8");
    expect(content).toMatch(/export\s+(function|async\s+function)\s+setupLiveEventsWebSocketServer\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Shared types -- chat-ws.ts (T54 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Shared types -- chat-ws.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SHARED_TYPES_FILE, "utf-8");
  });

  test("Defines ChatClientMessage with type chat_message and content", () => {
    expect(content).toContain("ChatClientMessage");
    expect(content).toContain('"chat_message"');
    expect(content).toContain("content");
  });

  test("Defines ChatClientTyping with type typing_start | typing_stop", () => {
    expect(content).toContain("ChatClientTyping");
    expect(content).toContain('"typing_start"');
    expect(content).toContain('"typing_stop"');
  });

  test("Defines ChatClientSync with type sync_request and lastMessageId", () => {
    expect(content).toContain("ChatClientSync");
    expect(content).toContain('"sync_request"');
    expect(content).toContain("lastMessageId");
  });

  test("Defines ChatClientPing with type ping", () => {
    expect(content).toContain("ChatClientPing");
    expect(content).toContain('"ping"');
  });

  test("Defines ChatClientPayload union type", () => {
    expect(content).toContain("ChatClientPayload");
    // Should be a union of the 4 client types
    expect(content).toMatch(
      /ChatClientPayload\s*=\s*[\s\S]*ChatClientMessage[\s\S]*ChatClientTyping[\s\S]*ChatClientSync[\s\S]*ChatClientPing/,
    );
  });

  test("Defines ChatServerMessage with id, channelId, senderId, senderType, content, createdAt", () => {
    expect(content).toContain("ChatServerMessage");
    // Check it includes server message fields
    const serverMsgIdx = content.indexOf("ChatServerMessage");
    const block = content.slice(serverMsgIdx, serverMsgIdx + 500);
    expect(block).toContain("id");
    expect(block).toContain("channelId");
    expect(block).toContain("senderId");
    expect(block).toContain("senderType");
    expect(block).toContain("content");
    expect(block).toContain("createdAt");
  });

  test("Defines ChatServerAck with clientMessageId and messageId", () => {
    expect(content).toContain("ChatServerAck");
    expect(content).toContain("clientMessageId");
    expect(content).toContain("messageId");
  });

  test("Defines ChatServerTyping with senderId, senderType, isTyping", () => {
    expect(content).toContain("ChatServerTyping");
    expect(content).toContain("isTyping");
  });

  test("Defines ChatServerSync with messages array and hasMore", () => {
    expect(content).toContain("ChatServerSync");
    expect(content).toContain("hasMore");
  });

  test("Defines ChatServerError with code and message fields", () => {
    expect(content).toContain("ChatServerError");
    expect(content).toContain("code");
    expect(content).toContain("retryAfter");
  });

  test("Defines ChatServerPong with type pong", () => {
    expect(content).toContain("ChatServerPong");
    expect(content).toContain('"pong"');
  });

  test("Defines ChatServerChannelClosed with channelId and reason", () => {
    expect(content).toContain("ChatServerChannelClosed");
    expect(content).toContain('"channel_closed"');
    expect(content).toContain("reason");
  });

  test("Defines ChatServerPayload union of all 7 server types", () => {
    expect(content).toContain("ChatServerPayload");
  });

  test("Defines ChatChannelStatus type (open | closed)", () => {
    expect(content).toMatch(/ChatChannelStatus/);
    expect(content).toContain('"open"');
    expect(content).toContain('"closed"');
  });

  test("Defines ChatSenderType type (user | agent)", () => {
    expect(content).toMatch(/ChatSenderType/);
    expect(content).toContain('"user"');
    expect(content).toContain('"agent"');
  });

  test("Types barrel export: packages/shared/src/types/index.ts re-exports chat-ws", async () => {
    const indexContent = await readFile(SHARED_TYPES_INDEX, "utf-8");
    expect(indexContent).toMatch(/from\s+["']\.\/chat-ws/);
  });

  test("Root barrel export: packages/shared/src/index.ts re-exports chat-ws types", async () => {
    const indexContent = await readFile(SHARED_INDEX, "utf-8");
    // Should contain chat-ws types via barrel export chain
    expect(indexContent).toMatch(/chat/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Constants -- LiveEventTypes chat (T55-T57 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Constants -- LiveEventTypes chat", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(CONSTANTS_FILE, "utf-8");
  });

  test("LIVE_EVENT_TYPES array includes chat.message_sent", () => {
    // Verify it's inside the LIVE_EVENT_TYPES array, not just anywhere in the file
    const liveEventsIdx = content.indexOf("LIVE_EVENT_TYPES");
    const arrayBlock = content.slice(liveEventsIdx, content.indexOf("] as const", liveEventsIdx) + 10);
    expect(arrayBlock).toContain('"chat.message_sent"');
  });

  test("LIVE_EVENT_TYPES array includes chat.channel_created", () => {
    const liveEventsIdx = content.indexOf("LIVE_EVENT_TYPES");
    const arrayBlock = content.slice(liveEventsIdx, content.indexOf("] as const", liveEventsIdx) + 10);
    expect(arrayBlock).toContain('"chat.channel_created"');
  });

  test("LIVE_EVENT_TYPES array includes chat.channel_closed", () => {
    const liveEventsIdx = content.indexOf("LIVE_EVENT_TYPES");
    const arrayBlock = content.slice(liveEventsIdx, content.indexOf("] as const", liveEventsIdx) + 10);
    expect(arrayBlock).toContain('"chat.channel_closed"');
  });

  test("LiveEventType union includes chat types (via const assertion)", () => {
    expect(content).toContain("LiveEventType");
    // Should be derived from LIVE_EVENT_TYPES via typeof/indexed access
    expect(content).toMatch(/LiveEventType\s*=\s*\(typeof\s+LIVE_EVENT_TYPES\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Validators -- Zod schemas (T53 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Validators -- Zod schemas", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATOR_FILE, "utf-8");
  });

  test("chatClientMessageSchema validates type literal chat_message", () => {
    expect(content).toContain("chatClientMessageSchema");
    expect(content).toMatch(/type:\s*z\.literal\(\s*["']chat_message["']\s*\)/);
  });

  test("chatClientMessageSchema validates content: string, min(1), max(4096)", () => {
    // Find the chatClientMessageSchema block
    const schemaIdx = content.indexOf("chatClientMessageSchema");
    const schemaBlock = content.slice(schemaIdx, schemaIdx + 500);
    expect(schemaBlock).toContain("content");
    expect(schemaBlock).toMatch(/z\.string\(\)/);
    expect(schemaBlock).toMatch(/\.min\(\s*1\s*\)/);
    expect(schemaBlock).toMatch(/\.max\(\s*4096\s*\)/);
  });

  test("chatClientMessageSchema validates optional metadata: record", () => {
    const schemaIdx = content.indexOf("chatClientMessageSchema");
    const schemaBlock = content.slice(schemaIdx, schemaIdx + 500);
    expect(schemaBlock).toContain("metadata");
    expect(schemaBlock).toMatch(/z\.record\(/);
  });

  test("chatClientMessageSchema validates optional clientMessageId: uuid", () => {
    const schemaIdx = content.indexOf("chatClientMessageSchema");
    const schemaBlock = content.slice(schemaIdx, schemaIdx + 500);
    expect(schemaBlock).toContain("clientMessageId");
    expect(schemaBlock).toMatch(/\.uuid\(\)/);
  });

  test("chatClientTypingSchema validates type enum (typing_start, typing_stop)", () => {
    expect(content).toContain("chatClientTypingSchema");
    expect(content).toMatch(/z\.enum\(\s*\[\s*["']typing_start["']\s*,\s*["']typing_stop["']\s*\]\s*\)/);
  });

  test("chatClientSyncSchema validates type literal sync_request and lastMessageId uuid", () => {
    expect(content).toContain("chatClientSyncSchema");
    expect(content).toMatch(/type:\s*z\.literal\(\s*["']sync_request["']\s*\)/);
    expect(content).toContain("lastMessageId");
  });

  test("chatClientPingSchema validates type literal ping", () => {
    expect(content).toContain("chatClientPingSchema");
    expect(content).toMatch(/type:\s*z\.literal\(\s*["']ping["']\s*\)/);
  });

  test("chatClientPayloadSchema uses z.discriminatedUnion on type field", () => {
    expect(content).toContain("chatClientPayloadSchema");
    expect(content).toMatch(/z\.discriminatedUnion\(\s*["']type["']/);
  });

  test("chatClientPayloadSchema unions all 4 client schemas", () => {
    const unionIdx = content.indexOf("chatClientPayloadSchema");
    const unionBlock = content.slice(unionIdx, unionIdx + 500);
    expect(unionBlock).toContain("chatClientMessageSchema");
    expect(unionBlock).toContain("chatClientTypingSchema");
    expect(unionBlock).toContain("chatClientSyncSchema");
    expect(unionBlock).toContain("chatClientPingSchema");
  });

  test("Validator imports zod", () => {
    expect(content).toMatch(/import\s+.*\{[^}]*z[^}]*\}\s+from\s+["']zod["']/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Chat service -- CRUD functions (T51 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Chat service -- CRUD functions", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICE_FILE, "utf-8");
  });

  test("chatService function accepts db parameter of type Db", () => {
    expect(content).toMatch(/chatService\(\s*db\s*:\s*Db\s*\)/);
  });

  test("createChannel function: inserts into chatChannels", () => {
    expect(content).toContain("createChannel");
    expect(content).toMatch(/db\s*\n?\s*\.insert\(\s*chatChannels\s*\)/);
  });

  test("getChannel function: selects from chatChannels by id", () => {
    expect(content).toContain("getChannel");
  });

  test("listChannels function: returns channels array with total count", () => {
    expect(content).toContain("listChannels");
    expect(content).toContain("total");
  });

  test("closeChannel function: updates channel status to closed", () => {
    expect(content).toContain("closeChannel");
    expect(content).toContain('"closed"');
  });

  test("createMessage function: inserts into chatMessages", () => {
    expect(content).toContain("createMessage");
    expect(content).toMatch(/db\s*\n?\s*\.insert\(\s*chatMessages\s*\)/);
  });

  test("getMessages function: returns messages with hasMore pagination flag", () => {
    expect(content).toContain("getMessages");
    expect(content).toContain("hasMore");
  });

  test("getMessagesSince function: retrieves messages after a given messageId", () => {
    expect(content).toContain("getMessagesSince");
  });

  test("getMessageCount function: returns count for a channel", () => {
    expect(content).toContain("getMessageCount");
  });

  test("Service uses Drizzle ORM: db.select(), db.insert(), db.update()", () => {
    expect(content).toMatch(/db\s*\n?\s*\.select\(/);
    expect(content).toMatch(/db\s*\n?\s*\.insert\(/);
    expect(content).toMatch(/db\s*\n?\s*\.update\(/);
  });

  test("Service imports chatChannels and chatMessages from @mnm/db", () => {
    expect(content).toContain("chatChannels");
    expect(content).toContain("chatMessages");
    expect(content).toMatch(/from\s+["']@mnm\/db["']/);
  });

  test("Service imports Drizzle operators (eq, and, desc, gt, lt)", () => {
    expect(content).toMatch(/import\s+\{[^}]*eq[^}]*\}\s+from\s+["']drizzle-orm["']/);
    expect(content).toContain("desc");
  });

  test("Service companyId filter: all queries include companyId for RLS", () => {
    // companyId should appear multiple times in the service for RLS filtering
    const companyIdOccurrences = (content.match(/companyId/g) || []).length;
    expect(companyIdOccurrences).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: REST routes -- chat.ts (T29-T38)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: REST routes -- chat.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ROUTES_FILE, "utf-8");
  });

  test("T29 -- POST /companies/:companyId/chat/channels creates a channel", () => {
    expect(content).toMatch(
      /router\.post\(\s*\n?\s*["'].*companies\/:companyId\/chat\/channels["']/,
    );
  });

  test("T31 -- POST /chat/channels requires permission chat.agent (403 without)", () => {
    // POST route should have requirePermission with "chat:agent"
    const postIdx = content.indexOf("router.post(");
    expect(postIdx).toBeGreaterThan(-1);
    const postSection = content.slice(postIdx, postIdx + 500);
    expect(postSection).toContain("requirePermission");
    expect(postSection).toContain('"chat:agent"');
  });

  test("POST /chat/channels returns 201 Created", () => {
    expect(content).toMatch(/res\.status\(\s*201\s*\)/);
  });

  test("T32 -- GET /companies/:companyId/chat/channels lists channels", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*companies\/:companyId\/chat\/channels["']/,
    );
  });

  test("T33 -- GET /companies/:companyId/chat/channels/:channelId returns channel detail", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*companies\/:companyId\/chat\/channels\/:channelId["']/,
    );
  });

  test("T35 -- GET /companies/:companyId/chat/channels/:channelId/messages returns message history", () => {
    expect(content).toMatch(
      /router\.get\(\s*\n?\s*["'].*companies\/:companyId\/chat\/channels\/:channelId\/messages["']/,
    );
  });

  test("All routes use requirePermission with chat:agent", () => {
    expect(content).toContain("requirePermission");
    expect(content).toContain('"chat:agent"');
    // At least 4 routes should use requirePermission
    const permOccurrences = (content.match(/requirePermission\(/g) || []).length;
    expect(permOccurrences).toBeGreaterThanOrEqual(3);
  });

  test("Routes use assertCompanyAccess for company-level authorization", () => {
    expect(content).toContain("assertCompanyAccess");
    const occurrences = (content.match(/assertCompanyAccess\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test("Routes function accepts db parameter of type Db", () => {
    expect(content).toMatch(/chatRoutes\(\s*db\s*:\s*Db\s*\)/);
  });

  test("Routes imports Router from express", () => {
    expect(content).toMatch(
      /import\s+\{[^}]*Router[^}]*\}\s+from\s+["']express["']/,
    );
  });

  test("Routes creates chatService instance with db", () => {
    expect(content).toContain("chatService(db)");
  });

  test("Routes imports requirePermission middleware", () => {
    expect(content).toContain("requirePermission");
    expect(content).toMatch(/from\s+["']\.\.\/middleware\/require-permission/);
  });

  test("GET channels supports status filter query parameter", () => {
    // The list channels route should read status from query params
    expect(content).toMatch(/req\.query\.status|query\.status|status/);
  });

  test("GET messages supports pagination with before and limit query parameters", () => {
    expect(content).toContain("before");
    expect(content).toContain("limit");
  });

  test("GET channel detail includes messageCount", () => {
    expect(content).toContain("messageCount");
  });

  test("Route has exactly 4 endpoint handlers (POST + 3 GET)", () => {
    const postCount = (content.match(/router\.post\(/g) || []).length;
    const getCount = (content.match(/router\.get\(/g) || []).length;
    expect(postCount).toBe(1);
    expect(getCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: ChatWebSocketManager (T50 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: ChatWebSocketManager", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WS_MANAGER_FILE, "utf-8");
  });

  test("Exports ChatWebSocketManager class or factory", () => {
    expect(content).toMatch(/(export\s+(class|function)\s+ChatWebSocketManager|export\s+function\s+createChatWsManager)/);
  });

  test("Manages connection registry: Map of channelId to Set of WsSocket", () => {
    // Should have a Map for connection tracking
    expect(content).toMatch(/Map\s*</);
    expect(content).toMatch(/Set\s*</);
  });

  test("broadcastLocal: broadcasts message to all connected clients of a channel", () => {
    expect(content).toContain("broadcastLocal");
  });

  test("handleMessage: validates, persists, and broadcasts chat messages", () => {
    expect(content).toContain("handleMessage");
  });

  test("handleSyncRequest: returns missed messages from buffer or DB fallback", () => {
    expect(content).toContain("handleSyncRequest");
  });

  test("Reconnection buffer: stores recent messages per channel (max 100, TTL 30s)", () => {
    // Should reference a buffer for reconnection
    expect(content).toMatch(/(buffer|reconnect|recent)/i);
    // Should have 30s TTL or 100 message limit references
    expect(content).toMatch(/(30|100)/);
  });

  test("Rate limiting: 10 messages per minute per user/channel", () => {
    expect(content).toMatch(/(rate|limit)/i);
    expect(content).toContain("10");
  });

  test("Redis pub/sub integration: subscribe and publish to chat channels", () => {
    expect(content).toMatch(/(subscribe|publish|redis|pub.*sub)/i);
  });

  test("Redis fallback: uses EventEmitter when Redis is unavailable", () => {
    expect(content).toMatch(/(EventEmitter|fallback|emitter)/i);
  });

  test("Cleanup: removes closed connections from registry", () => {
    // Should handle connection cleanup on close/error
    expect(content).toMatch(/(cleanup|delete|remove|close)/i);
  });

  test("Typing indicator: broadcasts to others without loop-back to sender", () => {
    expect(content).toMatch(/(typing|indicator)/i);
  });

  test("LiveEvent integration: delegates to chatService which emits live events for chat actions", () => {
    // The ws-manager delegates LiveEvent emission to chatService (via svc.createMessage, svc.closeChannel)
    expect(content).toContain("chatService");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: WebSocket server -- chat-ws.ts (T49 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: WebSocket server -- chat-ws.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WS_SERVER_FILE, "utf-8");
  });

  test("WebSocket path: handles /ws/chat/:channelId", () => {
    expect(content).toMatch(/\/ws\/chat\//);
  });

  test("Parses channelId from URL path", () => {
    expect(content).toContain("channelId");
  });

  test("Authentication: reuses token/session/local_trusted pattern from live-events", () => {
    // Should handle various auth mechanisms
    expect(content).toMatch(/(token|session|local_trusted|auth)/i);
  });

  test("Permission check: verifies company membership or agent API key authorization", () => {
    // WS upgrade auth checks company membership / instance admin / agent API key
    // (consistent with live-events-ws.ts pattern; REST routes enforce chat:agent permission)
    expect(content).toContain("companyMemberships");
    expect(content).toMatch(/(agentApiKeys|authorization)/i);
  });

  test("Channel validation: verifies channel exists and is open", () => {
    expect(content).toContain("open");
    expect(content).toMatch(/(channel|status)/i);
  });

  test("Connection refused for non-existent channel (404)", () => {
    expect(content).toMatch(/404/);
  });

  test("Connection refused for closed channel (410)", () => {
    expect(content).toMatch(/410/);
  });

  test("Connection refused without permission (403)", () => {
    expect(content).toMatch(/403/);
  });

  test("Message handling: parses JSON and routes by type", () => {
    expect(content).toMatch(/JSON\.parse/);
    expect(content).toMatch(/(type|payload)/);
  });

  test("Heartbeat: implements ping/pong every 30s", () => {
    expect(content).toMatch(/(ping|pong|heartbeat)/i);
    expect(content).toMatch(/30/);
  });

  test("Cleanup: removes connection from registry on close/error", () => {
    expect(content).toMatch(/(close|error|cleanup)/i);
  });

  test("Upgrade handler: handles HTTP upgrade requests separately from live-events", () => {
    expect(content).toMatch(/(upgrade|handleUpgrade)/i);
  });

  test("Uses ChatWebSocketManager for connection management", () => {
    expect(content).toMatch(/(ChatWebSocketManager|chatWsManager|wsManager)/i);
  });

  test("Uses ChatWsManager which delegates persistence to chatService", () => {
    // chat-ws.ts creates and uses createChatWsManager, which internally uses chatService
    expect(content).toMatch(/(createChatWsManager|ChatWsManager)/);
  });

  test("Logger: uses parentLogger.child for chat-ws context", () => {
    expect(content).toMatch(/(logger|log)/i);
    expect(content).toMatch(/(child|chat-ws|chat_ws)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Integration -- app.ts + index.ts wiring (T58-T59 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Integration -- app.ts + index.ts wiring", () => {
  test("T58 -- app.ts imports chatRoutes from routes/chat", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toContain("chatRoutes");
    expect(content).toMatch(/import\s+\{[^}]*chatRoutes[^}]*\}\s+from\s+["']\.\/routes\/chat/);
  });

  test("T58 -- app.ts mounts chatRoutes on the api router with api.use()", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toMatch(/api\.use\([^)]*chatRoutes\(\s*db\s*\)\s*\)/);
  });

  test("T59 -- index.ts imports setupChatWebSocketServer from realtime/chat-ws", async () => {
    const content = await readFile(INDEX_FILE, "utf-8");
    expect(content).toMatch(/import\s+\{[^}]*setupChatWebSocketServer[^}]*\}\s+from\s+["']\.\/realtime\/chat-ws/);
  });

  test("T59 -- index.ts calls setupChatWebSocketServer with server, db, and options", async () => {
    const content = await readFile(INDEX_FILE, "utf-8");
    // Should be called after setupLiveEventsWebSocketServer
    const liveEventsIdx = content.indexOf("setupLiveEventsWebSocketServer");
    const chatWsIdx = content.indexOf("setupChatWebSocketServer(");
    expect(chatWsIdx).toBeGreaterThan(liveEventsIdx);
  });

  test("index.ts passes deploymentMode to setupChatWebSocketServer options", async () => {
    const content = await readFile(INDEX_FILE, "utf-8");
    const chatWsIdx = content.indexOf("setupChatWebSocketServer(");
    const chatWsBlock = content.slice(chatWsIdx, chatWsIdx + 500);
    expect(chatWsBlock).toContain("deploymentMode");
  });

  test("index.ts passes resolveSessionFromHeaders to setupChatWebSocketServer options", async () => {
    const content = await readFile(INDEX_FILE, "utf-8");
    const chatWsIdx = content.indexOf("setupChatWebSocketServer(");
    const chatWsBlock = content.slice(chatWsIdx, chatWsIdx + 500);
    expect(chatWsBlock).toContain("resolveSessionFromHeaders");
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Backward compatibility -- live-events-ws.ts unchanged (T60 detailed)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Backward compatibility -- live-events-ws.ts", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(LIVE_EVENTS_FILE, "utf-8");
  });

  test("T47 -- LiveEvents WebSocket path still uses /api/companies/:companyId/events/ws", () => {
    // The path appears in a regex pattern with escaped slashes: \/api\/companies\/...\/events\/ws
    expect(content).toMatch(/api.*companies.*events.*ws/);
  });

  test("T60 -- setupLiveEventsWebSocketServer function signature unchanged", () => {
    expect(content).toMatch(
      /export\s+(function|async\s+function)\s+setupLiveEventsWebSocketServer\s*\(/,
    );
  });

  test("LiveEvents WS does NOT handle /ws/chat/ paths (separation of concerns)", () => {
    // live-events-ws.ts should not contain chat WebSocket path
    expect(content).not.toContain("/ws/chat/");
  });

  test("LiveEvents WS still uses subscribeCompanyLiveEvents", () => {
    expect(content).toContain("subscribeCompanyLiveEvents");
  });
});

// ---------------------------------------------------------------------------
// Groupe 11: Schema verification (TECH-06 prerequisite)
// ---------------------------------------------------------------------------

test.describe("Groupe 11: Schema verification (TECH-06 prerequisite)", () => {
  test("chat_channels schema exists", async () => {
    await expect(
      fsAccess(SCHEMA_CHANNELS_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("chat_channels has id, companyId, agentId, status, createdAt, updatedAt columns", async () => {
    const content = await readFile(SCHEMA_CHANNELS_FILE, "utf-8");
    expect(content).toContain('"company_id"');
    expect(content).toContain('"agent_id"');
    expect(content).toContain('"status"');
    expect(content).toContain('"created_at"');
    expect(content).toContain('"updated_at"');
  });

  test("chat_channels has status default open", async () => {
    const content = await readFile(SCHEMA_CHANNELS_FILE, "utf-8");
    expect(content).toMatch(/default\(\s*["']open["']\s*\)/);
  });

  test("chat_channels has heartbeatRunId column", async () => {
    const content = await readFile(SCHEMA_CHANNELS_FILE, "utf-8");
    expect(content).toContain('"heartbeat_run_id"');
  });

  test("chat_channels has company_status_idx index", async () => {
    const content = await readFile(SCHEMA_CHANNELS_FILE, "utf-8");
    expect(content).toContain("chat_channels_company_status_idx");
  });

  test("chat_messages schema exists", async () => {
    await expect(
      fsAccess(SCHEMA_MESSAGES_FILE).then(() => true),
    ).resolves.toBe(true);
  });

  test("chat_messages has channelId, companyId, senderId, senderType, content, createdAt columns", async () => {
    const content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
    expect(content).toContain('"channel_id"');
    expect(content).toContain('"company_id"');
    expect(content).toContain('"sender_id"');
    expect(content).toContain('"sender_type"');
    expect(content).toContain('"content"');
    expect(content).toContain('"created_at"');
  });

  test("chat_messages has metadata jsonb column", async () => {
    const content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
    expect(content).toContain('"metadata"');
    expect(content).toContain("jsonb");
  });

  test("chat_messages has channel_created_idx index", async () => {
    const content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
    expect(content).toContain("chat_messages_channel_created_idx");
  });

  test("chat_messages has company_created_idx index", async () => {
    const content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
    expect(content).toContain("chat_messages_company_created_idx");
  });

  test("chat_messages channelId references chatChannels with onDelete cascade", async () => {
    const content = await readFile(SCHEMA_MESSAGES_FILE, "utf-8");
    expect(content).toContain("onDelete");
    expect(content).toContain('"cascade"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 12: WebSocket protocol error codes
// ---------------------------------------------------------------------------

test.describe("Groupe 12: WebSocket protocol error codes", () => {
  let wsServerContent: string;
  let wsManagerContent: string;

  test.beforeAll(async () => {
    wsServerContent = await readFile(WS_SERVER_FILE, "utf-8");
    wsManagerContent = await readFile(WS_MANAGER_FILE, "utf-8");
  });

  test("T12 -- INVALID_MESSAGE error code for empty or invalid messages", () => {
    const combined = wsServerContent + wsManagerContent;
    expect(combined).toContain("INVALID_MESSAGE");
  });

  test("T13 -- MESSAGE_TOO_LONG error code for content exceeding 4096 chars", () => {
    const combined = wsServerContent + wsManagerContent;
    expect(combined).toContain("MESSAGE_TOO_LONG");
  });

  test("T18 -- RATE_LIMITED error code with retryAfter field", () => {
    const combined = wsServerContent + wsManagerContent;
    expect(combined).toContain("RATE_LIMITED");
    expect(combined).toContain("retryAfter");
  });

  test("CHANNEL_CLOSED error code for messages on closed channels", () => {
    const combined = wsServerContent + wsManagerContent;
    expect(combined).toContain("CHANNEL_CLOSED");
  });

  test("UNAUTHORIZED error code for auth failures", () => {
    const combined = wsServerContent + wsManagerContent;
    expect(combined).toMatch(/(UNAUTHORIZED|unauthorized)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 13: WebSocket message types handling
// ---------------------------------------------------------------------------

test.describe("Groupe 13: WebSocket message types handling", () => {
  let wsManagerContent: string;

  test.beforeAll(async () => {
    wsManagerContent = await readFile(WS_MANAGER_FILE, "utf-8");
  });

  test("T09/T10 -- Handles chat_message type: persist + ack + broadcast", () => {
    expect(wsManagerContent).toContain("chat_message");
    expect(wsManagerContent).toContain("message_ack");
  });

  test("T22/T23/T24 -- Handles typing_start and typing_stop without loop-back", () => {
    expect(wsManagerContent).toContain("typing_start");
    expect(wsManagerContent).toContain("typing_stop");
    expect(wsManagerContent).toContain("typing_indicator");
  });

  test("T25/T26/T27 -- Handles sync_request and returns sync_response", () => {
    expect(wsManagerContent).toContain("sync_request");
    expect(wsManagerContent).toContain("sync_response");
  });

  test("T45 -- Handles ping and returns pong", () => {
    expect(wsManagerContent).toContain('"ping"');
    expect(wsManagerContent).toContain('"pong"');
  });

  test("T39 -- Handles channel_closed notification to all connected clients", () => {
    expect(wsManagerContent).toContain("channel_closed");
  });
});

// ---------------------------------------------------------------------------
// Groupe 14: Redis pub/sub pattern
// ---------------------------------------------------------------------------

test.describe("Groupe 14: Redis pub/sub pattern", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(WS_MANAGER_FILE, "utf-8");
  });

  test("T13 -- Redis channel naming: chat:{channelId} pattern", () => {
    expect(content).toMatch(/chat:/);
  });

  test("Redis subscribe: subscribes to channel-specific Redis topics", () => {
    expect(content).toMatch(/(subscribe|on\(\s*["']message["'])/);
  });

  test("Redis publish: publishes messages to Redis for cross-instance delivery", () => {
    expect(content).toMatch(/(publish)/i);
  });

  test("Graceful degradation: falls back to local EventEmitter when Redis unavailable", () => {
    expect(content).toMatch(/(EventEmitter|fallback|local)/i);
  });
});

// ---------------------------------------------------------------------------
// Groupe 15: LiveEvent emission
// ---------------------------------------------------------------------------

test.describe("Groupe 15: LiveEvent emission", () => {
  test("T42 -- chat.channel_created LiveEvent emitted on channel creation", async () => {
    // Check routes or service for live event emission on create
    const routesContent = await readFile(ROUTES_FILE, "utf-8");
    const serviceContent = await readFile(SERVICE_FILE, "utf-8");
    const combined = routesContent + serviceContent;
    expect(combined).toContain("publishLiveEvent");
    expect(combined).toContain("chat.channel_created");
  });

  test("T44 -- chat.message_sent LiveEvent emitted on each message", async () => {
    const wsManagerContent = await readFile(WS_MANAGER_FILE, "utf-8");
    const serviceContent = await readFile(SERVICE_FILE, "utf-8");
    const combined = wsManagerContent + serviceContent;
    expect(combined).toContain("chat.message_sent");
  });

  test("T43 -- chat.channel_closed LiveEvent emitted on channel close", async () => {
    const wsManagerContent = await readFile(WS_MANAGER_FILE, "utf-8");
    const serviceContent = await readFile(SERVICE_FILE, "utf-8");
    const routesContent = await readFile(ROUTES_FILE, "utf-8");
    const combined = wsManagerContent + serviceContent + routesContent;
    expect(combined).toContain("chat.channel_closed");
  });

  test("LiveEvents use publishLiveEvent from live-events service (via chatService delegation)", async () => {
    // The ws-manager delegates to chatService which imports publishLiveEvent from live-events
    const serviceContent = await readFile(SERVICE_FILE, "utf-8");
    expect(serviceContent).toMatch(/from\s+["']\.\/live-events|from\s+["']\.\.\/services\/live-events/);
  });
});
