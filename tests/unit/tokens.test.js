import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

const LIGHT = ':root, :root[data-appearance="light"]';
const DARK = ':root[data-appearance="dark"]';

/** The custom-property names declared inside the block that `selector` opens.
 * @param {string} selector @returns {Set<string>} */
function tokensIn(selector) {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `no \`${selector}\` block in styles.css`);
  const open = css.indexOf('{', at), close = css.indexOf('}', open);
  return new Set([...css.slice(open, close).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
}

test('the light and dark palettes declare exactly the same tokens', () => {
  const light = tokensIn(LIGHT), dark = tokensIn(DARK);
  assert.deepEqual([...dark].filter(t => !light.has(t)), [], 'declared only in the dark palette');
  assert.deepEqual([...light].filter(t => !dark.has(t)), [], 'declared only in the light palette');
  assert.ok(light.size >= 25, `only ${light.size} tokens — did the palette blocks move?`);
});

test('every var() the stylesheet references is declared in the palettes', () => {
  const declared = tokensIn(LIGHT);
  const used = new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]));
  assert.deepEqual([...used].filter(t => !declared.has(t)), [], 'referenced but never declared');
});

// effects.js builds these names by template (`--confetti-${i}`), so no var() appears
// in the stylesheet for the parity test above to catch a missing one.
test('all six confetti slots exist in both palettes', () => {
  for (const block of [LIGHT, DARK]) {
    const t = tokensIn(block);
    for (let i = 1; i <= 6; i++) assert.ok(t.has(`--confetti-${i}`), `${block} is missing --confetti-${i}`);
  }
});

// The old palette lived as bare literals in styles.css, view.js and effects.js.
// Any survivor is a colour that cannot follow the appearance setting.
test('no bare hex literal survives outside the palette blocks', () => {
  const body = css.slice(css.indexOf('}', css.indexOf(DARK)) + 1);
  assert.deepEqual(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
});
