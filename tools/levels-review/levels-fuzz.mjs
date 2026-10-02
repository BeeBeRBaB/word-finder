// 200k random and half-valid records through normalize, merge, recordLevel and saveCurrent:
// nothing may throw, every output must be well-formed, and normalizing twice must be a no-op.
import * as L from '../../src/levels.js';
import { makeRng } from '../../src/rng.js';
const rng = makeRng(99);
const pick = (a) => a[rng.int(a.length)];
const atoms = [null, undefined, 0, -0, 1, -1, 1.5, 2 ** 32, 0xffffffff, NaN, Infinity, -Infinity, '', 'x', '5', true, false, [], {}, 'easy', 'normal', 'hard', 'nature/birds', 1e300];
function val(d) {
  if (d > 3 || rng.random() < 0.4) return pick(atoms);
  if (rng.random() < 0.3) return Array.from({ length: rng.int(4) }, () => val(d + 1));
  const keys = ['v', 'seed', 'level', 'points', 'history', 'current', 'subject', 'difficulty', 'score', 'ms', 'reveals', 'at', 'events', 'elapsedMs', 'word', 'revealed'];
  const o = {}; for (let i = rng.int(8); i-- > 0;) o[pick(keys)] = val(d + 1); return o;
}
const good = () => ({ v: 1, seed: rng.int(2 ** 32), level: 1 + rng.int(5), points: rng.int(100), history: [], current: null });
const ok = (p) => p === null || (p.v === 1 && Number.isInteger(p.seed) && p.seed >= 0 && p.seed <= 0xffffffff && Number.isInteger(p.level) && p.level >= 1 && Number.isInteger(p.points) && p.points >= 0 && Array.isArray(p.history) && p.history.length <= 50 && (p.current === null || p.current.level === p.level));
let n = 0, bad = 0, nonIdem = 0;
for (let i = 0; i < 200000; i++) {
  const raw = rng.random() < 0.5 ? val(0) : { ...good(), ...(rng.random() < 0.5 ? { [pick(['level', 'points', 'history', 'current'])]: val(1) } : {}) };
  let p;
  try { p = L.normalizeProgress(raw); } catch (e) { console.log('THROW normalize', e.message, JSON.stringify(raw)); bad++; continue; }
  if (!ok(p)) { console.log('BAD', JSON.stringify(p)); bad++; }
  if (p) { const q = L.normalizeProgress(JSON.parse(JSON.stringify(p))); if (JSON.stringify(q) !== JSON.stringify(p)) nonIdem++; n++; }
  try {
    const m = L.mergeProgress(raw, val(0)); if (!ok(m)) bad++;
    if (p) { const r = L.recordLevel(p, /** @type any */ (val(0))); if (!ok(r)) bad++; const s = L.saveCurrent(p, /** @type any */ (val(0))); if (!ok(s)) bad++; }
  } catch (e) { console.log('THROW', e.message); bad++; }
}
console.log({ valid: n, bad, nonIdem });
process.exitCode = bad || nonIdem ? 1 : 0;
