import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0085_github_apps", () => {
  const sql = readFileSync(join(__dirname, "0085_github_apps.sql"), "utf-8");

  it("creates github_apps and github_app_installations tables", () => {
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"?github_apps"?/i);
    expect(sql).toMatch(
      /CREATE TABLE\s+IF NOT EXISTS\s+"?github_app_installations"?/i,
    );
  });

  it("github_apps stores private_key encrypted inline (3 text NOT NULL, hex-encoded AES-256-GCM)", () => {
    // Same shape as oauth_connectors.client_secret_* — a single helper can read both.
    expect(sql).toMatch(/"private_key_iv"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/"private_key_ciphertext"\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/"private_key_tag"\s+text\s+NOT NULL/i);
  });

  it("github_apps stores webhook_secret encrypted inline (3 text, nullable)", () => {
    expect(sql).toMatch(/"webhook_secret_iv"\s+text/i);
    expect(sql).toMatch(/"webhook_secret_ciphertext"\s+text/i);
    expect(sql).toMatch(/"webhook_secret_tag"\s+text/i);
    // Should NOT have NOT NULL on webhook_secret_iv (admin may not provide one)
    expect(sql).not.toMatch(/"webhook_secret_iv"\s+text\s+NOT NULL/i);
  });

  it("github_apps has UNIQUE on connector_id (D6: at most one App per connector)", () => {
    expect(sql).toMatch(
      /CONSTRAINT\s+"github_apps_connector_unique"\s+UNIQUE\s*\(\s*"connector_id"\s*\)/i,
    );
  });

  it("github_apps has revoked_at for soft-delete", () => {
    expect(sql).toMatch(/"revoked_at"\s+timestamp\s+with\s+time\s+zone/i);
  });

  it("github_app_installations has UNIQUE (github_app_id, installation_id)", () => {
    expect(sql).toMatch(
      /CONSTRAINT\s+"github_app_installations_app_install_unique"\s+UNIQUE\s*\(\s*"github_app_id"\s*,\s*"installation_id"\s*\)/i,
    );
  });

  it("github_app_installations has CHECK on account_type IN ('User','Organization')", () => {
    expect(sql).toMatch(
      /CHECK\s*\(\s*account_type\s+IN\s*\(\s*'User'\s*,\s*'Organization'\s*\)\s*\)/i,
    );
  });

  it("github_app_installations has CHECK on repository_selection IN ('all','selected') (nullable allowed)", () => {
    expect(sql).toMatch(
      /repository_selection\s+IS\s+NULL\s+OR\s+repository_selection\s+IN\s*\(\s*'all'\s*,\s*'selected'\s*\)/i,
    );
  });

  it("denormalizes company_id on github_app_installations for cheap RLS", () => {
    // The installations table's RLS policy filters on company_id directly —
    // confirm the column is present and references companies(id) ON DELETE CASCADE.
    expect(sql).toMatch(
      /CREATE TABLE\s+IF NOT EXISTS\s+"?github_app_installations"?[\s\S]*?"company_id"\s+uuid\s+NOT NULL\s+REFERENCES\s+"companies"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/i,
    );
  });

  it("enables PERMISSIVE baseline + RESTRICTIVE tenant policy + FORCE on each table", () => {
    for (const table of ["github_apps", "github_app_installations"]) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE\\s+"?${table}"?\\s+ENABLE ROW LEVEL SECURITY`, "i"),
      );
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE\\s+"?${table}"?\\s+FORCE ROW LEVEL SECURITY`, "i"),
      );
      // PERMISSIVE baseline (database.md §2 + NEW-S1 chantier)
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY\\s+"tenant_baseline_permissive"\\s+ON\\s+"?${table}"?[\\s\\S]*?AS PERMISSIVE FOR ALL[\\s\\S]*?USING\\s*\\(\\s*true\\s*\\)`,
          "i",
        ),
      );
      // RESTRICTIVE tenant_isolation
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY\\s+"tenant_isolation"\\s+ON\\s+"?${table}"?[\\s\\S]*?AS RESTRICTIVE FOR ALL[\\s\\S]*?current_setting\\('app\\.current_company_id', true\\)::uuid`,
          "i",
        ),
      );
    }
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/--> statement-breakpoint/);
  });

  it("FK cascades correctly", () => {
    // company_id ON DELETE CASCADE on both tables
    expect(
      (sql.match(/REFERENCES\s+"companies"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/gi) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    // connector_id ON DELETE CASCADE on github_apps
    expect(sql).toMatch(
      /REFERENCES\s+"oauth_connectors"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/i,
    );
    // github_app_id ON DELETE CASCADE on github_app_installations
    expect(sql).toMatch(
      /REFERENCES\s+"github_apps"\s*\(\s*"id"\s*\)\s+ON DELETE CASCADE/i,
    );
    // created_by_user_id NO cascade — keep the audit trail when a user leaves
    expect(sql).toMatch(
      /"created_by_user_id"\s+text\s+NOT NULL\s+REFERENCES\s+"user"\s*\(\s*"id"\s*\)/i,
    );
  });

  it("creates company-leading indexes on both tables", () => {
    expect(sql).toMatch(
      /CREATE INDEX\s+IF NOT EXISTS\s+"idx_github_apps_company"[\s\S]*?\(\s*"company_id"\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE INDEX\s+IF NOT EXISTS\s+"idx_github_app_installations_company"[\s\S]*?\(\s*"company_id"\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE INDEX\s+IF NOT EXISTS\s+"idx_github_app_installations_account"[\s\S]*?\(\s*"account_login"\s*\)/i,
    );
  });
});
