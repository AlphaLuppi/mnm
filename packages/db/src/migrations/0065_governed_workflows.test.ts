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
