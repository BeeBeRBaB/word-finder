import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLevel, formatClock, SCORING } from '../../src/scoring.js';
import { makeRng } from '../../src/rng.js';

const ORDER = ['words', 'streak', 'difficulty', 'time', 'reveals', 'complete', 'perfect'];

/** @param {string} word @param {number} at */
const find = (word, at) => ({ word, at, revealed: false });
/** @param {string} word @param {number} at */
const reveal = (word, at) => ({ word, at, revealed: true });

/** @param {any} b @param {string} key */
const line = (b, key) => b.lines.find((/** @type {any} */ l) => l.key === key);
/** @param {any} b */
const points = (b) => Object.fromEntries(b.lines.map((/** @type {any} */ l) => [l.key, l.points]));

// Six words; CAT, LION, TIGER chain; HYENA revealed; ZEBRA after a gap; GIRAFFE chains again.
const EXAMPLE = [
  find('CAT', 4000), find('LION', 10000), find('TIGER', 18000),
  reveal('HYENA', 25000), find('ZEBRA', 60000), find('GIRAFFE', 70000),
];

test('the worked example, easy: 240 + 47 + 144 - 25 + 100', () => {
  const b = scoreLevel({ events: EXAMPLE, elapsedMs: 100000, difficulty: 'easy', wordCount: 6 });
  assert.deepEqual(b.lines, [
    { key: 'words', label: 'Words', detail: '5 words', points: 240 },
    { key: 'streak', label: 'Streak', detail: 'best ×1.5', points: 47 },
    { key: 'time', label: 'Speed', detail: '1:40 · par 2:00 · ×1.5', points: 144 },
    { key: 'reveals', label: 'Reveals', detail: '1 word', points: -25 },
    { key: 'complete', label: 'Level complete', detail: 'all 6 words', points: 100 },
  ]);
  assert.equal(b.total, 506);
  assert.equal(b.complete, true);
  assert.deepEqual(b.stats, { found: 5, revealed: 1, elapsedMs: 100000, parMs: 120000, bestStreak: 1.5 });
});

test('the worked example, normal: difficulty applies before speed', () => {
  const b = scoreLevel({ events: EXAMPLE, elapsedMs: 100000, difficulty: 'normal', wordCount: 6 });
  assert.deepEqual(b.lines.find(l => l.key === 'difficulty'),
    { key: 'difficulty', label: 'Normal ×1.5', detail: 'words + streak', points: 144 });
  assert.deepEqual(points(b), { words: 240, streak: 47, difficulty: 144, time: 216, reveals: -38, complete: 150 });
  assert.equal(b.total, 759);
});

test('the worked example, hard', () => {
  const b = scoreLevel({ events: EXAMPLE, elapsedMs: 100000, difficulty: 'hard', wordCount: 6 });
  assert.equal(line(b, 'difficulty').label, 'Hard ×2');
  assert.deepEqual(points(b), { words: 240, streak: 47, difficulty: 287, time: 287, reveals: -50, complete: 200 });
  assert.equal(b.total, 1011);
});

test('a perfect level earns both bonuses; the streak caps at the top of the table', () => {
  const events = [find('SUN', 0), find('MOON', 5000), find('STAR', 9000), find('COMET', 12000), find('ORBIT', 14000)];
  const b = scoreLevel({ events, elapsedMs: 50000, difficulty: 'hard', wordCount: 5 });
  // levels 0,1,2,3,3: 0 + 8 + 20 + 50 + 50
  assert.deepEqual(points(b), { words: 210, streak: 128, difficulty: 338, time: 676, complete: 200, perfect: 100 });
  assert.equal(line(b, 'time').detail, '0:50 · par 1:40 · ×2');
  assert.equal(line(b, 'perfect').label, 'No reveals');
  assert.equal(b.total, 1652);
  assert.equal(b.stats.bestStreak, 2);
});

test('the streak window is inclusive, and a longer gap drops the level to 0', () => {
  const w = SCORING.streakWindowMs;
  const chained = scoreLevel({ events: [find('ABCDE', 0), find('FGHIJ', w)], elapsedMs: 0, difficulty: 'easy', wordCount: 9 });
  assert.equal(line(chained, 'streak').points, 10);
  const gap = scoreLevel({ events: [find('ABCDE', 0), find('FGHIJ', w + 1)], elapsedMs: 0, difficulty: 'easy', wordCount: 9 });
  assert.equal(line(gap, 'streak'), undefined);
  assert.equal(gap.stats.bestStreak, 1);
  // Built to x1.5, broken by a gap, then rebuilt only to x1.2.
  const events = [find('AAAAA', 0), find('BBBBB', 1), find('CCCCC', 2), find('DDDDD', 2 + w + 1), find('EEEEE', 3 + w + 1)];
  const b = scoreLevel({ events, elapsedMs: 0, difficulty: 'easy', wordCount: 9 });
  assert.equal(line(b, 'streak').points, 10 + 25 + 0 + 10);
  // The window runs from the previous find, not from the start of the chain.
  const steady = [0, 1, 2, 3].map(i => find('ABCDE', i * (w - 1000)));
  const chain = scoreLevel({ events: steady, elapsedMs: 0, difficulty: 'easy', wordCount: 9 });
  assert.equal(line(chain, 'streak').points, 10 + 25 + 50);
});

test('a reveal resets the streak and is not a find to chain from', () => {
  const w = SCORING.streakWindowMs;
  const base = [find('AAAAA', 0), find('BBBBB', 1000), find('CCCCC', 2000)];
  const clean = scoreLevel({ events: [...base, find('DDDDD', 3000)], elapsedMs: 0, difficulty: 'easy', wordCount: 9 });
  assert.equal(line(clean, 'streak').points, 10 + 25 + 50, 'the fourth find reaches x2');
  // The find after the reveal restarts from level 0, so it rises only to x1.2.
  const broken = scoreLevel({
    events: [...base, reveal('XXXXX', 2500), find('DDDDD', 3000)], elapsedMs: 0, difficulty: 'easy', wordCount: 9,
  });
  assert.equal(line(broken, 'streak').points, 10 + 25 + 10);
  // The gap is measured from the last find, not from the reveal.
  const late = scoreLevel({
    events: [find('AAAAA', 0), reveal('XXXXX', w), find('BBBBB', w + 1)], elapsedMs: 0, difficulty: 'easy', wordCount: 9,
  });
  assert.equal(line(late, 'streak'), undefined);
});

test('reveals escalate by order, times the difficulty, and never cost more than the word is worth', () => {
  const events = ['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE'].map((w, i) => reveal(w, i));
  // base 40 each, hard x2: 40, 60, 80, 80, 80
  const b = scoreLevel({ events, elapsedMs: 0, difficulty: 'hard', wordCount: 9 });
  assert.deepEqual(line(b, 'reveals'), { key: 'reveals', label: 'Reveals', detail: '5 words', points: -340 });
  const normal = scoreLevel({ events: events.slice(0, 2), elapsedMs: 0, difficulty: 'normal', wordCount: 9 });
  assert.equal(line(normal, 'reveals').points, -(30 + 45));
  for (const d of ['easy', 'normal', 'hard']) {
    const one = scoreLevel({ events: [reveal('ABCDEFGHIJKL', 0)], elapsedMs: 0, difficulty: d, wordCount: 1 });
    const dm = /** @type {Record<string, number>} */ (SCORING.difficulty)[d];
    assert.ok(-line(one, 'reveals').points <= 120 * dm, `${d}: cost within base x difficulty`);
  }
});

test('a level of nothing but reveals completes with no bonus and a negative total', () => {
  const b = scoreLevel({ events: [reveal('CAT', 0), reveal('DOG', 1)], elapsedMs: 1000, difficulty: 'normal', wordCount: 2 });
  assert.equal(b.complete, true);
  assert.deepEqual(b.lines.map(l => l.key), ['words', 'reveals']);
  assert.equal(line(b, 'words').detail, '0 words');
  assert.equal(b.total, -(23 + 34));
});

test('an abandoned level has no speed line and no bonuses', () => {
  const events = [find('CAT', 0), find('DOG', 1000)];
  const b = scoreLevel({ events, elapsedMs: 1000, difficulty: 'hard', wordCount: 3 });
  assert.equal(b.complete, false);
  assert.deepEqual(b.lines.map(l => l.key), ['words', 'streak', 'difficulty']);
  assert.equal(b.stats.parMs, 60000);
  assert.equal(scoreLevel({ events: [...events, find('EWE', 2000)], elapsedMs: 1000, difficulty: 'hard', wordCount: 3 })
    .lines.some(l => l.key === 'time'), true, 'the same level finished does get one');
});

test('each row of the time table, at and just past its boundary', () => {
  const par = SCORING.parPerWordMs;       // one word, so ratio = elapsed / par
  /** @param {number} elapsedMs */
  const speed = (elapsedMs) => line(scoreLevel({
    events: [find('ABCDEFGHIJ', 0)], elapsedMs, difficulty: 'easy', wordCount: 1,
  }), 'time');
  assert.deepEqual(speed(0), { key: 'time', label: 'Speed', detail: '0:00 · par 0:20 · ×2', points: 100 });
  assert.equal(speed(par * 0.5).points, 100);
  assert.equal(speed(par * 0.5 + 1).points, 50);
  assert.equal(speed(par * 0.5 + 1).detail, '0:10 · par 0:20 · ×1.5');
  assert.equal(speed(par).points, 50);
  assert.equal(speed(par + 1).points, 20);
  assert.equal(speed(par * 2).points, 20);
  assert.equal(speed(par * 2 + 1), undefined, 'x1 scores nothing, so has no line');
  assert.equal(speed(par * 3), undefined);
  assert.deepEqual(speed(par * 3 + 1), { key: 'time', label: 'Speed', detail: '1:00 · par 0:20 · ×0.8', points: -20 });
  assert.equal(speed(Infinity).points, -20);
});

test('an empty level is one zero line', () => {
  const b = scoreLevel({ events: [], elapsedMs: 0, difficulty: 'normal', wordCount: 12 });
  assert.deepEqual(b.lines, [{ key: 'words', label: 'Words', detail: '0 words', points: 0 }]);
  assert.equal(b.total, 0);
  assert.equal(b.complete, false);
  assert.deepEqual(b.stats, { found: 0, revealed: 0, elapsedMs: 0, parMs: 240000, bestStreak: 1 });
});

test('bad input degrades instead of throwing', () => {
  const ok = scoreLevel({ events: [find('CAT', 0)], elapsedMs: 0, difficulty: 'normal', wordCount: 1 });
  for (const d of ['bogus', undefined, 'toString', 'constructor']) {
    assert.equal(scoreLevel({ events: [find('CAT', 0)], elapsedMs: 0, difficulty: /** @type {any} */ (d), wordCount: 1 }).total,
      ok.total, `difficulty ${d} falls back to normal`);
  }
  for (const t of [-5000, NaN, undefined, '9']) {
    const b = scoreLevel({ events: [find('CAT', 0)], elapsedMs: /** @type {any} */ (t), difficulty: 'normal', wordCount: 1 });
    assert.equal(b.stats.elapsedMs, 0);
    assert.equal(b.total, ok.total, `elapsed ${t} counts as 0`);
  }
  const odd = scoreLevel({
    events: /** @type {any} */ ([null, 7, { at: NaN }, { word: 42, at: -1 }, find('CAT', NaN), find('DOG', 5), find('CAT', 6)]),
    elapsedMs: 0, difficulty: 'easy', wordCount: 5,
  });
  assert.equal(odd.stats.found, 5, 'two wordless finds, then CAT, DOG and CAT again');
  assert.equal(line(odd, 'words').points, 90);
  assert.equal(odd.complete, true, 'duplicates are the caller\'s problem');
  // Negative and NaN event times clamp to 0, so both of these chain.
  for (const events of [[find('ABCDE', -5000), find('FGHIJ', NaN)], [find('ABCDE', -30000), find('FGHIJ', 1)]]) {
    const b = scoreLevel({ events, elapsedMs: 0, difficulty: 'easy', wordCount: 9 });
    assert.equal(line(b, 'streak')?.points, 10, JSON.stringify(events.map(e => e.at)));
  }
  // More events than words is not a finished level.
  const over = scoreLevel({ events: [find('CAT', 0), find('DOG', 1), find('CAT', 2)], elapsedMs: 0, difficulty: 'easy', wordCount: 2 });
  assert.equal(over.complete, false);
  assert.deepEqual(over.lines.map(l => l.key), ['words', 'streak']);
  assert.equal(scoreLevel({ events: /** @type {any} */ (null), elapsedMs: 0, difficulty: 'easy', wordCount: 3 }).total, 0);
  for (const n of [0, -1, 2.5, NaN]) {
    const b = scoreLevel({ events: [], elapsedMs: 0, difficulty: 'easy', wordCount: n });
    assert.equal(b.complete, false, `wordCount ${n} never completes`);
    assert.equal(b.stats.parMs, 0);
  }
});

/** A seeded random level: some complete, some abandoned, some all reveals. @param {number} seed */
function randomLevel(seed) {
  const rng = makeRng(seed);
  const wordCount = 1 + rng.int(12);
  const count = rng.int(wordCount + 1);
  const pReveal = [0, 0.2, 0.6, 1][rng.int(4)];
  const events = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    // Mostly inside the streak window, so long chains are common enough to matter.
    at += rng.int(4) ? rng.int(12000) : rng.int(60000);
    const word = 'ABCDEFGHIJKL'.slice(0, 3 + rng.int(10));
    events.push({ word, at, revealed: rng.random() < pReveal });
  }
  const difficulty = ['easy', 'normal', 'hard', 'bogus'][rng.int(4)];
  const elapsedMs = at + rng.int(300000);
  return { events, elapsedMs, difficulty, wordCount };
}

test('over 5000 random levels: total is the sum of the lines, all integers, in order, no zero lines', () => {
  for (let seed = 1; seed <= 5000; seed++) {
    const b = scoreLevel(randomLevel(seed));
    assert.equal(b.total, b.lines.reduce((s, l) => s + l.points, 0), `seed ${seed}`);
    assert.equal(b.lines[0].key, 'words', `seed ${seed}`);
    const keys = b.lines.map(l => l.key);
    assert.deepEqual(keys, ORDER.filter(k => keys.includes(k)), `seed ${seed}: order`);
    for (const l of b.lines) {
      assert.ok(Number.isInteger(l.points), `seed ${seed}: ${l.key} ${l.points}`);
      if (l.key !== 'words') assert.notEqual(l.points, 0, `seed ${seed}: ${l.key} is zero`);
    }
  }
});

test('finding a word never scores less than revealing it', () => {
  let flips = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const level = randomLevel(seed);
    const before = scoreLevel(level).total;
    level.events.forEach((e, i) => {
      if (!e.revealed) return;
      const events = level.events.map((x, j) => (j === i ? { ...x, revealed: false } : x));
      const after = scoreLevel({ ...level, events }).total;
      assert.ok(after >= before, `seed ${seed}, event ${i}: found ${after} < revealed ${before}`);
      flips++;
    });
  }
  assert.ok(flips > 1000, `only ${flips} reveals were flipped`);
});

test('being faster never scores less', () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const level = randomLevel(seed);
    const rng = makeRng(seed * 7919);
    const times = Array.from({ length: 12 }, () => rng.int(SCORING.parPerWordMs * level.wordCount * 4));
    // Every row boundary too, and either side of it.
    const par = SCORING.parPerWordMs * level.wordCount;
    for (const { upTo } of SCORING.time) times.push(par * upTo - 1, par * upTo, par * upTo + 1);
    times.sort((a, b) => a - b);
    let prev = Infinity;
    for (const elapsedMs of times) {
      const t = scoreLevel({ ...level, elapsedMs }).total;
      assert.ok(t <= prev, `seed ${seed}: ${elapsedMs}ms scored ${t}, more than a faster time's ${prev}`);
      prev = t;
    }
  }
});

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(999), '0:00');
  assert.equal(formatClock(59999), '0:59');
  assert.equal(formatClock(60000), '1:00');
  assert.equal(formatClock(192000), '3:12');
  assert.equal(formatClock(3599999), '59:59');
  assert.equal(formatClock(3600000), '1:00:00');
  assert.equal(formatClock(3723000), '1:02:03');
  assert.equal(formatClock(36000000 + 61000), '10:01:01');
  assert.equal(formatClock(-1), '0:00');
  assert.equal(formatClock(NaN), '0:00');
  assert.equal(formatClock(Infinity), '--:--');
});

test('the scoring table cannot be changed at runtime', () => {
  assert.ok(Object.isFrozen(SCORING));
  for (const k of ['streak', 'difficulty', 'time', 'reveal']) assert.ok(Object.isFrozen(/** @type {any} */ (SCORING)[k]), k);
  assert.ok(SCORING.time.every(r => Object.isFrozen(r)));
});
