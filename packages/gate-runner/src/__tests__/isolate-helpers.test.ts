import { describe, it, expect } from "vitest";
import ivm from "isolated-vm";
import { installHelpers } from "../isolate-helpers.js";

/**
 * The bridge MUST:
 *  - Expose each helper name as an async function on `ctx.helpers` inside the
 *    isolate.
 *  - Marshal arguments via `copy: true` (no Reference leakage across the
 *    sandbox boundary).
 *  - Resolve with the host function's return value (deep-copied).
 *  - Reject with a plain Error if the host function throws.
 *  - Reject with a timeout error if the host function exceeds 3 s.
 *
 * Note: circular references ARE accepted by ivm's structured-clone (copied as
 * `[Circular]`). The bridge delegates serialisation entirely to ivm — it does
 * not enforce additional JSON-serialisability.
 */
describe("installHelpers", () => {
  async function withIsolate<T>(
    fn: (ctx: ivm.Context, jail: ivm.Reference<Record<string, unknown>>) => Promise<T>,
  ): Promise<T> {
    const iso = new ivm.Isolate({ memoryLimit: 64 });
    try {
      const ctx = await iso.createContext();
      const jail = ctx.global;
      await jail.set("global", jail.derefInto());
      return await fn(ctx, jail);
    } finally {
      iso.dispose();
    }
  }

  it("forwards args and returns the helper's resolved value", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { echo: async (x: unknown) => x };
      await installHelpers(ctx, jail, helpers);
      const script = await ctx.eval(`
        (async () => {
          const r = await ctx.helpers.echo({ hello: "world" });
          return JSON.stringify(r);
        })()
      `, { promise: true, copy: true });
      expect(JSON.parse(script as string)).toEqual({ hello: "world" });
    });
  });

  it("rejects with the host error message when the helper throws", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { boom: async () => { throw new Error("kaboom"); } };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(`ctx.helpers.boom()`, { promise: true, copy: true }),
      ).rejects.toThrow(/kaboom/);
    });
  });

  it("times out if the helper exceeds 3 seconds", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = {
        slow: async () => new Promise((r) => setTimeout(r, 4000)),
      };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(`ctx.helpers.slow()`, { promise: true, copy: true }),
      ).rejects.toThrow(/timed out/i);
    }, );
  }, 10_000);

  it("rejects when passed a value ivm cannot clone (function arg)", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { echo: async (x: unknown) => x };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(
          `(async () => { return await ctx.helpers.echo(() => 42); })()`,
          { promise: true, copy: true },
        ),
      ).rejects.toThrow();
    });
  });
});
