// Word coverage. Pure aside from the store it's handed, like storage.js — but with the
// OPPOSITE validation rule. A board save is all-or-nothing because half a grid is worse
// than a fresh one; this record is merged field by field, because one bad counter must
// never cost a player 600 shuffle bags.
//
// The unit of progress is word coverage, not "solved". A subject's pool holds 40-105 words
// and a puzzle draws 12, so one win covers 27% of an average subject — calling that solved
// would claim 105 words on the evidence of 12. Each subject instead carries a bag of the
// words not yet drawn this cycle; drawing the last one refills it and counts a cycle. That
// is also why there is no "max word usage" threshold to tune: no word can be drawn twice
// until every word has been drawn once.
import { defaultStore } from './storage.js';

export const KEY = 'wordfinder-progress-v1';

/**
 * @typedef {{n:number, c:number, d:string}} Bag
 *   n: the pool length this bag was built for — the drift guard.
 *   c: completed cycles through the whole pool.
 *   d: base64 bitmask of words drawn this cycle, indexed by position in the pool.
 * @typedef {{v:number, puzzles:number, favourLeastSeen:boolean,
 *            bags:Record<string,Bag>, sizes:Record<string,number>}} Progress
 * @typedef {Pick<Storage,'getItem'|'setItem'>} ProgressStore
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** @returns {Progress} */
const empty = () => ({ v: 1, puzzles: 0, favourLeastSeen: true, bags: {}, sizes: {} });

/** @param {unknown} n @returns {n is number} */
const isCount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** @param {unknown} o @returns {o is Record<string, unknown>} */
const isRecord = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

/** Bytes to base64. Hand-rolled because this module runs in the browser, where `Buffer`
 * does not exist and `btoa` would need a binary string built first anyway.
 * @param {Uint8Array} bytes @returns {string} */
function toB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b === undefined ? 0 : b) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c === undefined ? 0 : c) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

/** Base64 to bytes, sized for `bits` regardless of what the string actually held — a
 * truncated or padded value yields a short mask rather than an exception.
 * @param {string} s @param {number} bits @returns {Uint8Array} */
function fromB64(s, bits) {
  const out = new Uint8Array(Math.ceil(bits / 8));
  let acc = 0, n = 0, o = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;                 // '=' padding, and anything unexpected
    acc = (acc << 6) | v; n += 6;
    if (n >= 8) { n -= 8; if (o < out.length) out[o++] = (acc >> n) & 255; }
  }
  return out;
}

/** @param {Uint8Array} b @param {number} i @returns {boolean} */
const getBit = (b, i) => !!(b[i >> 3] & (1 << (i & 7)));

/** @param {Uint8Array} b @param {number} i @returns {void} */
const setBit = (b, i) => { b[i >> 3] |= 1 << (i & 7); };

/** @param {Uint8Array} b @param {number} bits @returns {number} */
function popcount(b, bits) {
  let n = 0;
  for (let i = 0; i < bits; i++) if (getBit(b, i)) n++;
  return n;
}

/** Merge whatever survived the read onto the defaults. Never returns null: there is no
 * "reject the record" outcome, only fields that could not be trusted. A bag whose `n`,
 * `c` or `d` is unusable is dropped on its own, so the other 599 survive it.
 * @param {string|null} raw @returns {Progress} */
export function parseProgress(raw) {
  const out = empty();
  if (!raw) return out;
  /** @type {unknown} */
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return out; }
  if (!isRecord(parsed)) return out;

  if (isCount(parsed.puzzles)) out.puzzles = parsed.puzzles;
  if (typeof parsed.favourLeastSeen === 'boolean') out.favourLeastSeen = parsed.favourLeastSeen;
  if (isRecord(parsed.sizes)) {
    for (const [k, v] of Object.entries(parsed.sizes)) if (isCount(v) && v > 0) out.sizes[k] = v;
  }
  if (isRecord(parsed.bags)) {
    for (const [k, v] of Object.entries(parsed.bags)) {
      if (!isRecord(v)) continue;
      if (!isCount(v.n) || v.n <= 0) continue;
      if (!isCount(v.c)) continue;
      if (typeof v.d !== 'string') continue;
      out.bags[k] = { n: v.n, c: v.c, d: v.d };
    }
  }
  return out;
}

/** The next subject to deal. With `favourLeastSeen`, draws among those tied for the LOWEST
 * coverage; otherwise draws from the whole list. `current` is dropped last, and only if
 * something else remains — so a fully-covered category still avoids dealing the same
 * subject twice running.
 *
 * There is deliberately no exhaustion case. A minimum always exists, so unlike a binary
 * "skip what you have already solved" filter this can never empty the pool and dead-end.
 * @param {string[]} subjectIds @param {Map<string,number>} seen @param {string|null} current
 * @param {boolean} favourLeastSeen @param {() => number} rand @returns {string} */
export function chooseSubject(subjectIds, seen, current, favourLeastSeen, rand) {
  let pool = subjectIds;
  if (favourLeastSeen) {
    let lowest = Infinity;
    for (const id of pool) lowest = Math.min(lowest, seen.get(id) ?? 0);
    pool = pool.filter(id => (seen.get(id) ?? 0) === lowest);
  }
  const fresh = pool.filter(id => id !== current);
  if (fresh.length) pool = fresh;
  return pool[Math.floor(rand() * pool.length)];
}

/** @param {ProgressStore|null} [store] */
export function makeProgress(store) {
  if (store === undefined) store = defaultStore();

  let data = empty();
  // Merely reading localStorage throws on Safari with "Block All Cookies" — see
  // storage.js's defaultStore — so the read is guarded, not just the parse.
  try { data = parseProgress(store ? store.getItem(KEY) : null); } catch { data = empty(); }

  /** @returns {void} */
  const flush = () => {
    if (!store) return;
    try { store.setItem(KEY, JSON.stringify(data)); } catch { /* not remembered */ }
  };

  /** The bag for a subject, discarding it when the pool length has changed since it was
   * written. That guard catches an inserted or deleted word; a same-length substitution
   * is accepted as one cycle of slightly-off distribution, which self-corrects at the
   * next refill and is not worth a per-subject digest.
   * @param {string} id @param {number} n @returns {Bag} */
  function bagOf(id, n) {
    const b = data.bags[id];
    if (!b || b.n !== n) data.bags[id] = { n, c: 0, d: '' };
    return data.bags[id];
  }

  return {
    /** @returns {Progress} */
    get: () => ({
      ...data,
      bags: Object.fromEntries(Object.entries(data.bags).map(([k, v]) => [k, { ...v }])),
      sizes: { ...data.sizes },
    }),

    /** Words not yet drawn this cycle; the whole pool when there is no usable bag.
     * @param {string} id @param {string[]} pool @returns {Set<string>} */
    bagFor(id, pool) {
      const b = bagOf(id, pool.length);
      const bits = fromB64(b.d, pool.length);
      return new Set(pool.filter((_, i) => !getBit(bits, i)));
    },

    /** Mark words drawn. When that empties the bag, the cycle count rises and it refills.
     * @param {string} id @param {string[]} pool @param {string[]} words @returns {void} */
    noteDraw(id, pool, words) {
      const b = bagOf(id, pool.length);
      const bits = fromB64(b.d, pool.length);
      for (const w of words) {
        const i = pool.indexOf(w);
        if (i >= 0) setBit(bits, i);
      }
      if (popcount(bits, pool.length) >= pool.length) { b.c += 1; b.d = ''; }
      else b.d = toB64(bits);
      flush();
    },

    /** @returns {void} */
    addSolve() { data.puzzles += 1; flush(); },

    /** @param {string} catId @param {number} n @returns {void} */
    noteSize(catId, n) { if (isCount(n) && n > 0) { data.sizes[catId] = n; flush(); } },

    /** 0..1 within the current cycle; 1 once a full cycle has completed.
     * @param {string} id @returns {number} */
    coverage(id) {
      const b = data.bags[id];
      if (!b) return 0;
      if (b.c > 0) return 1;
      return popcount(fromB64(b.d, b.n), b.n) / b.n;
    },

    /** @param {boolean} on @returns {void} */
    setFavourLeastSeen(on) { data.favourLeastSeen = !!on; flush(); },

    /** Every subject in the category through at least one full cycle. False when the
     * category's size is unknown — never guess a completion the record cannot support.
     * @param {string} catId @param {string[]} subjectIds @returns {boolean} */
    isComplete(catId, subjectIds) {
      const n = data.sizes[catId];
      if (!n || subjectIds.length < n) return false;
      return subjectIds.every(id => (data.bags[id]?.c ?? 0) > 0);
    },
  };
}
