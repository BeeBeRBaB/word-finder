// Seeding. Pure: no DOM, no `location` — the query string arrives as an argument
// so the same functions can be exercised from a plain unit test.
//
// Deterministic PRNG so a puzzle can be reproduced exactly. `?seed=N` pins the
// sequence, `?subject=` / `?category=` pin what is dealt; with none of them, the
// clock seeds it and a random subject is chosen. This is the shipped path, not a
// test-only branch.

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
 * Which subject to deal, from the URL: `?subject=<id>` pins one, `?category=<id>`
 * pins the category and picks inside it, neither picks from the whole catalog.
 *
 * Note the asymmetry, which is not decoration: the fully-explicit branch must NOT
 * touch `rng`. Drawing there would shift the sequence, so the same `?seed=` would
 * deal a different grid with and without `?subject=`, and the determinism the e2e
 * suite rests on would quietly stop holding.
 *
 * An id that is not in the catalog falls through to a random pick rather than
 * throwing — a stale bookmark should still give you a game.
 *
 * @param {string} search @param {import('./catalog.js').Category[]} categories
 * @param {Rng} rng @returns {string}
 */
export function resolveSubject(search, categories, rng) {
  const p = new URLSearchParams(search);
  const all = categories.flatMap(c => c.subjects);
  const wanted = p.get('subject');
  if (wanted !== null && all.some(s => s.id === wanted)) return wanted;
  const cat = p.get('category');
  if (cat !== null) {
    const c = categories.find(x => x.id === cat);
    if (c && c.subjects.length) return c.subjects[rng.int(c.subjects.length)].id;
  }
  return all[rng.int(all.length)].id;
}
