// Seeding. Pure: no DOM, no `location` — the query string arrives as an argument
// so the same functions can be exercised from a plain unit test.
//
// Deterministic PRNG so a puzzle can be reproduced exactly. `?seed=N` pins the
// sequence, `?theme=N` pins the theme; with neither, the clock seeds it and the
// game behaves exactly as before. This is the shipped path, not a test-only branch.

/**
 * @typedef {{random:()=>number, int:(n:number)=>number, shuffle:<T>(a:T[])=>T[]}} Rng
 */

/** Small fast PRNG. Same seed, same sequence — the basis of reproducible puzzles.
 * @param {number} a @returns {() => number} */
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** @param {number} seed @returns {Rng} */
export function makeRng(seed) {
  const random = mulberry32(seed);
  return {
    random,
    int: (n) => Math.floor(random() * n),
    /** @template T @param {T[]} arr @returns {T[]} */
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

/** `?seed=N` when present and numeric, else the clock.
 * @param {string} search @returns {number} */
export function resolveSeed(search) {
  const v = new URLSearchParams(search).get('seed');
  if (v === null) return Date.now();
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * `?theme=N` clamped into range when present, else a random theme.
 * Note the asymmetry: the explicit branch must NOT touch `rng`, or pinning a theme
 * would shift the sequence and a pinned seed would produce a different grid.
 * @param {string} search @param {number} count @param {Rng} rng @returns {number}
 */
export function resolveThemeIndex(search, count, rng) {
  const v = new URLSearchParams(search).get('theme');
  if (v === null) return rng.int(count);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(count - 1, Math.max(0, n)) : 0;
}
