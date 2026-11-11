import test from 'node:test';
import assert from 'node:assert/strict';
import { GLASS_SHARES, glassVars } from '../../src/glass-shares.js';
import { BACKGROUNDS } from '../../src/backgrounds.js';

// Subject motion runs another background and takes that one's glass (main.js), so it has none.
test('every background but Subject motion has its own glass in both flavours, and nothing else does', () => {
  assert.deepEqual(Object.keys(GLASS_SHARES).sort(), BACKGROUNDS.map(b => b.id).filter(id => id !== 'motion').sort());
  for (const [id, s] of Object.entries(GLASS_SHARES)) for (const pref of /** @type {const} */ (['dark', 'light'])) {
    assert.equal(s[pref].length, 2, `${id} ${pref}`);
    // Steps of 5 from the margin up: glass-shares.mjs never writes less than its margin over a need of 0.
    for (const v of s[pref]) assert.ok(Number.isInteger(v / 5) && v >= 10 && v <= 100, `${id} ${pref} ${v}`);
  }
});

test('the custom properties carry a background\'s shares in its flavour, or remove them', () => {
  const [id] = Object.keys(GLASS_SHARES);
  const { dark, light } = GLASS_SHARES[id];
  assert.deepEqual(glassVars(id, 'light'), [['--clear-board', `${light[0]}%`], ['--clear-list', `${light[1]}%`]]);
  assert.deepEqual(glassVars(id, 'dark').map(([, v]) => v), dark.map(v => `${v}%`));
  assert.deepEqual(glassVars(id, 'anything else').map(([, v]) => v), dark.map(v => `${v}%`));
  assert.deepEqual(glassVars('no-such-background', 'dark'), [['--clear-board', ''], ['--clear-list', '']]);
});
