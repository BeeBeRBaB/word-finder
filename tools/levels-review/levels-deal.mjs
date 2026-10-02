// Deal checks for levels.js: no back-to-back category for 1-30 categories, spread of first
// categories, seed avalanche, and how huge or odd levels behave (the last lines are informational).
import * as L from '../../src/levels.js';
import { CATEGORIES } from '../../src/catalog.js';
const IDS = CATEGORIES.map(c => c.id);
console.log('n categories', IDS.length);
// back-to-back for many n, seeds, cycles
let bad = 0;
for (let n = 1; n <= 30; n++) {
  const ids = Array.from({ length: n }, (_, i) => 'c' + String(i).padStart(2, '0'));
  for (let seed = 0; seed < 300; seed++) {
    let prev = null;
    for (let level = 1; level <= n * 8; level++) {
      const c = L.levelCategory(seed, level, ids);
      if (n > 1 && c === prev) bad++;
      prev = c;
    }
  }
}
console.log('back-to-back repeats (n>1):', bad);
// distribution of first category and of cycle-1 first over 50k seeds
const cnt = new Map();
for (let s = 0; s < 50000; s++) { const c = L.levelCategory(s * 2654435761 >>> 0, 1, IDS); cnt.set(c, (cnt.get(c) || 0) + 1); }
const v = [...cnt.values()]; console.log('level1 first-cat min/max', Math.min(...v), Math.max(...v), 'expected', 50000 / 25);
const cnt2 = new Map();
for (let s = 0; s < 50000; s++) { const c = L.levelCategory(s, 26, IDS); cnt2.set(c, (cnt2.get(c) || 0) + 1); }
const v2 = [...cnt2.values()]; console.log('level26 cat min/max', Math.min(...v2), Math.max(...v2));
// position-in-cycle distribution for a fixed category
const pos = new Array(25).fill(0);
for (let s = 0; s < 20000; s++) for (let i = 0; i < 25; i++) if (L.levelCategory(s, 101 + i, IDS) === IDS[0]) pos[i]++;
console.log('position of first cat in cycle 4, min/max', Math.min(...pos), Math.max(...pos));
// levelSeed vs non-integer / weird inputs
console.log('levelSeed(1, 1.5)', L.levelSeed(1, 1.5), L.levelSeed(1, 1), 'levelSeed(1,0)', L.levelSeed(1, 0), 'NaN', L.levelSeed(1, NaN));
console.log('levelSeed(-1,1) vs (2**32-1,1)', L.levelSeed(-1, 1), L.levelSeed(2 ** 32 - 1, 1));
// avalanche: bits flipped between adjacent levels
let tot = 0, N = 100000;
for (let l = 1; l <= N; l++) { let x = (L.levelSeed(7, l) ^ L.levelSeed(7, l + 1)) >>> 0; let b = 0; while (x) { b += x & 1; x >>>= 1; } tot += b; }
console.log('avg bits flipped adjacent', tot / N);
// huge levels
console.log('level 1e300', L.levelCategory(1, 1e300, IDS), L.levelSeed(1, 1e300));
console.log('normalize level 1e300', L.normalizeProgress({ v: 1, seed: 1, level: 1e300 })?.level);
const p = L.normalizeProgress({ v: 1, seed: 1, level: 2 ** 53 });
console.log('record at 2^53', L.recordLevel(p, { level: 2 ** 53, subject: 'a/b', difficulty: 'easy', score: 1, ms: 1, reveals: 0, at: 1 }).level === 2 ** 53 + 1);
console.log('normalize -0 seed', Object.is(L.normalizeProgress({ v: 1, seed: -0 })?.seed, -0));
console.log('points overflow', L.recordLevel(L.normalizeProgress({ v: 1, seed: 1, points: 1.7e308 }), { level: 1, subject: 'a/b', difficulty: 'easy', score: 1e308, ms: 1, reveals: 0, at: 1 }).points);
process.exitCode = bad ? 1 : 0;
