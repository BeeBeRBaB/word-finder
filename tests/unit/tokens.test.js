import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

// Palette parity (below) is direction-agnostic — it doesn't care which selector is
// the attribute-less default, only that both blocks declare the same tokens. Named
// for what's structurally true after the selector swap: DEFAULT_DARK is the block
// that also matches bare `:root`; LIGHT_ONLY only ever matches with the attribute set.
const DEFAULT_DARK = ':root, :root[data-appearance="dark"]';
const LIGHT_ONLY = ':root[data-appearance="light"]';

/** The custom-property names declared inside the block that `selector` opens.
 * @param {string} selector @returns {Set<string>} */
function tokensIn(selector) {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `no \`${selector}\` block in styles.css`);
  const open = css.indexOf('{', at), close = css.indexOf('}', open);
  return new Set([...css.slice(open, close).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
}

test('the light and dark palettes declare exactly the same tokens', () => {
  const dark = tokensIn(DEFAULT_DARK), light = tokensIn(LIGHT_ONLY);
  assert.deepEqual([...dark].filter(t => !light.has(t)), [], 'declared only in the dark palette');
  assert.deepEqual([...light].filter(t => !dark.has(t)), [], 'declared only in the light palette');
  assert.ok(light.size >= 25, `only ${light.size} tokens — did the palette blocks move?`);
});

test('every var() the stylesheet references is declared in the palettes', () => {
  const declared = tokensIn(DEFAULT_DARK);
  const used = new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]));
  assert.deepEqual([...used].filter(t => !declared.has(t)), [], 'referenced but never declared');
});

// effects.js builds these names by template (`--confetti-${i}`), so no var() appears
// in the stylesheet for the parity test above to catch a missing one.
test('all six confetti slots exist in both palettes', () => {
  for (const block of [DEFAULT_DARK, LIGHT_ONLY]) {
    const t = tokensIn(block);
    for (let i = 1; i <= 6; i++) assert.ok(t.has(`--confetti-${i}`), `${block} is missing --confetti-${i}`);
  }
});

// The old palette lived as bare literals in styles.css, view.js and effects.js.
// Any survivor is a colour that cannot follow the appearance setting. The two palette
// blocks can appear in either order in the stylesheet (dark leads as of the
// attribute-less-default swap), so this locates the closing brace of *whichever*
// block ends last, rather than assuming DEFAULT_DARK is second — hard-coding one
// block's position silently scans an empty (or wrong) string the moment the file
// order changes again.
test('no bare hex literal survives outside the palette blocks', () => {
  const closeOf = (selector) => {
    const at = css.indexOf(selector);
    const open = css.indexOf('{', at);
    return css.indexOf('}', open);
  };
  const lastClose = Math.max(closeOf(DEFAULT_DARK), closeOf(LIGHT_ONLY));
  const body = css.slice(lastClose + 1);
  assert.ok(body.length > 100, 'suspiciously little CSS left after the palette blocks — did the slice point go wrong?');
  assert.deepEqual(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
});
