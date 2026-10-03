// Level mode: an account plays levels 1, 2, 3, ... forever. Pure — the store is injected.
// Level n's category, subject and puzzle seed are a function of (account seed, n) and the
// catalog, so every device deals the same level. Changing a hash here, or adding a category
// or subject, re-deals every account's unplayed levels.
import { makeRng, fnv1a } from './rng.js';
import { defaultStore } from './storage.js';
import { DIFFICULTY_NAMES } from './scoring.js';

export const LEVELS_KEY = 'wordfinder-levels-v1';
export const HISTORY_MAX = 50;

/**
 * @typedef {'easy'|'normal'|'hard'} Difficulty
 * @typedef {{level:number, subject:string, difficulty:Difficulty, score:number, ms:number,
 *   reveals:number, at:number}} LevelResult
 * @typedef {{word:string, at:number, revealed:boolean}} LevelEvent
 * @typedef {{level:number, subject:string, difficulty:Difficulty, events:LevelEvent[],
 *   elapsedMs:number}} LevelCurrent  An unfinished level, so another device can resume it.
 * @typedef {{v:1, seed:number, level:number, points:number, history:LevelResult[],
 *   current:LevelCurrent|null}} LevelProgress  `level` is the next one to play (>= 1).
 * @typedef {Pick<Storage,'getItem'|'setItem'|'removeItem'>} LevelStore
 */

// Distinct salts keep the puzzle, category and subject streams uncorrelated.
const SALT_PUZZLE = 0x2545f491, SALT_CATEGORY = 0x6c8e9cf5, SALT_SUBJECT = 0x3c6ef372;

/** murmur3's 32-bit finalizer: a bijection on uint32 with full avalanche.
 * @param {number} h @returns {number} */
function fmix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Fold integers into a uint32. Each step is a bijection in its part, so two values of the
 * last part that differ mod 2^32 never collide.
 * @param {...number} parts @returns {number} */
function hash(...parts) {
  let h = 0;
  for (const p of parts) h = fmix32(((h ^ p) + 0x9e3779b9) | 0);
  return h;
}

/** @param {unknown} n @returns {n is number} */
const isInt = (n) => Number.isInteger(n);
/** @param {unknown} n @returns {n is number} */
const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
/** @param {unknown} n @returns {n is number} */
const isTime = (n) => isFiniteNum(n) && n >= 0;
/** @param {unknown} n @returns {n is number} */
const isLevel = (n) => isInt(n) && n >= 1;
/** @param {unknown} s @returns {s is string} */
const isText = (s) => typeof s === 'string' && s.length > 0;
/** @param {unknown} d @returns {d is Difficulty} */
const isDifficulty = (d) => typeof d === 'string' && Object.keys(DIFFICULTY_NAMES).includes(d);
/** @param {unknown} o @returns {o is Record<string, unknown>} */
const isRecord = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

/** @param {number} level @returns {void} */
function checkLevel(level) {
  if (!isLevel(level)) throw new RangeError(`level must be an integer >= 1, got ${level}`);
}

/** @param {string[]} ids @param {string} what @returns {number} */
function checkList(ids, what) {
  if (!Array.isArray(ids) || ids.length === 0) throw new RangeError(`${what} must be a non-empty list`);
  return ids.length;
}

/** @param {number} seed @returns {LevelProgress} */
export function newProgress(seed) {
  return { v: 1, seed: seed >>> 0, level: 1, points: 0, history: [], current: null };
}

/** @param {unknown} r @returns {LevelResult|null} */
function toResult(r) {
  if (!isRecord(r)) return null;
  const { level, subject, difficulty, score, ms, reveals, at } = r;
  if (!isLevel(level) || !isText(subject) || !isDifficulty(difficulty) || !isFiniteNum(score)
    || !isTime(ms) || !isInt(reveals) || reveals < 0 || !isTime(at)) return null;
  return { level, subject, difficulty, score, ms, reveals, at };
}

/** All or nothing: one bad event voids the whole in-progress level.
 * @param {unknown} c @returns {LevelCurrent|null} */
function toCurrent(c) {
  if (!isRecord(c)) return null;
  const { level, subject, difficulty, events, elapsedMs } = c;
  if (!isLevel(level) || !isText(subject) || !isDifficulty(difficulty) || !isTime(elapsedMs)
    || !Array.isArray(events)) return null;
  /** @type {LevelEvent[]} */
  const out = [];
  for (const e of events) {
    if (!isRecord(e) || !isText(e.word) || !isTime(e.at) || typeof e.revealed !== 'boolean') return null;
    out.push({ word: e.word, at: e.at, revealed: e.revealed });
  }
  return { level, subject, difficulty, events: out, elapsedMs };
}

/** A fresh, trusted copy, or null without a v:1 record and a uint32 seed. Otherwise lenient:
 * bad history entries are dropped singly, a bad or stale `current` is dropped, and level and
 * points are clamped to integers (>= 1, >= 0).
 * @param {unknown} raw @returns {LevelProgress|null} */
export function normalizeProgress(raw) {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const { seed } = raw;
  if (!isInt(seed) || seed < 0 || seed > 0xffffffff) return null;
  const level = isFiniteNum(raw.level) ? Math.max(1, Math.floor(raw.level)) : 1;
  const points = isFiniteNum(raw.points) ? Math.max(0, Math.floor(raw.points)) : 0;
  /** @type {LevelResult[]} */
  const history = [];
  if (Array.isArray(raw.history)) {
    for (const h of raw.history) { const r = toResult(h); if (r) history.push(r); }
  }
  const current = toCurrent(raw.current);
  return {
    v: 1, seed, level, points, history: history.slice(-HISTORY_MAX),
    current: current && current.level === level ? current : null,
  };
}

/** The puzzle seed for a level: a bijection in `level`, so no two levels < 2^32 share one.
 * @param {number} accountSeed @param {number} level @returns {number} */
export function levelSeed(accountSeed, level) {
  return hash(SALT_PUZZLE, accountSeed, level);
}

/** @param {number} seed @param {number} cycle @param {string[]} sorted @returns {string[]} */
const rawCycle = (seed, cycle, sorted) => makeRng(hash(SALT_CATEGORY, seed, cycle)).shuffle(sorted);

/** One cycle's category order, never opening on the previous cycle's last. Swapping slots 0
 * and 1 leaves the last slot alone, so the previous cycle's last is its raw shuffle's.
 * @param {number} seed @param {number} cycle @param {string[]} sorted @returns {string[]} */
function cycleOrder(seed, cycle, sorted) {
  const n = sorted.length;
  // With two categories, cycle 0's order is the only one that never repeats back to back.
  if (n === 2) return rawCycle(seed, 0, sorted);
  const order = rawCycle(seed, cycle, sorted);
  if (n > 2 && cycle > 0 && order[0] === rawCycle(seed, cycle - 1, sorted)[n - 1]) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

/** Level n's category: every one of the (distinct) ids once per cycle of ids.length levels, in
 * a seeded order per cycle. Sorted first, so the catalog's listing order does not matter.
 * @param {number} accountSeed @param {number} level @param {string[]} categoryIds @returns {string} */
export function levelCategory(accountSeed, level, categoryIds) {
  checkLevel(level);
  const n = checkList(categoryIds, 'categoryIds');
  const i = level - 1;
  return cycleOrder(accountSeed, Math.floor(i / n), [...categoryIds].sort())[i % n];
}

/** Level n's subject, once its category module has loaded. `categoryCount` is the length of
 * the list given to levelCategory: it says how many times this category came up before, and
 * is a parameter so this module never imports the catalog. No subject repeats until every
 * subject in the category has been dealt.
 * @param {number} accountSeed @param {number} level @param {string} categoryId
 * @param {string[]} subjectIds @param {number} categoryCount @returns {string} */
export function levelSubject(accountSeed, level, categoryId, subjectIds, categoryCount) {
  checkLevel(level);
  const m = checkList(subjectIds, 'subjectIds');
  if (!isLevel(categoryCount)) throw new RangeError(`categoryCount must be an integer >= 1, got ${categoryCount}`);
  const visit = Math.floor((level - 1) / categoryCount);
  const round = Math.floor(visit / m);
  const rng = makeRng(hash(SALT_SUBJECT, accountSeed, fnv1a(categoryId), round));
  return rng.shuffle([...subjectIds].sort())[visit % m];
}

/** Bank a finished level. A result for any level but the current one (stale, duplicate or
 * malformed) returns `progress` itself. Never mutates its input.
 * @param {LevelProgress} progress @param {LevelResult} result @returns {LevelProgress} */
export function recordLevel(progress, result) {
  const r = toResult(result);
  if (!r || r.level !== progress.level) return progress;
  return {
    ...progress,
    level: progress.level + 1,
    points: Math.max(0, Math.floor(progress.points + r.score)),
    history: [...progress.history, r].slice(-HISTORY_MAX),
    current: null,
  };
}

/** Keep the in-progress level; one for another level, or malformed, returns `progress` itself.
 * @param {LevelProgress} progress @param {LevelCurrent} current @returns {LevelProgress} */
export function saveCurrent(progress, current) {
  const c = toCurrent(current);
  if (!c || c.level !== progress.level) return progress;
  return { ...progress, current: c };
}

/** @param {LevelProgress} p @returns {number} */
const eventCount = (p) => (p.current ? p.current.events.length : 0);

/** Pick one whole record, never splice two. Different seeds: remote, since the account's seed
 * is authoritative. Same seed: higher level, then points, then events in `current`, then remote.
 * Both sides are normalized, so garbage counts as null; null only when both are.
 * @param {unknown} local @param {unknown} remote @returns {LevelProgress|null} */
export function mergeProgress(local, remote) {
  const l = normalizeProgress(local), r = normalizeProgress(remote);
  if (!l || !r) return r ?? l;
  if (l.seed !== r.seed) return r;
  const lead = l.level - r.level || l.points - r.points || eventCount(l) - eventCount(r);
  return lead > 0 ? l : r;
}

/** The local copy of a signed-in player's progress. A missing, throwing or garbled store
 * degrades to null and never throws into the game.
 * @param {{store?:LevelStore|null}} [deps] */
export function makeLevelStore(deps = {}) {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  return {
    /** @returns {LevelProgress|null} */
    load() {
      try {
        const raw = store ? store.getItem(LEVELS_KEY) : null;
        return raw ? normalizeProgress(JSON.parse(raw)) : null;
      } catch { return null; }
    },
    /** An invalid record is not written. @param {LevelProgress} p @returns {void} */
    save(p) {
      const n = normalizeProgress(p);
      if (!store || !n) return;
      try { store.setItem(LEVELS_KEY, JSON.stringify(n)); } catch { /* not remembered */ }
    },
    /** @returns {void} */
    clear() {
      try { if (store) store.removeItem(LEVELS_KEY); } catch { /* nothing to forget */ }
    },
  };
}
