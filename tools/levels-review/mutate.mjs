// Plants one bug at a time in a temp copy of the repo and reports whether the module's unit
// tests catch it. The repo itself is never written.
//   node tools/levels-review/mutate.mjs <scorecard|scoring|levels|cloud> [name filter]
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const SETS = readdirSync(new URL('./mutants/', import.meta.url)).map((f) => f.replace(/\.json$/, ''));
const [set, only] = process.argv.slice(2);
if (!SETS.includes(set)) {
  console.error(`usage: node tools/levels-review/mutate.mjs <${SETS.join('|')}> [name filter]`);
  process.exit(2);
}

/** @type {{tests: string[], mutants: [string, string, string, string, string?][]}} */
const { tests, mutants } = JSON.parse(readFileSync(new URL(`./mutants/${set}.json`, import.meta.url), 'utf8'));
const copy = mkdtempSync(join(tmpdir(), `wf-mutate-${set}-`));
// package.json carries "type": "module"; the unit tests also read styles.css, index.html and sw.js.
for (const p of ['src', 'tests', 'styles.css', 'index.html', 'sw.js', 'package.json', 'manifest.webmanifest']) {
  cpSync(join(REPO, p), join(copy, p), { recursive: true });
}
// node --test has no timeout of its own, and a mutant can deadlock a test. A failed assert on a
// fake element prints megabytes, which past the default buffer read as a hang.
const run = () => spawnSync(process.execPath, ['--test', ...tests], { cwd: copy, encoding: 'utf8', timeout: 30000, maxBuffer: 1 << 28 });

let caught = 0, missed = 0, skipped = 0, hung = 0, equiv = 0;
try {
  // A copy that already fails would make every mutant look caught.
  if (run().status !== 0) throw new Error(`the unmutated copy fails ${tests.join(' ')}`);
  for (const [name, file, from, to, note] of mutants) {
    if (only && !name.includes(only)) continue;
    const path = join(copy, file);
    const orig = readFileSync(path, 'utf8');
    const count = orig.split(from).length - 1;
    if (count !== 1) { skipped++; console.log(`SKIP    ${name}: anchor found ${count}x in ${file}`); continue; }
    writeFileSync(path, orig.replace(from, () => to));
    const r = run();
    writeFileSync(path, orig);
    // The spec reporter's ✖ lines on a terminal, TAP's top-level `not ok` lines through a pipe.
    const fails = [...new Set((r.stdout.match(/^(?:✖ |not ok \d+ - ).*$/gm) || []).filter((l) => !l.includes('failing tests'))
      .map((l) => l.replace(/^not ok \d+ - /, '✖ ').replace(/\s*\([\d.]+m?s\)$/, '')))];
    if (r.error || r.signal) { hung++; console.log(`HUNG    ${name}`); }
    else if (r.status !== 0) { caught++; console.log(`caught  ${name}  <- ${fails.slice(0, 2).join(' | ')}`); }
    else if (note) { equiv++; console.log(`equiv   ${name}  (${note})`); }
    else { missed++; console.log(`MISSED  ${name}`); }
  }
} finally {
  rmSync(copy, { recursive: true, force: true });
}
console.log(`${set}: caught ${caught}, missed ${missed}, known-equivalent ${equiv}, skipped ${skipped}, hung ${hung}`);
process.exitCode = missed || skipped || hung ? 1 : 0;
