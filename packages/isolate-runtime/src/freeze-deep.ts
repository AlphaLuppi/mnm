/**
 * Deep-freezes an object graph in place. Used by hook runners to ensure
 * the host context object passed into an isolate (or returned by a hook)
 * cannot be mutated to perform prototype-pollution attacks.
 *
 * Behaviour:
 *  - No-op on primitives (returns the same value).
 *  - Strips `__proto__` access by setting the prototype to `null` on plain
 *    objects (the isolate cannot pollute Object.prototype via the returned
 *    graph).
 *  - Recurses into own enumerable property values (arrays + plain objects).
 *  - Tracks visited objects via a `WeakSet` to handle circular references
 *    without infinite recursion.
 *  - Skips already-frozen objects (idempotent + defends against external
 *    pre-frozen graphs).
 *
 * This function MUTATES its input — callers needing immutability of the
 * original graph should clone first (`structuredClone`).
 */
export function freezeDeep<T>(obj: T): Readonly<T> {
  freezeDeepInternal(obj, new WeakSet());
  return obj as Readonly<T>;
}

function freezeDeepInternal(obj: unknown, seen: WeakSet<object>): void {
  if (obj === null || typeof obj !== "object") return;
  if (seen.has(obj as object)) return;
  if (Object.isFrozen(obj)) return;
  seen.add(obj as object);

  // Strip prototype chain on plain objects (not on arrays or class
  // instances — they need their methods). A "plain" object is one whose
  // prototype is Object.prototype (or already null).
  if (!Array.isArray(obj)) {
    const proto = Object.getPrototypeOf(obj);
    if (proto === Object.prototype || proto === null) {
      Object.setPrototypeOf(obj as object, null);
    }
  }

  for (const value of Object.values(obj as object)) {
    freezeDeepInternal(value, seen);
  }
  Object.freeze(obj);
}
