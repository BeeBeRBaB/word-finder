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

// Every [data-theme] block, found by selector rather than listed, so a theme added to the
// stylesheet is covered without touching this file.
const THEME_BLOCKS = [...css.matchAll(/^(:root\[data-theme="[\w-]+"\][^{]*)\{/gm)].map(m => m[1].trim());

test('every theme block declares exactly the default palette\'s tokens', () => {
  const dark = tokensIn(DEFAULT_DARK);
  assert.ok(THEME_BLOCKS.length >= 2, 'no theme blocks found — did the selector shape change?');
  for (const sel of THEME_BLOCKS) {
    const t = tokensIn(sel);
    assert.deepEqual([...dark].filter(x => !t.has(x)), [], `${sel} is missing tokens`);
    assert.deepEqual([...t].filter(x => !dark.has(x)), [], `${sel} declares tokens the default palette does not`);
  }
});

test('every theme has both a dark and a light block, and appearance.js lists exactly those themes', async () => {
  const { THEMES } = await import('../../src/appearance.js');
  const inCss = [...new Set(THEME_BLOCKS.map(s => /** @type {RegExpMatchArray} */ (s.match(/data-theme="([\w-]+)"/))[1]))];
  for (const k of inCss) {
    assert.ok(THEME_BLOCKS.some(s => s.startsWith(`:root[data-theme="${k}"], `)), `${k} has no dark block`);
    assert.ok(THEME_BLOCKS.includes(`:root[data-theme="${k}"][data-appearance="light"]`), `${k} has no light block`);
  }
  // The default theme rides on the base blocks and has no block of its own.
  assert.deepEqual([...inCss].sort(), THEMES.filter(t => t !== THEMES[0]).slice().sort());
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

// main.js reads these names by template (`--confetti-${i}`), so no var() appears
// in the stylesheet for the parity test above to catch a missing one.
test('all six confetti slots exist in both palettes', () => {
  for (const block of [DEFAULT_DARK, LIGHT_ONLY]) {
    const t = tokensIn(block);
    for (let i = 1; i <= 6; i++) assert.ok(t.has(`--confetti-${i}`), `${block} is missing --confetti-${i}`);
  }
});

// Numbers written in both a module and the stylesheet, each commented "must match". A drift
// renders wrong rather than throwing: the grid overlaps the rail, the solved mark is cropped,
// a word strikes out mid-glow, the next-puzzle bar drains at a different pace than the deal,
// or a pane is placed for a card on a screen that shows it as a page.
/** @param {string} p @returns {string} */
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
/** @param {string} src @param {RegExp} re @param {string} what @returns {number} */
const num = (src, re, what) => {
  const m = src.match(re);
  assert.ok(m, `could not find ${what} — did it get renamed?`);
  return Number(m[1]);
};

test('the numbers shared between a module and the stylesheet agree', () => {
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
  const main = read('../../src/main.js');
  assert.equal(
    num(main, /const AUTO_NEXT_MS = (\d+)/, 'AUTO_NEXT_MS in main.js'),
    num(css, /#winnext\.run #winbar i\{animation:drain ([\d.]+)s/, 'the drain duration') * 1000,
    'the next-puzzle bar empties at a different moment than the deal');
});

test('the illustration tones in the stylesheet are art.js\'s', async () => {
  const { TONE } = await import('../../src/art.js');
  for (const [k, v] of Object.entries(TONE)) {
    assert.equal(num(css, new RegExp(`#art \\.t-${k},#railart \\.t-${k}\\{fill-opacity:([\\d.]+)\\}`), `#art .t-${k}`), v, `tone ${k}`);
  }
});

test('main.js places panes at the same breakpoints the stylesheet lays them out at', () => {
  const main = read('../../src/main.js');
  const page = /** @type {RegExpMatchArray} */ (main.match(/const SETTINGS_PAGE = '([^']+)'/));
  assert.ok(page, 'could not find SETTINGS_PAGE in main.js');
  assert.ok(css.includes(`@media ${page[1]}{\n  #settings{`), `no \`@media ${page[1]}\` block styles #settings as a page`);
  assert.equal(
    num(main, /innerWidth < (\d+)/, "anchorPane's width cut-off"),
    num(css, /@media \(min-width:(\d+)px\)\{\s*#picker,#settings\{/, 'the pane card breakpoint'),
    'anchorPane anchors a card the stylesheet draws as a full-width sheet, or the reverse');
  assert.equal(
    num(main, /innerHeight > (\d+)/, "anchorPane's height cut-off"),
    num(css, /@media \(min-width:\d+px\) and \(max-height:(\d+)px\)\{\s*#picker,#settings\{padding-top/, 'the short-screen pane breakpoint'),
    'anchorPane drops a pane under the header on a screen the stylesheet pins it to the top');
});

// The category list is laid out as a fixed number of rows so it fills by column. Adding a
// category without updating it would spill into a third, implicit column off the list.
test('the category list rows match the catalog', async () => {
  const { CATEGORIES } = await import('../../src/catalog.js');
  const m = css.match(/#picker-select:open::picker\(select\)\{[^}]*grid-template-rows:repeat\((\d+),auto\)/);
  assert.ok(m, 'could not find the category list row count in styles.css');
  assert.equal(Number(m[1]), Math.ceil((CATEGORIES.length + 1) / 2));
});

// The old palette lived as bare literals in styles.css, view.js and effects.js.
// Any survivor is a colour that cannot follow the appearance setting. The two palette
// blocks can appear in either order in the stylesheet (dark leads as of the
// attribute-less-default swap), so this locates the closing brace of *whichever*
// block ends last, rather than assuming DEFAULT_DARK is second — hard-coding one
// block's position silently scans an empty (or wrong) string the moment the file
// order changes again.
test('no bare colour literal survives outside the palette blocks', () => {
  const closeOf = (selector) => {
    const at = css.indexOf(selector);
    const open = css.indexOf('{', at);
    return css.indexOf('}', open);
  };
  const lastClose = Math.max(closeOf(DEFAULT_DARK), closeOf(LIGHT_ONLY), ...THEME_BLOCKS.map(closeOf));
  const body = css.slice(lastClose + 1);
  assert.ok(body.length > 100, 'suspiciously little CSS left after the palette blocks — did the slice point go wrong?');
  assert.deepEqual(body.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], [], 'hex');
  assert.deepEqual(body.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^)]*\)/g) ?? [], [], 'colour functions');
});
