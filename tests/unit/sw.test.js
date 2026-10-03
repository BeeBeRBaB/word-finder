import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../../', import.meta.url);
const sw = readFileSync(new URL('sw.js', ROOT), 'utf8');

/** @returns {string[]} */
function assets() {
  const m = sw.match(/const ASSETS=(\[[^\]]*\])/);
  assert.ok(m, 'could not find ASSETS in sw.js');
  return JSON.parse(m[1].replace(/'/g, '"'));
}

// GitHub Pages serves code with `cache-control: max-age=600` (see sw.js, where
// `revalidate()` already documents and works around this for the fetch handler). A
// plain fetch -- which is exactly what `caches.open(CACHE).then(c=>c.addAll(ASSETS))`
// issues -- can be answered straight from the browser's own HTTP cache, so a bare
// `addAll` at install can fill a freshly-bumped CACHE with the PREVIOUS build's files
// for up to ten minutes after a deploy. `install` was the one place that never got
// the `revalidate()` treatment. This is asserted both directions -- a regex that
// could pass vacuously (e.g. only checking `cache:'reload'` appears somewhere in the
// file) would be worse than nothing, since it wouldn't actually prove the install
// handler is the thing using it.
test("the install handler forces reload-mode requests, not a bare addAll(ASSETS)", () => {
  const line = sw.split('\n').find((l) => l.includes("addEventListener('install'"));
  assert.ok(line, "could not find the install handler in sw.js");
  assert.ok(
    !line.includes('addAll(ASSETS)'),
    "install must not precache with a bare addAll(ASSETS): it can be answered from the " +
    "browser's own HTTP cache and silently poison CACHE with the previous build -- the " +
    "hazard is real the moment a deploy deletes a file a stale main.js still imports"
  );
  assert.ok(
    line.includes("cache:'reload'"),
    "install must request each asset with {cache:'reload'} to force an origin fetch, " +
    "bypassing GitHub Pages' max-age=600 HTTP cache the same way revalidate() does"
  );
});

test('the shell precache lists catalog.js and every src module, but no word pool or background', () => {
  const list = assets();
  assert.ok(list.includes('./src/catalog.js'), 'the picker needs names on every visit');
  assert.ok(list.includes('./src/subjects.js'), 'the loader is shell code, not content');
  assert.ok(list.includes('./src/picker.js'));
  assert.ok(
    !list.some(a => a.startsWith('./src/subjects/')),
    'word pools must not be precached: they are the whole reason the catalog is separate',
  );
  assert.ok(
    !list.some(a => a.startsWith('./src/backgrounds/')),
    'backgrounds and their icon library load when picked; precaching them would put ~350KB in every install',
  );
});

// Both directions, because each fails silently and differently. A module missing from
// the list works online and breaks only offline. A listed path that no longer exists is
// worse: Cache.addAll is atomic, so one 404 rejects the whole install and caches
// NOTHING, disabling offline support entirely -- and main.js swallows the registration
// error, so nothing surfaces anywhere. Renaming a module trips exactly that.
//
// This lives here rather than in the PostToolUse hook, which used to re-parse ASSETS
// itself: as a test it also runs under `npm test` and `/ship`, which is what catches a
// module deleted with `rm` or moved with `git mv` -- neither of which the hook sees,
// since it only fires on edits Claude makes through Edit/Write.
test('every src module is precached and every precached path exists', () => {
  const list = assets();
  /** @type {string[]} */
  const problems = [];
  for (const f of readdirSync(new URL('src/', ROOT)).filter(f => f.endsWith('.js'))) {
    if (!list.includes(`./src/${f}`)) problems.push(`src/${f} is not in ASSETS (breaks offline)`);
  }
  for (const a of list) {
    const rel = a.replace(/^\.\//, '');
    if (rel === '' || rel.endsWith('/')) continue;              // './' is the document
    if (!existsSync(new URL(rel, ROOT))) problems.push(`${a} is in ASSETS but not on disk (addAll is atomic — this caches nothing)`);
  }
  assert.deepEqual(problems, []);
});

// The cost of getting this wrong is invisible until a deploy: the shell sweep would
// delete every downloaded category, so a one-line CSS fix would cost every player a
// full re-download and would strand an offline one with nothing to play.
test('activate sweeps only older builds: word pools and other sites\' caches stay', async () => {
  assert.match(sw, /const SUBJECT_CACHE='wordfinder-subjects'/, 'subjects need an unversioned cache');
  const cache = /const CACHE='([^']+)'/.exec(sw)?.[1] ?? '';
  /** @type {string[]} */
  const deleted = [];
  const caches = { keys: async () => [cache, 'wordfinder-subjects', 'wordfinder-v1', 'otherproj-v1'],
    delete: async (/** @type {string} */ k) => { deleted.push(k); return true; } };
  /** @type {Record<string, (e: object) => void>} */
  const on = {};
  const self = { clients: { claim: async () => {} }, location: new URL('https://beeberbab.github.io/word-finder/sw.js'),
    addEventListener: (/** @type {string} */ t, /** @type {(e: object) => void} */ f) => { on[t] = f; } };
  vm.runInNewContext(sw, { self, caches, URL });
  /** @type {Promise<unknown>|undefined} */
  let done;
  on.activate({ waitUntil: (/** @type {Promise<unknown>} */ p) => { done = p; } });
  await done;
  // user.github.io is one origin for every Pages site the account hosts.
  assert.deepEqual(deleted, ['wordfinder-v1']);
});

// A pool changes whenever a subject is added to it, so it takes the code path, which
// revalidates; only the cache it is kept in differs.
test('a subject module is kept in the subject cache, on the same path as code', () => {
  /** @type {string[]} */
  const opened = [];
  const handler = swFetchHandler({ open: (name) => opened.push(name) });
  answers(handler, 'https://beeberbab.github.io/word-finder/src/subjects/animals.js?retry=1');
  answers(handler, 'https://beeberbab.github.io/word-finder/src/main.js');
  assert.deepEqual(opened, ['wordfinder-subjects', /const CACHE='([^']+)'/.exec(sw)?.[1]]);
});

// Matching with ignoreSearch while storing under the full URL let a ?subject= visit pin an
// index.html that later refreshes never replaced; a coupled deploy then broke every launch.
// subjects.js's `?retry=N` loads are the same file too, and must land on the one entry.
test('same-origin code is read and refreshed under one path-only key', async () => {
  assert.ok(!/ignoreSearch\s*:/.test(sw), 'a search-blind match reads entries that refreshes never write');
  /** @param {unknown} k @returns {string} */
  const keyOf = (k) => (typeof k === 'string' ? k : /** @type {Request} */ (k).url);
  /** @type {string[]} */
  const read = [], wrote = [];
  const cache = {
    match: async (/** @type {unknown} */ k) => { read.push(keyOf(k)); },
    put: async (/** @type {unknown} */ k) => { wrote.push(keyOf(k)); },
  };
  const handler = swFetchHandler({ cache, fetch: async () => new Response('ok') });
  const base = 'https://beeberbab.github.io/word-finder/';
  for (const url of [`${base}index.html?subject=nature/birds`, `${base}src/subjects/nature.js?retry=2`]) {
    /** @type {Promise<unknown>|undefined} */
    let answer;
    handler({ request: new Request(url), respondWith(/** @type {Promise<unknown>} */ p) { answer = p; }, waitUntil() {} });
    await answer;
  }
  const keys = [`${base}index.html`, `${base}src/subjects/nature.js`];
  assert.deepEqual(read, keys, 'looked up under the full URL');
  assert.deepEqual(wrote, keys, 'stored under the full URL');
});

/** Runs sw.js against stub globals and returns the fetch listener. By default every cache
 * and fetch stays pending, which is enough to see what the handler answers and opens.
 * @param {{open?: (name: string) => void, cache?: object, fetch?: () => Promise<Response>}} [stubs]
 *   open: told each cache the handler opens; cache: what every open resolves to
 * @returns {(e: object) => void} */
function swFetchHandler({ open = () => {}, cache, fetch = () => new Promise(() => {}) } = {}) {
  /** @type {Record<string, (e: object) => void>} */
  const on = {};
  const self = {
    location: new URL('https://beeberbab.github.io/word-finder/sw.js'),
    addEventListener: (/** @type {string} */ t, /** @type {(e: object) => void} */ f) => { on[t] = f; },
  };
  const caches = {
    open: (/** @type {string} */ n) => { open(n); return cache ? Promise.resolve(cache) : new Promise(() => {}); },
  };
  vm.runInNewContext(sw, { self, caches, fetch, URL, Request, Response });
  return on.fetch;
}

/** @param {(e: object) => void} handler @param {string} url @returns {boolean} */
function answers(handler, url) {
  let took = false;
  handler({ request: new Request(url), respondWith() { took = true; }, waitUntil() {} });
  return took;
}

const BASE = 'https://beeberbab.github.io/word-finder/';
const CACHE = /const CACHE='([^']+)'/.exec(sw)?.[1] ?? '';
const PAGE = readFileSync(new URL('index.html', ROOT), 'utf8');
const SHEET = /href="(https:\/\/fonts\.googleapis\.com\/css[^"]+)"/.exec(PAGE)?.[1] ?? '';

/** Runs sw.js's install against an in-memory CacheStorage.
 * @param {Record<string, Record<string, string>>} caches name -> url -> body, before install
 * @param {(url: string, opts: {cache?: string, signal?: AbortSignal}) => Promise<Response>} fetch
 * @returns {{store: Map<string, Map<string, Response>>, installed: Promise<unknown>, budget: () => void}}
 *   budget runs carryOver's time limit now */
function install(caches, fetch) {
  const store = new Map(Object.entries(caches).map(([n, m]) => [n, new Map(Object.entries(m).map(([u, b]) => [u, new Response(b)]))]));
  /** @param {unknown} k @returns {string} */
  const keyOf = (k) => (typeof k === 'string' ? k : /** @type {{url:string}} */ (k).url);
  const cacheStorage = {
    keys: async () => [...store.keys()],
    open: async (/** @type {string} */ name) => {
      const m = store.get(name) ?? new Map();
      store.set(name, m);
      return {
        keys: async () => [...m.keys()].map(url => ({ url })),
        match: async (/** @type {unknown} */ k) => m.get(keyOf(k))?.clone(),
        put: async (/** @type {unknown} */ k, /** @type {Response} */ r) => { m.set(keyOf(k), r); },
        // The page as it is, since the fonts carried are the ones its stylesheet names.
        addAll: async (/** @type {{url:string}[]} */ reqs) => {
          for (const r of reqs) m.set(r.url, new Response(r.url === `${BASE}index.html` ? PAGE : 'precached'));
        },
      };
    },
  };
  /** @type {Record<string, (e: object) => void>} */
  const on = {};
  const self = { location: new URL(`${BASE}sw.js`), skipWaiting: () => {},
    addEventListener: (/** @type {string} */ t, /** @type {(e: object) => void} */ f) => { on[t] = f; } };
  const Request = class { constructor(/** @type {string} */ u, /** @type {{cache?:string}} */ o = {}) { this.url = new URL(u, self.location).href; this.cache = o.cache; } };
  let budget = () => {};
  vm.runInNewContext(sw, {
    self, caches: cacheStorage, URL, Request, Response, AbortController,
    // By URL only: a stored Request comes back from cache.keys() as no-cors, and refetching a font
    // with it made an opaque copy the page's cors request could not use.
    fetch: (/** @type {unknown} */ req, /** @type {{cache?:string, signal?:AbortSignal}} */ opts) => {
      assert.equal(typeof req, 'string', `fetched with a stored request: ${keyOf(req)}`);
      return fetch(keyOf(req), opts);
    },
    setTimeout: (/** @type {() => void} */ f) => { budget = f; return 0; }, clearTimeout: () => {},
  });
  /** @type {Promise<unknown>} */
  let installed = Promise.resolve();
  on.install({ waitUntil: (/** @type {Promise<unknown>} */ p) => { installed = p; } });
  return { store, installed, budget: () => budget() };
}

// A bump used to throw away, with the old cache, everything pages had loaded on demand: the first
// launch after an update, if offline, came back without its background or its fonts.
test('install carries on-demand entries into a bumped cache, each fetched again for this build', async () => {
  const font = 'https://fonts.gstatic.com/s/x.woff2', oldFont = 'https://fonts.gstatic.com/s/old.woff2';
  /** @type {string[]} */
  const fetched = [];
  const { store, installed } = install({
    'wordfinder-v1': {
      [`${BASE}src/main.js`]: 'old main',
      [`${BASE}src/backgrounds/drifting-icons.js`]: 'old drift',
      [`${BASE}src/backgrounds/gone.js`]: 'old gone',
      [`${BASE}index.html?subject=nature/birds`]: 'old page',
      [`${BASE}src/subjects/nature.js`]: 'old pool',
      // An older build's stylesheet, and a file only it named.
      'https://fonts.googleapis.com/css2?family=Space+Mono&display=swap': 'old sheet',
      [oldFont]: 'old font',
      [font]: 'font',
      'https://firestore.googleapis.com/v1/doc': 'a document',
    },
    'wordfinder-subjects': { [`${BASE}src/subjects/food.js`]: 'pool' },
    // Another Pages site on the same origin.
    'otherproj-v1': { 'https://beeberbab.github.io/otherproj/app.js': 'theirs' },
  }, async (url, opts) => {
    fetched.push(`${url} ${opts.cache}`);
    if (url.endsWith('gone.js')) return new Response('', { status: 404 });
    // This build's drift imports a module the old one never loaded, and one the shell precaches.
    if (url.endsWith('drifting-icons.js')) return new Response("import { frameLoop } from './frame-loop.js';\nimport { makeRng } from '../rng.js';");
    if (url === SHEET) return new Response(`@font-face{src:url(${font}) format('woff2')}`);
    return new Response(`new ${url}`);
  });
  await installed;
  const now = /** @type {Map<string, Response>} */ (store.get(CACHE));
  assert.match(await now.get(`${BASE}src/backgrounds/drifting-icons.js`)?.text() ?? '', /frame-loop/);
  assert.equal(await now.get(`${BASE}src/backgrounds/frame-loop.js`)?.text(), `new ${BASE}src/backgrounds/frame-loop.js`,
    'a module this build newly imports comes too, or the carried background cannot load offline');
  assert.match(await now.get(SHEET)?.text() ?? '', /@font-face/, "this build's stylesheet comes along");
  assert.equal(await now.get(font)?.text(), `new ${font}`, 'a font is fetched again, so a bad copy does not outlive the bump');
  assert.ok(!now.has(oldFont), 'a font this build no longer uses is left behind');
  assert.equal(await now.get(`${BASE}src/main.js`)?.text(), 'precached', 'what the build precaches is not fetched twice');
  assert.ok(!now.has(`${BASE}src/backgrounds/gone.js`), 'a file this build no longer has is dropped');
  assert.ok(!now.has(`${BASE}index.html?subject=nature/birds`), 'kept by path, the key the fetch handler reads');
  assert.ok(![...now.keys()].some(k => k.includes('/subjects/')), 'word pools live in their own cache');
  assert.deepEqual(fetched.sort(), [`${BASE}src/backgrounds/drifting-icons.js no-cache`, `${BASE}src/backgrounds/frame-loop.js no-cache`,
    `${BASE}src/backgrounds/gone.js no-cache`, `${SHEET} no-cache`, `${font} no-cache`].sort(),
  "only this app's own caches, and of other origins only this build's fonts");
});

// An install cut short (the browser killed mid-way) leaves what it carried in the new cache. Taking
// that as done skipped its imports on the retry, and the background could not load offline.
test('a retried install still follows the imports of what an earlier attempt carried', async () => {
  const { store, installed } = install({
    'wordfinder-v1': { [`${BASE}src/backgrounds/drifting-icons.js`]: 'old drift' },
    [CACHE]: { [`${BASE}src/backgrounds/drifting-icons.js`]: "import { frameLoop } from './frame-loop.js';" },
  }, async (url) => new Response(url.endsWith('drifting-icons.js') ? "import { frameLoop } from './frame-loop.js';" : 'loop'));
  await installed;
  assert.ok(store.get(CACHE)?.has(`${BASE}src/backgrounds/frame-loop.js`));
});

test('a request that never settles cannot hold the update back', async () => {
  const { installed, budget } = install({ 'wordfinder-v1': { [`${BASE}src/backgrounds/drifting-icons.js`]: 'old drift' } },
    (_url, opts) => new Promise((_, fail) => {
      // As fetch does: one already aborted fails at once.
      if (opts.signal?.aborted) fail(new Error('aborted'));
      opts.signal?.addEventListener('abort', () => fail(new Error('aborted')));
    }));
  let done = false;
  void installed.then(() => { done = true; });
  await new Promise((r) => setImmediate(r));
  assert.equal(done, false, 'still waiting on the stalled request');
  budget();
  await installed;
});

// A sheet that never answered used to hold the code back until the budget ran out, and then
// nothing was fetched at all: the first launch offline came back without its background.
test('a font stylesheet that stalls holds back only the fonts', async () => {
  const font = 'https://fonts.gstatic.com/s/x.woff2';
  const { store, installed, budget } = install({
    'wordfinder-v1': { [`${BASE}src/backgrounds/drifting-icons.js`]: 'old drift', [font]: 'font' },
  }, (url, opts) => url === SHEET
    ? new Promise((_, fail) => opts.signal?.addEventListener('abort', () => fail(new Error('aborted'))))
    : Promise.resolve(new Response(`new ${url}`)));
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  assert.ok(store.get(CACHE)?.has(`${BASE}src/backgrounds/drifting-icons.js`), 'carried while the sheet is still waited on');
  budget();
  await installed;
  assert.ok(!store.get(CACHE)?.has(font), 'a font goes by the sheet, which never came');
});

test('an install with no fonts to carry asks Google Fonts nothing', async () => {
  /** @type {string[]} */
  const fetched = [];
  const { installed } = install({ 'wordfinder-v1': { [`${BASE}src/backgrounds/drifting-icons.js`]: 'old drift' } },
    async (url) => { fetched.push(url); return new Response(''); });
  await installed;
  assert.deepEqual(fetched, [`${BASE}src/backgrounds/drifting-icons.js`]);
});

// Firestore document URLs have no extension, so cache-first would hand cloud.load() a
// device's first copy forever, to every account. Only Google Fonts is worth caching.
test('cross-origin GETs other than Google Fonts are left to the network', () => {
  const h = swFetchHandler();
  for (const u of [
    'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/users/u1',
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=k',
    'https://securetoken.googleapis.com/v1/token?key=k',
    'https://example.com/anything.js',
  ]) assert.equal(answers(h, u), false, `${u} must not be answered from the service worker`);
  for (const u of [
    'https://fonts.googleapis.com/css2?family=Space+Mono&display=swap',
    'https://fonts.gstatic.com/s/spacemono/v13/x.woff2',
    'https://beeberbab.github.io/word-finder/src/main.js',
    'https://beeberbab.github.io/word-finder/src/subjects/sports.js',
  ]) assert.equal(answers(h, u), true, `${u} should still be served through the caches`);
});
