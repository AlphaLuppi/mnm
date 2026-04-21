import { describe, it, expect } from "vitest";
import { CompiledCache } from "../compiled-cache.js";

describe("CompiledCache", () => {
  it("stores and retrieves by (gitSha, path)", () => {
    const cache = new CompiledCache();
    cache.set("sha1", "gates/a.gate.ts", "var js1 = 1;");
    expect(cache.get("sha1", "gates/a.gate.ts")).toBe("var js1 = 1;");
  });

  it("returns undefined on miss", () => {
    const cache = new CompiledCache();
    expect(cache.get("sha1", "gates/a.gate.ts")).toBeUndefined();
  });

  it("treats different shas as different keys", () => {
    const cache = new CompiledCache();
    cache.set("sha1", "gates/a.gate.ts", "v1");
    cache.set("sha2", "gates/a.gate.ts", "v2");
    expect(cache.get("sha1", "gates/a.gate.ts")).toBe("v1");
    expect(cache.get("sha2", "gates/a.gate.ts")).toBe("v2");
  });

  it("treats different paths as different keys", () => {
    const cache = new CompiledCache();
    cache.set("sha1", "gates/a.gate.ts", "v-a");
    cache.set("sha1", "gates/b.gate.ts", "v-b");
    expect(cache.get("sha1", "gates/a.gate.ts")).toBe("v-a");
    expect(cache.get("sha1", "gates/b.gate.ts")).toBe("v-b");
  });

  it("FIFO-evicts the oldest entry once maxEntries is exceeded", () => {
    const cache = new CompiledCache({ maxEntries: 2 });
    cache.set("s1", "a", "v1");
    cache.set("s2", "b", "v2");
    cache.set("s3", "c", "v3");
    expect(cache.get("s1", "a")).toBeUndefined();
    expect(cache.get("s2", "b")).toBe("v2");
    expect(cache.get("s3", "c")).toBe("v3");
  });

  it("overwriting an existing key does not count as a new entry for eviction", () => {
    const cache = new CompiledCache({ maxEntries: 2 });
    cache.set("s1", "a", "v1");
    cache.set("s2", "b", "v2");
    cache.set("s1", "a", "v1-updated");
    expect(cache.size()).toBe(2);
    expect(cache.get("s1", "a")).toBe("v1-updated");
    expect(cache.get("s2", "b")).toBe("v2");
  });

  it("exposes size() and clear()", () => {
    const cache = new CompiledCache();
    cache.set("s1", "a", "v");
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("JSON-encodes keys so path/sha boundaries cannot collide", () => {
    const cache = new CompiledCache();
    cache.set("s1", "a|b", "v-one");
    cache.set("s1|a", "b", "v-two");
    expect(cache.get("s1", "a|b")).toBe("v-one");
    expect(cache.get("s1|a", "b")).toBe("v-two");
  });
});
