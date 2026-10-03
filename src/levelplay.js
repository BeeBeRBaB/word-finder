// Levels mode's bookkeeping: which level to deal, what happened while it was played, and
// banking the result on this device and in the cloud. No DOM; main.js renders what it returns.
import {
  newProgress, normalizeProgress, levelSeed, levelCategory, levelSubject, recordLevel, saveCurrent, mergeProgress, makeLevelStore,
} from './levels.js';
import { scoreLevel } from './scoring.js';
import { buildPuzzle, spanOf } from './puzzle.js';
import { makeRng } from './rng.js';
import { mixFor } from './layout.js';
import { safeStore } from './storage.js';

// Whose progress the local copy is, so a second account on this device never inherits it.
export const OWNER_KEY = 'wordfinder-levels-owner-v1';

/**
 * @typedef {import('./levels.js').LevelProgress} LevelProgress
 * @typedef {import('./levels.js').LevelEvent} LevelEvent
 * @typedef {import('./levels.js').LevelCurrent} LevelCurrent
 * @typedef {import('./levels.js').Difficulty} Difficulty
 * @typedef {import('./levels.js').LevelStore} LevelStore
 * @typedef {import('./cloud.js').Account} Account
 * @typedef {import('./cloud.js').CloudCode} CloudCode
 * @typedef {{enabled:boolean, session():Account|null, signIn(u:string, p:string):Promise<Account>,
 *   signUp(u:string, p:string):Promise<Account>, signOut():void, load():Promise<unknown>,
 *   save(data:unknown):Promise<void>}} CloudLike
 * @typedef {{level:number, subject:string, seed:number, difficulty:Difficulty, size?:number}} Deal
 *   seed: the puzzle seed. Build the board from it with the difficulty's mix and no coverage bag.
 *   size: the board a level already started was played on, to deal it there again.
 * @typedef {{subjectIds:string[]}} CategoryLike
 * @typedef {{breakdown:import('./scoring.js').Breakdown, progress:LevelProgress, saved:Promise<void>}} Finish
 *   saved: settles when the save it starts has landed or failed, which status() then tells.
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
 * @param {{word:string}[]} events @returns {{word:string, sel:{x0:number, y0:number, x1:number, y1:number}}[]} */
export function replaySelections(puzzle, events) {
  /** @type {{word:string, sel:{x0:number, y0:number, x1:number, y1:number}}[]} */
  const out = [];
  for (const e of events) {
    const p = puzzle.placements.find(q => q.word === e.word);
    if (!p || out.some(o => o.word === e.word)) continue;
    out.push({ word: e.word, sel: spanOf(p) });
  }
  return out;
}

/** Whether `deal` is a level of `p`'s run: a run another device began, with its own seed, can
 * replace it. @param {LevelProgress} p @param {Deal} deal @returns {boolean} */
const ofRun = (p, deal) => levelSeed(p.seed, deal.level) === deal.seed;

/** Whether a saved level was played on a board `size` wide, as far as it says: builds before
 * the size was kept left it out. @param {LevelCurrent|null} c @param {number} size @returns {boolean} */
const onBoard = (c, size) => (c?.size ?? size) === size;

/** Whether a saved level is the game of `deal` on a board `size` wide, as far as it says.
 * @param {LevelCurrent} c @param {Deal} deal @param {number} size @returns {boolean} */
const sameGame = (c, deal, size) => c.subject === deal.subject && c.difficulty === deal.difficulty && onBoard(c, size);

/** Whether a saved level was played on a board smaller than `size`: mergeProgress ranks that game
 * of the level first, since every device can deal it, so it has won the level from this board's.
 * @param {LevelCurrent|null} c @param {number} size @returns {boolean} */
const beaten = (c, size) => (c?.size ?? size) < size;

/** What went wrong, from a thrown cloud error; 'server' for anything else.
 * @param {unknown} e @returns {CloudCode} */
export const codeOf = (e) => {
  const c = e && typeof e === 'object' && 'code' in e ? e.code : null;
  return typeof c === 'string' ? /** @type {CloudCode} */ (c) : 'server';
};

/** @param {{cloud:CloudLike, store?:LevelStore|null, now?:() => number, clock?:() => number,
 *   random?:() => number}} deps  clock: a monotonic ms clock for play time. */
export function makeLevelPlay(deps) {
  const { cloud } = deps;
  const kv = safeStore(deps.store);
  const now = deps.now ?? Date.now;
  const clock = deps.clock ?? (() => performance.now());
  const random = deps.random ?? Math.random;
  const local = makeLevelStore({ store: deps.store });

  /** @type {LevelProgress|null} */
  let prog = null;
  /** @type {{deal:Deal, words:Set<string>, size:number, events:LevelEvent[], base:number, since:number|null}|null} */
  let live = null;
  // Bumped on every change of account, so a load or save that lands afterwards is dropped.
  let gen = 0;
  let dirty = false;
  /** @type {CloudCode|null} */
  let error = null;
  /** @type {Promise<void>|null} */
  let saving = null;
  let again = false;

  /** @param {string} uid @returns {void} */
  function adopt(uid) {
    gen++;
    live = null;
    // A save still in flight is the last account's: the next one must not wait on it.
    saving = null;
    dirty = again = false;
    error = null;
    if (kv.get(OWNER_KEY) !== uid) local.clear();
    kv.set(OWNER_KEY, uid);
    prog = local.load();
  }

  /** @param {LevelProgress} p @returns {void} */
  function keep(p) {
    prog = p;
    local.save(p);
  }

  /** The signed-in player's progress. Null once the session lapses, though this device keeps
   * its copy for the same account signing in again. @returns {LevelProgress|null} */
  const progress = () => (cloud.session() ? prog : null);

  /** @returns {number} */
  const elapsed = () => (live ? live.base + (live.since === null ? 0 : clock() - live.since) : 0);

  /** Record finds and reveals at one instant of active play, skipping a word not on the board or
   * already recorded, and save once. @param {{word:string, revealed:boolean}[]} finds
   * @returns {boolean} whether any was recorded */
  function record(finds) {
    const l = live;
    if (!l) return false;
    const at = Math.round(elapsed()), n = l.events.length;
    for (const { word, revealed } of finds) {
      if (l.words.has(word) && !l.events.some(e => e.word === word)) l.events.push({ word, at, revealed });
    }
    if (l.events.length === n) return false;
    remember();
    // Not online until the next save: Sign out warns, and opening Settings tries again.
    if (cloud.session()) dirty = true;
    return true;
  }

  /** The in-progress level as levels.js stores it. @returns {void} */
  function remember() {
    if (!live || !prog) return;
    const { level, subject, difficulty } = live.deal;
    keep(saveCurrent(prog, { level, subject, difficulty, size: live.size, events: live.events.map(e => ({ ...e })), elapsedMs: Math.round(elapsed()) }));
  }

  /** Fold the cloud's copy into this device's: whichever is further on wins, and while a level
   * is being played, another device's finds on that same level and board join this one's, with
   * the longer of the two clocks. @param {unknown} remote @returns {boolean} whether the cloud needs the result */
  function take(remote) {
    const r = normalizeProgress(remote);
    const merged = mergeProgress(prog, r) ?? newProgress((random() * 0x100000000) >>> 0);
    // The level being played is the cloud's no longer: it moved on, another device's run with its
    // own seed won, or another device's game of it on a smaller board did.
    if (live && (merged.level !== live.deal.level || !ofRun(merged, live.deal) || beaten(merged.current, live.size))) live = null;
    keep(merged);
    const c = live && r && r.seed === merged.seed && r.level === live.deal.level ? r.current : null;
    if (live && c && sameGame(c, live.deal, live.size)) {
      const have = new Set(live.events.map(e => e.word));
      for (const e of c.events) if (live.words.has(e.word) && !have.has(e.word)) { live.events.push({ ...e }); have.add(e.word); }
      live.events.sort((a, b) => a.at - b.at);
      if (c.elapsedMs > elapsed()) { live.base = c.elapsedMs; if (live.since !== null) live.since = clock(); }
    }
    remember();
    const mine = normalizeProgress(prog);
    if (JSON.stringify(mine) === JSON.stringify(r)) return false;
    // Only the running clock has moved on since the cloud's copy: not worth a write until this
    // device has something to say (a find, or the clock stopping when the page is hidden).
    /** @param {LevelProgress|null} p */
    const still = (p) => JSON.stringify(p && p.current ? { ...p, current: { ...p.current, elapsedMs: 0 } } : p);
    return dirty || still(mine) !== still(r);
  }

  /** Bring this device's copy and the cloud's together: read the cloud's, fold it in, and save the
   * result when the cloud lacks it. Reading first is what stops a device coming back with an old
   * copy from writing over a newer one. One round at a time; one asked for meanwhile runs after it.
   * @param {boolean} news this device has progress the cloud may not @returns {Promise<void>} */
  function exchange(news) {
    if (!cloud.session()) return Promise.resolve();
    if (news) dirty = true;
    if (saving) { again = true; return saving; }
    const g = gen;
    saving = (async () => {
      do {
        again = false;
        let remote;
        try { remote = await cloud.load(); } catch (e) {
          if (g === gen) error = codeOf(e);
          return;
        }
        if (g !== gen) return;
        // A copy written by a newer build is not this one's to replace: leave it for that build.
        if (Number(/** @type {{v?:unknown}|null} */ (remote)?.v) > 1) { error = 'server'; return; }
        error = null;
        // Nothing to write: the cloud already holds this copy, unsent finds and all.
        if (!take(remote)) { if (!again) dirty = false; continue; }
        /** @type {LevelProgress|null} */
        const sent = prog;
        try {
          await cloud.save(sent);
          if (g !== gen) return;
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
  const push = () => exchange(true);
  /** @returns {Promise<void>} */
  const sync = () => exchange(false);

  return {
    enabled: cloud.enabled,

    /** @returns {Account|null} */
    account: () => cloud.session(),

    progress,

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
      kv.remove(OWNER_KEY);
      prog = live = null;
      dirty = again = false;
      saving = null;
      error = null;
    },

    sync,

    /** What to deal next. Resumes an unfinished level by its saved subject, since a device on
     * an older catalog would compute a different one. Null when signed out, before or while the
     * category loads, or when the account changed meanwhile.
     * @param {string[]} categoryIds @param {(id:string) => Promise<CategoryLike>} loadCategory
     * @param {Difficulty} difficulty for a level not yet started @returns {Promise<Deal|null>} */
    async deal(categoryIds, loadCategory, difficulty) {
      // Again from the top when a sync moves the account on while the category loads.
      for (;;) {
        if (!cloud.session() || !prog) return null;
        const p = prog, g = gen;
        const seed = levelSeed(p.seed, p.level);
        const c = p.current;
        if (c) return { level: p.level, subject: c.subject, seed, difficulty: c.difficulty, ...(c.size ? { size: c.size } : {}) };
        const category = levelCategory(p.seed, p.level, categoryIds);
        const cat = await loadCategory(category);
        if (g !== gen || !cloud.session()) return null;
        if (prog && prog.seed === p.seed && prog.level === p.level && !prog.current) {
          return { level: p.level, subject: levelSubject(p.seed, p.level, category, cat.subjectIds, categoryIds.length), seed, difficulty };
        }
      }
    },

    /** A board is the level in progress when its subject, seed and size are that level's:
     * returns its deal, to start() with the board. @param {string} subjectId
     * @param {number} seed @param {number} size @returns {Deal|null} */
    resumable(subjectId, seed, size) {
      const p = progress(), c = p?.current;
      if (!p || !c || c.subject !== subjectId || levelSeed(p.seed, p.level) !== seed || !onBoard(c, size)) return null;
      return { level: p.level, subject: subjectId, seed, difficulty: c.difficulty };
    },

    /** The deal being played and timed, or null. @returns {Deal|null} */
    playing: () => (live ? live.deal : null),

    /** Why a sync let go of `deal`: the account is past its level on the run it was dealt from
     * ('finished'), or still on it there, as another device's game of it on a smaller board
     * ('moved'), or on another device's run ('replaced'). @param {Deal} deal
     * @returns {'finished'|'moved'|'replaced'} */
    lost(deal) {
      const p = progress();
      if (!p || !ofRun(p, deal)) return 'replaced';
      return p.level > deal.level ? 'finished' : 'moved';
    },

    /** The level's finds so far, in order, including any another device added. @returns {LevelEvent[]} */
    events: () => (live ? live.events.map(e => ({ ...e })) : []),

    /** Start timing a dealt level, unless the session has lapsed, the account has moved on from it
     * since it was dealt, or another device's game of it on a smaller board has won it. Returns the
     * finds to put back when it resumes one, in order; a saved level of another subject, difficulty
     * or board (a phone cannot deal the large one), or whose words are not all on this board, starts over.
     * @param {Deal} deal @param {string[]} words the board's words @param {number} size its width
     * @param {boolean} [paused] the page is hidden: the clock waits for resume() @returns {LevelEvent[]} */
    start(deal, words, size, paused = false) {
      const p = progress();
      if (!p || deal.level !== p.level || !ofRun(p, deal) || beaten(p.current, size)) { live = null; return []; }
      const set = new Set(words);
      const c = p.current;
      const resume = !!c && sameGame(c, deal, size)
        && c.events.every(e => set.has(e.word)) && new Set(c.events.map(e => e.word)).size === c.events.length;
      live = { deal, words: set, size, events: resume && c ? c.events.map(e => ({ ...e })) : [], base: resume && c ? c.elapsedMs : 0, since: paused ? null : clock() };
      remember();
      return live.events.map(e => ({ ...e }));
    },

    /** Active play time of the level, in ms. */
    elapsed,

    /** Stop the clock and save, so another device can carry on: the page is hidden, or the board
     * is going. @returns {Promise<void>} settles when that save has landed or failed */
    pause() {
      if (!live || live.since === null) return Promise.resolve();
      live.base = elapsed();
      live.since = null;
      remember();
      return push();
    },

    /** @returns {void} */
    resume() { if (live && live.since === null) live.since = clock(); },

    /** Record a find or a reveal. False for a word not on the board or already recorded.
     * @param {string} word @param {boolean} revealed @returns {boolean} */
    note: (word, revealed) => record([{ word, revealed }]),

    /** Record the finds a board already had when its level started, all at one instant: when
     * they were found is not known, and scoreLevel never chains finds at one instant.
     * @param {{word:string, revealed:boolean}[]} finds @returns {void} */
    carry(finds) { record(finds); },

    /** Score and bank the level once every word is found or revealed; null before that.
     * @returns {Finish|null} */
    finish() {
      if (!live || !prog || live.events.length !== live.words.size) return null;
      const { deal, events, words } = live;
      const ms = Math.round(elapsed());
      const breakdown = scoreLevel({ events, elapsedMs: ms, difficulty: deal.difficulty, wordCount: words.size });
      // The account's level on its run, or take() would have let it go: the record takes it.
      keep(recordLevel(prog, { level: deal.level, subject: deal.subject, difficulty: deal.difficulty,
        score: breakdown.total, ms, reveals: breakdown.stats.revealed, at: now() }));
      live = null;
      return { breakdown, progress: prog, saved: push() };
    },
  };
}
