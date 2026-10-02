// Chi-square spread of levelCategory over 100k seeds (three seed patterns, four cycles) and of
// levelSubject over one category's subjects. Exits 1 if any statistic passes p = 0.001.
import * as L from '../../src/levels.js';
import { CATEGORIES } from '../../src/catalog.js';
const IDS = CATEGORIES.map(c => c.id);
// Wilson-Hilferty approximation of the p = 0.001 critical value (51.2 at df 24).
const crit = (df) => df * (1 - 2 / (9 * df) + 3.09 * Math.sqrt(2 / (9 * df))) ** 3;
let worst = 0;
for (const [name, f] of [['consec', s => s], ['mult', s => (s * 2654435761) >>> 0], ['hi', s => (0x80000000 + s) >>> 0]]) {
  for (const level of [1, 26, 51, 76]) {
    const cnt = new Map();
    const N = 100000;
    for (let s = 0; s < N; s++) { const c = L.levelCategory(f(s), level, IDS); cnt.set(c, (cnt.get(c) || 0) + 1); }
    const v = [...cnt.values()]; const e = N / 25; const chi = v.reduce((a, x) => a + (x - e) ** 2 / e, 0);
    worst = Math.max(worst, chi / crit(24));
    console.log(name, 'level', level, 'chi2(df24)=', chi.toFixed(1));
  }
}
// subject distribution for a category's first visit
import { WORDS } from '../../src/subjects/nature.js';
const S = Object.keys(WORDS);
const cnt = new Map(); const N = 100000;
for (let s = 0; s < N; s++) { const c = L.levelSubject(s, 1, 'nature', S, 25); cnt.set(c, (cnt.get(c) || 0) + 1); }
const v = [...cnt.values()]; const e = N / S.length; const chiS = v.reduce((a, x) => a + (x - e) ** 2 / e, 0);
worst = Math.max(worst, chiS / crit(S.length - 1));
console.log('subjects', S.length, 'chi2', chiS.toFixed(1), 'df', S.length - 1, 'p=0.001 at', crit(S.length - 1).toFixed(1));
process.exitCode = worst > 1 ? 1 : 0;
