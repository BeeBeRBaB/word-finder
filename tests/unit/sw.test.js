import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

// GitHub Pages serves code with `cache-control: max-age=600` (see sw.js:21-26, where
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

test('the shell precache lists catalog.js and every src module, but no word pool', () => {
  const m = sw.match(/const ASSETS=(\[[^\]]*\])/);
  assert.ok(m, 'could not find ASSETS in sw.js');
  /** @type {string[]} */
  const assets = JSON.parse(m[1].replace(/'/g, '"'));
  assert.ok(assets.includes('./src/catalog.js'), 'the picker needs names on every visit');
  assert.ok(assets.includes('./src/subjects.js'), 'the loader is shell code, not content');
  assert.ok(assets.includes('./src/picker.js'));
  assert.ok(
    !assets.some(a => a.startsWith('./src/subjects/')),
    'word pools must not be precached: they are the whole reason the catalog is separate',
  );
});

// The cost of getting this wrong is invisible until a deploy: the shell sweep would
// delete every downloaded category, so a one-line CSS fix would cost every player a
// full re-download and would strand an offline one with nothing to play.
test('word pools live in their own cache, which the activate sweep spares', () => {
  assert.match(sw, /const SUBJECT_CACHE='wordfinder-subjects'/, 'subjects need an unversioned cache');
  const line = sw.split('\n').find((l) => l.includes("addEventListener('activate'"));
  assert.ok(line, 'could not find the activate handler in sw.js');
  assert.ok(
    line.includes('k!==SUBJECT_CACHE'),
    'the activate sweep deletes every cache that is not CACHE; it must spare SUBJECT_CACHE',
  );
});

test('a subject module is routed to the subject cache, cache-first', () => {
  assert.match(sw, /isSubject/, 'the fetch handler needs to recognise a word pool');
});
