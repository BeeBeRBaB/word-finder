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
 * Generate a puzzle. `placements` records where each word actually landed, so a
 * test can assert the grid really contains what the word list claims.
 * @param {{themes:[string,string][], themeIdx:number, rng:Rng, size:number, count:number}} opts
 * @returns {Puzzle}
 */
export function buildPuzzle({ themes, themeIdx, rng, size, count }) {
  const name = themes[themeIdx][0];
  const pool = themes[themeIdx][1].split(',').filter(w => w.length <= size - 1);
  const words = rng.shuffle(pool).slice(0, count).sort((a, b) => b.length - a.length);

  /** @type {(string|null)[][]} */
  const g = Array.from({ length: size }, () => new Array(size).fill(null));
  /** @type {Placement[]} */
  const placements = [];
  for (const w of words) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const [dx, dy] = DIRS[rng.int(8)];
      const span = w.length - 1;
      const xmin = dx < 0 ? span : 0, xmax = dx > 0 ? size - 1 - span : size - 1;
      const ymin = dy < 0 ? span : 0, ymax = dy > 0 ? size - 1 - span : size - 1;
      if (xmax < xmin || ymax < ymin) continue;
      const x0 = xmin + rng.int(xmax - xmin + 1);
      const y0 = ymin + rng.int(ymax - ymin + 1);
      let ok = true;
      for (let i = 0; i < w.length; i++) {
        const c = g[y0 + dy * i][x0 + dx * i];
        if (c && c !== w[i]) { ok = false; break; }
      }
      if (!ok) continue;
      for (let i = 0; i < w.length; i++) g[y0 + dy * i][x0 + dx * i] = w[i];
      placements.push({ word: w, x0, y0, dx, dy });
      break;
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

/** Read the letters under a selection, start to end inclusive.
 * @param {string[]} cells @param {number} size @param {Selection} sel @returns {string} */
export function readLine(cells, size, sel) {
  const dx = Math.sign(sel.x1 - sel.x0), dy = Math.sign(sel.y1 - sel.y0);
  const len = Math.max(Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)) + 1;
  let out = '';
  for (let i = 0; i < len; i++) out += cells[(sel.y0 + dy * i) * size + (sel.x0 + dx * i)];
  return out;
}

/** First unfound word matching the string forwards or backwards.
 * @param {string[]} words @param {Record<string, unknown>} found @param {string} str
 * @returns {string|null} */
export function matchWord(words, found, str) {
  const rev = str.split('').reverse().join('');
  for (const w of words) if (!found[w] && (w === str || w === rev)) return w;
  return null;
}
