// Cascade check of the theme CSS, in a real browser. For every theme x flavour, and for an
// absent or unknown theme or flavour, every token and color-scheme computes exactly what the
// look's own block in styles.css declares. The look is what normalizeTheme and normalizePref
// make of the attributes, so an unknown theme gets the default's blocks and no flavour gets dark.
//   node tools/sims/appearance/cascade.mjs
//   CSS=/tmp/candidate.css node tools/sims/appearance/cascade.mjs
// Exits 1 on any problem.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { serve, REPO } from '../site.mjs';
import { THEMES, PREFS, normalizeTheme, normalizePref } from '../../../src/appearance.js';

const css = fs.readFileSync(process.env.CSS || path.join(process.env.SITE || REPO, 'styles.css'), 'utf8');
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, sel, body]) => ({ sels: sel.split(',').map((s) => s.trim()), body }));
const problems = [];

/** A look's declarations, var() resolved within the block: the one rule listing
 * :root[data-theme="t"][data-appearance="p"], or :root[data-appearance="p"] for the default theme. */
function declared(theme, pref) {
  const sel = `:root${theme === THEMES[0] ? '' : `[data-theme="${theme}"]`}[data-appearance="${pref}"]`;
  const hits = rules.filter((r) => r.sels.includes(sel));
  if (hits.length !== 1) { problems.push(`${hits.length} blocks list ${sel}`); return {}; }
  const own = Object.fromEntries([...hits[0].body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
  const sub = (v) => v.replace(/var\((--[\w-]+)\)/g, (m, n) => (own[n] === undefined ? m : sub(own[n])));
  return Object.fromEntries(Object.entries(own).map(([k, v]) => [k, sub(v)]));
}
const LOOKS = Object.fromEntries(THEMES.flatMap((t) => PREFS.map((p) => [`${t}/${p}`, declared(t, p)])));
const TOKENS = [...new Set(Object.values(LOOKS).flatMap(Object.keys))];

const site = await serve();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
if (process.env.CSS) await page.route('**/styles.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
await page.goto(site.url + '/?seed=3&subject=sports/golf');
await page.waitForSelector('.cell');

let cases = 0;
for (const theme of [...THEMES, null, 'neon', 'Grove']) for (const pref of [...PREFS, null, 'system']) {
  const look = `${normalizeTheme(theme)}/${normalizePref(pref)}`;
  // Both sides go through the same probe, so colours compare by value and the rest as text.
  const diffs = await page.evaluate(([attrs, want, tokens]) => {
    const h = document.documentElement;
    for (const [k, v] of Object.entries(attrs)) { if (v === null) h.removeAttribute('data-' + k); else h.setAttribute('data-' + k, v); }
    const cs = getComputedStyle(h);
    const probe = document.body.appendChild(document.createElement('div'));
    const norm = (v) => {
      if (v === undefined) return '(not declared)';
      v = v.trim().replace(/\s+/g, ' ');
      probe.style.color = ''; probe.style.color = v;
      return probe.style.color ? getComputedStyle(probe).color : v;
    };
    const out = tokens.map((t) => [t, norm(want[t]), norm(cs.getPropertyValue(t))]).filter(([, w, g]) => w !== g);
    probe.remove();
    return out;
  }, [{ theme, appearance: pref }, LOOKS[look], TOKENS]);
  for (const [t, w, g] of diffs) problems.push(`${theme}/${pref} (${look}) ${t}: declared ${w} computed ${g}`);
  cases++;
}
console.log(`${cases} attribute pairs checked against ${Object.keys(LOOKS).length} looks' blocks, ${TOKENS.length} properties each`);
console.log('PROBLEMS', problems.length); for (const p of problems) console.log('  ' + p);
await b.close(); site.close();
if (problems.length) process.exitCode = 1;
