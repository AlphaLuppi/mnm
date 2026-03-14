/**
 * A2A-S03 — Audit A2A: Complete audit trail for inter-agent communications
 *
 * File-content-based E2E tests verifying:
 * - Audit emission for expired messages in cleanupExpiredMessages
 * - Audit for permission_allowed in sendMessage
 * - Enriched metadata in a2a.message_sent and a2a.message_responded
 * - Audit for stats query in routes
 * - A2A_AUDIT_ACTIONS constant in types
 * - Barrel exports
 * - Existing audit verification (severity levels, companyId)
 *
 * 45 test cases — all file-content based
 */

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const BUS_SVC_FILE = resolve(ROOT, "server/src/services/a2a-bus.ts");
const ROUTE_FILE = resolve(ROOT, "server/src/routes/a2a.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/a2a.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");

// ============================================================
// Service: a2a-bus.ts audit integration (T01–T20)
// ============================================================

test.describe("A2A-S03 — Service: audit in cleanupExpiredMessages", () => {
  // T01 — cleanupExpiredMessages has audit.emit call
  test("T01 — cleanupExpiredMessages has audit.emit call", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    // Find the cleanupExpiredMessages function and verify audit.emit is called within it
    const cleanupFn = src.slice(src.indexOf("async function cleanupExpiredMessages"));
    expect(cleanupFn).toContain("audit.emit");
  });

  // T02 — audit.emit in cleanup uses action "a2a.message_expired"
  test('T02 — cleanup audit uses action "a2a.message_expired"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const cleanupFn = src.slice(src.indexOf("async function cleanupExpiredMessages"));
    expect(cleanupFn).toContain('"a2a.message_expired"');
  });

  // T03 — audit.emit in cleanup uses severity "warning"
  test('T03 — cleanup audit uses severity "warning"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    // Get the a2a-s03-audit-expired block
    const auditBlock = src.slice(src.indexOf("a2a-s03-audit-expired"));
    const nextFnBoundary = auditBlock.indexOf("logger.info");
    const block = auditBlock.slice(0, nextFnBoundary > 0 ? nextFnBoundary : undefined);
    expect(block).toContain('severity: "warning"');
  });

  // T04 — audit.emit in cleanup includes chainId in metadata
  test("T04 — cleanup audit includes chainId in metadata", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const auditBlock = src.slice(src.indexOf("a2a-s03-audit-expired"));
    const nextFnBoundary = auditBlock.indexOf("logger.info");
    const block = auditBlock.slice(0, nextFnBoundary > 0 ? nextFnBoundary : undefined);
    expect(block).toContain("chainId");
  });

  // T05 — audit.emit in cleanup includes senderId in metadata
  test("T05 — cleanup audit includes senderId in metadata", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const auditBlock = src.slice(src.indexOf("a2a-s03-audit-expired"));
    const nextFnBoundary = auditBlock.indexOf("logger.info");
    const block = auditBlock.slice(0, nextFnBoundary > 0 ? nextFnBoundary : undefined);
    expect(block).toContain("senderId");
  });

  // T06 — audit.emit in cleanup includes receiverId in metadata
  test("T06 — cleanup audit includes receiverId in metadata", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const auditBlock = src.slice(src.indexOf("a2a-s03-audit-expired"));
    const nextFnBoundary = auditBlock.indexOf("logger.info");
    const block = auditBlock.slice(0, nextFnBoundary > 0 ? nextFnBoundary : undefined);
    expect(block).toContain("receiverId");
  });

  // T07 — audit.emit in cleanup includes ttlSeconds in metadata
  test("T07 — cleanup audit includes ttlSeconds in metadata", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const auditBlock = src.slice(src.indexOf("a2a-s03-audit-expired"));
    const nextFnBoundary = auditBlock.indexOf("logger.info");
    const block = auditBlock.slice(0, nextFnBoundary > 0 ? nextFnBoundary : undefined);
    expect(block).toContain("ttlSeconds");
  });
});

test.describe("A2A-S03 — Service: permission_allowed audit", () => {
  // T08 — sendMessage has audit.emit for a2a.permission_allowed
  test("T08 — sendMessage has audit.emit for a2a.permission_allowed", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain('"a2a.permission_allowed"');
  });

  // T09 — permission_allowed audit uses severity "info"
  test('T09 — permission_allowed audit uses severity "info"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "info"');
  });

  // T10 — permission_allowed audit includes senderId metadata
  test("T10 — permission_allowed audit includes senderId", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("senderId");
  });

  // T11 — permission_allowed audit includes receiverId metadata
  test("T11 — permission_allowed audit includes receiverId", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("receiverId");
  });

  // T12 — permission_allowed audit includes senderRole metadata
  test("T12 — permission_allowed audit includes senderRole", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("senderRole");
  });

  // T13 — permission_allowed audit includes receiverRole metadata
  test("T13 — permission_allowed audit includes receiverRole", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("receiverRole");
  });

  // T14 — permission_allowed audit includes matchedRuleId metadata
  test("T14 — permission_allowed audit includes matchedRuleId", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("matchedRuleId");
  });

  // T15 — permission_allowed audit includes reason metadata
  test("T15 — permission_allowed audit includes reason", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-permission-allowed"));
    const blockEnd = block.indexOf("const messageType");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("reason");
  });
});

test.describe("A2A-S03 — Service: enriched metadata", () => {
  // T16 — a2a.message_sent audit includes contentSize in metadata
  test("T16 — message_sent audit includes contentSize", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-enriched-sent"));
    const blockEnd = block.indexOf("logger.info");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("contentSize");
  });

  // T17 — a2a.message_sent audit includes expiresAt in metadata
  test("T17 — message_sent audit includes expiresAt", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-enriched-sent"));
    const blockEnd = block.indexOf("logger.info");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("expiresAt");
  });

  // T18 — a2a.message_responded audit includes responseTimeMs in metadata
  test("T18 — message_responded audit includes responseTimeMs", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-enriched-responded"));
    const blockEnd = block.indexOf("logger.info");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain("responseTimeMs");
  });
});

test.describe("A2A-S03 — Service: comment markers", () => {
  // T19 — a2a-s03-audit-expired comment marker present
  test("T19 — a2a-s03-audit-expired comment marker present", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s03-audit-expired");
  });

  // T20 — a2a-s03-audit-permission-allowed comment marker present
  test("T20 — a2a-s03-audit-permission-allowed comment marker present", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain("a2a-s03-audit-permission-allowed");
  });
});

// ============================================================
// Existing audit verification (T21–T30)
// ============================================================

test.describe("A2A-S03 — Existing audit: sendMessage/respondToMessage/cancelMessage", () => {
  // T21 — sendMessage has audit.emit for a2a.message_sent
  test("T21 — sendMessage has audit.emit for a2a.message_sent", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain('"a2a.message_sent"');
  });

  // T22 — respondToMessage has audit.emit for a2a.message_responded
  test("T22 — respondToMessage has audit.emit for a2a.message_responded", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain('"a2a.message_responded"');
  });

  // T23 — cancelMessage has audit.emit for a2a.message_cancelled
  test("T23 — cancelMessage has audit.emit for a2a.message_cancelled", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    expect(src).toContain('"a2a.message_cancelled"');
  });

  // T24 — chain_depth_exceeded audit uses severity "warning"
  test('T24 — chain_depth_exceeded audit uses severity "warning"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf('"a2a.chain_depth_exceeded"'));
    const blockEnd = block.indexOf("throw Object.assign");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "warning"');
  });

  // T25 — cycle_detected audit uses severity "warning"
  test('T25 — cycle_detected audit uses severity "warning"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf('"a2a.cycle_detected"'));
    const blockEnd = block.indexOf("throw Object.assign");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "warning"');
  });

  // T26 — permission_denied audit uses severity "warning"
  test('T26 — permission_denied audit uses severity "warning"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf('"a2a.permission_denied"'));
    const blockEnd = block.indexOf("throw Object.assign");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "warning"');
  });

  // T27 — a2a.message_sent audit uses severity "info"
  test('T27 — message_sent audit uses severity "info"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-enriched-sent"));
    const blockEnd = block.indexOf("logger.info");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "info"');
  });

  // T28 — a2a.message_responded audit uses severity "info"
  test('T28 — message_responded audit uses severity "info"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf("a2a-s03-audit-enriched-responded"));
    const blockEnd = block.indexOf("logger.info");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "info"');
  });

  // T29 — a2a.message_cancelled audit uses severity "info"
  test('T29 — message_cancelled audit uses severity "info"', async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    const block = src.slice(src.indexOf('"a2a.message_cancelled"'));
    const blockEnd = block.indexOf("logger.info");
    const auditBlock = block.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(auditBlock).toContain('severity: "info"');
  });

  // T30 — All audit.emit calls include companyId
  test("T30 — all audit.emit calls include companyId", async () => {
    const src = await readFile(BUS_SVC_FILE, "utf-8");
    // Find all audit.emit( blocks
    const auditEmitRegex = /audit\.emit\(\{[^}]*\}/gs;
    const matches = src.match(auditEmitRegex);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(7);
    for (const m of matches!) {
      expect(m).toContain("companyId");
    }
  });
});

// ============================================================
// Routes: a2a.ts audit (T31–T35)
// ============================================================

test.describe("A2A-S03 — Routes: stats audit", () => {
  // T31 — GET /stats route has emitAudit call
  test("T31 — GET /stats route has emitAudit call", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    // Find the stats route section and verify emitAudit is present
    const statsSection = src.slice(src.indexOf("a2a-s01-route-stats"));
    const nextSection = statsSection.indexOf("A2A-S02");
    const block = statsSection.slice(0, nextSection > 0 ? nextSection : undefined);
    expect(block).toContain("emitAudit");
  });

  // T32 — stats emitAudit uses action "a2a.stats_queried"
  test('T32 — stats emitAudit uses action "a2a.stats_queried"', async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain('"a2a.stats_queried"');
  });

  // T33 — a2a-s03-route-audit-stats comment marker present
  test("T33 — a2a-s03-route-audit-stats comment marker", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toContain("a2a-s03-route-audit-stats");
  });

  // T34 — emitAudit import exists in route file
  test("T34 — emitAudit import in route file", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*emitAudit[^}]*\}\s*from/);
  });

  // T35 — route emitAudit calls include req, db, companyId params
  test("T35 — emitAudit calls include req, db, companyId", async () => {
    const src = await readFile(ROUTE_FILE, "utf-8");
    const statsBlock = src.slice(src.indexOf("a2a-s03-route-audit-stats"));
    const blockEnd = statsBlock.indexOf("res.json");
    const block = statsBlock.slice(0, blockEnd > 0 ? blockEnd : undefined);
    expect(block).toContain("req");
    expect(block).toContain("db");
    expect(block).toContain("companyId");
  });
});

// ============================================================
// Types: A2A_AUDIT_ACTIONS (T36–T42)
// ============================================================

test.describe("A2A-S03 — Types: A2A_AUDIT_ACTIONS constant", () => {
  // T36 — A2A_AUDIT_ACTIONS constant defined in types/a2a.ts
  test("T36 — A2A_AUDIT_ACTIONS constant defined", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toMatch(/export\s+const\s+A2A_AUDIT_ACTIONS\s*=/);
  });

  // T37 — A2A_AUDIT_ACTIONS includes "a2a.message_sent"
  test('T37 — A2A_AUDIT_ACTIONS includes "a2a.message_sent"', async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const block = src.slice(src.indexOf("A2A_AUDIT_ACTIONS"));
    expect(block).toContain('"a2a.message_sent"');
  });

  // T38 — A2A_AUDIT_ACTIONS includes "a2a.message_responded"
  test('T38 — A2A_AUDIT_ACTIONS includes "a2a.message_responded"', async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const block = src.slice(src.indexOf("A2A_AUDIT_ACTIONS"));
    expect(block).toContain('"a2a.message_responded"');
  });

  // T39 — A2A_AUDIT_ACTIONS includes "a2a.message_expired"
  test('T39 — A2A_AUDIT_ACTIONS includes "a2a.message_expired"', async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const block = src.slice(src.indexOf("A2A_AUDIT_ACTIONS"));
    expect(block).toContain('"a2a.message_expired"');
  });

  // T40 — A2A_AUDIT_ACTIONS includes "a2a.message_cancelled"
  test('T40 — A2A_AUDIT_ACTIONS includes "a2a.message_cancelled"', async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const block = src.slice(src.indexOf("A2A_AUDIT_ACTIONS"));
    expect(block).toContain('"a2a.message_cancelled"');
  });

  // T41 — A2A_AUDIT_ACTIONS includes "a2a.permission_allowed"
  test('T41 — A2A_AUDIT_ACTIONS includes "a2a.permission_allowed"', async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const block = src.slice(src.indexOf("A2A_AUDIT_ACTIONS"));
    expect(block).toContain('"a2a.permission_allowed"');
  });

  // T42 — A2A_AUDIT_ACTIONS includes "a2a.permission_denied"
  test('T42 — A2A_AUDIT_ACTIONS includes "a2a.permission_denied"', async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    const block = src.slice(src.indexOf("A2A_AUDIT_ACTIONS"));
    expect(block).toContain('"a2a.permission_denied"');
  });
});

// ============================================================
// Barrel exports (T43–T45)
// ============================================================

test.describe("A2A-S03 — Barrel exports", () => {
  // T43 — A2A_AUDIT_ACTIONS exported from types/index.ts
  test("T43 — A2A_AUDIT_ACTIONS exported from types/index.ts", async () => {
    const src = await readFile(TYPES_INDEX, "utf-8");
    expect(src).toContain("A2A_AUDIT_ACTIONS");
  });

  // T44 — A2A_AUDIT_ACTIONS re-exported from shared/src/index.ts
  test("T44 — A2A_AUDIT_ACTIONS re-exported from shared/src/index.ts", async () => {
    const src = await readFile(SHARED_INDEX, "utf-8");
    expect(src).toContain("A2A_AUDIT_ACTIONS");
  });

  // T45 — a2a-s03-audit-actions comment marker present in types/a2a.ts
  test("T45 — a2a-s03-audit-actions comment marker in types/a2a.ts", async () => {
    const src = await readFile(TYPES_FILE, "utf-8");
    expect(src).toContain("a2a-s03-audit-actions");
  });
});
