import { describe, it, expect } from "vitest";
import { freezeDeep } from "../freeze-deep.js";

describe("freezeDeep", () => {
  it("returns primitives unchanged (no-op)", () => {
    expect(freezeDeep(1)).toBe(1);
    expect(freezeDeep("foo")).toBe("foo");
    expect(freezeDeep(null)).toBe(null);
    expect(freezeDeep(undefined)).toBe(undefined);
    expect(freezeDeep(true)).toBe(true);
  });

  it("freezes a plain object so mutations throw in strict mode", () => {
    const o = freezeDeep({ a: 1, b: 2 }) as { a: number; b: number };
    expect(Object.isFrozen(o)).toBe(true);
    expect(() => {
      // @ts-expect-error - frozen
      o.a = 99;
    }).toThrow();
  });

  it("strips Object.prototype so __proto__ pollution is neutralised", () => {
    const polluted = JSON.parse('{"__proto__":{"x":1}}');
    // Before freeze: in some runtimes the __proto__ key would be silently
    // dropped, in others it pollutes. Either way, after freezeDeep the
    // resulting object's prototype is null — so reading {}.x yields
    // undefined, and the original object has no own .x property.
    const frozen = freezeDeep(polluted) as Record<string, unknown>;
    // No accidental property leakage onto plain objects via prototype.
    const probe: Record<string, unknown> = {};
    expect(probe.x).toBeUndefined();
    // The frozen object itself doesn't expose 'x' as an own property.
    expect(Object.prototype.hasOwnProperty.call(frozen, "x")).toBe(false);
    // Prototype is null after freeze.
    expect(Object.getPrototypeOf(frozen)).toBe(null);
  });

  it("recursively freezes nested objects", () => {
    const o = freezeDeep({ a: { b: { c: 1 } } }) as { a: { b: { c: number } } };
    expect(Object.isFrozen(o)).toBe(true);
    expect(Object.isFrozen(o.a)).toBe(true);
    expect(Object.isFrozen(o.a.b)).toBe(true);
  });

  it("freezes array entries", () => {
    const o = freezeDeep([{ a: 1 }, { a: 2 }]) as Array<{ a: number }>;
    expect(Object.isFrozen(o)).toBe(true);
    expect(Object.isFrozen(o[0])).toBe(true);
    expect(Object.isFrozen(o[1])).toBe(true);
  });

  it("handles circular references without infinite recursion", () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    expect(() => freezeDeep(a)).not.toThrow();
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(b)).toBe(true);
  });

  it("is idempotent — freezing an already-frozen graph is a no-op", () => {
    const o = freezeDeep({ a: 1 }) as { a: number };
    expect(() => freezeDeep(o)).not.toThrow();
    expect(Object.isFrozen(o)).toBe(true);
  });

  it("does not strip prototype on non-plain objects (class instances)", () => {
    class Foo {
      constructor(public x: number) {}
      bar() {
        return this.x;
      }
    }
    const instance = new Foo(42);
    freezeDeep(instance);
    // Prototype kept so methods still work (though instance is frozen).
    expect(typeof instance.bar).toBe("function");
    expect(instance.bar()).toBe(42);
  });
});
