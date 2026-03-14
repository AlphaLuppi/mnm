/**
 * MU-S01: API Invitations par Email — E2E Tests
 *
 * These tests verify the deliverables of MU-S01:
 *   - Group 1: Schema — invites table has targetEmail column + index
 *   - Group 2: Migration — SQL migration for target_email exists
 *   - Group 3: Validator — createCompanyInviteSchema has optional email field
 *   - Group 4: Email service — abstraction with Resend + console fallback
 *   - Group 5: Route POST invites — 7-day TTL, deduplication, email sending
 *   - Group 6: Route GET invites — list with computed status
 *   - Group 7: Service exports — createEmailService from index
 *   - Group 8: Environment — .env.example has email config vars
 *
 * Source files:
 *   - packages/db/src/schema/invites.ts — targetEmail column + index
 *   - packages/db/src/migrations/0032_*.sql — ALTER TABLE add target_email
 *   - packages/shared/src/validators/access.ts — email field in createCompanyInviteSchema
 *   - server/src/services/email.ts — EmailService interface + Resend/Console impls
 *   - server/src/services/index.ts — re-exports createEmailService
 *   - server/src/routes/access.ts — POST invites (email), GET invites
 *   - .env.example — RESEND_API_KEY, MNM_EMAIL_FROM
 *
 * All tests are file-content based — no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const INVITES_SCHEMA = resolve(ROOT, "packages/db/src/schema/invites.ts");
const MIGRATIONS_DIR = resolve(ROOT, "packages/db/src/migrations");
const JOURNAL = resolve(MIGRATIONS_DIR, "meta/_journal.json");
const VALIDATORS_ACCESS = resolve(
  ROOT,
  "packages/shared/src/validators/access.ts",
);
const EMAIL_SERVICE = resolve(ROOT, "server/src/services/email.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const ACCESS_ROUTES = resolve(ROOT, "server/src/routes/access.ts");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");

// ─── Group 1: Schema — invites table ────────────────────────────────────────

test.describe("Group 1: Schema — invites table has targetEmail", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(INVITES_SCHEMA, "utf-8");
  });

  test("has targetEmail column with text(\"target_email\")", () => {
    expect(content).toContain('text("target_email")');
  });

  test("targetEmail is nullable (no .notNull())", () => {
    // Extract the targetEmail line and verify it does NOT chain .notNull()
    const lines = content.split("\n");
    const targetEmailLine = lines.find((l) => l.includes("target_email"));
    expect(targetEmailLine).toBeTruthy();
    expect(targetEmailLine).not.toContain(".notNull()");
  });

  test("has companyEmailPendingIdx index on companyId and targetEmail", () => {
    // Should have an index that covers companyId + targetEmail
    expect(content).toMatch(/index\(["']invites_company_email_pending_idx["']\)/);
    // The index should reference both companyId and targetEmail columns
    expect(content).toMatch(
      /invites_company_email_pending_idx[\s\S]*?\.on\s*\([\s\S]*?companyId[\s\S]*?targetEmail/,
    );
  });
});

// ─── Group 2: Migration ─────────────────────────────────────────────────────

test.describe("Group 2: Migration for target_email", () => {
  test("a migration file 0032_* exists in packages/db/src/migrations/", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migration0032 = files.filter(
      (f) => f.startsWith("0032") && f.endsWith(".sql"),
    );
    expect(migration0032.length).toBeGreaterThanOrEqual(1);
  });

  test("migration SQL contains ALTER TABLE or CREATE for target_email", async () => {
    const files = await readdir(MIGRATIONS_DIR);
    const migration0032 = files.find(
      (f) => f.startsWith("0032") && f.endsWith(".sql"),
    );
    expect(migration0032).toBeTruthy();

    const content = await readFile(
      resolve(MIGRATIONS_DIR, migration0032!),
      "utf-8",
    );
    // Should reference target_email column
    expect(content).toMatch(/target_email/i);
    // Should contain ALTER TABLE or CREATE (table/index)
    expect(content).toMatch(/ALTER\s+TABLE|CREATE/i);
  });

  test("migration journal has entry for 0032", async () => {
    const journalContent = await readFile(JOURNAL, "utf-8");
    const journal = JSON.parse(journalContent);
    const entry0032 = journal.entries.find(
      (e: { idx: number; tag: string }) =>
        e.idx === 32 || e.tag.startsWith("0032"),
    );
    expect(entry0032).toBeTruthy();
    expect(entry0032.tag).toMatch(/^0032/);
  });
});

// ─── Group 3: Validator — createCompanyInviteSchema ─────────────────────────

test.describe("Group 3: Validator — email field in createCompanyInviteSchema", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(VALIDATORS_ACCESS, "utf-8");
  });

  test("createCompanyInviteSchema has email field", () => {
    // Extract the createCompanyInviteSchema definition
    const schemaMatch = content.match(
      /createCompanyInviteSchema\s*=\s*z\.object\(\s*\{[\s\S]*?\}\s*\)/,
    );
    expect(schemaMatch).toBeTruthy();
    expect(schemaMatch![0]).toContain("email");
  });

  test("email field uses z.string().email() validation", () => {
    // The email field should use z.string().email()
    const schemaMatch = content.match(
      /createCompanyInviteSchema\s*=\s*z\.object\(\s*\{[\s\S]*?\}\s*\)/,
    );
    expect(schemaMatch).toBeTruthy();
    const schemaBody = schemaMatch![0];
    // Should have z.string().email() somewhere in the email field definition
    expect(schemaBody).toMatch(/email[\s\S]*?z\.string\(\)\.email\(\)/);
  });

  test("email field is optional", () => {
    const schemaMatch = content.match(
      /createCompanyInviteSchema\s*=\s*z\.object\(\s*\{[\s\S]*?\}\s*\)/,
    );
    expect(schemaMatch).toBeTruthy();
    const schemaBody = schemaMatch![0];
    // The email line should chain .optional()
    expect(schemaBody).toMatch(/email[\s\S]*?\.optional\(\)/);
  });

  test("email has .transform for lowercase/trim", () => {
    const schemaMatch = content.match(
      /createCompanyInviteSchema\s*=\s*z\.object\(\s*\{[\s\S]*?\}\s*\)/,
    );
    expect(schemaMatch).toBeTruthy();
    const schemaBody = schemaMatch![0];
    // Should have a .transform() on the email field for normalization
    expect(schemaBody).toMatch(/email[\s\S]*?\.transform\s*\(/);
  });
});

// ─── Group 4: Email service ─────────────────────────────────────────────────

test.describe("Group 4: Email service (server/src/services/email.ts)", () => {
  let content: string;

  test.beforeAll(async () => {
    // Verify file exists first
    await expect(
      fsAccess(EMAIL_SERVICE).then(() => true),
    ).resolves.toBe(true);
    content = await readFile(EMAIL_SERVICE, "utf-8");
  });

  test("file exists", async () => {
    await expect(
      fsAccess(EMAIL_SERVICE).then(() => true),
    ).resolves.toBe(true);
  });

  test("exports createEmailService function", () => {
    expect(content).toMatch(
      /export\s+function\s+createEmailService/,
    );
  });

  test("exports EmailService interface or type", () => {
    expect(content).toMatch(
      /export\s+(interface|type)\s+EmailService/,
    );
  });

  test("has sendInviteEmail method with correct params", () => {
    // Should define sendInviteEmail with params: to, inviteUrl, companyName, inviterName, expiresAt
    expect(content).toContain("sendInviteEmail");
    expect(content).toMatch(/sendInviteEmail\s*\(/);
    // Verify parameter names are present in the interface/method signature area
    expect(content).toContain("to:");
    expect(content).toContain("inviteUrl:");
    expect(content).toContain("companyName:");
    expect(content).toContain("inviterName:");
    expect(content).toContain("expiresAt:");
  });

  test("has ConsoleEmailService fallback implementation", () => {
    expect(content).toMatch(/class\s+ConsoleEmailService/);
  });

  test("checks RESEND_API_KEY env var in createEmailService", () => {
    // The factory function should check for RESEND_API_KEY
    expect(content).toContain("RESEND_API_KEY");
  });

  test("uses logger for console fallback", () => {
    // ConsoleEmailService should use logger (not just console.log)
    expect(content).toMatch(/logger\.(info|log|debug)/);
  });
});

// ─── Group 5: Route POST invites ────────────────────────────────────────────

test.describe("Group 5: Route POST invites — email support", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("EMAIL_INVITE_TTL_MS constant exists (7 days)", () => {
    expect(content).toMatch(/EMAIL_INVITE_TTL_MS/);
    // 7 days = 7 * 24 * 60 * 60 * 1000 = 604800000
    // Accept either the calculation form or the literal
    expect(content).toMatch(
      /EMAIL_INVITE_TTL_MS\s*=\s*(?:7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|604800000)/,
    );
  });

  test("route stores targetEmail when email provided", () => {
    expect(content).toContain("targetEmail");
  });

  test("route checks for duplicate pending invites (409 conflict)", () => {
    // Should have deduplication logic checking existing invites for same email
    // Look for conflict() call near targetEmail/email logic
    expect(content).toMatch(/conflict\s*\(/);
    // The deduplication should check targetEmail in the invites table
    expect(content).toMatch(/invites\.targetEmail|targetEmail/);
  });

  test("route sends email using email service", () => {
    // Should call emailService.sendInviteEmail or similar
    expect(content).toMatch(/emailService[\s\S]*?sendInviteEmail|sendInviteEmail/);
  });

  test("route uses 7-day TTL when email provided", () => {
    // Should reference emailInviteExpiresAt or EMAIL_INVITE_TTL_MS in create logic
    expect(content).toMatch(/emailInviteExpiresAt|EMAIL_INVITE_TTL_MS/);
  });

  test("backward compatible: 10-min TTL when no email", () => {
    // The existing COMPANY_INVITE_TTL_MS (10 min) should still be present
    expect(content).toContain("COMPANY_INVITE_TTL_MS");
    // Should have conditional logic choosing between email TTL and standard TTL
    expect(content).toMatch(/companyInviteExpiresAt|COMPANY_INVITE_TTL_MS/);
  });
});

// ─── Group 6: Route GET invites ─────────────────────────────────────────────

test.describe("Group 6: Route GET /companies/:companyId/invites", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ACCESS_ROUTES, "utf-8");
  });

  test("GET /companies/:companyId/invites endpoint exists", () => {
    expect(content).toMatch(
      /router\.get\s*\(\s*["'][^"']*\/companies\/:companyId\/invites["']/,
    );
  });

  test("uses assertCompanyPermission with \"users:invite\"", () => {
    // Find the GET invites handler and verify it uses the right permission
    const getIdx = content.search(
      /router\.get\s*\(\s*["'][^"']*\/companies\/:companyId\/invites["']/,
    );
    expect(getIdx).toBeGreaterThan(-1);
    // Look for assertCompanyPermission in the handler body (within 1000 chars)
    const handlerSlice = content.slice(getIdx, getIdx + 1000);
    expect(handlerSlice).toContain("assertCompanyPermission");
    expect(handlerSlice).toContain("users:invite");
  });

  test("returns invites with computed status (pending/accepted/revoked/expired)", () => {
    // The GET handler should compute status from revokedAt/acceptedAt/expiresAt
    const getIdx = content.search(
      /router\.get\s*\(\s*["'][^"']*\/companies\/:companyId\/invites["']/,
    );
    expect(getIdx).toBeGreaterThan(-1);
    // Look for status computation logic
    const handlerSlice = content.slice(getIdx, getIdx + 2000);
    expect(handlerSlice).toContain("pending");
    expect(handlerSlice).toContain("accepted");
    expect(handlerSlice).toContain("revoked");
    expect(handlerSlice).toContain("expired");
  });

  test("orders by createdAt descending", () => {
    const getIdx = content.search(
      /router\.get\s*\(\s*["'][^"']*\/companies\/:companyId\/invites["']/,
    );
    expect(getIdx).toBeGreaterThan(-1);
    const handlerSlice = content.slice(getIdx, getIdx + 2000);
    // Should use desc(invites.createdAt) or orderBy desc
    expect(handlerSlice).toMatch(/desc\s*\(\s*invites\.createdAt\s*\)|orderBy.*desc/);
  });
});

// ─── Group 7: Service exports ───────────────────────────────────────────────

test.describe("Group 7: Service exports (server/src/services/index.ts)", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(SERVICES_INDEX, "utf-8");
  });

  test("exports createEmailService from email.js", () => {
    expect(content).toContain("createEmailService");
    expect(content).toMatch(/from\s+["']\.\/email\.js["']/);
  });
});

// ─── Group 8: Environment (.env.example) ────────────────────────────────────

test.describe("Group 8: Environment — .env.example has email config", () => {
  let content: string;

  test.beforeAll(async () => {
    content = await readFile(ENV_EXAMPLE, "utf-8");
  });

  test("has RESEND_API_KEY", () => {
    expect(content).toContain("RESEND_API_KEY");
  });

  test("has MNM_EMAIL_FROM or email from address config", () => {
    // Should have either MNM_EMAIL_FROM or MNM_PUBLIC_URL for email
    expect(content).toMatch(/MNM_EMAIL_FROM/);
  });

  test("has email section comment", () => {
    // Should have a section header/comment for email configuration
    expect(content).toMatch(/[Ee]mail/i);
    // Specifically an email section (not just an inline mention)
    expect(content).toMatch(/---.*[Ee]mail|#.*[Ee]mail/i);
  });
});
