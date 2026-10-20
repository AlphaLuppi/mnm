import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

describe("migration 0086_user_sound_settings", () => {
  const sql = readFileSync(join(__dirname, "0086_user_sound_settings.sql"), "utf-8");

  it("creates user_sound_settings table with CREATE TABLE IF NOT EXISTS", () => {
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+"?user_sound_settings"?/i);
  });

  it("has enabled boolean NOT NULL DEFAULT true", () => {
    expect(sql).toMatch(/"enabled"\s+boolean\s+NOT NULL\s+DEFAULT\s+true/i);
  });

  it("has volume integer NOT NULL DEFAULT 70", () => {
    expect(sql).toMatch(/"volume"\s+integer\s+NOT NULL\s+DEFAULT\s+70/i);
  });

  it("has tones jsonb NOT NULL", () => {
    expect(sql).toMatch(/"tones"\s+jsonb\s+NOT NULL/i);
  });

  it("has user_sound_settings_volume_range CHECK constraint", () => {
    expect(sql).toMatch(/CONSTRAINT\s+"user_sound_settings_volume_range"\s+CHECK/i);
  });

  it("has unique index user_sound_settings_company_user_uq on (company_id, user_id)", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+IF NOT EXISTS\s+"user_sound_settings_company_user_uq"\s+ON\s+"user_sound_settings"\s*\(\s*"company_id"\s*,\s*"user_id"\s*\)/i,
    );
  });

  it("enables and forces ROW LEVEL SECURITY", () => {
    expect(sql).toMatch(
      /ALTER TABLE\s+"user_sound_settings"\s+ENABLE ROW LEVEL SECURITY/i,
    );
    expect(sql).toMatch(
      /ALTER TABLE\s+"user_sound_settings"\s+FORCE ROW LEVEL SECURITY/i,
    );
  });

  it("creates tenant_baseline_permissive PERMISSIVE policy", () => {
    expect(sql).toMatch(
      /CREATE POLICY\s+"tenant_baseline_permissive"\s+ON\s+"?user_sound_settings"?[\s\S]*?AS PERMISSIVE FOR ALL[\s\S]*?USING\s*\(\s*true\s*\)/i,
    );
  });

  it("creates tenant_isolation RESTRICTIVE policy referencing current_setting('app.current_company_id'", () => {
    expect(sql).toMatch(
      /CREATE POLICY\s+"tenant_isolation"\s+ON\s+"?user_sound_settings"?[\s\S]*?AS RESTRICTIVE FOR ALL[\s\S]*?current_setting\('app\.current_company_id', true\)::uuid/i,
    );
  });

  it("uses --> statement-breakpoint between DDL statements", () => {
    expect(sql).toMatch(/--> statement-breakpoint/);
  });
});
