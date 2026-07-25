// Shared fixtures for the node:test unit specs, mirroring tests/e2e/helpers.js.

/** A Map-backed stand-in for localStorage. Returns `null` for a missing key, the
 * way the real thing does — several tests depend on that rather than `undefined`.
 * @returns {Pick<Storage,'getItem'|'setItem'|'removeItem'>} */
export function memStore() {
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, v),
    removeItem: k => { m.delete(k); },
  };
}
