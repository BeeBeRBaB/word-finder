import test from 'node:test';
import assert from 'node:assert/strict';
import { retryingImport } from '../../src/importer.js';

test('each retry after a failure asks for a URL not yet failed on, per key', async () => {
  /** @type {string[]} */ const asked = [];
  let fail = true;
  const load = retryingImport(async (/** @type {string} */ key, /** @type {string} */ query) => {
    asked.push(key + query);
    if (fail) throw new Error('offline');
    return key;
  });
  await assert.rejects(load('nature'));
  await assert.rejects(load('nature'));
  fail = false;
  assert.equal(await load('nature'), 'nature');
  assert.equal(await load('space'), 'space');
  assert.deepEqual(asked, ['nature', 'nature?retry=1', 'nature?retry=2', 'space']);
});
