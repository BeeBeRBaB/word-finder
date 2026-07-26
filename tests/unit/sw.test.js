import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const sw = readFileSync(new URL('sw.js', ROOT), 'utf8');

/** @returns {string[]} */
function assets() {
  const m = sw.match(/const ASSETS=(\[[^\]]*\])/);
  assert.ok(m, 'could not find ASSETS in sw.js');
  return JSON.parse(m[1].replace(/'/g, '"'));
}

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
  const list = assets();
  assert.ok(list.includes('./src/catalog.js'), 'the picker needs names on every visit');
  assert.ok(list.includes('./src/subjects.js'), 'the loader is shell code, not content');
  assert.ok(list.includes('./src/picker.js'));
  assert.ok(
    !list.some(a => a.startsWith('./src/subjects/')),
    'word pools must not be precached: they are the whole reason the catalog is separate',
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
