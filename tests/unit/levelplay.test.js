import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLevelPlay, levelPuzzle, replaySelections, OWNER_KEY } from '../../src/levelplay.js';
import { PRESETS, mixFor } from '../../src/layout.js';
import { buildPuzzle } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { WORDS as NATURE } from '../../src/subjects/nature.js';
import { newProgress, levelSeed, levelCategory, levelSubject, LEVELS_KEY } from '../../src/levels.js';
import { scoreLevel } from '../../src/scoring.js';
import { CloudError } from '../../src/cloud.js';
import { memStore } from './helpers.js';

const IDS = ['animals', 'food', 'nature'];
const SUBJECTS = { animals: ['animals/cats', 'animals/dogs'], food: ['food/fruit', 'food/bread'], nature: ['nature/birds', 'nature/trees'] };
/** @param {string} id */
const loadCategory = async (id) => ({ subjectIds: SUBJECTS[/** @type {keyof typeof SUBJECTS} */ (id)] });
const WORDS = ['ROBIN', 'WREN', 'OWL'];

/** A promise and the functions that settle it. */
function deferred() {
  /** @type {(v?: any) => void} */ let resolve = () => {};
  /** @type {(e: any) => void} */ let reject = () => {};
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** A cloud with one document per uid. `gate` holds the next load or save open until released. */
function fakeCloud() {
  /** @type {{uid:string, username:string}|null} */
  let session = null;
  /** @type {Map<string, unknown>} */
  const docs = new Map();
  const c = {
    enabled: true,
    docs,
    /** @type {unknown[]} */ saves: [],
    loads: 0,
    /** @type {null | (() => Promise<void>)} */ loadGate: null,
    /** @type {null | (() => Promise<void>)} */ saveGate: null,
    /** @type {CloudError|null} */ loadError: null,
    /** @type {CloudError|null} */ saveError: null,
    session: () => session,
    /** @param {string} u */
    async signIn(u) { session = { uid: `uid-${u}`, username: u }; return session; },
    /** @param {string} u */
    async signUp(u) { session = { uid: `uid-${u}`, username: u }; return session; },
    signOut() { session = null; },
    async load() {
      const s = session;
      c.loads++;
      if (c.loadGate) await c.loadGate();
      if (c.loadError) throw c.loadError;
      return s ? structuredClone(docs.get(s.uid) ?? null) : null;
    },
    /** @param {unknown} d */
    async save(d) {
      const s = session;
      if (c.saveGate) await c.saveGate();
      if (c.saveError) throw c.saveError;
      c.saves.push(structuredClone(d));
      if (s) docs.set(s.uid, structuredClone(d));
    },
  };
  return c;
}

/** @param {object} [over] */
function setup(over = {}) {
  const cloud = fakeCloud();
  const store = memStore();
  let t = 1000;
  const clock = { now: () => t, /** @param {number} ms */ tick: (ms) => { t += ms; } };
  const play = makeLevelPlay({ cloud, store, clock: clock.now, now: () => 1700000000000, random: () => 0.25, ...over });
  return { cloud, store, clock, play };
}

const settle = () => new Promise(r => setImmediate(r));
/** Fails instead of hanging the suite, since node:test has no timeout of its own.
 * @template T @param {Promise<T>} p @param {string} what @returns {Promise<T>} */
const within = (p, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} never settled`)), 500))]);

test('signed out, there is nothing to deal, time or bank', async () => {
  const { play } = setup();
  await play.boot();
  assert.equal(play.enabled, true);
  assert.equal(play.account(), null);
  assert.equal(play.progress(), null);
  assert.equal(await play.deal(IDS, loadCategory, 'normal'), null);
  assert.deepEqual(play.start({ level: 1, subject: 'nature/birds', seed: 1, difficulty: 'normal' }, WORDS), []);
  assert.equal(play.note('ROBIN', false), false);
  assert.equal(play.finish(), null);
  play.pause(); play.resume();
  await play.sync();
  assert.deepEqual(play.status(), { signedIn: false, username: null, level: 0, points: 0, pending: false, error: null });
});

test('a new account starts at level 1 on a random seed, saved here and in the cloud', async () => {
  const { play, cloud, store } = setup();
  await play.signUp('ana', 'secret1');
  const p = play.progress();
  assert.deepEqual(p, newProgress(0x40000000));
  assert.deepEqual(cloud.docs.get('uid-ana'), p);
  assert.deepEqual(JSON.parse(/** @type {string} */ (store.getItem(LEVELS_KEY))), p);
  assert.equal(store.getItem(OWNER_KEY), 'uid-ana');
  assert.deepEqual(play.status(), { signedIn: true, username: 'ana', level: 1, points: 0, pending: false, error: null });
});

test('signing in takes the cloud copy when it is further on, without saving it back', async () => {
  const { play, cloud } = setup();
  cloud.docs.set('uid-ana', { ...newProgress(9), level: 7, points: 300 });
  await play.signIn('ana', 'secret1');
  assert.equal(play.progress()?.level, 7);
  assert.equal(cloud.saves.length, 0);
});

test('a device further on than the cloud saves its copy up', async () => {
  const { play, cloud, store } = setup();
  store.setItem(OWNER_KEY, 'uid-ana');
  store.setItem(LEVELS_KEY, JSON.stringify({ ...newProgress(9), level: 5 }));
  cloud.docs.set('uid-ana', { ...newProgress(9), level: 3 });
  await play.signIn('ana', 'secret1');
  assert.equal(play.progress()?.level, 5);
  assert.equal(/** @type {any} */ (cloud.docs.get('uid-ana')).level, 5);
});

test('a second account on this device never inherits the first one\'s progress', async () => {
  const { play, cloud, store } = setup();
  store.setItem(OWNER_KEY, 'uid-ana');
  store.setItem(LEVELS_KEY, JSON.stringify({ ...newProgress(9), level: 40, points: 9000 }));
  await play.signUp('bo', 'secret1');
  assert.equal(play.progress()?.level, 1);
  assert.equal(play.progress()?.points, 0);
  assert.equal(/** @type {any} */ (cloud.docs.get('uid-bo')).level, 1);
});

test('boot picks up a session the device already has', async () => {
  const { play, cloud } = setup();
  cloud.docs.set('uid-ana', { ...newProgress(9), level: 4 });
  await cloud.signIn('ana');
  await play.boot();
  assert.equal(play.progress()?.level, 4);
});

test('sign out forgets the local copy, and a load still in flight is dropped', async () => {
  const { play, cloud, store } = setup();
  await play.signUp('ana', 'secret1');
  const gate = deferred();
  cloud.loadGate = () => gate.promise;
  const syncing = play.sync();
  play.signOut();
  gate.resolve();
  await syncing;
  assert.equal(play.progress(), null);
  assert.equal(store.getItem(LEVELS_KEY), null);
  assert.equal(store.getItem(OWNER_KEY), null);
  assert.deepEqual(play.status(), { signedIn: false, username: null, level: 0, points: 0, pending: false, error: null });
});

test('a failed load keeps the local copy and reports why', async () => {
  const { play, cloud } = setup();
  await play.signUp('ana', 'secret1');
  cloud.loadError = new CloudError('offline');
  await play.sync();
  assert.equal(play.progress()?.level, 1);
  assert.equal(play.status().error, 'offline');
  cloud.loadError = null;
  await play.sync();
  assert.equal(play.status().error, null);
});

test('a new level is dealt from the account seed; an unfinished one resumes by its saved subject', async () => {
  const { play, cloud } = setup();
  cloud.docs.set('uid-ana', { ...newProgress(9), level: 3 });
  await play.signIn('ana', 'secret1');
  const cat = levelCategory(9, 3, IDS);
  const want = { level: 3, subject: levelSubject(9, 3, cat, SUBJECTS[/** @type {keyof typeof SUBJECTS} */ (cat)], IDS.length), seed: levelSeed(9, 3), difficulty: 'hard' };
  assert.deepEqual(await play.deal(IDS, loadCategory, 'hard'), want);
  // Saved mid-level as an easy level of another subject: that is what comes back.
  cloud.docs.set('uid-ana', { ...newProgress(9), level: 3, current: { level: 3, subject: 'food/bread', difficulty: 'easy', events: [], elapsedMs: 0 } });
  await play.sync();
  assert.deepEqual(await play.deal(IDS, () => { throw new Error('no load needed'); }, 'hard'),
    { level: 3, subject: 'food/bread', seed: levelSeed(9, 3), difficulty: 'easy' });
});

test('a deal overtaken by a change of account is dropped', async () => {
  const { play } = setup();
  await play.signUp('ana', 'secret1');
  const gate = deferred();
  const dealing = play.deal(IDS, async (id) => { await gate.promise; return loadCategory(id); }, 'normal');
  await play.signUp('bo', 'secret1');
  gate.resolve();
  assert.equal(await dealing, null);
});

test('a level is timed in active play only, and its score is the scorer\'s', async () => {
  const { play, clock, cloud } = setup();
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'hard'));
  assert.deepEqual(play.start(deal, WORDS), []);
  clock.tick(4000);
  assert.equal(play.note('ROBIN', false), true);
  play.pause();
  clock.tick(60000);                       // hidden: not play time
  play.pause();                            // a second pause changes nothing
  play.resume();
  play.resume();
  clock.tick(3000);
  assert.equal(play.note('WREN', true), true);
  assert.equal(play.finish(), null, 'not until every word is found or revealed');
  clock.tick(2000);
  assert.equal(play.note('OWL', false), true);
  assert.equal(play.elapsed(), 9000);
  const events = [{ word: 'ROBIN', at: 4000, revealed: false }, { word: 'WREN', at: 7000, revealed: true }, { word: 'OWL', at: 9000, revealed: false }];
  const done = play.finish();
  const breakdown = scoreLevel({ events, elapsedMs: 9000, difficulty: 'hard', wordCount: 3 });
  assert.deepEqual(done, { breakdown, banked: true, progress: play.progress() });
  const p = /** @type {import('../../src/levels.js').LevelProgress} */ (play.progress());
  assert.equal(p.level, 2);
  assert.equal(p.points, Math.max(0, breakdown.total));
  assert.deepEqual(p.history.at(-1), { level: 1, subject: deal.subject, difficulty: 'hard', score: breakdown.total, ms: 9000, reveals: 1, at: 1700000000000 });
  assert.equal(p.current, null);
  await settle();
  assert.deepEqual(cloud.docs.get('uid-ana'), p);
  assert.equal(play.finish(), null, 'a level banks once');
});

test('only a word on the board, once, is recorded', async () => {
  const { play } = setup();
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  assert.equal(play.note('EAGLE', false), false);
  assert.equal(play.note('ROBIN', false), true);
  assert.equal(play.note('ROBIN', true), false);
  assert.equal(play.progress()?.current?.events.length, 1);
});

test('each find is saved, so the level resumes with its finds and its time', async () => {
  const { play, clock, cloud, store } = setup();
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'easy'));
  play.start(deal, WORDS);
  clock.tick(2500);
  play.note('WREN', false);
  clock.tick(1000);
  play.pause();
  await settle();
  // Another device, same board: it gets the finds back in order and carries on the clock.
  const other = makeLevelPlay({ cloud, store: memStore(), clock: clock.now, random: () => 0.9 });
  await other.boot();
  const again = /** @type {import('../../src/levelplay.js').Deal} */ (await other.deal(IDS, loadCategory, 'hard'));
  assert.deepEqual(again, deal, 'the saved difficulty, not this device\'s setting');
  assert.deepEqual(other.start(again, WORDS), [{ word: 'WREN', at: 2500, revealed: false }]);
  assert.equal(other.elapsed(), 3500);
  // A board without that word (another board size) starts the level over.
  const third = makeLevelPlay({ cloud, store: memStore(), clock: clock.now });
  await third.boot();
  assert.deepEqual(third.start(again, ['ROBIN', 'OWL']), []);
  assert.equal(third.elapsed(), 0);
  assert.deepEqual(third.progress()?.current?.events, []);
  assert.ok(store.getItem(LEVELS_KEY));
});

test('a saved level of another subject or difficulty is not resumed into this one', async () => {
  const { play, cloud } = setup();
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  play.note('OWL', false);
  assert.deepEqual(play.start({ ...deal, difficulty: 'hard' }, WORDS), []);
  play.note('OWL', false);
  assert.deepEqual(play.start({ ...deal, subject: 'food/bread' }, WORDS), []);
  // A duplicated find in a stored level is not trusted either.
  cloud.docs.set('uid-ana', { ...newProgress(0x40000000), current: { level: 1, subject: deal.subject, difficulty: 'normal', elapsedMs: 5,
    events: [{ word: 'OWL', at: 1, revealed: false }, { word: 'OWL', at: 2, revealed: false }] } });
  const fresh = makeLevelPlay({ cloud, store: memStore() });
  await fresh.boot();
  assert.deepEqual(fresh.start(deal, WORDS), []);
  assert.deepEqual(play.start({ ...deal, level: 9 }, WORDS), [], 'not this account\'s level');
  assert.equal(play.note('OWL', false), false);
});

test('when the cloud has moved past the level being played, it is neither banked nor kept', async () => {
  const { play, cloud } = setup();
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  for (const w of WORDS) play.note(w, false);
  // Another device banked level 1 meanwhile and the merge took its record.
  cloud.docs.set('uid-ana', { ...newProgress(0x40000000), level: 2, points: 50 });
  await play.sync();
  assert.equal(play.finish(), null, 'the level was dropped with the sync');
  // The same race without a sync in between: the result is refused and nothing moves.
  const deal2 = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal2, WORDS);
  for (const w of WORDS) play.note(w, false);
  const moved = { ...newProgress(0x40000000), level: 3, points: 80 };
  cloud.docs.set('uid-ana', moved);
  const syncing = play.sync();
  await syncing;
  assert.equal(play.progress()?.level, 3);
});

test('a level the store refuses to bank is reported, not counted', async () => {
  const { play } = setup({ now: () => NaN });
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  for (const w of WORDS) play.note(w, false);
  const done = play.finish();
  assert.equal(done?.banked, false);
  assert.equal(play.progress()?.level, 1);
});

test('a failed save stays pending and is retried by the next one; saves never overlap', async () => {
  const { play, cloud } = setup();
  await play.signUp('ana', 'secret1');
  cloud.saveError = new CloudError('offline');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  play.note('OWL', false);
  play.pause();
  await settle();
  assert.deepEqual([play.status().pending, play.status().error], [true, 'offline']);
  cloud.saveError = null;
  const gate = deferred();
  let open = 0, most = 0;
  cloud.saveGate = async () => { open++; most = Math.max(most, open); await gate.promise; open--; };
  play.resume();
  play.note('ROBIN', false);
  play.pause();
  play.resume();
  play.note('WREN', false);
  play.finish();
  gate.resolve();
  await settle(); await settle();
  assert.equal(most, 1);
  assert.deepEqual(cloud.docs.get('uid-ana'), play.progress(), 'the last save carries the latest copy');
  assert.deepEqual([play.status().pending, play.status().error], [false, null]);
});

test('a save that lands after the account changed is ignored', async () => {
  const { play, cloud } = setup();
  await play.signUp('ana', 'secret1');
  const gate = deferred();
  cloud.saveGate = () => gate.promise;
  cloud.saveError = new CloudError('server');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  play.pause();
  play.signOut();
  gate.resolve();
  await settle();
  assert.equal(play.status().error, null);
  cloud.saveError = null;
  // Ana's save hangs; Bo signs up meanwhile and his first save must not wait behind it.
  const g2 = deferred();
  let first = true;
  cloud.saveGate = () => { if (!first) return Promise.resolve(); first = false; return g2.promise; };
  await cloud.signIn('ana');
  await play.boot();
  const d2 = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(d2, WORDS);
  play.pause();
  await within(play.signUp('bo', 'secret1'), 'a sign-up waiting on the last account\'s save');
  assert.equal(play.note('OWL', false), false, 'ana\'s level is not bo\'s');
  assert.deepEqual(cloud.docs.get('uid-bo'), play.progress());
  assert.equal(play.status().pending, false);
  g2.resolve();
  await settle();
  assert.deepEqual([play.status().username, play.status().pending], ['bo', false]);
});

test('a throwing store still plays, for this session only', async () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  const { play } = setup({ store: bad });
  await play.signUp('ana', 'secret1');
  assert.equal(play.progress()?.level, 1);
  play.signOut();
  const none = setup({ store: null }).play;
  await none.signUp('bo', 'secret1');
  assert.equal(none.progress()?.level, 1);
  none.signOut();
});

test('without an injected clock or random it uses performance.now and Math.random', async () => {
  const cloud = fakeCloud();
  const play = makeLevelPlay({ cloud, store: memStore() });
  await play.signUp('ana', 'secret1');
  const seed = play.progress()?.seed;
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  assert.ok(play.elapsed() >= 0);
  const s = makeLevelPlay({ cloud });
  assert.equal(s.enabled, true);
});

test('once the session has expired, nothing is sent until the player signs in again', async () => {
  const { play, cloud } = setup();
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(deal, WORDS);
  const sent = cloud.saves.length;
  cloud.signOut();   // what cloud.js does when Auth refuses the refresh token
  play.note('OWL', false);
  play.pause();
  await settle();
  assert.equal(cloud.saves.length, sent);
  assert.deepEqual(play.status(), { signedIn: false, username: null, level: 0, points: 0, pending: false, error: null });
  assert.equal(play.resumable(deal.subject, deal.seed), null, 'no level to resume for a player no longer signed in');
});

test('a level\'s board depends only on its seed, difficulty and board size', () => {
  const subject = { name: 'Birds', words: NATURE['nature/birds'].split(',') };
  const deal = { level: 4, subject: 'nature/birds', seed: 123456, difficulty: /** @type {const} */ ('hard') };
  for (const shape of [PRESETS.full, PRESETS.compact]) {
    const a = levelPuzzle(deal, subject, shape);
    assert.deepEqual(a, levelPuzzle(deal, subject, shape), 'every device of this size deals the same board');
    assert.deepEqual(a, buildPuzzle({ name: 'Birds', pool: subject.words, rng: makeRng(123456), size: shape.size, count: shape.count, mix: mixFor(shape, 'hard') }));
    assert.equal(a.words.length, shape.count);
    assert.notDeepEqual(a.words, levelPuzzle({ ...deal, difficulty: 'easy' }, subject, shape).words);
  }
});

test('a board saved mid-level is known by its subject and seed, and by nothing else', async () => {
  const { play } = setup();
  assert.equal(play.resumable('nature/birds', 1), null, 'signed out');
  await play.signUp('ana', 'secret1');
  const deal = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'hard'));
  assert.equal(play.resumable(deal.subject, deal.seed), null, 'dealt but not started: no board yet');
  assert.equal(play.playing(), null);
  play.start(deal, WORDS);
  assert.equal(play.playing(), deal);
  assert.deepEqual(play.resumable(deal.subject, deal.seed), deal);
  assert.equal(play.resumable('food/bread', deal.seed), null, 'another subject');
  assert.equal(play.resumable(deal.subject, deal.seed + 1), null, 'another board of that subject');
  for (const w of WORDS) play.note(w, false);
  assert.ok(play.finish());
  assert.equal(play.playing(), null);
  assert.equal(play.resumable(deal.subject, deal.seed), null, 'finished, so the next level is current');
  const next = /** @type {import('../../src/levelplay.js').Deal} */ (await play.deal(IDS, loadCategory, 'normal'));
  play.start(next, WORDS);
  play.signOut();
  assert.equal(play.resumable(next.subject, next.seed), null);
  assert.equal(play.playing(), null);
});

test('a resumed level puts each recorded word back where the board holds it, once, in order', () => {
  const puzzle = { placements: [{ word: 'ROBIN', x0: 0, y0: 0, dx: 1, dy: 0 }, { word: 'OWL', x0: 2, y0: 3, dx: 0, dy: -1 }, { word: 'WREN', x0: 4, y0: 4, dx: -1, dy: -1 }] };
  const ev = (/** @type {string} */ word) => ({ word, at: 0, revealed: false });
  assert.deepEqual(replaySelections(puzzle, [ev('OWL'), ev('HERON'), ev('ROBIN'), ev('OWL'), ev('WREN')]), [
    { word: 'OWL', sel: { x0: 2, y0: 3, x1: 2, y1: 1 } },
    { word: 'ROBIN', sel: { x0: 0, y0: 0, x1: 4, y1: 0 } },
    { word: 'WREN', sel: { x0: 4, y0: 4, x1: 1, y1: 1 } },
  ]);
  assert.deepEqual(replaySelections(puzzle, []), []);
});
