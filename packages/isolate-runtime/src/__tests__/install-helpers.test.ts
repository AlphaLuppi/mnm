import { describe, it, expect } from "vitest";
import ivm from "isolated-vm";
import { installHelpers } from "../install-helpers.js";

/**
 * Regression coverage for the helper bridge — installed onto a V8 isolate
 * via isolated-vm. These mirror the original gate-runner tests + add
 * coverage for the configurable `helperTimeoutMs` option.
 *
 * NOTE: `ctx.eval` below refers to the isolated-vm Context's sandboxed
 * code execution API (NOT host-side JavaScript code execution). Code is
 * run inside a separate V8 isolate with no fs / network / require access.
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
      const script = await ctx.eval(
        `
        (async () => {
          const r = await ctx.helpers.echo({ hello: "world" });
          return JSON.stringify(r);
        })()
      `,
        { promise: true, copy: true },
      );
      expect(JSON.parse(script as string)).toEqual({ hello: "world" });
    });
  });

  it("rejects with the host error message when the helper throws", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = {
        boom: async () => {
          throw new Error("kaboom");
        },
      };
      await installHelpers(ctx, jail, helpers);
      await expect(ctx.eval(`ctx.helpers.boom()`, { promise: true, copy: true })).rejects.toThrow(
        /kaboom/,
      );
    });
  });

  it("times out at default 3 seconds", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = {
        slow: async () => new Promise((r) => setTimeout(r, 4000)),
      };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(`ctx.helpers.slow()`, { promise: true, copy: true }),
      ).rejects.toThrow(/timed out/i);
    });
  }, 10_000);

  it("respects a custom helperTimeoutMs (longer than default)", async () => {
    await withIsolate(async (ctx, jail) => {
      // Helper that takes 4 s to resolve — would time out at default 3 s
      // but should pass with a 6 s budget.
      const helpers = {
        steady: async () => {
          await new Promise((r) => setTimeout(r, 4000));
          return "ok";
        },
      };
      await installHelpers(ctx, jail, helpers, { helperTimeoutMs: 6000 });
      const result = await ctx.eval(`ctx.helpers.steady()`, { promise: true, copy: true });
      expect(result).toBe("ok");
    });
  }, 15_000);

  it("respects a custom helperTimeoutMs (shorter than default)", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = {
        slow: async () => new Promise((r) => setTimeout(r, 500)),
      };
      // 100 ms ceiling — must trigger the timeout path.
      await installHelpers(ctx, jail, helpers, { helperTimeoutMs: 100 });
      await expect(
        ctx.eval(`ctx.helpers.slow()`, { promise: true, copy: true }),
      ).rejects.toThrow(/timed out/i);
    });
  });

  it("rejects when passed a value ivm cannot clone (function arg)", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { echo: async (x: unknown) => x };
      await installHelpers(ctx, jail, helpers);
      await expect(
        ctx.eval(`(async () => { return await ctx.helpers.echo(() => 42); })()`, {
          promise: true,
          copy: true,
        }),
      ).rejects.toThrow();
    });
  });

  it("returns helper objects deep-copied across the boundary", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = {
        getObj: async () => ({ nested: { value: 42 } }),
      };
      await installHelpers(ctx, jail, helpers);
      const script = await ctx.eval(
        `
        (async () => {
          const r = await ctx.helpers.getObj();
          return JSON.stringify(r);
        })()
      `,
        { promise: true, copy: true },
      );
      expect(JSON.parse(script as string)).toEqual({ nested: { value: 42 } });
    });
  });

  it("only installs proxies for declared helpers", async () => {
    await withIsolate(async (ctx, jail) => {
      const helpers = { known: async () => "ok" };
      await installHelpers(ctx, jail, helpers);
      // Calling a known helper works.
      const ok = await ctx.eval(`ctx.helpers.known()`, { promise: true, copy: true });
      expect(ok).toBe("ok");
      // Calling something not declared has no proxy attached, so accessing
      // ctx.helpers.unknown returns undefined (and calling it throws as a
      // normal isolate error: not a function).
      const probe = await ctx.eval(`typeof ctx.helpers.unknown`, { copy: true });
      expect(probe).toBe("undefined");
    });
  });
});
