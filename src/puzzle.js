// Puzzle generation and hit-detection. Pure: given the same rng and inputs this
// module produces the same puzzle anywhere, with no DOM in sight.

/**
 * @typedef {import('./rng.js').Rng} Rng
 * @typedef {{word:string, x0:number, y0:number, dx:number, dy:number}} Placement
 * @typedef {{name:string, cells:string[], words:string[], placements:Placement[]}} Puzzle
 * @typedef {{x0:number, y0:number, x1:number, y1:number}} Selection
 */

const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
// Every direction, by index into DIRS. Difficulty is carried by word length (layout.js
// MIXES), never by direction: every board uses all eight.
const ALL_DIRS = DIRS.map((_, i) => i);
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Fresh layouts tried as-is, then allowing swaps, before any rule may relax. Real subjects
// never needed more than 7 of the first; only synthetic pools built to defeat it reach the end.
const BOARD_TRIES = 25, SWAP_TRIES = 100;
/** Which of the four lines a direction runs along: a word and its reverse share one.
 * @param {number} d @returns {number} */
const axisOf = (d) => d >> 1;

/**
 * Where a word goes. Least-used directions are tried first, ties in random order: drawing a
 * direction at random and retrying on failure let long words pile into whichever directions
 * still had room — 4.5 of 12 words shared one direction on the average full board. Within
 * the direction, every position the word fits is equally likely, except one that touches a
 * word running along the same line: `halo[axis]` marks every cell within one step of those.
 * Only when nothing fits anywhere under that rule is it dropped, so a word is never lost.
 * @param {(string|null)[][]} g @param {string} w @param {number} size @param {number[]} used
 * @param {Rng} rng @param {Uint8Array[]} halo
 * @returns {{x0:number, y0:number, d:number}|null}
 */
function choosePlacement(g, w, size, used, rng, halo) {
  return placeIn(g, w, size, used, rng, halo, true) ?? placeIn(g, w, size, used, rng, halo, false);
}

/**
 * @typedef {{g:(string|null)[][], placements:Placement[]}} Laid
 * Lay every word on an empty grid. 'strict' keeps every rule and fails the whole layout
 * (null) when a word has no legal spot, so the caller can start over. 'swap' keeps every
 * rule too, but first trades that word for a spare of the same length. 'relaxed' is only
 * reached by a pool outside the content contract: a word may touch a parallel one, and one
 * with no spot at all is swapped, never dropped — dropping made boards one word short.
 * A swap stays made for the layouts that follow, and 'swap' gives up after half the swaps
 * 'relaxed' may make. Both are how the first build with levels dealt, and a level has to deal
 * the same board on every build: either changed re-deals some seeds (tests/unit/puzzle.test.js).
 * @param {string[]} words swapped in place @param {string[]} spare likewise
 * @param {number} size @param {Rng} rng @param {'strict'|'swap'|'relaxed'} mode @param {string} name
 * @returns {Laid|null}
 */
function lay(words, spare, size, rng, mode, name) {
  const strict = mode !== 'relaxed';
  /** @type {(string|null)[][]} */
  const g = Array.from({ length: size }, () => new Array(size).fill(null));
  /** @type {Placement[]} */
  const placements = [];
  let swaps = 0;
  // Words placed so far in each of the eight directions, and per line (axis) the cells
  // within one step of a word on it, which another word on that line may not enter.
  const used = DIRS.map(() => 0);
  const halo = [0, 1, 2, 3].map(() => new Uint8Array(size * size));
  // The even share per direction, the same rule at every board size: 1 for 8 words, 2 for 12.
  const share = Math.ceil(words.length / DIRS.length);
  for (let i = 0; i < words.length; i++) {
    for (;;) {
      const w = words[i];
      const spot = strict
        ? placeIn(g, w, size, used, rng, halo, true, share, words.length - i - 1)
        : choosePlacement(g, w, size, used, rng, halo);
      if (spot) {
        const [dx, dy] = DIRS[spot.d], ring = halo[axisOf(spot.d)];
        for (let j = 0; j < w.length; j++) {
          const x = spot.x0 + dx * j, y = spot.y0 + dy * j;
          g[y][x] = w[j];
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            if (x + ox >= 0 && x + ox < size && y + oy >= 0 && y + oy < size) ring[(y + oy) * size + x + ox] = 1;
          }
        }
        placements.push({ word: w, x0: spot.x0, y0: spot.y0, dx, dy });
        used[spot.d]++;
        break;
      }
      if (mode === 'strict') return null;
      const alt = spare.findIndex(s => s.length === w.length);
      if (alt === -1 || ++swaps > (mode === 'swap' ? MAX_SWAPS / 2 : MAX_SWAPS)) {
        if (mode === 'swap') return null;
        throw new Error(`could not place ${w} in a ${size}x${size} grid for "${name}"`);
      }
      words[i] = spare.splice(alt, 1)[0];
    }
  }
  return { g, placements };
}

/** @param {(string|null)[][]} g @param {string} w @param {number} size @param {number[]} used
 * @param {Rng} rng @param {Uint8Array[]} halo @param {boolean} apart
 * @param {number} [share] strict layouts only: no direction past this many words
 * @param {number} [left] strict layouts only: words still to place after this one. A used
 *   direction is allowed only while enough remain to reach every unused one.
 * @returns {{x0:number, y0:number, d:number}|null} */
function placeIn(g, w, size, used, rng, halo, apart, share = Infinity, left = Infinity) {
  const unused = ALL_DIRS.filter(d => used[d] === 0).length;
  // Stable sort after a shuffle: ties keep their shuffled order.
  const order = rng.shuffle(ALL_DIRS).sort((a, b) => used[a] - used[b]);
  const span = w.length - 1;
  for (const d of order) {
    if (used[d] >= share || (used[d] > 0 && left < unused)) continue;
    const [dx, dy] = DIRS[d];
    const near = halo[axisOf(d)];
    const xmin = dx < 0 ? span : 0, xmax = dx > 0 ? size - 1 - span : size - 1;
    const ymin = dy < 0 ? span : 0, ymax = dy > 0 ? size - 1 - span : size - 1;
    /** @type {{x0:number, y0:number}[]} */
    const fits = [];
    for (let y0 = ymin; y0 <= ymax; y0++) for (let x0 = xmin; x0 <= xmax; x0++) {
      let ok = true;
      for (let j = 0; j < w.length && ok; j++) {
        const x = x0 + dx * j, y = y0 + dy * j, c = g[y][x];
        if ((c && c !== w[j]) || (apart && near[y * size + x])) ok = false;
      }
      if (ok) fits.push({ x0, y0 });
    }
    if (!fits.length) continue;
    const pick = fits[rng.int(fits.length)];
    return { x0: pick.x0, y0: pick.y0, d };
  }
  return null;
}


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

// Each swap re-tries the word against every position, and a board that cannot be filled
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

  // Parallel words never touch, every direction is used, and none takes more than its even
  // share. Fresh layouts first, then fresh layouts that may trade a stuck word for a spare
  // of the same length; only a pool with no spares (outside the content contract) relaxes.
  let laid = null;
  for (let t = 0; t < BOARD_TRIES && !laid; t++) laid = lay(words, spare, size, rng, 'strict', name);
  for (let t = 0; t < SWAP_TRIES && !laid; t++) laid = lay(words, spare, size, rng, 'swap', name);
  const { g, placements } = laid ?? /** @type {Laid} */ (lay(words, spare, size, rng, 'relaxed', name));

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

/** Flat `cells` indices under a selection, start to end inclusive: the cells a found
 * word colours.
 * @param {number} size @param {Selection} sel @returns {number[]} */
export function lineIndices(size, sel) {
  const dx = Math.sign(sel.x1 - sel.x0), dy = Math.sign(sel.y1 - sel.y0);
  const len = Math.max(Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)) + 1;
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < len; i++) out.push((sel.y0 + dy * i) * size + (sel.x0 + dx * i));
  return out;
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
    if (!found[p.word] && runKey(size, spanOf(p)) === want) return p.word;
  }
  return null;
}

/** The selection a placement fills, first letter to last.
 * @param {Placement} p @returns {Selection} */
export function spanOf(p) {
  const last = p.word.length - 1;
  return { x0: p.x0, y0: p.y0, x1: p.x0 + p.dx * last, y1: p.y0 + p.dy * last };
}
