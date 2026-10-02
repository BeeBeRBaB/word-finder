// Independent cross-check of the "parallel words never touch" rule: a plain pairwise test
// (any cell of one within one step, diagonals included, of any cell of the other), separate
// from million.mjs's grid scan. Pass another puzzle.js to test a candidate or baseline copy.
//   node tools/sims/generator/adjacency.mjs [path/to/puzzle.js] [seeds=20]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const R = new URL('../../../', import.meta.url);
const file = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])).href : new URL('src/puzzle.js', R).href;
const SEEDS = Number(process.argv[3] || 20);
const { buildPuzzle } = await import(file);
const { makeRng } = await import(new URL('src/rng.js', R).href);
const { PRESETS } = await import(new URL('src/layout.js', R).href);
const pools = [];
for (const f of fs.readdirSync(new URL('src/subjects/', R))) {
  const { WORDS } = await import(new URL('src/subjects/' + f, R).href);
  for (const [k, v] of Object.entries(WORDS)) pools.push([k, v.split(',')]);
}
const cellsOf = (p) => Array.from({ length: p.word.length }, (_, j) => [p.x0 + p.dx * j, p.y0 + p.dy * j]);
let total = 0;
for (const [pn, p] of Object.entries(PRESETS)) {
  let boards = 0, badBoards = 0, badPairs = 0, sameDirPairs = 0, errors = 0, maxSame = 0, distinct = 0, t = 0;
  for (const [id, pool] of pools) for (let seed = 1; seed <= SEEDS; seed++) {
    let pz; const t0 = performance.now();
    try { pz = buildPuzzle({ name: id, pool, rng: makeRng(seed * 7919 + 13), size: p.size, count: p.count, mix: p.mix }); } catch { errors++; continue; }
    t += performance.now() - t0; boards++;
    const pl = pz.placements; let bad = 0;
    for (let i = 0; i < pl.length; i++) for (let k = i + 1; k < pl.length; k++) {
      const a = pl[i], b = pl[k];
      const parallel = (a.dx === b.dx && a.dy === b.dy) || (a.dx === -b.dx && a.dy === -b.dy);
      if (!parallel) continue;
      const A = cellsOf(a), B = cellsOf(b);
      if (A.some(([ax, ay]) => B.some(([bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by)) <= 1))) {
        bad++; if (a.dx === b.dx && a.dy === b.dy) sameDirPairs++;
      }
    }
    badPairs += bad; if (bad) badBoards++;
    const c = {}; for (const q of pl) c[q.dx + ',' + q.dy] = (c[q.dx + ',' + q.dy] || 0) + 1;
    maxSame += Math.max(...Object.values(c)); distinct += Object.keys(c).length;
  }
  console.log(`${pn.padEnd(8)} boards=${boards} errors=${errors} boardsWithTouchingParallel=${badBoards} (${(100 * badBoards / boards).toFixed(1)}%) touchingPairs=${badPairs} ofWhichSameDir=${sameDirPairs} avgMaxSameDir=${(maxSame / boards).toFixed(2)} avgDirs=${(distinct / boards).toFixed(2)} ms/board=${(t / boards).toFixed(3)}`);
  total += errors + badPairs;
}
if (total) process.exitCode = 1;
