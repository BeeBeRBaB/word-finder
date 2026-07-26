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
// The type tokens (--display, --utility) are the only non-colour tokens in the file.
// They are appearance-independent, so they live in one bare `:root` block instead of
// being written into both palettes — and that block is kept first in styles.css so
// this plain `:root` lookup finds it rather than the dark palette's own selector,
// which also starts with `:root`.
const TYPE = ':root';

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

test('the type block is first, so it is what a bare `:root` lookup finds', () => {
  const type = tokensIn(TYPE);
  assert.deepEqual([...type].sort(), ['--display', '--utility'],
    'the first `:root` block in styles.css is not the type block — did the palettes move above it?');
});

test('every var() the stylesheet references is declared in the palettes or the type block', () => {
  const declared = new Set([...tokensIn(DEFAULT_DARK), ...tokensIn(TYPE)]);
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

// Three numbers are written in both a module and the stylesheet, and each is commented
// "must match" with nothing checking. A drift renders wrong rather than throwing: the
// grid overlaps the rail, the solved mark is cropped, or a word strikes out mid-glow.
test('the numbers shared between a module and the stylesheet agree', () => {
  /** @param {string} p @returns {string} */
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  /** @param {string} src @param {RegExp} re @param {string} what @returns {number} */
  const num = (src, re, what) => {
    const m = src.match(re);
    assert.ok(m, `could not find ${what} — did it get renamed?`);
    return Number(m[1]);
  };
  assert.equal(
    num(read('../../src/layout.js'), /const GAP = (\d+)/, 'GAP in layout.js'),
    num(css, /#app\[data-landscape\]\{[^}]*column-gap:(\d+)px/, "#app[data-landscape]'s column-gap"),
    'layout.js reserves a different landscape gap than the stylesheet draws');
  assert.equal(
    num(read('../../src/view.js'), /SOLVED_BOX = (\d+)/, 'SOLVED_BOX in view.js'),
    num(css, /#solved\{[^}]*width:(\d+)px/, "#solved's width"),
    'renderSolvedShape lays out against a different box than #solved draws');
  assert.equal(
    num(read('../../src/main.js'), /const GLOW_MS = (\d+)/, 'GLOW_MS in main.js'),
    num(css, /\.w\.glow\{[^}]*animation:foundGlow ([\d.]+)s/, "the foundGlow duration") * 1000,
    'main.js strikes a word through at a different moment than the glow ends');
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
