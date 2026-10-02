// Independent reference written straight from the spec, then diffed against scoreLevel over
// 200k random levels. A change to the scoring rules must change ref() too.
import { scoreLevel, SCORING as S } from '../../src/scoring.js';
import { makeRng } from '../../src/rng.js';

const clamp = t => (typeof t === 'number' && !Number.isNaN(t) && t > 0 ? t : 0);
function ref({ events, elapsedMs, difficulty, wordCount }) {
  const dm = { easy: 1, normal: 1.5, hard: 2 }[['easy','normal','hard'].includes(difficulty) ? difficulty : 'normal'];
  const base = w => 10 * w.length;
  let words = 0, streak = 0, lvl = 0, prev = null, k = 0, cost = 0, found = 0;
  for (const e of events) {
    if (e.revealed) { k++; cost += Math.round(base(e.word) * S.reveal[Math.min(k, 3) - 1] * dm); prev = null; continue; }
    const at = clamp(e.at);
    if (prev !== null && at - prev <= 20000) lvl = Math.min(lvl + 1, 3); else lvl = 0;
    prev = at; found++;
    words += base(e.word);
    streak += Math.round(base(e.word) * (S.streak[lvl] - 1));
  }
  const diff = Math.round((words + streak) * (dm - 1));
  const complete = events.length === wordCount;
  const par = 20000 * wordCount, ratio = clamp(elapsedMs) / par;
  const row = S.time.find(r => ratio <= r.upTo);
  const mult = row ? row.mult : 0.8;
  const time = complete ? Math.round((words + streak + diff) * (mult - 1)) : 0;
  const out = { words, streak, difficulty: diff, time, reveals: -cost,
    complete: complete && found ? Math.round(100 * dm) : 0, perfect: complete && k === 0 ? Math.round(50 * dm) : 0 };
  return out;
}

let bad = 0, n = 0;
for (let seed = 1; seed <= 200000; seed++) {
  const r = makeRng(seed);
  const wordCount = 1 + r.int(14);
  const count = r.int(wordCount + 3);   // sometimes more events than words
  const events = []; let at = 0;
  for (let i = 0; i < count; i++) {
    at += [0, 1, 19999, 20000, 20001, r.int(25000), r.int(60000)][r.int(7)];
    events.push({ word: 'ABCDEFGHIJKL'.slice(0, 1 + r.int(12)), at: r.int(20) ? at : [-5, NaN, at - 30000][r.int(3)], revealed: r.random() < [0, .3, .7, 1][seed % 4] });
  }
  const par = 20000 * wordCount;
  const elapsedMs = [r.int(par * 4), par * 0.5, par, par * 2, par * 3, par * 3 + 1, -1, NaN][r.int(8)];
  const difficulty = ['easy', 'normal', 'hard', 'x', undefined][r.int(5)];
  const want = ref({ events, elapsedMs, difficulty, wordCount });
  const b = scoreLevel({ events, elapsedMs, difficulty, wordCount });
  const got = Object.fromEntries(Object.keys(want).map(k => [k, b.lines.find(l => l.key === k)?.points ?? 0]));
  n++;
  const wantTotal = Object.values(want).reduce((a, c) => a + c, 0);
  if (JSON.stringify(got) !== JSON.stringify(Object.fromEntries(Object.entries(want).map(([k, v]) => [k, v || 0]))) || b.total !== wantTotal) {
    if (bad++ < 5) console.log('MISMATCH', seed, JSON.stringify({ events, elapsedMs, difficulty, wordCount }), want, got);
  }
}
console.log(`${n} levels, ${bad} mismatches`);
process.exitCode = bad ? 1 : 0;
