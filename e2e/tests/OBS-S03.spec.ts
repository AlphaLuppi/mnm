/**
 * OBS-S03: Résumé LLM Actions Agent — E2E Tests
 *
 * These tests verify the deliverables of OBS-S03:
 *   - Groupe 1: File existence and barrel exports (T01-T08)
 *   - Groupe 2: Service summarize function (T09-T16)
 *   - Groupe 3: Cache behavior (T17-T22)
 *   - Groupe 4: Fallback summary (T23-T26)
 *   - Groupe 5: Routes (T27-T34)
 *   - Groupe 6: Types and validators (T35-T40)
 *   - Groupe 7: Integration patterns (T41-T45)
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const SERVICE_FILE = resolve(ROOT, "server/src/services/audit-summarizer.ts");
const AUDIT_SERVICE_FILE = resolve(ROOT, "server/src/services/audit.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/audit.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/audit.ts");
const VALIDATOR_FILE = resolve(ROOT, "packages/shared/src/validators/audit.ts");
const SERVICE_INDEX = resolve(ROOT, "server/src/services/index.ts");
const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VALIDATOR_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence and barrel exports (T01-T08)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence and barrel exports", () => {
  test("T01 — Service file audit-summarizer.ts exists and exports auditSummarizerService", async () => {
    await expect(fsAccess(SERVICE_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+auditSummarizerService\s*\(/);
  });

  test("T02 — Service exports summarize, getSummary, listSummaries, invalidateCache functions", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("summarize:");
    expect(content).toContain("getSummary:");
    expect(content).toContain("listSummaries:");
    expect(content).toContain("invalidateCache:");
  });

  test("T03 — Types file contains AuditSummary, AuditSummaryPeriod, AuditSummaryStats", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toContain("AuditSummary");
    expect(content).toContain("AuditSummaryPeriod");
    expect(content).toContain("AuditSummaryStats");
    expect(content).toContain("AUDIT_SUMMARY_PERIODS");
    expect(content).toContain("AUDIT_SUMMARY_SOURCES");
  });

  test("T04 — Validators file contains auditSummaryFiltersSchema, auditSummaryGenerateSchema", async () => {
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    expect(content).toContain("auditSummaryFiltersSchema");
    expect(content).toContain("auditSummaryGenerateSchema");
  });

  test("T05 — services/index.ts barrel exports auditSummarizerService", async () => {
    const content = await readFile(SERVICE_INDEX, "utf-8");
    expect(content).toMatch(/export\s*\{[^}]*auditSummarizerService[^}]*\}\s*from/);
  });

  test("T06 — shared/index.ts barrel exports AuditSummary types", async () => {
    const content = await readFile(SHARED_INDEX, "utf-8");
    expect(content).toContain("AuditSummary");
    expect(content).toContain("AuditSummaryPeriod");
    expect(content).toContain("AuditSummaryStats");
    expect(content).toContain("AUDIT_SUMMARY_PERIODS");
    expect(content).toContain("AUDIT_SUMMARY_SOURCES");
  });

  test("T07 — types/index.ts barrel exports AuditSummary types with obs-s03 marker", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("obs-s03-barrel-types");
    expect(content).toContain("AUDIT_SUMMARY_PERIODS");
    expect(content).toContain("AUDIT_SUMMARY_SOURCES");
    expect(content).toContain("AuditSummaryPeriod");
    expect(content).toContain("AuditSummarySource");
    expect(content).toContain("AuditSummaryStats");
    expect(content).toContain("AuditSummary");
  });

  test("T08 — validators/index.ts barrel exports summary validators with obs-s03 marker", async () => {
    const content = await readFile(VALIDATOR_INDEX, "utf-8");
    expect(content).toContain("obs-s03-barrel-validators");
    expect(content).toContain("auditSummaryFiltersSchema");
    expect(content).toContain("auditSummaryGenerateSchema");
    expect(content).toContain("AuditSummaryFilters");
    expect(content).toContain("AuditSummaryGenerate");
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Service summarize function (T09-T16)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Service summarize function", () => {
  test("T09 — summarize function accepts companyId, period, options parameters", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // The summarize function signature accepts companyId, period, options
    expect(content).toMatch(/summarize:\s*async\s*\(\s*\n?\s*companyId:\s*string/);
    expect(content).toMatch(/period:\s*AuditSummaryPeriod/);
    expect(content).toContain("options?:");
  });

  test("T10 — summarize function queries audit events using auditService.list", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Uses audit.list to fetch events
    expect(content).toContain("audit.list(");
    expect(content).toContain("auditService(db)");
  });

  test("T11 — summarize builds event statistics grouped by action category (domain)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("groupEventsByDomain");
    expect(content).toContain("topActions");
    expect(content).toContain("groupEventsBySeverity");
  });

  test("T12 — summarize calls LLM provider and parses response", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("generateSummaryViaLlm");
    expect(content).toContain("MNM_LLM_SUMMARY_ENDPOINT");
    expect(content).toContain("MNM_LLM_SUMMARY_API_KEY");
    // Parses the LLM response
    expect(content).toContain("response.json()");
  });

  test("T13 — summarize returns AuditSummary with all required fields", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Both LLM and fallback paths construct AuditSummary with all fields
    expect(content).toContain("id:");
    expect(content).toContain("companyId,");
    expect(content).toContain("title:");
    expect(content).toContain("body:");
    expect(content).toContain("stats,");
    expect(content).toContain("period,");
    expect(content).toContain("periodStart:");
    expect(content).toContain("periodEnd:");
    expect(content).toContain("generatedAt:");
    expect(content).toContain("source:");
  });

  test("T14 — summarize stores result in cache with TTL key", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("summaryCache.set(key,");
    expect(content).toContain("expiresAt: Date.now() + CACHE_TTL_MS");
  });

  test("T15 — summarize emits audit.summary_generated via emitAudit", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("emitAudit(");
    expect(content).toContain('"audit.summary_generated"');
    expect(content).toContain('"audit_summary"');
  });

  test("T16 — summarize gracefully degrades to fallback when LLM unavailable", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // When LLM returns null, fallback is used
    expect(content).toContain("buildFallbackSummary");
    // LLM returns null when no env vars
    expect(content).toMatch(/if\s*\(\s*!llmEndpoint\s*\|\|\s*!llmApiKey\s*\)/);
    expect(content).toContain("return null; // No LLM configured");
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Cache behavior (T17-T22)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Cache behavior", () => {
  test("T17 — Cache key is derived from companyId + period combination", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/function\s+cacheKey\s*\(\s*companyId:\s*string,\s*period/);
    expect(content).toContain("`${companyId}:${period}`");
  });

  test("T18 — Cache hit returns stored result without LLM call", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Early return from cache
    expect(content).toContain("const cached = summaryCache.get(key)");
    expect(content).toMatch(/if\s*\(\s*cached\s*&&\s*cached\.expiresAt\s*>\s*Date\.now\(\)\s*\)/);
    expect(content).toContain("return cached.summary;");
  });

  test("T19 — Cache respects TTL (expired entries are evicted)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("function evictExpired()");
    expect(content).toMatch(/if\s*\(\s*entry\.expiresAt\s*<=\s*now\s*\)/);
    expect(content).toContain("summaryCache.delete(key)");
  });

  test("T20 — CACHE_TTL_MS constant is exported and defaults to 300_000 (5 min)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/export\s+const\s+CACHE_TTL_MS\s*=\s*300_000/);
  });

  test("T21 — invalidateCache removes all entries for a given companyId", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("invalidateCache:");
    expect(content).toContain("key.startsWith(`${companyId}:`)");
    expect(content).toContain("summaryCache.delete(key)");
  });

  test("T22 — Cache size is bounded (MAX_CACHE_ENTRIES with FIFO eviction)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("MAX_CACHE_ENTRIES");
    expect(content).toContain("function evictOldestIfNeeded()");
    expect(content).toMatch(/if\s*\(\s*summaryCache\.size\s*<\s*MAX_CACHE_ENTRIES\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Fallback summary (T23-T26)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Fallback summary", () => {
  test("T23 — Fallback summary uses event counts grouped by action prefix (domain)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("function buildFallbackSummary");
    expect(content).toContain("groupEventsByDomain(actions)");
    expect(content).toContain("groupEventsBySeverity(severities)");
  });

  test("T24 — Fallback summary includes period start/end dates", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // buildFallbackSummary receives periodStart and periodEnd
    expect(content).toMatch(/buildFallbackSummary\(\s*\n?\s*companyId/);
    expect(content).toContain("periodStart:");
    expect(content).toContain("periodEnd:");
  });

  test("T25 — Fallback summary title follows pattern 'Activity summary for [period]'", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toContain("`Activity summary for ${periodLabel(period)}`");
  });

  test("T26 — Fallback summary body lists top action categories with counts", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Body constructed from domain entries
    expect(content).toContain("Top activity domains:");
    expect(content).toContain("${domain} (${count})");
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: Routes (T27-T34)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: Routes", () => {
  test("T27 — Route GET /companies/:companyId/audit/summary exists in audit routes", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain('"/companies/:companyId/audit/summary"');
    expect(content).toMatch(/router\.get\(\s*\n?\s*"\/companies\/:companyId\/audit\/summary"/);
  });

  test("T28 — Route GET /companies/:companyId/audit/summaries exists in audit routes", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain('"/companies/:companyId/audit/summaries"');
    expect(content).toMatch(/router\.get\(\s*\n?\s*"\/companies\/:companyId\/audit\/summaries"/);
  });

  test("T29 — Route POST /companies/:companyId/audit/summary/generate exists in audit routes", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain('"/companies/:companyId/audit/summary/generate"');
    expect(content).toMatch(/router\.post\(\s*\n?\s*"\/companies\/:companyId\/audit\/summary\/generate"/);
  });

  test("T30 — Summary route validates period query parameter via Zod", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    expect(content).toContain("auditSummaryFiltersSchema.parse(req.query)");
  });

  test("T31 — Summaries route supports limit and offset pagination", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // The summaries route extracts limit and offset from filters
    expect(content).toContain("filters.limit");
    expect(content).toContain("filters.offset");
    expect(content).toContain("listSummaries(companyId,");
  });

  test("T32 — Generate route calls invalidateCache then summarize", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // In the generate route, invalidateCache is called before summarize
    const generateRouteMatch = content.match(
      /audit\/summary\/generate[\s\S]*?invalidateCache[\s\S]*?summarize/,
    );
    expect(generateRouteMatch).not.toBeNull();
  });

  test("T33 — All 3 summary routes require audit:read permission", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Count occurrences of requirePermission(db, "audit:read") — existing routes + 3 new ones
    const matches = content.match(/requirePermission\(db,\s*"audit:read"\)/g);
    expect(matches).not.toBeNull();
    // At least 6 routes use audit:read: list, count, verify, summary, summaries, :id, generate
    expect(matches!.length).toBeGreaterThanOrEqual(7);
  });

  test("T34 — Summary routes are registered BEFORE the :id catch-all route", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    const summaryIdx = content.indexOf('"/companies/:companyId/audit/summary"');
    const summariesIdx = content.indexOf('"/companies/:companyId/audit/summaries"');
    const generateIdx = content.indexOf('"/companies/:companyId/audit/summary/generate"');
    const idIdx = content.indexOf('"/companies/:companyId/audit/:id"');
    // All summary routes must appear before the :id route
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(summariesIdx).toBeGreaterThan(-1);
    expect(generateIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeLessThan(idIdx);
    expect(summariesIdx).toBeLessThan(idIdx);
    expect(generateIdx).toBeLessThan(idIdx);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Types and validators (T35-T40)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Types and validators", () => {
  test("T35 — AuditSummary type has fields: id, companyId, title, body, stats, period, generatedAt, source", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // Extract the AuditSummary interface
    const interfaceMatch = content.match(/export\s+interface\s+AuditSummary\s*\{[\s\S]*?\n\}/);
    expect(interfaceMatch).not.toBeNull();
    const iface = interfaceMatch![0];
    expect(iface).toContain("id:");
    expect(iface).toContain("companyId:");
    expect(iface).toContain("title:");
    expect(iface).toContain("body:");
    expect(iface).toContain("stats:");
    expect(iface).toContain("period:");
    expect(iface).toContain("generatedAt:");
    expect(iface).toContain("source:");
    expect(iface).toContain("periodStart:");
    expect(iface).toContain("periodEnd:");
  });

  test("T36 — AuditSummaryPeriod is union type with 1h, 6h, 12h, 24h, 7d, 30d", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    expect(content).toContain("AUDIT_SUMMARY_PERIODS");
    // Check the const array contains all periods
    const arrayMatch = content.match(/AUDIT_SUMMARY_PERIODS\s*=\s*\[([^\]]+)\]/);
    expect(arrayMatch).not.toBeNull();
    const periods = arrayMatch![1];
    expect(periods).toContain('"1h"');
    expect(periods).toContain('"6h"');
    expect(periods).toContain('"12h"');
    expect(periods).toContain('"24h"');
    expect(periods).toContain('"7d"');
    expect(periods).toContain('"30d"');
  });

  test("T37 — AuditSummaryStats has fields: totalEvents, topActions, eventsByDomain, eventsBySeverity", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    const statsMatch = content.match(/export\s+interface\s+AuditSummaryStats\s*\{[\s\S]*?\n\}/);
    expect(statsMatch).not.toBeNull();
    const stats = statsMatch![0];
    expect(stats).toContain("totalEvents:");
    expect(stats).toContain("topActions:");
    expect(stats).toContain("eventsByDomain:");
    expect(stats).toContain("eventsBySeverity:");
  });

  test("T38 — auditSummaryFiltersSchema validates period, limit, offset", async () => {
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    const schemaMatch = content.match(
      /auditSummaryFiltersSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)\.strict\(\)/,
    );
    expect(schemaMatch).not.toBeNull();
    const schema = schemaMatch![0];
    expect(schema).toContain("period:");
    expect(schema).toContain("limit:");
    expect(schema).toContain("offset:");
  });

  test("T39 — auditSummaryGenerateSchema validates period (required), forceRefresh (optional)", async () => {
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    const schemaMatch = content.match(
      /auditSummaryGenerateSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)\.strict\(\)/,
    );
    expect(schemaMatch).not.toBeNull();
    const schema = schemaMatch![0];
    expect(schema).toContain("period:");
    expect(schema).toContain("forceRefresh:");
  });

  test("T40 — Validators use .strict() mode", async () => {
    const content = await readFile(VALIDATOR_FILE, "utf-8");
    // Both schemas end with .strict()
    const summaryFilterStrict = content.match(/auditSummaryFiltersSchema[\s\S]*?\.strict\(\)/);
    expect(summaryFilterStrict).not.toBeNull();
    const generateStrict = content.match(/auditSummaryGenerateSchema[\s\S]*?\.strict\(\)/);
    expect(generateStrict).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Integration patterns (T41-T45)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Integration patterns", () => {
  test("T41 — Service uses auditService(db).list to fetch events (not raw DB queries)", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // Imports auditService and uses it
    expect(content).toMatch(/import\s*\{[^}]*auditService[^}]*\}\s*from/);
    expect(content).toContain("const audit = auditService(db)");
    expect(content).toContain("audit.list(");
    // Should NOT contain direct drizzle queries
    expect(content).not.toContain("db.select()");
    expect(content).not.toContain("from(auditEvents)");
  });

  test("T42 — Service uses emitAudit helper for audit trail", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    expect(content).toMatch(/import\s*\{[^}]*emitAudit[^}]*\}\s*from/);
    expect(content).toContain("emitAudit({");
  });

  test("T43 — Routes use assertCompanyAccess for company authorization", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Count assertCompanyAccess calls in summary routes
    const summarySection = content.slice(
      content.indexOf("OBS-S03:"),
      content.indexOf("single event detail"),
    );
    const assertCalls = summarySection.match(/assertCompanyAccess\(req,\s*companyId\)/g);
    expect(assertCalls).not.toBeNull();
    expect(assertCalls!.length).toBe(3); // summary, summaries, generate
  });

  test("T44 — Routes use requirePermission(db, 'audit:read') middleware", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // All 3 OBS-S03 routes use requirePermission
    const summarySection = content.slice(
      content.indexOf("OBS-S03:"),
      content.indexOf("single event detail"),
    );
    const permCalls = summarySection.match(/requirePermission\(db,\s*"audit:read"\)/g);
    expect(permCalls).not.toBeNull();
    expect(permCalls!.length).toBe(3);
  });

  test("T45 — Summary source field distinguishes 'llm' vs 'fallback'", async () => {
    const content = await readFile(SERVICE_FILE, "utf-8");
    // LLM path sets source to "llm"
    expect(content).toContain('"llm" as const');
    // Fallback path sets source to "fallback"
    expect(content).toContain('"fallback" as const');
    // Types file defines the union
    const typesContent = await readFile(TYPES_FILE, "utf-8");
    expect(typesContent).toContain('"llm"');
    expect(typesContent).toContain('"fallback"');
  });
});
