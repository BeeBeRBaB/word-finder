import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { BACKGROUNDS, findBackground, makeBackdrop } from '../../src/backgrounds.js';

const OPTS = { colors: [], dark: true, reducedMotion: false };
/** @param {string} id */
const host = (id) => /** @type {HTMLElement} */ (/** @type {unknown} */ ({ id }));

/** A fake module loader that records starts and stops, and can be made to fail or stall. */
function fakeImports() {
  /** @type {string[]} */ const log = [];
  /** @type {Map<string, () => void>} */ const gates = new Map();
  let fail = false;
  /** @param {string} file */
  const importFn = async (file) => {
    if (gates.has(file)) await new Promise(r => gates.set(file, /** @type {() => void} */ (r)));
    if (fail) throw new Error('offline');
    return { start: (/** @type {HTMLElement} */ h) => { log.push(`start ${file} ${h.id}`); return () => log.push(`stop ${file}`); } };
  };
  return { log, importFn, gates, failNext: (/** @type {boolean} */ v) => { fail = v; } };
}

test('every animated background names a module that exists, and ids are unique', () => {
  const files = readdirSync(new URL('../../src/backgrounds/', import.meta.url)).map(f => f.replace(/\.js$/, ''));
  for (const b of BACKGROUNDS) {
    assert.equal(b.animated, !!b.file, `${b.id}: animated exactly when it has a module`);
    if (b.file) assert.ok(files.includes(b.file), `${b.id}: no src/backgrounds/${b.file}.js`);
    assert.ok(b.glyph.length > 20, `${b.id}: no picker picture`);
  }
  assert.equal(new Set(BACKGROUNDS.map(b => b.id)).size, BACKGROUNDS.length);
  assert.equal(findBackground('nope').id, BACKGROUNDS[0].id);
  assert.equal(findBackground('aurora').file, 'aurora-drift');
});

test('the settings choices are exactly the background ids, default first', async () => {
  const { CHOICES, DEFAULTS } = await import('../../src/settings.js');
  assert.deepEqual([...CHOICES.art], BACKGROUNDS.map(b => b.id));
  assert.equal(DEFAULTS.art, BACKGROUNDS[0].id);
});

test('one animated background runs at a time, and a still choice stops it', async () => {
  const f = fakeImports();
  const bd = makeBackdrop({ importFn: f.importFn });
  assert.equal(await bd.show('aurora', host('side'), OPTS), true);
  assert.equal(await bd.show('aurora', host('side'), OPTS), true, 'same choice: left running');
  assert.equal(await bd.show('starfield', host('side'), OPTS), true);
  assert.equal(bd.running(), 'starfield');
  assert.equal(await bd.show('illustrated', host('side'), OPTS), false);
  assert.equal(bd.running(), '');
  assert.deepEqual(f.log, ['start aurora-drift side', 'stop aurora-drift', 'start pixel-starfield side', 'stop pixel-starfield']);
});

test('a new host, mode or motion setting restarts it', async () => {
  const f = fakeImports();
  const bd = makeBackdrop({ importFn: f.importFn });
  await bd.show('bokeh', host('side'), OPTS);
  await bd.show('bokeh', host('bg'), OPTS);
  await bd.show('bokeh', host('bg'), { ...OPTS, dark: false });
  await bd.show('bokeh', host('bg'), { ...OPTS, dark: false, reducedMotion: true });
  assert.equal(f.log.filter(l => l.startsWith('start')).length, 4);
  assert.equal(f.log.filter(l => l.startsWith('stop')).length, 3);
});

test('a show overtaken while its module loads never starts', async () => {
  const f = fakeImports();
  f.gates.set('pixel-skyline', () => {});
  const bd = makeBackdrop({ importFn: f.importFn });
  const slow = bd.show('skyline', host('side'), OPTS);
  const fast = bd.show('confetti', host('side'), OPTS);
  /** @type {() => void} */ (f.gates.get('pixel-skyline'))();
  assert.equal(await slow, false);
  assert.equal(await fast, true);
  assert.deepEqual(f.log, ['start pixel-confetti side']);
  bd.stop();
  assert.equal(bd.running(), '');
});

test('a module that fails to load leaves nothing running, and is retried next time', async () => {
  const f = fakeImports();
  const bd = makeBackdrop({ importFn: f.importFn });
  f.failNext(true);
  assert.equal(await bd.show('constellation', host('side'), OPTS), false);
  assert.equal(bd.running(), '');
  f.failNext(false);
  assert.equal(await bd.show('constellation', host('side'), OPTS), true);
  assert.deepEqual(f.log, ['start constellation side']);
});

test('no host means nothing starts', async () => {
  const bd = makeBackdrop({ importFn: fakeImports().importFn });
  assert.equal(await bd.show('aurora', null, OPTS), false);
});

test('the default loader imports the module from src/backgrounds/', async () => {
  // No DOM here, so the real module's start() throws; show() must absorb that like a failed load.
  const bd = makeBackdrop();
  assert.equal(await bd.show('aurora', host('side'), OPTS), false);
  assert.equal(bd.running(), '');
  const mod = await import('../../src/backgrounds/aurora-drift.js');
  assert.equal(typeof mod.start, 'function');
});
