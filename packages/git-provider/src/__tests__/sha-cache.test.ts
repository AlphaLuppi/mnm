import { describe, it, expect } from "vitest";
import { ShaCache } from "../sha-cache.js";

describe("ShaCache", () => {
  it("stores and retrieves a value by (providerId, path, sha)", () => {
    const cache = new ShaCache();
    cache.set("gitlab:42", "hello-world/workflow.json", "abc123", "{hello}");
    expect(cache.get("gitlab:42", "hello-world/workflow.json", "abc123")).toBe("{hello}");
  });

  it("returns undefined for a miss", () => {
    const cache = new ShaCache();
    expect(cache.get("gitlab:42", "x", "y")).toBeUndefined();
  });

  it("isolates keys by providerId", () => {
    const cache = new ShaCache();
    cache.set("gitlab:42", "p", "s", "A");
    cache.set("gitlab:43", "p", "s", "B");
    expect(cache.get("gitlab:42", "p", "s")).toBe("A");
    expect(cache.get("gitlab:43", "p", "s")).toBe("B");
  });

  it("isolates keys by path", () => {
    const cache = new ShaCache();
    cache.set("p", "a.json", "s", "A");
    cache.set("p", "b.json", "s", "B");
    expect(cache.get("p", "a.json", "s")).toBe("A");
    expect(cache.get("p", "b.json", "s")).toBe("B");
  });

  it("evicts the oldest entry when maxEntries is reached (FIFO)", () => {
    const cache = new ShaCache({ maxEntries: 2 });
    cache.set("p", "a", "s1", "A");
    cache.set("p", "b", "s2", "B");
    cache.set("p", "c", "s3", "C");
    expect(cache.get("p", "a", "s1")).toBeUndefined(); // evicted
    expect(cache.get("p", "b", "s2")).toBe("B");
    expect(cache.get("p", "c", "s3")).toBe("C");
  });

  it("`size()` reflects current entry count", () => {
    const cache = new ShaCache({ maxEntries: 10 });
    expect(cache.size()).toBe(0);
    cache.set("p", "a", "s", "A");
    expect(cache.size()).toBe(1);
  });

  it("`clear()` empties the cache", () => {
    const cache = new ShaCache();
    cache.set("p", "a", "s", "A");
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get("p", "a", "s")).toBeUndefined();
  });

  it("defaults maxEntries to 500", () => {
    const cache = new ShaCache();
    for (let i = 0; i < 500; i++) cache.set("p", `f${i}`, "s", "v");
    expect(cache.size()).toBe(500);
    cache.set("p", "f500", "s", "v"); // triggers eviction
    expect(cache.size()).toBe(500);
    expect(cache.get("p", "f0", "s")).toBeUndefined();
    expect(cache.get("p", "f500", "s")).toBe("v");
  });
});
