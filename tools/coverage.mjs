#!/usr/bin/env node
// Per-file coverage gate. Dev-only; nothing imports it.
//
// Node's own --test-coverage-lines/-branches/-functions are AGGREGATE thresholds: they
// compare the whole-project total against the floor. With the pure modules sitting near
// 99%, a single new file at 0% barely moves that total, so the built-in flags pass while
// the thing you actually wanted to catch sails through. Verified by planting an uncovered
// function in rng.js -- it dropped that file to 88.89% functions and `node --test
// --test-coverage-functions=90` still exited 0.
//
// So this runs the suite with the lcov reporter and enforces the floor FILE BY FILE.
// No dependency: lcov is a Node built-in reporter and the format is six counters.

import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FLOOR = Number(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 90);
const LCOV = join(tmpdir(), `wordfinder-cov-${process.pid}.info`);

// src/subjects/* is data, not code: 25 files of string constants with no branches, which
// would dominate any average and can never regress. tools/ and tests/ are dev-only.
const EXCLUDE = ['tests/**', 'tools/**', 'src/subjects/**'];

const run = spawnSync(process.execPath, [
  '--test',
  '--experimental-test-coverage',
  ...EXCLUDE.map(g => `--test-coverage-exclude=${g}`),
  '--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', `--test-reporter-destination=${LCOV}`,
], { stdio: 'inherit' });

if (run.status !== 0) {
  rmSync(LCOV, { force: true });
  process.exit(run.status ?? 1);
}

/** @type {{file:string, lines:number, branches:number, functions:number}[]} */
const rows = [];
let cur = null;
const pct = (hit, found) => (found === 0 ? 100 : (hit / found) * 100);

for (const line of readFileSync(LCOV, 'utf8').split('\n')) {
  const [tag, val] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)];
  if (tag === 'SF') cur = { file: val, LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 };
  else if (cur && ['LF', 'LH', 'BRF', 'BRH', 'FNF', 'FNH'].includes(tag)) cur[tag] = Number(val);
  else if (line.trim() === 'end_of_record' && cur) {
    rows.push({
      file: cur.file,
      lines: pct(cur.LH, cur.LF),
      branches: pct(cur.BRH, cur.BRF),
      functions: pct(cur.FNH, cur.FNF),
    });
    cur = null;
  }
}
rmSync(LCOV, { force: true });

if (!rows.length) {
  console.error('coverage: lcov produced no records — the gate did not actually run');
  process.exit(1);
}

const short = rows.filter(r => r.lines < FLOOR || r.branches < FLOOR || r.functions < FLOOR);
const width = Math.max(...rows.map(r => r.file.length));
const fmt = (n) => `${n.toFixed(2).padStart(6)}%`;

console.log(`\ncoverage, per file, floor ${FLOOR}%`);
for (const r of rows.sort((a, b) => a.file.localeCompare(b.file))) {
  const bad = short.includes(r) ? ' <-- below floor' : '';
  console.log(`  ${r.file.padEnd(width)}  lines ${fmt(r.lines)}  branch ${fmt(r.branches)}  funcs ${fmt(r.functions)}${bad}`);
}

if (short.length) {
  console.error(`\ncoverage below ${FLOOR}% in ${short.length} file(s): ${short.map(r => r.file).join(', ')}`);
  process.exit(1);
}
console.log(`\nall ${rows.length} files at or above ${FLOOR}%`);
