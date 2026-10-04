import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { BACKGROUNDS, findBackground, makeBackdrop, importBackground, resolveBackground, RANDOM_POOL, THEME_BACKGROUNDS } from '../../src/backgrounds.js';

const OPTS = { colors: ['#111111', '#222222'], dark: true, reducedMotion: false, subject: 'space/jupiter', seed: 1 };
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
    // A still background may have a module too (a scene drawn once); an animated one must.
    if (b.animated) assert.ok(b.file, `${b.id}: animated but no module`);
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

test('a new palette restarts it, and a new deal restarts only a perDeal background', async () => {
  const f = fakeImports();
  const bd = makeBackdrop({ importFn: f.importFn });
  await bd.show('aurora', host('bg'), OPTS);
  await bd.show('aurora', host('bg'), { ...OPTS, subject: 'food/fruit', seed: 2 });
  assert.equal(f.log.length, 1, 'a deal leaves an ordinary background running');
  await bd.show('aurora', host('bg'), { ...OPTS, subject: 'food/fruit', seed: 2, colors: ['#333333'] });
  assert.deepEqual(f.log, ['start aurora-drift bg', 'stop aurora-drift', 'start aurora-drift bg']);

  const g = fakeImports();
  const sd = makeBackdrop({ importFn: g.importFn });
  assert.equal(await sd.show('scene', host('bg'), OPTS), true, 'a still background with a module runs it');
  await sd.show('scene', host('bg'), OPTS);
  await sd.show('scene', host('bg'), { ...OPTS, seed: 2 });
  await sd.show('scene', host('bg'), { ...OPTS, seed: 2, subject: 'food/fruit' });
  // The board corner is another host, so an orientation flip restarts the scene there.
  await sd.show('scene', host('art'), { ...OPTS, seed: 2, subject: 'food/fruit', corner: true });
  await sd.show('drift', host('bg'), OPTS);
  await sd.show('drift', host('bg'), { ...OPTS, seed: 3 });
  assert.deepEqual(g.log, ['start subject-scene bg', 'stop subject-scene', 'start subject-scene bg', 'stop subject-scene',
    'start subject-scene bg', 'stop subject-scene', 'start subject-scene art', 'stop subject-scene',
    'start drifting-icons bg', 'stop drifting-icons', 'start drifting-icons bg']);
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

test('the default loader finds every registry module, and each exports start()', async () => {
  for (const b of BACKGROUNDS) {
    if (b.file) assert.equal(typeof (await importBackground(b.file)).start, 'function', b.file);
  }
});

test('a module whose start() throws leaves nothing running, like a failed load', async () => {
  // No DOM here, so the real module's start() throws.
  const bd = makeBackdrop();
  assert.equal(await bd.show('aurora', host('side'), OPTS), false);
  assert.equal(bd.running(), '');
});

test('every theme has its own background, a real one, the same in both flavours', async () => {
  const { THEMES } = await import('../../src/appearance.js');
  assert.deepEqual(Object.keys(THEME_BACKGROUNDS).sort(), [...THEMES].sort());
  for (const t of THEMES) {
    const id = resolveBackground('theme', 'none', t, 1);
    assert.equal(findBackground(id).id, id, `${t}: ${id} is not in the registry`);
    // The flavour is no input at all, and the Manual pick, seed and last pick change nothing.
    assert.equal(resolveBackground('theme', 'pixel', t, 2, id), id, t);
  }
  assert.deepEqual(THEMES.map(t => resolveBackground('theme', '', t, 0)),
    ['starfield', 'constellation', 'illustrated', 'shimmer', 'motion', 'bokeh', 'aurora']);
  assert.equal(resolveBackground('theme', '', 'retired', 0), 'starfield', 'an unknown theme is the default one');
  assert.equal(new Set(Object.values(THEME_BACKGROUNDS)).size, THEMES.length, 'no two themes share one');
});

test('Manual shows the pick, and an unknown pick the default', () => {
  assert.equal(resolveBackground('manual', 'aquarium', 'plum', 5, 'aquarium'), 'aquarium');
  assert.equal(resolveBackground('manual', 'none', 'grove', 5), 'none');
  assert.equal(resolveBackground('manual', 'gone', 'grove', 5), BACKGROUNDS[0].id);
});

test('Random picks by the seed from every background but None, and never the last pick', () => {
  assert.deepEqual([...RANDOM_POOL], BACKGROUNDS.filter(b => b.id !== 'none').map(b => b.id));
  /** @type {Record<string, number>} */
  const count = Object.fromEntries(RANDOM_POOL.map(id => [id, 0]));
  let prev = '';
  const deals = 100 * RANDOM_POOL.length;
  for (let seed = 0; seed < deals; seed++) {
    const id = resolveBackground('random', 'pixel', 'plum', seed, prev);
    assert.notEqual(id, prev, `seed ${seed} repeated ${prev}`);
    assert.equal(resolveBackground('random', 'none', 'grove', seed, prev), id, 'the seed and last pick decide it, nothing else');
    count[id]++;
    prev = id;
  }
  // 100 each on average: every one comes up, and none far from its share.
  for (const [id, n] of Object.entries(count)) assert.ok(n > 60 && n < 140, `${id}: ${n} of ${deals}`);
  // Clock seeds, as New game deals them, spread over the pool too.
  const clock = new Set(Array.from({ length: 200 }, (_, i) => resolveBackground('random', '', '', (1759536000000 + i * 977) >>> 0)));
  assert.equal(clock.size, RANDOM_POOL.length);
  assert.equal(resolveBackground('random', '', '', 9, 'solo', ['solo']), 'solo', 'a pool of one has nothing else to pick');
  assert.equal(resolveBackground('random', '', '', 9, 'a', ['a', 'b']), 'b');
});
