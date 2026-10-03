// A dynamic import that can be tried again. A page remembers a failed dynamic import for its whole
// life, so a retry of the same URL fails at once, back online or not: each retry names a URL the
// page has not failed on (`?retry=N`, a counter, since each one is poisoned in turn). sw.js keys
// code by path, so every retry still reads and refreshes the one cached copy. Only the module
// itself gets a fresh URL: one it imports that failed stays failed until the next launch.

/**
 * @template T
 * @param {(key:string, query:string) => Promise<T>} load imports `key`'s module with `query` ('' the
 *   first time) on its URL. It calls import() itself, so the path resolves against its own module.
 * @returns {(key:string) => Promise<T>}
 */
export function retryingImport(load) {
  /** @type {Map<string, number>} */
  const failures = new Map();
  return (key) => {
    const n = failures.get(key) ?? 0;
    return load(key, n ? `?retry=${n}` : '').catch((err) => { failures.set(key, n + 1); throw err; });
  };
}
