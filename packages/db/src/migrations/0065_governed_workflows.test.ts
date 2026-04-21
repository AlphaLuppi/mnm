import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const MIGRATION_URL = new URL("./0065_governed_workflows.sql", import.meta.url);

let sql: string;

beforeAll(async () => {
  sql = await readFile(fileURLToPath(MIGRATION_URL), "utf8");
});

describe("0065_governed_workflows migration — file exists", () => {
  it("is non-empty", () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it("starts with the expected header comment", () => {
    expect(sql).toMatch(/^-- GOVERNED-WORKFLOWS: T2 /);
  });
});

describe("0065_governed_workflows migration — agents table extensions", () => {
  it("adds latest_git_tag column to agents", () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+agents\s+ADD\s+COLUMN\s+latest_git_tag\s+TEXT/i);
  });

  it("adds enabled column to agents with NOT NULL DEFAULT true", () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+agents\s+ADD\s+COLUMN\s+enabled\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+true/i);
  });
});
