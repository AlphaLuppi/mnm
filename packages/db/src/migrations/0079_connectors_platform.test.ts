import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0079_connectors_platform", () => {
  const sql = readFileSync(join(__dirname, "0079_connectors_platform.sql"), "utf-8");

  it("creates 4 connectors tables", () => {
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"?oauth_connectors"?/i);
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"?connector_tokens"?/i);
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"?user_api_keys"?/i);
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"?oauth_connectors_audit"?/i);
  });

  it("enables RLS RESTRICTIVE FORCE on each table", () => {
    for (const table of [
      "oauth_connectors",
      "connector_tokens",
      "user_api_keys",
      "oauth_connectors_audit",
    ]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE\\s+"?${table}"?\\s+ENABLE ROW LEVEL SECURITY`, "i"));
      expect(sql).toMatch(new RegExp(`ALTER TABLE\\s+"?${table}"?\\s+FORCE ROW LEVEL SECURITY`, "i"));
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY\\s+"tenant_isolation"\\s+ON\\s+"?${table}"?[\\s\\S]*?AS RESTRICTIVE FOR ALL[\\s\\S]*?current_setting\\('app\\.current_company_id', true\\)::uuid`,
          "i",
        ),
      );
    }
  });

  it("oauth_connectors has UNIQUE (company_id, provider_slug)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"?oauth_connectors_company_provider_idx"?[\s\S]*?"company_id"[\s\S]*?"provider_slug"/i,
    );
  });

  it("connector_tokens and user_api_keys both have UNIQUE (user_id, connector_id)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"?connector_tokens_user_connector_idx"?[\s\S]*?"user_id"[\s\S]*?"connector_id"/i,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?"?user_api_keys_user_connector_idx"?[\s\S]*?"user_id"[\s\S]*?"connector_id"/i,
    );
  });

  it("oauth_connectors has CHECK on type IN ('oauth2','api_key')", () => {
    expect(sql).toMatch(/CHECK\s*\([^)]*type\s+IN\s*\(\s*'oauth2'\s*,\s*'api_key'\s*\)/i);
  });

  it("oauth_connectors has conditional CHECK shape (oauth2 fields vs api_key fields)", () => {
    expect(sql).toMatch(/oauth_connectors_type_shape_check/i);
    expect(sql).toMatch(/type\s*=\s*'oauth2'\s+AND\s+authorization_url\s+IS NOT NULL/i);
    expect(sql).toMatch(/type\s*=\s*'api_key'\s+AND\s+api_key_label\s+IS NOT NULL/i);
  });

  it("connector_tokens stores access_token chiffré inline (3 columns NOT NULL: iv, ciphertext, tag)", () => {
    expect(sql).toMatch(/"access_token_iv"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/"access_token_ciphertext"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/"access_token_tag"\s+text\s+NOT NULL/i);
  });

  it("user_api_keys stores key chiffré inline (3 columns NOT NULL: iv, ciphertext, tag)", () => {
    expect(sql).toMatch(/"key_iv"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/"key_ciphertext"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/"key_tag"\s+text\s+NOT NULL/i);
  });

  it("oauth_connectors stores client_secret chiffré inline (3 columns nullable, gated by CHECK)", () => {
    expect(sql).toMatch(/"client_secret_iv"\s+text/i);
    expect(sql).toMatch(/"client_secret_ciphertext"\s+text/i);
    expect(sql).toMatch(/"client_secret_tag"\s+text/i);
  });

  it("oauth_connectors_audit has CHECK on action IN whitelist", () => {
    expect(sql).toMatch(/oauth_connectors_audit_action_check/i);
    expect(sql).toMatch(/action\s+IN\s*\([\s\S]*'connector_created'[\s\S]*'token_used'[\s\S]*'redirect_after_rejected'/i);
  });

  it("seeds 2 permissions per company (connectors:manage + connectors:audit)", () => {
    expect(sql).toMatch(
      /INSERT INTO\s+"permissions"[\s\S]*?'connectors:manage'[\s\S]*?'connectors:audit'/i,
    );
    expect(sql).toMatch(/ON CONFLICT\s*\(\s*"company_id"\s*,\s*"slug"\s*\)\s+DO NOTHING/i);
  });

  it("FK on user_id and actor_user_id reference user(id) (NOT users) and use text type", () => {
    // user_id columns are text and reference the BetterAuth "user" table
    expect(sql).toMatch(/"user_id"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(
      /REFERENCES\s+"user"\s*\(\s*"id"\s*\)/i,
    );
    // No mistaken FK on a "users" table
    expect(sql).not.toMatch(/REFERENCES\s+"users"\s*\(/i);
    // No mistaken FK on principals table (which doesn't exist)
    expect(sql).not.toMatch(/REFERENCES\s+"principals"\s*\(/i);
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/--> statement-breakpoint/);
  });

  it("FK cascades correctly", () => {
    // company_id ON DELETE CASCADE — when a company is deleted, all connectors data goes
    expect(
      (sql.match(/REFERENCES\s+"companies"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/gi) ?? []).length,
    ).toBeGreaterThanOrEqual(4);
    // user_id ON DELETE CASCADE on connector_tokens and user_api_keys
    expect(
      (sql.match(/REFERENCES\s+"user"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/gi) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    // connector_id ON DELETE SET NULL on audit (action history kept after delete)
    expect(sql).toMatch(/REFERENCES\s+"oauth_connectors"\s*\(\s*"id"\s*\)\s+ON DELETE SET NULL/i);
  });
});
