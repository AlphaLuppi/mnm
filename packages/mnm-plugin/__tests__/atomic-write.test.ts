import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteFile } from "../src/atomic-write.js";

describe("atomicWriteFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "atomic-write-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a new file with the exact content provided", async () => {
    const target = join(dir, "new.txt");
    await atomicWriteFile(target, "hello");
    expect(readFileSync(target, "utf8")).toBe("hello");
  });

  it("overwrites an existing file", async () => {
    const target = join(dir, "existing.txt");
    writeFileSync(target, "old");
    await atomicWriteFile(target, "new");
    expect(readFileSync(target, "utf8")).toBe("new");
  });

  it("leaves no temp artifact after success", async () => {
    const target = join(dir, "clean.txt");
    await atomicWriteFile(target, "x");
    expect(existsSync(`${target}.tmp`)).toBe(false);
  });

  it("creates the parent directory if missing", async () => {
    const target = join(dir, "nested", "deeper", "file.txt");
    await atomicWriteFile(target, "deep");
    expect(readFileSync(target, "utf8")).toBe("deep");
  });
});
