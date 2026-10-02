// Levels mode's bookkeeping: which level to deal, what happened while it was played, and
// banking the result on this device and in the cloud. No DOM; main.js renders what it returns.
import {
  newProgress, levelSeed, levelCategory, levelSubject, recordLevel, saveCurrent, mergeProgress, makeLevelStore,
} from './levels.js';
import { scoreLevel } from './scoring.js';
import { buildPuzzle } from './puzzle.js';
import { makeRng } from './rng.js';
import { mixFor } from './layout.js';
import { defaultStore } from './storage.js';

// Whose progress the local copy is, so a second account on this device never inherits it.
export const OWNER_KEY = 'wordfinder-levels-owner-v1';

/**
 * @typedef {import('./levels.js').LevelProgress} LevelProgress
 * @typedef {import('./levels.js').LevelEvent} LevelEvent
 * @typedef {import('./levels.js').Difficulty} Difficulty
 * @typedef {import('./levels.js').LevelStore} LevelStore
 * @typedef {import('./cloud.js').Account} Account
 * @typedef {import('./cloud.js').CloudCode} CloudCode
 * @typedef {{enabled:boolean, session():Account|null, signIn(u:string, p:string):Promise<Account>,
 *   signUp(u:string, p:string):Promise<Account>, signOut():void, load():Promise<unknown>,
 *   save(data:unknown):Promise<void>}} CloudLike
 * @typedef {{level:number, subject:string, seed:number, difficulty:Difficulty}} Deal
 *   seed: the puzzle seed. Build the board from it with the difficulty's mix and no coverage bag.
 * @typedef {{subjectIds:string[]}} CategoryLike
 * @typedef {{breakdown:import('./scoring.js').Breakdown, banked:boolean, progress:LevelProgress}} Finish
 *   banked: false when the cloud had already moved this account past the level.
 * @typedef {{signedIn:boolean, username:string|null, level:number, points:number,
 *   pending:boolean, error:CloudCode|null}} Status
 */

/** A level's board: the same on every device with this board size, at the level's own
 * difficulty and with no coverage bag, so it never depends on what this device has seen.
 * @param {Deal} deal @param {{name:string, words:string[]}} subject
 * @param {import('./layout.js').Preset} shape @returns {import('./puzzle.js').Puzzle} */
export function levelPuzzle(deal, subject, shape) {
  return buildPuzzle({ name: subject.name, pool: subject.words, rng: makeRng(deal.seed), size: shape.size,
    count: shape.count, mix: mixFor(shape, deal.difficulty) });
}

/** Where each recorded word lies on the board, in the order found, to put a resumed level's
 * finds back. A word the board does not hold is skipped.
 * @param {{placements:{word:string, x0:number, y0:number, dx:number, dy:number}[]}} puzzle
 * @param {LevelEvent[]} events @returns {{word:string, sel:{x0:number, y0:number, x1:number, y1:number}}[]} */
export function replaySelections(puzzle, events) {
  /** @type {{word:string, sel:{x0:number, y0:number, x1:number, y1:number}}[]} */
  const out = [];
  for (const e of events) {
    const p = puzzle.placements.find(q => q.word === e.word);
    if (!p || out.some(o => o.word === e.word)) continue;
    const n = p.word.length - 1;
    out.push({ word: e.word, sel: { x0: p.x0, y0: p.y0, x1: p.x0 + p.dx * n, y1: p.y0 + p.dy * n } });
  }
  return out;
}

/** @param {unknown} e @returns {CloudCode} */
const codeOf = (e) => {
  const c = e && typeof e === 'object' && 'code' in e ? e.code : null;
  return typeof c === 'string' ? /** @type {CloudCode} */ (c) : 'server';
};

/** @param {{cloud:CloudLike, store?:LevelStore|null, now?:() => number, clock?:() => number,
 *   random?:() => number}} deps  clock: a monotonic ms clock for play time. */
export function makeLevelPlay(deps) {
  const { cloud } = deps;
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const now = deps.now ?? Date.now;
  const clock = deps.clock ?? (() => performance.now());
  const random = deps.random ?? Math.random;
  const local = makeLevelStore({ store });

  /** @type {LevelProgress|null} */
  let prog = null;
  /** @type {{deal:Deal, words:Set<string>, events:LevelEvent[], base:number, since:number|null}|null} */
  let live = null;
  // Bumped on every change of account, so a load or save that lands afterwards is dropped.
  let gen = 0;
  let dirty = false;
  /** @type {CloudCode|null} */
  let error = null;
  /** @type {Promise<void>|null} */
  let saving = null;
  let again = false;

  /** @returns {string|null} */
  const owner = () => { try { return store ? store.getItem(OWNER_KEY) : null; } catch { return null; } };

  /** @param {string} uid @returns {void} */
  function adopt(uid) {
    gen++;
    live = null;
    // A save still in flight is the last account's: the next one must not wait on it.
    saving = null;
    dirty = again = false;
    error = null;
    if (owner() !== uid) local.clear();
    try { if (store) store.setItem(OWNER_KEY, uid); } catch { /* not remembered */ }
    prog = local.load();
  }

  /** @param {LevelProgress} p @returns {void} */
  function keep(p) {
    prog = p;
    local.save(p);
  }

  /** @returns {number} */
  const elapsed = () => (live ? live.base + (live.since === null ? 0 : clock() - live.since) : 0);

  /** The in-progress level as levels.js stores it. @returns {void} */
  function remember() {
    if (!live || !prog) return;
    const { level, subject, difficulty } = live.deal;
    keep(saveCurrent(prog, { level, subject, difficulty, events: live.events.map(e => ({ ...e })), elapsedMs: Math.round(elapsed()) }));
  }

  /** Save to the cloud, one request at a time; a save asked for meanwhile runs after it.
   * @returns {Promise<void>} */
  function push() {
    if (!cloud.session() || !prog) return Promise.resolve();
    dirty = true;
    if (saving) { again = true; return saving; }
    const g = gen;
    saving = (async () => {
      do {
        again = false;
        /** @type {LevelProgress|null} */
        const sent = prog;
        try {
          await cloud.save(sent);
          if (g !== gen) return;
          error = null;
          if (prog === sent && !again) dirty = false;
        } catch (e) {
          if (g !== gen) return;
          error = codeOf(e);
          return;
        }
      } while (again && g === gen);
    })().finally(() => { if (g === gen) saving = null; });
    return saving;
  }

  /** Bring the local copy and the cloud's together, keeping whichever is further on.
   * @returns {Promise<void>} */
  async function sync() {
    if (!cloud.session()) return;
    const g = gen;
    let remote;
    try { remote = await cloud.load(); } catch (e) {
      if (g === gen) error = codeOf(e);
      return;
    }
    if (g !== gen) return;
    error = null;
    const merged = mergeProgress(prog, remote) ?? newProgress((random() * 0x100000000) >>> 0);
    // The level being played is the cloud's no longer: deal whatever level it says.
    if (live && merged.level !== live.deal.level) live = null;
    keep(merged);
    if (JSON.stringify(merged) !== JSON.stringify(mergeProgress(null, remote))) await push();
  }

  return {
    enabled: cloud.enabled,

    /** @returns {Account|null} */
    account: () => cloud.session(),

    /** The signed-in player's progress, or null when nobody is signed in. @returns {LevelProgress|null} */
    progress: () => (cloud.session() ? prog : null),

    /** @returns {Status} */
    status() {
      const a = cloud.session();
      return { signedIn: !!a, username: a ? a.username : null, level: a && prog ? prog.level : 0,
        points: a && prog ? prog.points : 0, pending: dirty, error };
    },

    /** Pick up a session this device already has. @returns {Promise<void>} */
    async boot() {
      const a = cloud.session();
      if (!a) return;
      adopt(a.uid);
      await sync();
    },

    /** @param {string} username @param {string} password @returns {Promise<Account>} */
    async signIn(username, password) {
      const a = await cloud.signIn(username, password);
      adopt(a.uid);
      await sync();
      return a;
    },

    /** @param {string} username @param {string} password @returns {Promise<Account>} */
    async signUp(username, password) {
      const a = await cloud.signUp(username, password);
      adopt(a.uid);
      await sync();
      return a;
    },

    /** Forget the account and its local copy. @returns {void} */
    signOut() {
      gen++;
      cloud.signOut();
      local.clear();
      try { if (store) store.removeItem(OWNER_KEY); } catch { /* nothing to forget */ }
      prog = live = null;
      dirty = again = false;
      saving = null;
      error = null;
    },

    sync,

    /** What to deal next. Resumes an unfinished level by its saved subject, since a device on
     * an older catalog would compute a different one. Null when signed out, or when the
     * account changed while the category loaded.
     * @param {string[]} categoryIds @param {(id:string) => Promise<CategoryLike>} loadCategory
     * @param {Difficulty} difficulty for a level not yet started @returns {Promise<Deal|null>} */
    async deal(categoryIds, loadCategory, difficulty) {
      if (!cloud.session() || !prog) return null;
      const p = prog, g = gen;
      const seed = levelSeed(p.seed, p.level);
      if (p.current) return { level: p.level, subject: p.current.subject, seed, difficulty: p.current.difficulty };
      const category = levelCategory(p.seed, p.level, categoryIds);
      const cat = await loadCategory(category);
      if (g !== gen || prog !== p) return null;
      return { level: p.level, subject: levelSubject(p.seed, p.level, category, cat.subjectIds, categoryIds.length), seed, difficulty };
    },

    /** The saved board is the level in progress when its subject and seed are that level's:
     * returns its deal, to start() once the board is back. @param {string} subjectId
     * @param {number} seed @returns {Deal|null} */
    resumable(subjectId, seed) {
      const p = cloud.session() ? prog : null;
      if (!p || !p.current || p.current.subject !== subjectId || levelSeed(p.seed, p.level) !== seed) return null;
      return { level: p.level, subject: subjectId, seed, difficulty: p.current.difficulty };
    },

    /** The deal being played and timed, or null. @returns {Deal|null} */
    playing: () => (live ? live.deal : null),

    /** Start timing a dealt level. Returns the finds to put back when it resumes one, in order;
     * a saved level whose words are not all on this board (another device's board size) starts over.
     * @param {Deal} deal @param {string[]} words the board's words @returns {LevelEvent[]} */
    start(deal, words) {
      if (!prog || deal.level !== prog.level) { live = null; return []; }
      const set = new Set(words);
      const c = prog.current;
      const resume = !!c && c.subject === deal.subject && c.difficulty === deal.difficulty
        && c.events.every(e => set.has(e.word)) && new Set(c.events.map(e => e.word)).size === c.events.length;
      live = { deal, words: set, events: resume && c ? c.events.map(e => ({ ...e })) : [], base: resume && c ? c.elapsedMs : 0, since: clock() };
      remember();
      return live.events.map(e => ({ ...e }));
    },

    /** Active play time of the level, in ms. */
    elapsed,

    /** The page is hidden: stop the clock and save, so another device can carry on. @returns {void} */
    pause() {
      if (!live || live.since === null) return;
      live.base = elapsed();
      live.since = null;
      remember();
      void push();
    },

    /** @returns {void} */
    resume() { if (live && live.since === null) live.since = clock(); },

    /** Record a find or a reveal. False for a word not on the board or already recorded.
     * @param {string} word @param {boolean} revealed @returns {boolean} */
    note(word, revealed) {
      if (!live || !live.words.has(word) || live.events.some(e => e.word === word)) return false;
      live.events.push({ word, at: Math.round(elapsed()), revealed });
      remember();
      return true;
    },

    /** Score and bank the level once every word is found or revealed; null before that.
     * @returns {Finish|null} */
    finish() {
      if (!live || !prog || live.events.length !== live.words.size) return null;
      const { deal, events, words } = live;
      const ms = Math.round(elapsed());
      const breakdown = scoreLevel({ events, elapsedMs: ms, difficulty: deal.difficulty, wordCount: words.size });
      const next = recordLevel(prog, { level: deal.level, subject: deal.subject, difficulty: deal.difficulty,
        score: breakdown.total, ms, reveals: breakdown.stats.revealed, at: now() });
      live = null;
      if (next === prog) return { breakdown, banked: false, progress: prog };
      keep(next);
      void push();
      return { breakdown, banked: true, progress: next };
    },
  };
}
