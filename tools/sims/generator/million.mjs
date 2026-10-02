// Million-board check of the word generator: every subject x SEEDS seeds, per preset, on all
// cores. Counts throws, misspelled placements, touching parallel words, direction balance,
// cell coverage and nondeterminism. Exits 1 if any board throws, misspells, touches, skips or
// overloads a direction, or replays differently.
//   node tools/sims/generator/million.mjs                 1667 seeds x 600 subjects ~ 1M boards per preset
//   SEEDS=20 LEVEL=hard PRESETS=compact node tools/sims/generator/million.mjs
//   SRC=/path/to/other/src node tools/sims/generator/million.mjs     a baseline or planted copy
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const SRC = process.env.SRC ? pathToFileURL(path.resolve(process.env.SRC) + '/') : new URL('../../../src/', import.meta.url);
const SEEDS = Number(process.env.SEEDS || 1667);
const LEVEL = process.env.LEVEL || 'normal';
const PRESETS = (process.env.PRESETS || 'full,compact').split(',');
const DIRS = ['1,0', '-1,0', '0,1', '0,-1', '1,1', '-1,-1', '1,-1', '-1,1'];

if (isMainThread) {
  const n = Math.min(os.availableParallelism(), SEEDS); const t0 = Date.now(); let bad = 0;
  console.log(`level=${LEVEL} seeds=${SEEDS} src=${SRC.pathname}`);
  for (const preset of PRESETS) {
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => new Promise((res, rej) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { preset, from: Math.floor(i * SEEDS / n) + 1, to: Math.floor((i + 1) * SEEDS / n) } });
      w.on('message', res); w.on('error', rej);
    })));
    const T = parts.reduce((a, p) => {
      for (const k of Object.keys(p)) a[k] = k === 'heat' || k === 'dirTotals' ? (a[k] || p[k].map(() => 0)).map((v, i) => v + p[k][i])
        : k === 'worstMs' || k === 'worstSame' ? Math.max(a[k] || 0, p[k]) : (a[k] || 0) + p[k];
      return a;
    }, {});
    const heat = T.heat.map(v => 100 * v / T.boards), mean = heat.reduce((a, b) => a + b) / heat.length;
    const sd = Math.sqrt(heat.reduce((a, b) => a + (b - mean) ** 2, 0) / heat.length);
    const dirSum = T.dirTotals.reduce((a, b) => a + b);
    console.log(`${preset.padEnd(8)} boards=${T.boards.toLocaleString()} errors=${T.errors} misspelled=${T.misspelled} touchingParallelPairs=${T.touching} boardsOverShare=${T.overShare} determinismFail=${T.detFail}/${T.detChecked}`);
    console.log(`         maxSameDir avg=${(T.maxSame / T.boards).toFixed(3)} worst=${T.worstSame}  distinctDirs avg=${(T.distinct / T.boards).toFixed(3)} boardsMissingADirection=${T.missingDir}  directionTotals=${T.dirTotals.map(v => (100 * v / dirSum).toFixed(2) + '%').join(' ')}`);
    console.log(`         avgWordLength=${(T.len / T.words).toFixed(2)}  coverage min=${Math.min(...heat).toFixed(1)}% max=${Math.max(...heat).toFixed(1)}% sd=${sd.toFixed(1)}  ms/board avg=${(T.ms / T.boards).toFixed(3)} worst=${T.worstMs.toFixed(2)}`);
    bad += T.errors + T.misspelled + T.touching + T.overShare + T.missingDir + T.detFail;
  }
  console.log(`total ${((Date.now() - t0) / 1000).toFixed(0)}s on ${n} workers`);
  if (bad) process.exitCode = 1;
} else {
  const { buildPuzzle } = await import(new URL('puzzle.js', SRC).href);
  const { makeRng } = await import(new URL('rng.js', SRC).href);
  const { PRESETS: P_ALL, mixFor } = await import(new URL('layout.js', SRC).href);
  const pools = [];
  for (const f of fs.readdirSync(new URL('subjects/', SRC))) {
    const { WORDS } = await import(new URL('subjects/' + f, SRC).href);
    for (const [k, v] of Object.entries(WORDS)) pools.push([k, v.split(',')]);
  }
  const P = P_ALL[workerData.preset], N = P.size, share = Math.ceil(P.count / 8), MIX = mixFor(P, LEVEL);
  const A = { len: 0, words: 0, missingDir: 0, boards: 0, errors: 0, misspelled: 0, touching: 0, overShare: 0, detFail: 0, detChecked: 0, maxSame: 0, worstSame: 0, distinct: 0, ms: 0, worstMs: 0, heat: new Array(N * N).fill(0), dirTotals: new Array(8).fill(0) };
  const owner = new Int16Array(N * N);
  const build = (id, pool, seed) => buildPuzzle({ name: id, pool, rng: makeRng(seed * 104729 + 7), size: N, count: P.count, mix: MIX });
  for (let seed = workerData.from; seed <= workerData.to; seed++) for (const [id, pool] of pools) {
    let pz; const t0 = performance.now();
    try { pz = build(id, pool, seed); } catch { A.errors++; continue; }
    const dt = performance.now() - t0; A.ms += dt; if (dt > A.worstMs) A.worstMs = dt; A.boards++;
    const pl = pz.placements, per = new Array(8).fill(0);
    // Parallel = same axis (a direction and its reverse are adjacent in DIRS).
    for (let axis = 0; axis < 4; axis++) {
      owner.fill(-1);
      const on = pl.map((p, i) => [p, i]).filter(([p]) => (DIRS.indexOf(p.dx + ',' + p.dy) >> 1) === axis);
      for (const [p, i] of on) for (let j = 0; j < p.word.length; j++) owner[(p.y0 + p.dy * j) * N + p.x0 + p.dx * j] = i;
      for (const [p, i] of on) {
        let hit = false;
        for (let j = 0; j < p.word.length && !hit; j++) {
          const x = p.x0 + p.dx * j, y = p.y0 + p.dy * j;
          for (let oy = -1; oy <= 1 && !hit; oy++) for (let ox = -1; ox <= 1; ox++) {
            const xx = x + ox, yy = y + oy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
            const o = owner[yy * N + xx]; if (o >= 0 && o !== i) { hit = true; break; }
          }
        }
        if (hit) A.touching++;
      }
    }
    for (const p of pl) {
      const d = DIRS.indexOf(p.dx + ',' + p.dy); per[d]++; A.dirTotals[d]++; let s = '';
      for (let j = 0; j < p.word.length; j++) { const c = (p.y0 + p.dy * j) * N + p.x0 + p.dx * j; s += pz.cells[c]; A.heat[c]++; }
      if (s !== p.word) A.misspelled++;
      A.len += p.word.length; A.words++;
    }
    const m = Math.max(...per), used = per.filter(Boolean).length;
    A.maxSame += m; if (m > A.worstSame) A.worstSame = m; if (m > share) A.overShare++;
    A.distinct += used; if (used < 8) A.missingDir++;
    if (A.boards % 100 === 0) { A.detChecked++; if (build(id, pool, seed).cells.join('') !== pz.cells.join('')) A.detFail++; }
  }
  parentPort.postMessage(A);
}
