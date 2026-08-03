// Puzzle generation and hit-detection. Pure: given the same rng and inputs this
// module produces the same puzzle anywhere, with no DOM in sight.

/**
 * @typedef {import('./rng.js').Rng} Rng
 * @typedef {{word:string, x0:number, y0:number, dx:number, dy:number}} Placement
 * @typedef {{name:string, cells:string[], words:string[], placements:Placement[]}} Puzzle
 * @typedef {{x0:number, y0:number, x1:number, y1:number}} Selection
 */

const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** @param {string} s @returns {string} */
export function cap(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }

/**
 * @typedef {{min:number, max:number, take:number}} Bucket
 */

/** How far a length sits outside a bucket's range; 0 when inside it.
 * @param {number} len @param {Bucket} b @returns {number} */
function distanceTo(len, b) {
  if (len < b.min) return b.min - len;
  if (len > b.max) return len - b.max;
  return 0;
}

/** Move the words a player has not seen this cycle to the front, keeping the shuffled
 * order within each half. Ordering, not filtering: the caller still takes the first N, so
 * a bag too small to fill a bucket is topped up from seen words instead of shipping a
 * board a word short. `undefined` returns the list untouched.
 * @template {string} T
 * @param {T[]} shuffled @param {Set<string>|undefined} undrawn @returns {T[]} */
function prefer(shuffled, undrawn) {
  if (!undrawn) return shuffled;
  return [...shuffled.filter(w => undrawn.has(w)), ...shuffled.filter(w => !undrawn.has(w))];
}

/**
 * Draw `count` words spread across the length buckets in `mix`, or a deal is as likely
 * to be twelve nine-letter words as twelve four-letter ones. A short bucket is
 * backfilled nearest-length-first rather than throwing — the scarce bucket is always
 * the short words, and that subject is still worth playing.
 *
 * `undrawn` is the subject's shuffle bag — the words the player has not seen this cycle.
 * It only ORDERS each bucket, never filters it, so a bag that cannot fill a bucket still
 * yields a full board rather than a short one. Omitting it reproduces the draw exactly,
 * which is what keeps a pinned `?seed=` reproducible for every player.
 *
 * @param {string[]} pool @param {import('./rng.js').Rng} rng
 * @param {{count:number, mix:Bucket[], undrawn?:Set<string>}} opts
 * @returns {string[]}
 */
export function pickWords(pool, rng, { count, mix, undrawn }) {
  const lo = Math.min(...mix.map(b => b.min)), hi = Math.max(...mix.map(b => b.max));
  const eligible = pool.filter(w => w.length >= lo && w.length <= hi);
  if (eligible.length < count) {
    throw new Error(`pool has ${eligible.length} eligible words, need ${count}`);
  }
  /** @type {Set<string>} */
  const used = new Set();
  /** @type {string[]} */
  const out = [];
  /** @type {Bucket[]} */
  const unfilled = [];
  for (const b of mix) {
    const cands = prefer(rng.shuffle(eligible.filter(w => !used.has(w) && distanceTo(w.length, b) === 0)), undrawn);
    for (const w of cands.slice(0, b.take)) { used.add(w); out.push(w); }
    if (cands.length < b.take) unfilled.push(b);
  }
  if (out.length < count) {
    // Nearest length first. Shuffled before sorting so ties stay random — sort is
    // stable in every engine this ships to, which is also what lets the bag's ordering
    // survive as the tie-break within a distance band.
    const rest = prefer(rng.shuffle(eligible.filter(w => !used.has(w))), undrawn)
      .sort((a, b2) =>
        Math.min(...unfilled.map(u => distanceTo(a.length, u))) -
        Math.min(...unfilled.map(u => distanceTo(b2.length, u))));
    for (const w of rest.slice(0, count - out.length)) { used.add(w); out.push(w); }
  }
  return out;
}

// Each swap costs a full 400-attempt placement pass, and a board that cannot be filled
// in eight swaps is a broken subject, not an unlucky seed.
const MAX_SWAPS = 8;

/**
 * Generate a puzzle from a resolved pool. `placements` records where each word landed so
 * a test can assert the grid contains what the list claims. Knows nothing about
 * categories or the catalog, so it can be tested against a synthetic pool.
 *
 * @param {{name:string, pool:string[], rng:Rng, size:number, count:number, mix:Bucket[],
 *          undrawn?:Set<string>}} opts
 * @returns {Puzzle}
 */
export function buildPuzzle({ name, pool, rng, size, count, mix, undrawn }) {
  const fits = pool.filter(w => w.length <= size - 1);
  const chosen = pickWords(fits, rng, { count, mix, undrawn });
  // Longest first: a long word has the fewest legal positions, so placing it into an
  // empty grid and letting short words fill around it fails far less often.
  const words = chosen.slice().sort((a, b) => b.length - a.length);
  const spare = rng.shuffle(fits.filter(w => !chosen.includes(w)));

  /** @type {(string|null)[][]} */
  const g = Array.from({ length: size }, () => new Array(size).fill(null));
  /** @type {Placement[]} */
  const placements = [];
  let swaps = 0;

  for (let i = 0; i < words.length; i++) {
    let placed = false;
    while (!placed) {
      const w = words[i];
      for (let attempt = 0; attempt < 400; attempt++) {
        const [dx, dy] = DIRS[rng.int(8)];
        const span = w.length - 1;
        const xmin = dx < 0 ? span : 0, xmax = dx > 0 ? size - 1 - span : size - 1;
        const ymin = dy < 0 ? span : 0, ymax = dy > 0 ? size - 1 - span : size - 1;
        if (xmax < xmin || ymax < ymin) continue;
        const x0 = xmin + rng.int(xmax - xmin + 1);
        const y0 = ymin + rng.int(ymax - ymin + 1);
        let ok = true;
        for (let j = 0; j < w.length; j++) {
          const c = g[y0 + dy * j][x0 + dx * j];
          if (c && c !== w[j]) { ok = false; break; }
        }
        if (!ok) continue;
        for (let j = 0; j < w.length; j++) g[y0 + dy * j][x0 + dx * j] = w[j];
        placements.push({ word: w, x0, y0, dx, dy });
        placed = true;
        break;
      }
      // Swap, never drop: dropping produced boards quietly one word short.
      if (placed) break;   // skips the swap below; the while alone would not
      const alt = spare.findIndex(s => s.length === w.length);
      if (alt === -1 || ++swaps > MAX_SWAPS) {
        throw new Error(`could not place ${w} in a ${size}x${size} grid for "${name}"`);
      }
      words[i] = spare.splice(alt, 1)[0];
    }
  }

  /** @type {string[]} */
  const cells = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) cells.push(g[y][x] || ALPHABET[rng.int(26)]);

  return { name, cells, words: placements.map(p => p.word), placements };
}

/**
 * Snap a pointer offset to one of 8 directions and a whole number of cells. Length is
 * the PROJECTION onto that direction; raw distance overshoots on diagonals.
 * @param {number} sx @param {number} sy @param {number} fx @param {number} fy
 * @param {number} size
 * @returns {{x1:number, y1:number}}
 */
export function snap(sx, sy, fx, fy, size) {
  const dx = fx - sx, dy = fy - sy;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { x1: sx, y1: sy };
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const ux = Math.round(Math.cos(ang)), uy = Math.round(Math.sin(ang));
  let L = Math.round((dx * ux + dy * uy) / (ux * ux + uy * uy));
  while (L > 0 && (sx + ux * L < 0 || sx + ux * L >= size || sy + uy * L < 0 || sy + uy * L >= size)) L--;
  return { x1: sx + ux * L, y1: sy + uy * L };
}

/** Flat `cells` indices under a selection. Shared so reading letters and colouring
 * found ones cannot walk a selection differently.
 * @param {number} size @param {Selection} sel @returns {number[]} */
export function lineIndices(size, sel) {
  const dx = Math.sign(sel.x1 - sel.x0), dy = Math.sign(sel.y1 - sel.y0);
  const len = Math.max(Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)) + 1;
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < len; i++) out.push((sel.y0 + dy * i) * size + (sel.x0 + dx * i));
  return out;
}

/** Read the letters under a selection, start to end inclusive.
 * @param {string[]} cells @param {number} size @param {Selection} sel @returns {string} */
export function readLine(cells, size, sel) {
  return lineIndices(size, sel).map(i => cells[i]).join('');
}

/** A cell run's identity: its two endpoints, unordered. Two points determine exactly one
 * straight run, so this is an exact key rather than a heuristic, and a word dragged
 * backwards keys the same as forwards.
 * @param {number} size @param {Selection} sel @returns {string} */
export function runKey(size, sel) {
  const a = sel.y0 * size + sel.x0, b = sel.y1 * size + sel.x1;
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** The not-yet-found word whose placement occupies exactly the selected cells.
 *
 * Identity is the CELL RUN, not the letters. Matching on letters alone marked a word found
 * wherever its letters happened to read — inside a longer word (WOOD inside HARDWOOD), or
 * by chance in the filler — and its real placement then failed to match and flashed as a
 * miss on a word that is genuinely there. 581 of 600 subjects contain a word inside another
 * of their own words, and 30% of dealt puzzles contain at least one word readable off its
 * placement, so this was the common case rather than a curiosity.
 * @param {Placement[]} placements @param {Record<string, unknown>} found
 * @param {number} size @param {Selection} sel @returns {string|null} */
export function matchWord(placements, found, size, sel) {
  const want = runKey(size, sel);
  for (const p of placements) {
    if (found[p.word]) continue;
    const last = p.word.length - 1;
    const run = runKey(size, { x0: p.x0, y0: p.y0, x1: p.x0 + p.dx * last, y1: p.y0 + p.dy * last });
    if (run === want) return p.word;
  }
  return null;
}
