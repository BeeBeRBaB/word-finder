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

/** @typedef {{id:string, name:string}} CategoryRef */
/** @typedef {{subject:string|null, category:string}} Target */

/**
 * What to deal, from the URL: `?subject=<cat>/<slug>` pins a subject by shape alone
 * — whether that slug is really in the category's module is only knowable after the
 * module loads, so `loadSubject` (src/subjects.js) is what reports `unknown` for a
 * key that is not there. `?category=<id>` pins the category and leaves the subject
 * to be drawn once its module is loaded. With neither, a category is drawn here.
 *
 * `categories` arrives as a parameter rather than an import of catalog.js: this
 * module stays dependency-free so it can be unit-tested with a tiny fixture list.
 *
 * Note the asymmetry, which is not decoration: an explicit `?subject=` or
 * `?category=` must NOT touch `rng`. Drawing there would shift the sequence, so the
 * same `?seed=` would deal a different grid with and without the parameter, and the
 * determinism the e2e suite rests on would quietly stop holding.
 *
 * An id that names no known category falls through to a random pick rather than
 * throwing — a stale bookmark should still give you a game.
 *
 * @param {string} search @param {CategoryRef[]} categories
 * @param {Rng} rng @returns {Target}
 */
export function resolveTarget(search, categories, rng) {
  const p = new URLSearchParams(search);
  const ids = new Set(categories.map(c => c.id));

  const subject = p.get('subject');
  if (subject !== null) {
    const slash = subject.indexOf('/');
    if (slash > 0) {
      const category = subject.slice(0, slash);
      const slug = subject.slice(slash + 1);
      if (slug.length > 0 && ids.has(category)) return { subject, category };
    }
  }

  const category = p.get('category');
  if (category !== null && ids.has(category)) return { subject: null, category };

  return { subject: null, category: categories[rng.int(categories.length)].id };
}
