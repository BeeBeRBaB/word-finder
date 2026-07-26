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

/**
 * Draw `count` words, spread across the length buckets in `mix`. A pool of 100+
 * words would otherwise deal twelve nine-letter words as readily as twelve
 * four-letter ones, and neither makes a good board.
 *
 * A bucket short of candidates does not shrink the board: the shortfall is backfilled
 * from what is left, nearest length first. Backfilling rather than throwing matters
 * because the scarce bucket is always the short words, and a subject with only two
 * three-letter words is still worth playing.
 *
 * @param {string[]} pool @param {import('./rng.js').Rng} rng
 * @param {{count:number, mix:Bucket[]}} opts
 * @returns {string[]}
 */
export function pickWords(pool, rng, { count, mix }) {
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
    const cands = rng.shuffle(eligible.filter(w => !used.has(w) && distanceTo(w.length, b) === 0));
    for (const w of cands.slice(0, b.take)) { used.add(w); out.push(w); }
    if (cands.length < b.take) unfilled.push(b);
  }
  if (out.length < count) {
    // Nearest-length first, so a missing long word is replaced by the longest thing
    // left rather than by whatever the shuffle happened to surface. Shuffle before
    // sorting so ties inside one distance are still random; Array#sort is stable in
    // every engine this ships to, so the shuffled order survives the tie.
    const rest = rng.shuffle(eligible.filter(w => !used.has(w)))
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
 * Generate a puzzle from a resolved word pool. `placements` records where each word
 * actually landed, so a test can assert the grid really contains what the word list
 * claims.
 *
 * Knows nothing about categories, subjects or the catalog — it is handed a name and a
 * bag of words, which is what lets the placement logic be tested against a synthetic
 * pool with no content module loaded.
 *
 * @param {{name:string, pool:string[], rng:Rng, size:number, count:number, mix:Bucket[]}} opts
 * @returns {Puzzle}
 */
export function buildPuzzle({ name, pool, rng, size, count, mix }) {
  const fits = pool.filter(w => w.length <= size - 1);
  const chosen = pickWords(fits, rng, { count, mix });
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
      // A word that will not fit is swapped for another of the same length rather
      // than dropped. Dropping is what the old generator did, and it produced boards
      // that were quietly one word short with nothing anywhere saying so.
      if (placed) break;   // `while (!placed)` would catch it, but this skips the swap below
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
 * Snap a free pointer offset to the nearest of 8 directions and a whole number of
 * cells. Length is the PROJECTION of the offset onto the snapped direction: using
 * raw Euclidean distance overshoots, because a k-cell diagonal spans k*sqrt(2).
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

/** Flat `cells` indices under a selection, start to end inclusive. Reading the
 * letters and colouring the found ones both walk a selection the same way, so the
 * stepping lives here once rather than being re-derived per caller.
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

/** First unfound word matching the string forwards or backwards.
 * @param {string[]} words @param {Record<string, unknown>} found @param {string} str
 * @returns {string|null} */
export function matchWord(words, found, str) {
  const rev = str.split('').reverse().join('');
  for (const w of words) if (!found[w] && (w === str || w === rev)) return w;
  return null;
}
