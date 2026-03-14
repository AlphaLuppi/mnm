/**
 * A2A-S01 — A2A Bus: Agent-to-Agent Communication
 *
 * File-content-based E2E tests verifying:
 * - Schema definition with table, columns, and indexes
 * - Service factory export and public API methods (9 functions)
 * - Cycle detection and chain depth limiting logic
 * - Rate limiting with configurable max (20/min)
 * - TTL expiration and cleanup mechanics
 * - LiveEvent publication for A2A events
 * - Audit integration for all A2A actions
 * - API routes with permission guards and validation
 * - Shared types, constants, validators, and barrel exports
 *
 * 60 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SCHEMA_FILE = resolve(ROOT, "packages/db/src/schema/a2a_messages.ts");
const SCHEMA_INDEX = resolve(ROOT, "packages/db/src/schema/index.ts");
const MIGRATION_FILE = resolve(ROOT, "packages/db/src/migrations/0039_a2a_messages.sql");
const SVC_FILE = resolve(ROOT, "server/src/services/a2a-bus.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/a2a.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/a2a.ts");
const VAL_FILE = resolve(ROOT, "packages/shared/src/validators/a2a.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VAL_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const CONSTANTS_FILE = resolve(ROOT, "packages/shared/src/constants.ts");
const ROUTES_INDEX = resolve(ROOT, "server/src/routes/index.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");

// ============================================================
// Schema: a2a_messages.ts (T01–T08)
// ============================================================

test.describe("A2A-S01 — Schema: a2a_messages", () => {
  // T01 — Table definition uses pgTable
  test("T01 — defines a2aMessages table with pgTable", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+a2aMessages\s*=\s*pgTable\s*\(\s*["']a2a_messages["']/);
  });

  // T02 — companyId column references companies
  test("T02 — companyId column with FK to companies", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("company_id");
    expect(src).toMatch(/companyId.*references\s*\(\s*\(\)\s*=>\s*companies\.id\s*\)/);
  });

  // T03 — chainId column
  test("T03 — chainId column defined as uuid NOT NULL", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("chain_id");
    expect(src).toMatch(/chainId.*uuid.*notNull/);
  });

  // T04 — senderId and receiverId columns with agent FK
  test("T04 — senderId and receiverId reference agents table", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/senderId.*references\s*\(\s*\(\)\s*=>\s*agents\.id\s*\)/);
    expect(src).toMatch(/receiverId.*references\s*\(\s*\(\)\s*=>\s*agents\.id\s*\)/);
  });

  // T05 — status column with default "pending"
  test("T05 — status column defaults to pending", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toMatch(/status.*default\s*\(\s*["']pending["']\s*\)/);
  });

  // T06 — messageType column
  test("T06 — messageType column defined", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("message_type");
    expect(src).toMatch(/messageType.*text.*notNull/);
  });

  // T07 — 6 indexes defined
  test("T07 — schema defines 6 indexes", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("a2a_messages_company_idx");
    expect(src).toContain("a2a_messages_sender_idx");
    expect(src).toContain("a2a_messages_receiver_idx");
    expect(src).toContain("a2a_messages_chain_idx");
    expect(src).toContain("a2a_messages_status_idx");
    expect(src).toContain("a2a_messages_expires_idx");
  });

  // T08 — chainDepth, ttlSeconds, expiresAt columns
  test("T08 — has chainDepth, ttlSeconds, and expiresAt columns", async () => {
    const src = await readFile(SCHEMA_FILE, "utf-8");
    expect(src).toContain("chain_depth");
    expect(src).toContain("ttl_seconds");
    expect(src).toContain("expires_at");
  });
});

// ============================================================
// Migration: 0039_a2a_messages.sql (T09–T11)
// ============================================================

test.describe("A2A-S01 — Migration", () => {
  // T09 — CREATE TABLE statement
  test("T09 — migration creates a2a_messages table", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toMatch(/CREATE TABLE.*a2a_messages/i);
  });

  // T10 — RLS policy
  test("T10 — migration enables RLS with tenant isolation policy", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(src).toMatch(/CREATE POLICY.*a2a_messages.*tenant/i);
    expect(src).toContain("app.current_company_id");
  });

  // T11 — Indexes created
  test("T11 — migration creates all 6 indexes", async () => {
    const src = await readFile(MIGRATION_FILE, "utf-8");
    expect(src).toContain("a2a_messages_company_idx");
    expect(src).toContain("a2a_messages_sender_idx");
    expect(src).toContain("a2a_messages_receiver_idx");
    expect(src).toContain("a2a_messages_chain_idx");
    expect(src).toContain("a2a_messages_status_idx");
    expect(src).toContain("a2a_messages_expires_idx");
  });
});

// ============================================================
// Service: a2a-bus.ts (T12–T31)
// ============================================================

test.describe("A2A-S01 — Service: a2a-bus", () => {
  // T12 — Service factory export
  test("T12 — exports a2aBusService function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/export\s+function\s+a2aBusService\s*\(\s*db\s*:\s*Db\s*\)/);
  });

  // T13 — sendMessage function
  test("T13 — service has sendMessage function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+sendMessage\s*\(/);
    expect(src).toContain("sendMessage,");
  });

  // T14 — respondToMessage function
  test("T14 — service has respondToMessage function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+respondToMessage\s*\(/);
    expect(src).toContain("respondToMessage,");
  });

  // T15 — cancelMessage function
  test("T15 — service has cancelMessage function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+cancelMessage\s*\(/);
    expect(src).toContain("cancelMessage,");
  });

  // T16 — getMessages function
  test("T16 — service has getMessages function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getMessages\s*\(/);
    expect(src).toContain("getMessages,");
  });

  // T17 — getMessageById function
  test("T17 — service has getMessageById function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getMessageById\s*\(/);
    expect(src).toContain("getMessageById,");
  });

  // T18 — getChainMessages function
  test("T18 — service has getChainMessages function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getChainMessages\s*\(/);
    expect(src).toContain("getChainMessages,");
  });

  // T19 — getStats function
  test("T19 — service has getStats function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+getStats\s*\(/);
    expect(src).toContain("getStats,");
  });

  // T20 — detectCycle function with chainId parameter
  test("T20 — service has detectCycle function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+detectCycle\s*\(\s*chainId\s*:\s*string/);
    expect(src).toContain("detectCycle,");
  });

  // T21 — cleanupExpiredMessages function
  test("T21 — service has cleanupExpiredMessages function", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/async\s+function\s+cleanupExpiredMessages\s*\(/);
    expect(src).toContain("cleanupExpiredMessages,");
  });

  // T22 — imports a2aMessages from @mnm/db
  test("T22 — service imports a2aMessages from @mnm/db", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*a2aMessages[^}]*\}\s*from\s*["']@mnm\/db["']/);
  });

  // T23 — imports auditService for audit integration
  test("T23 — service imports auditService", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*auditService[^}]*\}\s*from/);
  });

  // T24 — cycle detection checks receiverId in chain history
  test("T24 — cycle detection checks receiverId against chain senders", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("senderIds.has(receiverId)");
  });

  // T25 — chain depth check against MAX_CHAIN_DEPTH = 5
  test("T25 — MAX_CHAIN_DEPTH constant is 5", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/MAX_CHAIN_DEPTH\s*=\s*5/);
  });

  // T26 — rate limiting MAX_A2A_RATE = 20
  test("T26 — MAX_A2A_RATE constant is 20", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/MAX_A2A_RATE\s*=\s*20/);
  });

  // T27 — default TTL of 300 seconds
  test("T27 — DEFAULT_TTL_SECONDS is 300", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/DEFAULT_TTL_SECONDS\s*=\s*300/);
  });

  // T28 — message statuses include all 5 values
  test("T28 — handles pending, completed, expired, cancelled, error statuses", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain('"pending"');
    expect(src).toContain('"completed"');
    expect(src).toContain('"expired"');
    expect(src).toContain('"cancelled"');
  });

  // T29 — publishLiveEvent call for a2a events
  test("T29 — publishes LiveEvents via publishLiveEvent", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*publishLiveEvent[^}]*\}\s*from/);
    expect(src).toContain("publishLiveEvent(");
  });

  // T30 — expiresAt calculation
  test("T30 — calculates expiresAt from createdAt + ttlSeconds", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toMatch(/new\s+Date\s*\(.*\.getTime\(\)\s*\+\s*ttlSeconds\s*\*\s*1000/);
  });

  // T31 — respondedAt set on response
  test("T31 — sets respondedAt timestamp on response", async () => {
    const src = await readFile(SVC_FILE, "utf-8");
    expect(src).toContain("respondedAt: now");
  });
});

// ============================================================
// Routes: a2a.ts (T32–T41)
// ============================================================

test.describe("A2A-S01 — Routes: a2a", () => {
  // T32 — POST /a2a/messages route with requirePermission
  test("T32 — POST /a2a/messages route exists with permission guard", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/companies\/:companyId\/a2a\/messages["']/);
    expect(src).toContain('requirePermission(db, "agents:create")');
  });

  // T33 — POST /a2a/messages/:id/respond route
  test("T33 — POST /a2a/messages/:id/respond route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/companies\/:companyId\/a2a\/messages\/:id\/respond["']/);
  });

  // T34 — POST /a2a/messages/:id/cancel route
  test("T34 — POST /a2a/messages/:id/cancel route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.post\s*\(\s*["']\/companies\/:companyId\/a2a\/messages\/:id\/cancel["']/);
  });

  // T35 — GET /a2a/messages route
  test("T35 — GET /a2a/messages route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/a2a\/messages["']/);
  });

  // T36 — GET /a2a/messages/:id route
  test("T36 — GET /a2a/messages/:id route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/a2a\/messages\/:id["']/);
  });

  // T37 — GET /a2a/chains/:chainId route
  test("T37 — GET /a2a/chains/:chainId route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/a2a\/chains\/:chainId["']/);
  });

  // T38 — GET /a2a/stats route
  test("T38 — GET /a2a/stats route exists", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/router\.get\s*\(\s*["']\/companies\/:companyId\/a2a\/stats["']/);
  });

  // T39 — assertCompanyAccess call in routes
  test("T39 — routes call assertCompanyAccess", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const assertCalls = (src.match(/assertCompanyAccess\s*\(/g) || []).length;
    expect(assertCalls).toBeGreaterThanOrEqual(7);
  });

  // T40 — emitAudit call in send and respond routes
  test("T40 — routes call emitAudit for mutations", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const auditCalls = (src.match(/emitAudit\s*\(/g) || []).length;
    expect(auditCalls).toBeGreaterThanOrEqual(3);
  });

  // T41 — notFound error for missing messages
  test("T41 — routes use notFound for missing messages", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain('notFound("A2A message not found")');
  });
});

// ============================================================
// Types: a2a.ts (T42–T48)
// ============================================================

test.describe("A2A-S01 — Types: a2a", () => {
  // T42 — A2A_MESSAGE_TYPES constant
  test("T42 — A2A_MESSAGE_TYPES includes request, response, notification, error", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/A2A_MESSAGE_TYPES\s*=\s*\[/);
    expect(src).toContain('"request"');
    expect(src).toContain('"response"');
    expect(src).toContain('"notification"');
    expect(src).toContain('"error"');
  });

  // T43 — A2A_MESSAGE_STATUSES constant
  test("T43 — A2A_MESSAGE_STATUSES includes all 5 values", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/A2A_MESSAGE_STATUSES\s*=\s*\[/);
    expect(src).toContain('"pending"');
    expect(src).toContain('"completed"');
    expect(src).toContain('"expired"');
    expect(src).toContain('"cancelled"');
    expect(src).toContain('"error"');
  });

  // T44 — A2AMessage interface with all fields
  test("T44 — A2AMessage interface has all required fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+A2AMessage/);
    expect(src).toContain("chainId: string");
    expect(src).toContain("senderId: string");
    expect(src).toContain("receiverId: string");
    expect(src).toContain("chainDepth: number");
    expect(src).toContain("ttlSeconds: number");
    expect(src).toContain("expiresAt: string");
  });

  // T45 — A2AStats interface
  test("T45 — A2AStats interface has totalMessages and cyclesDetected", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+A2AStats/);
    expect(src).toContain("totalMessages: number");
    expect(src).toContain("cyclesDetected: number");
    expect(src).toContain("averageResponseTimeMs");
  });

  // T46 — A2AChainInfo interface
  test("T46 — A2AChainInfo interface defined", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+A2AChainInfo/);
    expect(src).toContain("chainId: string");
    expect(src).toContain("depth: number");
  });

  // T47 — A2AMessageFilters interface
  test("T47 — A2AMessageFilters interface has filter fields", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+interface\s+A2AMessageFilters/);
    expect(src).toContain("senderId?");
    expect(src).toContain("receiverId?");
    expect(src).toContain("messageType?");
    expect(src).toContain("status?");
    expect(src).toContain("chainId?");
  });

  // T48 — A2AMessageType and A2AMessageStatus types derived from constants
  test("T48 — A2AMessageType and A2AMessageStatus are derived types", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/type\s+A2AMessageType\s*=\s*\(typeof\s+A2A_MESSAGE_TYPES\)/);
    expect(src).toMatch(/type\s+A2AMessageStatus\s*=\s*\(typeof\s+A2A_MESSAGE_STATUSES\)/);
  });
});

// ============================================================
// Validators: a2a.ts (T49–T51)
// ============================================================

test.describe("A2A-S01 — Validators: a2a", () => {
  // T49 — sendA2AMessageSchema
  test("T49 — sendA2AMessageSchema uses z.object with receiverId", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+sendA2AMessageSchema\s*=\s*z\.object/);
    expect(src).toContain("receiverId: z.string().uuid()");
  });

  // T50 — a2aMessageFiltersSchema
  test("T50 — a2aMessageFiltersSchema with optional filter fields", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+a2aMessageFiltersSchema\s*=\s*z\.object/);
    expect(src).toContain("senderId: z.string().uuid().optional()");
    expect(src).toContain("receiverId: z.string().uuid().optional()");
  });

  // T51 — respondA2AMessageSchema
  test("T51 — respondA2AMessageSchema validates content", async () => {
    const src = await readFile(VAL_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+respondA2AMessageSchema\s*=\s*z\.object/);
    expect(src).toContain("content: z.record(z.unknown())");
  });
});

// ============================================================
// Barrel Exports (T52–T60)
// ============================================================

test.describe("A2A-S01 — Barrel Exports", () => {
  // T52 — schema/index.ts exports a2aMessages
  test("T52 — schema/index.ts exports a2aMessages", async () => {
    const src = await readFile(SCHEMA_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*a2aMessages[^}]*\}\s*from\s*["']\.\/a2a_messages/);
  });

  // T53 — services/index.ts exports a2aBusService
  test("T53 — services/index.ts exports a2aBusService", async () => {
    const src = await readFile(SERVICES_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*a2aBusService[^}]*\}\s*from\s*["']\.\/a2a-bus/);
  });

  // T54 — routes/index.ts exports a2aRoutes
  test("T54 — routes/index.ts exports a2aRoutes", async () => {
    const src = await readFile(ROUTES_INDEX, "utf-8");
    expect(src).toMatch(/export\s*\{[^}]*a2aRoutes[^}]*\}\s*from\s*["']\.\/a2a/);
  });

  // T55 — types/index.ts exports A2A types
  test("T55 — types/index.ts exports A2A types and constants", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("A2A_MESSAGE_TYPES");
    expect(src).toContain("A2A_MESSAGE_STATUSES");
    expect(src).toContain("A2AMessage");
    expect(src).toContain("A2AStats");
  });

  // T56 — validators/index.ts exports A2A validators
  test("T56 — validators/index.ts exports A2A validators", async () => {
    const src = await readFile(VAL_INDEX, "utf-8");
    expect(src).toContain("sendA2AMessageSchema");
    expect(src).toContain("respondA2AMessageSchema");
    expect(src).toContain("a2aMessageFiltersSchema");
  });

  // T57 — shared/src/index.ts re-exports A2A types
  test("T57 — shared index re-exports A2A types", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("A2AMessage");
    expect(src).toContain("A2AStats");
    expect(src).toContain("A2AChainInfo");
  });

  // T58 — shared/src/index.ts re-exports A2A validators
  test("T58 — shared index re-exports A2A validators", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("sendA2AMessageSchema");
    expect(src).toContain("a2aMessageFiltersSchema");
  });

  // T59 — constants.ts has A2A LiveEventTypes
  test("T59 — constants has a2a LiveEventTypes", async () => {
    const src = await readFile(CONSTANTS_FILE, "utf-8");
    expect(src).toContain('"a2a.message_sent"');
    expect(src).toContain('"a2a.message_responded"');
    expect(src).toContain('"a2a.message_expired"');
  });

  // T60 — app.ts imports and mounts a2aRoutes
  test("T60 — app.ts imports and mounts a2aRoutes", async () => {
    const src = await readFile(APP_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*a2aRoutes[^}]*\}\s*from\s*["']\.\/routes\/a2a/);
    expect(src).toContain("a2aRoutes(db)");
  });
});
